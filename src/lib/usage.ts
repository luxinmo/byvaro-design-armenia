/**
 * usage.ts · Contadores de uso del workspace para el paywall (Fase 1).
 *
 * QUÉ
 * ----
 * Helpers puros + hook reactivo que cuentan el "consumo" actual del
 * workspace contra los `PLAN_LIMITS` definidos en `src/lib/plan.ts`.
 * Los contadores son la ENTRADA del `useUsageGuard()` que decide si
 * una acción se bloquea con el modal de upgrade.
 *
 * CÓMO
 * ----
 * Como Fase 1 vive en mocks (localStorage + seeds), los contadores
 * leen de los almacenes existentes:
 *
 *   · Promociones activas → `developerOnlyPromotions` filtradas por
 *     `status === "active"`. Cuando exista `createdPromotionsStorage`
 *     real (TODO backend), se sumará aquí.
 *   · Agencias invitadas  → `agencies` con `estadoColaboracion`
 *     definido (pendiente · activa · contrato-pendiente · pausada).
 *     Esa lista representa todas las agencias que el promotor
 *     gestiona como colaboradoras.
 *   · Registros           → `useCreatedRegistros` (en localStorage)
 *     + el seed `registros` agrupados (todos pertenecen al developer
 *     actual en el mock; en backend filtrará por `developerId`).
 *
 * Hook: `useUsageCounters()` se re-renderiza cuando cambian los
 * stores reactivos (registros · plan · etc).
 *
 * TODO(backend):
 *   GET /api/workspace/usage → { activePromotions, invitedAgencies, registros }
 *   El backend agrega contra `developerId` con multi-tenancy estricto.
 *   Los contadores se cachean 30s en server (no necesitan tiempo real).
 */

import { useEffect, useState } from "react";
import { developerOnlyPromotions } from "@/data/developerPromotions";
import { agencies as ALL_AGENCIES } from "@/data/agencies";
import { useCreatedRegistros } from "@/lib/registrosStorage";
import { registros as SEED_REGISTROS } from "@/data/records";
import { useCurrentUser } from "@/lib/currentUser";
import { currentOrgIdentity, useSentOrgCollabRequests } from "@/lib/orgCollabRequests";
import { getCollaboratingDeveloperIds } from "@/lib/developerNavigation";

/* ══════ Counters puros ═══════════════════════════════════════════ */

const DEFAULT_ORG = "developer-default";

/** Promociones activas del developer (no incluye borradores). Filtradas
 *  por `ownerOrganizationId === orgId` para multi-tenant correcto. */
export function countActivePromotions(orgId: string = DEFAULT_ORG): number {
  return developerOnlyPromotions
    .filter((p) => p.status === "active")
    .filter((p) => (p.ownerOrganizationId ?? DEFAULT_ORG) === orgId)
    .length;
}

/** Agencias que el promotor ha invitado o que están en su red.
 *  Cualquier `estadoColaboracion` definido cuenta · `pendiente`
 *  también, porque el promotor ya consumió una "ranura" al invitarla
 *  aunque la agencia todavía no haya respondido. Filtradas por
 *  colaboración con el `orgId` actual. */
export function countInvitedAgencies(orgId: string = DEFAULT_ORG): number {
  return ALL_AGENCIES
    .filter((a) => !!a.estadoColaboracion)
    .filter((a) => getCollaboratingDeveloperIds(a).has(orgId))
    .length;
}

/** Registros recibidos de AGENCIAS COLABORADORAS (acumulado · cualquier
 *  estado). Solo cuentan al paywall los `origen === "collaborator"`:
 *  walk-ins del promotor, portales (Idealista, Fotocasa…) y registros
 *  directos NO entran al cómputo · son leads del propio promotor.
 *  Filtrados por promoción del workspace actual.
 *  Ver `docs/portal-leads-integration.md`. */
export function countRegistros(
  createdRegistros: ReadonlyArray<{ origen: string; promotionId?: string }>,
  orgId: string = DEFAULT_ORG,
): number {
  const all = [...createdRegistros, ...SEED_REGISTROS];
  /* Set de promo ids del workspace para no recalcular por iteración. */
  const myPromoIds = new Set(
    developerOnlyPromotions
      .filter((p) => (p.ownerOrganizationId ?? DEFAULT_ORG) === orgId)
      .map((p) => p.id),
  );
  return all
    .filter((r) => r.origen === "collaborator")
    .filter((r) => !r.promotionId || myPromoIds.has(r.promotionId))
    .length;
}

/* ══════ Hook reactivo ════════════════════════════════════════════ */

export type UsageCounters = {
  activePromotions: number;
  invitedAgencies: number;
  registros: number;
  /** Solicitudes de colaboración enviadas por la agencia que aún no han
   *  sido aceptadas/rechazadas · cuentan contra el límite del plan
   *  agency_free (10 max). Una vez la otra parte responde
   *  (acepta/rechaza), el slot se libera. */
  collabRequests: number;
};

/**
 * React hook · devuelve los 3 contadores y se actualiza cuando cambian
 * los stores reactivos.
 *
 * En Fase 1 los contadores de promociones/agencias salen de seeds
 * (estables) — si vienen de localStorage en el futuro, este hook se
 * extiende con sus eventos.
 */
export function useUsageCounters(): UsageCounters {
  const created = useCreatedRegistros();
  const user = useCurrentUser();
  const orgId = currentOrgIdentity(user).orgId;
  /* Solicitudes pendientes enviadas por la org actual · usado para gate
   *  de plan agency_free (10 max). */
  const sentPending = useSentOrgCollabRequests(user, "pendiente");
  const [counters, setCounters] = useState<UsageCounters>(() => ({
    activePromotions: countActivePromotions(orgId),
    invitedAgencies: countInvitedAgencies(orgId),
    registros: countRegistros(created, orgId),
    collabRequests: 0,
  }));

  /* Re-derivar si la lista de registros creados, el orgId o las
   *  solicitudes enviadas cambian. */
  useEffect(() => {
    setCounters({
      activePromotions: countActivePromotions(orgId),
      invitedAgencies: countInvitedAgencies(orgId),
      registros: countRegistros(created, orgId),
      collabRequests: sentPending.length,
    });
  }, [created, orgId, sentPending.length]);

  return counters;
}
