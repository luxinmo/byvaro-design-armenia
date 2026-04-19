import { CheckCircle2, Circle, Clock } from "lucide-react";

const milestones = [
  { label: "Reserva", amount: "6.000 €", percent: "~1.7%", status: "current" as const, description: "Señal inicial para reservar la unidad" },
  { label: "Contrato privado", amount: "30%", percent: "del precio", status: "upcoming" as const, description: "A la firma del contrato de compraventa (30 días)" },
  { label: "Durante obra", amount: "20%", percent: "del precio", status: "upcoming" as const, description: "Pagos fraccionados durante la construcción" },
  { label: "Escritura", amount: "50%", percent: "del precio", status: "upcoming" as const, description: "Pago final ante notario con hipoteca o fondos propios" },
];

const statusIcon = {
  completed: <CheckCircle2 className="h-5 w-5 text-emerald-500" />,
  current: <Clock className="h-5 w-5 text-primary" />,
  upcoming: <Circle className="h-5 w-5 text-muted-foreground/40" />,
};

export function PromotionPaymentPlan() {
  return (
    <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)]">
      <h2 className="text-base font-semibold text-foreground mb-0.5">Forma de pago</h2>
      <p className="text-xs text-muted-foreground mb-4">Estructura de pagos estándar para esta promoción</p>

      <div className="relative">
        {milestones.map((m, i) => (
          <div key={m.label} className="flex gap-3 relative">
            {i < milestones.length - 1 && (
              <div className="absolute left-[8px] top-6 w-[1.5px] h-[calc(100%-6px)] bg-border/60" />
            )}
            <div className="relative z-10 shrink-0 mt-0.5">
              {statusIcon[m.status]}
            </div>
            <div className={`flex-1 pb-5 ${i === milestones.length - 1 ? "pb-0" : ""}`}>
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <p className={`text-sm font-semibold ${m.status === "current" ? "text-primary" : "text-foreground"}`}>
                    {m.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-foreground tabular-nums">{m.amount}</p>
                  <p className="text-[10px] text-muted-foreground">{m.percent}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
