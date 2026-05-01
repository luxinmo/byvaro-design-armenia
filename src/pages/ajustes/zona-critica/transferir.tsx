/**
 * /ajustes/zona-critica/transferir — Transferir propiedad del workspace.
 */

import { useState } from "react";
import { Crown, ArrowRightLeft } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { SettingsField } from "@/components/settings/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { isAdmin, useCurrentUser } from "@/lib/currentUser";
import { toast } from "sonner";
import { useWorkspaceMembers } from "@/lib/useWorkspaceMembers";

export default function AjustesZonaCriticaTransferir() {
  const user = useCurrentUser();
  const canEdit = isAdmin(user);
  /* Source of truth · `useWorkspaceMembers` lee de `team` storage que
   *  ya tiene write-through a Supabase via `team.ts`. */
  const { members: allMembers } = useWorkspaceMembers();
  const members = allMembers
    .filter((m) => m.id !== user.id)
    .map((m) => ({ id: m.id, name: m.fullName ?? m.name, email: m.email }));
  const [targetEmail, setTargetEmail] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const confirm = useConfirm();

  const expectedConfirm = "TRANSFERIR";
  const target = members.find((m) => m.email === targetEmail.trim());
  const canSubmit = canEdit && target && confirmText === expectedConfirm;

  const submit = async () => {
    if (!canSubmit || !target) return;
    const ok = await confirm({
      title: `¿Transferir el workspace a ${target.name}?`,
      description: "Tú dejarás de ser owner. La acción no se puede deshacer salvo que la nueva propiedad te transfiera el workspace de vuelta.",
      confirmLabel: "Transferir",
      cancelLabel: "Cancelar",
      variant: "destructive",
    });
    if (!ok) return;
    /* TODO(backend): POST /api/organization/transfer { newOwnerId } */
    toast.success(`Workspace transferido a ${target.name}`);
    setTargetEmail("");
    setConfirmText("");
  };

  return (
    <SettingsScreen
      title="Transferir propiedad"
      description="Cambia el propietario del workspace. Solo el propietario puede ejecutar esta acción y solo a otro usuario que ya sea miembro."
    >
      <SettingsCard>
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-warning/15 grid place-items-center text-warning shrink-0">
            <Crown className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Propietario actual: {user.name}</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Como propietario, tienes acceso completo a la facturación, a la eliminación del workspace
              y eres el único que puede transferir esta titularidad.
            </p>
          </div>
        </div>
      </SettingsCard>

      {!canEdit ? (
        <SettingsCard>
          <p className="text-sm text-muted-foreground">
            Solo el propietario actual puede iniciar la transferencia.
          </p>
        </SettingsCard>
      ) : (
        <SettingsCard title="Transferir a otro miembro">
          <div className="space-y-4">
            <SettingsField label="Email del nuevo propietario" description="Debe ser un miembro existente del workspace.">
              <Input
                type="email"
                value={targetEmail}
                onChange={(e) => setTargetEmail(e.target.value)}
                placeholder="email@empresa.com"
              />
              {targetEmail && !target && (
                <p className="text-[11.5px] text-destructive mt-1">No hay un miembro con ese email</p>
              )}
              {target && (
                <p className="text-[11.5px] text-success mt-1">✓ Miembro encontrado: {target.name}</p>
              )}
            </SettingsField>

            <SettingsField
              label={`Para confirmar, escribe "${expectedConfirm}" abajo`}
              description="Esta acción es irreversible sin acción del nuevo propietario."
            >
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={expectedConfirm}
                className="font-mono"
              />
            </SettingsField>

            <div className="pt-2 flex justify-end">
              <Button onClick={submit} disabled={!canSubmit} variant="destructive" className="rounded-full">
                <ArrowRightLeft className="h-4 w-4" />
                Transferir propiedad
              </Button>
            </div>
          </div>
        </SettingsCard>
      )}
    </SettingsScreen>
  );
}
