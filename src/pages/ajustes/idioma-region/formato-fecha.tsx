/**
 * /ajustes/idioma-region/formato-fecha — Cómo se muestran las
 * fechas en la app. Independiente del idioma (puedes tener español
 * con formato americano, etc.).
 */

import { useState } from "react";
import { Check } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const KEY = "byvaro.userDateFormat.v1";

const FORMATS = [
  { value: "DD/MM/YYYY", example: "21/04/2026", label: "DD/MM/AAAA", region: "España, Europa" },
  { value: "MM/DD/YYYY", example: "04/21/2026", label: "MM/DD/AAAA", region: "Estados Unidos" },
  { value: "YYYY-MM-DD", example: "2026-04-21", label: "AAAA-MM-DD", region: "ISO 8601 (técnico)" },
  { value: "DD MMM YYYY", example: "21 abr 2026", label: "DD MMM AAAA", region: "Legible · corto" },
  { value: "DD MMMM YYYY", example: "21 abril 2026", label: "DD MMMM AAAA", region: "Legible · largo" },
];

const TIME_FORMATS = [
  { value: "24h", example: "14:30", label: "24 horas (14:30)" },
  { value: "12h", example: "2:30 PM", label: "12 horas (2:30 PM)" },
];

function loadDate(): string {
  if (typeof window === "undefined") return "DD/MM/YYYY";
  return window.localStorage.getItem(KEY) ?? "DD/MM/YYYY";
}
function loadTime(): string {
  if (typeof window === "undefined") return "24h";
  return window.localStorage.getItem(KEY + ".time") ?? "24h";
}

export default function AjustesFormatoFecha() {
  const [date, setDate] = useState(() => loadDate());
  const [time, setTime] = useState(() => loadTime());

  const save = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KEY, date);
      window.localStorage.setItem(KEY + ".time", time);
    }
    toast.success(`Formato de fecha guardado · ${date} · ${time === "24h" ? "24h" : "12h"}`);
  };

  return (
    <SettingsScreen
      title="Formato de fecha"
      description="Cómo se muestran las fechas y horas en toda la app, los emails y los documentos exportados."
      actions={
        <Button onClick={save} className="rounded-full" size="sm">
          Guardar cambios
        </Button>
      }
    >
      <SettingsCard title="Formato de fecha">
        <div className="space-y-2">
          {FORMATS.map((f) => {
            const active = date === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setDate(f.value)}
                className={cn(
                  "w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-left transition-colors",
                  active
                    ? "border border-primary bg-primary/5"
                    : "border border-border hover:border-foreground/20",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{f.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{f.region}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-mono text-foreground tnum bg-muted/60 px-2 py-1 rounded-md">
                    {f.example}
                  </span>
                  {active && <Check className="h-4 w-4 text-primary" strokeWidth={2.5} />}
                </div>
              </button>
            );
          })}
        </div>
      </SettingsCard>

      <SettingsCard title="Formato de hora">
        <div className="space-y-2">
          {TIME_FORMATS.map((f) => {
            const active = time === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setTime(f.value)}
                className={cn(
                  "w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-left transition-colors",
                  active
                    ? "border border-primary bg-primary/5"
                    : "border border-border hover:border-foreground/20",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{f.label}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-mono text-foreground tnum bg-muted/60 px-2 py-1 rounded-md">
                    {f.example}
                  </span>
                  {active && <Check className="h-4 w-4 text-primary" strokeWidth={2.5} />}
                </div>
              </button>
            );
          })}
        </div>
      </SettingsCard>
    </SettingsScreen>
  );
}
