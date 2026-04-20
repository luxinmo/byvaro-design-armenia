/**
 * PromotionAvailabilitySummary · tarjeta resumen de inventario en la vista
 * principal de la ficha de promoción.
 *
 * Responsabilidades:
 *   1. Mostrar un vistazo rápido del inventario de la promoción: totales por
 *      estado (disponibles, reservadas, vendidas, retiradas).
 *   2. Calcular y mostrar el precio medio de las unidades disponibles.
 *   3. Calcular el porcentaje de ocupación (unidades NO disponibles / total).
 *   4. Ofrecer un atajo "Ver todo" que dispara `onViewAll()` — típicamente
 *      navega a la pestaña completa de disponibilidad.
 *
 * Props:
 *   - promotionId: string          → ID de la promoción (key de `unitsByPromotion`).
 *   - onViewAll: () => void        → callback para el CTA "Ver todo".
 *
 * Dependencias:
 *   - `@/data/units`             → fuente mock de unidades (unitsByPromotion).
 *   - `@/components/ui/button`   → primitiva Button Byvaro (no usada directamente,
 *                                  pero se mantiene el import por consistencia con
 *                                  otros componentes del mismo slot).
 *   - `lucide-react`             → icono ArrowRight para el CTA.
 *
 * Tokens Byvaro usados (todos HSL, definidos en src/index.css):
 *   - bg-card · border-border · text-foreground · text-muted-foreground
 *   - bg-primary (dot "Disponibles")
 *   - bg-destructive (dot "Retiradas")
 *   - Excepción amber-500: dot "Reservadas" — warning estándar Byvaro.
 *   - Radios: `rounded-2xl` (panel principal) · `rounded-full` (dots).
 *
 * TODOs:
 *   - TODO(backend): endpoint GET /api/promociones/:id/availability-summary con
 *     { available, reserved, sold, withdrawn, avgPrice, occupancy } agregados
 *     server-side (ahora lo hacemos client-side sobre todas las unidades).
 *   - TODO(ui): añadir sparkline o barra apilada de ocupación para reforzar
 *     visualmente el mix de estados.
 *   - TODO(feature): permitir al promotor configurar qué KPIs adicionales
 *     aparecen aquí (ej. precio medio por m², tiempo medio en mercado).
 */

import { unitsByPromotion } from "@/data/units"; // Mock inventory (reemplazar por API)
import { ArrowRight } from "lucide-react";
// Button: primitiva Byvaro. Mantener el import aunque no se use directamente — se
// conserva por paridad con el archivo original y para futuros CTAs en este panel.
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

  // Dots de estado unificados con paleta de tokens Byvaro.
  // Amber conservado para "Reservadas" (warning estándar).
  const stats = [
    { label: "Disponibles", count: available.length, dot: "bg-primary" },
    { label: "Reservadas", count: reserved.length, dot: "bg-amber-500" },
    { label: "Vendidas", count: sold.length, dot: "bg-primary" },
    { label: "Retiradas", count: withdrawn.length, dot: "bg-destructive" },
  ];

  const avgPrice = available.length > 0
    ? Math.round(available.reduce((s, u) => s + u.price, 0) / available.length)
    : 0;
  const occupancy = Math.round(((units.length - available.length) / units.length) * 100);

  return (
    <div className="rounded-2xl border border-border/40 bg-card p-5 2xl:p-6 shadow-soft">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-5">
        <h2 className="text-base font-semibold text-foreground">
          Inventario <span className="text-muted-foreground font-normal">· {units.length} unidades</span>
        </h2>
        <button
          onClick={onViewAll}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
        >
          Ver todo <ArrowRight className="h-3 w-3" />
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
        <span className="text-muted-foreground">Precio medio</span>
        <span className="text-foreground font-medium tabular-nums">{formatPrice(avgPrice)}</span>
      </div>
      <div className="flex items-center justify-between mt-2 text-xs">
        <span className="text-muted-foreground">Ocupación</span>
        <span className="text-foreground font-medium tabular-nums">{occupancy}%</span>
      </div>
    </div>
  );
}
