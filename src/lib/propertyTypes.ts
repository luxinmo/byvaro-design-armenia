/**
 * propertyTypes.ts · ÚNICA fuente de verdad para tipologías de
 * vivienda (Villas / Apartamentos / Adosados / etc.) y su mapping
 * desde los IDs raw del wizard.
 *
 * Bug histórico · DOS implementaciones divergentes:
 *
 *   1. `deriveFlatMetadata` (promotionsStorage.ts) al CREAR · guardaba
 *      raw ids del wizard: `state.tipologiasSeleccionadas.map(t => t.tipo)`
 *      → `["independiente"]`.
 *   2. `wizardStateToPromotion` al EDITAR override · MAPEABA inline:
 *      `independiente → "Villas"` → `["Villas"]`.
 *
 * Resultado · al editar una promo, sus `propertyTypes` cambiaban de
 * "independiente" a "Villas" silenciosamente. Filtros del listado por
 * tipología dejaban de matchear y los chips visuales pasaban del id
 * raw al label legible sin avisar.
 *
 * Solución canónica · TODO el código guarda RAW IDs (`independiente`,
 * `adosados`, `pareados`, `Apartments`, etc.). Mapeo a label legible
 * solo al RENDERIZAR vía `getPropertyTypeLabel`. Filtros y matching
 * usan ids estables.
 *
 * Por qué raw y no label · si en el futuro cambia el copy ("Villas"
 * → "Casas individuales"), los datos en DB no necesitan migración ·
 * solo cambia el label en este archivo.
 */

/** Aliases · normalizan variantes singulares/plurales o etiquetas
 *  legacy a un único id canónico. Tras `normalizePropertyType` el id
 *  resultante es ÚNICO y matcheable. */
const propertyTypeAliases: Record<string, string> = {
  /* Inglés singular → plural canónico */
  Villa: "Villas",
  Apartment: "Apartments",
  Townhouse: "Townhouses",
  Penthouse: "Penthouses",
};

/** Mapping id → label visible (es-ES). Cubre TANTO los ids raw del
 *  wizard (`independiente`, `adosados`, `pareados`, `bajo`, etc.) COMO
 *  los labels en inglés legacy del seed estático. */
const propertyTypeLabels: Record<string, string> = {
  /* Plurales canónicos en inglés (legacy seed) */
  Apartments: "Apartamentos",
  Villas: "Villas",
  Townhouses: "Adosados",
  Penthouses: "Áticos",
  Duplex: "Dúplex",
  Commercial: "Locales",

  /* Ids raw del wizard unifamiliar */
  independiente: "Villas",
  adosados: "Adosados",
  pareados: "Pareados",

  /* Ids raw del wizard plurifamiliar (subtipos de unidad) */
  apartamento: "Apartamentos",
  atico: "Áticos",
  duplex: "Dúplex",
  loft: "Lofts",
  planta_baja: "Bajos",
  estudio: "Estudios",
};

/** Normaliza un value crudo al canónico (Villa → Villas, etc.).
 *  Ids raw del wizard (independiente, adosados…) se devuelven sin
 *  cambio · solo se mapean a label visible en `getPropertyTypeLabel`. */
export function normalizePropertyType(v: string): string {
  return propertyTypeAliases[v] ?? v;
}

/** Devuelve el label visible (es-ES) de un propertyType. Si el id no
 *  está catalogado, devuelve el id raw como fallback (señal de que
 *  hay que añadirlo aquí). */
export function getPropertyTypeLabel(v: string): string {
  return propertyTypeLabels[v] ?? v;
}

/** Deriva el array `propertyTypes: string[]` canónico desde un
 *  WizardState · ÚNICA función que producen TODOS los paths de
 *  guardado (createPromotionFromWizard, wizardStateToPromotion,
 *  promotionDrafts). Garantiza que listado, ficha, filtros, chips
 *  y emails leen el mismo conjunto de ids estables.
 *
 *  Para PLURIFAMILIAR · `tipologiasSeleccionadas` y `subVarias` están
 *  vacíos (son campos del flow unifamiliar). En su lugar derivamos
 *  los subtipos únicos de las unidades creadas (apartamento, ático,
 *  duplex, etc.). Sin esto, el validador de publicación pedía
 *  "Sin tipologías" aunque el user ya tuviera unidades configuradas. */
export function resolvePropertyTypes(
  state: {
    tipologiasSeleccionadas?: Array<{ tipo?: string | null }> | null;
    subVarias?: string | null;
    unidades?: Array<{ subtipo?: string | null }> | null;
    tipo?: string | null;
  },
): string[] {
  const ids = (state.tipologiasSeleccionadas ?? [])
    .map((t) => t?.tipo)
    .filter((t): t is string => !!t);
  if (ids.length > 0) return ids;
  if (state.subVarias) return [state.subVarias];
  /* Plurifamiliar/mixto · derivar de subtipos únicos de unidades.
   *  Excluye `local` (no es vivienda) y `planta_baja` (es localización,
   *  no tipología). */
  const subtipos = new Set<string>();
  for (const u of state.unidades ?? []) {
    if (u.subtipo && u.subtipo !== "local" && u.subtipo !== "planta_baja") {
      subtipos.add(u.subtipo);
    }
  }
  return Array.from(subtipos);
}
