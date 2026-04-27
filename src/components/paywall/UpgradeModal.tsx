/**
 * UpgradeModal — modal global del paywall (Fase 1 · validación 249€).
 *
 * QUÉ
 * ----
 * Se monta UNA VEZ en `App.tsx` y escucha el store singleton
 * `usageGuard::useUpgradeModalState`. Cualquier parte de la app
 * dispara el modal con `useUsageGuard(action).openUpgrade()`.
 *
 * Tres triggers · cada uno con copy específico:
 *   · createPromotion · "Has llegado al límite de promociones activas"
 *   · inviteAgency    · "Has llegado al límite de agencias invitadas"
 *   · acceptRegistro  · "Has llegado al límite de registros recibidos"
 *   · near_limit      · variante "Estás cerca del límite" (el banner del header).
 *
 * El CTA primario simula la suscripción (mock · `subscribeToPromoter249()`)
 * y muestra toast de éxito. En backend real abriría Stripe Checkout.
 *
 * CLAUDE.md §"Responsive móvil sin popovers" · en mobile ocupa
 * pantalla completa con header/footer sticky y CTA principal abajo.
 */

import { useEffect } from "react";
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Sparkles, Check, Building2, Users, FileCheck2, X, Info, Crown,
} from "lucide-react";
import { toast } from "sonner";
import {
  useUpgradeModalState, closeUpgradeModal,
  type PaywallTrigger,
} from "@/lib/usageGuard";
import { subscribeToPromoter249, PLAN_LABEL } from "@/lib/plan";
import { usePaywallAnalytics } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/* ══════ Copy por trigger ═════════════════════════════════════════ */

type Copy = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: (used: number, limit: number) => string;
};

const COPY: Record<PaywallTrigger, Copy> = {
  createPromotion: {
    icon: Building2,
    title: "Has llegado al límite de promociones",
    subtitle: (u, l) =>
      `La versión gratuita permite ${l} promoción${l === 1 ? "" : "es"} activa${l === 1 ? "" : "s"} (${u}/${l} en uso). Suscríbete y publica hasta 5.`,
  },
  inviteAgency: {
    icon: Users,
    title: "Has llegado al límite de agencias",
    subtitle: (u, l) =>
      `Has invitado ${u} agencia${u === 1 ? "" : "s"} de ${l} permitidas en gratis. Con el plan promotor invitas sin límite.`,
  },
  acceptRegistro: {
    icon: FileCheck2,
    title: "Has llegado al límite de registros",
    subtitle: (u, l) =>
      `Tu workspace ha recibido ${u} registros (límite ${l} en gratis). Suscríbete para aprobar registros sin tope.`,
  },
  near_limit: {
    icon: Info,
    title: "Estás cerca del límite gratuito",
    subtitle: (u, l) =>
      `Llevas ${u} de ${l}. Cuando lo alcances, las acciones clave quedarán bloqueadas hasta que actualices el plan.`,
  },
};

/* ══════ Componente ═══════════════════════════════════════════════ */

export function UpgradeModal() {
  const state = useUpgradeModalState();
  const analytics = usePaywallAnalytics();
  const open = state.open;

  /* Emite `paywall.shown` cada vez que el modal pasa a `open=true`.
   * El effect se re-dispara solo en transiciones · no spam de eventos
   * mientras el modal está visible.
   * TODO(backend/analytics): la fuente de verdad sigue siendo este
   * componente · si en backend creamos un endpoint POST /paywall-events
   * con el mismo shape, sustituimos `analytics.track` por `fetch`. */
  useEffect(() => {
    if (state.open) {
      analytics.track("paywall.shown", {
        trigger: state.trigger,
        used: state.used,
        limit: state.limit,
      });
    }
    /* Solo dependemos del bool · cuando se abre con un trigger nuevo,
     * el state cambia entero y el effect se re-ejecuta. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.open]);

  if (!open) {
    /* Mantener el componente montado pero sin contenido para que el
     * Dialog pueda animar la entrada/salida sin desmontarse. */
    return (
      <Dialog open={false} onOpenChange={() => closeUpgradeModal()}>
        <DialogContent className="hidden" />
      </Dialog>
    );
  }
  const { trigger, used, limit } = state;
  const { icon: Icon, title, subtitle } = COPY[trigger];

  /* Cierra el modal y emite `paywall.dismissed`. Se llama desde el
   * botón X, "Más adelante", overlay click y ESC · cualquier salida
   * que no sea convertir. */
  const handleDismiss = () => {
    analytics.track("paywall.dismissed", { trigger, used, limit });
    closeUpgradeModal();
  };

  const handleSubscribe = () => {
    /* IMPORTANTE para validación: este evento es la métrica clave de
     * Fase 1. % click "Suscribirme" / `paywall.shown` = conversion. */
    analytics.track("paywall.subscribe_clicked", { trigger, used, limit });
    /* Mock · activa el plan en localStorage. En backend real sería un
     * fetch('/api/subscribe') que redirige a Stripe Checkout. */
    subscribeToPromoter249();
    closeUpgradeModal();
    toast.success("¡Suscripción activada!", {
      description: "Plan Promotor 249€/mes · cuenta sin límites.",
      icon: <Crown className="h-4 w-4" />,
    });
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) handleDismiss(); }}>
      <DialogContent
        className={cn(
          "p-0 gap-0 overflow-hidden",
          /* Mobile · pantalla completa · CLAUDE.md §"Responsive móvil sin popovers" */
          "max-w-full w-screen h-screen rounded-none flex flex-col",
          /* Desktop · centrado */
          "sm:h-auto sm:max-w-[480px] sm:rounded-2xl",
        )}
      >
        {/* Header con cierre · sticky en mobile */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 sm:border-0 sm:pb-0">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Upgrade
          </span>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 -mr-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 sm:py-6">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary grid place-items-center mb-4">
            <Icon className="h-5 w-5" />
          </div>
          <DialogTitle className="text-lg font-bold leading-tight">
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-2 leading-relaxed">
            {subtitle(used, limit)}
          </DialogDescription>

          {/* Bullets de valor · concretos, no genéricos */}
          <ul className="mt-5 space-y-2.5">
            {[
              "Hasta 5 promociones activas en paralelo",
              "Agencias colaboradoras ilimitadas",
              "Registros y aprobaciones sin tope",
            ].map((bullet) => (
              <li key={bullet} className="flex items-start gap-2.5">
                <span className="h-5 w-5 rounded-full bg-success/15 text-success grid place-items-center shrink-0 mt-0.5">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                <span className="text-sm text-foreground leading-snug">{bullet}</span>
              </li>
            ))}
          </ul>

          {/* Strip precio */}
          <div className="mt-5 rounded-xl border border-border bg-muted/30 px-4 py-3 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-foreground tabular-nums">249€</span>
            <span className="text-xs text-muted-foreground">/mes + IVA · sin permanencia · postpago</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
            Plan actual: <span className="font-medium text-foreground">{PLAN_LABEL.trial}</span>
            {" · "}
            Cancela cuando quieras desde Ajustes → Plan.
          </p>
        </div>

        {/* Footer · CTAs */}
        <div className="px-5 sm:px-6 py-4 border-t border-border bg-card flex flex-col sm:flex-row gap-2 sm:gap-2.5 sm:items-center sm:justify-end">
          <Button
            variant="ghost"
            onClick={handleDismiss}
            className="rounded-full sm:order-1"
          >
            Más adelante
          </Button>
          <Button
            onClick={handleSubscribe}
            className="rounded-full bg-foreground text-background hover:bg-foreground/90 sm:order-2"
          >
            <Crown className="h-3.5 w-3.5" />
            Suscribirme · 249€/mes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
