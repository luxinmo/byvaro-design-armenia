import { useMemo, useState } from "react";
import {
  Search, Plus, SlidersHorizontal, LayoutGrid, List, ChevronDown,
  MapPin, Calendar, Percent, TrendingUp, Users2, Star, Sparkles,
  MoreHorizontal, ArrowUpRight, Check, X, Building2, CircleDollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ══════════════════════════════════════════════════════════════════
   MOCK DATA (se reemplaza por fetch real cuando haya backend)
   ══════════════════════════════════════════════════════════════════ */

type PromotionStatus = "active" | "pre-sale" | "draft" | "sold-out";

type Promotion = {
  id: string;
  code: string;
  name: string;
  location: string;
  status: PromotionStatus;
  badge?: "new" | "last-units" | "hot";
  priceMin: number;
  priceMax: number;
  totalUnits: number;
  availableUnits: number;
  commission: number;          // %
  delivery: string;            // "Q2 2026"
  constructionProgress?: number; // 0-100
  image: string;
  propertyTypes: string[];
  agencyAvatars: string[];
  agencyCount: number;
  activity: {
    registros: number;
    visitas: number;
    reservas: number;
    trend: number;             // -100..+100
  };
  updatedAt: string;
};

const PROMOS: Promotion[] = [
  {
    id: "1", code: "PRM-0050", name: "Los Arqueros",
    location: "Marbella, Costa del Sol",
    status: "active", badge: "hot",
    priceMin: 512000, priceMax: 1850000,
    totalUnits: 36, availableUnits: 8,
    commission: 5, delivery: "Q3 2026", constructionProgress: 78,
    image: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&h=500&fit=crop",
    propertyTypes: ["Villas", "Áticos"],
    agencyAvatars: [
      "https://ui-avatars.com/api/?name=EV&background=2563eb&color=fff&size=60&bold=true",
      "https://ui-avatars.com/api/?name=HM&background=d97706&color=fff&size=60&bold=true",
      "https://ui-avatars.com/api/?name=KR&background=dc2626&color=fff&size=60&bold=true",
      "https://ui-avatars.com/api/?name=CB&background=059669&color=fff&size=60&bold=true",
    ],
    agencyCount: 6,
    activity: { registros: 480, visitas: 142, reservas: 28, trend: 18 },
    updatedAt: "hace 2 h",
  },
  {
    id: "2", code: "PRM-0049", name: "Villas del Pinar",
    location: "Jávea, Alicante",
    status: "active",
    priceMin: 685000, priceMax: 1200000,
    totalUnits: 24, availableUnits: 10,
    commission: 4.5, delivery: "Q1 2027", constructionProgress: 58,
    image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=500&fit=crop",
    propertyTypes: ["Villas"],
    agencyAvatars: [
      "https://ui-avatars.com/api/?name=CB&background=059669&color=fff&size=60&bold=true",
      "https://ui-avatars.com/api/?name=IB&background=7c3aed&color=fff&size=60&bold=true",
    ],
    agencyCount: 4,
    activity: { registros: 328, visitas: 96, reservas: 14, trend: 8 },
    updatedAt: "hace 5 h",
  },
  {
    id: "3", code: "PRM-0048", name: "Terrazas del Golf",
    location: "Mijas, Málaga",
    status: "active", badge: "last-units",
    priceMin: 420000, priceMax: 890000,
    totalUnits: 22, availableUnits: 5,
    commission: 5, delivery: "Q4 2025", constructionProgress: 92,
    image: "https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=800&h=500&fit=crop",
    propertyTypes: ["Apartamentos", "Dúplex"],
    agencyAvatars: [
      "https://ui-avatars.com/api/?name=EV&background=2563eb&color=fff&size=60&bold=true",
      "https://ui-avatars.com/api/?name=NR&background=0891b2&color=fff&size=60&bold=true",
      "https://ui-avatars.com/api/?name=HM&background=d97706&color=fff&size=60&bold=true",
    ],
    agencyCount: 5,
    activity: { registros: 238, visitas: 78, reservas: 17, trend: 12 },
    updatedAt: "hace 1 día",
  },
  {
    id: "4", code: "PRM-0047", name: "Residencial Aurora",
    location: "Finestrat, Alicante",
    status: "pre-sale", badge: "new",
    priceMin: 310000, priceMax: 620000,
    totalUnits: 48, availableUnits: 42,
    commission: 6, delivery: "Q2 2027", constructionProgress: 12,
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=500&fit=crop",
    propertyTypes: ["Apartamentos"],
    agencyAvatars: [
      "https://ui-avatars.com/api/?name=IB&background=7c3aed&color=fff&size=60&bold=true",
      "https://ui-avatars.com/api/?name=CB&background=059669&color=fff&size=60&bold=true",
    ],
    agencyCount: 3,
    activity: { registros: 272, visitas: 34, reservas: 9, trend: 42 },
    updatedAt: "hace 8 h",
  },
  {
    id: "5", code: "PRM-0046", name: "Altea Hills Residences",
    location: "Altea, Alicante",
    status: "active",
    priceMin: 344000, priceMax: 1400000,
    totalUnits: 48, availableUnits: 12,
    commission: 5, delivery: "Q2 2026", constructionProgress: 45,
    image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&h=500&fit=crop",
    propertyTypes: ["Apartamentos", "Áticos"],
    agencyAvatars: [
      "https://ui-avatars.com/api/?name=EV&background=2563eb&color=fff&size=60&bold=true",
      "https://ui-avatars.com/api/?name=MP&background=6b7280&color=fff&size=60&bold=true",
      "https://ui-avatars.com/api/?name=HM&background=d97706&color=fff&size=60&bold=true",
    ],
    agencyCount: 4,
    activity: { registros: 186, visitas: 48, reservas: 6, trend: 4 },
    updatedAt: "hace 3 h",
  },
  {
    id: "6", code: "PRM-0045", name: "Marina Bay Towers",
    location: "Valencia, Playa Malvarrosa",
    status: "draft",
    priceMin: 0, priceMax: 0,
    totalUnits: 80, availableUnits: 80,
    commission: 0, delivery: "—",
    image: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800&h=500&fit=crop",
    propertyTypes: ["Apartamentos"],
    agencyAvatars: [],
    agencyCount: 0,
    activity: { registros: 0, visitas: 0, reservas: 0, trend: 0 },
    updatedAt: "hace 2 días",
  },
  {
    id: "7", code: "PRM-0044", name: "Sotogrande Golf Villas",
    location: "San Roque, Cádiz",
    status: "sold-out",
    priceMin: 890000, priceMax: 2400000,
    totalUnits: 16, availableUnits: 0,
    commission: 4, delivery: "Q3 2025", constructionProgress: 100,
    image: "https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800&h=500&fit=crop",
    propertyTypes: ["Villas"],
    agencyAvatars: [
      "https://ui-avatars.com/api/?name=EV&background=2563eb&color=fff&size=60&bold=true",
      "https://ui-avatars.com/api/?name=HM&background=d97706&color=fff&size=60&bold=true",
    ],
    agencyCount: 3,
    activity: { registros: 412, visitas: 134, reservas: 16, trend: 0 },
    updatedAt: "hace 4 días",
  },
  {
    id: "8", code: "PRM-0043", name: "Costa Norte",
    location: "Benidorm, Alicante",
    status: "active", badge: "new",
    priceMin: 280000, priceMax: 560000,
    totalUnits: 60, availableUnits: 48,
    commission: 5.5, delivery: "Q4 2026", constructionProgress: 28,
    image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=500&fit=crop",
    propertyTypes: ["Apartamentos"],
    agencyAvatars: [
      "https://ui-avatars.com/api/?name=KR&background=dc2626&color=fff&size=60&bold=true",
      "https://ui-avatars.com/api/?name=NR&background=0891b2&color=fff&size=60&bold=true",
      "https://ui-avatars.com/api/?name=IB&background=7c3aed&color=fff&size=60&bold=true",
    ],
    agencyCount: 5,
    activity: { registros: 627, visitas: 98, reservas: 12, trend: 32 },
    updatedAt: "hace 6 h",
  },
];

/* ══════════════════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════════════════ */
const formatEur = (n: number) => {
  if (n === 0) return "—";
  if (n >= 1000000) return `${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1)}M€`;
  if (n >= 1000) return `${Math.round(n / 1000)}K€`;
  return `${n}€`;
};

const statusConfig: Record<PromotionStatus, { label: string; tone: string }> = {
  active: { label: "Activa", tone: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  "pre-sale": { label: "Pre-venta", tone: "bg-amber-50 text-amber-700 border-amber-100" },
  draft: { label: "Borrador", tone: "bg-muted text-muted-foreground border-border" },
  "sold-out": { label: "Vendida", tone: "bg-primary/10 text-primary border-primary/20" },
};

const badgeConfig = {
  new: { label: "Nueva", tone: "bg-primary text-primary-foreground", icon: Sparkles },
  "last-units": { label: "Últimas unidades", tone: "bg-amber-500 text-white", icon: Star },
  hot: { label: "Top", tone: "bg-gradient-to-br from-orange-500 to-red-500 text-white", icon: TrendingUp },
};

/* ══════════════════════════════════════════════════════════════════
   MAIN
   ══════════════════════════════════════════════════════════════════ */
export default function Promociones() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PromotionStatus | "all">("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const counts = useMemo(() => {
    return {
      all: PROMOS.length,
      active: PROMOS.filter(p => p.status === "active").length,
      "pre-sale": PROMOS.filter(p => p.status === "pre-sale").length,
      draft: PROMOS.filter(p => p.status === "draft").length,
      "sold-out": PROMOS.filter(p => p.status === "sold-out").length,
    };
  }, []);

  const filtered = useMemo(() => {
    return PROMOS.filter(p => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !p.location.toLowerCase().includes(q) && !p.code.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [search, statusFilter]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex-1 flex flex-col min-h-full bg-background">
      {/* ════ HEADER ════ */}
      <div className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Comercial</p>
            <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight mt-1 leading-tight">
              Promociones <span className="text-muted-foreground font-medium text-[18px] sm:text-[22px]">· {counts.all}</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button className="hidden sm:inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors">
              <CircleDollarSign className="h-3.5 w-3.5 text-muted-foreground" /> Informe
            </button>
            <button className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors shadow-soft">
              <Plus className="h-3.5 w-3.5" /> Nueva promoción
            </button>
          </div>
        </div>
      </div>

      {/* ════ STATS BAR (status tabs) ════ */}
      <div className="px-4 sm:px-6 lg:px-8 mt-5">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
            <StatTab label="Todas" count={counts.all} active={statusFilter === "all"} onClick={() => setStatusFilter("all")} />
            <StatTab label="Activas" count={counts.active} active={statusFilter === "active"} onClick={() => setStatusFilter("active")} tone="emerald" />
            <StatTab label="Pre-venta" count={counts["pre-sale"]} active={statusFilter === "pre-sale"} onClick={() => setStatusFilter("pre-sale")} tone="amber" />
            <StatTab label="Borradores" count={counts.draft} active={statusFilter === "draft"} onClick={() => setStatusFilter("draft")} tone="muted" />
            <StatTab label="Vendidas" count={counts["sold-out"]} active={statusFilter === "sold-out"} onClick={() => setStatusFilter("sold-out")} tone="primary" />
          </div>
        </div>
      </div>

      {/* ════ TOOLBAR ════ */}
      <div className="px-4 sm:px-6 lg:px-8 mt-4">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row sm:items-center gap-3">

          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, ubicación o código…"
              className="w-full h-9 pl-9 pr-9 text-sm bg-card border border-border rounded-full focus:border-primary outline-none transition-colors"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filter pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <FilterPill label="Ubicación" />
            <FilterPill label="Tipología" />
            <FilterPill label="Precio" />
            <FilterPill label="Agencia" />
            <button className="inline-flex items-center gap-1 h-8 px-3 rounded-full text-[12.5px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Más
            </button>
          </div>

          {/* View toggle */}
          <div className="sm:ml-auto flex items-center gap-1 bg-muted/40 border border-border rounded-full p-0.5">
            <button
              onClick={() => setView("grid")}
              className={cn(
                "inline-flex items-center justify-center h-7 w-7 rounded-full transition-colors",
                view === "grid" ? "bg-background text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="Vista grid"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setView("list")}
              className={cn(
                "inline-flex items-center justify-center h-7 w-7 rounded-full transition-colors",
                view === "list" ? "bg-background text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="Vista lista"
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ════ CONTENT ════ */}
      <div className="px-4 sm:px-6 lg:px-8 mt-5 pb-8">
        <div className="max-w-[1400px] mx-auto">

          {filtered.length === 0 ? (
            <EmptyState />
          ) : view === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(p => (
                <PromoCard key={p.id} promo={p} selected={selected.has(p.id)} onToggleSelect={() => toggleSelect(p.id)} />
              ))}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl shadow-soft overflow-hidden">
              <div className="hidden md:grid grid-cols-[32px_minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_80px] gap-3 px-4 py-3 border-b border-border bg-muted/20">
                <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground" />
                <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Promoción</div>
                <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Estado</div>
                <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Unidades</div>
                <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Actividad</div>
                <div />
              </div>
              <div className="divide-y divide-border">
                {filtered.map(p => (
                  <PromoRow key={p.id} promo={p} selected={selected.has(p.id)} onToggleSelect={() => toggleSelect(p.id)} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ════ FLOATING SELECTION BAR ════ */}
      {selected.size > 0 && (
        <div className="fixed bottom-[72px] lg:bottom-6 left-1/2 -translate-x-1/2 z-40 bg-foreground text-background rounded-full shadow-soft-lg px-2 py-2 flex items-center gap-1">
          <span className="text-xs font-medium px-3">{selected.size} seleccionada{selected.size > 1 ? "s" : ""}</span>
          <div className="h-4 w-px bg-background/20" />
          <button className="px-3 h-8 rounded-full text-xs font-medium hover:bg-background/10 transition-colors">Compartir</button>
          <button className="px-3 h-8 rounded-full text-xs font-medium hover:bg-background/10 transition-colors">Exportar</button>
          <button onClick={() => setSelected(new Set())} className="px-3 h-8 rounded-full text-xs font-medium hover:bg-background/10 transition-colors">Cancelar</button>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   STAT TAB
   ══════════════════════════════════════════════════════════════════ */
function StatTab({ label, count, active, onClick, tone = "default" }: { label: string; count: number; active: boolean; onClick: () => void; tone?: "default" | "emerald" | "amber" | "muted" | "primary" }) {
  const toneMap = {
    default: "bg-foreground text-background",
    emerald: "bg-emerald-600 text-white",
    amber: "bg-amber-500 text-white",
    muted: "bg-muted-foreground text-background",
    primary: "bg-primary text-primary-foreground",
  };
  return (
    <button
      onClick={onClick}
      className={cn(
        "group inline-flex items-center gap-2 h-8 px-3.5 rounded-full text-[12.5px] font-medium whitespace-nowrap transition-all shrink-0",
        active
          ? "bg-foreground text-background shadow-soft"
          : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
      )}
    >
      {label}
      <span className={cn(
        "tnum text-[11px] font-semibold px-1.5 py-px rounded-md",
        active ? "bg-background/15 text-background" : toneMap[tone] + " opacity-90"
      )}>
        {count}
      </span>
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════
   FILTER PILL
   ══════════════════════════════════════════════════════════════════ */
function FilterPill({ label }: { label: string }) {
  return (
    <button className="inline-flex items-center gap-1 h-8 px-3 rounded-full border border-border bg-card text-[12.5px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors">
      {label}
      <ChevronDown className="h-3 w-3" />
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PROMO CARD (grid)
   ══════════════════════════════════════════════════════════════════ */
function PromoCard({ promo, selected, onToggleSelect }: { promo: Promotion; selected: boolean; onToggleSelect: () => void }) {
  const status = statusConfig[promo.status];
  const badge = promo.badge ? badgeConfig[promo.badge] : null;
  const BadgeIcon = badge?.icon;
  const availablePct = (promo.availableUnits / promo.totalUnits) * 100;

  return (
    <article
      className={cn(
        "group relative bg-card border rounded-2xl overflow-hidden shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer",
        selected ? "border-primary ring-2 ring-primary/20" : "border-border"
      )}
    >
      {/* Cover */}
      <div className="relative aspect-[16/9] overflow-hidden bg-muted">
        <img
          src={promo.image}
          alt={promo.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

        {/* Select checkbox */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
          className={cn(
            "absolute top-3 left-3 h-6 w-6 rounded-md border-2 grid place-items-center transition-all",
            selected
              ? "bg-primary border-primary text-primary-foreground opacity-100"
              : "bg-white/90 border-white/60 backdrop-blur-sm hover:border-primary opacity-0 group-hover:opacity-100"
          )}
          aria-label={selected ? "Deseleccionar" : "Seleccionar"}
        >
          {selected && <Check className="h-3.5 w-3.5" />}
        </button>

        {/* Badges */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          {badge && BadgeIcon && (
            <span className={cn("inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full shadow-soft", badge.tone)}>
              <BadgeIcon className="h-3 w-3" />
              {badge.label}
            </span>
          )}
        </div>

        {/* Status */}
        <div className="absolute bottom-3 left-3">
          <span className={cn("inline-block text-[10.5px] font-semibold px-2.5 py-1 rounded-full border shadow-soft backdrop-blur-sm", status.tone)}>
            {status.label}
          </span>
        </div>

        {/* More menu */}
        <button
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-3 right-3 h-8 w-8 rounded-full bg-white/90 backdrop-blur-sm grid place-items-center text-foreground hover:bg-white transition-colors opacity-0 group-hover:opacity-100 shadow-soft"
          aria-label="Más opciones"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 sm:p-5">
        {/* Title + code */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold truncate leading-tight">{promo.name}</h3>
            <div className="flex items-center gap-1.5 mt-1 text-[12px] text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{promo.location}</span>
              <span className="opacity-50">·</span>
              <span className="tnum opacity-80">{promo.code}</span>
            </div>
          </div>
        </div>

        {/* Price */}
        <div className="mt-3 flex items-baseline gap-1">
          {promo.priceMin > 0 ? (
            <>
              <span className="text-[11px] text-muted-foreground">Desde</span>
              <span className="text-[17px] font-bold tnum tracking-tight">{formatEur(promo.priceMin)}</span>
              {promo.priceMax !== promo.priceMin && (
                <span className="text-[12px] text-muted-foreground tnum"> – {formatEur(promo.priceMax)}</span>
              )}
            </>
          ) : (
            <span className="text-[12px] text-muted-foreground italic">Precio por definir</span>
          )}
        </div>

        {/* KPI grid */}
        <div className="mt-4 grid grid-cols-4 gap-2 py-3 border-y border-border">
          <KpiCell label="Disponibles" value={`${promo.availableUnits}/${promo.totalUnits}`} />
          <KpiCell label="Registros" value={promo.activity.registros.toString()} />
          <KpiCell label="Visitas" value={promo.activity.visitas.toString()} />
          <KpiCell label="Reservas" value={promo.activity.reservas.toString()} accent />
        </div>

        {/* Progress + delivery */}
        {promo.constructionProgress !== undefined && (
          <div className="mt-3.5">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                <span>Obra {promo.constructionProgress}%</span>
              </span>
              <span className="inline-flex items-center gap-1 tnum">
                <Calendar className="h-3 w-3" />
                <span>{promo.delivery}</span>
              </span>
            </div>
            <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  promo.constructionProgress === 100 ? "bg-emerald-500" : "bg-gradient-to-r from-primary to-primary/70"
                )}
                style={{ width: `${promo.constructionProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer: commission + agencies */}
        <div className="mt-4 flex items-center justify-between gap-3">
          {promo.commission > 0 ? (
            <div className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
              <Percent className="h-3 w-3" />
              {promo.commission}% comisión
            </div>
          ) : (
            <span className="text-[11.5px] text-muted-foreground italic">Sin comisión</span>
          )}

          {promo.agencyCount > 0 ? (
            <div className="flex items-center gap-1.5">
              <div className="flex -space-x-1.5">
                {promo.agencyAvatars.slice(0, 3).map((a, i) => (
                  <img key={i} src={a} alt="" className="h-6 w-6 rounded-full ring-2 ring-card bg-white" />
                ))}
                {promo.agencyCount > 3 && (
                  <div className="h-6 w-6 rounded-full ring-2 ring-card bg-muted grid place-items-center text-[9.5px] font-bold text-muted-foreground">
                    +{promo.agencyCount - 3}
                  </div>
                )}
              </div>
              <span className="text-[11px] text-muted-foreground tnum">{promo.agencyCount}</span>
            </div>
          ) : (
            <span className="text-[11.5px] text-muted-foreground italic inline-flex items-center gap-1">
              <Users2 className="h-3 w-3" /> Sin colaboradores
            </span>
          )}
        </div>
      </div>

      {/* Hover corner arrow */}
      <div className="absolute bottom-0 right-0 h-10 w-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="absolute bottom-3 right-3 h-7 w-7 rounded-full bg-foreground text-background grid place-items-center shadow-soft">
          <ArrowUpRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </article>
  );
}

function KpiCell({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-center min-w-0">
      <p className={cn("text-[14px] font-bold tnum leading-none", accent && "text-primary")}>{value}</p>
      <p className="text-[9.5px] uppercase tracking-wider text-muted-foreground font-semibold mt-1 truncate">{label}</p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PROMO ROW (list)
   ══════════════════════════════════════════════════════════════════ */
function PromoRow({ promo, selected, onToggleSelect }: { promo: Promotion; selected: boolean; onToggleSelect: () => void }) {
  const status = statusConfig[promo.status];
  return (
    <div
      className={cn(
        "grid grid-cols-[32px_minmax(0,1fr)_80px] md:grid-cols-[32px_minmax(0,2.4fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_80px] gap-3 px-4 py-3.5 hover:bg-muted/20 transition-colors cursor-pointer items-center",
        selected && "bg-primary/5"
      )}
    >
      {/* Checkbox */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
        className={cn(
          "h-5 w-5 rounded border-2 grid place-items-center transition-all",
          selected ? "bg-primary border-primary text-primary-foreground" : "border-border hover:border-primary"
        )}
        aria-label={selected ? "Deseleccionar" : "Seleccionar"}
      >
        {selected && <Check className="h-3 w-3" />}
      </button>

      {/* Promoción (name + cover + code + location) */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-11 w-11 rounded-lg bg-cover bg-center ring-1 ring-border shrink-0"
          style={{ backgroundImage: `url(${promo.image})` }}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-[13.5px] font-semibold truncate">{promo.name}</h4>
            {promo.badge && (
              <span className={cn("hidden lg:inline-flex items-center text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0", badgeConfig[promo.badge].tone)}>
                {badgeConfig[promo.badge].label}
              </span>
            )}
          </div>
          <p className="text-[11.5px] text-muted-foreground mt-0.5 truncate">{promo.location} · {promo.code}</p>
        </div>
      </div>

      {/* Estado */}
      <div className="hidden md:block">
        <span className={cn("inline-block text-[10.5px] font-semibold px-2.5 py-1 rounded-full border", status.tone)}>
          {status.label}
        </span>
      </div>

      {/* Unidades */}
      <div className="hidden md:block">
        <div className="flex items-baseline gap-1.5">
          <span className="text-sm font-bold tnum">{promo.availableUnits}/{promo.totalUnits}</span>
          <span className="text-[11px] text-muted-foreground">disponibles</span>
        </div>
        <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden w-24">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
            style={{ width: `${((promo.totalUnits - promo.availableUnits) / promo.totalUnits) * 100}%` }}
          />
        </div>
      </div>

      {/* Actividad */}
      <div className="hidden md:flex items-center gap-3 text-[12px]">
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <span className="tnum font-semibold text-foreground">{promo.activity.registros}</span> reg
        </span>
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <span className="tnum font-semibold text-foreground">{promo.activity.reservas}</span> res
        </span>
        {promo.activity.trend > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-emerald-600 tnum">
            <TrendingUp className="h-3 w-3" /> +{promo.activity.trend}%
          </span>
        )}
      </div>

      {/* More */}
      <button
        onClick={(e) => e.stopPropagation()}
        className="justify-self-end p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label="Más opciones"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   EMPTY STATE
   ══════════════════════════════════════════════════════════════════ */
function EmptyState() {
  return (
    <div className="py-16 text-center">
      <div className="h-12 w-12 rounded-2xl bg-muted grid place-items-center mx-auto mb-4">
        <Search className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold">No hay promociones que coincidan</h3>
      <p className="text-[12.5px] text-muted-foreground mt-1">Prueba a cambiar los filtros o la búsqueda.</p>
    </div>
  );
}
