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

/** Devuelve el equipo seed para una agencia · derivado de mockUsers. */
export function buildAgencyTeam(agencyId: string): TeamMember[] {
  const users = mockUsers.filter(
    (u) => u.accountType === "agency" && u.agencyId === agencyId,
  );
  if (users.length === 0) {
    /* Sin mockUsers para esta agencia (p.ej. ag-6+ que solo existen
     * como solicitudes pendientes). Devolvemos lista vacía · la
     * pantalla muestra el empty-state estándar. */
    return [];
  }
  const langs = inferLanguages(agencyId);
  return users.map((u, idx) => ({
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
}

/* Auto-registramos el builder en team.ts al cargar este módulo. Se
 * importa desde el hook useWorkspaceMembers (o desde Empresa/Equipo)
 * la primera vez que el usuario logueado es agency · a partir de ahí
 * `getMembersForWorkspace("agency-…")` ya devuelve datos. */
_registerAgencyTeamBuilder(buildAgencyTeam);
