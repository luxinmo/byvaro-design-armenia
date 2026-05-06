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
    /** Precio (€) cuando `priceMode === "optional"` · sin IVA, base
     *  para el upsell de la unidad. Null si aún no se ha rellenado o
     *  si el modo no es opcional. */
    optionalPrice: number | null;
  };
  parking: {
    enabled: boolean;
    spaces: number;
    /** Tipo de plaza · `outdoor` (descubierta), `subterraneo` (sótano
     *  comunitario), `closed_garage` (garaje cerrado privado), `mixto`
     *  (la promoción ofrece varios tipos sin distinguir per-vivienda). */
    type: "outdoor" | "subterraneo" | "closed_garage" | "mixto";
    priceMode: PriceMode | null;
    appliesTo: AppliesTo | null;
    optionalPrice: number | null;
  };
  storageRoom: {
    enabled: boolean;
    appliesTo: AppliesTo | null;
    priceMode: PriceMode | null;
    optionalPrice: number | null;
  };
  /** Sótano · típico en villa unifamiliar · puede tener uso polivalente
   *  (bodega, gimnasio, cine, etc.). Puede ser opcional con precio
   *  · igual que piscina/parking/trastero. */
  basement: {
    enabled: boolean;
    appliesTo: AppliesTo | null;
    priceMode: PriceMode | null;
    optionalPrice: number | null;
  };
  solarium: {
    enabled: boolean;
    appliesTo: AppliesTo | null;
    priceMode: PriceMode | null;
    optionalPrice: number | null;
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
    /** Punto de carga para vehículo eléctrico (preinstalación o
     *  instalación completa) · obligatorio CTE en parking nuevo. */
    chargingPoint: boolean;
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
    /* Exterior · ocio · tenis/padel ELIMINADOS · son zona comunitaria
     *  de la urbanización (van en amenidades), no anejo per-vivienda. */
    bbq: boolean;
    /* Edificio · `ascensor` se renderiza como "Ascensor privado" en
     *  ambos tipos · en plurifamiliar = ascensor exclusivo del piso ·
     *  en unifamiliar = ascensor interno de la villa. */
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
   *  en este orden · el último marcado aparece primero. */
  selectedOrder: string[];
  /** Categorías "abiertas" en el wizard (chip seleccionado · card
   *  expandida). Se persiste para que `canContinue` pueda exigir al
   *  user que marque algo dentro o cierre el chip antes de
   *  "Siguiente". Útil sobre todo para categorías sin `enabled`
   *  flag (security, views, orientation). */
  openExtras: string[];
}

export const defaultPromotionDefaults: PromotionDefaults = {
  privatePool: { enabled: false, appliesTo: null, priceMode: null, optionalPrice: null },
  parking: {
    enabled: false,
    spaces: 1,
    type: "outdoor",
    priceMode: null,
    appliesTo: null,
    optionalPrice: null,
  },
  storageRoom: { enabled: false, appliesTo: null, priceMode: null, optionalPrice: null },
  basement: { enabled: false, appliesTo: null, priceMode: null, optionalPrice: null },
  solarium: { enabled: false, appliesTo: null, priceMode: null, optionalPrice: null },
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
    chargingPoint: false,
    lavanderia: false, bodega: false, armariosEmpotrados: false, vestidor: false, chimenea: false,
    gym: false, sauna: false, jacuzzi: false, hammam: false,
    bbq: false,
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
  openExtras: [],
};
