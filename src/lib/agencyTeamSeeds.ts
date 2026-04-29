/**
 * agencyTeamSeeds.ts · seed determinista del equipo de cada agencia.
 *
 * El prototipo arrancó como single-tenant — todos los stores leían
 * `TEAM_MEMBERS` de `team.ts` (el equipo del promotor). Cuando una
 * agencia entraba a `/equipo` o a `/empresa` veía el equipo del
 * promotor, no el suyo · era una fuga del modelo dual-role.
 *
 * Ahora cada workspace tiene su propio listado:
 *   · developer-default → TEAM_MEMBERS (promotor Luxinmo).
 *   · agency-<agencyId>  → seeds derivados aquí.
 *
 * Construimos el seed de cada agencia desde `mockUsers.ts` (los
 * usuarios demo con `accountType: "agency"` ya tienen `agencyId`,
 * email, nombre y role admin/member). Añadimos campos visuales
 * coherentes (avatar, jobTitle, idiomas inferidos por país) para
 * que la pantalla `/equipo` tenga datos demo realistas.
 *
 * TODO(backend): cuando exista `GET /api/workspace/members`, este
 * archivo se elimina. La función `getMembersForWorkspace` se
 * convierte en wrapper sobre la respuesta del endpoint.
 */

import { mockUsers } from "@/data/mockUsers";
import { agencies } from "@/data/agencies";
import { _registerAgencyTeamBuilder, type TeamMember } from "./team";

/* ─── Helpers ─────────────────────────────────────────────────────── */

/* Idiomas razonables por agencia (infiere por mercados de la seed
 * `agencies.ts` cuando los hay; cae a [es, en] como base europea). */
function inferLanguages(agencyId: string): string[] {
  const a = agencies.find((x) => x.id === agencyId);
  if (!a) return ["ES", "EN"];
  const langs = new Set<string>(["EN"]);
  if (a.mercados?.includes("ES") || a.location?.toLowerCase().includes("spain")) langs.add("ES");
  if (a.mercados?.includes("FR")) langs.add("FR");
  if (a.mercados?.includes("DE")) langs.add("DE");
  if (a.mercados?.includes("NL")) langs.add("NL");
  if (a.mercados?.includes("PT") || a.location?.toLowerCase().includes("lisbon")) langs.add("PT");
  if (a.mercados?.includes("SE") || a.location?.toLowerCase().includes("stockholm")) langs.add("SV");
  if (a.location?.toLowerCase().includes("london") || a.location?.toLowerCase().includes("uk")) langs.add("EN");
  return Array.from(langs);
}

/* Avatar determinista por email · evita el efecto "siempre la misma
 * cara" cuando hay muchos miembros mock. */
function avatarFor(email: string): string {
  return `https://i.pravatar.cc/320?u=${encodeURIComponent(email)}`;
}

/* Job title razonable según el rol · admin = Director / Partner ·
 * member = Property Consultant. */
function jobTitleFor(role: "admin" | "member"): string {
  return role === "admin" ? "Director / Partner" : "Property Consultant";
}

/* ─── Builder ─────────────────────────────────────────────────────── */

/* Pool determinista de nombres por mercado · usado para padding
 * sintético cuando `teamSize` del seed > nº de mockUsers reales (los
 * mockUsers son los que pueden hacer login; los sintéticos solo
 * aparecen como miembros del equipo en `/equipo` y `/empresa` para
 * que la cuenta visible coincida con el "12 agentes" pintado en la
 * card). El pool se elige por country code de los mercados de la
 * agencia · si no matchea, cae en pool ES/EN. */
const NAME_POOLS: Record<string, string[]> = {
  ES: ["Carlos Ruiz","Marta López","Diego Pérez","Lucía García","Pablo Martín","Sara Fernández","Andrés Romero","Beatriz Castro","Javier Ortega","Elena Navarro"],
  GB: ["Oliver Bennett","Charlotte Hayes","George Mitchell","Sophie Turner","Henry Walsh","Amelia Reed","Jack Howard","Isabella Knight","William Owen","Florence Page"],
  IE: ["Aisling Murphy","Cillian O'Brien","Niamh Doyle","Finn Kelly"],
  NL: ["Lars Visser","Anouk de Boer","Daan van Dijk","Sanne Bakker","Bram Mulder","Eva Smit"],
  BE: ["Lucas Janssens","Camille Dubois","Maxime Peeters","Léa Vermeulen"],
  DE: ["Maximilian Weber","Hannah Becker","Leon Schäfer","Mia Hoffmann"],
  FR: ["Antoine Moreau","Camille Rousseau","Théo Lefebvre","Léna Dupont"],
  IT: ["Matteo Russo","Giulia Conti","Lorenzo Bianchi","Sofia Ricci"],
  PT: ["Ricardo Silva","Mariana Santos","Tiago Pereira","Beatriz Costa","Gonçalo Ferreira","Inês Rodrigues"],
  SE: ["Linnea Andersson","Oscar Karlsson","Astrid Nilsson","Hugo Eriksson","Wilma Larsson","Axel Olsson","Ebba Persson","Liam Svensson"],
  NO: ["Henrik Hansen","Ingrid Olsen","Magnus Berg","Sofie Jensen"],
  DK: ["Mads Christensen","Frida Jørgensen","Emil Madsen","Saga Pedersen"],
  FI: ["Aino Korhonen","Onni Virtanen","Lumi Mäkelä","Eetu Niemi"],
  RU: ["Anastasia Volkova","Mikhail Sokolov","Ekaterina Petrova","Dmitry Ivanov"],
  CH: ["Jonas Müller","Lara Keller","Noah Schmid","Mia Steiner"],
  US: ["Ethan Brooks","Madison Cole","Tyler Reed","Avery Bennett"],
};

const JOB_TITLES_MEMBER = [
  "Property Consultant",
  "Senior Sales Agent",
  "International Liaison",
  "Lead Generation Specialist",
  "Closing Specialist",
  "Buyer's Agent",
  "Listing Agent",
  "Investor Relations",
  "Marketing Coordinator",
  "Client Success Manager",
];

function namePoolFor(agencyId: string): string[] {
  const a = agencies.find((x) => x.id === agencyId);
  const markets = a?.mercados ?? [];
  const pool: string[] = [];
  /* Mezclamos nombres del mercado primario + complementos ES/GB para
   * tener variedad sin repetir. Mantenemos orden estable per-agencia. */
  for (const m of markets) {
    const list = NAME_POOLS[m];
    if (list) pool.push(...list);
  }
  if (pool.length === 0) pool.push(...NAME_POOLS.ES, ...NAME_POOLS.GB);
  return pool;
}

/** Devuelve el equipo seed para una agencia · derivado de mockUsers
 *  + padding sintético hasta `teamSize` para que el counter público
 *  ("12 agentes") coincida con lo que se ve en `/equipo` y en el
 *  tab Equipo de `/empresa`. Sin esto hay disonancia visible cross
 *  -screen. Los sintéticos NO pueden hacer login (no están en
 *  `mockUsers`) · solo existen como filas de la tabla equipo del
 *  workspace mock. */
export function buildAgencyTeam(agencyId: string): TeamMember[] {
  const users = mockUsers.filter(
    (u) => u.accountType === "agency" && u.agencyId === agencyId,
  );
  const langs = inferLanguages(agencyId);
  const realMembers: TeamMember[] = users.map((u, idx) => ({
    id: u.teamMemberId ?? `${agencyId}-m${idx + 1}`,
    name: u.name,
    email: u.email,
    role: u.role ?? "member",
    jobTitle: jobTitleFor(u.role ?? "member"),
    department: "Comercial",
    languages: langs,
    avatarUrl: avatarFor(u.email),
    status: "active",
    visibleOnProfile: true,
    canSign: u.role === "admin",
    canAcceptRegistrations: true,
    joinedAt: "2026-01-15T10:00:00Z",
    lastActiveAt: "2026-04-23T12:00:00Z",
    emailAccountsCount: 1,
    emailsSentLast30d: 30 + idx * 12,
    whatsappLinked: u.role === "admin",
    twoFactorEnabled: u.role === "admin",
    recordsDecidedLast30d: 5 + idx * 3,
  }));

  /* Padding sintético · si la agency tiene `teamSize` declarado y es
   *  mayor que el nº real de mockUsers, generamos miembros
   *  determinísticos hasta llegar a ese número. Si no hay teamSize o
   *  los mockUsers ya cubren la cifra, devolvemos solo los reales. */
  const a = agencies.find((x) => x.id === agencyId);
  const targetSize = a?.teamSize ?? realMembers.length;
  if (targetSize <= realMembers.length) return realMembers;

  const pool = namePoolFor(agencyId);
  const padCount = targetSize - realMembers.length;
  const synthetic: TeamMember[] = [];
  for (let i = 0; i < padCount; i++) {
    const name = pool[i % pool.length];
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, ".");
    const emailDomain = users[0]?.email.split("@")[1] ?? `${agencyId}.byvaro.demo`;
    const synthEmail = `${slug}@${emailDomain}`;
    synthetic.push({
      id: `${agencyId}-syn-${i + 1}`,
      name,
      email: synthEmail,
      role: "member",
      jobTitle: JOB_TITLES_MEMBER[i % JOB_TITLES_MEMBER.length],
      department: i % 3 === 0 ? "Marketing" : "Comercial",
      languages: langs,
      avatarUrl: avatarFor(synthEmail),
      status: "active",
      visibleOnProfile: true,
      canSign: false,
      canAcceptRegistrations: true,
      joinedAt: new Date(Date.parse("2025-06-01") + i * 14 * 24 * 60 * 60 * 1000).toISOString(),
      lastActiveAt: new Date(Date.parse("2026-04-23") - i * 2 * 24 * 60 * 60 * 1000).toISOString(),
      emailAccountsCount: 1,
      emailsSentLast30d: 12 + (i * 5) % 40,
      whatsappLinked: i % 2 === 0,
      twoFactorEnabled: false,
      recordsDecidedLast30d: 2 + (i * 3) % 12,
    });
  }
  return [...realMembers, ...synthetic];
}

/* Auto-registramos el builder en team.ts al cargar este módulo. Se
 * importa desde el hook useWorkspaceMembers (o desde Empresa/Equipo)
 * la primera vez que el usuario logueado es agency · a partir de ahí
 * `getMembersForWorkspace("agency-…")` ya devuelve datos. */
_registerAgencyTeamBuilder(buildAgencyTeam);
