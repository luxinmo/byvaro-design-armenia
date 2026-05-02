/**
 * meStorage.ts · "mí" como entrada única en la lista de miembros.
 *
 * QUÉ
 * ----
 * Una única fuente de verdad para los datos del usuario actual.
 * Antes existían dos stores separados que divergían:
 *   - `byvaro.user.profile.v1` (profileStorage · lo que editabas en
 *     `/ajustes/perfil/personal`).
 *   - `byvaro.organization.members.v4` (TEAM_MEMBERS · lo que veías en
 *     `/equipo` y lo que el admin editaba en `MemberFormDialog`).
 *
 * Ambos describían a la misma persona (`currentUser.id === "u1"`) pero
 * cada uno tenía sus propios campos, con lo que editar perfil no se
 * reflejaba en equipo y viceversa. Ver ADR-050.
 *
 * Desde ahora: `/ajustes/perfil/personal` y `/equipo` leen y escriben
 * sobre el MISMO `TeamMember`. `meStorage` es la fachada que:
 *   1. Lee la lista de miembros en `byvaro.organization.members.v4`.
 *   2. Devuelve la entrada donde `id === MY_ID`.
 *   3. Persiste parches en esa misma entrada.
 *   4. Emite un `CustomEvent` reactivo para que cualquier consumer
 *      (useCurrentUser, sidebar, etc.) se actualice en caliente.
 *
 * TODO(backend): reemplazar por `GET /api/me` + `PATCH /api/me`.
 *   El endpoint devolverá el `TeamMember` del usuario logueado. El
 *   refactor es trivial porque todos los consumers ya pasan por aquí.
 */

import { useEffect, useState } from "react";
import { memCache } from "./memCache";
import { TEAM_MEMBERS, type TeamMember } from "@/lib/team";

/* Key compartida con Equipo.tsx y /ajustes/usuarios/miembros.
 * Bump de versión coordinada con los dos archivos. */
const MEMBERS_KEY = "byvaro.organization.members.v4";
const CHANGE_EVENT = "byvaro:me-change";
/* Si cambia la lista global de miembros (admin edita a alguien desde
 * /equipo), también emitimos `me-change` por si la edición fue al
 * usuario actual. */
const MEMBERS_CHANGE_EVENT = "byvaro:members-change";

/** Id del usuario actual · hoy hardcoded, mañana vendrá del JWT. */
const MY_ID = "u1";

/* ═══════════════════════════════════════════════════════════════════
   Lectura / escritura de la lista global
   ═══════════════════════════════════════════════════════════════════ */

function readAll(): TeamMember[] {
  if (typeof window === "undefined") return TEAM_MEMBERS;
  try {
    const raw = memCache.getItem(MEMBERS_KEY);
    return raw ? (JSON.parse(raw) as TeamMember[]) : TEAM_MEMBERS;
  } catch {
    return TEAM_MEMBERS;
  }
}

function writeAll(list: TeamMember[]) {
  if (typeof window === "undefined") return;
  memCache.setItem(MEMBERS_KEY, JSON.stringify(list));
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
  return list.find((m) => m.id === MY_ID) ?? null;
}

/** Parches sobre el propio `TeamMember`. Crea la entrada si no existe. */
export function updateMe(patch: Partial<TeamMember>): void {
  const list = readAll();
  const index = list.findIndex((m) => m.id === MY_ID);
  if (index === -1) {
    const seed = TEAM_MEMBERS.find((m) => m.id === MY_ID);
    const newMember: TeamMember = {
      id: MY_ID,
      name: seed?.name ?? "Arman Rahmanov",
      email: seed?.email ?? "arman@byvaro.com",
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
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(CHANGE_EVENT, handler);
      window.removeEventListener(MEMBERS_CHANGE_EVENT, handler);
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
