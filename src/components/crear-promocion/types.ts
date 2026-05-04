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
  | "revision"
  /* Mini-steps · solo se acceden desde la pantalla de Revisión vía
   *  modal (EditStepModal) · NO aparecen en la timeline lineal del
   *  wizard. Cada uno cubre UN dominio limpio: identidad (rol +
   *  nombre), ubicación (dirección), operativa (piso piloto +
   *  oficinas). */
  | "identidad"
  | "ubicacion"
  | "operativa"
  | "planos"
  | "brochure";

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
  /** Solo aplica a unifamiliar · indica que la villa tiene solárium
   *  (terraza superior accesible). */
  solarium?: boolean;
  /** Solo aplica a unifamiliar · indica que la villa tiene sótano. */
  sotano?: boolean;
  /** Piscina privada (solo aplicable a villas). */
  piscinaPrivada: boolean;
  status: UnitStatus;
  vistas: TipoVista[];
  fotosMode: UnitFotosMode;
  /** Plano específico de la unidad (no plano de planta del edificio). */
  planos: boolean;
  subtipo: SubtipoUnidad | null;
  /** Para promociones unifamiliares · qué tipología tiene esta unidad
   *  concreta (independiente / adosados / pareados). Lo necesita el
   *  adapter `unitDataToUnit` para mostrar la etiqueta correcta en
   *  la columna "Tipo" del catálogo · sin esto, fallback "Apartamento"
   *  (bug). Null/undef en promociones plurifamiliar/mixto. */
  tipologiaUnifamiliar?: SubVarias;
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
  /** URLs de memorias de calidades específicas de la unidad. */
  memoriaUrls?: string[];
  /** URLs de brochures comerciales específicos de la unidad. */
  brochureUrls?: string[];
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
  /** Unidad a la que pertenece cada trastero suelto · "" = sin asignar.
   *  Mismo índice que `trasteroPrecios`. */
  trasteroAsignaciones?: string[];
  parkings: number;
  parkingsIncluidosPrecio: boolean;
  parkingsIncluidosPorVivienda: number;
  parkingPrecio: number;            // precio por defecto al crear una plaza suelta
  parkingPrecios: number[];         // precio individualizado por Pn (índice 0 = P1)
  /** Unidad a la que pertenece cada plaza suelta. Mismo índice. */
  parkingAsignaciones?: string[];
  /* Solárium y sótano sueltos · solo aplica a unifamiliar. Mismo
   * patrón que trasteros/parking · `count` total + `precios[]` por
   * índice. La UI los expone en Anejos sueltos cuando hay villas.
   * Opcionales · drafts antiguos no los tienen · runtime los hidrata
   * con `?? 0` / `?? []`. */
  solariums?: number;
  solariumPrecio?: number;
  solariumPrecios?: number[];
  /** Unidad asignada a cada solárium · mismo índice que precios. */
  solariumAsignaciones?: string[];
  sotanos?: number;
  sotanoPrecio?: number;
  sotanoPrecios?: number[];
  /** Unidad asignada a cada sótano · mismo índice que precios. */
  sotanoAsignaciones?: string[];
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
  /** Id de la unidad que actúa como piso piloto · solo aplica si
   *  `pisoPiloto = true`. Se asigna desde la pantalla de Revisión
   *  (modal Operativa) o desde la ficha de la promo. Null cuando
   *  el promotor activó el toggle pero aún no eligió cuál. */
  pisoPilotoUnidadId: string | null;
  oficinaVentas: boolean;
  oficinasVentaSeleccionadas: OficinaVenta[];
  fechaEntrega: string | null;
  fechaTerminacion: string | null;
  tipoEntrega: TipoEntrega | null;
  mesesTrasContrato: number;
  /** Meses estimados desde que se obtenga la licencia hasta entrega ·
   *  análogo a `mesesTrasContrato` · solo aplica cuando
   *  `tipoEntrega === "tras_licencia"`. */
  mesesTrasLicencia: number;
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
  /** Referencia pública canónica `PR + 5 dígitos` (CLAUDE.md scheme).
   *  Se asigna automáticamente al abrir el wizard por primera vez ·
   *  inmutable durante toda la vida del borrador y de la promoción
   *  publicada. Sirve como identidad estable para el draft (su id
   *  interno se deriva de aquí) · garantiza que cada autosave
   *  actualiza el MISMO borrador en lugar de generar duplicados.
   *  Opcional para retrocompat con drafts antiguos. */
  publicRef?: string;
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
  /** Tipo de urbanización · "cerrada" (gated), "resort" (mar/golf
   *  con servicios) o "abierta" (sin acceso restringido). */
  urbanizacionTipo: "cerrada" | "resort" | "abierta" | null;
  urbanizacionNombre: string;
  /** Amenities seleccionadas · ids planos. La agrupación visual
   *  (seguridad / zonas comunes / deporte / social / servicios /
   *  sostenibilidad) vive en `InfoBasicaStep` · el dato es solo el
   *  set de ids. */
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
  /** Aval bancario (Ley 38/1999) · `null` = el user no ha elegido aún
   *  (default fresh draft). Forzamos elección explícita · sin default
   *  preseleccionado · evita publicar "Sin aval" por inercia cuando
   *  la promoción sí lo tiene constituido. */
  avalBancario: boolean | null;
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
  /** Características por defecto de la promoción (`?wizardV5=1`).
   *  Se propagan a cada unidad creada en `crear_unidades` según el
   *  `appliesTo` de cada bloque. Opcional · drafts antiguos no lo
   *  tienen y se hidratan al `defaultPromotionDefaults` al entrar
   *  en el step. Spec en `extras-v5/types.ts`. */
  promotionDefaults?: import("./extras-v5/types").PromotionDefaults;
}

/* defaultWizardState · TODOS los campos arrancan en estado "vacío".
 * Antes había muchos números mock (importeReserva: 5000, comisiones
 * 5/3%, validez 180/30 días, precios de parking/trastero/piscina,
 * etc.) que se persistían en el state aunque el user nunca los
 * tocara · luego aparecían en la ficha como si los hubiera
 * configurado. Ahora cero / null / [] · el user introduce sus valores
 * reales o los inputs muestran placeholder con sugerencia (no en el
 * state). Excepción · numBloques y plantas se quedan en 1 porque no
 * puede haber 0 edificios/plantas en plurifamiliar. */
export const defaultWizardState: WizardState = {
  role: null,
  tipo: null,
  subUni: null,
  subVarias: null,
  numBloques: 1,
  escalerasPorBloque: [1],
  /* Defaults razonables para un edificio plurifamiliar típico · 4
   * plantas con 4 viviendas/planta = 16 viviendas en 1 escalera + 1
   * bloque. Hace que la vista previa del wizard se renderice
   * inmediatamente al abrir el paso 3 sin "edificio vacío". El user
   * ajusta a partir de ahí. */
  plantas: 4,
  aptosPorPlanta: 4,
  plantaBajaTipo: null,
  locales: 0,
  trasteros: 0,
  trasterosIncluidosPrecio: true,
  trasterosIncluidosPorVivienda: 1,
  trasteroPrecio: 0,
  trasteroPrecios: [],
  parkings: 0,
  parkingsIncluidosPrecio: true,
  parkingsIncluidosPorVivienda: 1,
  parkingPrecio: 0,
  parkingPrecios: [],
  solariums: 0,
  solariumPrecio: 0,
  solariumPrecios: [],
  sotanos: 0,
  sotanoPrecio: 0,
  sotanoPrecios: [],
  piscinaComunitaria: false,
  piscinaInterna: false,
  zonaSpa: false,
  zonaInfantil: false,
  urbanizacionCerrada: false,
  piscinaPrivadaPorDefecto: false,
  piscinaIncluidaPrecio: true,
  piscinaPrecio: 0,
  estado: null,
  tieneLicencia: null,
  faseConstruccion: null,
  trimestreEntrega: null,
  pisoPiloto: false,
  pisoPilotoUnidadId: null,
  oficinaVentas: false,
  oficinasVentaSeleccionadas: [],
  fechaEntrega: null,
  fechaTerminacion: null,
  tipoEntrega: null,
  mesesTrasContrato: 0,
  mesesTrasLicencia: 0,
  tipologiasSeleccionadas: [],
  estilosSeleccionados: [],
  tiposUnidadMixto: [],
  colaboracion: false,
  comisionInternacional: 0,
  comisionNacional: 0,
  diferenciarNacionalInternacional: false,
  diferenciarComisiones: false,
  agenciasRefusarNacional: false,
  clasificacionCliente: "residencia",
  formaPagoComision: null,
  hitosComision: [],
  ivaIncluido: false,
  condicionesRegistro: [],
  validezRegistroDias: 0,
  modoValidacionRegistro: "directo", // regla canónica · NUNCA `por_visita` por defecto (no recomendamos amarrar comisión a visita) · TODO(logic) implementar
  refPromocion: "",
  blockNames: {},
  nombrePromocion: "",
  direccionPromocion: { pais: "", provincia: "", ciudad: "", direccion: "" },
  amenities: [],
  caracteristicasVivienda: [],
  caracteristicasAplicacion: "todas",
  estiloVivienda: null,
  urbanizacion: false,
  urbanizacionTipo: null,
  urbanizacionNombre: "",
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
  importeReserva: 0,
  validezReserva: 0,
  avalBancario: null,
  avalEntidad: "",
  contactoWeb: "",
  contactoTelefono: "",
  contactoEmail: "",
  documentosMemoria: [],
  documentosPlanos: [],
  documentosBrochure: [],
};
