/**
 * agencyScope.ts — Helpers para filtrar listas por pertenencia a una
 * agencia. Único punto canónico para decidir "¿este item le corresponde
 * a Laura viendo el panel como agencia?".
 *
 * Uso típico:
 *
 *   const { isAgencyUser, agencyId } = useRoleScope();
 *   const visible = useMemo(
 *     () => (isAgencyUser ? items.filter((x) => x.agencyId === agencyId) : items),
 *     [items, isAgencyUser, agencyId],
 *   );
 *
 * Cuando llegue el backend: esto se reemplaza por las queries que ya
 * devuelven registros filtrados por JWT claims (ver
 * `docs/permissions.md` §4 / RLS).
 */

import { useCurrentUser } from "./currentUser";

export function useRoleScope() {
  const user = useCurrentUser();
  return {
    isAgencyUser: user.accountType === "agency",
    agencyId: user.agencyId,
    userId: user.id,
  };
}

/** Predicado genérico: true si el item pertenece a la agencia actual.
 *  Acepta shape con `agencyId` o `requestingAgencyId`. */
export function matchesAgency<T extends { agencyId?: string | null; requestingAgencyId?: string | null }>(
  item: T,
  agencyId: string | undefined,
): boolean {
  if (!agencyId) return false;
  return item.agencyId === agencyId || item.requestingAgencyId === agencyId;
}
