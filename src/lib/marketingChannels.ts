/**
 * marketingChannels.ts · catálogo canónico de canales de marketing/
 * publicación donde una agencia colaboradora PODRÍA promocionar una
 * promoción compartida por el promotor.
 *
 * El promotor define reglas de MARKETING en la ficha de la promoción
 * (`MarketingRulesCard` + `MarketingRulesDialog`). Marca qué canales
 * están PROHIBIDOS. Por defecto todos permitidos.
 *
 * Por qué un catálogo cerrado · cuando existan integraciones reales
 * con portales (Idealista API, Fotocasa API, Meta Ads, etc.) el id
 * de cada canal se mapea 1:1 al conector backend. Un canal "free-form"
 * no se puede deshabilitar programáticamente, así que preferimos un
 * catálogo fijo + "Otros" (custom) si hace falta.
 *
 * TODO(backend): cuando se enchufen los conectores reales
 *   (`src/lib/portalIntegrations/*`), este catálogo se lee desde
 *   `GET /api/marketing/channels` · incluirá qué integraciones tiene
 *   activas el tenant y permite ordenarlas.
 */

import type { LucideIcon } from "lucide-react";
import {
  Globe, Instagram, Facebook, Youtube, Linkedin, Building2,
  Megaphone,
} from "lucide-react";

export type MarketingChannelCategory = "portales" | "redes" | "publicidad";

export interface MarketingChannel {
  /** ID estable · se persiste en `Promotion.marketingProhibitions[]`.
   *  Nunca renombrar · añade uno nuevo y marca el viejo como deprecated. */
  id: string;
  /** Nombre humano en español (como aparece en UI). */
  label: string;
  /** Categoría para agrupar en el dialog. */
  category: MarketingChannelCategory;
  /** Icono Lucide · solo decorativo, el catálogo canónico es textual. */
  icon: LucideIcon;
  /** Dominio principal · solo informativo, no se usa para matching. */
  domain?: string;
}

export const MARKETING_CHANNELS: readonly MarketingChannel[] = [
  /* ── Portales inmobiliarios ───────────────────────────── */
  { id: "idealista",   label: "Idealista",   category: "portales", icon: Building2, domain: "idealista.com" },
  { id: "fotocasa",    label: "Fotocasa",    category: "portales", icon: Building2, domain: "fotocasa.es" },
  { id: "habitaclia",  label: "Habitaclia",  category: "portales", icon: Building2, domain: "habitaclia.com" },
  { id: "pisos-com",   label: "Pisos.com",   category: "portales", icon: Building2, domain: "pisos.com" },
  { id: "milanuncios", label: "Milanuncios", category: "portales", icon: Building2, domain: "milanuncios.com" },
  { id: "yaencontre",  label: "Yaencontre",  category: "portales", icon: Building2, domain: "yaencontre.com" },
  { id: "thinkspain",  label: "ThinkSPAIN",  category: "portales", icon: Globe,     domain: "thinkspain.com" },
  { id: "kyero",       label: "Kyero",       category: "portales", icon: Globe,     domain: "kyero.com" },

  /* ── Redes sociales ───────────────────────────────────── */
  { id: "instagram", label: "Instagram", category: "redes", icon: Instagram, domain: "instagram.com" },
  { id: "facebook",  label: "Facebook",  category: "redes", icon: Facebook,  domain: "facebook.com" },
  { id: "tiktok",    label: "TikTok",    category: "redes", icon: Megaphone, domain: "tiktok.com" },
  { id: "youtube",   label: "YouTube",   category: "redes", icon: Youtube,   domain: "youtube.com" },
  { id: "linkedin",  label: "LinkedIn",  category: "redes", icon: Linkedin,  domain: "linkedin.com" },
  { id: "x",         label: "X (Twitter)", category: "redes", icon: Megaphone, domain: "x.com" },

  /* ── Publicidad de pago ──────────────────────────────── */
  { id: "google-ads", label: "Google Ads", category: "publicidad", icon: Megaphone, domain: "ads.google.com" },
  { id: "meta-ads",   label: "Meta Ads",   category: "publicidad", icon: Megaphone, domain: "business.facebook.com" },
] as const;

export const CATEGORY_LABEL: Record<MarketingChannelCategory, string> = {
  portales:   "Portales inmobiliarios",
  redes:      "Redes sociales",
  publicidad: "Publicidad de pago",
};

/** Devuelve el canal por id, o `undefined` si no existe en el catálogo. */
export function getMarketingChannel(id: string): MarketingChannel | undefined {
  return MARKETING_CHANNELS.find((c) => c.id === id);
}

/** Agrupa el catálogo por categoría manteniendo el orden declarado. */
export function groupMarketingChannels(): Record<MarketingChannelCategory, MarketingChannel[]> {
  const out: Record<MarketingChannelCategory, MarketingChannel[]> = {
    portales: [], redes: [], publicidad: [],
  };
  for (const c of MARKETING_CHANNELS) out[c.category].push(c);
  return out;
}

/** Dados los ids prohibidos, devuelve su `label` humano en el orden del
 *  catálogo. Filtra ids desconocidos (p. ej. si el catálogo cambió). */
export function labelsForProhibited(ids: string[]): string[] {
  const set = new Set(ids);
  return MARKETING_CHANNELS.filter((c) => set.has(c.id)).map((c) => c.label);
}
