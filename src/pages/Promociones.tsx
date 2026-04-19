/**
 * Promociones · listado (Vista Promotor)
 *
 * Port 1:1 del DeveloperPromotions.tsx del repo original.
 * Funcionalidad idéntica, datos idénticos; solo cambia el vestido visual
 * al lenguaje Byvaro v2 (tokens HSL, rounded-2xl, shadow-soft, pill buttons).
 */

import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, Building2, Plus, MapPin, Users, Flame, SlidersHorizontal,
  X, AlertTriangle, Ban, Share2, TrendingUp,
  Home, Layers, CircleDollarSign, Palette, CalendarDays,
} from "lucide-react";
import { promotions, getBuildingTypeLabel, type Promotion } from "@/data/promotions";
import { developerOnlyPromotions, type DevPromotion } from "@/data/developerPromotions";
import { unitsByPromotion } from "@/data/units";
import { Tag } from "@/components/ui/Tag";
import { FilterPill, SortPill } from "@/components/ui/FilterBar";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════
   Opciones de filtros (en formato { value, label } para FilterPill)
   ═══════════════════════════════════════════════════════════════════ */
const propertyTypeOptions = [
  { value: "Apartments", label: "Apartamentos" },
  { value: "Villas", label: "Villas" },
  { value: "Townhouses", label: "Adosados" },
  { value: "Penthouses", label: "Áticos" },
];
const buildingTypeOptions = [
  { value: "Unifamiliar", label: "Unifamiliar" },
  { value: "Plurifamiliar", label: "Plurifamiliar" },
];
const priceFilterOptions = [
  { value: "200k+", label: "Desde 200K€" },
  { value: "500k+", label: "Desde 500K€" },
  { value: "1M+", label: "Desde 1M€" },
  { value: "2M+", label: "Desde 2M€" },
];
const styleOptions = [
  { value: "Contemporary", label: "Contemporáneo" },
  { value: "Mediterranean", label: "Mediterráneo" },
  { value: "Minimalist", label: "Minimalista" },
  { value: "Classic", label: "Clásico" },
];
const deliveryOptions = [
  { value: "Ready now", label: "Entrega inmediata" },
  { value: "2025", label: "2025" },
  { value: "2026", label: "2026" },
  { value: "2027+", label: "2027 o posterior" },
];
const sortOptions = [
  { value: "recent", label: "Recientes" },
  { value: "trending", label: "Más activas" },
  { value: "priceAsc", label: "Precio ↑" },
  { value: "priceDesc", label: "Precio ↓" },
  { value: "deliveryAsc", label: "Entrega más cercana" },
  { value: "availability", label: "Más disponibilidad" },
];
const commissionOptions = [
  { label: "3%+", value: 3 },
  { label: "4%+", value: 4 },
  { label: "5%+", value: 5 },
];
const bedroomOptions = ["1", "2", "3", "4+"];

// Map de traducción value → label (para chips activas y mapping precio → number)
const priceLabelFromValue: Record<string, number> = {
  "200k+": 200000, "500k+": 500000, "1M+": 1000000, "2M+": 2000000,
};

/* ═══════════════════════════════════════════════════════════════════
   Filtros avanzados (panel: comisión + dormitorios)
   ═══════════════════════════════════════════════════════════════════ */
function FiltersPanel({ minCommission, setMinCommission, bedrooms, setBedrooms }: {
  minCommission: number | null; setMinCommission: (v: number | null) => void;
  bedrooms: string | null; setBedrooms: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const activeCount = [minCommission, bedrooms].filter(Boolean).length;

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative inline-flex items-center justify-center h-9 w-9 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        {activeCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-foreground text-background text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-semibold">
            {activeCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 bg-popover border border-border rounded-xl shadow-soft-lg z-50 w-[260px] p-4 space-y-4">
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
              Comisión mín.
            </label>
            <div className="flex gap-1">
              {commissionOptions.map(c => (
                <button
                  key={c.value}
                  onClick={() => setMinCommission(minCommission === c.value ? null : c.value)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex-1",
                    minCommission === c.value
                      ? "bg-foreground text-background"
                      : "bg-muted/40 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="h-px bg-border/60" />
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
              Dormitorios
            </label>
            <div className="flex gap-1">
              {bedroomOptions.map(b => (
                <button
                  key={b}
                  onClick={() => setBedrooms(bedrooms === b ? null : b)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex-1",
                    bedrooms === b
                      ? "bg-foreground text-background"
                      : "bg-muted/40 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Utilidades (idénticas al original)
   ═══════════════════════════════════════════════════════════════════ */
function formatPrice(n: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function statusTag(status: string) {
  const map: Record<string, { label: string; variant: "success" | "warning" | "muted" | "danger" }> = {
    active: { label: "Activa", variant: "success" },
    incomplete: { label: "Incompleta", variant: "warning" },
    inactive: { label: "Inactiva", variant: "muted" },
    "sold-out": { label: "Vendida", variant: "danger" },
  };
  return map[status] || map.inactive;
}

type LastUnitDetail = {
  id: string;
  label: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  builtArea: number;
  terrace: number;
  floor: number;
  orientation: string;
};

function getAvailableData(promotionId: string) {
  const units = unitsByPromotion[promotionId];
  if (!units) return { typologies: [], units: [], lastUnit: null as LastUnitDetail | null };

  const available = units.filter((u) => u.status === "available");

  if (available.length === 1) {
    const u = available[0];
    const lastUnit: LastUnitDetail = {
      id: `${u.block}-${u.floor}${u.door}`,
      label: u.type === "Ático" ? "Ático" : `${u.bedrooms} Hab`,
      price: u.price,
      bedrooms: u.bedrooms,
      bathrooms: u.bathrooms,
      builtArea: u.builtArea,
      terrace: u.terrace,
      floor: u.floor,
      orientation: u.orientation,
    };
    return { typologies: [], units: [], lastUnit };
  }

  const byType = new Map<string, { price: number; unit: typeof available[0] }[]>();
  for (const u of available) {
    const label = u.type === "Ático" ? "Ático" : `${u.bedrooms} Hab`;
    if (!byType.has(label)) byType.set(label, []);
    byType.get(label)!.push({ price: u.price, unit: u });
  }

  for (const [, group] of byType) group.sort((a, b) => a.price - b.price);

  const typologies = Array.from(byType.entries())
    .map(([label, group]) => ({ label, price: group[0].price }))
    .sort((a, b) => a.price - b.price)
    .slice(0, 3);

  const shownUnits: typeof available[0][] = [];
  const usedIds = new Set<string>();

  for (const [, group] of byType) {
    const cheapest = group[0].unit;
    if (!usedIds.has(cheapest.id)) {
      shownUnits.push(cheapest);
      usedIds.add(cheapest.id);
    }
  }

  for (const u of available.sort((a, b) => a.price - b.price)) {
    if (shownUnits.length >= 3) break;
    if (!usedIds.has(u.id)) {
      shownUnits.push(u);
      usedIds.add(u.id);
    }
  }

  const unitsList = shownUnits
    .sort((a, b) => a.price - b.price)
    .slice(0, 3)
    .map((u) => ({
      id: `${u.block}-${u.floor}${u.door}`,
      label: u.type === "Ático" ? "Ático" : `${u.bedrooms} Hab`,
      price: u.price,
    }));

  return { typologies, units: unitsList, lastUnit: null as LastUnitDetail | null };
}

const TRENDING_THRESHOLD = 50;

/* ═══════════════════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
   ═══════════════════════════════════════════════════════════════════ */
export default function Promociones() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedPrices, setSelectedPrices] = useState<string[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedDelivery, setSelectedDelivery] = useState<string[]>([]);
  const [minCommission, setMinCommission] = useState<number | null>(null);
  const [bedrooms, setBedrooms] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [buildingTypeFilter, setBuildingTypeFilter] = useState<string>("All");
  const [sort, setSort] = useState<string>("recent");

  const allFilters: { key: string; label: string; remove: () => void }[] = [];
  selectedTypes.forEach(v => allFilters.push({ key: "type", label: v, remove: () => setSelectedTypes(selectedTypes.filter(x => x !== v)) }));
  selectedPrices.forEach(v => allFilters.push({ key: "price", label: v, remove: () => setSelectedPrices(selectedPrices.filter(x => x !== v)) }));
  selectedStyles.forEach(v => allFilters.push({ key: "style", label: v, remove: () => setSelectedStyles(selectedStyles.filter(x => x !== v)) }));
  selectedDelivery.forEach(v => allFilters.push({ key: "delivery", label: v, remove: () => setSelectedDelivery(selectedDelivery.filter(x => x !== v)) }));
  if (minCommission) allFilters.push({ key: "commission", label: `${minCommission}%+`, remove: () => setMinCommission(null) });
  if (bedrooms) allFilters.push({ key: "bedrooms", label: `${bedrooms} hab`, remove: () => setBedrooms(null) });

  const hasFilters = allFilters.length > 0;
  const clearAllFilters = () => {
    setSearch(""); setSelectedTypes([]); setSelectedPrices([]); setSelectedStyles([]);
    setSelectedDelivery([]); setMinCommission(null); setBedrooms(null);
    setStatusFilter("all"); setBuildingTypeFilter("All");
  };

  const statusFilterOptions = [
    { key: "all", label: "Todas" },
    { key: "active", label: "Activas" },
    { key: "incomplete", label: "Incompletas" },
    { key: "sold-out", label: "Vendidas" },
  ] as const;

  const buildingTypeFilterOptions = ["All", "Unifamiliar", "Plurifamiliar"];

  const allPromotions: DevPromotion[] = useMemo(() => {
    return [...developerOnlyPromotions, ...promotions.map(p => ({ ...p } as DevPromotion))];
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let result = [...allPromotions];
    if (statusFilter !== "all") result = result.filter(p => p.status === statusFilter);
    if (buildingTypeFilter === "Unifamiliar") {
      result = result.filter(p => p.buildingType === "unifamiliar-single" || p.buildingType === "unifamiliar-multiple");
    } else if (buildingTypeFilter === "Plurifamiliar") {
      result = result.filter(p => p.buildingType === "plurifamiliar");
    }
    if (q) {
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q)
      );
    }
    if (selectedTypes.length > 0) {
      result = result.filter(p => selectedTypes.some(t => p.propertyTypes.some(pt => pt.toLowerCase().includes(t.toLowerCase()))));
    }
    if (selectedPrices.length > 0) {
      const minVal = Math.min(...selectedPrices.map(l => priceLabelFromValue[l] || 0));
      result = result.filter(p => p.priceMax >= minVal);
    }
    if (selectedDelivery.length > 0) {
      result = result.filter(p => selectedDelivery.some(d => {
        if (d === "Ready now") return p.delivery?.includes("2025");
        return p.delivery?.includes(d.replace("+", ""));
      }));
    }
    if (minCommission) result = result.filter(p => p.commission >= minCommission);
    return result;
  }, [search, selectedTypes, selectedPrices, selectedDelivery, minCommission, allPromotions, statusFilter, buildingTypeFilter]);

  const isTrending = (p: DevPromotion) => (p.activity?.trend ?? 0) >= TRENDING_THRESHOLD;

  return (
    <div className="flex flex-col min-h-full bg-background">
      {/* ═══════════ HEADER ═══════════ */}
      <div className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-3">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
          {/* Title · visible en todos los breakpoints, tamaño igual a Inicio */}
          <div className="shrink-0 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground leading-none">Comercial</p>
            <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight leading-tight mt-1">Promociones</h1>
          </div>

          {/* Controles: búsqueda + filter panel + CTA */}
          <div className="flex items-center gap-2 sm:ml-auto flex-1 sm:flex-initial sm:max-w-[560px]">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 z-10" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar promoción, promotor, referencia o ubicación..."
              className="w-full h-9 pl-9 pr-9 text-sm bg-card border border-border rounded-full focus:border-primary outline-none transition-colors"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <FiltersPanel
            minCommission={minCommission} setMinCommission={setMinCommission}
            bedrooms={bedrooms} setBedrooms={setBedrooms}
          />

          <button
            onClick={() => navigate("/crear-promocion")}
            className="inline-flex items-center gap-1.5 h-9 px-3 sm:px-4 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors shadow-soft shrink-0"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            <span className="hidden md:inline">Nueva promoción</span>
            <span className="md:hidden">Nueva</span>
          </button>
          </div>
        </div>
      </div>

      <div className="h-px bg-border/60" />

      {/* ═══════════ Toolbar compacta · status + filtros + count ═══════════ */}
      <div className="px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="max-w-[1400px] mx-auto flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          {/* Status tabs */}
          <div className="flex items-center gap-0.5 shrink-0">
            {statusFilterOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setStatusFilter(opt.key)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-[12.5px] font-medium transition-colors whitespace-nowrap",
                  statusFilter === opt.key
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="h-5 w-px bg-border shrink-0 mx-1" />

          {/* Filter pills con iconos */}
          <FilterPill
            icon={Home}
            label="Tipo"
            values={selectedTypes}
            options={propertyTypeOptions}
            onChange={setSelectedTypes}
          />
          <FilterPill
            icon={Layers}
            label="Edificio"
            values={buildingTypeFilter === "All" ? [] : [buildingTypeFilter]}
            options={buildingTypeOptions}
            onChange={(v) => setBuildingTypeFilter(v.length === 0 ? "All" : v[v.length - 1])}
            multi={false}
          />
          <FilterPill
            icon={CircleDollarSign}
            label="Precio"
            values={selectedPrices}
            options={priceFilterOptions}
            onChange={setSelectedPrices}
          />
          <FilterPill
            icon={Palette}
            label="Estilo"
            values={selectedStyles}
            options={styleOptions}
            onChange={setSelectedStyles}
          />
          <FilterPill
            icon={CalendarDays}
            label="Entrega"
            values={selectedDelivery}
            options={deliveryOptions}
            onChange={setSelectedDelivery}
          />

          {/* Sort */}
          <div className="h-5 w-px bg-border shrink-0 mx-1 hidden sm:block" />
          <SortPill value={sort} options={sortOptions} onChange={setSort} />

          {/* Active filter chips */}
          {allFilters.map((f, i) => (
            <span key={`${f.key}-${f.label}-${i}`} className="inline-flex items-center gap-1 h-8 px-3 rounded-full bg-foreground text-background text-[12px] font-medium shrink-0">
              {f.label}
              <button onClick={f.remove} className="hover:opacity-70 -mr-0.5" aria-label={`Quitar ${f.label}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {hasFilters && (
            <button onClick={clearAllFilters} className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 shrink-0">
              Limpiar
            </button>
          )}

          {/* Count */}
          <span className="text-xs text-muted-foreground ml-auto pl-3 shrink-0 hidden sm:inline">
            <span className="font-semibold text-foreground tnum">{filtered.length}</span> promociones
          </span>
        </div>
      </div>

      {/* ═══════════ Cards list (horizontal) ═══════════ */}
      <div className="flex-1 px-4 sm:px-6 lg:px-8 pb-8">
        <div className="max-w-[1400px] mx-auto flex flex-col gap-3 lg:gap-4">
          {filtered.length === 0 ? (
            <EmptyState />
          ) : (
            filtered.map((p) => {
              const badgeLabel = p.badge === "new" ? "Nueva" : p.badge === "last-units" ? "Últimas unidades" : null;
              const status = statusTag(p.status);
              const { typologies, units: availableUnits, lastUnit } = getAvailableData(p.id);
              const trending = isTrending(p);
              const hasMissing = p.missingSteps && p.missingSteps.length > 0;

              return (
                <article
                  key={p.id}
                  onClick={() => alert(`Navegar a /promociones/${p.id}`)}
                  className={cn(
                    "group flex flex-col lg:flex-row bg-card border rounded-2xl overflow-hidden shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer",
                    hasMissing
                      ? "border-destructive/30 ring-1 ring-destructive/10"
                      : trending
                      ? "border-border ring-1 ring-amber-300/50"
                      : "border-border"
                  )}
                >
                  {/* Image */}
                  <div className="relative w-full lg:w-[550px] h-[160px] sm:h-[220px] lg:h-[400px] shrink-0 overflow-hidden bg-muted">
                    {p.image ? (
                      <>
                        <img
                          src={p.image}
                          alt={p.name}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                          loading="lazy"
                        />
                        {badgeLabel && (
                          <Tag variant="overlay" size="sm" shape="pill" className="absolute top-3 left-3 shadow-soft">
                            {badgeLabel}
                          </Tag>
                        )}
                        {trending && (
                          <Tag variant="trending" size="sm" shape="pill" icon={<Flame className="h-3 w-3" />} className="absolute top-3 right-3">
                            Trending
                          </Tag>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Building2 className="h-10 w-10 text-muted-foreground/15" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-4 sm:p-5 flex flex-col min-w-0">
                    {/* Top row: location + building type + status */}
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase truncate">
                          {p.location || "Sin ubicación"}
                        </p>
                        {getBuildingTypeLabel(p.buildingType) && (
                          <Tag variant="default" size="sm" className="shrink-0 hidden sm:inline-flex">
                            {getBuildingTypeLabel(p.buildingType)}
                          </Tag>
                        )}
                      </div>
                      <Tag variant={status.variant} size="sm" className="shrink-0">
                        {status.label}
                      </Tag>
                    </div>

                    {/* Name + developer + delivery */}
                    <h3 className="text-lg lg:text-base font-bold text-foreground leading-snug mb-1">
                      {p.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-2 text-sm lg:text-xs text-muted-foreground mb-2 lg:mb-3">
                      {p.developer && <span>{p.developer}</span>}
                      {p.delivery && (
                        <>
                          <span className="text-border">·</span>
                          <span>Entrega {p.delivery}</span>
                        </>
                      )}
                    </div>

                    {/* Missing steps warning */}
                    {hasMissing && (
                      <div className="flex items-start gap-2.5 mb-3 px-3 py-2.5 rounded-xl bg-destructive/5 border border-destructive/20">
                        <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm lg:text-xs font-semibold text-destructive mb-0.5">Pasos pendientes para publicar</p>
                          <p className="text-sm lg:text-xs text-muted-foreground">{p.missingSteps!.join(" · ")}</p>
                        </div>
                      </div>
                    )}

                    {/* Cannot share warning */}
                    {p.canShareWithAgencies === false && !hasMissing && (
                      <div className="flex items-start gap-2.5 mb-3 px-3 py-2.5 rounded-xl bg-amber-50/60 border border-amber-200/40">
                        <Ban className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm lg:text-xs font-semibold text-amber-700 mb-0.5">No se puede compartir con agencias</p>
                          <p className="text-sm lg:text-xs text-muted-foreground">Configura comisiones en Colaboradores para habilitar el share</p>
                        </div>
                      </div>
                    )}

                    {/* Metrics row */}
                    <div className="flex items-center gap-5 lg:gap-6 mb-2 lg:mb-3">
                      <Metric label="Disponibles" value={`${p.availableUnits} / ${p.totalUnits}`} />
                      <Metric label="Comisión" value={`${p.commission}%`} />
                      {p.constructionProgress !== undefined && (
                        <Metric label="Obra" value={`${p.constructionProgress}%`} />
                      )}
                    </div>

                    {/* Trending activity box */}
                    {p.activity && trending && (
                      <div className="hidden sm:flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 px-3 py-2 rounded-xl bg-amber-50/60 border border-amber-200/40">
                        <div className="flex items-center gap-1 text-amber-600">
                          <TrendingUp className="h-3.5 w-3.5" />
                          <span className="text-xs font-semibold">+{p.activity.trend}%</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{p.activity.inquiries} consultas</span>
                        <span className="text-xs text-muted-foreground">{p.activity.reservations} reservas</span>
                        <span className="text-xs text-muted-foreground">{p.activity.visits} visitas</span>
                        <span className="text-[10px] text-muted-foreground/60 sm:ml-auto">Últimas 2 semanas</span>
                      </div>
                    )}

                    {/* Price */}
                    <p className="text-lg font-bold text-foreground tracking-tight mb-1 lg:mb-3">
                      {lastUnit ? formatPrice(lastUnit.price) : (
                        <>
                          {formatPrice(p.priceMin)}
                          {p.priceMax > p.priceMin && <span className="text-muted-foreground font-normal"> — </span>}
                          {p.priceMax > p.priceMin && formatPrice(p.priceMax)}
                        </>
                      )}
                    </p>

                    {/* Last unit detail */}
                    {lastUnit && (
                      <div className="hidden sm:block rounded-xl border border-border bg-muted/20 p-4 mb-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-xs font-medium text-foreground">Última unidad disponible</p>
                            <p className="text-xs text-muted-foreground">{lastUnit.label} · Unidad {lastUnit.id}</p>
                          </div>
                          <p className="text-sm font-semibold text-foreground">{formatPrice(lastUnit.price)}</p>
                        </div>
                        <div className="h-px bg-border/40 mb-3" />
                        <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                          <span className="text-xs text-muted-foreground">{lastUnit.bedrooms} hab · {lastUnit.bathrooms} baños</span>
                          <span className="text-xs text-muted-foreground">{lastUnit.builtArea} m² const.</span>
                          {lastUnit.terrace > 0 && <span className="text-xs text-muted-foreground">{lastUnit.terrace} m² terraza</span>}
                          <span className="text-xs text-muted-foreground">Planta {lastUnit.floor} · {lastUnit.orientation}</span>
                        </div>
                      </div>
                    )}

                    {/* Typologies + available units */}
                    {!lastUnit && (typologies.length > 0 || availableUnits.length > 0) && (
                      <div className="hidden sm:grid grid-cols-2 gap-3 mb-4">
                        {typologies.length > 0 && (
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Tipologías</p>
                            <div className="space-y-0.5">
                              {typologies.map((t) => (
                                <p key={t.label} className="text-xs text-foreground">
                                  {t.label} <span className="text-muted-foreground">desde</span> {formatPrice(t.price)}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                        {availableUnits.length > 0 && (
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Unidades disponibles</p>
                            <div className="space-y-0.5">
                              {availableUnits.map((u) => (
                                <p key={u.id} className="text-xs text-foreground">
                                  {u.id} <span className="text-muted-foreground">·</span> {u.label} <span className="text-muted-foreground">·</span> {formatPrice(u.price)}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="mt-auto pt-2 lg:pt-3 border-t border-border/30 flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground/60 min-w-0">
                        {p.agencies > 0 && (
                          <span className="text-foreground/70 flex items-center gap-1">
                            <Users className="h-3.5 w-3.5 lg:h-3 lg:w-3" />
                            {p.agencies} agencias
                          </span>
                        )}
                        {p.constructionProgress !== undefined && p.constructionProgress < 100 && (
                          <span>{p.constructionProgress}% obra</span>
                        )}
                        {p.hasShowFlat && <span className="hidden sm:inline">Piso piloto</span>}
                      </div>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm lg:text-xs font-medium text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1 shrink-0"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Compartir con agencias</span>
                        <span className="sm:hidden">Compartir</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Sub-componentes
   ═══════════════════════════════════════════════════════════════════ */
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs lg:text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-20 text-center">
      <div className="h-12 w-12 rounded-2xl bg-muted grid place-items-center mx-auto mb-4">
        <Search className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold">Sin resultados</h3>
      <p className="text-[12.5px] text-muted-foreground mt-1">Prueba a cambiar los filtros o la búsqueda.</p>
    </div>
  );
}

/* El import de Promotion se queda por si más adelante necesitamos tipar a fondo */
export type { Promotion };
