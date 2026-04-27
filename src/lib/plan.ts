/**
 * plan.ts · Suscripción del workspace y límites por plan (Fase 1).
 *
 * QUÉ
 * ----
 * Modelo mínimo de "plan activo" del workspace para validar el
 * paywall de 249€/mes para promotores. Solo dos tiers en Fase 1:
 *
 *   · `trial`         · gratis, con límites duros que disparan el modal
 *                       de upgrade (CLAUDE.md §"Paywall validación").
 *   · `promoter_249`  · pagado · 249€/mes + IVA · sin tope práctico.
 *
 * Las agencias permanecen FREE (no se monetizan en Fase 1) — su plan
 * es siempre `trial` pero los gates no se evalúan en cuentas con
 * `accountType !== "developer"`.
 *
 * CÓMO
 * ----
 * Persistencia mock: `localStorage` con clave `byvaro.plan.v1`. Esta
 * clave es **workspace-level** (todos los miembros del developer
 * comparten el mismo plan). El hook `usePlan()` se suscribe al evento
 * `byvaro:plan-change` y al `storage` event para reaccionar en vivo
 * y entre pestañas.
 *
 * TODO(backend):
 *   GET  /api/workspace/plan          → { tier, since, expiresAt? }
 *   POST /api/workspace/plan/subscribe { stripePriceId } → 200
 *   POST /api/workspace/plan/cancel   → 200
 *   El backend respeta workspace-tenancy: el plan vive en la
 *   organización (developer org), nunca por usuario.
 */

import { useEffect, useState } from "react";

/* ══════ Tipos ════════════════════════════════════════════════════ */

export type PlanTier = "trial" | "promoter_249";

export type PlanLimits = {
  /** Promociones en estado "activa" simultáneas. */
  activePromotions: number;
  /** Agencias invitadas (cualquier estado · pendiente, activa, etc). */
  invitedAgencies: number;
  /** Registros recibidos en total (acumulado · pendientes + decididos). */
  registros: number;
};

/**
 * Límites por plan (Fase 1 · validación).
 *
 * Los números del trial son **tunables**. Pensados para que el promotor
 * llegue a probar el producto con sustancia antes de toparse con el
 * paywall: una promoción no basta (1 era demasiado restrictivo · te
 * obliga a pagar antes de ver valor), 2 le permite comparar.
 *
 * trial · 2 promociones / 5 agencias / 40 registros.
 * promoter_249 · 5 promociones (cap del producto) / ilimitado / ilimitado.
 */
export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  trial: {
    activePromotions: 2,
    invitedAgencies: 5,
    registros: 40,
  },
  promoter_249: {
    activePromotions: 5,
    invitedAgencies: Number.POSITIVE_INFINITY,
    registros: Number.POSITIVE_INFINITY,
  },
};

/** Etiqueta humana del plan (para UI). */
export const PLAN_LABEL: Record<PlanTier, string> = {
  trial: "Gratis",
  promoter_249: "Promotor · 249€/mes",
};

/* ══════ Storage ══════════════════════════════════════════════════ */

const STORAGE_KEY = "byvaro.plan.v1";
const CHANGE_EVENT = "byvaro:plan-change";

function readPlan(): PlanTier {
  if (typeof window === "undefined") return "trial";
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === "promoter_249" ? "promoter_249" : "trial";
}

/** Lee el plan actual del workspace · safe-server (devuelve "trial"). */
export function getCurrentPlan(): PlanTier {
  return readPlan();
}

/** Cambia el plan del workspace · dispara evento para refrescar UI. */
export function setPlan(tier: PlanTier) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, tier);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Helper para el flujo "suscribirse" del UpgradeModal · simula la
 *  activación instantánea (en backend real haría POST /subscribe). */
export function subscribeToPromoter249() {
  setPlan("promoter_249");
}

/** Helper para "cancelar suscripción" desde /ajustes/plan. */
export function cancelSubscription() {
  setPlan("trial");
}

/* ══════ Hook reactivo ════════════════════════════════════════════ */

/** React hook · devuelve el tier vigente y se actualiza en vivo. */
export function usePlan(): PlanTier {
  const [tier, setTier] = useState<PlanTier>(readPlan);
  useEffect(() => {
    const cb = () => setTier(readPlan());
    window.addEventListener(CHANGE_EVENT, cb);
    window.addEventListener("storage", cb);
    return () => {
      window.removeEventListener(CHANGE_EVENT, cb);
      window.removeEventListener("storage", cb);
    };
  }, []);
  return tier;
}

/** Conveniencia · devuelve los límites del plan actual ya resueltos. */
export function usePlanLimits(): PlanLimits {
  const tier = usePlan();
  return PLAN_LIMITS[tier];
}

/** ¿El workspace ya está en plan pagado? · útil para gates. */
export function isPaidPlan(tier: PlanTier): boolean {
  return tier === "promoter_249";
}
