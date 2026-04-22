/**
 * Primitivas de fila para SettingsCard — copiadas del patrón Lovable
 * (figgy-friend-forge · components/settings/fields.tsx) y adaptadas a
 * tokens Byvaro.
 *
 * Componentes:
 *   - SettingsRow         · fila simple label + description + control
 *   - SettingsRowGroup    · agrupa N filas con divider sutil entre cada una
 *   - SettingsField       · label encima + control debajo (forms verticales)
 *   - SettingsToggle      · switch de configuración (atajo de SettingsRow)
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SettingsRow({
  label,
  description,
  control,
  className,
}: {
  label: ReactNode;
  description?: ReactNode;
  control?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 py-3.5",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
      {control && <div className="shrink-0">{control}</div>}
    </div>
  );
}

export function SettingsRowGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("divide-y divide-border/40 -my-3.5", className)}>
      {children}
    </div>
  );
}

export function SettingsToggle({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onCheckedChange: (b: boolean) => void;
}) {
  return (
    <SettingsRow
      label={label}
      description={description}
      control={
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onCheckedChange(!checked)}
          className={cn(
            "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors",
            checked ? "bg-primary" : "bg-muted-foreground/30",
          )}
        >
          <span
            className={cn(
              "inline-block h-4 w-4 rounded-full bg-background shadow transition-transform mt-0.5",
              checked ? "translate-x-4" : "translate-x-0.5",
            )}
          />
        </button>
      }
    />
  );
}

export function SettingsField({
  label,
  description,
  children,
  htmlFor,
  className,
}: {
  label: string;
  description?: string;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="text-[12px] font-medium text-foreground block"
      >
        {label}
      </label>
      {description && (
        <p className="text-[11.5px] text-muted-foreground leading-relaxed">{description}</p>
      )}
      {children}
    </div>
  );
}
