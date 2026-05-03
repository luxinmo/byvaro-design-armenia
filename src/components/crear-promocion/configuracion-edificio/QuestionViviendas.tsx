/**
 * Pregunta 2 · ¿Cuántas viviendas hay por planta?
 * Stepper grande. Validación 1-20.
 */

import { Stepper } from "./Stepper";
import { LIMITES } from "./types";

export function QuestionViviendas({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Pregunta 2 de 4
      </p>
      <h2 className="mt-2 text-[20px] sm:text-[22px] leading-tight font-bold text-foreground tracking-tight max-w-md">
        ¿Cuántas viviendas hay por planta?
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        El número de puertas en cada rellano de la escalera principal.
      </p>

      <div className="mt-6">
        <Stepper
          value={value}
          onChange={onChange}
          min={LIMITES.viviendas.min}
          max={LIMITES.viviendas.max}
          variant="big"
          ariaLabel="Viviendas por planta"
        />
      </div>
    </div>
  );
}
