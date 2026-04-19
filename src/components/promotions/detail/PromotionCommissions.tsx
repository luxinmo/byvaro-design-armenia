import { TrendingUp, Info } from "lucide-react";
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
    { range: "4–8 ventas", rate: `${commission + 0.5}%`, bonus: "+0.5% bonus" },
    { range: "9+ ventas", rate: `${commission + 1}%`, bonus: "+1% bonus" },
  ];

  return (
    <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)]">
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
