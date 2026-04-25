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
 * con portales (Idealista API, Fotocasa API, Rightmove feed, etc.) el
 * id de cada canal se mapea 1:1 al conector backend. Un canal
 * "free-form" no se puede deshabilitar programáticamente, así que
 * preferimos un catálogo fijo.
 *
 * Fuentes del listado (abril 2026):
 *   · Inmogesco · "Mejores portales inmobiliarios en España 2026"
 *   · 1001portales · "Los 15 mejores portales inmobiliarios para vender en Europa"
 *   · Octoparse · "Los 10 Mejores Portales Inmobiliarios de España en 2026"
 *
 * TODO(backend): cuando se enchufen los conectores reales
 *   (`src/lib/portalIntegrations/*`), este catálogo se lee desde
 *   `GET /api/marketing/channels` · incluirá qué integraciones tiene
 *   activas el tenant y permite ordenarlas por tráfico real.
 */

import type { LucideIcon } from "lucide-react";
import {
  Globe, Instagram, Facebook, Youtube, Linkedin, Building2,
  Megaphone, Home, Search,
} from "lucide-react";

export type MarketingChannelCategory = "portales" | "internacionales" | "redes" | "publicidad";

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
  /** Nota opcional para diferenciar canales con dominios similares. */
  hint?: string;
}

export const MARKETING_CHANNELS: readonly MarketingChannel[] = [
  /* ── Portales inmobiliarios · generalistas ES ─────────── */
  { id: "idealista",   label: "Idealista",   category: "portales", icon: Building2, domain: "idealista.com",   hint: "Líder nacional" },
  { id: "fotocasa",    label: "Fotocasa",    category: "portales", icon: Building2, domain: "fotocasa.es" },
  { id: "habitaclia",  label: "Habitaclia",  category: "portales", icon: Building2, domain: "habitaclia.com" },
  { id: "pisos-com",   label: "Pisos.com",   category: "portales", icon: Building2, domain: "pisos.com" },
  { id: "milanuncios", label: "Milanuncios", category: "portales", icon: Search,    domain: "milanuncios.com" },
  { id: "yaencontre",  label: "Yaencontre",  category: "portales", icon: Building2, domain: "yaencontre.com" },
  { id: "enalquiler",  label: "Enalquiler",  category: "portales", icon: Home,      domain: "enalquiler.com" },
  { id: "indomio",     label: "Indomio",     category: "portales", icon: Building2, domain: "indomio.es" },
  { id: "tucasa",      label: "TuCasa",      category: "portales", icon: Home,      domain: "tucasa.com" },
  { id: "trovimap",    label: "Trovimap",    category: "portales", icon: Globe,     domain: "trovimap.com" },

  /* ── Portales internacionales · foco España ─────────── */
  { id: "kyero",         label: "Kyero",         category: "internacionales", icon: Globe,     domain: "kyero.com",         hint: "12 idiomas · líder comprador internacional" },
  { id: "thinkspain",    label: "ThinkSPAIN",    category: "internacionales", icon: Globe,     domain: "thinkspain.com",    hint: "UK · DE · NL" },
  { id: "spainhouses",   label: "SpainHouses",   category: "internacionales", icon: Globe,     domain: "spainhouses.net" },
  { id: "hispacasas",    label: "HispaCasas",    category: "internacionales", icon: Globe,     domain: "hispacasas.com",    hint: "Multi-idioma · red por nacionalidad" },
  { id: "rightmove",     label: "Rightmove",     category: "internacionales", icon: Globe,     domain: "rightmove.co.uk",   hint: "UK · 85.000 viviendas ES" },
  { id: "zoopla",        label: "Zoopla",        category: "internacionales", icon: Globe,     domain: "zoopla.co.uk",      hint: "UK · sección lujo extranjero" },
  { id: "primelocation", label: "PrimeLocation", category: "internacionales", icon: Globe,     domain: "primelocation.com", hint: "UK · alta calidad" },
  { id: "properstar",    label: "Properstar",    category: "internacionales", icon: Globe,     domain: "properstar.com",    hint: "Sindicación a 70+ portales" },
  { id: "globimmo",      label: "Globimmo",      category: "internacionales", icon: Globe,     domain: "globimmo.net",      hint: "Paneuropeo · multi-idioma" },
  { id: "green-acres",   label: "Green-Acres",   category: "internacionales", icon: Globe,     domain: "green-acres.com",   hint: "FR · BE · foco comprador francés" },
  { id: "luxuryestate",  label: "LuxuryEstate",  category: "internacionales", icon: Globe,     domain: "luxuryestate.com",  hint: "Global · lujo premium (James Edition)" },
  { id: "jamesedition",  label: "JamesEdition",  category: "internacionales", icon: Globe,     domain: "jamesedition.com",  hint: "Global · lujo HNW" },
  { id: "realtor-com",   label: "Realtor.com",   category: "internacionales", icon: Globe,     domain: "realtor.com",       hint: "US · comprador americano" },
  { id: "immobiliare-it", label: "Immobiliare.it", category: "internacionales", icon: Globe,   domain: "immobiliare.it",    hint: "IT · líder italiano" },

  /* ── Redes sociales ───────────────────────────────────── */
  { id: "instagram", label: "Instagram",    category: "redes", icon: Instagram, domain: "instagram.com" },
  { id: "facebook",  label: "Facebook",     category: "redes", icon: Facebook,  domain: "facebook.com" },
  { id: "tiktok",    label: "TikTok",       category: "redes", icon: Megaphone, domain: "tiktok.com" },
  { id: "youtube",   label: "YouTube",      category: "redes", icon: Youtube,   domain: "youtube.com" },
  { id: "linkedin",  label: "LinkedIn",     category: "redes", icon: Linkedin,  domain: "linkedin.com" },
  { id: "x",         label: "X (Twitter)",  category: "redes", icon: Megaphone, domain: "x.com" },

  /* ── Publicidad de pago ──────────────────────────────── */
  { id: "google-ads", label: "Google Ads", category: "publicidad", icon: Megaphone, domain: "ads.google.com" },
  { id: "meta-ads",   label: "Meta Ads",   category: "publicidad", icon: Megaphone, domain: "business.facebook.com", hint: "Facebook + Instagram Ads" },
] as const;

export const CATEGORY_LABEL: Record<MarketingChannelCategory, string> = {
  portales:        "Portales inmobiliarios",
  internacionales: "Portales internacionales",
  redes:           "Redes sociales",
  publicidad:      "Publicidad de pago",
};

export const CATEGORY_DESCRIPTION: Record<MarketingChannelCategory, string> = {
  portales:        "Portales generalistas españoles",
  internacionales: "Portales con foco en compradores extranjeros",
  redes:           "Perfiles orgánicos en redes sociales",
  publicidad:      "Campañas pagadas de performance",
};

/** Devuelve el canal por id, o `undefined` si no existe en el catálogo. */
export function getMarketingChannel(id: string): MarketingChannel | undefined {
  return MARKETING_CHANNELS.find((c) => c.id === id);
}

/** Agrupa el catálogo por categoría manteniendo el orden declarado. */
export function groupMarketingChannels(): Record<MarketingChannelCategory, MarketingChannel[]> {
  const out: Record<MarketingChannelCategory, MarketingChannel[]> = {
    portales: [], internacionales: [], redes: [], publicidad: [],
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

/** Total de canales del catálogo · útil para "N / TOTAL prohibidos". */
export const TOTAL_CHANNELS = MARKETING_CHANNELS.length;

/**
 * Favicon oficial del canal · usa el servicio de Google Favicon (CDN,
 * sin rate limit práctico, devuelve PNG). Si el canal no tiene
 * `domain`, devuelve null — el componente hará fallback al icono
 * Lucide. Tamaño 64px para pintar nítido en avatares 24-32px.
 *
 * Para cuando integremos los conectores (fase backend) podemos
 * sustituir esto por assets propios en `/public/channels/<id>.png`
 * si queremos no depender de Google · hoy el coste/beneficio favorece
 * el servicio externo.
 */
export function channelFaviconUrl(channel: MarketingChannel, size = 64): string | null {
  if (!channel.domain) return null;
  // Normaliza · quita "www." si viene (Google lo resuelve igual pero
  // evita duplicados de caché en el browser).
  const host = channel.domain.replace(/^www\./, "");
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size}`;
}
