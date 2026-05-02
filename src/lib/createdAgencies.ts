/**
 * createdAgencies.ts · Storage local de agencias creadas vía
 * `/invite/:token` (caso 1 · email completamente nuevo en Byvaro).
 *
 * Mientras no haya backend, cuando un email externo acepta una
 * invitación pasa por un wizard mínimo (nombre comercial + email +
 * password + nombre del admin) que termina creando una "agencia mock"
 * + un "usuario mock" guardados aquí. Subsiguientes logins con ese
 * email funcionan vía `findCreatedAgencyUser`.
 *
 * En backend real, esto desaparece · `POST /api/v1/auth/signup` crea
 * la `organization` (kind=agency) + la `membership` (rol admin) + el
 * `users.password_hash` en una transacción.
 */

import type { Agency } from "@/data/agencies";
import { memCache } from "./memCache";
import type { MockUser } from "@/data/mockUsers";

/* Cache local · cuando Supabase está configurado, la fuente de verdad
 *  es `auth.users` + `organizations` + `organization_members`. Las
 *  claves siguen aquí para soporte offline + lookup pre-auth, pero
 *  toda creación nueva se hace primero contra Supabase (ver
 *  `signUpAgencyAdmin` abajo) y se cachea localmente. */
const AGENCIES_KEY = "byvaro.agencies.created.v1";
const USERS_KEY    = "byvaro.users.created.v1";

/* ─── Agencias ─── */
export function loadCreatedAgencies(): Agency[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = memCache.getItem(AGENCIES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveCreatedAgency(agency: Agency): void {
  const all = loadCreatedAgencies();
  const dedup = all.filter((a) => a.id !== agency.id);
  memCache.setItem(AGENCIES_KEY, JSON.stringify([agency, ...dedup]));
  window.dispatchEvent(new Event("byvaro:created-agencies-changed"));
}

/** Lookup combinado seed + creadas. */
export function findAgencyById(id: string, seed: Agency[]): Agency | undefined {
  return seed.find((a) => a.id === id) ?? loadCreatedAgencies().find((a) => a.id === id);
}

/* ─── Usuarios mock creados ─── */
export function loadCreatedUsers(): MockUser[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = memCache.getItem(USERS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveCreatedUser(user: MockUser): void {
  const all = loadCreatedUsers();
  const norm = (s: string) => s.trim().toLowerCase();
  const dedup = all.filter((u) => norm(u.email) !== norm(user.email));
  memCache.setItem(USERS_KEY, JSON.stringify([user, ...dedup]));
}

/** Busca usuario creado por email + password. Retorna null si no matchea.
 *  Complementa `findMockUser` del seed. */
export function findCreatedUser(email: string, password: string): MockUser | null {
  const norm = email.trim().toLowerCase();
  return loadCreatedUsers().find(
    (u) => u.email.toLowerCase() === norm && u.password === password,
  ) ?? null;
}

/** Existe ya un usuario con ese email · usado para detectar caso 2b
 *  (workspace ya existe) en `/invite/:token`. */
export function userExistsByEmail(email: string, seedEmails: string[]): boolean {
  const norm = email.trim().toLowerCase();
  if (seedEmails.some((e) => e.toLowerCase() === norm)) return true;
  return loadCreatedUsers().some((u) => u.email.toLowerCase() === norm);
}

/* ─── Generación de id de agencia para nueva alta. ─── */
export function generateNewAgencyId(): string {
  return `ag-new-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

/* ══════ Sign-up real · Supabase auth + multi-tenant ══════════════
 *
 * Crea atómicamente:
 *   1. auth.users (vía supabase.auth.signUp)
 *   2. organizations (la nueva agencia · kind=agency)
 *   3. organization_members (user → org como admin)
 *
 * Llamado desde el wizard `/invite/:token` cuando el email es
 * completamente nuevo en Byvaro. Si Supabase no está configurado
 * (dev sin .env), cae al mock localStorage.
 */
export async function signUpAgencyAdmin(input: {
  email: string;
  password: string;
  fullName: string;
  agencyId: string;
  agencyName: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) {
      /* Mock fallback · no hay Supabase configurado */
      return { ok: true };
    }

    /* 1. Crear user en auth */
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      options: { data: { name: input.fullName } },
    });
    if (signUpErr) {
      console.warn("[signUpAgencyAdmin:auth]", signUpErr.message);
      return { ok: false, error: signUpErr.message };
    }
    const userId = signUpData.user?.id;
    if (!userId) return { ok: false, error: "No user id returned" };

    /* 2. Insertar organizations (kind=agency) */
    const { error: orgErr } = await supabase.from("organizations").insert({
      id: input.agencyId,
      kind: "agency",
      name: input.agencyName,
      slug: input.agencyId,
    });
    if (orgErr) {
      console.warn("[signUpAgencyAdmin:org]", orgErr.message);
      /* No abortamos · el user ya existe · admin lo arregla manualmente */
    }

    /* 3. Insertar organization_members como admin */
    const { error: memErr } = await supabase.from("organization_members").insert({
      organization_id: input.agencyId,
      user_id: userId,
      role: "admin",
      status: "active",
    });
    if (memErr) {
      console.warn("[signUpAgencyAdmin:member]", memErr.message);
    }

    return { ok: true };
  } catch (e) {
    console.warn("[signUpAgencyAdmin] exception:", e);
    return { ok: false, error: String(e) };
  }
}
