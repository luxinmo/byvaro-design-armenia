/**
 * Contacts types — CRM del promotor.
 *
 * Cada Contact representa una persona única en la base de datos del
 * promotor (cliente final, lead, prospecto). NO hay distinción
 * Promotor/Agencia — los contactos son siempre del usuario que está
 * en el sistema.
 *
 * Portado desde figgy-friend-forge · ARCHITECTURE_CONTACTS.md y
 * adaptado a un único modelo (sin agencyMode).
 */

/**
 * Tipo de canal por el que entra un contacto.
 *
 * NOTA importante: un colaborador (agencia que te trae clientes) NO
 * es un origen — esa información se guarda aparte en el campo
 * `referredBy` o en la asignación. El origen describe el CANAL técnico
 * por el que el contacto llegó al CRM.
 */
export type ContactSourceType =
  | "registration" // vino de un registro de visita
  | "portal" // Idealista, Fotocasa, etc.
  | "direct" // formulario web propio o entrada directa
  | "import"; // importado de Excel/CSV

/**
 * Actividad agregada por party · una entrada por organización (agencia,
 * developer, owner) que ha tenido algún touchpoint con el cliente.
 * Phase 2 · habilita la regla "atribución débil tras 45 días sin
 * actividad". Ver `docs/registration-generic-model.md §3`.
 *
 * El array es append-once por party · si una org toca al cliente
 * varias veces, se ACTUALIZA su entry (no se duplica).
 */
export type PartyActivity = {
  partyId: string;          // organizationId
  partyKind: "developer" | "agency" | "owner";
  partyLabel: string;       // cacheado para UI
  lastActivityAt: string;   // ISO
  lastActivityType: ContactTimelineEventType;
  /** Total de eventos relevantes con esta party. */
  activityCount: number;
  /** Primera vez que esta party tocó al cliente. */
  firstActivityAt: string;
};

/**
 * Origen acumulativo de un Contact · cada vez que el contacto vuelve
 * por un canal nuevo (portal, microsite, agencia…) se añade un entry
 * a `Contact.origins[]`. NUNCA se sobrescribe.
 *
 * Ver `docs/contact-origins-audit.md`.
 */
export type ContactOrigin = {
  /** Canal normalizado · alineado con LeadSource. Mantengo string para
   *  no acoplar este modelo al import circular del enum LeadSource. */
  source:
    | "idealista" | "fotocasa" | "habitaclia"
    | "microsite" | "referral" | "agency"
    | "whatsapp" | "walkin" | "call"
    | "registration" | "import" | "direct";
  /** Etiqueta humana visible en UI · "Idealista", "Agencia Norte", etc. */
  label: string;
  /** ISO timestamp del momento exacto. */
  occurredAt: string;
  /** Promoción asociada si aplica (ej. lead específico de Promo A). */
  promotionId?: string;
  /** Agencia asociada si vino vía colaborador. */
  agencyId?: string;
  /** Id del Registro/Lead/event que disparó este origen · trazabilidad. */
  refId?: string;
  refType?: "registro" | "lead" | "web_activity" | "import" | "manual";
  /** Notas opcionales: campaña, UTM, etc. */
  meta?: Record<string, string | number>;
};

export type ContactStatus =
  /** Activo: con interacciones recientes o visitas próximas. */
  | "active"
  /** Lead pendiente de cualificar. */
  | "pending"
  /** Cliente convertido (compró). */
  | "converted"
  /** Frío: sin actividad en >90 días. */
  | "cold";

export type ContactKind = "individual" | "company";

export type Contact = {
  id: string;
  /** Tipo de cliente. Default "individual" si no está. */
  kind?: ContactKind;
  /** Para empresas: razón social legal (ej. "Inmobiliaria Costa Sol S.L."). */
  companyName?: string;
  /** Para empresas: nombre comercial (el que conoce el cliente, ej. "Costa Sol Living"). */
  tradeName?: string;
  /** Para empresas: NIF/CIF de la empresa. */
  companyTaxId?: string;
  /** @deprecated Usar `publicRef`. Alias derivado durante migración ·
   *  se mantiene 1 release para no romper UI legacy que aún lo lea. */
  reference?: string;
  /** Referencia pública del contacto · formato `coXXXXXX`. Único por
   *  organización · inmutable durante la vida del contacto. Uso
   *  HUMANO (búsqueda, emails, documentos, UI). El UUID `id` sigue
   *  siendo PK técnica. Ver `docs/public-references-audit.md`. */
  publicRef: string;
  name: string;
  nationality?: string; // nombre del país
  email?: string;
  phone?: string;
  /** Tags asignadas (ids de availableTags). */
  tags: string[];
  /** @deprecated Usar `primarySource.label`. Mantengo 1 release. */
  source: string;
  /** @deprecated Usar `primarySource.source`. Mantengo 1 release. */
  sourceType: ContactSourceType;
  /**
   * PRIMER origen del contacto · inmutable tras creación. Reemplaza
   * a `source/sourceType` legacy para queries y UI nuevas.
   * Ver `docs/contact-origins-audit.md`.
   */
  primarySource: ContactOrigin;
  /** ÚLTIMO origen registrado · se actualiza en cada `appendOrigin`. */
  latestSource: ContactOrigin;
  /** Histórico cronológico completo · append-only · NUNCA sobrescribe. */
  origins: ContactOrigin[];
  status: ContactStatus;
  /** @deprecated Texto humano "Hace 2h" derivado de `lastActivityAt`. */
  lastActivity: string;
  /** ISO timestamp de la última actividad relevante con el contacto.
   *  Único punto de mutación: `recordActivity()` en
   *  `src/lib/contactActivity.ts`. NUNCA se retrocede.
   *  Mantenemos como agregado global · `partyActivities[]` per-party
   *  (Phase 2) ofrece detalle. */
  lastActivityAt: string;
  /** Phase 2 · actividad per-party · habilita regla 45d de inactividad.
   *  Append-once por `partyId` · `recordActivityForParty()` actualiza
   *  el entry existente. Ver `docs/registration-generic-model.md §3`. */
  partyActivities?: PartyActivity[];
  /** Fecha de alta legible: "12 mar 2026". */
  firstSeen: string;
  /** Cuántas oportunidades activas tiene (visitas/ofertas en curso). */
  activeOpportunities: number;
  /** Próxima visita programada. */
  hasUpcomingVisit: boolean;
  /** Visita ya completada en algún momento. */
  hasVisitDone: boolean;
  /** Ha visitado el microsite recientemente (web tracking). */
  hasRecentWebActivity: boolean;
  /** Total de registros (formularios + visitas) del contacto. */
  totalRegistrations: number;
  /** Promociones que le interesan (nombres, derivado de records). */
  promotionsOfInterest: string[];
  /** Ids de miembros (TEAM_MEMBERS) asignados al contacto · fuente única.
   *  El nombre/avatar se resuelven en render vía `findTeamMember()`. */
  assignedToUserIds?: string[];
  /** LEGACY · snapshot de nombres cuando no hay userIds (p. ej. datos
   *  pre-migración). Mantenido como fallback para renderizar el listado
   *  y para filtros del menú. TODO: eliminar cuando backend devuelva
   *  siempre `assignedToUserIds`. */
  assignedTo: string[];
  /** Idiomas que habla (códigos ISO o nombres cortos). */
  languages?: string[];
  /** Código ISO 3166-1 alpha-2 del país de nacionalidad (ES, AE, GB…).
   *  Se renderiza con <Flag iso={nationalityIso} /> al lado del nombre
   *  — nunca sustituyendo al avatar. Regla CLAUDE.md §🧱. */
  nationalityIso?: string;
  /** Avatar del contacto (foto subida por el admin). Data URL (JPEG)
   *  vía PhotoCropModal. Si no hay, se usan iniciales. Persistido en
   *  localStorage `byvaro.contact.<id>.avatar.v1`. */
  avatarUrl?: string;
  /** Notas internas cortas — preview en el listado. */
  notes?: string;
  /** Propietario del contacto. Si `ownerAgencyId` está puesto, el
   *  contacto pertenece a una agencia colaboradora (y el promotor NO
   *  lo ve cross-agency). Si falta, pertenece al promotor. Se escribe
   *  al crear el contacto según el accountType del usuario logueado.
   *  TODO(backend): columna `owner_agency_id` + RLS. */
  ownerAgencyId?: string;
};

/* ══════ Tipos para la ficha de contacto (/contactos/:id) ══════
 *
 * `Contact` es el modelo plano que usa el listado. Para la ficha de
 * detalle creamos `ContactDetail = Contact & { ... }` con todo lo que
 * el listado no necesita (timeline, registros, visitas, documentos…).
 * Mantenemos los dos separados para no inflar el listado.
 */

export type ContactPhone = {
  id: string;
  number: string;
  label: "Móvil" | "Casa" | "Trabajo" | "Otro";
  primary?: boolean;
  hasWhatsapp?: boolean;
};

export type ContactEmailAddress = {
  id: string;
  address: string;
  label?: "Personal" | "Trabajo" | "Otro";
  primary?: boolean;
  verified?: boolean;
};

/**
 * Lead / Registro asociado a un contacto.
 *
 * Ciclo de vida (status):
 *   pending   → recién entrado, esperando que el promotor lo apruebe
 *   approved  → aprobado por el promotor, el agente trabaja el cliente
 *   cancelled → no fructificó (cliente perdió interés, no fit, etc.)
 *   converted → se convirtió en operación (`convertedSaleId` la apunta)
 *
 * Lo importante en la ficha del contacto:
 *   · CUÁNDO entró    (`timestamp`)
 *   · DE DÓNDE entró  (`source` = agencia / portal / web / manual)
 *   · PARA QUÉ inmueble (`promotionName` + `unit`)
 *   · A QUIÉN se le asignó (`agent`)
 *   · FINALIDAD       (`status` = cancelled / converted al cerrarse)
 */
export type ContactRecordEntry = {
  id: string;
  promotionId: string;
  promotionName: string;
  unit?: string;
  /** Imagen del inmueble (thumbnail). Resuelta en mock; en producción
   *  vendrá del campo image del Promotion o de la unidad concreta. */
  propertyImage?: string;
  /** Referencia interna del inmueble (ej. MN-4B). */
  propertyRef?: string;
  /** URL del landing del microsite o del portal donde se captó. */
  landingUrl?: string;
  /** Agente asignado al lead (no es siempre el que lo creó). */
  agent: string;
  /** De dónde vino el lead. Mock: nombre de agencia, "Idealista",
   *  "Fotocasa", "Microsite", "Manual"… En producción será un id
   *  estructurado. */
  source: string;
  status: "pending" | "approved" | "cancelled" | "converted";
  /** ISO datetime · cuándo entró el lead. */
  timestamp: string;
  /** Si status === "converted", id de la venta que generó. */
  convertedSaleId?: string;
  /** Si status === "cancelled", motivo. */
  cancelReason?: string;
  blockchainHash?: string;
  agentNote?: string;
};

/**
 * Oportunidad activa sobre un contacto.
 *
 * A diferencia del lead (registro entrante), una oportunidad lleva
 * el detalle del INTERÉS del cliente: tipo de inmueble que busca,
 * zona, presupuesto, dormitorios y tags libres ("Vistas al mar",
 * "Inversión"…). El agente trabaja la oportunidad hasta cerrarla
 * como ganada (genera Venta) o archivarla.
 */
export type ContactOpportunityEntry = {
  id: string;
  /** Promoción concreta que se le está ofreciendo (o que más le encaja). */
  promotionId: string;
  promotionName: string;
  unit?: string;
  propertyImage?: string;
  /** Agencia que abrió la oportunidad (puede ser null si la abre el
   *  promotor en directo). */
  agencyName?: string;
  /** Id del miembro (TEAM_MEMBERS) que trabaja la oportunidad · fuente única.
   *  El nombre se resuelve en render vía `findTeamMember()`. */
  agentUserId?: string;
  /** LEGACY · snapshot del nombre del agente en el momento de crear la
   *  oportunidad. Se mantiene como fallback (agente externo de agencia,
   *  miembro desactivado). */
  agentName: string;
  status: "active" | "won" | "archived";
  createdAt: string;
  /** Intereses declarados/inferidos del cliente. */
  clientInterests?: {
    propertyType?: string;
    area?: string;
    budgetMin?: number;
    budgetMax?: number;
    bedrooms?: string;
  };
  /** Tags libres ("Vistas al mar", "Inversión", "Terraza grande"…). */
  tags?: string[];
};

/**
 * Resumen de la operación activa que se enseña como banner en el tab
 * Operaciones (cuando el contacto tiene una compra en marcha).
 */
export type ContactActiveOperation = {
  id: string;
  title: string;          // "Compra en curso"
  promotionName: string;
  unit?: string;
  price: number;
  deposit: number;
  startDate: string;      // ISO
  /** Estado de display: "in-progress" | "signed" | "delivered"… */
  state: "in-progress";
};

export type VisitOutcome = "completed" | "cancelled" | "rescheduled";

export type VisitEvaluation = {
  /** Qué pasó realmente con la visita.
   *  - completed: se hizo. Pide rating + interés + feedback + fotos.
   *  - cancelled: al final no se hizo. Pide motivo.
   *  - rescheduled: se movió a otra fecha. Pide nueva fecha + motivo. */
  outcome: VisitOutcome;
  /** Solo si outcome=completed. */
  rating?: 1 | 2 | 3 | 4 | 5;
  /** Interés que mostró el cliente (solo completed). */
  clientInterest?: "low" | "medium" | "high";
  /** Comentario del agente o motivo si cancelled/rescheduled. */
  feedback?: string;
  /** Agente que efectivamente realizó la visita (puede diferir del
   *  agente programado originalmente). */
  actualAgent?: string;
  /** Solo si outcome=rescheduled: nueva fecha ISO. */
  rescheduledTo?: string;
  /** ISO datetime cuando se evaluó. */
  evaluatedAt: string;
  /** Nombre del agente que registró la evaluación. */
  evaluatedBy: string;
};

export type ContactVisitEntry = {
  id: string;
  promotionId: string;
  promotionName: string;
  unit?: string;
  agent: string;
  /** ISO datetime. */
  scheduledAt: string;
  status: "scheduled" | "done" | "cancelled" | "noshow";
  notes?: string;
  /** Evaluación post-visita. Una visita "done" SIN evaluation es una
   *  TAREA pendiente del agente — debe aparecer como tal en su feed
   *  de tareas y bloqueada como follow-up. */
  evaluation?: VisitEvaluation;
};

export type ContactDocumentEntry = {
  id: string;
  name: string;
  category: "legal" | "id" | "commercial" | "other";
  /** Bytes. */
  size: number;
  /** ISO datetime. */
  uploadedAt: string;
  uploadedBy: string;
  /** URL de origen del archivo. Puede ser:
   *   - dataURL `data:application/pdf;base64,...` (subido localmente)
   *   - URL relativa `/sample.pdf` (asset público en /public)
   *   - URL absoluta firmada de S3 (en producción)
   *  Si está, se puede previsualizar y descargar. */
  dataUrl?: string;
};

export type ContactCommentEntry = {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  attachments?: { name: string; size: number }[];
  /** ISO datetime. */
  timestamp: string;
  /** Tipo de comentario:
   *   - "user" (default): nota escrita por un agente. Tiene avatar +
   *     menú edit/delete (solo el autor).
   *   - "system": evento automático del sistema (creación, cambio de
   *     estado, etc). No editable, icono diferente, label "Sistema". */
  kind?: "user" | "system";
};

export type ContactTimelineEventType =
  | "lead_entry"
  | "contact_created" | "contact_edited" | "contact_deleted"
  | "assignee_added" | "assignee_removed"
  | "relation_linked" | "relation_unlinked"
  | "tag_added" | "tag_removed"
  | "status_changed"
  | "visit_scheduled" | "visit_done" | "visit_cancelled" | "visit_evaluated"
  | "email_sent" | "email_received" | "email_delivered" | "email_opened"
  | "whatsapp_sent" | "whatsapp_received"
  | "call"
  | "comment"
  | "registration"
  | "web_activity"
  | "document_uploaded" | "document_deleted"
  | "system_change";

/** Categorías para los sub-tabs del Historial. */
export type TimelineCategory = "all" | "comments" | "emails" | "whatsapp" | "web" | "system";

export const EVENT_CATEGORY: Record<ContactTimelineEventType, TimelineCategory> = {
  lead_entry: "system",
  contact_created: "system",
  contact_edited: "system",
  contact_deleted: "system",
  assignee_added: "system",
  assignee_removed: "system",
  relation_linked: "system",
  relation_unlinked: "system",
  tag_added: "system",
  tag_removed: "system",
  status_changed: "system",
  visit_scheduled: "system",
  visit_done: "system",
  visit_cancelled: "system",
  visit_evaluated: "system",
  email_sent: "emails",
  email_received: "emails",
  email_delivered: "emails",
  email_opened: "emails",
  whatsapp_sent: "whatsapp",
  whatsapp_received: "whatsapp",
  call: "system",
  comment: "comments",
  registration: "system",
  web_activity: "web",
  document_uploaded: "system",
  document_deleted: "system",
  system_change: "system",
};

export type ContactTimelineEvent = {
  id: string;
  type: ContactTimelineEventType;
  /** ISO datetime. */
  timestamp: string;
  /** Título corto del evento ("Visita realizada · Marina Bay"). */
  title: string;
  /** Detalle opcional ("Cliente educado, pidió ficha financiera."). */
  description?: string;
  /** Nombre del actor (agente o "Sistema"). */
  actor?: string;
  /** Email del actor — para derivar el avatar real. */
  actorEmail?: string;
  /** Metadatos extra opcionales (id de visita, doc, mensaje, etc) para
   *  enlazar con la entidad asociada o para auditoría detallada. */
  meta?: Record<string, string | number>;
};

export type ContactAssignedUser = {
  userId: string;
  userName: string;
  role?: string;
  permissions: { canView: boolean; canEdit: boolean };
};

export type ContactRelation = {
  contactId: string;
  contactName: string;
  /** Id de tipo de relación del catálogo `relationTypesStorage`. Los 5
   *  predeterminados son spouse/partner/family/colleague/other; el admin
   *  puede añadir tipos propios desde /ajustes/contactos/relaciones. */
  relationType: string;
};

export type ContactConsent = {
  /** Base legal · firma del documento de tratamiento de datos (GDPR). */
  gdpr: boolean;
  /** Recibir boletín informativo de novedades. */
  newsletter: boolean;
  /** Recibir envíos comerciales (ofertas, promociones, descuentos). */
  commercialMailing: boolean;
  /** Id del documento de consentimiento firmado (si existe). Sin él los
   *  toggles no se pueden activar. */
  signedDocumentId?: string;
};

export type ContactDetail = Contact & {
  /** Score 0-100 (ver /ajustes/contactos/lead-score para fórmula). */
  leadScore?: number;
  nif?: string;
  /** ISO date. */
  birthDate?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  /** Teléfonos múltiples (uno marcado como principal). */
  phones: ContactPhone[];
  /** Emails múltiples (uno marcado como principal). */
  emailAddresses: ContactEmailAddress[];
  records: ContactRecordEntry[];
  opportunities: ContactOpportunityEntry[];
  activeOperation?: ContactActiveOperation;
  visits: ContactVisitEntry[];
  documents: ContactDocumentEntry[];
  comments: ContactCommentEntry[];
  timeline: ContactTimelineEvent[];
  assignedUsers: ContactAssignedUser[];
  relatedContacts: ContactRelation[];
  consents: ContactConsent;
};

/**
 * Scope de una tag:
 *   - "organization" → la define el admin de la organización; visible
 *     a todos los miembros. Solo admins pueden CRUD.
 *   - "personal"     → solo el usuario que la creó la ve. Cualquier
 *     usuario puede CRUD sus propias tags personales.
 */
export type TagScope = "organization" | "personal";

export type ContactTag = {
  id: string;
  label: string;
  color: string; // clase tailwind del dot
  scope: TagScope;
  /** id del creador. Para org tags, identifica al admin que la creó. */
  createdBy?: string;
};
