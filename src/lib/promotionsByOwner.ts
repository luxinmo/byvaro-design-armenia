/**
 * promotionsByOwner.ts · helper canónico para resolver el portfolio
 * de promociones de un workspace concreto.
 *
 * REGLA BACKEND (consensuada con producto · 2026-04-29):
 *   Toda promoción tiene un único dueño (`Promotion.ownerOrganizationId`)
 *   que es el `id` del workspace que la creó. Es la columna de
 *   aislamiento multi-tenant · NUNCA se mezclan promociones de
 *   workspaces distintos sin pasar por este helper.
 *
 * Estructura SQL equivalente:
 *   SELECT * FROM promotions WHERE owner_organization_id = :orgId
 *
 * El frontend NO debe leer `promotions`/`developerOnlyPromotions`/
 * `EXTERNAL_PROMOTOR_PORTFOLIO` directamente desde un componente que
 * pinta data per-tenant · usa este helper para que el filtro sea
 * explícito y trazable.
 *
 * Mock single-tenant (estado actual):
 *   · "developer-default" → promociones de Luxinmo (`promotions.ts` +
 *     `developerOnlyPromotions.ts`).
 *   · "prom-1", "prom-2"…  → mocks de portfolio para promotores
 *     externos (`EXTERNAL_PROMOTOR_PORTFOLIO`).
 *
 * Cuando aterrice backend:
 *   - Una sola tabla `promotions` con `owner_organization_id NOT NULL`.
 *   - Endpoint `GET /api/promotor/:id/portfolio` filtra por owner.
 *   - Estos helpers se sustituyen por un fetch · la signature
 *     `(orgId) → PortfolioItem[]` se mantiene para no romper consumers.
 */

import { promotions, type Promotion } from "@/data/promotions";
import { developerOnlyPromotions, type DevPromotion } from "@/data/developerPromotions";
import {
  EXTERNAL_PROMOTOR_PORTFOLIO,
  type ExternalPortfolioEntry,
} from "@/data/promotores";

/** ID canónico del único developer en el mock single-tenant. */
export const DEFAULT_DEVELOPER_ORG_ID = "developer-default";

/** Item del portfolio · union compatible con consumers del visual
 *  (PortfolioShowcase, cards, mapa). Todos los campos comunes
 *  existen en ambas variantes · usa solo esos al renderizar.
 *
 *  Campos garantizados por ambos:
 *    id · name · location · status? · badge? · image? · priceMin
 *    · priceMax · totalUnits · availableUnits · delivery? ·
 *    ownerOrganizationId.
 */
export type PortfolioItem = Promotion | DevPromotion | ExternalPortfolioEntry;

/** Devuelve todas las promociones cuyo `ownerOrganizationId === orgId`.
 *
 *  Nota: en el mock, los seeds antiguos pueden no tener el campo
 *  rellenado · se asume `developer-default` por compatibilidad.
 *  El backend escribirá el campo en TODAS las filas, eliminando este
 *  fallback.
 */
export function getPromotionsByOwner(orgId: string): PortfolioItem[] {
  if (orgId === DEFAULT_DEVELOPER_ORG_ID) {
    return [...promotions, ...developerOnlyPromotions].filter(
      (p) => (p.ownerOrganizationId ?? DEFAULT_DEVELOPER_ORG_ID) === orgId,
    );
  }
  return EXTERNAL_PROMOTOR_PORTFOLIO[orgId] ?? [];
}

/** Conveniencia · solo activas / incompletas (no sold-out, no
 *  inactive). Pensado para la PortfolioShowcase de la ficha pública. */
export function getActivePromotionsByOwner(orgId: string): PortfolioItem[] {
  return getPromotionsByOwner(orgId).filter(
    (p) => !p.status || p.status === "active" || p.status === "incomplete",
  );
}

/** Resuelve el `ownerOrganizationId` desde un `tenantId` de UI.
 *  - `undefined`            → "developer-default" (own ficha del workspace).
 *  - "developer-default"    → "developer-default".
 *  - "prom-X"               → "prom-X".
 *  - "ag-X" o cualquier otro → tal cual (agencias no tienen portfolio
 *    en el mock pero la signature se mantiene). */
export function tenantIdToOwnerOrgId(tenantId?: string): string {
  if (!tenantId) return DEFAULT_DEVELOPER_ORG_ID;
  return tenantId;
}
