/**
 * Registry de Ajustes — réplica de la estructura de Lovable
 * (figgy-friend-forge · ARCHITECTURE_*) adaptada al producto Byvaro
 * en español.
 *
 * 6 secciones · 19 grupos · 70+ links totales. La mayoría son
 * placeholders por ahora — se irán convirtiendo en páginas reales
 * conforme se implemente cada feature. Las que ya tienen página
 * real son las marcadas en App.tsx con su componente propio; las
 * demás caen en el catch-all → SettingsPlaceholder.
 *
 * Cuando añadas un módulo nuevo:
 *   1. Añade su grupo aquí (sección + icon + links)
 *   2. Crea las páginas reales en src/pages/ajustes/<modulo>/
 *   3. Cablea las rutas en App.tsx
 */

import {
  User, Building2, Users as UsersIcon, Bell, Languages, Calendar,
  FileSignature, Mailbox, MessageSquare, FileText, Shield, Eye,
  Database, Plug, CreditCard, AlertTriangle, Tag, Bot, Code2, Zap,
  Contact,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type SettingsLink = {
  label: string;
  to: string;
  /** Si true, navega fuera del SettingsShell (ej. al cliente de email). */
  external?: boolean;
  /**
   * true → la sub-página tiene implementación real con contenido y
   *  funcionalidad. Se renderiza con color normal.
   * false (o undefined) → es un placeholder ("En diseño"). Se
   *  renderiza con color más claro tanto en la home como en el nav
   *  para que el usuario vea de un vistazo qué está activo.
   *
   * Cuando una sub-página deja de ser placeholder y pasa a ser real,
   * marca este flag a true en el registry. El indicador visual
   * desaparece automáticamente. Ver CLAUDE.md → "Settings: marcar
   * live al activar".
   */
  live?: boolean;
  /**
   * true → la sub-página ha sido REVISADA Y CONFIRMADA por Arman
   *  (más allá de "tiene contenido"). Se pinta un tick verde junto
   *  al label en la home y en el sidebar mientras dure el diseño,
   *  para identificar de un vistazo qué está cerrado y qué falta.
   *
   * Es una marca temporal de revisión, NO una propiedad del producto
   *  final. Se quita en bloque antes de salir a producción
   *  cambiando `SHOW_DONE_TICKS` a false (no hace falta tocar este
   *  flag por cada link). Ver `SHOW_DONE_TICKS` abajo.
   */
  done?: boolean;
};

/**
 * Kill-switch del indicador visual `done`.
 *
 * Mientras vale `true`, los links marcados con `done: true` muestran
 * un check verde junto al label. Antes de salir a producción, cambia
 * a `false` (o elimínalo junto con el rendering en AjustesHome y
 * SettingsShell): los flags `done: true` siguen ahí pero no se pintan.
 */
export const SHOW_DONE_TICKS = true;

export type SettingsGroup = {
  id: string;
  title: string;
  icon: LucideIcon;
  links: SettingsLink[];
};

export type SettingsSection = {
  id: string;
  title: string;
  groups: SettingsGroup[];
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  /* ══════ Cuenta y organización ══════ */
  {
    id: "account",
    title: "Cuenta y organización",
    groups: [
      { id: "profile", title: "Mi perfil", icon: User, links: [
        { label: "Información personal", to: "/ajustes/perfil/personal", live: true },
        { label: "Teléfonos de contacto", to: "/ajustes/perfil/contacto", live: true },
      ]},
      { id: "company", title: "Empresa", icon: Building2, links: [
        { label: "Datos de la empresa", to: "/ajustes/empresa/datos", live: true },
        { label: "Oficinas", to: "/ajustes/empresa/oficinas", live: true },
        { label: "Verificación", to: "/ajustes/empresa/verificacion", live: true },
        { label: "Suscripción", to: "/ajustes/empresa/suscripcion", live: true },
      ]},
      { id: "users", title: "Usuarios y roles", icon: UsersIcon, links: [
        { label: "Miembros del equipo", to: "/ajustes/usuarios/miembros", live: true },
        { label: "Roles y permisos", to: "/ajustes/usuarios/roles", live: true, done: true },
        { label: "Invitaciones", to: "/ajustes/usuarios/invitaciones", live: true },
      ]},
      { id: "security", title: "Seguridad", icon: Shield, links: [
        { label: "Contraseña", to: "/ajustes/seguridad/contrasena", live: true, done: true },
        { label: "Verificación en dos pasos", to: "/ajustes/seguridad/2fa", live: true, done: true },
        { label: "Sesiones activas", to: "/ajustes/seguridad/sesiones", live: true },
        { label: "Actividad de inicio de sesión", to: "/ajustes/seguridad/actividad", live: true },
      ]},
      { id: "billing", title: "Facturación y plan", icon: CreditCard, links: [
        { label: "Plan actual", to: "/ajustes/facturacion/plan", live: true },
        { label: "Método de pago", to: "/ajustes/facturacion/pago", live: true },
        { label: "Facturas", to: "/ajustes/facturacion/facturas", live: true },
        { label: "Uso", to: "/ajustes/facturacion/uso", live: true },
      ]},
    ],
  },

  /* ══════ Preferencias del workspace ══════ */
  {
    id: "preferences",
    title: "Preferencias",
    groups: [
      { id: "localization", title: "Idioma y región", icon: Languages, links: [
        { label: "Idioma", to: "/ajustes/idioma-region/idioma", live: true, done: true },
        { label: "Zona horaria", to: "/ajustes/idioma-region/zona-horaria", live: true, done: true },
        { label: "Formato de fecha", to: "/ajustes/idioma-region/formato-fecha", live: true, done: true },
        { label: "Moneda", to: "/ajustes/idioma-region/moneda", live: true, done: true },
      ]},
      { id: "notifications", title: "Notificaciones", icon: Bell, links: [
        { label: "Notificaciones por email", to: "/ajustes/notificaciones/email", live: true },
        { label: "Notificaciones push", to: "/ajustes/notificaciones/push", live: true },
        { label: "Tipos de alertas", to: "/ajustes/notificaciones/alertas", live: true },
        { label: "Resumen semanal", to: "/ajustes/notificaciones/resumen", live: true },
      ]},
      { id: "privacy", title: "Privacidad y datos", icon: Eye, links: [
        { label: "Analítica de uso", to: "/ajustes/privacidad/analitica", live: true },
        { label: "Visibilidad pública", to: "/ajustes/privacidad/visibilidad", live: true },
        { label: "Retención de datos", to: "/ajustes/privacidad/retencion", live: true },
        { label: "Exportar mis datos", to: "/ajustes/privacidad/exportar", live: true },
      ]},
    ],
  },

  /* ══════ Módulos ══════ */
  {
    id: "modules",
    title: "Módulos",
    groups: [
      { id: "contactos", title: "Contactos", icon: Contact, links: [
        { label: "Etiquetas", to: "/ajustes/contactos/etiquetas", live: true, done: true },
        { label: "Orígenes", to: "/ajustes/contactos/origenes", live: true, done: true },
        { label: "Tipos de relación", to: "/ajustes/contactos/relaciones", live: true },
        { label: "Campos personalizados", to: "/ajustes/contactos/campos", live: true },
        { label: "Fórmula de lead score", to: "/ajustes/contactos/lead-score", live: true },
        { label: "Importar contactos", to: "/ajustes/contactos/importar", live: true, done: true },
      ]},
      { id: "promociones", title: "Promociones", icon: Tag, links: [
        { label: "Validez por defecto", to: "/ajustes/promociones/validez", live: true },
        { label: "Comisión por defecto", to: "/ajustes/promociones/comision" },
        { label: "Campos personalizados", to: "/ajustes/promociones/campos" },
        { label: "Identificación de unidades", to: "/ajustes/promociones/unidades" },
      ]},
      { id: "registros", title: "Registros", icon: FileText, links: [
        { label: "Detección de duplicados", to: "/ajustes/registros/duplicados" },
        { label: "Reglas de auto-rechazo", to: "/ajustes/registros/auto-rechazo" },
        { label: "Ventanas de visita", to: "/ajustes/registros/visitas" },
        { label: "Flujo de aprobación", to: "/ajustes/registros/aprobacion" },
      ]},
      { id: "leads-oportunidades", title: "Leads y oportunidades", icon: Zap, links: [
        { label: "Flujo y conversión", to: "/ajustes/leads-oportunidades", live: true },
      ]},
      { id: "calendario", title: "Calendario y visitas", icon: Calendar, links: [
        { label: "Horario laboral", to: "/ajustes/calendario/horario" },
        { label: "Duración de visitas", to: "/ajustes/calendario/duracion" },
        { label: "Recordatorios", to: "/ajustes/calendario/recordatorios" },
        { label: "Sincronizar calendario externo", to: "/ajustes/calendario/sync" },
      ]},
      { id: "documentos", title: "Documentos", icon: FileSignature, links: [
        { label: "Carpetas por defecto", to: "/ajustes/documentos/carpetas" },
        { label: "Plantillas PDF", to: "/ajustes/documentos/plantillas" },
        { label: "Firma electrónica", to: "/ajustes/documentos/firma" },
        { label: "Marcas de agua", to: "/ajustes/documentos/marcas-agua" },
      ]},
    ],
  },

  /* ══════ Comunicación ══════ */
  {
    id: "communication",
    title: "Comunicación",
    groups: [
      { id: "email", title: "Email", icon: Mailbox, links: [
        { label: "Cuentas conectadas", to: "/emails", external: true, live: true },
        { label: "Firma de email", to: "/ajustes/email/firma", live: true },
        { label: "Plantillas", to: "/ajustes/email/plantillas", live: true },
        { label: "Auto-respuesta", to: "/ajustes/email/auto-respuesta", live: true },
        { label: "Dominio de envío SMTP", to: "/ajustes/email/smtp", live: true },
      ]},
      { id: "whatsapp", title: "WhatsApp", icon: MessageSquare, links: [
        { label: "Número vinculado", to: "/ajustes/whatsapp/numero", live: true, done: true },
        { label: "Respuestas rápidas", to: "/ajustes/whatsapp/respuestas-rapidas" },
        { label: "Auto-respondedor", to: "/ajustes/whatsapp/auto-respondedor" },
      ]},
      { id: "messaging", title: "Mensajería interna", icon: Bell, links: [
        { label: "Comentarios internos", to: "/ajustes/mensajeria/comentarios", live: true },
        { label: "Menciones", to: "/ajustes/mensajeria/menciones", live: true },
        { label: "Alertas sonoras", to: "/ajustes/mensajeria/sonidos", live: true },
      ]},
    ],
  },

  /* ══════ Integraciones y desarrolladores ══════ */
  {
    id: "integrations",
    title: "Integraciones",
    groups: [
      { id: "marketplace", title: "Integraciones", icon: Plug, links: [
        { label: "Apps conectadas", to: "/ajustes/integraciones/conectadas" },
        { label: "Idealista / Fotocasa", to: "/ajustes/integraciones/portales" },
        { label: "Stripe pagos", to: "/ajustes/integraciones/stripe" },
      ]},
      { id: "automation", title: "Automatización", icon: Zap, links: [
        { label: "Workflows", to: "/ajustes/automatizacion/workflows" },
        { label: "Triggers", to: "/ajustes/automatizacion/triggers" },
        { label: "Tareas programadas", to: "/ajustes/automatizacion/programadas" },
        { label: "Logs de actividad", to: "/ajustes/automatizacion/logs" },
      ]},
      { id: "ai", title: "Asistente IA", icon: Bot, links: [
        { label: "Preferencias IA", to: "/ajustes/ia/preferencias" },
        { label: "Auto-resúmenes", to: "/ajustes/ia/resumenes" },
        { label: "Respuestas sugeridas", to: "/ajustes/ia/respuestas" },
        { label: "Datos de entrenamiento", to: "/ajustes/ia/entrenamiento" },
      ]},
      { id: "developers", title: "Desarrolladores", icon: Code2, links: [
        { label: "API keys", to: "/ajustes/desarrolladores/api-keys" },
        { label: "Webhooks", to: "/ajustes/desarrolladores/webhooks" },
        { label: "Apps OAuth", to: "/ajustes/desarrolladores/oauth" },
        { label: "Audit log", to: "/ajustes/desarrolladores/audit" },
      ]},
    ],
  },

  /* ══════ Avanzado ══════ */
  {
    id: "advanced",
    title: "Avanzado",
    groups: [
      { id: "data", title: "Gestión de datos", icon: Database, links: [
        { label: "Importar datos", to: "/ajustes/datos/importar" },
        { label: "Exportar datos", to: "/ajustes/datos/exportar" },
        { label: "Backup", to: "/ajustes/datos/backup" },
        { label: "Uso de almacenamiento", to: "/ajustes/datos/almacenamiento" },
      ]},
      { id: "danger", title: "Zona crítica", icon: AlertTriangle, links: [
        { label: "Cerrar sesión en todos los dispositivos", to: "/ajustes/zona-critica/cerrar-sesion", live: true },
        { label: "Transferir propiedad", to: "/ajustes/zona-critica/transferir", live: true },
        { label: "Eliminar workspace", to: "/ajustes/zona-critica/eliminar-workspace", live: true },
        { label: "Eliminar cuenta", to: "/ajustes/zona-critica/eliminar-cuenta", live: true },
      ]},
    ],
  },
];

/** Encuentra el contexto (sección + grupo + link) según pathname. */
export function findContext(pathname: string) {
  for (const section of SETTINGS_SECTIONS) {
    for (const group of section.groups) {
      const link = group.links.find((l) => pathname === l.to || pathname.startsWith(l.to + "/"));
      if (link) return { section, group, link };
    }
  }
  return null;
}

/** Primer link disponible — para el redirect de `/ajustes`. */
export function firstSettingsLink(): string {
  return SETTINGS_SECTIONS[0]?.groups[0]?.links[0]?.to ?? "/inicio";
}
