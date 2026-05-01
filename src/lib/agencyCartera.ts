/**
 * Cartera de promociones de una agencia (runtime).
 *
 * Source of truth · `public.agency_cartera` (Supabase). El localStorage
 * cache (`byvaro.agencyCartera.v1`) solo existe para que `useAgencyCartera()`
 * pueda devolver síncrono en el render · NO es la fuente de verdad.
 *
 * El seed de `agencies.ts` lleva un `promotionsCollaborating` estático
 * por agencia, pero cuando una agencia ACEPTA una invitación desde el
 * producto, el id de la promoción se guarda en `agency_cartera` para que:
 *   · Aparezca en su listado `/promociones`.
 *   · Pueda registrar clientes sobre ella.
 *   · Desaparezca del Bloque 2 "Aún sin compartir" del promotor.
 *
 * `getCarteraSet(agency)` mergea seed + DB → Set efectivo.
 */

import { useEffect, useState } from "react";
import type { Agency } from "@/data/agencies";
import { developerOnlyPromotions } from "@/data/developerPromotions";
import { promotions } from "@/data/promotions";

const KEY = "byvaro.agencyCartera.v1";
const CHANGE = "byvaro:agency-cartera-changed";

type Store = Record<string, string[]>;

/** IDs de promociones que son realmente compartibles · usado para
 *  auto-limpiar entradas fantasma en la cartera. */
function shareablePromoIds(): Set<string> {
  const ids = new Set<string>();
  for (const p of developerOnlyPromotions) {
    if (p.status === "active" && p.canShareWithAgencies !== false) ids.add(p.id);
  }
  for (const p of promotions) {
    if (p.status === "active") ids.add(p.id);
  }
  return ids;
}

/* ══════ Cache local · render-only ════════════════════════════════ */

function readCache(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Store;
    const shareable = shareablePromoIds();
    let dirty = false;
    for (const agencyId of Object.keys(parsed)) {
      const filtered = (parsed[agencyId] ?? []).filter((id) => {
        if (!shareable.has(id)) { dirty = true; return false; }
        return true;
      });
      if (filtered.length !== (parsed[agencyId] ?? []).length) {
        parsed[agencyId] = filtered;
      }
    }
    if (dirty) window.localStorage.setItem(KEY, JSON.stringify(parsed));
    return parsed;
  } catch { return {}; }
}
function writeCache(store: Store) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(store));
  window.dispatchEvent(new CustomEvent(CHANGE));
}

/* ══════ Source of truth · Supabase ═══════════════════════════════ */

/** Pulla la cartera entera desde Supabase y refresca el cache local.
 *  Solo se llama al login · evita N queries en cada render. */
export async function hydrateCarteraFromSupabase(): Promise<void> {
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("agency_cartera")
      .select("agency_org_id, promotion_id");
    if (error) {
      console.warn("[agencyCartera:hydrate]", error.message);
      return;
    }
    const grouped: Store = {};
    for (const row of data ?? []) {
      const agencyId = row.agency_org_id as string;
      const promoId = row.promotion_id as string;
      if (!grouped[agencyId]) grouped[agencyId] = [];
      grouped[agencyId].push(promoId);
    }
    writeCache(grouped);
  } catch (e) {
    console.warn("[agencyCartera:hydrate] skipped:", e);
  }
}

/* ══════ API pública ══════════════════════════════════════════════ */

/** Añade una promoción a la cartera de la agencia · write-through. */
export function addPromotionToCartera(agencyId: string, promotionId: string) {
  const store = readCache();
  const list = new Set(store[agencyId] ?? []);
  if (list.has(promotionId)) return;
  list.add(promotionId);
  store[agencyId] = Array.from(list);
  writeCache(store);

  void (async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
      if (!isSupabaseConfigured) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from("agency_cartera")
        .upsert({
          agency_org_id: agencyId,
          promotion_id: promotionId,
          added_by_user_id: user.id,
        }, { onConflict: "agency_org_id,promotion_id" });
      if (error) console.warn("[agencyCartera:add]", error.message);
    } catch (e) {
      console.warn("[agencyCartera:add] skipped:", e);
    }
  })();
}

/** Quita una promoción de la cartera · write-through. */
export function removePromotionFromCartera(agencyId: string, promotionId: string) {
  const store = readCache();
  const list = new Set(store[agencyId] ?? []);
  if (!list.has(promotionId)) return;
  list.delete(promotionId);
  store[agencyId] = Array.from(list);
  writeCache(store);

  void (async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
      if (!isSupabaseConfigured) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from("agency_cartera")
        .delete()
        .eq("agency_org_id", agencyId)
        .eq("promotion_id", promotionId);
      if (error) console.warn("[agencyCartera:remove]", error.message);
    } catch (e) {
      console.warn("[agencyCartera:remove] skipped:", e);
    }
  })();
}

/** Set efectivo de promociones en cartera = seed + overrides. */
export function getCarteraSet(agency: Agency): Set<string> {
  const seed = new Set(agency.promotionsCollaborating ?? []);
  for (const id of readCache()[agency.id] ?? []) seed.add(id);
  return seed;
}

/** Hook reactivo · hidrata desde DB en mount si el cache está vacío. */
export function useAgencyCartera(agency: Agency): Set<string> {
  const [set, setSet] = useState<Set<string>>(() => getCarteraSet(agency));
  useEffect(() => {
    const cb = () => setSet(getCarteraSet(agency));
    cb();
    /* Hidratación lazy. */
    if (Object.keys(readCache()).length === 0) {
      void hydrateCarteraFromSupabase().then(() => cb());
    }
    window.addEventListener(CHANGE, cb);
    window.addEventListener("storage", cb);
    return () => {
      window.removeEventListener(CHANGE, cb);
      window.removeEventListener("storage", cb);
    };
  }, [agency]);
  return set;
}

/** Versión pura · útil para rutas sync (sin hook). */
export function isInCartera(agency: Agency, promotionId: string): boolean {
  return getCarteraSet(agency).has(promotionId);
}
