/**
 * Pantalla · Estadísticas de colaboradores (`/colaboradores/estadisticas`)
 *
 * Análisis del rendimiento comercial de la red de agencias para un promotor
 * de obra nueva. Tres tabs: captación · ventas · eficiencia.
 *
 * Eje dual · cada heatmap se puede ver por **Nacionalidad** del comprador
 * (el extranjero representa ~70% del mercado) o por **Promoción** (para
 * decisiones de asignación de stock).
 *
 * Métricas diferenciales de Byvaro (ninguna métrica € vanity):
 *   · Registros · Visitas · Ventas · Conversión
 *   · % aprobación del promotor (calidad del lead)
 *   · Duplicados detectados por la IA
 *   · SLA medio de primera respuesta de la agencia
 *
 * Insights y oportunidades son **derivados** · se recalculan con los filtros.
 *
 * TODO(backend): §7 de `docs/backend-integration.md`. Todo el mock inline
 *   (AGENCIES, NATIONS, PROMOTIONS, matrices REG/VIS/EFF/AGENCY_META) se
 *   sustituye por la respuesta del endpoint.
 */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTabParam } from "@/lib/useTabParam";
import {
  ArrowLeft, ChevronDown, Download, Sparkles, FileText, BarChart3, Target,
  Check, AlertTriangle, Clock, Copy, ShieldCheck,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { AgencyRankingTop5 } from "@/components/colaboradores/AgencyRankingTop5";

/* ─── helpers ─── */
function formatNumber(n: number) {
  return new Intl.NumberFormat("es-ES").format(n);
}
function flagOf(code: string): string {
  const c = code.toUpperCase();
  if (c.length !== 2) return "🏳️";
  return String.fromCodePoint(...[...c].map((ch) => 127397 + ch.charCodeAt(0)));
}

/* ═══════════════════════════════════════════════════════════════════
   DATA MOCK · sustituir por backend (ver TODO en el encabezado)
   ═══════════════════════════════════════════════════════════════════ */

const AGENCIES = [
  { id: "EV", name: "Engel & Völkers",     city: "Marbella · Estepona" },
  { id: "CB", name: "Costa Blanca Homes",  city: "Alicante · Valencia" },
  { id: "HM", name: "Hamptons Int.",       city: "Madrid · Málaga" },
  { id: "IB", name: "InmoBenelux",         city: "Alicante" },
  { id: "KR", name: "Kristall Properties", city: "Marbella" },
  { id: "NR", name: "Nordic Realty",       city: "Málaga" },
  { id: "MP", name: "Mediterráneo Prem.",  city: "Alicante" },
] as const;
type AgencyId = typeof AGENCIES[number]["id"];

const NATIONS = [
  { id: "RU", name: "Rusos",       label: "Rusia" },
  { id: "DE", name: "Alemanes",    label: "Alemania" },
  { id: "GB", name: "Británicos",  label: "UK" },
  { id: "BE", name: "Belgas",      label: "Bélgica" },
  { id: "NL", name: "Holandeses",  label: "Holanda" },
  { id: "NO", name: "Noruegos",    label: "Noruega" },
  { id: "SE", name: "Suecos",      label: "Suecia" },
  { id: "FR", name: "Franceses",   label: "Francia" },
  { id: "CH", name: "Suizos",      label: "Suiza" },
  { id: "US", name: "Americanos",  label: "USA" },
] as const;
type NationId = typeof NATIONS[number]["id"];

const PROMOTIONS = [
  { id: "dev-1", code: "PRM-0050", name: "Villa Serena",          city: "Marbella" },
  { id: "dev-2", code: "PRM-0051", name: "Villas del Pinar",      city: "Jávea" },
  { id: "dev-3", code: "PRM-0052", name: "Residencial Aurora",    city: "Benalmádena" },
  { id: "dev-4", code: "PRM-0053", name: "Terrazas del Golf",     city: "Mijas" },
  { id: "dev-5", code: "PRM-0054", name: "Mar Azul Residences",   city: "Torrevieja" },
] as const;
type PromoId = typeof PROMOTIONS[number]["id"];

/* Matrices por nacionalidad ─────────────────── */

const REG_NAT: Record<AgencyId, Record<NationId, number>> = {
  EV: { RU: 385, DE: 182, GB: 42,  BE: 18,  NL: 24,  NO: 14, SE: 12, FR: 22,  CH: 8,  US: 5 },
  CB: { RU: 42,  DE: 66,  GB: 158, BE: 38,  NL: 102, NO: 28, SE: 16, FR: 38,  CH: 10, US: 20 },
  HM: { RU: 22,  DE: 35,  GB: 224, BE: 28,  NL: 24,  NO: 12, SE: 8,  FR: 52,  CH: 6,  US: 20 },
  IB: { RU: 8,   DE: 34,  GB: 14,  BE: 228, NL: 66,  NO: 8,  SE: 4,  FR: 22,  CH: 2,  US: 2 },
  KR: { RU: 58,  DE: 182, GB: 14,  BE: 12,  NL: 10,  NO: 6,  SE: 4,  FR: 4,   CH: 6,  US: 1 },
  NR: { RU: 6,   DE: 28,  GB: 12,  BE: 6,   NL: 8,   NO: 88, SE: 78, FR: 4,   CH: 4,  US: 7 },
  MP: { RU: 4,   DE: 14,  GB: 22,  BE: 10,  NL: 12,  NO: 6,  SE: 4,  FR: 102, CH: 2,  US: 6 },
};

const VIS_NAT: Record<AgencyId, Record<NationId, number>> = {
  EV: { RU: 135, DE: 64,  GB: 15, BE: 6,  NL: 8,  NO: 5,  SE: 4,  FR: 8,  CH: 3,  US: 2 },
  CB: { RU: 13,  DE: 20,  GB: 47, BE: 11, NL: 31, NO: 8,  SE: 5,  FR: 11, CH: 3,  US: 6 },
  HM: { RU: 7,   DE: 11,  GB: 72, BE: 9,  NL: 8,  NO: 4,  SE: 3,  FR: 17, CH: 2,  US: 6 },
  IB: { RU: 3,   DE: 14,  GB: 6,  BE: 96, NL: 28, NO: 3,  SE: 2,  FR: 9,  CH: 1,  US: 1 },
  KR: { RU: 26,  DE: 82,  GB: 6,  BE: 5,  NL: 5,  NO: 3,  SE: 2,  FR: 2,  CH: 3,  US: 0 },
  NR: { RU: 2,   DE: 11,  GB: 5,  BE: 2,  NL: 3,  NO: 33, SE: 30, FR: 2,  CH: 2,  US: 3 },
  MP: { RU: 1,   DE: 3,   GB: 5,  BE: 2,  NL: 3,  NO: 1,  SE: 1,  FR: 22, CH: 0,  US: 1 },
};

const EFF_NAT: Record<AgencyId, Record<NationId, number>> = {
  EV: { RU: 9.1, DE: 5.5,  GB: 4.8, BE: 2.8,  NL: 4.2, NO: 3.6,  SE: 4.2,  FR: 4.5, CH: 5.0,  US: 0 },
  CB: { RU: 4.8, DE: 6.1,  GB: 8.2, BE: 6.6,  NL: 9.8, NO: 5.4,  SE: 6.3,  FR: 6.1, CH: 0,    US: 9.0 },
  HM: { RU: 4.5, DE: 5.7,  GB: 9.1, BE: 5.7,  NL: 5.0, NO: 5.0,  SE: 4.2,  FR: 7.7, CH: 0,    US: 5.0 },
  IB: { RU: 0,   DE: 5.9,  GB: 4.3, BE: 12.2, NL: 8.2, NO: 5.0,  SE: 0,    FR: 5.4, CH: 0,    US: 0 },
  KR: { RU: 6.9, DE: 10.2, GB: 5.7, BE: 3.3,  NL: 8.0, NO: 6.7,  SE: 5.0,  FR: 2.5, CH: 12.5, US: 0 },
  NR: { RU: 0,   DE: 4.3,  GB: 5.0, BE: 3.3,  NL: 5.0, NO: 11.4, SE: 10.3, FR: 2.5, CH: 0,    US: 0 },
  MP: { RU: 0,   DE: 4.3,  GB: 5.5, BE: 4.0,  NL: 3.3, NO: 3.3,  SE: 0,    FR: 4.9, CH: 0,    US: 3.3 },
};

/* Matrices por promoción ────────────────────── */

const REG_PROMO: Record<AgencyId, Record<PromoId, number>> = {
  EV: { "dev-1": 120, "dev-2": 40,  "dev-3": 280, "dev-4": 220, "dev-5": 52 },
  CB: { "dev-1": 30,  "dev-2": 140, "dev-3": 60,  "dev-4": 50,  "dev-5": 238 },
  HM: { "dev-1": 40,  "dev-2": 60,  "dev-3": 160, "dev-4": 130, "dev-5": 41 },
  IB: { "dev-1": 10,  "dev-2": 180, "dev-3": 40,  "dev-4": 30,  "dev-5": 128 },
  KR: { "dev-1": 90,  "dev-2": 20,  "dev-3": 120, "dev-4": 50,  "dev-5": 17 },
  NR: { "dev-1": 15,  "dev-2": 25,  "dev-3": 40,  "dev-4": 22,  "dev-5": 139 },
  MP: { "dev-1": 5,   "dev-2": 25,  "dev-3": 35,  "dev-4": 92,  "dev-5": 25 },
};

const VIS_PROMO: Record<AgencyId, Record<PromoId, number>> = {
  EV: { "dev-1": 42, "dev-2": 14, "dev-3": 98, "dev-4": 77, "dev-5": 18 },
  CB: { "dev-1": 9,  "dev-2": 42, "dev-3": 18, "dev-4": 15, "dev-5": 71 },
  HM: { "dev-1": 13, "dev-2": 19, "dev-3": 51, "dev-4": 42, "dev-5": 13 },
  IB: { "dev-1": 4,  "dev-2": 76, "dev-3": 17, "dev-4": 13, "dev-5": 54 },
  KR: { "dev-1": 40, "dev-2": 9,  "dev-3": 54, "dev-4": 22, "dev-5": 8 },
  NR: { "dev-1": 6,  "dev-2": 10, "dev-3": 15, "dev-4": 8,  "dev-5": 53 },
  MP: { "dev-1": 1,  "dev-2": 6,  "dev-3": 8,  "dev-4": 20, "dev-5": 6 },
};

const EFF_PROMO: Record<AgencyId, Record<PromoId, number>> = {
  EV: { "dev-1": 7.5, "dev-2": 4.2, "dev-3": 6.8, "dev-4": 5.4, "dev-5": 8.1 },
  CB: { "dev-1": 3.2, "dev-2": 7.8, "dev-3": 5.1, "dev-4": 6.2, "dev-5": 9.2 },
  HM: { "dev-1": 5.1, "dev-2": 5.8, "dev-3": 6.9, "dev-4": 5.5, "dev-5": 7.4 },
  IB: { "dev-1": 2.8, "dev-2": 9.5, "dev-3": 4.4, "dev-4": 4.2, "dev-5": 11.2 },
  KR: { "dev-1": 8.5, "dev-2": 5.2, "dev-3": 9.8, "dev-4": 6.8, "dev-5": 6.5 },
  NR: { "dev-1": 4.1, "dev-2": 5.8, "dev-3": 6.2, "dev-4": 7.5, "dev-5": 10.8 },
  MP: { "dev-1": 2.5, "dev-2": 3.8, "dev-3": 4.1, "dev-4": 5.0, "dev-5": 5.5 },
};

/* Señales diferenciales de Byvaro por agencia (global, no por eje) */
const AGENCY_META: Record<AgencyId, {
  aprobacionPct: number;    // % registros aprobados por el promotor
  duplicados: number;       // registros marcados duplicados por la IA
  respuestaHoras: number;   // SLA medio primera respuesta de la agencia
}> = {
  EV: { aprobacionPct: 94, duplicados: 18, respuestaHoras: 2.4 },
  CB: { aprobacionPct: 88, duplicados: 42, respuestaHoras: 3.8 },
  HM: { aprobacionPct: 82, duplicados: 28, respuestaHoras: 5.2 },
  IB: { aprobacionPct: 91, duplicados: 12, respuestaHoras: 2.1 },
  KR: { aprobacionPct: 96, duplicados: 8,  respuestaHoras: 1.8 },
  NR: { aprobacionPct: 90, duplicados: 16, respuestaHoras: 4.1 },
  MP: { aprobacionPct: 72, duplicados: 64, respuestaHoras: 8.5 },
};

/* ═══════════════════════════════════════════════════════════════════
   TIPOS
   ═══════════════════════════════════════════════════════════════════ */

const TAB_KEYS = ["registros", "ventas", "eficiencia"] as const;
type Tab = typeof TAB_KEYS[number];
type Dim = "nacionalidad" | "promocion";

type Axis = { id: string; name: string; shortLabel: string; flag?: string };
type DataMap = Record<AgencyId, Record<string, number>>;

/* ═══════════════════════════════════════════════════════════════════
   PANTALLA
   ═══════════════════════════════════════════════════════════════════ */

export default function ColaboradoresEstadisticas({
  lockedPromotionId, lockedPromotionName, embedded = false,
}: {
  /** Si viene, la pantalla se bloquea a esa promoción: fija `fPromos` y
   *  oculta el filtro Promoción en la toolbar. Usado en la tab
   *  "Estadísticas" de la ficha de promoción. */
  lockedPromotionId?: string;
  /** Nombre de la promoción bloqueada · se muestra en el banner
   *  contextual para que el usuario sepa que está viendo datos
   *  filtrados a esa promo. */
  lockedPromotionName?: string;
  /** Modo embebido · oculta el back y el header propio (el contenedor
   *  ya aporta contexto). Por defecto la pantalla renderiza header
   *  completo como página independiente. */
  embedded?: boolean;
} = {}) {
  const navigate = useNavigate();
  const [tab, setTab] = useTabParam<Tab>(TAB_KEYS, "registros");

  /* ─── Filtros ─── */
  const [fNations, setFNations] = useState<NationId[]>([]);
  const [fPromos, setFPromos] = useState<PromoId[]>(
    lockedPromotionId ? [lockedPromotionId as PromoId] : [],
  );
  const [fAgencies, setFAgencies] = useState<AgencyId[]>([]);

  const visibleAgencies = useMemo(
    () => AGENCIES.filter((a) => fAgencies.length === 0 || fAgencies.includes(a.id)),
    [fAgencies],
  );

  /* Totales KPI agregan siempre por nacionalidad (el eje más completo) */
  const totals = useMemo(() => {
    const nats = fNations.length === 0 ? [...NATIONS] : NATIONS.filter((n) => fNations.includes(n.id));
    let regs = 0, vis = 0, ventas = 0;
    for (const a of visibleAgencies) for (const n of nats) {
      regs += REG_NAT[a.id][n.id];
      vis += VIS_NAT[a.id][n.id];
      ventas += Math.round(REG_NAT[a.id][n.id] * EFF_NAT[a.id][n.id] / 100);
    }
    const conv = regs > 0 ? ventas / regs * 100 : 0;
    return { regs, vis, ventas, conv };
  }, [visibleAgencies, fNations]);

  /* Cuando hay una promoción bloqueada, fPromos siempre contiene ese ID
   *  y no cuenta como filtro activo para el usuario (no puede quitarlo). */
  const activeFilters =
    fNations.length +
    (lockedPromotionId ? 0 : fPromos.length) +
    fAgencies.length;
  const clearAll = () => {
    setFNations([]);
    setFPromos(lockedPromotionId ? [lockedPromotionId as PromoId] : []);
    setFAgencies([]);
  };

  return (
    <div className="flex flex-col min-h-full bg-background">

      {/* ─── Back + header ─── */}
      <div className={cn("px-4 sm:px-6 lg:px-8", embedded ? "pt-5" : "pt-6 sm:pt-8")}>
        <div className="max-w-[1400px] mx-auto">
          {!embedded && (
            <button
              onClick={() => navigate("/colaboradores")}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
              Colaboradores
            </button>
          )}

          {!embedded && (
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Red comercial · Estadísticas
                </p>
                <h1 className="text-[19px] sm:text-[22px] font-bold tracking-tight text-foreground mt-1 leading-tight">
                  Análisis de colaboradores
                </h1>
                <p className="text-sm text-muted-foreground mt-1.5 max-w-[640px] leading-relaxed">
                  Qué agencia trae mejores leads, dónde cerramos más y en qué mercados hay huecos por cubrir.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full border border-border bg-card text-sm font-medium text-foreground hover:bg-muted transition-colors">
                  <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Exportar
                </button>
              </div>
            </div>
          )}

          {/* Banner de contexto cuando la pantalla está bloqueada a una
              promoción concreta. Siempre visible para que el usuario vea
              qué subconjunto está analizando. */}
          {lockedPromotionId && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
              <div className="h-8 w-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <Target className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                  Estadísticas filtradas
                </p>
                <p className="text-sm font-semibold text-foreground mt-0.5 leading-snug">
                  Solo datos de {lockedPromotionName ?? "esta promoción"}
                </p>
                <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">
                  Todos los KPIs, heatmaps e insights se limitan a los registros y ventas
                  de esta promoción · cierra con la X para volver a la ficha.
                </p>
              </div>
            </div>
          )}

          {/* Filter bar */}
          <div className="rounded-2xl border border-border bg-card p-3 flex flex-wrap gap-2 items-center mb-5">
            <FilterSelect
              label="Nacionalidad"
              placeholder="Todas"
              options={NATIONS.map((n) => ({ value: n.id, label: `${flagOf(n.id)} ${n.name}` }))}
              selected={fNations}
              onChange={(v) => setFNations(v as NationId[])}
            />
            {!lockedPromotionId && (
              <FilterSelect
                label="Promoción"
                placeholder="Todas"
                options={PROMOTIONS.map((p) => ({ value: p.id, label: p.name }))}
                selected={fPromos}
                onChange={(v) => setFPromos(v as PromoId[])}
              />
            )}
            <FilterSelect
              label="Colaborador"
              placeholder="Todos"
              options={AGENCIES.map((a) => ({ value: a.id, label: a.name }))}
              selected={fAgencies}
              onChange={(v) => setFAgencies(v as AgencyId[])}
            />
            {activeFilters > 0 && (
              <button
                onClick={clearAll}
                className="ml-auto text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-full hover:bg-muted transition-colors"
              >
                Limpiar filtros ({activeFilters})
              </button>
            )}
          </div>

          {/* 4 KPIs · sin trends hasta que haya histórico */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-5">
            <Kpi label="Registros" value={formatNumber(totals.regs)} icon={FileText} />
            <Kpi label="Visitas realizadas" value={formatNumber(totals.vis)} icon={Target} />
            <Kpi label="Ventas cerradas" value={formatNumber(totals.ventas)} icon={BarChart3} />
            <Kpi label="Conversión registro → venta" value={`${totals.conv.toFixed(1)}%`} icon={Sparkles} />
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-border overflow-x-auto no-scrollbar mb-5">
            {([
              { v: "registros",  label: "Registros",  icon: FileText,  badge: formatNumber(totals.regs) },
              { v: "ventas",     label: "Ventas",     icon: BarChart3, badge: formatNumber(totals.ventas) },
              { v: "eficiencia", label: "Eficiencia", icon: Target,    badge: `${totals.conv.toFixed(1)}%` },
            ] as const).map((t) => {
              const active = tab === t.v;
              const Icon = t.icon;
              return (
                <button
                  key={t.v}
                  onClick={() => setTab(t.v)}
                  className={cn(
                    "inline-flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative whitespace-nowrap",
                    active
                      ? "text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                  {t.label}
                  <span
                    className={cn(
                      "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                      active ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {t.badge}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Tab content ─── */}
      <div className="px-4 sm:px-6 lg:px-8 pb-12 max-w-[1400px] mx-auto w-full">
        {tab === "registros" && (
          <TabRegistros
            visibleAgencies={visibleAgencies}
            fNations={fNations}
            fPromos={fPromos}
          />
        )}
        {tab === "ventas" && (
          <TabVentas
            visibleAgencies={visibleAgencies}
            fNations={fNations}
            fPromos={fPromos}
          />
        )}
        {tab === "eficiencia" && (
          <TabEficiencia
            visibleAgencies={visibleAgencies}
            fNations={fNations}
            fPromos={fPromos}
          />
        )}
      </div>
    </div>
  );
}

type VisibleAgency = typeof AGENCIES[number];

/* Resuelve columnas según dimensión y filtros */
function useAxes(dim: Dim, fNations: NationId[], fPromos: PromoId[]): Axis[] {
  return useMemo(() => {
    if (dim === "nacionalidad") {
      const src = fNations.length === 0 ? [...NATIONS] : NATIONS.filter((n) => fNations.includes(n.id));
      return src.map((n) => ({ id: n.id, name: n.name, shortLabel: n.id, flag: flagOf(n.id) }));
    }
    const src = fPromos.length === 0 ? [...PROMOTIONS] : PROMOTIONS.filter((p) => fPromos.includes(p.id));
    return src.map((p) => ({ id: p.id, name: p.name, shortLabel: p.code }));
  }, [dim, fNations, fPromos]);
}

/* Map de datos según dim */
function pickData(dim: Dim, metric: "REG" | "VIS" | "EFF"): DataMap {
  if (dim === "nacionalidad") {
    return metric === "REG" ? REG_NAT as DataMap : metric === "VIS" ? VIS_NAT as DataMap : EFF_NAT as DataMap;
  }
  return metric === "REG" ? REG_PROMO as DataMap : metric === "VIS" ? VIS_PROMO as DataMap : EFF_PROMO as DataMap;
}

/* ═══════════════════════════════════════════════════════════════════
   TAB · REGISTROS
   ═══════════════════════════════════════════════════════════════════ */

function TabRegistros({ visibleAgencies, fNations, fPromos }: {
  visibleAgencies: readonly VisibleAgency[];
  fNations: NationId[];
  fPromos: PromoId[];
}) {
  const [dim, setDim] = useState<Dim>("nacionalidad");
  const axes = useAxes(dim, fNations, fPromos);
  const data = pickData(dim, "REG");

  const insights = useMemo(() => deriveInsights(visibleAgencies, axes, data, "REG", dim), [visibleAgencies, axes, data, dim]);

  const calidad = useMemo(() => {
    return [...visibleAgencies].map((a) => {
      const regs = axes.reduce((s, x) => s + (data[a.id][x.id] ?? 0), 0);
      const m = AGENCY_META[a.id];
      return { ...a, regs, aprobacion: m.aprobacionPct, duplicados: m.duplicados, sla: m.respuestaHoras };
    }).sort((a, b) => b.regs - a.regs);
  }, [visibleAgencies, axes, data]);

  return (
    <div className="space-y-5">
      <InsightsBlock insights={insights} />
      {/* Ranking simple Fase 1 · datos en vivo (seed + creados). */}
      <AgencyRankingTop5 />
      <Heatmap
        title="Matriz de registros"
        subtitle="Leads generados. Celda dominante por columna con borde."
        dim={dim}
        setDim={setDim}
        axes={axes}
        data={data}
        fmt={(v) => (v === 0 ? "—" : formatNumber(v))}
        tone="blue"
        visibleAgencies={visibleAgencies}
      />
      <Panel
        title="Calidad de los registros"
        subtitle="% aprobados por el promotor · duplicados detectados por la IA · SLA de respuesta"
      >
        <div className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-left">Agencia</th>
                <th className="pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Registros</th>
                <th className="pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">
                  <span className="inline-flex items-center gap-1 justify-end">
                    <ShieldCheck className="h-3 w-3" strokeWidth={2} /> Aprobación
                  </span>
                </th>
                <th className="pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">
                  <span className="inline-flex items-center gap-1 justify-end">
                    <Copy className="h-3 w-3" strokeWidth={2} /> Duplicados
                  </span>
                </th>
                <th className="pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">
                  <span className="inline-flex items-center gap-1 justify-end">
                    <Clock className="h-3 w-3" strokeWidth={2} /> Respuesta
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {calidad.map((r, i) => (
                <tr key={r.id} className="border-b border-border/60 hover:bg-muted/40 transition-colors">
                  <td className="py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "h-6 w-6 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0",
                          i === 0 && "bg-warning/15 text-warning",
                          i === 1 && "bg-muted text-foreground",
                          i === 2 && "bg-warning/10 text-warning",
                          i > 2 && "bg-muted text-muted-foreground",
                        )}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground text-[13px] truncate">{r.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{r.city}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 text-right text-[13px] text-foreground tabular-nums">
                    {formatNumber(r.regs)}
                  </td>
                  <td className="py-2.5 text-right">
                    <span
                      className={cn(
                        "inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border tabular-nums",
                        r.aprobacion >= 90 ? "bg-success/10 text-success border-success/25" :
                        r.aprobacion >= 80 ? "bg-warning/10 text-warning border-warning/25" :
                        "bg-destructive/5 text-destructive border-destructive/25",
                      )}
                    >
                      {r.aprobacion}%
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    <span
                      className={cn(
                        "inline-block text-[11px] font-medium px-2 py-0.5 rounded-full border tabular-nums",
                        r.duplicados <= 20 ? "bg-muted text-muted-foreground border-border" :
                        r.duplicados <= 40 ? "bg-warning/10 text-warning border-warning/25" :
                        "bg-destructive/5 text-destructive border-destructive/25",
                      )}
                    >
                      {r.duplicados}
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    <span className="text-[12px] text-foreground tabular-nums font-medium">{r.sla}h</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TAB · VENTAS
   ═══════════════════════════════════════════════════════════════════ */

function TabVentas({ visibleAgencies, fNations, fPromos }: {
  visibleAgencies: readonly VisibleAgency[];
  fNations: NationId[];
  fPromos: PromoId[];
}) {
  const [dim, setDim] = useState<Dim>("nacionalidad");
  const axes = useAxes(dim, fNations, fPromos);
  const regData = pickData(dim, "REG");
  const effData = pickData(dim, "EFF");
  const visData = pickData(dim, "VIS");

  /* Ventas = round(REG * EFF / 100) por celda */
  const ventasData: DataMap = useMemo(() => {
    const out: DataMap = {} as DataMap;
    for (const a of AGENCIES) {
      out[a.id] = {};
      for (const x of axes) {
        const r = regData[a.id][x.id] ?? 0;
        const e = effData[a.id][x.id] ?? 0;
        out[a.id][x.id] = Math.round(r * e / 100);
      }
    }
    return out;
  }, [axes, regData, effData]);

  const insights = useMemo(() => deriveInsights(visibleAgencies, axes, ventasData, "VENTAS", dim), [visibleAgencies, axes, ventasData, dim]);

  const ranking = useMemo(() => {
    return [...visibleAgencies].map((a) => {
      const regs = axes.reduce((s, x) => s + (regData[a.id][x.id] ?? 0), 0);
      const visitas = axes.reduce((s, x) => s + (visData[a.id][x.id] ?? 0), 0);
      const ventas = axes.reduce((s, x) => s + (ventasData[a.id][x.id] ?? 0), 0);
      const conv = regs > 0 ? ventas / regs * 100 : 0;
      return { ...a, regs, visitas, ventas, conv };
    }).sort((a, b) => b.ventas - a.ventas);
  }, [visibleAgencies, axes, regData, visData, ventasData]);

  return (
    <div className="space-y-5">
      <InsightsBlock insights={insights} />
      <Heatmap
        title="Matriz de ventas cerradas"
        subtitle="Operaciones firmadas por agencia. Celda dominante por columna con borde."
        dim={dim}
        setDim={setDim}
        axes={axes}
        data={ventasData}
        fmt={(v) => (v === 0 ? "—" : formatNumber(v))}
        tone="green"
        visibleAgencies={visibleAgencies}
      />
      <Panel title="Embudo por agencia" subtitle="Registros → visitas → ventas · ordenado por ventas">
        <div className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-left">Agencia</th>
                <th className="pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Regs.</th>
                <th className="pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Visitas</th>
                <th className="pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Ventas</th>
                <th className="pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Conv.</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((r, i) => (
                <tr key={r.id} className="border-b border-border/60 hover:bg-muted/40 transition-colors">
                  <td className="py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          "h-6 w-6 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0",
                          i === 0 && "bg-warning/15 text-warning",
                          i === 1 && "bg-muted text-foreground",
                          i === 2 && "bg-warning/10 text-warning",
                          i > 2 && "bg-muted text-muted-foreground",
                        )}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground text-[13px] truncate">{r.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{r.city}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 text-right text-[13px] text-foreground tabular-nums">{formatNumber(r.regs)}</td>
                  <td className="py-2.5 text-right text-[13px] text-foreground tabular-nums">{formatNumber(r.visitas)}</td>
                  <td className="py-2.5 text-right text-[13px] text-foreground tabular-nums font-semibold">{formatNumber(r.ventas)}</td>
                  <td className="py-2.5 text-right">
                    <span
                      className={cn(
                        "inline-block text-[11px] font-medium px-2 py-0.5 rounded-full border tabular-nums",
                        r.conv >= 7 ? "bg-success/10 text-success border-success/25" :
                        r.conv >= 5 ? "bg-warning/10 text-warning border-warning/25" :
                        "bg-destructive/5 text-destructive border-destructive/25",
                      )}
                    >
                      {r.conv.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TAB · EFICIENCIA
   ═══════════════════════════════════════════════════════════════════ */

function TabEficiencia({ visibleAgencies, fNations, fPromos }: {
  visibleAgencies: readonly VisibleAgency[];
  fNations: NationId[];
  fPromos: PromoId[];
}) {
  const [dim, setDim] = useState<Dim>("nacionalidad");
  const axes = useAxes(dim, fNations, fPromos);
  const effData = pickData(dim, "EFF");
  const regData = pickData(dim, "REG");

  const insights = useMemo(() => deriveInsights(visibleAgencies, axes, effData, "EFF", dim), [visibleAgencies, axes, effData, dim]);

  const ranking = useMemo(() => {
    return [...visibleAgencies].map((a) => {
      const regs = axes.reduce((s, x) => s + (regData[a.id][x.id] ?? 0), 0);
      const ventas = axes.reduce((s, x) => s + Math.round((regData[a.id][x.id] ?? 0) * (effData[a.id][x.id] ?? 0) / 100), 0);
      const conv = regs > 0 ? ventas / regs * 100 : 0;
      return { ...a, regs, ventas, conv };
    }).sort((a, b) => b.conv - a.conv);
  }, [visibleAgencies, axes, regData, effData]);

  /* Oportunidades derivadas */
  const oportunidades = useMemo(() => deriveOportunidades(visibleAgencies, axes, regData, effData, dim), [visibleAgencies, axes, regData, effData, dim]);

  return (
    <div className="space-y-5">
      <InsightsBlock insights={insights} />
      <Heatmap
        title="Matriz de conversión"
        subtitle="% de registros que se convierten en venta. Verde = sobre la media."
        dim={dim}
        setDim={setDim}
        axes={axes}
        data={effData}
        fmt={(v) => (v === 0 ? "—" : `${v.toFixed(1)}%`)}
        tone="diverging"
        visibleAgencies={visibleAgencies}
      />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-4">
        <Panel title="Ranking de agencias por eficiencia" subtitle="Las que cierran más con menos">
          <div className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-left">Agencia</th>
                  <th className="pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Regs.</th>
                  <th className="pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Ventas</th>
                  <th className="pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Conv.</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r, i) => (
                  <tr key={r.id} className="border-b border-border/60 hover:bg-muted/40 transition-colors">
                    <td className="py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={cn(
                            "h-6 w-6 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0",
                            i === 0 && "bg-warning/15 text-warning",
                            i === 1 && "bg-muted text-foreground",
                            i === 2 && "bg-warning/10 text-warning",
                            i > 2 && "bg-muted text-muted-foreground",
                          )}
                        >
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground text-[13px] truncate">{r.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{r.city}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 text-right text-[13px] text-foreground tabular-nums">{formatNumber(r.regs)}</td>
                    <td className="py-2.5 text-right text-[13px] text-foreground tabular-nums">{formatNumber(r.ventas)}</td>
                    <td className="py-2.5 text-right">
                      <span
                        className={cn(
                          "inline-block text-[11px] font-medium px-2 py-0.5 rounded-full border tabular-nums",
                          r.conv >= 7 ? "bg-success/10 text-success border-success/25" :
                          r.conv >= 5 ? "bg-warning/10 text-warning border-warning/25" :
                          "bg-destructive/5 text-destructive border-destructive/25",
                        )}
                      >
                        {r.conv.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Oportunidades detectadas" subtitle="Acciones derivadas de los datos visibles">
          {oportunidades.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4">
              No se detectan oportunidades destacables en el subset actual. Prueba ampliar filtros.
            </p>
          ) : (
            <ul className="space-y-2">
              {oportunidades.map((o, i) => (
                <li key={i} className="rounded-xl border border-border bg-card p-3 flex items-start gap-2.5">
                  <div
                    className={cn(
                      "h-7 w-7 rounded-lg flex items-center justify-center shrink-0 font-semibold text-xs",
                      o.tone === "ok" && "bg-success/10 text-success",
                      o.tone === "info" && "bg-primary/10 text-primary",
                      o.tone === "warn" && "bg-warning/10 text-warning",
                    )}
                  >
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-snug">{o.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{o.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   INSIGHTS · OPORTUNIDADES · derivados de los datos visibles
   ═══════════════════════════════════════════════════════════════════ */

type Insight = { tone: "pos" | "neu" | "neg"; title: string; body: string };

function deriveInsights(
  agencies: readonly VisibleAgency[],
  axes: Axis[],
  data: DataMap,
  metric: "REG" | "VENTAS" | "EFF",
  dim: Dim,
): Insight[] {
  const out: Insight[] = [];
  if (agencies.length === 0 || axes.length === 0) return out;

  const dimLabel = dim === "nacionalidad" ? "mercado" : "promoción";

  /* 1 · Líder absoluto */
  const totalsAg = agencies.map((a) => ({
    a,
    total: axes.reduce((s, x) => s + (data[a.id][x.id] ?? 0), 0),
  })).sort((a, b) => b.total - a.total);
  const gran = totalsAg.reduce((s, t) => s + t.total, 0);
  if (totalsAg.length > 0 && gran > 0) {
    const top = totalsAg[0];
    const pct = top.total / gran * 100;
    if (pct >= 30 && metric !== "EFF") {
      out.push({
        tone: "pos",
        title: `${top.a.name} lidera la red`,
        body: `${pct.toFixed(0)}% del total con ${formatNumber(top.total)} ${metric === "REG" ? "registros" : "ventas"}. ${totalsAg.length > 1 ? `Seguido de ${totalsAg[1].a.name} (${(totalsAg[1].total / gran * 100).toFixed(0)}%).` : ""}`,
      });
    }
  }

  /* 2 · Dominante por columna o columna fragmentada */
  if (metric !== "EFF") {
    const columnBreakdown = axes.map((x) => {
      const rows = agencies.map((a) => ({ a, v: data[a.id][x.id] ?? 0 })).sort((p, q) => q.v - p.v);
      const tot = rows.reduce((s, r) => s + r.v, 0);
      const leader = rows[0];
      const leaderPct = tot > 0 && leader ? leader.v / tot * 100 : 0;
      return { axis: x, leader: leader?.a, leaderPct, tot };
    }).filter((c) => c.tot > 0);

    const dominado = [...columnBreakdown].sort((a, b) => b.leaderPct - a.leaderPct)[0];
    const fragmentado = [...columnBreakdown].filter((c) => c.tot >= 30).sort((a, b) => a.leaderPct - b.leaderPct)[0];

    if (dominado && dominado.leaderPct >= 45 && dominado.leader) {
      out.push({
        tone: "pos",
        title: `${dominado.leader.name} domina ${dominado.axis.name}`,
        body: `${dominado.leaderPct.toFixed(0)}% del ${dimLabel} (${formatNumber(dominado.tot)}). Buen candidato para acuerdo exclusivo.`,
      });
    }
    if (fragmentado && fragmentado.leaderPct < 35 && fragmentado.tot >= 60) {
      out.push({
        tone: "neu",
        title: `${fragmentado.axis.name} sin líder claro`,
        body: `El top agencia solo alcanza ${fragmentado.leaderPct.toFixed(0)}%. ${formatNumber(fragmentado.tot)} ${metric === "REG" ? "registros" : "ventas"} repartidos · oportunidad de consolidar.`,
      });
    }
  }

  /* 3 · Eficiencia: mejor y peor */
  if (metric === "EFF") {
    const rowsEff = agencies.map((a) => {
      const regs = axes.reduce((s, x) => s + (REG_NAT[a.id]?.[x.id as NationId] ?? REG_PROMO[a.id]?.[x.id as PromoId] ?? 0), 0);
      const ventas = axes.reduce((s, x) => s + Math.round(
        (REG_NAT[a.id]?.[x.id as NationId] ?? REG_PROMO[a.id]?.[x.id as PromoId] ?? 0) *
        (data[a.id][x.id] ?? 0) / 100,
      ), 0);
      const conv = regs > 0 ? ventas / regs * 100 : 0;
      return { a, regs, ventas, conv };
    }).filter((r) => r.regs >= 30);

    const sortedUp = [...rowsEff].sort((a, b) => b.conv - a.conv);
    const sortedDown = [...rowsEff].sort((a, b) => a.conv - b.conv);

    if (sortedUp[0]) {
      out.push({
        tone: "pos",
        title: `${sortedUp[0].a.name} · ${sortedUp[0].conv.toFixed(1)}% conversión`,
        body: `La agencia más eficiente del subset · cierra ${formatNumber(sortedUp[0].ventas)} ventas sobre ${formatNumber(sortedUp[0].regs)} registros.`,
      });
    }
    if (sortedDown[0] && sortedDown[0].conv < 4 && sortedDown[0].regs >= 50) {
      out.push({
        tone: "neg",
        title: `${sortedDown[0].a.name} · solo ${sortedDown[0].conv.toFixed(1)}% conversión`,
        body: `Alta captación (${formatNumber(sortedDown[0].regs)}) pero baja conversión · revisa calidad del lead, producto asignado o SLA.`,
      });
    }
  }

  /* 4 · Fallback neutro si no hay nada */
  if (out.length === 0) {
    out.push({
      tone: "neu",
      title: "Datos limitados",
      body: "No se detectan patrones destacables con los filtros actuales. Prueba ampliar la selección.",
    });
  }

  return out.slice(0, 3);
}

function deriveOportunidades(
  agencies: readonly VisibleAgency[],
  axes: Axis[],
  regData: DataMap,
  effData: DataMap,
  dim: Dim,
): { tone: "ok" | "info" | "warn"; title: string; body: string }[] {
  const out: { tone: "ok" | "info" | "warn"; title: string; body: string }[] = [];
  if (agencies.length === 0 || axes.length === 0) return out;
  const dimLabel = dim === "nacionalidad" ? "mercado" : "promoción";

  /* Columnas con alta demanda y conversión media baja */
  axes.forEach((x) => {
    const regs = agencies.reduce((s, a) => s + (regData[a.id][x.id] ?? 0), 0);
    if (regs < 80) return;
    const ventas = agencies.reduce((s, a) => s + Math.round((regData[a.id][x.id] ?? 0) * (effData[a.id][x.id] ?? 0) / 100), 0);
    const conv = regs > 0 ? ventas / regs * 100 : 0;
    if (conv < 5) {
      out.push({
        tone: "warn",
        title: `${x.name} · alta captación, baja conversión`,
        body: `${formatNumber(regs)} registros pero conversión media ${conv.toFixed(1)}%. Revisa encaje producto-perfil o asigna una agencia especializada.`,
      });
    }
  });

  /* Agencia × columna con gran eficiencia y poco volumen → escalar */
  const scale: { agency: VisibleAgency; axis: Axis; conv: number; regs: number }[] = [];
  agencies.forEach((a) => {
    axes.forEach((x) => {
      const regs = regData[a.id][x.id] ?? 0;
      const eff = effData[a.id][x.id] ?? 0;
      if (eff >= 9 && regs >= 10 && regs <= 80) scale.push({ agency: a, axis: x, conv: eff, regs });
    });
  });
  scale.sort((a, b) => b.conv - a.conv).slice(0, 2).forEach((s) => {
    out.push({
      tone: "ok",
      title: `Escala ${s.agency.name} en ${s.axis.name}`,
      body: `${s.conv.toFixed(1)}% de conversión con solo ${formatNumber(s.regs)} registros · capacidad para absorber más volumen.`,
    });
  });

  /* Columnas fragmentadas → firma exclusiva */
  axes.forEach((x) => {
    const rows = agencies.map((a) => ({ a, v: regData[a.id][x.id] ?? 0 })).sort((p, q) => q.v - p.v);
    const tot = rows.reduce((s, r) => s + r.v, 0);
    if (tot < 60) return;
    const leader = rows[0];
    const leaderPct = leader ? leader.v / tot * 100 : 0;
    if (leaderPct < 35) {
      const bestConv = agencies.map((a) => ({ a, eff: effData[a.id][x.id] ?? 0 })).sort((p, q) => q.eff - p.eff)[0];
      if (bestConv && bestConv.eff >= 7) {
        out.push({
          tone: "info",
          title: `${x.name} · consolida con ${bestConv.a.name}`,
          body: `${dimLabel[0].toUpperCase()}${dimLabel.slice(1)} repartido (top agencia ${leaderPct.toFixed(0)}%). ${bestConv.a.name} tiene la mejor conversión (${bestConv.eff.toFixed(1)}%).`,
        });
      }
    }
  });

  return out.slice(0, 4);
}

/* ═══════════════════════════════════════════════════════════════════
   SUBCOMPONENTES
   ═══════════════════════════════════════════════════════════════════ */

function Kpi({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
      </div>
      <p className="text-2xl sm:text-[26px] font-bold text-foreground mt-2 leading-none tabular-nums">{value}</p>
    </div>
  );
}

function FilterSelect({
  label, placeholder, options, selected, onChange,
}: {
  label: string;
  placeholder: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = selected.length > 0;
  const value = selected.length === 0
    ? null
    : selected.length === 1
      ? options.find((o) => o.value === selected[0])?.label ?? null
      : `${selected.length} seleccionados`;

  const toggle = (v: string) => {
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[12.5px] transition-colors",
            active
              ? "bg-foreground text-background border-foreground"
              : "bg-background text-foreground border-border hover:bg-muted",
          )}
        >
          <span className={cn("font-medium", active ? "text-background/70" : "text-muted-foreground")}>{label}:</span>
          <span className="font-semibold truncate max-w-[160px]">{value ?? placeholder}</span>
          <ChevronDown className={cn("h-3 w-3 opacity-60 transition-transform", open && "rotate-180")} strokeWidth={2} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-60 p-0">
        <div className="max-h-[280px] overflow-y-auto p-1">
          {options.map((opt) => {
            const isSel = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggle(opt.value)}
                className={cn(
                  "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12.5px] text-left hover:bg-muted transition-colors",
                  isSel && "bg-muted",
                )}
              >
                <span
                  className={cn(
                    "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                    isSel ? "bg-foreground border-foreground" : "border-border bg-background",
                  )}
                >
                  {isSel && <Check className="h-3 w-3 text-background" strokeWidth={2.5} />}
                </span>
                <span className="min-w-0 flex-1 truncate text-foreground">{opt.label}</span>
              </button>
            );
          })}
        </div>
        {active && (
          <div className="border-t border-border p-1">
            <button
              onClick={() => onChange([])}
              className="w-full text-[11px] text-muted-foreground hover:text-destructive px-2.5 py-1.5 rounded-md hover:bg-muted transition-colors text-left"
            >
              Limpiar selección
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function Panel({
  title, subtitle, right, children,
}: { title: string; subtitle?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
      <header className="px-4 sm:px-5 pt-4 pb-3 flex items-start justify-between gap-3 border-b border-border">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="text-[11.5px] text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function InsightsBlock({ insights }: { insights: Insight[] }) {
  return (
    <section>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {insights.map((ins, i) => {
          const Icon = ins.tone === "pos" ? Check : ins.tone === "neg" ? AlertTriangle : Sparkles;
          return (
            <div
              key={i}
              className={cn(
                "rounded-xl border p-3 flex items-start gap-2.5",
                ins.tone === "pos" && "bg-success/40 border-success/25",
                ins.tone === "neu" && "bg-primary/5 border-primary/20",
                ins.tone === "neg" && "bg-warning/40 border-warning/25",
              )}
            >
              <div
                className={cn(
                  "h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
                  ins.tone === "pos" && "bg-success/15 text-success",
                  ins.tone === "neu" && "bg-primary/10 text-primary",
                  ins.tone === "neg" && "bg-warning/15 text-warning",
                )}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold text-foreground leading-snug">{ins.title}</p>
                <p className="text-[11.5px] text-muted-foreground mt-1 leading-relaxed">{ins.body}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DimSwitch({ dim, setDim }: { dim: Dim; setDim: (d: Dim) => void }) {
  return (
    <div className="inline-flex items-center bg-muted rounded-full p-0.5 text-[11px]">
      {(["nacionalidad", "promocion"] as const).map((d) => {
        const active = dim === d;
        return (
          <button
            key={d}
            onClick={() => setDim(d)}
            className={cn(
              "px-2.5 py-1 rounded-full font-medium transition-colors whitespace-nowrap",
              active ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {d === "nacionalidad" ? "Por nacionalidad" : "Por promoción"}
          </button>
        );
      })}
    </div>
  );
}

/* Heatmap genérico · eje X configurable (nacionalidad o promoción) */
function Heatmap({
  title, subtitle, dim, setDim, axes, data, fmt, tone, visibleAgencies,
}: {
  title: string;
  subtitle?: string;
  dim: Dim;
  setDim: (d: Dim) => void;
  axes: Axis[];
  data: DataMap;
  fmt: (v: number) => string;
  tone: "blue" | "green" | "diverging";
  visibleAgencies: readonly VisibleAgency[];
}) {
  let max = 0;
  for (const a of visibleAgencies) for (const x of axes) if ((data[a.id][x.id] ?? 0) > max) max = data[a.id][x.id];

  const dominant: Record<string, AgencyId | null> = {};
  for (const x of axes) {
    let best: AgencyId | null = null, bestV = -1;
    for (const a of visibleAgencies) if ((data[a.id][x.id] ?? 0) > bestV) { bestV = data[a.id][x.id] ?? 0; best = a.id; }
    dominant[x.id] = bestV > 0 ? best : null;
  }

  const cellStyle = (v: number): string => {
    if (v === 0) return "bg-muted text-muted-foreground/40";
    if (tone === "diverging") {
      if (v < 3)  return "bg-destructive/10 text-destructive";
      if (v < 5)  return "bg-warning/15 text-warning";
      if (v < 7)  return "bg-warning/10 text-warning";
      if (v < 10) return "bg-success/15 text-success";
      return "bg-success text-white";
    }
    const t = Math.min(v / Math.max(max, 1), 1);
    if (tone === "green") {
      if (t < 0.15) return "bg-success/10 text-success";
      if (t < 0.35) return "bg-success/15 text-success";
      if (t < 0.55) return "bg-success/20 text-success";
      if (t < 0.75) return "bg-success text-white";
      return "bg-success text-white";
    }
    if (t < 0.15) return "bg-primary/5  text-foreground";
    if (t < 0.35) return "bg-primary/15 text-foreground";
    if (t < 0.55) return "bg-primary/30 text-foreground";
    if (t < 0.75) return "bg-primary/60 text-primary-foreground";
    return "bg-primary text-primary-foreground";
  };

  return (
    <Panel title={title} subtitle={subtitle} right={<DimSwitch dim={dim} setDim={setDim} />}>
      <div className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5">
        <table className="w-full border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 bg-card z-10 text-left pb-2 pr-3 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground">
                Agencia
              </th>
              {axes.map((x) => (
                <th key={x.id} className="pb-2 px-1 text-center font-semibold text-[10px] text-muted-foreground">
                  {x.flag && <span className="block text-sm leading-none">{x.flag}</span>}
                  <span className="block mt-0.5">{x.shortLabel}</span>
                </th>
              ))}
              <th className="pb-2 pl-2 text-center font-semibold text-[10px] text-muted-foreground">Total</th>
            </tr>
          </thead>
          <tbody>
            {visibleAgencies.map((a) => {
              const rowTotal = axes.reduce((s, x) => s + (data[a.id][x.id] ?? 0), 0);
              return (
                <tr key={a.id}>
                  <td className="sticky left-0 bg-card z-10 py-1 pr-3 font-semibold text-foreground whitespace-nowrap">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-5 w-5 rounded-full bg-muted text-[9px] font-bold flex items-center justify-center text-foreground">
                        {a.id}
                      </span>
                      {a.name}
                    </span>
                  </td>
                  {axes.map((x) => {
                    const v = data[a.id][x.id] ?? 0;
                    const isDom = dominant[x.id] === a.id && v > 0;
                    return (
                      <td key={x.id} className="p-0.5">
                        <div
                          title={`${a.name} · ${x.name}: ${fmt(v)}`}
                          className={cn(
                            "h-10 rounded-md text-[11.5px] font-semibold flex items-center justify-center tabular-nums transition-all hover:scale-[1.05] hover:shadow-soft hover:z-10 relative",
                            cellStyle(v),
                            isDom && "ring-2 ring-foreground",
                          )}
                        >
                          {v === 0 ? "—" : fmt(v)}
                        </div>
                      </td>
                    );
                  })}
                  <td className="p-0.5 pl-1">
                    <div className="h-10 rounded-md bg-foreground text-background text-[11.5px] font-bold flex items-center justify-center tabular-nums">
                      {tone === "diverging" ? (
                        /* para eficiencia, el total por fila es la conv global → calculada aparte */
                        (() => {
                          const r = axes.reduce((s, x) => s + ((REG_NAT[a.id]?.[x.id as NationId]) ?? (REG_PROMO[a.id]?.[x.id as PromoId]) ?? 0), 0);
                          const v = axes.reduce((s, x) => s + Math.round(((REG_NAT[a.id]?.[x.id as NationId]) ?? (REG_PROMO[a.id]?.[x.id as PromoId]) ?? 0) * (data[a.id][x.id] ?? 0) / 100), 0);
                          return r > 0 ? `${(v / r * 100).toFixed(1)}%` : "—";
                        })()
                      ) : fmt(rowTotal)}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
