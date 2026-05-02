/**
 * plan.ts · Modelo de planes con DOS packs independientes.
 *
 * Source of truth · `public.workspace_plans` (Supabase) con tres campos:
 *   · `signup_kind`     · "agency" | "promoter" · determinado al crear
 *     cuenta · NO cambia · gobierna los beneficios "alta nueva".
 *   · `agency_pack`     · "none" | "free" | "marketplace"
 *   · `promoter_pack`   · "none" | "trial" | "promoter_249" | "promoter_329"
 *
 * Cada workspace puede tener AMBOS packs activos (un promotor que
 * además quiere catálogo de inmobiliarias activa el agency_pack).
 *
 * BENEFICIOS "ALTA NUEVA" (no se heredan al activar el otro pack):
 *   · 10 solicitudes de colaboración gratis · solo agency_pack=free
 *     CON signup_kind=agency. Si signup_kind=promoter activa el
 *     agency_pack=free, paga 0€ pero 0 solicitudes.
 *   · 6 meses gratis (trial) · solo promoter_pack=trial CON
 *     signup_kind=promoter. Si signup_kind=agency quiere actuar
 *     como promotor, debe pagar 249€/mes desde el día 1.
 *
 * BACKWARDS COMPAT
 * ----------------
 * `usePlan()` se mantiene · devuelve un `PlanTier` derivado del pack
 * "principal" (el del signup_kind). Componentes que aún no han
 * migrado al modelo de packs siguen funcionando.
 */

import { useEffect, useState } from "react";
import { memCache } from "./memCache";
import { useCurrentUser, currentWorkspaceKey } from "@/lib/currentUser";
import type { CurrentUser } from "@/lib/currentUser";

/* ══════ Tipos ════════════════════════════════════════════════════ */

/** Legacy single-tier · derivado del pack principal · backwards-compat. */
export type PlanTier =
  | "trial"
  | "promoter_249"
  | "promoter_329"
  | "agency_free"
  | "agency_marketplace"
  | "enterprise";

export type SignupKind = "agency" | "promoter";
export type AgencyPack = "none" | "free" | "marketplace";
export type PromoterPack = "none" | "trial" | "promoter_249" | "promoter_329";

export type PlanState = {
  signupKind: SignupKind;
  agencyPack: AgencyPack;
  promoterPack: PromoterPack;
  /** ISO date · solo presente si promoterPack === "trial" · usado para
   *  mostrar "tu prueba acaba el dd/mm/yyyy · N días restantes" en
   *  `/ajustes/facturacion/plan`. Lo setea el trigger DB al crear el
   *  workspace (`now() + interval '6 months'`). */
  trialEndsAt?: string;
  /** ISO date · cuándo arrancó el trial · usado para auditoría y para
   *  saber cuánto del trial se ha consumido. */
  trialStartedAt?: string;
};

export type PlanLimits = {
  /** Promociones en estado "activa" simultáneas · derivado del
   *  promoter_pack. Si pack="none", 0 (no puede crear). */
  activePromotions: number;
  /** Solicitudes de colaboración pendientes · derivado del agency_pack
   *  + signup_kind. Las 10 de free son benefit del alta agencia ·
   *  NO se heredan al activar el pack desde un workspace promoter. */
  collabRequests: number;
  /** Firmas Firmafy/mes incluidas · combinado de ambos packs. */
  signaturesPerMonth: number;
  /** Landing pages publicadas · combinado de ambos packs. */
  landingPages: number;
};

/* ══════ Defaults y derivación de límites ═════════════════════════ */

export const DEFAULT_PLAN_STATE_AGENCY: PlanState = {
  signupKind: "agency",
  agencyPack: "free",
  promoterPack: "none",
};

/** Genera el state default del promotor con trialEndsAt sintético
 *  basado en la hora actual · usado para que la primera pintura
 *  ANTES de que la hidratación termine ya muestre el contador
 *  correcto en `/ajustes/facturacion/plan`. La hidratación
 *  posterior reemplaza con la fecha real del DB. */
function buildDefaultPromoterState(): PlanState {
  const now = Date.now();
  return {
    signupKind: "promoter",
    agencyPack: "none",
    promoterPack: "trial",
    trialStartedAt: new Date(now).toISOString(),
    trialEndsAt: new Date(now + 180 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

export const DEFAULT_PLAN_STATE_PROMOTER: PlanState = buildDefaultPromoterState();

/** Computa los límites efectivos a partir de la combinación de packs.
 *  Suma capabilities · si solo tiene agency_pack, no puede crear
 *  promociones. Si solo tiene promoter_pack, no puede enviar
 *  solicitudes a otros promotores. */
export function deriveLimits(state: PlanState): PlanLimits {
  /* ── Promociones activas (gate de promoter_pack) ── */
  let activePromotions = 0;
  if (state.promoterPack === "trial" || state.promoterPack === "promoter_249") activePromotions = 5;
  else if (state.promoterPack === "promoter_329") activePromotions = 10;

  /* ── Solicitudes de colaboración (gate de agency_pack) ──
   *  · 10 solo si signup=agency + free (alta nueva).
   *  · ∞ si marketplace (paga 99€).
   *  · 0 si none o si signup=promoter activa free (no benefit). */
  let collabRequests = 0;
  if (state.agencyPack === "marketplace") {
    collabRequests = Number.POSITIVE_INFINITY;
  } else if (state.agencyPack === "free" && state.signupKind === "agency") {
    collabRequests = 10;
  }

  /* ── Firmas digitales · suma ambos packs ──
   *  · promoter_249/329/trial · 50/mes
   *  · agency_marketplace · 15/mes
   *  · agency_free · 0
   *  Los packs combinados suman (un workspace dual con 249+marketplace
   *  tiene 50+15=65/mes). */
  let signaturesPerMonth = 0;
  if (state.promoterPack === "trial"
   || state.promoterPack === "promoter_249"
   || state.promoterPack === "promoter_329") {
    signaturesPerMonth += 50;
  }
  if (state.agencyPack === "marketplace") signaturesPerMonth += 15;

  /* ── Landing pages ─ ilimitadas en cualquier plan de pago ── */
  let landingPages = 10; // base
  if (state.promoterPack !== "none" || state.agencyPack === "marketplace") {
    landingPages = Number.POSITIVE_INFINITY;
  }

  return { activePromotions, collabRequests, signaturesPerMonth, landingPages };
}

/* ══════ Labels y helpers ═════════════════════════════════════════ */

export const AGENCY_PACK_LABEL: Record<AgencyPack, string> = {
  none: "Sin pack agencia",
  free: "Agencia · Gratis",
  marketplace: "Agencia · Marketplace · 99€/mes",
};

export const PROMOTER_PACK_LABEL: Record<PromoterPack, string> = {
  none: "Sin pack promotor",
  /* FILOSOFÍA · "trial" en DB se traduce visualmente a "Plan Gratis"
   *  porque el trial NO es un plan distinto · es una ventana de
   *  180 días de bonus encima del plan Gratis. Cuando se acaba la
   *  ventana, el promotor sigue en el plan Gratis (acceso a sus
   *  datos · sin crear promociones nuevas) o decide pasar al de pago.
   *  Ver `/ajustes/facturacion/plan` · explicación de las 3 cajas. */
  trial: "Plan Gratis",
  promoter_249: "Promotor · 249€/mes",
  promoter_329: "Promotor · 329€/mes",
};

/** Etiqueta humana del estado total (paquete principal). */
export function planLabel(state: PlanState): string {
  if (state.signupKind === "agency") return AGENCY_PACK_LABEL[state.agencyPack];
  return PROMOTER_PACK_LABEL[state.promoterPack];
}

export function isAgencyActive(state: PlanState): boolean {
  return state.agencyPack !== "none";
}
export function isPromoterActive(state: PlanState): boolean {
  return state.promoterPack !== "none";
}
export function isAgencyPaid(state: PlanState): boolean {
  return state.agencyPack === "marketplace";
}
export function isPromoterPaid(state: PlanState): boolean {
  return state.promoterPack === "promoter_249" || state.promoterPack === "promoter_329";
}

/* ── Backwards-compat con el modelo single-tier ── */

/** Deriva un `PlanTier` legacy desde el `PlanState` · prioriza el
 *  pack principal según `signup_kind`. Usado por componentes que aún
 *  no han migrado a `usePlanState()`. */
export function tierFromState(state: PlanState): PlanTier {
  if (state.signupKind === "agency") {
    if (state.agencyPack === "marketplace") return "agency_marketplace";
    return "agency_free";
  }
  if (state.promoterPack === "trial") return "trial";
  if (state.promoterPack === "promoter_249") return "promoter_249";
  if (state.promoterPack === "promoter_329") return "promoter_329";
  return "trial";
}

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

/* ── Legacy `PLAN_LIMITS` table · derivado de cada tier asumiendo
 *  signup matching · usado por consumers que aún no leen
 *  `usePlanLimits()`. */
export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  trial: deriveLimits({ signupKind: "promoter", agencyPack: "none", promoterPack: "trial" }),
  promoter_249: deriveLimits({ signupKind: "promoter", agencyPack: "none", promoterPack: "promoter_249" }),
  promoter_329: deriveLimits({ signupKind: "promoter", agencyPack: "none", promoterPack: "promoter_329" }),
  agency_free: deriveLimits({ signupKind: "agency", agencyPack: "free", promoterPack: "none" }),
  agency_marketplace: deriveLimits({ signupKind: "agency", agencyPack: "marketplace", promoterPack: "none" }),
  enterprise: { activePromotions: Number.POSITIVE_INFINITY, collabRequests: Number.POSITIVE_INFINITY, signaturesPerMonth: Number.POSITIVE_INFINITY, landingPages: Number.POSITIVE_INFINITY },
};

export const PLAN_LABEL: Record<PlanTier, string> = {
  trial: "Plan Gratis",
  promoter_249: "Promotor · 249€/mes",
  promoter_329: "Promotor · 329€/mes",
  agency_free: "Agencia · Gratis",
  agency_marketplace: "Agencia · Marketplace · 99€/mes",
  enterprise: "Enterprise",
};

/** Duración total del trial · constante canónica · cambiar aquí
 *  refleja en el counter de días, en el trigger DB y en la copy. */
export const TRIAL_DURATION_DAYS = 180;

/* ══════ Trial helpers ════════════════════════════════════════════ */

/** Días restantes del trial · usado en el subtítulo de
 *  `/ajustes/facturacion/plan` y en banners. Devuelve null si no hay
 *  trial activo o no hay `trialEndsAt` en el state.
 *  Negativo si el trial ya expiró (el promotor sigue en plan Gratis
 *  pero ya no tiene los privilegios "alta nueva"). */
export function trialDaysRemaining(state: PlanState): number | null {
  if (state.promoterPack !== "trial" || !state.trialEndsAt) return null;
  const end = new Date(state.trialEndsAt).getTime();
  const now = Date.now();
  return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
}

/** ¿Está el promotor dentro de la ventana de 180 días con acceso
 *  completo? Si false, está en plan Gratis "puro" (acceso a sus
 *  datos · sin crear promociones nuevas hasta upgrade).
 *  Una agencia (`promoterPack !== 'trial'`) NO está en trial · su
 *  plan Gratis ya es el estable, sin contador. */
export function isInTrialWindow(state: PlanState): boolean {
  const days = trialDaysRemaining(state);
  return days !== null && days > 0;
}

/** Días consumidos del trial · útil para barras de progreso. */
export function trialDaysConsumed(state: PlanState): number | null {
  if (state.promoterPack !== "trial" || !state.trialStartedAt) return null;
  const start = new Date(state.trialStartedAt).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
}

/** Fecha legible del fin del trial · "2 de noviembre de 2026". */
export function formatTrialEndDate(state: PlanState): string | null {
  if (!state.trialEndsAt) return null;
  try {
    return new Date(state.trialEndsAt).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

/* ══════ Cache local · render-only ════════════════════════════════ */

/* Bump v3 · invalida cualquier cache previo que no tenía
 *  trialStartedAt/trialEndsAt · evita estados inconsistentes
 *  durante la primera pintura post-deploy. */
const KEY_PREFIX = "byvaro.plan.v3::";
const CHANGE_EVENT = "byvaro:plan-change";

function keyFor(workspaceKey: string): string {
  return `${KEY_PREFIX}${workspaceKey}`;
}

function readCache(workspaceKey: string): PlanState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = memCache.getItem(keyFor(workspaceKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlanState;
    if (parsed.signupKind && parsed.agencyPack && parsed.promoterPack) return parsed;
    return null;
  } catch { return null; }
}

function writeCache(workspaceKey: string, state: PlanState): void {
  if (typeof window === "undefined") return;
  memCache.setItem(keyFor(workspaceKey), JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { workspaceKey } }));
}

/* ══════ Source of truth · Supabase ═══════════════════════════════ */

function orgIdForUser(user: CurrentUser): string {
  if (user.accountType === "agency" && user.agencyId) return user.agencyId;
  /* Developer · prioriza el `organizationId` real (viene del JWT +
   *  organization_members al login). Solo cae al sentinel "developer-
   *  default" para mocks legacy sin signup real. */
  if (user.organizationId) return user.organizationId;
  return "developer-default";
}

function defaultStateForUser(user: CurrentUser): PlanState {
  return user.accountType === "agency"
    ? DEFAULT_PLAN_STATE_AGENCY
    : DEFAULT_PLAN_STATE_PROMOTER;
}

/** Hidrata el plan desde Supabase usando los datos de sessionStorage
 *  (no requiere CurrentUser construido) · llamado por
 *  `SupabaseHydrator` al login + on-auth-change. Internamente reusa
 *  `hydratePlanFromSupabase` con un user sintético. */
export async function hydratePlanForCurrentUser(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const { readAccountType } = await import("./accountType");
    const snap = readAccountType();
    const synthUser: CurrentUser = {
      id: "anonymous",
      name: "",
      email: snap.developerEmail ?? "",
      role: "admin",
      organizationId: snap.organizationId ?? "",
      accountType: snap.type,
      agencyId: snap.type === "agency" ? snap.agencyId : undefined,
    };
    await hydratePlanFromSupabase(synthUser);
  } catch (e) {
    console.warn("[plan:hydrate] skipped:", e);
  }
}

export async function hydratePlanFromSupabase(user: CurrentUser): Promise<PlanState | null> {
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return null;
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return null;
    const orgId = orgIdForUser(user);
    const { data, error } = await supabase
      .from("workspace_plans")
      .select("signup_kind, agency_pack, promoter_pack, trial_started_at, trial_ends_at")
      .eq("organization_id", orgId)
      .maybeSingle();
    if (error) {
      console.warn("[plan:hydrate]", error.message);
      return null;
    }
    if (!data) return null;
    const state: PlanState = {
      signupKind: (data.signup_kind as SignupKind) ?? defaultStateForUser(user).signupKind,
      agencyPack: (data.agency_pack as AgencyPack) ?? "none",
      promoterPack: (data.promoter_pack as PromoterPack) ?? "none",
      trialStartedAt: data.trial_started_at ?? undefined,
      trialEndsAt: data.trial_ends_at ?? undefined,
    };
    writeCache(currentWorkspaceKey(user), state);
    return state;
  } catch (e) {
    console.warn("[plan:hydrate] skipped:", e);
    return null;
  }
}

/* ══════ API pública ══════════════════════════════════════════════ */

export function getCurrentPlanState(user: CurrentUser): PlanState {
  if (typeof window === "undefined") return defaultStateForUser(user);
  return readCache(currentWorkspaceKey(user)) ?? defaultStateForUser(user);
}

/** Backwards-compat · sigue devolviendo el `PlanTier` legacy. */
export function getCurrentPlan(user?: CurrentUser): PlanTier {
  if (!user) return "trial";
  return tierFromState(getCurrentPlanState(user));
}

/** Cambia ÚNICAMENTE el agency_pack · respeta el promoter_pack. */
export function setAgencyPack(user: CurrentUser, pack: AgencyPack): void {
  const current = getCurrentPlanState(user);
  const next: PlanState = { ...current, agencyPack: pack };
  persistPlanState(user, next);
}

/** Cambia ÚNICAMENTE el promoter_pack · respeta el agency_pack. */
export function setPromoterPack(user: CurrentUser, pack: PromoterPack): void {
  const current = getCurrentPlanState(user);
  const next: PlanState = { ...current, promoterPack: pack };
  persistPlanState(user, next);
}

function persistPlanState(user: CurrentUser, state: PlanState): void {
  if (typeof window === "undefined") return;
  const orgId = orgIdForUser(user);
  writeCache(currentWorkspaceKey(user), state);

  void (async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
      if (!isSupabaseConfigured) return;
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      /* Mantenemos `tier` legacy actualizado para queries pendientes
       *  de migrar · derivado del state nuevo. */
      const legacyTier = tierFromState(state);
      const { error } = await supabase
        .from("workspace_plans")
        .upsert({
          organization_id: orgId,
          tier: legacyTier,
          signup_kind: state.signupKind,
          agency_pack: state.agencyPack,
          promoter_pack: state.promoterPack,
          activated_at: isPromoterPaid(state) || isAgencyPaid(state) ? new Date().toISOString() : null,
          cancelled_at: state.agencyPack === "none" && state.promoterPack === "none" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "organization_id" });
      if (error) console.warn("[plan:set]", error.message);
    } catch (e) {
      console.warn("[plan:set] skipped:", e);
    }
  })();
}

/** Backwards-compat · setPlan(tier) sigue funcionando · escribe ambos
 *  packs derivando del tier legacy. */
export function setPlan(user: CurrentUser, tier: PlanTier): void {
  const next: PlanState = (() => {
    if (tier === "agency_free") return { signupKind: "agency", agencyPack: "free", promoterPack: "none" } as PlanState;
    if (tier === "agency_marketplace") return { signupKind: "agency", agencyPack: "marketplace", promoterPack: "none" } as PlanState;
    if (tier === "trial") return { signupKind: "promoter", agencyPack: "none", promoterPack: "trial" } as PlanState;
    if (tier === "promoter_249") return { signupKind: "promoter", agencyPack: "none", promoterPack: "promoter_249" } as PlanState;
    if (tier === "promoter_329") return { signupKind: "promoter", agencyPack: "none", promoterPack: "promoter_329" } as PlanState;
    return { signupKind: "promoter", agencyPack: "none", promoterPack: "promoter_329" } as PlanState;
  })();
  persistPlanState(user, next);
}

export function subscribeToPromoter249(user: CurrentUser): void {
  setPromoterPack(user, "promoter_249");
}

export function cancelSubscription(user: CurrentUser): void {
  /* Cancelar lleva al estado más cercano a "free": si signup=promoter
   *  vuelve a trial, si signup=agency vuelve a agency_free. */
  const current = getCurrentPlanState(user);
  if (current.signupKind === "agency") {
    setAgencyPack(user, "free");
  } else {
    setPromoterPack(user, "trial");
  }
}

/* ══════ Hooks reactivos ══════════════════════════════════════════ */

export function usePlanState(): PlanState {
  const user = useCurrentUser();
  const wsKey = currentWorkspaceKey(user);
  const [state, setState] = useState<PlanState>(() =>
    readCache(wsKey) ?? defaultStateForUser(user),
  );

  useEffect(() => {
    let cancelled = false;
    if (readCache(wsKey)) return;
    void (async () => {
      const fromDb = await hydratePlanFromSupabase(user);
      if (cancelled) return;
      if (fromDb) setState(fromDb);
    })();
    return () => { cancelled = true; };
  }, [user, wsKey]);

  useEffect(() => {
    const cb = () => {
      const fromCache = readCache(wsKey);
      if (fromCache) setState(fromCache);
    };
    window.addEventListener(CHANGE_EVENT, cb);
    window.addEventListener("storage", cb);
    return () => {
      window.removeEventListener(CHANGE_EVENT, cb);
      window.removeEventListener("storage", cb);
    };
  }, [wsKey]);

  return state;
}

export function usePlan(): PlanTier {
  return tierFromState(usePlanState());
}

export function usePlanLimits(): PlanLimits {
  return deriveLimits(usePlanState());
}
