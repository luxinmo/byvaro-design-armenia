/**
 * /ajustes/seguridad/sesiones — Sesiones activas con device + IP +
 * última actividad. Botón Revocar por sesión + Revocar todas.
 */

import { useState } from "react";
import { Monitor, Smartphone, Tablet, MapPin, Clock, X, ShieldCheck } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Session = {
  id: string;
  device: "desktop" | "mobile" | "tablet";
  browser: string;
  os: string;
  location: string;
  ip: string;
  lastActive: string;
  current?: boolean;
};

const MOCK_SESSIONS: Session[] = [
  { id: "s1", device: "desktop", browser: "Chrome 120", os: "macOS Sonoma",
    location: "Marbella, España", ip: "85.222.140.21", lastActive: "Hace unos segundos", current: true },
  { id: "s2", device: "mobile", browser: "Safari Mobile", os: "iOS 17.4",
    location: "Marbella, España", ip: "85.222.140.21", lastActive: "Hace 2 horas" },
  { id: "s3", device: "desktop", browser: "Firefox 124", os: "Windows 11",
    location: "Madrid, España", ip: "212.105.45.7", lastActive: "Hace 1 día" },
  { id: "s4", device: "tablet", browser: "Safari", os: "iPadOS 17",
    location: "Estepona, España", ip: "85.222.140.55", lastActive: "Hace 3 días" },
];

const DEVICE_ICON = { desktop: Monitor, mobile: Smartphone, tablet: Tablet };

export default function AjustesSesiones() {
  const [sessions, setSessions] = useState<Session[]>(MOCK_SESSIONS);
  const confirm = useConfirm();

  const revokeOne = async (id: string) => {
    const session = sessions.find((s) => s.id === id);
    if (!session) return;
    const ok = await confirm({
      title: "¿Cerrar sesión en este dispositivo?",
      description: `${session.browser} en ${session.os} (${session.location}) tendrá que iniciar sesión de nuevo.`,
      confirmLabel: "Cerrar sesión",
      cancelLabel: "Cancelar",
      variant: "destructive",
    });
    if (!ok) return;
    setSessions((prev) => prev.filter((s) => s.id !== id));
    toast.success("Sesión revocada");
  };

  const revokeAllOthers = async () => {
    const others = sessions.filter((s) => !s.current);
    if (others.length === 0) return;
    const ok = await confirm({
      title: `¿Cerrar sesión en ${others.length} ${others.length === 1 ? "dispositivo" : "dispositivos"}?`,
      description: "Tu sesión actual se mantendrá. El resto tendrá que iniciar sesión otra vez.",
      confirmLabel: "Cerrar todas las demás",
      cancelLabel: "Cancelar",
      variant: "destructive",
    });
    if (!ok) return;
    setSessions((prev) => prev.filter((s) => s.current));
    toast.success(`${others.length} sesiones revocadas`);
  };

  return (
    <SettingsScreen
      title="Sesiones activas"
      description="Dispositivos donde tienes sesión iniciada. Si ves alguno desconocido, ciérralo."
      actions={
        sessions.filter((s) => !s.current).length > 0 ? (
          <Button onClick={revokeAllOthers} variant="outline" size="sm" className="rounded-full">
            Cerrar todas las demás
          </Button>
        ) : null
      }
    >
      <SettingsCard>
        <div className="divide-y divide-border/40 -my-4">
          {sessions.map((s) => {
            const DeviceIcon = DEVICE_ICON[s.device];
            return (
              <div key={s.id} className="py-4 flex items-start gap-4">
                <div className={cn(
                  "h-10 w-10 rounded-xl grid place-items-center shrink-0",
                  s.current ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground",
                )}>
                  <DeviceIcon className="h-5 w-5" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-foreground">
                      {s.browser} <span className="text-muted-foreground">·</span>{" "}
                      <span className="text-muted-foreground">{s.os}</span>
                    </p>
                    {s.current && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        <ShieldCheck className="h-2.5 w-2.5" />
                        Sesión actual
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11.5px] text-muted-foreground flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {s.location}
                    </span>
                    <span className="inline-flex items-center gap-1 font-mono">
                      {s.ip}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {s.lastActive}
                    </span>
                  </div>
                </div>

                {!s.current && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revokeOne(s.id)}
                    className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                    Cerrar
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </SettingsCard>
    </SettingsScreen>
  );
}
