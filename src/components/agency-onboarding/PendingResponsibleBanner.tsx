/**
 * PendingResponsibleBanner · banda persistente que recuerda al admin
 * actual de una agencia recién creada que el setup del Responsable
 * está aplazado · "Lo haré más tarde". Aparece en TODAS las pantallas
 * de la agencia hasta que se completa.
 *
 * No se renderiza si:
 *   · La cuenta no es de tipo agency.
 *   · La agencia no es de las creadas vía /invite/:token (los seeds
 *     no tienen onboarding pendiente).
 *   · El setup ya está completo.
 *   · El setup está pendiente pero NO aplazado (en ese caso el modal
 *     ya está bloqueando la pantalla).
 *
 * El click en "Continuar configuración" re-abre el dialog vía un
 * estado controlado (forceOpen).
 */

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useCurrentUser } from "@/lib/currentUser";
import {
  needsResponsibleSetup, getAgencyOnboardingState,
  onAgencyOnboardingChanged,
} from "@/lib/agencyOnboarding";
import { ResponsibleSetupDialog } from "./ResponsibleSetupDialog";

export function PendingResponsibleBanner() {
  const user = useCurrentUser();
  const [, tick] = useState(0);
  const [reopenForce, setReopenForce] = useState(false);

  useEffect(() => onAgencyOnboardingChanged(() => tick((n) => n + 1)), []);

  const isAgencyUser = user.accountType === "agency";
  const agencyId = isAgencyUser ? user.agencyId : undefined;
  if (!agencyId) return null;

  const isPending = needsResponsibleSetup(agencyId);
  const state = getAgencyOnboardingState(agencyId);
  const isDeferred = !!state?.deferredAt && !state.completedAt;

  /* Solo pintamos el banner si el setup está aplazado · si está
   * "fresh-pending" sin defer, el modal ya bloquea la pantalla. */
  if (!isPending || !isDeferred) return null;

  return (
    <>
      <div className="sticky top-0 z-30 bg-warning/10 border-b border-warning/30 px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="max-w-[1400px] mx-auto flex items-center gap-3 flex-wrap">
          <span className="h-7 w-7 rounded-lg bg-warning/30 text-warning grid place-items-center shrink-0">
            <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
          <p className="flex-1 min-w-0 text-[12.5px] text-foreground leading-snug">
            <span className="font-semibold">Falta configurar el Responsable de la agencia.</span>{" "}
            <span className="text-muted-foreground">
              Sin él no podrás invitar miembros, generar contratos ni gestionar el plan.
            </span>
          </p>
          <button
            type="button"
            onClick={() => setReopenForce(true)}
            className="inline-flex items-center gap-1 h-8 px-3 rounded-full bg-foreground text-background text-[12.5px] font-semibold hover:bg-foreground/90 transition-colors shrink-0"
          >
            Continuar configuración
            <ArrowRight className="h-3 w-3" strokeWidth={2.25} />
          </button>
        </div>
      </div>

      {/* Re-apertura controlada cuando el user pulsa "Continuar". */}
      {reopenForce && (
        <ResponsibleSetupDialog
          forceOpen
          onClose={() => setReopenForce(false)}
        />
      )}
    </>
  );
}
