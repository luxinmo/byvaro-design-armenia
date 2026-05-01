/**
 * Sistema de permisos por rol del workspace.
 *
 * Source of truth · `public.org_settings.data.role_permissions` (Supabase).
 * El localStorage cache (`byvaro.workspace.rolePermissions.v1::<orgId>`)
 * solo existe para que `useHasPermission()` pueda devolver síncrono
 * en el render · NO es la fuente de verdad.
 *
 * MOCK · TODO(backend): los permisos reales se gestionan server-side
 *   y se devuelven en el JWT / sesión. El cliente NUNCA debe
 *   depender solo de este check para decisiones de seguridad.
 *   El backend valida CADA endpoint contra el rol del usuario.
 */

import { useEffect } from "react";
import { useCurrentUser, isAdmin, currentWorkspaceKey } from "@/lib/currentUser";
import type { CurrentUser } from "@/lib/currentUser";

export type PermissionKey =
  | "whatsapp.viewAll" | "whatsapp.viewOwn" | "whatsapp.manageChannel"
  | "contacts.editOrgTags" | "contacts.delete"
  | "collaboration.panel.view" | "collaboration.contracts.view"
  | "collaboration.contracts.manage" | "collaboration.incidents.view"
  | "collaboration.payments.view" | "collaboration.payments.manage"
  | "collaboration.documents.manage" | "collaboration.requests.manage"
  | "activity.dashboard.view" | "records.matchDetails.view"
  | "organization.editProfile" | "offices.manage" | "members.manage"
  | "promotions.create" | "promotions.edit" | "promotions.publish"
  | "contacts.viewAll" | "contacts.viewOwn"
  | "records.viewAll" | "records.viewOwn"
  | "opportunities.viewAll" | "opportunities.viewOwn"
  | "sales.viewAll" | "sales.viewOwn"
  | "visits.viewAll" | "visits.viewOwn"
  | "documents.viewAll" | "documents.viewOwn"
  | "emails.viewAll" | "emails.viewOwn";

const KEY_PREFIX = "byvaro.workspace.rolePermissions.v1::";
const CHANGE_EVENT = "byvaro:role-permissions-change";

export type RolePermissions = Record<string, PermissionKey[]>;

export const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  admin: [
    "whatsapp.viewAll", "whatsapp.viewOwn", "whatsapp.manageChannel",
    "contacts.editOrgTags", "contacts.delete",
    "collaboration.panel.view", "collaboration.contracts.view",
    "collaboration.contracts.manage", "collaboration.incidents.view",
    "collaboration.payments.view", "collaboration.payments.manage",
    "collaboration.documents.manage", "collaboration.requests.manage",
    "activity.dashboard.view", "records.matchDetails.view",
    "organization.editProfile", "offices.manage", "members.manage",
    "promotions.create", "promotions.edit", "promotions.publish",
    "contacts.viewAll", "contacts.viewOwn",
    "records.viewAll", "records.viewOwn",
    "opportunities.viewAll", "opportunities.viewOwn",
    "sales.viewAll", "sales.viewOwn",
    "visits.viewAll", "visits.viewOwn",
    "documents.viewAll", "documents.viewOwn",
    "emails.viewAll", "emails.viewOwn",
  ],
  member: [
    "whatsapp.viewOwn",
    "contacts.viewOwn", "records.viewOwn", "opportunities.viewOwn",
    "sales.viewOwn", "visits.viewOwn", "documents.viewOwn", "emails.viewOwn",
  ],
};

/* ══════ Cache local · render-only ════════════════════════════════ */

function keyFor(orgId: string): string { return `${KEY_PREFIX}${orgId}`; }

function readCache(orgId: string): RolePermissions | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(keyFor(orgId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_ROLE_PERMISSIONS, ...parsed };
  } catch { return null; }
}

function writeCache(orgId: string, perms: RolePermissions): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(keyFor(orgId), JSON.stringify(perms));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { orgId } }));
}

/* ══════ Source of truth · Supabase ═══════════════════════════════ */

function orgIdForUser(user: CurrentUser): string {
  if (user.accountType === "agency" && user.agencyId) return user.agencyId;
  return "developer-default";
}

/** Hidrata `org_settings.data.role_permissions` desde Supabase. */
export async function hydrateRolePermissionsFromSupabase(
  user: CurrentUser,
): Promise<RolePermissions | null> {
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return null;
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) return null;
    const orgId = orgIdForUser(user);
    const { data, error } = await supabase
      .from("org_settings")
      .select("data")
      .eq("organization_id", orgId)
      .maybeSingle();
    if (error) {
      console.warn("[permissions:hydrate]", error.message);
      return null;
    }
    const settings = (data?.data ?? {}) as { role_permissions?: RolePermissions };
    if (settings.role_permissions) {
      const merged = { ...DEFAULT_ROLE_PERMISSIONS, ...settings.role_permissions };
      writeCache(orgId, merged);
      return merged;
    }
    return DEFAULT_ROLE_PERMISSIONS;
  } catch (e) {
    console.warn("[permissions:hydrate] skipped:", e);
    return null;
  }
}

/* ══════ API pública ══════════════════════════════════════════════ */

/** Lee los permisos · sync · usa cache si está disponible. */
export function loadRolePermissions(user?: CurrentUser): RolePermissions {
  if (!user) return DEFAULT_ROLE_PERMISSIONS;
  const orgId = orgIdForUser(user);
  return readCache(orgId) ?? DEFAULT_ROLE_PERMISSIONS;
}

/** Persiste a Supabase + cache local · merge dentro del JSONB. */
export function saveRolePermissions(user: CurrentUser, perms: RolePermissions): void {
  if (typeof window === "undefined") return;
  const orgId = orgIdForUser(user);
  writeCache(orgId, perms);

  void (async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
      if (!isSupabaseConfigured) return;
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      /* Read-modify-write · no pisamos otros campos del JSONB. */
      const { data: row, error: readErr } = await supabase
        .from("org_settings")
        .select("data")
        .eq("organization_id", orgId)
        .maybeSingle();
      if (readErr) {
        console.warn("[permissions:save:read]", readErr.message);
        return;
      }
      const current = (row?.data ?? {}) as Record<string, unknown>;
      const next = { ...current, role_permissions: perms };
      const { error: updErr } = await supabase
        .from("org_settings")
        .upsert({
          organization_id: orgId,
          data: next,
          updated_at: new Date().toISOString(),
        }, { onConflict: "organization_id" });
      if (updErr) console.warn("[permissions:save]", updErr.message);
    } catch (e) {
      console.warn("[permissions:save] skipped:", e);
    }
  })();
}

export function hasPermission(role: string, key: PermissionKey, user?: CurrentUser): boolean {
  const perms = loadRolePermissions(user);
  return (perms[role] ?? []).includes(key);
}

/** Hook para usar en componentes con el usuario actual.
 *  Hidrata desde Supabase en mount si el cache está vacío. */
export function useHasPermission(key: PermissionKey): boolean {
  const user = useCurrentUser();
  const orgId = orgIdForUser(user);
  /* Hidratación lazy · idempotente. */
  useEffect(() => {
    if (readCache(orgId)) return;
    void hydrateRolePermissionsFromSupabase(user);
  }, [orgId, user]);
  /* Admin tiene todos los permisos por defecto. */
  if (isAdmin(user)) return true;
  return hasPermission(user.role, key, user);
}

/** @deprecated use `loadRolePermissions(user)` */
export function _legacyLoad(): RolePermissions {
  return DEFAULT_ROLE_PERMISSIONS;
}
