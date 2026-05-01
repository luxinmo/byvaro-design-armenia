/**
 * visibility.ts · helper canónico para filtrar listados según el
 * permiso `*.viewAll` / `*.viewOwn` del usuario actual.
 *
 * MODELO (ver `docs/permissions.md §1`)
 * ------
 *  · El admin tiene visibilidad TOTAL siempre (escudo en
 *    `useHasPermission`).
 *  · Si el rol tiene `<scope>.viewAll`, también ve todo.
 *  · Si solo tiene `<scope>.viewOwn`, ve únicamente los registros donde
 *    aparece como "owner" (depende de la entidad: `assignedTo`,
 *    `agentUserId`, `assigneeUserId`, `decidedByUserId`, etc.).
 *  · Si no tiene ninguno de los dos, NO ve nada · la pantalla debe
 *    renderizar `<NoAccessView />`.
 *
 * USO
 * ---
 *  const filter = useVisibilityFilter("sales", (s) =>
 *    resolveSaleUserId(s.agentName) ?? null
 *  );
 *  const visible = useMemo(() => sales.filter(filter), [sales, filter]);
 *
 * Para entidades con varios owners (`Contact.assignedTo: string[]`)
 * el callback puede devolver un array · el filtro acepta cualquier
 * intersección con el `userId` actual.
 *
 * TODO(backend) · cuando aterrice RLS server-side, este helper se
 * convierte en no-op a nivel UI · el backend ya devuelve solo lo que
 * el usuario puede ver. Mantener el componente como adaptador para
 * que el porting sea trivial.
 */

import { useCallback, useRef } from "react";
import { useCurrentUser } from "@/lib/currentUser";
import { useHasPermission, type PermissionKey } from "@/lib/permissions";

export type VisibilityScope =
  | "contacts"
  | "records"
  | "opportunities"
  | "sales"
  | "visits"
  | "documents"
  | "emails";

type OwnerIds = string | ReadonlyArray<string> | null | undefined;

/* Mapeo scope → keys. Aquí se concentra el conocimiento de qué
 * dominios usan qué permission keys · si añades un dominio nuevo
 * (`appointments.viewAll`...), lo declaras una vez aquí y todos los
 * consumers funcionan. */
const KEYS: Record<
  VisibilityScope,
  { viewAll: PermissionKey; viewOwn: PermissionKey }
> = {
  contacts:      { viewAll: "contacts.viewAll",      viewOwn: "contacts.viewOwn" },
  records:       { viewAll: "records.viewAll",       viewOwn: "records.viewOwn" },
  opportunities: { viewAll: "opportunities.viewAll", viewOwn: "opportunities.viewOwn" },
  sales:         { viewAll: "sales.viewAll",         viewOwn: "sales.viewOwn" },
  visits:        { viewAll: "visits.viewAll",        viewOwn: "visits.viewOwn" },
  documents:     { viewAll: "documents.viewAll",     viewOwn: "documents.viewOwn" },
  emails:        { viewAll: "emails.viewAll",        viewOwn: "emails.viewOwn" },
};

function ownerMatches(userId: string, owners: OwnerIds): boolean {
  if (!owners) return false;
  if (typeof owners === "string") return owners === userId;
  return owners.includes(userId);
}

/**
 * Devuelve un predicado para `Array.filter()` aplicado a una lista
 * de items del scope dado.
 *
 * @param scope · dominio (sales/contacts/...) · selecciona las keys
 *   `viewAll` / `viewOwn` del catálogo.
 * @param getOwnerIds · función que extrae el/los owner(s) de un item
 *   en formato TeamMember.id. Devolver `null/undefined` indica que el
 *   item no tiene owner · solo será visible con `viewAll`.
 *
 * El predicado es estable (`useCallback`) salvo que cambien userId o
 * los permisos del rol.
 */
export function useVisibilityFilter<T>(
  scope: VisibilityScope,
  getOwnerIds: (item: T) => OwnerIds,
): (item: T) => boolean {
  const user = useCurrentUser();
  const canViewAll = useHasPermission(KEYS[scope].viewAll);
  const canViewOwn = useHasPermission(KEYS[scope].viewOwn);

  /* Estabilizamos `getOwnerIds` vía ref · los callers normalmente
   * pasan una arrow inline (ej. `(r) => r.decidedByUserId ?? null`) y
   * no podemos exigir que la memoricen siempre. Si la metiéramos en
   * los deps, el predicado cambiaría cada render y los `useMemo`/
   * `useEffect` que lo consumen entrarían en bucle infinito (el
   * patrón clásico es `useState(scoped) + useEffect(setRecords(scoped))`
   * en `Registros.tsx`). */
  const getOwnerIdsRef = useRef(getOwnerIds);
  getOwnerIdsRef.current = getOwnerIds;

  return useCallback(
    (item: T) => {
      if (canViewAll) return true;
      if (!canViewOwn) return false;
      return ownerMatches(user.id, getOwnerIdsRef.current(item));
    },
    [canViewAll, canViewOwn, user.id],
  );
}

/**
 * Hook compañero · devuelve los flags de permisos para que el caller
 * decida cuándo renderizar `<NoAccessView />` (sin permiso ni de
 * `viewOwn`) o mostrar el listado vacío natural.
 */
export function useVisibilityState(scope: VisibilityScope): {
  canViewAll: boolean;
  canViewOwn: boolean;
  hasAccess: boolean;
} {
  const canViewAll = useHasPermission(KEYS[scope].viewAll);
  const canViewOwn = useHasPermission(KEYS[scope].viewOwn);
  return { canViewAll, canViewOwn, hasAccess: canViewAll || canViewOwn };
}
