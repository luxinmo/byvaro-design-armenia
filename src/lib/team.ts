/**
 * Catálogo único del equipo del workspace.
 *
 * Todos los selectores de "agente / usuario / asignado" en la app
 * deben tirar de aquí (no hardcodear listas en cada componente). Y
 * todos deben usar `<UserSelect>` para mantener UX consistente.
 *
 * TODO(backend): GET /api/workspace/members → array tipado igual a
 *   TeamMember. Reemplazar `TEAM_MEMBERS` por la respuesta de la API
 *   y exponer `useTeam()` con caché.
 */

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member";
  jobTitle?: string;
  /** URL del avatar. Si no hay, se usan iniciales. */
  avatarUrl?: string;
};

export const TEAM_MEMBERS: TeamMember[] = [
  { id: "u1", name: "Arman Rahmanov", email: "arman@byvaro.com", role: "admin",  jobTitle: "Director comercial" },
  { id: "u2", name: "Laura Gómez",    email: "laura@byvaro.com", role: "member", jobTitle: "Comercial senior" },
  { id: "u3", name: "Diego Sánchez",  email: "diego@byvaro.com", role: "member", jobTitle: "Comercial" },
  { id: "u4", name: "Marta Jiménez",  email: "marta@byvaro.com", role: "member", jobTitle: "Coordinadora" },
];

/** Busca por id o por nombre (case-insensitive). */
export function findTeamMember(idOrName: string): TeamMember | undefined {
  const q = idOrName.trim().toLowerCase();
  return TEAM_MEMBERS.find(
    (m) => m.id.toLowerCase() === q || m.name.toLowerCase() === q,
  );
}

/** Iniciales (2 chars máx) para el avatar fallback. */
export function memberInitials(member: Pick<TeamMember, "name">): string {
  return member.name
    .split(" ").filter(Boolean).slice(0, 2)
    .map((w) => w[0]).join("").toUpperCase() || "?";
}

/**
 * URL del avatar a usar para un miembro del equipo.
 *  - Si el miembro tiene `avatarUrl` propio (subido por el admin), se usa.
 *  - Si no, generamos una URL determinista de Pravatar a partir del
 *    email para que cada miembro tenga "su cara" estable.
 *
 * TODO(backend): cuando los miembros suban avatar real, reemplazar
 *   pravatar por la URL firmada de S3/equivalente.
 */
export function getMemberAvatarUrl(member: Pick<TeamMember, "email" | "avatarUrl">): string {
  if (member.avatarUrl) return member.avatarUrl;
  return `https://i.pravatar.cc/150?u=${encodeURIComponent(member.email)}`;
}

/**
 * Versión por nombre — busca el miembro y devuelve su avatar.
 * Si no existe en el equipo (p.ej. agente histórico que ya no está),
 * devuelve un avatar pravatar usando el nombre como seed.
 */
export function getAvatarUrlByName(name: string): string {
  const member = findTeamMember(name);
  if (member) return getMemberAvatarUrl(member);
  return `https://i.pravatar.cc/150?u=${encodeURIComponent(name)}`;
}
