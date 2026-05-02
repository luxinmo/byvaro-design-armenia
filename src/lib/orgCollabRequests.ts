/**
 * orgCollabRequests.ts · solicitudes de colaboración a nivel
 * ORGANIZACIÓN (no per-promotion).
 *
 * Distinto de `solicitudesColaboracion.ts` que es per-promotion.
 * Este modelo cubre el flujo "Aún no colaboras · enviar solicitud"
 * desde la ficha pública de cualquier empresa (agencia o promotor).
 *
 * REGLA BYVARO (consensuada con producto · 2026-04-29):
 *   1. Cualquier organización puede pedir colaborar con otra.
 *   2. La org receptora ve la solicitud como
 *      "Solicitudes recibidas · esperando tu respuesta".
 *   3. Acepta → quedan colaborando. Rechaza → solicitud descartada.
 *   4. Antes de enviar una solicitud, el admin de la empresa
 *      ORIGEN debe tener su workspace con datos mínimos:
 *      razón social + CIF + dirección fiscal + al menos un contacto.
 *      Sin esos datos NO se puede enviar (toast informativo y
 *      mensaje "contacta con tu admin").
 *   5. Las invitaciones de PROMOTORES (flujo `invitaciones.ts`)
 *      prevalecen sobre la regla 4 · una agencia puede aceptar una
 *      invitación de promotor aunque su workspace esté vacío.
 *
 * Mock storage · `localStorage["byvaro.org-collab-requests.v1"]`.
 *
 * BACKEND · este store fusiona con `solicitudesColaboracion` y
 * `invitaciones` en la tabla unificada `collab_requests` con
 * `kind ∈ {invitation, org_request, promotion_request}`. Ver
 * `docs/backend-dual-role-architecture.md §3.6`. Endpoints canónicos
 * en inglés:
 *   · `GET /collab-requests?direction=inbound|outbound&status=pending&kind=org_request`
 *   · `POST /collab-requests` (body sin `from_organization_id` · viene del JWT)
 *   · `POST /collab-requests/:id/{accept,reject,cancel,restore}`
 * RLS: cada org solo ve filas donde participe como `from_organization_id`
 * o `to_organization_id`.
 */

import { useEffect, useMemo, useState } from "react";
import { memCache } from "./memCache";
import type { CurrentUser } from "./currentUser";
import { defaultEmpresa, loadEmpresaForOrg, type Empresa } from "./empresa";

const STORAGE_KEY = "byvaro.org-collab-requests.v1";
const EVENT = "byvaro:org-collab-requests-changed";

export type OrgCollabRequestStatus = "pendiente" | "aceptada" | "rechazada";
export type OrgKind = "developer" | "agency";

export interface OrgCollabRequest {
  id: string;
  /** Org que envía. */
  fromOrgId: string;
  fromOrgName: string;
  fromOrgKind: OrgKind;
  /** Org que recibe. */
  toOrgId: string;
  toOrgName: string;
  toOrgKind: OrgKind;
  message?: string;
  status: OrgCollabRequestStatus;
  createdAt: number;
  /** Snapshot del usuario que pulsó "Enviar solicitud". */
  requestedBy?: { name: string; email?: string };
  decidedAt?: number;
  decidedBy?: { name: string; email?: string };
}

function read(): OrgCollabRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = memCache.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OrgCollabRequest[]) : [];
  } catch {
    return [];
  }
}

function write(list: OrgCollabRequest[]) {
  if (typeof window === "undefined") return;
  memCache.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Resuelve la empresa del workspace del usuario actual leyendo SIEMPRE
 *  el storage scoped del orgId (`byvaro-empresa:<orgId>`). Si no hay
 *  edición previa, `loadEmpresaForOrg` cae al seed correspondiente
 *  (LUXINMO_PROFILE para developer, agencyToEmpresa(agencies) para
 *  agency, agencyToEmpresa(promotores) para promotor externo).
 *
 *  Usado para validar que el actor tiene los datos mínimos antes
 *  de enviar una solicitud (`hasMinimumIdentityData(myEmpresa)`) o
 *  al pintar el banner "Tu empresa no será visible".
 *
 *  REGLA · NO leemos directamente el seed para agency · si la agencia
 *  ha editado su perfil en `/empresa`, la versión editada manda. */
export function getMyOwnEmpresa(user: CurrentUser): Empresa {
  const { orgId } = currentOrgIdentity(user);
  return loadEmpresaForOrg(orgId) ?? defaultEmpresa;
}

/** Resuelve el `(orgId, orgKind)` del usuario actual. En el mock
 *  single-tenant, developer = `developer-default`, agency = id real
 *  de la agencia.
 *
 *  TODO(backend): el JWT lleva `organization_id` y `kind` directamente. */
export function currentOrgIdentity(user: CurrentUser): {
  orgId: string;
  orgKind: OrgKind;
  orgName: string;
} {
  /* Cadena de resolución del orgId · idéntica a `userOrgId()` en
   *  `src/lib/empresa.ts` · ambas DEBEN coincidir para que el banner
   *  "no eres visible" y la pantalla de preview lean la misma empresa.
   *
   *  1. `user.organizationId` · UUID real de la DB · seteado por
   *     `loginAs()` tras login/signup vía Supabase.
   *  2. `user.agencyId` · legacy (mockUsers + agency seeds, también
   *     workspaces externos `prom-X`).
   *  3. Sentinel default por accountType. */
  if (user.accountType === "developer") {
    return {
      orgId: user.organizationId || user.agencyId || "developer-default",
      orgKind: "developer",
      /* El nombre se rellena en el caller con `useEmpresa()` ·
       *  mantener este helper sin acceso al storage de empresa. */
      orgName: user.name,
    };
  }
  return {
    orgId: user.organizationId || user.agencyId || "ag-unknown",
    orgKind: "agency",
    orgName: user.name,
  };
}

/** Crea una solicitud pendiente · idempotente: si ya hay una
 *  pendiente entre el mismo par from→to, la devuelve sin duplicar.
 *  Optimistic write a localStorage + write-through a Supabase. */
export function crearOrgCollabRequest(input: Omit<
  OrgCollabRequest, "id" | "status" | "createdAt"
>): OrgCollabRequest {
  const list = read();
  const existing = list.find(
    (s) =>
      s.fromOrgId === input.fromOrgId
      && s.toOrgId === input.toOrgId
      && s.status === "pendiente",
  );
  if (existing) return existing;
  const next: OrgCollabRequest = {
    id: `ocr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ...input,
    status: "pendiente",
    createdAt: Date.now(),
  };
  write([...list, next]);

  /* Write-through · INSERT a `collab_requests` con kind='org_request'.
   *  RLS verifica que el caller es admin del fromOrgId. Si falla,
   *  la fila queda en localStorage (la próxima hidratación reconcilia). */
  void (async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
      if (!isSupabaseConfigured) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from("collab_requests").insert({
        from_organization_id: input.fromOrgId,
        to_organization_id: input.toOrgId,
        kind: "org_request",
        status: "pending",
        created_by_user_id: user.id,
        message: input.message ?? null,
        metadata: {
          fromOrgName: input.fromOrgName,
          toOrgName: input.toOrgName,
          fromOrgKind: input.fromOrgKind,
          toOrgKind: input.toOrgKind,
          requestedBy: input.requestedBy,
          localId: next.id,
        },
      });
      if (error) console.warn("[orgCollabRequest:create] supabase insert failed:", error.message);
    } catch (e) { console.warn("[orgCollabRequest:create] skipped:", e); }
  })();

  return next;
}

export function aceptarOrgCollabRequest(id: string, decidedBy?: { name: string; email?: string }) {
  const list = read();
  const target = list.find((s) => s.id === id);
  write(list.map((s) => s.id === id
    ? { ...s, status: "aceptada", decidedAt: Date.now(), decidedBy }
    : s,
  ));

  /* Write-through · marca request como accepted Y MATERIALIZA la
   *  fila correspondiente en `organization_collaborations`. */
  void (async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
      if (!isSupabaseConfigured || !target) return;
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("collab_requests")
        .update({
          status: "accepted",
          responded_at: new Date().toISOString(),
          responded_by_user_id: user?.id ?? null,
        })
        .eq("kind", "org_request")
        .eq("from_organization_id", target.fromOrgId)
        .eq("to_organization_id", target.toOrgId)
        .eq("status", "pending");
      if (error) console.warn("[orgCollabRequest:accept] supabase update failed:", error.message);

      /* Materializar collab. El trigger normalize_orgcollab_pair se
       *  encarga de ordenar a < b. */
      const { error: collabErr } = await supabase
        .from("organization_collaborations").insert({
          organization_a_id: target.fromOrgId,
          organization_b_id: target.toOrgId,
          status: "active",
          started_at: new Date().toISOString(),
        });
      /* Idempotente · constraint unique pair la rechaza si ya existe.
       *  Ignoramos código 23505 (unique_violation). */
      if (collabErr && !collabErr.message.includes("duplicate")) {
        console.warn("[org_collaboration:create]", collabErr.message);
      }
    } catch (e) { console.warn("[orgCollabRequest:accept] skipped:", e); }
  })();
}

export function rechazarOrgCollabRequest(id: string, decidedBy?: { name: string; email?: string }) {
  const list = read();
  const target = list.find((s) => s.id === id);
  write(list.map((s) => s.id === id
    ? { ...s, status: "rechazada", decidedAt: Date.now(), decidedBy }
    : s,
  ));
  void (async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
      if (!isSupabaseConfigured || !target) return;
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("collab_requests")
        .update({
          status: "rejected",
          responded_at: new Date().toISOString(),
          responded_by_user_id: user?.id ?? null,
        })
        .eq("kind", "org_request")
        .eq("from_organization_id", target.fromOrgId)
        .eq("to_organization_id", target.toOrgId)
        .eq("status", "pending");
      if (error) console.warn("[orgCollabRequest:reject] supabase update failed:", error.message);
    } catch (e) { console.warn("[orgCollabRequest:reject] skipped:", e); }
  })();
}

/** Hook reactivo · todas las solicitudes (sin filtrar). Útil para
 *  vistas que listan recibidas + enviadas con tabs. */
export function useOrgCollabRequests(): OrgCollabRequest[] {
  const [list, setList] = useState<OrgCollabRequest[]>(() => read());
  useEffect(() => {
    const refresh = () => setList(read());
    refresh();
    window.addEventListener(EVENT, refresh as EventListener);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVENT, refresh as EventListener);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return list;
}

/** Solicitudes RECIBIDAS por la org del usuario actual, filtradas
 *  por status (default: pendientes). */
export function useReceivedOrgCollabRequests(
  user: CurrentUser,
  status: OrgCollabRequestStatus = "pendiente",
): OrgCollabRequest[] {
  const all = useOrgCollabRequests();
  const myOrgId = currentOrgIdentity(user).orgId;
  return useMemo(
    () => all.filter((s) => s.toOrgId === myOrgId && s.status === status),
    [all, myOrgId, status],
  );
}

/** Solicitudes ENVIADAS por la org del usuario actual. */
export function useSentOrgCollabRequests(
  user: CurrentUser,
  status?: OrgCollabRequestStatus,
): OrgCollabRequest[] {
  const all = useOrgCollabRequests();
  const myOrgId = currentOrgIdentity(user).orgId;
  return useMemo(
    () => all.filter((s) =>
      s.fromOrgId === myOrgId
      && (status ? s.status === status : true),
    ),
    [all, myOrgId, status],
  );
}

/** ¿Hay una solicitud pendiente del actual hacia `targetOrgId`? */
export function useHasPendingRequestTo(user: CurrentUser, targetOrgId: string | undefined): boolean {
  const sent = useSentOrgCollabRequests(user, "pendiente");
  return useMemo(
    () => !!targetOrgId && sent.some((s) => s.toOrgId === targetOrgId),
    [sent, targetOrgId],
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Validación de "datos mínimos" para enviar solicitud

   El admin de la empresa origen debe tener:
   1. Razón social NO vacía.
   2. CIF NO vacío.
   3. Dirección fiscal · al menos `direccionFiscalCompleta` o
      la combinación `ciudad + país`.
   4. Al menos un contacto · email o teléfono.

   Sin esto la solicitud NO se puede enviar · regla canónica.
   ═══════════════════════════════════════════════════════════════════ */
export function hasMinimumIdentityData(empresa: Empresa): {
  ok: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (!empresa.razonSocial?.trim()) missing.push("Razón social");
  if (!empresa.cif?.trim()) missing.push("CIF/NIF/VAT");
  const hasFiscal = !!(
    empresa.direccionFiscalCompleta?.trim()
    || (empresa.direccionFiscal?.ciudad?.trim() && empresa.direccionFiscal?.pais?.trim())
  );
  if (!hasFiscal) missing.push("Dirección fiscal");
  const hasContact = !!(empresa.email?.trim() || empresa.telefono?.trim());
  if (!hasContact) missing.push("Email o teléfono de contacto");
  return { ok: missing.length === 0, missing };
}
