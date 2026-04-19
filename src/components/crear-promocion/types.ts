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
  | "llave_en_mano";

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

export interface UnitData {
  id: string;
  nombre: string;
  dormitorios: number;
  banos: number;
  superficieConstruida: number;
  superficieUtil: number;
  superficieTerraza: number;
  precio: number;
  planta: number;
  orientacion: string;
  parking: boolean;
  trastero: boolean;
  vistas: TipoVista[];
  fotosMode: UnitFotosMode;
  planos: boolean;
  subtipo: SubtipoUnidad | null;
  idInterna: string;
  caracteristicas: string[];
  usarFotosPromocion: boolean;
  fotosUnidad: FotoItem[];
  videosUnidad: VideoItem[];
}

export type CondicionRegistro = "nombre_completo" | "ultimas_4_cifras" | "nacionalidad" | "email_completo";

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
  parkings: number;
  parkingsIncluidosPrecio: boolean;
  parkingsIncluidosPorVivienda: number;
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
  // Info basica
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
  parkings: 0,
  parkingsIncluidosPrecio: true,
  parkingsIncluidosPorVivienda: 1,
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
  ivaIncluido: true,
  condicionesRegistro: ["nombre_completo", "ultimas_4_cifras", "nacionalidad"],
  validezRegistroDias: 0,
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
};
