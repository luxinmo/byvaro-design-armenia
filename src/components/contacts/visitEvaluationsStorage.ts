/**
 * Storage local de evaluaciones de visitas (mientras no haya backend).
 *
 * Las evaluaciones que el agente añade desde el tab Visitas se guardan
 * en localStorage por visita id. Al cargar la conversación se mergean
 * sobre los datos del mock.
 *
 * REGLA DE NEGOCIO:
 *   Una visita con `status === "done"` SIN evaluación es una TAREA
 *   pendiente del agente. Debe aparecer en su feed de tareas y como
 *   bloqueante para cerrar el ciclo de seguimiento.
 *
 * TODO(backend): POST /api/visits/:id/evaluation { rating, clientInterest, feedback }.
 */

import type { VisitEvaluation } from "./types";

const KEY = "byvaro.visits.evaluations.v1";

type Store = Record<string, VisitEvaluation>;

function loadStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Store;
  } catch { return {}; }
}

function saveStore(s: Store) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
}

export function getEvaluation(visitId: string): VisitEvaluation | undefined {
  return loadStore()[visitId];
}

export function setEvaluation(visitId: string, ev: VisitEvaluation) {
  const store = loadStore();
  store[visitId] = ev;
  saveStore(store);
  /* Write-through · visit_evaluations table (RLS: por organization_id
   *  del calendar_event referenciado). */
  void (async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import("@/lib/supabaseClient");
      if (!isSupabaseConfigured) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const evx = ev as unknown as Record<string, unknown>;
      const { error } = await supabase.from("visit_evaluations").upsert({
        calendar_event_id: visitId,
        outcome: (evx.outcome as string) ?? (evx.clientInterest as string) ?? "unknown",
        rating: (evx.rating as number) ?? null,
        notes: (evx.feedback as string) ?? (evx.notes as string) ?? null,
        evaluated_at: new Date().toISOString(),
      }, { onConflict: "calendar_event_id" });
      if (error) console.warn("[visit_evaluations:upsert]", error.message);
    } catch (e) { console.warn("[visit_evaluations:upsert] skipped:", e); }
  })();
}

export function clearEvaluation(visitId: string) {
  const store = loadStore();
  delete store[visitId];
  saveStore(store);
  void (async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import("@/lib/supabaseClient");
      if (!isSupabaseConfigured) return;
      await supabase.from("visit_evaluations").delete().eq("calendar_event_id", visitId);
    } catch (e) { console.warn("[visit_evaluations:delete] skipped:", e); }
  })();
}

/** Devuelve todas las evaluaciones guardadas (para mergear con mocks). */
export function loadAllEvaluations(): Store {
  return loadStore();
}
