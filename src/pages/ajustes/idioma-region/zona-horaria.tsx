/**
 * /ajustes/idioma-region/zona-horaria — Zona horaria del usuario.
 *
 * Define la zona en la que se muestran fechas/horas en la app
 * (visitas, calendario, timestamps, emails enviados…).
 */

import { useEffect, useMemo, useState } from "react";
import { Search, Check, Globe } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useUserSetting } from "@/lib/userSettings";

const SETTING_KEY = "user.timezone";

/** Subset curado de zonas horarias relevantes para el mercado Byvaro
 * (Costa del Sol, Costa Blanca + clientes internacionales típicos). */
const TIMEZONES = [
  { value: "Europe/Madrid", label: "Madrid · Barcelona · Málaga", offset: "GMT+01:00" },
  { value: "Europe/Lisbon", label: "Lisboa · Faro", offset: "GMT+00:00" },
  { value: "Europe/London", label: "Londres · Edimburgo", offset: "GMT+00:00" },
  { value: "Europe/Paris", label: "París", offset: "GMT+01:00" },
  { value: "Europe/Berlin", label: "Berlín · Múnich", offset: "GMT+01:00" },
  { value: "Europe/Amsterdam", label: "Ámsterdam", offset: "GMT+01:00" },
  { value: "Europe/Stockholm", label: "Estocolmo · Oslo", offset: "GMT+01:00" },
  { value: "Europe/Moscow", label: "Moscú", offset: "GMT+03:00" },
  { value: "Asia/Dubai", label: "Dubái · Abu Dabi", offset: "GMT+04:00" },
  { value: "Asia/Riyadh", label: "Riad · Doha", offset: "GMT+03:00" },
  { value: "America/New_York", label: "Nueva York · Miami", offset: "GMT-05:00" },
  { value: "America/Los_Angeles", label: "Los Ángeles · San Francisco", offset: "GMT-08:00" },
  { value: "America/Mexico_City", label: "Ciudad de México", offset: "GMT-06:00" },
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires", offset: "GMT-03:00" },
];

function browserTz(): string {
  if (typeof window === "undefined") return "Europe/Madrid";
  return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "Europe/Madrid";
}

export default function AjustesZonaHoraria() {
  const [persisted, setPersisted] = useUserSetting<string>(SETTING_KEY, browserTz());
  const [selected, setSelected] = useState(persisted);
  const [query, setQuery] = useState("");
  useEffect(() => { setSelected(persisted); }, [persisted]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TIMEZONES;
    return TIMEZONES.filter(
      (tz) =>
        tz.label.toLowerCase().includes(q) ||
        tz.value.toLowerCase().includes(q) ||
        tz.offset.toLowerCase().includes(q),
    );
  }, [query]);

  const save = () => {
    setPersisted(selected);
    const tz = TIMEZONES.find((t) => t.value === selected);
    toast.success(`Zona horaria: ${tz?.label ?? selected}`);
  };

  /** Hora actual formateada en la zona seleccionada (live preview). */
  const currentTimePreview = useMemo(() => {
    try {
      return new Date().toLocaleTimeString("es-ES", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: selected,
        timeZoneName: "short",
      });
    } catch {
      return "—";
    }
  }, [selected]);

  return (
    <SettingsScreen
      title="Zona horaria"
      description="Las fechas y horas (visitas, calendario, emails, registros) se muestran en esta zona."
      actions={
        <Button onClick={save} className="rounded-full" size="sm">
          Guardar cambios
        </Button>
      }
    >
      <SettingsCard
        title="Hora actual"
        description="Vista previa con la zona horaria seleccionada."
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center">
            <Globe className="h-5 w-5 text-primary" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-2xl font-bold tracking-tight tnum text-foreground">
              {currentTimePreview}
            </p>
            <p className="text-xs text-muted-foreground">{selected}</p>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Selecciona zona horaria">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar ciudad, país o zona…"
            className="w-full h-9 pl-9 pr-3 text-sm bg-muted/30 border border-transparent rounded-full focus:bg-background focus:border-border outline-none transition-colors"
          />
        </div>

        <div className="space-y-1 max-h-[420px] overflow-y-auto -mx-2 px-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground italic text-center py-6">
              Sin coincidencias
            </p>
          ) : (
            filtered.map((tz) => {
              const active = selected === tz.value;
              return (
                <button
                  key={tz.value}
                  onClick={() => setSelected(tz.value)}
                  className={cn(
                    "w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-left transition-colors",
                    active
                      ? "bg-primary/5 border border-primary/30"
                      : "border border-transparent hover:bg-muted/40",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{tz.label}</p>
                    <p className="text-[11px] text-muted-foreground">{tz.value}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground tnum">{tz.offset}</span>
                    {active && <Check className="h-4 w-4 text-primary" strokeWidth={2.5} />}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </SettingsCard>
    </SettingsScreen>
  );
}
