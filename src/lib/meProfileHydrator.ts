/**
 * meProfileHydrator.ts · Hidrata el perfil del user actual desde
 * `public.user_profiles` (Supabase) hacia memCache (`meStorage`).
 *
 * Por qué existe · `teamHydrator` ya hidrata el listado del workspace
 * via RPC `list_workspace_members`, pero hay casos donde el user
 * autenticado todavía no aparece en esa lista (workspace pending,
 * primer login antes de que `organization_members.status='active'`,
 * o user sin membership). Este hidratador es independiente y siempre
 * trae la fila del user actual desde su propia tabla canónica.
 *
 * Se ejecuta:
 *   · on-mount del SupabaseHydrator (primera carga · paralelo).
 *   · on-auth-change (SIGNED_IN, TOKEN_REFRESHED).
 */

import { hydrateMeLocal } from "./meStorage";
import { readMyUserProfile } from "./userProfileSync";

export async function hydrateMyProfile(): Promise<void> {
  const row = await readMyUserProfile();
  if (!row) return;
  const meta = (row.metadata ?? {}) as Record<string, unknown>;
  hydrateMeLocal({
    name: row.full_name ?? undefined,
    email: row.email ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    jobTitle: row.job_title ?? undefined,
    department: row.department ?? undefined,
    languages: row.languages ?? undefined,
    bio: row.bio ?? undefined,
    phone: typeof meta.phone === "string" ? (meta.phone as string) : undefined,
  });
}
