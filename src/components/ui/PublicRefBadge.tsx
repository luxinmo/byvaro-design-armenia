/**
 * PublicRefBadge — pill compacto que muestra una `publicRef`.
 *
 * Formato visual: monospace pequeño, color muted, click-to-copy con
 * toast de confirmación. Tooltip explica que es la referencia interna.
 *
 * Uso:
 *   <PublicRefBadge value="co000042" />
 *   <PublicRefBadge value="re000123" size="sm" />
 *
 * Reusable en: Contact list, ficha contacto, ficha registro, ficha
 * lead, banners de conflicto.
 */

import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  size?: "sm" | "md";
  className?: string;
  /** Si false, oculta el icono de copy (solo display). */
  copyable?: boolean;
};

export function PublicRefBadge({ value, size = "sm", className, copyable = true }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!copyable) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard puede fallar en contextos http · ignoramos */
    }
  };

  const Icon = copied ? Check : Copy;

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border/50 bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors tabular-nums font-mono",
        size === "sm" ? "h-5 px-1.5 text-[10.5px]" : "h-6 px-2 text-[11px]",
        !copyable && "cursor-default pointer-events-none",
        className,
      )}
      title={copied ? "Copiado" : `Referencia interna · click para copiar`}
      aria-label={`Referencia ${value}`}
    >
      <span>{value}</span>
      {copyable && <Icon className={cn(size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3", "opacity-50 group-hover:opacity-100")} strokeWidth={2} />}
    </button>
  );
}
