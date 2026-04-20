/**
 * MinimalSort · dropdown discreto de texto. Usado como selector de
 * orden y de filtros en varios listados (Promociones, Disponibilidad).
 *
 * Patrón: etiqueta tenue + valor en negrita + chevron. Al abrirse
 * muestra un popover con las opciones, el valor actual con check.
 */
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function MinimalSort({
  value,
  options,
  onChange,
  label,
  align = "right",
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  /** Etiqueta prefija opcional (ej. "Ordenar por"). Oculta en móvil. */
  label?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const current = options.find((o) => o.value === value);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground transition-colors"
      >
        {label && <span className="hidden sm:inline">{label}</span>}
        <span className="font-semibold text-foreground">{current?.label}</span>
        <ChevronDown className={cn("h-3 w-3 opacity-60 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          className={cn(
            "absolute top-full mt-2 bg-popover border border-border rounded-xl shadow-soft-lg z-30 min-w-[220px] py-1.5",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
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
