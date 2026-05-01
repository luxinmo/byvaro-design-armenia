/**
 * promoStats.ts · Stats derivados de la promoción · canónicos.
 *
 * Antes los componentes leían `p.availableUnits`, `p.totalUnits`,
 * `p.badge` directamente del seed, lo que causaba inconsistencias
 * cuando las unidades reales (en `unitsByPromotion`) no coincidían
 * con los números seed.
 *
 * Helper único:
 *   `getPromoStats(promoId, seedFallback)` · devuelve los counts y
 *   el badge derivados de las unidades reales · cae al seed si la
 *   promoción no tiene unidades cargadas.
 *
 * REGLAS:
 *   · `availableUnits` · count de unidades con `status === "available"`.
 *     Si no hay unidades, usa `seed.availableUnits`.
 *   · `totalUnits` · `units.length` · si no hay, `seed.totalUnits`.
 *   · `badge` · derivado dinámicamente:
 *       - `"last-units"` cuando `availableUnits === 1`.
 *       - `"new"` cuando el seed lo declare (no hay createdAt todavía).
 *       - undefined en cualquier otro caso.
 *
 * TODO(backend): cuando aterrice backend, esto se reemplaza por un
 * SELECT que devuelve los counters ya agregados · este helper se
 * mantiene como adaptador para no tocar consumers.
 */

import { unitsByPromotion } from "@/data/units";

export type PromoStats = {
  availableUnits: number;
  totalUnits: number;
  /** Etiqueta superior izquierda en card · null si no aplica. */
  badge: "new" | "last-units" | undefined;
};

export function getPromoStats(
  promoId: string,
  seed: { availableUnits: number; totalUnits: number; badge?: string },
): PromoStats {
  const units = unitsByPromotion[promoId];

  if (!units || units.length === 0) {
    /* Fallback al seed cuando la promoción todavía no tiene unidades
     *  cargadas. Cards se renderizan con los counts del seed. */
    const badge = seed.badge === "new" || seed.badge === "last-units"
      ? seed.badge
      : undefined;
    return {
      availableUnits: seed.availableUnits,
      totalUnits: seed.totalUnits,
      badge,
    };
  }

  const availableUnits = units.filter((u) => u.status === "available").length;
  const totalUnits = units.length;

  /* Badge dinámico · prevalece "last-units" sobre "new" cuando solo
   *  queda 1 unidad (es la señal más urgente para el comercial). */
  let badge: PromoStats["badge"];
  if (availableUnits === 1) badge = "last-units";
  else if (seed.badge === "new") badge = "new";

  return { availableUnits, totalUnits, badge };
}
