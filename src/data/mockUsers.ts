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
import type { UserRole } from "@/lib/currentUser";

export interface MockUser {
  email: string;
  password: string;
  name: string;
  accountType: AccountType;
  /** Solo presente cuando accountType === "developer". "admin" controla
   *  acceso a todas las keys de permisos; "member" es el rol operativo
   *  con permisos limitados (ver `src/lib/permissions.ts`). Si falta →
   *  se asume "admin" para compatibilidad con cuentas viejas. */
  role?: UserRole;
  /** Solo para developer · id del registro en `TEAM_MEMBERS` al que
   *  corresponde esta cuenta. Permite que `useCurrentUser()` devuelva
   *  el id real (ej. `u2` para Laura) y que la ownership / filtros
   *  por usuario funcionen. */
  teamMemberId?: string;
  /** Solo presente cuando accountType === "agency". */
  agencyId?: string;
  /** Label humano para mostrar en la UI (ej. "Prime Properties · Agencia"). */
  label: string;
}

export const DEMO_PASSWORD = "demo1234";

export const mockUsers: MockUser[] = [
  /* ───── Promotor · admin ───── */
  {
    email: "arman@byvaro.com",
    password: DEMO_PASSWORD,
    name: "Arman Rahmanov",
    accountType: "developer",
    role: "admin",
    teamMemberId: "u1",
    label: "Luxinmo · Promotor (admin)",
  },

  /* ───── Promotor · miembro (para probar gating por permisos) ───── */
  {
    email: "laura@byvaro.com",
    password: DEMO_PASSWORD,
    name: "Laura Gómez",
    accountType: "developer",
    role: "member",
    teamMemberId: "u2",
    label: "Luxinmo · Agente (member)",
  },

  /* ───── Agencias colaboradoras ───── */
  {
    email: "laura@primeproperties.com",
    password: DEMO_PASSWORD,
    name: "Laura Sánchez",
    accountType: "agency",
    agencyId: "ag-1",
    label: "Prime Properties Costa del Sol · Agencia",
  },
  {
    email: "erik@nordichomefinders.com",
    password: DEMO_PASSWORD,
    name: "Erik Lindqvist",
    accountType: "agency",
    agencyId: "ag-2",
    label: "Nordic Home Finders · Agencia",
  },
  {
    email: "pieter@dutchbelgianrealty.com",
    password: DEMO_PASSWORD,
    name: "Pieter De Vries",
    accountType: "agency",
    agencyId: "ag-3",
    label: "Dutch & Belgian Realty · Agencia",
  },
  {
    email: "james@meridianrealestate.co.uk",
    password: DEMO_PASSWORD,
    name: "James Whitfield",
    accountType: "agency",
    agencyId: "ag-4",
    label: "Meridian Real Estate · Agencia",
  },
  {
    email: "joao@iberialuxuryhomes.pt",
    password: DEMO_PASSWORD,
    name: "João Almeida",
    accountType: "agency",
    agencyId: "ag-5",
    label: "Iberia Luxury Homes · Agencia",
  },
];

/** Busca un usuario por credenciales. Retorna null si no matchea. */
export function findMockUser(email: string, password: string): MockUser | null {
  const normalized = email.trim().toLowerCase();
  return (
    mockUsers.find(
      (u) => u.email.toLowerCase() === normalized && u.password === password,
    ) ?? null
  );
}
