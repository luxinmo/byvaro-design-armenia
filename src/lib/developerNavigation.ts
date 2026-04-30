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
import { promotions } from "@/data/promotions";
import { developerOnlyPromotions } from "@/data/developerPromotions";
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

/** Devuelve el set de IDs de developers/comercializadores con los que
 *  la agencia colabora · derivado de `Agency.promotionsCollaborating`
 *  cruzado contra `promotion.ownerOrganizationId`.
 *
 *  Una agencia "colabora con un developer" si tiene al menos una
 *  promoción de ese developer en su array `promotionsCollaborating`.
 *
 *  Caso típico mock: Anna (`ag-2`) tiene `["dev-1","dev-2","dev-3","dev-4"]`
 *  todas owned por `developer-default` → set = `{"developer-default"}`.
 *
 *  TODO(backend): cuando `agency_collaborations` exista en DB, esta
 *  función pasa a ser un `SELECT DISTINCT developer_organization_id
 *  FROM agency_collaborations WHERE agency_id = :id`. La signature se
 *  mantiene · solo cambia la implementación. */
export function getCollaboratingDeveloperIds(agency: Agency | null | undefined): Set<string> {
  const out = new Set<string>();
  if (!agency) return out;
  const allPromos = [...promotions, ...developerOnlyPromotions];
  for (const promId of agency.promotionsCollaborating ?? []) {
    const p = allPromos.find((x) => x.id === promId);
    const ownerId = p?.ownerOrganizationId;
    if (ownerId) out.add(ownerId);
  }
  return out;
}

/** ¿La agencia colabora específicamente con ESTE developer (por su id
 *  interno, no su `IDXXXXXX`)? Usado por el panel `/promotor/:id/panel`
 *  para decidir si mostrar la operativa o redirigir a la ficha pública. */
export function hasDeveloperCollab(
  user: CurrentUser | null | undefined,
  developerInternalId: string,
): boolean {
  if (!user || user.accountType !== "agency" || !user.agencyId) return false;
  const a = agencies.find((x) => x.id === user.agencyId);
  if (!a) return false;
  return getCollaboratingDeveloperIds(a).has(developerInternalId);
}

/** Mirror simétrico · ¿el developer logueado colabora con ESTA agencia?
 *  Es decir: ¿alguna promoción del developer está en
 *  `agency.promotionsCollaborating`?
 *
 *  Usado por el panel `/colaboradores/:id/panel` para que el lado
 *  developer aplique el mismo guard que el lado agencia.
 *
 *  Mock single-developer: Arman (Luxinmo) es dueño de todas las
 *  promociones de los seeds, así que cualquier agencia con
 *  `promotionsCollaborating` no vacío matchea. AEDAS (`prom-1`,
 *  hipotético login futuro) solo matchearía agencias que colaboren
 *  en `aedas-1` / `aedas-2`. */
export function agencyCollabsWithDeveloper(
  agency: Agency | null | undefined,
  developerInternalId: string,
): boolean {
  if (!agency) return false;
  return getCollaboratingDeveloperIds(agency).has(developerInternalId);
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
  /* Decisión PER-DEVELOPER · solo si la agencia colabora con ESE
   *  developer concreto va al panel. Si no, ficha pública. Antes
   *  usábamos `hasActiveDeveloperCollab` global y eso colaba el
   *  panel para AEDAS/Neinor cuando Anna solo colabora con Luxinmo. */
  if (hasDeveloperCollab(user, internalId)) {
    const base = `/promotor/${ref}/panel`;
    return opts?.fromPromoId ? `${base}?from=${opts.fromPromoId}` : base;
  }
  return `/promotor/${ref}`;
}
