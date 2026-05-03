/**
 * Stepper · variante 'big' (botones 52px, número serif 56px) para las
 * preguntas principales · variante 'sm' para sub-steppers (escaleras,
 * bloques) en la pregunta de estructura.
 *
 * Validación · al perder foco, restaura el último valor válido si el
 * input quedó vacío o fuera de rango.
 */

import { useState, useEffect, useId } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function Stepper({
  value,
  onChange,
  min = 1,
  max = 99,
  variant = "big",
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  variant?: "big" | "sm";
  ariaLabel?: string;
}) {
  const inputId = useId();
  const [draft, setDraft] = useState(String(value));

  /* Sync external changes (ej. cambio desde otro lado) hacia el input. */
  useEffect(() => { setDraft(String(value)); }, [value]);

  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const commit = (raw: string) => {
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) {
      setDraft(String(value));
      return;
    }
    const next = clamp(n);
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  const isBig = variant === "big";
  /* Sizing compacto · debe encajar en una sola pantalla sin scroll
   * junto al título + nav + preview en el otro lado. Botones 44px y
   * número 36px en lugar de 52/48 para ganar ~30px verticales. */
  const btnSize = isBig ? "h-11 w-11" : "h-9 w-9";
  const numSize = isBig
    ? "text-[36px] leading-none font-bold tracking-tight w-[80px]"
    : "text-[18px] leading-none font-semibold w-[56px]";

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center",
        isBig ? "gap-4" : "gap-2",
      )}
    >
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
        aria-label={`Disminuir${ariaLabel ? ` · ${ariaLabel}` : ""}`}
        className={cn(
          "rounded-full border border-border bg-card text-foreground grid place-items-center transition-colors",
          "hover:border-foreground/40 hover:bg-muted active:scale-95",
          "disabled:opacity-30 disabled:cursor-not-allowed",
          btnSize,
        )}
      >
        <Minus className={isBig ? "h-4 w-4" : "h-3.5 w-3.5"} strokeWidth={1.75} />
      </button>

      <input
        id={inputId}
        type="number"
        min={min}
        max={max}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit((e.target as HTMLInputElement).value);
            (e.target as HTMLInputElement).blur();
          }
        }}
        aria-label={ariaLabel}
        className={cn(
          "text-center bg-transparent text-foreground tabular-nums outline-none",
          "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          isBig
            ? "focus:underline decoration-primary underline-offset-8 decoration-2"
            : "border border-border rounded-lg h-9 px-2 focus:border-primary focus:ring-1 focus:ring-primary/20",
          numSize,
        )}
      />

      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        aria-label={`Aumentar${ariaLabel ? ` · ${ariaLabel}` : ""}`}
        className={cn(
          "rounded-full border border-border bg-card text-foreground grid place-items-center transition-colors",
          "hover:border-foreground/40 hover:bg-muted active:scale-95",
          "disabled:opacity-30 disabled:cursor-not-allowed",
          btnSize,
        )}
      >
        <Plus className={isBig ? "h-4 w-4" : "h-3.5 w-3.5"} strokeWidth={1.75} />
      </button>
    </div>
  );
}
