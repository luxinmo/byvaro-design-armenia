/**
 * Mock dataset de PROMOTORES & COMERCIALIZADORES con los que el
 * workspace actual colabora EN ROL DE COMERCIALIZADOR.
 *
 * El modelo de Byvaro permite que un mismo workspace opere como
 * "promotor" en sus propias promociones (las que crea él) y como
 * "comercializador" en promociones de otros promotores que le han
 * delegado la venta. Esta lista representa esa SEGUNDA cara: con
 * quién comercializo cuando NO soy el dueño de la promoción.
 *
 * Mismos campos que `Agency` para reusar componentes de cards
 * (`AgenciasTabStats` GridView). Cuando aterrice el backend real:
 *
 *   GET /api/workspace/promotores
 *     → lista de organizaciones (kind: "developer" | "comercializador")
 *       con las que el workspace actual tiene una relación de
 *       comercialización activa o histórica.
 */

import type { Agency } from "./agencies";

/** Mock de promotores · misma shape que Agency para reuse de UI. */
export const promotores: Agency[] = [];

/* ─── DEPRECATED · `EXTERNAL_PROMOTOR_PORTFOLIO` ─────────────────
 *
 *  Antes existía un store paralelo con entries lite (`ExternalPortfolioEntry`)
 *  para que las fichas de promotores externos no salieran vacías. Hoy
 *  TODAS las promociones reales viven en `developerOnlyPromotions`
 *  con shape `DevPromotion` completo (ver entries `dev-aedas-1`,
 *  `dev-aedas-2`, `dev-neinor-1`, `dev-neinor-2`, `dev-habitat-1`,
 *  `dev-metrovacesa-1`, `dev-metrovacesa-2`).
 *
 *  El helper `getPromotionsByOwner(orgId)` en `src/lib/promotionsByOwner.ts`
 *  es la ÚNICA fuente · filtra `developerOnlyPromotions` por
 *  `ownerOrganizationId === orgId`.
 *
 *  Beneficio · IDs son clickables, las promos aparecen en el `/promociones`
 *  del owner cuando entra a su workspace, y no hay duplicados (Edificio
 *  Bilbao Alta solía aparecer 2 veces en la ficha de Neinor).
 *
 *  Backend · single SELECT desde `promotions WHERE owner_organization_id = $1`.
 * ────────────────────────────────────────────────────────────── */
