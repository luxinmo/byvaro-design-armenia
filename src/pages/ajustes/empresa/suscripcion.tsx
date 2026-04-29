/**
 * /ajustes/empresa/suscripcion — Plan actual + comparativa de planes
 * + (lado agencia) activación del pack de promotor/comercializador.
 */

import { useEffect, useState } from "react";
import { Check, Sparkles, ArrowUpRight, Building2 } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { Button } from "@/components/ui/button";
import { useDirty } from "@/components/settings/SettingsDirtyContext";
import { isAdmin, useCurrentUser, currentWorkspaceKey } from "@/lib/currentUser";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useDeveloperPack,
  setDeveloperPackEnabled,
} from "@/lib/empresaCategories";
import { EmpresaCategoryBadges } from "@/components/empresa/EmpresaCategoryBadges";

const KEY = "byvaro.organization.plan.v1";

const PLANS = [
  {
    id: "starter", name: "Starter", price: 0, description: "Para probar Byvaro.",
    features: ["1 promoción", "Hasta 50 contactos", "Microsite básico", "Sin integraciones"],
  },
  {
    id: "pro", name: "Pro", price: 99, description: "Para equipos pequeños.",
    features: ["10 promociones", "Hasta 1.000 contactos", "Microsites custom", "Email integrado", "Detección de duplicados IA"],
  },
  {
    id: "promotor", name: "Promotor", price: 249, description: "Plan principal · todo incluido.", featured: true,
    features: ["Promociones ilimitadas", "Contactos ilimitados", "Marketplace de agencias", "WhatsApp integrado", "API + webhooks", "Soporte prioritario"],
  },
  {
    id: "enterprise", name: "Enterprise", price: null, description: "Multi-empresa, SSO, SLA.",
    features: ["Todo de Promotor", "SSO SAML / OIDC", "SLA 99.99%", "Onboarding dedicado", "Account manager"],
  },
] as const;

function load(): string {
  if (typeof window === "undefined") return "promotor";
  return window.localStorage.getItem(KEY) ?? "promotor";
}

export default function AjustesEmpresaSuscripcion() {
  const user = useCurrentUser();
  const canEdit = isAdmin(user);
  const [current, setCurrent] = useState(() => load());
  const [initial, setInitial] = useState(current);
  const { setDirty } = useDirty();

  useEffect(() => { setDirty(current !== initial); }, [current, initial, setDirty]);

  const save = () => {
    if (!canEdit) return;
    window.localStorage.setItem(KEY, current);
    setInitial(current);
    setDirty(false);
    toast.success("Plan actualizado · próxima factura ajustada");
  };

  const activePlan = PLANS.find((p) => p.id === current) ?? PLANS[2];

  return (
    <SettingsScreen
      title="Suscripción"
      description="Tu plan actual + lo que incluye. Si cambias de plan, el cobro se prorratea automáticamente."
      actions={current !== initial ? <Button onClick={save} disabled={!canEdit} className="rounded-full" size="sm">Confirmar cambio</Button> : null}
    >
      <SettingsCard>
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 grid place-items-center text-primary shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Plan actual</p>
            <p className="text-2xl font-bold tracking-tight text-foreground mt-0.5">{activePlan.name}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {activePlan.price === null ? "Precio personalizado" : `${activePlan.price} € / mes · IVA aparte`}
            </p>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Comparativa de planes" description="Selecciona uno para cambiar.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PLANS.map((plan) => {
            const isCurrent = plan.id === current;
            return (
              <button
                key={plan.id}
                onClick={() => canEdit && setCurrent(plan.id)}
                disabled={!canEdit}
                className={cn(
                  "text-left rounded-xl border p-4 transition-colors disabled:cursor-not-allowed disabled:opacity-70",
                  isCurrent ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border/40 hover:border-foreground/20",
                  plan.featured && !isCurrent && "ring-1 ring-warning/40/40",
                )}
              >
                <div className="flex items-baseline justify-between mb-1">
                  <p className="text-sm font-semibold text-foreground">{plan.name}</p>
                  {plan.featured && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-warning">Recomendado</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mb-2">{plan.description}</p>
                <p className="text-lg font-bold tracking-tight text-foreground tnum mb-3">
                  {plan.price === null ? "Custom" : <>{plan.price}€<span className="text-xs text-muted-foreground font-normal"> /mes</span></>}
                </p>
                <ul className="space-y-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-[12px] text-muted-foreground">
                      <Check className="h-3 w-3 text-success mt-0.5 shrink-0" strokeWidth={3} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
      </SettingsCard>

      {/* Pack de promotor/comercializador · solo lado AGENCIA. Una
          vez activado, la agencia puede crear sus propias promociones
          y elegir en cada wizard si actúa como Promotor o
          Comercializador. La categoría se añade automáticamente
          cuando hay al menos una promo activa con ese rol. */}
      {user.accountType === "agency" && <DeveloperPackCard canEdit={canEdit} />}

      <SettingsCard>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">¿Necesitas algo más grande?</p>
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => toast.info("Te contactará un account manager · próximamente")}>
            Contactar con ventas
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </SettingsCard>
    </SettingsScreen>
  );
}

/* ─── Pack de promotor / comercializador ───
 *  Activación del paquete para agencias. Al activarlo la inmobiliaria
 *  puede crear sus propias promociones y elegir el rol (promotor o
 *  comercializador) en el wizard. Las categorías se asignan
 *  automáticamente al publicar una promo con ese rol.
 *
 *  TODO(backend): la activación pasa por billing real (no solo flag).
 *  Por ahora persistimos un flag por workspace en localStorage. */
function DeveloperPackCard({ canEdit }: { canEdit: boolean }) {
  const user = useCurrentUser();
  const workspaceKey = currentWorkspaceKey(user);
  const pack = useDeveloperPack(workspaceKey);

  const toggle = () => {
    if (!canEdit) return;
    const next = !pack.enabled;
    setDeveloperPackEnabled(workspaceKey, next);
    toast.success(
      next
        ? "Pack activado · ya puedes crear promociones desde tu workspace"
        : "Pack desactivado · perderás acceso al wizard de creación",
    );
  };

  return (
    <SettingsCard>
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-2xl bg-success/10 grid place-items-center text-success shrink-0">
          <Building2 className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[15px] font-semibold text-foreground">
              Pack de promotor / comercializador
            </h3>
            {pack.enabled && (
              <EmpresaCategoryBadges
                categories={["promotor", "comercializador"]}
                size="xs"
              />
            )}
          </div>
          <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">
            Tu inmobiliaria podrá crear sus propias promociones · al
            publicar cada una decides si actúas como{" "}
            <span className="font-semibold text-foreground">Promotor</span>{" "}
            (eres el dueño de la obra) o como{" "}
            <span className="font-semibold text-foreground">Comercializador</span>{" "}
            (vendes en exclusiva por encargo). Las categorías
            correspondientes aparecen automáticamente en tu ficha cuando
            tengas al menos una promo activa con ese rol.
          </p>
          {pack.enabled && pack.activatedAt && (
            <p className="text-[11.5px] text-muted-foreground/80 mt-2">
              Activado el {new Date(pack.activatedAt).toLocaleDateString("es-ES")}.
            </p>
          )}
          <div className="mt-4 flex items-center gap-2">
            <Button
              onClick={toggle}
              disabled={!canEdit}
              variant={pack.enabled ? "outline" : "default"}
              className="rounded-full"
              size="sm"
            >
              {pack.enabled ? "Desactivar pack" : "Activar pack"}
            </Button>
            {!pack.enabled && (
              <span className="text-[11px] text-muted-foreground">
                Activación inmediata · facturación próxima · sin permanencia
              </span>
            )}
          </div>
        </div>
      </div>
    </SettingsCard>
  );
}
