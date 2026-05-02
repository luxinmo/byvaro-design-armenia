/**
 * teamHydrator.ts · Hidrata el equipo del workspace desde Supabase.
 *
 * Llama a `api.list_workspace_members(p_org_id)` (SECURITY DEFINER,
 * gated por `is_org_member`) y poblar `memCache[teamStorageKey]` para
 * que `useWorkspaceMembers()` y todos los selectores derivados (UserSelect,
 * picker de calendario, asignación de leads, etc.) muestren la lista
 * real del workspace.
 *
 * Se ejecuta:
 *   · on-mount del SupabaseHydrator (primera carga · bloqueante).
 *   · on-auth-change (SIGNED_IN, TOKEN_REFRESHED).
 *
 * Sin esto, los users que se registran via `/register` no aparecen en
 * `/equipo`, `/ajustes/usuarios/miembros` ni en los desplegables de
 * asignación · porque el seed local arranca vacío para los workspaces
 * developer-{userId}.
 */

import { memCache } from "./memCache";
import { teamStorageKey, type TeamMember, type TeamMemberStatus } from "./team";
import { readAccountType } from "./accountType";
import { emitMembersChange } from "./meStorage";

/** Resuelve el `workspaceKey` del usuario logueado · alineado con
 *  `currentWorkspaceKey(user)` de currentUser.ts pero sin requerir
 *  el hook (este helper se llama desde fuera de React). */
function workspaceKeyFromSession(): { workspaceKey: string; orgId: string } | null {
  const snap = readAccountType();
  if (snap.type === "agency" && snap.agencyId) {
    return {
      workspaceKey: `agency-${snap.agencyId}`,
      orgId: snap.agencyId,
    };
  }
  /* developer · prioriza organizationId real (del JWT vía Login.tsx /
   *  ensureSessionStorageHydrated) sobre el sentinel "developer-default". */
  if (snap.organizationId) {
    return {
      workspaceKey: snap.organizationId.startsWith("developer-")
        ? "developer-default"
        : snap.organizationId,
      orgId: snap.organizationId,
    };
  }
  return null;
}

/** Mapea una fila de la RPC a TeamMember · normaliza nulls a undefined
 *  y aplica defaults consistentes con seeds. */
function rowToMember(row: {
  user_id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  job_title: string | null;
  department: string | null;
  languages: string[] | null;
  bio: string | null;
  phone: string | null;
  role: string | null;
  status: string | null;
  joined_at: string | null;
  public_ref: string | null;
}): TeamMember {
  const role = row.role === "admin" ? "admin" : "member";
  const status: TeamMemberStatus = (row.status === "active" || row.status === "invited"
    || row.status === "pending" || row.status === "deactive")
    ? row.status
    : "active";
  return {
    id: row.user_id,
    name: row.full_name?.trim()
      || row.email?.split("@")[0]
      || "Sin nombre",
    email: row.email ?? "",
    role,
    jobTitle: row.job_title ?? undefined,
    department: row.department ?? undefined,
    languages: row.languages ?? undefined,
    phone: row.phone ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    bio: row.bio ?? undefined,
    status,
    visibleOnProfile: true,
    canSign: role === "admin",
    canAcceptRegistrations: role === "admin",
    joinedAt: row.joined_at ?? undefined,
  };
}

/** Pulla los miembros del workspace actual y los persiste en memCache.
 *  Idempotente · se puede llamar múltiples veces (re-hidratación on
 *  auth change, re-render de pestañas, etc.). */
export async function hydrateTeamFromSupabase(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const target = workspaceKeyFromSession();
    if (!target) return;

    const { data, error } = await supabase.rpc("list_workspace_members", {
      p_org_id: target.orgId,
    });
    if (error) {
      console.warn("[team:hydrate] rpc error:", error.message);
      return;
    }
    if (!Array.isArray(data)) return;

    const members = data.map(rowToMember);
    memCache.setItem(teamStorageKey(target.workspaceKey), JSON.stringify(members));
    emitMembersChange();
  } catch (e) {
    console.warn("[team:hydrate] skipped:", e);
  }
}
