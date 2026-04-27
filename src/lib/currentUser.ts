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

/** Construye un usuario sintético de agencia a partir del seed de agencies
 *  o de las agencias creadas vía /invite/:token (caso 1 · alta nueva).
 *
 *  Si `agencyEmail` apunta a un mockUser (seed) o a un usuario creado en
 *  localStorage, derivamos su rol (admin/member) y datos personales ·
 *  permite probar admin vs member dentro de la misma agencia. */
function buildAgencyUser(agencyId: string, agencyEmail?: string): CurrentUser {
  /* Resolver agencia · seed primero, luego storage local de creadas
   * (alta vía invitación). Solo si ninguna existe, caemos a la primera
   * del seed (compat). */
  let a = agencies.find((x) => x.id === agencyId);
  if (!a && typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem("byvaro.agencies.created.v1");
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          a = arr.find((x: { id: string }) => x.id === agencyId);
        }
      }
    } catch { /* noop */ }
  }
  if (!a) a = agencies[0];

  /* Resolver mockUser · seed primero, luego created users. */
  let mock = agencyEmail
    ? mockUsers.find(
        (u) => u.accountType === "agency"
          && u.agencyId === agencyId
          && u.email.toLowerCase() === agencyEmail.toLowerCase(),
      )
    : undefined;
  if (!mock && agencyEmail && typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem("byvaro.users.created.v1");
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          mock = arr.find(
            (u: { accountType: string; agencyId?: string; email: string }) =>
              u.accountType === "agency"
              && u.agencyId === agencyId
              && u.email.toLowerCase() === agencyEmail.toLowerCase(),
          );
        }
      }
    } catch { /* noop */ }
  }

  return {
    id: mock ? `u-agency-${a.id}-${mock.email}` : `u-agency-${a.id}`,
    /* Fallbacks neutros · NUNCA un nombre demo concreto · si no hay
     *  data, mostramos placeholders genéricos que el wizard de
     *  onboarding obligará a rellenar. */
    name: mock?.name ?? a.contactoPrincipal?.nombre ?? "Sin nombre",
    email: mock?.email ?? a.contactoPrincipal?.email ?? "",
    role: mock?.role ?? "admin",
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
  const { type, agencyId, developerEmail, agencyEmail } = useAccountType();
  /* Fachada legacy · delega en meStorage. Ver ADR-050 y `src/lib/meStorage.ts`.
   * Se sincroniza automáticamente con la lista de TEAM_MEMBERS — si un
   * admin edita al usuario actual desde `/equipo`, este hook se refresca. */
  const profile = usePersistedProfile();
  return useMemo(() => {
    if (type === "agency") return buildAgencyUser(agencyId, agencyEmail);
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
  }, [type, agencyId, developerEmail, agencyEmail, profile]);
}

export function isAdmin(user: CurrentUser): boolean {
  return user.role === "admin";
}

/** Identificador estable del workspace del usuario actual.
 *
 *  Usado para particionar stores que son "del workspace" (equipo,
 *  configuración interna, drafts) y que en el prototipo single-tenant
 *  vivían en una clave global de localStorage — fugando datos del
 *  promotor a las agencias y viceversa.
 *
 *  Mapping:
 *    · accountType="developer" → "developer-default" (un solo
 *      promotor en mock; en backend será `organization.id`).
 *    · accountType="agency"    → `agency-${agencyId}`.
 *
 *  Patrón canónico para keys: `${baseKey}:${currentWorkspaceKey(user)}`.
 *  Ver REGLA DE ORO "Datos del workspace son por tenant" en CLAUDE.md.
 */
export function currentWorkspaceKey(user: CurrentUser): string {
  if (user.accountType === "agency" && user.agencyId) {
    return `agency-${user.agencyId}`;
  }
  return "developer-default";
}
