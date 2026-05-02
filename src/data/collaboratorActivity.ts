/**
 * Mock de actividad mensual por agencia colaboradora.
 *
 * Se usa en la pestaña "Analítica" de /colaboradores para renderizar el
 * heatmap (12 meses × N agencias). Los valores representan el número de
 * registros aportados por la agencia en ese mes (normalizados 0–10 para
 * fácil mapeo a opacidades `bg-primary/X`).
 *
 * TODO(backend): sustituir por
 *   GET /api/collaborators/activity?range=12m
 *     → { [agencyId]: number[12] }
 *
 * Orden de `monthLabels`: de hace 11 meses al actual (mismo orden que
 * los arrays de cada agencia, index 0 = mes más antiguo).
 */

import { agencies } from "@/data/agencies";

/** Etiquetas cortas de los 12 meses (más antiguo → más reciente).
 *  Para v2 usamos meses estáticos relativos a la fecha de cierre del
 *  producto (abril 2026). Cuando haya backend, se calcularán en vivo. */
export const activityMonths = [
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
  "Ene",
  "Feb",
  "Mar",
  "Abr",
] as const;

/** Mapa agencyId → array de 12 valores (registros/mes). */
export const collaboratorActivity: Record<string, number[]> = {};

/** Devuelve el máximo valor mensual para normalizar el heatmap. */
export function getMaxActivity(): number {
  const all = Object.values(collaboratorActivity).flat();
  return Math.max(1, ...all);
}

/** Agrupa actividad total del último mes para el KPI "Registros aportados (mes)". */
export function getLastMonthRegistrations(): number {
  return Object.values(collaboratorActivity).reduce(
    (acc, arr) => acc + (arr[arr.length - 1] ?? 0),
    0,
  );
}

/** Devuelve una lista de agencias para el heatmap, en el mismo orden que
 *  las keys del mapa de actividad, filtrando las que tienen datos. */
export function getActivityAgencies() {
  return agencies.filter((a) => collaboratorActivity[a.id] !== undefined);
}
