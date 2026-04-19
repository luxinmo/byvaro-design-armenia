/**
 * PortfolioShowcase · muestra una selección de promociones destacadas
 * del promotor en forma de cards horizontales con scroll.
 *
 * Aprovecha los datos mock existentes (src/data/promotions.ts) para
 * simular el portfolio real. En producción saldrá de la tabla de
 * promociones del tenant.
 */

import { useNavigate } from "react-router-dom";
import { MapPin, ArrowRight, Building2 } from "lucide-react";
import { promotions } from "@/data/promotions";
import { EditableSection } from "./EditableSection";
import { cn } from "@/lib/utils";

/* Mostramos las primeras 4 promociones "activas" como destacadas */
const destacadas = promotions
  .filter(p => p.status === "active" || p.status === "incomplete")
  .slice(0, 4);

function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    "active":     { label: "Activa", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
    "incomplete": { label: "Incompleta", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" },
    "inactive":   { label: "Inactiva", cls: "bg-muted text-muted-foreground border-border" },
    "sold-out":   { label: "Vendido", cls: "bg-muted text-muted-foreground border-border" },
  };
  const s = map[status ?? "active"] ?? map["active"];
  return (
    <span className={cn("inline-flex items-center text-[9.5px] font-bold uppercase tracking-wide rounded-full border px-2 py-0.5", s.cls)}>
      {s.label}
    </span>
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
        <div className="py-6 text-center">
          <Building2 className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-[12px] text-muted-foreground">
            Todavía no tienes promociones publicadas. Créalas desde <span className="font-semibold">Comercial → Promociones</span>.
          </p>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-5 px-5 pb-1">
          {destacadas.map((p) => (
            <div
              key={p.id}
              className="w-[240px] shrink-0 rounded-2xl border border-border bg-card overflow-hidden hover:border-border/70 transition-colors cursor-pointer group"
              onClick={() => navigate(`/promociones?id=${p.id}`)}
            >
              <div className="relative aspect-[4/3] bg-muted">
                {p.image ? (
                  <img src={p.image} alt={p.name} className="absolute inset-0 h-full w-full object-cover group-hover:scale-[1.02] transition-transform" />
                ) : (
                  <div className="absolute inset-0 grid place-items-center">
                    <Building2 className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                )}
                <div className="absolute top-2 left-2">
                  <StatusBadge status={p.status} />
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                  <p className="text-white text-[13px] font-semibold truncate">{p.name}</p>
                </div>
              </div>
              <div className="p-3 flex items-center justify-between text-[11px] text-muted-foreground gap-2">
                <span className="flex items-center gap-1 truncate">
                  <MapPin className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">{p.location}</span>
                </span>
                <span className="tnum text-foreground font-semibold shrink-0">
                  {p.availableUnits}/{p.totalUnits} uds
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </EditableSection>
  );
}
