/**
 * orgSettings.ts · Settings del workspace (compartidas entre miembros).
 *
 * Source of truth · `public.org_settings.data` (JSONB · 1 fila por
 * organization). El localStorage cache (`byvaro.orgSettings.v1::<orgId>`)
 * solo existe para que `useOrgSetting()` sea síncrono · NO es la
 * fuente de verdad.
 *
 * USO
 * ----
 * Ajustes que NO son per-user sino per-workspace:
 *   · `/ajustes/empresa/oficinas` (oficinas defaults)
 *   · `/ajustes/empresa/verificacion` (estado verification)
 *   · `/ajustes/contactos/campos` (custom fields)
 *   · `/ajustes/contactos/lead-score` (config scoring)
 *   · `/ajustes/promociones/validez` (validity defaults)
 *   · `/ajustes/notificaciones/resumen` (notif defaults org)
 *   · `/ajustes/privacidad/retencion` (retention policy)
 *   · `/ajustes/mensajeria/sonidos` (notification sounds)
 *
 * REGLAS
 * ------
 *  · WRITE solo admin (RLS).
 *  · READ cualquier miembro.
 *  · Cada save hace UPSERT del JSONB completo (read-modify-write).
 */

import { useEffect, useState } from "react";

const KEY_PREFIX = "byvaro.orgSettings.v1::";
const EVENT = "byvaro:org-settings-change";

function keyFor(orgId: string): string { return `${KEY_PREFIX}${orgId}`; }

type Settings = Record<string, unknown>;

/* ══════ Cache local · render-only ════════════════════════════════ */

function readCache(orgId: string): Settings {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(keyFor(orgId));
    if (!raw) return {};
    return JSON.parse(raw) as Settings;
  } catch { return {}; }
}

function writeCache(orgId: string, data: Settings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(keyFor(orgId), JSON.stringify(data));
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { orgId } }));
}

/* ══════ Source of truth · Supabase ═══════════════════════════════ */

async function getCurrentOrgId(): Promise<string | null> {
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return null;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();
    return (data?.organization_id as string) ?? null;
  } catch { return null; }
}

export async function hydrateOrgSettingsFromSupabase(): Promise<Settings | null> {
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return null;
    const orgId = await getCurrentOrgId();
    if (!orgId) return null;
    const { data, error } = await supabase
      .from("org_settings")
      .select("data")
      .eq("organization_id", orgId)
      .maybeSingle();
    if (error) {
      console.warn("[orgSettings:hydrate]", error.message);
      return null;
    }
    const settings = (data?.data ?? {}) as Settings;
    writeCache(orgId, settings);
    return settings;
  } catch (e) {
    console.warn("[orgSettings:hydrate] skipped:", e);
    return null;
  }
}

/* ══════ API pública ══════════════════════════════════════════════ */

export function getOrgSetting<T = unknown>(key: string, defaultValue: T): T {
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

export function setOrgSetting<T = unknown>(key: string, value: T): void {
  if (typeof window === "undefined") return;

  void (async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
      if (!isSupabaseConfigured) return;
      const orgId = await getCurrentOrgId();
      if (!orgId) return;

      const current = readCache(orgId);
      const next = { ...current, [key]: value };
      writeCache(orgId, next);

      const { error } = await supabase
        .from("org_settings")
        .upsert({
          organization_id: orgId,
          data: next,
          updated_at: new Date().toISOString(),
        }, { onConflict: "organization_id" });
      if (error) console.warn("[orgSettings:set]", error.message);
    } catch (e) {
      console.warn("[orgSettings:set] skipped:", e);
    }
  })();
}

export function clearOrgSetting(key: string): void {
  if (typeof window === "undefined") return;
  void (async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
      if (!isSupabaseConfigured) return;
      const orgId = await getCurrentOrgId();
      if (!orgId) return;
      const current = readCache(orgId);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [key]: _, ...rest } = current;
      writeCache(orgId, rest);
      const { error } = await supabase
        .from("org_settings")
        .upsert({
          organization_id: orgId,
          data: rest,
          updated_at: new Date().toISOString(),
        }, { onConflict: "organization_id" });
      if (error) console.warn("[orgSettings:clear]", error.message);
    } catch (e) {
      console.warn("[orgSettings:clear] skipped:", e);
    }
  })();
}

export function useOrgSetting<T = unknown>(
  key: string,
  defaultValue: T,
): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => getOrgSetting<T>(key, defaultValue));

  useEffect(() => {
    void hydrateOrgSettingsFromSupabase().then((fresh) => {
      if (fresh && key in fresh) setValue(fresh[key] as T);
    });
    const handler = () => setValue(getOrgSetting<T>(key, defaultValue));
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
    setOrgSetting(key, next);
  };

  return [value, update];
}
