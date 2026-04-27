export type RoleOption = "promotor" | "comercializador";
export type TipoPromocion = "unifamiliar" | "plurifamiliar" | "mixto";
export type SubUni = "una_sola" | "varias";
export type SubVarias = "independiente" | "adosados" | "pareados";

export type EstiloVivienda =
  | "mediterraneo"
  | "contemporaneo"
  | "finca"
  | "colonial"
  | "minimalista"
  | "rustico";
export type EstadoPromocion = "proyecto" | "en_construccion" | "terminado";

export type FaseConstruccion =
  | "inicio_obra"
  | "estructura"
  | "cerramientos"
  | "instalaciones"
  | "acabados"
  | "entrega_proxima"
  | "llave_en_mano"
  | "definir_mas_tarde";

export type EstadoComercializacion =
  | "nuevo_lanzamiento"
  | "comercializacion_abierta"
  | "todo_vendido";

export type DefinicionClienteNacional =
  | "residente_pais"
  | "nie_residencia_fiscal"
  | "domicilio_pais"
  | "personalizada";

export type PlantaBajaTipo = "locales" | "viviendas";

export type FormaPagoComision =
  | "proporcional"
  | "escritura"
  | "personalizado";

export type FotosType = "generales" | "por_unidad" | "ambas";

export type MetodoPago = "contrato" | "manual" | "certificaciones";

export type ClasificacionCliente = "residencia" | "fiscal" | "manual";

export type FotoCategoria =
  | "fachada" | "cocina" | "salon" | "dormitorio" | "bano"
  | "jardin" | "piscina" | "vistas" | "terraza" | "zonas_comunes"
  | "parking" | "otra";

export type TipoEntrega = "fecha_definida" | "tras_contrato_cv" | "tras_licencia";

export type SubtipoUnidad = "apartamento" | "loft" | "penthouse" | "duplex" | "triplex" | "planta_baja";

export type TipoVista = "mar" | "montana" | "rio" | "oceano" | "golf";

export interface TipologiaSeleccionada {
  tipo: SubVarias;
  cantidad: number;
}

export type TipoUnidadMixto = "unifamiliar" | "piso" | "atico" | "bajo" | "duplex" | "local";

export interface FotoItem {
  id: string;
  url: string;
  nombre: string;
  categoria: FotoCategoria;
  esPrincipal: boolean;
  bloqueada: boolean;
  orden: number;
}

export interface VideoItem {
  id: string;
  tipo: "youtube" | "video" | "vimeo360";
  url: string;
  nombre: string;
}

export interface HitoPago {
  porcentaje: number;
  descripcion: string;
}

export interface HitoCertificacion {
  porcentaje: number;
  fase: string;
}

export type StepId =
  | "role"
  | "tipo"
  | "sub_uni"
  | "sub_varias"
  | "config_edificio"
  | "extras"
  | "estado"
  | "detalles"
  | "info_basica"
  | "multimedia"
  | "descripcion"
  | "crear_unidades"
  | "colaboradores"
  | "plan_pagos"
  | "revision";

/**
 * 6 fases del wizard (agrupación visual de los pasos en la timeline).
 * La ramificación entre pasos sigue igual que en el original Lovable;
 * estas fases solo agrupan para no abrumar al usuario con 14+ items sueltos.
 */
export type PhaseId = "tipologia" | "estructura" | "comercializacion" | "marketing" | "operativa" | "revision";

export interface PhaseDef {
  id: PhaseId;
  label: string;
  description: string;
  steps: StepId[];
}

export interface CardOption<T extends string> {
  value: T;
  label: string;
  description: string;
  icon: React.ElementType;
}

export interface HitoComision {
  pagoCliente: number;
  pagoColaborador: number;
}

export interface DireccionPromocion {
  pais: string;
  provincia: string;
  ciudad: string;
  direccion: string;
}

export type UnitFotosMode = "promocion" | "propias" | null;

export type UnitStatus = "available" | "reserved" | "sold" | "withdrawn";

export interface UnitData {
  id: string;
  /** Referencia interna obligatoria (p. ej. "AHLL-0001").
   *  Se usa para exportación a portales inmobiliarios. */
  ref: string;
  /** ID legible visible: "Villa 1", "Adosado 3", "1ºA"… */
  nombre: string;
  dormitorios: number;
  banos: number;
  superficieConstruida: number;
  superficieUtil: number;
  superficieTerraza: number;
  /** m² de parcela / jardín privado. Aplica a independientes y bajos. */
  parcela: number;
  precio: number;
  planta: number;
  orientacion: string;
  parking: boolean;
  trastero: boolean;
  /** Piscina privada (solo aplicable a villas). */
  piscinaPrivada: boolean;
  status: UnitStatus;
  vistas: TipoVista[];
  fotosMode: UnitFotosMode;
  /** Plano específico de la unidad (no plano de planta del edificio). */
  planos: boolean;
  subtipo: SubtipoUnidad | null;
  /** @deprecated Usar `ref`. Se mantiene por compatibilidad hasta migrar. */
  idInterna: string;
  caracteristicas: string[];
  usarFotosPromocion: boolean;
  fotosUnidad: FotoItem[];
  videosUnidad: VideoItem[];
  /* ── Overrides heredados de promoción (null = hereda) ── */
  descripcionOverride?: string;
  caracteristicasOverride?: string[];
  hitosPagoOverride?: HitoPago[];
  /** Solo aplicable a unifamiliar independiente — el resto toma el año global de promoción. */
  deliveryYearOverride?: string;
  /** Solo si el promotor quiere cambiar la certificación en una unidad concreta. */
  energyCertOverride?: string;
  /** Fase de obra por unidad · solo tiene sentido en unifamiliar. */
  faseConstruccionOverride?: FaseConstruccion;
  /** URLs de planos subidos específicos de la unidad (múltiples docs). */
  planoUrls?: string[];
  /* ── Operación comercial (se rellenan al reservar/vender) ── */
  clientName?: string;
  agencyName?: string;
  reservedAt?: string;
  soldAt?: string;
}

export type CondicionRegistro = "nombre_completo" | "ultimas_4_cifras" | "nacionalidad" | "email_completo";

/**
 * Modo de validación del registro de cliente que aplica a una promoción.
 *
 *   · "directo"     · al aprobar el registro, el cliente queda
 *                     formalmente registrado. Sin condicionar a visita.
 *   · "por_visita"  · al aprobar el registro, el cliente queda como
 *                     PREREGISTRO reservado a nombre del colaborador.
 *                     La reserva se confirma definitivamente cuando se
 *                     realice la primera visita.
 *
 * TODO(logic): la lógica de transición preregistro → aprobado tras
 * visita realizada NO está implementada todavía. El toggle persiste el
 * valor en `WizardState` y `Promotion.modoValidacionRegistro` pero
 * `Registros.tsx::approve()` sigue formalizando todo registro al
 * instante (comportamiento `directo` de facto). Implementar siguiendo
 * `docs/registration-system.md §2`.
 */
export type ModoValidacionRegistro = "directo" | "por_visita";

export interface OficinaVenta {
  id: string;
  nombre: string;
  direccion: string;
  telefono: string;
  email: string;
  whatsapp: string;
  esNueva: boolean;
}

export interface WizardState {
  role: RoleOption | null;
  tipo: TipoPromocion | null;
  subUni: SubUni | null;
  subVarias: SubVarias | null;
  // Edificio config
  numBloques: number;
  escalerasPorBloque: number[];
  plantas: number;
  aptosPorPlanta: number;
  plantaBajaTipo: PlantaBajaTipo | null;
  locales: number;
  trasteros: number;
  trasterosIncluidosPrecio: boolean;
  trasterosIncluidosPorVivienda: number;
  trasteroPrecio: number;           // precio por defecto al crear un trastero suelto
  trasteroPrecios: number[];        // precio individualizado por Tn (índice 0 = T1)
  parkings: number;
  parkingsIncluidosPrecio: boolean;
  parkingsIncluidosPorVivienda: number;
  parkingPrecio: number;            // precio por defecto al crear una plaza suelta
  parkingPrecios: number[];         // precio individualizado por Pn (índice 0 = P1)
  /* ── Zonas y amenidades (ampliado) ─────────────────────────────────
     Booleanos explícitos para las amenidades clave que la ficha de
     unidad necesita consultar de forma estructurada. El array genérico
     `amenities` más abajo se mantiene para añadir cosas extra.
     ─────────────────────────────────────────────────────────────── */
  piscinaComunitaria: boolean;
  piscinaInterna: boolean;         // piscina cubierta / climatizada
  zonaSpa: boolean;
  zonaInfantil: boolean;
  urbanizacionCerrada: boolean;
  /** Piscina privada asignada a cada villa por defecto al generar.
   *  Aplicable solo a unifamiliar. Cada unidad puede luego marcar su
   *  propio flag `piscinaPrivada`. */
  piscinaPrivadaPorDefecto: boolean;
  piscinaIncluidaPrecio: boolean;  // si la privada está incluida en el precio
  piscinaPrecio: number;           // precio por piscina privada si no está incluida
  estado: EstadoPromocion | null;
  tieneLicencia: boolean | null;
  faseConstruccion: FaseConstruccion | null;
  trimestreEntrega: string | null;
  pisoPiloto: boolean;
  oficinaVentas: boolean;
  oficinasVentaSeleccionadas: OficinaVenta[];
  fechaEntrega: string | null;
  fechaTerminacion: string | null;
  tipoEntrega: TipoEntrega | null;
  mesesTrasContrato: number;
  // Unifamiliar multi-select
  tipologiasSeleccionadas: TipologiaSeleccionada[];
  estilosSeleccionados: EstiloVivienda[];
  // Mixto
  tiposUnidadMixto: TipoUnidadMixto[];
  // Colaboradores
  colaboracion: boolean;
  comisionInternacional: number;
  comisionNacional: number;
  diferenciarNacionalInternacional: boolean;
  diferenciarComisiones: boolean;
  agenciasRefusarNacional: boolean;
  clasificacionCliente: ClasificacionCliente;
  formaPagoComision: FormaPagoComision | null;
  hitosComision: HitoComision[];
  ivaIncluido: boolean;
  condicionesRegistro: CondicionRegistro[];
  validezRegistroDias: number; // 0 = no expira
  /** Modo de validación · ver `ModoValidacionRegistro`. Default
   *  `por_visita` (alineado con la copy histórica del wizard que ya
   *  prometía preregistro tras visita). TODO(logic): la lógica
   *  asociada vive en `Registros.tsx::approve()` y aún transita
   *  directo a `aprobado` aunque este flag sea `por_visita`. */
  modoValidacionRegistro: ModoValidacionRegistro;
  // Info basica
  /** Referencia interna de la promoción (abreviatura usada como prefijo
   *  en las referencias de unidades). Se autogenera desde el nombre
   *  pero el usuario puede editarla. */
  refPromocion: string;
  /** Overrides de nombre por bloque. Clave = id del bloque (B1, B1-E1…),
   *  valor = nombre custom ("Torre Norte"). */
  blockNames: Record<string, string>;
  nombrePromocion: string;
  direccionPromocion: DireccionPromocion;
  amenities: string[];
  caracteristicasVivienda: string[];
  caracteristicasAplicacion: "todas" | "algunas";
  estiloVivienda: EstiloVivienda | null;
  urbanizacion: boolean;
  zonasComunes: string[];
  certificadoEnergetico: string;
  // Descripcion
  descripcion: string;
  descripcionMode: "ai" | "manual" | null;
  descripcionIdiomas: Record<string, string>;
  // Multimedia (fotos + videos)
  fotos: FotoItem[];
  videos: VideoItem[];
  // Unidades
  unidades: UnitData[];
  // Plan de pagos
  metodoPago: MetodoPago | null;
  hitosPago: HitoPago[];
  hitosCertificacion: HitoCertificacion[];
  requiereReserva: boolean | null;
  importeReserva: number;
  validezReserva: number;
  // Aval bancario (Ley 38/1999) — garantía sobre cantidades anticipadas.
  avalBancario: boolean;
  avalEntidad: string; // nombre del banco emisor (opcional)
  // Contactos públicos (aparecen en microsite y en ficha pública).
  contactoWeb: string;
  contactoTelefono: string;
  contactoEmail: string;
  // Documentos subidos (URLs · sustituir por objetos al tener backend).
  documentosMemoria: string[];
  documentosPlanos: string[];
  documentosBrochure: string[];
  // Override manual del % de obra (si el promotor lo ajusta en la ficha).
  constructionProgressOverride?: number;
}

export const defaultWizardState: WizardState = {
  role: null,
  tipo: null,
  subUni: null,
  subVarias: null,
  numBloques: 1,
  escalerasPorBloque: [1],
  plantas: 1,
  aptosPorPlanta: 4,
  plantaBajaTipo: null,
  locales: 0,
  trasteros: 0,
  trasterosIncluidosPrecio: true,
  trasterosIncluidosPorVivienda: 1,
  trasteroPrecio: 5000,
  trasteroPrecios: [],
  parkings: 0,
  parkingsIncluidosPrecio: true,
  parkingsIncluidosPorVivienda: 1,
  parkingPrecio: 15000,
  parkingPrecios: [],
  piscinaComunitaria: false,
  piscinaInterna: false,
  zonaSpa: false,
  zonaInfantil: false,
  urbanizacionCerrada: false,
  piscinaPrivadaPorDefecto: false,
  piscinaIncluidaPrecio: true,
  piscinaPrecio: 25000,
  estado: null,
  tieneLicencia: null,
  faseConstruccion: null,
  trimestreEntrega: null,
  pisoPiloto: false,
  oficinaVentas: false,
  oficinasVentaSeleccionadas: [],
  fechaEntrega: null,
  fechaTerminacion: null,
  tipoEntrega: null,
  mesesTrasContrato: 18,
  tipologiasSeleccionadas: [],
  estilosSeleccionados: [],
  tiposUnidadMixto: [],
  colaboracion: false,
  comisionInternacional: 5,
  comisionNacional: 3,
  diferenciarNacionalInternacional: false,
  diferenciarComisiones: false,
  agenciasRefusarNacional: false,
  clasificacionCliente: "residencia",
  formaPagoComision: null,
  hitosComision: [],
  ivaIncluido: false,
  condicionesRegistro: ["nombre_completo", "ultimas_4_cifras", "nacionalidad"],
  validezRegistroDias: 180, // 6 meses por defecto
  modoValidacionRegistro: "por_visita", // alineado con copy histórica · TODO(logic) implementar
  refPromocion: "",
  blockNames: {},
  nombrePromocion: "",
  direccionPromocion: { pais: "", provincia: "", ciudad: "", direccion: "" },
  amenities: [],
  caracteristicasVivienda: [],
  caracteristicasAplicacion: "todas",
  estiloVivienda: null,
  urbanizacion: false,
  zonasComunes: [],
  certificadoEnergetico: "",
  descripcion: "",
  descripcionMode: null,
  descripcionIdiomas: {},
  fotos: [],
  videos: [],
  unidades: [],
  metodoPago: null,
  hitosPago: [],
  hitosCertificacion: [],
  requiereReserva: null,
  importeReserva: 5000,
  validezReserva: 30,
  avalBancario: false,
  avalEntidad: "",
  contactoWeb: "",
  contactoTelefono: "",
  contactoEmail: "",
  documentosMemoria: [],
  documentosPlanos: [],
  documentosBrochure: [],
};
