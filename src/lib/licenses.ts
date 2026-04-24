/**
 * Licencias y registros inmobiliarios · catálogo canónico.
 *
 * El modelo español NO tiene un único registro nacional obligatorio: cada
 * comunidad autónoma decide si crea su propio registro y si es
 * obligatorio o voluntario. Por eso una agencia puede tener N licencias
 * según dónde opere.
 *
 * Registros autonómicos obligatorios hoy:
 *   · AICAT  · Catalunya            · desde 2010 (Decret 12/2010)
 *   · RAICV  · Comunitat Valenciana · desde 2023 (Decreto 98/2022)
 *   · EKAIA  · País Vasco           · desde 2018
 *
 * Registros autonómicos voluntarios:
 *   · RAIA   · Andalucía (propuesto como obligatorio, hoy voluntario)
 *
 * Voluntarios a nivel nacional / internacional:
 *   · COAPI  · Colegio Oficial de Agentes de la Propiedad Inmobiliaria
 *   · API    · Título Agente de la Propiedad Inmobiliaria
 *   · GIPE   · Gestor Intermediario en Promociones
 *   · RICS   · Royal Institution of Chartered Surveyors (UK, internacional)
 *   · FIABCI · Federación Internacional de Profesiones Inmobiliarias
 *
 * Autoridades extranjeras:
 *   · FMI    · Fastighetsmäklarinspektionen (Suecia, obligatorio)
 *
 * Otras CCAA (Madrid, Baleares, Canarias, Castilla y León, Galicia,
 * Asturias, Cantabria, Navarra, La Rioja, Murcia, Aragón, Castilla-La
 * Mancha, Extremadura) no tienen registro autonómico obligatorio · usan
 * COAPI / API voluntarios.
 */

export type LicenciaTipo =
  | "AICAT" | "RAICV" | "EKAIA" | "RAIA"
  | "COAPI" | "API"   | "GIPE"
  | "RICS"  | "FIABCI"
  | "FMI"
  | "custom";

export interface LicenciaInmobiliaria {
  tipo: LicenciaTipo;
  /** Número del registro · formato libre, viene como lo emite la
   *  autoridad (ej. AICAT-123456, RAICV-A-01234). */
  numero: string;
  /** Fecha de alta si aplica. ISO yyyy-mm-dd. */
  desde?: string;
  /** Fecha de vencimiento si aplica. */
  expiraEn?: string;
  /** true cuando Byvaro ha verificado el número contra el registro
   *  oficial. Alimenta el badge "Verificada". */
  verificada?: boolean;
  /** Etiqueta libre cuando `tipo === "custom"`. */
  etiqueta?: string;
  /** URL del registro público donde consultar (copiado al vuelo si la
   *  autoridad expone consulta online). */
  publicUrl?: string;
}

interface LicenciaMeta {
  label: string;
  /** Nombre completo en el idioma oficial del registro. */
  nombreCompleto: string;
  /** Ámbito geográfico (CCAA / país). */
  ambito: string;
  /** Si es obligatorio cumplir con este registro para operar en el ámbito. */
  obligatorio: boolean;
  /** Organismo que lleva el registro. */
  autoridad: string;
  /** URL principal del registro público. */
  autoridadUrl?: string;
}

export const LICENCIA_META: Record<Exclude<LicenciaTipo, "custom">, LicenciaMeta> = {
  AICAT: {
    label: "AICAT",
    nombreCompleto: "Registre d'Agents Immobiliaris de Catalunya",
    ambito: "Catalunya",
    obligatorio: true,
    autoridad: "Generalitat de Catalunya",
    autoridadUrl: "https://agentsimmobiliaris.gencat.cat",
  },
  RAICV: {
    label: "RAICV",
    nombreCompleto: "Registro de Agentes Inmobiliarios de la Comunitat Valenciana",
    ambito: "Comunitat Valenciana",
    obligatorio: true,
    autoridad: "Generalitat Valenciana",
    autoridadUrl: "https://habitatge.gva.es/va/web/vivienda-y-calidad-en-la-edificacion/registro-de-agentes-inmobiliarios",
  },
  EKAIA: {
    label: "EKAIA",
    nombreCompleto: "Registro de Agentes Inmobiliarios de Euskadi",
    ambito: "País Vasco",
    obligatorio: true,
    autoridad: "Gobierno Vasco",
    autoridadUrl: "https://www.euskadi.eus",
  },
  RAIA: {
    label: "RAIA",
    nombreCompleto: "Registro de Agentes Inmobiliarios de Andalucía",
    ambito: "Andalucía",
    obligatorio: false,
    autoridad: "Junta de Andalucía",
  },
  COAPI: {
    label: "COAPI",
    nombreCompleto: "Colegio Oficial de Agentes de la Propiedad Inmobiliaria",
    ambito: "España",
    obligatorio: false,
    autoridad: "CGCOAPI",
    autoridadUrl: "https://www.coapi.org",
  },
  API: {
    label: "API",
    nombreCompleto: "Título de Agente de la Propiedad Inmobiliaria",
    ambito: "España",
    obligatorio: false,
    autoridad: "Ministerio",
  },
  GIPE: {
    label: "GIPE",
    nombreCompleto: "Gestor Intermediario en Promociones de Edificaciones",
    ambito: "España",
    obligatorio: false,
    autoridad: "APIALIA",
  },
  RICS: {
    label: "RICS",
    nombreCompleto: "Royal Institution of Chartered Surveyors",
    ambito: "Internacional",
    obligatorio: false,
    autoridad: "RICS UK",
    autoridadUrl: "https://www.rics.org",
  },
  FIABCI: {
    label: "FIABCI",
    nombreCompleto: "Federación Internacional de Profesiones Inmobiliarias",
    ambito: "Internacional",
    obligatorio: false,
    autoridad: "FIABCI World",
    autoridadUrl: "https://www.fiabci.org",
  },
  FMI: {
    label: "FMI",
    nombreCompleto: "Fastighetsmäklarinspektionen",
    ambito: "Sverige",
    obligatorio: true,
    autoridad: "FMI · autoridad sueca de corredores inmobiliarios",
    autoridadUrl: "https://fmi.se",
  },
};

/** Una agencia se considera "verificada por Byvaro" cuando tiene al
 *  menos una licencia con `verificada === true`. Regla simple hoy · en
 *  producción, el equipo de confianza marca el flag tras validar el
 *  número contra el registro oficial. */
export function isAgencyVerified(licencias?: LicenciaInmobiliaria[]): boolean {
  if (!licencias || licencias.length === 0) return false;
  return licencias.some((l) => !!l.verificada);
}

export function licenciaLabel(l: LicenciaInmobiliaria): string {
  if (l.tipo === "custom") return l.etiqueta ?? "Licencia";
  return LICENCIA_META[l.tipo].label;
}

export function licenciaMeta(l: LicenciaInmobiliaria): LicenciaMeta | null {
  if (l.tipo === "custom") return null;
  return LICENCIA_META[l.tipo];
}
