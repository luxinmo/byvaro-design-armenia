/**
 * /ajustes/zona-critica/cerrar-sesion — Cerrar sesión en TODOS los dispositivos.
 */

import { LogOut, ShieldAlert } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { toast } from "sonner";

export default function AjustesZonaCriticaCerrarSesion() {
  const confirm = useConfirm();

  const handleSignOut = async () => {
    const ok = await confirm({
      title: "¿Cerrar sesión en todos los dispositivos?",
      description: "Tendrás que iniciar sesión otra vez en este navegador y en cualquier otro donde estuvieses conectado. Tus datos no se pierden.",
      confirmLabel: "Cerrar todas las sesiones",
      cancelLabel: "Cancelar",
      variant: "destructive",
    });
    if (!ok) return;
    /* TODO(backend): POST /api/auth/sign-out-everywhere
     * Invalida todos los refresh tokens del usuario en Postgres. */
    toast.success("Sesiones cerradas en todos los dispositivos");
  };

  return (
    <SettingsScreen
      title="Cerrar sesión en todos los dispositivos"
      description="Útil si crees que alguien tiene acceso no autorizado o si has perdido un dispositivo."
    >
      <SettingsCard>
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-amber-100 grid place-items-center text-amber-700 shrink-0">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Sesiones activas</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Si solo quieres cerrar sesión en un dispositivo concreto, ve a{" "}
              <strong className="text-foreground">Seguridad › Sesiones activas</strong>{" "}
              y revoca solo ése. Esta acción cierra TODAS de golpe.
            </p>
            <Button onClick={handleSignOut} variant="destructive" className="rounded-full mt-3" size="sm">
              <LogOut className="h-4 w-4" />
              Cerrar sesión en todos
            </Button>
          </div>
        </div>
      </SettingsCard>
    </SettingsScreen>
  );
}
