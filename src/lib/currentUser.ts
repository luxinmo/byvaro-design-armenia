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
import { memCache } from "./memCache";
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

/* Fallback NEUTRO · NUNCA un nombre/email demo concreto. Solo se
 *  usa si el SupabaseHydrator no ha resuelto la sesión real todavía.
 *  En cuanto llega `auth.getUser()`, el `useCurrentUser()` real lo
 *  reemplaza con los datos del JWT. */
const DEVELOPER_USER: CurrentUser = {
  id: "anonymous",
  name: "",
  email: "",
  role: "admin",
  organizationId: "",
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
   * (alta vía invitación). Si no existe en ningún sitio (caso post-
   * limpieza · seeds vacíos · agencia nueva sin hidratar todavía),
   * devolvemos un user "agency" sintético con el agencyId solo · sin
   * crashear cuando el render de UpgradeModal/SupabaseHydrator se
   * dispara antes de que la hidratación cargue las agencias. */
  let a = agencies.find((x) => x.id === agencyId);
  if (!a && typeof window !== "undefined") {
    try {
      const raw = memCache.getItem("byvaro.agencies.created.v1");
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          a = arr.find((x: { id: string }) => x.id === agencyId);
        }
      }
    } catch { /* noop */ }
  }
  if (!a) {
    /* Fallback defensivo · sin seed (agencies=[]) y sin agencias
     * creadas localmente · devolvemos un user con datos vacíos
     * "anonymous" para que la UI no crashee. La hidratación
     * posterior poblará el resto cuando llegue el JWT/profile. */
    return {
      id: `u-agency-${agencyId}`,
      name: "",
      email: agencyEmail ?? "",
      role: "admin",
      organizationId: `agency-${agencyId}`,
      accountType: "agency",
      agencyId,
      agencyName: "",
    };
  }

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
      const raw = memCache.getItem("byvaro.users.created.v1");
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

/** Construye un usuario developer.
 *
 *  Phase 2 (signup real) · usa los datos del sessionStorage que
 *  Login.tsx pobló desde Supabase Auth + organization_members:
 *    · developerEmail · email del JWT
 *    · organizationId · UUID real del workspace en DB
 *    · userName · raw_user_meta_data.name del JWT
 *
 *  Phase 1 (legacy con mockUsers) · si NO hay datos de signup real,
 *  cae al mock por email · solo para tests con cuentas demo. */
function buildDeveloperUser(
  developerEmail?: string,
  organizationId?: string,
  userName?: string,
): CurrentUser {
  if (!developerEmail) return DEVELOPER_USER;

  /* Si tenemos organizationId real (signup real vía /register), lo
   *  usamos · es la fuente de verdad. */
  if (organizationId) {
    return {
      id: developerEmail, // se reemplaza por user_profiles.user_id en hidratación
      name: userName ?? developerEmail.split("@")[0],
      email: developerEmail,
      role: "admin",
      organizationId,
      accountType: "developer",
      agencyId: undefined,
    };
  }

  /* Fallback legacy · busca en mockUsers (vacío en producción · solo
   *  útil si alguien añade demos de prueba). */
  const mock = mockUsers.find(
    (u) => u.accountType === "developer"
        && u.email.toLowerCase() === developerEmail.toLowerCase(),
  );
  if (!mock) {
    return {
      ...DEVELOPER_USER,
      email: developerEmail,
      name: userName ?? developerEmail.split("@")[0],
    };
  }
  return {
    id: mock.teamMemberId ?? "u1",
    name: mock.name,
    email: mock.email,
    role: mock.role ?? "admin",
    organizationId: mock.agencyId ?? "developer-default",
    accountType: "developer",
    agencyId: mock.agencyId,
  };
}

export function useCurrentUser(): CurrentUser {
  const { type, agencyId, developerEmail, agencyEmail, organizationId, userName } = useAccountType();
  /* Fachada legacy · delega en meStorage. Ver ADR-050 y `src/lib/meStorage.ts`.
   * Se sincroniza automáticamente con la lista de TEAM_MEMBERS — si un
   * admin edita al usuario actual desde `/equipo`, este hook se refresca. */
  const profile = usePersistedProfile();
  return useMemo(() => {
    if (type === "agency") return buildAgencyUser(agencyId, agencyEmail);
    const base = buildDeveloperUser(developerEmail, organizationId, userName);
    /* `usePersistedProfile()` lee la entrada `MY_ID="u1"` de meStorage ·
     *  hardcoded a Arman/Luxinmo. SOLO debemos aplicar el override cuando
     *  el usuario logueado realmente sea Arman (mismo email). Para
     *  developers no-Luxinmo (Carlos AEDAS, Marta Neinor, etc.) se
     *  mantienen los datos del mock para que sidebar/hero/headers
     *  reflejen la identidad correcta.
     *  TODO(backend): cuando llegue `GET /api/me` real, este guard se
     *  elimina · cada usuario tendrá su propio profile en backend. */
    const profileBelongsToUser = profile?.email
      && base.email
      && profile.email.toLowerCase() === base.email.toLowerCase();
    if (!profileBelongsToUser) return base;
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
  }, [type, agencyId, developerEmail, agencyEmail, organizationId, userName, profile]);
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
  /* Developer · si lleva `agencyId` (workspace externo prom-X), úsalo;
   *  Luxinmo legacy (sin agencyId) cae a `developer-default`. */
  if (user.accountType === "developer" && user.agencyId) {
    return user.agencyId;
  }
  return "developer-default";
}
