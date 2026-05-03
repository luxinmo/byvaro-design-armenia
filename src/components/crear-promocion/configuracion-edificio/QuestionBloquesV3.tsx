/**
 * V3 · Pregunta 2 · ¿Un bloque o más de uno?
 *
 * Misma mecánica que escaleras · binary cards · auto-advance solo
 * en "Uno solo".
 */

import { Stepper } from "./Stepper";
import { LIMITES } from "./types";
import { cn } from "@/lib/utils";

export function QuestionBloquesV3({
  bloques,
  onBloquesChange,
  onAutoAdvance,
}: {
  bloques: number;
  onBloquesChange: (n: number) => void;
  onAutoAdvance: () => void;
}) {
  const isMultiple = bloques > 1;

  const handleUno = () => {
    if (bloques !== 1) onBloquesChange(1);
    setTimeout(() => onAutoAdvance(), 0);
  };

  const handleVarios = () => {
    if (bloques < 2) onBloquesChange(2);
  };

  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Pregunta 2
      </p>
      <h2 className="mt-2 text-[20px] sm:text-[22px] leading-tight font-bold text-foreground tracking-tight max-w-md">
        ¿La promoción tiene uno o varios bloques?
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground max-w-md">
        Edificios separados que comparten promoción.
      </p>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md">
        <BinaryCard
          selected={!isMultiple}
          onClick={handleUno}
          title="Un solo bloque"
          desc="Un único edificio"
        />
        <BinaryCard
          selected={isMultiple}
          onClick={handleVarios}
          title="Más de uno"
          desc="Varios edificios"
        />
      </div>

      {isMultiple && (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 w-full max-w-md">
          <p className="text-[12px] text-muted-foreground">¿Cuántos bloques?</p>
          <Stepper
            value={bloques}
            onChange={onBloquesChange}
            min={LIMITES.bloques.min}
            max={LIMITES.bloques.max}
            variant="sm"
            ariaLabel="Número de bloques"
          />
        </div>
      )}
    </div>
  );
}

function BinaryCard({
  selected, onClick, title, desc,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border-2 p-4 text-left transition-all",
        "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none",
        selected
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-foreground hover:border-foreground/40",
      )}
    >
      <p className="text-[14px] font-semibold leading-tight">{title}</p>
      <p className={cn("text-[12px] mt-1 leading-snug", selected ? "text-background/70" : "text-muted-foreground")}>
        {desc}
      </p>
    </button>
  );
}
