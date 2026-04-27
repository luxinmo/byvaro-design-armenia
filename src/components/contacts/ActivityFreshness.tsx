/**
 * ActivityFreshness — pill colored según freshness de la última
 * actividad con un Contact (Phase 1 · global, no per-party).
 *
 *   <14 días  · verde  "Activo"
 *   14-44 d   · ámbar  "Inactivo"
 *   ≥45 d     · rojo   "Dormido"
 *   sin data  · gris   "Sin actividad"
 *
 * Reusable en lista de contactos, ficha de contacto, banner de
 * conflicto en registros.
 */

import { Clock } from "lucide-react";
import { activityLevel, daysSince, humanizeActivity, type ActivityLevel } from "@/lib/contactActivity";
import { cn } from "@/lib/utils";

type Props = {
  /** ISO timestamp de la última actividad. Undefined renderiza "sin data". */
  lastActivityAt?: string;
  /** Modo compacto · solo color + tooltip · sin texto. */
  compact?: boolean;
  className?: string;
};

const LEVEL_STYLES: Record<ActivityLevel, { bg: string; text: string; label: string }> = {
  fresh:    { bg: "bg-success/10",     text: "text-success",     label: "Activo"   },
  inactive: { bg: "bg-warning/15",     text: "text-warning",     label: "Inactivo" },
  dormant:  { bg: "bg-destructive/10", text: "text-destructive", label: "Dormido"  },
};

export function ActivityFreshness({ lastActivityAt, compact, className }: Props) {
  if (!lastActivityAt) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground/70 text-[10.5px] font-medium",
          compact ? "h-4 w-4 justify-center" : "h-5 px-2",
          className,
        )}
        title="Sin actividad registrada"
      >
        {compact ? <Clock className="h-2.5 w-2.5" /> : "Sin actividad"}
      </span>
    );
  }

  const level = activityLevel(lastActivityAt);
  const days = daysSince(lastActivityAt);
  const human = humanizeActivity(lastActivityAt);
  const styles = LEVEL_STYLES[level];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium tabular-nums",
        styles.bg,
        styles.text,
        compact ? "h-4 w-4 justify-center" : "h-5 px-2 text-[10.5px]",
        className,
      )}
      title={`${styles.label} · ${human} (${days} días)`}
    >
      <Clock className={compact ? "h-2.5 w-2.5" : "h-2.5 w-2.5"} strokeWidth={2.25} />
      {!compact && <span>{human}</span>}
    </span>
  );
}
