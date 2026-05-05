/**
 * PromotionKPIs · fila de 5 KPIs resumen de la ficha de promoción.
 *
 * Lo que muestra (izquierda a derecha):
 *   1. Rango de precios (min – max) + coste de reserva como detalle.
 *   2. Disponibilidad (N de M) + barra de progreso del % vendido.
 *   3. Comisión para el colaborador + rango estimado en €.
 *   4. Fecha de entrega estimada.
 *   5. Coste de reserva.
 *
 * Cada KPI es una card `rounded-xl` con hover lift (`-translate-y-0.5`)
 * + `shadow-soft` → `shadow-soft-lg`. El icono va en un cuadrado
 * coloreado con tokens semánticos (bg-primary/10, bg-accent/10, etc.)
 * en vez de la paleta plana blue/emerald/amber/violet/rose original.
 *
 * Props:
 *   - promotion: objeto `Promotion` (ver src/data/promotions.ts).
 *
 * Dependencias:
 *   - `@/data/promotions`        → tipo `Promotion`.
 *   - `@/components/ui/progress` → primitiva Radix Progress (barra fina).
 *   - `lucide-react`             → iconos.
 *
 * TODOs:
 *   - TODO(backend): cuando haya analítica real de mercado, el KPI "Tu
 *     comisión" puede añadir un sparkline con últimos 30 días.
 *   - TODO(ui): hacer cada KPI clicable y saltar al tab relevante
 *     (disponibilidad → tab Disponibilidad, etc.).
 */

import { Promotion } from "@/data/promotions";
import { TrendingUp, Home, Calendar, Euro, Banknote } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { resolveDelivery } from "@/lib/deliveryFormat";

function formatPrice(n: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function PromotionKPIs({ promotion: p }: { promotion: Promotion }) {
  const occupancy = Math.round(((p.totalUnits - p.availableUnits) / p.totalUnits) * 100);

  // Todos los tintes usan tokens HSL: primary, accent, destructive, muted.
  // Si necesitas un nuevo tinte, créalo como variable CSS en src/index.css.
  const kpis = [
    {
      icon: Euro,
      label: "Rango de precios",
      value: `${formatPrice(p.priceMin)} – ${formatPrice(p.priceMax)}`,
      detail: `${formatPrice(p.reservationCost)} reserva`,
      iconClass: "text-primary bg-primary/10",
    },
    {
      icon: Home,
      label: "Disponibilidad",
      value: `${p.availableUnits} de ${p.totalUnits}`,
      detail: `${occupancy}% vendido`,
      iconClass: "text-primary bg-primary/10",
      progress: occupancy,
    },
    {
      icon: TrendingUp,
      label: "Tu comisión",
      /* "—" cuando no hay comisión configurada · evita mostrar
       *  "0%" que se interpreta como "sin comisión negociable" en
       *  vez de "el promotor aún no la ha definido". */
      value: p.commission > 0 ? `${p.commission}%` : "—",
      detail: p.commission > 0
        ? `~${formatPrice((p.priceMin * p.commission) / 100)} – ${formatPrice((p.priceMax * p.commission) / 100)}`
        : "Sin configurar",
      iconClass: "text-accent-foreground bg-accent/10",
    },
    {
      icon: Calendar,
      label: "Entrega estimada",
      value: resolveDelivery(p) || "Por confirmar",
      detail: "Desde firma de contrato",
      iconClass: "text-muted-foreground bg-muted",
    },
    {
      icon: Banknote,
      label: "Coste de reserva",
      value: formatPrice(p.reservationCost),
      detail: "Señal inicial",
      iconClass: "text-destructive bg-destructive/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 2xl:gap-4">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className="rounded-xl border border-border bg-card p-4 shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 transition-all duration-200"
        >
          <div
            className={`h-8 w-8 rounded-lg flex items-center justify-center ${kpi.iconClass} mb-2`}
          >
            <kpi.icon className="h-4 w-4" strokeWidth={1.5} />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-0.5">
            {kpi.label}
          </p>
          <p className="text-sm font-semibold text-foreground leading-tight tnum">{kpi.value}</p>
          {kpi.progress !== undefined && <Progress value={kpi.progress} className="h-1 mt-1.5" />}
          <p className="text-[10px] text-muted-foreground mt-1 tnum">{kpi.detail}</p>
        </div>
      ))}
    </div>
  );
}
