/**
 * V3 · Pregunta 1 · ¿Una escalera o más de una?
 *
 * 2 cards binarias. Click "Una" → auto-advance al siguiente paso.
 * Click "Varias" → muestra sub-stepper (cuántas) · el user confirma
 * con "Siguiente" manual.
 */

import { Stepper } from "./Stepper";
import { LIMITES } from "./types";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

export function QuestionEscalerasV3({
  escaleras,
  onEscalerasChange,
  onAutoAdvance,
}: {
  escaleras: number;
  onEscalerasChange: (n: number) => void;
  onAutoAdvance: () => void;
}) {
  const isMultiple = escaleras > 1;

  const handleUna = () => {
    if (escaleras !== 1) onEscalerasChange(1);
    /* setTimeout 0 · espera a que el setState se aplique antes de
     * navegar · garantiza que el siguiente paso ve el valor nuevo. */
    setTimeout(() => onAutoAdvance(), 0);
  };

  const handleVarias = () => {
    if (escaleras < 2) onEscalerasChange(2);
    /* No auto-advance · el user ajusta cuántas con el sub-stepper
     * y pulsa "Siguiente" manual. */
  };

  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Pregunta 1
      </p>
      <h2 className="mt-2 text-[20px] sm:text-[22px] leading-tight font-bold text-foreground tracking-tight max-w-md">
        ¿El edificio tiene una o más escaleras?
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground max-w-md">
        Cada escalera es un portal independiente.
      </p>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md">
        <BinaryCard
          selected={!isMultiple}
          onClick={handleUna}
          title="Una sola"
          desc="Un único portal"
        />
        <BinaryCard
          selected={isMultiple}
          onClick={handleVarias}
          title="Más de una"
          desc="Varios portales"
        />
      </div>

      {isMultiple && (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-4 w-full max-w-md">
          <p className="text-[12px] text-muted-foreground">¿Cuántas escaleras?</p>
          <Stepper
            value={escaleras}
            onChange={onEscalerasChange}
            min={LIMITES.escaleras.min}
            max={LIMITES.escaleras.max}
            variant="sm"
            ariaLabel="Número de escaleras"
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
        "rounded-2xl border-2 p-4 text-left transition-all relative",
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
      {!selected && title.includes("Más") && (
        <Plus className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground/60" strokeWidth={2} />
      )}
    </button>
  );
}
