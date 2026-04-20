/**
 * PromotionPaymentPlan · línea temporal de hitos de pago.
 *
 * Qué hace:
 *   Muestra la estructura de pagos estándar de la promoción como un
 *   timeline vertical de 4 hitos (Reserva → Contrato privado → Durante
 *   obra → Escritura). Cada hito tiene un icono de estado (completed /
 *   current / upcoming), etiqueta, descripción y el importe o porcentaje
 *   asociado. Entre hitos se dibuja una guía vertical fina (`bg-border/60`)
 *   para reforzar la secuencia temporal.
 *
 * Props:
 *   - Ninguna por ahora. Los milestones están hardcodeados.
 *     Cuando haya backend pasará a recibir
 *     `milestones: PaymentMilestone[]` como prop.
 *
 * Dependencias:
 *   - `lucide-react` → iconos de estado:
 *       · CheckCircle2 para hitos ya cumplidos (completed).
 *       · Clock para el hito activo (current).
 *       · Circle vacío para los futuros (upcoming).
 *
 * Tokens Byvaro usados:
 *   - `bg-card` + `border-border/40` → superficie del panel.
 *   - `text-primary` → icono "current" + label del hito activo (usa el
 *     azul de marca en vez del verde emerald original).
 *   - `text-muted-foreground/40` → icono "upcoming".
 *   - `text-primary` sustituye al `text-emerald-500` original para
 *     "completed"; emerald no está en el sistema Byvaro.
 *   - Radios: panel `rounded-2xl`.
 *   - Sombras: `shadow-soft` en reposo (sin hover lift porque es un
 *     panel estático informativo).
 *
 * TODO(backend):
 *   - GET /api/promotions/:id/payment-plan → devolver milestones reales
 *     con { label, amount, percent, status, description, dueDate? }.
 *   - El campo `status` debería calcularse contra el estado de la reserva
 *     del usuario (si el agente tiene una reserva activa).
 *   - Soportar planes de pago custom por unidad (UnitDetailPanel).
 *
 * TODO(ui):
 *   - Animar el icono "current" (pulse suave en el Clock).
 *   - Tooltip al hover de cada hito con fecha estimada.
 *   - Variante compacta para mostrar dentro del UnitDetailPanel.
 */

// Iconos lucide: Check para hitos pasados, Clock para el hito actual,
// Circle vacío para los futuros. Decisión visual: el "current" usa
// Clock (reloj) porque comunica "en curso" mejor que un círculo relleno.
import { CheckCircle2, Circle, Clock } from "lucide-react";

const milestones = [
  { label: "Reserva", amount: "6.000 €", percent: "~1.7%", status: "current" as const, description: "Señal inicial para reservar la unidad" },
  { label: "Contrato privado", amount: "30%", percent: "del precio", status: "upcoming" as const, description: "A la firma del contrato de compraventa (30 días)" },
  { label: "Durante obra", amount: "20%", percent: "del precio", status: "upcoming" as const, description: "Pagos fraccionados durante la construcción" },
  { label: "Escritura", amount: "50%", percent: "del precio", status: "upcoming" as const, description: "Pago final ante notario con hipoteca o fondos propios" },
];

// Mapa estado → icono. Todos los tintes van contra tokens Byvaro
// (primary en vez de emerald/blue). "completed" también usa primary
// porque en el sistema Byvaro no existe un token "success" separado.
const statusIcon = {
  completed: <CheckCircle2 className="h-5 w-5 text-primary" />,
  current: <Clock className="h-5 w-5 text-primary" />,
  upcoming: <Circle className="h-5 w-5 text-muted-foreground/40" />,
};

export function PromotionPaymentPlan() {
  return (
    <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-soft">
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
