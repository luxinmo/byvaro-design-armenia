/**
 * Dialog "Asignar miembros".
 *
 * Multi-select de TEAM_MEMBERS para indicar quién está asignado a un
 * contacto. Cada asignado puede tener permiso de editar (toggle), o
 * solo de ver (default). El primero asignado se considera el "owner".
 *
 * Persiste en `byvaro.contact.<id>.assigned.v1`.
 *
 * TODO(backend): PATCH /api/contacts/:id { assignedUserIds, permissions }.
 */

import { useEffect, useMemo, useState } from "react";
import { Save, X, Search, Star, Pencil, Eye } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  memberInitials, getMemberAvatarUrl, getAllTeamMembers,
} from "@/lib/team";
import { useMe } from "@/lib/meStorage";
import { saveAssignedOverride } from "@/components/contacts/contactRelationsStorage";
import { recordAssigneeAdded, recordAssigneeRemoved } from "@/components/contacts/contactEventsStorage";
import { useCurrentUser } from "@/lib/currentUser";
import type { ContactAssignedUser } from "@/components/contacts/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  current: ContactAssignedUser[];
  onSaved: () => void;
};

export function AssignMembersDialog({ open, onOpenChange, contactId, current, onSaved }: Props) {
  const user = useCurrentUser();
  const [assigned, setAssigned] = useState<ContactAssignedUser[]>(current);
  const [query, setQuery] = useState("");

  /* Lectura LIVE de miembros · al suscribirnos a `useMe()` el dialog se
   * re-renderiza cuando el admin edita un miembro (o el propio usuario
   * cambia su perfil desde /ajustes/perfil/personal). Así los cargos
   * borrados no se ven aquí. */
  useMe();
  const liveMembers = useMemo(() => getAllTeamMembers(), [
    /* Recalcular cada re-render · getAllTeamMembers() es una lectura
     * síncrona de localStorage (rápido, menos de 10 miembros). */
  ]);

  useEffect(() => {
    if (open) {
      setAssigned(current);
      setQuery("");
    }
  }, [open, current]);

  const isAssigned = (userId: string) => assigned.some((a) => a.userId === userId);

  const toggleMember = (userId: string) => {
    if (isAssigned(userId)) {
      setAssigned((prev) => prev.filter((a) => a.userId !== userId));
    } else {
      const m = liveMembers.find((u) => u.id === userId);
      if (!m) return;
      setAssigned((prev) => [...prev, {
        userId: m.id,
        userName: m.name,
        role: m.jobTitle,
        permissions: { canView: true, canEdit: false },
      }]);
    }
  };

  const togglePermission = (userId: string) => {
    setAssigned((prev) => prev.map((a) =>
      a.userId === userId
        ? { ...a, permissions: { ...a.permissions, canEdit: !a.permissions.canEdit } }
        : a,
    ));
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return liveMembers;
    return liveMembers.filter(
      (m) => m.name.toLowerCase().includes(q) ||
             m.email.toLowerCase().includes(q) ||
             (m.jobTitle?.toLowerCase().includes(q) ?? false),
    );
  }, [query, liveMembers]);

  const save = () => {
    /* Diff con current para registrar add/remove granular en historial. */
    const before = new Set(current.map((a) => a.userId));
    const after = new Set(assigned.map((a) => a.userId));
    const by = { name: user.name, email: user.email };
    for (const a of assigned) {
      if (!before.has(a.userId)) recordAssigneeAdded(contactId, by, a.userName);
    }
    for (const a of current) {
      if (!after.has(a.userId)) recordAssigneeRemoved(contactId, by, a.userName);
    }

    saveAssignedOverride(contactId, assigned);
    onSaved();
    onOpenChange(false);
    toast.success(
      assigned.length === 0
        ? "Contacto sin asignados"
        : `${assigned.length} ${assigned.length === 1 ? "miembro asignado" : "miembros asignados"}`,
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border/40 p-0 gap-0 max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/40 shrink-0">
          <DialogTitle className="text-base font-semibold">Asignar miembros</DialogTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Quién tiene acceso a este contacto. Marca el lápiz para dar permiso de editar.
          </p>
        </DialogHeader>

        <div className="px-5 py-3 border-b border-border/40 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar miembro…"
              className="w-full h-9 pl-9 pr-3 text-sm bg-muted/30 border border-transparent rounded-full focus:bg-background focus:border-border outline-none transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="text-[11.5px] text-muted-foreground italic text-center py-6">
              Sin coincidencias
            </p>
          ) : filtered.map((m) => {
            const selected = isAssigned(m.id);
            const assignment = assigned.find((a) => a.userId === m.id);
            return (
              <div
                key={m.id}
                className={cn(
                  "w-full flex items-center gap-3 px-2.5 py-2 rounded-xl transition-colors",
                  selected ? "bg-foreground/5" : "hover:bg-muted/40",
                )}
              >
                <button
                  onClick={() => toggleMember(m.id)}
                  className={cn(
                    "h-5 w-5 rounded-md border grid place-items-center transition-colors shrink-0",
                    selected ? "bg-foreground border-foreground text-background" : "border-border",
                  )}
                >
                  {selected && (
                    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3}>
                      <path d="M3 8l3.5 3.5L13 5" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => toggleMember(m.id)}
                  className="flex-1 flex items-center gap-3 min-w-0 text-left"
                >
                  <MemberAvatar member={m} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                    {m.jobTitle && (
                      <p className="text-[11px] text-muted-foreground truncate">{m.jobTitle}</p>
                    )}
                  </div>
                </button>
                {selected && (
                  <button
                    onClick={() => togglePermission(m.id)}
                    title={assignment?.permissions.canEdit ? "Puede editar" : "Solo ver"}
                    className={cn(
                      "h-7 w-7 rounded-lg grid place-items-center transition-colors shrink-0",
                      assignment?.permissions.canEdit
                        ? "bg-success/15 text-success dark:text-success"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted",
                    )}
                  >
                    {assignment?.permissions.canEdit
                      ? <Pencil className="h-3 w-3" />
                      : <Eye className="h-3 w-3" />}
                  </button>
                )}
                {selected && assigned[0]?.userId === m.id && (
                  <span title="Owner — primer asignado" className="shrink-0">
                    <Star className="h-3 w-3 text-warning fill-current" />
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter className="px-5 py-3 border-t border-border/40 bg-card flex-row sm:justify-between gap-2 shrink-0">
          <span className="text-[11.5px] text-muted-foreground self-center">
            <strong className="tnum text-foreground">{assigned.length}</strong> asignado{assigned.length === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="rounded-full">
              <X className="h-3.5 w-3.5" /> Cancelar
            </Button>
            <Button size="sm" onClick={save} className="rounded-full">
              <Save className="h-3.5 w-3.5" /> Guardar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MemberAvatar({
  member, size,
}: { member: { name: string; email: string; avatarUrl?: string }; size: number }) {
  const initials = memberInitials({ name: member.name });
  /* Usa el avatarUrl real del TeamMember (la foto subida por el admin
   * o del seed Unsplash). Solo cae a pravatar si realmente no hay foto. */
  const url = getMemberAvatarUrl(member);
  return (
    <div
      className="rounded-full bg-foreground/10 grid place-items-center text-foreground font-semibold shrink-0 overflow-hidden"
      style={{ width: size, height: size, fontSize: size / 2.6 }}
    >
      <img
        src={url}
        alt={member.name}
        className="w-full h-full object-cover"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
          (e.currentTarget.parentElement as HTMLElement).textContent = initials;
        }}
      />
    </div>
  );
}
