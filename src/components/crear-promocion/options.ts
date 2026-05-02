import {
  Building2, Store, Home, Building, Layers,
  Landmark, Castle, House, Fence,
  PencilRuler, HardHat, CheckCircle2,
  Hammer, Columns3, BrickWall, Plug, Paintbrush, PackageCheck, Key, Clock,
  Rocket, ShoppingBag, Ban,
  Waves, Dumbbell, Sparkles, UtensilsCrossed, Laptop, ShieldCheck,
  Car, TreePine, Baby, Umbrella, Bell,
  CookingPot, Eye, PanelTop, Flower2, Cpu, Wind, Heater,
  Sun, Boxes, TreeDeciduous, Columns2, PenTool, Mountain,
  Footprints, Volleyball, Dog,
} from "lucide-react";
import type {
  CardOption, RoleOption, TipoPromocion, SubUni, SubVarias,
  EstadoPromocion, FaseConstruccion, EstadoComercializacion,
  DefinicionClienteNacional, FormaPagoComision, EstiloVivienda,
  SubtipoUnidad, TipoVista,
} from "./types";

export const roleOptions: CardOption<RoleOption>[] = [
  { value: "promotor", label: "Como Promotor", description: "Eres el propietario o desarrollador de la promoción", icon: Building2 },
  { value: "comercializador", label: "Como Comercializador", description: "Gestionas la venta en nombre de un promotor", icon: Store },
];

export const tipoOptions: CardOption<TipoPromocion>[] = [
  { value: "unifamiliar", label: "Unifamiliar", description: "Viviendas individuales con parcela propia", icon: Home },
  { value: "plurifamiliar", label: "Plurifamiliar", description: "Edificio con múltiples viviendas en altura", icon: Building },
  { value: "mixto", label: "Mixto", description: "Combinación de unifamiliar y plurifamiliar", icon: Layers },
];

export const subUniOptions: CardOption<SubUni>[] = [
  { value: "una_sola", label: "Una sola vivienda", description: "Proyecto de una única vivienda unifamiliar", icon: House },
  { value: "varias", label: "Varias viviendas", description: "Conjunto de viviendas unifamiliares", icon: Landmark },
];

export const subVariasOptions: CardOption<SubVarias>[] = [
  { value: "independiente", label: "Independiente", description: "Vivienda aislada con parcela propia", icon: Castle },
  { value: "adosados", label: "Adosado", description: "Vivienda unida lateralmente en hilera", icon: Fence },
  { value: "pareados", label: "Pareado", description: "Dos viviendas que comparten pared medianera", icon: Home },
];

export const estiloViviendaOptions: CardOption<EstiloVivienda>[] = [
  { value: "mediterraneo", label: "Mediterráneo", description: "Estilo clásico con tonos cálidos y terrazas", icon: Sun },
  { value: "contemporaneo", label: "Contemporáneo", description: "Líneas rectas, grandes ventanales y diseño actual", icon: Boxes },
  { value: "finca", label: "Finca", description: "Estilo rústico tradicional con carácter rural", icon: TreeDeciduous },
  { value: "colonial", label: "Colonial", description: "Inspiración clásica con columnas y simetría", icon: Columns2 },
  { value: "minimalista", label: "Minimalista", description: "Simplicidad, espacios abiertos y acabados puros", icon: PenTool },
  { value: "rustico", label: "Rústico", description: "Materiales naturales como piedra y madera", icon: Mountain },
];

export const estadoOptions: CardOption<EstadoPromocion>[] = [
  { value: "proyecto", label: "Proyecto", description: "Aún no ha empezado a construirse", icon: PencilRuler },
  { value: "en_construccion", label: "En construcción", description: "La obra está actualmente en marcha", icon: HardHat },
  { value: "terminado", label: "Terminado", description: "La promoción está finalizada", icon: CheckCircle2 },
];

/* Etapas de construcción · cada una lleva su rango de % aproximado de
 *  ejecución de obra · sirve al promotor / agencia para comunicar al
 *  cliente "qué tan cerca está la entrega". Los rangos son de
 *  referencia técnica habitual en obra nueva. Si cambian, mantenlos
 *  coherentes con la copy del label (visible), la description (subline)
 *  y los buckets del helper `constructionPhaseFromProgress` de abajo. */
export const faseConstruccionOptions: CardOption<FaseConstruccion>[] = [
  { value: "inicio_obra", label: "Inicio de obra · 0–10%", description: "Fase inicial de la construcción", icon: Hammer },
  { value: "estructura", label: "Estructura · 20–40%", description: "Levantamiento de la estructura del edificio", icon: Columns3 },
  { value: "cerramientos", label: "Cerramientos · 40–60%", description: "Fachada y cerramientos exteriores", icon: BrickWall },
  { value: "instalaciones", label: "Instalaciones · 60–75%", description: "Instalaciones interiores y servicios", icon: Plug },
  { value: "acabados", label: "Acabados · 75–90%", description: "Fase final de acabados interiores", icon: Paintbrush },
  { value: "entrega_proxima", label: "Entrega próxima · 90–100%", description: "La obra está a punto de finalizarse", icon: PackageCheck },
  { value: "llave_en_mano", label: "Llave en mano · 100%", description: "Terminada y disponible para entrega inmediata", icon: Key },
  { value: "definir_mas_tarde", label: "Lo añadiré más tarde", description: "Completa este dato cuando lo tengas claro", icon: Clock },
];

/* Lista canónica de fases REALES (excluye 'definir_mas_tarde') · usada
 *  por mapeos % → fase y por selectores de edición que necesitan
 *  enumerar solo etapas de obra. */
export const FASES_CONSTRUCCION_REALES: FaseConstruccion[] = [
  "inicio_obra", "estructura", "cerramientos",
  "instalaciones", "acabados", "entrega_proxima", "llave_en_mano",
];

/** Mapea un % de progreso de obra (0-100) a la fase canónica que
 *  corresponde según los rangos definidos en `faseConstruccionOptions`.
 *  Devuelve `null` para `progress === undefined` (sin configurar).
 *
 *  Buckets exactos · alineados con los rangos visibles:
 *    100      → llave_en_mano
 *    ≥ 90     → entrega_proxima  (90–100%)
 *    ≥ 75     → acabados         (75–90%)
 *    ≥ 60     → instalaciones    (60–75%)
 *    ≥ 40     → cerramientos     (40–60%)
 *    ≥ 20     → estructura       (20–40%)
 *    else     → inicio_obra      (0–10%, gap 10–20% se redondea aquí) */
export function constructionPhaseFromProgress(
  progress: number | undefined,
): FaseConstruccion | null {
  if (progress === undefined || progress === null) return null;
  if (progress >= 100) return "llave_en_mano";
  if (progress >= 90) return "entrega_proxima";
  if (progress >= 75) return "acabados";
  if (progress >= 60) return "instalaciones";
  if (progress >= 40) return "cerramientos";
  if (progress >= 20) return "estructura";
  return "inicio_obra";
}

/** Devuelve el label canónico (con su rango de %) de la fase de obra
 *  que corresponde a un `progress` numérico. Útil para componentes que
 *  solo tienen el progress y necesitan mostrar el nombre + rango.
 *  Devuelve `null` si no hay progress definido. */
export function constructionPhaseLabelFromProgress(
  progress: number | undefined,
): string | null {
  const value = constructionPhaseFromProgress(progress);
  if (!value) return null;
  return faseConstruccionOptions.find((o) => o.value === value)?.label ?? null;
}

export const estadoComercializacionOptions: CardOption<EstadoComercializacion>[] = [
  { value: "nuevo_lanzamiento", label: "Nuevo lanzamiento", description: "La promoción se lanzará próximamente", icon: Rocket },
  { value: "comercializacion_abierta", label: "Comercialización abierta", description: "Las unidades ya están disponibles para venta", icon: ShoppingBag },
  { value: "todo_vendido", label: "Todo vendido", description: "Todas las unidades han sido vendidas", icon: Ban },
];

export const definicionClienteNacionalOptions: CardOption<DefinicionClienteNacional>[] = [
  { value: "residente_pais", label: "Residente en el país", description: "Cliente residente en el mismo país de la promoción", icon: Home },
  { value: "nie_residencia_fiscal", label: "NIE / Residencia fiscal", description: "Cliente con NIE o residencia fiscal local", icon: ShieldCheck },
  { value: "domicilio_pais", label: "Domicilio en el país", description: "Cliente comprador con domicilio en el país", icon: Building },
  { value: "personalizada", label: "Personalizada", description: "Configuración personalizada de definición", icon: Laptop },
];

export const formaPagoComisionOptions: CardOption<FormaPagoComision>[] = [
  { value: "proporcional", label: "Proporcional", description: "Reparto proporcional según pago del comprador", icon: Layers },
  { value: "escritura", label: "En escritura", description: "Todo al momento de la firma de escritura pública", icon: PencilRuler },
  { value: "personalizado", label: "Personalizado", description: "Hitos de pago personalizados", icon: PackageCheck },
];

export const amenitiesOptions = [
  { value: "piscina", label: "Piscina", icon: Waves },
  { value: "gimnasio", label: "Gimnasio", icon: Dumbbell },
  { value: "spa", label: "Spa", icon: Sparkles },
  { value: "restaurantes", label: "Restaurantes", icon: UtensilsCrossed },
  { value: "coworking", label: "Co-working", icon: Laptop },
  { value: "seguridad", label: "Seguridad", icon: ShieldCheck },
  { value: "parking", label: "Parking", icon: Car },
  { value: "jardin", label: "Jardín", icon: TreePine },
  { value: "zona_infantil", label: "Zona infantil", icon: Baby },
  { value: "beach_club", label: "Beach club", icon: Umbrella },
  { value: "conserje", label: "Conserjería", icon: Bell },
];

export const caracteristicasViviendaOptions = [
  { value: "cocina_equipada", label: "Cocina equipada", icon: CookingPot },
  { value: "vistas_mar", label: "Vistas al mar", icon: Eye },
  { value: "terraza", label: "Terraza", icon: PanelTop },
  { value: "jardin_privado", label: "Jardín privado", icon: Flower2 },
  { value: "smart_home", label: "Smart home", icon: Cpu },
  { value: "aire_acondicionado", label: "Aire acondicionado", icon: Wind },
  { value: "suelo_radiante", label: "Suelo radiante", icon: Heater },
];

export const zonasComOptions = [
  { value: "piscina_com", label: "Piscina comunitaria", icon: Waves },
  { value: "jardin_com", label: "Jardín comunitario", icon: TreePine },
  { value: "zona_infantil_com", label: "Zona infantil", icon: Baby },
  { value: "padel", label: "Pista de pádel", icon: Volleyball },
  { value: "gimnasio_com", label: "Gimnasio", icon: Dumbbell },
  { value: "paseos", label: "Zonas de paseo", icon: Footprints },
  { value: "zona_mascotas", label: "Zona de mascotas", icon: Dog },
  { value: "seguridad_com", label: "Seguridad / Vigilancia", icon: ShieldCheck },
];

export const subtipoUnidadOptions: { value: SubtipoUnidad; label: string }[] = [
  { value: "apartamento", label: "Apartamento" },
  { value: "loft", label: "Loft" },
  { value: "penthouse", label: "Penthouse" },
  { value: "duplex", label: "Dúplex" },
  { value: "triplex", label: "Tríplex" },
  { value: "planta_baja", label: "Planta baja" },
];

export const tipoVistaOptions: { value: TipoVista; label: string }[] = [
  { value: "mar", label: "Al mar" },
  { value: "montana", label: "A la montaña" },
  { value: "rio", label: "Al río" },
  { value: "oceano", label: "Al océano" },
  { value: "golf", label: "A golf" },
];

export const certificadoEnergeticoOptions = [
  "A", "B", "C", "D", "E", "F", "G", "En trámite",
];
