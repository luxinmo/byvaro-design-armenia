/**
 * /ajustes/usuarios/miembros — Equipo de la organización.
 *
 * QUÉ
 * ----
 * Gestión completa de los miembros: estados (active/invited/pending/
 * deactive), permisos granulares (canSign, canAcceptRegistrations,
 * visibleOnProfile), rol admin/member, invitaciones, aprobaciones de
 * solicitudes pendientes.
 *
 * CÓMO
 * ----
 * - Fuente de datos: `TEAM_MEMBERS` de `src/lib/team.ts` (seed) +
 *   capa de persistencia local `byvaro.organization.members.v2`
 *   (migra desde `.v1` si existe el viejo shape).
 * - Cada row es expandible · al abrirla se ven los permisos granulares.
 *
 * TODO(backend): GET/PATCH /api/organization/members — sustituye el
 *   localStorage. POST /api/organization/invitations (ya existe §1.5).
 *   POST /api/organization/join-requests/:id/{approve|reject} para
 *   las solicitudes pendientes por dominio.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Plus, Trash2, Mail, Shield, ShieldCheck, ChevronDown,
  Check, X, UserPlus, UserCheck, UserX, PenLine, Eye,
} from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { isAdmin, useCurrentUser, currentWorkspaceKey } from "@/lib/currentUser";
import { type TeamMember, type TeamMemberStatus, getMembersForWorkspace, teamStorageKey } from "@/lib/team";
import "@/lib/agencyTeamSeeds";
import { findLanguageByCode } from "@/lib/languages";
import { emitMembersChange } from "@/lib/meStorage";
import { Flag } from "@/components/ui/Flag";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* Storage por workspace (developer / agency-XX) · ver
 * REGLA DE ORO multi-tenant en CLAUDE.md. */
function persistAt(workspaceKey: string, m: TeamMember[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(teamStorageKey(workspaceKey), JSON.stringify(m));
    emitMembersChange();
  }
}

/* ═══════════════════════════════════════════════════════════════════
   Helpers visuales
   ═══════════════════════════════════════════════════════════════════ */

function initials(name: string): string {
  return name
    .split(" ")
    .filter((p) => p && p !== "—")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "?";
}

function statusMeta(status: TeamMemberStatus | undefined): {
  label: string;
  cls: string;
} {
  switch (status) {
    case "invited":
      return { label: "Invitado", cls: "bg-primary/10 text-primary" };
    case "pending":
      return { label: "Pendiente", cls: "bg-warning/15 text-warning" };
    case "deactive":
      return { label: "Inactivo", cls: "bg-muted text-muted-foreground" };
    case "active":
    default:
      return { label: "Activo", cls: "bg-success/10 text-success" };
  }
}

/* ═══════════════════════════════════════════════════════════════════
   Página
   ═══════════════════════════════════════════════════════════════════ */

export default function AjustesUsuariosMiembros() {
  const user = useCurrentUser();
  const canEdit = isAdmin(user);
  const workspaceKey = currentWorkspaceKey(user);
  const [members, setMembers] = useState<TeamMember[]>(() => getMembersForWorkspace(workspaceKey));
  useEffect(() => {
    setMembers(getMembersForWorkspace(workspaceKey));
  }, [workspaceKey]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const confirm = useConfirm();

  useEffect(() => {
    persistAt(workspaceKey, members);
  }, [members, workspaceKey]);

  const update = (id: string, patch: Partial<TeamMember>) =>
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  /* Separar por estado para pintar en secciones. */
  const { pendingReqs, invited, active, deactive } = useMemo(() => {
    return {
      pendingReqs: members.filter((m) => m.status === "pending"),
      invited: members.filter((m) => m.status === "invited"),
      active: members.filter((m) => !m.status || m.status === "active"),
      deactive: members.filter((m) => m.status === "deactive"),
    };
  }, [members]);

  /* ─── Acciones ─── */
  const invite = () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    if (members.some((m) => m.email.toLowerCase() === email)) {
      toast.error("Ese email ya está en el equipo");
      return;
    }
    const newMember: TeamMember = {
      id: `u${Date.now()}`,
      name: email.split("@")[0] ?? email,
      email,
      role: "member",
      status: "invited",
      joinedAt: new Date().toISOString(),
    };
    setMembers((prev) => [...prev, newMember]);
    /* TODO(backend): POST /api/organization/invitations { email, role } */
    toast.success(`Invitación enviada a ${email}`);
    setInviteEmail("");
  };

  const approveRequest = (id: string) => {
    update(id, { status: "active" });
    toast.success("Solicitud aprobada · el miembro ya puede entrar");
  };

  const rejectRequest = async (id: string) => {
    const m = members.find((x) => x.id === id);
    if (!m) return;
    const ok = await confirm({
      title: `¿Rechazar la solicitud de ${m.email}?`,
      description: "No podrán volver a solicitar entrar durante 30 días.",
      confirmLabel: "Rechazar",
      variant: "destructive",
    });
    if (!ok) return;
    setMembers((prev) => prev.filter((x) => x.id !== id));
    toast.success("Solicitud rechazada");
  };

  const revokeInvite = async (id: string) => {
    const m = members.find((x) => x.id === id);
    if (!m) return;
    const ok = await confirm({
      title: `¿Revocar la invitación a ${m.email}?`,
      description: "El enlace de invitación dejará de funcionar.",
      confirmLabel: "Revocar",
      variant: "destructive",
    });
    if (!ok) return;
    setMembers((prev) => prev.filter((x) => x.id !== id));
    toast.success("Invitación revocada");
  };

  const toggleActive = (id: string) => {
    const m = members.find((x) => x.id === id);
    if (!m) return;
    const next: TeamMemberStatus = m.status === "deactive" ? "active" : "deactive";
    update(id, { status: next });
    toast.success(next === "active" ? "Miembro reactivado" : "Miembro desactivado");
  };

  const removeMember = async (id: string) => {
    const m = members.find((x) => x.id === id);
    if (!m) return;
    if (m.id === user.id) {
      toast.error("No puedes eliminarte a ti mismo");
      return;
    }
    const ok = await confirm({
      title: `¿Eliminar a ${m.name}?`,
      description: "Perderá acceso inmediatamente al workspace. Sus datos creados se conservan.",
      confirmLabel: "Eliminar miembro",
      variant: "destructive",
    });
    if (!ok) return;
    setMembers((prev) => prev.filter((x) => x.id !== id));
    toast.success("Miembro eliminado");
  };

  const toggleRole = (id: string) => {
    const m = members.find((x) => x.id === id);
    if (!m) return;
    update(id, { role: m.role === "admin" ? "member" : "admin" });
    toast.success("Rol actualizado");
  };

  /* ═══════════════ Render ═══════════════ */

  return (
    <SettingsScreen
      title="Miembros del equipo"
      description={`${active.length} ${active.length === 1 ? "activo" : "activos"} · ${invited.length} ${invited.length === 1 ? "invitado" : "invitados"} · ${pendingReqs.length} ${pendingReqs.length === 1 ? "solicitud pendiente" : "solicitudes pendientes"}`}
    >
      {/* ── Invitar ── */}
      {canEdit && (
        <SettingsCard
          title="Invitar miembro"
          description="Enviaremos un email con instrucciones para crear cuenta."
        >
          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            <Input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="email@empresa.com"
              className="flex-1 min-w-[220px]"
              onKeyDown={(e) => e.key === "Enter" && invite()}
            />
            <Button onClick={invite} disabled={!inviteEmail.trim()} className="rounded-full">
              <Mail className="h-4 w-4" />
              Enviar invitación
            </Button>
          </div>
        </SettingsCard>
      )}

      {/* ── Solicitudes pendientes (dominio) ── */}
      {pendingReqs.length > 0 && (
        <SettingsCard
          title="Solicitudes pendientes"
          description="Personas que han pedido unirse al workspace usando tu dominio de email."
        >
          <div className="divide-y divide-border/40 -my-3">
            {pendingReqs.map((m) => (
              <div key={m.id} className="py-3 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-warning/15 text-warning grid place-items-center shrink-0">
                  <UserPlus className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{m.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Solicitud por dominio · {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : ""}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => rejectRequest(m.id)}
                    >
                      <X className="h-3.5 w-3.5" />
                      Rechazar
                    </Button>
                    <Button
                      size="sm"
                      className="rounded-full"
                      onClick={() => approveRequest(m.id)}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Aprobar
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </SettingsCard>
      )}

      {/* ── Miembros activos ── */}
      <SettingsCard
        title={`Equipo · ${active.length}`}
        description="Miembros con acceso activo al workspace."
      >
        <div className="divide-y divide-border/40 -my-3">
          {active.map((m) => (
            <MemberRow
              key={m.id}
              m={m}
              isMe={m.id === user.id}
              canEdit={canEdit}
              expanded={expandedId === m.id}
              onToggleExpand={() => setExpandedId(expandedId === m.id ? null : m.id)}
              onRoleToggle={() => toggleRole(m.id)}
              onUpdate={(patch) => update(m.id, patch)}
              onDeactivate={() => toggleActive(m.id)}
              onRemove={() => removeMember(m.id)}
            />
          ))}
          {active.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground italic">
              Aún no hay miembros activos
            </p>
          )}
        </div>
      </SettingsCard>

      {/* ── Invitaciones enviadas ── */}
      {invited.length > 0 && (
        <SettingsCard
          title={`Invitaciones enviadas · ${invited.length}`}
          description="Emails enviados pendientes de aceptación."
        >
          <div className="divide-y divide-border/40 -my-3">
            {invited.map((m) => (
              <div key={m.id} className="py-3 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                  <Mail className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{m.email}</p>
                  <p className="text-xs text-muted-foreground">
                    Invitación enviada · {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : ""}
                  </p>
                </div>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => revokeInvite(m.id)}
                  >
                    Revocar
                  </Button>
                )}
              </div>
            ))}
          </div>
        </SettingsCard>
      )}

      {/* ── Inactivos (colapsado) ── */}
      {deactive.length > 0 && (
        <SettingsCard
          title={`Inactivos · ${deactive.length}`}
          description="Miembros desactivados. Sus datos se conservan."
        >
          <div className="divide-y divide-border/40 -my-3">
            {deactive.map((m) => (
              <div key={m.id} className="py-3 flex items-center gap-3 opacity-70">
                <div className="h-10 w-10 rounded-full bg-muted text-muted-foreground grid place-items-center shrink-0 text-xs font-semibold">
                  {initials(m.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                </div>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => toggleActive(m.id)}
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    Reactivar
                  </Button>
                )}
              </div>
            ))}
          </div>
        </SettingsCard>
      )}
    </SettingsScreen>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MemberRow · fila expandible con permisos granulares
   ═══════════════════════════════════════════════════════════════════ */

function MemberRow({
  m, isMe, canEdit, expanded, onToggleExpand,
  onRoleToggle, onUpdate, onDeactivate, onRemove,
}: {
  m: TeamMember;
  isMe: boolean;
  canEdit: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onRoleToggle: () => void;
  onUpdate: (patch: Partial<TeamMember>) => void;
  onDeactivate: () => void;
  onRemove: () => void;
}) {
  const meta = statusMeta(m.status);

  return (
    <div>
      {/* Resumen */}
      <div className="py-3 flex items-center gap-3">
        {m.avatarUrl ? (
          <img src={m.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
        ) : (
          <div className="h-10 w-10 rounded-full bg-primary/15 text-primary grid place-items-center text-xs font-semibold tnum shrink-0">
            {initials(m.name)}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {m.name}
            {isMe && <span className="text-xs text-muted-foreground ml-2">(tú)</span>}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {m.email}
            {m.jobTitle && <span className="text-muted-foreground/50 mx-1.5">·</span>}
            {m.jobTitle}
          </p>
        </div>

        {/* Estado */}
        <span className={cn("text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider", meta.cls)}>
          {meta.label}
        </span>

        {/* Role pill */}
        <button
          type="button"
          onClick={onRoleToggle}
          disabled={!canEdit || isMe}
          className={cn(
            "inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold transition-colors disabled:cursor-not-allowed",
            m.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          {m.role === "admin" ? <ShieldCheck className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
          {m.role === "admin" ? "Admin" : "Miembro"}
        </button>

        {/* Toggle expand */}
        {canEdit && (
          <button
            type="button"
            onClick={onToggleExpand}
            className="h-8 w-8 rounded-full hover:bg-muted grid place-items-center text-muted-foreground hover:text-foreground transition-colors"
            aria-expanded={expanded}
            aria-label={expanded ? "Contraer detalles" : "Editar detalles"}
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
          </button>
        )}
      </div>

      {/* Detalle expandido · edición + permisos granulares */}
      {expanded && canEdit && (
        <div className="pb-4 pl-[52px] pr-2 space-y-4">
          {/* Metadata editable */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cargo</span>
              <Input
                value={m.jobTitle ?? ""}
                onChange={(e) => onUpdate({ jobTitle: e.target.value })}
                placeholder="Ej. Comercial senior"
                className="mt-1"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Departamento</span>
              <Input
                value={m.department ?? ""}
                onChange={(e) => onUpdate({ department: e.target.value })}
                placeholder="Ej. Comercial"
                className="mt-1"
              />
            </label>
          </div>

          {/* Idiomas · chips readonly con bandera SVG (edición desde /ajustes/perfil) */}
          {m.languages && m.languages.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Idiomas</p>
              <div className="flex flex-wrap gap-1.5">
                {m.languages.map((l) => {
                  const lang = findLanguageByCode(l);
                  return (
                    <span
                      key={l}
                      title={lang?.name ?? l}
                      className="inline-flex items-center gap-1.5 text-[11px] font-medium pl-1.5 pr-2 py-0.5 rounded-full bg-muted text-foreground"
                    >
                      <Flag iso={lang?.countryIso} size={13} />
                      {l}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Permisos granulares */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Permisos</p>
            <div className="space-y-1.5">
              <ToggleRow
                icon={UserCheck}
                label="Puede aprobar registros"
                description="Decidir sobre leads entrantes de agencias colaboradoras."
                checked={!!m.canAcceptRegistrations}
                onChange={(v) => onUpdate({ canAcceptRegistrations: v })}
              />
              <ToggleRow
                icon={PenLine}
                label="Puede firmar contratos"
                description="Representar legalmente a la empresa en acuerdos con agencias."
                checked={!!m.canSign}
                onChange={(v) => onUpdate({ canSign: v })}
              />
              <ToggleRow
                icon={Eye}
                label="Visible en el perfil público"
                description="Aparece en el microsite de la promoción y la ficha de empresa."
                checked={!!m.visibleOnProfile}
                onChange={(v) => onUpdate({ visibleOnProfile: v })}
              />
            </div>
          </div>

          {/* Acciones destructivas */}
          {!isMe && (
            <div className="flex justify-end gap-2 pt-1 border-t border-border/40">
              <Button
                size="sm"
                variant="ghost"
                className="rounded-full text-muted-foreground hover:text-foreground"
                onClick={onDeactivate}
              >
                <UserX className="h-3.5 w-3.5" />
                Desactivar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={onRemove}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Eliminar
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ToggleRow · fila de permiso con switch accesible
   ═══════════════════════════════════════════════════════════════════ */

function ToggleRow({
  icon: Icon, label, description, checked, onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-muted/40 cursor-pointer transition-colors">
      <div className="h-8 w-8 rounded-lg bg-muted text-muted-foreground grid place-items-center shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-tight">{label}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={cn(
          "relative appearance-none h-5 w-9 rounded-full transition-colors cursor-pointer shrink-0 mt-0.5",
          "bg-muted checked:bg-foreground",
          "before:content-[''] before:absolute before:top-0.5 before:left-0.5 before:h-4 before:w-4 before:rounded-full before:bg-white before:shadow-soft before:transition-transform",
          "checked:before:translate-x-4",
        )}
      />
    </label>
  );
}
