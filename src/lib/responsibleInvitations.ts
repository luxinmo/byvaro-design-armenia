/**
 * responsibleInvitations.ts · Storage de invitaciones al Responsable
 * de una agencia (caso 1 · alta nueva donde el invitador declara que
 * NO es el dueño y propone al Responsable real).
 *
 * Diferente de `byvaro-invitaciones` (Promotor → Agencia colaboradora) ·
 * aquí el origen es un usuario admin de una agencia recién creada que
 * propone a otra persona como Responsable / dueño.
 *
 * Vida del registro:
 *   1. `pendiente`  · creado al pulsar "Enviar invitación" · email
 *      enviado · esperando que el Responsable abra el link y
 *      cree su contraseña.
 *   2. `aceptada`   · el Responsable creó la contraseña en
 *      `/responsible/:token` · automáticamente toma rol admin de la
 *      agencia, el invitador original pasa a `member`.
 *   3. `caducada`   · expira tras 30 días sin respuesta.
 *
 * Storage · `byvaro.responsible-invitations.v1` (localStorage).
 *
 * TODO(backend):
 *   POST /api/agencies/:id/invite-responsible (admin actual)
 *   GET  /api/responsible-invitations/:token (público, sin auth)
 *   POST /api/responsible-invitations/:token/accept
 *        body: { password } → server crea usuario admin + downgrade
 *        del invitador + cookie de sesión.
 */

export type ResponsibleInvitationEstado = "pendiente" | "aceptada" | "caducada";

export interface ResponsibleInvitation {
  id: string;
  token: string;
  agencyId: string;
  agencyName: string;
  /** Datos del Responsable propuesto (recibe el email). */
  responsibleEmail: string;
  responsibleName: string;
  responsibleTelefono?: string;
  /** Datos del invitador (admin actual de la agencia · pasa a member
   *  cuando el Responsable acepta). */
  inviterUserEmail: string;
  inviterUserName: string;
  estado: ResponsibleInvitationEstado;
  createdAt: number;
  expiraEn: number;
  respondidoEn?: number;
}

const STORAGE_KEY = "byvaro.responsible-invitations.v1";
const VALIDEZ_DIAS = 30;

function readAll(): ResponsibleInvitation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    /* Auto-marcar caducadas. */
    const now = Date.now();
    return (parsed as ResponsibleInvitation[]).map((i) =>
      i.estado === "pendiente" && i.expiraEn < now
        ? { ...i, estado: "caducada" as ResponsibleInvitationEstado }
        : i,
    );
  } catch {
    return [];
  }
}

function writeAll(list: ResponsibleInvitation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("byvaro:responsible-invitations-changed"));
}

function generateToken(): string {
  return Array.from({ length: 24 }, () =>
    "abcdefghjkmnpqrstuvwxyz23456789"[Math.floor(Math.random() * 31)]
  ).join("");
}

export function createResponsibleInvitation(input: {
  agencyId: string;
  agencyName: string;
  responsibleEmail: string;
  responsibleName: string;
  responsibleTelefono?: string;
  inviterUserEmail: string;
  inviterUserName: string;
}): ResponsibleInvitation {
  const now = Date.now();
  const inv: ResponsibleInvitation = {
    id: `respinv-${now}-${Math.random().toString(36).slice(2, 6)}`,
    token: generateToken(),
    agencyId: input.agencyId,
    agencyName: input.agencyName,
    responsibleEmail: input.responsibleEmail.trim().toLowerCase(),
    responsibleName: input.responsibleName.trim(),
    responsibleTelefono: input.responsibleTelefono?.trim() || undefined,
    inviterUserEmail: input.inviterUserEmail.trim().toLowerCase(),
    inviterUserName: input.inviterUserName.trim(),
    estado: "pendiente",
    createdAt: now,
    expiraEn: now + VALIDEZ_DIAS * 24 * 60 * 60 * 1000,
  };
  writeAll([inv, ...readAll()]);
  return inv;
}

export function findResponsibleInvitationByToken(
  token: string,
): ResponsibleInvitation | undefined {
  return readAll().find((i) => i.token === token);
}

export function markResponsibleInvitationAccepted(id: string): void {
  const list = readAll();
  const now = Date.now();
  writeAll(list.map((i) =>
    i.id === id ? { ...i, estado: "aceptada" as const, respondidoEn: now } : i,
  ));
}

export function buildResponsibleInviteUrl(token: string): string {
  return `${window.location.origin}/responsible/${token}`;
}
