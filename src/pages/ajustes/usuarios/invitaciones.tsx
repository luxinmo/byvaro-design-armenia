/**
 * /ajustes/usuarios/invitaciones — Invitaciones pendientes.
 * Lista invites con resend / revoke.
 */

import { useState } from "react";
import { Mail, Send, X, Plus } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isAdmin, useCurrentUser } from "@/lib/currentUser";
import { toast } from "sonner";

const KEY = "byvaro.organization.invitations.v1";

type Invitation = { id: string; email: string; role: "admin" | "member"; sentAt: string };

const DEFAULT: Invitation[] = [
  { id: "i1", email: "pedro@empresa.com", role: "member", sentAt: "Hace 2 días" },
  { id: "i2", email: "sofia@empresa.com", role: "admin", sentAt: "Hace 5 días" },
];

function load(): Invitation[] {
  if (typeof window === "undefined") return DEFAULT;
  try { return JSON.parse(window.localStorage.getItem(KEY) ?? JSON.stringify(DEFAULT)); }
  catch { return DEFAULT; }
}

export default function AjustesUsuariosInvitaciones() {
  const user = useCurrentUser();
  const canEdit = isAdmin(user);
  const [invitations, setInvitations] = useState<Invitation[]>(() => load());
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "member">("member");

  const update = (next: Invitation[]) => {
    setInvitations(next);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  };

  const send = () => {
    if (!newEmail.trim()) return;
    if (invitations.some((i) => i.email === newEmail.trim())) {
      toast.error("Ya hay una invitación pendiente para ese email"); return;
    }
    const next: Invitation = { id: `i${Date.now()}`, email: newEmail.trim(), role: newRole, sentAt: "Ahora" };
    update([next, ...invitations]);
    toast.success(`Invitación enviada a ${newEmail}`);
    setNewEmail("");
  };

  const resend = (id: string) => toast.success("Invitación reenviada");
  const revoke = (id: string) => {
    const inv = invitations.find((i) => i.id === id);
    update(invitations.filter((i) => i.id !== id));
    toast.success(`Invitación a ${inv?.email} revocada`);
  };

  return (
    <SettingsScreen
      title="Invitaciones"
      description="Personas a las que has invitado pero aún no han aceptado. Las invitaciones expiran en 7 días."
    >
      {canEdit && (
        <SettingsCard title="Nueva invitación">
          <div className="flex gap-2">
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="email@empresa.com"
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && send()}
            />
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as "admin" | "member")}
              className="h-9 px-3 rounded-full border border-border bg-card text-sm outline-none focus:border-primary"
            >
              <option value="member">Miembro</option>
              <option value="admin">Admin</option>
            </select>
            <Button onClick={send} disabled={!newEmail.trim()} className="rounded-full">
              <Send className="h-4 w-4" />
              Enviar
            </Button>
          </div>
        </SettingsCard>
      )}

      <SettingsCard title={`Pendientes (${invitations.length})`}>
        <div className="divide-y divide-border/40 -my-3">
          {invitations.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground text-center italic">Sin invitaciones pendientes</p>
          ) : invitations.map((i) => (
            <div key={i.id} className="py-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-muted text-muted-foreground grid place-items-center shrink-0">
                <Mail className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{i.email}</p>
                <p className="text-[11px] text-muted-foreground">Como {i.role === "admin" ? "Admin" : "Miembro"} · enviada {i.sentAt.toLowerCase()}</p>
              </div>
              {canEdit && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => resend(i.id)} className="rounded-full">
                    <Send className="h-3.5 w-3.5" />
                    Reenviar
                  </Button>
                  <button
                    onClick={() => revoke(i.id)}
                    className="h-8 w-8 rounded-full hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive"
                    title="Revocar"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </SettingsCard>
    </SettingsScreen>
  );
}
