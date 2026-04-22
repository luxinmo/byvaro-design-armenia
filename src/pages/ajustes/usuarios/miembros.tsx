/**
 * /ajustes/usuarios/miembros — Equipo de la organización.
 * Lista miembros con role + invite + remove.
 */

import { useState } from "react";
import { Plus, Trash2, Mail, Shield, ShieldCheck } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { isAdmin, useCurrentUser } from "@/lib/currentUser";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const KEY = "byvaro.organization.members.v1";

type Member = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member";
  initials: string;
  joined: string;
  lastActive: string;
};

const DEFAULT: Member[] = [
  { id: "u1", name: "Arman Rahmanov", email: "arman@byvaro.com", role: "admin", initials: "AR", joined: "12 ene 2026", lastActive: "Hace unos segundos" },
  { id: "u2", name: "Laura Gómez", email: "laura@byvaro.com", role: "member", initials: "LG", joined: "20 feb 2026", lastActive: "Hace 2 horas" },
  { id: "u3", name: "Carlos Vega", email: "carlos@byvaro.com", role: "member", initials: "CV", joined: "5 mar 2026", lastActive: "Hace 1 día" },
  { id: "u4", name: "María Pérez", email: "maria@byvaro.com", role: "member", initials: "MP", joined: "1 abr 2026", lastActive: "Hace 4 días" },
];

function load(): Member[] {
  if (typeof window === "undefined") return DEFAULT;
  try { return JSON.parse(window.localStorage.getItem(KEY) ?? JSON.stringify(DEFAULT)); }
  catch { return DEFAULT; }
}
function save(m: Member[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(m));
}

export default function AjustesUsuariosMiembros() {
  const user = useCurrentUser();
  const canEdit = isAdmin(user);
  const [members, setMembers] = useState<Member[]>(() => load());
  const [inviteEmail, setInviteEmail] = useState("");
  const confirm = useConfirm();

  const update = (next: Member[]) => { setMembers(next); save(next); };

  const invite = () => {
    if (!inviteEmail.trim()) return;
    if (members.some((m) => m.email === inviteEmail.trim())) {
      toast.error("Ese email ya está en el equipo"); return;
    }
    /* TODO(backend): POST /api/organization/invitations { email, role } */
    toast.success(`Invitación enviada a ${inviteEmail}`);
    setInviteEmail("");
  };

  const removeMember = async (id: string) => {
    const m = members.find((x) => x.id === id);
    if (!m) return;
    if (m.id === user.id) { toast.error("No puedes eliminarte a ti mismo"); return; }
    const ok = await confirm({
      title: `¿Eliminar a ${m.name}?`,
      description: "Perderá acceso inmediatamente al workspace. Sus datos creados se conservan.",
      confirmLabel: "Eliminar miembro",
      variant: "destructive",
    });
    if (!ok) return;
    update(members.filter((x) => x.id !== id));
    toast.success("Miembro eliminado");
  };

  const toggleRole = (id: string) => {
    update(members.map((m) => m.id === id ? { ...m, role: m.role === "admin" ? "member" : "admin" } : m));
    toast.success("Rol actualizado");
  };

  return (
    <SettingsScreen
      title="Miembros del equipo"
      description={`${members.length} ${members.length === 1 ? "persona en" : "personas en"} ${user.email.split("@")[1]}`}
    >
      {canEdit && (
        <SettingsCard title="Invitar miembro" description="Le enviaremos un email con instrucciones para crear cuenta.">
          <div className="flex gap-2">
            <Input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="email@empresa.com"
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && invite()}
            />
            <Button onClick={invite} disabled={!inviteEmail.trim()} className="rounded-full">
              <Mail className="h-4 w-4" />
              Invitar
            </Button>
          </div>
        </SettingsCard>
      )}

      <SettingsCard title="Equipo">
        <div className="divide-y divide-border/40 -my-3">
          {members.map((m) => (
            <div key={m.id} className="py-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/15 text-primary grid place-items-center text-xs font-semibold tnum shrink-0">
                {m.initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {m.name}{m.id === user.id && <span className="text-xs text-muted-foreground ml-2">(tú)</span>}
                </p>
                <p className="text-xs text-muted-foreground truncate">{m.email} · Activo {m.lastActive.toLowerCase()}</p>
              </div>
              <button
                onClick={() => canEdit && m.id !== user.id && toggleRole(m.id)}
                disabled={!canEdit || m.id === user.id}
                className={cn("inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold transition-colors disabled:cursor-not-allowed",
                  m.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}
              >
                {m.role === "admin" ? <ShieldCheck className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                {m.role === "admin" ? "Admin" : "Miembro"}
              </button>
              {canEdit && m.id !== user.id && (
                <button
                  onClick={() => removeMember(m.id)}
                  className="h-8 w-8 rounded-full hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </SettingsCard>
    </SettingsScreen>
  );
}
