import { memCache } from "./memCache";
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

/**
 * Estado del miembro dentro de la organización.
 * - `active`   · cuenta operativa, puede entrar.
 * - `invited`  · enviada invitación por email, aún no ha aceptado.
 * - `pending`  · ha solicitado unirse (por dominio de email) y espera aprobación del admin.
 * - `deactive` · antiguo miembro desactivado — no puede entrar pero sus datos se conservan.
 */
export type TeamMemberStatus = "active" | "invited" | "pending" | "deactive";

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member";
  jobTitle?: string;
  department?: string;
  languages?: string[];
  /** Número completo con prefijo internacional · `+34 600 000 000`. */
  phone?: string;
  /** URL del avatar. Si no hay, se usan iniciales. */
  avatarUrl?: string;
  /** Biografía breve (280 chars) · firma de email y perfil interno. */
  bio?: string;
  status?: TeamMemberStatus;
  /** Aparece en el perfil público de la empresa / microsite. */
  visibleOnProfile?: boolean;
  /** Puede firmar contratos en nombre de la empresa. */
  canSign?: boolean;
  /** Puede aprobar/rechazar registros entrantes de agencias. */
  canAcceptRegistrations?: boolean;
  joinedAt?: string;    // ISO
  lastActiveAt?: string; // ISO
  /* ─── Señales de estado · usadas en el dashboard del admin
     cuando abre la ficha del miembro para valorar su salud. ─── */
  /** Cuántas cuentas de email ha conectado en `/emails`. 0 = sin email. */
  emailAccountsCount?: number;
  /** Número de correos enviados desde el workspace en los últimos 30 días. */
  emailsSentLast30d?: number;
  /** Tiene WhatsApp Business vinculado. */
  whatsappLinked?: boolean;
  /** Tiene 2FA activa. */
  twoFactorEnabled?: boolean;
  /** Cuántos registros ha aprobado/rechazado en los últimos 30 días. */
  recordsDecidedLast30d?: number;
  /* ─── Plan de comisiones · opcional ─────────────────────────────
     Porcentajes `0-100`. Cuando `undefined`, el miembro hereda el
     plan por defecto del workspace o no tiene comisión (p. ej.
     admin técnico, coordinadora). */
  /** % que se lleva por captación (traer un lead al sistema). */
  commissionCapturePct?: number;
  /** % que se lleva por cerrar la venta asociada a un registro. */
  commissionSalePct?: number;
};

export const TEAM_MEMBERS: TeamMember[] = [];

/* ─── Multi-tenant: equipo por workspace ──────────────────────────
 *
 * El prototipo arrancó single-tenant: una sola key
 * `byvaro.organization.members.v4` con TEAM_MEMBERS (equipo del
 * promotor) leída desde TODAS las pantallas. Cuando se introdujo el
 * dual-role (developer + agency), las agencias acabaron viendo el
 * equipo del promotor en `/equipo`, en `/empresa` (tab Equipo), en
 * los selectores de miembros, etc. — fuga del modelo dual-role.
 *
 * Ahora cada workspace tiene su propia clave:
 *   `byvaro.organization.members.v4:${workspaceKey}`
 *   donde `workspaceKey = currentWorkspaceKey(user)`.
 *
 * Seeds:
 *   · developer-default → TEAM_MEMBERS (constante de este archivo).
 *   · agency-<agencyId>  → buildAgencyTeam(agencyId) en
 *     `agencyTeamSeeds.ts` (deriva de mockUsers + agencies).
 *
 * Patrón canónico — ver REGLA DE ORO "Datos del workspace son por
 * tenant" en CLAUDE.md.
 *
 * TODO(backend): cuando exista `GET /api/workspace/members`, este
 * helper se reemplaza por una llamada al endpoint scoped al
 * workspace del JWT.
 */

/* Base key (compat con código que aún no pasa workspaceKey). */
const TEAM_BASE_KEY = "byvaro.organization.members.v4";

/** Key de localStorage para el equipo de un workspace concreto. */
export function teamStorageKey(workspaceKey: string): string {
  return `${TEAM_BASE_KEY}:${workspaceKey}`;
}

/** Seed de fallback para un workspace · sincrono · sin tocar storage. */
export function seedMembersForWorkspace(workspaceKey: string): TeamMember[] {
  if (workspaceKey === "developer-default") return TEAM_MEMBERS;
  if (workspaceKey.startsWith("agency-")) {
    const agencyId = workspaceKey.slice("agency-".length);
    /* Lazy require para evitar ciclo team.ts ↔ agencyTeamSeeds.ts ↔
     * mockUsers.ts. `require` no rula con Vite ESM, así que importamos
     * de manera estática desde el helper interno (ver buildAgencyTeam). */
    return buildAgencyTeamSafe(agencyId);
  }
  /* Workspaces developer no-Luxinmo (`prom-1` AEDAS, `prom-2` Neinor,
   *  etc.) arrancan SIN equipo seeded · no fallback a TEAM_MEMBERS de
   *  Luxinmo · si no, los miembros u1...u8 de Luxinmo aparecen como
   *  equipo de Carlos/Marta/Sara y leakean en /inicio, /equipo y
   *  selectores de miembros. */
  return [];
}

/* Wrapper que importa `buildAgencyTeam` perezosamente para no crear
 * ciclo de imports. En runtime el módulo ya está disponible. */
let _buildAgencyTeam: ((id: string) => TeamMember[]) | null = null;
function buildAgencyTeamSafe(agencyId: string): TeamMember[] {
  if (!_buildAgencyTeam) {
    /* Nota: se inyecta en `agencyTeamSeeds.ts` durante su carga ·
     * si nunca se importa, devolvemos []. */
    return [];
  }
  return _buildAgencyTeam(agencyId);
}
export function _registerAgencyTeamBuilder(fn: (id: string) => TeamMember[]) {
  _buildAgencyTeam = fn;
}

/**
 * Devuelve la lista efectiva de miembros de UN workspace concreto.
 * Lee primero `localStorage[teamStorageKey(workspaceKey)]` y cae al
 * seed si está vacío o falla parseo.
 *
 * Migración legacy: si la clave nueva está vacía pero existe la vieja
 * `byvaro.organization.members.v4` Y `workspaceKey === "developer-default"`,
 * leemos la vieja (compat con prototipo single-tenant). Las agencias
 * NUNCA heredan de la clave global · su seed es propio.
 */
export function getMembersForWorkspace(workspaceKey: string): TeamMember[] {
  const seed = seedMembersForWorkspace(workspaceKey);
  if (typeof window === "undefined") return seed;
  try {
    const raw = memCache.getItem(teamStorageKey(workspaceKey));
    if (raw) {
      const parsed = JSON.parse(raw) as TeamMember[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    /* Migración legacy · solo developer. */
    if (workspaceKey === "developer-default") {
      const legacyRaw = memCache.getItem(TEAM_BASE_KEY);
      if (legacyRaw) {
        const parsed = JSON.parse(legacyRaw) as TeamMember[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    }
    return seed;
  } catch {
    return seed;
  }
}

/**
 * Compat — devuelve los miembros del workspace developer (legacy).
 * Solo usar desde código que NO tiene contexto del usuario actual
 * (helpers puros que nunca van a ver una agencia). Para todo lo
 * demás usar `getMembersForWorkspace(workspaceKey)`.
 */
export function getAllTeamMembers(): TeamMember[] {
  return getMembersForWorkspace("developer-default");
}

/** Busca por id o por nombre (case-insensitive) · datos vivos de localStorage. */
export function findTeamMember(idOrName: string): TeamMember | undefined {
  const q = idOrName.trim().toLowerCase();
  return getAllTeamMembers().find(
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
