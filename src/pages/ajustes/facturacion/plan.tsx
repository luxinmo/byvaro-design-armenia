/**
 * /ajustes/facturacion/plan · Estado real del plan + uso.
 *
 * Adaptable según `accountType`:
 *   · developer · muestra plan Promotor (trial/promoter_249/329) +
 *     uso (promociones · agencias · registros).
 *   · agency    · muestra plan Agencia (free/marketplace) + uso
 *     (solicitudes de colaboración).
 *
 * TODO(backend): cuando exista billing real (Stripe), los CTAs llaman
 * al portal hosted. Hoy mockean cambio de tier vía localStorage.
 */

import { Crown, Sparkles, Check, ArrowRight, Handshake } from "lucide-react";
import { Link } from "react-router-dom";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  usePlan, PLAN_LIMITS, PLAN_LABEL,
  cancelSubscription, setPlan, isAgencyPlan, isPromoterPlan,
  type PlanTier,
} from "@/lib/plan";
import { useUsageCounters } from "@/lib/usage";
import { openUpgradeModal } from "@/lib/usageGuard";
import { useCurrentUser } from "@/lib/currentUser";
import { cn } from "@/lib/utils";

type UsageRow = { label: string; used: number; limit: number };

export default function AjustesFacturacionPlan() {
  const tier = usePlan();
  const counters = useUsageCounters();
  const limits = PLAN_LIMITS[tier];
  const user = useCurrentUser();
  const isAgency = user.accountType === "agency";

  /* Coherencia · si la sesión actual es agency pero el plan stored
   *  es de promotor (o viceversa), el caller debería haberlo migrado
   *  · aquí no autocorregimos para evitar sorpresas · solo mostramos
   *  el tier almacenado y el caller arregla. Mostramos un fallback
   *  defensivo si el cruce es absurdo. */
  const showAgencyView = isAgency || isAgencyPlan(tier);
  const showPromoterView = !isAgency || isPromoterPlan(tier);

  /* Filas de uso · SOLO los 2 únicos límites reales del sistema.
   *  Resto (agencias invitadas, registros) son ilimitados · no se
   *  muestran. Ver `src/lib/systemLimits.ts` para el catálogo
   *  completo de qué se gates y qué no. */
  const usage: UsageRow[] = showAgencyView && !showPromoterView
    ? [
        {
          label: "Solicitudes de colaboración enviadas",
          /* TODO(backend): contador real desde
           *  `GET /api/workspace/usage` · campo collabRequestsSent. */
          used: 0,
          limit: limits.collabRequests,
        },
      ]
    : [
        { label: "Promociones activas", used: counters.activePromotions, limit: limits.activePromotions },
      ];

  /* CTAs según tier. */
  const handleSubscribePromoter = () => {
    openUpgradeModal({ trigger: "near_limit", used: 0, limit: 0 });
  };

  const handleActivateMarketplace = () => {
    setPlan(user, "agency_marketplace");
    toast.success("Marketplace activado", {
      description: "Acceso al directorio nacional de promotores.",
    });
  };

  const handleCancel = () => {
    /* Cancelar vuelve al plan gratuito según tipo de cuenta. */
    cancelSubscription(user);
    if (isAgency) setPlan(user, "agency_free");
    toast.info("Suscripción cancelada", {
      description: "Has vuelto al plan gratuito · los datos se mantienen.",
    });
  };

  /* Texto bajo el título según tier. */
  const subtitle = (() => {
    if (tier === "trial") return "6 meses gratis · luego 249€/mes (IVA excl.)";
    if (tier === "promoter_249") return "249€/mes (IVA excl.) · postpago · sin permanencia";
    if (tier === "promoter_329") return "329€/mes (IVA excl.) · hasta 10 promociones";
    if (tier === "agency_free") return "Gratis para siempre si te invitan · 10 solicitudes propias en tu provincia";
    if (tier === "agency_marketplace") return "99€/mes (IVA excl.) · directorio nacional · sin permanencia";
    if (tier === "enterprise") return "Plan a medida · gestionado por tu account manager";
    return "";
  })();

  /* Icono visual del plan. */
  const planIcon = (() => {
    if (tier === "agency_marketplace" || tier === "promoter_249" || tier === "promoter_329") {
      return <Crown className="h-6 w-6" />;
    }
    if (tier === "agency_free") return <Handshake className="h-6 w-6" />;
    return <Sparkles className="h-6 w-6" />;
  })();

  const isPaidTier = tier === "promoter_249" || tier === "promoter_329"
    || tier === "agency_marketplace" || tier === "enterprise";

  return (
    <SettingsScreen
      title="Plan actual"
      description="Resumen de tu suscripción y uso real del workspace."
    >
      <SettingsCard>
        <div className="flex items-start gap-4">
          <div className={cn(
            "h-14 w-14 rounded-2xl grid place-items-center shrink-0",
            isPaidTier ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
          )}>
            {planIcon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Plan</p>
            <p className="text-2xl font-bold tracking-tight text-foreground mt-0.5">
              {PLAN_LABEL[tier]}
            </p>
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          </div>
          {/* CTA contextual según tier */}
          {tier === "trial" && (
            <Button onClick={handleSubscribePromoter} className="rounded-full bg-foreground text-background hover:bg-foreground/90">
              <Crown className="h-3.5 w-3.5" />
              Suscribirme
            </Button>
          )}
          {tier === "agency_free" && (
            <Button onClick={handleActivateMarketplace} className="rounded-full bg-foreground text-background hover:bg-foreground/90">
              <Crown className="h-3.5 w-3.5" />
              Activar Marketplace
            </Button>
          )}
          {isPaidTier && tier !== "enterprise" && (
            <Button onClick={handleCancel} variant="outline" className="rounded-full">
              Cancelar suscripción
            </Button>
          )}
        </div>
      </SettingsCard>

      <SettingsCard
        title="Uso del workspace"
        description={
          tier === "trial"
            ? "6 meses de prueba · cuando alcances un límite las acciones clave quedan bloqueadas hasta suscribirte."
            : tier === "agency_free"
            ? "Cuando agotes las 10 solicitudes en tu provincia, activa Marketplace para acceso nacional ilimitado."
            : "En el plan actual todas las métricas son ilimitadas."
        }
      >
        <div className="space-y-4">
          {usage.map((u) => {
            const unlimited = u.limit === Number.POSITIVE_INFINITY;
            const pct = unlimited || u.limit === 0 ? 0 : Math.min(100, (u.used / u.limit) * 100);
            const atLimit = !unlimited && u.limit > 0 && u.used >= u.limit;
            return (
              <div key={u.label}>
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-sm text-foreground">{u.label}</span>
                  <span className="text-xs text-muted-foreground tnum">
                    {u.used.toLocaleString("es-ES")}
                    {!unlimited && u.limit > 0 && (
                      <> / <span className="text-muted-foreground/60">{u.limit.toLocaleString("es-ES")}</span></>
                    )}
                    {unlimited && <span className="text-success ml-1.5 inline-flex items-center gap-0.5">
                      <Check className="h-3 w-3" /> Ilimitado
                    </span>}
                  </span>
                </div>
                {!unlimited && u.limit > 0 && (
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

      {/* Cards de upgrade según tier */}
      {tier === "trial" && (
        <SettingsCard
          title="¿Qué desbloquea el plan Promotor?"
          description="Resumen de las diferencias clave."
        >
          <ul className="space-y-2.5">
            {[
              `Hasta ${PLAN_LIMITS.promoter_249.activePromotions} promociones activas`,
              "Agencias colaboradoras ilimitadas",
              "Registros y aprobaciones sin tope",
              "10 colaboraciones cross-empresa gratis",
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

      {tier === "agency_free" && (
        <SettingsCard
          title="¿Qué desbloquea Marketplace?"
          description="99€/mes · IVA excluido · cancela cuando quieras."
        >
          <ul className="space-y-2.5">
            {[
              "Acceso al directorio nacional completo de promotores y comercializadores",
              "Solicitudes ilimitadas de colaboración",
              "Búsqueda avanzada por mercados, especialidad e idiomas",
              "Aparición prioritaria ante promotores que buscan agencias",
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

      {tier === "promoter_249" && (
        <SettingsCard
          title="¿Necesitas más promociones?"
          description="Volumen · 329€/mes · IVA excluido · hasta 10 promociones activas."
        >
          <ul className="space-y-2.5">
            <li className="flex items-start gap-2.5">
              <span className="h-5 w-5 rounded-full bg-success/15 text-success grid place-items-center shrink-0 mt-0.5">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              <span className="text-sm text-foreground leading-snug">
                Hasta 10 promociones activas (vs 5 en el plan actual)
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="h-5 w-5 rounded-full bg-success/15 text-success grid place-items-center shrink-0 mt-0.5">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              <span className="text-sm text-foreground leading-snug">
                Resto idéntico · invitaciones nacionales, colaboraciones, IA
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="h-5 w-5 rounded-full bg-success/15 text-success grid place-items-center shrink-0 mt-0.5">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              <span className="text-sm text-foreground leading-snug">
                Más de 10 · escríbenos a hola@byvaro.com (Enterprise)
              </span>
            </li>
          </ul>
        </SettingsCard>
      )}

      {/* Atajo a la página comercial · comparativa completa */}
      <SettingsCard>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Comparar todos los planes
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Agencia · Promotor · Volumen · Enterprise · feature list completa.
            </p>
          </div>
          <Link
            to="/planes"
            className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-full border border-border bg-card text-sm font-medium hover:bg-muted transition-colors shrink-0"
          >
            Ver planes
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} />
          </Link>
        </div>
      </SettingsCard>
    </SettingsScreen>
  );
}

/* Solo para que TS no se queje del tipo no usado. */
export type { PlanTier };
