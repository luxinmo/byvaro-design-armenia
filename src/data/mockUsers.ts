/**
 * mockUsers.ts · Credenciales de usuarios mock para el login demo.
 *
 * Mientras no hay backend, el Login compara email+password contra esta
 * lista. Es SOLO para desarrollo y presentaciones — en producción el
 * login pasará por `POST /api/v1/auth/login` y esto desaparece.
 *
 * Dos tipos de usuarios:
 *   · developer → promotor (Luxinmo). Ve todo el SaaS del promotor.
 *   · agency    → agencia colaboradora. Entra a una vista scopeada a su
 *                 agencia concreta (referenciada por `agencyId`).
 *
 * La contraseña por defecto es `demo1234` para todas las cuentas demo;
 * lo único que cambia entre cuentas es el email (que determina el rol y,
 * en el caso de agencias, cuál).
 */

import type { AccountType } from "@/lib/accountType";
import { memCache } from "@/lib/memCache";
import type { UserRole } from "@/lib/currentUser";

export interface MockUser {
  email: string;
  password: string;
  name: string;
  accountType: AccountType;
  /** Rol del usuario dentro de su organización (workspace).
   *   · "admin"  controla acceso a todas las keys de permisos · puede
   *     gestionar miembros, datos de empresa, billing y plan.
   *   · "member" es el rol operativo · permisos limitados (ver
   *     `src/lib/permissions.ts`).
   *  Aplica tanto a `developer` (admin/member del workspace promotor)
   *  como a `agency` (admin/member dentro de su agencia). Si falta,
   *  se asume "admin" para compatibilidad con cuentas viejas. */
  role?: UserRole;
  /** Solo para developer · id del registro en `TEAM_MEMBERS` al que
   *  corresponde esta cuenta. Permite que `useCurrentUser()` devuelva
   *  el id real (ej. `u2` para Laura) y que la ownership / filtros
   *  por usuario funcionen. */
  teamMemberId?: string;
  /** ID del workspace (organization) al que pertenece este usuario.
   *  - Para `accountType: "agency"` · id de la agencia (`ag-X`).
   *  - Para `accountType: "developer"` · id del workspace developer
   *    (omitir o `developer-default` para Luxinmo · `prom-X` para
   *    promotores externos como AEDAS, Neinor, Habitat, Metrovacesa).
   *  El nombre `agencyId` se conserva por compat backward · semánticamente
   *  es `organizationId`. */
  agencyId?: string;
  /** Label humano para mostrar en la UI (ej. "Prime Properties · Agencia"). */
  label: string;
}

/** Contraseña común para todas las cuentas demo · suficiente friction
 *  para que solo quien la conoce (equipo Byvaro · testers invitados)
 *  pueda entrar a la app desplegada en producción mientras se valida.
 *  Combinada con la capa de basic-auth a nivel CDN/Vercel
 *  (`docs/backend-integration.md §14.6`) cubre el periodo Phase 1A. */
export const DEMO_PASSWORD = "Luxinmo2026Byvaro";

export const mockUsers: MockUser[] = [];

/** Busca un usuario por credenciales. Retorna null si no matchea.
 *  Cruza el seed canónico con los usuarios creados vía `/invite/:token`
 *  (alta nueva caso 1) que viven en `byvaro.users.created.v1`.
 *  Cuando llegue backend real, esto pasa a `POST /api/auth/login`. */
export function findMockUser(email: string, password: string): MockUser | null {
  const normalized = email.trim().toLowerCase();
  const seedHit = mockUsers.find(
    (u) => u.email.toLowerCase() === normalized && u.password === password,
  );
  if (seedHit) return seedHit;
  /* Lazy require para evitar cycle (createdAgencies importa MockUser). */
  if (typeof window === "undefined") return null;
  try {
    const raw = memCache.getItem("byvaro.users.created.v1");
    if (!raw) return null;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return null;
    return (arr as MockUser[]).find(
      (u) => u.email.toLowerCase() === normalized && u.password === password,
    ) ?? null;
  } catch {
    return null;
  }
}
