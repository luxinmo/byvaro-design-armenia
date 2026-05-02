import { memCache } from "./memCache";
/**
 * dbWriteThrough.ts · helpers genéricos de write-through a Supabase.
 *
 * Patrón canónico de Byvaro v2 (CLAUDE.md REGLA DE ORO · backend
 * acoplado): cada helper de `src/lib/*` actúa como frontera estable
 * entre los componentes y Supabase. La UI nunca habla con
 * `supabase.from()` directo · siempre va por un helper.
 *
 * Este módulo centraliza el boilerplate común:
 *   1. `hydrateTable(table, opts)` · pull al inicio · cachea en
 *      localStorage si se le pasa cacheKey.
 *   2. `upsertRow(table, row)` · write con upsert by id · best-effort.
 *   3. `deleteRow(table, id)` · best-effort.
 *   4. `getCurrentOrgId()` · resuelve la organization_id activa del
 *      JWT del user (primera membership active o explícita en
 *      currentUser).
 */

let cachedOrgId: string | null = null;
let cachedOrgPromise: Promise<string | null> | null = null;

/** Devuelve la organization_id "activa" del usuario logueado. Cacheada
 *  en memoria para 30s. */
export async function getCurrentOrgId(): Promise<string | null> {
  if (cachedOrgId) return cachedOrgId;
  if (cachedOrgPromise) return cachedOrgPromise;
  cachedOrgPromise = (async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
      if (!isSupabaseConfigured) return null;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: members } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: true })
        .limit(1);
      const id = members?.[0]?.organization_id ?? null;
      cachedOrgId = id;
      setTimeout(() => { cachedOrgId = null; }, 30_000);
      return id;
    } catch {
      return null;
    } finally {
      cachedOrgPromise = null;
    }
  })();
  return cachedOrgPromise;
}

export interface HydrateOpts<T> {
  /** Filtros adicionales antes de ejecutar la query. */
  apply?: (q: any) => any;
  /** Mapper row→shape interno. */
  transform?: (row: any) => T;
  /** Si se especifica, escribe el resultado en localStorage[key]. */
  cacheKey?: string;
  /** Evento custom a despachar tras hidratar (para subscribers). */
  changedEvent?: string;
}

/** Pull genérico de una tabla Supabase. Best-effort · si falla,
 *  devuelve null y no altera el cache local. */
export async function hydrateTable<T>(
  table: string,
  opts: HydrateOpts<T> = {},
): Promise<T[] | null> {
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return null;
    let q = supabase.from(table).select("*");
    if (opts.apply) q = opts.apply(q);
    const { data, error } = await q;
    if (error) {
      console.warn(`[dbWriteThrough:${table}] hydrate failed:`, error.message);
      return null;
    }
    const rows = (data ?? []).map((r) => (opts.transform ? opts.transform(r) : (r as T)));
    if (opts.cacheKey && typeof window !== "undefined") {
      memCache.setItem(opts.cacheKey, JSON.stringify(rows));
      if (opts.changedEvent) {
        window.dispatchEvent(new CustomEvent(opts.changedEvent));
      }
    }
    return rows;
  } catch (e) {
    console.warn(`[dbWriteThrough:${table}] hydrate skipped:`, e);
    return null;
  }
}

/** Upsert por id (write-through). Best-effort · errores se loggean. */
export async function upsertRow(
  table: string,
  row: Record<string, unknown>,
  opts: { onConflict?: string } = {},
): Promise<void> {
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return;
    const { error } = await supabase
      .from(table)
      .upsert(row, { onConflict: opts.onConflict ?? "id" });
    if (error) console.warn(`[dbWriteThrough:${table}] upsert:`, error.message);
  } catch (e) {
    console.warn(`[dbWriteThrough:${table}] upsert skipped:`, e);
  }
}

/** Insert row (no conflict resolution). */
export async function insertRow(
  table: string,
  row: Record<string, unknown>,
): Promise<void> {
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from(table).insert(row);
    if (error) console.warn(`[dbWriteThrough:${table}] insert:`, error.message);
  } catch (e) {
    console.warn(`[dbWriteThrough:${table}] insert skipped:`, e);
  }
}

/** Delete by primary key. */
export async function deleteRow(
  table: string,
  match: Record<string, unknown>,
): Promise<void> {
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return;
    let q = supabase.from(table).delete();
    for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
    const { error } = await q;
    if (error) console.warn(`[dbWriteThrough:${table}] delete:`, error.message);
  } catch (e) {
    console.warn(`[dbWriteThrough:${table}] delete skipped:`, e);
  }
}

/** Update by primary key. */
export async function updateRow(
  table: string,
  match: Record<string, unknown>,
  patch: Record<string, unknown>,
): Promise<void> {
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return;
    let q = supabase.from(table).update(patch);
    for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
    const { error } = await q;
    if (error) console.warn(`[dbWriteThrough:${table}] update:`, error.message);
  } catch (e) {
    console.warn(`[dbWriteThrough:${table}] update skipped:`, e);
  }
}
