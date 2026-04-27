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
 * Storage · `byvaro.invitaciones.descartadas.v1` (ids de invitaciones
 * descartadas, sin scope por agencia · single-tenant mock). En backend
 * real, mover a tabla `agency_invitation_dismissals(agency_id,
 * invitation_id, dismissed_at)`.
 */

const STORAGE_KEY = "byvaro.invitaciones.descartadas.v1";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  window.dispatchEvent(new CustomEvent("byvaro:invitaciones-descartadas-changed"));
}

/** ¿La agencia descartó esta invitación? */
export function isInvitacionDescartada(invitationId: string): boolean {
  return read().includes(invitationId);
}

/** Añade el id al set de descartadas. Idempotente. */
export function descartarInvitacion(invitationId: string): void {
  const current = read();
  if (current.includes(invitationId)) return;
  write([...current, invitationId]);
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
