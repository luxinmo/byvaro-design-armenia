/**
 * labels.ts — Persistencia de etiquetas personalizadas en localStorage.
 *
 * Se guardan las etiquetas creadas por el usuario para que sobrevivan
 * a recargas. Los emails siguen siendo mock en memoria (se resetean
 * al recargar), por lo que si asignas una etiqueta a un email, la
 * etiqueta persiste pero la asignación no. TODO(backend) resolverá
 * ambas cosas juntas con una tabla `emails`.
 *
 * Clave:
 *   byvaro.emailLabels.v1 → Label[]
 */

export type Label = {
  name: string;
  color: string; // clase tailwind (bg-warning, bg-success, …)
};

const KEY = "byvaro.emailLabels.v1";

export function loadLabels(fallback: Label[]): Label[] {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Label[];
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function saveLabels(labels: Label[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(labels));
}
