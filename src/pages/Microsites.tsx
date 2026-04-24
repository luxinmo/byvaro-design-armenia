/**
 * Microsites · listado (Vista Promotor)
 *
 * QUÉ HACE
 * ────────
 * Centraliza todos los microsites que Byvaro auto-genera por cada promoción.
 * El promotor ve aquí cuántos tiene activos, su tráfico agregado, puede
 * configurar el branding global de su empresa, editar tema/SEO/dominio por
 * microsite y abrir la vista pública.
 *
 * CÓMO SE USA
 * ───────────
 * - Ruta: `/microsites` (montado en AppLayout).
 * - Mock data: `src/data/microsites.ts`.
 * - Diferencial P0 del producto: cada promoción activa genera un microsite
 *   público (ver `docs/product.md` → "Web de la promoción incluida").
 *
 * COMPONENTES
 * ───────────
 * - Cabecera con eyebrow, H1, contador y CTA "Configurar branding"
 * - 4 KPI cards (activos, visitas 30d, conversión media, dominios propios)
 * - Grid de cards (1 / 2 / 3 columnas según breakpoint)
 * - Sheet lateral `MicrositeEditor` (Tema / SEO / Dominio / Analytics)
 * - Dialog `BrandingDialog` (ajustes globales aplicables a todos)
 *
 * TODO(backend): ver endpoints en `docs/screens/microsites.md`.
 */

import { useMemo, useState } from "react";
import {
  Globe, ExternalLink, Copy, Check, Eye, MoreHorizontal,
  TrendingUp, Sparkles, Pencil, Palette, Search, Server, BarChart3,
  Smartphone, Monitor, Tablet, Type, LayoutTemplate,
  Image as ImageIcon, Upload, AlertTriangle,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import {
  microsites as initialMicrosites,
  countActiveMicrosites,
  sumVisits30d,
  averageConversionRate,
  countCustomDomains,
  BRAND_PRESETS,
  FONT_OPTIONS,
  HERO_LAYOUT_OPTIONS,
  defaultBranding,
  slugify,
  type Microsite,
  type MicrositeFont,
  type MicrositeHeroLayout,
  type MicrositeStatus,
  type GlobalBranding,
} from "@/data/microsites";
import { promotions } from "@/data/promotions";
import { developerOnlyPromotions } from "@/data/developerPromotions";
import { Tag } from "@/components/ui/Tag";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { formatDistanceToNowStrict } from "date-fns";
import { es } from "date-fns/locale";

/* ═══════════════════════════════════════════════════════════════════
   Helpers de presentación
   ═══════════════════════════════════════════════════════════════════ */

const allPromos = [...developerOnlyPromotions, ...promotions];
function promoById(id: string) {
  return allPromos.find(p => p.id === id);
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("es-ES").format(n);
}

function statusTag(status: MicrositeStatus): { label: string; variant: "success" | "warning" | "muted" } {
  if (status === "active")  return { label: "Activo",   variant: "success" };
  if (status === "draft")   return { label: "Borrador", variant: "warning" };
  return { label: "Offline", variant: "muted" };
}

/** hsl() envuelto para usar como CSS color a partir del token "H S% L%" */
function hsl(token: string, alpha = 1): string {
  return alpha === 1 ? `hsl(${token})` : `hsl(${token} / ${alpha})`;
}

/* ═══════════════════════════════════════════════════════════════════
   Sparkline inline (para KPIs)
   ═══════════════════════════════════════════════════════════════════ */
function Sparkline({ data, className }: { data: number[]; className?: string }) {
  const { poly, area } = useMemo(() => {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const w = 72;
    const h = 24;
    const step = w / Math.max(1, data.length - 1);
    const pts = data.map((v, i) => `${i * step},${h - ((v - min) / range) * h}`);
    return { poly: pts.join(" "), area: `0,${h} ${pts.join(" ")} ${w},${h}` };
  }, [data]);
  return (
    <svg width="72" height="24" viewBox="0 0 72 24" className={cn("overflow-visible", className)}>
      <polygon points={area} fill="currentColor" opacity="0.12" />
      <polyline points={poly} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PÁGINA
   ═══════════════════════════════════════════════════════════════════ */
export default function Microsites() {
  const [sites, setSites] = useState<Microsite[]>(initialMicrosites);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [brandingOpen, setBrandingOpen] = useState(false);
  const [branding, setBranding] = useState<GlobalBranding>(defaultBranding);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | MicrositeStatus>("all");

  const editing = sites.find(s => s.id === editingId) ?? null;

  /* ─── KPI aggregate numbers ─── */
  const kpis = useMemo(() => ({
    active: countActiveMicrosites(),
    visits: sumVisits30d(),
    conversion: averageConversionRate(),
    domains: countCustomDomains(),
  }), []);

  /* ─── filtrado por status ─── */
  const filtered = useMemo(() => {
    if (statusFilter === "all") return sites;
    return sites.filter(s => s.status === statusFilter);
  }, [sites, statusFilter]);

  /* ─── helper: copiar URL pública ─── */
  const copyUrl = async (site: Microsite) => {
    const url = site.customDomain ? `https://${site.customDomain}` : `https://byvaro.com/${site.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedSlug(site.id);
      toast.success("URL copiada al portapapeles");
      setTimeout(() => setCopiedSlug(null), 1800);
    } catch {
      toast.error("No se pudo copiar la URL");
    }
  };

  /* ─── actualizar un microsite concreto (inmutable) ─── */
  const updateSite = (id: string, patch: Partial<Microsite>) => {
    setSites(prev => prev.map(s => s.id === id ? { ...s, ...patch, lastEditedAt: new Date().toISOString() } : s));
    // TODO(backend): PATCH /api/v1/microsites/:id con el patch
  };

  return (
    <div className="flex flex-col min-h-full bg-background">
      <Toaster richColors position="top-right" />

      {/* ═══════════ HEADER ═══════════ */}
      <div className="px-3 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-4">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground leading-none">Contenido</p>
            <div className="flex items-baseline gap-3 mt-1">
              <h1 className="text-[19px] sm:text-[22px] font-bold tracking-tight leading-tight">Microsites</h1>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground tabular-nums">{kpis.active}</span> activos
                <span className="mx-1.5 text-border">·</span>
                <span className="tabular-nums">{sites.length}</span> totales
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBrandingOpen(true)}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors shadow-soft"
            >
              <Palette className="h-3.5 w-3.5" />
              Configurar branding
            </button>
          </div>
        </div>
      </div>

      <div className="h-px bg-border/60" />

      {/* ═══════════ CONTENIDO ═══════════ */}
      <div className="px-3 sm:px-6 lg:px-8 py-5 sm:py-6 space-y-5 sm:space-y-6 flex-1">
        <div className="max-w-[1400px] mx-auto space-y-5 sm:space-y-6">

          {/* ─── KPIs ─── */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <KpiCard
              icon={Globe}
              label="Microsites activos"
              value={formatNumber(kpis.active)}
              delta={`${sites.length - kpis.active} en pausa`}
              deltaTone="neutral"
              iconTone="bg-primary/10"
              iconColor="text-primary"
              sparkColor="text-primary"
              trend={[6, 7, 8, 9, 10, 11, kpis.active]}
            />
            <KpiCard
              icon={Eye}
              label="Visitas · 30 días"
              value={formatNumber(kpis.visits)}
              delta="+21%"
              deltaTone="positive"
              iconTone="bg-violet-500/10"
              iconColor="text-violet-600"
              sparkColor="text-violet-500"
              trend={[
                kpis.visits * 0.6, kpis.visits * 0.7, kpis.visits * 0.75,
                kpis.visits * 0.85, kpis.visits * 0.9, kpis.visits * 0.95, kpis.visits,
              ]}
            />
            <KpiCard
              icon={TrendingUp}
              label="Conversión media"
              value={`${kpis.conversion.toLocaleString("es-ES")}%`}
              delta="+0,4 pts"
              deltaTone="positive"
              iconTone="bg-success/10"
              iconColor="text-success"
              sparkColor="text-success"
              trend={[2.1, 2.3, 2.4, 2.5, 2.7, 2.9, kpis.conversion]}
            />
            <KpiCard
              icon={Server}
              label="Dominios propios"
              value={formatNumber(kpis.domains)}
              delta={`${kpis.active - kpis.domains} con subdominio`}
              deltaTone="neutral"
              iconTone="bg-warning/10"
              iconColor="text-warning"
              sparkColor="text-warning"
              trend={[1, 1, 2, 2, 3, 3, kpis.domains]}
            />
          </section>

          {/* ─── Status tabs ─── */}
          <div className="flex items-center gap-0.5">
            <StatusPill active={statusFilter === "all"}     onClick={() => setStatusFilter("all")}     label="Todos" count={sites.length} />
            <StatusPill active={statusFilter === "active"}  onClick={() => setStatusFilter("active")}  label="Activos" count={sites.filter(s => s.status === "active").length} />
            <StatusPill active={statusFilter === "draft"}   onClick={() => setStatusFilter("draft")}   label="Borrador" count={sites.filter(s => s.status === "draft").length} />
            <StatusPill active={statusFilter === "offline"} onClick={() => setStatusFilter("offline")} label="Offline" count={sites.filter(s => s.status === "offline").length} />
          </div>

          {/* ─── Grid de microsites ─── */}
          {filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
              {filtered.map(site => (
                <MicrositeCard
                  key={site.id}
                  site={site}
                  copied={copiedSlug === site.id}
                  onCopy={() => copyUrl(site)}
                  onEdit={() => setEditingId(site.id)}
                  onPreview={() => toast.info("Abriendo vista previa (mock)")}
                />
              ))}
            </div>
          )}

        </div>
      </div>

      {/* ═══════════ EDITOR (Sheet derecho · fullscreen móvil) ═══════════ */}
      <MicrositeEditor
        site={editing}
        onClose={() => setEditingId(null)}
        onPatch={(patch) => editing && updateSite(editing.id, patch)}
      />

      {/* ═══════════ MODAL BRANDING GLOBAL ═══════════ */}
      <BrandingDialog
        open={brandingOpen}
        onClose={() => setBrandingOpen(false)}
        branding={branding}
        onSave={(next) => {
          setBranding(next);
          setBrandingOpen(false);
          toast.success("Branding global guardado");
        }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   KPI CARD
   ═══════════════════════════════════════════════════════════════════ */
function KpiCard({
  icon: Icon, label, value, delta, deltaTone = "positive", iconTone, iconColor, sparkColor, trend,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  delta?: string;
  deltaTone?: "positive" | "neutral" | "primary";
  iconTone: string;
  iconColor: string;
  sparkColor: string;
  trend: number[];
}) {
  return (
    <div className="group relative bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between mb-3.5">
        <div className={cn("h-9 w-9 rounded-xl grid place-items-center shrink-0", iconTone)}>
          <Icon className={cn("h-4 w-4", iconColor)} />
        </div>
        <Sparkline data={trend} className={cn("opacity-70 group-hover:opacity-100 transition-opacity", sparkColor)} />
      </div>
      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</p>
      <div className="flex items-baseline gap-2 mt-1.5">
        <p className="text-[26px] sm:text-[28px] font-bold leading-none tabular-nums tracking-tight">{value}</p>
        {delta && (
          <span className={cn(
            "text-[11px] font-semibold tabular-nums inline-flex items-center gap-0.5",
            deltaTone === "positive" && "text-success",
            deltaTone === "neutral"  && "text-muted-foreground",
            deltaTone === "primary"  && "text-primary"
          )}>
            {deltaTone === "positive" && <TrendingUp className="h-3 w-3" />}
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   STATUS PILL (tabs)
   ═══════════════════════════════════════════════════════════════════ */
function StatusPill({
  active, onClick, label, count,
}: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-[12.5px] font-medium transition-colors whitespace-nowrap inline-flex items-center gap-1.5",
        active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
      )}
    >
      {label}
      <span className={cn("tabular-nums text-[11px]", active ? "text-background/70" : "text-muted-foreground/70")}>
        {count}
      </span>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MICROSITE CARD
   ═══════════════════════════════════════════════════════════════════ */
function MicrositeCard({
  site, copied, onCopy, onEdit, onPreview,
}: {
  site: Microsite;
  copied: boolean;
  onCopy: () => void;
  onEdit: () => void;
  onPreview: () => void;
}) {
  const promo = promoById(site.promotionId);
  const status = statusTag(site.status);
  const url = site.customDomain ?? `byvaro.com/${site.slug}`;

  return (
    <article className="group bg-card border border-border rounded-2xl overflow-hidden shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col">

      {/* Screenshot simulado 16:9 · gradient con color del tema + nombre */}
      <div
        className="relative aspect-[16/9] w-full overflow-hidden"
        style={{
          backgroundImage: promo?.image
            ? `linear-gradient(135deg, ${hsl(site.theme.colorPrimary, 0.72)}, ${hsl(site.theme.colorPrimary, 0.2)}), url(${promo.image})`
            : `linear-gradient(135deg, ${hsl(site.theme.colorPrimary)}, ${hsl(site.theme.colorPrimary, 0.4)})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundBlendMode: "multiply",
        }}
      >
        {/* Status + layout badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          <Tag variant={status.variant} size="sm" shape="pill" className="shadow-soft">
            <span className={cn(
              "h-1.5 w-1.5 rounded-full",
              site.status === "active"  && "bg-success",
              site.status === "draft"   && "bg-warning",
              site.status === "offline" && "bg-muted-foreground/60",
            )} />
            {status.label}
          </Tag>
        </div>
        {site.customDomain && (
          <div className="absolute top-3 right-3">
            <Tag variant="overlay" size="sm" shape="pill" className="shadow-soft">
              <Server className="h-3 w-3" /> Dominio propio
            </Tag>
          </div>
        )}
        {/* Nombre superpuesto (simulando hero del microsite) */}
        <div className="absolute bottom-3 left-3 right-3 text-white">
          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-white/80">
            {site.theme.heroLayout === "minimal" && "Minimal"}
            {site.theme.heroLayout === "hero-left" && "Hero split"}
            {site.theme.heroLayout === "hero-full" && "Hero full"}
          </p>
          <h3 className={cn(
            "text-[17px] font-bold leading-tight truncate mt-0.5 drop-shadow-sm",
            site.theme.font === "playfair" && "font-serif",
          )}>
            {promo?.name ?? "Microsite"}
          </h3>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-4 sm:p-5 flex flex-col">
        {/* URL + copy */}
        <button
          onClick={onCopy}
          className="group/url inline-flex items-center gap-1.5 text-xs font-medium text-foreground/80 hover:text-foreground transition-colors w-full min-w-0"
          aria-label="Copiar URL"
        >
          <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{url}</span>
          {copied ? (
            <Check className="h-3.5 w-3.5 shrink-0 text-success" strokeWidth={2.5} />
          ) : (
            <Copy className="h-3.5 w-3.5 shrink-0 opacity-40 group-hover/url:opacity-100 transition-opacity" />
          )}
        </button>

        {/* Mini KPIs */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <MiniKpi label="Visitas"     value={formatNumber(site.analytics.visits30d)}          />
          <MiniKpi label="Únicos"      value={formatNumber(site.analytics.uniqueVisitors30d)} />
          <MiniKpi label="Conversión"  value={`${site.analytics.conversionRate}%`}            tone="emerald" />
        </div>

        {/* Footer · acciones */}
        <div className="mt-4 pt-3 border-t border-border/40 flex items-center gap-1.5">
          <button
            onClick={onPreview}
            className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-full border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            Vista previa
          </button>
          <button
            onClick={onEdit}
            className="inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-full bg-foreground text-background text-xs font-medium hover:bg-foreground/90 transition-colors"
          >
            <Pencil className="h-3 w-3" />
            Editar
          </button>
          <button
            onClick={() => toast.info("Más opciones (mock)")}
            aria-label="Más opciones"
            className="ml-auto h-8 w-8 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>

        {/* Last edited */}
        <p className="text-[11px] text-muted-foreground mt-2.5">
          Editado hace {formatDistanceToNowStrict(new Date(site.lastEditedAt), { locale: es })}
        </p>
      </div>
    </article>
  );
}

function MiniKpi({ label, value, tone }: { label: string; value: string; tone?: "emerald" }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</p>
      <p className={cn("text-sm font-bold tabular-nums mt-0.5", tone === "emerald" && "text-success")}>
        {value}
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   EMPTY STATE
   ═══════════════════════════════════════════════════════════════════ */
function EmptyState() {
  return (
    <div className="py-20 text-center border border-dashed border-border rounded-2xl bg-muted/10">
      <div className="h-12 w-12 rounded-2xl bg-muted grid place-items-center mx-auto mb-4">
        <Globe className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold">Sin microsites en este estado</h3>
      <p className="text-[12.5px] text-muted-foreground mt-1">Cambia el filtro o crea una promoción para generar uno nuevo.</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MICROSITE EDITOR · Sheet derecho (fullscreen móvil)
   ═══════════════════════════════════════════════════════════════════ */
function MicrositeEditor({
  site, onClose, onPatch,
}: {
  site: Microsite | null;
  onClose: () => void;
  onPatch: (patch: Partial<Microsite>) => void;
}) {
  const promo = site ? promoById(site.promotionId) : null;

  return (
    <Sheet open={!!site} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side="right"
        className="w-full sm:w-[520px] sm:max-w-[520px] p-0 flex flex-col bg-background border-l border-border shadow-soft-lg"
      >
        {site && promo && (
          <>
            {/* Header */}
            <SheetHeader className="h-16 shrink-0 px-5 border-b border-border flex-row items-center gap-3 space-y-0 pr-14">
              <div
                className="h-9 w-9 rounded-xl shrink-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${promo.image})` }}
              />
              <div className="min-w-0 flex-1 text-left">
                <SheetTitle className="text-[14px] font-semibold truncate leading-tight">{promo.name}</SheetTitle>
                <p className="text-[11.5px] text-muted-foreground truncate">
                  {site.customDomain ?? `byvaro.com/${site.slug}`}
                </p>
              </div>
            </SheetHeader>

            {/* Tabs body */}
            <Tabs defaultValue="tema" className="flex-1 flex flex-col min-h-0">
              <TabsList className="h-auto bg-transparent p-0 px-5 border-b border-border rounded-none justify-start gap-1">
                <EditorTabTrigger value="tema"      icon={<Palette className="h-3.5 w-3.5" />}     label="Tema" />
                <EditorTabTrigger value="seo"       icon={<Search className="h-3.5 w-3.5" />}      label="SEO" />
                <EditorTabTrigger value="dominio"   icon={<Server className="h-3.5 w-3.5" />}      label="Dominio" />
                <EditorTabTrigger value="analytics" icon={<BarChart3 className="h-3.5 w-3.5" />}   label="Analytics" />
              </TabsList>

              <div className="flex-1 overflow-y-auto">
                <TabsContent value="tema"      className="p-5 mt-0 focus-visible:ring-0"><ThemeTab      site={site} onPatch={onPatch} /></TabsContent>
                <TabsContent value="seo"       className="p-5 mt-0 focus-visible:ring-0"><SeoTab        site={site} onPatch={onPatch} /></TabsContent>
                <TabsContent value="dominio"   className="p-5 mt-0 focus-visible:ring-0"><DomainTab     site={site} onPatch={onPatch} /></TabsContent>
                <TabsContent value="analytics" className="p-5 mt-0 focus-visible:ring-0"><AnalyticsTab  site={site} /></TabsContent>
              </div>
            </Tabs>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function EditorTabTrigger({ value, icon, label }: { value: string; icon: React.ReactNode; label: string }) {
  return (
    <TabsTrigger
      value={value}
      className={cn(
        "relative inline-flex items-center gap-1.5 px-1 pt-3 pb-3 h-auto rounded-none bg-transparent",
        "text-muted-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none",
        "data-[state=active]:text-foreground text-[13px] font-medium transition-colors",
        "after:absolute after:inset-x-1 after:bottom-[-1px] after:h-[2px] after:rounded-full",
        "after:bg-foreground after:scale-x-0 data-[state=active]:after:scale-x-100 after:origin-left after:transition-transform",
        "mr-4"
      )}
    >
      {icon}
      {label}
    </TabsTrigger>
  );
}

/* ════════ THEME TAB ════════ */
function ThemeTab({ site, onPatch }: { site: Microsite; onPatch: (p: Partial<Microsite>) => void }) {
  const [customColor, setCustomColor] = useState<string>("");

  const setTheme = (patch: Partial<Microsite["theme"]>) => {
    onPatch({ theme: { ...site.theme, ...patch } });
  };

  return (
    <div className="space-y-6">
      {/* Color primario */}
      <div>
        <SectionLabel icon={<Palette className="h-3.5 w-3.5" />} title="Color primario" description="Se usa en botones, enlaces y acentos del microsite" />
        <div className="grid grid-cols-6 gap-2 mt-3">
          {BRAND_PRESETS.map(p => {
            const active = site.theme.colorPrimary === p.value;
            return (
              <button
                key={p.value}
                onClick={() => setTheme({ colorPrimary: p.value })}
                className={cn(
                  "relative aspect-square rounded-xl border transition-all",
                  active ? "border-foreground ring-2 ring-foreground/20" : "border-border hover:border-foreground/30"
                )}
                style={{ backgroundColor: hsl(p.value) }}
                title={p.label}
                aria-label={p.label}
              >
                {active && <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow" strokeWidth={3} />}
              </button>
            );
          })}
        </div>
        {/* Custom color: acepta HSL tokens libres */}
        <div className="flex items-center gap-2 mt-3">
          <input
            type="text"
            value={customColor}
            onChange={(e) => setCustomColor(e.target.value)}
            placeholder="Ej. 220 70% 50% (HSL)"
            className="flex-1 h-9 px-3 text-[13px] bg-card border border-border rounded-xl focus:border-primary outline-none transition-colors"
          />
          <button
            onClick={() => {
              if (/^\d+\s\d+%\s\d+%$/.test(customColor.trim())) {
                setTheme({ colorPrimary: customColor.trim() });
                toast.success("Color personalizado aplicado");
                setCustomColor("");
              } else {
                toast.error("Formato HSL inválido. Usa \"H S% L%\"");
              }
            }}
            className="h-9 px-4 rounded-full bg-foreground text-background text-[13px] font-medium hover:bg-foreground/90 transition-colors"
          >
            Aplicar
          </button>
        </div>
      </div>

      <Divider />

      {/* Fuente */}
      <div>
        <SectionLabel icon={<Type className="h-3.5 w-3.5" />} title="Tipografía" description="Fuente para títulos y cuerpo del microsite" />
        <div className="grid grid-cols-1 gap-2 mt-3">
          {FONT_OPTIONS.map(f => {
            const active = site.theme.font === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setTheme({ font: f.value as MicrositeFont })}
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl border transition-colors text-left",
                  active ? "bg-primary/5 border-primary/30" : "bg-card border-border hover:border-foreground/30"
                )}
              >
                <div>
                  <p className={cn(
                    "text-[15px] font-bold",
                    f.value === "playfair" && "font-serif",
                    f.value === "manrope"  && "tracking-tight",
                  )}>
                    {f.label}
                  </p>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5">{f.sample}</p>
                </div>
                {active && <Check className="h-4 w-4 text-primary" strokeWidth={2.5} />}
              </button>
            );
          })}
        </div>
      </div>

      <Divider />

      {/* Hero layout */}
      <div>
        <SectionLabel icon={<LayoutTemplate className="h-3.5 w-3.5" />} title="Layout del hero" description="Cómo se presenta la foto principal" />
        <div className="grid grid-cols-3 gap-2 mt-3">
          {HERO_LAYOUT_OPTIONS.map(l => {
            const active = site.theme.heroLayout === l.value;
            return (
              <button
                key={l.value}
                onClick={() => setTheme({ heroLayout: l.value as MicrositeHeroLayout })}
                className={cn(
                  "flex flex-col gap-2 p-2 rounded-xl border transition-colors text-left",
                  active ? "border-primary/40 bg-primary/5" : "border-border hover:border-foreground/30"
                )}
              >
                <HeroLayoutPreview layout={l.value} primary={site.theme.colorPrimary} />
                <div className="px-1">
                  <p className="text-[12.5px] font-semibold text-foreground leading-tight">{l.label}</p>
                  <p className="text-[10.5px] text-muted-foreground mt-0.5 leading-tight">{l.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function HeroLayoutPreview({ layout, primary }: { layout: MicrositeHeroLayout; primary: string }) {
  const bg = hsl(primary);
  const muted = hsl(primary, 0.2);
  if (layout === "minimal") {
    return (
      <div className="aspect-[5/3] rounded-lg bg-muted/40 border border-border/60 p-2 flex flex-col items-center justify-center gap-1">
        <div className="h-1.5 w-10 rounded-full" style={{ background: bg }} />
        <div className="h-1 w-14 rounded-full bg-muted" />
        <div className="h-1 w-8 rounded-full bg-muted" />
      </div>
    );
  }
  if (layout === "hero-left") {
    return (
      <div className="aspect-[5/3] rounded-lg bg-muted/40 border border-border/60 p-2 flex gap-1.5">
        <div className="flex-1 flex flex-col justify-center gap-1">
          <div className="h-1.5 w-10 rounded-full" style={{ background: bg }} />
          <div className="h-1 w-full rounded-full bg-muted" />
          <div className="h-1 w-3/4 rounded-full bg-muted" />
        </div>
        <div className="flex-1 rounded" style={{ background: muted }} />
      </div>
    );
  }
  return (
    <div className="aspect-[5/3] rounded-lg border border-border/60 p-1.5 flex flex-col justify-end" style={{ background: muted }}>
      <div className="h-1.5 w-12 rounded-full" style={{ background: bg }} />
      <div className="h-1 w-full rounded-full bg-white/80 mt-1" />
    </div>
  );
}

/* ════════ SEO TAB ════════ */
function SeoTab({ site, onPatch }: { site: Microsite; onPatch: (p: Partial<Microsite>) => void }) {
  const setSeo = (patch: Partial<Microsite["seo"]>) => {
    onPatch({ seo: { ...site.seo, ...patch } });
  };

  return (
    <div className="space-y-6">
      {/* Google preview */}
      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">Previsualización Google</p>
        <div className="bg-background rounded-lg p-3 border border-border/40">
          <p className="text-[12px] text-success truncate">
            https://{site.customDomain ?? `byvaro.com/${site.slug}`}
          </p>
          <p className="text-[15px] text-[#1a0dab] hover:underline cursor-pointer truncate mt-0.5">
            {site.seo.title || "Sin título"}
          </p>
          <p className="text-[12px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">
            {site.seo.description || "Sin descripción"}
          </p>
        </div>
      </div>

      <div>
        <FieldLabel label="Título SEO" hint={`${site.seo.title.length}/60`} warn={site.seo.title.length > 60} />
        <input
          type="text"
          value={site.seo.title}
          maxLength={80}
          onChange={(e) => setSeo({ title: e.target.value })}
          className="w-full h-9 px-3 text-[13px] bg-card border border-border rounded-xl focus:border-primary outline-none transition-colors"
        />
      </div>

      <div>
        <FieldLabel label="Meta descripción" hint={`${site.seo.description.length}/160`} warn={site.seo.description.length > 160} />
        <textarea
          rows={3}
          value={site.seo.description}
          maxLength={200}
          onChange={(e) => setSeo({ description: e.target.value })}
          className="w-full px-3 py-2 text-[13px] bg-card border border-border rounded-xl focus:border-primary outline-none transition-colors resize-none"
        />
      </div>

      <div>
        <FieldLabel label="Imagen Open Graph" hint="Se usa al compartir en redes (1200×630px recomendado)" />
        <div className="rounded-xl overflow-hidden border border-border bg-muted/20">
          <div
            className="aspect-[1200/630] bg-cover bg-center"
            style={{ backgroundImage: `url(${site.seo.ogImage})` }}
          />
          <div className="p-3 flex items-center justify-between gap-3">
            <p className="text-[12px] text-muted-foreground truncate">{site.seo.ogImage}</p>
            <button
              onClick={() => toast.info("Seleccionar imagen (mock)")}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-border bg-card text-xs font-medium hover:bg-muted transition-colors shrink-0"
            >
              <Upload className="h-3 w-3" /> Cambiar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════ DOMAIN TAB ════════ */
function DomainTab({ site, onPatch }: { site: Microsite; onPatch: (p: Partial<Microsite>) => void }) {
  const [domain, setDomain] = useState(site.customDomain ?? "");
  const connected = !!site.customDomain;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Dominio por defecto</p>
        <p className="text-[15px] font-semibold mt-1">byvaro.com/{site.slug}</p>
        <p className="text-[12px] text-muted-foreground mt-1">Este dominio siempre está disponible y no requiere configuración.</p>
      </div>

      <div>
        <SectionLabel icon={<Server className="h-3.5 w-3.5" />} title="Dominio propio" description="Conecta un dominio de tu propiedad (ej. altahills.com)" />
        <div className="flex items-center gap-2 mt-3">
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value.trim())}
            placeholder="tudominio.com"
            className="flex-1 h-9 px-3 text-[13px] bg-card border border-border rounded-xl focus:border-primary outline-none transition-colors"
          />
          {connected ? (
            <button
              onClick={() => {
                onPatch({ customDomain: undefined });
                setDomain("");
                toast.success("Dominio desconectado");
              }}
              className="h-9 px-4 rounded-full border border-destructive/30 text-destructive text-[13px] font-medium hover:bg-destructive/5 transition-colors"
            >
              Desconectar
            </button>
          ) : (
            <button
              onClick={() => {
                if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(domain)) {
                  toast.error("Introduce un dominio válido");
                  return;
                }
                onPatch({ customDomain: domain });
                toast.success("Dominio conectado. Configura los DNS para activarlo.");
              }}
              className="h-9 px-4 rounded-full bg-foreground text-background text-[13px] font-medium hover:bg-foreground/90 transition-colors"
            >
              Conectar
            </button>
          )}
        </div>

        {connected && (
          <div className="mt-4 rounded-xl border border-warning/30 bg-warning/10 p-3.5">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-semibold text-warning mb-1">Configura los DNS en tu proveedor</p>
                <p className="text-[11.5px] text-muted-foreground leading-snug">
                  Añade el siguiente registro para validar y servir el microsite:
                </p>
                <div className="mt-2 rounded-lg bg-background border border-border/60 p-2.5 font-mono text-[11.5px] space-y-1">
                  <div className="grid grid-cols-[60px_1fr] gap-2">
                    <span className="text-muted-foreground">Tipo</span><span className="font-semibold">CNAME</span>
                  </div>
                  <div className="grid grid-cols-[60px_1fr] gap-2">
                    <span className="text-muted-foreground">Host</span><span className="font-semibold">@</span>
                  </div>
                  <div className="grid grid-cols-[60px_1fr] gap-2">
                    <span className="text-muted-foreground">Valor</span><span className="font-semibold">cname.byvaro.com</span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  La propagación DNS puede tardar hasta 24 h. Verificaremos automáticamente cada 5 minutos.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════ ANALYTICS TAB ════════ */
function AnalyticsTab({ site }: { site: Microsite }) {
  const a = site.analytics;
  const totalSources = a.topSources.reduce((acc, s) => acc + s.count, 0);

  return (
    <div className="space-y-6">
      {/* Big numbers */}
      <div className="grid grid-cols-2 gap-2">
        <AnalyticsNumber label="Visitas (30 d)"  value={formatNumber(a.visits30d)} />
        <AnalyticsNumber label="Visitantes únicos" value={formatNumber(a.uniqueVisitors30d)} />
        <AnalyticsNumber label="Tiempo medio"    value={formatDuration(a.avgDuration)} />
        <AnalyticsNumber label="Conversión"       value={`${a.conversionRate}%`} tone="emerald" />
        <AnalyticsNumber label="Tasa de rebote"   value={`${a.bounceRate}%`} />
        <AnalyticsNumber label="Leads generados" value={formatNumber(Math.round(a.visits30d * a.conversionRate / 100))} />
      </div>

      {/* Fuentes de tráfico */}
      <div>
        <SectionLabel icon={<BarChart3 className="h-3.5 w-3.5" />} title="Fuentes de tráfico" description="Origen de los visitantes en los últimos 30 días" />
        <div className="mt-3 space-y-2">
          {a.topSources.map(src => {
            const pct = Math.round((src.count / totalSources) * 100);
            return (
              <div key={src.name}>
                <div className="flex items-center justify-between text-[12px] mb-1">
                  <span className="font-medium text-foreground">{src.name}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatNumber(src.count)} <span className="text-muted-foreground/60">· {pct}%</span>
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dispositivos */}
      <div>
        <SectionLabel icon={<Monitor className="h-3.5 w-3.5" />} title="Dispositivos" description="Desglose por tipo de dispositivo" />
        <div className="mt-3 grid grid-cols-3 gap-2">
          <DeviceStat icon={<Smartphone className="h-4 w-4" />} label="Mobile"  value={a.devices.mobile}  />
          <DeviceStat icon={<Monitor    className="h-4 w-4" />} label="Desktop" value={a.devices.desktop} />
          <DeviceStat icon={<Tablet     className="h-4 w-4" />} label="Tablet"  value={a.devices.tablet}  />
        </div>
      </div>
    </div>
  );
}

function AnalyticsNumber({ label, value, tone }: { label: string; value: string; tone?: "emerald" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3.5">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</p>
      <p className={cn(
        "text-[18px] font-bold tabular-nums mt-1",
        tone === "emerald" && "text-success"
      )}>
        {value}
      </p>
    </div>
  );
}

function DeviceStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-[17px] font-bold tabular-nums">{value}%</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   BRANDING DIALOG · ajustes globales
   ═══════════════════════════════════════════════════════════════════ */
function BrandingDialog({
  open, onClose, branding, onSave,
}: {
  open: boolean;
  onClose: () => void;
  branding: GlobalBranding;
  onSave: (next: GlobalBranding) => void;
}) {
  const [draft, setDraft] = useState<GlobalBranding>(branding);

  // Reset draft when opening
  useMemo(() => {
    if (open) setDraft(branding);
  }, [open, branding]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg p-0 bg-background rounded-3xl overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border space-y-1.5 pr-10">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-primary/10 grid place-items-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <DialogTitle className="text-base font-semibold">Branding global</DialogTitle>
          </div>
          <p className="text-[12.5px] text-muted-foreground">
            Estos ajustes se aplican a <strong className="text-foreground">todos los microsites</strong> que crees a partir de ahora. Los microsites existentes se pueden re-sincronizar al guardar.
          </p>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Logo uploader */}
          <div>
            <FieldLabel label="Logo de la empresa" hint="PNG / SVG · fondo transparente" />
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-xl bg-muted/40 border border-dashed border-border grid place-items-center shrink-0">
                {draft.logoUrl ? (
                  <img src={draft.logoUrl} alt="Logo" className="h-10 w-10 object-contain" />
                ) : (
                  <ImageIcon className="h-5 w-5 text-muted-foreground/60" />
                )}
              </div>
              <button
                onClick={() => toast.info("Subir logo (mock)")}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-border bg-card text-[13px] font-medium hover:bg-muted transition-colors"
              >
                <Upload className="h-3.5 w-3.5" /> Subir archivo
              </button>
            </div>
          </div>

          {/* Company name */}
          <div>
            <FieldLabel label="Nombre de la empresa" />
            <input
              type="text"
              value={draft.companyName}
              onChange={(e) => setDraft(d => ({ ...d, companyName: e.target.value }))}
              className="w-full h-9 px-3 text-[13px] bg-card border border-border rounded-xl focus:border-primary outline-none transition-colors"
            />
          </div>

          {/* Color */}
          <div>
            <FieldLabel label="Color primario" />
            <div className="grid grid-cols-6 gap-2">
              {BRAND_PRESETS.map(p => {
                const active = draft.colorPrimary === p.value;
                return (
                  <button
                    key={p.value}
                    onClick={() => setDraft(d => ({ ...d, colorPrimary: p.value }))}
                    className={cn(
                      "relative aspect-square rounded-xl border transition-all",
                      active ? "border-foreground ring-2 ring-foreground/20" : "border-border hover:border-foreground/30"
                    )}
                    style={{ backgroundColor: hsl(p.value) }}
                    title={p.label}
                    aria-label={p.label}
                  >
                    {active && <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Font */}
          <div>
            <FieldLabel label="Tipografía" />
            <div className="grid grid-cols-3 gap-2">
              {FONT_OPTIONS.map(f => {
                const active = draft.font === f.value;
                return (
                  <button
                    key={f.value}
                    onClick={() => setDraft(d => ({ ...d, font: f.value as MicrositeFont }))}
                    className={cn(
                      "p-3 rounded-xl border text-left transition-colors",
                      active ? "bg-primary/5 border-primary/30" : "border-border hover:border-foreground/30"
                    )}
                  >
                    <p className={cn(
                      "text-[14px] font-bold",
                      f.value === "playfair" && "font-serif",
                      f.value === "manrope"  && "tracking-tight",
                    )}>
                      {f.label}
                    </p>
                    <p className="text-[10.5px] text-muted-foreground mt-0.5">{f.sample}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border gap-2 sm:gap-2">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-full border border-border bg-card text-[13px] font-medium hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(draft)}
            className="h-9 px-5 rounded-full bg-foreground text-background text-[13px] font-medium hover:bg-foreground/90 transition-colors shadow-soft"
          >
            Guardar branding
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Reusables del editor
   ═══════════════════════════════════════════════════════════════════ */
function SectionLabel({ icon, title, description }: { icon: React.ReactNode; title: string; description?: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-foreground">
        <span className="text-muted-foreground">{icon}</span>
        <p className="text-[13px] font-semibold">{title}</p>
      </div>
      {description && <p className="text-[11.5px] text-muted-foreground mt-0.5">{description}</p>}
    </div>
  );
}

function FieldLabel({ label, hint, warn }: { label: string; hint?: string; warn?: boolean }) {
  return (
    <div className="flex items-baseline justify-between mb-1.5">
      <label className="text-[12.5px] font-semibold text-foreground">{label}</label>
      {hint && (
        <span className={cn("text-[11px]", warn ? "text-destructive" : "text-muted-foreground")}>{hint}</span>
      )}
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-border" />;
}
