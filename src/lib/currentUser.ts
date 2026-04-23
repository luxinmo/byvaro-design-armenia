/**
 * currentUser.ts — Mock del usuario logueado.
 *
 * Hoy es estático (Arman Rahmanov, promotor admin) pero respeta el
 * `accountType` global: si el usuario activa el AccountSwitcher y se pone
 * "Ver como agencia", este hook devuelve un usuario sintético de agencia
 * con el `agencyId` seleccionado — el resto de la app se adapta sola.
 *
 * En producción vendrá de un AuthProvider que envuelva la app y lea el
 * JWT/cookie de sesión. Cualquier UI que necesite saber quién es o qué
 * puede hacer importa este helper — al portar al backend, solo cambia
 * la implementación de `useCurrentUser()`.
 */

import { useMemo } from "react";
import { agencies } from "@/data/agencies";
import { useAccountType, type AccountType } from "./accountType";

export type UserRole = "admin" | "member";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organizationId: string;
  /** "developer" = promotor · "agency" = agencia colaboradora (mock). */
  accountType: AccountType;
  /** Solo presente cuando accountType === "agency". */
  agencyId?: string;
  agencyName?: string;
};

const DEVELOPER_USER: CurrentUser = {
  id: "u1",
  name: "Arman Rahmanov",
  email: "arman@byvaro.com",
  role: "admin",
  organizationId: "org1",
  accountType: "developer",
};

/** Construye un usuario sintético de agencia a partir del seed de agencies. */
function buildAgencyUser(agencyId: string): CurrentUser {
  const a = agencies.find((x) => x.id === agencyId) ?? agencies[0];
  return {
    id: `u-agency-${a.id}`,
    name: a.contactoPrincipal?.nombre ?? "Laura Sánchez",
    email: a.contactoPrincipal?.email ?? "contacto@agencia.com",
    role: "admin",
    organizationId: `agency-${a.id}`,
    accountType: "agency",
    agencyId: a.id,
    agencyName: a.name,
  };
}

export function useCurrentUser(): CurrentUser {
  const { type, agencyId } = useAccountType();
  return useMemo(() => {
    if (type === "agency") return buildAgencyUser(agencyId);
    return DEVELOPER_USER;
  }, [type, agencyId]);
}

export function isAdmin(user: CurrentUser): boolean {
  return user.role === "admin";
}
