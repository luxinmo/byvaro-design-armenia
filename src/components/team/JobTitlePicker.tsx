/**
 * JobTitlePicker · selector múltiple de cargos (máx 2) agrupado en 3
 * secciones (Leadership / Sales / Technical). Muestra el valor como
 * "Cargo A & Cargo B" y dispara autoasignación de departamento.
 *
 * Patrón visual: popover estilo dropdown · header por grupo en negrita
 * uppercase · items con check a la derecha cuando están seleccionados.
 */

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  JOB_TITLES_BY_GROUP,
  JOB_TITLE_GROUPS,
  type JobTitleGroup,
} from "@/data/jobTitles";
import { cn } from "@/lib/utils";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  /** Máximo de cargos simultáneos. Default 2. */
  max?: number;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
};

export function JobTitlePicker({
  value,
  onChange,
  max = 2,
  placeholder = "Selecciona un cargo",
  className,
  triggerClassName,
}: Props) {
  const [open, setOpen] = useState(false);

  const toggle = (key: string) => {
    if (value.includes(key)) {
      onChange(value.filter((v) => v !== key));
      return;
    }
    /* Si ya hay `max`, reemplazamos el primero (FIFO) — UX típica de
     * limit=2 donde no quieres bloquear al usuario con un toast. */
    if (value.length >= max) {
      onChange([...value.slice(1), key]);
      return;
    }
    onChange([...value, key]);
  };

  const display = value.length > 0 ? value.join(", ") : placeholder;

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "w-full flex items-center justify-between h-10 px-3 rounded-xl border border-border bg-card text-sm text-foreground hover:border-foreground/30 transition-colors gap-2",
              triggerClassName,
            )}
          >
            <span className={cn("truncate", value.length === 0 && "text-muted-foreground")}>
              {display}
            </span>
            <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform", open && "rotate-180")} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-1.5 max-h-[380px] overflow-y-auto" align="start">
          {(Object.keys(JOB_TITLES_BY_GROUP) as JobTitleGroup[]).map((group) => {
            const titles = JOB_TITLES_BY_GROUP[group];
            return (
              <div key={group} className="mb-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground px-2.5 py-1.5 sticky top-0 bg-popover">
                  {JOB_TITLE_GROUPS[group]}
                </p>
                {titles.map((t) => {
                  const active = value.includes(t.key);
                  const atLimit = !active && value.length >= max;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => toggle(t.key)}
                      className={cn(
                        "w-full text-left px-2.5 py-1.5 text-sm rounded-lg flex items-center justify-between gap-2 transition-colors",
                        active
                          ? "bg-primary/10 text-primary font-medium"
                          : atLimit
                            ? "text-muted-foreground/50 cursor-default hover:bg-transparent"
                            : "text-foreground hover:bg-muted",
                      )}
                    >
                      <span className="truncate">{t.key}</span>
                      {active && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            );
          })}
          <div className="border-t border-border/60 mt-1 pt-1 px-2.5 py-1.5 flex items-center justify-between text-[11px] text-muted-foreground sticky bottom-0 bg-popover">
            <span>
              {value.length} / {max} seleccionado{value.length !== 1 ? "s" : ""}
            </span>
            {value.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs font-medium text-foreground hover:underline"
              >
                Limpiar
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
