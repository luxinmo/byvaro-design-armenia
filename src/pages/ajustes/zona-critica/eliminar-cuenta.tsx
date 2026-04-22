/**
 * /ajustes/zona-critica/eliminar-cuenta — Eliminar mi cuenta personal.
 */

import { useState } from "react";
import { Trash2, UserX } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { SettingsField } from "@/components/settings/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useCurrentUser } from "@/lib/currentUser";
import { toast } from "sonner";

export default function AjustesZonaCriticaEliminarCuenta() {
  const user = useCurrentUser();
  const expected = "ELIMINAR";
  const [text, setText] = useState("");
  const [reason, setReason] = useState("");
  const confirm = useConfirm();

  const submit = async () => {
    if (text !== expected) return;
    const ok = await confirm({
      title: "¿Eliminar tu cuenta personal?",
      description: "Tu cuenta se anonimiza y se elimina. Los workspaces donde eras propietario único se cerrarán también. Acción irreversible.",
      confirmLabel: "Eliminar mi cuenta",
      cancelLabel: "Cancelar",
      variant: "destructive",
    });
    if (!ok) return;
    /* TODO(backend): DELETE /api/me — anonimiza nombre/email,
     * borra avatar, elimina sesiones, cancela suscripciones donde es owner único. */
    toast.success("Cuenta eliminada · cerrando sesión");
  };

  return (
    <SettingsScreen
      title="Eliminar cuenta"
      description={`Eliminar permanentemente la cuenta de ${user.name} (${user.email}). Esto NO elimina los workspaces donde eres miembro — solo perderás acceso.`}
    >
      <SettingsCard>
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-destructive/10 grid place-items-center text-destructive shrink-0">
            <UserX className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Qué pasará con tus datos</p>
            <ul className="text-xs text-muted-foreground mt-2 space-y-1.5 leading-relaxed list-disc pl-4">
              <li>Tus datos personales (nombre, email, foto) se anonimizan.</li>
              <li>Los contactos / promociones / registros que has creado se quedan en cada workspace, atribuidos a "Usuario eliminado".</li>
              <li>Si eres el único propietario de algún workspace, ése se eliminará también (con su grace period de 30 días).</li>
              <li>Cualquier suscripción activa donde eres titular se cancela.</li>
              <li>Pierdes acceso a TODOS los workspaces inmediatamente.</li>
            </ul>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="¿Por qué te vas? (opcional)" description="Nos ayuda a mejorar.">
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Cuéntanos…"
          rows={3}
          className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-card text-foreground outline-none focus:border-primary resize-none"
        />
      </SettingsCard>

      <SettingsCard title="Confirmación">
        <SettingsField label={`Escribe "${expected}" para confirmar`}>
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder={expected} className="font-mono" />
        </SettingsField>
        <div className="mt-4 flex justify-end">
          <Button onClick={submit} disabled={text !== expected} variant="destructive" className="rounded-full">
            <Trash2 className="h-4 w-4" />
            Eliminar mi cuenta
          </Button>
        </div>
      </SettingsCard>
    </SettingsScreen>
  );
}
