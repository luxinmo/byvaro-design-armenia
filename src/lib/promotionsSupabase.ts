/**
 * promotionsSupabase.ts · Hooks de lectura de promociones y unidades
 * desde Supabase (source of truth) con caché localStorage para que el
 * primer render sea síncrono.
 *
 * REGLA CANÓNICA · `CLAUDE.md` "Backend acoplado":
 *   · Source of truth = `public.promotions` + `public.promotion_units`
 *   · Cache local = `byvaro.cache.promotions.v1` + `byvaro.cache.units.v1`
 *   · El cache solo permite render síncrono · NO es la fuente de verdad
 *
 * Compatibilidad shape · los hooks devuelven el mismo shape que los
 * arrays seed (`Promotion`, `Unit`) para que componentes que ya
 * importan de `data/promotions` o `data/units` puedan migrar drop-in.
 */

import { useEffect, useState } from "react";
import { memCache } from "./memCache";
import type { Promotion } from "@/data/promotions";
import type { DevPromotion } from "@/data/developerPromotions";
import type { Unit, UnitStatus } from "@/data/units";

const PROMOS_CACHE_KEY = "byvaro.cache.promotions.v1";
const UNITS_CACHE_KEY = "byvaro.cache.units.v1";
const PROMOS_EVENT = "byvaro:cache-promotions-changed";
const UNITS_EVENT = "byvaro:cache-units-changed";

/* ══════ Helpers de cache ══════════════════════════════════════════ */

function readPromosCache(): DevPromotion[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = memCache.getItem(PROMOS_CACHE_KEY);
    return raw ? (JSON.parse(raw) as DevPromotion[]) : [];
  } catch { return []; }
}

function writePromosCache(list: DevPromotion[]) {
  if (typeof window === "undefined") return;
  memCache.setItem(PROMOS_CACHE_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(PROMOS_EVENT));
}

function readUnitsCache(): Record<string, Unit[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = memCache.getItem(UNITS_CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Unit[]>) : {};
  } catch { return {}; }
}

function writeUnitsCache(map: Record<string, Unit[]>) {
  if (typeof window === "undefined") return;
  memCache.setItem(UNITS_CACHE_KEY, JSON.stringify(map));
  window.dispatchEvent(new CustomEvent(UNITS_EVENT));
}

/* ══════ Mappers DB → Shape frontend ══════════════════════════════ */

interface PromotionRow {
  id: string;
  owner_organization_id: string;
  owner_role: "promotor" | "comercializador" | null;
  name: string;
  reference: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  status: string;
  total_units: number;
  available_units: number;
  price_from: number | null;
  price_to: number | null;
  delivery: string | null;
  image_url: string | null;
  can_share_with_agencies: boolean;
  marketing_prohibitions: string[] | null;
  metadata: Record<string, unknown> | null;
}

function rowToPromotion(r: PromotionRow): DevPromotion {
  /* `location` legacy = "Ciudad, Provincia". */
  const location = [r.city, r.province].filter(Boolean).join(", ");
  /* Convertimos `sold_out` (DB) → `sold-out` (TS) si aplica. */
  const status = r.status === "sold_out" ? "sold-out" : r.status;
  const meta = (r.metadata ?? {}) as { propertyTypes?: string[]; buildingType?: string; constructionProgress?: number; hasShowFlat?: boolean; commission?: number };
  return {
    id: r.id,
    code: r.reference ?? r.id,
    name: r.name,
    location,
    priceMin: r.price_from ?? 0,
    priceMax: r.price_to ?? 0,
    availableUnits: r.available_units,
    totalUnits: r.total_units,
    status: status as DevPromotion["status"],
    reservationCost: 0, // not in DB column · default
    delivery: r.delivery ?? "",
    commission: meta.commission ?? 0,
    developer: "",
    agencies: 0,
    agencyAvatars: [],
    propertyTypes: meta.propertyTypes ?? [],
    image: r.image_url ?? undefined,
    updatedAt: "",
    constructionProgress: meta.constructionProgress,
    hasShowFlat: meta.hasShowFlat,
    buildingType: meta.buildingType as DevPromotion["buildingType"],
    canShareWithAgencies: r.can_share_with_agencies,
    ownerOrganizationId: r.owner_organization_id,
    ownerRole: r.owner_role ?? undefined,
  };
}

interface UnitRow {
  id: string;
  promotion_id: string;
  label: string;
  reference: string | null;
  rooms: number | null;
  bathrooms: number | null;
  surface_m2: number | null;
  terrace_m2: number | null;
  price: number | null;
  status: string | null;
  floor: string | null;
  orientation: string | null;
  metadata: Record<string, unknown> | null;
}

function rowToUnit(r: UnitRow): Unit {
  const meta = (r.metadata ?? {}) as {
    block?: string; door?: string; type?: string;
    usableArea?: number; parcela?: number;
    piscinaPrivada?: boolean;
    fotosUnidad?: string[];
  };
  return {
    id: r.id,
    ref: r.reference ?? r.id,
    promotionId: r.promotion_id,
    block: meta.block ?? "",
    floor: r.floor ? Number(r.floor) : 0,
    door: meta.door ?? "",
    publicId: r.label,
    type: meta.type ?? "Apartamento",
    bedrooms: r.rooms ?? 0,
    bathrooms: r.bathrooms ?? 0,
    builtArea: r.surface_m2 ?? 0,
    usableArea: meta.usableArea ?? 0,
    terrace: r.terrace_m2 ?? 0,
    garden: 0,
    parcel: meta.parcela ?? 0,
    hasPool: !!meta.piscinaPrivada,
    orientation: r.orientation ?? "Sur",
    price: r.price ?? 0,
    status: (r.status ?? "available") as UnitStatus,
    fotos: meta.fotosUnidad ?? [],
  };
}

/* ══════ Hidratación desde Supabase ════════════════════════════════ */

let promosHydratePromise: Promise<DevPromotion[]> | null = null;

export async function hydratePromotionsFromSupabase(): Promise<DevPromotion[]> {
  if (promosHydratePromise) return promosHydratePromise;
  promosHydratePromise = (async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
      if (!isSupabaseConfigured) return [];
      const { data, error } = await supabase
        .from("promotions")
        .select("*");
      if (error) {
        console.warn("[promotions:hydrate]", error.message);
        return [];
      }
      const list = (data ?? []).map((r) => rowToPromotion(r as PromotionRow));
      writePromosCache(list);
      return list;
    } catch (e) {
      console.warn("[promotions:hydrate] skipped:", e);
      return [];
    } finally {
      /* Reset promise after 30s para que nuevos calls vuelvan a pulsar
       * la DB · evita stale data si algo cambia. */
      setTimeout(() => { promosHydratePromise = null; }, 30_000);
    }
  })();
  return promosHydratePromise;
}

let unitsHydratePromise: Promise<Record<string, Unit[]>> | null = null;

export async function hydrateUnitsFromSupabase(): Promise<Record<string, Unit[]>> {
  if (unitsHydratePromise) return unitsHydratePromise;
  unitsHydratePromise = (async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
      if (!isSupabaseConfigured) return {};
      const { data, error } = await supabase
        .from("promotion_units")
        .select("*");
      if (error) {
        console.warn("[units:hydrate]", error.message);
        return {};
      }
      const map: Record<string, Unit[]> = {};
      for (const r of data ?? []) {
        const u = rowToUnit(r as UnitRow);
        if (!map[u.promotionId]) map[u.promotionId] = [];
        map[u.promotionId].push(u);
      }
      writeUnitsCache(map);
      return map;
    } catch (e) {
      console.warn("[units:hydrate] skipped:", e);
      return {};
    } finally {
      setTimeout(() => { unitsHydratePromise = null; }, 30_000);
    }
  })();
  return unitsHydratePromise;
}

/* ══════ Hooks ═════════════════════════════════════════════════════ */

/** Lee promociones desde cache · hidrata desde Supabase en mount.
 *  Devuelve `Promotion[]` (shape compatible con seeds). */
export function useSupabasePromotions(): DevPromotion[] {
  const [list, setList] = useState<DevPromotion[]>(() => readPromosCache());

  useEffect(() => {
    if (list.length === 0) {
      void hydratePromotionsFromSupabase().then((fresh) => {
        if (fresh.length > 0) setList(fresh);
      });
    }
    const handler = () => setList(readPromosCache());
    window.addEventListener(PROMOS_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(PROMOS_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return list;
}

/** Lee unidades agrupadas por promotionId. Drop-in replacement de
 *  `unitsByPromotion` import del seed. */
export function useSupabaseUnitsByPromotion(): Record<string, Unit[]> {
  const [map, setMap] = useState<Record<string, Unit[]>>(() => readUnitsCache());

  useEffect(() => {
    if (Object.keys(map).length === 0) {
      void hydrateUnitsFromSupabase().then((fresh) => {
        if (Object.keys(fresh).length > 0) setMap(fresh);
      });
    }
    const handler = () => setMap(readUnitsCache());
    window.addEventListener(UNITS_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(UNITS_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return map;
}

/** Lee unidades de UNA promoción. Mismo shape que `unitsByPromotion[id]`. */
export function useSupabaseUnits(promotionId: string | undefined | null): Unit[] {
  const all = useSupabaseUnitsByPromotion();
  if (!promotionId) return [];
  return all[promotionId] ?? [];
}

/** Versión non-hook · uso en handlers/imperativos. Devuelve cache
 *  actual sin disparar hidratación (el render sí la dispara). */
export function getCachedPromotions(): DevPromotion[] {
  return readPromosCache();
}

export function getCachedUnitsByPromotion(): Record<string, Unit[]> {
  return readUnitsCache();
}

/* ══════ Re-export de tipos para compatibilidad ════════════════════ */
export type { Promotion, DevPromotion, Unit };
