/**
 * meStorage.ts · "mí" como entrada única en la lista de miembros.
 *
 * QUÉ
 * ----
 * Una única fuente de verdad para los datos del usuario actual.
 *
 * Antes existían dos stores separados que divergían:
 *   - `byvaro.user.profile.v1` (profileStorage · lo que editabas en
 *     `/ajustes/perfil/personal`).
 *   - `byvaro.organization.members.v4` (TEAM_MEMBERS · lo que veías en
 *     `/equipo` y lo que el admin editaba en `MemberFormDialog`).
 *
 * Ambos describían a la misma persona pero cada uno tenía sus propios
 * campos, con lo que editar perfil no se reflejaba en equipo y
 * viceversa. Ver ADR-050.
 *
 * Desde ahora: `/ajustes/perfil/personal` y `/equipo` leen y escriben
 * sobre el MISMO `TeamMember`. `meStorage` es la fachada que:
 *   1. Resuelve el ID del user actual (auth.uid() del JWT, fallback "u1"
 *      legacy si no hay sesión Supabase).
 *   2. Lee la lista de miembros del workspace en memCache.
 *   3. Devuelve la entrada cuyo id coincide.
 *   4. Persiste parches via write-through:
 *        · Optimistic local · escribe a memCache + emite evento.
 *        · Supabase async · UPDATE en `user_profiles`. Pre-auth skip.
 *   5. Emite un `CustomEvent` reactivo para que cualquier consumer
 *      (useCurrentUser, sidebar, etc.) se actualice en caliente.
 *
 * Backend doc · `docs/backend-development-rules.md` (helpers permanentes).
 */

import { useEffect, useState } from "react";
import { memCache } from "./memCache";
import { TEAM_MEMBERS, teamStorageKey, type TeamMember } from "@/lib/team";
import { readAccountType } from "./accountType";
import {
  updateUserProfile,
  mergeUserProfileMetadata,
} from "./userProfileSync";

/* Key compartida con Equipo.tsx y /ajustes/usuarios/miembros.
 * Bump de versión coordinada con los dos archivos. */
const MEMBERS_KEY_LEGACY = "byvaro.organization.members.v4";
const CHANGE_EVENT = "byvaro:me-change";
/* Si cambia la lista global de miembros (admin edita a alguien desde
 * /equipo), también emitimos `me-change` por si la edición fue al
 * usuario actual. */
const MEMBERS_CHANGE_EVENT = "byvaro:members-change";

/** ID legacy del usuario en seeds mock (single-tenant prototype). */
const LEGACY_MY_ID = "u1";

/* ═══════════════════════════════════════════════════════════════════
   Resolución del ID del user actual

   Prioriza:
     1. sessionStorage `byvaro.accountType.userId.v1` → auth.uid() real
        (set por loginAs() tras autenticación Supabase).
     2. Fallback "u1" → mock legacy single-tenant.

   No es un hook, es una función pura que se invoca dentro de
   getMe()/updateMe() · resuelve dinámicamente cada vez para reflejar
   un re-login sin estado caducado.
   ═══════════════════════════════════════════════════════════════════ */
function resolveMyId(): string {
  const snap = readAccountType();
  return snap.userId ?? LEGACY_MY_ID;
}

/** Workspace key activo (igual que `currentWorkspaceKey` pero sync,
 *  sin necesitar el hook ni el `CurrentUser`). */
function resolveWorkspaceKey(): string {
  const snap = readAccountType();
  if (snap.type === "agency" && snap.agencyId) return `agency-${snap.agencyId}`;
  if (snap.type === "developer" && snap.organizationId
      && !snap.organizationId.startsWith("developer-")) {
    return snap.organizationId;
  }
  return "developer-default";
}

/* ═══════════════════════════════════════════════════════════════════
   Lectura / escritura de la lista de miembros del workspace activo

   La key real es scoped por workspace (`teamStorageKey(workspaceKey)`).
   Mantenemos compatibilidad con la key legacy single-tenant
   `byvaro.organization.members.v4` cuando el workspace es
   `developer-default`.
   ═══════════════════════════════════════════════════════════════════ */

function activeKey(): string {
  const wk = resolveWorkspaceKey();
  /* Si es developer-default, usamos la key legacy plana para compat
   * con el resto del código que aún la lee directa (Equipo.tsx, etc.). */
  if (wk === "developer-default") return MEMBERS_KEY_LEGACY;
  return teamStorageKey(wk);
}

function readAll(): TeamMember[] {
  if (typeof window === "undefined") return TEAM_MEMBERS;
  try {
    const raw = memCache.getItem(activeKey());
    return raw ? (JSON.parse(raw) as TeamMember[]) : TEAM_MEMBERS;
  } catch {
    return TEAM_MEMBERS;
  }
}

function writeAll(list: TeamMember[]) {
  if (typeof window === "undefined") return;
  memCache.setItem(activeKey(), JSON.stringify(list));
  /* Notificamos a AMBAS audiencias: listados de miembros y consumers
   * del usuario actual. Así /equipo se refresca al editar el perfil y
   * el sidebar se refresca al editar desde /equipo. */
  window.dispatchEvent(new Event(MEMBERS_CHANGE_EVENT));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/* ═══════════════════════════════════════════════════════════════════
   API pública
   ═══════════════════════════════════════════════════════════════════ */

/** Devuelve el `TeamMember` del usuario actual o `null`. */
export function getMe(): TeamMember | null {
  const list = readAll();
  const myId = resolveMyId();
  /* Match exact por id · si no aparece (caso transitorio: hidratación
   * todavía pendiente, o la RPC list_workspace_members no devolvió al
   * user · puede pasar si su organization_member está pending), también
   * intentamos por email del JWT como fallback. */
  const found = list.find((m) => m.id === myId);
  if (found) return found;
  const snap = readAccountType();
  const myEmail = snap.developerEmail ?? snap.agencyEmail;
  if (myEmail) {
    return list.find((m) => m.email?.toLowerCase() === myEmail.toLowerCase()) ?? null;
  }
  return null;
}

/** Mapea un patch de `TeamMember` (modelo cliente) al patch de Supabase
 *  (`user_profiles` · columnas + metadata). */
function patchToSupabase(patch: Partial<TeamMember>): {
  cols: Parameters<typeof updateUserProfile>[0];
  meta: Parameters<typeof mergeUserProfileMetadata>[0];
} {
  const cols: Parameters<typeof updateUserProfile>[0] = {};
  const meta: Parameters<typeof mergeUserProfileMetadata>[0] = {};
  if ("name" in patch) cols.full_name = patch.name?.trim() || null;
  if ("avatarUrl" in patch) cols.avatar_url = patch.avatarUrl ?? null;
  if ("jobTitle" in patch) cols.job_title = patch.jobTitle ?? null;
  if ("department" in patch) cols.department = patch.department ?? null;
  if ("languages" in patch) {
    cols.languages = patch.languages && patch.languages.length > 0
      ? patch.languages : null;
  }
  if ("bio" in patch) cols.bio = patch.bio ?? null;
  if ("phone" in patch) meta.phone = patch.phone ?? null;
  return { cols, meta };
}

/** Parches sobre el propio `TeamMember`.
 *
 *  Write-through:
 *    1. Optimistic local · escribe a memCache + dispara event (UI refresh
 *       instantáneo en sidebar, /equipo y la propia /ajustes/perfil).
 *    2. Supabase async · UPDATE en `user_profiles`. Si falla, el cambio
 *       local sigue · el caller que necesite confirmación debe usar
 *       `updateMeAsync()`. */
export function updateMe(patch: Partial<TeamMember>): void {
  applyLocal(patch);
  /* Best-effort · errores se loggean dentro de los helpers. La UI ya
   * tiene el cambio aplicado · si Supabase falla, el caller decide. */
  void syncRemote(patch);
}

/** Variante async · espera a que Supabase confirme. Útil para el
 *  botón "Guardar cambios" que necesita saber si persistió. */
export async function updateMeAsync(
  patch: Partial<TeamMember>,
): Promise<{ ok: boolean; error?: string }> {
  applyLocal(patch);
  return syncRemote(patch);
}

function applyLocal(patch: Partial<TeamMember>): void {
  const list = readAll();
  const myId = resolveMyId();
  const index = list.findIndex((m) => m.id === myId);
  if (index === -1) {
    /* Crear entrada nueva · solo si tenemos un id resuelto. */
    const seed = TEAM_MEMBERS.find((m) => m.id === myId);
    const snap = readAccountType();
    const newMember: TeamMember = {
      id: myId,
      name: seed?.name ?? snap.userName ?? "",
      email: seed?.email ?? snap.developerEmail ?? snap.agencyEmail ?? "",
      role: seed?.role ?? "admin",
      ...seed,
      ...patch,
    };
    writeAll([newMember, ...list]);
    return;
  }
  const next = [...list];
  next[index] = { ...next[index], ...patch };
  writeAll(next);
}

async function syncRemote(
  patch: Partial<TeamMember>,
): Promise<{ ok: boolean; error?: string }> {
  const { cols, meta } = patchToSupabase(patch);
  const tasks: Promise<{ ok: boolean; error?: string }>[] = [];
  if (Object.keys(cols).length > 0) tasks.push(updateUserProfile(cols));
  if (Object.keys(meta).length > 0) tasks.push(mergeUserProfileMetadata(meta));
  if (tasks.length === 0) return { ok: true };
  const results = await Promise.all(tasks);
  const failed = results.find((r) => !r.ok);
  return failed ? { ok: false, error: failed.error } : { ok: true };
}

/* ═══════════════════════════════════════════════════════════════════
   Migración legacy · desde `byvaro.user.profile.v1` (profileStorage)
   ═══════════════════════════════════════════════════════════════════ */

const LEGACY_PROFILE_KEY = "byvaro.user.profile.v1";

/**
 * Una única vez: si existe un profile legacy y no se ha migrado todavía,
 * volcamos sus campos sobre mi entrada en TEAM_MEMBERS. No borramos la
 * key legacy — quedará como backup hasta que confirmemos en
 * producción.
 */
function migrateLegacyProfile() {
  if (typeof window === "undefined") return;
  const already = memCache.getItem("byvaro.me-migration.v1");
  if (already === "done") return;

  const raw = memCache.getItem(LEGACY_PROFILE_KEY);
  if (!raw) {
    memCache.setItem("byvaro.me-migration.v1", "done");
    return;
  }
  try {
    const legacy = JSON.parse(raw) as {
      fullName?: string;
      email?: string;
      jobTitle?: string;
      department?: string;
      bio?: string;
      avatar?: string;
      languages?: string[];
    };
    const patch: Partial<TeamMember> = {};
    if (legacy.fullName)   patch.name = legacy.fullName;
    if (legacy.email)      patch.email = legacy.email;
    if (legacy.jobTitle)   patch.jobTitle = legacy.jobTitle;
    if (legacy.department) patch.department = legacy.department;
    if (legacy.avatar)     patch.avatarUrl = legacy.avatar;
    if (legacy.languages)  patch.languages = legacy.languages;
    if (Object.keys(patch).length > 0) updateMe(patch);
    memCache.setItem("byvaro.me-migration.v1", "done");
  } catch {
    /* Si falla, no reintentamos para no entrar en loop. */
    memCache.setItem("byvaro.me-migration.v1", "failed");
  }
}

/* Al importar el módulo por primera vez en cliente, migramos. */
if (typeof window !== "undefined") {
  /* defer: evita trabajar antes de que hidraten los stores downstream. */
  setTimeout(migrateLegacyProfile, 0);
}

/* ═══════════════════════════════════════════════════════════════════
   Hook reactivo
   ═══════════════════════════════════════════════════════════════════ */

/** Hook que re-renderiza cuando mi perfil (o la lista de miembros) cambia. */
export function useMe(): TeamMember | null {
  const [me, setMe] = useState<TeamMember | null>(() => getMe());
  useEffect(() => {
    const handler = () => setMe(getMe());
    window.addEventListener(CHANGE_EVENT, handler);
    window.addEventListener(MEMBERS_CHANGE_EVENT, handler);
    /* Cuando cambia el accountType (login/logout/AccountSwitcher), el
     *  myId se resuelve diferente · re-resolvemos getMe(). */
    window.addEventListener("byvaro:account-change", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(CHANGE_EVENT, handler);
      window.removeEventListener(MEMBERS_CHANGE_EVENT, handler);
      window.removeEventListener("byvaro:account-change", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return me;
}

/** Helper para que Equipo y miembros.tsx disparen el evento tras escribir. */
export function emitMembersChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(MEMBERS_CHANGE_EVENT));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Aplica un patch SOLO a memCache · sin write-back a Supabase. Usado
 *  por hidratadores que vienen de leer la DB · evita el round-trip
 *  inmediato de re-escribir lo que acabamos de leer. */
export function hydrateMeLocal(patch: Partial<TeamMember>): void {
  applyLocal(patch);
}
