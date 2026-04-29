/**
 * collabRequests.ts · ADAPTER UNIFICADO de solicitudes de colaboración.
 *
 * Hoy en el prototipo viven TRES sistemas paralelos en localStorage:
 *
 *   1. **Invitaciones** (`invitaciones.ts`) · promotor → agencia con
 *      token + email · `byvaro-invitaciones`.
 *   2. **Solicitudes per-promoción** (`solicitudesColaboracion.ts`) ·
 *      agencia → promotor para UNA promoción concreta ·
 *      `byvaro.agency.collab-requests.v1`.
 *   3. **Solicitudes org-level** (`orgCollabRequests.ts`) · cualquier
 *      org → cualquier org peer-to-peer ·
 *      `byvaro.org-collab-requests.v1`.
 *
 * Este adapter expone una vista UNIFICADA de los tres como
 * `CollabRequest` con `kind` discriminante. NO reemplaza los hooks
 * existentes · los mantenemos vivos porque sus consumers actuales
 * (UI específica, drawers, banners) usan campos propios. Pero
 * cualquier vista que necesite "todas las solicitudes que afectan a
 * mi workspace" puede leer aquí y filtrar por `direction` o `status`
 * sin pasar por los tres stores.
 *
 * REGLA · Cada solicitud tiene `fromOrgId`, `toOrgId` y `currentOrgId`
 * decide la `direction`:
 *   · `currentOrgId === toOrgId`  → `inbound`  (esperando MI respuesta).
 *   · `currentOrgId === fromOrgId` → `outbound` (esperando respuesta DEL OTRO).
 *
 * TODO(backend): este adapter desaparece cuando el backend tenga UNA
 * tabla `collab_requests` con shape canónico:
 *   id PK · from_organization_id FK · to_organization_id FK ·
 *   promotion_id FK NULLABLE · kind ENUM · status ENUM ·
 *   created_at · responded_at · created_by · responded_by ·
 *   message TEXT NULLABLE.
 * Los tres stores localStorage se eliminan · el endpoint
 * `GET /api/collab-requests?direction=inbound|outbound&status=pending`
 * lo reemplaza por completo. RLS scoped al organization_id del JWT.
 */

import { useMemo } from "react";
import type { CurrentUser } from "./currentUser";
import { currentOrgIdentity } from "./orgCollabRequests";
import { useOrgCollabRequests } from "./orgCollabRequests";
import { useAllSolicitudes } from "./solicitudesColaboracion";
import { useInvitaciones } from "./invitaciones";

/* ─── Shape unificado ───────────────────────────────────────────── */

export type CollabRequestKind =
  | "invitation"          // mapped from `invitaciones` (promotor → agencia, con token)
  | "org_request"         // mapped from `orgCollabRequests` (org → org, sin promo)
  | "promotion_request";  // mapped from `solicitudesColaboracion` (agencia → promotor, con promoción)

export type CollabRequestStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "cancelled";          // solo invitaciones soportan "cancelada" hoy · resto cae en rejected

export type CollabRequestDirection = "inbound" | "outbound";

export interface CollabRequest {
  id: string;
  kind: CollabRequestKind;
  fromOrgId: string;
  toOrgId: string;
  promotionId: string | null;
  status: CollabRequestStatus;
  /** Calculado al consumir vía `useCollabRequests` · NO se persiste. */
  direction?: CollabRequestDirection;
  createdAt: number;
  respondedAt: number | null;
  /** Caducidad · solo relevante para `kind="invitation"` (cron de
   *  expiración). `null` para org_request y promotion_request porque
   *  no expiran automáticamente.
   *  Backend equivalent · `collab_requests.expires_at`.
   *  TODO(backend): cron diario marca `pending → cancelled` cuando
   *  `expires_at < now()`. */
  expiresAt?: number | null;
  /** Snapshot del actor que envió (solo si la fuente lo guardó).
   *  Backend equivalent · `created_by_user_id` con JOIN a `users`. */
  createdBy?: { name: string; email?: string };
  /** Snapshot del actor que decidió (acepta/rechaza).
   *  Backend equivalent · `responded_by_user_id`. */
  respondedBy?: { name: string; email?: string };
  /** Texto opcional · solo relevante en algunas fuentes. */
  message?: string;
  /** Per-kind extras · invitación lleva token, comisión, payment splits;
   *  promotion_request puede llevar términos contractuales propuestos;
   *  org_request normalmente vacío. Mantener cualquier shape · cada
   *  consumer hace narrowing por `kind`.
   *  Backend equivalent · `collab_requests.metadata jsonb`. */
  metadata?: Record<string, unknown>;
  /** Pista para debugging · de qué store viene la fila. NO se persiste
   *  en el backend · se usa solo durante la migración mock. */
  source: "invitaciones" | "solicitudesColaboracion" | "orgCollabRequests";
}

/* ─── Mappers · cada store → CollabRequest ──────────────────────── */

function mapInvitacionStatus(s: string): CollabRequestStatus {
  switch (s) {
    case "aceptada":  return "accepted";
    case "rechazada": return "rejected";
    case "caducada":  return "cancelled";
    case "pendiente":
    default:          return "pending";
  }
}

function mapSolicitudStatus(s: string): CollabRequestStatus {
  switch (s) {
    case "aceptada":  return "accepted";
    case "rechazada": return "rejected";
    case "pendiente":
    default:          return "pending";
  }
}

function mapOrgStatus(s: string): CollabRequestStatus {
  switch (s) {
    case "aceptada":  return "accepted";
    case "rechazada": return "rejected";
    case "pendiente":
    default:          return "pending";
  }
}

/* ─── Hook unificado · todas las solicitudes (sin filtrar) ──────── */

/** Devuelve TODAS las solicitudes del sistema (los tres stores) en
 *  shape unificado. NO aplica filtros · cada caller decide. La
 *  `direction` se calcula respecto al usuario actual. */
export function useCollabRequests(user: CurrentUser): CollabRequest[] {
  const invitaciones = useInvitaciones();
  const solicitudes = useAllSolicitudes();
  const orgRequests = useOrgCollabRequests();

  const myOrgId = currentOrgIdentity(user).orgId;

  return useMemo<CollabRequest[]>(() => {
    const list: CollabRequest[] = [];

    /* 1. Invitaciones · promotor → agencia.
     *    En mock single-tenant `fromOrgId` es siempre "developer-default"
     *    (todas las invitaciones las envía Luxinmo) y `toOrgId` es la
     *    agencia (solo si `agencyId` está set · invitaciones a email
     *    externo no entran en el modelo unificado · son emails sueltos
     *    sin org). */
    for (const inv of invitaciones.lista) {
      if (!inv.agencyId) continue; // skip invitaciones a email externo
      list.push({
        id: `inv-${inv.id}`,
        kind: "invitation",
        fromOrgId: "developer-default",
        toOrgId: inv.agencyId,
        promotionId: inv.promocionId ?? null,
        status: mapInvitacionStatus(inv.estado),
        createdAt: inv.createdAt,
        respondedAt: inv.respondidoEn ?? null,
        expiresAt: inv.expiraEn ?? null,
        createdBy: inv.createdBy,
        message: inv.mensajePersonalizado || undefined,
        /* Metadata per-kind · token de magic-link, idioma del email,
         *  comisión ofrecida, plan de pago al colaborador, datos
         *  obligatorios al registrar y promo asociada (denormalizada
         *  para email rendering). Backend equivalent ·
         *  `collab_requests.metadata jsonb` con misma estructura. */
        metadata: {
          token: inv.token,
          emailLanguage: inv.idiomaEmail,
          commissionPercentage: inv.comisionOfrecida,
          durationMonths: inv.duracionMeses,
          paymentPlan: inv.formaPago,
          requiredFields: inv.datosRequeridos,
          promotionName: inv.promocionNombre,
        },
        source: "invitaciones",
      });
    }

    /* 2. Solicitudes per-promoción · agencia → promotor con promoción.
     *    En mock, `fromOrgId` = `agencyId` y `toOrgId` siempre es
     *    "developer-default" porque sólo hay un promotor. */
    for (const s of solicitudes) {
      list.push({
        id: `sol-${s.id}`,
        kind: "promotion_request",
        fromOrgId: s.agencyId,
        toOrgId: "developer-default",
        promotionId: s.promotionId,
        status: mapSolicitudStatus(s.status),
        createdAt: s.createdAt,
        respondedAt: s.decidedAt ?? null,
        createdBy: s.requestedBy,
        respondedBy: s.decidedBy,
        message: s.message,
        source: "solicitudesColaboracion",
      });
    }

    /* 3. Solicitudes org-level · org ↔ org peer-to-peer. */
    for (const r of orgRequests) {
      list.push({
        id: `ocr-${r.id}`,
        kind: "org_request",
        fromOrgId: r.fromOrgId,
        toOrgId: r.toOrgId,
        promotionId: null,
        status: mapOrgStatus(r.status),
        createdAt: r.createdAt,
        respondedAt: r.decidedAt ?? null,
        createdBy: r.requestedBy,
        respondedBy: r.decidedBy,
        message: r.message,
        source: "orgCollabRequests",
      });
    }

    /* Direction calculada respecto al usuario actual · solo para las
     *  filas donde myOrgId participa. Las demás se devuelven con
     *  `direction = undefined` (admin global · normalmente nadie las
     *  ve, pero el adapter no decide qué filtrar).
     *
     *  Backend contract · `promotion_request` rejection is SILENT for
     *  the sender (regla canónica · CLAUDE.md "Solicitud de
     *  colaboración por promoción" + `docs/backend-dual-role-architecture.md
     *  §5.5`). El backend debe enmascarar `status='rejected'` como
     *  `'pending'` para el sender · la agencia NUNCA debe ver el
     *  rechazo del promotor. Replicamos ese masking aquí mientras el
     *  adapter es la fuente de UI · cuando el endpoint exista, el
     *  servidor ya devuelve `status='pending'` para sender de un
     *  promotion_request rechazado y este branch deja de mutar
     *  status (el masking pasa a server-side).
     *
     *  REGLA · Solo aplica a `promotion_request`. Ni `org_request` ni
     *  `invitation` tienen descarte silencioso (es flujo legítimo de
     *  rechazo bilateral). */
    return list.map((row) => {
      let direction: CollabRequestDirection | undefined;
      if (row.toOrgId === myOrgId) direction = "inbound";
      else if (row.fromOrgId === myOrgId) direction = "outbound";

      let status = row.status;
      if (
        row.kind === "promotion_request"
        && status === "rejected"
        && direction === "outbound"
      ) {
        /* El sender no debe enterarse · enmascaramos como pendiente.
         *  No tocamos `respondedAt` / `respondedBy` porque el sender
         *  no los lee (la UI no expone esos campos para outbound). */
        status = "pending";
      }

      return { ...row, direction, status };
    });
  }, [invitaciones.lista, solicitudes, orgRequests, myOrgId]);
}

/* ─── Hooks de conveniencia · filtros típicos ───────────────────── */

/** Pendientes que afectan al workspace actual (inbound + outbound).
 *  Útil para la pestaña "Pendientes" de `/colaboradores` · no debe
 *  mostrar pendientes globales que no me involucran. */
export function usePendingCollabRequestsForWorkspace(user: CurrentUser): CollabRequest[] {
  const all = useCollabRequests(user);
  return useMemo(
    () => all.filter((r) => r.status === "pending" && r.direction != null),
    [all],
  );
}

/** Solo las inbound pendientes · "esperando MI respuesta". */
export function useInboundPendingCollabRequests(user: CurrentUser): CollabRequest[] {
  const all = useCollabRequests(user);
  return useMemo(
    () => all.filter((r) => r.status === "pending" && r.direction === "inbound"),
    [all],
  );
}

/** Solo las outbound pendientes · "yo lo envié, esperando respuesta". */
export function useOutboundPendingCollabRequests(user: CurrentUser): CollabRequest[] {
  const all = useCollabRequests(user);
  return useMemo(
    () => all.filter((r) => r.status === "pending" && r.direction === "outbound"),
    [all],
  );
}

/** Map orgId → timestamp de la solicitud INBOUND pendiente más
 *  reciente (la otra org me pidió colaborar). Usado por la card del
 *  listado para pintar "Colaboración solicitada DD/MM/YYYY".
 *
 *  Devuelve un Record para lookup O(1) en el render del grid. */
export function useInboundPendingByOrgId(user: CurrentUser): Record<string, number> {
  const inbound = useInboundPendingCollabRequests(user);
  return useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of inbound) {
      const otherOrg = r.fromOrgId; // inbound: fromOrgId es el solicitante
      if (!map[otherOrg] || r.createdAt > map[otherOrg]) {
        map[otherOrg] = r.createdAt;
      }
    }
    return map;
  }, [inbound]);
}

/** Map orgId → timestamp de la solicitud OUTBOUND pendiente más
 *  reciente (yo le pedí colaborar a esa org). Usado por la card del
 *  listado para pintar "Solicitado DD/MM/YYYY". */
export function useOutboundPendingByOrgId(user: CurrentUser): Record<string, number> {
  const outbound = useOutboundPendingCollabRequests(user);
  return useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of outbound) {
      const otherOrg = r.toOrgId; // outbound: toOrgId es el receptor
      if (!map[otherOrg] || r.createdAt > map[otherOrg]) {
        map[otherOrg] = r.createdAt;
      }
    }
    return map;
  }, [outbound]);
}
