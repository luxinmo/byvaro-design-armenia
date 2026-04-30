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
import type { MockUser } from "@/data/mockUsers";

/* TODO(backend) Phase 3 · LEAK CONOCIDO documentado ·
 * Estas claves SON GLOBALES en localStorage (no scoped por org) y
 * contienen emails + nombres de usuarios + agencias creadas via
 * `/invite/:token`. Si dos users comparten físicamente el mismo
 * navegador, pueden ver mutuamente las cuentas creadas (vía DevTools).
 *
 * Por qué no scoping: el LOGIN flow (`findMockUser`) necesita
 * encontrar el user antes de saber a qué workspace pertenece · sin
 * orgId no hay forma de elegir clave scoped. Iterar todas las claves
 * sufijadas es feo y no resiste el test de "qué pasa si crece a 1000
 * tenants".
 *
 * Solución correcta · `supabase.auth.signUp` desde el wizard
 * `/invite/:token`:
 *   1. signUp({ email, password, options: { data: { name } } }) ·
 *      crea fila en `auth.users`.
 *   2. Insertar `organizations` (la nueva agencia) con id generado.
 *   3. Insertar `organization_members` linkeando user → org como admin.
 *   4. La sesión queda activa (signUp devuelve session) · navegar a
 *      /inicio.
 *   5. Borrar estos helpers · el login real es Supabase auth,
 *      `findMockUser` solo cubre el seed de demo.
 *
 * Mitigación actual · estos datos solo se consultan en flows de
 * resolución (login + agencyDomainLookup), nunca se renderizan en
 * UI a otros users. Leak requiere acceso DevTools al navegador
 * físico. Riesgo bajo en tests con dispositivos separados.
 */
const AGENCIES_KEY = "byvaro.agencies.created.v1";
const USERS_KEY    = "byvaro.users.created.v1";

/* ─── Agencias ─── */
export function loadCreatedAgencies(): Agency[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(AGENCIES_KEY);
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
  localStorage.setItem(AGENCIES_KEY, JSON.stringify([agency, ...dedup]));
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
    const raw = localStorage.getItem(USERS_KEY);
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
  localStorage.setItem(USERS_KEY, JSON.stringify([user, ...dedup]));
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
