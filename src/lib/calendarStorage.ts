/**
 * calendarStorage.ts · store + hook reactivo para CalendarEvent.
 *
 * Lee de `calendarEvents` (seed) + overrides en localStorage. El
 * override permite al admin crear/editar/borrar eventos desde la UI
 * sin tocar el seed. En backend real, estos endpoints apuntan a
 * `GET/POST/PATCH/DELETE /api/calendar/events`.
 *
 * El hook `useCalendarEvents()` es reactivo: se refresca cuando
 * cualquier edición dispara el `CustomEvent`.
 */

import { useEffect, useState } from "react";
import {
  calendarEvents as SEED,
  type CalendarEvent,
} from "@/data/calendarEvents";
import { eventsOverlap } from "@/lib/calendarHelpers";

const KEY_OVERRIDES = "byvaro.calendar.overrides.v1";
const KEY_DELETED   = "byvaro.calendar.deleted.v1";
const EVENT = "byvaro:calendar-change";

/* ══════ Lectura ══════════════════════════════════════════════════ */

function loadOverrides(): Record<string, CalendarEvent> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY_OVERRIDES);
    return raw ? (JSON.parse(raw) as Record<string, CalendarEvent>) : {};
  } catch {
    return {};
  }
}

function loadDeletedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(KEY_DELETED);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

/** Devuelve el universo completo de eventos · seed + nuevos creados
 *  por el usuario + ediciones sobre el seed − eventos borrados. */
export function getCalendarEvents(): CalendarEvent[] {
  const overrides = loadOverrides();
  const deleted = loadDeletedIds();
  // Map id → override (si existe) para poder ediciones sobre seed.
  const out: CalendarEvent[] = [];
  const seen = new Set<string>();
  for (const ev of SEED) {
    if (deleted.has(ev.id)) continue;
    if (overrides[ev.id]) {
      out.push(overrides[ev.id]);
      seen.add(ev.id);
    } else {
      out.push(ev);
      seen.add(ev.id);
    }
  }
  // Y los eventos NUEVOS creados por el usuario (no están en seed).
  for (const id of Object.keys(overrides)) {
    if (!seen.has(id) && !deleted.has(id)) {
      out.push(overrides[id]);
    }
  }
  return out;
}

/* ══════ Escritura ══════════════════════════════════════════════════ */

function saveOverrides(map: Record<string, CalendarEvent>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_OVERRIDES, JSON.stringify(map));
  window.dispatchEvent(new CustomEvent(EVENT));
}

function saveDeleted(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_DELETED, JSON.stringify([...ids]));
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Crea un evento nuevo. Autogen id `ev-${uuid}`. */
export function createCalendarEvent(
  input: Omit<CalendarEvent, "id" | "createdAt"> & Partial<Pick<CalendarEvent, "id" | "createdAt">>,
): CalendarEvent {
  const ev: CalendarEvent = {
    ...input,
    id: input.id ?? `ev-${crypto.randomUUID()}`,
    createdAt: input.createdAt ?? new Date().toISOString(),
  } as CalendarEvent;
  const overrides = loadOverrides();
  overrides[ev.id] = ev;
  saveOverrides(overrides);
  return ev;
}

/** Actualiza un evento. Si el evento venía del seed, se guarda un
 *  override · si venía de overrides, se muta el override. */
export function updateCalendarEvent(id: string, patch: Partial<CalendarEvent>): void {
  const list = getCalendarEvents();
  const existing = list.find((e) => e.id === id);
  if (!existing) return;
  const overrides = loadOverrides();
  overrides[id] = { ...existing, ...patch } as CalendarEvent;
  saveOverrides(overrides);
}

/** Borrar un evento. Si era del seed, se guarda en deleted-ids. Si
 *  era override, se elimina del map. */
export function deleteCalendarEvent(id: string): void {
  const overrides = loadOverrides();
  if (overrides[id]) {
    delete overrides[id];
    saveOverrides(overrides);
  }
  const seedHas = SEED.some((e) => e.id === id);
  if (seedHas) {
    const deleted = loadDeletedIds();
    deleted.add(id);
    saveDeleted(deleted);
  }
}

/** Detecta conflicto para el agente indicado en el intervalo
 *  `[start, end)`. Si `ignoreId` se pasa (ej. editando un evento
 *  existente), se excluye del chequeo. Devuelve el primer evento que
 *  solapa o `null` si no hay conflicto. */
export function findConflict(
  assigneeUserId: string,
  start: string,
  end: string,
  ignoreId?: string,
): CalendarEvent | null {
  const list = getCalendarEvents();
  const match = list.find(
    (ev) =>
      ev.id !== ignoreId &&
      ev.assigneeUserId === assigneeUserId &&
      // Los eventos cancelados / noshow no bloquean
      ev.status !== "cancelled" &&
      ev.status !== "noshow" &&
      eventsOverlap({ start, end }, { start: ev.start, end: ev.end }),
  );
  return match ?? null;
}

/* ══════ Hook reactivo ══════════════════════════════════════════════ */

export function useCalendarEvents(): CalendarEvent[] {
  const [list, setList] = useState<CalendarEvent[]>(() => getCalendarEvents());
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setList(getCalendarEvents());
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return list;
}
