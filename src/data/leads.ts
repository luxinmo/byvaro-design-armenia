/**
 * Leads · entradas crudas de potenciales compradores que llegan desde
 * portales (Idealista, Fotocasa, Habitaclia…), formularios del microsite,
 * o agencias colaboradoras antes de ser aprobados/rechazados como
 * Registros.
 *
 * Diferencia con `Registro`:
 *   - Lead = entrada sin cualificar, pendiente de revisión por el
 *     promotor o asignación a un comercial.
 *   - Registro = lead ya aprobado y ligado a un cliente + promoción
 *     concreta. La IA de duplicados corre sobre los leads antes de
 *     promocionarlos a registros.
 *
 * TODO(backend): `GET /api/leads` con paginación + filtros. Cada lead
 *   se persiste al recibir el webhook del portal o al someter un
 *   formulario. Ver `docs/backend-integration.md §7.1`.
 */

export type LeadSource =
  | "idealista"
  | "fotocasa"
  | "habitaclia"
  | "microsite"
  | "referral"
  | "agency"
  | "whatsapp"
  | "walkin"
  | "call";

export type LeadStatus =
  | "new"          // recién entrado, sin revisar
  | "qualified"    // revisado, cumple requisitos mínimos
  | "contacted"    // alguien del equipo ya contactó
  | "duplicate"    // detectado duplicado por la IA
  | "rejected"     // descartado manualmente
  | "converted";   // promovido a Registro

export type LeadInterest = {
  /** Promoción con la que el lead ha mostrado interés. */
  promotionId?: string;
  promotionName?: string;
  /** Tipología (Apartamento, Villa, Ático…). */
  tipologia?: string;
  /** Rango de dormitorios pedido. */
  dormitorios?: string;        // "2-3", "3+"
  /** Presupuesto máximo en EUR (null = no declarado). */
  presupuestoMax?: number;
  /** Zona preferida. */
  zona?: string;
};

export type Lead = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  /** ISO2 del país de origen del comprador. */
  nationality?: string;
  /** Idioma preferido para comunicarse (ISO2). */
  idioma?: string;
  source: LeadSource;
  status: LeadStatus;
  /** Interés declarado. */
  interest: LeadInterest;
  /** ISO timestamp cuando entró el lead. */
  createdAt: string;
  /** ISO timestamp del primer contacto del equipo (null si aún no). */
  firstResponseAt?: string;
  /** Usuario del promotor asignado al lead. */
  assignedTo?: { name: string; email: string };
  /** Mensaje libre del comprador (si llegó con mensaje). */
  message?: string;
  /** Score de IA duplicados · 0-100 · null si aún no se ha evaluado. */
  duplicateScore?: number;
  /** Si duplicateScore ≥ 70, referencia al contacto/registro con el
   *  que matchea (para revisar antes de crear doble entrada). */
  duplicateOfContactId?: string;
  /** Etiquetas libres para clasificar (urgente, cash-buyer, etc.). */
  tags?: string[];
};

/* ─── Helpers de UI ─── */

export const leadSourceLabel: Record<LeadSource, string> = {
  idealista:  "Idealista",
  fotocasa:   "Fotocasa",
  habitaclia: "Habitaclia",
  microsite:  "Microsite",
  referral:   "Referido",
  agency:     "Agencia",
  whatsapp:   "WhatsApp",
  walkin:     "Visita oficina",
  call:       "Llamada",
};

export const leadStatusConfig: Record<LeadStatus, { label: string; badgeClass: string; dotClass: string }> = {
  new:        { label: "Nuevo",       badgeClass: "bg-primary/10 text-primary border border-primary/25",             dotClass: "bg-primary" },
  qualified:  { label: "Cualificado", badgeClass: "bg-sky-50 text-sky-800 border border-sky-200",                    dotClass: "bg-sky-500" },
  contacted:  { label: "Contactado",  badgeClass: "bg-amber-50 text-amber-800 border border-amber-200",              dotClass: "bg-amber-500" },
  duplicate:  { label: "Duplicado",   badgeClass: "bg-destructive/5 text-destructive border border-destructive/25",  dotClass: "bg-destructive" },
  rejected:   { label: "Descartado",  badgeClass: "bg-muted text-muted-foreground border border-border",             dotClass: "bg-muted-foreground" },
  converted:  { label: "Convertido",  badgeClass: "bg-emerald-50 text-emerald-800 border border-emerald-200",        dotClass: "bg-emerald-500" },
};

/* ═══════════════════════════════════════════════════════════════════
   MOCK · sustituir por `GET /api/leads`
   ═══════════════════════════════════════════════════════════════════ */

/** Helper: resta N días/horas al momento actual en ISO. */
const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();

export const leads: Lead[] = [
  {
    id: "lead-1",
    fullName: "Ivan Petrov",
    email: "ivan.petrov@example.com",
    phone: "+34 612 345 678",
    nationality: "RU",
    idioma: "RU",
    source: "idealista",
    status: "new",
    interest: {
      promotionId: "dev-1",
      promotionName: "Villa Serena",
      tipologia: "Villa",
      dormitorios: "4+",
      presupuestoMax: 1800000,
      zona: "Marbella",
    },
    createdAt: hoursAgo(0.5),
    message: "Buenos días, me interesa visitar la villa. ¿Qué disponibilidad tienen para esta semana?",
    tags: ["premium", "cash-buyer"],
  },
  {
    id: "lead-2",
    fullName: "Marie Dubois",
    email: "marie.dubois@mail.fr",
    phone: "+33 6 12 34 56 78",
    nationality: "FR",
    idioma: "FR",
    source: "fotocasa",
    status: "new",
    interest: {
      promotionId: "dev-4",
      promotionName: "Terrazas del Golf",
      tipologia: "Apartamento",
      dormitorios: "2-3",
      presupuestoMax: 450000,
      zona: "Mijas",
    },
    createdAt: hoursAgo(2),
  },
  {
    id: "lead-3",
    fullName: "Lars Andersson",
    email: "lars.andersson@nordicmail.se",
    phone: "+46 70 123 45 67",
    nationality: "SE",
    idioma: "EN",
    source: "microsite",
    status: "qualified",
    interest: {
      promotionId: "dev-5",
      promotionName: "Mar Azul Residences",
      tipologia: "Apartamento",
      dormitorios: "2",
      presupuestoMax: 320000,
      zona: "Torrevieja",
    },
    createdAt: hoursAgo(5),
    assignedTo: { name: "Laura Sánchez", email: "laura@mycompany.es" },
    message: "Looking for a 2-bedroom flat near the beach for summer use.",
  },
  {
    id: "lead-4",
    fullName: "Klaus Hoffmann",
    email: "klaus.hoffmann@domain.de",
    phone: "+49 171 234 56 78",
    nationality: "DE",
    idioma: "DE",
    source: "idealista",
    status: "contacted",
    interest: {
      promotionId: "dev-3",
      promotionName: "Residencial Aurora",
      tipologia: "Ático",
      dormitorios: "3",
      presupuestoMax: 680000,
      zona: "Benalmádena",
    },
    createdAt: hoursAgo(18),
    firstResponseAt: hoursAgo(16),
    assignedTo: { name: "Pedro Sánchez", email: "pedro@mycompany.es" },
    tags: ["visita-agendada"],
  },
  {
    id: "lead-5",
    fullName: "Emma Johnson",
    email: "emma.johnson@ukmail.co.uk",
    phone: "+44 7700 900123",
    nationality: "GB",
    idioma: "EN",
    source: "agency",
    status: "new",
    interest: {
      promotionId: "dev-1",
      promotionName: "Villa Serena",
      tipologia: "Villa",
      dormitorios: "4+",
      presupuestoMax: 1500000,
      zona: "Marbella",
    },
    createdAt: hoursAgo(26),
    tags: ["referido-agencia"],
  },
  {
    id: "lead-6",
    fullName: "Peter van der Berg",
    email: "peter.vdberg@example.nl",
    phone: "+31 6 1234 5678",
    nationality: "NL",
    idioma: "EN",
    source: "habitaclia",
    status: "duplicate",
    interest: {
      promotionId: "dev-2",
      promotionName: "Villas del Pinar",
      tipologia: "Villa",
      dormitorios: "3",
      presupuestoMax: 550000,
      zona: "Jávea",
    },
    createdAt: hoursAgo(30),
    duplicateScore: 92,
    duplicateOfContactId: "contact-existing-1",
  },
  {
    id: "lead-7",
    fullName: "Sofia Rossi",
    email: "sofia.rossi@mail.it",
    phone: "+39 333 123 4567",
    nationality: "IT",
    idioma: "IT",
    source: "microsite",
    status: "new",
    interest: {
      promotionId: "dev-3",
      promotionName: "Residencial Aurora",
      tipologia: "Apartamento",
      dormitorios: "2",
      presupuestoMax: 380000,
      zona: "Benalmádena",
    },
    createdAt: hoursAgo(32),
  },
  {
    id: "lead-8",
    fullName: "Olivier Moreau",
    email: "olivier.moreau@mail.fr",
    phone: "+33 6 87 65 43 21",
    nationality: "FR",
    idioma: "FR",
    source: "referral",
    status: "converted",
    interest: {
      promotionId: "dev-4",
      promotionName: "Terrazas del Golf",
      tipologia: "Apartamento",
      dormitorios: "3",
      presupuestoMax: 520000,
      zona: "Mijas",
    },
    createdAt: hoursAgo(48),
    firstResponseAt: hoursAgo(47),
    assignedTo: { name: "Laura Sánchez", email: "laura@mycompany.es" },
  },
  {
    id: "lead-9",
    fullName: "Anna Schmidt",
    email: "anna.schmidt@domain.de",
    phone: "+49 151 111 22 33",
    nationality: "DE",
    idioma: "DE",
    source: "whatsapp",
    status: "new",
    interest: {
      promotionId: "dev-1",
      promotionName: "Villa Serena",
      tipologia: "Villa",
      dormitorios: "4+",
      presupuestoMax: 1950000,
      zona: "Marbella",
    },
    createdAt: hoursAgo(3),
    message: "Hallo, ist die Villa noch verfügbar? Können wir telefonieren?",
    tags: ["urgente"],
  },
  {
    id: "lead-10",
    fullName: "Michael Brown",
    email: "michael.brown@example.com",
    phone: "+1 305 555 0199",
    nationality: "US",
    idioma: "EN",
    source: "walkin",
    status: "qualified",
    interest: {
      promotionId: "dev-1",
      promotionName: "Villa Serena",
      tipologia: "Villa",
      dormitorios: "5",
      presupuestoMax: 2500000,
      zona: "Marbella",
    },
    createdAt: hoursAgo(70),
    firstResponseAt: hoursAgo(68),
    assignedTo: { name: "Ana Martín", email: "ana@mycompany.es" },
    tags: ["premium", "visita-realizada"],
  },
  {
    id: "lead-11",
    fullName: "Yuki Tanaka",
    email: "yuki.tanaka@example.jp",
    phone: "+81 90 1234 5678",
    nationality: "JP",
    idioma: "EN",
    source: "microsite",
    status: "rejected",
    interest: {
      promotionId: "dev-5",
      promotionName: "Mar Azul Residences",
      tipologia: "Apartamento",
      dormitorios: "1",
      presupuestoMax: 120000,
      zona: "Torrevieja",
    },
    createdAt: hoursAgo(72),
  },
  {
    id: "lead-12",
    fullName: "Erik Nielsen",
    email: "erik.nielsen@example.no",
    phone: "+47 912 34 567",
    nationality: "NO",
    idioma: "EN",
    source: "idealista",
    status: "new",
    interest: {
      promotionId: "dev-5",
      promotionName: "Mar Azul Residences",
      tipologia: "Apartamento",
      dormitorios: "2",
      presupuestoMax: 280000,
      zona: "Torrevieja",
    },
    createdAt: hoursAgo(4),
  },
];
