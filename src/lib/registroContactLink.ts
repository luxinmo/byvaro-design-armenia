/**
 * registroContactLink.ts · sincronización Registro → Contact.
 *
 * Cuando el promotor aprueba un registro, el cliente debe quedar
 * registrado en el CRM (`/contactos`) como un Contact aunque sea con
 * datos mínimos. Mañana, cuando se programe una visita o empiece una
 * venta, se enriquece. La regla de negocio:
 *
 *   - Buscar Contact existente por email normalizado o teléfono E.164.
 *   - Si existe → añadir entrada `lead_entry` al timeline.
 *   - Si no existe → crear Contact "skeleton" con lo que haya
 *     (nombre + nacionalidad como mínimo) + flag `sourceType:
 *     "registration"` + evento `contact_created`.
 *   - Devolver `{ contactId, created }` para que el caller pueda
 *     enlazar `registro.contactId = contactId` y mostrar feedback.
 *
 * TODO(backend): POST /api/registrations/:id/approve hace este upsert
 * server-side en una sola transacción (idempotente).
 */

import type { Contact, ContactRecordEntry } from "@/components/contacts/types";
import { MOCK_CONTACTS } from "@/components/contacts/data";
import {
  loadCreatedContacts, saveCreatedContact, generateContactId, nextContactReference,
} from "@/components/contacts/createdContactsStorage";
import { loadImportedContacts } from "@/components/contacts/importedStorage";
import {
  recordContactCreated, recordTypeAny,
} from "@/components/contacts/contactEventsStorage";
import type { Registro } from "@/data/records";
import { agencies } from "@/data/agencies";
import { promotions } from "@/data/promotions";
import type { ContactOrigin } from "@/components/contacts/types";
import { appendOrigin } from "@/lib/contactOrigins";
import { recordActivity } from "@/lib/contactActivity";

/* ══════ Helpers de normalización ══════════════════════════════════ */

function normEmail(s?: string): string {
  return (s ?? "").trim().toLowerCase();
}
function normPhone(s?: string): string {
  return (s ?? "").replace(/\D/g, "");
}

/** Devuelve el universo de contactos visible (seed + creados +
 *  importados) para el lookup. */
function loadAllContacts(): Contact[] {
  return [
    ...loadCreatedContacts(),
    ...loadImportedContacts(),
    ...MOCK_CONTACTS,
  ];
}

/** Busca un contacto por email o teléfono. Devuelve undefined si no
 *  hay match razonable. */
function findContact(registro: Registro, all: Contact[]): Contact | undefined {
  const email = normEmail(registro.cliente.email);
  const phone = normPhone(registro.cliente.telefono);
  if (!email && !phone) return undefined;
  return all.find((c) => {
    if (email && normEmail(c.email) === email) return true;
    if (phone && normPhone(c.phone) === phone) return true;
    return false;
  });
}

/* ══════ Crear / actualizar contacto desde un registro ════════════ */

export type UpsertResult = {
  contactId: string;
  created: boolean;
  contactName: string;
};

/** Crea o actualiza un Contact a partir de un Registro recién aprobado.
 *  Idempotente · si ya hay contacto por email/teléfono, solo añade
 *  evento `lead_entry` al timeline. */
export function upsertContactFromRegistro(
  registro: Registro,
  by: { name: string; email?: string },
): UpsertResult {
  const all = loadAllContacts();
  const existing = findContact(registro, all);
  const promo = promotions.find((p) => p.id === registro.promotionId);
  const promoName = promo?.name ?? "Promoción";
  const agency = registro.agencyId
    ? agencies.find((a) => a.id === registro.agencyId)
    : undefined;
  const sourceLabel = agency?.name
    ?? (registro.origen === "direct" ? "Promotor directo" : "Agencia colaboradora");

  const nowIso = new Date().toISOString();
  /* Origen estructurado del Registro · se usa en ambos paths (existente
     y nuevo) para alimentar `Contact.origins[]` y `lastActivityAt`. */
  const incomingOrigin: ContactOrigin = {
    source: registro.origen === "collaborator" ? "agency" : "direct",
    label: sourceLabel,
    occurredAt: nowIso,
    promotionId: registro.promotionId,
    agencyId: registro.agencyId,
    refId: registro.id,
    refType: "registro",
  };

  /* ── Caso 1 · El contacto ya existe · acumula origen + actividad. ── */
  if (existing) {
    /* Actualiza el Contact en su storage correspondiente con el nuevo
       origen + lastActivityAt. Solo aplicamos a contactos creados
       (los seeds e imported son read-only en mock). */
    const created = loadCreatedContacts();
    const idx = created.findIndex((c) => c.id === existing.id);
    if (idx >= 0) {
      const updated = recordActivity(
        appendOrigin(created[idx], incomingOrigin),
        "lead_entry",
        nowIso,
      );
      saveCreatedContact(updated);
    }
    recordTypeAny(
      existing.id,
      "lead_entry",
      `Nuevo registro · ${promoName}`,
      `Registro aprobado · origen: ${sourceLabel}`,
      by,
    );
    return { contactId: existing.id, created: false, contactName: existing.name };
  }

  /* ── Caso 2 · Crear contacto skeleton. ── */
  const id = generateContactId(registro.cliente.nombre);
  const publicRef = nextContactReference(all);
  const newContact: Contact = {
    id,
    reference: publicRef, // alias legacy · derivado de publicRef
    publicRef,
    kind: "individual",
    name: registro.cliente.nombre,
    email: registro.cliente.email,
    phone: registro.cliente.telefono,
    nationality: registro.cliente.nacionalidad,
    nationalityIso: registro.cliente.nationalityIso,
    tags: [],
    source: sourceLabel,             // legacy · alias de primarySource.label
    sourceType: "registration",       // legacy
    primarySource: incomingOrigin,    // ← canónico
    latestSource: incomingOrigin,
    origins: [incomingOrigin],
    lastActivityAt: nowIso,
    status: "pending",
    lastActivity: "Hoy",
    firstSeen: new Date().toLocaleDateString("es-ES", {
      day: "numeric", month: "short", year: "numeric",
    }),
    activeOpportunities: 0,
    hasUpcomingVisit: registro.tipo === "registration_visit",
    hasVisitDone: false,
    hasRecentWebActivity: false,
    totalRegistrations: 1,
    promotionsOfInterest: [promoName],
    /* Asignar al promotor que decidió · si no, vacío. */
    assignedToUserIds: registro.decidedByUserId ? [registro.decidedByUserId] : [],
    assignedTo: registro.decidedBy ? [registro.decidedBy] : [],
    notes: registro.notas,
    /* Si lo trajo una agencia colaboradora, marcamos owner para que
     *  los datos sensibles no se mezclen cross-agency. Si lo creó el
     *  promotor directo, sin owner. */
    ownerAgencyId: registro.agencyId,
  };
  saveCreatedContact(newContact);
  recordContactCreated(id, by);
  recordTypeAny(
    id,
    "lead_entry",
    `Nuevo registro · ${promoName}`,
    `Origen: ${sourceLabel} · ${nowIso.slice(0, 10)}`,
    by,
  );
  return { contactId: id, created: true, contactName: newContact.name };
}

/** Helper "shape" para alinear con `ContactRecordEntry` cuando luego
 *  se enlace al detalle del contacto · TODO(fase-2). */
export function toContactRecordEntry(
  registro: Registro,
  promotionName: string,
  agencyName: string | null,
): ContactRecordEntry {
  return {
    id: registro.id,
    promotionId: registro.promotionId,
    promotionName,
    agent: registro.decidedBy ?? "Promotor",
    source: agencyName ?? "Directo",
    status: registro.estado === "aprobado" ? "approved" : "pending",
    timestamp: registro.fecha,
  };
}
