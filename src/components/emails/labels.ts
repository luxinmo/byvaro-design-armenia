import { memCache } from "@/lib/memCache";
/**
 * labels.ts — Etiquetas personalizadas de emails.
 *
 * Source of truth · `public.email_labels` (Supabase). El localStorage
 * cache (`byvaro.emailLabels.v1::<orgId>`) solo existe para que
 * `loadLabels()` sea síncrono · NO es la fuente de verdad.
 */

export type Label = {
  name: string;
  color: string; // clase tailwind (bg-warning, bg-success, …)
};

const KEY_PREFIX = "byvaro.emailLabels.v1::";
const EVENT = "byvaro:email-labels-change";

function keyFor(orgId: string): string { return `${KEY_PREFIX}${orgId}`; }

/* ══════ Cache local · render-only ════════════════════════════════ */

function readCache(orgId: string): Label[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = memCache.getItem(keyFor(orgId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Label[];
    return Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}

function writeCache(orgId: string, labels: Label[]): void {
  if (typeof window === "undefined") return;
  memCache.setItem(keyFor(orgId), JSON.stringify(labels));
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { orgId } }));
}

/* ══════ Source of truth · Supabase ═══════════════════════════════ */

async function getCurrentOrgId(): Promise<string | null> {
  try {
    const { supabase, isSupabaseConfigured } = await import("@/lib/supabaseClient");
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

export async function hydrateLabelsFromSupabase(): Promise<Label[] | null> {
  try {
    const { supabase, isSupabaseConfigured } = await import("@/lib/supabaseClient");
    if (!isSupabaseConfigured) return null;
    const orgId = await getCurrentOrgId();
    if (!orgId) return null;
    const { data, error } = await supabase
      .from("email_labels")
      .select("label, color")
      .eq("organization_id", orgId)
      .order("created_at");
    if (error) {
      console.warn("[emailLabels:hydrate]", error.message);
      return null;
    }
    const labels: Label[] = (data ?? []).map((r) => ({
      name: r.label as string,
      color: (r.color as string) ?? "bg-muted",
    }));
    writeCache(orgId, labels);
    return labels;
  } catch (e) {
    console.warn("[emailLabels:hydrate] skipped:", e);
    return null;
  }
}

/* ══════ API pública ══════════════════════════════════════════════ */

export function loadLabels(fallback: Label[]): Label[] {
  if (typeof window === "undefined") return fallback;
  for (let i = 0; i < memCache.length; i++) {
    const k = memCache.key(i);
    if (k && k.startsWith(KEY_PREFIX)) {
      const cached = readCache(k.slice(KEY_PREFIX.length));
      if (cached) return cached;
    }
  }
  return fallback;
}

/** Sustituye toda la lista del workspace · diff-and-replace en DB. */
export function saveLabels(labels: Label[]): void {
  if (typeof window === "undefined") return;

  void (async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import("@/lib/supabaseClient");
      if (!isSupabaseConfigured) return;
      const orgId = await getCurrentOrgId();
      if (!orgId) return;
      writeCache(orgId, labels);

      const { error: delErr } = await supabase
        .from("email_labels")
        .delete()
        .eq("organization_id", orgId);
      if (delErr) console.warn("[emailLabels:save:delete]", delErr.message);

      if (labels.length === 0) return;
      const rows = labels.map((l) => ({
        organization_id: orgId,
        label: l.name,
        color: l.color,
      }));
      const { error: insErr } = await supabase
        .from("email_labels")
        .insert(rows);
      if (insErr) console.warn("[emailLabels:save:insert]", insErr.message);
    } catch (e) {
      console.warn("[emailLabels:save] skipped:", e);
    }
  })();
}
