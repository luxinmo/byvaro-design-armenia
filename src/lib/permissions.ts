/**
 * Sistema de permisos por rol del workspace.
 *
 * Cada rol tiene un conjunto de permisos (claves dot-namespaced).
 * El admin tiene todo por defecto. Los miembros tienen un subset
 * configurable desde /ajustes/usuarios/roles.
 *
 * MOCK · TODO(backend): los permisos reales se gestionan server-side
 *   y se devuelven en el JWT / sesión. El cliente NUNCA debe
 *   depender solo de este check para decisiones de seguridad.
 *   El backend valida CADA endpoint contra el rol del usuario.
 */

import { useCurrentUser, isAdmin } from "@/lib/currentUser";

export type PermissionKey =
  /** Ver TODAS las conversaciones de WhatsApp del workspace
   *  (incluyendo las de otros agentes). */
  | "whatsapp.viewAll"
  /** Ver SUS PROPIAS conversaciones de WhatsApp (las que él inició o
   *  donde el cliente le ha respondido). Permiso base. */
  | "whatsapp.viewOwn"
  /** Conectar / desconectar el canal de WhatsApp del workspace
   *  (Business API o Web). Acción de admin. */
  | "whatsapp.manageChannel"
  /** Ver / editar etiquetas de organización. */
  | "contacts.editOrgTags"
  /** Eliminar contactos. */
  | "contacts.delete"
  /** Ver el PANEL OPERATIVO de colaboración con una agencia
   *  (`/colaboradores/:id?from=<promoId>`). Contiene datos sensibles:
   *  contratos, comisiones, incidencias, top agentes. */
  | "collaboration.panel.view"
  /** Ver la lista de contratos de colaboración con una agencia. */
  | "collaboration.contracts.view"
  /** Subir un PDF de contrato y enviarlo a firmar vía Firmafy. */
  | "collaboration.contracts.manage"
  /** Ver incidencias (duplicados, cancelaciones, reclamaciones) entre
   *  empresas · datos delicados. */
  | "collaboration.incidents.view"
  /** Ver calendario de pagos y facturas de la agencia. Datos
   *  financieros: cuánto se le debe, cuánto se ha pagado, qué está
   *  bloqueado. */
  | "collaboration.payments.view"
  /** Marcar pagos como pagados, poner on-hold, cancelar, subir
   *  comprobante interno. */
  | "collaboration.payments.manage"
  /** Solicitar documentos a la agencia (factura, IBAN, certificados
   *  fiscales) + aprobar/rechazar los subidos. */
  | "collaboration.documents.manage"
  /** Ver el dashboard analítico `/actividad` — KPIs financieros
   *  (pipeline €, ventas €, ventas cerradas), embudo de conversión,
   *  rankings de miembros y agencias, salud del equipo,
   *  heatmap. Datos sensibles de negocio y de desempeño interno.
   *  Admin-only por defecto. */
  | "activity.dashboard.view"
  /** Ver datos sensibles del cliente con el que coincide un
   *  registro entrante en el diálogo de confirmación de match
   *  (nombre completo · email). Sin este permiso se muestra solo
   *  "un contacto existente" sin identificarlo. Admin-only. */
  | "records.matchDetails.view";

const STORAGE_KEY = "byvaro.workspace.rolePermissions.v1";

export type RolePermissions = Record<string, PermissionKey[]>;

export const DEFAULT_ROLE_PERMISSIONS: RolePermissions = {
  admin: [
    "whatsapp.viewAll", "whatsapp.viewOwn", "whatsapp.manageChannel",
    "contacts.editOrgTags", "contacts.delete",
    "collaboration.panel.view", "collaboration.contracts.view",
    "collaboration.contracts.manage", "collaboration.incidents.view",
    "collaboration.payments.view", "collaboration.payments.manage",
    "collaboration.documents.manage",
    "activity.dashboard.view",
    "records.matchDetails.view",
  ],
  member: [
    "whatsapp.viewOwn",
  ],
};

export function loadRolePermissions(): RolePermissions {
  if (typeof window === "undefined") return DEFAULT_ROLE_PERMISSIONS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ROLE_PERMISSIONS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_ROLE_PERMISSIONS, ...parsed };
  } catch { return DEFAULT_ROLE_PERMISSIONS; }
}

export function saveRolePermissions(perms: RolePermissions): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(perms));
}

export function hasPermission(role: string, key: PermissionKey): boolean {
  const perms = loadRolePermissions();
  return (perms[role] ?? []).includes(key);
}

/** Hook para usar en componentes con el usuario actual. */
export function useHasPermission(key: PermissionKey): boolean {
  const user = useCurrentUser();
  /* Admin tiene todos los permisos por defecto, ignorando lo que diga
   * el config (escudo extra para evitar lock-out accidental). */
  if (isAdmin(user)) return true;
  return hasPermission(user.role, key);
}
