/**
 * UsagePill — pill discreto en el header (desktop) y mobile-header
 * que muestra el uso del plan trial cuando se acerca a un límite (≥80%).
 *
 * QUÉ
 * ----
 * - Solo se renderiza si el usuario es promotor (developer) y el plan
 *   activo es `trial`.
 * - Calcula el contador con mayor presión (% más alto contra su tope)
 *   y lo muestra como `8/10 promociones` con color ámbar.
 * - Click → abre el `UpgradeModal` con trigger `near_limit`.
 *
 * Por qué este pill (y no un toast persistente o un banner full-width):
 * - No interrumpe el trabajo · es discreto pero siempre visible.
 * - Convierte la presión psicológica en una acción a un click.
 *
 * Aparece en cuanto cualquier counter llega al **80% del límite**
 * (umbral tunable abajo). Antes del 80% no hay nada — silencio.
 */

import { useUpgradeReason, NEAR_LIMIT_THRESHOLD } from "@/lib/usagePressure";
import { openUpgradeModal } from "@/lib/usageGuard";
import { usePaywallAnalytics } from "@/lib/analytics";
import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function UsagePill({ className }: { className?: string }) {
  const reason = useUpgradeReason();
  const analytics = usePaywallAnalytics();
  if (!reason) return null;

  const { used, limit, label } = reason;
  const atLimit = used >= limit;

  /* Click en el pill → emite `usage_pill.clicked` y abre el modal con
   *  trigger `near_limit`. El modal a su vez emite `paywall.shown`. */
  const handleClick = () => {
    analytics.track("usage_pill.clicked", { trigger: "near_limit", used, limit });
    openUpgradeModal({ trigger: "near_limit", used, limit });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[11.5px] font-medium transition-colors",
        atLimit
          ? "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15"
          : "border-warning/30 bg-warning/15 text-warning hover:bg-warning/25",
        className,
      )}
      title={atLimit ? `Has llegado al límite de ${label}` : `${used}/${limit} ${label}`}
    >
      <TriangleAlert className="h-3 w-3" strokeWidth={2.25} />
      <span className="tabular-nums">
        {used}/{limit === Number.POSITIVE_INFINITY ? "∞" : limit}
      </span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

/* Export del umbral para que tests/docs puedan referenciarlo. */
export { NEAR_LIMIT_THRESHOLD };
