/**
 * accountType.ts · Tipo de cuenta del usuario actual (mock).
 *
 * QUÉ
 * ----
 * Byvaro tiene dos personas distintas en el frontend:
 *   - **developer** · promotor inmobiliario (crea promociones, aprueba registros).
 *   - **agency** · agencia colaboradora (registra clientes, navega promociones
 *     donde ha sido invitada o que cogió del marketplace).
 *
 * En producción esto viene del JWT/sesión. Aquí lo simulamos con localStorage
 * para que el usuario pueda alternar entre vistas durante la fase de diseño
 * y probar flujos como "registrar cliente desde agencia".
 *
 * CÓMO
 * ----
 * Un hook `useAccountType()` devuelve `{ type, agencyId }` y se re-renderiza
 * cuando el usuario cambia la vista desde el `AccountSwitcher`. Los mutadores
 * (`setAccountType`, `setAccountAgencyId`) persisten y emiten un evento
 * custom para que todas las pantallas montadas se re-rendericen en el acto.
 *
 * TODO(backend): sustituir por un AuthContext que lea claims reales. Las
 * pantallas no deben cambiar — solo `useCurrentUser()` y este helper.
 */

import { useEffect, useState } from "react";
import { memCache } from "./memCache";

export type AccountType = "developer" | "agency";

const STORAGE_KEY = "byvaro.accountType.v1";
const AGENCY_KEY = "byvaro.accountType.agencyId.v1";
/** Email del developer logueado · permite distinguir arman (admin) de
 *  laura (member) en el mock de `currentUser`. Solo tiene sentido
 *  cuando type === "developer". */
const DEVELOPER_EMAIL_KEY = "byvaro.accountType.developerEmail.v1";
/** Email del agency user logueado · permite distinguir admin/member
 *  dentro de la misma agencia (ej. laura@primeproperties admin vs
 *  tom@primeproperties member). Solo tiene sentido cuando type === "agency". */
const AGENCY_EMAIL_KEY = "byvaro.accountType.agencyEmail.v1";
/** organization_id real del workspace donde el user es member (viene
 *  de la query a organization_members tras login). Es la clave para
 *  que `useEmpresa()` cargue los datos REALES del workspace en
 *  Supabase · sin esto cae al fallback "developer-default" que NO
 *  existe en DB para users registrados via /register. */
const ORG_ID_KEY = "byvaro.accountType.organizationId.v1";
/** Nombre del user logueado · viene de auth.users.raw_user_meta_data.
 *  Usado por useCurrentUser para mostrar nombre real en sidebar/UI
 *  sin tener que llamar a Supabase en cada render. */
const USER_NAME_KEY = "byvaro.accountType.userName.v1";
const CHANGE_EVENT = "byvaro:account-change";

/** Agencia por defecto cuando el usuario activa modo agencia sin elegir una. */
export const DEFAULT_AGENCY_ID = "ag-1";

type Snapshot = {
  type: AccountType;
  agencyId: string;
  developerEmail?: string;
  agencyEmail?: string;
  /** organization_id real del workspace · se setea en login. */
  organizationId?: string;
  /** Nombre completo del user · se setea en login desde JWT metadata. */
  userName?: string;
};

/** sessionStorage vive por pestaña; así el usuario puede tener una pestaña como
 *  Promotor y otra como Agencia simultáneamente sin que se pisen. Al cerrar la
 *  pestaña se pierde el contexto — es lo correcto para un "modo demo". */
function read(): Snapshot {
  if (typeof window === "undefined") {
    return { type: "developer", agencyId: DEFAULT_AGENCY_ID };
  }
  const rawType = sessionStorage.getItem(STORAGE_KEY);
  const type: AccountType = rawType === "agency" ? "agency" : "developer";
  const agencyId = sessionStorage.getItem(AGENCY_KEY) ?? DEFAULT_AGENCY_ID;
  const developerEmail = sessionStorage.getItem(DEVELOPER_EMAIL_KEY) ?? undefined;
  const agencyEmail = sessionStorage.getItem(AGENCY_EMAIL_KEY) ?? undefined;
  const organizationId = sessionStorage.getItem(ORG_ID_KEY) ?? undefined;
  const userName = sessionStorage.getItem(USER_NAME_KEY) ?? undefined;
  return { type, agencyId, developerEmail, agencyEmail, organizationId, userName };
}

function emit() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function setAccountType(type: AccountType) {
  sessionStorage.setItem(STORAGE_KEY, type);
  emit();
}

/**
 * ¿Hay sesión activa? · usado por el `<RequireAuth>` gate del router.
 *
 * En mock · el "login" persiste solo el AccountType en sessionStorage.
 * Si no hay accountType en sessionStorage, la sesión no existe y se
 * fuerza redirect a /login.
 *
 * TODO(backend): sustituir por verificación de cookie httpOnly o JWT
 * + endpoint `GET /api/auth/me` que devuelva 401 si no hay sesión.
 * El cliente no debe inferir auth desde sessionStorage en producción.
 */
export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(STORAGE_KEY) !== null;
}

export function setAccountAgencyId(id: string) {
  sessionStorage.setItem(AGENCY_KEY, id);
  emit();
}

/** Login mock: setea los valores de golpe y emite UNA sola vez.
 *  - Para developer, `emailOrAgencyId` es el email del mock user logueado
 *    (ej. "laura@byvaro.com") · se usa para resolver rol y id reales en
 *    `useCurrentUser`.
 *  - Para agency, es el agencyId de la agencia logueada.
 *  - `agencyEmail` (opcional) · email del usuario concreto dentro de la
 *    agencia, para resolver admin/member. Si no se pasa, asume admin. */
export function loginAs(
  type: AccountType,
  emailOrAgencyId?: string,
  agencyEmail?: string,
  /** organization_id real del workspace · debe pasarse desde Login.tsx
   *  tras query a organization_members. Si no se pasa, useEmpresa cae
   *  al fallback "developer-default" que NO existe en DB para users
   *  registrados via /register. */
  organizationId?: string,
  /** Nombre completo del user · pasarlo desde authData.user.user_metadata.name
   *  para que el sidebar/UI lo muestre sin tener que llamar a Supabase
   *  en cada render. */
  userName?: string,
) {
  sessionStorage.setItem(STORAGE_KEY, type);
  // Limpia cualquier identidad previa del otro rol para que no se mezclen.
  if (type === "agency") {
    sessionStorage.removeItem(DEVELOPER_EMAIL_KEY);
    if (emailOrAgencyId) sessionStorage.setItem(AGENCY_KEY, emailOrAgencyId);
    if (agencyEmail) sessionStorage.setItem(AGENCY_EMAIL_KEY, agencyEmail);
    else sessionStorage.removeItem(AGENCY_EMAIL_KEY);
  } else {
    // developer
    sessionStorage.removeItem(AGENCY_KEY);
    sessionStorage.removeItem(AGENCY_EMAIL_KEY);
    if (emailOrAgencyId) sessionStorage.setItem(DEVELOPER_EMAIL_KEY, emailOrAgencyId);
    else sessionStorage.removeItem(DEVELOPER_EMAIL_KEY);
  }
  if (organizationId) sessionStorage.setItem(ORG_ID_KEY, organizationId);
  else sessionStorage.removeItem(ORG_ID_KEY);
  if (userName) sessionStorage.setItem(USER_NAME_KEY, userName);
  else sessionStorage.removeItem(USER_NAME_KEY);
  emit();
}

/** Limpia la sesión · equivale a logout.
 *  Borra el perfil editable del usuario, los teléfonos, y cierra
 *  sesión en Supabase Auth. Para que al entrar como otro usuario no
 *  se hereden datos. */
export async function logout() {
  sessionStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(AGENCY_KEY);
  sessionStorage.removeItem(DEVELOPER_EMAIL_KEY);
  sessionStorage.removeItem(AGENCY_EMAIL_KEY);
  if (typeof window !== "undefined") {
    memCache.removeItem("byvaro.user.profile.v1");
    memCache.removeItem("byvaro.user.phones.v1");
    window.dispatchEvent(new Event("byvaro:profile-change"));
    /* Lazy-import para evitar ciclo · supabaseClient depende de env.
     * `signOut()` invalida la sesión + limpia su storage propio
     * (`byvaro.supabase.auth.v1`). */
    try {
      const { supabase } = await import("./supabaseClient");
      await supabase.auth.signOut();
    } catch { /* Sin Supabase configurado · skip. */ }
  }
  emit();
}

/** Hook reactivo · escucha el evento de cambio para actualizar todas las vistas. */
export function useAccountType(): Snapshot {
  const [snapshot, setSnapshot] = useState<Snapshot>(read);
  useEffect(() => {
    const cb = () => setSnapshot(read());
    window.addEventListener(CHANGE_EVENT, cb);
    // También reaccionamos a cambios en otras pestañas (storage event).
    window.addEventListener("storage", cb);
    return () => {
      window.removeEventListener(CHANGE_EVENT, cb);
      window.removeEventListener("storage", cb);
    };
  }, []);
  return snapshot;
}

/** Lectores sincrónicos para código no-React (filtros en datasets, etc.). */
export function readAccountType(): Snapshot {
  return read();
}
