/**
 * invitationContacts.ts · Crea contactos cruzados al invitar / aceptar
 * una colaboración promotor ↔ agencia.
 *
 * Cuando el promotor envía una invitación a una agencia:
 *   · Lado promotor → la AGENCIA se persiste como Contact (kind=company)
 *     en el CRM del promotor con `primarySource.source = "agency"` y
 *     label "Invitación enviada · {fecha}". El admin la ve aparecer en
 *     /contactos como cualquier otro contacto empresa.
 *
 * Cuando la agencia ACEPTA la invitación:
 *   · Lado agencia → el PROMOTOR se persiste como Contact (kind=company)
 *     en el CRM de la agencia (con `ownerAgencyId = agencyId`) con
 *     `primarySource.source = "referral"` y label "Promotor · invitación
 *     aceptada".
 *
 * Helpers IDEMPOTENTES · si el contacto ya existe (búsqueda por
 * `companyTaxId` o `email` o `meta.invitacionId`) NO se duplica.
 *
 * TODO(backend): cuando llegue la API real, esta lógica se mueve al
 * handler de `POST /api/agencies/invite` y `POST /api/invitations/accept`
 * — el backend debe hacer ambos UPSERTs de forma atómica con la
 * persistencia de la propia invitación. Ver `docs/backend-integration.md
 * §16 · Contactos bidireccionales en colaboración`.
 */

import type { Contact, ContactOrigin } from "@/components/contacts/types";
import { MOCK_CONTACTS } from "@/components/contacts/data";
import {
  loadCreatedContacts, saveCreatedContact, generateContactId,
} from "@/components/contacts/createdContactsStorage";
import { loadImportedContacts } from "@/components/contacts/importedStorage";
import { generatePublicRef } from "@/lib/publicRef";
import type { Agency } from "@/data/agencies";
import type { Empresa } from "@/lib/empresa";

/* ─── Universo de contactos para idempotencia + numeración ──────────── */
function universeForRef(): Contact[] {
  return [...MOCK_CONTACTS, ...loadImportedContacts(), ...loadCreatedContacts()];
}

/** Hoy humanizado · alineado con el resto de creación de contactos. */
function todayHuman(): string {
  return new Date().toLocaleDateString("es-ES", {
    day: "numeric", month: "short", year: "numeric",
  });
}

/* ═══════════════════════════════════════════════════════════════════
   Lado PROMOTOR · al enviar invitación → crea contacto de la agencia
   ═══════════════════════════════════════════════════════════════════ */

export interface EnsurePromoterContactInput {
  /** Datos de la agencia · si la invitación parte de una existente
   *  (`agencyId` set), pasamos el objeto entero para tomar logo,
   *  location, etc. Si es a un email externo (no existe agencia
   *  todavía), se pasa solo el nombre + email. */
  agency?: Pick<Agency, "id" | "name" | "logo" | "location"> & { logo?: string };
  /** Email de la agencia destinataria · siempre disponible en la
   *  invitación. */
  emailAgencia: string;
  /** Nombre de la agencia (puede ser vacío si la invitación va a un
   *  email externo y el promotor no rellenó el nombre). */
  nombreAgencia?: string;
  /** Id de la invitación · queda en `meta.invitacionId` para trazabilidad
   *  y para que el helper sea idempotente entre llamadas. */
  invitacionId: string;
  /** Promoción asociada (opcional · solo si la invitación se hizo desde
   *  el flujo "Compartir promoción"). */
  promocionId?: string;
  promocionNombre?: string;
}

/**
 * Crea (o devuelve el existente) el Contact de la AGENCIA en el CRM
 * del promotor. Idempotente vía email + invitacionId.
 *
 * Devuelve el Contact (creado o pre-existente) para que el caller
 * pueda registrar eventos sobre él si lo necesita.
 */
export function ensurePromoterContactForAgency(
  input: EnsurePromoterContactInput,
): Contact {
  const universe = universeForRef();
  const emailLower = input.emailAgencia.trim().toLowerCase();
  const displayName = (input.nombreAgencia?.trim() || input.agency?.name?.trim() || input.emailAgencia).trim();

  /* Idempotencia · busca primero por invitacionId, luego por email
   * exacto. Si encuentra algo, devuelve sin crear. */
  const existing = universe.find((c) => {
    const meta = c.primarySource?.meta;
    if (meta && meta.invitacionId === input.invitacionId) return true;
    if (c.kind === "company" && c.email && c.email.toLowerCase() === emailLower) return true;
    return false;
  });
  if (existing) return existing;

  const nowIso = new Date().toISOString();
  const origin: ContactOrigin = {
    source: "agency",
    label: input.agency?.name
      ? `Invitación enviada · ${input.agency.name}`
      : "Invitación enviada",
    occurredAt: nowIso,
    agencyId: input.agency?.id,
    refId: input.invitacionId,
    refType: "manual",
    promotionId: input.promocionId,
    meta: {
      invitacionId: input.invitacionId,
      ...(input.promocionNombre ? { promocion: input.promocionNombre } : {}),
    },
  };

  const publicRef = generatePublicRef("contact", universe);
  const id = generateContactId(displayName);

  const newContact: Contact = {
    id,
    reference: publicRef,
    publicRef,
    kind: "company",
    companyName: displayName,
    tradeName: displayName,
    name: displayName,
    email: input.emailAgencia,
    avatarUrl: input.agency?.logo,
    tags: [],
    source: origin.label,
    sourceType: "direct",
    primarySource: origin,
    latestSource: origin,
    origins: [origin],
    lastActivityAt: nowIso,
    status: "pending",
    lastActivity: "Hoy",
    firstSeen: todayHuman(),
    activeOpportunities: 0,
    hasUpcomingVisit: false,
    hasVisitDone: false,
    hasRecentWebActivity: false,
    totalRegistrations: 0,
    promotionsOfInterest: input.promocionNombre ? [input.promocionNombre] : [],
    assignedTo: [],
    notes: input.agency?.location ? `Ubicación: ${input.agency.location}` : undefined,
    /* Lado promotor · contacto pertenece al tenant del promotor
     * (no `ownerAgencyId`). */
    ownerAgencyId: undefined,
  };
  saveCreatedContact(newContact);
  return newContact;
}

/* ═══════════════════════════════════════════════════════════════════
   Lado AGENCIA · al ACEPTAR invitación → crea contacto del promotor
   ═══════════════════════════════════════════════════════════════════ */

export interface EnsureAgencyContactInput {
  /** Id de la agencia que está aceptando · sirve como `ownerAgencyId`
   *  del contacto creado · garantiza el aislamiento multi-tenant. */
  agencyId: string;
  /** Datos del promotor que invitó · cogidos del estado de
   *  `useEmpresa()` en el lado promotor (en mock actual) o del payload
   *  de la invitación (en backend real). */
  promotor: Pick<Empresa, "nombreComercial" | "razonSocial" | "cif" | "email" | "telefono" | "logoUrl"> & {
    /** Id del workspace promotor · cuando exista (Phase 2). Por ahora
     *  se queda en `undefined` y referenciamos por nombre. */
    promotorId?: string;
  };
  /** Id de la invitación que se está aceptando · idempotencia. */
  invitacionId: string;
}

/**
 * Crea (o devuelve el existente) el Contact del PROMOTOR en el CRM
 * de la agencia. Idempotente vía CIF + invitacionId.
 */
export function ensureAgencyContactForPromoter(
  input: EnsureAgencyContactInput,
): Contact {
  const universe = universeForRef();
  const cifLower = input.promotor.cif?.trim().toLowerCase();
  const emailLower = input.promotor.email?.trim().toLowerCase();
  const displayName = input.promotor.nombreComercial?.trim()
    || input.promotor.razonSocial?.trim()
    || "Promotor";

  /* Idempotencia · invitacionId > CIF > email. */
  const existing = universe.find((c) => {
    if (c.ownerAgencyId !== input.agencyId) return false;
    const meta = c.primarySource?.meta;
    if (meta && meta.invitacionId === input.invitacionId) return true;
    if (c.kind === "company" && cifLower && c.companyTaxId?.toLowerCase() === cifLower) return true;
    if (c.kind === "company" && emailLower && c.email?.toLowerCase() === emailLower) return true;
    return false;
  });
  if (existing) return existing;

  const nowIso = new Date().toISOString();
  /* Label neutro · "Empresa colaboradora" en vez de "Promotor" porque
   * el otro lado puede ser promotor o comercializador (CLAUDE.md regla
   * de oro · `getOwnerRoleLabel`). El nombre comercial real ya queda
   * en `companyName` · aquí solo describimos cómo entró este contacto. */
  const origin: ContactOrigin = {
    source: "referral",
    label: `Empresa colaboradora · invitación aceptada`,
    occurredAt: nowIso,
    refId: input.invitacionId,
    refType: "manual",
    meta: {
      invitacionId: input.invitacionId,
      empresa: displayName,
    },
  };

  const publicRef = generatePublicRef("contact", universe);
  const id = generateContactId(displayName);

  const newContact: Contact = {
    id,
    reference: publicRef,
    publicRef,
    kind: "company",
    companyName: displayName,
    tradeName: input.promotor.nombreComercial || undefined,
    companyTaxId: input.promotor.cif || undefined,
    name: displayName,
    email: input.promotor.email || undefined,
    phone: input.promotor.telefono || undefined,
    avatarUrl: input.promotor.logoUrl || undefined,
    tags: [],
    source: origin.label,
    sourceType: "direct",
    primarySource: origin,
    latestSource: origin,
    origins: [origin],
    lastActivityAt: nowIso,
    status: "active",
    lastActivity: "Hoy",
    firstSeen: todayHuman(),
    activeOpportunities: 0,
    hasUpcomingVisit: false,
    hasVisitDone: false,
    hasRecentWebActivity: false,
    totalRegistrations: 0,
    promotionsOfInterest: [],
    assignedTo: [],
    /* Tenant scoping · este contacto vive en el CRM de la agencia. */
    ownerAgencyId: input.agencyId,
  };
  saveCreatedContact(newContact);
  return newContact;
}
