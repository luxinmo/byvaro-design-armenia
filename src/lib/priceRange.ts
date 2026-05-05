/**
 * priceRange.ts · ÚNICA fuente de verdad para calcular el rango de
 * precios `{ min, max }` de una lista de unidades.
 *
 * Bug histórico · 4 implementaciones paralelas en el código, cada una
 * con sutiles diferencias:
 *
 *   1. `promotionsStorage.ts` (al CREAR) · `Math.min/max` sobre
 *      `state.unidades.map(u => u.precio)` · TODAS las unidades.
 *   2. `wizardStateToPromotion.ts` (al EDITAR override) · idem ·
 *      TODAS las unidades.
 *   3. `promoStats.ts` (RUNTIME para cards del listado) · filtra
 *      solo `available` · ignora reserved/sold.
 *   4. `promotionDrafts.ts` (DRAFTS) · idem create · TODAS.
 *   5. `RevisionStep.tsx` (revisión 14/14) · idem · TODAS.
 *
 * Resultado · ficha y listado mostraban rangos distintos cuando había
 * unidades vendidas con precio extremo (la unidad más barata vendida
 * → ficha leía el plano "desde 200K" pero listado calculaba con
 * available y mostraba "desde 280K"). El usuario veía precios que no
 * coincidían según dónde mirara.
 *
 * Solución canónica · `resolvePriceRange(units, opts)` único · prop
 * `availableOnly` decide la semántica:
 *
 *   · `availableOnly: true`  → cards/listado · refleja lo que está
 *     realmente a la venta hoy.
 *   · `availableOnly: false` (default) → snapshot total · usado al
 *     persistir `priceFrom/priceTo` en DB (caché plana, all-time).
 *
 * REGLA · siempre que vayas a calcular rango de precios, usa este
 * helper. NO hagas `Math.min(...prices)` inline.
 */

interface UnitLike {
  /** Compatibilidad · acepta `price` (Unit / runtime) o `precio`
   *  (UnitData / WizardState) sin que el caller tenga que mapear. */
  price?: number;
  precio?: number;
  /** Status · `available` por default si no se pasa · permite
   *  filtrar reserved/sold con `availableOnly: true`. */
  status?: string | null;
}

export interface PriceRangeOptions {
  /** Filtra a unidades con `status === "available"` antes de
   *  computar el rango. Default `false` (todas las unidades). */
  availableOnly?: boolean;
}

export function resolvePriceRange(
  units: UnitLike[] | null | undefined,
  opts: PriceRangeOptions = {},
): { min: number; max: number } {
  if (!units || units.length === 0) return { min: 0, max: 0 };

  let filtered = units;
  if (opts.availableOnly) {
    filtered = units.filter((u) => (u.status ?? "available") === "available");
  }

  const prices = filtered
    .map((u) => u.price ?? u.precio ?? 0)
    .filter((n): n is number => typeof n === "number" && n > 0);

  if (prices.length === 0) return { min: 0, max: 0 };
  return { min: Math.min(...prices), max: Math.max(...prices) };
}
