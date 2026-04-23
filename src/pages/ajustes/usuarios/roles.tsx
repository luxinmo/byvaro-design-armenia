/**
 * /ajustes/usuarios/roles — Matriz editable de permisos por rol.
 *
 * Hoy hay dos roles fijos: Admin y Member. El admin puede editar qué
 * permisos tiene el member; el admin siempre los tiene todos (no se
 * puede dejar el workspace sin admin con permisos).
 *
 * Los permisos "live" (los que realmente gating código) se gestionan
 * desde `src/lib/permissions.ts`. Los permisos en modo "info" (los
 * que aún no están cableados en el código real) se muestran como
 * read-only con un badge "Próximamente" para que se vea la intención.
 *
 * TODO(backend): POST /api/workspace/roles/:role/permissions
 *   con la lista de permission keys. El backend valida cada endpoint
 *   contra el rol del usuario; este frontend es solo UI.
 */

import { useState } from "react";
import { Check, X, Lock, Info } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { Button } from "@/components/ui/button";
import { useDirty } from "@/components/settings/SettingsDirtyContext";
import { useCurrentUser, isAdmin } from "@/lib/currentUser";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  loadRolePermissions, saveRolePermissions, DEFAULT_ROLE_PERMISSIONS,
  type PermissionKey, type RolePermissions,
} from "@/lib/permissions";

/** Catálogo de permisos para la UI. `key` lo marca como cableado
 *  al sistema real; sin `key` es solo informativo. */
type RolePermissionRow = {
  label: string;
  description?: string;
  /** Si está presente, el toggle edita el permission real. */
  key?: PermissionKey;
  /** Valores por defecto en modo informativo (sin key). */
  defaults?: { admin: boolean; member: boolean };
};

const PERMISSION_GROUPS: { group: string; items: RolePermissionRow[] }[] = [
  { group: "Promociones", items: [
    { label: "Ver promociones",                    defaults: { admin: true, member: true } },
    { label: "Crear promoción",                    defaults: { admin: true, member: true } },
    { label: "Editar promoción",                   defaults: { admin: true, member: true } },
    { label: "Eliminar promoción",                 defaults: { admin: true, member: false } },
    { label: "Cambiar precio de unidades",         defaults: { admin: true, member: true } },
    { label: "Marcar unidad como vendida",         defaults: { admin: true, member: true } },
  ]},
  { group: "Contactos", items: [
    { label: "Ver contactos",                      defaults: { admin: true, member: true } },
    { label: "Crear contactos",                    defaults: { admin: true, member: true } },
    { label: "Importar contactos en masa",         defaults: { admin: true, member: false } },
    { label: "Exportar contactos",                 defaults: { admin: true, member: false } },
    { label: "Gestionar etiquetas de organización", key: "contacts.editOrgTags" },
    { label: "Eliminar contactos",                 key: "contacts.delete" },
    { label: "Gestionar orígenes",                 defaults: { admin: true, member: false } },
  ]},
  { group: "WhatsApp", items: [
    { label: "Ver sus propias conversaciones",     description: "Mensajes donde el agente ha participado.",               key: "whatsapp.viewOwn" },
    { label: "Ver conversaciones de otros agentes", description: "Permite leer mensajes enviados por cualquier miembro.", key: "whatsapp.viewAll" },
    { label: "Conectar / desconectar canal",       description: "Business API o WhatsApp Web del workspace.",             key: "whatsapp.manageChannel" },
  ]},
  { group: "Email y comunicación", items: [
    { label: "Conectar cuenta de email propia",    defaults: { admin: true, member: true } },
    { label: "Enviar emails",                      defaults: { admin: true, member: true } },
    { label: "Configurar SMTP de empresa",         defaults: { admin: true, member: false } },
    { label: "Editar plantillas de empresa",       defaults: { admin: true, member: false } },
  ]},
  { group: "Equipo y organización", items: [
    { label: "Invitar miembros",                   defaults: { admin: true, member: false } },
    { label: "Asignar roles",                      defaults: { admin: true, member: false } },
    { label: "Editar datos de empresa",            defaults: { admin: true, member: false } },
    { label: "Ver facturas",                       defaults: { admin: true, member: false } },
    { label: "Cambiar plan",                       defaults: { admin: true, member: false } },
  ]},
];

export default function AjustesUsuariosRoles() {
  const user = useCurrentUser();
  const canEdit = isAdmin(user);
  const { setDirty } = useDirty();

  const [perms, setPerms] = useState<RolePermissions>(() => loadRolePermissions());
  const [initial, setInitial] = useState(perms);

  const isDirty = JSON.stringify(perms) !== JSON.stringify(initial);

  const toggle = (role: "admin" | "member", key: PermissionKey) => {
    if (!canEdit) return;
    /* Admin siempre tiene todos los permisos — no se puede quitar. */
    if (role === "admin") return;

    setPerms((prev) => {
      const current = prev[role] ?? [];
      const next = current.includes(key)
        ? current.filter((k) => k !== key)
        : [...current, key];
      const updated = { ...prev, [role]: next };
      setDirty(true);
      return updated;
    });
  };

  const save = () => {
    saveRolePermissions(perms);
    setInitial(perms);
    setDirty(false);
    toast.success("Permisos de roles guardados");
  };

  const reset = () => {
    setPerms(DEFAULT_ROLE_PERMISSIONS);
    setDirty(true);
  };

  const has = (role: "admin" | "member", key: PermissionKey) => {
    if (role === "admin") return true; // admin siempre tiene todo
    return (perms[role] ?? []).includes(key);
  };

  return (
    <SettingsScreen
      title="Roles y permisos"
      description="Define qué puede hacer cada rol dentro del workspace. El admin siempre tiene todos los permisos — lo configurable es qué puede hacer un miembro."
      actions={canEdit ? (
        <div className="flex gap-2">
          <Button onClick={reset} variant="ghost" size="sm" className="rounded-full">
            Valores por defecto
          </Button>
          <Button onClick={save} disabled={!isDirty} size="sm" className="rounded-full">
            Guardar permisos
          </Button>
        </div>
      ) : undefined}
    >
      {!canEdit && (
        <SettingsCard>
          <div className="flex items-start gap-3">
            <Lock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-[12.5px] text-muted-foreground leading-relaxed">
              Estás en modo lectura. Solo los administradores pueden modificar la matriz de permisos.
            </p>
          </div>
        </SettingsCard>
      )}

      <SettingsCard>
        <div className="overflow-x-auto -mx-5 sm:-mx-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40">
                <th className="text-left py-3 px-5 sm:px-6 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Permiso</th>
                <th className="text-center py-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-[100px]">Admin</th>
                <th className="text-center py-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground w-[100px]">Miembro</th>
              </tr>
            </thead>
            <tbody>
              {PERMISSION_GROUPS.map((g) => (
                <RoleGroup
                  key={g.group}
                  group={g.group}
                  items={g.items}
                  canEdit={canEdit}
                  has={has}
                  onToggle={toggle}
                />
              ))}
            </tbody>
          </table>
        </div>
      </SettingsCard>

      <SettingsCard>
        <div className="flex items-start gap-3">
          <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-[12px] text-muted-foreground leading-relaxed">
            <p className="text-foreground font-semibold mb-0.5">Permisos con check editable</p>
            Los permisos con toggle funcional están cableados al código (ej. WhatsApp). Los demás aparecen en modo informativo: se configurarán cuando se implementen las features correspondientes.
          </div>
        </div>
      </SettingsCard>
    </SettingsScreen>
  );
}

function RoleGroup({
  group, items, canEdit, has, onToggle,
}: {
  group: string;
  items: RolePermissionRow[];
  canEdit: boolean;
  has: (role: "admin" | "member", key: PermissionKey) => boolean;
  onToggle: (role: "admin" | "member", key: PermissionKey) => void;
}) {
  return (
    <>
      <tr className="bg-muted/20">
        <td colSpan={3} className="py-2 px-5 sm:px-6 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {group}
        </td>
      </tr>
      {items.map((p) => {
        const isLive = !!p.key;
        const adminActive = p.key ? has("admin", p.key) : p.defaults?.admin ?? false;
        const memberActive = p.key ? has("member", p.key) : p.defaults?.member ?? false;
        return (
          <tr key={p.label} className="border-b border-border/30">
            <td className="py-3 px-5 sm:px-6">
              <p className="text-foreground inline-flex items-center gap-1.5">
                {p.label}
                {!isLive && (
                  <span className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground/70 bg-muted rounded px-1.5 py-0.5">
                    Info
                  </span>
                )}
              </p>
              {p.description && (
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{p.description}</p>
              )}
            </td>
            {/* Admin · siempre activo, no editable */}
            <td className="text-center align-middle">
              <Check className="h-4 w-4 text-success inline-block" strokeWidth={3} />
            </td>
            {/* Member · editable si es live + el usuario puede */}
            <td className="text-center align-middle">
              {isLive ? (
                <button
                  disabled={!canEdit}
                  onClick={() => onToggle("member", p.key!)}
                  className={cn(
                    "inline-flex h-5 w-9 rounded-full transition-colors items-center px-0.5",
                    memberActive ? "bg-success" : "bg-muted-foreground/30",
                    !canEdit && "opacity-60 cursor-not-allowed",
                  )}
                  aria-label={memberActive ? "Desactivar" : "Activar"}
                >
                  <span className={cn(
                    "h-4 w-4 rounded-full bg-white shadow transition-transform",
                    memberActive ? "translate-x-4" : "translate-x-0",
                  )} />
                </button>
              ) : memberActive ? (
                <Check className="h-4 w-4 text-success inline-block" strokeWidth={3} />
              ) : (
                <X className="h-4 w-4 text-muted-foreground/40 inline-block" />
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}
