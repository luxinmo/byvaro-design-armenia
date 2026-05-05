/**
 * constructionProgress.ts · ÚNICA fuente de verdad del % de obra
 * de una promoción · derivado del WizardState.
 *
 * Bug histórico · había DOS implementaciones divergentes:
 *
 *   1. `deriveFlatMetadata` (promotionsStorage.ts) usaba
 *      `faseConstruccion` PRIMERO (10/30/50/65/80/95/100) y caía a
 *      `estado` (0/50/100) como fallback. NO respetaba
 *      `constructionProgressOverride` manual.
 *   2. `deriveProgress` (wizardStateToPromotion.ts) IGNORABA
 *      `faseConstruccion`. Solo usaba `constructionProgressOverride` o
 *      `estado` enum.
 *
 * Resultado · al CREAR con `faseConstruccion="acabados"` → 80%. Al
 * EDITAR vía override y guardar (sin tocar nada) → wizardStateToPromotion
 * gana → 50% (de `estado=en_construccion`) o undefined si no hay estado.
 * El % BAJABA al editar.
 *
 * Solución canónica · `resolveConstructionProgress(state)` único con
 * prioridad: override manual > fase granular > estado grueso.
 *
 * REGLA · siempre que vayas a derivar el progress numérico desde un
 * WizardState, usa este helper. NO recrees la lógica.
 */

import type { WizardState } from "@/components/crear-promocion/types";

/** % asignado a cada fase de construcción · más granular que estado.
 *  10 → 30 → 50 → 65 → 80 → 95 → 100 cubren el ciclo completo desde
 *  inicio de obra hasta llave en mano. `definir_mas_tarde` deja en 0
 *  para que la promo no parezca "avanzada" sin datos reales. */
export const FASE_PROGRESS: Record<string, number> = {
  inicio_obra: 10,
  estructura: 30,
  cerramientos: 50,
  instalaciones: 65,
  acabados: 80,
  entrega_proxima: 95,
  llave_en_mano: 100,
  definir_mas_tarde: 0,
};

/** % asignado a cada estado · 3 niveles gruesos cuando el promotor no
 *  ha rellenado fase específica. */
export const ESTADO_PROGRESS: Record<string, number> = {
  proyecto: 0,
  en_construccion: 50,
  terminado: 100,
};

/**
 * Deriva el % de obra desde el WizardState con prioridad canónica:
 *
 *   1. `constructionProgressOverride` · slider manual del promotor en
 *      la ficha · gana SIEMPRE si está set (incluido 0).
 *   2. `faseConstruccion` · 7 fases granulares.
 *   3. `estado` · 3 niveles gruesos.
 *
 * Devuelve `undefined` si nada está rellenado · señal para el
 * validador `getMissingForPromotion` de que falta el dato.
 */
export function resolveConstructionProgress(
  state: Pick<WizardState, "constructionProgressOverride" | "faseConstruccion" | "estado">,
): number | undefined {
  if (typeof state.constructionProgressOverride === "number") {
    return state.constructionProgressOverride;
  }
  if (state.faseConstruccion && FASE_PROGRESS[state.faseConstruccion] != null) {
    return FASE_PROGRESS[state.faseConstruccion];
  }
  if (state.estado && ESTADO_PROGRESS[state.estado] != null) {
    return ESTADO_PROGRESS[state.estado];
  }
  return undefined;
}
