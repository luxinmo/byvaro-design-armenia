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
  /** Aceptar / rechazar / restaurar solicitudes de colaboración que
   *  envían las agencias (tab Pendientes/Descartadas en el drawer
   *  de `/colaboradores`). Sin esto el usuario VE las solicitudes
   *  pero no puede mover su estado. Admin-only por defecto. */
  | "collaboration.requests.manage"
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
  | "records.matchDetails.view"
  /* ═══════════════════════════════════════════════════════════════
     Permisos backend-dual-role · alineados con
     `docs/backend-dual-role-architecture.md §6`. Default solo admin
     (en `DEFAULT_ROLE_PERMISSIONS` abajo). Cuando aterrice backend,
     cada endpoint mutante valida estas keys server-side · el
     frontend solo OCULTA UI · NO es de confianza.
     ═══════════════════════════════════════════════════════════════ */
  /** Editar el perfil público y privado de la organización
   *  (`organizations` + `organization_profiles`). Cubre nombre
   *  comercial, razón social, CIF, dirección, descripción, logo,
   *  cover, color corporativo, idiomas, marketing snapshot, etc.
   *  Backend · `PATCH /organizations/me`. */
  | "organization.editProfile"
  /** CRUD de oficinas del workspace · crear, editar, archivar,
   *  marcar principal. Backend ·
   *  `POST/PATCH/DELETE /organizations/me/offices`. */
  | "offices.manage"
  /** Invitar / desactivar / cambiar rol de miembros del equipo.
   *  Cubre el flujo de handover obligatorio al desactivar. Backend ·
   *  `POST/PATCH/DELETE /organizations/me/members` y
   *  `POST /members/:id/handover`. */
  | "members.manage"
  /** Crear una promoción (activa o draft). El gate de paywall
   *  (`createPromotion` · 2/5 según tier) es ortogonal · ese vive en
   *  `usageGuard.ts` y se enforce con HTTP 402. Backend ·
   *  `POST /promotions`. */
  | "promotions.create"
  /** Editar una promoción ya creada · cambios al hero, unidades,
   *  precios, brochure, contactos, marketing rules. Backend ·
   *  `PATCH /promotions/:id`. */
  | "promotions.edit"
  /** Transicionar una promoción a `status='active'` (publicar) o de
   *  vuelta a `paused/archived`. Es una sub-acción de `edit` que
   *  algunos flujos prefieren gating por separado · admin-only por
   *  defecto. Backend · `PATCH /promotions/:id { status }`. */
  | "promotions.publish"
  /* ═══════════════════════════════════════════════════════════════
     Permisos de VISIBILIDAD por OWNERSHIP · `*.viewAll` / `*.viewOwn`.
     Modelo doc en `docs/permissions.md §1`:
       · `viewAll` ve TODOS los registros del workspace.
       · `viewOwn` ve solo los registros donde el usuario aparece como
         owner (assigned_to / agentUserId / assigneeUserId / etc).
       · `viewAll` IMPLICA `viewOwn` (el filtro se desactiva).
     Default · admin viewAll en todos · member viewOwn en todos.
     ═══════════════════════════════════════════════════════════════ */
  /** Ver TODOS los contactos del workspace. */
  | "contacts.viewAll"
  /** Ver solo contactos donde el usuario está en `assignedTo`. */
  | "contacts.viewOwn"
  /** Ver TODOS los registros entrantes del workspace. */
  | "records.viewAll"
  /** Ver solo registros donde el usuario es `decidedByUserId`. Pendientes
   *  sin owner se consideran "del workspace" · solo aparecen con viewAll. */
  | "records.viewOwn"
  /** Ver TODAS las oportunidades (leads) del workspace. */
  | "opportunities.viewAll"
  /** Ver solo oportunidades donde `agentUserId === user.id`. */
  | "opportunities.viewOwn"
  /** Ver TODAS las ventas del workspace. */
  | "sales.viewAll"
  /** Ver solo ventas donde el agente resuelto desde `agentName` es el
   *  user actual. */
  | "sales.viewOwn"
  /** Ver TODAS las visitas (events `type=visit`) del workspace. */
  | "visits.viewAll"
  /** Ver solo visitas donde `assigneeUserId === user.id`. */
  | "visits.viewOwn"
  /** Ver TODOS los documentos del workspace. */
  | "documents.viewAll"
  /** Ver solo documentos donde el contacto/lead asociado tiene al user
   *  en su ownership. */
  | "documents.viewOwn"
  /** Ver TODOS los emails enviados/recibidos del workspace. */
  | "emails.viewAll"
  /** Ver solo emails donde el user es sender/recipient o donde el
   *  contacto asociado le pertenece. */
  | "emails.viewOwn";

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
    "collaboration.requests.manage",
    "activity.dashboard.view",
    "records.matchDetails.view",
    /* Dual-role · default solo admin. Member NO los tiene. */
    "organization.editProfile",
    "offices.manage",
    "members.manage",
    "promotions.create",
    "promotions.edit",
    "promotions.publish",
    /* Visibilidad · admin tiene viewAll en TODOS los dominios.
     *  El escudo `isAdmin(user)` en `useHasPermission` hace que esto
     *  sea redundante a nivel runtime, pero lo declaramos explícito
     *  para que el editor de roles muestre los toggles correctos. */
    "contacts.viewAll",     "contacts.viewOwn",
    "records.viewAll",      "records.viewOwn",
    "opportunities.viewAll", "opportunities.viewOwn",
    "sales.viewAll",        "sales.viewOwn",
    "visits.viewAll",       "visits.viewOwn",
    "documents.viewAll",    "documents.viewOwn",
    "emails.viewAll",       "emails.viewOwn",
  ],
  member: [
    "whatsapp.viewOwn",
    /* Visibilidad · member ve solo lo suyo en cada dominio. Si el admin
     *  quiere darle vista global, edita la matriz desde
     *  `/ajustes/usuarios/roles` y añade `*.viewAll` por dominio. */
    "contacts.viewOwn",
    "records.viewOwn",
    "opportunities.viewOwn",
    "sales.viewOwn",
    "visits.viewOwn",
    "documents.viewOwn",
    "emails.viewOwn",
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
