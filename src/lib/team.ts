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

export const TEAM_MEMBERS: TeamMember[] = [
  { id: "u1", name: "Arman Rahmanov", email: "arman@byvaro.com", role: "admin",
    jobTitle: "Founder & Co-Founder", department: "Dirección",
    languages: ["ES", "EN", "RU", "HY"],
    phone: "+34 612 345 678",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=320&h=320&fit=crop",
    status: "active", visibleOnProfile: true, canSign: true, canAcceptRegistrations: true,
    joinedAt: "2026-01-12T10:00:00Z", lastActiveAt: "2026-04-23T16:40:00Z",
    emailAccountsCount: 2, emailsSentLast30d: 142,
    whatsappLinked: true, twoFactorEnabled: true, recordsDecidedLast30d: 28,
    commissionCapturePct: 20, commissionSalePct: 40 },
  { id: "u2", name: "Laura Gómez", email: "laura@byvaro.com", role: "member",
    jobTitle: "Senior Property Consultant", department: "Comercial",
    languages: ["ES", "EN", "FR", "IT"],
    phone: "+34 611 223 344",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=320&h=320&fit=crop",
    status: "active", visibleOnProfile: true, canAcceptRegistrations: true,
    joinedAt: "2026-02-20T10:00:00Z", lastActiveAt: "2026-04-23T14:15:00Z",
    emailAccountsCount: 1, emailsSentLast30d: 87,
    whatsappLinked: true, twoFactorEnabled: true, recordsDecidedLast30d: 16,
    commissionCapturePct: 15, commissionSalePct: 35 },
  { id: "u3", name: "Diego Sánchez", email: "diego@byvaro.com", role: "member",
    jobTitle: "Property Consultant", department: "Comercial",
    languages: ["ES", "DE", "NL"],
    phone: "+34 633 998 877",
    avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=320&h=320&fit=crop",
    status: "active", visibleOnProfile: true,
    joinedAt: "2026-03-05T10:00:00Z", lastActiveAt: "2026-04-22T09:30:00Z",
    emailAccountsCount: 1, emailsSentLast30d: 43,
    whatsappLinked: false, twoFactorEnabled: false, recordsDecidedLast30d: 4,
    commissionCapturePct: 10, commissionSalePct: 25 },
  { id: "u4", name: "Marta Jiménez", email: "marta@byvaro.com", role: "member",
    jobTitle: "Listings Coordinator", department: "Comercial",
    languages: ["ES", "EN", "AR"],
    avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=320&h=320&fit=crop",
    status: "active", visibleOnProfile: false,
    joinedAt: "2026-04-01T10:00:00Z", lastActiveAt: "2026-04-21T18:00:00Z",
    emailAccountsCount: 0, emailsSentLast30d: 0,
    whatsappLinked: false, twoFactorEnabled: true, recordsDecidedLast30d: 0 },
  { id: "u5", name: "Sophie Martin", email: "sophie.martin@byvaro.com", role: "member",
    jobTitle: "Real Estate Agent", department: "Comercial",
    languages: ["FR", "EN", "ES"],
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=320&h=320&fit=crop",
    status: "invited",
    joinedAt: "2026-04-22T10:00:00Z" },
  { id: "u6", name: "Thomas Weber", email: "thomas.weber@weberpromo.com", role: "member",
    status: "pending",
    joinedAt: "2026-04-23T09:00:00Z" },
  { id: "u7", name: "Isabel Fernández", email: "isabel@byvaro.com", role: "member",
    jobTitle: "Property Consultant", department: "Comercial",
    languages: ["ES", "EN", "PT", "ZH"],
    phone: "+34 677 112 233",
    avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=320&h=320&fit=crop",
    status: "active", visibleOnProfile: true, canAcceptRegistrations: true,
    joinedAt: "2026-02-15T10:00:00Z", lastActiveAt: "2026-04-23T11:20:00Z",
    emailAccountsCount: 1, emailsSentLast30d: 64,
    whatsappLinked: true, twoFactorEnabled: true, recordsDecidedLast30d: 11,
    commissionCapturePct: 15, commissionSalePct: 30 },
  { id: "u8", name: "Carlos Ruiz", email: "carlos.ruiz@byvaro.com", role: "admin",
    jobTitle: "Accountant", department: "Administración",
    languages: ["ES"],
    phone: "+34 655 009 988",
    status: "deactive",
    joinedAt: "2026-01-20T10:00:00Z", lastActiveAt: "2026-03-14T12:00:00Z",
    emailAccountsCount: 1, emailsSentLast30d: 0,
    whatsappLinked: false, twoFactorEnabled: true, recordsDecidedLast30d: 0 },
];

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
  return TEAM_MEMBERS;
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
    const raw = window.localStorage.getItem(teamStorageKey(workspaceKey));
    if (raw) {
      const parsed = JSON.parse(raw) as TeamMember[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    /* Migración legacy · solo developer. */
    if (workspaceKey === "developer-default") {
      const legacyRaw = window.localStorage.getItem(TEAM_BASE_KEY);
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
