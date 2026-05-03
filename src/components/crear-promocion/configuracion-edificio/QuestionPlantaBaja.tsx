/**
 * Pregunta 4 · ¿Qué uso tiene la planta baja?
 * 3 cards iconográficas · una seleccionada en azul.
 */

import { Minus, Store, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UsoPlantaBaja } from "./types";

const OPCIONES: Array<{
  value: UsoPlantaBaja;
  title: string;
  desc: string;
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}> = [
  { value: "sin", title: "Sin uso", desc: "Nada en planta baja", Icon: Minus },
  { value: "locales", title: "Locales", desc: "Espacios comerciales", Icon: Store },
  { value: "viviendas", title: "Viviendas", desc: "Bajos residenciales", Icon: Home },
];

export function QuestionPlantaBaja({
  value,
  onChange,
}: {
  value: UsoPlantaBaja;
  onChange: (v: UsoPlantaBaja) => void;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Pregunta 4 de 4
      </p>
      <h2 className="mt-2 text-[20px] sm:text-[22px] leading-tight font-bold text-foreground tracking-tight max-w-md">
        ¿Qué uso tiene la planta baja?
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        La planta a nivel de calle (planta 0).
      </p>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl">
        {OPCIONES.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                "rounded-2xl border-2 p-4 transition-all flex flex-col items-center gap-2",
                "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none",
                selected
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border bg-card hover:border-foreground/30",
              )}
            >
              <div
                className={cn(
                  "h-10 w-10 rounded-xl grid place-items-center transition-colors",
                  selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                <opt.Icon className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-[13px] font-semibold text-foreground">{opt.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                  {opt.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
