/**
 * departmentsStorage.ts · departamentos del workspace.
 *
 * Source of truth · `public.departments` (Supabase). El localStorage
 * cache (`byvaro.workspace.departments.v1::<orgId>`) solo existe para
 * que `useDepartments()` sea síncrono · NO es la fuente de verdad.
 *
 * Un departamento es simplemente un string único por workspace. Se
 * usa como sugerencia en los formularios de miembro · el admin lo
 * selecciona (o escribe uno nuevo libre).
 */

import { useEffect, useState } from "react";

const KEY_PREFIX = "byvaro.workspace.departments.v1::";
const EVENT = "byvaro:departments-change";

export const DEFAULT_DEPARTMENTS = [
  "Comercial", "Marketing", "Operaciones", "Administración",
  "Dirección", "Atención al cliente", "Legal",
] as const;

function keyFor(orgId: string): string { return `${KEY_PREFIX}${orgId}`; }

/* ══════ Cache local · render-only ════════════════════════════════ */

function readCache(orgId: string): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(keyFor(orgId));
    if (!raw) return null;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.every((x) => typeof x === "string")) return arr;
    return null;
  } catch { return null; }
}

function writeCache(orgId: string, list: string[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(keyFor(orgId), JSON.stringify(list));
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

export async function hydrateDepartmentsFromSupabase(): Promise<string[] | null> {
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return null;
    const orgId = await getCurrentOrgId();
    if (!orgId) return null;
    const { data, error } = await supabase
      .from("departments")
      .select("name, created_at")
      .eq("organization_id", orgId)
      .order("created_at");
    if (error) {
      console.warn("[departments:hydrate]", error.message);
      return null;
    }
    const names = (data ?? []).map((r) => r.name as string);
    writeCache(orgId, names);
    return names;
  } catch (e) {
    console.warn("[departments:hydrate] skipped:", e);
    return null;
  }
}

/* ══════ API pública ══════════════════════════════════════════════ */

export function getDepartments(): string[] {
  if (typeof window === "undefined") return [...DEFAULT_DEPARTMENTS];
  /* Lookup pragmático · iteramos las claves scoped por orgId. */
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith(KEY_PREFIX)) {
      const cached = readCache(k.slice(KEY_PREFIX.length));
      if (cached && cached.length > 0) return cached;
    }
  }
  return [...DEFAULT_DEPARTMENTS];
}

function dedupe(list: string[]): string[] {
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const d of list) {
    const t = d.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push(t);
  }
  return clean;
}

/** Sustituye toda la lista del workspace · hace diff y aplica
 *  insert/delete a la tabla `departments`. */
export function saveDepartments(list: string[]): void {
  if (typeof window === "undefined") return;
  const clean = dedupe(list);

  void (async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
      if (!isSupabaseConfigured) return;
      const orgId = await getCurrentOrgId();
      if (!orgId) return;
      writeCache(orgId, clean);

      /* Replace-all approach · borra todos los del workspace y vuelve
       *  a insertar en orden. Sencillo · el set es pequeño (<20). */
      const { error: delErr } = await supabase
        .from("departments")
        .delete()
        .eq("organization_id", orgId);
      if (delErr) console.warn("[departments:save:delete]", delErr.message);

      if (clean.length === 0) return;
      const rows = clean.map((name) => ({
        organization_id: orgId,
        name,
      }));
      const { error: insErr } = await supabase
        .from("departments")
        .insert(rows);
      if (insErr) console.warn("[departments:save:insert]", insErr.message);
    } catch (e) {
      console.warn("[departments:save] skipped:", e);
    }
  })();
}

export function addDepartment(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  const existing = getDepartments();
  if (existing.some((d) => d.toLowerCase() === trimmed.toLowerCase())) {
    return false;
  }
  saveDepartments([...existing, trimmed]);
  return true;
}

export function renameDepartment(oldName: string, newName: string): boolean {
  const trimmed = newName.trim();
  if (!trimmed) return false;
  const existing = getDepartments();
  if (
    existing.some(
      (d) => d.toLowerCase() === trimmed.toLowerCase()
          && d.toLowerCase() !== oldName.toLowerCase(),
    )
  ) {
    return false;
  }
  saveDepartments(existing.map((d) => (d === oldName ? trimmed : d)));
  return true;
}

export function removeDepartment(name: string): void {
  saveDepartments(getDepartments().filter((d) => d !== name));
}

export function reorderDepartments(list: string[]): void {
  saveDepartments(list);
}

/** Hook reactivo · hidrata desde DB en mount si el cache está vacío. */
export function useDepartments(): string[] {
  const [list, setList] = useState<string[]>(() => getDepartments());
  useEffect(() => {
    if (typeof window === "undefined") return;
    /* Hidratación lazy. */
    if (getDepartments().length === DEFAULT_DEPARTMENTS.length) {
      void hydrateDepartmentsFromSupabase().then((fresh) => {
        if (fresh) setList(fresh);
      });
    }
    const handler = () => setList(getDepartments());
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return list;
}
