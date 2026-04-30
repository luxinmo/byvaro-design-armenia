/**
 * Calendario de pagos a una agencia colaboradora.
 *
 * Cada venta cerrada genera uno o varios `AgencyPayment` siguiendo
 * la configuración de pagos pactada en el contrato (tramos de
 * comisión: 30% al firmar arras · 30% al firmar contrato privado ·
 * 40% al escriturar, p. ej.). Aquí el promotor ve:
 *
 *   · Lo pendiente de pagar (con fecha de vencimiento)
 *   · Lo pagado (historial)
 *   · Lo bloqueado (a la espera de factura u otros documentos)
 *   · KPIs: total pendiente, próximo vencimiento, total pagado
 *
 * MVP mock · cuando el módulo de ventas esté conectado, los pagos se
 * generarán server-side al cerrar una venta (webhook `sale.closed`
 * dispara `POST /api/agencies/:id/payments` con los tramos
 * calculados del contrato). Por ahora seedeamos datos realistas.
 *
 * TODO(backend):
 *   · `GET /api/agencias/:id/payments` → AgencyPayment[]
 *   · `PATCH /api/payments/:id { status, paidAt, note }`
 *   · Trigger interno: al marcar venta como cerrada, calcular tramos
 *     y crear N payments en estado `scheduled`.
 */

import { useCallback, useEffect, useState } from "react";

/** Estado del pago a la agencia.
 * - `scheduled`     · generado por la venta, pendiente a su vencimiento.
 * - `due`           · vencimiento alcanzado, listo para pagar.
 * - `on-hold`       · bloqueado por falta de documentación (factura, etc.).
 * - `paid`          · ejecutado. Registro de auditoría.
 * - `cancelled`     · anulado (ej. venta cae y se revierte el pago). */
export type PaymentStatus =
  | "scheduled" | "due" | "on-hold" | "paid" | "cancelled";

export interface AgencyPayment {
  id: string;
  agencyId: string;
  /** Venta que origina este pago · en backend será FK a Sale. */
  saleId?: string;
  /** Promoción donde ocurrió la venta (para filtrar + contexto). */
  promotionId?: string;
  promotionName?: string;
  /** Unidad vendida · texto descriptivo (ej. "Villa 12-B"). */
  unitLabel?: string;
  /** Cliente final. */
  clientName?: string;
  /** Descripción del tramo: "Tramo 1 · firma de arras · 30%" */
  concept: string;
  /** Importe bruto a pagar a la agencia. */
  amount: number;
  /** ISO date de vencimiento pactado. */
  dueDate: number;
  /** Cuándo se ejecutó el pago (solo si `status=paid`). */
  paidAt?: number;
  /** Estado visual/operativo. Ver arriba. */
  status: PaymentStatus;
  /** Motivo si está `on-hold` (ej. "Falta factura rectificativa"). */
  onHoldReason?: string;
  /** IDs de documentos requeridos para poder pagar · si alguno no
   *  está aprobado, el promotor suele poner el pago `on-hold`. */
  requiredDocumentIds?: string[];
  /** Factura emitida por la agencia cubriendo este pago. */
  invoiceDocumentId?: string;
  /** Nota libre del promotor (trazabilidad). */
  note?: string;
  createdAt: number;
}

const STORAGE_KEY = "byvaro.agencyPayments.v1";
const SEED_KEY = "byvaro.agencyPayments.seeded.v1";
const CHANGE_EVENT = "byvaro:agency-payments-changed";

function readStore(): AgencyPayment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function writeStore(list: AgencyPayment[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  void (async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
      if (!isSupabaseConfigured) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || list.length === 0) return;
      const rows = list.map((p) => {
        const pay = p as unknown as Record<string, unknown>;
        return {
          id: p.id,
          developer_organization_id: "developer-default",
          agency_organization_id: p.agencyId,
          invoice_id: (pay.invoiceId as string) ?? null,
          amount: (pay.amount as number) ?? null,
          currency: (pay.currency as string) ?? "EUR",
          state: (pay.state as string) ?? "pending",
          scheduled_at: (pay.scheduledAt as string) ?? null,
          paid_at: (pay.paidAt as string) ?? null,
          hold_reason: (pay.holdReason as string) ?? null,
          proof_url: (pay.proofUrl as string) ?? null,
          metadata: pay,
        };
      });
      const { error } = await supabase.from("agency_payments").upsert(rows, { onConflict: "id" });
      if (error) console.warn("[agencyPayments:sync]", error.message);
    } catch (e) { console.warn("[agencyPayments:sync] skipped:", e); }
  })();
}

function daysAhead(n: number) { return Date.now() + n * 24 * 60 * 60 * 1000; }
function daysAgo(n: number)   { return Date.now() - n * 24 * 60 * 60 * 1000; }

/** Mock idempotente · seedea ejemplos realistas para dev-1 y dev-2 de
 *  la agencia Prime Properties (ag-1) si nunca se sembró. */
export function seedAgencyPaymentsIfEmpty() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(SEED_KEY)) return;
  const seeds: AgencyPayment[] = [
    {
      id: "pay-seed-1", agencyId: "ag-1", saleId: "mock-s-101",
      promotionId: "dev-1", promotionName: "Villa Serena",
      unitLabel: "Villa 12-B", clientName: "María García",
      concept: "Comisión tramo 1 · firma de arras (30%)",
      amount: 7800, dueDate: daysAgo(5),
      status: "on-hold",
      onHoldReason: "Falta factura de la agencia con IVA desglosado",
      requiredDocumentIds: ["doc-req-ag1-invoice-101"],
      createdAt: daysAgo(12),
    },
    {
      id: "pay-seed-2", agencyId: "ag-1", saleId: "mock-s-101",
      promotionId: "dev-1", promotionName: "Villa Serena",
      unitLabel: "Villa 12-B", clientName: "María García",
      concept: "Comisión tramo 2 · contrato privado (30%)",
      amount: 7800, dueDate: daysAhead(18),
      status: "scheduled",
      createdAt: daysAgo(12),
    },
    {
      id: "pay-seed-3", agencyId: "ag-1", saleId: "mock-s-101",
      promotionId: "dev-1", promotionName: "Villa Serena",
      unitLabel: "Villa 12-B", clientName: "María García",
      concept: "Comisión tramo 3 · escritura (40%)",
      amount: 10400, dueDate: daysAhead(95),
      status: "scheduled",
      createdAt: daysAgo(12),
    },
    {
      id: "pay-seed-4", agencyId: "ag-1", saleId: "mock-s-087",
      promotionId: "dev-2", promotionName: "Villas del Pinar",
      unitLabel: "Apt. 04-2", clientName: "Pedro Sánchez",
      concept: "Comisión completa · pago único al escriturar",
      amount: 12500, dueDate: daysAgo(25), paidAt: daysAgo(20),
      status: "paid",
      invoiceDocumentId: "doc-inv-ag1-087",
      createdAt: daysAgo(60),
    },
    {
      id: "pay-seed-5", agencyId: "ag-1", saleId: "mock-s-092",
      promotionId: "dev-1", promotionName: "Villa Serena",
      unitLabel: "Villa 08-C", clientName: "Carlos López",
      concept: "Comisión tramo 1 · firma de arras (30%)",
      amount: 6300, dueDate: daysAhead(3),
      status: "due",
      createdAt: daysAgo(20),
    },
  ];
  writeStore(seeds);
  localStorage.setItem(SEED_KEY, "1");
}

export function getPaymentsForAgency(agencyId: string): AgencyPayment[] {
  return readStore().filter((p) => p.agencyId === agencyId);
}

export function markPaymentPaid(
  paymentId: string,
  note?: string,
) {
  const now = Date.now();
  writeStore(readStore().map((p) =>
    p.id === paymentId
      ? { ...p, status: "paid" as PaymentStatus, paidAt: now, note }
      : p,
  ));
}

export function holdPayment(paymentId: string, reason: string) {
  writeStore(readStore().map((p) =>
    p.id === paymentId
      ? { ...p, status: "on-hold" as PaymentStatus, onHoldReason: reason }
      : p,
  ));
}

export function releaseHold(paymentId: string) {
  writeStore(readStore().map((p) => {
    if (p.id !== paymentId) return p;
    /* Si ya venció, vuelve a `due`; si no, a `scheduled`. */
    const next: PaymentStatus = p.dueDate <= Date.now() ? "due" : "scheduled";
    return { ...p, status: next, onHoldReason: undefined };
  }));
}

export function cancelPayment(paymentId: string) {
  writeStore(readStore().map((p) =>
    p.id === paymentId ? { ...p, status: "cancelled" as PaymentStatus } : p,
  ));
}

export function useAgencyPayments(agencyId: string): AgencyPayment[] {
  const [list, setList] = useState<AgencyPayment[]>(() => {
    seedAgencyPaymentsIfEmpty();
    return getPaymentsForAgency(agencyId);
  });
  useEffect(() => {
    const cb = () => setList(getPaymentsForAgency(agencyId));
    cb();
    window.addEventListener(CHANGE_EVENT, cb);
    window.addEventListener("storage", cb);
    return () => {
      window.removeEventListener(CHANGE_EVENT, cb);
      window.removeEventListener("storage", cb);
    };
  }, [agencyId]);
  return list;
}

/** Agrega KPIs financieros de pagos a una agencia. */
export function summarizePayments(list: AgencyPayment[]) {
  const now = Date.now();
  const paid     = list.filter((p) => p.status === "paid");
  const pending  = list.filter((p) => p.status === "scheduled" || p.status === "due");
  const onHold   = list.filter((p) => p.status === "on-hold");
  const nextDue  = [...pending].sort((a, b) => a.dueDate - b.dueDate)[0];
  return {
    paidTotal:    paid.reduce((s, p) => s + p.amount, 0),
    pendingTotal: pending.reduce((s, p) => s + p.amount, 0),
    onHoldTotal:  onHold.reduce((s, p) => s + p.amount, 0),
    overdueCount: list.filter((p) =>
      (p.status === "due" || p.status === "scheduled") && p.dueDate < now).length,
    nextDue,
    counts: {
      paid: paid.length, pending: pending.length,
      onHold: onHold.length, cancelled: list.filter((p) => p.status === "cancelled").length,
    },
  };
}

export const PAYMENT_STATUS: Record<PaymentStatus, {
  label: string;
  tone: "muted" | "success" | "primary" | "warning" | "destructive";
}> = {
  scheduled: { label: "Programado",     tone: "muted" },
  due:       { label: "Listo para pagar", tone: "primary" },
  "on-hold": { label: "En espera",      tone: "warning" },
  paid:      { label: "Pagado",         tone: "success" },
  cancelled: { label: "Cancelado",      tone: "destructive" },
};
