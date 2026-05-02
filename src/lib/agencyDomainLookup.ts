/**
 * agencyDomainLookup.ts · Detecta a qué agencia pertenece un email
 * por su dominio (ej. `juan@primeproperties.com` → Prime Properties).
 *
 * Sirve para distinguir 3 casos al recibir una invitación:
 *
 *   1. Email exactamente registrado en mockUsers / created users →
 *      caso 2b · login normal.
 *
 *   2. Email NO registrado pero dominio matchea con una agencia
 *      existente → caso 2c · "tu empresa ya está en Byvaro · pide a
 *      tu admin que te invite al equipo". El admin de esa agencia
 *      recibe notificación in-app + email para invitar al miembro.
 *
 *   3. Ni email ni dominio matchean → caso 1 · alta nueva (wizard).
 *
 * El dominio se compara case-insensitive y trim. Subdominios cuentan
 * como dominios distintos (`juan@dev.primeproperties.com` NO matchea
 * con `primeproperties.com` para evitar falsos positivos en clientes
 * con mail privado tipo Gmail/Outlook · solo dominios corporativos).
 *
 * TODO(backend): tabla `agency_email_domains(agency_id, domain,
 * verified_at)` con verificación DNS opcional · evita que cualquiera
 * registre `gmail.com` y secuestre invitaciones de Gmail. En frontend
 * mock filtramos los dominios "públicos" (gmail, hotmail, outlook…)
 * para no caer en el problema.
 */

import { agencies as SEED_AGENCIES, type Agency } from "@/data/agencies";
import { memCache } from "./memCache";
import { mockUsers, type MockUser } from "@/data/mockUsers";
import { isPublicEmailDomain, getEmailDomain } from "@/data/emailDomains";

/** Devuelve el dominio en minúscula SOLO si es corporativo · null si
 *  el email es público (gmail, etc.), inválido o vacío. Se delega a
 *  `src/data/emailDomains.ts` el catálogo de dominios públicos. */
function getDomain(email: string | null | undefined): string | null {
  if (!email) return null;
  if (isPublicEmailDomain(email)) return null;
  return getEmailDomain(email);
}

export interface DomainMatchResult {
  agency: Agency;
  /** Usuario admin de la agencia (si existe en seed o en created
   *  users) · usado para enviar notif al admin · email + name. */
  adminUser: { email: string; name: string } | undefined;
}

/** Busca una agencia por dominio del email · cruzando seed +
 *  localStorage. Devuelve undefined si:
 *    - el dominio es público (gmail, etc.)
 *    - no hay agencia con ese dominio
 *    - el email matchea exactamente a un user (caso 2b · ya hay
 *      lookup directo aparte). */
export function findAgencyByEmailDomain(
  email: string,
): DomainMatchResult | undefined {
  const dom = getDomain(email);
  if (!dom) return undefined;

  /* 1. Buscamos agencias del seed cuyo `contactoPrincipal.email`
   *    pertenezca a ese dominio. */
  const matches: Agency[] = [];
  for (const a of SEED_AGENCIES) {
    const cpEmail = a.contactoPrincipal?.email;
    const cpDom = getDomain(cpEmail);
    if (cpDom === dom) matches.push(a);
  }

  /* 2. También cruzamos `mockUsers` · alguien podría tener un user
   *    con dominio Y agencyId aunque no sea el contactoPrincipal. */
  const seedUsersWithDomain = mockUsers.filter((u) => {
    if (u.accountType !== "agency" || !u.agencyId) return false;
    return getDomain(u.email) === dom;
  });
  for (const u of seedUsersWithDomain) {
    const a = SEED_AGENCIES.find((x) => x.id === u.agencyId);
    if (a && !matches.some((m) => m.id === a.id)) matches.push(a);
  }

  /* 3. Y el storage local de usuarios creados via signup. */
  if (typeof window !== "undefined") {
    try {
      const raw = memCache.getItem("byvaro.users.created.v1");
      if (raw) {
        const arr = JSON.parse(raw) as MockUser[];
        for (const u of arr) {
          if (u.accountType !== "agency" || !u.agencyId) continue;
          if (getDomain(u.email) !== dom) continue;
          /* La agencia puede estar en seed o en created. */
          let a = SEED_AGENCIES.find((x) => x.id === u.agencyId);
          if (!a) {
            try {
              const rawA = memCache.getItem("byvaro.agencies.created.v1");
              if (rawA) {
                const arrA = JSON.parse(rawA) as Agency[];
                a = arrA.find((x) => x.id === u.agencyId);
              }
            } catch { /* noop */ }
          }
          if (a && !matches.some((m) => m.id === a!.id)) matches.push(a);
        }
      }
    } catch { /* noop */ }
  }

  if (matches.length === 0) return undefined;

  /* Si hay varias agencias con el mismo dominio (raro pero posible),
   * preferimos la primera del seed · backend deberá decidir cuál
   * según verificación de dominio. */
  const agency = matches[0];

  /* Resolver admin user · primero seed mockUsers, luego created. */
  let adminUser: { email: string; name: string } | undefined;
  const seedAdmin = mockUsers.find(
    (u) => u.accountType === "agency"
      && u.agencyId === agency.id
      && u.role === "admin",
  );
  if (seedAdmin) {
    adminUser = { email: seedAdmin.email, name: seedAdmin.name };
  } else if (typeof window !== "undefined") {
    try {
      const raw = memCache.getItem("byvaro.users.created.v1");
      if (raw) {
        const arr = JSON.parse(raw) as MockUser[];
        const admin = arr.find(
          (u) => u.accountType === "agency"
            && u.agencyId === agency.id
            && u.role === "admin",
        );
        if (admin) adminUser = { email: admin.email, name: admin.name };
      }
    } catch { /* noop */ }
  }
  /* Fallback al contactoPrincipal del seed · puede que no haya
   * mockUser pero sí esté el contacto humano del seed. */
  if (!adminUser && agency.contactoPrincipal) {
    adminUser = {
      email: agency.contactoPrincipal.email,
      name: agency.contactoPrincipal.nombre,
    };
  }

  return { agency, adminUser };
}
