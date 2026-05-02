/**
 * Solicitudes de documentos a la agencia · el promotor pide al
 * colaborador papeles necesarios para poder pagarle (factura,
 * certificado de alta de autónomos, modelo 130/303, IBAN, etc.).
 *
 * Ciclo de vida:
 *   pending  → solicitud enviada a la agencia.
 *   uploaded → la agencia subió el archivo · promotor revisa.
 *   approved → validado · puede proceder el pago.
 *   rejected → rechazado con motivo · la agencia vuelve a subir.
 *
 * MVP mock · cuando se conecte la parte de agencia (futuro), la
 * agencia verá estas solicitudes en su propia vista y subirá el
 * archivo desde ahí. Por ahora el promotor simula la subida.
 *
 * TODO(backend):
 *   · POST /api/agencias/:id/doc-requests { type, note, paymentId? }
 *   · POST /api/doc-requests/:id/upload (multipart) — desde agencia
 *   · PATCH /api/doc-requests/:id { status: "approved" | "rejected", note }
 */

import { useCallback, useEffect, useState } from "react";
import { memCache } from "./memCache";

export type DocRequestType =
  | "invoice"          // factura emitida por la agencia
  | "fiscal-cert"      // certificado de alta en actividad económica
  | "iban"             // IBAN de cobro
  | "tax-quarter"      // modelo 130/303/etc. del trimestre
  | "rc-insurance"     // responsabilidad civil
  | "custom";          // cualquier otro

export type DocRequestStatus = "pending" | "uploaded" | "approved" | "rejected";

export interface AgencyDocRequest {
  id: string;
  agencyId: string;
  type: DocRequestType;
  /** Título explícito (para custom · también override del default). */
  label: string;
  /** Nota del promotor explicando qué necesita (ej. motivo legal). */
  note?: string;
  /** Si el documento está vinculado a un pago concreto (factura de X
   *  tramo de Y venta). */
  paymentId?: string;
  status: DocRequestStatus;
  requestedBy?: { name: string; email?: string };
  requestedAt: number;
  /** Respuesta de la agencia. */
  uploadedAt?: number;
  fileUrl?: string;      // mock
  fileName?: string;
  fileSize?: number;
  /** Revisión del promotor. */
  reviewedAt?: number;
  reviewedBy?: { name: string; email?: string };
  rejectionReason?: string;
}

const STORAGE_KEY = "byvaro.agencyDocRequests.v1";
const SEED_KEY = "byvaro.agencyDocRequests.seeded.v1";
const CHANGE_EVENT = "byvaro:agency-doc-requests-changed";

function readStore(): AgencyDocRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = memCache.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function writeStore(list: AgencyDocRequest[]) {
  if (typeof window === "undefined") return;
  memCache.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  void (async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
      if (!isSupabaseConfigured) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || list.length === 0) return;
      const rows = list.map((d) => {
        const dq = d as unknown as Record<string, unknown>;
        return {
          id: d.id,
          developer_organization_id: "developer-default",
          agency_organization_id: d.agencyId,
          type: (dq.type as string) ?? "other",
          status: (dq.status as string) ?? "pending",
          due_at: (dq.dueAt as string) ?? null,
          submitted_at: (dq.submittedAt as string) ?? null,
          decided_at: (dq.decidedAt as string) ?? null,
          file_url: (dq.fileUrl as string) ?? null,
          notes: (dq.notes as string) ?? null,
          metadata: dq,
        };
      });
      const { error } = await supabase.from("doc_requests").upsert(rows, { onConflict: "id" });
      if (error) console.warn("[docRequests:sync]", error.message);
    } catch (e) { console.warn("[docRequests:sync] skipped:", e); }
  })();
}

function daysAgo(n: number) { return Date.now() - n * 24 * 60 * 60 * 1000; }

export function seedDocRequestsIfEmpty() {
  if (typeof window === "undefined") return;
  if (memCache.getItem(SEED_KEY)) return;
  const seeds: AgencyDocRequest[] = [
    {
      id: "doc-req-ag1-invoice-101",
      agencyId: "ag-1",
      type: "invoice",
      label: "Factura · comisión tramo 1 Villa 12-B",
      note: "Necesitamos factura con IVA desglosado antes de ejecutar el pago del tramo 1.",
      paymentId: "pay-seed-1",
      status: "pending",
      requestedAt: daysAgo(4),
    },
    {
      id: "doc-req-ag1-fiscal",
      agencyId: "ag-1",
      type: "fiscal-cert",
      label: "Certificado de alta actividad económica",
      note: "Anual · lo necesitamos actualizado para procesar pagos de 2026.",
      status: "uploaded",
      requestedAt: daysAgo(20),
      uploadedAt: daysAgo(15),
      fileName: "certificado-alta-prime-2026.pdf",
      fileSize: 124_000,
    },
    {
      id: "doc-req-ag1-iban",
      agencyId: "ag-1",
      type: "iban",
      label: "Certificado bancario con IBAN",
      note: "",
      status: "approved",
      requestedAt: daysAgo(90),
      uploadedAt: daysAgo(88),
      reviewedAt: daysAgo(86),
      reviewedBy: { name: "Arman Yeghiazaryan", email: "arman@luxinmo.com" },
      fileName: "iban-prime-properties.pdf",
      fileSize: 82_000,
    },
  ];
  writeStore(seeds);
  memCache.setItem(SEED_KEY, "1");
}

export function getDocRequestsForAgency(agencyId: string): AgencyDocRequest[] {
  return readStore().filter((d) => d.agencyId === agencyId);
}

export function createDocRequest(data: {
  agencyId: string;
  type: DocRequestType;
  label: string;
  note?: string;
  paymentId?: string;
  actor?: { name: string; email?: string };
}): AgencyDocRequest {
  const now = Date.now();
  const req: AgencyDocRequest = {
    id: `doc-req-${now}-${Math.random().toString(36).slice(2, 6)}`,
    agencyId: data.agencyId,
    type: data.type,
    label: data.label,
    note: data.note,
    paymentId: data.paymentId,
    status: "pending",
    requestedBy: data.actor,
    requestedAt: now,
  };
  writeStore([req, ...readStore()]);
  return req;
}

/** Mock: simula que la agencia subió el documento. */
export function mockAgencyUpload(
  requestId: string,
  file: { name: string; size?: number },
) {
  const now = Date.now();
  writeStore(readStore().map((r) =>
    r.id === requestId ? {
      ...r,
      status: "uploaded" as DocRequestStatus,
      uploadedAt: now,
      fileName: file.name,
      fileSize: file.size,
      fileUrl: `mock://uploads/${file.name}`,
    } : r,
  ));
}

export function approveDocRequest(
  requestId: string,
  actor?: { name: string; email?: string },
) {
  const now = Date.now();
  writeStore(readStore().map((r) =>
    r.id === requestId ? {
      ...r, status: "approved" as DocRequestStatus,
      reviewedAt: now, reviewedBy: actor,
    } : r,
  ));
}

export function rejectDocRequest(
  requestId: string,
  reason: string,
  actor?: { name: string; email?: string },
) {
  const now = Date.now();
  writeStore(readStore().map((r) =>
    r.id === requestId ? {
      ...r, status: "rejected" as DocRequestStatus,
      reviewedAt: now, reviewedBy: actor, rejectionReason: reason,
    } : r,
  ));
}

export function deleteDocRequest(requestId: string) {
  writeStore(readStore().filter((r) => r.id !== requestId));
}

export function useAgencyDocRequests(agencyId: string): AgencyDocRequest[] {
  const [list, setList] = useState<AgencyDocRequest[]>(() => {
    seedDocRequestsIfEmpty();
    return getDocRequestsForAgency(agencyId);
  });
  useEffect(() => {
    const cb = () => setList(getDocRequestsForAgency(agencyId));
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

/** Metadata por tipo · label por defecto + icono. El icono se
 *  resuelve en el render, aquí solo el nombre de lucide. */
export const DOC_REQUEST_META: Record<DocRequestType, {
  defaultLabel: string;
  description: string;
}> = {
  invoice:      { defaultLabel: "Factura",                    description: "Factura emitida por la agencia con IVA desglosado." },
  "fiscal-cert":{ defaultLabel: "Certificado fiscal",         description: "Alta en actividad económica o certificado análogo." },
  iban:         { defaultLabel: "IBAN bancario",              description: "Certificado bancario con titular e IBAN para el pago." },
  "tax-quarter":{ defaultLabel: "Modelo fiscal trimestral",   description: "Modelo 130 / 303 / 115 del último trimestre." },
  "rc-insurance":{defaultLabel: "Seguro responsabilidad civil", description: "Póliza de RC vigente con capital cubierto." },
  custom:       { defaultLabel: "Documento personalizado",    description: "Cualquier otro documento que necesites." },
};

export const DOC_STATUS_LABEL: Record<DocRequestStatus, {
  label: string;
  tone: "muted" | "primary" | "success" | "warning" | "destructive";
}> = {
  pending:  { label: "Solicitado",  tone: "muted" },
  uploaded: { label: "Subido · por revisar", tone: "primary" },
  approved: { label: "Aprobado",    tone: "success" },
  rejected: { label: "Rechazado",   tone: "destructive" },
};
