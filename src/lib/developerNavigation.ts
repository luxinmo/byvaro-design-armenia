/**
 * Navegación unificada hacia el promotor desde la cuenta de agencia.
 * Mirror de `agencyNavigation.ts`: aplica la REGLA DE ORO ficha vs panel,
 * pero invertida (ahora es la AGENCIA quien clica al PROMOTOR):
 *
 *   · Agencia con colaboración activa → PANEL operativo
 *     `/promotor/:id/panel` (mirror del que el promotor ve de la agencia
 *     en `/colaboradores/:id/panel`).
 *
 *   · Agencia SIN colaboración (pendiente, rechazada, marketplace, o
 *     cualquier otra promoción donde no es colaboradora) → FICHA PÚBLICA
 *     `/promotor/:id` (perfil público del promotor).
 *
 * En la maqueta single-tenant solo existe un promotor (Luxinmo). El
 * `id` es un sentinel `developer-default`. Cuando se modele la API
 * multi-tenant pasará a ser el `organization.id` del promotor real.
 */

import { agencies, type Agency } from "@/data/agencies";
import type { CurrentUser } from "./currentUser";
import { getPublicRef } from "./tenantRefResolver";

/** Id reservado del único promotor en mock single-tenant. */
export const DEFAULT_DEVELOPER_ID = "developer-default";

/** ¿La agencia logueada tiene colaboración (al menos una invitación
 *  o aceptación) con el promotor?
 *
 *  "Colaborar" en el sentido del producto = existe un vínculo entre las
 *  partes, no necesariamente una colaboración firmada y activa. Por eso
 *  contamos también `contrato-pendiente` (invitación abierta) y
 *  `pausada` (colaboración previa que puede reanudarse) — el panel
 *  avanzado debe estar disponible en todos esos estados, porque ya hay
 *  contexto operativo entre las dos empresas. La ficha pública solo es
 *  el "fallback" cuando no existe ningún vínculo. */
export function hasActiveDeveloperCollab(user: CurrentUser | null | undefined): boolean {
  if (!user || user.accountType !== "agency" || !user.agencyId) return false;
  const a: Agency | undefined = agencies.find((x) => x.id === user.agencyId);
  if (!a) return false;
  if (a.status === "active") return true;
  if (a.estadoColaboracion === "activa") return true;
  if (a.estadoColaboracion === "contrato-pendiente") return true;
  if (a.estadoColaboracion === "pausada") return true;
  return false;
}

/** Devuelve el href correcto para llegar al promotor desde la agencia.
 *  Si pasas `developerId`, se usa; si no, se asume el único promotor del
 *  workspace (`DEFAULT_DEVELOPER_ID`).
 *  `fromPromoId` (opcional) preserva el contexto de promoción en el
 *  panel — equivalente al `?from=` que usa `agencyHref`. */
export function developerHref(
  user: CurrentUser | null | undefined,
  opts?: { developerId?: string; fromPromoId?: string },
): string {
  const internalId = opts?.developerId ?? DEFAULT_DEVELOPER_ID;
  const ref = getPublicRef(internalId) || internalId;
  if (hasActiveDeveloperCollab(user)) {
    const base = `/promotor/${ref}/panel`;
    return opts?.fromPromoId ? `${base}?from=${opts.fromPromoId}` : base;
  }
  return `/promotor/${ref}`;
}
