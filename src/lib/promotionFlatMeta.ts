/**
 * promotionFlatMeta.ts · helpers canónicos para LEER campos planos
 * de `metadata` con fallback al `wizardSnapshot` legacy.
 *
 * Bug histórico · `tieneLicencia` y `promotionDefaults` vivían SOLO
 * en `metadata.wizardSnapshot.*`. Si una promo se hidrataba sin
 * snapshot (legacy seed estático, agencia mirror, hidratación
 * parcial Supabase), las pantallas que dependían de esos campos los
 * perdían silenciosamente:
 *
 *   · Chip "Licencia" del listado · desaparece sin avisar.
 *   · Bloque "Extras y opcionales" de la ficha · no se renderiza.
 *
 * Solución · `deriveFlatMetadata` (promotionsStorage.ts) ahora
 * proyecta `metadata.licenseGranted` y `metadata.extras` planos
 * además del snapshot. Los lectores usan estos helpers que prefieren
 * el plano (más estable, menos data) y caen al snapshot si hace
 * falta. Garantiza que la UI funciona en TODOS los caminos de
 * hidratación.
 *
 * REGLA · siempre que vayas a leer `tieneLicencia` o `promotionDefaults.*`
 * de una `Promotion` en pantalla, usa estos helpers. NO leas
 * directamente `metadata.wizardSnapshot.*`.
 */

import type { Promotion } from "@/data/promotions";
import type { FlatExtras } from "./promotionsStorage";

type ExtrasKey = "privatePool" | "parking" | "storageRoom" | "basement" | "solarium" | "plot";

interface SnapShape {
  metadata?: {
    licenseGranted?: boolean | null;
    extras?: FlatExtras;
    wizardSnapshot?: {
      tieneLicencia?: boolean | null;
      promotionDefaults?: Partial<Record<ExtrasKey, {
        enabled?: boolean;
        priceMode?: string | null;
        optionalPrice?: number | null;
        minSizeSqm?: number | null;
      }>>;
    };
  } | null;
}

/** Devuelve el estado legal de la promoción · `true` (concedida),
 *  `false` (sin licencia), `null` (no decidido). Prefiere
 *  `metadata.licenseGranted` plano · cae al snapshot · cae a null. */
export function resolveLicenseGranted(p: Promotion | SnapShape | null | undefined): boolean | null {
  if (!p) return null;
  const m = p.metadata;
  if (!m) return null;
  if (typeof m.licenseGranted === "boolean") return m.licenseGranted;
  if (m.licenseGranted === null) return null;
  const snap = m.wizardSnapshot?.tieneLicencia;
  if (typeof snap === "boolean") return snap;
  return null;
}

/** Devuelve el sub-shape de un anejo (piscina/parking/etc.) · prefiere
 *  `metadata.extras[key]` plano · cae al `wizardSnapshot.promotionDefaults[key]`
 *  · si nada, `enabled: false`. Lo usa `ExtrasOpcionalesCard` para
 *  decidir qué tiles mostrar. */
export function resolveExtraSlot(
  p: Promotion | SnapShape | null | undefined,
  key: ExtrasKey,
): { enabled: boolean; priceMode: string | null; optionalPrice: number | null; minSizeSqm: number | null } {
  const m = p?.metadata;
  if (m?.extras?.[key as keyof FlatExtras]) {
    const slot = m.extras[key as keyof FlatExtras];
    return {
      enabled: !!slot.enabled,
      priceMode: slot.priceMode ?? null,
      optionalPrice: slot.optionalPrice ?? null,
      minSizeSqm: null,
    };
  }
  const snap = m?.wizardSnapshot?.promotionDefaults?.[key];
  if (snap) {
    return {
      enabled: !!snap.enabled,
      priceMode: snap.priceMode ?? null,
      optionalPrice: snap.optionalPrice ?? null,
      minSizeSqm: snap.minSizeSqm ?? null,
    };
  }
  return { enabled: false, priceMode: null, optionalPrice: null, minSizeSqm: null };
}

/** Devuelve TODOS los anejos · útil para iterar al renderizar el
 *  bloque "Extras y opcionales" sin saber qué hay activo. */
export function resolveAllExtras(p: Promotion | SnapShape | null | undefined): {
  privatePool: ReturnType<typeof resolveExtraSlot>;
  parking: ReturnType<typeof resolveExtraSlot>;
  storageRoom: ReturnType<typeof resolveExtraSlot>;
  basement: ReturnType<typeof resolveExtraSlot>;
  solarium: ReturnType<typeof resolveExtraSlot>;
  plot: ReturnType<typeof resolveExtraSlot>;
} {
  return {
    privatePool: resolveExtraSlot(p, "privatePool"),
    parking:     resolveExtraSlot(p, "parking"),
    storageRoom: resolveExtraSlot(p, "storageRoom"),
    basement:    resolveExtraSlot(p, "basement"),
    solarium:    resolveExtraSlot(p, "solarium"),
    plot:        resolveExtraSlot(p, "plot"),
  };
}
