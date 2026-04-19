import { useState } from "react";
import { CheckCircle2, BadgePercent, Euro, Users, Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  commission: number;
  delivery: string;
  reservationCost: number;
}

const subTabs = [
  { id: "delivery", label: "Fecha de entrega", icon: CheckCircle2 },
  { id: "commissions", label: "Commissions", icon: BadgePercent },
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
                  ? "border-border bg-card shadow-sm"
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
        <p className="text-sm text-muted-foreground">Status of the work and delivery date</p>
      </div>
      <div className="rounded-xl bg-card border border-border/50 p-5 space-y-1">
        <p className="text-sm font-semibold text-foreground">Status of the work</p>
        <p className="text-sm text-muted-foreground">
          The project is in various stages of completion, with some units already delivered. Check the status in the development's availability section.
        </p>
      </div>
      <div className="rounded-xl bg-card border border-border/50 p-5 space-y-1">
        <p className="text-sm font-semibold text-foreground">Delivery time</p>
        <p className="text-lg font-bold text-foreground">{delivery || "Por confirmar"}</p>
        <p className="text-sm text-muted-foreground">Estimated delivery date for this promotion.</p>
      </div>
    </>
  );
}

/* ─── Commissions ─── */
function CommissionsContent({ commission }: { commission: number }) {
  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Commissions</p>
      </div>
      <div className="rounded-xl bg-card border border-border/50 p-5 flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Collaboration commission for sales</p>
        <div className="text-right">
          <p className="text-xl font-bold text-foreground">{commission}%</p>
          <p className="text-xs text-muted-foreground">VAT included</p>
        </div>
      </div>
      <div className="rounded-xl bg-card border border-border/50 p-5 space-y-4">
        <p className="text-sm font-semibold text-foreground">Method of payment of commissions</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground">
              <th className="text-left font-medium pb-3">Payments</th>
              <th className="text-left font-medium pb-3">Client completed payment</th>
              <th className="text-left font-medium pb-3">Collaborator payment</th>
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
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600 bg-green-50 rounded-full px-3 py-1">
          <Check className="h-3.5 w-3.5" /> Collaborating
        </span>
        <span className="text-xs text-orange-500 font-medium">No contract</span>
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
        <p className="text-sm text-muted-foreground">Method of payment</p>
      </div>
      <div className="rounded-xl bg-card border border-border/50 p-5 space-y-4">
        <div className="flex items-center justify-between pb-4 border-b border-border/30">
          <div>
            <p className="text-lg font-bold text-foreground">{formatPrice(reservationCost)}</p>
            <p className="text-xs text-muted-foreground">Reservation payment</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-foreground">60 days</p>
            <p className="text-xs text-muted-foreground">Validity</p>
          </div>
        </div>
        <div className="space-y-0">
          {[
            { n: 1, label: "Earthworks / Excavation", pct: "15%" },
            { n: 2, label: "Interior Painting", pct: "20%" },
            { n: 3, label: "First Occupancy License / Certificate of Habitability", pct: "65%" },
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
    "Name and surname",
    "Nationality",
    "Last 4 digits of the phone number",
  ];

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Register</p>
      </div>
      <div className="rounded-xl bg-card border border-border/50 p-5 flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Choose the payment method for commissions to collaborators</p>
        <div className="text-right">
          <p className="text-sm font-bold text-foreground">no_expira days</p>
          <p className="text-xs text-muted-foreground">Validity of registration</p>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Customer registration conditions</p>
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
