/**
 * agencyMetrics.ts · cómputo de las 5 métricas de la card de agencia.
 *
 * REGLA DE ORO · semántica fija (consensuada con producto · 2026-04-29):
 *   1. Visitas        → visitas REALIZADAS (status=done + outcome=completed).
 *   2. Registros      → registros APROBADOS (estado="aprobado").
 *   3. Ventas         → ventas INICIADAS (cualquier estado salvo "caida").
 *   4. Conversión     → (ventas iniciadas / registros aprobados) × 100.
 *   5. Unidades       → suma de `availableUnits` de las promociones
 *                       que la agencia colabora con el promotor (no
 *                       suma `totalUnits` · solo lo disponible hoy).
 *
 * Para el lado AGENCIA (vista `/promotores`) la métrica es simétrica ·
 * lo que la agencia tiene con ESE promotor.
 *
 * TODO(backend): este cómputo cliente desaparece cuando exista
 *   `GET /api/agencias/:id/card-metrics` · devuelve el mismo shape
 *   `AgencyCardMetrics`. Mientras tanto, este helper deriva del seed
 *   global (`registros`, `sales`, `calendarEvents`, `promotions`,
 *   `developerOnlyPromotions`).
 */

import { agencies, type Agency } from "@/data/agencies";
import { registros as seedRegistros } from "@/data/records";
import { sales } from "@/data/sales";
import { calendarEvents } from "@/data/calendarEvents";
import { promotions } from "@/data/promotions";
import { developerOnlyPromotions } from "@/data/developerPromotions";
import { getActivePromotionsByOwner } from "./promotionsByOwner";

export interface AgencyCardMetrics {
  visitasRealizadas: number;
  registrosAprobados: number;
  ventasIniciadas: number;
  /** % entero · 0-100. */
  conversion: number;
  /** Suma de `availableUnits` de promociones compartidas. */
  unidadesCompartidas: number;
}

/** Visitas atribuibles a una agencia · seguimos el link
 *  `calendarEvent.registroId → registro.agencyId` o
 *  `calendarEvent.leadId → lead.agencyId`. Si una visita no tiene
 *  esos vínculos, no se cuenta para ninguna agencia. Solo se cuentan
 *  las que están `status="done"` Y tienen `evaluation.outcome="completed"`
 *  (regla canónica · una visita en done sin evaluation es tarea
 *  pendiente, no realizada). */
function countVisitasRealizadas(agencyId: string): number {
  /* Indexamos registros por id → agencyId para resolución O(1). */
  const registroAgency: Record<string, string | undefined> = {};
  for (const r of seedRegistros) {
    if (r.agencyId) registroAgency[r.id] = r.agencyId;
  }
  let count = 0;
  for (const ev of calendarEvents) {
    if (ev.type !== "visit") continue;
    if (ev.status !== "done") continue;
    if (ev.evaluation?.outcome !== "completed") continue;
    /* Atribución · prioridad registroId → agencyId. */
    if (ev.registroId && registroAgency[ev.registroId] === agencyId) {
      count++;
      continue;
    }
    /* TODO(backend): si en el futuro `lead.agencyId` se persiste,
     *  se añade el branch leadId aquí. Hoy `leads.ts` mock no expone
     *  `agencyId` directo · se omite. */
  }
  return count;
}

function countRegistrosAprobados(agencyId: string): number {
  return seedRegistros.filter((r) => r.agencyId === agencyId && r.estado === "aprobado").length;
}

function countVentasIniciadas(agencyId: string): number {
  return sales.filter((s) => s.agencyId === agencyId && s.estado !== "caida").length;
}

function sumUnidadesCompartidas(promotionIds: string[]): number {
  if (!promotionIds.length) return 0;
  const pool = [...promotions, ...developerOnlyPromotions];
  let total = 0;
  for (const id of promotionIds) {
    const p = pool.find((x) => x.id === id);
    if (p) total += p.availableUnits ?? 0;
  }
  return total;
}

/** Punto de entrada principal · devuelve las 5 métricas listas para
 *  pintar en la card. Si la agencia no existe, devuelve ceros. */
export function getAgencyCardMetrics(a: Agency): AgencyCardMetrics {
  const visitasRealizadas = countVisitasRealizadas(a.id);
  const registrosAprobados = countRegistrosAprobados(a.id);
  const ventasIniciadas = countVentasIniciadas(a.id);
  const conversion = registrosAprobados > 0
    ? Math.round((ventasIniciadas / registrosAprobados) * 100)
    : 0;
  const unidadesCompartidas = sumUnidadesCompartidas(a.promotionsCollaborating ?? []);
  return {
    visitasRealizadas,
    registrosAprobados,
    ventasIniciadas,
    conversion,
    unidadesCompartidas,
  };
}

/** Variante por id · útil para componentes que solo tienen el id. */
export function getAgencyCardMetricsById(agencyId: string): AgencyCardMetrics | null {
  const a = agencies.find((x) => x.id === agencyId);
  return a ? getAgencyCardMetrics(a) : null;
}

/* ═══════════════════════════════════════════════════════════════════
   Portfolio metrics · Cartera · Colaboraciones · Volumen · Promociones
   ═══════════════════════════════════════════════════════════════════

   Métricas "patrimoniales" de la card · responden a "qué tiene esta
   empresa, no qué nos une a ella":

     · Cartera         → unidades disponibles en sus colaboraciones.
     · Colaboraciones  → nº de promociones activas donde colabora.
     · Volumen         → suma de cartera × precio medio (en €).
     · Promociones     → solo si la empresa es Promotor · nº de
                         promociones propias activas.

   La 4ª métrica se omite si la entidad NO tiene categoría `promotor`.
*/

export interface AgencyPortfolioMetrics {
  cartera: number;          // unidades disponibles en colaboraciones
  colaboraciones: number;   // nº de promociones colaboradas activas
  volumen: number;          // €
  /** Solo presente si la entidad es Promotor (categories incluye "promotor"). */
  promociones?: number;
}

export function getAgencyPortfolioMetrics(
  a: Agency,
  options?: { isPromotor?: boolean },
): AgencyPortfolioMetrics {
  const pool = [...promotions, ...developerOnlyPromotions];
  const ids = a.promotionsCollaborating ?? [];
  let cartera = 0;
  let colaboraciones = 0;
  let volumen = 0;
  for (const id of ids) {
    const p = pool.find((x) => x.id === id);
    if (!p) continue;
    if (p.status !== "active") continue;
    colaboraciones += 1;
    const available = p.availableUnits ?? 0;
    cartera += available;
    const avg = ((p.priceMin ?? 0) + (p.priceMax ?? 0)) / 2;
    volumen += available * avg;
  }
  const result: AgencyPortfolioMetrics = { cartera, colaboraciones, volumen };
  if (options?.isPromotor) {
    /* Promociones propias activas · en mock single-tenant esto solo
     *  aplica al developer (Luxinmo) · todas las promociones del
     *  catálogo son suyas. Cuando una agencia con pack publique sus
     *  propias promos, el filtrado pasa a ser por owner_id. */
    result.promociones = pool.filter((p) => p.status === "active").length;
  }
  return result;
}

/* ═══════════════════════════════════════════════════════════════════
   Organization portfolio metrics · UNIFIED helper (canónico)

   Cualquier card o vista que necesite "qué tiene esta organización"
   debe pasar SIEMPRE por aquí · NO leer `agency.promotionsCollaborating`
   ni `agency.totalPromotionsAvailable` directamente. Esos campos son
   seed-only · cuando el backend aterrice desaparecen.

   Backend equivalent · `GET /organizations/:id/portfolio-metrics`
   devolverá EXACTAMENTE este shape · doc canónico
   `docs/backend-dual-role-architecture.md §7.1` (a añadir).

   Resolución del orgId:
     · "developer-default"     → workspace developer (Luxinmo) · métricas
        del lado developer (sus propias promociones, sin "colaborando").
     · "ag-*"                  → Agency · cuántas colaboraciones tiene
        con developers/comercializadores.
     · "prom-*"                → promotor externo · sus propias promos.

   TODO(backend): GET /organizations/:id/portfolio-metrics →
   { portfolioUnits, collaborationsCount, totalVolume, promotionsCount,
     collaborationDenominator }.
   ═══════════════════════════════════════════════════════════════════ */
export interface OrganizationPortfolioMetrics {
  /** Unidades disponibles agregadas en las colaboraciones de la org.
   *  Para una agencia · suma de `availableUnits` de promociones donde
   *  colabora. Para un developer · 0 (no colabora con otros). */
  portfolioUnits: number;
  /** Nº de promociones activas donde la org participa como colaborador
   *  (agency-side). Para developer · 0. Backend: count(*) sobre
   *  `promotion_collaborations WHERE agency_organization_id = orgId
   *  AND status = 'active'`. */
  collaborationsCount: number;
  /** Volumen € agregado de la cartera (availableUnits × precio medio). */
  totalVolume: number;
  /** Nº de promociones propias ACTIVAS de la org. Backend: count(*)
   *  sobre `promotions WHERE owner_organization_id = orgId AND
   *  status = 'active'`. */
  promotionsCount: number;
  /** "Y" del marker "Colaborador X/Y". Total de promociones que la
   *  org PODRÍA estar comercializando dentro de su red activa
   *  (ej. todas las del developer con quien colabora). Solo relevante
   *  agency-side; para developer-side queda 0. Backend: derived. */
  collaborationDenominator: number;
}

const ZERO_PORTFOLIO_METRICS: OrganizationPortfolioMetrics = {
  portfolioUnits: 0,
  collaborationsCount: 0,
  totalVolume: 0,
  promotionsCount: 0,
  collaborationDenominator: 0,
};

/** Helper canónico · resuelve métricas de una organización por id.
 *  AgencyGridCard y demás consumers deben llamar SOLO a este helper
 *  · no acceder a campos del seed `agencies.ts` ni
 *  `EXTERNAL_PROMOTOR_PORTFOLIO` directamente.
 *
 *  TODO(backend): reemplazar por fetch a
 *  `GET /organizations/:id/portfolio-metrics`. Mantener firma. */
export function getOrganizationPortfolioMetrics(
  orgId: string,
): OrganizationPortfolioMetrics {
  if (!orgId) return ZERO_PORTFOLIO_METRICS;

  const pool = [...promotions, ...developerOnlyPromotions];

  /* Caso 1 · developer-default · workspace propio del promotor.
   *  Solo count de sus promociones activas; no colabora con nadie. */
  if (orgId === "developer-default" || orgId.startsWith("developer-")) {
    return {
      ...ZERO_PORTFOLIO_METRICS,
      promotionsCount: pool.filter((p) => p.status === "active").length,
    };
  }

  /* Caso 2 · promotor externo (`prom-*`) · usa portfolio mock
   *  (EXTERNAL_PROMOTOR_PORTFOLIO). Solo count de sus promos activas. */
  if (orgId.startsWith("prom-")) {
    return {
      ...ZERO_PORTFOLIO_METRICS,
      promotionsCount: getActivePromotionsByOwner(orgId).length,
    };
  }

  /* Caso 3 · agency · resuelve via Agency seed para encontrar las
   *  promociones donde colabora. Igual que `getAgencyPortfolioMetrics`
   *  pero envuelto bajo este shape unificado. */
  const a = agencies.find((x) => x.id === orgId);
  if (!a) return ZERO_PORTFOLIO_METRICS;

  const ids = a.promotionsCollaborating ?? [];
  let portfolioUnits = 0;
  let collaborationsCount = 0;
  let totalVolume = 0;
  for (const id of ids) {
    const p = pool.find((x) => x.id === id);
    if (!p || p.status !== "active") continue;
    collaborationsCount += 1;
    const available = p.availableUnits ?? 0;
    portfolioUnits += available;
    const avg = ((p.priceMin ?? 0) + (p.priceMax ?? 0)) / 2;
    totalVolume += available * avg;
  }

  return {
    portfolioUnits,
    collaborationsCount,
    totalVolume,
    /* Una agencia con pack puede tener sus propias promociones · en
     *  el mock single-tenant las promociones son del developer y no se
     *  cuentan aquí. TODO(backend): count(*) sobre promotions con
     *  `owner_organization_id = orgId`. */
    promotionsCount: 0,
    collaborationDenominator: a.totalPromotionsAvailable ?? 0,
  };
}
