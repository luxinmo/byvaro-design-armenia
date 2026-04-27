/**
 * usagePressure.ts · Computa el contador "más urgente" del plan trial.
 *
 * Dado el plan + counters, devuelve la métrica con mayor presión
 * (% más alto contra su tope) si es ≥ NEAR_LIMIT_THRESHOLD. Si todos
 * los counters están por debajo del umbral, devuelve null.
 *
 * Lo usa `<UsagePill>` para decidir si pintar el pill ámbar y qué
 * texto mostrar.
 *
 * Solo aplica al promotor en plan trial · si el viewer es agencia o
 * el plan es `promoter_249`, devuelve null (no hay presión).
 */

import { usePlan, PLAN_LIMITS } from "@/lib/plan";
import { useUsageCounters } from "@/lib/usage";
import { useCurrentUser } from "@/lib/currentUser";

/** Porcentaje a partir del cual sale el pill (80% del límite). */
export const NEAR_LIMIT_THRESHOLD = 0.8;

export type UpgradeReason = {
  /** Etiqueta para UI · "promociones" / "agencias" / "registros". */
  label: string;
  used: number;
  limit: number;
};

export function useUpgradeReason(): UpgradeReason | null {
  const tier = usePlan();
  const counters = useUsageCounters();
  const currentUser = useCurrentUser();

  if (currentUser.accountType !== "developer") return null;
  if (tier !== "trial") return null;

  const limits = PLAN_LIMITS[tier];
  /* Calcula la presión de cada métrica · 0..1+. Mayor que 1 = ya pasada. */
  const candidates: UpgradeReason[] = [
    { label: "promociones", used: counters.activePromotions, limit: limits.activePromotions },
    { label: "agencias",    used: counters.invitedAgencies,  limit: limits.invitedAgencies },
    { label: "registros",   used: counters.registros,        limit: limits.registros },
  ];
  /* Filtra los infinitos (no aplican en trial pero por defensa). */
  const finite = candidates.filter((c) => c.limit !== Number.POSITIVE_INFINITY && c.limit > 0);
  if (finite.length === 0) return null;

  /* Ranking por ratio · si nadie pasa el umbral, no mostramos nada. */
  finite.sort((a, b) => (b.used / b.limit) - (a.used / a.limit));
  const top = finite[0];
  if (!top || top.used / top.limit < NEAR_LIMIT_THRESHOLD) return null;

  return top;
}
