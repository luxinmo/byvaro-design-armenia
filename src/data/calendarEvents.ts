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
export const calendarEvents: CalendarEvent[] = [
  /* ─── HOY ─── */
  {
    id: "ev-1", type: "visit", title: "Visita · Villa Serena",
    start: relISO(0, 10, 0), end: relISO(0, 11, 0),
    assigneeUserId: "u1", assigneeName: "Arman Yeghiazaryan",
    status: "confirmed", source: "oportunidad",
    contactId: "ahmed-al-rashid", contactName: "Ahmed Al Rashid",
    leadId: "lead-1",
    promotionId: "dev-1", promotionName: "Villa Serena",
    unitId: "unit-9", unitLabel: "Villa 09",
    location: { label: "Villa Serena · Marbella", address: "Av. de los Arcos 12, Marbella" },
    reminder: "1h",
    notes: "Cliente VIP · cash-buyer. Tiene preaprobación bancaria.",
    createdAt: relISO(-3, 9, 30), createdByUserId: "u1",
  },
  {
    id: "ev-2", type: "call", title: "Llamada seguimiento",
    start: relISO(0, 11, 30), end: relISO(0, 12, 0),
    assigneeUserId: "u1", assigneeName: "Arman Yeghiazaryan",
    status: "confirmed", source: "manual",
    contactId: "marie-dubois", contactName: "Marie Dubois",
    phone: "+33 6 12 34 56 78",
    notes: "Confirmar visita del jueves.",
    createdAt: relISO(-1, 15, 0),
  } as CalendarCallEvent,
  {
    id: "ev-3", type: "block", title: "Comida con equipo",
    start: relISO(0, 14, 0), end: relISO(0, 15, 0),
    assigneeUserId: "u1", assigneeName: "Arman Yeghiazaryan",
    status: "confirmed", source: "manual",
    blockReason: "Almuerzo",
    createdAt: relISO(-7, 10, 0),
  } as CalendarBlockEvent,
  {
    id: "ev-4", type: "visit", title: "Visita · Terrazas del Golf",
    start: relISO(0, 16, 30), end: relISO(0, 17, 30),
    assigneeUserId: "u2", assigneeName: "Laura Sánchez",
    status: "confirmed", source: "oportunidad",
    contactId: "marie-dubois", contactName: "Marie Dubois",
    leadId: "lead-2",
    promotionId: "dev-4", promotionName: "Terrazas del Golf",
    unitLabel: "Apt 204",
    location: { label: "Terrazas del Golf · Mijas", address: "Calle del Golf 3, Mijas" },
    reminder: "1h",
    createdAt: relISO(-2, 11, 0),
  },

  /* ─── +1 DÍA (mañana) ─── */
  {
    id: "ev-5", type: "visit", title: "Visita · Mar Azul Residences",
    start: relISO(1, 10, 0), end: relISO(1, 11, 0),
    assigneeUserId: "u2", assigneeName: "Laura Sánchez",
    status: "confirmed", source: "oportunidad",
    contactId: "lars-andersson", contactName: "Lars Andersson",
    leadId: "lead-3",
    promotionId: "dev-5", promotionName: "Mar Azul Residences",
    location: { label: "Mar Azul · Torrevieja", address: "Av. del Mar 40, Torrevieja" },
    createdAt: relISO(-1, 9, 0),
  },
  {
    id: "ev-6", type: "meeting", title: "Reunión semanal comercial",
    start: relISO(1, 9, 0), end: relISO(1, 9, 45),
    assigneeUserId: "u1", assigneeName: "Arman Yeghiazaryan",
    status: "confirmed", source: "manual",
    location: { label: "Oficina HQ · Sala Reunión 1" },
    teamAttendees: ["u2", "u3", "u4"],
    createdAt: relISO(-7, 10, 0),
  } as CalendarMeetingEvent,
  {
    id: "ev-7", type: "visit", title: "Visita · Residencial Aurora",
    start: relISO(1, 12, 0), end: relISO(1, 13, 0),
    assigneeUserId: "u3", assigneeName: "Pedro Sánchez",
    status: "pending-confirmation",
    source: "registro",
    contactId: "klaus-hoffmann", contactName: "Klaus Hoffmann",
    leadId: "lead-4",
    registroId: "reg-klaus",
    promotionId: "dev-3", promotionName: "Residencial Aurora",
    location: { label: "Residencial Aurora · Benalmádena" },
    notes: "Llegó desde la agencia · confirmar con el cliente antes de las 18h.",
    createdAt: relISO(0, 8, 30),
  },
  {
    id: "ev-8", type: "call", title: "Llamada prospección",
    start: relISO(1, 15, 0), end: relISO(1, 15, 30),
    assigneeUserId: "u3", assigneeName: "Pedro Sánchez",
    status: "confirmed", source: "manual",
    contactId: "emma-johnson", contactName: "Emma Johnson",
    phone: "+44 7700 900123",
    createdAt: relISO(-1, 16, 0),
  } as CalendarCallEvent,
  {
    id: "ev-9", type: "reminder", title: "Enviar dossier a Ivan Petrov",
    start: relISO(1, 17, 30), end: relISO(1, 17, 30),
    assigneeUserId: "u1", assigneeName: "Arman Yeghiazaryan",
    status: "confirmed", source: "manual",
    createdAt: relISO(0, 14, 0),
  } as CalendarReminderEvent,

  /* ─── +2 DÍAS ─── */
  {
    id: "ev-10", type: "visit", title: "Visita · Villa Serena",
    start: relISO(2, 11, 0), end: relISO(2, 12, 0),
    assigneeUserId: "u1", assigneeName: "Arman Yeghiazaryan",
    status: "confirmed", source: "oportunidad",
    contactId: "emma-johnson", contactName: "Emma Johnson",
    leadId: "lead-5",
    promotionId: "dev-1", promotionName: "Villa Serena",
    unitLabel: "Villa 03",
    location: { label: "Villa Serena · Marbella" },
    reminder: "1d",
    createdAt: relISO(-2, 10, 30),
  },
  {
    id: "ev-11", type: "visit", title: "Visita · Villas del Pinar",
    start: relISO(2, 16, 0), end: relISO(2, 17, 0),
    assigneeUserId: "u4", assigneeName: "Ana Martín",
    status: "confirmed", source: "oportunidad",
    contactId: "peter-vanderberg", contactName: "Peter van der Berg",
    leadId: "lead-6",
    promotionId: "dev-2", promotionName: "Villas del Pinar",
    location: { label: "Villas del Pinar · Jávea" },
    createdAt: relISO(-1, 17, 0),
  },

  /* ─── +3 DÍAS ─── */
  {
    id: "ev-12", type: "call", title: "Llamada · negociación",
    start: relISO(3, 10, 0), end: relISO(3, 10, 30),
    assigneeUserId: "u1", assigneeName: "Arman Yeghiazaryan",
    status: "confirmed", source: "oportunidad",
    contactId: "ahmed-al-rashid", contactName: "Ahmed Al Rashid",
    leadId: "lead-1",
    phone: "+971 50 123 4567",
    createdAt: relISO(-1, 12, 0),
  } as CalendarCallEvent,
  {
    id: "ev-13", type: "visit", title: "Visita · Villa Serena",
    start: relISO(3, 13, 0), end: relISO(3, 14, 0),
    assigneeUserId: "u1", assigneeName: "Arman Yeghiazaryan",
    status: "confirmed", source: "oportunidad",
    contactId: "michael-brown", contactName: "Michael Brown",
    leadId: "lead-10",
    promotionId: "dev-1", promotionName: "Villa Serena",
    unitLabel: "Villa 05",
    location: { label: "Villa Serena · Marbella" },
    notes: "Cliente US · cash-buyer. 2.5M€.",
    createdAt: relISO(-2, 14, 0),
  },
  {
    id: "ev-14", type: "meeting", title: "Visita técnica arquitecto",
    start: relISO(3, 16, 0), end: relISO(3, 17, 30),
    assigneeUserId: "u2", assigneeName: "Laura Sánchez",
    status: "confirmed", source: "manual",
    location: { label: "Obra Terrazas del Golf" },
    createdAt: relISO(-5, 10, 0),
  } as CalendarMeetingEvent,

  /* ─── +4 DÍAS ─── */
  {
    id: "ev-15", type: "visit", title: "Visita · Mar Azul Residences",
    start: relISO(4, 10, 30), end: relISO(4, 11, 30),
    assigneeUserId: "u2", assigneeName: "Laura Sánchez",
    status: "confirmed", source: "oportunidad",
    contactId: "erik-nielsen", contactName: "Erik Nielsen",
    leadId: "lead-12",
    promotionId: "dev-5", promotionName: "Mar Azul Residences",
    location: { label: "Mar Azul · Torrevieja" },
    createdAt: relISO(0, 10, 0),
  },

  /* ─── AYER (-1) · eventos completados ─── */
  {
    id: "ev-16", type: "visit", title: "Visita · Residencial Aurora",
    start: relISO(-1, 11, 0), end: relISO(-1, 12, 0),
    assigneeUserId: "u3", assigneeName: "Pedro Sánchez",
    status: "done", source: "oportunidad",
    contactId: "klaus-hoffmann", contactName: "Klaus Hoffmann",
    leadId: "lead-4",
    promotionId: "dev-3", promotionName: "Residencial Aurora",
    unitLabel: "Ático 12",
    createdAt: relISO(-4, 10, 0),
    // no evaluation → aparece como TAREA PENDIENTE de evaluar
  },
  {
    id: "ev-17", type: "call", title: "Llamada primer contacto",
    start: relISO(-1, 15, 30), end: relISO(-1, 16, 0),
    assigneeUserId: "u4", assigneeName: "Ana Martín",
    status: "done", source: "oportunidad",
    contactId: "sofia-rossi", contactName: "Sofia Rossi",
    leadId: "lead-7",
    phone: "+39 333 123 4567",
    createdAt: relISO(-2, 9, 0),
  } as CalendarCallEvent,
  {
    id: "ev-18", type: "visit", title: "Visita cancelada · Villa Serena",
    start: relISO(-1, 17, 0), end: relISO(-1, 18, 0),
    assigneeUserId: "u1", assigneeName: "Arman Yeghiazaryan",
    status: "cancelled", source: "oportunidad",
    contactId: "yuki-tanaka", contactName: "Yuki Tanaka",
    leadId: "lead-11",
    promotionId: "dev-1", promotionName: "Villa Serena",
    notes: "Cliente canceló por cambio de planes.",
    createdAt: relISO(-3, 14, 0),
  },

  /* ─── -2 DÍAS ─── */
  {
    id: "ev-19", type: "visit", title: "Visita · Villas del Pinar",
    start: relISO(-2, 10, 0), end: relISO(-2, 11, 0),
    assigneeUserId: "u4", assigneeName: "Ana Martín",
    status: "noshow", source: "oportunidad",
    contactId: "peter-vanderberg", contactName: "Peter van der Berg",
    leadId: "lead-6",
    promotionId: "dev-2", promotionName: "Villas del Pinar",
    notes: "Cliente no apareció. Re-programar la semana que viene.",
    createdAt: relISO(-5, 15, 0),
  },

  /* ─── +5 DÍAS ─── */
  {
    id: "ev-20", type: "visit", title: "Visita · Terrazas del Golf",
    start: relISO(5, 10, 0), end: relISO(5, 11, 0),
    assigneeUserId: "u2", assigneeName: "Laura Sánchez",
    status: "confirmed", source: "oportunidad",
    contactId: "olivier-moreau", contactName: "Olivier Moreau",
    leadId: "lead-8",
    promotionId: "dev-4", promotionName: "Terrazas del Golf",
    unitLabel: "Apt 310",
    location: { label: "Terrazas del Golf · Mijas" },
    createdAt: relISO(-2, 11, 0),
  },
  {
    id: "ev-21", type: "meeting", title: "Firma reserva · Olivier",
    start: relISO(5, 16, 0), end: relISO(5, 17, 0),
    assigneeUserId: "u2", assigneeName: "Laura Sánchez",
    status: "confirmed", source: "manual",
    contactId: "olivier-moreau", contactName: "Olivier Moreau",
    leadId: "lead-8",
    location: { label: "Oficina HQ" },
    createdAt: relISO(-1, 10, 0),
  } as CalendarMeetingEvent,

  /* ─── SEMANA SIGUIENTE · +7/+10 días ─── */
  {
    id: "ev-22", type: "visit", title: "Visita · Villa Serena",
    start: relISO(7, 11, 0), end: relISO(7, 12, 0),
    assigneeUserId: "u1", assigneeName: "Arman Yeghiazaryan",
    status: "pending-confirmation", source: "registro",
    contactId: "anna-schmidt", contactName: "Anna Schmidt",
    leadId: "lead-9",
    registroId: "reg-anna",
    promotionId: "dev-1", promotionName: "Villa Serena",
    location: { label: "Villa Serena · Marbella" },
    notes: "Pendiente confirmación · cliente desde WhatsApp.",
    createdAt: relISO(0, 16, 0),
  },
  {
    id: "ev-23", type: "block", title: "Vacaciones",
    start: relISO(10, 9, 0), end: relISO(10, 18, 0),
    assigneeUserId: "u3", assigneeName: "Pedro Sánchez",
    status: "confirmed", source: "manual",
    blockReason: "Vacaciones (día completo)",
    createdAt: relISO(-10, 10, 0),
  } as CalendarBlockEvent,
  {
    id: "ev-24", type: "call", title: "Llamada seguimiento Ivan",
    start: relISO(7, 10, 30), end: relISO(7, 11, 0),
    assigneeUserId: "u1", assigneeName: "Arman Yeghiazaryan",
    status: "confirmed", source: "oportunidad",
    contactId: "ivan-petrov", contactName: "Ivan Petrov",
    leadId: "lead-1",
    phone: "+34 612 345 678",
    createdAt: relISO(0, 11, 0),
  } as CalendarCallEvent,
];

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
