/**
 * FilterBar · sistema de filtros reutilizable
 *
 * Pills compactas con icono + label + valor seleccionado inline.
 * Estado activo: bg primary/10 + text primary (no negro plano).
 * Usable en Promociones, Contactos, Registros, Ventas (mismo look).
 *
 * Piezas:
 *   <FilterPill icon={Building2} label="Tipo" values={[]} options={...} onChange={...} />
 *   <SortPill value={sort} options={...} onChange={...} />
 *   <FilterChipsActive filters={...} onClear={...} />
 *
 * Todos comparten altura h-8, radio rounded-full, tipografía text-[12.5px].
 */

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check, X, ArrowUpDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════
   FilterPill · multi-select con icono
   ═══════════════════════════════════════════════════════════════════ */
export type FilterOption = { value: string; label: string };

interface FilterPillProps {
  icon?: LucideIcon;
  label: string;
  values: string[];
  options: FilterOption[];
  onChange: (values: string[]) => void;
  multi?: boolean;
}

export function FilterPill({
  icon: Icon, label, values, options, onChange, multi = true,
}: FilterPillProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (opt: FilterOption) => {
    if (multi) {
      onChange(values.includes(opt.value)
        ? values.filter(v => v !== opt.value)
        : [...values, opt.value]);
    } else {
      onChange(values.includes(opt.value) ? [] : [opt.value]);
      setOpen(false);
    }
  };

  const isActive = values.length > 0;
  const selectedLabels = values
    .map(v => options.find(o => o.value === v)?.label || v);

  // Display inline: si 1 seleccionado → muestra label; si >1 → muestra contador
  const displayValue = isActive
    ? (selectedLabels.length === 1
        ? selectedLabels[0]
        : `${selectedLabels.length} sel.`)
    : null;

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className={cn(
          "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12.5px] font-medium border transition-all whitespace-nowrap",
          isActive
            ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/15"
            : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
        )}
      >
        {Icon && <Icon className={cn("h-3.5 w-3.5", isActive ? "text-primary" : "text-muted-foreground/70")} />}
        <span>{label}</span>
        {displayValue && (
          <>
            <span className="text-primary/40">·</span>
            <span className="font-semibold">{displayValue}</span>
          </>
        )}
        <ChevronDown className={cn("h-3 w-3 opacity-70", open && "rotate-180")} />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1.5 bg-popover border border-border rounded-xl shadow-soft-lg z-50 min-w-[200px] py-1.5 animate-in"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {options.map((opt) => {
            const selected = values.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggle(opt)}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 text-sm transition-colors hover:bg-muted/40 text-left"
              >
                <div className={cn(
                  "w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors",
                  selected ? "bg-primary border-primary" : "border-muted-foreground/40"
                )}>
                  {selected && <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={3} />}
                </div>
                <span className={cn(selected ? "text-foreground font-medium" : "text-muted-foreground")}>
                  {opt.label}
                </span>
              </button>
            );
          })}
          {isActive && (
            <>
              <div className="h-px bg-border my-1" />
              <button
                onClick={() => { onChange([]); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
              >
                <X className="h-3 w-3" />
                Limpiar selección
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SortPill · ordenación
   ═══════════════════════════════════════════════════════════════════ */
export type SortOption = { value: string; label: string };

interface SortPillProps {
  value: string;
  options: SortOption[];
  onChange: (value: string) => void;
}

export function SortPill({ value, options, onChange }: SortPillProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const current = options.find(o => o.value === value);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12.5px] font-medium border border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all whitespace-nowrap"
      >
        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/70" />
        <span>Ordenar</span>
        {current && (
          <>
            <span className="text-border">·</span>
            <span className="font-semibold text-foreground">{current.label}</span>
          </>
        )}
        <ChevronDown className={cn("h-3 w-3 opacity-70", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1.5 bg-popover border border-border rounded-xl shadow-soft-lg z-50 min-w-[220px] py-1.5 animate-in">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full flex items-center justify-between px-3 py-1.5 text-sm transition-colors hover:bg-muted/40 text-left"
            >
              <span className={cn(value === opt.value ? "text-foreground font-medium" : "text-muted-foreground")}>
                {opt.label}
              </span>
              {value === opt.value && <Check className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   FilterChipsActive · chips de filtros activos con X para quitar
   ═══════════════════════════════════════════════════════════════════ */
interface ActiveChip {
  key: string;
  label: string;
  remove: () => void;
}

interface FilterChipsActiveProps {
  chips: ActiveChip[];
  onClearAll?: () => void;
}

export function FilterChipsActive({ chips, onClearAll }: FilterChipsActiveProps) {
  if (chips.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {chips.map((c, i) => (
        <span
          key={`${c.key}-${i}`}
          className="inline-flex items-center gap-1 h-7 pl-3 pr-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11.5px] font-semibold"
        >
          {c.label}
          <button
            onClick={c.remove}
            className="p-0.5 rounded-full hover:bg-primary/20 transition-colors"
            aria-label={`Quitar ${c.label}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {onClearAll && chips.length > 1 && (
        <button
          onClick={onClearAll}
          className="text-[11.5px] font-medium text-muted-foreground hover:text-foreground transition-colors px-2"
        >
          Limpiar todo
        </button>
      )}
    </div>
  );
}
