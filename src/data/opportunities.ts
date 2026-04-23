/**
 * Oportunidades · contactos comercialmente activos en pipeline de venta.
 *
 * Ciclo producto:
 *   Lead (crudo)  →  Oportunidad (cualificada, con interés estructurado)  →  Ganada/Perdida
 *
 * La oportunidad es la unidad comercial viva del sistema: contiene el
 * interés del cliente, las propiedades/promociones que se le muestran,
 * los registros (alta ante el promotor vía agencia) asociados y toda
 * la actividad (emails, visitas, comentarios, cambios de etapa).
 *
 * Diferencia con `Lead` (`src/data/leads.ts`):
 *   - Lead = input bruto de un portal/web. Foco: cualificar.
 *   - Oportunidad = cliente ya cualificado. Foco: conversión comercial.
 *
 * Diferencia con `ContactOpportunityEntry`
 * (`src/components/contacts/types.ts`):
 *   - `ContactOpportunityEntry` es el resumen **embedido** en la ficha
 *     de contacto (tab Operaciones).
 *   - Este `Opportunity` es la entidad comercial **standalone**: tiene
 *     su propia pantalla `/oportunidades/:id`, pipeline, registros y
 *     timeline. El `contactId` la liga al contacto canónico.
 *
 * TODO(backend): `GET /api/opportunities` con filtros + paginación y
 *   `GET /api/opportunities/:id`. Cada mutación (cambio de etapa,
 *   nuevo registro, email enviado) emite evento en el timeline de la
 *   oportunidad **y** en el historial del contacto (regla de oro
 *   `CLAUDE.md §🥇 Historial del contacto`). Ver
 *   `docs/backend-integration.md §7.3 Oportunidades`.
 */

/* ══════ Enums + tipos ══════════════════════════════════════════════ */

/** Pipeline fijo para V1 · la customización queda fuera de alcance. */
export type OpportunityStage =
  | "interes"
  | "visita"
  | "evaluacion"
  | "negociacion"
  | "ganada"
  | "perdida";

export type OpportunityTemperature = "caliente" | "tibio" | "frio";

export type OpportunitySource =
  | "lead"       // convertida desde un lead
  | "direct"     // creada directamente (setting "Direct to Opportunity")
  | "referral"   // recomendación de otro cliente
  | "agency"     // la abrió una agencia colaboradora
  | "walkin"     // entró por oficina / evento
  | "call";      // llamada directa

/** Registro (alta del cliente ante el promotor vía agencia) asociado
 *  a la oportunidad. Una oportunidad puede tener 0..N registros (un
 *  cliente puede ser registrado en varias promociones). */
export type OpportunityRegistration = {
  id: string;
  promotionId: string;
  promotionName: string;
  /** Agencia que registra al cliente · null si lo registra el promotor. */
  agencyName?: string;
  /** Agente concreto (miembro TEAM_MEMBERS) que lo registra. */
  agentUserId?: string;
  agentName: string;
  createdAt: string;             // ISO
  status: "pendiente" | "aceptado" | "rechazado" | "cancelado";
  note?: string;                 // razón del rechazo, observación libre
  /** Si ya se evaluó, cuándo + quién. */
  decidedAt?: string;
  decidedByName?: string;
};

/** Intereses estructurados del cliente — lo que la oportunidad busca. */
export type OpportunityInterest = {
  propertyType?: string;         // "Villa", "Ático", "Apartamento"…
  area?: string;                 // "Marbella · Nueva Andalucía"
  budgetMin?: number;            // EUR
  budgetMax?: number;            // EUR
  bedrooms?: string;             // "2-3", "3+", "5"
  /** Extras libres ("piscina", "vistas al mar", "planta baja con jardín"). */
  extras?: string[];
  /** Promoción/propiedad que disparó el interés (si venía de un lead
   *  con referencia). Pre-llena el bloque al convertir. */
  originPromotionId?: string;
  originPromotionName?: string;
  originPropertyRef?: string;
};

/** Sugerencia de matching (promoción o propiedad concreta). */
export type OpportunityMatch = {
  id: string;
  kind: "promotion" | "property";
  /** Referencia a Promotion (kind=promotion) o Unit (kind=property). */
  refId: string;
  name: string;
  location?: string;
  priceFrom?: number;            // EUR · "desde X" si es promoción
  priceExact?: number;           // EUR · para una unidad concreta
  image?: string;
  /** Motivo corto (lo genera la IA o lo escribe el comercial). */
  reason: string;
  /** Nivel de match (0-100) para ordenar. */
  score?: number;
};

export type OpportunityTimelineEventType =
  | "lead-received"
  | "opportunity-created"
  | "stage-changed"
  | "interest-updated"
  | "email-sent"
  | "email-opened"
  | "email-bounced"
  | "email-replied"
  | "property-sent"
  | "promotion-sent"
  | "comment-added"
  | "registration-created"
  | "registration-accepted"
  | "registration-rejected"
  | "visit-scheduled"
  | "visit-completed"
  | "assignee-changed"
  | "won"
  | "lost";

export type OpportunityTimelineEvent = {
  id: string;
  type: OpportunityTimelineEventType;
  occurredAt: string;            // ISO
  /** Autor de la acción (si aplica). */
  byName?: string;
  /** Texto ya renderizable para la UI. */
  title: string;
  description?: string;
  /** Referencias opcionales para el click-through ("ir al email", etc.). */
  refId?: string;
};

export type OpportunityComment = {
  id: string;
  authorName: string;
  authorEmail?: string;
  createdAt: string;             // ISO
  body: string;
};

export type OpportunityEmailEvent = {
  id: string;
  direction: "sent" | "received";
  subject: string;
  at: string;                    // ISO
  /** Estado de entrega/apertura (solo `sent`). */
  status?: "delivered" | "opened" | "bounced" | "replied";
  fromName?: string;
  fromEmail?: string;
  snippet?: string;
};

export type Opportunity = {
  id: string;
  /** Contacto canónico (persona) al que pertenece esta oportunidad. */
  contactId: string;
  fullName: string;
  nationality?: string;          // ISO2
  stage: OpportunityStage;
  temperature: OpportunityTemperature;
  source: OpportunitySource;
  /** Si vino de un lead, la referencia al lead original. */
  sourceLeadId?: string;
  /** Miembro del equipo (TEAM_MEMBERS) asignado. */
  assigneeUserId?: string;
  /** Snapshot del nombre del asignado (fallback para agentes externos o
   *  miembros desactivados · misma regla que `ContactOpportunityEntry`). */
  assigneeName?: string;
  createdAt: string;             // ISO
  /** ISO de la última actividad para ordenar el listado. */
  lastActivityAt: string;
  interest: OpportunityInterest;
  /** Sugerencias de matching · se cargan por separado en producción. */
  matches?: OpportunityMatch[];
  /** Registros asociados (0..N) · el listado muestra "Registro pendiente"
   *  si alguno está en `pendiente`. */
  registrations: OpportunityRegistration[];
  /** Eventos de timeline (append-only en producción). */
  timeline: OpportunityTimelineEvent[];
  /** Comentarios internos. */
  comments: OpportunityComment[];
  /** Últimos eventos de email (resumen · la tab completa vive en el
   *  contacto). */
  emails: OpportunityEmailEvent[];
  /** Tags libres. */
  tags?: string[];
  /** Motivo de pérdida (solo si stage === "perdida"). */
  lostReason?: string;
};

/* ══════ Helpers de UI ══════════════════════════════════════════════ */

export const opportunityStageConfig: Record<
  OpportunityStage,
  { label: string; order: number; badgeClass: string; dotClass: string }
> = {
  interes:     { label: "Interés",     order: 1, badgeClass: "bg-primary/10 text-primary border border-primary/25",             dotClass: "bg-primary" },
  visita:      { label: "Visita",      order: 2, badgeClass: "bg-sky-50 text-sky-800 border border-sky-200",                    dotClass: "bg-sky-500" },
  evaluacion:  { label: "Evaluación",  order: 3, badgeClass: "bg-indigo-50 text-indigo-800 border border-indigo-200",           dotClass: "bg-indigo-500" },
  negociacion: { label: "Negociación", order: 4, badgeClass: "bg-warning/10 text-warning border border-warning/25",             dotClass: "bg-warning" },
  ganada:      { label: "Ganada",      order: 5, badgeClass: "bg-success/10 text-success border border-success/25",             dotClass: "bg-success" },
  perdida:     { label: "Perdida",     order: 6, badgeClass: "bg-muted text-muted-foreground border border-border",             dotClass: "bg-muted-foreground" },
};

export const temperatureConfig: Record<
  OpportunityTemperature,
  { label: string; badgeClass: string; emoji: string }
> = {
  caliente: { label: "Caliente", badgeClass: "bg-destructive/10 text-destructive border border-destructive/25", emoji: "🔥" },
  tibio:    { label: "Tibio",    badgeClass: "bg-warning/10 text-warning border border-warning/25",             emoji: "🌤" },
  frio:     { label: "Frío",     badgeClass: "bg-sky-50 text-sky-800 border border-sky-200",                    emoji: "❄️" },
};

export const opportunitySourceLabel: Record<OpportunitySource, string> = {
  lead:     "Lead convertido",
  direct:   "Alta directa",
  referral: "Referido",
  agency:   "Agencia",
  walkin:   "Visita oficina",
  call:     "Llamada",
};

export const registrationStatusConfig: Record<
  OpportunityRegistration["status"],
  { label: string; badgeClass: string }
> = {
  pendiente: { label: "Pendiente", badgeClass: "bg-warning/10 text-warning border border-warning/25" },
  aceptado:  { label: "Aceptado",  badgeClass: "bg-success/10 text-success border border-success/25" },
  rechazado: { label: "Rechazado", badgeClass: "bg-destructive/5 text-destructive border border-destructive/25" },
  cancelado: { label: "Cancelado", badgeClass: "bg-muted text-muted-foreground border border-border" },
};

/** Devuelve true si la oportunidad tiene al menos un registro en `pendiente`. */
export function hasPendingRegistration(o: Opportunity): boolean {
  return o.registrations.some((r) => r.status === "pendiente");
}

/** Devuelve la etapa siguiente en el pipeline (null si ganada/perdida). */
export function nextStage(s: OpportunityStage): OpportunityStage | null {
  const pipeline: OpportunityStage[] = ["interes", "visita", "evaluacion", "negociacion", "ganada"];
  const i = pipeline.indexOf(s);
  if (i < 0 || i === pipeline.length - 1) return null;
  return pipeline[i + 1];
}

/* ══════ MOCK · estados realistas variados ═══════════════════════════
   Cubrimos los states pedidos por el spec:
   · con registro pendiente · con registro aceptado · sin registros
   · con matching · sin matching · en visita · en negociación
   · sin actividad reciente · oportunidad caliente / fría
   ══════════════════════════════════════════════════════════════════ */

const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString();
const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();

export const opportunities: Opportunity[] = [
  /* ─── O-1 · NEGOCIACIÓN con registro PENDIENTE · caliente ─── */
  {
    id: "opp-1",
    contactId: "ahmed-al-rashid",
    fullName: "Ahmed Al Rashid",
    nationality: "AE",
    stage: "negociacion",
    temperature: "caliente",
    source: "lead",
    sourceLeadId: "lead-1",
    assigneeUserId: "u1",
    assigneeName: "Arman Yeghiazaryan",
    createdAt: daysAgo(12),
    lastActivityAt: hoursAgo(3),
    interest: {
      propertyType: "Villa",
      area: "Marbella · Nueva Andalucía",
      budgetMin: 1500000,
      budgetMax: 2200000,
      bedrooms: "4+",
      extras: ["piscina", "vistas al mar", "garaje 2 coches"],
      originPromotionId: "dev-1",
      originPromotionName: "Villa Serena",
    },
    matches: [
      {
        id: "m-1", kind: "promotion", refId: "dev-1",
        name: "Villa Serena", location: "Marbella",
        priceFrom: 1800000, score: 94,
        reason: "Coincide tipología, presupuesto y zona declarada",
      },
      {
        id: "m-2", kind: "property", refId: "unit-9",
        name: "Villa Serena · Villa 09", location: "Marbella",
        priceExact: 1950000, score: 88,
        reason: "Última villa disponible con piscina privada",
      },
    ],
    registrations: [
      {
        id: "reg-1", promotionId: "dev-1", promotionName: "Villa Serena",
        agencyName: "Prime Properties", agentUserId: "laura-sanchez", agentName: "Laura Sánchez",
        createdAt: daysAgo(2), status: "pendiente",
        note: "Cliente con preaprobación bancaria · revisar antes de fin de semana.",
      },
    ],
    timeline: [
      { id: "ev-1", type: "lead-received", occurredAt: daysAgo(12), title: "Lead recibido", description: "Idealista · Villa Serena" },
      { id: "ev-2", type: "opportunity-created", occurredAt: daysAgo(11), title: "Oportunidad creada", byName: "Arman Yeghiazaryan" },
      { id: "ev-3", type: "email-sent", occurredAt: daysAgo(10), title: "Email enviado", description: "Presentación · Villa Serena" },
      { id: "ev-4", type: "email-opened", occurredAt: daysAgo(10), title: "Email abierto" },
      { id: "ev-5", type: "visit-scheduled", occurredAt: daysAgo(8), title: "Visita programada", description: "Villa Serena · Vivienda 9" },
      { id: "ev-6", type: "visit-completed", occurredAt: daysAgo(6), title: "Visita realizada", description: "Interesado · pide info financiación" },
      { id: "ev-7", type: "stage-changed", occurredAt: daysAgo(5), title: "Etapa → Negociación", byName: "Arman Yeghiazaryan" },
      { id: "ev-8", type: "registration-created", occurredAt: daysAgo(2), title: "Registro creado", description: "Prime Properties · Villa Serena" },
      { id: "ev-9", type: "comment-added", occurredAt: hoursAgo(3), title: "Comentario", byName: "Arman Yeghiazaryan", description: "Cliente confirma visita a escritura." },
    ],
    comments: [
      { id: "c-1", authorName: "Arman Yeghiazaryan", authorEmail: "arman@luxinmo.com", createdAt: hoursAgo(3),
        body: "Cliente confirma que quiere cerrar antes de fin de mes. Pedí documentación bancaria y una prueba de fondos." },
      { id: "c-2", authorName: "Laura Sánchez", authorEmail: "laura@primeproperties.com", createdAt: daysAgo(2),
        body: "Registro creado. Acompaño al cliente a la visita de escritura el viernes." },
    ],
    emails: [
      { id: "em-1", direction: "sent", subject: "Presentación · Villa Serena",     at: daysAgo(10), status: "opened",   fromName: "Arman", fromEmail: "arman@luxinmo.com" },
      { id: "em-2", direction: "received", subject: "Re: Presentación",             at: daysAgo(9),  fromName: "Ahmed",  fromEmail: "ahmed@example.ae" },
      { id: "em-3", direction: "sent", subject: "Dossier financiación",             at: daysAgo(4),  status: "delivered", fromName: "Arman", fromEmail: "arman@luxinmo.com" },
    ],
    tags: ["premium", "cash-buyer"],
  },

  /* ─── O-2 · VISITA · temperatura tibia · sin registros ─── */
  {
    id: "opp-2",
    contactId: "marie-dubois",
    fullName: "Marie Dubois",
    nationality: "FR",
    stage: "visita",
    temperature: "tibio",
    source: "lead",
    sourceLeadId: "lead-2",
    assigneeUserId: "u2",
    assigneeName: "Laura Sánchez",
    createdAt: daysAgo(8),
    lastActivityAt: daysAgo(1),
    interest: {
      propertyType: "Apartamento",
      area: "Costa del Sol · Mijas",
      budgetMin: 300000,
      budgetMax: 500000,
      bedrooms: "2-3",
      extras: ["terraza", "cerca playa"],
      originPromotionId: "dev-4",
      originPromotionName: "Terrazas del Golf",
    },
    matches: [
      {
        id: "m-3", kind: "promotion", refId: "dev-4",
        name: "Terrazas del Golf", location: "Mijas",
        priceFrom: 390000, score: 91,
        reason: "Coincide tipología y zona declarada, presupuesto encaja",
      },
      {
        id: "m-4", kind: "promotion", refId: "dev-3",
        name: "Residencial Aurora", location: "Benalmádena",
        priceFrom: 420000, score: 72,
        reason: "Alternativa cercana con mejor vista al mar",
      },
    ],
    registrations: [],
    timeline: [
      { id: "ev-10", type: "lead-received",          occurredAt: daysAgo(8), title: "Lead recibido", description: "Fotocasa · Terrazas del Golf" },
      { id: "ev-11", type: "opportunity-created",    occurredAt: daysAgo(7), title: "Oportunidad creada" },
      { id: "ev-12", type: "email-sent",             occurredAt: daysAgo(7), title: "Email enviado", description: "Bienvenida + dossier" },
      { id: "ev-13", type: "email-opened",           occurredAt: daysAgo(6), title: "Email abierto" },
      { id: "ev-14", type: "visit-scheduled",        occurredAt: daysAgo(3), title: "Visita programada", description: "Terrazas del Golf · Apt 204" },
      { id: "ev-15", type: "stage-changed",          occurredAt: daysAgo(3), title: "Etapa → Visita" },
      { id: "ev-16", type: "comment-added",          occurredAt: daysAgo(1), title: "Comentario" },
    ],
    comments: [
      { id: "c-3", authorName: "Laura Sánchez", createdAt: daysAgo(1),
        body: "Llamada breve · pidió que le enviemos planos del Apt 204 antes de la visita." },
    ],
    emails: [
      { id: "em-4", direction: "sent", subject: "Bienvenida · Terrazas del Golf", at: daysAgo(7), status: "opened", fromName: "Laura", fromEmail: "laura@mycompany.es" },
    ],
  },

  /* ─── O-3 · EVALUACIÓN · registro ACEPTADO ─── */
  {
    id: "opp-3",
    contactId: "lars-andersson",
    fullName: "Lars Andersson",
    nationality: "SE",
    stage: "evaluacion",
    temperature: "caliente",
    source: "lead",
    sourceLeadId: "lead-3",
    assigneeUserId: "u2",
    assigneeName: "Laura Sánchez",
    createdAt: daysAgo(20),
    lastActivityAt: daysAgo(2),
    interest: {
      propertyType: "Apartamento",
      area: "Torrevieja",
      budgetMin: 280000,
      budgetMax: 350000,
      bedrooms: "2",
      extras: ["cerca playa", "piscina comunitaria"],
      originPromotionId: "dev-5",
      originPromotionName: "Mar Azul Residences",
    },
    matches: [],
    registrations: [
      {
        id: "reg-2", promotionId: "dev-5", promotionName: "Mar Azul Residences",
        agencyName: "Nordic Real Estate", agentUserId: "u3", agentName: "Pedro Sánchez",
        createdAt: daysAgo(10), status: "aceptado",
        decidedAt: daysAgo(9), decidedByName: "Arman Yeghiazaryan",
      },
    ],
    timeline: [
      { id: "ev-20", type: "opportunity-created",    occurredAt: daysAgo(20), title: "Oportunidad creada" },
      { id: "ev-21", type: "registration-created",   occurredAt: daysAgo(10), title: "Registro creado", description: "Nordic Real Estate · Mar Azul" },
      { id: "ev-22", type: "registration-accepted",  occurredAt: daysAgo(9),  title: "Registro aceptado", byName: "Arman Yeghiazaryan" },
      { id: "ev-23", type: "visit-completed",        occurredAt: daysAgo(4),  title: "Visita realizada" },
      { id: "ev-24", type: "stage-changed",          occurredAt: daysAgo(2),  title: "Etapa → Evaluación" },
    ],
    comments: [],
    emails: [
      { id: "em-5", direction: "sent", subject: "Mar Azul · propuesta", at: daysAgo(8), status: "replied", fromName: "Laura" },
    ],
    tags: ["visita-realizada"],
  },

  /* ─── O-4 · INTERÉS · temperatura fría · SIN matching ─── */
  {
    id: "opp-4",
    contactId: "klaus-hoffmann",
    fullName: "Klaus Hoffmann",
    nationality: "DE",
    stage: "interes",
    temperature: "frio",
    source: "direct",
    assigneeUserId: "u3",
    assigneeName: "Pedro Sánchez",
    createdAt: daysAgo(45),
    lastActivityAt: daysAgo(14),
    interest: {
      propertyType: "Ático",
      area: "Benalmádena",
      budgetMin: 500000,
      budgetMax: 750000,
      bedrooms: "3",
    },
    matches: [],
    registrations: [],
    timeline: [
      { id: "ev-30", type: "opportunity-created", occurredAt: daysAgo(45), title: "Oportunidad creada directa" },
      { id: "ev-31", type: "email-sent",          occurredAt: daysAgo(40), title: "Email enviado", description: "Presentación portfolio" },
      { id: "ev-32", type: "email-bounced",       occurredAt: daysAgo(40), title: "Email rebotado", description: "klaus.hoffmann@domain.de · 550 recipient rejected" },
      { id: "ev-33", type: "comment-added",       occurredAt: daysAgo(14), title: "Comentario" },
    ],
    comments: [
      { id: "c-4", authorName: "Pedro Sánchez", createdAt: daysAgo(14),
        body: "Email rebotado · probar con teléfono (pendiente)." },
    ],
    emails: [
      { id: "em-6", direction: "sent", subject: "Presentación portfolio", at: daysAgo(40), status: "bounced", fromName: "Pedro" },
    ],
    tags: ["sin-respuesta"],
  },

  /* ─── O-5 · GANADA ─── */
  {
    id: "opp-5",
    contactId: "olivier-moreau",
    fullName: "Olivier Moreau",
    nationality: "FR",
    stage: "ganada",
    temperature: "caliente",
    source: "referral",
    assigneeUserId: "u2",
    assigneeName: "Laura Sánchez",
    createdAt: daysAgo(90),
    lastActivityAt: daysAgo(4),
    interest: {
      propertyType: "Apartamento",
      area: "Mijas",
      budgetMin: 450000,
      budgetMax: 600000,
      bedrooms: "3",
      originPromotionId: "dev-4",
      originPromotionName: "Terrazas del Golf",
    },
    matches: [],
    registrations: [
      {
        id: "reg-3", promotionId: "dev-4", promotionName: "Terrazas del Golf",
        agencyName: "Prime Properties", agentUserId: "u2", agentName: "Laura Sánchez",
        createdAt: daysAgo(75), status: "aceptado",
        decidedAt: daysAgo(74), decidedByName: "Arman Yeghiazaryan",
      },
    ],
    timeline: [
      { id: "ev-40", type: "opportunity-created", occurredAt: daysAgo(90), title: "Oportunidad creada" },
      { id: "ev-41", type: "registration-accepted", occurredAt: daysAgo(74), title: "Registro aceptado" },
      { id: "ev-42", type: "visit-completed",     occurredAt: daysAgo(60), title: "Visita realizada" },
      { id: "ev-43", type: "stage-changed",       occurredAt: daysAgo(30), title: "Etapa → Negociación" },
      { id: "ev-44", type: "won",                 occurredAt: daysAgo(4),  title: "Oportunidad ganada", description: "Reserva firmada · Apt 204" },
    ],
    comments: [],
    emails: [],
    tags: ["escritura-firmada"],
  },

  /* ─── O-6 · INTERÉS · fresco, recién convertido desde lead ─── */
  {
    id: "opp-6",
    contactId: "emma-johnson",
    fullName: "Emma Johnson",
    nationality: "GB",
    stage: "interes",
    temperature: "tibio",
    source: "lead",
    sourceLeadId: "lead-5",
    assigneeUserId: "u1",
    assigneeName: "Arman Yeghiazaryan",
    createdAt: hoursAgo(20),
    lastActivityAt: hoursAgo(4),
    interest: {
      propertyType: "Villa",
      area: "Marbella",
      budgetMin: 1200000,
      budgetMax: 1500000,
      bedrooms: "4+",
      originPromotionId: "dev-1",
      originPromotionName: "Villa Serena",
    },
    matches: [
      {
        id: "m-5", kind: "promotion", refId: "dev-1",
        name: "Villa Serena", location: "Marbella",
        priceFrom: 1800000, score: 80,
        reason: "Match alto de tipología y zona · presupuesto algo por debajo",
      },
    ],
    registrations: [],
    timeline: [
      { id: "ev-50", type: "lead-received",       occurredAt: hoursAgo(26), title: "Lead recibido", description: "Agencia · Prime Properties" },
      { id: "ev-51", type: "opportunity-created", occurredAt: hoursAgo(20), title: "Oportunidad creada desde lead" },
      { id: "ev-52", type: "email-sent",          occurredAt: hoursAgo(19), title: "Email enviado", description: "Bienvenida" },
      { id: "ev-53", type: "email-opened",        occurredAt: hoursAgo(4),  title: "Email abierto" },
    ],
    comments: [],
    emails: [
      { id: "em-7", direction: "sent", subject: "Bienvenida · Byvaro Luxinmo", at: hoursAgo(19), status: "opened", fromName: "Arman" },
    ],
  },

  /* ─── O-7 · PERDIDA ─── */
  {
    id: "opp-7",
    contactId: "yuki-tanaka",
    fullName: "Yuki Tanaka",
    nationality: "JP",
    stage: "perdida",
    temperature: "frio",
    source: "lead",
    sourceLeadId: "lead-11",
    assigneeUserId: "u3",
    assigneeName: "Pedro Sánchez",
    createdAt: daysAgo(60),
    lastActivityAt: daysAgo(55),
    interest: {
      propertyType: "Apartamento",
      area: "Torrevieja",
      budgetMin: 100000,
      budgetMax: 130000,
      bedrooms: "1",
    },
    matches: [],
    registrations: [],
    timeline: [
      { id: "ev-60", type: "opportunity-created", occurredAt: daysAgo(60), title: "Oportunidad creada" },
      { id: "ev-61", type: "lost",                occurredAt: daysAgo(55), title: "Oportunidad perdida", description: "Presupuesto no alcanza el mercado" },
    ],
    comments: [],
    emails: [],
    lostReason: "Presupuesto por debajo del mínimo de mercado",
  },
];

/** Lookup por id (para el detalle). */
export function findOpportunity(id: string): Opportunity | undefined {
  return opportunities.find((o) => o.id === id);
}
