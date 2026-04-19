/**
 * Checkbox · simple, accesible, alineado al design system Byvaro.
 * Sin Radix. Incluye label opcional con for/id.
 */

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckboxProps {
  id?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}

export function Checkbox({ id, checked, onCheckedChange, disabled, label, className }: CheckboxProps) {
  const input = (
    <button
      type="button"
      role="checkbox"
      id={id}
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange(!checked)}
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        checked ? "bg-primary border-primary text-primary-foreground" : "bg-card border-border hover:border-foreground/40",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      {checked && <Check className="h-3 w-3" strokeWidth={3} />}
    </button>
  );
  if (!label) return input;
  return (
    <label htmlFor={id} className="flex items-center gap-2 cursor-pointer">
      {input}
      <span className="text-xs text-muted-foreground select-none">{label}</span>
    </label>
  );
}
