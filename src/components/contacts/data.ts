/**
 * Mock contacts — 12 contactos realistas para el directorio.
 *
 * Tendencia internacional (mercado típico de promotor en Costa del
 * Sol / Costa Blanca): mix UAE, UK, DE, RU, NL, FR, US + algunos ES.
 * Cada contacto cubre un escenario distinto (VIP cash buyer, lead
 * frío, primera vivienda, follow-up, oportunidad activa, etc.).
 *
 * En producción esto vendrá de `GET /api/contacts?cursor=…`.
 *
 * BACKFILL · Phase 1 Core
 *   Los entries del array siguen escribiéndose con los campos legacy
 *   (reference, source, sourceType, lastActivity, firstSeen). El
 *   helper `enrichLegacySeed()` deriva los nuevos campos requeridos
 *   por el tipo Contact (publicRef, primarySource, latestSource,
 *   origins, lastActivityAt). Mantener legibilidad del seed sin
 *   tocar 12 entries a mano.
 */

import type { Contact, ContactOrigin, ContactSourceType } from "./types";
import { seedRef } from "@/lib/publicRef";

type LegacyContactSeed = Omit<Contact, "publicRef" | "primarySource" | "latestSource" | "origins" | "lastActivityAt">;

/* ── Mapeo del sourceType legacy al `ContactOrigin.source` nuevo. ── */
function inferOriginSource(c: LegacyContactSeed): ContactOrigin["source"] {
  const label = c.source?.toLowerCase() ?? "";
  if (label.includes("idealista")) return "idealista";
  if (label.includes("fotocasa"))  return "fotocasa";
  if (label.includes("habitaclia")) return "habitaclia";
  if (label.includes("microsite") || label.includes("web")) return "microsite";
  if (label.includes("referido") || label.includes("referral")) return "referral";
  if (label.includes("agencia") || label.includes("collaborator")) return "agency";
  if (label.includes("whatsapp")) return "whatsapp";
  if (label.includes("walk")) return "walkin";
  if (label.includes("call") || label.includes("llamad")) return "call";
  if (c.sourceType === "import") return "import";
  if (c.sourceType === "registration") return "registration";
  if (c.sourceType === "portal") return "idealista"; // default portal → idealista
  return "direct";
}

/* ── Best-effort parse de "12 mar 2026" a ISO. ── */
const SPANISH_MONTHS: Record<string, number> = {
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
  jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11,
};
function parseFirstSeen(s: string | undefined): string {
  if (!s) return new Date(2026, 0, 1).toISOString();
  const m = s.match(/^(\d{1,2})\s+(\w{3})\s+(\d{4})$/);
  if (m) {
    const [, d, mn, y] = m;
    const month = SPANISH_MONTHS[mn.toLowerCase()] ?? 0;
    return new Date(parseInt(y, 10), month, parseInt(d, 10)).toISOString();
  }
  return new Date(2026, 0, 1).toISOString();
}

function enrichLegacySeed(seed: LegacyContactSeed, _idx: number): Contact {
  const occurredAt = parseFirstSeen(seed.firstSeen);
  const origin: ContactOrigin = {
    source: inferOriginSource(seed),
    label: seed.source,
    occurredAt,
    refType: seed.sourceType === "registration" ? "registro" : "manual",
  };
  return {
    ...seed,
    /* publicRef · scheme canónico CO + 7 dígitos · derivado del id
     *  via hash determinista (estable entre reloads). El campo
     *  legacy `reference: "CON-NNNN"` queda solo como breadcrumb. */
    publicRef: seedRef("contact", seed.id),
    primarySource: origin,
    latestSource: origin,
    origins: [origin],
    /* En backfill `lastActivityAt` = `firstSeen` parseado. Las nuevas
       interacciones lo adelantan vía `recordActivity()`. */
    lastActivityAt: occurredAt,
  };
}

const RAW_CONTACTS: LegacyContactSeed[] = [
  {
    id: "ahmed-al-rashid",
    reference: "CON-0001",
    name: "Ahmed Al-Rashid",
    nationalityIso: "AE",
    nationality: "United Arab Emirates",
    email: "ahmed.alrashid@gulfgroup.ae",
    phone: "+971 50 123 4567",
    tags: ["vip", "investor", "cash-buyer"],
    source: "Direct",
    sourceType: "direct",
    status: "active",
    lastActivity: "Hace 2 horas",
    firstSeen: "8 mar 2026",
    activeOpportunities: 3,
    hasUpcomingVisit: true,
    hasVisitDone: true,
    hasRecentWebActivity: true,
    totalRegistrations: 5,
    promotionsOfInterest: ["Marina Bay", "Sotogrande Hills", "Estepona Heights"],
    assignedTo: ["Arman Rahmanov", "Laura Gómez"],
    assignedToUserIds: ["u1", "u2"],
    languages: ["EN", "AR"],
    notes: "High-net-worth investor — targeting penthouses ≥ €1.5M.",
  },
  {
    id: "sophie-laurent",
    reference: "CON-0002",
    name: "Sophie Laurent",
    nationalityIso: "FR",
    nationality: "France",
    email: "sophie.laurent@gmail.com",
    phone: "+33 6 12 34 56 78",
    tags: ["first-home", "qualified"],
    source: "Idealista",
    sourceType: "portal",
    status: "active",
    lastActivity: "Ayer",
    firstSeen: "15 mar 2026",
    activeOpportunities: 1,
    hasUpcomingVisit: true,
    hasVisitDone: false,
    hasRecentWebActivity: true,
    totalRegistrations: 2,
    promotionsOfInterest: ["Marina Bay"],
    assignedTo: ["Arman Rahmanov"],
    assignedToUserIds: ["u1"],
    languages: ["FR", "EN"],
    notes: "Looking for primary residence, 2-3 bed, sea view.",
  },
  {
    id: "james-walker",
    reference: "CON-0003",
    name: "James Walker",
    nationalityIso: "GB",
    nationality: "United Kingdom",
    email: "james.w@walkerfamily.co.uk",
    phone: "+44 7700 900123",
    tags: ["vip", "international"],
    source: "Direct",
    sourceType: "direct",
    status: "active",
    lastActivity: "Hace 3 días",
    firstSeen: "2 abr 2026",
    activeOpportunities: 2,
    hasUpcomingVisit: false,
    hasVisitDone: true,
    hasRecentWebActivity: false,
    totalRegistrations: 3,
    promotionsOfInterest: ["Sotogrande Hills"],
    assignedTo: ["Laura Gómez"],
    assignedToUserIds: ["u2"],
    languages: ["EN"],
    notes: "Already owns property in Sotogrande — interested in second unit.",
  },
  {
    id: "maria-gonzalez",
    reference: "CON-0004",
    name: "María González",
    nationalityIso: "ES",
    nationality: "Spain",
    email: "maria.gonzalez@email.es",
    phone: "+34 678 123 456",
    tags: ["first-home"],
    source: "Web form",
    sourceType: "direct",
    status: "pending",
    lastActivity: "Hace 5 días",
    firstSeen: "20 mar 2026",
    activeOpportunities: 0,
    hasUpcomingVisit: false,
    hasVisitDone: false,
    hasRecentWebActivity: false,
    totalRegistrations: 1,
    promotionsOfInterest: ["Estepona Heights"],
    assignedTo: ["Arman Rahmanov"],
    assignedToUserIds: ["u1"],
    languages: ["ES", "EN"],
    notes: "First inquiry. Awaiting financing pre-approval.",
  },
  {
    id: "klaus-mueller",
    reference: "CON-0005",
    name: "Klaus Müller",
    nationalityIso: "DE",
    nationality: "Germany",
    email: "k.mueller@hauseberlin.de",
    phone: "+49 170 1234567",
    tags: ["investor", "international"],
    source: "Direct",
    sourceType: "direct",
    status: "active",
    lastActivity: "Hoy",
    firstSeen: "10 abr 2026",
    activeOpportunities: 2,
    hasUpcomingVisit: true,
    hasVisitDone: false,
    hasRecentWebActivity: true,
    totalRegistrations: 2,
    promotionsOfInterest: ["Marina Bay", "Sotogrande Hills"],
    assignedTo: ["Laura Gómez"],
    assignedToUserIds: ["u2"],
    languages: ["DE", "EN"],
    notes: "Portfolio investor, owns 4 units already across Spain.",
  },
  {
    id: "ekaterina-volkov",
    reference: "CON-0006",
    name: "Ekaterina Volkov",
    nationalityIso: "RU",
    nationality: "Russia",
    email: "e.volkov@volkovestates.ru",
    tags: ["vip", "investor", "cash-buyer", "urgent"],
    source: "Direct",
    sourceType: "direct",
    status: "active",
    lastActivity: "Hoy",
    firstSeen: "12 abr 2026",
    activeOpportunities: 4,
    hasUpcomingVisit: true,
    hasVisitDone: false,
    hasRecentWebActivity: true,
    totalRegistrations: 4,
    promotionsOfInterest: ["Marina Bay", "Sotogrande Hills", "Estepona Heights"],
    assignedTo: ["Arman Rahmanov", "Laura Gómez"],
    assignedToUserIds: ["u1", "u2"],
    languages: ["RU", "EN"],
    notes: "Wants to close deal before end of month. Cash purchase.",
  },
  {
    id: "tom-van-dijk",
    reference: "CON-0007",
    name: "Tom van Dijk",
    nationalityIso: "NL",
    nationality: "Netherlands",
    email: "tom.vandijk@dutchinvest.nl",
    phone: "+31 6 1234 5678",
    tags: ["follow-up"],
    source: "Fotocasa",
    sourceType: "portal",
    status: "pending",
    lastActivity: "Hace 1 semana",
    firstSeen: "25 mar 2026",
    activeOpportunities: 0,
    hasUpcomingVisit: false,
    hasVisitDone: true,
    hasRecentWebActivity: false,
    totalRegistrations: 2,
    promotionsOfInterest: ["Marina Bay"],
    assignedTo: ["Arman Rahmanov"],
    assignedToUserIds: ["u1"],
    languages: ["NL", "EN"],
    notes: "Visited Marina Bay 2 weeks ago. No response since — needs follow-up.",
  },
  {
    id: "jennifer-chen",
    reference: "CON-0008",
    name: "Jennifer Chen",
    nationalityIso: "US",
    nationality: "United States",
    email: "jen.chen@chenfamily.com",
    phone: "+1 415 555 0123",
    tags: ["vip", "international", "qualified"],
    source: "Direct",
    sourceType: "direct",
    status: "active",
    lastActivity: "Hace 4 horas",
    firstSeen: "5 abr 2026",
    activeOpportunities: 1,
    hasUpcomingVisit: true,
    hasVisitDone: false,
    hasRecentWebActivity: true,
    totalRegistrations: 1,
    promotionsOfInterest: ["Sotogrande Hills"],
    assignedTo: ["Laura Gómez"],
    assignedToUserIds: ["u2"],
    languages: ["EN"],
    notes: "Referred by Ahmed Al-Rashid. SF tech executive.",
  },
  {
    id: "carlos-ruiz",
    reference: "CON-0009",
    name: "Carlos Ruiz",
    nationalityIso: "ES",
    nationality: "Spain",
    email: "carlos.ruiz@empresa.es",
    phone: "+34 600 123 456",
    tags: ["qualified"],
    source: "Web form",
    sourceType: "direct",
    status: "active",
    lastActivity: "Ayer",
    firstSeen: "18 mar 2026",
    activeOpportunities: 1,
    hasUpcomingVisit: false,
    hasVisitDone: true,
    hasRecentWebActivity: true,
    totalRegistrations: 3,
    promotionsOfInterest: ["Estepona Heights"],
    assignedTo: ["Arman Rahmanov"],
    assignedToUserIds: ["u1"],
    languages: ["ES"],
    notes: "Negotiating financing. Offer expected next week.",
  },
  {
    id: "harald-sorensen",
    reference: "CON-0010",
    name: "Harald Sørensen",
    nationalityIso: "NO",
    nationality: "Norway",
    email: "harald.s@nordlys.no",
    tags: ["follow-up", "international"],
    source: "Direct",
    sourceType: "direct",
    status: "cold",
    lastActivity: "Hace 3 meses",
    firstSeen: "5 ene 2026",
    activeOpportunities: 0,
    hasUpcomingVisit: false,
    hasVisitDone: false,
    hasRecentWebActivity: false,
    totalRegistrations: 1,
    promotionsOfInterest: ["Marina Bay"],
    assignedTo: ["Laura Gómez"],
    assignedToUserIds: ["u2"],
    languages: ["NO", "EN"],
    notes: "Cold lead. Last contact 3 months ago — likely lost.",
  },
  {
    id: "amelia-thompson",
    reference: "CON-0011",
    name: "Amelia Thompson",
    nationalityIso: "GB",
    nationality: "United Kingdom",
    email: "amelia.thompson@thompsongroup.uk",
    phone: "+44 7711 234567",
    tags: [],
    source: "Imported",
    sourceType: "import",
    status: "pending",
    lastActivity: "Hace 2 semanas",
    firstSeen: "1 abr 2026",
    activeOpportunities: 0,
    hasUpcomingVisit: false,
    hasVisitDone: false,
    hasRecentWebActivity: false,
    totalRegistrations: 0,
    promotionsOfInterest: [],
    assignedTo: [],
    assignedToUserIds: [],
    languages: ["EN"],
    notes: "Imported from Excel. No interactions yet.",
  },
  {
    id: "diana-petrov",
    reference: "CON-0012",
    name: "Diana Petrov",
    nationality: "Bulgaria",
    email: "diana.petrov@email.bg",
    phone: "+359 88 123 4567",
    tags: ["first-home", "qualified"],
    source: "Idealista",
    sourceType: "portal",
    status: "converted",
    lastActivity: "Hace 1 mes",
    firstSeen: "10 feb 2026",
    activeOpportunities: 0,
    hasUpcomingVisit: false,
    hasVisitDone: true,
    hasRecentWebActivity: false,
    totalRegistrations: 4,
    promotionsOfInterest: ["Marina Bay"],
    assignedTo: ["Arman Rahmanov"],
    assignedToUserIds: ["u1"],
    languages: ["BG", "EN", "RU"],
    notes: "Closed deal — Marina Bay unit B-204. €285K, signed 12 mar.",
  },
];

/** Export final · cada seed enriquecido con publicRef + origins +
 *  lastActivityAt. Los campos legacy (reference, source, sourceType,
 *  lastActivity, firstSeen) se mantienen por retrocompat. */
export const MOCK_CONTACTS: Contact[] = RAW_CONTACTS.map(enrichLegacySeed);
