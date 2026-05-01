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
 * Único almacén:
 *   · `promotions.ts` + `developerOnlyPromotions.ts` con
 *     `ownerOrganizationId` poblado en cada fila. Sin owner explícito
 *     se asume `developer-default` (Luxinmo legacy).
 *
 *  Histórico · existió un `EXTERNAL_PROMOTOR_PORTFOLIO` con entries
 *  lite para promotores externos. Migrado en 2026-05-01 · todo vive
 *  en `developerOnlyPromotions` con shape `DevPromotion` completo
 *  (clickeable, scopeable, único origen).
 *
 * Cuando aterrice backend:
 *   - Una sola tabla `promotions` con `owner_organization_id NOT NULL`.
 *   - Endpoint `GET /api/promotor/:id/portfolio` filtra por owner.
 *   - Estos helpers se sustituyen por un fetch · la signature
 *     `(orgId) → PortfolioItem[]` se mantiene para no romper consumers.
 */

import { promotions, type Promotion } from "@/data/promotions";
import { developerOnlyPromotions, type DevPromotion } from "@/data/developerPromotions";

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
export type PortfolioItem = Promotion | DevPromotion;

/** Devuelve todas las promociones cuyo `ownerOrganizationId === orgId`.
 *
 *  Une las dos fuentes legacy (`promotions.ts` + `developerOnlyPromotions.ts`)
 *  y filtra por `ownerOrganizationId === orgId`. Las filas sin owner
 *  explícito asumen `developer-default` (compatibilidad single-tenant
 *  histórica · el backend escribirá el campo en TODAS las filas y
 *  eliminará este fallback). */
export function getPromotionsByOwner(orgId: string): PortfolioItem[] {
  return [...promotions, ...developerOnlyPromotions].filter(
    (p) => (p.ownerOrganizationId ?? DEFAULT_DEVELOPER_ORG_ID) === orgId,
  );
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
