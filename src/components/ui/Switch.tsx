/**
 * Switch · toggle on/off simple y accesible.
 * No depende de Radix (para mantener el bundle bajo).
 * Sigue el patrón visual Byvaro: fondo primary cuando activo.
 */

import { cn } from "@/lib/utils";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function Switch({ checked, onCheckedChange, disabled, className, ariaLabel }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        checked ? "bg-primary" : "bg-muted-foreground/30",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <span
        className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-soft transition-transform"
        style={{ transform: checked ? "translateX(18px)" : "translateX(2px)" }}
      />
    </button>
  );
}
