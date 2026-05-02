/**
 * solicitudesColaboracion.ts · solicitudes de colaboración que la
 * agencia envía al promotor por una promoción concreta.
 *
 * Mock single-tenant · localStorage. BACKEND · este store fusiona con
 * `invitaciones` y `orgCollabRequests` en la tabla unificada
 * `collab_requests` con `kind='promotion_request'` (ver
 * `docs/backend-dual-role-architecture.md §3.6`).
 *
 * Endpoints canónicos en INGLÉS (los stubs heredados en español se
 * mapean 1:1):
 *   · `POST /collab-requests`              { kind:'promotion_request',
 *                                             to_organization_id, promotion_id, message? }
 *      ANTES (legacy): `POST /api/agencias/me/colaboraciones-solicitadas`
 *   · `GET  /collab-requests?direction=inbound&kind=promotion_request`
 *      ANTES (legacy): `GET /api/promociones/:id/solicitudes-pendientes`
 *   · `POST /collab-requests/:id/{accept,reject,cancel,restore}`
 *
 * REGLA · descarte SILENCIOSO para `promotion_request` · ver
 * `docs/backend-dual-role-architecture.md §5.5` · cuando el caller es
 * el sender, el backend debe ENMASCARAR `status='rejected'` como
 * `'pending'` (la agencia nunca se entera del rechazo). El frontend
 * adapter `collabRequests.ts` ya implementa este masking.
 *
 * Estado · "pendiente" tras crear · pasa a "aceptada" cuando el
 * promotor aprueba (lo que implica añadir la promo a
 * `agency.promotionsCollaborating`) o "rechazada" si la deniega.
 */

import { useEffect, useState } from "react";
import { memCache } from "./memCache";

const STORAGE_KEY = "byvaro.agency.collab-requests.v1";
const EVENT = "byvaro:collab-requests-changed";

export type SolicitudColaboracionStatus = "pendiente" | "aceptada" | "rechazada";

export interface SolicitudColaboracion {
  id: string;
  agencyId: string;
  promotionId: string;
  message?: string;
  status: SolicitudColaboracionStatus;
  createdAt: number;
  /** Usuario que envió la solicitud · se muestra en el chip
   *  "Colaboración solicitada" (avatar + nombre) y en el historial
   *  cross-empresa. Backend: snapshot del actor en el momento del
   *  envío · `avatarUrl` puede quedar obsoleto si el usuario cambia
   *  su foto, pero refleja "quién envió esto" en ese momento. */
  requestedBy?: { name: string; email?: string; avatarUrl?: string };
  decidedAt?: number;
  /** Usuario del lado promotor que decidió (aceptar / rechazar /
   *  recuperar). Mirror de `requestedBy` pero del otro lado del
   *  flujo. Se muestra en las tabs Aceptadas y Descartadas. */
  decidedBy?: { name: string; email?: string; avatarUrl?: string };
}

function read(): SolicitudColaboracion[] {
  try {
    const raw = typeof window !== "undefined" ? memCache.getItem(STORAGE_KEY) : null;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SolicitudColaboracion[]) : [];
  } catch {
    return [];
  }
}

function write(list: SolicitudColaboracion[]) {
  if (typeof window === "undefined") return;
  memCache.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Crea una solicitud pendiente · idempotente · si ya hay una pendiente
 *  para el mismo (agencyId, promotionId) la devuelve en lugar de duplicar. */
export function crearSolicitud(input: {
  agencyId: string;
  promotionId: string;
  message?: string;
  requestedBy?: { name: string; email?: string; avatarUrl?: string };
}): SolicitudColaboracion {
  const list = read();
  const existing = list.find(
    (s) => s.agencyId === input.agencyId && s.promotionId === input.promotionId && s.status === "pendiente",
  );
  if (existing) return existing;
  const next: SolicitudColaboracion = {
    id: `sol-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    agencyId: input.agencyId,
    promotionId: input.promotionId,
    message: input.message?.trim() || undefined,
    status: "pendiente",
    createdAt: Date.now(),
    requestedBy: input.requestedBy,
  };
  write([...list, next]);
  return next;
}

/** Devuelve la solicitud pendiente de la agencia para una promoción
 *  concreta, si existe. Sirve para mostrar el chip "Colaboración
 *  solicitada · fecha · usuario" en la card. */
export function findSolicitudPendiente(
  agencyId: string,
  promotionId: string,
  list: SolicitudColaboracion[],
): SolicitudColaboracion | undefined {
  return list.find(
    (s) => s.agencyId === agencyId && s.promotionId === promotionId && s.status === "pendiente",
  );
}

/** Devuelve cualquier solicitud "viva" (pendiente o rechazada — NO
 *  aceptada porque ahí el promo pasa a colaboración activa) para
 *  esta (agencyId, promotionId). REGLA: el descarte del promotor
 *  es SILENCIOSO · la agencia no debe poder reenviar la solicitud
 *  ni saber que fue rechazada. Desde su lado siempre se ve como
 *  "Solicitud enviada", esté pendiente o descartada por el otro
 *  lado. Solo la borra el promotor (cuando envía invitación, ver
 *  `acceptInvitationOverride`). */
export function findSolicitudVivaParaAgencia(
  agencyId: string,
  promotionId: string,
  list: SolicitudColaboracion[],
): SolicitudColaboracion | undefined {
  return list.find(
    (s) =>
      s.agencyId === agencyId &&
      s.promotionId === promotionId &&
      (s.status === "pendiente" || s.status === "rechazada"),
  );
}

/** Override del promotor · cuando envía una invitación a una agencia
 *  para una promoción donde había una solicitud rechazada,
 *  marcamos esa solicitud como "aceptada" para que la relación
 *  formal sea la invitación. Devuelve la solicitud actualizada o
 *  null si no había una rechazada que reactivar. */
export function acceptInvitationOverride(
  agencyId: string,
  promotionId: string,
): SolicitudColaboracion | null {
  const list = read();
  const idx = list.findIndex(
    (s) => s.agencyId === agencyId && s.promotionId === promotionId && s.status === "rechazada",
  );
  if (idx === -1) return null;
  const updated: SolicitudColaboracion = {
    ...list[idx],
    status: "aceptada",
    decidedAt: Date.now(),
  };
  list[idx] = updated;
  write(list);
  return updated;
}

/** Lookup helper · ¿hay solicitud RECHAZADA para esta (agencyId,
 *  promoId)? Lo usa el SharePromotionDialog para mostrar el banner
 *  "esta agencia tenía una solicitud descartada · enviar la
 *  invitación la reactivará". */
export function hasRejectedSolicitud(agencyId: string, promotionId: string): boolean {
  return read().some(
    (s) => s.agencyId === agencyId && s.promotionId === promotionId && s.status === "rechazada",
  );
}

/** Hook reactivo · todas las solicitudes activas (no decididas) de una agencia. */
export function useSolicitudesPendientes(agencyId: string | undefined): SolicitudColaboracion[] {
  const [list, setList] = useState<SolicitudColaboracion[]>(() =>
    agencyId ? read().filter((s) => s.agencyId === agencyId && s.status === "pendiente") : [],
  );

  useEffect(() => {
    if (!agencyId) return;
    const refresh = () => setList(read().filter((s) => s.agencyId === agencyId && s.status === "pendiente"));
    refresh();
    window.addEventListener(EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [agencyId]);

  return list;
}

/** Hook reactivo · TODAS las solicitudes pendientes (todas las agencias).
 *  Para el lado promotor en /colaboradores que necesita ver la lista
 *  global. Cuando llegue el backend será `GET /api/me/colaboraciones-solicitudes?status=pendiente`. */
export function useAllSolicitudesPendientes(): SolicitudColaboracion[] {
  const [list, setList] = useState<SolicitudColaboracion[]>(() =>
    read().filter((s) => s.status === "pendiente"),
  );

  useEffect(() => {
    const refresh = () => setList(read().filter((s) => s.status === "pendiente"));
    refresh();
    window.addEventListener(EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return list;
}

/** Hook reactivo · TODAS las solicitudes (cualquier estado · todas las
 *  agencias). Lo usa el drawer de /colaboradores para renderizar tabs
 *  Pendientes/Aceptadas/Descartadas. */
export function useAllSolicitudes(): SolicitudColaboracion[] {
  const [list, setList] = useState<SolicitudColaboracion[]>(() => read());

  useEffect(() => {
    const refresh = () => setList(read());
    refresh();
    window.addEventListener(EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return list;
}

/** Restaura una solicitud descartada (rechazada) → vuelve a pendiente.
 *  Útil cuando el promotor descarta por error y quiere reconsiderar.
 *  Se limpia `decidedAt`/`decidedBy` para evitar mostrar trazabilidad
 *  obsoleta · queda como si el descarte no hubiera ocurrido. */
export function restaurarSolicitud(solicitudId: string) {
  const list = read();
  const next = list.map((s) =>
    s.id === solicitudId && s.status === "rechazada"
      ? { ...s, status: "pendiente" as const, decidedAt: undefined, decidedBy: undefined }
      : s,
  );
  write(next);
}

/** Marca una solicitud como rechazada · NO la borra para preservar
 *  trazabilidad (fecha, mensaje original, quién y cuándo descartó).
 *  La agencia NO se entera del descarte (silencioso): para ella
 *  la solicitud sigue viéndose como "Solicitud enviada". */
export function rechazarSolicitud(
  solicitudId: string,
  decidedBy?: { name: string; email?: string; avatarUrl?: string },
) {
  const list = read();
  const next = list.map((s) =>
    s.id === solicitudId
      ? { ...s, status: "rechazada" as const, decidedAt: Date.now(), decidedBy }
      : s,
  );
  write(next);
}

/** Marca una solicitud como aceptada · `decidedAt` y `decidedBy`
 *  permiten saber cuándo y quién lo hizo. */
export function aceptarSolicitud(
  solicitudId: string,
  decidedBy?: { name: string; email?: string; avatarUrl?: string },
) {
  const list = read();
  const next = list.map((s) =>
    s.id === solicitudId
      ? { ...s, status: "aceptada" as const, decidedAt: Date.now(), decidedBy }
      : s,
  );
  write(next);
}

/** Backfill · rellena `requestedBy` en solicitudes antiguas que no lo
 *  tenían (creadas antes de que el campo existiera). Solo afecta a las
 *  solicitudes pendientes de la agencia indicada · es la única
 *  inferencia razonable: "el usuario actual de la agencia X es el
 *  responsable de las solicitudes pendientes que ella misma envió".
 *  Devuelve cuántas filas mutó · si 0, no escribe (evita ruido). */
export function backfillRequestedBy(
  agencyId: string,
  actor: { name: string; email?: string; avatarUrl?: string },
): number {
  const list = read();
  let mutated = 0;
  const next = list.map((s) => {
    if (s.agencyId === agencyId && s.status === "pendiente" && !s.requestedBy?.name) {
      mutated += 1;
      return { ...s, requestedBy: { name: actor.name, email: actor.email, avatarUrl: actor.avatarUrl } };
    }
    return s;
  });
  if (mutated > 0) write(next);
  return mutated;
}
