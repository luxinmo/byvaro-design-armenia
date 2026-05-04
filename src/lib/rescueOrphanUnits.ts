/**
 * rescueOrphanUnits.ts · recupera promos cuyas unidades quedaron
 * en cache local (wizardSnapshot.unidades) pero NO se persistieron
 * a Supabase (insert silencioso fallido pre-fix de saveUnitsToSupabase).
 *
 * Se ejecuta al final de `hydrateSeedsFromSupabase` · para cada promo
 * del workspace que tiene `wizardSnapshot.unidades` no vacío pero
 * `unitsByPromotion[id]` vacío:
 *   1. Reconstruye el array `Unit[]` localmente para que la ficha y
 *      el listado puedan renderizar de inmediato.
 *   2. Re-intenta `saveUnitsToSupabase` para cerrar el gap definitivo.
 *
 * Es un shim de migración · una vez todas las promos legacy estén
 * sincronizadas, este helper se puede borrar (o dejar como safety net).
 */

import { unitsByPromotion } from "@/data/units";
import type { Unit } from "@/data/units";
import type { DevPromotion } from "@/data/developerPromotions";
import { saveUnitsToSupabase } from "./promotionsStorage";
import type { UnitData } from "@/data/units";

interface WizardUnitSnapshot {
  id?: string;
  ref?: string;
  nombre?: string;
  dormitorios?: number;
  banos?: number;
  superficieConstruida?: number;
  superficieUtil?: number;
  superficieTerraza?: number;
  parcela?: number;
  precio?: number;
  status?: string;
  planta?: number | string;
  orientacion?: string;
  subtipo?: string;
  parking?: boolean;
  trastero?: boolean;
  piscinaPrivada?: boolean;
  vistas?: string;
  caracteristicas?: string[];
  fotosUnidad?: unknown[];
  videosUnidad?: unknown[];
  planoUrls?: string[];
}

function snapshotToUnit(promotionId: string, u: WizardUnitSnapshot): Unit {
  const id = u.id ?? `u-${Math.random().toString(36).slice(2, 10)}`;
  return {
    id,
    ref: u.ref ?? id,
    promotionId,
    block: "",
    floor: typeof u.planta === "number" ? u.planta : 0,
    door: "",
    publicId: u.nombre || u.ref || id,
    type: typeof u.subtipo === "string" ? u.subtipo : "",
    bedrooms: Number(u.dormitorios) || 0,
    bathrooms: Number(u.banos) || 0,
    builtArea: Number(u.superficieConstruida) || 0,
    usableArea: Number(u.superficieUtil) || 0,
    terrace: Number(u.superficieTerraza) || 0,
    garden: 0,
    parcel: Number(u.parcela) || 0,
    hasPool: !!u.piscinaPrivada,
    orientation: u.orientacion || "",
    price: Number(u.precio) || 0,
    status: (u.status ?? "available") as Unit["status"],
  } as Unit;
}

export async function rescueOrphanUnits(promos: DevPromotion[]): Promise<void> {
  if (typeof window === "undefined") return;
  const orphans: { id: string; units: WizardUnitSnapshot[] }[] = [];

  for (const p of promos) {
    const existing = unitsByPromotion[p.id];
    if (existing && existing.length > 0) continue; // ya tiene units · skip

    const meta = (p as { metadata?: { wizardSnapshot?: { unidades?: WizardUnitSnapshot[] } } }).metadata;
    const snapshotUnits = meta?.wizardSnapshot?.unidades;
    if (!snapshotUnits || snapshotUnits.length === 0) continue; // no hay nada que rescatar

    orphans.push({ id: p.id, units: snapshotUnits });
  }

  if (orphans.length === 0) return;
  console.warn(
    `[rescueOrphanUnits] ${orphans.length} promo(s) con unidades en wizardSnapshot pero sin filas en promotion_units · reconstruyendo cache local + reintentando insert`,
  );

  for (const { id, units } of orphans) {
    /* 1 · cache local · ficha + listado renderizan de inmediato. */
    unitsByPromotion[id] = units.map((u) => snapshotToUnit(id, u));

    /* 2 · re-insert a Supabase · si falla, queda al menos visible
     * en local hasta el próximo intento. */
    try {
      await saveUnitsToSupabase(id, units as UnitData[]);
      console.info(`[rescueOrphanUnits] ✓ promo ${id} · ${units.length} units sincronizadas`);
    } catch (e) {
      console.error(`[rescueOrphanUnits] ❌ promo ${id} · falla insert:`,
        e instanceof Error ? e.message : e);
    }
  }

  /* Notificar a consumers reactivos · listado se refresca. */
  window.dispatchEvent(new CustomEvent("byvaro:promotions-changed"));
}
