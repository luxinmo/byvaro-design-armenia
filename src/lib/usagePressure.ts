/**
 * usagePressure.ts · Computa el contador "más urgente" del plan
 * actual del viewer · pill ámbar en el header (`<UsagePill>`).
 *
 * Solo hay 2 límites en Byvaro (ver `plan.ts`):
 *   · `activePromotions` · promotores · 5 (249) · 10 (329).
 *   · `collabRequests`   · agencia free · 10 en provincia.
 *
 * El pill aparece cuando el contador relevante alcanza el 80% del
 * tope. Si no hay tope (ilimitado), devuelve null y el pill no sale.
 */

import { usePlan, PLAN_LIMITS } from "@/lib/plan";
import { useUsageCounters } from "@/lib/usage";
import { useCurrentUser } from "@/lib/currentUser";

/** Porcentaje a partir del cual sale el pill (80% del límite). */
export const NEAR_LIMIT_THRESHOLD = 0.8;

export type UpgradeReason = {
  /** Etiqueta para UI · "promociones" / "solicitudes". */
  label: string;
  used: number;
  limit: number;
};

export function useUpgradeReason(): UpgradeReason | null {
  const tier = usePlan();
  const counters = useUsageCounters();
  const currentUser = useCurrentUser();
  const limits = PLAN_LIMITS[tier];

  /* Promotor · presiona contra activePromotions si el plan tiene
   *  límite finito (trial · 249 · 329). Promoter ilimitado / enterprise
   *  · no hay presión. */
  if (currentUser.accountType === "developer") {
    const limit = limits.activePromotions;
    if (limit === Number.POSITIVE_INFINITY || limit <= 0) return null;
    const used = counters.activePromotions;
    if (used / limit < NEAR_LIMIT_THRESHOLD) return null;
    return { label: "promociones", used, limit };
  }

  /* Agencia · presiona contra collabRequests · solo en agency_free.
   *  En marketplace el límite es ∞ y no hay pill. */
  if (currentUser.accountType === "agency") {
    const limit = limits.collabRequests;
    if (limit === Number.POSITIVE_INFINITY || limit <= 0) return null;
    /* TODO(backend): contador real desde
     *  `GET /api/workspace/usage` · campo collabRequestsSent. */
    const used = 0;
    if (used / limit < NEAR_LIMIT_THRESHOLD) return null;
    return { label: "solicitudes", used, limit };
  }

  return null;
}
