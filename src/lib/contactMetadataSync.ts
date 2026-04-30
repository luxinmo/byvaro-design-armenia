/**
 * contactMetadataSync.ts · Helper canónico para mergear campos en
 * `contacts.metadata` (JSONB) desde las stores subdocumentales locales
 * (avatar, languages, tags, relations).
 *
 * Por qué no columnas dedicadas: avatar/languages/tags/relations son
 * extensiones específicas del frontend que no hay justificación de
 * normalizar en columnas Postgres en Phase 1. JSONB merge atómico es
 * suficiente y no requiere migración cada vez que añadimos un campo.
 *
 * Pre-auth skip: si no hay sesión Supabase, no-op silencioso. La
 * cache local sigue funcionando.
 */

export async function mergeContactMetadata(
  contactId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: row } = await supabase.from("contacts")
      .select("metadata").eq("id", contactId).maybeSingle();
    const current = (row?.metadata as Record<string, unknown> | null) ?? {};
    const next = { ...current, ...patch };
    const { error } = await supabase.from("contacts")
      .update({ metadata: next }).eq("id", contactId);
    if (error) console.warn("[contactMetadataSync]", error.message);
  } catch (e) { console.warn("[contactMetadataSync] skipped:", e); }
}
