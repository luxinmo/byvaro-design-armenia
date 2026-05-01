/**
 * plan.ts · Suscripción del workspace y límites por plan.
 *
 * Source of truth · `public.workspace_plans` (Supabase). El localStorage
 * cache (`byvaro.plan.v1::<orgId>`) solo existe para que `usePlan()`
 * pueda devolver síncrono en el render · NO es la fuente de verdad.
 *
 * Mutaciones · `setPlan(tier)` escribe primero a Supabase (UPSERT) y
 * luego al cache. `usePlan()` hidrata desde Supabase en mount cuando
 * el cache está vacío.
 *
 * TODO(backend) · Stripe webhook actualiza la fila tras
 * `customer.subscription.created/updated` · cliente NO debe llamar a
 * `setPlan("promoter_249")` salvo durante validación frontend-only.
 */

import { useEffect, useState } from "react";
import { useCurrentUser, currentWorkspaceKey } from "@/lib/currentUser";
import type { CurrentUser } from "@/lib/currentUser";

/* ══════ Tipos ════════════════════════════════════════════════════ */

export type PlanTier =
  | "trial"
  | "promoter_249"
  | "promoter_329"
  | "agency_free"
  | "agency_marketplace"
  | "enterprise";

export type PlanLimits = {
  activePromotions: number;
  collabRequests: number;
  signaturesPerMonth: number;
  landingPages: number;
};

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  trial: { activePromotions: 5, collabRequests: Number.POSITIVE_INFINITY, signaturesPerMonth: 50, landingPages: Number.POSITIVE_INFINITY },
  promoter_249: { activePromotions: 5, collabRequests: Number.POSITIVE_INFINITY, signaturesPerMonth: 50, landingPages: Number.POSITIVE_INFINITY },
  promoter_329: { activePromotions: 10, collabRequests: Number.POSITIVE_INFINITY, signaturesPerMonth: 50, landingPages: Number.POSITIVE_INFINITY },
  agency_free: { activePromotions: Number.POSITIVE_INFINITY, collabRequests: 10, signaturesPerMonth: 0, landingPages: 10 },
  agency_marketplace: { activePromotions: Number.POSITIVE_INFINITY, collabRequests: Number.POSITIVE_INFINITY, signaturesPerMonth: 15, landingPages: Number.POSITIVE_INFINITY },
  enterprise: { activePromotions: Number.POSITIVE_INFINITY, collabRequests: Number.POSITIVE_INFINITY, signaturesPerMonth: Number.POSITIVE_INFINITY, landingPages: Number.POSITIVE_INFINITY },
};

export const PLAN_LABEL: Record<PlanTier, string> = {
  trial: "Promotor · 6 meses gratis",
  promoter_249: "Promotor · 249€/mes",
  promoter_329: "Promotor · 329€/mes",
  agency_free: "Agencia · Gratis",
  agency_marketplace: "Agencia · Marketplace · 99€/mes",
  enterprise: "Enterprise",
};

export function isAgencyPlan(tier: PlanTier): boolean {
  return tier === "agency_free" || tier === "agency_marketplace";
}
export function isPromoterPlan(tier: PlanTier): boolean {
  return tier === "trial" || tier === "promoter_249" || tier === "promoter_329";
}
export function isPaidPlan(tier: PlanTier): boolean {
  return tier === "promoter_249" || tier === "promoter_329"
    || tier === "agency_marketplace" || tier === "enterprise";
}

/* ══════ Cache local · render-only ════════════════════════════════ */

const KEY_PREFIX = "byvaro.plan.v1::";
const CHANGE_EVENT = "byvaro:plan-change";

const ALL_TIERS: PlanTier[] = [
  "trial", "promoter_249", "promoter_329",
  "agency_free", "agency_marketplace", "enterprise",
];

function keyFor(workspaceKey: string): string {
  return `${KEY_PREFIX}${workspaceKey}`;
}

function readCache(workspaceKey: string): PlanTier | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(keyFor(workspaceKey));
  if (raw && (ALL_TIERS as string[]).includes(raw)) return raw as PlanTier;
  return null;
}

function writeCache(workspaceKey: string, tier: PlanTier): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(keyFor(workspaceKey), tier);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { workspaceKey } }));
}

/* ══════ Source of truth · Supabase ═══════════════════════════════ */

/** Resolve org id desde el current user · 'developer-default' single-tenant. */
function orgIdForUser(user: CurrentUser): string {
  if (user.accountType === "agency" && user.agencyId) return user.agencyId;
  return "developer-default";
}

function defaultTierForUser(user: CurrentUser): PlanTier {
  return user.accountType === "agency" ? "agency_free" : "trial";
}

/** Hidrata el plan desde Supabase y refresca el cache local. */
export async function hydratePlanFromSupabase(user: CurrentUser): Promise<PlanTier | null> {
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return null;
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return null;
    const orgId = orgIdForUser(user);
    const { data, error } = await supabase
      .from("workspace_plans")
      .select("tier")
      .eq("organization_id", orgId)
      .maybeSingle();
    if (error) {
      console.warn("[plan:hydrate]", error.message);
      return null;
    }
    const tier = (data?.tier ?? null) as PlanTier | null;
    if (tier) writeCache(currentWorkspaceKey(user), tier);
    return tier;
  } catch (e) {
    console.warn("[plan:hydrate] skipped:", e);
    return null;
  }
}

/** Lee el plan actual del cache · sync · safe-server. */
export function getCurrentPlan(user?: CurrentUser): PlanTier {
  if (typeof window === "undefined") return "trial";
  if (user) {
    const cached = readCache(currentWorkspaceKey(user));
    if (cached) return cached;
    return defaultTierForUser(user);
  }
  /* Fallback legacy · sin user, intenta cualquier tier guardado */
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(KEY_PREFIX)) {
      const v = localStorage.getItem(k);
      if (v && (ALL_TIERS as string[]).includes(v)) return v as PlanTier;
    }
  }
  return "trial";
}

/** Cambia el plan · write-through (Supabase upsert + cache). */
export function setPlan(user: CurrentUser, tier: PlanTier): void {
  if (typeof window === "undefined") return;
  const orgId = orgIdForUser(user);
  writeCache(currentWorkspaceKey(user), tier);

  void (async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
      if (!isSupabaseConfigured) return;
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      const { error } = await supabase
        .from("workspace_plans")
        .upsert({
          organization_id: orgId,
          tier,
          activated_at: isPaidPlan(tier) ? new Date().toISOString() : null,
          cancelled_at: tier === "trial" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "organization_id" });
      if (error) console.warn("[plan:set]", error.message);
    } catch (e) {
      console.warn("[plan:set] skipped:", e);
    }
  })();
}

export function subscribeToPromoter249(user: CurrentUser): void {
  setPlan(user, "promoter_249");
}

export function cancelSubscription(user: CurrentUser): void {
  setPlan(user, "trial");
}

/* ══════ Hook reactivo ════════════════════════════════════════════ */

export function usePlan(): PlanTier {
  const user = useCurrentUser();
  const wsKey = currentWorkspaceKey(user);
  const [tier, setTier] = useState<PlanTier>(() =>
    readCache(wsKey) ?? defaultTierForUser(user),
  );

  /* Hidratación desde Supabase en mount si el cache está vacío. */
  useEffect(() => {
    let cancelled = false;
    if (readCache(wsKey)) return; // ya hidratado
    void (async () => {
      const fromDb = await hydratePlanFromSupabase(user);
      if (cancelled) return;
      if (fromDb) setTier(fromDb);
    })();
    return () => { cancelled = true; };
  }, [user, wsKey]);

  useEffect(() => {
    const cb = () => {
      const fromCache = readCache(wsKey);
      if (fromCache) setTier(fromCache);
    };
    window.addEventListener(CHANGE_EVENT, cb);
    window.addEventListener("storage", cb);
    return () => {
      window.removeEventListener(CHANGE_EVENT, cb);
      window.removeEventListener("storage", cb);
    };
  }, [wsKey]);

  /* Default per accountType cuando el storage no tiene un tier
   *  congruente con el rol. */
  if (user.accountType === "agency" && !isAgencyPlan(tier)) {
    return "agency_free";
  }
  if (user.accountType === "developer" && !isPromoterPlan(tier) && tier !== "enterprise") {
    return "trial";
  }
  return tier;
}

export function usePlanLimits(): PlanLimits {
  const tier = usePlan();
  return PLAN_LIMITS[tier];
}
