import { Promotion } from "@/data/promotions";
import { TrendingUp, Home, Calendar, Euro, Banknote, Users } from "lucide-react";
import { Progress } from "@/components/ui/progress";

function formatPrice(n: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export function PromotionKPIs({ promotion: p }: { promotion: Promotion }) {
  const occupancy = Math.round(((p.totalUnits - p.availableUnits) / p.totalUnits) * 100);

  const kpis = [
    {
      icon: Euro,
      label: "Rango de precios",
      value: `${formatPrice(p.priceMin)} – ${formatPrice(p.priceMax)}`,
      detail: `${formatPrice(p.reservationCost)} reserva`,
      color: "text-blue-600 bg-blue-50",
    },
    {
      icon: Home,
      label: "Disponibilidad",
      value: `${p.availableUnits} de ${p.totalUnits}`,
      detail: `${occupancy}% vendido`,
      color: "text-emerald-600 bg-emerald-50",
      progress: occupancy,
    },
    {
      icon: TrendingUp,
      label: "Tu comisión",
      value: `${p.commission}%`,
      detail: `~${formatPrice(p.priceMin * p.commission / 100)} – ${formatPrice(p.priceMax * p.commission / 100)}`,
      color: "text-amber-600 bg-amber-50",
    },
    {
      icon: Calendar,
      label: "Entrega estimada",
      value: p.delivery || "Por confirmar",
      detail: "Desde firma de contrato",
      color: "text-violet-600 bg-violet-50",
    },
    {
      icon: Banknote,
      label: "Coste de reserva",
      value: formatPrice(p.reservationCost),
      detail: "Señal inicial",
      color: "text-rose-600 bg-rose-50",
    },
    // "Agencias colaborando" KPI is only visible for promotor view, hidden in agency view
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 2xl:gap-4">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="rounded-2xl border border-border/40 bg-card p-3.5 2xl:p-5 shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_24px_-8px_rgba(0,0,0,0.1)] hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex items-center gap-2 mb-2">
            <div className={`h-7 w-7 2xl:h-9 2xl:w-9 rounded-lg flex items-center justify-center ${kpi.color}`}>
              <kpi.icon className="h-3.5 w-3.5 2xl:h-4 2xl:w-4" />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{kpi.label}</p>
          <p className="text-sm 2xl:text-base font-semibold text-foreground leading-tight tabular-nums">{kpi.value}</p>
          {kpi.progress !== undefined && (
            <Progress value={kpi.progress} className="h-1 mt-1.5" />
          )}
          <p className="text-[10px] text-muted-foreground mt-1">{kpi.detail}</p>
        </div>
      ))}
    </div>
  );
}
