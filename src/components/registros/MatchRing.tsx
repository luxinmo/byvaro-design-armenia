/**
 * MatchRing — anillo SVG con porcentaje de duplicado.
 *
 * Color por umbral (alineado con `getMatchLevel()` de
 * `src/data/records.ts` y la regla del producto en `CLAUDE.md`):
 *   ≥ 70%  → destructive (rojo)
 *   40-69% → ámbar
 *   <  40% → emerald (verde)
 *   0%     → muted (sin coincidencias)
 *
 * Usado en:
 *  · Lista de Registros (size compacto, 12).
 *  · Detalle de Registro (size grande, 14 o 16).
 */

import { cn } from "@/lib/utils";

type Props = {
  pct: number;
  /** Tamaño en unidades Tailwind (12 = h-12 w-12). Default 12. */
  size?: 12 | 14 | 16;
};

export function MatchRing({ pct, size = 12 }: Props) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  const colorClass =
    pct >= 70 ? "text-destructive" :
    pct >= 40 ? "text-amber-500" :
    pct > 0   ? "text-emerald-500" :
                "text-muted-foreground/40";

  const sizeClasses =
    size === 16 ? "h-16 w-16" :
    size === 14 ? "h-14 w-14" :
                  "h-12 w-12";
  const textSize =
    size === 16 ? "text-sm" :
    size === 14 ? "text-xs" :
                  "text-[10px]";

  return (
    <div className={cn("relative shrink-0", sizeClasses)}>
      <svg className={cn("-rotate-90", sizeClasses)} viewBox="0 0 40 40">
        <circle
          cx="20" cy="20" r={radius}
          fill="none" stroke="currentColor" strokeWidth="2"
          className="text-border/30"
        />
        <circle
          cx="20" cy="20" r={radius}
          fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={colorClass}
        />
      </svg>
      <span className={cn(
        "absolute inset-0 flex items-center justify-center font-bold tnum",
        textSize, colorClass,
      )}>
        {pct}%
      </span>
    </div>
  );
}
