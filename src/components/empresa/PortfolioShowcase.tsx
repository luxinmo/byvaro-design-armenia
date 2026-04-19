/**
 * PortfolioShowcase · grid editorial con las promociones más
 * relevantes del promotor. 1 card hero + 3 secundarias en desktop.
 * En móvil: 1 columna apilada.
 *
 * Cada card muestra:
 *   - Cover (aspect 4:3 o 16:9 según jerarquía)
 *   - Badge de estado (Activa · Nueva · Vendido)
 *   - Nombre en el overlay
 *   - Ubicación y unidades en la fila inferior
 *   - Rango de precio
 *   - Mini progress bar si es plurifamiliar con unidades vendidas
 */

import { useNavigate } from "react-router-dom";
import { MapPin, ArrowRight, Building2, Sparkles } from "lucide-react";
import { promotions } from "@/data/promotions";
import { EditableSection } from "./EditableSection";
import { cn } from "@/lib/utils";

const destacadas = promotions
  .filter(p => p.status === "active" || p.status === "incomplete")
  .slice(0, 4);

function formatMoney(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M €`;
  if (v >= 1_000) return `${Math.round(v / 1000)}k €`;
  return `${v} €`;
}

function StatusBadge({ status, badge }: { status?: string; badge?: string }) {
  const isNew = badge === "new";
  const isLastUnits = badge === "last-units";
  if (isLastUnits) {
    return <span className="inline-flex items-center text-[9.5px] font-bold uppercase tracking-wide rounded-full bg-amber-500/95 text-white px-2 py-1 shadow-soft">Últimas unidades</span>;
  }
  if (isNew) {
    return <span className="inline-flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wide rounded-full bg-primary text-primary-foreground px-2 py-1 shadow-soft">
      <Sparkles className="h-2 w-2" /> Nueva
    </span>;
  }
  const map: Record<string, { label: string; cls: string }> = {
    "active":     { label: "Activa",     cls: "bg-emerald-500/95 text-white" },
    "incomplete": { label: "Incompleta", cls: "bg-amber-500/95 text-white" },
    "inactive":   { label: "Inactiva",   cls: "bg-muted text-muted-foreground" },
    "sold-out":   { label: "Vendido",    cls: "bg-foreground text-background" },
  };
  const s = map[status ?? "active"] ?? map["active"];
  return (
    <span className={cn("inline-flex items-center text-[9.5px] font-bold uppercase tracking-wide rounded-full px-2 py-1 shadow-soft", s.cls)}>
      {s.label}
    </span>
  );
}

function PortfolioCard({
  promotion,
  size = "small",
  onClick,
}: {
  promotion: typeof promotions[number];
  size?: "hero" | "small";
  onClick: () => void;
}) {
  const sold = promotion.totalUnits - promotion.availableUnits;
  const pct = promotion.totalUnits > 0 ? Math.round((sold / promotion.totalUnits) * 100) : 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border bg-card shadow-soft text-left",
        "hover:shadow-soft-lg hover:-translate-y-0.5 transition-all duration-300",
        size === "hero" ? "row-span-2" : "",
      )}
    >
      {/* Cover */}
      <div className={cn(
        "relative w-full overflow-hidden bg-muted",
        size === "hero" ? "h-full min-h-[260px]" : "aspect-[16/10]",
      )}>
        {promotion.image ? (
          <img
            src={promotion.image}
            alt={promotion.name}
            className="absolute inset-0 h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <Building2 className="h-10 w-10 text-muted-foreground/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Status badge */}
        <div className="absolute top-3 left-3">
          <StatusBadge status={promotion.status} badge={promotion.badge} />
        </div>

        {/* Precio */}
        <div className="absolute top-3 right-3 rounded-full bg-white/90 backdrop-blur px-3 py-1 shadow-soft">
          <span className="text-[10.5px] font-bold text-foreground tnum">
            {formatMoney(promotion.priceMin)}
            {promotion.priceMin !== promotion.priceMax && ` – ${formatMoney(promotion.priceMax)}`}
          </span>
        </div>

        {/* Info bottom */}
        <div className="absolute left-0 right-0 bottom-0 p-4">
          <h3 className={cn("text-white font-bold leading-tight drop-shadow-sm", size === "hero" ? "text-[18px]" : "text-[14px]")}>
            {promotion.name}
          </h3>
          <p className="text-white/85 text-[11px] flex items-center gap-1 mt-1">
            <MapPin className="h-2.5 w-2.5" />
            <span className="truncate">{promotion.location}</span>
          </p>
        </div>
      </div>

      {/* Footer info */}
      <div className="px-4 py-3 flex items-center justify-between gap-3 border-t border-border">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Unidades</p>
          <p className="text-[13px] font-semibold text-foreground tnum">
            {promotion.availableUnits} / {promotion.totalUnits}
            <span className="text-muted-foreground font-normal"> disponibles</span>
          </p>
          {/* Progress bar */}
          <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary/70 rounded-full"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        {promotion.delivery && (
          <div className="text-right shrink-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Entrega</p>
            <p className="text-[12px] font-semibold text-foreground tnum">{promotion.delivery}</p>
          </div>
        )}
      </div>
    </button>
  );
}

export function PortfolioShowcase({ viewMode }: { viewMode: "edit" | "preview" }) {
  const navigate = useNavigate();

  return (
    <EditableSection
      title="Portfolio destacado"
      viewMode={viewMode}
      rightSlot={
        <button
          type="button"
          onClick={() => navigate("/promociones")}
          className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-primary hover:underline"
        >
          Ver todas
          <ArrowRight className="h-3 w-3" />
        </button>
      }
    >
      {destacadas.length === 0 ? (
        <div className="py-8 text-center">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground/20 mb-2" />
          <p className="text-[13px] text-muted-foreground">
            Todavía no tienes promociones publicadas.
          </p>
          <button
            type="button"
            onClick={() => navigate("/crear-promocion")}
            className="mt-3 inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary/90 transition-colors"
          >
            Crear primera promoción
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {destacadas.map((p, idx) => (
            <PortfolioCard
              key={p.id}
              promotion={p}
              size={idx === 0 && destacadas.length >= 3 ? "hero" : "small"}
              onClick={() => navigate(`/promociones?id=${p.id}`)}
            />
          ))}
        </div>
      )}
    </EditableSection>
  );
}
