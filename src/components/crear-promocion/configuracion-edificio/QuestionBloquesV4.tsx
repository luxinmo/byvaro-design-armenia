/**
 * V4 · Pregunta 1 · Bloques
 *
 * Sin selección por defecto · usuario debe elegir explícitamente.
 * "Un único bloque" → auto-advance.
 * "Más de un bloque" → auto-advance también (se configurarán uno a
 *   uno en los siguientes pasos).
 *
 * El sub-stepper de "cuántos" no se muestra aquí · se gestiona desde
 * el flujo per-bloque (cada vez que termines un bloque, decides si
 * añadir otro).
 */

import { cn } from "@/lib/utils";
import { Building2, Building } from "lucide-react";

export function QuestionBloquesV4({
  hasChosen,
  isSingle,
  onSelect,
}: {
  hasChosen: boolean;
  isSingle: boolean;
  onSelect: (single: boolean) => void;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Pregunta 1
      </p>
      <h2 className="mt-2 text-[20px] sm:text-[22px] leading-tight font-bold text-foreground tracking-tight max-w-md">
        ¿La promoción tiene uno o varios bloques?
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground max-w-md">
        Cada bloque es un edificio independiente que comparte la misma promoción.
      </p>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-md">
        <Card
          Icon={Building2}
          title="Un único bloque"
          desc="Una sola edificación"
          selected={hasChosen && isSingle}
          onClick={() => onSelect(true)}
        />
        <Card
          Icon={Building}
          title="Más de un bloque"
          desc="Configuro cada uno por separado"
          selected={hasChosen && !isSingle}
          onClick={() => onSelect(false)}
        />
      </div>
    </div>
  );
}

function Card({
  Icon, title, desc, selected, onClick,
}: {
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  desc: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border-2 p-5 text-left transition-all flex flex-col gap-2",
        "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none",
        selected
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-foreground hover:border-foreground/40",
      )}
    >
      <div className={cn(
        "h-10 w-10 rounded-xl grid place-items-center transition-colors",
        selected ? "bg-background/15 text-background" : "bg-muted text-muted-foreground",
      )}>
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <div>
        <p className="text-[14px] font-semibold leading-tight">{title}</p>
        <p className={cn("text-[12px] mt-1 leading-snug", selected ? "text-background/70" : "text-muted-foreground")}>
          {desc}
        </p>
      </div>
    </button>
  );
}
