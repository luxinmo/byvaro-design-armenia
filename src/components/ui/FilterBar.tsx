/**
 * FilterBar · sistema de filtros reutilizable
 *
 * Pills compactas con icono + label + valor seleccionado inline.
 * Estado activo: bg primary/10 + text primary (no negro plano).
 * Usable en Promociones, Contactos, Registros, Ventas (mismo look).
 *
 * Los popovers se renderizan via React Portal al document.body para
 * evitar problemas de clipping por contenedores con overflow-x-auto
 * (como la toolbar horizontal scrollable en móvil).
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, X, ArrowUpDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Hook: posicionar popover debajo del botón ─── */
function usePopoverPosition(
  buttonRef: React.RefObject<HTMLButtonElement>,
  open: boolean,
  align: "start" | "end" = "start",
) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const update = () => {
      const rect = buttonRef.current!.getBoundingClientRect();
      const top = rect.bottom + 6;
      const left = align === "end"
        ? rect.right
        : rect.left;
      setPos({ top, left });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, align, buttonRef]);

  return pos;
}

/* ─── Hook: cerrar al click fuera (button + portal) ─── */
function useClickOutside(
  buttonRef: React.RefObject<HTMLElement>,
  open: boolean,
  onClose: () => void,
  portalDataAttr: string,
) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (buttonRef.current?.contains(target)) return;
      if (target.closest(`[${portalDataAttr}]`)) return;
      onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose, buttonRef, portalDataAttr]);
}

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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pos = usePopoverPosition(buttonRef, open, "start");

  useClickOutside(buttonRef, open, () => setOpen(false), "data-filter-pill-portal");

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
  const selectedLabels = values.map(v => options.find(o => o.value === v)?.label || v);

  const displayValue = isActive
    ? (selectedLabels.length === 1 ? selectedLabels[0] : `${selectedLabels.length} sel.`)
    : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12.5px] font-medium border transition-all whitespace-nowrap shrink-0",
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
        <ChevronDown className={cn("h-3 w-3 opacity-70 transition-transform", open && "rotate-180")} />
      </button>

      {open && pos && createPortal(
        <div
          data-filter-pill-portal
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
          className="bg-popover border border-border rounded-xl shadow-soft-lg min-w-[220px] py-1.5 max-h-[60vh] overflow-y-auto"
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
        </div>,
        document.body
      )}
    </>
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pos = usePopoverPosition(buttonRef, open, "end");

  useClickOutside(buttonRef, open, () => setOpen(false), "data-sort-pill-portal");

  const current = options.find(o => o.value === value);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12.5px] font-medium border border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all whitespace-nowrap shrink-0"
      >
        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/70" />
        <span>Ordenar</span>
        {current && (
          <>
            <span className="text-border">·</span>
            <span className="font-semibold text-foreground">{current.label}</span>
          </>
        )}
        <ChevronDown className={cn("h-3 w-3 opacity-70 transition-transform", open && "rotate-180")} />
      </button>

      {open && pos && createPortal(
        <div
          data-sort-pill-portal
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            transform: "translateX(-100%)",
            zIndex: 9999,
          }}
          className="bg-popover border border-border rounded-xl shadow-soft-lg min-w-[240px] py-1.5 max-h-[60vh] overflow-y-auto"
        >
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
        </div>,
        document.body
      )}
    </>
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
