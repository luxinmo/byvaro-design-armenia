/**
 * /ajustes/calendario/sync — Sincronizar calendarios externos.
 *
 * Permite a cada miembro del equipo conectar su Google Calendar (y
 * próximamente Outlook / Apple). La sincronización es **bidireccional**:
 * los eventos de Byvaro se crean en el Google del agente y los eventos
 * del Google aparecen en el carril del agente en `/calendario` · con
 * distinción visual (icono Google).
 *
 * Mock: un toggle por miembro con estado "conectado / no conectado" en
 * localStorage. En real, el flujo es:
 *   1. Click "Conectar" → OAuth redirect a Google.
 *   2. Callback guarda `accessToken` + `refreshToken` en backend.
 *   3. Cron cada 5 min trae eventos nuevos y actualiza.
 *   4. Cuando Byvaro crea un evento, POSTea también a Google Calendar
 *      API con el calendarId del agente.
 *
 * TODO(backend):
 *   POST /api/me/integrations/google-calendar/connect → URL de OAuth
 *   GET  /api/me/integrations/google-calendar/status
 *   POST /api/me/integrations/google-calendar/disconnect
 *   Cron `calendar-sync` cada 5 min.
 */

import { useEffect, useState } from "react";
import { Check, X, AlertCircle, CalendarCheck2, Mail, Phone } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { Button } from "@/components/ui/button";
import { getAllTeamMembers, memberInitials, getMemberAvatarUrl } from "@/lib/team";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useOrgSetting } from "@/lib/orgSettings";

const SETTING_KEY = "calendar.googleSync";

type GoogleSyncStatus = Record<string, {
  connected: boolean;
  email?: string;
  lastSyncAt?: string; // ISO
}>;

export default function AjustesCalendarioSync() {
  const teamMembers = getAllTeamMembers().filter((m) => !m.status || m.status === "active");
  const [persisted, setPersisted] = useOrgSetting<GoogleSyncStatus>(SETTING_KEY, {});
  const [statusMap, setStatusMap] = useState<GoogleSyncStatus>(persisted);

  useEffect(() => {
    setStatusMap(persisted);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(persisted)]);

  /* Cualquier cambio se persiste en write-through al org_settings. */
  useEffect(() => { setPersisted(statusMap); /* eslint-disable-next-line */ }, [JSON.stringify(statusMap)]);

  const connect = (userId: string, email: string) => {
    setStatusMap((m) => ({
      ...m,
      [userId]: { connected: true, email, lastSyncAt: new Date().toISOString() },
    }));
    toast.success(`Google Calendar conectado · ${email}`, {
      description: "La sincronización se ejecuta cada 5 minutos en segundo plano.",
    });
  };
  const disconnect = (userId: string) => {
    setStatusMap((m) => ({
      ...m,
      [userId]: { connected: false },
    }));
    toast.info("Google Calendar desconectado");
  };

  return (
    <SettingsScreen
      title="Sincronizar calendario"
      description="Cada miembro puede conectar su Google Calendar para sincronizar en ambos sentidos las visitas, llamadas y reuniones. Las integraciones con Outlook y Apple llegarán más adelante."
    >
      {/* Google Calendar */}
      <SettingsCard
        title="Google Calendar"
        description="Sincronización bidireccional · eventos de Byvaro aparecen en Google y viceversa. Conecta por cada miembro del equipo."
      >
        <ul className="divide-y divide-border/50">
          {teamMembers.map((m) => {
            const s = statusMap[m.id];
            const connected = s?.connected;
            return (
              <li key={m.id} className="flex items-center gap-3 py-3">
                {getMemberAvatarUrl(m) ? (
                  <img src={getMemberAvatarUrl(m)!} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-muted grid place-items-center text-[11px] font-bold shrink-0">
                    {memberInitials(m)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                  {connected ? (
                    <p className="text-[11.5px] text-muted-foreground truncate">
                      <span className="inline-flex items-center gap-1 text-success">
                        <Check className="h-3 w-3" strokeWidth={2.5} />
                        Conectado
                      </span>
                      {" · "}
                      {s?.email ?? m.email}
                      {s?.lastSyncAt && (
                        <> · última sync {new Date(s.lastSyncAt).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</>
                      )}
                    </p>
                  ) : (
                    <p className="text-[11.5px] text-muted-foreground truncate">
                      Sin sincronización · {m.email}
                    </p>
                  )}
                </div>
                {connected ? (
                  <Button
                    variant="outline" size="sm" onClick={() => disconnect(m.id)}
                    className="rounded-full shrink-0"
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Desconectar
                  </Button>
                ) : (
                  <Button
                    size="sm" onClick={() => connect(m.id, m.email)}
                    className="rounded-full shrink-0"
                  >
                    <CalendarCheck2 className="h-3.5 w-3.5 mr-1" />
                    Conectar
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        <div className="mt-3 rounded-lg bg-muted/30 p-3 flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.75} />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Cada conexión ocupa la cuota del workspace de Byvaro · hasta 20 cuentas Google en el plan
            actual. Al conectar, se pide permiso de lectura y escritura de eventos · el token no se
            comparte con nadie fuera de tu workspace.
          </p>
        </div>
      </SettingsCard>

      {/* Otros proveedores (placeholders) */}
      <SettingsCard
        title="Otros proveedores"
        description="Más integraciones llegarán en futuras versiones."
      >
        <ul className="space-y-2">
          {[
            { name: "Outlook / Microsoft 365", icon: Mail, hint: "Próximamente (Q3)" },
            { name: "Apple iCal",              icon: Phone, hint: "Próximamente" },
          ].map((p) => {
            const Icon = p.icon;
            return (
              <li
                key={p.name}
                className="flex items-center gap-3 rounded-xl border border-border p-3 opacity-60"
              >
                <div className="h-8 w-8 rounded-lg bg-muted grid place-items-center shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{p.name}</p>
                  <p className="text-[11.5px] text-muted-foreground italic">{p.hint}</p>
                </div>
                <span className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full border border-dashed border-border text-[10.5px] text-muted-foreground">
                  Pendiente
                </span>
              </li>
            );
          })}
        </ul>
      </SettingsCard>
    </SettingsScreen>
  );
}
