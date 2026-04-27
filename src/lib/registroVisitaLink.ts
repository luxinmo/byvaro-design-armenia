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

/**
 * Cuando una visita asociada a un Registro en estado `preregistro_activo`
 * se marca como REALIZADA (`outcome: "realizada"`), el registro debe
 * transitar a `aprobado` (cliente formalmente registrado).
 *
 * **Phase 1 Core**: función LISTA pero sin wire al calendario · el
 * flujo de "marcar visita realizada" todavía no existe en el prototipo
 * mock. Cuando el agente tenga UI para evaluar la visita (probablemente
 * en `Calendario.tsx` o `VisitDetail.tsx`), llamar `onVisitCompleted`
 * desde ahí.
 *
 * Devuelve un payload para que el caller pueda mutar su state local
 * de Registros (no muta directamente · no tiene acceso al setRecords
 * del componente).
 */
export function onVisitCompleted(registroId: string): {
  shouldPromoteToApproved: boolean;
  reason: "preregistro_activo_with_completed_visit" | "not_applicable";
} {
  /* Para conocer el estado del registro necesitamos leerlo desde el
     storage donde viva (seed o creados). En Phase 1 mock el caller
     ya tiene el record en su state · es más limpio que el caller
     pase el `estado` o que esta función reciba el Registro entero.
     Para mantener API simple, devolvemos solo el verdict basado en
     una mirada quick al storage. */
  // TODO(logic): cuando se cablee al flow de calendario, leer el
  // Registro desde el state global o pasar el registro completo como
  // argumento. Por ahora devolvemos `not_applicable` para no asumir.
  void registroId;
  return { shouldPromoteToApproved: false, reason: "not_applicable" };
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
