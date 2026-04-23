/**
 * companyEvents.ts · Historial cross-empresa (promotor ↔ agencia).
 *
 * Es la fuente única de verdad del vínculo comercial entre dos
 * organizaciones. Toda interacción relevante entre un promotor y
 * una agencia se registra aquí: primera solicitud, invitaciones,
 * aceptaciones/rechazos, registros aprobados/rechazados, visitas,
 * contratos, ventas, incidencias.
 *
 * REGLA DE ORO (ver CLAUDE.md §"Historial entre empresas"):
 *   - SOLO admin ve el timeline.
 *   - La página debe declararlo explícitamente ("Historial solo
 *     visible para administradores").
 *   - Toda acción que cambie el vínculo debe llamar a
 *     `recordCompanyEvent()` (o su helper tipado) en el mismo
 *     handler que dispara la acción — no es opcional.
 *
 * TODO(backend):
 *   - Tabla `company_events(id, agency_id, type, title, description,
 *     by_name, by_email, by_id, related_ids jsonb, meta jsonb,
 *     happened_at)` en el schema del promotor.
 *   - POST /api/agencies/:id/events  · append-only.
 *   - GET  /api/agencies/:id/events  · listado, paginado,
 *     restringido a admin via RLS + JWT claim `role=admin`.
 *   - Triggers internos: registrar eventos automáticos (bot)
 *     cuando una invitación expira sin respuesta, cuando un
 *     registro se marca duplicado, etc.
 */

import { useEffect, useState } from "react";
import { useCurrentUser, isAdmin } from "./currentUser";

const KEY = "byvaro.companyEvents.v1";
const CHANGE = "byvaro:companyEvents-change";

/** Catálogo de tipos de evento. Agrupados por dominio para que la
 *  UI pueda pintar iconos y etiquetas coherentes. */
export type CompanyEventType =
  /* Ciclo de vida de la colaboración */
  | "invitation_sent"
  | "invitation_accepted"
  | "invitation_rejected"
  | "invitation_cancelled"
  | "invitation_expired"
  | "request_received"
  | "request_approved"
  | "request_rejected"
  | "collaboration_paused"
  | "collaboration_resumed"
  | "collaboration_ended"
  /* Registros de clientes */
  | "registration_created"
  | "registration_approved"
  | "registration_rejected"
  | "registration_expired"
  /* Visitas */
  | "visit_scheduled"
  | "visit_completed"
  | "visit_cancelled"
  /* Ofertas, ventas, contratos */
  | "offer_sent"
  | "offer_rejected"
  | "sale_reserved"
  | "sale_contracted"
  | "sale_completed"
  | "sale_cancelled"
  | "contract_sent"
  | "contract_signed"
  /* Incidencias */
  | "incident_duplicate"
  | "incident_cancellation"
  | "incident_claim"
  /* Escape hatch */
  | "custom";

export type CompanyEventActor = {
  name: string;
  email?: string;
  /** Si el evento lo disparó el sistema, `name === "Sistema"` y
   *  este flag pasa a true para que la UI use estilo bot. */
  system?: boolean;
};

export type CompanyEvent = {
  id: string;
  /** FK → src/data/agencies.ts::Agency.id */
  agencyId: string;
  type: CompanyEventType;
  title: string;
  /** Texto largo opcional (ej. motivo de rechazo, nota del promotor). */
  description?: string;
  /** Quién disparó el evento. `undefined` para eventos muy antiguos
   *  migrados sin autor conocido. */
  by?: CompanyEventActor;
  /** IDs relacionados para enlaces y contexto (promoción, registro,
   *  cliente, venta, contrato). */
  related?: {
    promotionId?: string;
    promotionName?: string;
    clientName?: string;
    unit?: string;
    registroId?: string;
    saleId?: string;
    contractId?: string;
  };
  /** Timestamp ISO. Se fija al crear y nunca se muta. */
  happenedAt: string;
};

/* ══════════════════════════════════════════════════════════
   Storage básico
   ══════════════════════════════════════════════════════════ */

function read(): CompanyEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CompanyEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(list: CompanyEvent[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(CHANGE));
}

/** API genérica · el resto de helpers delegan aquí. */
export function recordCompanyEvent(
  agencyId: string,
  type: CompanyEventType,
  title: string,
  opts: {
    description?: string;
    by?: CompanyEventActor;
    related?: CompanyEvent["related"];
  } = {},
): CompanyEvent {
  const evt: CompanyEvent = {
    id: `ce-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    agencyId,
    type,
    title,
    description: opts.description,
    by: opts.by,
    related: opts.related,
    happenedAt: new Date().toISOString(),
  };
  write([evt, ...read()]);
  return evt;
}

/* ══════════════════════════════════════════════════════════
   Helpers tipados · uno por cada caso documentado en CLAUDE.md
   ══════════════════════════════════════════════════════════ */

export const recordInvitationSent = (
  agencyId: string,
  by: CompanyEventActor,
  related?: { promotionId?: string; promotionName?: string },
) =>
  recordCompanyEvent(agencyId, "invitation_sent",
    related?.promotionName
      ? `Invitación enviada · ${related.promotionName}`
      : "Invitación enviada",
    { by, related });

export const recordInvitationAccepted = (agencyId: string, by: CompanyEventActor) =>
  recordCompanyEvent(agencyId, "invitation_accepted", "Invitación aceptada", { by });

export const recordInvitationRejected = (agencyId: string, by: CompanyEventActor, reason?: string) =>
  recordCompanyEvent(agencyId, "invitation_rejected", "Invitación rechazada",
    { by, description: reason });

export const recordInvitationCancelled = (agencyId: string, by: CompanyEventActor) =>
  recordCompanyEvent(agencyId, "invitation_cancelled", "Invitación cancelada", { by });

export const recordRequestReceived = (
  agencyId: string,
  message?: string,
  related?: { promotionId?: string; promotionName?: string },
) =>
  recordCompanyEvent(agencyId, "request_received",
    related?.promotionName
      ? `Solicitud entrante · ${related.promotionName}`
      : "Solicitud entrante",
    { by: { name: "Sistema", system: true }, description: message, related });

export const recordRequestApproved = (agencyId: string, by: CompanyEventActor) =>
  recordCompanyEvent(agencyId, "request_approved", "Solicitud aprobada", { by });

export const recordRequestRejected = (agencyId: string, by: CompanyEventActor, reason?: string) =>
  recordCompanyEvent(agencyId, "request_rejected", "Solicitud rechazada", { by, description: reason });

export const recordRegistrationApproved = (
  agencyId: string,
  by: CompanyEventActor,
  clientName: string,
  promotionName: string,
  registroId?: string,
) =>
  recordCompanyEvent(agencyId, "registration_approved",
    `Registro aprobado · ${clientName} · ${promotionName}`,
    { by, related: { clientName, promotionName, registroId } });

export const recordRegistrationRejected = (
  agencyId: string,
  by: CompanyEventActor,
  clientName: string,
  reason?: string,
  registroId?: string,
) =>
  recordCompanyEvent(agencyId, "registration_rejected",
    `Registro rechazado · ${clientName}`,
    { by, description: reason, related: { clientName, registroId } });

export const recordVisitScheduled = (
  agencyId: string,
  by: CompanyEventActor,
  info: { clientName: string; promotionName: string; when: string },
) =>
  recordCompanyEvent(agencyId, "visit_scheduled",
    `Visita programada · ${info.clientName} · ${info.promotionName} · ${info.when}`,
    { by, related: { clientName: info.clientName, promotionName: info.promotionName } });

export const recordVisitCompleted = (
  agencyId: string,
  by: CompanyEventActor,
  info: { clientName: string; outcome: string; rating?: number },
) =>
  recordCompanyEvent(agencyId, "visit_completed",
    `Visita realizada · ${info.clientName} · ${info.outcome}${info.rating ? ` · ${info.rating}★` : ""}`,
    { by, related: { clientName: info.clientName } });

export const recordContractSent = (agencyId: string, by: CompanyEventActor, docName: string, contractId?: string) =>
  recordCompanyEvent(agencyId, "contract_sent", `Contrato enviado · ${docName}`,
    { by, related: { contractId } });

export const recordContractSigned = (agencyId: string, by: CompanyEventActor, docName: string, contractId?: string) =>
  recordCompanyEvent(agencyId, "contract_signed", `Contrato firmado · ${docName}`,
    { by, related: { contractId } });

export const recordSaleClosed = (
  agencyId: string,
  by: CompanyEventActor,
  info: { clientName: string; unit: string; amount: number; saleId?: string },
) =>
  recordCompanyEvent(agencyId, "sale_completed",
    `Venta cerrada · ${info.clientName} · ${info.unit}`,
    { by, description: `${new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(info.amount)}`, related: { clientName: info.clientName, unit: info.unit, saleId: info.saleId } });

export const recordSaleRejected = (
  agencyId: string,
  by: CompanyEventActor,
  info: { clientName: string; reason: string; saleId?: string },
) =>
  recordCompanyEvent(agencyId, "sale_cancelled",
    `Venta rechazada · ${info.clientName}`,
    { by, description: info.reason, related: { clientName: info.clientName, saleId: info.saleId } });

export const recordCollaborationPaused = (agencyId: string, by: CompanyEventActor, reason?: string) =>
  recordCompanyEvent(agencyId, "collaboration_paused", "Colaboración pausada", { by, description: reason });

export const recordCollaborationResumed = (agencyId: string, by: CompanyEventActor) =>
  recordCompanyEvent(agencyId, "collaboration_resumed", "Colaboración reanudada", { by });

export const recordCompanyAny = (
  agencyId: string,
  type: CompanyEventType,
  title: string,
  description?: string,
  by?: CompanyEventActor,
) => recordCompanyEvent(agencyId, type, title, { description, by });

/* ══════════════════════════════════════════════════════════
   Hooks de lectura
   ══════════════════════════════════════════════════════════ */

/** Guard canónico de visibilidad: SOLO admin del promotor.
 *  - Agencia → false (aunque esté consultando su propia ficha, no
 *    ve la auditoría cross-tenant del promotor).
 *  - Agente (no admin) → false.
 *  - Admin del promotor → true.
 *
 *  En producción la query sale restringida por RLS con claim
 *  role=admin; este hook modela la misma intención en el cliente
 *  para que la UI ni siquiera renderice los datos. */
export function useCanViewCompanyHistory(): boolean {
  const user = useCurrentUser();
  if (user.accountType !== "developer") return false;
  return isAdmin(user);
}

/** Eventos de una agencia concreta, más recientes primero.
 *  Devuelve [] si el viewer no es admin del promotor — nunca
 *  expone datos confidenciales, ni siquiera al hook. */
export function useCompanyEvents(agencyId: string): CompanyEvent[] {
  const canView = useCanViewCompanyHistory();
  const [list, setList] = useState<CompanyEvent[]>(() =>
    canView ? read().filter((e) => e.agencyId === agencyId) : [],
  );
  useEffect(() => {
    const cb = () => setList(canView ? read().filter((e) => e.agencyId === agencyId) : []);
    cb();
    window.addEventListener(CHANGE, cb);
    window.addEventListener("storage", cb);
    return () => {
      window.removeEventListener(CHANGE, cb);
      window.removeEventListener("storage", cb);
    };
  }, [agencyId, canView]);
  return list;
}

/** Todos los eventos · solo para herramientas de admin.
 *  Mismo guard: [] si el viewer no es admin. */
export function useAllCompanyEvents(): CompanyEvent[] {
  const canView = useCanViewCompanyHistory();
  const [list, setList] = useState<CompanyEvent[]>(() => (canView ? read() : []));
  useEffect(() => {
    if (!canView) { setList([]); return; }
    const cb = () => setList(read());
    cb();
    window.addEventListener(CHANGE, cb);
    window.addEventListener("storage", cb);
    return () => {
      window.removeEventListener(CHANGE, cb);
      window.removeEventListener("storage", cb);
    };
  }, [canView]);
  return list;
}
