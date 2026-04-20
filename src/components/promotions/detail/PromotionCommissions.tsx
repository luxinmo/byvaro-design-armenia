/**
 * PromotionCommissions · tabla de comisiones escalonadas por volumen.
 *
 * Qué hace:
 *   Renderiza la estructura de comisiones de la promoción para el
 *   colaborador: una tabla compacta con 3 tramos (1–3 ventas, 4–8,
 *   9+) que muestran el % de comisión y bonus aplicable. El tramo
 *   actual (primero, "1–3 ventas") se destaca con borde y fondo tinte
 *   primary. Abajo, un bloque resumen `bg-muted/50` calcula la
 *   estimación en € por venta (min – max) aplicando `commission` al
 *   rango de precios de la promoción.
 *
 * Props:
 *   - commission: number       % base de comisión (p.ej. 3 → 3%).
 *   - priceMin: number         precio mínimo de la promoción (€).
 *   - priceMax: number         precio máximo de la promoción (€).
 *
 * Dependencias:
 *   - `lucide-react`              → iconos TrendingUp (no usado actualmente
 *     tras limpieza, se mantiene import por si se reintroduce en header)
 *     e Info (tooltip aclaratorio en cabecera).
 *   - `@/components/ui/tooltip`   → Tooltip Radix para el hover "cuándo se
 *     pagan las comisiones".
 *
 * Tokens Byvaro usados:
 *   - `bg-card` + `border-border/40` → superficie del panel.
 *   - `border-primary/30 bg-primary/5` → highlight del tramo activo.
 *   - `bg-primary` → bullet del tramo activo.
 *   - `bg-muted/50` → bloque resumen de estimación.
 *   - Radios: panel `rounded-2xl`, filas `rounded-lg`, bullet
 *     `rounded-full`.
 *   - Sombras: `shadow-soft` en reposo (panel informativo, sin hover).
 *
 * TODO(backend):
 *   - GET /api/promotions/:id/commission-tiers → recibir los tramos
 *     configurados por la promotora en lugar del array hardcodeado.
 *     Shape esperado: { rangeLabel, minDeals, maxDeals?, rate, bonus }.
 *   - Cruzar con las ventas reales del agente (GET /api/agent/sales?
 *     promotionId=...) para marcar dinámicamente qué tramo está activo
 *     en vez de fijar `i === 0`.
 *
 * TODO(ui):
 *   - Mostrar progreso hacia el siguiente tramo (p.ej. "2 de 4 ventas
 *     para bonus +0,5%").
 *   - Versión mobile con cards en vez de filas.
 *   - Animación al promocionar de tramo (micro-celebración).
 */

// Iconos: Info para el tooltip aclaratorio. TrendingUp se conserva
// temporalmente en el import porque queda reservado para un futuro
// header visual (icono a la izquierda del título "Comisiones").
import { TrendingUp, Info } from "lucide-react";
// Tooltip Radix del sistema de UI Byvaro — usado para mostrar la
// aclaración "Comisiones por venta cerrada. Se pagan a la escritura."
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function formatPrice(n: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

type Props = {
  commission: number;
  priceMin: number;
  priceMax: number;
};

export function PromotionCommissions({ commission, priceMin, priceMax }: Props) {
  const tiers = [
    { range: "1–3 ventas", rate: `${commission}%`, bonus: "—" },
    { range: "4–8 ventas", rate: `${commission + 0.5}%`, bonus: "+0,5% bonus" },
    { range: "9+ ventas", rate: `${commission + 1}%`, bonus: "+1% bonus" },
  ];

  return (
    <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-soft">
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-base font-semibold text-foreground">Comisiones</h2>
        <Tooltip>
          <TooltipTrigger>
            <Info className="h-3 w-3 text-muted-foreground" />
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Comisiones por venta cerrada. Se pagan a la escritura.</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <p className="text-xs text-muted-foreground mb-3">Estructura de comisiones escalonada por volumen</p>

      <div className="space-y-1.5">
        {tiers.map((t, i) => (
          <div
            key={t.range}
            className={`flex items-center justify-between p-2.5 rounded-lg border ${
              i === 0 ? "border-primary/30 bg-primary/5" : "border-border/40"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className={`h-1.5 w-1.5 rounded-full ${i === 0 ? "bg-primary" : "bg-muted-foreground/30"}`} />
              <span className="text-sm text-foreground">{t.range}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{t.bonus}</span>
              <span className="text-sm font-bold text-foreground min-w-[36px] text-right tabular-nums">{t.rate}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 p-2.5 rounded-lg bg-muted/50">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Estimación por venta:</span>{" "}
          {formatPrice(priceMin * commission / 100)} – {formatPrice(priceMax * commission / 100)}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          Pago a la firma de escritura pública. IVA no incluido.
        </p>
      </div>
    </div>
  );
}
