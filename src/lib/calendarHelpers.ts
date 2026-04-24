/**
 * calendarHelpers.ts · utilidades de fecha/hora para el calendario.
 *
 * Mantener estos helpers puros · sin efectos ni dependencias de React.
 * La app usa `es-ES` como locale principal · lunes como primer día de
 * la semana (ISO 8601).
 */

import type { CalendarEvent } from "@/data/calendarEvents";

/** Días de la semana (lun-dom) en español cortos. */
export const WEEKDAY_SHORT_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
export const WEEKDAY_LONG_ES  = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/** Meses en español. */
export const MONTH_LONG_ES  = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
export const MONTH_SHORT_ES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

/** Primer día de la semana ISO (lunes) que contiene `d`. */
export function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  // getDay(): 0=dom, 1=lun, ..., 6=sáb → desplazamiento para lun=0.
  const dow = copy.getDay();
  const shift = dow === 0 ? -6 : 1 - dow;
  copy.setDate(copy.getDate() + shift);
  return copy;
}

/** Último día de la semana ISO (domingo) que contiene `d`. */
export function endOfWeek(d: Date): Date {
  const start = startOfWeek(d);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

/** Primer día del mes · 00:00:00. */
export function startOfMonth(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), 1);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Último día del mes · 23:59:59. */
export function endOfMonth(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

/** Inicio del día (00:00:00). */
export function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Fin del día (23:59:59.999). */
export function endOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

/** ¿Dos fechas son el mismo día (ignorando hora)? */
export function isSameDay(a: Date | string, b: Date | string): boolean {
  const da = typeof a === "string" ? new Date(a) : a;
  const db = typeof b === "string" ? new Date(b) : b;
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

/** ¿La fecha es hoy? */
export function isToday(d: Date | string): boolean {
  return isSameDay(d, new Date());
}

/** Array de 7 días (lun-dom) de la semana que contiene `d`. */
export function getWeekDays(d: Date): Date[] {
  const start = startOfWeek(d);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return day;
  });
}

/** Grid de 6×7 celdas para la vista Mes · incluye días del mes
 *  anterior/siguiente para rellenar el grid. */
export function getMonthGrid(d: Date): Date[] {
  const first = startOfMonth(d);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    return day;
  });
}

/** "14:30" (24h). Para usar en celdas de evento. */
export function formatTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/** "10:00 – 11:00" · rango de horas del evento. */
export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

/** "1 abr 2026". */
export function formatShortDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getDate()} ${MONTH_SHORT_ES[date.getMonth()].toLowerCase()} ${date.getFullYear()}`;
}

/** "Abril 2026" · título de la vista Mes. */
export function formatMonthTitle(d: Date): string {
  return `${MONTH_LONG_ES[d.getMonth()]} ${d.getFullYear()}`;
}

/** "1 – 7 abr 2026" · título de la vista Semana. */
export function formatWeekRange(d: Date): string {
  const start = startOfWeek(d);
  const end = endOfWeek(d);
  const sameMonth = start.getMonth() === end.getMonth();
  const sameYear = start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${start.getDate()} – ${end.getDate()} ${MONTH_SHORT_ES[start.getMonth()].toLowerCase()} ${start.getFullYear()}`;
  }
  if (sameYear) {
    return `${start.getDate()} ${MONTH_SHORT_ES[start.getMonth()].toLowerCase()} – ${end.getDate()} ${MONTH_SHORT_ES[end.getMonth()].toLowerCase()} ${start.getFullYear()}`;
  }
  return `${formatShortDate(start)} – ${formatShortDate(end)}`;
}

/** "Martes · 1 abril 2026" · título de la vista Día. */
export function formatDayTitle(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  // getDay(): 0=dom..6=sáb → index del array WEEKDAY_LONG_ES (lun=0).
  const dow = date.getDay();
  const idx = dow === 0 ? 6 : dow - 1;
  return `${WEEKDAY_LONG_ES[idx]} · ${date.getDate()} ${MONTH_LONG_ES[date.getMonth()].toLowerCase()} ${date.getFullYear()}`;
}

/** Avanza N días (negativo = retroceder). No muta. */
export function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function addWeeks(d: Date, weeks: number): Date {
  return addDays(d, weeks * 7);
}

export function addMonths(d: Date, months: number): Date {
  const copy = new Date(d);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

/** Combina una fecha (YYYY-MM-DD) y una hora ("HH:mm") en un ISO. */
export function combineDateAndTime(dateStr: string, timeStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = timeStr.split(":").map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1, h ?? 0, min ?? 0, 0, 0);
  return date.toISOString();
}

/** Devuelve "YYYY-MM-DD" a partir de un Date · para `<input type="date">`. */
export function toDateInputValue(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Devuelve "HH:mm" · para `<input type="time">`. */
export function toTimeInputValue(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/** Duración del evento en minutos. */
export function durationMinutes(ev: CalendarEvent): number {
  return Math.max(
    0,
    Math.round((new Date(ev.end).getTime() - new Date(ev.start).getTime()) / 60000),
  );
}

/** ¿Dos eventos del mismo agente se solapan? Se usa para la
 *  detección de conflicto dura en CreateCalendarEventDialog. */
export function eventsOverlap(
  a: { start: string; end: string },
  b: { start: string; end: string },
): boolean {
  const aStart = new Date(a.start).getTime();
  const aEnd   = new Date(a.end).getTime();
  const bStart = new Date(b.start).getTime();
  const bEnd   = new Date(b.end).getTime();
  // Estricto: tocar exactamente (A.end === B.start) NO es solape.
  return aStart < bEnd && bStart < aEnd;
}

/** Devuelve todos los eventos del día (ignora hora). */
export function eventsInDay(list: CalendarEvent[], day: Date): CalendarEvent[] {
  const s = startOfDay(day).getTime();
  const e = endOfDay(day).getTime();
  return list.filter((ev) => {
    const evStart = new Date(ev.start).getTime();
    return evStart >= s && evStart <= e;
  });
}

/** Devuelve todos los eventos de la semana que contiene `day`. */
export function eventsInWeek(list: CalendarEvent[], day: Date): CalendarEvent[] {
  const s = startOfWeek(day).getTime();
  const e = endOfWeek(day).getTime();
  return list.filter((ev) => {
    const evStart = new Date(ev.start).getTime();
    return evStart >= s && evStart <= e;
  });
}

/** Devuelve todos los eventos del mes al que pertenece `day`. */
export function eventsInMonth(list: CalendarEvent[], day: Date): CalendarEvent[] {
  const s = startOfMonth(day).getTime();
  const e = endOfMonth(day).getTime();
  return list.filter((ev) => {
    const evStart = new Date(ev.start).getTime();
    return evStart >= s && evStart <= e;
  });
}

/** Devuelve los próximos N eventos a partir de ahora. Útil para el
 *  widget de Inicio y para la Agenda. */
export function upcomingEvents(
  list: CalendarEvent[],
  limit = 5,
  filter?: (ev: CalendarEvent) => boolean,
): CalendarEvent[] {
  const now = Date.now();
  return list
    .filter((ev) => new Date(ev.start).getTime() >= now)
    .filter((ev) => !filter || filter(ev))
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, limit);
}
