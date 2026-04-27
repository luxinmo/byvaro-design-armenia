/**
 * Microsites · mock data (Vista Promotor)
 *
 * Qué contiene: un microsite por cada promoción "active" (tanto del listado
 * `promotions` como `developerOnlyPromotions`). Además varios en estado
 * "draft" u "offline" para probar UI de estados.
 *
 * Relación con el dominio:
 *   - Cada microsite hereda su `promotionId` de `Promotion.id`.
 *   - El slug se genera a partir del nombre de la promoción.
 *   - Los microsites con `status === "active"` tienen URL pública
 *     `byvaro.com/<slug>` (o `customDomain` si existe).
 *
 * Este archivo se consumirá desde `/microsites` para listar, editar tema,
 * configurar dominio, ver analytics y generar previews.
 *
 * TODO(backend): GET /api/v1/microsites — devuelve lista por `companyId`.
 * TODO(backend): PATCH /api/v1/microsites/:id/theme — persiste tema.
 * TODO(backend): POST /api/v1/microsites/:id/domain — registra custom domain
 *   + pide verificación DNS (TXT challenge).
 */

import { promotions } from "./promotions";
import { developerOnlyPromotions } from "./developerPromotions";

export type MicrositeStatus = "active" | "draft" | "offline";
export type MicrositeFont = "inter" | "playfair" | "manrope";
export type MicrositeHeroLayout = "minimal" | "hero-left" | "hero-full";

export type MicrositeTheme = {
  colorPrimary: string;       // HSL string "220 70% 50%"
  font: MicrositeFont;
  heroLayout: MicrositeHeroLayout;
};

export type MicrositeSeo = {
  title: string;
  description: string;
  ogImage: string;
};

export type AnalyticsSource = { name: string; count: number };
export type DeviceBreakdown = { desktop: number; mobile: number; tablet: number };

export type MicrositeAnalytics = {
  visits30d: number;
  uniqueVisitors30d: number;
  avgDuration: number; // en segundos
  topSources: AnalyticsSource[];
  conversionRate: number; // porcentaje (0-100)
  devices: DeviceBreakdown; // porcentajes (suman 100)
  bounceRate: number; // porcentaje (0-100)
  trend30d: number[]; // 30 puntos para sparkline de visitas
};

export type Microsite = {
  id: string;
  promotionId: string;
  slug: string;
  customDomain?: string;
  status: MicrositeStatus;
  theme: MicrositeTheme;
  seo: MicrositeSeo;
  analytics: MicrositeAnalytics;
  publishedAt: string;   // ISO-8601
  lastEditedAt: string;  // ISO-8601
};

/* ──────────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────────── */

/** "Altea Hills Residences" → "altea-hills-residences" */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")     // quita tildes
    .replace(/[^a-z0-9\s-]/g, "")         // quita símbolos
    .trim()
    .replace(/\s+/g, "-")                  // espacios → -
    .replace(/-+/g, "-");                  // colapsa guiones
}

/** Genera un trend aleatorio pero determinista por ID (con seed) */
function seededTrend(seed: number, days: number, base: number, variance: number): number[] {
  const out: number[] = [];
  let s = seed;
  for (let i = 0; i < days; i++) {
    // LCG simple determinista
    s = (s * 9301 + 49297) % 233280;
    const noise = (s / 233280 - 0.5) * variance;
    out.push(Math.max(0, Math.round(base + noise + Math.sin(i / 4) * variance * 0.3)));
  }
  return out;
}

/** Paleta de colores primarios preset (HSL) usados por defecto */
export const BRAND_PRESETS: { value: string; label: string }[] = [
  { value: "215 72% 55%", label: "Azul Byvaro" },
  { value: "16 85% 55%",  label: "Terracota" },
  { value: "150 45% 40%", label: "Verde bosque" },
  { value: "260 60% 55%", label: "Índigo" },
  { value: "340 70% 52%", label: "Magenta" },
  { value: "35 85% 50%",  label: "Ámbar" },
];

export const FONT_OPTIONS: { value: MicrositeFont; label: string; sample: string }[] = [
  { value: "inter",    label: "Inter",    sample: "Moderno y neutro" },
  { value: "playfair", label: "Playfair", sample: "Editorial · lujo" },
  { value: "manrope",  label: "Manrope",  sample: "Geométrico · tech" },
];

export const HERO_LAYOUT_OPTIONS: { value: MicrositeHeroLayout; label: string; description: string }[] = [
  { value: "minimal",   label: "Minimal",   description: "Foto principal centrada con texto superpuesto" },
  { value: "hero-left", label: "Hero split", description: "Foto a la derecha, texto y CTA a la izquierda" },
  { value: "hero-full", label: "Hero full",  description: "Galería full-bleed con navegación inferior" },
];

/* ──────────────────────────────────────────────────────────────────
   Construcción del dataset
   ────────────────────────────────────────────────────────────────── */

/** Combinado de ambos datasets. Un microsite por promoción con imagen. */
const allPromos = [
  ...developerOnlyPromotions.map(p => ({
    id: p.id,
    name: p.name,
    image: p.image,
    status: p.status,
  })),
  ...promotions.map(p => ({
    id: p.id,
    name: p.name,
    image: p.image,
    status: p.status,
  })),
].filter(p => p.name && p.image); // hace falta foto para el microsite

/** Configuración manual de overrides por promoción (temas alternativos,
 *  custom domains, estados concretos). El resto se rellena por defecto. */
const manualOverrides: Record<string, Partial<Microsite>> = {
  "1": {
    customDomain: "alteahills.com",
    theme: { colorPrimary: "16 85% 55%", font: "playfair", heroLayout: "hero-full" },
  },
  "2": {
    customDomain: "marinabay-malaga.com",
    theme: { colorPrimary: "215 72% 55%", font: "inter", heroLayout: "hero-left" },
  },
  "3": {
    theme: { colorPrimary: "150 45% 40%", font: "playfair", heroLayout: "hero-full" },
  },
  "4": {
    customDomain: "skyline-valencia.com",
  },
  "dev-1": {
    theme: { colorPrimary: "340 70% 52%", font: "playfair", heroLayout: "minimal" },
    customDomain: "villa-serena.com",
  },
  "dev-2": {
    theme: { colorPrimary: "150 45% 40%", font: "manrope", heroLayout: "hero-left" },
  },
  "dev-3": {
    status: "draft" as MicrositeStatus,
  },
  "dev-4": {
    status: "draft" as MicrositeStatus,
  },
  "dev-5": {
    theme: { colorPrimary: "260 60% 55%", font: "inter", heroLayout: "hero-full" },
  },
  "8": {
    status: "offline" as MicrositeStatus, // sold-out → microsite apagado
  },
};

export const microsites: Microsite[] = allPromos.map((p, idx) => {
  const slug = slugify(p.name);
  const override = manualOverrides[p.id] || {};

  // Base status: el promo incomplete/sold-out tira a draft/offline salvo override
  let status: MicrositeStatus = "active";
  if (p.status === "incomplete") status = "draft";
  if (p.status === "sold-out") status = "offline";
  if (override.status) status = override.status;

  const seed = idx * 37 + 1;
  const baseVisits = status === "active" ? 280 + (seed % 600) : 60 + (seed % 120);
  const visits30d = baseVisits * 30;
  const uniqueVisitors30d = Math.round(visits30d * 0.62);
  const avgDuration = 70 + (seed % 180); // 70-250s
  const conversionRate = status === "active" ? 1.2 + ((seed % 38) / 10) : 0.4 + ((seed % 10) / 10);

  const publishedDays = 14 + (seed % 180);
  const editedDays = seed % 12;

  return {
    id: `ms-${p.id}`,
    promotionId: p.id,
    slug,
    customDomain: override.customDomain,
    status,
    theme: override.theme ?? {
      colorPrimary: BRAND_PRESETS[idx % BRAND_PRESETS.length].value,
      font: FONT_OPTIONS[idx % FONT_OPTIONS.length].value,
      heroLayout: HERO_LAYOUT_OPTIONS[idx % HERO_LAYOUT_OPTIONS.length].value,
    },
    seo: {
      title: `${p.name} · Obra nueva de lujo`,
      description: `Descubre ${p.name}: unidades disponibles, galería, ubicación y reserva online. Ficha técnica completa y solicitud de información directa al promotor.`,
      ogImage: p.image!,
    },
    analytics: {
      visits30d,
      uniqueVisitors30d,
      avgDuration,
      topSources: [
        { name: "Directo",  count: Math.round(visits30d * 0.34) },
        { name: "Google",   count: Math.round(visits30d * 0.29) },
        { name: "Instagram", count: Math.round(visits30d * 0.15) },
        { name: "Idealista", count: Math.round(visits30d * 0.12) },
        { name: "Otros",    count: Math.round(visits30d * 0.10) },
      ],
      conversionRate: Math.round(conversionRate * 10) / 10,
      devices: {
        mobile: 58 + (seed % 12),
        desktop: 30 - (seed % 8),
        tablet: 100 - (58 + (seed % 12)) - (30 - (seed % 8)),
      },
      bounceRate: 32 + (seed % 28),
      trend30d: seededTrend(seed, 30, baseVisits, baseVisits * 0.4),
    },
    publishedAt: new Date(Date.now() - publishedDays * 86400000).toISOString(),
    lastEditedAt: new Date(Date.now() - editedDays * 86400000).toISOString(),
  };
});

/** Aggregate helpers */
export function countActiveMicrosites(): number {
  return microsites.filter(m => m.status === "active").length;
}

export function sumVisits30d(): number {
  return microsites.reduce((acc, m) => acc + m.analytics.visits30d, 0);
}

export function averageConversionRate(): number {
  const actives = microsites.filter(m => m.status === "active");
  if (actives.length === 0) return 0;
  const avg = actives.reduce((a, m) => a + m.analytics.conversionRate, 0) / actives.length;
  return Math.round(avg * 10) / 10;
}

export function countCustomDomains(): number {
  return microsites.filter(m => m.customDomain && m.status === "active").length;
}

/** Branding global (singleton por promotor). Se aplica por defecto a todos
 *  los microsites nuevos. Editable desde el modal "Configurar branding". */
export type GlobalBranding = {
  logoUrl?: string;
  companyName: string;
  colorPrimary: string; // HSL "H S% L%"
  font: MicrositeFont;
};

export const defaultBranding: GlobalBranding = {
  companyName: "",
  colorPrimary: "215 72% 55%",
  font: "inter",
};
