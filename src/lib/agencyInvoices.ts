/**
 * Facturas entre promotor y agencia.
 *
 * Dos direcciones:
 *   · "emitida"   · la factura la emite el PROMOTOR hacia la agencia
 *                   (ej. cargos por uso del marketplace, servicios).
 *   · "recibida"  · la factura la RECIBE el promotor desde la agencia
 *                   (comisiones, gastos reembolsables).
 *
 * Dos vías de alta:
 *   · "upload"   · subida manual de PDF.
 *   · "generate" · generada dentro de Byvaro desde formulario (ids
 *                  consecutivos, plantilla estándar, mock de PDF).
 *
 * Mock localStorage. En backend:
 *   GET    /api/agencias/:id/invoices
 *   POST   /api/agencias/:id/invoices (multipart para upload)
 *   POST   /api/agencias/:id/invoices/generate (JSON + PDF server-side)
 *   PATCH  /api/invoices/:id
 *   DELETE /api/invoices/:id
 */

import { useCallback, useEffect, useState } from "react";

export type InvoiceDirection = "emitida" | "recibida";
export type InvoiceOrigin    = "upload" | "generate";
export type InvoiceStatus    = "draft" | "issued" | "paid" | "cancelled";

export interface Invoice {
  id: string;
  agencyId: string;
  direction: InvoiceDirection;
  origin: InvoiceOrigin;
  /** Número de factura · si se genera internamente, Byvaro lo asigna
   *  consecutivo por dirección (`emitida-2026-001`). Si se sube,
   *  puede ser el número original de la agencia. */
  numero: string;
  /** Fecha de emisión (ISO yyyy-mm-dd). */
  fecha: string;
  /** Concepto descriptivo. */
  concepto: string;
  /** Base imponible. */
  baseImponible: number;
  /** % IVA aplicado (ej. 21). */
  iva: number;
  /** Importe total (base + iva). */
  total: number;
  status: InvoiceStatus;
  /** Metadatos archivo. */
  pdfFilename?: string;
  pdfSize?: number;
  /** Quien la creó en el sistema. */
  createdBy?: { name: string; email?: string };
  createdAt: number;
  /** Si está pagada. */
  paidAt?: number;
  /** Nota interna. */
  notes?: string;
}

const STORAGE_KEY = "byvaro.agencyInvoices.v1";
const CHANGE_EVENT = "byvaro:agency-invoices-change";

function readStore(): Invoice[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function writeStore(list: Invoice[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

export function getAgencyInvoices(agencyId: string): Invoice[] {
  return readStore()
    .filter((i) => i.agencyId === agencyId)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Próximo número correlativo para facturas generadas internamente
 *  del tipo indicado. Formato `<dir>-<yyyy>-<###>`. */
function nextNumero(direction: InvoiceDirection): string {
  const year = new Date().getFullYear();
  const same = readStore().filter(
    (i) => i.origin === "generate" && i.direction === direction && i.numero.startsWith(`${direction}-${year}-`),
  );
  const next = same.length + 1;
  return `${direction}-${year}-${String(next).padStart(3, "0")}`;
}

export function createInvoice(data: {
  agencyId: string;
  direction: InvoiceDirection;
  origin: InvoiceOrigin;
  numero?: string;
  fecha: string;
  concepto: string;
  baseImponible: number;
  iva: number;
  status?: InvoiceStatus;
  pdfFilename?: string;
  pdfSize?: number;
  notes?: string;
  createdBy?: { name: string; email?: string };
}): Invoice {
  const total = Math.round((data.baseImponible * (1 + data.iva / 100)) * 100) / 100;
  const invoice: Invoice = {
    id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    agencyId: data.agencyId,
    direction: data.direction,
    origin: data.origin,
    numero: data.numero ?? (data.origin === "generate" ? nextNumero(data.direction) : `S/N-${Date.now()}`),
    fecha: data.fecha,
    concepto: data.concepto,
    baseImponible: data.baseImponible,
    iva: data.iva,
    total,
    status: data.status ?? (data.origin === "generate" ? "issued" : "issued"),
    pdfFilename: data.pdfFilename,
    pdfSize: data.pdfSize,
    notes: data.notes,
    createdBy: data.createdBy,
    createdAt: Date.now(),
  };
  writeStore([invoice, ...readStore()]);
  return invoice;
}

export function markInvoicePaid(id: string) {
  writeStore(readStore().map((i) => i.id === id ? { ...i, status: "paid" as const, paidAt: Date.now() } : i));
}

export function cancelInvoice(id: string) {
  writeStore(readStore().map((i) => i.id === id ? { ...i, status: "cancelled" as const } : i));
}

export function deleteInvoice(id: string) {
  writeStore(readStore().filter((i) => i.id !== id));
}

export function useAgencyInvoices(agencyId: string): Invoice[] {
  const [list, setList] = useState<Invoice[]>(() => getAgencyInvoices(agencyId));
  useEffect(() => {
    const cb = () => setList(getAgencyInvoices(agencyId));
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

export function formatEur(n: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency", currency: "EUR", maximumFractionDigits: 2,
  }).format(n);
}
