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
    /* Confort base */
    airConditioning: boolean;
    airConditioningType: "central" | "split" | "preinstallation" | null;
    heating: boolean;
    heatingType: "underfloor" | "central" | "gas" | null;
    equippedKitchen: boolean;
    kitchenType: "open" | "independent" | null;
    /* Eficiencia / smart */
    domotics: boolean;
    solarPanels: boolean;
    electricBlinds: boolean;
    doubleGlazing: boolean;
    /* Espacios extra */
    lavanderia: boolean;
    bodega: boolean;
    armariosEmpotrados: boolean;
    vestidor: boolean;
    chimenea: boolean;
    /* Wellness · zonas comunes/privadas */
    gym: boolean;
    sauna: boolean;
    jacuzzi: boolean;
    hammam: boolean;
    /* Exterior · ocio */
    bbq: boolean;
    tenis: boolean;
    padel: boolean;
    /* Edificio */
    ascensor: boolean;
  };
  security: {
    alarm: boolean;
    reinforcedDoor: boolean;
    videoSurveillance: boolean;
  };
  views: {
    sea: boolean;
    oceano: boolean;
    rio: boolean;
    mountain: boolean;
    ciudad: boolean;
    golf: boolean;
    panoramic: boolean;
    amanecer: boolean;
    atardecer: boolean;
    abiertas: boolean;
  };
  /** Rosa de los vientos completa · 8 puntos cardinales · estándar
   *  en fichas inmobiliarias españolas (Idealista, Fotocasa, etc.). */
  orientation:
    | "north" | "northeast" | "east" | "southeast"
    | "south" | "southwest" | "west" | "northwest"
    | null;
  /** Orden de selección · cada vez que el user marca una flag de
   *  equipment/views/security/etc., su id se añade al INICIO de
   *  este array. Al desmarcar, se quita. La ficha pinta los chips
   *  en este orden · el último marcado aparece primero. Sin esto,
   *  los chips seguían el orden del schema (estático) y "lo último
   *  añadido siempre quedaba abajo". */
  selectedOrder: string[];
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
    airConditioning: false, airConditioningType: null,
    heating: false, heatingType: null,
    equippedKitchen: false, kitchenType: null,
    domotics: false, solarPanels: false, electricBlinds: false, doubleGlazing: false,
    lavanderia: false, bodega: false, armariosEmpotrados: false, vestidor: false, chimenea: false,
    gym: false, sauna: false, jacuzzi: false, hammam: false,
    bbq: false, tenis: false, padel: false,
    ascensor: false,
  },
  security: { alarm: false, reinforcedDoor: false, videoSurveillance: false },
  views: {
    sea: false, oceano: false, rio: false,
    mountain: false, ciudad: false, golf: false, panoramic: false,
    amanecer: false, atardecer: false, abiertas: false,
  },
  orientation: null,
  selectedOrder: [],
};
