/**
 * Generador determinista de ContactDetail a partir de un Contact base.
 *
 * Mientras no haya backend, la ficha de detalle necesita timeline,
 * registros, visitas, documentos, etc. Aquí los generamos a partir
 * del id del contacto (función pura, mismo id → mismo detalle), de
 * forma que cada contacto se vea distinto pero estable entre recargas.
 *
 * TODO(backend): GET /api/contacts/:id → ContactDetail real desde DB.
 *  Este módulo desaparece o se queda solo para tests/storybook.
 */

import type {
  Contact, ContactDetail, ContactPhone, ContactEmailAddress,
  ContactRecordEntry, ContactVisitEntry, ContactDocumentEntry,
  ContactCommentEntry, ContactTimelineEvent, ContactAssignedUser,
  ContactRelation, ContactOpportunityEntry, ContactActiveOperation,
} from "./types";
import { loadAllEvaluations } from "./visitEvaluationsStorage";
import { loadAssignedOverride, loadRelationsOverride } from "./contactRelationsStorage";
import { TEAM_MEMBERS } from "@/lib/team";

/* PRNG determinista (mulberry32). Estable entre runs si la semilla es
 * la misma. Lo usamos para generar números, índices y timestamps
 * pseudo-aleatorios pero reproducibles a partir del id del contacto. */
function seedFromId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Resta `days` días a una fecha y devuelve ISO. */
function daysAgoISO(days: number, baseHours = 10): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(baseHours, 0, 0, 0);
  return d.toISOString();
}

const PROMOTIONS = [
  { id: "marina-bay",       name: "Marina Bay",       units: ["B-204", "B-301", "A-105", "PH-12"], image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=300&h=200&fit=crop", refPrefix: "MB" },
  { id: "sotogrande-hills", name: "Sotogrande Hills", units: ["12A", "8B", "5C"],                  image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=300&h=200&fit=crop", refPrefix: "SH" },
  { id: "estepona-heights", name: "Estepona Heights", units: ["402", "501", "PH-7"],               image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=300&h=200&fit=crop", refPrefix: "EH" },
  { id: "mare-nostrum",     name: "Mare Nostrum",     units: ["A-201", "B-104"],                   image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=300&h=200&fit=crop", refPrefix: "MN" },
];

/* AGENTS y TEAM_USERS derivan de TEAM_MEMBERS (fuente única · ADR-050).
 * Filtramos los 4 primeros activos para tener seeds deterministas. */
const ACTIVE_TEAM = TEAM_MEMBERS.filter((m) => !m.status || m.status === "active");
const AGENTS = ACTIVE_TEAM.slice(0, 4).map((m) => m.name);

/** Posibles orígenes de un lead (de dónde entró). */
const LEAD_SOURCES = [
  "Idealista",
  "Fotocasa",
  "Microsite Marina Bay",
  "Microsite Sotogrande Hills",
  "Habitaclia",
  "Manual",
  "Agencia Costa Sur",
  "Agencia Mediterráneo Premium",
  "Agencia BlueSea Properties",
  "Recomendación cliente",
];

/** Catálogos para construir oportunidades realistas. */
const PROPERTY_TYPES = ["Ático", "Piso", "Villa", "Dúplex", "Casa adosada"];
const AREAS          = ["Playa", "Centro", "Golf", "Casco antiguo", "Primera línea"];
const BEDROOMS       = ["2", "3", "3+", "4+"];
const OPP_TAGS = [
  "Vistas al mar", "Terraza grande", "Parking", "Inversión",
  "Pet friendly", "Reformado", "Piscina privada", "Smart home",
  "Eficiencia A", "Bajo VPO",
];
const AGENCIES_OPPORT = [
  "Iberia Homes", "Costa Sur Properties", "Mediterráneo Premium",
  "BlueSea Properties", "Sotogrande Realty",
];

const CANCEL_REASONS = [
  "Cliente perdió interés",
  "Fuera de presupuesto",
  "Compró otra promoción",
  "No localizable",
  "Cambio de planes personales",
];

const TEAM_USERS = ACTIVE_TEAM.slice(0, 4).map((m) => ({
  id: m.id,
  name: m.name,
  role: m.jobTitle ?? (m.role === "admin" ? "Admin" : "Comercial"),
}));

function buildPhones(rng: () => number, base?: string): ContactPhone[] {
  const phones: ContactPhone[] = [];
  if (base) {
    phones.push({ id: "p1", number: base, label: "Móvil", primary: true, hasWhatsapp: true });
  }
  if (rng() > 0.5) {
    phones.push({
      id: "p2",
      number: base ? base.replace(/\d{3}$/, String(Math.floor(rng() * 900) + 100)) : "+34 600 000 000",
      label: rng() > 0.5 ? "Trabajo" : "Casa",
      primary: !base,
      hasWhatsapp: false,
    });
  }
  return phones;
}

function buildEmails(rng: () => number, base?: string): ContactEmailAddress[] {
  const emails: ContactEmailAddress[] = [];
  if (base) {
    emails.push({ id: "e1", address: base, label: "Personal", primary: true, verified: rng() > 0.3 });
  }
  if (rng() > 0.6 && base) {
    const [user, domain] = base.split("@");
    emails.push({
      id: "e2",
      address: `${user}.work@${domain}`,
      label: "Trabajo",
      verified: false,
    });
  }
  return emails;
}

function buildRecords(rng: () => number, count: number): ContactRecordEntry[] {
  return Array.from({ length: count }, (_, i) => {
    const promo = PROMOTIONS[Math.floor(rng() * PROMOTIONS.length)];
    const unit = promo.units[Math.floor(rng() * promo.units.length)];
    /* El primero suele ser converted (lead que cuajó). El resto se
     * reparten entre todos los estados. */
    let status: ContactRecordEntry["status"];
    if (i === 0) status = "converted";
    else {
      const r = rng();
      status = r > 0.75 ? "pending"
             : r > 0.5  ? "approved"
             : r > 0.25 ? "cancelled"
             :            "converted";
    }
    return {
      id: `r${i + 1}`,
      promotionId: promo.id,
      promotionName: promo.name,
      unit,
      propertyImage: promo.image,
      propertyRef: `${promo.refPrefix}-${unit}`,
      landingUrl: `/${promo.id}/${unit.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      agent: AGENTS[Math.floor(rng() * AGENTS.length)],
      source: LEAD_SOURCES[Math.floor(rng() * LEAD_SOURCES.length)],
      status,
      timestamp: daysAgoISO(i * 12 + Math.floor(rng() * 5)),
      convertedSaleId: status === "converted" ? `v-${100 + i}` : undefined,
      cancelReason: status === "cancelled"
        ? CANCEL_REASONS[Math.floor(rng() * CANCEL_REASONS.length)]
        : undefined,
      blockchainHash: `0x${Math.floor(rng() * 0xffffffff).toString(16).padStart(8, "0")}…${Math.floor(rng() * 0xffff).toString(16)}`,
      agentNote: rng() > 0.6 ? "Cliente interesado, pidió segunda visita." : undefined,
    };
  });
}

/**
 * Genera oportunidades activas/cerradas con intereses del cliente y
 * tags. Suele haber 1 oportunidad activa principal + opcionalmente 1
 * archivada o ganada.
 */
function buildOpportunities(rng: () => number): ContactOpportunityEntry[] {
  const out: ContactOpportunityEntry[] = [];
  /* Oportunidad activa principal. */
  const promo = PROMOTIONS[Math.floor(rng() * PROMOTIONS.length)];
  const unit  = promo.units[Math.floor(rng() * promo.units.length)];
  const budgetBase = 300000 + Math.floor(rng() * 400000);
  const tagsCount = 2 + Math.floor(rng() * 3);
  const pickedTags = pickN(OPP_TAGS, tagsCount, rng);

  out.push({
    id: "opp-1",
    promotionId: promo.id,
    promotionName: promo.name,
    unit,
    propertyImage: promo.image,
    agencyName: AGENCIES_OPPORT[Math.floor(rng() * AGENCIES_OPPORT.length)],
    agentName: AGENTS[Math.floor(rng() * AGENTS.length)],
    status: "active",
    createdAt: daysAgoISO(15 + Math.floor(rng() * 25)),
    clientInterests: {
      propertyType: PROPERTY_TYPES[Math.floor(rng() * PROPERTY_TYPES.length)],
      area:         AREAS[Math.floor(rng() * AREAS.length)],
      budgetMin:    budgetBase,
      budgetMax:    budgetBase + 100000 + Math.floor(rng() * 250000),
      bedrooms:     BEDROOMS[Math.floor(rng() * BEDROOMS.length)],
    },
    tags: pickedTags,
  });

  /* 30% de probabilidad de tener una segunda oportunidad
   * (ganada o archivada — historia más rica). */
  if (rng() > 0.7) {
    const promo2 = PROMOTIONS[Math.floor(rng() * PROMOTIONS.length)];
    const unit2  = promo2.units[Math.floor(rng() * promo2.units.length)];
    out.push({
      id: "opp-2",
      promotionId: promo2.id,
      promotionName: promo2.name,
      unit: unit2,
      propertyImage: promo2.image,
      agencyName: AGENCIES_OPPORT[Math.floor(rng() * AGENCIES_OPPORT.length)],
      agentName: AGENTS[Math.floor(rng() * AGENTS.length)],
      status: rng() > 0.5 ? "won" : "archived",
      createdAt: daysAgoISO(60 + Math.floor(rng() * 60)),
      clientInterests: {
        propertyType: PROPERTY_TYPES[Math.floor(rng() * PROPERTY_TYPES.length)],
        area:         AREAS[Math.floor(rng() * AREAS.length)],
      },
      tags: pickN(OPP_TAGS, 2, rng),
    });
  }
  return out;
}

/**
 * Si el contacto tiene algún lead convertido, devuelve un resumen
 * "operación activa" para el banner verde del tab Operaciones. Mock
 * determinista por seed; los importes son creíbles para la promoción.
 */
function buildActiveOperation(
  rng: () => number, records: ContactRecordEntry[],
): ContactActiveOperation | undefined {
  const converted = records.find((r) => r.status === "converted");
  if (!converted) return undefined;
  const price = 350000 + Math.floor(rng() * 500000);
  const deposit = 5000 + Math.floor(rng() * 10000);
  return {
    id: `op-${converted.id}`,
    title: "Compra en curso",
    promotionName: converted.promotionName,
    unit: converted.unit,
    price,
    deposit,
    startDate: converted.timestamp,
    state: "in-progress",
  };
}

/** Helper: elige N elementos distintos de un array, determinista por rng. */
function pickN<T>(arr: T[], n: number, rng: () => number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(rng() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

function buildVisits(rng: () => number, hasUpcoming: boolean, hasDone: boolean): ContactVisitEntry[] {
  const visits: ContactVisitEntry[] = [];

  /* Visita programada futura. */
  if (hasUpcoming) {
    const promo = PROMOTIONS[Math.floor(rng() * PROMOTIONS.length)];
    visits.push({
      id: "v1",
      promotionId: promo.id,
      promotionName: promo.name,
      unit: promo.units[0],
      agent: AGENTS[Math.floor(rng() * AGENTS.length)],
      scheduledAt: daysAgoISO(-Math.ceil(rng() * 7) - 1, 11 + Math.floor(rng() * 6)),
      status: "scheduled",
      notes: "Confirmado por WhatsApp.",
    });
  }

  /* Visita realizada RECIENTE sin evaluación → tarea pendiente. */
  if (hasDone) {
    const promo = PROMOTIONS[Math.floor(rng() * PROMOTIONS.length)];
    const recentAgent = AGENTS[Math.floor(rng() * AGENTS.length)];
    visits.push({
      id: "v2",
      promotionId: promo.id,
      promotionName: promo.name,
      unit: promo.units[1] ?? promo.units[0],
      agent: recentAgent,
      scheduledAt: daysAgoISO(2 + Math.floor(rng() * 4)),
      status: "done",
      notes: "Le encantó la cocina. Volverá con su pareja.",
      /* SIN evaluation a propósito → aparece como tarea pendiente. */
    });

    /* Visita realizada antigua YA evaluada. */
    const promo2 = PROMOTIONS[Math.floor(rng() * PROMOTIONS.length)];
    const oldAgent = AGENTS[Math.floor(rng() * AGENTS.length)];
    const ratings: (1 | 2 | 3 | 4 | 5)[] = [3, 4, 4, 5, 5];
    const interests: ("low" | "medium" | "high")[] = ["medium", "high", "high"];
    visits.push({
      id: "v4",
      promotionId: promo2.id,
      promotionName: promo2.name,
      unit: promo2.units[0],
      agent: oldAgent,
      scheduledAt: daysAgoISO(20 + Math.floor(rng() * 20)),
      status: "done",
      notes: "Vio 3 unidades. Comparando.",
      evaluation: {
        outcome: "completed",
        rating: ratings[Math.floor(rng() * ratings.length)],
        clientInterest: interests[Math.floor(rng() * interests.length)],
        feedback: "Buena visita. Cliente educado, hace preguntas técnicas. Pidió ficha financiera.",
        actualAgent: oldAgent,
        evaluatedAt: daysAgoISO(20 + Math.floor(rng() * 20) - 1),
        evaluatedBy: oldAgent,
      },
    });
  }

  /* Visita cancelada (probabilística). */
  if (rng() > 0.7) {
    const promo = PROMOTIONS[Math.floor(rng() * PROMOTIONS.length)];
    visits.push({
      id: "v3",
      promotionId: promo.id,
      promotionName: promo.name,
      unit: promo.units[0],
      agent: AGENTS[Math.floor(rng() * AGENTS.length)],
      scheduledAt: daysAgoISO(30 + Math.floor(rng() * 30)),
      status: "cancelled",
      notes: "Surgió un imprevisto.",
    });
  }

  return visits;
}

function buildDocuments(rng: () => number): ContactDocumentEntry[] {
  const docs: ContactDocumentEntry[] = [];

  /* Ficha técnica REAL servida desde /public — sirve para probar
   * vista previa, descarga y envío por email/WhatsApp con un PDF
   * de verdad. Aparece en TODOS los contactos. */
  docs.push({
    id: "d-real-1",
    name: "REF-3348-ficha.pdf",
    category: "commercial",
    size: 1_489_095,
    uploadedAt: daysAgoISO(3),
    uploadedBy: AGENTS[0],
    dataUrl: "/REF-3348-ficha.pdf",
  });

  if (rng() > 0.4) {
    docs.push({
      id: "d1", name: "DNI escaneado.pdf", category: "id",
      size: 850_000, uploadedAt: daysAgoISO(60), uploadedBy: AGENTS[0],
    });
  }
  if (rng() > 0.5) {
    docs.push({
      id: "d2", name: "Reserva firmada.pdf", category: "legal",
      size: 320_000, uploadedAt: daysAgoISO(20), uploadedBy: AGENTS[0],
    });
  }
  if (rng() > 0.6) {
    docs.push({
      id: "d3", name: "Carta de oferta.pdf", category: "commercial",
      size: 180_000, uploadedAt: daysAgoISO(5), uploadedBy: AGENTS[1],
    });
  }
  return docs;
}

function buildComments(rng: () => number): ContactCommentEntry[] {
  const samples = [
    "Quiere confirmar disponibilidad para visitar el viernes.",
    "Cliente VIP — atender personalmente Arman.",
    "Pidió ficha técnica completa, enviada por email.",
    "Sigue dudando entre Marina Bay y Estepona Heights.",
    "Reserva confirmada · esperando documentación bancaria.",
  ];

  /* Comentarios "user" del equipo. */
  const count = Math.floor(rng() * 3) + 1;
  const userComments: ContactCommentEntry[] = Array.from({ length: count }, (_, i) => ({
    id: `c${i + 1}`,
    authorId: TEAM_USERS[Math.floor(rng() * TEAM_USERS.length)].id,
    authorName: AGENTS[Math.floor(rng() * AGENTS.length)],
    content: samples[Math.floor(rng() * samples.length)],
    timestamp: daysAgoISO(i * 3 + 1, 12 + Math.floor(rng() * 6)),
    kind: "user",
  }));

  /* Comentarios "system" — eventos automáticos. Se mezclan con los
   * de usuario para que el timeline tenga ambos tipos. */
  const systemComments: ContactCommentEntry[] = [
    {
      id: "sys-create",
      authorId: "system",
      authorName: "Sistema",
      content: "Contacto creado · llegó por formulario web de Marina Bay.",
      timestamp: daysAgoISO(90, 9),
      kind: "system",
    },
  ];
  if (rng() > 0.5) {
    systemComments.push({
      id: "sys-status",
      authorId: "system",
      authorName: "Sistema",
      content: "Estado cambiado a Activo automáticamente al detectar interacciones recientes.",
      timestamp: daysAgoISO(15, 11),
      kind: "system",
    });
  }
  if (rng() > 0.6) {
    systemComments.push({
      id: "sys-tag",
      authorId: "system",
      authorName: "Sistema",
      content: "Etiqueta «cash-buyer» asignada automáticamente por la regla de lead scoring.",
      timestamp: daysAgoISO(7, 14),
      kind: "system",
    });
  }

  return [...userComments, ...systemComments];
}

function buildTimeline(
  rng: () => number,
  records: ContactRecordEntry[],
  visits: ContactVisitEntry[],
  docs: ContactDocumentEntry[],
  comments: ContactCommentEntry[],
  contactEmail: string | undefined,
): ContactTimelineEvent[] {
  const events: ContactTimelineEvent[] = [];
  events.push({
    id: "t-lead", type: "lead_entry",
    timestamp: daysAgoISO(90),
    title: "Entrada del lead",
    description: "Llegó por formulario web de Marina Bay.",
  });
  records.forEach((r) => events.push({
    id: `t-r-${r.id}`, type: "registration",
    timestamp: r.timestamp,
    title: `Registro en ${r.promotionName}${r.unit ? " · " + r.unit : ""}`,
    description: r.status === "approved"  ? "Aprobado por el promotor." :
                 r.status === "pending"   ? "Pendiente de revisión." :
                 r.status === "converted" ? "Convertido en operación." :
                                            `Cancelado · ${r.cancelReason ?? "sin motivo"}`,
    actor: r.agent,
  }));
  visits.forEach((v) => events.push({
    id: `t-v-${v.id}`,
    type: v.status === "done" ? "visit_done" :
          v.status === "cancelled" ? "visit_cancelled" : "visit_scheduled",
    timestamp: v.scheduledAt,
    title: `Visita ${v.status === "scheduled" ? "programada" : v.status === "done" ? "realizada" : "cancelada"} · ${v.promotionName}`,
    description: v.notes,
    actor: v.agent,
  }));
  docs.forEach((d) => events.push({
    id: `t-d-${d.id}`, type: "document_uploaded",
    timestamp: d.uploadedAt,
    title: `Documento subido: ${d.name}`,
    actor: d.uploadedBy,
  }));
  comments.forEach((c) => events.push({
    id: `t-c-${c.id}`, type: "comment",
    timestamp: c.timestamp,
    title: "Comentario interno",
    description: c.content,
    actor: c.authorName,
  }));
  if (rng() > 0.5) {
    events.push({
      id: "t-web", type: "web_activity",
      timestamp: daysAgoISO(2, 16),
      title: "Visitó el microsite de Marina Bay",
      description: "Vió 3 unidades · descargó la brochure.",
    });
  }
  /* Ciclo de emails: 2-4 conversaciones con sent → delivered → opened
   * y algún received (cliente respondiendo). Por usuarios distintos
   * para que el tab Emails muestre el desglose por agente. */
  const emailConvos = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < emailConvos; i++) {
    const agent = AGENTS[Math.floor(rng() * AGENTS.length)];
    const subject = EMAIL_SUBJECTS[Math.floor(rng() * EMAIL_SUBJECTS.length)];
    const day = 30 - i * 5 - Math.floor(rng() * 3);
    const baseHour = 9 + Math.floor(rng() * 9);
    const sentAt = daysAgoISO(day, baseHour);
    const deliveredAt = daysAgoISO(day, baseHour);
    const openedAt = daysAgoISO(day, baseHour + 1);

    events.push({
      id: `t-em-s-${i}`, type: "email_sent",
      timestamp: sentAt,
      title: `Email enviado: ${subject}`,
      description: `Para ${contactEmail ?? "el cliente"}`,
      actor: agent,
    });
    events.push({
      id: `t-em-d-${i}`, type: "email_delivered",
      timestamp: deliveredAt,
      title: `Email entregado: ${subject}`,
      description: "Servidor confirmó recepción.",
      actor: "Sistema",
    });
    if (rng() > 0.4) {
      events.push({
        id: `t-em-o-${i}`, type: "email_opened",
        timestamp: openedAt,
        title: `Email abierto: ${subject}`,
        description: "El cliente abrió el mensaje.",
        actor: "Sistema",
      });
    }
    if (rng() > 0.6) {
      events.push({
        id: `t-em-r-${i}`, type: "email_received",
        timestamp: daysAgoISO(day - 1, baseHour + 2),
        title: `Email recibido: Re: ${subject}`,
        description: `De ${contactEmail ?? "el cliente"}`,
        actor: "Cliente",
      });
    }
  }
  // Más reciente arriba
  return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

const EMAIL_SUBJECTS = [
  "Información Marina Bay",
  "Plano Ático PH-12",
  "Disponibilidad de unidades",
  "Confirmación visita",
  "Documentación reserva",
  "Brochure Sotogrande Hills",
  "Propuesta de financiación",
  "Consulta sobre comisiones",
];

function buildAssignedUsers(rng: () => number, names: string[]): ContactAssignedUser[] {
  return names.map((name, i) => {
    const u = TEAM_USERS.find((u) => u.name === name);
    return {
      userId: u?.id ?? `u-mock-${i}`,
      userName: name,
      role: u?.role,
      permissions: {
        canView: true,
        canEdit: i === 0 || rng() > 0.5,
      },
    };
  });
}

function buildRelated(rng: () => number, all: Contact[], excludeId: string): ContactRelation[] {
  if (rng() < 0.4) return [];
  const candidates = all.filter((c) => c.id !== excludeId);
  if (candidates.length === 0) return [];
  const pick = candidates[Math.floor(rng() * candidates.length)];
  const types: ContactRelation["relationType"][] = ["spouse", "partner", "family", "colleague"];
  return [{
    contactId: pick.id,
    contactName: pick.name,
    relationType: types[Math.floor(rng() * types.length)],
  }];
}

/**
 * Construye un ContactDetail completo a partir de un Contact base.
 * Determinista por id (mismo contacto = mismo detalle siempre).
 */
export function buildContactDetail(base: Contact, allContacts: Contact[]): ContactDetail {
  const rng = mulberry32(seedFromId(base.id));

  const phones = buildPhones(rng, base.phone);
  const emails = buildEmails(rng, base.email);
  const records = buildRecords(rng, base.totalRegistrations || 1);
  const opportunities = buildOpportunities(rng);
  const activeOperation = buildActiveOperation(rng, records);
  /* Mergeamos evaluaciones que el usuario haya añadido localmente
   * (visitEvaluationsStorage) sobre las visitas mock. */
  const evals = loadAllEvaluations();
  const visits = buildVisits(rng, base.hasUpcomingVisit, base.hasVisitDone)
    .map((v) => evals[v.id] ? { ...v, evaluation: evals[v.id] } : v);
  const documents = buildDocuments(rng);
  const comments = buildComments(rng);
  const timeline = buildTimeline(rng, records, visits, documents, comments, base.email);
  /* Asignados y relacionados: si hay override local lo usamos, si no
   * generamos del mock determinista. */
  const assignedUsers = loadAssignedOverride(base.id) ?? buildAssignedUsers(rng, base.assignedTo);
  const relatedContacts = loadRelationsOverride(base.id) ?? buildRelated(rng, allContacts, base.id);

  /* Lead score determinista entre 30 y 95. Si el contacto está
   * "converted" o tiene oportunidades activas, score más alto. */
  const baseScore = base.status === "converted" ? 90
    : base.status === "active" ? 70
    : base.status === "pending" ? 50
    : 35;
  const leadScore = Math.min(99, baseScore + Math.floor(rng() * 15) + base.activeOpportunities * 3);

  return {
    ...base,
    leadScore,
    nif: rng() > 0.5 ? `${Math.floor(10000000 + rng() * 89999999)}${"ABCDEFGHJKLMNPQRSTVWXYZ"[Math.floor(rng() * 23)]}` : undefined,
    birthDate: rng() > 0.4 ? new Date(1960 + Math.floor(rng() * 40), Math.floor(rng() * 12), 1 + Math.floor(rng() * 27)).toISOString() : undefined,
    address: rng() > 0.5 ? "Calle Mayor 12, 3º B" : undefined,
    city: rng() > 0.5 ? "Marbella" : undefined,
    postalCode: rng() > 0.5 ? "29600" : undefined,
    phones,
    emailAddresses: emails,
    records,
    opportunities,
    activeOperation,
    visits,
    documents,
    comments,
    timeline,
    assignedUsers,
    relatedContacts,
    consents: {
      gdpr: rng() > 0.2,
      newsletter: rng() > 0.4,
      commercialMailing: rng() > 0.6,
    },
  };
}
