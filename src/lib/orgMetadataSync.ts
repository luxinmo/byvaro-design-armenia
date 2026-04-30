/**
 * orgMetadataSync.ts · Helper canónico para mergear catálogos
 * workspace-scoped (tags, fuentes de leads, tipos de relación, etc.)
 * en `organization_profiles.metadata` JSONB.
 *
 * Estos catálogos son configuración del workspace · no entidades
 * propias · por eso no justifican una tabla dedicada en Phase 1.
 *
 * Resuelve el orgId vía la primera membership activa del user actual.
 * Pre-auth skip · si no hay sesión, no-op silencioso.
 */

export async function mergeOrgMetadata(
  patch: Record<string, unknown>,
): Promise<void> {
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: members } = await supabase.from("organization_members")
      .select("organization_id").eq("user_id", user.id).eq("status", "active")
      .order("created_at", { ascending: true }).limit(1);
    const orgId = members?.[0]?.organization_id;
    if (!orgId) return;
    /* Usar RPC SECURITY DEFINER · permite a CUALQUIER miembro mergear
     * el campo metadata sin tocar el resto de columnas (que siguen
     * admin-only por la policy `profiles_update_admin`). */
    const { error } = await supabase.rpc("merge_org_metadata", {
      p_org_id: orgId, p_patch: patch,
    });
    if (error) console.warn("[orgMetadataSync]", error.message);
  } catch (e) { console.warn("[orgMetadataSync] skipped:", e); }
}
