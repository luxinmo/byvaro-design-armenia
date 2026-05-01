/**
 * userSettings.ts · Settings del usuario actual.
 *
 * Source of truth · `public.user_settings.data` (JSONB · 1 fila por
 * usuario). El localStorage cache (`byvaro.userSettings.v1::<userId>`)
 * solo existe para que `useUserSetting()` sea síncrono · NO es la
 * fuente de verdad.
 *
 * USO
 * ----
 * Las páginas `/ajustes/perfil/contacto.tsx`, `/ajustes/idioma-region/*`,
 * `/ajustes/notificaciones/resumen.tsx`, etc. guardan sus prefs aquí
 * con una clave dot-namespaced:
 *
 *   const [phones, setPhones] = useUserSetting("phones", []);
 *   setPhones([{ label: "Móvil", value: "..." }]);
 *
 * Cada save hace UPSERT del JSONB completo (read-modify-write).
 *
 * REGLAS
 * ------
 *  · NO usar para datos compartidos por workspace · esos van a
 *    `orgSettings.ts` · `public.org_settings`.
 *  · NO usar para datos de negocio (contactos, leads, ventas) · esos
 *    tienen tablas dedicadas.
 */

import { useEffect, useState } from "react";

const KEY_PREFIX = "byvaro.userSettings.v1::";
const EVENT = "byvaro:user-settings-change";

function keyFor(userId: string): string { return `${KEY_PREFIX}${userId}`; }

/* ══════ Cache local · render-only ════════════════════════════════ */

type Settings = Record<string, unknown>;

function readCache(userId: string): Settings {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(keyFor(userId));
    if (!raw) return {};
    return JSON.parse(raw) as Settings;
  } catch { return {}; }
}

function writeCache(userId: string, data: Settings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(keyFor(userId), JSON.stringify(data));
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { userId } }));
}

/* ══════ Source of truth · Supabase ═══════════════════════════════ */

async function getCurrentUserId(): Promise<string | null> {
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return null;
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch { return null; }
}

export async function hydrateUserSettingsFromSupabase(): Promise<Settings | null> {
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return null;
    const userId = await getCurrentUserId();
    if (!userId) return null;
    const { data, error } = await supabase
      .from("user_settings")
      .select("data")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.warn("[userSettings:hydrate]", error.message);
      return null;
    }
    const settings = (data?.data ?? {}) as Settings;
    writeCache(userId, settings);
    return settings;
  } catch (e) {
    console.warn("[userSettings:hydrate] skipped:", e);
    return null;
  }
}

/* ══════ API pública ══════════════════════════════════════════════ */

/** Lee una setting puntual · sync · safe-server.
 *  Si la clave no existe devuelve `defaultValue`. */
export function getUserSetting<T = unknown>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") return defaultValue;
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith(KEY_PREFIX)) {
      const data = readCache(k.slice(KEY_PREFIX.length));
      if (key in data) return data[key] as T;
    }
  }
  return defaultValue;
}

/** Escribe una setting · write-through (Supabase upsert + cache).
 *  Internamente hace read-modify-write para no pisar otras claves. */
export function setUserSetting<T = unknown>(key: string, value: T): void {
  if (typeof window === "undefined") return;

  void (async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
      if (!isSupabaseConfigured) return;
      const userId = await getCurrentUserId();
      if (!userId) return;

      const current = readCache(userId);
      const next = { ...current, [key]: value };
      writeCache(userId, next);

      const { error } = await supabase
        .from("user_settings")
        .upsert({
          user_id: userId,
          data: next,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      if (error) console.warn("[userSettings:set]", error.message);
    } catch (e) {
      console.warn("[userSettings:set] skipped:", e);
    }
  })();
}

/** Borra una setting · útil para reset. */
export function clearUserSetting(key: string): void {
  if (typeof window === "undefined") return;
  void (async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
      if (!isSupabaseConfigured) return;
      const userId = await getCurrentUserId();
      if (!userId) return;
      const current = readCache(userId);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [key]: _, ...rest } = current;
      writeCache(userId, rest);
      const { error } = await supabase
        .from("user_settings")
        .upsert({
          user_id: userId,
          data: rest,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
      if (error) console.warn("[userSettings:clear]", error.message);
    } catch (e) {
      console.warn("[userSettings:clear] skipped:", e);
    }
  })();
}

/** Hook · estado reactivo de una setting. Drop-in para `useState`. */
export function useUserSetting<T = unknown>(
  key: string,
  defaultValue: T,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => getUserSetting<T>(key, defaultValue));

  useEffect(() => {
    /* Hidratación lazy en mount · idempotente. */
    void hydrateUserSettingsFromSupabase().then((fresh) => {
      if (fresh && key in fresh) setValue(fresh[key] as T);
    });
    const handler = () => setValue(getUserSetting<T>(key, defaultValue));
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = (next: T) => {
    setValue(next);
    setUserSetting(key, next);
  };

  return [value, update];
}
