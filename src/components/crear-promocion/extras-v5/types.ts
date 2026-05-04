/**
 * extras-v5 · Schema de "Características por defecto de la promoción".
 *
 * Pantalla 5/14 del wizard (variante `?wizardV5=1`) · captura los
 * valores que se aplicarán por defecto a CADA unidad creada después
 * (cada villa hereda parking, piscina privada, equipamiento, vistas,
 * etc.). El usuario podrá luego sobrescribir per-unit en el paso
 * "Crear unidades".
 *
 * `appliesTo` controla la propagación:
 *   · "all"    → aplica a todas las viviendas al crearlas.
 *   · "some"   → solo a las que el user marque manualmente.
 *   · "later"  → no se aplica al generar · queda como sugerencia.
 *
 * TODO(backend) · este shape mapea a la columna `promotions.defaults`
 * (jsonb) cuando llegue el backend real. Endpoint `PATCH /api/promociones/:id`
 * acepta el sub-objeto y la generación de unidades en `crear_unidades`
 * lo lee para hidratar cada `Unit`.
 */

export type AppliesTo = "all" | "some" | "later";
export type PriceMode = "included" | "optional" | "not_included";

export interface PromotionDefaults {
  privatePool: {
    enabled: boolean;
    appliesTo: AppliesTo | null;
    priceMode: PriceMode | null;
  };
  parking: {
    enabled: boolean;
    spaces: number;
    type: "outdoor" | "closed_garage";
    priceMode: PriceMode | null;
    appliesTo: AppliesTo | null;
  };
  storageRoom: {
    enabled: boolean;
    appliesTo: AppliesTo | null;
    priceMode: PriceMode | null;
  };
  solarium: {
    enabled: boolean;
    appliesTo: AppliesTo | null;
    priceMode: PriceMode | null;
  };
  terraces: {
    /** Master switch · si true, exigimos que el user marque al menos
     *  uno de covered/uncovered antes de avanzar (el "Siguiente" del
     *  wizard valida esa coherencia). Sin enabled flag no podríamos
     *  distinguir "no he tocado" vs "he tocado y dejé sin marcar". */
    enabled: boolean;
    covered: boolean;
    uncovered: boolean;
  };
  plot: {
    enabled: boolean;
    appliesTo: AppliesTo | null;
    /** Superficie mínima (m²) · "Parcela desde X m²". Renombrado
     *  desde `averageSizeSqm` · ahora indica el mínimo, no la media. */
    minSizeSqm: number | null;
  };
  equipment: {
    airConditioning: boolean;
    airConditioningType: "central" | "split" | "preinstallation" | null;
    heating: boolean;
    heatingType: "underfloor" | "central" | "gas" | null;
    domotics: boolean;
    solarPanels: boolean;
    electricBlinds: boolean;
    doubleGlazing: boolean;
    equippedKitchen: boolean;
    kitchenType: "open" | "independent" | null;
  };
  security: {
    alarm: boolean;
    reinforcedDoor: boolean;
    videoSurveillance: boolean;
  };
  views: {
    sea: boolean;
    mountain: boolean;
    golf: boolean;
    panoramic: boolean;
  };
  /** Rosa de los vientos completa · 8 puntos cardinales · estándar
   *  en fichas inmobiliarias españolas (Idealista, Fotocasa, etc.). */
  orientation:
    | "north" | "northeast" | "east" | "southeast"
    | "south" | "southwest" | "west" | "northwest"
    | null;
}

export const defaultPromotionDefaults: PromotionDefaults = {
  privatePool: { enabled: false, appliesTo: null, priceMode: null },
  parking: {
    enabled: false,
    spaces: 1,
    type: "outdoor",
    priceMode: null,
    appliesTo: null,
  },
  storageRoom: { enabled: false, appliesTo: null, priceMode: null },
  solarium: { enabled: false, appliesTo: null, priceMode: null },
  terraces: { enabled: false, covered: false, uncovered: false },
  plot: {
    enabled: false,
    appliesTo: null,
    minSizeSqm: null,
  },
  equipment: {
    airConditioning: false,
    airConditioningType: null,
    heating: false,
    heatingType: null,
    domotics: false,
    solarPanels: false,
    electricBlinds: false,
    doubleGlazing: false,
    equippedKitchen: false,
    kitchenType: null,
  },
  security: { alarm: false, reinforcedDoor: false, videoSurveillance: false },
  views: { sea: false, mountain: false, golf: false, panoramic: false },
  orientation: null,
};
