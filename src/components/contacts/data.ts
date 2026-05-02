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

const RAW_CONTACTS: Contact[] = [];

/** Export final · cada seed enriquecido con publicRef + origins +
 *  lastActivityAt. Los campos legacy (reference, source, sourceType,
 *  lastActivity, firstSeen) se mantienen por retrocompat. */
export const MOCK_CONTACTS: Contact[] = RAW_CONTACTS.map(enrichLegacySeed);
