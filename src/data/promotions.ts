export type PromotionStatus = "active" | "incomplete" | "inactive" | "sold-out";
export type BuildingType = "plurifamiliar" | "unifamiliar-single" | "unifamiliar-multiple";

import type { ModoValidacionRegistro, RoleOption } from "@/components/crear-promocion/types";

export type Promotion = {
  id: string;
  code: string;
  name: string;
  location: string;
  priceMin: number;
  priceMax: number;
  availableUnits: number;
  totalUnits: number;
  status: PromotionStatus;
  reservationCost: number;
  delivery: string;
  commission: number;
  developer: string;
  agencies: number;
  agencyAvatars: string[];
  propertyTypes: string[];
  image?: string;
  badge?: "new" | "last-units";
  collaborating?: boolean;
  updatedAt: string;
  constructionProgress?: number;
  hasShowFlat?: boolean;
  buildingType?: BuildingType;
  /* `activity` ELIMINADO del tipo · era seed estático. La actividad
   *  real se computa en vivo desde registros + visitas + ventas via
   *  `usePromoActivity(promoId)` / `getPromoActivity()` en
   *  `src/lib/promoActivity.ts`. NUNCA volver a meter este campo
   *  como dato estático del seed. */
  /** Modo de validación · `directo` o `por_visita`. Si falta, asumir
   *  `por_visita` (alineado con la copy histórica del wizard que
   *  prometía preregistro tras visita). Ver `WizardState.modoValidacionRegistro`
   *  y `docs/registration-system.md §2`. */
  modoValidacionRegistro?: ModoValidacionRegistro;
  /** Rol del workspace dueño de esta promoción · "promotor" (construye)
   *  o "comercializador" (vende en exclusiva la obra de un tercero).
   *  Set en el wizard de creación · CLAUDE.md regla de oro. Si falta,
   *  asumir "promotor" para retrocompatibilidad con seeds antiguos.
   *  Toda copy en la UI ("Esperando decisión del promotor", "Aprobado
   *  por el promotor"…) DEBE leer este campo · usar el helper
   *  `getOwnerRoleLabel()` de `src/lib/promotionRole.ts`. */
  ownerRole?: RoleOption;

  /** ID del workspace (organization) dueño de la promoción.
   *
   *  **Backend**: mapea a `promotions.owner_organization_id`
   *  (FK NOT NULL a `organizations.id`). TODA query de promociones
   *  DEBE filtrar por este campo · es la columna de aislamiento
   *  multi-tenant. Sin este filtro hay fuga de datos cross-tenant.
   *
   *  **Mock single-tenant**:
   *    · `"developer-default"` → promociones de Luxinmo (workspace
   *      logueado) en `promotions.ts` + `developerOnlyPromotions.ts`.
   *    · `"prom-1"`, `"prom-2"`… → portfolios mock de promotores
   *      externos en `EXTERNAL_PROMOTOR_PORTFOLIO`.
   *
   *  Helper canónico para resolver portfolio per-tenant:
   *  `getPromotionsByOwner(orgId)` en `src/lib/promotionsByOwner.ts`.
   *  NUNCA leer `promotions` o `developerOnlyPromotions` directamente
   *  desde un componente que renderiza data per-tenant · usa el
   *  helper para que el filtro sea explícito y trazable.
   *
   *  Si falta (seeds legacy), tratar como `"developer-default"`. */
  ownerOrganizationId?: string;
};

export function getBuildingTypeLabel(type?: BuildingType): string | null {
  if (!type) return null;
  const map: Record<BuildingType, string> = {
    "plurifamiliar": "Edificio plurifamiliar",
    "unifamiliar-single": "Vivienda unifamiliar",
    "unifamiliar-multiple": "Viviendas unifamiliares",
  };
  return map[type] ?? null;
}

/** True si el tipo de edificación es unifamiliar (cualquier variante) ·
 *  útil para condicionales que decidan si mostrar/ocultar conceptos
 *  específicos de plurifamiliar como "bloques", "escaleras", etc. */
export function isUnifamiliar(type?: BuildingType): boolean {
  return type === "unifamiliar-single" || type === "unifamiliar-multiple";
}

/* RAW seeds · el campo `code` legacy queda como breadcrumb · el real
 * lo derivamos abajo con `seedRef("promotion", id)` siguiendo el
 * scheme canónico (PR + 5 dígitos · CLAUDE.md). */
const RAW_PROMOTIONS: Promotion[] = [];

import { seedRef } from "@/lib/publicRef";

/** Export final · `code` se sobrescribe con el formato canónico
 *  `PR + 5 dígitos` derivado del id via hash determinista. */
export const promotions: Promotion[] = RAW_PROMOTIONS.map((p) => ({
  ...p,
  code: seedRef("promotion", p.id),
}));