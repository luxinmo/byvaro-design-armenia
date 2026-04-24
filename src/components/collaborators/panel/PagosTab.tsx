/**
 * Tab "Pagos" del panel de colaboración.
 *
 * Vista financiera de la relación con la agencia. Secciones:
 *
 *   1. KPIs financieros (pagado, pendiente, bloqueado, próximo).
 *   2. Pagos urgentes (vencidos + listos para pagar + bloqueados).
 *   3. Calendario de pagos agrupado por estado.
 *   4. Facturas recibidas (doc requests tipo "invoice").
 *
 * Permisos:
 *   · `collaboration.payments.view`   → ver todo.
 *   · `collaboration.payments.manage` → marcar pagado, poner on-hold,
 *                                       liberar on-hold, cancelar.
 */

import { useMemo, useState } from "react";
import {
  AlertTriangle, CheckCircle2, Clock, Lock, Receipt, FileText,
  TrendingUp, ChevronRight, Euro, Wallet, ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Agency } from "@/data/agencies";
import { useCurrentUser } from "@/lib/currentUser";
import { useHasPermission } from "@/lib/permissions";
import {
  useAgencyPayments, summarizePayments, markPaymentPaid, holdPayment,
  releaseHold, cancelPayment, PAYMENT_STATUS,
  type AgencyPayment, type PaymentStatus,
} from "@/lib/agencyPayments";
import {
  useAgencyDocRequests,
} from "@/lib/agencyDocRequests";
import { SectionHeader, StateBadge, formatEur, formatDateShort, formatRelative } from "./shared";

interface Props {
  agency: Agency;
}

export function PagosTab({ agency: a }: Props) {
  const user = useCurrentUser();
  const actor = { name: user.name, email: user.email };
  const canView = useHasPermission("collaboration.payments.view");
  const canManage = useHasPermission("collaboration.payments.manage");

  const payments = useAgencyPayments(a.id);
  const docs = useAgencyDocRequests(a.id);
  const invoices = docs.filter((d) => d.type === "invoice");
  const summary = summarizePayments(payments);

  if (!canView) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
        <Lock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" strokeWidth={1.5} />
        <p className="text-sm font-medium text-foreground mb-1">Sin acceso a pagos</p>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          El módulo de pagos contiene información financiera sensible. Solo administradores
          o miembros con el permiso <code className="text-[11px] bg-muted px-1.5 rounded">collaboration.payments.view</code> pueden verlo.
        </p>
      </div>
    );
  }

  /* Agrupación por estado (sin los pagados · esos viven en "Historial"). */
  const overdue   = payments.filter((p) => (p.status === "due" || p.status === "scheduled") && p.dueDate < Date.now());
  const due       = payments.filter((p) => p.status === "due" && p.dueDate >= Date.now());
  const onHold    = payments.filter((p) => p.status === "on-hold");
  const paid      = [...payments.filter((p) => p.status === "paid")].sort((a, b) => (b.paidAt ?? 0) - (a.paidAt ?? 0));

  return (
    <div className="space-y-6">
      {/* ═══ KPIs financieros ═══ */}
      <section>
        <SectionHeader title="Resumen financiero" subtitle="Estado de los pagos a esta agencia" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={Wallet}       label="Pagado histórico" value={formatEur(summary.paidTotal)}   tone="muted"     sub={`${summary.counts.paid} pagos`} />
          <KpiCard icon={Clock}        label="Pendiente"        value={formatEur(summary.pendingTotal)} tone="primary"   sub={summary.nextDue ? `Próx. ${formatDateShort(summary.nextDue.dueDate)}` : "sin próximos"} />
          <KpiCard icon={AlertTriangle} label="Bloqueado"       value={formatEur(summary.onHoldTotal)}  tone={summary.onHoldTotal > 0 ? "warning" : "muted"} sub={`${summary.counts.onHold} en espera`} />
          <KpiCard icon={TrendingUp}   label="Vencidos"         value={summary.overdueCount}            tone={summary.overdueCount > 0 ? "destructive" : "muted"} sub="pagos sin procesar" />
        </div>
      </section>

      {/* ═══ Pagos urgentes ═══ */}
      {(overdue.length > 0 || due.length > 0 || onHold.length > 0) && (
        <section>
          <SectionHeader title="Requieren acción" subtitle="Pagos vencidos, listos para pagar o bloqueados" />
          <ul className="rounded-2xl border border-border bg-card shadow-soft divide-y divide-border/50 overflow-hidden">
            {[...overdue, ...due, ...onHold].map((p) => (
              <PaymentRow key={p.id} payment={p} canManage={canManage} actor={actor} urgent />
            ))}
          </ul>
        </section>
      )}

      {/* ═══ Calendario de pagos por mes ═══ */}
      <PaymentCalendar
        payments={payments}
        canManage={canManage}
        actor={actor}
      />

      {/* ═══ Historial de pagos ejecutados ═══ */}
      {paid.length > 0 && (
        <section>
          <SectionHeader title="Historial de pagos" subtitle="Últimos pagos ejecutados a esta agencia" />
          <ul className="rounded-2xl border border-border bg-card shadow-soft divide-y divide-border/50 overflow-hidden">
            {paid.slice(0, 10).map((p) => (
              <PaymentRow key={p.id} payment={p} canManage={false} actor={actor} />
            ))}
          </ul>
        </section>
      )}

      {/* ═══ Facturas recibidas ═══ */}
      <section>
        <SectionHeader
          title="Facturas de la agencia"
          subtitle="La agencia sube sus facturas desde su panel · aquí las revisas"
        />
        {invoices.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
            <Receipt className="h-6 w-6 text-muted-foreground/40 mx-auto mb-1.5" strokeWidth={1.5} />
            <p className="text-xs text-muted-foreground">
              No hay facturas pendientes.
              <br />
              Puedes solicitar una desde el tab <span className="font-medium text-foreground">Documentación</span>.
            </p>
          </div>
        ) : (
          <ul className="rounded-2xl border border-border bg-card shadow-soft divide-y divide-border/50 overflow-hidden">
            {invoices.map((inv) => (
              <li key={inv.id} className="px-4 py-3 flex items-start gap-3">
                <span className="h-9 w-9 rounded-lg bg-muted/60 grid place-items-center shrink-0">
                  <Receipt className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{inv.label}</p>
                  <p className="text-[11.5px] text-muted-foreground truncate">
                    {inv.status === "pending"  ? "Solicitada a la agencia" :
                     inv.status === "uploaded" ? "Subida · revisión pendiente" :
                     inv.status === "approved" ? "Aprobada" : "Rechazada"}
                    {inv.fileName ? ` · ${inv.fileName}` : ""}
                  </p>
                  <p className="text-[10.5px] text-muted-foreground/80 mt-0.5">
                    Solicitada {formatRelative(inv.requestedAt)}
                    {inv.uploadedAt ? ` · subida ${formatRelative(inv.uploadedAt)}` : ""}
                  </p>
                </div>
                <StateBadge
                  label={
                    inv.status === "pending"  ? "Esperando" :
                    inv.status === "uploaded" ? "Por revisar" :
                    inv.status === "approved" ? "Aprobada" : "Rechazada"
                  }
                  tone={
                    inv.status === "pending"  ? "muted" :
                    inv.status === "uploaded" ? "primary" :
                    inv.status === "approved" ? "success" : "destructive"
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════════
 * PaymentCalendar · vista mensual de pagos
 * ════════════════════════════════════════════════════════════════
 *
 * Strip horizontal con 6 meses (2 previos + actual + 3 futuros) ·
 * cada "chip" muestra el total € y un mini-bar con la composición
 * por estado. Al seleccionar un mes, debajo se listan los pagos
 * concretos de ese mes.
 *
 * Los meses PASADOS muestran lo cobrado/ejecutado; los FUTUROS lo
 * programado. La navegación con ‹ › permite recorrer el timeline.
 */
function PaymentCalendar({
  payments, canManage, actor,
}: {
  payments: AgencyPayment[];
  canManage: boolean;
  actor: { name: string; email: string };
}) {
  /* Ancla: el primer día del mes actual. El `anchorOffset` mueve la
     ventana de meses visibles (-6 / -5 / … / 0 / +1 / …). Cada click
     en ‹ / › desplaza 1 mes. */
  const [anchorOffset, setAnchorOffset] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string>(() => monthKey(new Date()));

  const months = useMemo(() => {
    /* Ventana de 6 meses: el central es current+anchorOffset; mostramos
       -2 previos y +3 siguientes alrededor. */
    const base = new Date();
    base.setDate(1);
    base.setHours(0, 0, 0, 0);
    base.setMonth(base.getMonth() + anchorOffset);
    const list: Date[] = [];
    for (let i = -2; i <= 3; i++) {
      const d = new Date(base);
      d.setMonth(d.getMonth() + i);
      list.push(d);
    }
    return list;
  }, [anchorOffset]);

  /* Agrupar pagos por mes (key yyyy-mm). */
  const byMonth = useMemo(() => {
    const map: Record<string, AgencyPayment[]> = {};
    for (const p of payments) {
      /* Para pagados contamos en el mes del pago real · para el resto,
         en el mes de vencimiento programado. */
      const refMs = p.status === "paid" ? (p.paidAt ?? p.dueDate) : p.dueDate;
      const key = monthKey(new Date(refMs));
      (map[key] ||= []).push(p);
    }
    return map;
  }, [payments]);

  const selectedPayments = [...(byMonth[selectedKey] ?? [])]
    .sort((a, b) => a.dueDate - b.dueDate);

  const selectedDate = useMemo(() => keyToDate(selectedKey), [selectedKey]);

  return (
    <section>
      <SectionHeader
        title="Calendario de pagos"
        subtitle="Cuánto se cobra o paga cada mes según las ventas abiertas"
        right={
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setAnchorOffset((v) => v - 1)}
              className="h-8 w-8 grid place-items-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
            </button>
            <button
              onClick={() => { setAnchorOffset(0); setSelectedKey(monthKey(new Date())); }}
              className="h-8 px-2.5 inline-flex items-center rounded-full text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Hoy
            </button>
            <button
              onClick={() => setAnchorOffset((v) => v + 1)}
              className="h-8 w-8 grid place-items-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        }
      />

      {/* Strip de meses */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
        {months.map((d) => {
          const key = monthKey(d);
          const items = byMonth[key] ?? [];
          const isSelected = key === selectedKey;
          const isCurrent = key === monthKey(new Date());
          const totals = summarizeMonth(items);
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedKey(key)}
              className={cn(
                "rounded-2xl border bg-card p-3 text-left transition-all",
                isSelected
                  ? "border-foreground shadow-soft-lg"
                  : "border-border hover:border-foreground/30 hover:shadow-soft",
                !isSelected && isCurrent && "ring-1 ring-foreground/20",
              )}
            >
              <p className={cn(
                "text-[10px] font-semibold uppercase tracking-wider truncate",
                isSelected ? "text-foreground" : "text-muted-foreground",
              )}>
                {formatMonthShort(d)}
                {isCurrent && <span className="ml-1 text-[9px] normal-case tracking-normal text-muted-foreground/70">(hoy)</span>}
              </p>
              <p className={cn(
                "text-[15px] font-bold tabular-nums leading-tight mt-1",
                totals.total === 0 ? "text-muted-foreground/50" : "text-foreground",
              )}>
                {formatEur(totals.total)}
              </p>
              {totals.total > 0 && (
                <>
                  <CompositionBar totals={totals} />
                  <p className="text-[10px] text-muted-foreground mt-1 tabular-nums">
                    {items.length} pago{items.length === 1 ? "" : "s"}
                  </p>
                </>
              )}
              {totals.total === 0 && (
                <p className="text-[10px] text-muted-foreground/70 mt-1">sin pagos</p>
              )}
            </button>
          );
        })}
      </div>

      {/* Detalle del mes seleccionado */}
      <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-border/60 flex items-center justify-between">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {formatMonthLong(selectedDate)}
            </p>
            <p className="text-sm font-semibold text-foreground mt-0.5">
              {selectedPayments.length === 0
                ? "Sin pagos este mes"
                : `${selectedPayments.length} pago${selectedPayments.length === 1 ? "" : "s"} · ${formatEur(selectedPayments.reduce((s, p) => s + p.amount, 0))}`}
            </p>
          </div>
        </div>
        {selectedPayments.length === 0 ? (
          <div className="p-8 text-center">
            <Clock className="h-7 w-7 text-muted-foreground/40 mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Este mes no tiene pagos programados ni ejecutados con esta agencia.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/50">
            {selectedPayments.map((p) => (
              <PaymentRow key={p.id} payment={p} canManage={canManage} actor={actor} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/* ══════ Helpers del calendario ══════ */

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function keyToDate(key: string): Date {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

function formatMonthShort(d: Date): string {
  return new Intl.DateTimeFormat("es-ES", { month: "short", year: "2-digit" })
    .format(d).replace(".", "");
}

function formatMonthLong(d: Date): string {
  return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" })
    .format(d);
}

/** Resumen por estado usado tanto en el mini-bar como en el total. */
function summarizeMonth(items: AgencyPayment[]) {
  const by: Record<PaymentStatus, number> = {
    paid: 0, due: 0, "on-hold": 0, scheduled: 0, cancelled: 0,
  };
  let total = 0;
  let overdue = 0;
  const now = Date.now();
  for (const p of items) {
    if (p.status === "cancelled") continue;
    total += p.amount;
    by[p.status] += p.amount;
    if ((p.status === "due" || p.status === "scheduled") && p.dueDate < now) {
      overdue += p.amount;
    }
  }
  return { total, by, overdue };
}

/** Mini barra apilada con la composición del mes (paid/pending/hold/overdue). */
function CompositionBar({ totals }: { totals: ReturnType<typeof summarizeMonth> }) {
  if (totals.total === 0) return null;
  const parts = [
    { key: "paid",    value: totals.by.paid,      cls: "bg-success" },
    { key: "overdue", value: totals.overdue,      cls: "bg-destructive" },
    { key: "on-hold", value: totals.by["on-hold"], cls: "bg-warning" },
    {
      key: "pending",
      /* Lo "pending" futuro = due+scheduled NO vencidos (total - pagado - vencido - en espera). */
      value: Math.max(0, totals.total - totals.by.paid - totals.overdue - totals.by["on-hold"]),
      cls: "bg-foreground/50",
    },
  ].filter((p) => p.value > 0);
  return (
    <div className="flex h-1 w-full rounded-full bg-muted overflow-hidden mt-2">
      {parts.map((p) => (
        <div key={p.key} className={cn("h-full", p.cls)} style={{ width: `${(p.value / totals.total) * 100}%` }} />
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */

function KpiCard({
  icon: Icon, label, value, tone, sub,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: number | string;
  tone: "muted" | "primary" | "success" | "warning" | "destructive";
  sub?: string;
}) {
  const iconCls = {
    muted:       "bg-muted text-muted-foreground",
    primary:     "bg-primary/10 text-primary",
    success:     "bg-success/10 text-success",
    warning:     "bg-warning/10 text-warning",
    destructive: "bg-destructive/10 text-destructive",
  }[tone];
  const valueCls = {
    muted:       "text-foreground",
    primary:     "text-foreground",
    success:     "text-success",
    warning:     "text-warning",
    destructive: "text-destructive",
  }[tone];
  return (
    <div className="rounded-2xl border border-border bg-card shadow-soft p-3.5">
      <div className={cn("h-8 w-8 rounded-lg grid place-items-center", iconCls)}>
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-2.5">{label}</p>
      <p className={cn("text-[20px] font-bold tabular-nums leading-none mt-1", valueCls)}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">{sub}</p>}
    </div>
  );
}

function PaymentRow({
  payment: p, canManage, actor, urgent = false,
}: {
  payment: AgencyPayment;
  canManage: boolean;
  actor: { name: string; email: string };
  urgent?: boolean;
}) {
  const status = PAYMENT_STATUS[p.status];
  const overdue = (p.status === "due" || p.status === "scheduled") && p.dueDate < Date.now();
  const effTone = overdue ? "destructive" : status.tone;
  const effLabel = overdue ? `Vencido · ${formatDateShort(p.dueDate)}` : status.label;

  return (
    <li className="px-4 sm:px-5 py-3 flex items-start gap-3">
      <span className="h-9 w-9 rounded-lg bg-muted/60 grid place-items-center shrink-0">
        <Euro className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-foreground">
            {formatEur(p.amount)}
          </p>
          <StateBadge label={effLabel} tone={effTone} />
        </div>
        <p className="text-[12px] text-foreground mt-0.5 truncate">{p.concept}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
          {p.promotionName ? `${p.promotionName}` : ""}
          {p.unitLabel ? ` · ${p.unitLabel}` : ""}
          {p.clientName ? ` · ${p.clientName}` : ""}
        </p>
        <p className="text-[10.5px] text-muted-foreground/80 mt-0.5">
          {p.status === "paid"
            ? <>Pagado {p.paidAt ? formatRelative(p.paidAt) : ""}</>
            : <>Vence {formatDateShort(p.dueDate)}</>
          }
        </p>
        {p.status === "on-hold" && p.onHoldReason && (
          <p className="text-[11px] text-warning mt-1 flex items-start gap-1">
            <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" strokeWidth={1.75} />
            {p.onHoldReason}
          </p>
        )}
      </div>

      {canManage && p.status !== "paid" && p.status !== "cancelled" && (
        <div className="flex items-center gap-1 shrink-0 pt-0.5">
          {p.status !== "on-hold" && (
            <>
              <button
                onClick={() => {
                  const reason = window.prompt("Motivo para poner el pago en espera (ej. falta factura):");
                  if (!reason) return;
                  holdPayment(p.id, reason);
                  toast.success("Pago en espera");
                }}
                className="h-8 px-3 inline-flex items-center gap-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-warning hover:bg-warning/5 transition-colors"
              >
                <Clock className="h-3.5 w-3.5" strokeWidth={1.75} />
                Espera
              </button>
              <button
                onClick={() => { markPaymentPaid(p.id); toast.success("Pago registrado"); }}
                className="h-8 px-3 inline-flex items-center gap-1.5 rounded-full bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors"
              >
                <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
                Marcar pagado
              </button>
            </>
          )}
          {p.status === "on-hold" && (
            <button
              onClick={() => { releaseHold(p.id); toast.success("Pago desbloqueado"); }}
              className="h-8 px-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              Desbloquear
            </button>
          )}
        </div>
      )}
    </li>
  );
}
