/**
 * Pregunta 3 · ¿El edificio tiene varias escaleras o varios bloques?
 * Progressive disclosure · si elige "Sí, varias", aparecen 2 sub-steppers.
 */

import { cn } from "@/lib/utils";
import { Stepper } from "./Stepper";
import { LIMITES } from "./types";
import type { EstructuraEdificio } from "./types";

export function QuestionEstructura({
  estructura,
  escaleras,
  bloques,
  onEstructuraChange,
  onEscalerasChange,
  onBloquesChange,
}: {
  estructura: EstructuraEdificio;
  escaleras: number;
  bloques: number;
  onEstructuraChange: (e: EstructuraEdificio) => void;
  onEscalerasChange: (n: number) => void;
  onBloquesChange: (n: number) => void;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Pregunta 3 de 4
      </p>
      <h2 className="mt-2 text-[20px] sm:text-[22px] leading-tight font-bold text-foreground tracking-tight max-w-lg">
        ¿El edificio tiene varias escaleras o bloques?
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground max-w-md">
        La mayoría de edificios tienen una sola escalera y un solo bloque.
      </p>

      {/* Dos botones grandes lado a lado */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md">
        <OptionButton
          selected={estructura === "simple"}
          onClick={() => onEstructuraChange("simple")}
          title="No, una sola"
          desc="1 escalera · 1 bloque"
        />
        <OptionButton
          selected={estructura === "multiple"}
          onClick={() => onEstructuraChange("multiple")}
          title="Sí, varias"
          desc="Configuro escaleras y bloques"
        />
      </div>

      {/* Sub-bloque · solo si "Sí, varias" · compacto · sin scroll */}
      {estructura === "multiple" && (
        <div className="mt-4 w-full max-w-md rounded-2xl border border-border bg-card p-4 flex flex-col gap-2.5">
          <SubStepperRow
            label="Escaleras"
            value={escaleras}
            onChange={onEscalerasChange}
            min={LIMITES.escaleras.min}
            max={LIMITES.escaleras.max}
          />
          <div className="h-px bg-border/60" />
          <SubStepperRow
            label="Bloques"
            value={bloques}
            onChange={onBloquesChange}
            min={LIMITES.bloques.min}
            max={LIMITES.bloques.max}
          />
        </div>
      )}
    </div>
  );
}

function OptionButton({
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

function SubStepperRow({
  label, value, onChange, min, max,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <Stepper
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        variant="sm"
        ariaLabel={label}
      />
    </div>
  );
}
