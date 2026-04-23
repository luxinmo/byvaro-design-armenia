/**
 * /ajustes/facturacion/plan — Resumen del plan + uso vs límites.
 * Re-usa la lógica de suscripcion para consistencia.
 */

import { Sparkles, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { Button } from "@/components/ui/button";

const KEY = "byvaro.organization.plan.v1";

const USAGE = [
  { label: "Promociones", used: 12, limit: null },
  { label: "Contactos", used: 1248, limit: null },
  { label: "Miembros del equipo", used: 4, limit: 10 },
  { label: "Almacenamiento", used: 2.4, limit: 50, unit: "GB" },
  { label: "Emails enviados (este mes)", used: 327, limit: 5000 },
];

function loadPlan(): string {
  if (typeof window === "undefined") return "promotor";
  return window.localStorage.getItem(KEY) ?? "promotor";
}

const PLAN_LABELS: Record<string, { name: string; price: string }> = {
  starter: { name: "Starter", price: "Gratis" },
  pro: { name: "Pro", price: "99 € / mes" },
  promotor: { name: "Promotor", price: "249 € / mes" },
  enterprise: { name: "Enterprise", price: "Custom" },
};

export default function AjustesFacturacionPlan() {
  const planId = loadPlan();
  const plan = PLAN_LABELS[planId] ?? PLAN_LABELS.promotor;

  return (
    <SettingsScreen
      title="Plan actual"
      description="Resumen de tu suscripción y uso real frente a los límites del plan."
    >
      <SettingsCard>
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 grid place-items-center text-primary shrink-0">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Plan</p>
            <p className="text-2xl font-bold tracking-tight text-foreground mt-0.5">{plan.name}</p>
            <p className="text-sm text-muted-foreground mt-1">{plan.price} · IVA aparte · próxima renovación 1 mayo 2026</p>
          </div>
          <Link to="/ajustes/empresa/suscripcion">
            <Button variant="outline" size="sm" className="rounded-full">
              Cambiar plan
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </SettingsCard>

      <SettingsCard title="Uso del mes" description="Lo que has consumido este ciclo de facturación.">
        <div className="space-y-4">
          {USAGE.map((u) => {
            const pct = u.limit === null ? 0 : Math.min(100, (u.used / u.limit) * 100);
            const unlimited = u.limit === null;
            return (
              <div key={u.label}>
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-sm text-foreground">{u.label}</span>
                  <span className="text-xs text-muted-foreground tnum">
                    {u.used.toLocaleString("es-ES")}
                    {u.unit && ` ${u.unit}`}
                    {!unlimited && (
                      <> / <span className="text-muted-foreground/60">{u.limit?.toLocaleString("es-ES")}{u.unit && ` ${u.unit}`}</span></>
                    )}
                    {unlimited && <span className="text-success ml-1.5">· Ilimitado</span>}
                  </span>
                </div>
                {!unlimited && (
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct > 80 ? "bg-warning" : "bg-primary"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SettingsCard>
    </SettingsScreen>
  );
}
