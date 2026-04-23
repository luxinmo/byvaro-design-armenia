/**
 * GracePeriodBanner — ventana de 5 minutos para REVERTIR una decisión.
 *
 * Cuando el promotor aprueba o rechaza un registro, la notificación a
 * la agencia NO se envía inmediatamente: hay 5 minutos de gracia para
 * que el promotor pueda deshacer si fue un error. El banner muestra el
 * tiempo restante en cuenta atrás y un botón "Revertir".
 *
 * Si `record.decidedAt` es más antiguo que 5 minutos, no renderiza
 * nada (la notificación ya se considera enviada).
 *
 * El backend respeta esta ventana: el job de notificación se programa
 * con un delay de 5min y se cancela si recibe `POST /records/:id/revert`
 * antes de disparar.
 */

import { useEffect, useState } from "react";
import { Clock, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Registro } from "@/data/records";

const GRACE_MS = 5 * 60 * 1000;

export function GracePeriodBanner({
  record, onRevert,
}: {
  record: Registro;
  /** Handler que devuelve el registro a `pendiente` y emite el evento. */
  onRevert: () => void;
}) {
  /* Se re-renderiza cada segundo para actualizar el countdown. */
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!record.decidedAt) return null;
  if (record.estado !== "aprobado" && record.estado !== "rechazado") return null;

  const elapsed = Date.now() - new Date(record.decidedAt).getTime();
  const remaining = GRACE_MS - elapsed;
  if (remaining <= 0) return null;

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  const mmss = `${minutes}:${String(seconds).padStart(2, "0")}`;

  return (
    <div className="rounded-xl border border-warning/30 bg-warning/40 dark:bg-warning/5 p-3 sm:p-4 flex items-center gap-3">
      <div className="h-9 w-9 rounded-xl bg-warning/15 grid place-items-center text-warning dark:text-warning shrink-0">
        <Clock className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-warning dark:text-warning leading-tight">
          La agencia será notificada en <span className="tnum">{mmss}</span>
        </p>
        <p className="text-[10.5px] text-warning/80 dark:text-warning/80 mt-0.5">
          Puedes revertir tu decisión antes de que se envíe la notificación.
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={onRevert}
        className="rounded-full h-8 border-warning/50 text-warning hover:bg-warning/60 dark:text-warning dark:hover:bg-warning/10"
      >
        <RotateCcw className="h-3.5 w-3.5" /> Revertir
      </Button>
    </div>
  );
}
