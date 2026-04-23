/**
 * profileStorage.ts · Perfil del usuario actual (mock en localStorage).
 *
 * QUÉ
 * ----
 * Hasta que haya backend de auth, el perfil que edita el usuario en
 * `/ajustes/perfil/personal` se persiste aquí. El hook `useCurrentUser()`
 * lo lee y lo fusiona con el mock base de `currentUser.ts`, así que
 * editar el nombre/email/cargo en Ajustes se refleja inmediatamente en:
 *   · Sidebar (avatar + iniciales + nombre)
 *   · Historial de contactos (autor de eventos)
 *   · Firma de emails · etc.
 *
 * CÓMO
 * ----
 * Clave única en localStorage: `byvaro.user.profile.v1` (se mantiene el
 * mismo nombre que ya usaba `perfil/personal.tsx` para no perder datos).
 * Se dispara un `CustomEvent` al escribir para que los consumidores que
 * se monten en otras pestañas o rutas se refresquen en caliente.
 *
 * TODO(backend): sustituir por GET/PATCH /api/me y pasar a AuthProvider.
 */

import { useEffect, useState } from "react";

export type UserProfile = {
  /** Nombre completo (un único campo en todo el sistema — ver CLAUDE.md). */
  fullName: string;
  email: string;
  jobTitle?: string;
  bio?: string;
  /** Data URL (png/jpg) hasta que haya storage real. */
  avatar?: string;
};

const KEY = "byvaro.user.profile.v1";
const CHANGE_EVENT = "byvaro:profile-change";

/** Migración silenciosa del schema viejo `{firstName, lastName}`. */
function migrate(raw: unknown): Partial<UserProfile> | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!r.fullName && (r.firstName || r.lastName)) {
    r.fullName = [r.firstName, r.lastName].filter(Boolean).join(" ").trim();
    delete r.firstName;
    delete r.lastName;
  }
  return r as Partial<UserProfile>;
}

export function getStoredProfile(): Partial<UserProfile> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    return migrate(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveStoredProfile(p: Partial<UserProfile>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(p));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Hook reactivo: se re-renderiza cuando el perfil cambia (desde otra ruta o tab). */
export function usePersistedProfile(): Partial<UserProfile> | null {
  const [value, setValue] = useState<Partial<UserProfile> | null>(getStoredProfile);
  useEffect(() => {
    const cb = () => setValue(getStoredProfile());
    window.addEventListener(CHANGE_EVENT, cb);
    window.addEventListener("storage", cb);
    return () => {
      window.removeEventListener(CHANGE_EVENT, cb);
      window.removeEventListener("storage", cb);
    };
  }, []);
  return value;
}
