/**
 * PromotionInfoTab
 * ─────────────────────────────────────────────────────────────────────────────
 * Pestaña "Información" de la ficha de promoción. Renderiza una barra de 4
 * sub-pestañas con iconos (entrega, comisiones, forma de pago, registro) y
 * muestra el contenido asociado a la sub-pestaña activa en un panel inferior.
 *
 * Estado local:
 *   - activeSubTab: SubTabId → controla cuál de los 4 bloques se muestra.
 *
 * Props:
 *   - commission:      number  → porcentaje de comisión colaborador (IVA inc.).
 *   - delivery:        string  → fecha/plazo estimado de entrega (texto libre).
 *   - reservationCost: number  → coste de reserva en EUR para la forma de pago.
 *
 * Dependencias (imports):
 *   - react (useState)            → estado local de la sub-pestaña activa.
 *   - lucide-react (icons)        → iconografía de las sub-pestañas y checks.
 *   - @/lib/utils (cn)            → merge condicional de clases Tailwind.
 *
 * Tokens Byvaro usados:
 *   - Colores:   border, bg-card, bg-muted/30, text-foreground,
 *                text-muted-foreground, bg-primary/10, text-primary,
 *                bg-destructive/10, text-destructive.
 *   - Radios:    rounded-xl (cards/tarjetas internas), rounded-full (pills).
 *   - Sombras:   shadow-soft (reposo).
 *
 * TODO(backend): cargar tabla de hitos de pago y % dinámicamente desde API.
 * TODO(backend): conectar estado real de colaboración (activa, contrato, etc.).
 * TODO(feature): permitir a admin editar condiciones de registro por promoción.
 * TODO(ui):      animar transición entre sub-pestañas (fade-up ya disponible).
 */
import { useState } from "react";
import { CheckCircle2, BadgePercent, Euro, Users, Check } from "lucide-react"; // iconos Lucide para sub-tabs y ticks
import { cn } from "@/lib/utils"; // helper clsx+tailwind-merge para clases condicionales

interface Props {
  commission: number;
  delivery: string;
  reservationCost: number;
}

const subTabs = [
  { id: "delivery", label: "Fecha de entrega", icon: CheckCircle2 },
  { id: "commissions", label: "Comisiones", icon: BadgePercent },
  { id: "payment", label: "Forma de Pago", icon: Euro },
  { id: "registro", label: "Registro", icon: Users },
] as const;

type SubTabId = typeof subTabs[number]["id"];

export function PromotionInfoTab({ commission, delivery, reservationCost }: Props) {
  const [activeSubTab, setActiveSubTab] = useState<SubTabId>("delivery");

  return (
    <div className="space-y-6">
      {/* Icon sub-tabs */}
      <div className="grid grid-cols-4 gap-3">
        {subTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={cn(
                "flex flex-col items-start gap-3 rounded-xl border p-4 transition-all text-left",
                isActive
                  ? "border-border bg-card shadow-soft"
                  : "border-transparent bg-transparent hover:bg-muted/30"
              )}
            >
              <Icon className={cn("h-6 w-6", isActive ? "text-foreground" : "text-muted-foreground/50")} strokeWidth={1.5} />
              <span className={cn("text-sm font-medium", isActive ? "text-foreground" : "text-muted-foreground")}>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content area */}
      <div className="rounded-xl bg-muted/30 p-6 space-y-4">
        {activeSubTab === "delivery" && <DeliveryContent delivery={delivery} />}
        {activeSubTab === "commissions" && <CommissionsContent commission={commission} />}
        {activeSubTab === "payment" && <PaymentContent reservationCost={reservationCost} />}
        {activeSubTab === "registro" && <RegistroContent />}
      </div>
    </div>
  );
}

/* ─── Delivery ─── */
function DeliveryContent({ delivery }: { delivery: string }) {
  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Estado de la obra y fecha de entrega</p>
      </div>
      <div className="rounded-xl bg-card border border-border/50 p-5 space-y-1">
        <p className="text-sm font-semibold text-foreground">Estado de la obra</p>
        <p className="text-sm text-muted-foreground">
          El proyecto se encuentra en diferentes fases de ejecución, con algunas unidades ya entregadas. Consulta el estado en la sección de disponibilidad de la promoción.
        </p>
      </div>
      <div className="rounded-xl bg-card border border-border/50 p-5 space-y-1">
        <p className="text-sm font-semibold text-foreground">Plazo de entrega</p>
        <p className="text-lg font-bold text-foreground">{delivery || "Por confirmar"}</p>
        <p className="text-sm text-muted-foreground">Fecha estimada de entrega para esta promoción.</p>
      </div>
    </>
  );
}

/* ─── Commissions ─── */
function CommissionsContent({ commission }: { commission: number }) {
  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Comisiones</p>
      </div>
      <div className="rounded-xl bg-card border border-border/50 p-5 flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Comisión de colaboración por venta</p>
        <div className="text-right">
          <p className="text-xl font-bold text-foreground">{commission}%</p>
          <p className="text-xs text-muted-foreground">IVA incluido</p>
        </div>
      </div>
      <div className="rounded-xl bg-card border border-border/50 p-5 space-y-4">
        <p className="text-sm font-semibold text-foreground">Forma de pago de comisiones</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground">
              <th className="text-left font-medium pb-3">Pagos</th>
              <th className="text-left font-medium pb-3">Pago completado por el cliente</th>
              <th className="text-left font-medium pb-3">Pago al colaborador</th>
            </tr>
          </thead>
          <tbody className="text-foreground">
            <tr className="border-t border-border/30">
              <td className="py-3">1</td>
              <td className="py-3">25%</td>
              <td className="py-3">75%</td>
            </tr>
            <tr className="border-t border-border/30">
              <td className="py-3">2</td>
              <td className="py-3">75%</td>
              <td className="py-3">25%</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 rounded-full px-3 py-1">
          <Check className="h-3.5 w-3.5" /> Colaborando
        </span>
        <span className="text-xs text-destructive font-medium">Sin contrato</span>
      </div>
    </>
  );
}

/* ─── Payment ─── */
function PaymentContent({ reservationCost }: { reservationCost: number }) {
  const formatPrice = (n: number) =>
    new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Forma de pago</p>
      </div>
      <div className="rounded-xl bg-card border border-border/50 p-5 space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-border/30">
          <div>
            <p className="text-lg font-bold text-foreground">{formatPrice(reservationCost)}</p>
            <p className="text-xs text-muted-foreground">Pago de reserva</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-foreground">60 días</p>
            <p className="text-xs text-muted-foreground">Validez</p>
          </div>
        </div>
        <div className="space-y-0">
          {[
            { n: 1, label: "Movimiento de tierras / Excavación", pct: "15%" },
            { n: 2, label: "Pintura interior", pct: "20%" },
            { n: 3, label: "Licencia de primera ocupación / Cédula de habitabilidad", pct: "65%" },
          ].map((m) => (
            <div key={m.n} className="flex items-center justify-between py-3 border-b border-border/20 last:border-0">
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{m.n}</span>
                <span className="text-sm text-muted-foreground">{m.label}</span>
              </div>
              <span className="text-sm font-semibold text-foreground">{m.pct}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/* ─── Registro ─── */
function RegistroContent() {
  const conditions = [
    "Nombre completo",
    "Nacionalidad",
    "Últimas 4 cifras del teléfono",
  ];

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Registro</p>
      </div>
      <div className="rounded-xl bg-card border border-border/50 p-5 flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Elige la forma de pago de comisiones a colaboradores</p>
        <div className="text-right">
          <p className="text-sm font-bold text-foreground">No expira</p>
          <p className="text-xs text-muted-foreground">Validez del registro</p>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Condiciones de registro de cliente</p>
        <div className="space-y-3">
          {conditions.map((c) => (
            <div key={c} className="flex items-center gap-3">
              <Check className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{c}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
