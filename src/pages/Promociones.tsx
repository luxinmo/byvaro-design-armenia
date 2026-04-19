/**
 * Promociones · listado (Vista Promotor)
 *
 * Port 1:1 del DeveloperPromotions.tsx del repo original.
 * Funcionalidad idéntica, datos idénticos; solo cambia el vestido visual
 * al lenguaje Byvaro v2 (tokens HSL, rounded-2xl, shadow-soft, pill buttons).
 */

import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Building2, Plus, MapPin, Users, Flame, SlidersHorizontal,
  X, AlertTriangle, Ban, Share2, TrendingUp, Check, ChevronDown,
  List, Map as MapIcon, LayoutGrid, type LucideIcon,
} from "lucide-react";
import { promotions, getBuildingTypeLabel, type Promotion } from "@/data/promotions";
import { developerOnlyPromotions, type DevPromotion } from "@/data/developerPromotions";
import { unitsByPromotion } from "@/data/units";
import { agencies, type Agency } from "@/data/agencies";
import { Tag } from "@/components/ui/Tag";
import { PromocionesMap } from "@/components/promociones/PromocionesMap";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════
   Opciones estáticas (las dinámicas se derivan de los datos en el componente)
   ═══════════════════════════════════════════════════════════════════ */

/** Traducción de propertyType (viene en inglés del dato) → label español */
const propertyTypeLabels: Record<string, string> = {
  "Apartments": "Apartamentos",
  "Villas": "Villas",
  "Townhouses": "Adosados",
  "Penthouses": "Áticos",
  "Duplex": "Dúplex",
  "Commercial": "Locales",
};

const buildingTypeOptions = [
  { value: "Unifamiliar", label: "Unifamiliar" },
  { value: "Plurifamiliar", label: "Plurifamiliar" },
  { value: "Mixto", label: "Mixto" },
];

/** Precio: rangos abiertos desde X. Valor es número (umbral min). */
const priceFilterOptions = [
  { value: "200000", label: "Desde 200K€" },
  { value: "500000", label: "Desde 500K€" },
  { value: "1000000", label: "Desde 1M€" },
  { value: "2000000", label: "Desde 2M€" },
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

/* ─── helpers de filtrado/ordenación ─────────────────────────────── */

/** Extrae la "zona" de la ubicación: "Marbella, Costa del Sol" → "Costa del Sol" */
function getZone(location: string): string {
  const parts = location.split(",").map(p => p.trim()).filter(Boolean);
  return parts[parts.length - 1] || parts[0] || "";
}

/** Extrae el año de la fecha de entrega: "Q3 2026" → 2026 */
function getDeliveryYear(delivery?: string): number {
  if (!delivery) return 9999;
  const match = delivery.match(/\d{4}/);
  return match ? parseInt(match[0], 10) : 9999;
}

/** Traduce un value de propertyType a su label en español */
function getPropertyTypeLabel(v: string): string {
  return propertyTypeLabels[v] || v;
}

/** Traduce el buildingType interno a su filtro */
function matchesBuildingType(promoType: string | undefined, filterValue: string): boolean {
  if (!promoType) return false;
  if (filterValue === "Unifamiliar") return promoType === "unifamiliar-single" || promoType === "unifamiliar-multiple";
  if (filterValue === "Plurifamiliar") return promoType === "plurifamiliar";
  if (filterValue === "Mixto") return promoType === "mixto";
  return false;
}

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

  // Filtros de gestión (específicos del promotor)
  const [activityFilter, setActivityFilter] = useState<string[]>([]);
  const [collabFilter, setCollabFilter] = useState<string[]>([]);

  // Filtros de búsqueda avanzada (catálogo)
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [buildingTypeFilter, setBuildingTypeFilter] = useState<string>("All");
  const [priceMin, setPriceMin] = useState<number | null>(null);
  const [priceMax, setPriceMax] = useState<number | null>(null);
  const [minBedrooms, setMinBedrooms] = useState<number | null>(null);
  const [selectedDelivery, setSelectedDelivery] = useState<string[]>([]);
  const [selectedCommissions, setSelectedCommissions] = useState<string[]>([]);

  // Agencia específica (solo si collabFilter incluye "with-agencies")
  const [agencyFilter, setAgencyFilter] = useState<string | null>(null);

  // Estado, orden, vista
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sort, setSort] = useState<string>("recent");
  const [viewMode, setViewMode] = useState<"list" | "grid" | "map">("list");

  // Drawer de filtros
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Contador de filtros activos (para badge)
  const activeFilterCount =
    activityFilter.length + collabFilter.length +
    selectedLocations.length + selectedTypes.length +
    selectedDelivery.length + selectedCommissions.length +
    (buildingTypeFilter !== "All" ? 1 : 0) +
    (priceMin !== null || priceMax !== null ? 1 : 0) +
    (minBedrooms !== null ? 1 : 0) +
    (agencyFilter !== null ? 1 : 0);

  /* ─── Dataset combinado (developer-only + legacy) ─── */
  const allPromotions: DevPromotion[] = useMemo(() => {
    return [...developerOnlyPromotions, ...promotions.map(p => ({ ...p } as DevPromotion))];
  }, []);

  /* ─── Opciones de filtros de GESTIÓN (fijas) ─── */
  const activityOptions = [
    { value: "new", label: "Nueva" },
    { value: "last-units", label: "Últimas unidades" },
    { value: "high-demand", label: "Demanda alta" },
    { value: "inactive", label: "Sin actividad" },
  ];
  const collabOptions = [
    { value: "with-agencies", label: "Con agencias" },
    { value: "without", label: "Sin agencias" },
  ];

  /* ─── Opciones estáticas de BÚSQUEDA AVANZADA ─── */
  const buildingTypeOptions = [
    { value: "Unifamiliar", label: "Unifamiliar" },
    { value: "Plurifamiliar", label: "Plurifamiliar" },
    { value: "Mixto", label: "Mixto" },
  ];
  const bedroomOptions = [
    { value: "1", label: "1+ hab" },
    { value: "2", label: "2+ hab" },
    { value: "3", label: "3+ hab" },
    { value: "4", label: "4+ hab" },
  ];
  const commissionFilterOptions = [
    { value: "3", label: "3%+" },
    { value: "4", label: "4%+" },
    { value: "5", label: "5%+" },
  ];

  /* ─── Opciones DINÁMICAS derivadas de los datos reales ─── */
  const locationOptions = useMemo(() => {
    const zones = new Set<string>();
    allPromotions.forEach(p => {
      const z = getZone(p.location);
      if (z) zones.add(z);
    });
    return Array.from(zones).sort().map(z => ({ value: z, label: z }));
  }, [allPromotions]);

  const propertyTypeOptions = useMemo(() => {
    const types = new Set<string>();
    allPromotions.forEach(p => p.propertyTypes.forEach(t => types.add(t)));
    return Array.from(types).sort().map(t => ({ value: t, label: getPropertyTypeLabel(t) }));
  }, [allPromotions]);

  const deliveryOptions = useMemo(() => {
    const years = new Set<string>();
    allPromotions.forEach(p => {
      const y = getDeliveryYear(p.delivery);
      if (y !== 9999) years.add(String(y));
    });
    return [
      { value: "ready", label: "Inmediata" },
      ...Array.from(years).sort().map(y => ({ value: y, label: y })),
    ];
  }, [allPromotions]);

  /* ─── "Limpiar todo" ─── */
  const hasFilters = activeFilterCount > 0;

  const clearAllFilters = () => {
    setSearch("");
    setActivityFilter([]); setCollabFilter([]); setAgencyFilter(null);
    setSelectedLocations([]); setSelectedTypes([]); setBuildingTypeFilter("All");
    setPriceMin(null); setPriceMax(null); setMinBedrooms(null);
    setSelectedDelivery([]); setSelectedCommissions([]);
    setStatusFilter("all");
  };

  const statusFilterOptions = [
    { key: "all", label: "Todas" },
    { key: "active", label: "Activas" },
    { key: "incomplete", label: "Incompletas" },
    { key: "sold-out", label: "Vendidas" },
  ] as const;

  /* ─── Filtrado (gestión + búsqueda avanzada combinadas) ─── */
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allPromotions.filter(p => {
      // Estado (tabs)
      if (statusFilter !== "all" && p.status !== statusFilter) return false;

      // Búsqueda textual (nombre, ubicación, código, developer)
      if (q) {
        const hay = p.name.toLowerCase().includes(q)
          || p.location.toLowerCase().includes(q)
          || p.code.toLowerCase().includes(q)
          || (p.developer?.toLowerCase().includes(q) ?? false);
        if (!hay) return false;
      }

      // ──────── Gestión ────────
      if (activityFilter.length > 0) {
        const ok = activityFilter.some(f => {
          if (f === "new") return p.badge === "new";
          if (f === "last-units") return p.badge === "last-units";
          if (f === "high-demand") return (p.activity?.inquiries ?? 0) >= 20;
          if (f === "inactive") return (p.activity?.inquiries ?? 0) === 0 && (p.activity?.visits ?? 0) === 0;
          return false;
        });
        if (!ok) return false;
      }
      if (collabFilter.length > 0) {
        const n = p.agencies ?? 0;
        const ok = collabFilter.some(f => {
          if (f === "with-agencies") return n >= 1;
          if (f === "without") return n === 0;
          return false;
        });
        if (!ok) return false;
      }

      // Agencia específica (solo aplica si se eligió)
      if (agencyFilter !== null) {
        const ag = agencies.find(a => a.id === agencyFilter);
        if (!ag || !ag.promotionsCollaborating.includes(p.id)) return false;
      }

      // ──────── Búsqueda avanzada ────────
      if (selectedLocations.length > 0 && !selectedLocations.includes(getZone(p.location))) return false;
      if (buildingTypeFilter !== "All" && !matchesBuildingType(p.buildingType, buildingTypeFilter)) return false;
      if (selectedTypes.length > 0 && !selectedTypes.some(t => p.propertyTypes.includes(t))) return false;

      // Precio min/max (inputs numéricos)
      if (priceMin !== null && p.priceMax < priceMin) return false;
      if (priceMax !== null && p.priceMin > priceMax) return false;

      if (selectedDelivery.length > 0) {
        const promoYear = getDeliveryYear(p.delivery);
        const ok = selectedDelivery.some(d => {
          if (d === "ready") return promoYear <= new Date().getFullYear();
          return String(promoYear) === d;
        });
        if (!ok) return false;
      }

      if (selectedCommissions.length > 0) {
        const minCom = Math.min(...selectedCommissions.map(v => parseInt(v, 10)));
        if (p.commission < minCom) return false;
      }

      // Dormitorios: umbral mínimo, la promo tiene al menos 1 unidad con >= minBedrooms habs
      if (minBedrooms !== null) {
        const units = unitsByPromotion[p.id] ?? [];
        if (!units.some(u => u.bedrooms >= minBedrooms)) return false;
      }

      return true;
    });
  }, [
    allPromotions, search, statusFilter,
    activityFilter, collabFilter, agencyFilter,
    selectedLocations, buildingTypeFilter, selectedTypes,
    priceMin, priceMax, minBedrooms,
    selectedDelivery, selectedCommissions,
  ]);

  /* ─── Ordenación ─── */
  const sortedAndFiltered = useMemo(() => {
    const arr = [...filtered];
    switch (sort) {
      case "trending":
        return arr.sort((a, b) => (b.activity?.trend ?? 0) - (a.activity?.trend ?? 0));
      case "priceAsc":
        return arr.sort((a, b) => a.priceMin - b.priceMin);
      case "priceDesc":
        return arr.sort((a, b) => b.priceMax - a.priceMax);
      case "deliveryAsc":
        return arr.sort((a, b) => getDeliveryYear(a.delivery) - getDeliveryYear(b.delivery));
      case "availability":
        return arr.sort((a, b) => b.availableUnits - a.availableUnits);
      case "recent":
      default:
        // 'recent' aproximado: las que tienen badge "new" primero, luego por actividad
        return arr.sort((a, b) => {
          const aNew = a.badge === "new" ? 1 : 0;
          const bNew = b.badge === "new" ? 1 : 0;
          if (aNew !== bNew) return bNew - aNew;
          return (b.activity?.inquiries ?? 0) - (a.activity?.inquiries ?? 0);
        });
    }
  }, [filtered, sort]);

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

          {/* Controles: búsqueda + FILTROS (al lado) + CTA */}
          <div className="flex items-center gap-2 sm:ml-auto flex-1 sm:flex-initial sm:max-w-[640px]">
            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 z-10" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar promoción, promotor, ubicación..."
                className="w-full h-9 pl-9 pr-9 text-sm bg-card border border-border rounded-full focus:border-primary outline-none transition-colors"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filtros (al lado del buscador) */}
            <button
              onClick={() => setFiltersOpen(true)}
              className={cn(
                "inline-flex items-center gap-1.5 h-9 px-3 sm:px-4 rounded-full border text-sm font-medium transition-colors shrink-0",
                activeFilterCount > 0
                  ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                  : "bg-card border-border text-foreground hover:border-foreground/30"
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Filtros</span>
              {activeFilterCount > 0 && (
                <span className="ml-0.5 bg-primary-foreground/20 rounded-full h-5 min-w-[20px] px-1 text-[11px] font-bold grid place-items-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <button
              onClick={() => navigate("/crear-promocion")}
              className="inline-flex items-center gap-1.5 h-9 px-3 sm:px-4 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors shadow-soft shrink-0"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              <span className="hidden md:inline">Nueva promoción</span>
            </button>
          </div>
        </div>
      </div>

      <div className="h-px bg-border/60" />

      {/* ═══════════ Toolbar ═══════════ */}
      <div className="px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="max-w-[1400px] mx-auto flex items-center gap-3 flex-wrap">
          {/* Izquierda: status tabs */}
          <div className="flex items-center gap-0.5">
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

          {/* Derecha: contador + sort + 3 vistas */}
          <div className="ml-auto flex items-center gap-3 sm:gap-4">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              <span className="font-semibold text-foreground tnum">{sortedAndFiltered.length}</span> resultados
            </span>

            <MinimalSort value={sort} options={sortOptions} onChange={setSort} />

            {/* Toggle Lista / Cuadrícula / Mapa */}
            <div className="inline-flex items-center bg-muted/40 border border-border rounded-full p-0.5 text-xs">
              <ViewToggleBtn active={viewMode === "list"} onClick={() => setViewMode("list")} icon={List} label="Lista" />
              <ViewToggleBtn active={viewMode === "grid"} onClick={() => setViewMode("grid")} icon={LayoutGrid} label="Cuadrícula" />
              <ViewToggleBtn active={viewMode === "map"} onClick={() => setViewMode("map")} icon={MapIcon} label="Mapa" />
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ Vista MAPA ═══════════ */}
      {viewMode === "map" && (
        <div className="flex-1 px-4 sm:px-6 lg:px-8 pb-8">
          <div className="max-w-[1400px] mx-auto">
            <PromocionesMap promotions={sortedAndFiltered} />
          </div>
        </div>
      )}

      {/* ═══════════ Vista CUADRÍCULA ═══════════ */}
      {viewMode === "grid" && (
        <div className="flex-1 px-4 sm:px-6 lg:px-8 pb-8">
          <div className="max-w-[1400px] mx-auto">
            {sortedAndFiltered.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {sortedAndFiltered.map(p => (
                  <PromoCardCompact key={p.id} promo={p} isTrending={isTrending(p)} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ Vista LISTA (horizontal cards) ═══════════ */}
      {viewMode === "list" && (
      <div className="flex-1 px-4 sm:px-6 lg:px-8 pb-8">
        <div className="max-w-[1400px] mx-auto flex flex-col gap-3 lg:gap-4">
          {sortedAndFiltered.length === 0 ? (
            <EmptyState />
          ) : (
            sortedAndFiltered.map((p) => {
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
      )}

      {/* ═══════════ DRAWER DE FILTROS ═══════════ */}
      <AnimatePresence>
        {filtersOpen && (
          <>
            {/* Backdrop borroso */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/25 backdrop-blur-sm"
              onClick={() => setFiltersOpen(false)}
            />
            {/* Panel lateral derecho */}
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[440px] bg-card border-l border-border shadow-soft-lg flex flex-col"
            >
              {/* Header */}
              <header className="h-14 shrink-0 flex items-center justify-between px-5 border-b border-border">
                <div>
                  <h2 className="text-[15px] font-semibold tracking-tight">Filtros</h2>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5">
                    {activeFilterCount === 0
                      ? "Ningún filtro aplicado"
                      : `${activeFilterCount} filtro${activeFilterCount > 1 ? "s" : ""} activo${activeFilterCount > 1 ? "s" : ""}`}
                  </p>
                </div>
                <button
                  onClick={() => setFiltersOpen(false)}
                  className="p-2 -mr-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Cerrar filtros"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>

              {/* Body · secciones scrollable */}
              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-7">
                <div className="space-y-5">
                  <SectionTitle>Gestión</SectionTitle>
                  <FilterGroup title="Actividad" options={activityOptions} values={activityFilter} onChange={setActivityFilter} />
                  <FilterGroup title="Colaboración" options={collabOptions} values={collabFilter} onChange={setCollabFilter} />

                  {/* Buscador de agencia específica (solo si 'Con agencias' está activo) */}
                  {collabFilter.includes("with-agencies") && (
                    <AgencySearcher
                      agencies={agencies}
                      value={agencyFilter}
                      onChange={setAgencyFilter}
                    />
                  )}
                </div>

                <div className="h-px bg-border" />

                <div className="space-y-5">
                  <SectionTitle>Búsqueda avanzada</SectionTitle>

                  <SearchableFilterGroup
                    title="Ubicación"
                    options={locationOptions}
                    values={selectedLocations}
                    onChange={setSelectedLocations}
                    placeholder="Buscar zona (Marbella, Alicante...)"
                  />

                  <FilterGroup title="Tipología" options={propertyTypeOptions} values={selectedTypes} onChange={setSelectedTypes} />

                  <FilterGroup
                    title="Edificio"
                    options={buildingTypeOptions}
                    values={buildingTypeFilter === "All" ? [] : [buildingTypeFilter]}
                    onChange={(v) => setBuildingTypeFilter(v.length === 0 ? "All" : v[v.length - 1])}
                    multi={false}
                  />

                  <PriceRangeFilter
                    min={priceMin}
                    max={priceMax}
                    onMinChange={setPriceMin}
                    onMaxChange={setPriceMax}
                  />

                  <BedroomsThresholdFilter value={minBedrooms} onChange={setMinBedrooms} />

                  <FilterGroup title="Entrega" options={deliveryOptions} values={selectedDelivery} onChange={setSelectedDelivery} />
                  <FilterGroup title="Comisión" options={commissionFilterOptions} values={selectedCommissions} onChange={setSelectedCommissions} />
                </div>
              </div>

              {/* Footer sticky */}
              <footer className="h-[72px] shrink-0 border-t border-border flex items-center justify-between gap-3 px-5">
                <button
                  onClick={clearAllFilters}
                  disabled={activeFilterCount === 0}
                  className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Limpiar todo
                </button>
                <button
                  onClick={() => setFiltersOpen(false)}
                  className="inline-flex items-center h-10 px-5 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors shadow-soft"
                >
                  Ver {sortedAndFiltered.length} resultado{sortedAndFiltered.length !== 1 ? "s" : ""}
                </button>
              </footer>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MinimalSort · dropdown minimalista (solo texto + chevron)
   ═══════════════════════════════════════════════════════════════════ */
function MinimalSort({
  value, options, onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
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

  const current = options.find(o => o.value === value);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="hidden sm:inline">Ordenar por</span>
        <span className="font-semibold text-foreground">{current?.label}</span>
        <ChevronDown className={cn("h-3 w-3 opacity-60 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 bg-popover border border-border rounded-xl shadow-soft-lg z-30 min-w-[220px] py-1.5">
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-1.5 text-sm transition-colors hover:bg-muted/40 text-left"
            >
              <span className={cn(value === opt.value ? "text-foreground font-medium" : "text-muted-foreground")}>
                {opt.label}
              </span>
              {value === opt.value && <Check className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Sub-componentes del drawer de filtros
   ═══════════════════════════════════════════════════════════════════ */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </p>
  );
}

function FilterGroup({
  title, options, values, onChange, multi = true,
}: {
  title: string;
  options: { value: string; label: string }[];
  values: string[];
  onChange: (v: string[]) => void;
  multi?: boolean;
}) {
  const toggle = (v: string) => {
    if (multi) {
      onChange(values.includes(v) ? values.filter(x => x !== v) : [...values, v]);
    } else {
      onChange(values.includes(v) ? [] : [v]);
    }
  };
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="text-[13px] font-semibold text-foreground">{title}</h4>
        {values.length > 0 && (
          <button
            onClick={() => onChange([])}
            className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
          >
            Limpiar
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const selected = values.includes(opt.value);
          return (
            <button
              key={opt.value}
              onClick={() => toggle(opt.value)}
              className={cn(
                "inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[12.5px] font-medium transition-colors",
                selected
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
              )}
            >
              {selected && <Check className="h-3 w-3" strokeWidth={3} />}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Sub-componentes
   ═══════════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════════
   ViewToggleBtn · botón de segmento del toggle Lista/Cuadrícula/Mapa
   ═══════════════════════════════════════════════════════════════════ */
function ViewToggleBtn({
  active, onClick, icon: Icon, label,
}: { active: boolean; onClick: () => void; icon: LucideIcon; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 h-6 px-2.5 rounded-full font-medium transition-all",
        active ? "bg-background text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"
      )}
      aria-label={`Vista ${label.toLowerCase()}`}
      aria-pressed={active}
    >
      <Icon className="h-3 w-3" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SearchableFilterGroup · chips con buscador arriba (para listas largas)
   Se usa para Ubicación (muchas zonas posibles).
   ═══════════════════════════════════════════════════════════════════ */
function SearchableFilterGroup({
  title, options, values, onChange, placeholder = "Buscar…",
}: {
  title: string;
  options: { value: string; label: string }[];
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const qq = q.toLowerCase().trim();
    if (!qq) return options;
    return options.filter(o => o.label.toLowerCase().includes(qq));
  }, [q, options]);
  const toggle = (v: string) =>
    onChange(values.includes(v) ? values.filter(x => x !== v) : [...values, v]);
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="text-[13px] font-semibold text-foreground">{title}</h4>
        {values.length > 0 && (
          <button onClick={() => onChange([])} className="text-[11px] text-muted-foreground hover:text-destructive">
            Limpiar
          </button>
        )}
      </div>
      <div className="relative mb-2">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="w-full h-8 pl-8 pr-8 text-[12.5px] bg-muted/30 border border-border rounded-full focus:bg-background focus:border-primary outline-none transition-colors"
        />
        {q && (
          <button onClick={() => setQ("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-[11.5px] text-muted-foreground italic px-1">Sin coincidencias</p>
        ) : (
          filtered.map(opt => {
            const selected = values.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggle(opt.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[12.5px] font-medium transition-colors",
                  selected
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                )}
              >
                {selected && <Check className="h-3 w-3" strokeWidth={3} />}
                {opt.label}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PriceRangeFilter · inputs numéricos min/max con formato español 500.000
   ═══════════════════════════════════════════════════════════════════ */
function PriceRangeFilter({
  min, max, onMinChange, onMaxChange,
}: {
  min: number | null;
  max: number | null;
  onMinChange: (v: number | null) => void;
  onMaxChange: (v: number | null) => void;
}) {
  const fmt = (v: number | null) => v === null ? "" : v.toLocaleString("es-ES");
  const parse = (s: string): number | null => {
    const digits = s.replace(/\D/g, "");
    if (!digits) return null;
    return parseInt(digits, 10);
  };
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="text-[13px] font-semibold text-foreground">Precio</h4>
        {(min !== null || max !== null) && (
          <button
            onClick={() => { onMinChange(null); onMaxChange(null); }}
            className="text-[11px] text-muted-foreground hover:text-destructive"
          >
            Limpiar
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="relative">
          <input
            type="text"
            inputMode="numeric"
            value={fmt(min)}
            onChange={(e) => onMinChange(parse(e.target.value))}
            placeholder="Mín."
            className="w-full h-9 pl-3 pr-8 text-sm bg-card border border-border rounded-xl focus:border-primary outline-none transition-colors tnum"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
        </div>
        <div className="relative">
          <input
            type="text"
            inputMode="numeric"
            value={fmt(max)}
            onChange={(e) => onMaxChange(parse(e.target.value))}
            placeholder="Máx."
            className="w-full h-9 pl-3 pr-8 text-sm bg-card border border-border rounded-xl focus:border-primary outline-none transition-colors tnum"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground mt-1.5">
        Formato: <span className="tnum">500.000</span> (separador de miles automático)
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   BedroomsThresholdFilter · radio-style con umbrales 1+ / 2+ / 3+ / 4+
   Seleccionar "2+" significa "al menos 2 dormitorios" → incluye 3+, 4+
   ═══════════════════════════════════════════════════════════════════ */
function BedroomsThresholdFilter({
  value, onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const thresholds = [1, 2, 3, 4];
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="text-[13px] font-semibold text-foreground">Dormitorios mínimos</h4>
        {value !== null && (
          <button onClick={() => onChange(null)} className="text-[11px] text-muted-foreground hover:text-destructive">
            Limpiar
          </button>
        )}
      </div>
      <div className="flex gap-1.5">
        {thresholds.map(n => {
          const selected = value === n;
          return (
            <button
              key={n}
              onClick={() => onChange(selected ? null : n)}
              className={cn(
                "flex-1 inline-flex items-center justify-center h-9 rounded-xl border text-sm font-medium transition-colors",
                selected
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
              )}
            >
              {n}+ hab
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   AgencySearcher · buscador + lista de agencias colaboradoras
   Solo se renderiza cuando collabFilter incluye "with-agencies".
   Selecciona una única agencia (o null) para filtrar promos donde
   esa agencia concreta colabora.
   ═══════════════════════════════════════════════════════════════════ */
function AgencySearcher({
  agencies: items, value, onChange,
}: {
  agencies: Agency[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const qq = q.toLowerCase().trim();
    if (!qq) return items;
    return items.filter(a => a.name.toLowerCase().includes(qq) || a.location.toLowerCase().includes(qq));
  }, [q, items]);
  const selected = value ? items.find(a => a.id === value) : null;

  return (
    <div className="pt-1">
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="text-[13px] font-semibold text-foreground">Agencia específica</h4>
        {value && (
          <button onClick={() => onChange(null)} className="text-[11px] text-muted-foreground hover:text-destructive">
            Quitar filtro
          </button>
        )}
      </div>
      {selected ? (
        <div className="flex items-center gap-2.5 p-2.5 rounded-xl border border-primary/30 bg-primary/5">
          <img src={selected.logo} alt="" className="h-8 w-8 rounded-full bg-white shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-foreground truncate">{selected.name}</p>
            <p className="text-[11px] text-muted-foreground truncate">{selected.location}</p>
          </div>
          <button onClick={() => onChange(null)} className="p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <>
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar agencia por nombre o ubicación..."
              className="w-full h-8 pl-8 pr-8 text-[12.5px] bg-muted/30 border border-border rounded-full focus:bg-background focus:border-primary outline-none transition-colors"
            />
            {q && (
              <button onClick={() => setQ("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="space-y-1 max-h-[160px] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-[11.5px] text-muted-foreground italic px-1 py-2">Sin coincidencias</p>
            ) : (
              filtered.map(ag => (
                <button
                  key={ag.id}
                  onClick={() => onChange(ag.id)}
                  className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/40 transition-colors text-left"
                >
                  <img src={ag.logo} alt="" className="h-7 w-7 rounded-full bg-white shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-medium text-foreground truncate">{ag.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{ag.location}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PromoCardCompact · tarjeta vertical para vista Cuadrícula
   ═══════════════════════════════════════════════════════════════════ */
function PromoCardCompact({ promo: p, isTrending }: { promo: DevPromotion; isTrending: boolean }) {
  const fmt = (n: number) =>
    new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
  return (
    <article className={cn(
      "group bg-card border rounded-2xl overflow-hidden shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer",
      isTrending ? "border-border ring-1 ring-amber-300/50" : "border-border"
    )}>
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {p.image && <img src={p.image} alt={p.name} className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform duration-500" loading="lazy" />}
        {isTrending && (
          <Tag variant="trending" size="sm" shape="pill" icon={<Flame className="h-3 w-3" />} className="absolute top-3 right-3">
            Trending
          </Tag>
        )}
        {p.badge && (
          <Tag variant="overlay" size="sm" shape="pill" className="absolute top-3 left-3 shadow-soft">
            {p.badge === "new" ? "Nueva" : "Últimas unidades"}
          </Tag>
        )}
      </div>
      <div className="p-4">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground truncate">{p.location}</p>
        <h3 className="text-[15px] font-bold text-foreground mt-0.5 truncate">{p.name}</h3>
        <p className="text-[11.5px] text-muted-foreground mt-0.5 truncate">
          {p.developer} · {p.delivery}
        </p>
        <p className="text-lg font-bold text-foreground mt-2 tnum">
          {fmt(p.priceMin)}
          {p.priceMax > p.priceMin && <span className="text-muted-foreground font-normal"> — {fmt(p.priceMax)}</span>}
        </p>
        <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between text-[11.5px]">
          <span className="text-muted-foreground"><span className="font-semibold text-foreground tnum">{p.availableUnits}/{p.totalUnits}</span> disp.</span>
          <span className="text-muted-foreground"><span className="font-semibold text-foreground tnum">{p.commission}%</span> com.</span>
          {p.agencies > 0 && (
            <span className="text-muted-foreground inline-flex items-center gap-1">
              <Users className="h-3 w-3" /> <span className="tnum">{p.agencies}</span>
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

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
