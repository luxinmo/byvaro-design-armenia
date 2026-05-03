/**
 * Pregunta 1 · ¿Cuántas plantas tiene el edificio?
 * Stepper grande (52px botones · número serif 56px). Validación 1-50.
 */

import { Stepper } from "./Stepper";
import { LIMITES } from "./types";

export function QuestionPlantas({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Pregunta 1 de 4
      </p>
      <h2 className="mt-2 text-[20px] sm:text-[22px] leading-tight font-bold text-foreground tracking-tight max-w-md">
        ¿Cuántas plantas tiene el edificio?
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Sin contar la planta baja.
      </p>

      <div className="mt-6">
        <Stepper
          value={value}
          onChange={onChange}
          min={LIMITES.plantas.min}
          max={LIMITES.plantas.max}
          variant="big"
          ariaLabel="Plantas sobre rasante"
        />
      </div>
    </div>
  );
}
