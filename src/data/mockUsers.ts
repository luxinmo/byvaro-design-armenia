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

  /* ───── Agencias colaboradoras ─────
   *  Cada agencia tiene 1 usuario admin (dueño/contacto principal).
   *  Prime Properties tiene un usuario `member` adicional para que
   *  puedas ver el comportamiento del rol limitado dentro de una
   *  agencia (ej. el member NO puede gestionar miembros del equipo
   *  ni cambiar el plan de la agencia · solo opera el día a día). */
  {
    email: "laura@primeproperties.com",
    password: DEMO_PASSWORD,
    name: "Laura Sánchez",
    accountType: "agency",
    role: "admin",
    agencyId: "ag-1",
    label: "Prime Properties Costa del Sol · Agencia (admin)",
  },
  {
    email: "tom@primeproperties.com",
    password: DEMO_PASSWORD,
    name: "Tom Brennan",
    accountType: "agency",
    role: "member",
    agencyId: "ag-1",
    label: "Prime Properties Costa del Sol · Agente (member)",
  },
  {
    email: "erik@nordichomefinders.com",
    password: DEMO_PASSWORD,
    name: "Erik Lindqvist",
    accountType: "agency",
    role: "admin",
    agencyId: "ag-2",
    label: "Nordic Home Finders · Agencia (admin)",
  },
  {
    email: "anna@nordichomefinders.com",
    password: DEMO_PASSWORD,
    name: "Anna Bergström",
    accountType: "agency",
    role: "member",
    agencyId: "ag-2",
    label: "Nordic Home Finders · Agente (member)",
  },
  {
    email: "pieter@dutchbelgianrealty.com",
    password: DEMO_PASSWORD,
    name: "Pieter De Vries",
    accountType: "agency",
    role: "admin",
    agencyId: "ag-3",
    label: "Dutch & Belgian Realty · Agencia (admin)",
  },
  {
    email: "sander@dutchbelgianrealty.com",
    password: DEMO_PASSWORD,
    name: "Sander Janssen",
    accountType: "agency",
    role: "member",
    agencyId: "ag-3",
    label: "Dutch & Belgian Realty · Agente (member)",
  },
  {
    email: "james@meridianrealestate.co.uk",
    password: DEMO_PASSWORD,
    name: "James Whitfield",
    accountType: "agency",
    role: "admin",
    agencyId: "ag-4",
    label: "Meridian Real Estate · Agencia (admin)",
  },
  {
    email: "olivia@meridianrealestate.co.uk",
    password: DEMO_PASSWORD,
    name: "Olivia Carter",
    accountType: "agency",
    role: "member",
    agencyId: "ag-4",
    label: "Meridian Real Estate · Agente (member)",
  },
  {
    email: "joao@iberialuxuryhomes.pt",
    password: DEMO_PASSWORD,
    name: "João Almeida",
    accountType: "agency",
    role: "admin",
    agencyId: "ag-5",
    label: "Iberia Luxury Homes · Agencia (admin)",
  },
  {
    email: "ines@iberialuxuryhomes.pt",
    password: DEMO_PASSWORD,
    name: "Inês Costa",
    accountType: "agency",
    role: "member",
    agencyId: "ag-5",
    label: "Iberia Luxury Homes · Agente (member)",
  },

  /* ───── Promotores externos · admin + member cada uno ─────
   *  Workspaces independientes de Luxinmo · `agencyId` actúa como
   *  organizationId. Cuando un user logea con uno de estos emails,
   *  `useCurrentUser` devuelve `accountType: "developer"` con su
   *  `agencyId` apuntando al workspace propio (prom-X). */

  /* prom-1 · AEDAS Homes */
  {
    email: "carlos.mendieta@aedashomes.es",
    password: DEMO_PASSWORD,
    name: "Carlos Mendieta",
    accountType: "developer",
    role: "admin",
    agencyId: "prom-1",
    label: "AEDAS Homes · Promotor (admin)",
  },
  {
    email: "ana@aedashomes.es",
    password: DEMO_PASSWORD,
    name: "Ana López",
    accountType: "developer",
    role: "member",
    agencyId: "prom-1",
    label: "AEDAS Homes · Comercial (member)",
  },

  /* prom-2 · Neinor Homes */
  {
    email: "marta.ribera@neinor.com",
    password: DEMO_PASSWORD,
    name: "Marta Ribera",
    accountType: "developer",
    role: "admin",
    agencyId: "prom-2",
    label: "Neinor Homes · Promotor (admin)",
  },
  {
    email: "pablo@neinor.com",
    password: DEMO_PASSWORD,
    name: "Pablo Ortega",
    accountType: "developer",
    role: "member",
    agencyId: "prom-2",
    label: "Neinor Homes · Comercial (member)",
  },

  /* prom-3 · Habitat Inmobiliaria */
  {
    email: "jordi.puig@habitatinmobiliaria.com",
    password: DEMO_PASSWORD,
    name: "Jordi Puig",
    accountType: "developer",
    role: "admin",
    agencyId: "prom-3",
    label: "Habitat Inmobiliaria · Promotor (admin)",
  },
  {
    email: "marta@habitatinmobiliaria.com",
    password: DEMO_PASSWORD,
    name: "Marta Vila",
    accountType: "developer",
    role: "member",
    agencyId: "prom-3",
    label: "Habitat Inmobiliaria · Comercial (member)",
  },

  /* prom-4 · Metrovacesa */
  {
    email: "sara.llorente@metrovacesa.com",
    password: DEMO_PASSWORD,
    name: "Sara Llorente",
    accountType: "developer",
    role: "admin",
    agencyId: "prom-4",
    label: "Metrovacesa · Promotor (admin)",
  },
  {
    email: "javier@metrovacesa.com",
    password: DEMO_PASSWORD,
    name: "Javier Rodríguez",
    accountType: "developer",
    role: "member",
    agencyId: "prom-4",
    label: "Metrovacesa · Comercial (member)",
  },

  /* ───── Agencias 6-10 · admin + member cada una ───── */

  /* ag-6 · Baltic Property Partners */
  {
    email: "aino@balticproperty.fi",
    password: DEMO_PASSWORD,
    name: "Aino Virtanen",
    accountType: "agency",
    role: "admin",
    agencyId: "ag-6",
    label: "Baltic Property Partners · Agencia (admin)",
  },
  {
    email: "jukka@balticproperty.fi",
    password: DEMO_PASSWORD,
    name: "Jukka Korhonen",
    accountType: "agency",
    role: "member",
    agencyId: "ag-6",
    label: "Baltic Property Partners · Agente (member)",
  },

  /* ag-7 · Mediterranean Lux Homes */
  {
    email: "elodie@medluxhomes.fr",
    password: DEMO_PASSWORD,
    name: "Élodie Laurent",
    accountType: "agency",
    role: "admin",
    agencyId: "ag-7",
    label: "Mediterranean Lux Homes · Agencia (admin)",
  },
  {
    email: "jean@medluxhomes.fr",
    password: DEMO_PASSWORD,
    name: "Jean Dubois",
    accountType: "agency",
    role: "member",
    agencyId: "ag-7",
    label: "Mediterranean Lux Homes · Agente (member)",
  },

  /* ag-8 · Moscow Estates */
  {
    email: "dmitri@moscowestates.ru",
    password: DEMO_PASSWORD,
    name: "Dmitri Volkov",
    accountType: "agency",
    role: "admin",
    agencyId: "ag-8",
    label: "Moscow Estates · Agencia (admin)",
  },
  {
    email: "olga@moscowestates.ru",
    password: DEMO_PASSWORD,
    name: "Olga Petrova",
    accountType: "agency",
    role: "member",
    agencyId: "ag-8",
    label: "Moscow Estates · Agente (member)",
  },

  /* ag-9 · Alpine Living */
  {
    email: "markus@alpineliving.ch",
    password: DEMO_PASSWORD,
    name: "Markus Zimmermann",
    accountType: "agency",
    role: "admin",
    agencyId: "ag-9",
    label: "Alpine Living · Agencia (admin)",
  },
  {
    email: "lara@alpineliving.ch",
    password: DEMO_PASSWORD,
    name: "Lara Müller",
    accountType: "agency",
    role: "member",
    agencyId: "ag-9",
    label: "Alpine Living · Agente (member)",
  },

  /* ag-10 · Gulf Premium Realty */
  {
    email: "khalid@gulfpremium.ae",
    password: DEMO_PASSWORD,
    name: "Khalid Al-Rashid",
    accountType: "agency",
    role: "admin",
    agencyId: "ag-10",
    label: "Gulf Premium Realty · Agencia (admin)",
  },
  {
    email: "amira@gulfpremium.ae",
    password: DEMO_PASSWORD,
    name: "Amira Hassan",
    accountType: "agency",
    role: "member",
    agencyId: "ag-10",
    label: "Gulf Premium Realty · Agente (member)",
  },
];

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
