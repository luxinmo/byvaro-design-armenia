/**
 * /equipo — Gestión del equipo de la organización (vista tipo Lovable).
 *
 * Complementa (no reemplaza) `/ajustes/usuarios/miembros`:
 *   - Esta pantalla es la vista RICA con cards grandes 2-col, foto y
 *     metadatos, pensada para onboarding de nuevos miembros y para
 *     decisiones de visibilidad pública.
 *   - `/ajustes/usuarios/miembros` sigue siendo la vista densa con
 *     edición inline en expansión — pensada para cambios rápidos.
 *
 * Ambas leen y escriben sobre el mismo store:
 *   - Seed: `TEAM_MEMBERS` de `src/lib/team.ts`.
 *   - Persistencia: `byvaro.organization.members.v2`.
 *
 * TODO(backend): ver `docs/backend-integration.md §1 · Auth & usuarios`
 *   (endpoints de `organization/members` + `join-requests`).
 */

import { useEffect, useMemo, useState } from "react";
import {
  Plus, Search, Phone, Mail, Eye, EyeOff, AlertCircle,
  PenLine, KeyRound, Settings as SettingsIcon, Check, X,
  LayoutGrid, List as ListIcon, Shield, ShieldCheck,
  UserCheck, MessageCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { ViewToggle } from "@/components/ui/ViewToggle";
import { TEAM_MEMBERS, type TeamMember, type TeamMemberStatus } from "@/lib/team";
import { useCurrentUser, isAdmin } from "@/lib/currentUser";
import { findLanguageByCode } from "@/lib/languages";
import { Flag } from "@/components/ui/Flag";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { MemberFormDialog } from "@/components/team/MemberFormDialog";
import { InviteMemberDialog } from "@/components/team/InviteMemberDialog";

/* v4 = bump tras adoptar catálogo canónico de jobTitles (Founder, CEO…). */
const KEY = "byvaro.organization.members.v4";

function load(): TeamMember[] {
  if (typeof window === "undefined") return TEAM_MEMBERS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as TeamMember[];
    return TEAM_MEMBERS;
  } catch {
    return TEAM_MEMBERS;
  }
}
function persist(m: TeamMember[]) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(m));
  }
}

/* ═══════════════════════════════════════════════════════════════════
   Página
   ═══════════════════════════════════════════════════════════════════ */

type ViewMode = "gallery" | "list";
const VIEW_KEY = "byvaro.equipo.view.v1";

export default function Equipo() {
  const user = useCurrentUser();
  const canEdit = isAdmin(user);
  const [members, setMembers] = useState<TeamMember[]>(() => load());
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "gallery";
    return (window.localStorage.getItem(VIEW_KEY) as ViewMode) ?? "gallery";
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const confirm = useConfirm();

  const editingMember = useMemo(
    () => members.find((m) => m.id === editingId) ?? null,
    [members, editingId],
  );
  const openEdit = (id: string) => setEditingId(id);
  const closeEdit = () => setEditingId(null);

  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  useEffect(() => {
    persist(members);
  }, [members]);

  const update = (id: string, patch: Partial<TeamMember>) =>
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  /* ─── Agrupación ─── */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.jobTitle?.toLowerCase().includes(q) ?? false) ||
        (m.department?.toLowerCase().includes(q) ?? false),
    );
  }, [members, query]);

  const groups = useMemo(() => {
    const requests = filtered.filter((m) => m.status === "pending" || m.status === "invited");
    const active = filtered.filter((m) => !m.status || m.status === "active");
    const direction = active.filter(
      (m) => m.role === "admin" || m.department === "Dirección" || m.department === "Administración",
    );
    const commercial = active.filter((m) => !direction.includes(m));
    const deactive = filtered.filter((m) => m.status === "deactive");
    return { requests, direction, commercial, deactive };
  }, [filtered]);

  /* ─── Acciones ─── */
  const approveRequest = (id: string) => {
    update(id, { status: "active" });
    toast.success("Solicitud aprobada");
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

  const toggleRole = (id: string) => {
    const m = members.find((x) => x.id === id);
    if (!m) return;
    update(id, { role: m.role === "admin" ? "member" : "admin" });
    toast.success("Rol actualizado");
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

  /* ─── Render ─── */
  return (
    <div className="flex flex-col min-h-full bg-background">
      {/* Header */}
      <div className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-4">
        <div className="max-w-[1400px] mx-auto">
          {/* Fila superior · título + CTA */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground leading-none">
                Red
              </p>
              <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight leading-tight mt-1">
                Equipo
              </h1>
              <p className="text-xs text-muted-foreground mt-1.5">
                {groups.direction.length + groups.commercial.length} activos ·{" "}
                {groups.requests.length} pendientes · {groups.deactive.length} inactivos
              </p>
            </div>
            {canEdit && (
              <Button
                size="sm"
                className="rounded-full"
                onClick={() => setInviteOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Añadir miembro
              </Button>
            )}
          </div>

          {/* Fila buscador + toggle de vista · misma línea */}
          <div className="mt-5 flex items-center gap-3 flex-wrap sm:flex-nowrap">
            <div className="relative flex-1 max-w-[420px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, email, cargo…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 h-9 text-sm rounded-full"
              />
            </div>
            <ViewToggle
              className="shrink-0"
              value={view}
              onChange={setView}
              options={[
                { value: "gallery", icon: LayoutGrid, label: "Galería" },
                { value: "list",    icon: ListIcon,   label: "Lista" },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Secciones */}
      <div className="flex-1 px-4 sm:px-6 lg:px-8 pb-12">
        <div className="max-w-[1400px] mx-auto space-y-10">
          {view === "gallery" ? (
            <>
              {groups.requests.length > 0 && (
                <Section title="Solicitudes e invitaciones">
                  {groups.requests.map((m) => (
                    <MemberCard
                      key={m.id}
                      member={m}
                      canEdit={canEdit}
                      onClick={() => openEdit(m.id)}
                      onApprove={() => approveRequest(m.id)}
                      onReject={() => rejectRequest(m.id)}
                      onRevoke={() => revokeInvite(m.id)}
                    />
                  ))}
                </Section>
              )}
              {groups.direction.length > 0 && (
                <Section title="Equipo de dirección">
                  {groups.direction.map((m) => (
                    <MemberCard key={m.id} member={m} canEdit={canEdit} onClick={() => openEdit(m.id)} />
                  ))}
                </Section>
              )}
              {groups.commercial.length > 0 && (
                <Section title="Comercial">
                  {groups.commercial.map((m) => (
                    <MemberCard key={m.id} member={m} canEdit={canEdit} onClick={() => openEdit(m.id)} />
                  ))}
                </Section>
              )}
              {groups.deactive.length > 0 && (
                <Section title="Inactivos">
                  {groups.deactive.map((m) => (
                    <MemberCard key={m.id} member={m} canEdit={canEdit} onClick={() => openEdit(m.id)} />
                  ))}
                </Section>
              )}
            </>
          ) : (
            <ListView
              groups={groups}
              canEdit={canEdit}
              currentUserId={user.id}
              onOpen={openEdit}
              onApprove={approveRequest}
              onReject={rejectRequest}
              onRevoke={revokeInvite}
              onReactivate={toggleActive}
            />
          )}

          {filtered.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-sm text-muted-foreground">
                No hay miembros que coincidan con "{query}"
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Dialog de edición · al clicar cualquier card o fila de la lista */}
      <MemberFormDialog
        open={editingId !== null}
        onClose={closeEdit}
        member={editingMember}
        onSave={(patch) => editingId && update(editingId, patch)}
        onDeactivate={() => editingId && toggleActive(editingId)}
        onReactivate={() => editingId && toggleActive(editingId)}
        onRemove={() => editingId && removeMember(editingId)}
      />

      {/* Dialog de alta · invitar email o crear con password temporal */}
      <InviteMemberDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvite={({ email, role: inviteRole, personalMessage: _msg }) => {
          /* TODO(backend): POST /api/organization/invitations { email, role,
           * personalMessage? } · el backend usa `renderTeamInvitation()` y
           * envía el email vía SMTP. Aquí solo persistimos el placeholder
           * para que aparezca en el listado de invitados. */
          const id = `u${Date.now()}`;
          setMembers((prev) => [
            ...prev,
            {
              id,
              name: email.split("@")[0] ?? email,
              email,
              role: inviteRole,
              status: "invited",
              joinedAt: new Date().toISOString(),
            },
          ]);
        }}
        onCreate={(payload) => {
          const id = `u${Date.now()}`;
          const { tempPassword: _pwd, ...data } = payload;
          setMembers((prev) => [...prev, { ...data, id }]);
        }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ListView · réplica compacta del patrón de /ajustes/usuarios/miembros
   ═══════════════════════════════════════════════════════════════════ */

type Groups = {
  requests: TeamMember[];
  direction: TeamMember[];
  commercial: TeamMember[];
  deactive: TeamMember[];
};

function ListView({
  groups, canEdit, currentUserId, onOpen,
  onApprove, onReject, onRevoke, onReactivate,
}: {
  groups: Groups;
  canEdit: boolean;
  currentUserId: string;
  onOpen: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onRevoke: (id: string) => void;
  onReactivate: (id: string) => void;
}) {
  return (
    <>
      {/* Pendientes */}
      {groups.requests.length > 0 && (
        <ListCard title={`Solicitudes e invitaciones · ${groups.requests.length}`}>
          <div className="divide-y divide-border/40 -my-2">
            {groups.requests.map((m) => (
              <div
                key={m.id}
                onClick={() => canEdit && onOpen(m.id)}
                className={cn(
                  "py-3 flex items-center gap-3 transition-colors",
                  canEdit && "-mx-2 px-2 rounded-lg cursor-pointer hover:bg-muted/40",
                )}
              >
                <Avatar m={m} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                </div>
                <span className={cn(
                  "text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider",
                  m.status === "pending"
                    ? "bg-warning/15 text-warning"
                    : "bg-primary/10 text-primary",
                )}>
                  {m.status === "pending" ? "Pendiente" : "Invitado"}
                </span>
                {canEdit && (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {m.status === "pending" ? (
                      <>
                        <Button size="sm" variant="outline" className="rounded-full" onClick={() => onReject(m.id)}>
                          <X className="h-3.5 w-3.5" />
                          Rechazar
                        </Button>
                        <Button size="sm" className="rounded-full" onClick={() => onApprove(m.id)}>
                          <Check className="h-3.5 w-3.5" />
                          Aprobar
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => onRevoke(m.id)}
                      >
                        Revocar
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ListCard>
      )}

      {/* Activos */}
      {(groups.direction.length > 0 || groups.commercial.length > 0) && (
        <ListCard
          title={`Equipo · ${groups.direction.length + groups.commercial.length}`}
          description="Miembros con acceso activo al workspace. Haz clic en cualquiera para editar su perfil."
        >
          <div className="divide-y divide-border/40 -my-2">
            {[...groups.direction, ...groups.commercial].map((m) => (
              <ListRow
                key={m.id}
                m={m}
                isMe={m.id === currentUserId}
                canEdit={canEdit}
                onClick={() => canEdit && onOpen(m.id)}
              />
            ))}
          </div>
        </ListCard>
      )}

      {/* Inactivos */}
      {groups.deactive.length > 0 && (
        <ListCard
          title={`Inactivos · ${groups.deactive.length}`}
          description="Miembros desactivados. Sus datos se conservan."
        >
          <div className="divide-y divide-border/40 -my-2">
            {groups.deactive.map((m) => (
              <div
                key={m.id}
                onClick={() => canEdit && onOpen(m.id)}
                className={cn(
                  "py-3 flex items-center gap-3 opacity-70 transition-colors",
                  canEdit && "-mx-2 px-2 rounded-lg cursor-pointer hover:bg-muted/40 hover:opacity-100",
                )}
              >
                <Avatar m={m} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                </div>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={(e) => { e.stopPropagation(); onReactivate(m.id); }}
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    Reactivar
                  </Button>
                )}
              </div>
            ))}
          </div>
        </ListCard>
      )}
    </>
  );
}

function ListCard({
  title, description, children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card shadow-soft p-5 sm:p-6">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Avatar({ m }: { m: TeamMember }) {
  if (m.avatarUrl) {
    return <img src={m.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />;
  }
  return (
    <div className="h-10 w-10 rounded-full bg-primary/15 text-primary grid place-items-center text-xs font-semibold tnum shrink-0">
      {initials(m.name)}
    </div>
  );
}

function ListRow({
  m, isMe, canEdit, onClick,
}: {
  m: TeamMember;
  isMe: boolean;
  canEdit: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "py-3 flex items-center gap-3 transition-colors",
        canEdit && "-mx-2 px-2 rounded-lg cursor-pointer hover:bg-muted/40",
      )}
    >
      <Avatar m={m} />
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

      {/* Señales de estado compactas */}
      <div className="flex items-center gap-1.5 shrink-0">
        {m.twoFactorEnabled && (
          <span title="2FA activa" className="text-muted-foreground/60">
            <KeyRound className="h-3.5 w-3.5" />
          </span>
        )}
        {(m.emailAccountsCount ?? 0) > 0 && (
          <span title={`${m.emailAccountsCount} cuenta(s) de email`} className="text-muted-foreground/60">
            <Mail className="h-3.5 w-3.5" />
          </span>
        )}
        {m.whatsappLinked && (
          <span title="WhatsApp vinculado" className="text-muted-foreground/60">
            <MessageCircle className="h-3.5 w-3.5" />
          </span>
        )}
      </div>

      <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider bg-success/10 text-success">
        Activo
      </span>

      <span
        className={cn(
          "inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold",
          m.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        {m.role === "admin" ? <ShieldCheck className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
        {m.role === "admin" ? "Admin" : "Miembro"}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Section
   ═══════════════════════════════════════════════════════════════════ */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">
        {title}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">{children}</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MemberCard · card rica con foto + metadatos + acciones contextuales
   ═══════════════════════════════════════════════════════════════════ */

function MemberCard({
  member, canEdit, onClick, onApprove, onReject, onRevoke,
}: {
  member: TeamMember;
  canEdit: boolean;
  onClick?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onRevoke?: () => void;
}) {
  const isPending = member.status === "pending";
  const isInvited = member.status === "invited";
  const isDeactive = member.status === "deactive";
  const clickable = canEdit && !!onClick;

  return (
    <article
      onClick={clickable ? onClick : undefined}
      className={cn(
        "group bg-card rounded-2xl border border-border/60 flex overflow-hidden transition-all duration-200",
        "hover:shadow-soft-lg hover:-translate-y-0.5",
        clickable && "cursor-pointer",
        isDeactive && "opacity-70",
      )}
    >
      {/* Foto · grayscale sólo en inactivos */}
      <div className="w-[120px] sm:w-[140px] shrink-0 bg-muted grid place-items-center overflow-hidden">
        {member.avatarUrl ? (
          <img
            src={member.avatarUrl}
            alt={member.name}
            className={cn(
              "w-full h-full object-cover transition-all duration-300",
              isDeactive && "grayscale",
            )}
          />
        ) : (
          <div
            className={cn(
              "w-full h-full grid place-items-center",
              isDeactive && "grayscale",
            )}
          >
            <span className="text-2xl font-semibold text-muted-foreground/40">
              {initials(member.name)}
            </span>
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="flex-1 min-w-0 px-4 py-3.5 flex flex-col justify-between gap-3">
        {/* Top */}
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-foreground truncate leading-snug">
                {member.name}
              </h3>
              {member.jobTitle && (
                <p className="text-[11px] text-muted-foreground truncate">
                  {member.jobTitle}
                  {member.department && (
                    <span className="text-muted-foreground/50 mx-1">·</span>
                  )}
                  {member.department}
                </p>
              )}
            </div>
            <VisibilityBadge member={member} />
          </div>

          {/* Languages · banderas SVG + código */}
          {member.languages && member.languages.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {member.languages.map((l) => {
                const lang = findLanguageByCode(l);
                return (
                  <span
                    key={l}
                    title={lang?.name ?? l}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground bg-muted/60 rounded-full pl-1 pr-1.5 py-0.5"
                  >
                    <Flag iso={lang?.countryIso} size={12} />
                    <span className="tracking-wider">{l}</span>
                  </span>
                );
              })}
            </div>
          )}

          {/* Pending alert */}
          {isPending && (
            <div className="flex items-start gap-1.5 mt-2">
              <AlertCircle className="h-3 w-3 text-primary shrink-0 mt-0.5" />
              <p className="text-[10px] text-primary leading-snug">
                Ha solicitado unirse por dominio de email. Verifica la identidad antes de aprobar.
              </p>
            </div>
          )}
        </div>

        {/* Bottom */}
        <div className="min-w-0">
          {/* Contacto + meta */}
          <div className="flex items-end justify-between gap-2">
            <div className="flex flex-col gap-0.5 text-[11px] text-muted-foreground min-w-0">
              {member.phone && (
                <span className="flex items-center gap-1.5 tnum truncate">
                  <Phone className="h-3 w-3 shrink-0" /> {member.phone}
                </span>
              )}
              {member.email && (
                <span className="flex items-center gap-1.5 truncate">
                  <Mail className="h-3 w-3 shrink-0" /> {member.email}
                </span>
              )}
            </div>
            {!isPending && !isInvited && (
              <div className="flex items-center gap-3 text-[11px] shrink-0">
                <div className="text-right">
                  <span className="text-muted-foreground/60 block text-[9px] uppercase tracking-wider">
                    Rol
                  </span>
                  <p className="font-semibold text-foreground flex items-center gap-1 justify-end">
                    <SettingsIcon className="h-3 w-3 text-muted-foreground/50" />
                    {member.role === "admin" ? "Admin" : "Miembro"}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground/60 block text-[9px] uppercase tracking-wider">
                    Estado
                  </span>
                  <StatusLabel status={member.status} />
                </div>
              </div>
            )}
          </div>

          {/* Permisos iconos */}
          {!isPending && !isInvited && (member.canSign || member.canAcceptRegistrations) && (
            <div className="flex items-center gap-2 mt-2">
              {member.canSign && (
                <span title="Puede firmar contratos">
                  <PenLine className="h-3.5 w-3.5 text-muted-foreground/50" />
                </span>
              )}
              {member.canAcceptRegistrations && (
                <span title="Puede aprobar registros">
                  <KeyRound className="h-3.5 w-3.5 text-muted-foreground/50" />
                </span>
              )}
            </div>
          )}

          {/* Actions pending */}
          {isPending && canEdit && (
            <div className="flex items-center gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full h-7 px-3 text-[11px]"
                onClick={onReject}
              >
                <X className="h-3 w-3" />
                Rechazar
              </Button>
              <Button
                size="sm"
                className="rounded-full h-7 px-3 text-[11px]"
                onClick={onApprove}
              >
                <Check className="h-3 w-3" />
                Aprobar
              </Button>
            </div>
          )}

          {/* Actions invited */}
          {isInvited && canEdit && (
            <div className="flex items-center gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full h-7 px-3 text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={onRevoke}
              >
                Revocar invitación
              </Button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Pequeños helpers
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

function VisibilityBadge({ member }: { member: TeamMember }) {
  if (member.status === "invited") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground border border-border/60 rounded-full px-2 py-0.5 whitespace-nowrap">
        <Mail className="h-3 w-3" /> Invitado
      </span>
    );
  }
  if (member.status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-warning bg-warning/10 rounded-full px-2 py-0.5 whitespace-nowrap">
        Pendiente
      </span>
    );
  }
  if (member.visibleOnProfile) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground border border-border/60 rounded-full px-2 py-0.5 whitespace-nowrap">
        <Eye className="h-3 w-3" /> Visible
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60 border border-border/40 rounded-full px-2 py-0.5 whitespace-nowrap">
      <EyeOff className="h-3 w-3" /> Oculto
    </span>
  );
}

function StatusLabel({ status }: { status?: TeamMemberStatus }) {
  if (status === "deactive") {
    return <p className="font-semibold text-muted-foreground">Inactivo</p>;
  }
  return <p className="font-semibold text-success">Activo</p>;
}
