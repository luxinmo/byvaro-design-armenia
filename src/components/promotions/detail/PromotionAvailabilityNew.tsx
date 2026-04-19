import { useState, useMemo } from "react";
import { unitsByPromotion, Unit, UnitStatus } from "@/data/units";
import {
  Search, Bed, Bath, Maximize, Compass, Waves, TreePine,
  ChevronDown, ChevronUp, ArrowUpDown, List, LayoutGrid,
  Building2, Eye, MapPin, X
} from "lucide-react";
import { cn } from "@/lib/utils";

function formatPrice(n: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

const statusDot: Record<UnitStatus, string> = {
  available: "bg-emerald-500",
  reserved: "bg-amber-500",
  sold: "bg-blue-500",
  withdrawn: "bg-muted-foreground/30",
};

const statusLabel: Record<UnitStatus, string> = {
  available: "Disponible",
  reserved: "Reservada",
  sold: "Vendida",
  withdrawn: "Retirada",
};

type SortField = "price" | "bedrooms" | "builtArea" | "floor";

// ═══════════════════════════════════════════════
// SINGLE UNIT — Show House style
// ═══════════════════════════════════════════════
function SingleUnitView({ unit }: { unit: Unit }) {
  const pricePerM2 = Math.round(unit.price / unit.builtArea);
  const hasSeaView = unit.floor >= 3;

  return (
    <div className="rounded-2xl border border-border/40 bg-card overflow-hidden" style={{ maxWidth: "1250px" }}>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px]">
        {/* Photo */}
        <div className="relative h-[320px] lg:h-[400px] overflow-hidden bg-muted">
          <img
            src="https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=900&h=600&fit=crop"
            alt={unit.type}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-background/90 backdrop-blur-sm text-xs font-semibold text-foreground border border-border/30">
              Última unidad
            </span>
          </div>
        </div>

        {/* Info */}
        <div className="p-6 lg:p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`h-2 w-2 rounded-full ${statusDot[unit.status]}`} />
              <span className="text-xs text-muted-foreground font-medium">{statusLabel[unit.status]}</span>
            </div>

            <p className="text-xs text-muted-foreground mt-3 uppercase tracking-wider font-medium">{unit.type} · {unit.id}</p>
            <p className="text-3xl font-bold text-foreground tracking-tight mt-1">{formatPrice(unit.price)}</p>
            <p className="text-xs text-muted-foreground">{formatPrice(pricePerM2)}/m²</p>

            <div className="h-px bg-border/40 my-5" />

            <div className="grid grid-cols-2 gap-y-4 gap-x-6">
              <Spec icon={Bed} label="Dormitorios" value={`${unit.bedrooms}`} />
              <Spec icon={Bath} label="Baños" value={`${unit.bathrooms}`} />
              <Spec icon={Maximize} label="Superficie" value={`${unit.builtArea} m²`} />
              <Spec icon={Maximize} label="Útil" value={`${unit.usableArea} m²`} />
              <Spec icon={Compass} label="Orientación" value={unit.orientation} />
              <Spec icon={Building2} label="Planta" value={`${unit.floor}ª`} />
              {unit.terrace > 0 && <Spec icon={TreePine} label="Terraza" value={`${unit.terrace} m²`} />}
              {unit.garden > 0 && <Spec icon={TreePine} label="Jardín" value={`${unit.garden} m²`} />}
            </div>

            {(unit.hasPool || hasSeaView) && (
              <div className="flex flex-wrap gap-1.5 mt-5">
                {unit.hasPool && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-medium">
                    <Waves className="h-3 w-3" /> Piscina
                  </span>
                )}
                {hasSeaView && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-700 text-[10px] font-medium">
                    <Eye className="h-3 w-3" /> Vistas al mar
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Spec({ icon: Icon, label, value }: { icon: typeof Bed; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground/60" strokeWidth={1.5} />
      <div>
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground leading-tight">{value}</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// MULTI UNIT — List + Table views
// ═══════════════════════════════════════════════
export function PromotionAvailabilityNew({ promotionId, readOnly = false }: { promotionId: string; readOnly?: boolean }) {
  const allUnits = unitsByPromotion[promotionId] || [];
  const availableUnits = allUnits.filter(u => u.status === "available");

  // Single unit → show house mode
  if (availableUnits.length === 1) {
    return <SingleUnitView unit={availableUnits[0]} />;
  }

  return <MultiUnitView allUnits={allUnits} readOnly={readOnly} />;
}

function MultiUnitView({ allUnits, readOnly }: { allUnits: Unit[]; readOnly: boolean }) {
  const [view, setView] = useState<"list" | "table">("list");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<UnitStatus | "all">("all");
  const [filterBedrooms, setFilterBedrooms] = useState<number | "all">("all");
  const [sortField, setSortField] = useState<SortField>("price");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);

  const bedroomOptions = [...new Set(allUnits.map(u => u.bedrooms))].sort();

  const filtered = useMemo(() => {
    let result = [...allUnits];
    if (filterStatus !== "all") result = result.filter(u => u.status === filterStatus);
    if (filterBedrooms !== "all") result = result.filter(u => u.bedrooms === filterBedrooms);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(u => u.id.toLowerCase().includes(q) || u.type.toLowerCase().includes(q) || u.door.toLowerCase().includes(q));
    }
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "price": cmp = a.price - b.price; break;
        case "bedrooms": cmp = a.bedrooms - b.bedrooms; break;
        case "builtArea": cmp = a.builtArea - b.builtArea; break;
        case "floor": cmp = (a.block + a.floor) < (b.block + b.floor) ? -1 : 1; break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [allUnits, filterStatus, filterBedrooms, search, sortField, sortDir]);

  const available = allUnits.filter(u => u.status === "available").length;
  const reserved = allUnits.filter(u => u.status === "reserved").length;
  const sold = allUnits.filter(u => u.status === "sold").length;

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  return (
    <div className="space-y-4" style={{ maxWidth: "1250px" }}>
      {/* Stats strip */}
      <div className="flex items-center gap-6">
        <StatPill label="Disponibles" value={available} color="text-emerald-600" />
        <StatPill label="Reservadas" value={reserved} color="text-amber-600" />
        <StatPill label="Vendidas" value={sold} color="text-blue-600" />
        <StatPill label="Total" value={allUnits.length} />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-[260px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" strokeWidth={1.5} />
          <input
            placeholder="Buscar unidad..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-8 pl-8 pr-3 rounded-lg border border-border/60 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
          {search && (
            <button className="absolute right-2.5 top-1/2 -translate-y-1/2" onClick={() => setSearch("")}>
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>

        <FilterPill
          value={filterStatus}
          onChange={v => setFilterStatus(v as UnitStatus | "all")}
          options={[
            { value: "all", label: "Todos estados" },
            { value: "available", label: "Disponible" },
            { value: "reserved", label: "Reservada" },
            { value: "sold", label: "Vendida" },
          ]}
        />

        <FilterPill
          value={filterBedrooms === "all" ? "all" : String(filterBedrooms)}
          onChange={v => setFilterBedrooms(v === "all" ? "all" : Number(v))}
          options={[
            { value: "all", label: "Todos hab." },
            ...bedroomOptions.map(b => ({ value: String(b), label: `${b} hab.` })),
          ]}
        />

        <div className="ml-auto flex items-center gap-0.5 bg-muted/40 rounded-lg p-0.5">
          <button
            onClick={() => setView("list")}
            className={cn(
              "h-7 w-7 rounded-md flex items-center justify-center transition-colors",
              view === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <List className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setView("table")}
            className={cn(
              "h-7 w-7 rounded-md flex items-center justify-center transition-colors",
              view === "table" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      {view === "list" ? (
        <ListView units={filtered} expandedUnit={expandedUnit} onToggle={id => setExpandedUnit(prev => prev === id ? null : id)} />
      ) : (
        <TableView units={filtered} sortField={sortField} sortDir={sortDir} onSort={handleSort} />
      )}

      {filtered.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground">No se encontraron unidades con estos filtros</p>
        </div>
      )}
    </div>
  );
}

// ── List View (flat table, no cards) ──
function ListView({ units, expandedUnit, onToggle }: { units: Unit[]; expandedUnit: string | null; onToggle: (id: string) => void }) {
  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center px-4 py-2.5 border-b border-border/40 text-xs font-medium text-muted-foreground">
        <span className="w-6 shrink-0" />
        <span className="w-[160px] shrink-0">Unidad</span>
        <span className="w-[140px] shrink-0">Tipo</span>
        <span className="w-[80px] shrink-0 text-center">Hab.</span>
        <span className="w-[80px] shrink-0 text-center">Baños</span>
        <span className="w-[80px] shrink-0 text-center">m²</span>
        <span className="w-[120px] shrink-0 hidden lg:block">Orient.</span>
        <span className="w-[80px] shrink-0 text-center hidden lg:block">Planta</span>
        <span className="ml-auto text-right min-w-[100px]">Precio</span>
      </div>

      {/* Rows */}
      {units.map(u => {
        const isExpanded = expandedUnit === u.id;
        const pricePerM2 = Math.round(u.price / u.builtArea);
        const isAvailable = u.status === "available";

        return (
          <div key={u.id}>
            <button
              onClick={() => onToggle(u.id)}
              className={cn(
                "w-full flex items-center px-4 py-3 text-left border-b border-border/20 transition-colors hover:bg-muted/30",
                u.status === "sold" && "opacity-40"
              )}
            >
              <span className="w-6 shrink-0 flex items-center">
                <span className={`h-2 w-2 rounded-full ${statusDot[u.status]}`} />
              </span>
              <span className={cn("w-[160px] shrink-0 text-sm truncate", isAvailable ? "font-semibold text-foreground" : "text-muted-foreground")}>{u.id}</span>
              <span className="w-[140px] shrink-0 text-sm text-muted-foreground">{u.type}</span>
              <span className={cn("w-[80px] shrink-0 text-sm text-center", isAvailable ? "font-medium text-foreground" : "text-muted-foreground")}>{u.bedrooms}</span>
              <span className="w-[80px] shrink-0 text-sm text-center text-muted-foreground">{u.bathrooms}</span>
              <span className={cn("w-[80px] shrink-0 text-sm text-center", isAvailable ? "font-medium text-foreground" : "text-muted-foreground")}>{u.builtArea}</span>
              <span className={cn("w-[120px] shrink-0 text-sm hidden lg:block", isAvailable ? "text-foreground" : "text-muted-foreground")}>{u.orientation}</span>
              <span className="w-[80px] shrink-0 text-sm text-center text-muted-foreground hidden lg:block">{u.floor}ª</span>
              <span className={cn("ml-auto text-right min-w-[100px] text-sm", isAvailable ? "font-bold text-foreground" : "font-medium text-muted-foreground")}>{formatPrice(u.price)}</span>
            </button>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="px-4 py-3 border-b border-border/20 bg-muted/10">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pl-6">
                  <MiniSpec label="Superficie construida" value={`${u.builtArea} m²`} />
                  <MiniSpec label="Superficie útil" value={`${u.usableArea} m²`} />
                  {u.terrace > 0 && <MiniSpec label="Terraza" value={`${u.terrace} m²`} />}
                  {u.garden > 0 && <MiniSpec label="Jardín" value={`${u.garden} m²`} />}
                  {u.parcel > 0 && <MiniSpec label="Parcela" value={`${u.parcel} m²`} />}
                  <MiniSpec label="Planta" value={`${u.floor}ª`} />
                  <MiniSpec label="Orientación" value={u.orientation} />
                  <MiniSpec label="Precio/m²" value={formatPrice(pricePerM2)} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Table View ──
function TableView({ units, sortField, sortDir, onSort }: { units: Unit[]; sortField: SortField; sortDir: "asc" | "desc"; onSort: (f: SortField) => void }) {
  const SortIcon = ({ field }: { field: SortField }) => (
    <span className="inline-flex ml-0.5 opacity-40">
      {sortField === field
        ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)
        : <ArrowUpDown className="h-3 w-3" />}
    </span>
  );

  return (
    <div className="rounded-xl border border-border/40 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/30 text-muted-foreground">
              <th className="px-4 py-2.5 text-left font-medium w-8" />
              <th className="px-3 py-2.5 text-left font-medium">Unidad</th>
              <th className="px-3 py-2.5 text-left font-medium">Tipo</th>
              <th className="px-3 py-2.5 text-center font-medium cursor-pointer select-none" onClick={() => onSort("bedrooms")}>
                Hab. <SortIcon field="bedrooms" />
              </th>
              <th className="px-3 py-2.5 text-center font-medium">Baños</th>
              <th className="px-3 py-2.5 text-right font-medium cursor-pointer select-none" onClick={() => onSort("builtArea")}>
                m² <SortIcon field="builtArea" />
              </th>
              <th className="px-3 py-2.5 text-left font-medium hidden lg:table-cell">Orient.</th>
              <th className="px-3 py-2.5 text-center font-medium cursor-pointer select-none" onClick={() => onSort("floor")}>
                Planta <SortIcon field="floor" />
              </th>
              <th className="px-3 py-2.5 text-right font-medium cursor-pointer select-none" onClick={() => onSort("price")}>
                Precio <SortIcon field="price" />
              </th>
            </tr>
          </thead>
          <tbody>
            {units.map((u, i) => (
              <tr key={u.id} className={cn(
                "border-t border-border/20 transition-colors hover:bg-muted/20",
                u.status === "sold" && "opacity-40"
              )}>
                <td className="px-4 py-2.5">
                  <span className={`h-2 w-2 rounded-full inline-block ${statusDot[u.status]}`} />
                </td>
                <td className="px-3 py-2.5 font-medium text-foreground">{u.id}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{u.type}</td>
                <td className="px-3 py-2.5 text-center text-foreground">{u.bedrooms}</td>
                <td className="px-3 py-2.5 text-center text-muted-foreground">{u.bathrooms}</td>
                <td className="px-3 py-2.5 text-right text-foreground">{u.builtArea}</td>
                <td className="px-3 py-2.5 text-muted-foreground hidden lg:table-cell">{u.orientation}</td>
                <td className="px-3 py-2.5 text-center text-muted-foreground">{u.floor}ª</td>
                <td className="px-3 py-2.5 text-right font-semibold text-foreground">{formatPrice(u.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Small helpers ──
function StatPill({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-base font-bold ${color || "text-foreground"}`}>{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function FilterPill({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="h-8 px-2.5 rounded-lg border border-border/60 bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function MiniSpec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-xs font-medium text-foreground">{value}</p>
    </div>
  );
}
