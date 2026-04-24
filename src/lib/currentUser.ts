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
import { mockUsers } from "@/data/mockUsers";
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
  /** Datos editables desde `/ajustes/perfil/personal` o desde `/equipo`
   *  (ver `src/lib/meStorage.ts`). Ambas pantallas comparten el mismo
   *  store — cualquier cambio se refleja en sidebar, emails, historial
   *  y dashboard del equipo en caliente. */
  jobTitle?: string;
  department?: string;
  languages?: string[];
  bio?: string;
  avatar?: string;
  phone?: string;
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

/** Construye un usuario developer a partir del MockUser logueado.
 *  Cuando `developerEmail` no coincide con ningún mock (o no existe),
 *  cae en DEVELOPER_USER (arman · admin) por compatibilidad. */
function buildDeveloperUser(developerEmail?: string): CurrentUser {
  if (!developerEmail) return DEVELOPER_USER;
  const mock = mockUsers.find(
    (u) => u.accountType === "developer"
        && u.email.toLowerCase() === developerEmail.toLowerCase(),
  );
  if (!mock) return DEVELOPER_USER;
  return {
    id: mock.teamMemberId ?? "u1",
    name: mock.name,
    email: mock.email,
    role: mock.role ?? "admin",
    organizationId: "org1",
    accountType: "developer",
  };
}

export function useCurrentUser(): CurrentUser {
  const { type, agencyId, developerEmail } = useAccountType();
  /* Fachada legacy · delega en meStorage. Ver ADR-050 y `src/lib/meStorage.ts`.
   * Se sincroniza automáticamente con la lista de TEAM_MEMBERS — si un
   * admin edita al usuario actual desde `/equipo`, este hook se refresca. */
  const profile = usePersistedProfile();
  return useMemo(() => {
    if (type === "agency") return buildAgencyUser(agencyId);
    const base = buildDeveloperUser(developerEmail);
    return {
      ...base,
      name:       profile?.fullName  ?? base.name,
      email:      profile?.email     ?? base.email,
      jobTitle:   profile?.jobTitle,
      department: profile?.department,
      languages:  profile?.languages,
      bio:        profile?.bio,
      avatar:     profile?.avatar,
      phone:      profile?.phone,
    };
  }, [type, agencyId, developerEmail, profile]);
}

export function isAdmin(user: CurrentUser): boolean {
  return user.role === "admin";
}
