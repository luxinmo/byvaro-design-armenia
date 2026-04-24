/**
 * registroVisitaLink.ts · sincronización Registro ↔ Visita.
 *
 * Un registro puede llegar con tipo "registration_visit" (la agencia
 * propone registrar un cliente Y quiere hacer una visita el día X).
 * En ese caso, además del Registro se crea un `CalendarEvent` de
 * tipo "visit" con `status: "pending-confirmation"` y con el
 * `registroId` apuntando al registro.
 *
 * Cuando el promotor decide sobre el registro:
 *   - **aprueba** → la visita asociada pasa a `status: "confirmed"`.
 *   - **rechaza** → la visita asociada pasa a `status: "cancelled"`
 *     con motivo en `notes`.
 *
 * Estas funciones son los "setters" que la UI de registros debe
 * llamar en lugar de mutar el registro directamente (así garantizamos
 * que la visita queda consistente).
 *
 * TODO(backend):
 *   - POST /api/registrations/:id/approve debe actualizar la visita
 *     asociada en una misma transacción.
 *   - POST /api/registrations/:id/reject igual.
 *   - Emitir evento en timeline del contacto y de la oportunidad
 *     (regla `CLAUDE.md §🥇`).
 */

import {
  createCalendarEvent, updateCalendarEvent, getCalendarEvents,
} from "@/lib/calendarStorage";
import type {
  CalendarEvent, CalendarVisitEvent, CalendarEventStatus,
} from "@/data/calendarEvents";

/* ══════ Crear visita vinculada a un registro ══════════════════════ */

export type RegistroVisitaInput = {
  registroId: string;
  assigneeUserId: string;
  start: string; // ISO
  end: string;   // ISO
  clientName: string;
  clientId?: string;
  promotionId: string;
  promotionName: string;
  unitLabel?: string;
  locationLabel?: string;
  notes?: string;
  /** Si viene directo desde una ficha de oportunidad ya existente. */
  leadId?: string;
};

/** Crea el `CalendarEvent` de una visita propuesta junto a un registro.
 *  La visita arranca `pending-confirmation` hasta que el promotor
 *  apruebe el registro. */
export function createVisitFromRegistro(input: RegistroVisitaInput): CalendarEvent {
  return createCalendarEvent({
    type: "visit",
    title: `Visita · ${input.promotionName}`,
    start: input.start,
    end: input.end,
    assigneeUserId: input.assigneeUserId,
    status: "pending-confirmation",
    source: "registro",
    registroId: input.registroId,
    leadId: input.leadId,
    contactId: input.clientId,
    contactName: input.clientName,
    promotionId: input.promotionId,
    promotionName: input.promotionName,
    unitLabel: input.unitLabel,
    location: input.locationLabel ? { label: input.locationLabel } : undefined,
    notes: input.notes,
  } as Parameters<typeof createCalendarEvent>[0]);
}

/* ══════ Aprobar / rechazar registro propaga a la visita ════════════ */

/** Busca el primer CalendarEvent asociado a `registroId`. */
function findVisitForRegistro(registroId: string): CalendarVisitEvent | undefined {
  const list = getCalendarEvents();
  return list.find(
    (ev): ev is CalendarVisitEvent =>
      ev.type === "visit" && ev.registroId === registroId,
  );
}

/** Cuando el promotor APRUEBA el registro, la visita pendiente pasa
 *  a `confirmed`. Si no hay visita asociada, no hace nada. */
export function onRegistroApproved(registroId: string): { visitUpdated: boolean } {
  const visit = findVisitForRegistro(registroId);
  if (!visit) return { visitUpdated: false };
  if (visit.status !== "pending-confirmation") return { visitUpdated: false };
  updateCalendarEvent(visit.id, { status: "confirmed" });
  return { visitUpdated: true };
}

/** Cuando el promotor RECHAZA el registro, la visita pendiente pasa
 *  a `cancelled` con motivo opcional. */
export function onRegistroRejected(
  registroId: string,
  reason?: string,
): { visitUpdated: boolean } {
  const visit = findVisitForRegistro(registroId);
  if (!visit) return { visitUpdated: false };
  if (visit.status === "cancelled") return { visitUpdated: false };
  const existing = visit.notes ?? "";
  const motivo = reason ? `Rechazado: ${reason}` : "Registro rechazado";
  const newNotes = existing ? `${existing}\n${motivo}` : motivo;
  updateCalendarEvent(visit.id, { status: "cancelled", notes: newNotes });
  return { visitUpdated: true };
}

/* ══════ El promotor REASIGNA una visita que llegó de agencia ══════ */

/** El flujo: una agencia manda registro+visita, el promotor aprueba
 *  y además cambia el agente responsable a uno de su equipo. */
export function assignVisitResponsible(
  eventId: string,
  newAssigneeUserId: string,
  newStatus: CalendarEventStatus = "confirmed",
): void {
  updateCalendarEvent(eventId, {
    assigneeUserId: newAssigneeUserId,
    status: newStatus,
  });
}
