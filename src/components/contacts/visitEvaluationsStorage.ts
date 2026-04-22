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
}

export function clearEvaluation(visitId: string) {
  const store = loadStore();
  delete store[visitId];
  saveStore(store);
}

/** Devuelve todas las evaluaciones guardadas (para mergear con mocks). */
export function loadAllEvaluations(): Store {
  return loadStore();
}
