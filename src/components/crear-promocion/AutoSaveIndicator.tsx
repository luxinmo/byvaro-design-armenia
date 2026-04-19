/**
 * AutoSaveIndicator · muestra el estado del autoguardado del wizard.
 *
 * Estados:
 *   - "saving"  → punto pulsante + texto "Guardando…"
 *   - "saved"   → check verde + "Guardado hace Xs" (refresh cada 1s)
 *   - "error"   → (no implementado aún — MVP asume localStorage siempre OK)
 *
 * El componente espera recibir `savedAt` (timestamp ms) del padre, que lo
 * actualiza tras cada escritura a localStorage. El texto se recalcula cada
 * segundo mediante un setInterval local (no depende de re-renders externos).
 */

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function formatRelative(savedAt: number, now: number): string {
  const diffSec = Math.max(0, Math.floor((now - savedAt) / 1000));
  if (diffSec < 3) return "ahora mismo";
  if (diffSec < 60) return `hace ${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `hace ${diffHr} h`;
  return "hace más de un día";
}

export function AutoSaveIndicator({
  savedAt,
  saving = false,
  className,
}: {
  savedAt: number | null;
  saving?: boolean;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  // Refresco cada segundo mientras esté montado. Coste ~despreciable.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (saving) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground",
          className,
        )}
        aria-live="polite"
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        Guardando…
      </span>
    );
  }

  if (savedAt == null) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground/60", className)}>
        Sin guardar
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground",
        className,
      )}
      aria-live="polite"
      title={new Date(savedAt).toLocaleTimeString()}
    >
      <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Check className="h-2.5 w-2.5" strokeWidth={3} />
      </span>
      Guardado {formatRelative(savedAt, now)}
    </span>
  );
}
