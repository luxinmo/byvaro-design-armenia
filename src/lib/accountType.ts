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

export type AccountType = "developer" | "agency";

const STORAGE_KEY = "byvaro.accountType.v1";
const AGENCY_KEY = "byvaro.accountType.agencyId.v1";
const CHANGE_EVENT = "byvaro:account-change";

/** Agencia por defecto cuando el usuario activa modo agencia sin elegir una. */
export const DEFAULT_AGENCY_ID = "ag-1";

type Snapshot = { type: AccountType; agencyId: string };

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
  return { type, agencyId };
}

function emit() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function setAccountType(type: AccountType) {
  sessionStorage.setItem(STORAGE_KEY, type);
  emit();
}

export function setAccountAgencyId(id: string) {
  sessionStorage.setItem(AGENCY_KEY, id);
  emit();
}

/** Login mock: setea ambos valores de golpe y emite UNA sola vez. */
export function loginAs(type: AccountType, agencyId?: string) {
  sessionStorage.setItem(STORAGE_KEY, type);
  if (type === "agency" && agencyId) {
    sessionStorage.setItem(AGENCY_KEY, agencyId);
  }
  emit();
}

/** Limpia la sesión · equivale a logout. */
export function logout() {
  sessionStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(AGENCY_KEY);
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
