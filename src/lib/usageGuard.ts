/**
 * usageGuard.ts · Bloqueo de acciones cuando se llega al límite del plan.
 *
 * QUÉ
 * ----
 * Capa fina sobre `usePlan()` + `useUsageCounters()` que responde
 * por acción ("createPromotion" | "inviteAgency" | "acceptRegistro")
 * si está bloqueada o no, y expone un `openUpgrade()` para disparar
 * el `UpgradeModal` global.
 *
 * Fase 1 monetiza solo promotores · si el viewer es agencia, los
 * gates devuelven `blocked: false` siempre (ver helper isMonetized).
 *
 * CÓMO
 * ----
 *   const guard = useUsageGuard("createPromotion");
 *   if (guard.blocked) {
 *     guard.openUpgrade();
 *     return;
 *   }
 *   // continuar con la acción
 *
 * El `UpgradeModal` se monta UNA VEZ en `App.tsx` y escucha el store
 * singleton `upgradeModalStore`. Cualquier componente puede llamar
 * `openUpgradeModal({ trigger })` y verá el modal · igual que `toast`.
 *
 * TODO(backend):
 *   El backend valida los mismos límites en cada endpoint mutante
 *   (POST /promociones, POST /agencies/invite, POST /registros/:id/approve).
 *   Devuelve 402 Payment Required con `{ trigger, limit, used }` si
 *   se llega al tope, y la UI usa ese payload para abrir el modal
 *   (con la misma copy que ya tenemos en mock).
 */

import { useSyncExternalStore } from "react";
import { usePlan, usePlanState, PLAN_LIMITS, deriveLimits, type PlanTier } from "@/lib/plan";
import { useUsageCounters, type UsageCounters } from "@/lib/usage";
import { useCurrentUser } from "@/lib/currentUser";

/* ══════ Tipos ════════════════════════════════════════════════════ */

/** Trigger del paywall · alineado con las acciones bloqueables de Fase 1. */
export type PaywallTrigger =
  | "createPromotion"
  | "inviteAgency"
  | "acceptRegistro"
  | "collabRequest"   // agencia envía solicitud de colaboración a un promotor
  | "near_limit";     // entrada manual desde banner del header

export type GuardResult = {
  /** ¿La acción está bloqueada por el plan actual? */
  blocked: boolean;
  /** Cuánto lleva usado el contador relevante · null si no aplica. */
  used: number | null;
  /** Tope del plan · `Infinity` significa sin tope. */
  limit: number;
  /** Plan vigente. */
  tier: PlanTier;
  /** Abre el `UpgradeModal` con el trigger en cuestión. */
  openUpgrade: () => void;
};

/* ══════ Mapping trigger → contador ═══════════════════════════════ */

function counterFor(action: PaywallTrigger, c: UsageCounters): number | null {
  switch (action) {
    case "createPromotion": return c.activePromotions;
    case "collabRequest":   return c.collabRequests;
    /* `inviteAgency` y `acceptRegistro` ya NO son límites del producto
     *  · se quedan como no-op para no romper consumers existentes. */
    case "inviteAgency":    return null;
    case "acceptRegistro":  return null;
    case "near_limit":      return null;
  }
}

function limitFor(action: PaywallTrigger, tier: PlanTier): number {
  const lim = PLAN_LIMITS[tier];
  switch (action) {
    case "createPromotion": return lim.activePromotions;
    case "collabRequest":   return lim.collabRequests;
    case "inviteAgency":    return Number.POSITIVE_INFINITY;
    case "acceptRegistro":  return Number.POSITIVE_INFINITY;
    case "near_limit":      return Number.POSITIVE_INFINITY;
  }
}

/** ¿El viewer está en una persona monetizada en Fase 1? · ahora con
 *  el modelo de packs split, la monetización depende del PACK del
 *  workspace, no del accountType original. Cualquier viewer con el
 *  pack relevante activo está sujeto a gate del paywall. */
function isMonetizedAction(action: PaywallTrigger): boolean {
  if (action === "createPromotion") return true;
  if (action === "collabRequest") return true;
  return false;
}

/* ══════ Hook principal ═══════════════════════════════════════════ */

export function useUsageGuard(action: PaywallTrigger): GuardResult {
  const planState = usePlanState();
  const tier = usePlan();
  const counters = useUsageCounters();

  const limits = deriveLimits(planState);

  /* Limit según el pack relevante de la acción · si el pack está
   *  inactivo (agency_pack=none o promoter_pack=none), limit=0 ·
   *  blocked=true desde la primera intentona. */
  let limit = Number.POSITIVE_INFINITY;
  if (action === "createPromotion") limit = limits.activePromotions;
  else if (action === "collabRequest") limit = limits.collabRequests;

  const used = counterFor(action, counters);
  const monetized = isMonetizedAction(action);

  const blocked =
    monetized
    && action !== "near_limit"
    && (used ?? 0) >= limit;

  return {
    blocked,
    used,
    limit,
    tier,
    openUpgrade: () => openUpgradeModal({ trigger: action, used: used ?? 0, limit }),
  };
}

/* ══════ Singleton store del UpgradeModal ═════════════════════════ */

export type UpgradeModalState =
  | { open: false }
  | { open: true; trigger: PaywallTrigger; used: number; limit: number };

let state: UpgradeModalState = { open: false };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function openUpgradeModal(payload: {
  trigger: PaywallTrigger;
  used: number;
  limit: number;
}) {
  /* El tracking del evento `paywall.shown` lo emite el propio
     `<UpgradeModal>` cuando reacciona al cambio de estado · allí tiene
     acceso a hooks (`useCurrentUser`, `usePlan`) y puede enriquecer el
     payload con `tier`, `userRole`, `organizationId`. Mantener este
     setter sin tracking evita duplicar llamadas y desacopla el store
     del proveedor analítico.
     TODO(backend/analytics): si en el futuro un emisor non-React abre
     el modal, llamar `track("paywall.shown", ...)` aquí pasando el
     contexto manualmente · ver `src/lib/analytics.ts`. */
  state = { open: true, ...payload };
  emit();
}

export function closeUpgradeModal() {
  state = { open: false };
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot(): UpgradeModalState {
  return state;
}

/** React hook · devuelve el estado del modal global. Solo el
 *  componente `<UpgradeModal>` montado en `App.tsx` lo consume. */
export function useUpgradeModalState(): UpgradeModalState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
