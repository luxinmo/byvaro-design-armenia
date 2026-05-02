/**
 * calendarEvents.ts · modelo único de eventos del calendario.
 *
 * Un calendario = timeline de `CalendarEvent` de distintos `type`. La
 * decisión (ADR-056) fue unificar en una sola entidad con union
 * discriminada en vez de tener Visitas + Llamadas + Reuniones como
 * tipos separados · todos comparten `start/end/assigneeUserId` y son
 * intercambiables desde la UI del calendario.
 *
 * Cada evento pertenece a un único agente (`assigneeUserId`). En
 * Multi-calendario desktop cada agente = una columna/color. Un
 * conflicto de horario (dos eventos del mismo agente solapando) es
 * un error bloqueante en el Dialog de crear · obliga a cambiar
 * primero.
 *
 * TODO(backend):
 *   - `GET/POST/PATCH/DELETE /api/calendar/events`
 *   - `GET /api/calendar/events/conflicts?assigneeUserId&start&end`
 *   - `POST /api/calendar/events/:id/ics` → ICS attachment
 *   - `POST /api/calendar/events/:id/send` → email + WhatsApp con ICS
 *   - Google Calendar sync: `POST /api/calendar/google/connect` +
 *     cron bidireccional.
 */

/* ══════ Enums + tipos ══════════════════════════════════════════════ */

/** Tipo de evento. Cada uno tiene un color + icono en la UI. */
export type CalendarEventType =
  | "visit"     // visita a una propiedad / promoción
  | "call"      // llamada comercial
  | "meeting"   // reunión (interna o con cliente)
  | "block"     // bloqueo de tiempo (almuerzo · personal · no molestar)
  | "reminder"; // recordatorio (sin duración real · se pinta como punto)

/** Estado del evento.
 *
 *  - `pending-confirmation` · creado pero aún no confirmado. Se pinta
 *    atenuado en el calendario con chip "Pendiente". Típico cuando la
 *    visita llega desde un Registro: la agencia propone un día/hora y
 *    el promotor tiene que confirmar (o al revés).
 *  - `confirmed` · visible normal. Estado por defecto al crear desde
 *    oportunidad.
 *  - `done` · ya realizado. Solo para tipos `visit`/`call`/`meeting`.
 *  - `cancelled` · cancelado.
 *  - `noshow` · cliente/asistente no apareció (`visit`/`meeting`). */
export type CalendarEventStatus =
  | "pending-confirmation"
  | "confirmed"
  | "done"
  | "cancelled"
  | "noshow";

export type CalendarReminderPreset = "none" | "15m" | "1h" | "1d";

/** Ubicación de un evento. Para visitas suele ser la dirección de la
 *  promoción / unidad; para reuniones puede ser "oficina", "Zoom",
 *  link, etc. */
export type CalendarEventLocation = {
  label: string;          // "Villa Serena · Marbella" / "Oficina HQ"
  address?: string;       // dirección completa
  url?: string;           // link Zoom / Meet / etc.
};

/** Base común a todos los eventos. */
type CalendarEventBase = {
  id: string;
  title: string;
  /** ISO · inicio. */
  start: string;
  /** ISO · fin. Para `reminder` suele ser igual a `start`. */
  end: string;
  /** Miembro del equipo asignado (`TEAM_MEMBERS.id`). Único. */
  assigneeUserId: string;
  /** Snapshot del nombre del asignado · fallback si el miembro se
   *  desactiva. */
  assigneeName?: string;
  status: CalendarEventStatus;
  /** ID del contacto principal del evento (si aplica). */
  contactId?: string;
  contactName?: string;
  /** Si viene de una oportunidad · link bidireccional. */
  leadId?: string;
  /** Si viene de un registro · link bidireccional. */
  registroId?: string;
  location?: CalendarEventLocation;
  notes?: string;
  /** Recordatorio antes del inicio · activa notificación push/email
   *  en backend. */
  reminder?: CalendarReminderPreset;
  createdAt: string;         // ISO
  createdByUserId?: string;
  /** Origen del evento para analítica / filtros. */
  source?: "manual" | "oportunidad" | "registro" | "google-calendar";
  /** Si viene de Google Calendar · id del evento externo. */
  externalId?: string;
};

/** Evento tipo **visita** · extensión con promoción/unidad. */
export type CalendarVisitEvent = CalendarEventBase & {
  type: "visit";
  promotionId?: string;
  promotionName?: string;
  /** Unidad concreta que se visita (opcional · puede ser solo
   *  promoción genérica). */
  unitId?: string;
  unitLabel?: string;
  /** Evaluación post-visita · rellena al ponerla en `done`. */
  evaluation?: {
    outcome: "completed" | "cancelled" | "rescheduled";
    rating?: 1 | 2 | 3 | 4 | 5;
    clientInterest?: "low" | "medium" | "high";
    feedback?: string;
    evaluatedAt: string;
    evaluatedBy: string;
  };
};

export type CalendarCallEvent = CalendarEventBase & {
  type: "call";
  phone?: string;
};

export type CalendarMeetingEvent = CalendarEventBase & {
  type: "meeting";
  /** Asistentes extra del equipo (visualización futura · V1 solo
   *  muestra el assigneeUserId como owner). */
  teamAttendees?: string[];
};

export type CalendarBlockEvent = CalendarEventBase & {
  type: "block";
  /** Motivo del bloqueo · "Almuerzo", "Personal", "Formación"… */
  blockReason?: string;
};

export type CalendarReminderEvent = CalendarEventBase & {
  type: "reminder";
};

export type CalendarEvent =
  | CalendarVisitEvent
  | CalendarCallEvent
  | CalendarMeetingEvent
  | CalendarBlockEvent
  | CalendarReminderEvent;

/* ══════ Helpers de UI ══════════════════════════════════════════════ */

/** Colores por tipo de evento · se pintan como clases bg/border de
 *  Tailwind. Siguen los tokens disponibles en el proyecto. */
export const eventTypeConfig: Record<
  CalendarEventType,
  { label: string; bgClass: string; borderClass: string; textClass: string; dotClass: string; icon: string }
> = {
  visit:    { label: "Visita",       bgClass: "bg-primary/10",       borderClass: "border-primary/40",       textClass: "text-primary",       dotClass: "bg-primary",       icon: "Home" },
  call:     { label: "Llamada",      bgClass: "bg-sky-100",          borderClass: "border-sky-300",          textClass: "text-sky-800",       dotClass: "bg-sky-500",       icon: "Phone" },
  meeting:  { label: "Reunión",      bgClass: "bg-indigo-100",       borderClass: "border-indigo-300",       textClass: "text-indigo-800",    dotClass: "bg-indigo-500",    icon: "Users" },
  block:    { label: "Bloqueo",      bgClass: "bg-muted",            borderClass: "border-border",           textClass: "text-muted-foreground", dotClass: "bg-muted-foreground", icon: "Ban" },
  reminder: { label: "Recordatorio", bgClass: "bg-warning/10",       borderClass: "border-warning/40",       textClass: "text-warning",       dotClass: "bg-warning",       icon: "Bell" },
};

export const eventStatusConfig: Record<
  CalendarEventStatus,
  { label: string; badgeClass: string; dotClass: string }
> = {
  "pending-confirmation": { label: "Pendiente de confirmación", badgeClass: "bg-warning/10 text-warning border border-warning/25", dotClass: "bg-warning" },
  "confirmed": { label: "Confirmado", badgeClass: "bg-primary/10 text-primary border border-primary/25", dotClass: "bg-primary" },
  "done":      { label: "Realizado",  badgeClass: "bg-success/10 text-success border border-success/25", dotClass: "bg-success" },
  "cancelled": { label: "Cancelado",  badgeClass: "bg-muted text-muted-foreground border border-border", dotClass: "bg-muted-foreground" },
  "noshow":    { label: "No asistió", badgeClass: "bg-destructive/5 text-destructive border border-destructive/25", dotClass: "bg-destructive" },
};

/** Duraciones default presentadas en el Dialog de crear · en minutos. */
export const DURATION_PRESETS = [
  { minutes: 30,  label: "30 min" },
  { minutes: 45,  label: "45 min" },
  { minutes: 60,  label: "1 h" },
  { minutes: 90,  label: "1 h 30 min" },
  { minutes: 120, label: "2 h" },
] as const;

/** Duración por defecto al crear un evento nuevo (minutos). */
export const DEFAULT_DURATION_MINUTES = 60;

/* ══════ MOCK · seed con ~25 eventos distribuidos en la semana ═══════
   Lógica:
     - Lunes-viernes con visitas + llamadas del equipo (u1..u4).
     - Algunos eventos `done` en días pasados de esta semana.
     - Un `pending-confirmation` (visita llegada desde registro).
     - Un `cancelled`, un `noshow`, un `block` (almuerzo).
     - Reminder puntual.
   ══════════════════════════════════════════════════════════════════ */

/** Construye una fecha ISO relativa a HOY: día offset + hora + minutos. */
function relISO(dayOffset: number, hour: number, minutes = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minutes, 0, 0);
  return d.toISOString();
}

/** Mantiene los datos del seed deterministas entre renders pero
 *  relativos a "hoy" para que el calendario siempre tenga contenido
 *  pintado. */
export const calendarEvents: CalendarEvent[] = [];

/** Lookup por id. */
export function findCalendarEvent(id: string): CalendarEvent | undefined {
  return calendarEvents.find((e) => e.id === id);
}

/** Colores estables para cada miembro del equipo · se usan en
 *  multi-calendario para distinguir carriles. Estos 8 cubren el
 *  equipo mock; para un miembro nuevo se cae al hash del id. */
export const CALENDAR_MEMBER_COLORS: Record<string, string> = {
  u1: "bg-primary",
  u2: "bg-emerald-500",
  u3: "bg-indigo-500",
  u4: "bg-rose-500",
  u5: "bg-orange-500",
  u6: "bg-cyan-500",
  u7: "bg-fuchsia-500",
  u8: "bg-lime-500",
};

/** Devuelve la clase de color para un miembro · si no está en el map,
 *  hash simple del id para elegir uno deterministamente. */
export function getMemberCalendarColor(userId: string): string {
  if (CALENDAR_MEMBER_COLORS[userId]) return CALENDAR_MEMBER_COLORS[userId];
  const palette = Object.values(CALENDAR_MEMBER_COLORS);
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash + userId.charCodeAt(i)) % palette.length;
  return palette[hash];
}
