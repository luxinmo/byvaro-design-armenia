/**
 * DotsNav · 5 puntos para navegar entre las 4 preguntas + resumen.
 * Tab/Enter/Space accesible. aria-current="step" en el activo.
 */

import { cn } from "@/lib/utils";
import type { SubStep } from "./types";

const LABELS: Record<SubStep, string> = {
  0: "Plantas",
  1: "Viviendas",
  2: "Estructura",
  3: "Planta baja",
  4: "Resumen",
};

export function DotsNav({
  current,
  onGo,
}: {
  current: SubStep;
  onGo: (s: SubStep) => void;
}) {
  return (
    <nav aria-label="Pasos de configuración del edificio" className="inline-flex items-center gap-2.5">
      {([0, 1, 2, 3, 4] as SubStep[]).map((s) => {
        const active = s === current;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onGo(s)}
            aria-current={active ? "step" : undefined}
            aria-label={`Ir a paso · ${LABELS[s]}`}
            className={cn(
              "h-2 rounded-full transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              active
                ? "w-8 bg-foreground"
                : "w-2 bg-foreground/20 hover:bg-foreground/40",
            )}
          />
        );
      })}
    </nav>
  );
}
