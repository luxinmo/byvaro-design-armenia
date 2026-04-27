/**
 * /ajustes/facturacion/plan · Estado real del plan + uso (Fase 1).
 *
 * Usa el `usePlan()` y `useUsageCounters()` canónicos para que esta
 * pantalla refleje el estado live del workspace y se sincronice con
 * los gates de Fase 1 (paywall + UpgradeModal).
 *
 * Botón principal:
 *   · trial         → "Suscribirme · 249€/mes" (abre UpgradeModal)
 *   · promoter_249  → "Cancelar suscripción" (vuelve a trial)
 *
 * TODO(backend): cuando exista billing real (Stripe), este botón
 * abrirá el portal de Stripe Customer / Stripe Checkout. El estado
 * del plan se obtendrá de GET /api/workspace/plan (no de localStorage).
 */

import { Crown, Sparkles, Check } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  usePlan, PLAN_LIMITS, PLAN_LABEL,
  cancelSubscription, type PlanTier,
} from "@/lib/plan";
import { useUsageCounters } from "@/lib/usage";
import { openUpgradeModal } from "@/lib/usageGuard";
import { cn } from "@/lib/utils";

type UsageRow = { label: string; used: number; limit: number };

export default function AjustesFacturacionPlan() {
  const tier = usePlan();
  const counters = useUsageCounters();
  const limits = PLAN_LIMITS[tier];

  const usage: UsageRow[] = [
    { label: "Promociones activas", used: counters.activePromotions, limit: limits.activePromotions },
    { label: "Agencias invitadas",  used: counters.invitedAgencies,  limit: limits.invitedAgencies },
    { label: "Registros recibidos", used: counters.registros,        limit: limits.registros },
  ];

  const handleSubscribe = () => {
    /* Abre el modal global de upgrade · centraliza la lógica de
       conversión y emite el evento de tracking. */
    openUpgradeModal({ trigger: "near_limit", used: 0, limit: 0 });
  };

  const handleCancel = () => {
    cancelSubscription();
    toast.info("Suscripción cancelada", {
      description: "Has vuelto al plan gratuito · los datos se mantienen.",
    });
  };

  return (
    <SettingsScreen
      title="Plan actual"
      description="Resumen de tu suscripción y uso real del workspace."
    >
      <SettingsCard>
        <div className="flex items-start gap-4">
          <div className={cn(
            "h-14 w-14 rounded-2xl grid place-items-center shrink-0",
            tier === "promoter_249" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
          )}>
            {tier === "promoter_249" ? <Crown className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Plan</p>
            <p className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
              {PLAN_LABEL[tier]}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {tier === "promoter_249"
                ? "249€ / mes + IVA · postpago · sin permanencia"
                : "Gratis · con límites para validar el producto"}
            </p>
          </div>
          {tier === "trial" ? (
            <Button onClick={handleSubscribe} className="rounded-full bg-foreground text-background hover:bg-foreground/90">
              <Crown className="h-3.5 w-3.5" />
              Suscribirme
            </Button>
          ) : (
            <Button onClick={handleCancel} variant="outline" className="rounded-full">
              Cancelar suscripción
            </Button>
          )}
        </div>
      </SettingsCard>

      <SettingsCard
        title="Uso del workspace"
        description={tier === "trial"
          ? "Cuando alcances un límite, las acciones clave quedan bloqueadas hasta suscribirte. Solo cuentan los registros que llegan de agencias colaboradoras · tus leads de portales y registros directos son free."
          : "En el plan promotor todas las métricas son ilimitadas."}
      >
        <div className="space-y-4">
          {usage.map((u) => {
            const unlimited = u.limit === Number.POSITIVE_INFINITY;
            const pct = unlimited ? 0 : Math.min(100, (u.used / u.limit) * 100);
            const atLimit = !unlimited && u.used >= u.limit;
            return (
              <div key={u.label}>
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-sm text-foreground">{u.label}</span>
                  <span className="text-xs text-muted-foreground tnum">
                    {u.used.toLocaleString("es-ES")}
                    {!unlimited && (
                      <> / <span className="text-muted-foreground/60">{u.limit.toLocaleString("es-ES")}</span></>
                    )}
                    {unlimited && <span className="text-success ml-1.5 inline-flex items-center gap-0.5">
                      <Check className="h-3 w-3" /> Ilimitado
                    </span>}
                  </span>
                </div>
                {!unlimited && (
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        atLimit ? "bg-destructive" : pct > 80 ? "bg-warning" : "bg-primary",
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SettingsCard>

      {tier === "trial" && (
        <SettingsCard
          title="¿Qué desbloquea el plan promotor?"
          description="Resumen de las diferencias clave."
        >
          <ul className="space-y-2.5">
            {[
              `Hasta ${PLAN_LIMITS.promoter_249.activePromotions} promociones activas (vs ${PLAN_LIMITS.trial.activePromotions} en gratis)`,
              "Agencias colaboradoras ilimitadas",
              "Registros y aprobaciones sin tope",
              "Sin permanencia · cancela cuando quieras",
            ].map((b) => (
              <li key={b} className="flex items-start gap-2.5">
                <span className="h-5 w-5 rounded-full bg-success/15 text-success grid place-items-center shrink-0 mt-0.5">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                <span className="text-sm text-foreground leading-snug">{b}</span>
              </li>
            ))}
          </ul>
        </SettingsCard>
      )}
    </SettingsScreen>
  );
}

/* Solo para que TS no se queje del tipo no usado · documentamos a
   futuros mantenedores que `PlanTier` es la fuente del enum. */
export type { PlanTier };
