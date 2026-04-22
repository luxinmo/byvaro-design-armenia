/**
 * MultiSelectFilter · dropdown multiselect con chips debajo.
 *
 * Patrón:
 *   ┌──────────────────────────┐
 *   │ Select sources...   ▼  3 │   ← trigger (count si hay selección)
 *   └──────────────────────────┘
 *   [× Iberia Homes] [× Idealista] [× Direct]
 *
 *   Al click se abre un popover con la lista de opciones (con
 *   checkbox por opción, opcional `searchable` para listas largas).
 *   Las opciones marcadas aparecen como chips debajo del trigger;
 *   click en la X de un chip lo deselecciona.
 *
 * El popover se renderiza vía createPortal a document.body con
 * posición calculada — así nunca lo recorta el drawer (mismo
 * patrón que FilterModeChip y FilterPill de FilterBar).
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type MultiSelectOption = {
  value: string;
  label: string;
  /** Prefijo opcional (emoji bandera, avatar inicial, dot color…). */
  prefix?: string;
};

interface Props {
  /** Texto del placeholder cuando no hay selección. */
  placeholder: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** Mostrar buscador dentro del popover (recomendado >8 opciones). */
  searchable?: boolean;
  /** Texto del placeholder del search input. */
  searchPlaceholder?: string;
}

const EDGE_MARGIN = 8;
const POPOVER_DEFAULT_WIDTH = 280;
const MAX_LIST_HEIGHT = 280;

export function MultiSelectFilter({
  placeholder,
  options,
  selected,
  onChange,
  searchable = false,
  searchPlaceholder = "Search…",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  /* Posición del popover (fixed, calculada desde rect del trigger). */
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const update = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const width = Math.max(rect.width, POPOVER_DEFAULT_WIDTH);
      let left = rect.left;
      const maxLeft = window.innerWidth - width - EDGE_MARGIN;
      left = Math.max(EDGE_MARGIN, Math.min(left, maxLeft));
      const top = rect.bottom + 4;
      setPos({ top, left, width });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  /* Cerrar al click fuera */
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (triggerRef.current?.contains(target)) return;
      if (target.closest("[data-multiselect-popover]")) return;
      setOpen(false);
      setQuery("");
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = (value: string) => {
    onChange(
      selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value],
    );
  };

  const remove = (value: string) => onChange(selected.filter((v) => v !== value));

  const visible = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;

  const labelOf = (value: string) =>
    options.find((o) => o.value === value)?.label ?? value;
  const prefixOf = (value: string) =>
    options.find((o) => o.value === value)?.prefix;

  return (
    <div className="space-y-2">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full inline-flex items-center justify-between gap-2 h-9 px-3.5 rounded-full border text-[13px] transition-colors text-left",
          open
            ? "bg-card border-foreground/40"
            : selected.length > 0
              ? "bg-card border-border hover:border-foreground/30"
              : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
        )}
      >
        <span className={cn("truncate flex-1", selected.length === 0 && "text-muted-foreground")}>
          {selected.length === 0 ? placeholder : `${selected.length} selected`}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0",
            open && "rotate-180",
          )}
        />
      </button>

      {/* Popover via portal */}
      {open && pos &&
        createPortal(
          <div
            ref={popoverRef}
            data-multiselect-popover
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: pos.width,
              zIndex: 9999,
            }}
            className="bg-popover border border-border rounded-2xl shadow-soft-lg overflow-hidden"
          >
            {searchable && (
              <div className="px-2.5 py-2 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                  <input
                    autoFocus
                    placeholder={searchPlaceholder}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full h-8 pl-8 pr-2 rounded-full bg-muted/40 border border-transparent focus:bg-background focus:border-border outline-none text-[12.5px] placeholder:text-muted-foreground"
                  />
                </div>
              </div>
            )}

            <div
              className="overflow-y-auto py-1.5"
              style={{ maxHeight: MAX_LIST_HEIGHT }}
            >
              {visible.length === 0 ? (
                <p className="text-[12px] text-muted-foreground italic text-center py-4 px-3">
                  No matches
                </p>
              ) : (
                visible.map((opt) => {
                  const isSelected = selected.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggle(opt.value)}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-1.5 text-[13px] transition-colors text-left",
                        "hover:bg-muted/50",
                        isSelected ? "text-foreground font-medium" : "text-muted-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                          isSelected ? "bg-primary border-primary" : "border-muted-foreground/40",
                        )}
                      >
                        {isSelected && (
                          <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={3} />
                        )}
                      </span>
                      {opt.prefix && <span className="shrink-0">{opt.prefix}</span>}
                      <span className="flex-1 truncate">{opt.label}</span>
                    </button>
                  );
                })
              )}
            </div>

            {selected.length > 0 && (
              <div className="border-t border-border px-2.5 py-1.5 flex items-center justify-between">
                <span className="text-[10.5px] text-muted-foreground">
                  {selected.length} selected
                </span>
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-[10.5px] text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}

      {/* Chips de selección debajo */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((value) => {
            const prefix = prefixOf(value);
            return (
              <span
                key={value}
                className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[12px] font-medium"
              >
                {prefix && <span className="shrink-0">{prefix}</span>}
                <span className="truncate max-w-[160px]">{labelOf(value)}</span>
                <button
                  type="button"
                  onClick={() => remove(value)}
                  title="Remove"
                  className="h-5 w-5 rounded-full hover:bg-primary/20 flex items-center justify-center shrink-0 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
