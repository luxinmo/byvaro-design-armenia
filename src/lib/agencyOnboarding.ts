/**
 * agencyOnboarding.ts · Estado de setup inicial de una agencia recién
 * dada de alta vía `/invite/:token` (caso 1).
 *
 * Cuando un usuario nuevo crea su workspace de agencia desde una
 * invitación, queremos preguntarle UNA VEZ si él es la persona
 * responsable de la agencia (dueño / director · admin total) o si
 * solo está iniciando el alta y quiere invitar a otra persona como
 * Responsible para que tome ese rol.
 *
 * Si elige:
 *   · "Soy el Responsable"   → keeps role admin · setup completed.
 *   · "Añadir un Responsable" → mete email del responsable real,
 *     se le envía invitación, el usuario actual queda como member.
 *     (Hoy mock · solo guardamos la decisión + downgrade local.)
 *
 * El flag se guarda por agencyId · una vez completado, no se vuelve
 * a preguntar nunca más en esa agencia.
 *
 * TODO(backend): mover a `agency_onboarding(agency_id, completed_at,
 * responsible_choice, pending_responsible_email)` con RLS.
 */

const STATE_KEY = "byvaro.agencies.onboarding.v1";

export type ResponsibleChoice = "self" | "invite_other";

export interface AgencyOnboardingState {
  agencyId: string;
  completedAt?: string;          // ISO · undefined hasta que el user decide
  responsibleChoice?: ResponsibleChoice;
  /** Solo si elige "invite_other" · email del Responsible real. */
  pendingResponsibleEmail?: string;
  /** Solo si elige "invite_other" · nombre del Responsible real. */
  pendingResponsibleName?: string;
  /** Solo si elige "invite_other" · teléfono opcional del Responsible. */
  pendingResponsibleTelefono?: string;
  /** ISO timestamp · si el user pulsó "Lo haré más tarde", aquí queda
   *  marcada la última fecha de aplazamiento. NO equivale a completedAt
   *  · el setup sigue pendiente y debe re-pedirse en acciones críticas. */
  deferredAt?: string;
  /** Paper trail legal · solo presente cuando `responsibleChoice === "self"`.
   *  Registra quién aceptó los términos del Responsable · esencial para
   *  cumplimiento RGPD y disputas legales sobre quién contrató qué.
   *  TODO(backend): tabla `agency_responsible_consents` con un row por
   *  cada aceptación, NUNCA mutable. */
  selfTermsAccepted?: {
    acceptedAt: string;        // ISO timestamp
    acceptedByName: string;    // user.name al momento de aceptar
    acceptedByEmail: string;   // user.email al momento de aceptar
    /** Versión de los T&C aceptados · permite saber qué texto vio el
     *  usuario incluso si los T&C luego cambian. */
    termsVersion: string;
  };
}

function readAll(): AgencyOnboardingState[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(list: AgencyOnboardingState[]) {
  localStorage.setItem(STATE_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("byvaro:agency-onboarding-changed"));
}

/** ¿Hay un setup pendiente para esta agencia? · usado por el gate
 *  visual del AppLayout para decidir si pintar el modal. */
export function needsResponsibleSetup(agencyId: string): boolean {
  if (typeof window === "undefined") return false;
  /* Solo agencias creadas vía invitación (storage created.v1) tienen
   * setup pendiente · las del seed son fixtures siempre completas. */
  const createdRaw = localStorage.getItem("byvaro.agencies.created.v1");
  if (!createdRaw) return false;
  try {
    const arr = JSON.parse(createdRaw) as Array<{ id: string }>;
    if (!arr.some((a) => a.id === agencyId)) return false;
  } catch {
    return false;
  }
  /* Y el flag de onboarding NO está marcado como completed. */
  const state = readAll().find((s) => s.agencyId === agencyId);
  return !state?.completedAt;
}

/** ¿El modal debe pintarse al cargar la app? · true cuando el setup
 *  está pendiente Y NO ha sido aplazado. Si fue aplazado ("Lo haré
 *  más tarde"), el modal queda silencioso · solo se vuelve a abrir en
 *  acciones críticas (`promptResponsibleOnCriticalAction`). */
export function shouldAutoOpenResponsibleSetup(agencyId: string): boolean {
  if (!needsResponsibleSetup(agencyId)) return false;
  const state = readAll().find((s) => s.agencyId === agencyId);
  return !state?.deferredAt;
}

import { RESPONSIBLE_ACCEPTANCE_TERMS } from "./legalTerms";

/** Versión actual de los T&C del Responsable · derivada del catálogo
 *  canónico en `legalTerms.ts`. Cualquier cambio del texto debe subir
 *  la versión allí · este export se mantiene como atajo. */
export const RESPONSIBLE_TERMS_VERSION = RESPONSIBLE_ACCEPTANCE_TERMS.version;

/** Marca el setup como completo con la elección del usuario.
 *  Idempotente · si vuelve a llamarse, sobrescribe el estado anterior.
 *  Si la elección es "self", se exige `consent` · paper trail legal. */
export function markResponsibleSetupComplete(
  agencyId: string,
  choice: ResponsibleChoice,
  details?: {
    email?: string; name?: string; telefono?: string;
    /** Solo cuando choice === "self" · datos del aceptante de T&C. */
    consent?: { acceptedByName: string; acceptedByEmail: string };
  },
): void {
  const all = readAll();
  const next: AgencyOnboardingState = {
    agencyId,
    completedAt: new Date().toISOString(),
    responsibleChoice: choice,
    pendingResponsibleEmail: details?.email,
    pendingResponsibleName: details?.name,
    pendingResponsibleTelefono: details?.telefono,
    selfTermsAccepted: details?.consent ? {
      acceptedAt: new Date().toISOString(),
      acceptedByName: details.consent.acceptedByName,
      acceptedByEmail: details.consent.acceptedByEmail,
      termsVersion: RESPONSIBLE_TERMS_VERSION,
    } : undefined,
  };
  const filtered = all.filter((s) => s.agencyId !== agencyId);
  writeAll([next, ...filtered]);
}

/** Aplaza el setup · el user pulsa "Lo haré más tarde". El modal deja
 *  de auto-aparecer hasta que el user dispare una acción crítica
 *  (invitar miembro, generar contrato, etc.) o limpie el storage. */
export function deferResponsibleSetup(agencyId: string): void {
  const all = readAll();
  const existing = all.find((s) => s.agencyId === agencyId);
  const next: AgencyOnboardingState = {
    ...(existing ?? { agencyId }),
    deferredAt: new Date().toISOString(),
  };
  const filtered = all.filter((s) => s.agencyId !== agencyId);
  writeAll([next, ...filtered]);
}

/** Suscríbete a cambios · permite re-render del dialog/layout. */
export function onAgencyOnboardingChanged(handler: () => void): () => void {
  const wrapped = () => handler();
  window.addEventListener("byvaro:agency-onboarding-changed", wrapped);
  window.addEventListener("storage", wrapped);
  return () => {
    window.removeEventListener("byvaro:agency-onboarding-changed", wrapped);
    window.removeEventListener("storage", wrapped);
  };
}

/** Lee el estado actual · útil para preview en componentes que ya
 *  tienen `agencyId`. */
export function getAgencyOnboardingState(
  agencyId: string,
): AgencyOnboardingState | undefined {
  return readAll().find((s) => s.agencyId === agencyId);
}
