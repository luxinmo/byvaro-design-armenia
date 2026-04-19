import React, { useState, useMemo } from "react";
import { unitsByPromotion, Unit, UnitStatus } from "@/data/units";
import { Button } from "@/components/ui/button";
import {
  Download, Search, ChevronDown, ChevronUp,
  Waves, Building2, Compass, Bed, Bath, Maximize,
  TreePine, Droplets, Eye, MapPin, Info,
  ArrowUpDown, Image as ImageIcon, Video, FileText,
  Filter, X
} from "lucide-react";
import { cn } from "@/lib/utils";

function formatPrice(n: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

const statusConfig: Record<UnitStatus, { label: string; bg: string; text: string; dot: string; border: string }> = {
  available: { label: "Disponible", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", border: "border-emerald-200" },
  reserved: { label: "Reservada", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", border: "border-amber-200" },
  sold: { label: "Vendida", bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", border: "border-blue-200" },
  withdrawn: { label: "Retirada", bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-500", border: "border-rose-200" },
};

const statusOptions: UnitStatus[] = ["available", "reserved", "sold", "withdrawn"];

export function PromotionAvailabilityFullV2({ promotionId }: { promotionId: string }) {
  const allUnits = unitsByPromotion[promotionId] || [];

  const [filterStatus, setFilterStatus] = useState<UnitStatus | "all">("all");
  const [filterBedrooms, setFilterBedrooms] = useState<number | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const bedroomOptions = [...new Set(allUnits.map(u => u.bedrooms))].sort();
  const blocks = [...new Set(allUnits.map(u => u.block))];

  const filtered = useMemo(() => {
    let result = [...allUnits];
    if (filterStatus !== "all") result = result.filter(u => u.status === filterStatus);
    if (filterBedrooms !== "all") result = result.filter(u => u.bedrooms === filterBedrooms);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(u => u.id.toLowerCase().includes(q) || u.door.toLowerCase().includes(q) || u.type.toLowerCase().includes(q));
    }
    return result;
  }, [allUnits, filterStatus, filterBedrooms, searchQuery]);

  // Stats
  const available = allUnits.filter(u => u.status === "available").length;
  const reserved = allUnits.filter(u => u.status === "reserved").length;
  const sold = allUnits.filter(u => u.status === "sold").length;
  const avgPrice = Math.round(allUnits.filter(u => u.status === "available").reduce((s, u) => s + u.price, 0) / (available || 1));
  const priceRange = {
    min: Math.min(...allUnits.filter(u => u.status === "available").map(u => u.price)),
    max: Math.max(...allUnits.filter(u => u.status === "available").map(u => u.price)),
  };

  const selected = selectedUnit ? allUnits.find(u => u.id === selectedUnit) : null;

  // Group by block then floor
  const groupedByBlock = useMemo(() => {
    const map: Record<string, Record<number, Unit[]>> = {};
    for (const u of filtered) {
      if (!map[u.block]) map[u.block] = {};
      if (!map[u.block][u.floor]) map[u.block][u.floor] = [];
      map[u.block][u.floor].push(u);
    }
    return map;
  }, [filtered]);

  return (
    <div className="space-y-5">
      {/* Summary strip */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-6 flex-1">
          {[
            { label: "Disponibles", value: available, color: "text-emerald-600" },
            { label: "Reservadas", value: reserved, color: "text-amber-600" },
            { label: "Vendidas", value: sold, color: "text-blue-600" },
          ].map(s => (
            <button
              key={s.label}
              onClick={() => setFilterStatus(filterStatus === s.label.toLowerCase().slice(0, -1) + (s.label === "Disponibles" ? "e" : s.label === "Reservadas" ? "d" : "") as UnitStatus ? "all" : "all")}
              className="flex items-center gap-2"
            >
              <span className={`text-2xl font-bold ${s.color}`}>{s.value}</span>
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </button>
          ))}
          <div className="h-8 w-px bg-border" />
          <div>
            <span className="text-2xl font-bold text-foreground">{allUnits.length}</span>
            <span className="text-xs text-muted-foreground ml-2">Total</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Rango de precios disponibles</p>
          <p className="text-sm font-semibold text-foreground">
            {available > 0 ? `${formatPrice(priceRange.min)} — ${formatPrice(priceRange.max)}` : "—"}
          </p>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          <input
            type="text"
            placeholder="Buscar por unidad, tipo..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Status pills */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFilterStatus("all")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              filterStatus === "all" ? "bg-foreground text-background" : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            Todas
          </button>
          {statusOptions.map(s => {
            const sc = statusConfig[s];
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(filterStatus === s ? "all" : s)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border",
                  filterStatus === s
                    ? `${sc.bg} ${sc.text} ${sc.border}`
                    : "border-transparent text-muted-foreground hover:bg-muted/50"
                )}
              >
                {sc.label}
              </button>
            );
          })}
        </div>

        {/* Bedrooms filter */}
        <div className="flex items-center gap-1 ml-auto">
          <Bed className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
          {bedroomOptions.map(b => (
            <button
              key={b}
              onClick={() => setFilterBedrooms(filterBedrooms === b ? "all" : b)}
              className={cn(
                "h-7 w-7 rounded-lg text-xs font-medium transition-colors",
                filterBedrooms === b ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"
              )}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      {/* Main content: floor grid + detail panel */}
      <div className={cn("grid gap-5 transition-all", selected ? "grid-cols-[1fr_380px]" : "grid-cols-1")}>
        {/* Left: Floor plan cards */}
        <div className="space-y-4">
          {blocks.map(block => {
            const floors = groupedByBlock[block];
            if (!floors) return null;
            const floorNumbers = Object.keys(floors).map(Number).sort((a, b) => b - a);

            return (
              <div key={block} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <Building2 className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  <h3 className="text-sm font-semibold text-foreground">Bloque {block}</h3>
                  <span className="text-xs text-muted-foreground">
                    {(allUnits.filter(u => u.block === block && u.status === "available")).length} disponibles
                  </span>
                </div>

                <div className="border border-border rounded-xl bg-card overflow-hidden">
                  {floorNumbers.map((floor, fi) => {
                    const floorUnits = floors[floor];
                    return (
                      <div
                        key={floor}
                        className={cn("flex items-stretch", fi < floorNumbers.length - 1 && "border-b border-border")}
                      >
                        {/* Floor label */}
                        <div className="w-14 shrink-0 flex items-center justify-center bg-muted/30 border-r border-border">
                          <span className="text-xs font-semibold text-muted-foreground">{floor}ª</span>
                        </div>

                        {/* Unit cards row */}
                        <div className="flex-1 flex flex-wrap gap-2 p-2.5">
                          {floorUnits.map(u => {
                            const sc = statusConfig[u.status];
                            const isSelected = selectedUnit === u.id;
                            return (
                              <button
                                key={u.id}
                                onClick={() => setSelectedUnit(isSelected ? null : u.id)}
                                className={cn(
                                  "relative group flex flex-col items-start rounded-xl border px-3 py-2.5 min-w-[140px] flex-1 max-w-[200px] transition-all text-left",
                                  isSelected
                                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                                    : u.status === "available"
                                      ? "border-border hover:border-primary/40 hover:shadow-sm bg-card"
                                      : "border-border/60 bg-muted/20 opacity-75 hover:opacity-100"
                                )}
                              >
                                {/* Status dot */}
                                <span className={cn("absolute top-2.5 right-2.5 h-2 w-2 rounded-full", sc.dot)} />

                                <span className="text-sm font-bold text-foreground">{u.floor}º{u.door}</span>
                                <span className="text-xs text-muted-foreground mt-0.5">{u.type}</span>

                                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                  <span>{u.bedrooms}h · {u.bathrooms}b</span>
                                  <span>·</span>
                                  <span>{u.builtArea}m²</span>
                                </div>

                                <span className="text-sm font-bold text-foreground mt-1.5">{formatPrice(u.price)}</span>

                                {/* Features mini-icons */}
                                <div className="flex items-center gap-1 mt-1.5">
                                  {u.hasPool && <Waves className="h-3 w-3 text-blue-500" strokeWidth={1.5} />}
                                  {u.floor >= 3 && <Eye className="h-3 w-3 text-cyan-500" strokeWidth={1.5} />}
                                  {u.garden > 0 && <TreePine className="h-3 w-3 text-green-500" strokeWidth={1.5} />}
                                  {u.terrace > 0 && <Droplets className="h-3 w-3 text-emerald-500" strokeWidth={1.5} />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Detail sidebar */}
        {selected && (
          <div className="border border-border rounded-xl bg-card overflow-hidden sticky top-4 self-start">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/20">
              <div>
                <h3 className="text-lg font-bold text-foreground">{selected.floor}º{selected.door}</h3>
                <p className="text-xs text-muted-foreground">{selected.type} · Bloque {selected.block}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
                  statusConfig[selected.status].bg,
                  statusConfig[selected.status].text,
                  statusConfig[selected.status].border
                )}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", statusConfig[selected.status].dot)} />
                  {statusConfig[selected.status].label}
                </span>
                <button onClick={() => setSelectedUnit(null)} className="p-1 rounded-lg hover:bg-muted transition-colors">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Price hero */}
            <div className="px-5 py-5 border-b border-border">
              <p className="text-3xl font-bold text-foreground tracking-tight">{formatPrice(selected.price)}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {formatPrice(Math.round(selected.price / selected.builtArea))}/m² · {selected.builtArea} m² construidos
              </p>
            </div>

            {/* Surfaces */}
            <div className="px-5 py-4 border-b border-border space-y-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Superficies</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Construida", value: selected.builtArea, icon: Maximize },
                  { label: "Útil", value: selected.usableArea, icon: Maximize },
                  ...(selected.terrace > 0 ? [{ label: "Terraza", value: selected.terrace, icon: Droplets }] : []),
                  ...(selected.garden > 0 ? [{ label: "Jardín", value: selected.garden, icon: TreePine }] : []),
                  ...(selected.parcel > 0 ? [{ label: "Parcela", value: selected.parcel, icon: MapPin }] : []),
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2">
                    <s.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
                    <div>
                      <p className="text-sm font-semibold text-foreground leading-none">{s.value} m²</p>
                      <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Details */}
            <div className="px-5 py-4 border-b border-border space-y-2.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Características</p>
              <div className="grid grid-cols-2 gap-y-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <Bed className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                  <span className="text-foreground font-medium">{selected.bedrooms} dormitorios</span>
                </div>
                <div className="flex items-center gap-2">
                  <Bath className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                  <span className="text-foreground font-medium">{selected.bathrooms} baños</span>
                </div>
                <div className="flex items-center gap-2">
                  <Compass className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                  <span className="text-foreground font-medium">{selected.orientation}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                  <span className="text-foreground font-medium">Planta {selected.floor}ª</span>
                </div>
              </div>

              {/* Highlights */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {selected.hasPool && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-blue-600 bg-blue-50">
                    <Waves className="h-3 w-3" /> Piscina
                  </span>
                )}
                {selected.floor >= 3 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-cyan-600 bg-cyan-50">
                    <Eye className="h-3 w-3" /> Vistas
                  </span>
                )}
                {selected.garden > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-green-600 bg-green-50">
                    <TreePine className="h-3 w-3" /> Jardín
                  </span>
                )}
              </div>
            </div>

            {/* Resources */}
            <div className="px-5 py-4 space-y-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Recursos</p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { icon: FileText, label: "Plano", color: "text-violet-600 bg-violet-50 border-violet-200" },
                  { icon: ImageIcon, label: "Fotos (6)", color: "text-amber-600 bg-amber-50 border-amber-200" },
                  { icon: Video, label: "Vídeo", color: "text-rose-600 bg-rose-50 border-rose-200" },
                  { icon: Eye, label: "Tour 360°", color: "text-blue-600 bg-blue-50 border-blue-200" },
                ].map(r => (
                  <button key={r.label} className={cn("flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium transition-all hover:shadow-sm", r.color)}>
                    <r.icon className="h-3.5 w-3.5" strokeWidth={1.5} /> {r.label}
                  </button>
                ))}
              </div>
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs w-full mt-1">
                <Download className="h-3 w-3" strokeWidth={1.5} /> Descargar ficha
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-3">
        <span>Mostrando {filtered.length} de {allUnits.length} unidades</span>
      </div>
    </div>
  );
}
