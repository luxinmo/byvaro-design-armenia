import { unitsByPromotion } from "@/data/units";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

function formatPrice(n: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export function PromotionAvailabilitySummary({ promotionId, onViewAll }: { promotionId: string; onViewAll: () => void }) {
  const units = unitsByPromotion[promotionId] || [];
  if (units.length === 0) return null;

  const available = units.filter(u => u.status === "available");
  const reserved = units.filter(u => u.status === "reserved");
  const sold = units.filter(u => u.status === "sold");
  const withdrawn = units.filter(u => u.status === "withdrawn");

  const stats = [
    { label: "Available", count: available.length, dot: "bg-emerald-500" },
    { label: "Reserved", count: reserved.length, dot: "bg-amber-500" },
    { label: "Sold", count: sold.length, dot: "bg-blue-500" },
    { label: "Withdrawn", count: withdrawn.length, dot: "bg-rose-500" },
  ];

  const avgPrice = available.length > 0
    ? Math.round(available.reduce((s, u) => s + u.price, 0) / available.length)
    : 0;
  const occupancy = Math.round(((units.length - available.length) / units.length) * 100);

  return (
    <div className="rounded-2xl border border-border/40 bg-card p-5 2xl:p-6">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-5">
        <h2 className="text-base font-semibold text-foreground">
          Inventory <span className="text-muted-foreground font-normal">· {units.length} units</span>
        </h2>
        <button
          onClick={onViewAll}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
        >
          View all <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {stats.map(s => (
          <div key={s.label}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</span>
            </div>
            <p className="text-lg font-semibold text-foreground tabular-nums">{s.count}</p>
          </div>
        ))}
      </div>

      {/* Meta */}
      <div className="flex items-center justify-between pt-4 border-t border-border/40 text-xs">
        <span className="text-muted-foreground">Avg. price</span>
        <span className="text-foreground font-medium tabular-nums">{formatPrice(avgPrice)}</span>
      </div>
      <div className="flex items-center justify-between mt-2 text-xs">
        <span className="text-muted-foreground">Occupancy</span>
        <span className="text-foreground font-medium tabular-nums">{occupancy}%</span>
      </div>
    </div>
  );
}
