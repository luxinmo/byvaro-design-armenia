/**
 * /ajustes/facturacion/plan · Estado del plan + uso.
 *
 * FILOSOFÍA · Plan Gratis es la base canónica.
 * ════════════════════════════════════════════════════════════════
 *
 * Un promotor inmobiliario tiene ciclos · puede pasar meses sin
 * promoción activa, y luego volver con un nuevo proyecto. Para que
 * Byvaro sea su CRM real, el plan Gratis es la base permanente:
 *
 *   - Acceso a sus datos siempre (contactos, ventas históricas,
 *     contratos firmados, microsites archivados).
 *   - Sin crear promociones nuevas hasta upgrade al plan de pago.
 *
 * El "trial" NO es un plan distinto · es una ventana de **180 días**
 * encima del plan Gratis donde el promotor recién registrado tiene
 * acceso completo (mismas capacidades que el plan de pago) para
 * arrancar sin fricción. Cuando se acaba la ventana, el promotor:
 *
 *   - Se queda en plan Gratis (acceso a sus datos · sin nuevas promos).
 *   - O pasa al plan de pago para seguir creando.
 *
 * UI · 3 cajas en lugar del card único de antes:
 *
 *   1. Tu plan actual (Plan Gratis · siempre).
 *   2. Días restantes de prueba (contador 180 / N).
 *   3. Plan de pago disponible (249€/mes · cuando lo necesites).
 *
 * Layout adaptable según `accountType` · agency tiene su propio
 * modelo (gratis para siempre + Marketplace 99€).
 */

import { Sparkles, Check, ArrowRight, Handshake, Clock, Crown, Lock, Database } from "lucide-react";
import { Link } from "react-router-dom";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  usePlan, usePlanState, PLAN_LIMITS, PLAN_LABEL, TRIAL_DURATION_DAYS,
  cancelSubscription, setPlan, isAgencyPlan, isPromoterPlan,
  trialDaysRemaining, formatTrialEndDate, isInTrialWindow,
  type PlanTier,
} from "@/lib/plan";
import { useUsageCounters } from "@/lib/usage";
import { openUpgradeModal } from "@/lib/usageGuard";
import { useCurrentUser } from "@/lib/currentUser";
import { cn } from "@/lib/utils";

type UsageRow = { label: string; used: number; limit: number };

export default function AjustesFacturacionPlan() {
  const tier = usePlan();
  const planState = usePlanState();
  const counters = useUsageCounters();
  const limits = PLAN_LIMITS[tier];
  const user = useCurrentUser();
  const isAgency = user.accountType === "agency";

  /* Estado del trial · solo aplica al promotor con
   *  promoter_pack='trial'. Si la ventana ha expirado (`!inTrial`)
   *  el promotor sigue mostrándose en "Plan Gratis" pero sin la
   *  caja del contador · ver bloque 3-cajas abajo. */
  const daysRemaining = trialDaysRemaining(planState);
  const trialEndDate = formatTrialEndDate(planState);
  const inTrial = isInTrialWindow(planState);
  /* Trial "urgente" · cuando faltan ≤30 días, escalamos el CTA. */
  const trialUrgent = inTrial && daysRemaining !== null && daysRemaining <= 30;

  const showAgencyView = isAgency || isAgencyPlan(tier);
  const showPromoterView = !isAgency || isPromoterPlan(tier);

  const usage: UsageRow[] = showAgencyView && !showPromoterView
    ? [
        {
          label: "Solicitudes de colaboración enviadas",
          used: 0,
          limit: limits.collabRequests,
        },
      ]
    : [
        { label: "Promociones activas", used: counters.activePromotions, limit: limits.activePromotions },
      ];

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
    cancelSubscription(user);
    if (isAgency) setPlan(user, "agency_free");
    toast.info("Suscripción cancelada", {
      description: "Has vuelto al plan gratuito · los datos se mantienen.",
    });
  };

  const isPaidTier = tier === "promoter_249" || tier === "promoter_329"
    || tier === "agency_marketplace" || tier === "enterprise";

  /* ── Vista promotor en Plan Gratis (con o sin trial activo) ── */
  if (tier === "trial") {
    return (
      <SettingsScreen
        title="Plan actual"
        description="Tu suscripción y los días de prueba que quedan."
        maxWidth="wide"
      >
        {/* ═══════════ 3 CAJAS · siempre en línea desde sm ═══════════ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* CAJA 1 · Plan actual = Gratis */}
          <article className="bg-card border border-border rounded-2xl p-5 shadow-soft flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-success/10 text-success grid place-items-center shrink-0">
                <Check className="h-4 w-4" strokeWidth={2} />
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Tu plan
              </p>
            </div>
            <p className="text-xl font-bold tracking-tight text-foreground">
              Plan Gratis
            </p>
            <p className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed flex-1">
              Tu plan permanente · acceso a tus datos siempre · sin tarjeta requerida.
            </p>
            <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-2">
              <Database className="h-3 w-3 text-muted-foreground" strokeWidth={1.8} />
              <span className="text-[11px] text-muted-foreground">Conservas tus datos</span>
            </div>
          </article>

          {/* CAJA 2 · Días de prueba restantes */}
          <article className={cn(
            "rounded-2xl p-5 shadow-soft flex flex-col border",
            inTrial
              ? "bg-primary/5 border-primary/30"
              : "bg-muted/30 border-border",
          )}>
            <div className="flex items-center gap-2 mb-3">
              <div className={cn(
                "h-8 w-8 rounded-lg grid place-items-center shrink-0",
                inTrial ? "bg-primary/10 text-primary" : "bg-card border border-border text-muted-foreground",
              )}>
                <Clock className="h-4 w-4" strokeWidth={2} />
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Prueba gratuita
              </p>
            </div>
            {inTrial && daysRemaining !== null ? (
              <>
                <p className="text-xl font-bold tracking-tight text-foreground tnum">
                  {daysRemaining} {daysRemaining === 1 ? "día" : "días"}
                </p>
                <p className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed flex-1">
                  Acceso completo hasta el {trialEndDate}.
                </p>
                {/* Barra de progreso · días consumidos / 180 */}
                <div className="mt-3 pt-3 border-t border-primary/20">
                  <div className="h-1.5 bg-primary/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{
                        width: `${Math.max(2, Math.min(100, ((TRIAL_DURATION_DAYS - daysRemaining) / TRIAL_DURATION_DAYS) * 100))}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1.5 text-[10.5px] text-muted-foreground tnum">
                    Día {TRIAL_DURATION_DAYS - daysRemaining} de {TRIAL_DURATION_DAYS}
                  </p>
                </div>
              </>
            ) : (
              <>
                <p className="text-xl font-bold tracking-tight text-foreground">
                  Finalizada
                </p>
                <p className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed flex-1">
                  Sigues en el plan Gratis · activa el plan de pago para crear promociones nuevas.
                </p>
              </>
            )}
          </article>

          {/* CAJA 3 · Plan de pago disponible */}
          <article className="bg-card border border-border rounded-2xl p-5 shadow-soft flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-foreground/5 text-foreground grid place-items-center shrink-0">
                <Crown className="h-4 w-4" strokeWidth={2} />
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Cuando lo necesites
              </p>
            </div>
            <p className="text-xl font-bold tracking-tight text-foreground">
              249€<span className="text-sm font-medium text-muted-foreground">/mes</span>
            </p>
            <p className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed flex-1">
              Plan Promotor · IVA excl. · sin permanencia · cancela cuando quieras.
            </p>
            <button
              type="button"
              onClick={handleSubscribePromoter}
              className={cn(
                "mt-3 inline-flex items-center justify-center gap-1.5 h-9 rounded-full text-[12.5px] font-semibold transition-all",
                trialUrgent
                  ? "bg-foreground text-background hover:bg-foreground/90 shadow-soft"
                  : "border border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              {trialUrgent ? "Suscribirme" : "Ver detalles"}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </article>
        </div>

        {/* ═══════════ FILOSOFÍA · Cómo funciona el plan Gratis ═══════════ */}
        <SettingsCard
          title="Cómo funciona tu plan Gratis"
          description="Diseñado para los ciclos reales del negocio inmobiliario."
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary grid place-items-center">
                <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
              </div>
              <p className="text-[12.5px] font-semibold text-foreground">
                Empiezas con prueba completa
              </p>
              <p className="text-[11.5px] text-muted-foreground leading-relaxed">
                {TRIAL_DURATION_DAYS} días con acceso pleno · crea promociones, invita agencias, prueba todo · sin tarjeta.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="h-7 w-7 rounded-lg bg-success/10 text-success grid place-items-center">
                <Database className="h-3.5 w-3.5" strokeWidth={2} />
              </div>
              <p className="text-[12.5px] font-semibold text-foreground">
                Conservas tus datos siempre
              </p>
              <p className="text-[11.5px] text-muted-foreground leading-relaxed">
                Cuando termina la prueba (o entre proyectos), sigues en el plan Gratis · contactos, ventas y microsites accesibles.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="h-7 w-7 rounded-lg bg-foreground/5 text-foreground grid place-items-center">
                <Crown className="h-3.5 w-3.5" strokeWidth={2} />
              </div>
              <p className="text-[12.5px] font-semibold text-foreground">
                Pagas solo cuando produces
              </p>
              <p className="text-[11.5px] text-muted-foreground leading-relaxed">
                Activa el plan de pago cuando vuelvas a tener una promoción que vender · cancela al terminar.
              </p>
            </div>
          </div>
        </SettingsCard>

        {/* ═══════════ USO · solo si trial activo · contadores reales ═══════════ */}
        {inTrial && (
          <SettingsCard
            title="Uso del workspace"
            description="Acceso completo durante la prueba · cuando alcances un límite, las acciones clave quedan bloqueadas."
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
        )}

        {/* ═══════════ Card aviso si trial expirado ═══════════ */}
        {!inTrial && (
          <div className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 flex items-start gap-3">
            <div className="h-7 w-7 rounded-lg bg-warning/15 text-warning grid place-items-center shrink-0 mt-0.5">
              <Lock className="h-3.5 w-3.5" strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-medium text-foreground">
                Tu prueba ha terminado
              </p>
              <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">
                Sigues en el plan Gratis con acceso a todos tus datos · para crear promociones nuevas, activa el plan Promotor.
              </p>
            </div>
            <Button
              onClick={handleSubscribePromoter}
              className="rounded-full bg-foreground text-background hover:bg-foreground/90 shrink-0 self-center"
              size="sm"
            >
              <Crown className="h-3.5 w-3.5" />
              Activar plan
            </Button>
          </div>
        )}

        {/* Atajo a la página comercial · comparativa completa */}
        <SettingsCard>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Comparar todos los planes
              </p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Plan Gratis · Promotor · Volumen · Inmobiliaria · feature list completa.
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

  /* ── Resto de tiers (paid promoter, agency_*, enterprise) · layout
   *    legacy de un solo card · más adelante uniformamos. */

  const subtitle = (() => {
    if (tier === "promoter_249") return "249€/mes (IVA excl.) · postpago · sin permanencia";
    if (tier === "promoter_329") return "329€/mes (IVA excl.) · hasta 10 promociones";
    if (tier === "agency_free") return "Gratis para siempre si te invitan · 10 solicitudes propias en tu provincia";
    if (tier === "agency_marketplace") return "99€/mes (IVA excl.) · directorio nacional · sin permanencia";
    if (tier === "enterprise") return "Plan a medida · gestionado por tu account manager";
    return "";
  })();

  const planIcon = (() => {
    if (tier === "agency_marketplace" || tier === "promoter_249" || tier === "promoter_329") {
      return <Crown className="h-6 w-6" />;
    }
    if (tier === "agency_free") return <Handshake className="h-6 w-6" />;
    return <Sparkles className="h-6 w-6" />;
  })();

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
          tier === "agency_free"
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

export type { PlanTier };
