/**
 * invitacionesDescartadas.ts · Descarte LOCAL de invitaciones (lado
 * agencia).
 *
 * Cuando una agencia recibe una invitación a colaborar en una promoción
 * y NO le interesa, puede pulsar "Descartar". Este descarte es **local
 * a la agencia** y NO notifica al promotor/comercializador · él sigue
 * viendo la invitación como `pendiente` y eventualmente caducará por
 * timeout.
 *
 * Justificación · una agencia no quiere generar fricción notificando
 * "rechazo" a cada promotor que no le interese. Es más natural que
 * simplemente desaparezca de su vista.
 *
 * Storage · `byvaro.invitaciones.descartadas.v1:<orgId>` (scoped por
 * agencia · evita que en navegador compartido un user vea las
 * descartadas de otro). Las funciones aceptan `orgId` opcional · si no
 * se pasa, leen de `currentOrgIdentity(useCurrentUser())`.
 *
 * Compatibilidad · si la clave legacy global existe (instalaciones
 * pre-2026-04-30), se migra al `:<orgId>` del workspace logueado al
 * primer read.
 *
 * TODO(backend): tabla `agency_invitation_dismissals(agency_id,
 * invitation_id, dismissed_at)` con RLS por agency_id.
 */

import { currentOrgIdentity } from "./orgCollabRequests";
import { useCurrentUser } from "./currentUser";
import type { CurrentUser } from "./currentUser";

const KEY_PREFIX = "byvaro.invitaciones.descartadas.v1";
const LEGACY_KEY = "byvaro.invitaciones.descartadas.v1";

function keyFor(orgId: string): string {
  return `${KEY_PREFIX}:${orgId}`;
}

/** Resuelve el orgId del user actual sin hooks · para callers no-React.
 *  Si no hay sesión activa o no se puede resolver, devuelve `null`. */
function readCurrentOrgIdSync(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const accountType = sessionStorage.getItem("byvaro.accountType.v1");
    const agencyId = sessionStorage.getItem("byvaro.accountType.agencyId.v1");
    if (accountType === "agency" && agencyId) return agencyId;
    if (accountType === "developer") return "developer-default";
  } catch { /* fallthrough */ }
  return null;
}

function read(orgId?: string): string[] {
  if (typeof window === "undefined") return [];
  const effectiveOrgId = orgId ?? readCurrentOrgIdSync();
  if (!effectiveOrgId) return [];
  try {
    /* Migración legacy · si existe la clave global y aún NO hay scoped,
     *  copiamos al workspace actual y borramos legacy. Idempotente. */
    const scopedRaw = localStorage.getItem(keyFor(effectiveOrgId));
    if (!scopedRaw) {
      const legacyRaw = localStorage.getItem(LEGACY_KEY);
      if (legacyRaw) {
        localStorage.setItem(keyFor(effectiveOrgId), legacyRaw);
        localStorage.removeItem(LEGACY_KEY);
        const legacyParsed = JSON.parse(legacyRaw);
        return Array.isArray(legacyParsed) ? legacyParsed : [];
      }
      return [];
    }
    const parsed = JSON.parse(scopedRaw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(orgId: string, ids: string[]) {
  localStorage.setItem(keyFor(orgId), JSON.stringify(ids));
  window.dispatchEvent(new CustomEvent("byvaro:invitaciones-descartadas-changed", {
    detail: { orgId },
  }));
}

/** ¿La agencia descartó esta invitación? Si `orgId` no se pasa, lee
 *  del workspace logueado · útil para callers que ya están en
 *  contexto del current user. */
export function isInvitacionDescartada(invitationId: string, orgId?: string): boolean {
  return read(orgId).includes(invitationId);
}

/** Añade el id al set de descartadas. Idempotente. Scoped al
 *  workspace logueado salvo que se pase `orgId` explícito. */
export function descartarInvitacion(invitationId: string, orgId?: string): void {
  const effectiveOrgId = orgId ?? readCurrentOrgIdSync();
  if (!effectiveOrgId) return;
  const current = read(effectiveOrgId);
  if (current.includes(invitationId)) return;
  write(effectiveOrgId, [...current, invitationId]);
}

/** Hook reactivo · resuelve orgId del user actual y se re-renderiza
 *  al cambiar el set descartado. Útil en componentes que muestran
 *  lista filtrada (ej. PromocionDetalle agencias colaborando). */
export function useInvitacionesDescartadas(): Set<string> {
  const user = useCurrentUser();
  return getDescartadasSet(user);
}

/** Helper non-hook · para flujos imperativos. */
export function getDescartadasSet(user: CurrentUser): Set<string> {
  const { orgId } = currentOrgIdentity(user);
  return new Set(read(orgId));
}

/** Suscríbete a cambios · útil para que el banner se re-renderice. */
export function onInvitacionesDescartadasChanged(handler: () => void): () => void {
  const wrapped = () => handler();
  window.addEventListener("byvaro:invitaciones-descartadas-changed", wrapped);
  window.addEventListener("storage", wrapped);
  return () => {
    window.removeEventListener("byvaro:invitaciones-descartadas-changed", wrapped);
    window.removeEventListener("storage", wrapped);
  };
}
