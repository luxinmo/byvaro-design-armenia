/**
 * ViewToggle · segmented control para alternar modo de vista.
 *
 * Patrón estándar de Byvaro (replicado en Promociones / Ventas / Equipo).
 * Contenedor `bg-muted/40` con borde redondeado, botones dentro con
 * shadow-soft sobre fondo blanco cuando están activos.
 *
 * Uso:
 *   <ViewToggle
 *     value={viewMode}
 *     onChange={setViewMode}
 *     options={[
 *       { value: "list", icon: List, label: "Lista" },
 *       { value: "grid", icon: LayoutGrid, label: "Cuadrícula" },
 *       { value: "map", icon: MapIcon, label: "Mapa" },
 *     ]}
 *   />
 *
 * Por defecto: icono siempre + texto oculto <sm y visible >=sm. Pasa
 * `iconOnly` para forzar solo iconos (útil cuando el toggle está en
 * una toolbar densa tipo Promociones).
 */

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewToggleOption<V extends string> = {
  value: V;
  icon: LucideIcon;
  label: string;
};

type Props<V extends string> = {
  value: V;
  onChange: (next: V) => void;
  options: ViewToggleOption<V>[];
  /** Solo iconos · oculta siempre el label. */
  iconOnly?: boolean;
  /** Oculta el toggle completo por debajo de `sm`. */
  hiddenOnMobile?: boolean;
  className?: string;
};

export function ViewToggle<V extends string>({
  value, onChange, options, iconOnly = false, hiddenOnMobile = false, className,
}: Props<V>) {
  return (
    <div
      role="radiogroup"
      className={cn(
        "inline-flex items-center bg-muted/40 border border-border rounded-full p-0.5 text-xs",
        hiddenOnMobile && "hidden sm:inline-flex",
        className,
      )}
    >
      {options.map((opt) => {
        const Icon = opt.icon;
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            role="radio"
            aria-checked={active}
            aria-label={`Vista ${opt.label.toLowerCase()}`}
            title={opt.label}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 h-8 rounded-full transition-all",
              iconOnly ? "w-8" : "px-3 text-[12.5px] font-medium",
              active
                ? "bg-background text-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className={cn(iconOnly ? "h-4 w-4" : "h-3.5 w-3.5")} />
            {/* Labels siempre visibles · en mobile ayudan a entender la opción.
             *  Solo se ocultan cuando el caller pide explícitamente iconOnly. */}
            {!iconOnly && <span>{opt.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
