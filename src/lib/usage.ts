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

/* ══════ Counters puros ═══════════════════════════════════════════ */

/** Promociones activas del developer (no incluye borradores). */
export function countActivePromotions(): number {
  return developerOnlyPromotions.filter((p) => p.status === "active").length;
}

/** Agencias que el promotor ha invitado o que están en su red.
 *  Cualquier `estadoColaboracion` definido cuenta · `pendiente`
 *  también, porque el promotor ya consumió una "ranura" al invitarla
 *  aunque la agencia todavía no haya respondido. */
export function countInvitedAgencies(): number {
  return ALL_AGENCIES.filter((a) => !!a.estadoColaboracion).length;
}

/** Registros recibidos de AGENCIAS COLABORADORAS (acumulado · cualquier
 *  estado). Solo cuentan al paywall los `origen === "collaborator"`:
 *  walk-ins del promotor, portales (Idealista, Fotocasa…) y registros
 *  directos NO entran al cómputo · son leads del propio promotor.
 *  Ver `docs/portal-leads-integration.md`. */
export function countRegistros(createdRegistros: ReadonlyArray<{ origen: string }>): number {
  const all = [...createdRegistros, ...SEED_REGISTROS];
  return all.filter((r) => r.origen === "collaborator").length;
}

/* ══════ Hook reactivo ════════════════════════════════════════════ */

export type UsageCounters = {
  activePromotions: number;
  invitedAgencies: number;
  registros: number;
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
  const [counters, setCounters] = useState<UsageCounters>(() => ({
    activePromotions: countActivePromotions(),
    invitedAgencies: countInvitedAgencies(),
    registros: countRegistros(created),
  }));

  /* Re-derivar si la lista de registros creados cambia · es la única
   *  fuente reactiva en Fase 1 mock. */
  useEffect(() => {
    setCounters({
      activePromotions: countActivePromotions(),
      invitedAgencies: countInvitedAgencies(),
      registros: countRegistros(created),
    });
  }, [created]);

  return counters;
}
