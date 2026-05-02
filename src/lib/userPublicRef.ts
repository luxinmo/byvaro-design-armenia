/**
 * userPublicRef.ts · referencia pública canónica de usuarios.
 *
 * Scheme · `USXXXXXXX` (US + 7 dígitos · 9 chars · espacio 10M).
 * Source of truth · `public.user_profiles.public_ref` (auto-generada
 * server-side via trigger `gen_user_public_ref()`). NUNCA editable
 * desde la UI · sirve como handle externo del usuario en URLs y
 * displays públicos.
 *
 * Esta API:
 *   · `useUserPublicRef(userId)` · hook reactivo · pulla y cachea.
 *   · `formatUserRef("US1234567")` · cosmetic "US·123·4567".
 *   · `findUserByRef(ref)` · resuelve ref → user (RPC público).
 */

import { useEffect, useState } from "react";
import { memCache } from "./memCache";

const CACHE_KEY = "byvaro.userPublicRef.v1";
const CHANGE_EVENT = "byvaro:user-public-ref-changed";

interface CacheMap {
  [userId: string]: string; // userId → publicRef
}

function readCache(): CacheMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = memCache.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function writeCache(map: CacheMap) {
  if (typeof window === "undefined") return;
  memCache.setItem(CACHE_KEY, JSON.stringify(map));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

/** Hidrata el cache desde Supabase · llamar al login. Solo fields
 *  públicos (user_id + public_ref) · seguro cross-tenant. */
export async function hydrateUserPublicRefs(): Promise<void> {
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return;
    const { data, error } = await supabase
      .from("user_profiles")
      .select("user_id, public_ref");
    if (error || !data) return;
    const map: CacheMap = {};
    for (const r of data) map[r.user_id as string] = r.public_ref as string;
    writeCache(map);
  } catch (e) {
    console.warn("[userPublicRef] hydrate skipped:", e);
  }
}

/** Lookup sync · devuelve la ref o null si no está en cache. */
export function getUserPublicRef(userId: string | undefined | null): string | null {
  if (!userId) return null;
  return readCache()[userId] ?? null;
}

/** Hook reactivo · re-renderea cuando se hidrata o cambia. */
export function useUserPublicRef(userId: string | undefined | null): string | null {
  const [ref, setRef] = useState<string | null>(() => getUserPublicRef(userId));
  useEffect(() => {
    setRef(getUserPublicRef(userId));
    const handler = () => setRef(getUserPublicRef(userId));
    window.addEventListener(CHANGE_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(CHANGE_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, [userId]);
  return ref;
}

/** Display cosmetic · `US1234567` → `US·123·4567` para legibilidad
 *  humana al mostrar la ref. Valor canónico es sin separador. */
export function formatUserRef(ref: string): string {
  if (!/^US\d{7}$/.test(ref)) return ref;
  return `${ref.slice(0, 2)}·${ref.slice(2, 5)}·${ref.slice(5)}`;
}

/** Resuelve ref pública → datos del user (RPC SECURITY DEFINER). */
export async function findUserByRef(ref: string): Promise<{
  user_id: string;
  public_ref: string;
  full_name: string | null;
  avatar_url: string | null;
  job_title: string | null;
} | null> {
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase.rpc("find_user_by_ref", { p_ref: ref });
    if (error || !data || data.length === 0) return null;
    return data[0];
  } catch {
    return null;
  }
}

/** Validador del scheme · `USXXXXXXX` con dígitos. */
export function isValidUserRef(s: string | undefined | null): s is string {
  return typeof s === "string" && /^US\d{7}$/.test(s);
}
