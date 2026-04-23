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
import { usePersistedProfile } from "./profileStorage";

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
  /** Datos editables desde `/ajustes/perfil/personal` (ver profileStorage.ts).
   *  Se sobreescriben sobre el mock base cuando el usuario los edita. */
  jobTitle?: string;
  bio?: string;
  avatar?: string;
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
  /* El perfil editable vive en localStorage (mock) y se fusiona sobre el
   * usuario base. Solo aplica a la cuenta "developer" — cuando el usuario
   * ha cambiado a "ver como agencia", la identidad la manda la agencia. */
  const profile = usePersistedProfile();
  return useMemo(() => {
    if (type === "agency") return buildAgencyUser(agencyId);
    return {
      ...DEVELOPER_USER,
      name:     profile?.fullName  ?? DEVELOPER_USER.name,
      email:    profile?.email     ?? DEVELOPER_USER.email,
      jobTitle: profile?.jobTitle,
      bio:      profile?.bio,
      avatar:   profile?.avatar,
    };
  }, [type, agencyId, profile]);
}

export function isAdmin(user: CurrentUser): boolean {
  return user.role === "admin";
}
