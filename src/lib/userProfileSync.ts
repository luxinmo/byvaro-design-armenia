/**
 * userProfileSync.ts · helper canónico para `public.user_profiles`.
 *
 * REGLA DE ORO · NUNCA `supabase.from("user_profiles")` en componentes.
 * Toda escritura/lectura del perfil del usuario actual pasa por aquí.
 *
 * Modelo (migración 20260502160000_user_public_ref):
 *   - Columnas dedicadas · full_name, avatar_url, job_title, department,
 *     languages (text[]), bio.
 *   - JSONB · `metadata` para campos sin columna (hoy: phone).
 *   - public_ref es INMUTABLE · auto-generada · jamás se toca aquí.
 *
 * RLS · UPDATE solo si `auth.uid() = user_id`. SELECT público (directorio).
 *
 * Patrón canónico CLAUDE.md · "merge en JSONB metadata":
 *   - Para `metadata` usamos lectura → merge → write para no pisar otras
 *     keys. Pre-auth skip silencioso (sin user logueado · noop).
 */

import { supabase, isSupabaseConfigured } from "./supabaseClient";

/** Patch que se aplica a `user_profiles` · solo columnas dedicadas. */
export interface UserProfilePatch {
  full_name?: string | null;
  avatar_url?: string | null;
  job_title?: string | null;
  department?: string | null;
  languages?: string[] | null;
  bio?: string | null;
}

/** Patch que se aplica al JSONB `metadata` · merge superficial. */
export interface UserProfileMetadataPatch {
  phone?: string | null;
  [key: string]: unknown;
}

/** Resultado del sync · permite al caller decidir qué hacer si falla
 *  (mostrar toast, dejar la edición en estado dirty, etc.). */
export interface UserProfileSyncResult {
  ok: boolean;
  error?: string;
}

/** UPDATE en `public.user_profiles` para el user actual.
 *  - Si Supabase no está configurado · noop silencioso (entorno mock).
 *  - Si no hay sesión · noop silencioso (pre-auth boot).
 *  - Si RLS rechaza el UPDATE · loggea + devuelve `{ ok: false }`. */
export async function updateUserProfile(
  patch: UserProfilePatch,
): Promise<UserProfileSyncResult> {
  if (!isSupabaseConfigured) return { ok: true };
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: true };

    const cleanPatch = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(cleanPatch).length === 0) return { ok: true };

    const { error } = await supabase
      .from("user_profiles")
      .update(cleanPatch)
      .eq("user_id", user.id);

    if (error) {
      console.warn("[userProfile:update] failed:", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.warn("[userProfile:update] exception:", msg);
    return { ok: false, error: msg };
  }
}

/** Merge superficial sobre `user_profiles.metadata` (JSONB).
 *  - Lee la metadata actual, hace `{ ...current, ...patch }`, escribe.
 *  - Borra una key pasando `null` explícito.
 *  - Pre-auth · skip silencioso. */
export async function mergeUserProfileMetadata(
  patch: UserProfileMetadataPatch,
): Promise<UserProfileSyncResult> {
  if (!isSupabaseConfigured) return { ok: true };
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: true };

    const { data: existing, error: readErr } = await supabase
      .from("user_profiles")
      .select("metadata")
      .eq("user_id", user.id)
      .single();

    if (readErr && readErr.code !== "PGRST116") {
      console.warn("[userProfile:mergeMeta] read failed:", readErr.message);
      return { ok: false, error: readErr.message };
    }

    const currentMeta = (existing?.metadata as Record<string, unknown> | null) ?? {};
    const merged: Record<string, unknown> = { ...currentMeta };
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) delete merged[k];
      else if (v !== undefined) merged[k] = v;
    }

    const { error } = await supabase
      .from("user_profiles")
      .update({ metadata: merged })
      .eq("user_id", user.id);

    if (error) {
      console.warn("[userProfile:mergeMeta] write failed:", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.warn("[userProfile:mergeMeta] exception:", msg);
    return { ok: false, error: msg };
  }
}

/** Lee el perfil completo del user actual (columnas + metadata).
 *  Útil para hidratar `meStorage` al login. */
export async function readMyUserProfile(): Promise<{
  user_id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  job_title: string | null;
  department: string | null;
  languages: string[] | null;
  bio: string | null;
  metadata: Record<string, unknown>;
} | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("user_profiles")
      .select("user_id, full_name, avatar_url, job_title, department, languages, bio, metadata")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.warn("[userProfile:read] failed:", error.message);
      return null;
    }
    if (!data) return null;
    return {
      user_id: data.user_id as string,
      email: user.email ?? null,
      full_name: (data.full_name as string | null) ?? null,
      avatar_url: (data.avatar_url as string | null) ?? null,
      job_title: (data.job_title as string | null) ?? null,
      department: (data.department as string | null) ?? null,
      languages: (data.languages as string[] | null) ?? null,
      bio: (data.bio as string | null) ?? null,
      metadata: ((data.metadata as Record<string, unknown> | null) ?? {}),
    };
  } catch (e) {
    console.warn("[userProfile:read] exception:", e);
    return null;
  }
}
