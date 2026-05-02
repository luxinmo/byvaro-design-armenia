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
import { memCache } from "./memCache";
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
    const raw = memCache.getItem(KEY_OVERRIDES);
    return raw ? (JSON.parse(raw) as Record<string, CalendarEvent>) : {};
  } catch {
    return {};
  }
}

function loadDeletedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = memCache.getItem(KEY_DELETED);
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
  memCache.setItem(KEY_OVERRIDES, JSON.stringify(map));
  window.dispatchEvent(new CustomEvent(EVENT));
}

function saveDeleted(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  memCache.setItem(KEY_DELETED, JSON.stringify([...ids]));
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Crea un evento nuevo. Autogen id `ev-${uuid}`. */
/** Write-through async a Supabase para un calendar_event. */
async function syncCalendarToSupabase(ev: CalendarEvent, ownerOrgId: string) {
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return;
    /* Map seed-style fields → DB columns. Mismo mapping que en
     * generate-crm-seed.ts · status/type. */
    const statusMap: Record<string, string> = {
      "scheduled": "scheduled", "confirmed": "confirmed", "done": "done",
      "cancelled": "cancelled", "rescheduled": "rescheduled",
      "noshow": "cancelled", "pending-confirmation": "scheduled",
    };
    const typeMap: Record<string, string> = {
      "visit": "visit", "call": "call", "meeting": "meeting",
      "task": "task", "block": "block", "followup": "followup",
      "reminder": "task",
    };
    const startsAt = (ev as { startsAt?: string; start?: string }).startsAt
      ?? (ev as { start?: string }).start;
    const endsAt = (ev as { endsAt?: string; end?: string }).endsAt
      ?? (ev as { end?: string }).end ?? startsAt;
    if (!startsAt || !endsAt) return;
    const evRegId = (ev as { registroId?: string }).registroId;
    /* Solo mantener registro_id si el FK existe. Sino null. */
    const registroId = evRegId ? evRegId : null;
    const { error } = await supabase.from("calendar_events").upsert({
      id: ev.id,
      organization_id: ownerOrgId,
      type: typeMap[(ev as { type?: string }).type ?? "task"] ?? "task",
      status: statusMap[(ev as { status?: string }).status ?? "scheduled"] ?? "scheduled",
      title: (ev as { title?: string }).title ?? "",
      description: (ev as { description?: string }).description ?? null,
      starts_at: startsAt,
      ends_at: endsAt,
      contact_id: (ev as { contactId?: string }).contactId ?? null,
      registro_id: registroId,
      promotion_id: (ev as { promotionId?: string }).promotionId ?? null,
      lead_id: null,
      location: (ev as { location?: string }).location ?? null,
      assignee_user_id: null,
    });
    if (error) console.warn("[calendar:sync] upsert failed:", error.message);
  } catch (e) { console.warn("[calendar:sync] skipped:", e); }
}

async function deleteCalendarFromSupabase(id: string) {
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return;
    /* Borrar evaluations primero · FK constraint. */
    await supabase.from("visit_evaluations").delete().eq("calendar_event_id", id);
    const { error } = await supabase.from("calendar_events").delete().eq("id", id);
    if (error) console.warn("[calendar:delete] failed:", error.message);
  } catch (e) { console.warn("[calendar:delete] skipped:", e); }
}

/** Persiste la evaluación de una visita a `visit_evaluations` table.
 *  Llamar tras `updateCalendarEvent({ status: "done", evaluation: {...} })`.
 *  El frontend ya actualiza el evento con la evaluación inline ·
 *  esto solo añade la fila en la tabla dedicada (auditoría/queries). */
export async function persistVisitEvaluation(
  calendarEventId: string,
  outcome: string,
  rating?: number,
  notes?: string,
): Promise<void> {
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("visit_evaluations").insert({
      calendar_event_id: calendarEventId,
      outcome,
      rating: rating ?? null,
      notes: notes ?? null,
      by_user_id: user?.id ?? null,
    });
    if (error) console.warn("[visit_evaluations:insert]", error.message);
  } catch (e) { console.warn("[visit_evaluations:insert] skipped:", e); }
}

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
  /* Write-through · org dueño es developer-default en mock. */
  void syncCalendarToSupabase(ev, "developer-default");
  return ev;
}

/** Actualiza un evento. Si el evento venía del seed, se guarda un
 *  override · si venía de overrides, se muta el override. */
export function updateCalendarEvent(id: string, patch: Partial<CalendarEvent>): void {
  const list = getCalendarEvents();
  const existing = list.find((e) => e.id === id);
  if (!existing) return;
  const overrides = loadOverrides();
  const updated = { ...existing, ...patch } as CalendarEvent;
  overrides[id] = updated;
  saveOverrides(overrides);
  void syncCalendarToSupabase(updated, "developer-default");
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
  void deleteCalendarFromSupabase(id);
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
