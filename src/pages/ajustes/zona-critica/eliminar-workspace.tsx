/**
 * /ajustes/zona-critica/eliminar-workspace — Eliminar workspace.
 * Acción irreversible · type-to-confirm.
 */

import { useState } from "react";
import { Trash2, AlertOctagon } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { SettingsField } from "@/components/settings/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { isAdmin, useCurrentUser } from "@/lib/currentUser";
import { useEmpresa } from "@/lib/empresa";
import { toast } from "sonner";

export default function AjustesZonaCriticaEliminarWorkspace() {
  const user = useCurrentUser();
  const canEdit = isAdmin(user);
  const { empresa } = useEmpresa();
  const orgName = empresa.nombreComercial?.trim() || empresa.razonSocial?.trim() || "Tu empresa";
  const [confirmText, setConfirmText] = useState("");
  const [understand, setUnderstand] = useState(false);
  const confirm = useConfirm();

  const canSubmit = canEdit && confirmText === orgName && understand;

  const submit = async () => {
    if (!canSubmit) return;
    const ok = await confirm({
      title: `¿Eliminar el workspace "${orgName}"?`,
      description: "Se eliminarán PERMANENTEMENTE todos los datos: contactos, promociones, registros, emails, microsites y suscripciones. Esta acción no se puede deshacer.",
      confirmLabel: "Eliminar workspace",
      cancelLabel: "Cancelar",
      variant: "destructive",
    });
    if (!ok) return;
    /* TODO(backend): DELETE /api/organization · job de borrado escalonado.
     * Soft delete con grace period de 30 días, luego hard delete. */
    toast.success("Workspace marcado para eliminación · 30 días para revertir");
  };

  return (
    <SettingsScreen
      title="Eliminar workspace"
      description="Elimina permanentemente este workspace y todos sus datos. Acción reservada al propietario."
    >
      <SettingsCard>
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-destructive/10 grid place-items-center text-destructive shrink-0">
            <AlertOctagon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Esto es irreversible</p>
            <ul className="text-xs text-muted-foreground mt-2 space-y-1.5 leading-relaxed list-disc pl-4">
              <li>Todos los miembros perderán acceso inmediatamente.</li>
              <li>Los datos (contactos, promociones, emails, etc.) se borran tras un grace period de 30 días.</li>
              <li>La suscripción se cancela y se cierra el ciclo de facturación.</li>
              <li>Los microsites publicados dejan de funcionar al instante.</li>
              <li>Los emails enviados ya no pueden ser tracked (los pixels dejan de funcionar).</li>
            </ul>
          </div>
        </div>
      </SettingsCard>

      {!canEdit ? (
        <SettingsCard>
          <p className="text-sm text-muted-foreground">Solo el propietario puede eliminar el workspace.</p>
        </SettingsCard>
      ) : (
        <SettingsCard title="Confirmación">
          <div className="space-y-4">
            <SettingsField
              label={`Escribe el nombre del workspace para confirmar`}
              description={`Esperando: "${orgName}"`}
            >
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={orgName}
                className="font-mono"
              />
            </SettingsField>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={understand}
                onChange={(e) => setUnderstand(e.target.checked)}
                className="mt-1 accent-destructive"
              />
              <span className="text-xs text-foreground leading-relaxed">
                Entiendo que esta acción es <strong>irreversible</strong> y que tras 30 días los datos
                se eliminarán permanentemente. Acepto la responsabilidad de avisar a mi equipo y
                exportar cualquier dato necesario antes de eliminar.
              </span>
            </label>

            <div className="pt-2 flex justify-end">
              <Button
                onClick={submit}
                disabled={!canSubmit}
                variant="destructive"
                className="rounded-full"
              >
                <Trash2 className="h-4 w-4" />
                Eliminar workspace permanentemente
              </Button>
            </div>
          </div>
        </SettingsCard>
      )}
    </SettingsScreen>
  );
}
