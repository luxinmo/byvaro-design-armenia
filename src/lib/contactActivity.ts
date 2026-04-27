/**
 * contactActivity.ts · Tracking de la última actividad relevante con
 * un Contact (Phase 1 · global, no per-party).
 *
 * Único punto de mutación de `Contact.lastActivityAt`. Pura: no muta
 * el Contact original · devuelve uno nuevo.
 *
 * Reglas:
 *   · `lastActivityAt` SIEMPRE adelanta · nunca retrocede.
 *   · Solo eventos relevantes cuentan (lista cerrada `isCountedEvent`).
 *   · Phase 2 introducirá `partyActivities[]` per-party (ver
 *     `docs/registration-generic-model.md §3`).
 */

import type { Contact, ContactTimelineEventType } from "@/components/contacts/types";

/** Eventos que cuentan como actividad con el cliente. Coments internos,
 *  tags, mantenimiento NO cuentan. */
const COUNTED_EVENTS: ReadonlySet<ContactTimelineEventType> = new Set<ContactTimelineEventType>([
  "lead_entry",
  "registration",
  "visit_scheduled",
  "visit_done",
  "visit_evaluated",
  "email_sent",
  "email_received",
  "email_delivered",
  "whatsapp_sent",
  "whatsapp_received",
  "call",
]);

export function isCountedEvent(eventType: ContactTimelineEventType): boolean {
  return COUNTED_EVENTS.has(eventType);
}

/**
 * Devuelve un Contact con `lastActivityAt` actualizado si el nuevo
 * timestamp es más reciente y el evento cuenta. Si no, devuelve el
 * contacto sin cambios.
 */
export function recordActivity(
  contact: Contact,
  eventType: ContactTimelineEventType,
  occurredAt: string = new Date().toISOString(),
): Contact {
  if (!isCountedEvent(eventType)) return contact;
  const incomingTs = new Date(occurredAt).getTime();
  const currentTs = contact.lastActivityAt
    ? new Date(contact.lastActivityAt).getTime()
    : 0;
  if (incomingTs <= currentTs) return contact;
  return {
    ...contact,
    lastActivityAt: occurredAt,
    /* Sincroniza también `lastActivity` legacy con un texto humano
     *  básico · UI vieja sigue funcionando hasta que migre a
     *  `<ActivityFreshness>`. */
    lastActivity: humanizeActivity(occurredAt),
  };
}

/* ══════ Freshness helpers · usados por <ActivityFreshness> ══════ */

export type ActivityLevel = "fresh" | "inactive" | "dormant";

export function activityLevel(lastActivityAt: string | undefined): ActivityLevel {
  if (!lastActivityAt) return "dormant";
  const days = daysSince(lastActivityAt);
  if (days < 14) return "fresh";
  if (days < 45) return "inactive";
  return "dormant";
}

export function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

/**
 * Texto humano básico ("Hoy", "Ayer", "Hace 3 días") para los
 * componentes legacy que aún leen `Contact.lastActivity`.
 */
export function humanizeActivity(iso: string): string {
  const d = daysSince(iso);
  if (d === 0) return "Hoy";
  if (d === 1) return "Ayer";
  if (d < 7) return `Hace ${d} días`;
  if (d < 30) return `Hace ${Math.floor(d / 7)} semana${Math.floor(d / 7) === 1 ? "" : "s"}`;
  if (d < 365) return `Hace ${Math.floor(d / 30)} mes${Math.floor(d / 30) === 1 ? "" : "es"}`;
  return `Hace ${Math.floor(d / 365)} año${Math.floor(d / 365) === 1 ? "" : "s"}`;
}
