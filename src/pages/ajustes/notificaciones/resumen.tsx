/**
 * /ajustes/notificaciones/resumen — Resumen semanal por email.
 * Toggle + selector día + hora + secciones a incluir.
 */

import { useEffect, useState } from "react";
import { Calendar, Clock } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { SettingsRowGroup, SettingsToggle } from "@/components/settings/fields";
import { Button } from "@/components/ui/button";
import { useDirty } from "@/components/settings/SettingsDirtyContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const KEY = "byvaro.notifications.weekly.v1";

const DAYS = [
  { v: "mon", l: "Lun" }, { v: "tue", l: "Mar" }, { v: "wed", l: "Mié" },
  { v: "thu", l: "Jue" }, { v: "fri", l: "Vie" }, { v: "sat", l: "Sáb" }, { v: "sun", l: "Dom" },
];
const HOURS = ["07:00", "08:00", "09:00", "10:00", "12:00", "18:00", "19:00", "20:00"];

type State = {
  enabled: boolean;
  day: string;
  hour: string;
  includeSales: boolean;
  includeRecords: boolean;
  includeAgencies: boolean;
  includeMicrosites: boolean;
};

const DEFAULT: State = {
  enabled: true, day: "mon", hour: "09:00",
  includeSales: true, includeRecords: true, includeAgencies: true, includeMicrosites: false,
};

function load(): State {
  if (typeof window === "undefined") return DEFAULT;
  try { return { ...DEFAULT, ...JSON.parse(window.localStorage.getItem(KEY) ?? "{}") }; }
  catch { return DEFAULT; }
}

export default function AjustesNotificacionesResumen() {
  const [state, setState] = useState<State>(() => load());
  const [initial, setInitial] = useState(state);
  const { setDirty } = useDirty();

  useEffect(() => { setDirty(JSON.stringify(state) !== JSON.stringify(initial)); }, [state, initial, setDirty]);
  const isDirty = JSON.stringify(state) !== JSON.stringify(initial);

  const save = () => {
    window.localStorage.setItem(KEY, JSON.stringify(state));
    setInitial(state);
    setDirty(false);
    toast.success("Configuración del resumen semanal guardada");
  };

  const set = (patch: Partial<State>) => setState((s) => ({ ...s, ...patch }));

  return (
    <SettingsScreen
      title="Resumen semanal"
      description="Un email cada semana con los KPIs y actividad de tu workspace."
      actions={<Button onClick={save} disabled={!isDirty} className="rounded-full" size="sm">Guardar cambios</Button>}
    >
      <SettingsCard>
        <SettingsToggle
          label="Recibir resumen semanal"
          description="Te llegará al email principal de tu cuenta."
          checked={state.enabled}
          onCheckedChange={(b) => set({ enabled: b })}
        />
      </SettingsCard>

      {state.enabled && (
        <>
          <SettingsCard title="Cuándo enviarlo">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-foreground mb-2 inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Día de la semana
                </p>
                <div className="flex gap-1.5">
                  {DAYS.map((d) => (
                    <button
                      key={d.v}
                      onClick={() => set({ day: d.v })}
                      className={cn(
                        "h-9 w-12 rounded-full text-xs font-medium transition-colors border",
                        state.day === d.v
                          ? "bg-foreground text-background border-foreground"
                          : "bg-card text-muted-foreground border-border hover:text-foreground",
                      )}
                    >
                      {d.l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground mb-2 inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Hora
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {HOURS.map((h) => (
                    <button
                      key={h}
                      onClick={() => set({ hour: h })}
                      className={cn(
                        "h-9 px-3 rounded-full text-xs font-medium transition-colors border tnum",
                        state.hour === h
                          ? "bg-foreground text-background border-foreground"
                          : "bg-card text-muted-foreground border-border hover:text-foreground",
                      )}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </SettingsCard>

          <SettingsCard title="Qué incluir" description="Secciones del informe.">
            <SettingsRowGroup>
              <SettingsToggle label="Ventas y revenue" checked={state.includeSales} onCheckedChange={(b) => set({ includeSales: b })} />
              <SettingsToggle label="Registros y leads nuevos" checked={state.includeRecords} onCheckedChange={(b) => set({ includeRecords: b })} />
              <SettingsToggle label="Top colaboradores" checked={state.includeAgencies} onCheckedChange={(b) => set({ includeAgencies: b })} />
              <SettingsToggle label="Tráfico de microsites" checked={state.includeMicrosites} onCheckedChange={(b) => set({ includeMicrosites: b })} />
            </SettingsRowGroup>
          </SettingsCard>
        </>
      )}
    </SettingsScreen>
  );
}
