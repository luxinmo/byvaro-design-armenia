/**
 * /ajustes/leads-oportunidades — Flujo y conversión entre Lead y
 * Oportunidad.
 *
 * Permite al administrador de la cuenta decidir cómo entran los
 * clientes al CRM:
 *
 *   · Flujo por defecto (Lead → Oportunidad):
 *       todo cliente nuevo aterriza como Lead y se convierte en
 *       Oportunidad cuando ya está cualificado.
 *   · Directo a Oportunidad:
 *       los formularios / portales crean Oportunidades directamente,
 *       saltándose la fase de Lead. Recomendado cuando el equipo
 *       trabaja con pocos clientes muy cualificados.
 *
 * TODO(backend): persistir en `settings.leads.flowMode` + endpoints:
 *   · `GET /api/settings/leads-opportunities`
 *   · `PATCH /api/settings/leads-opportunities`
 *   Ver `docs/backend-integration.md §7.3` (Settings de Oportunidades).
 */

import { useEffect, useState } from "react";
import { Check, Target, Inbox, Sparkles, AlertCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { opportunityStageConfig, type OpportunityStage } from "@/data/opportunities";

/** Clave única en localStorage (mock). */
const KEY = "byvaro.leadsOpps.settings.v1";

type FlowMode = "lead-to-opp" | "direct-to-opp";

type LeadsOppsSettings = {
  flowMode: FlowMode;
  defaultInitialStage: OpportunityStage;
  showRegistrationsInOpp: boolean;
  showPendingRegBadge: boolean;
  /** Para V1 solo existe "manual" · incluido aquí para hacer visible
   *  que en el futuro podrá ser automático. */
  leadConversion: "manual";
};

const DEFAULTS: LeadsOppsSettings = {
  flowMode: "lead-to-opp",
  defaultInitialStage: "interes",
  showRegistrationsInOpp: true,
  showPendingRegBadge: true,
  leadConversion: "manual",
};

function loadSettings(): LeadsOppsSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

function saveSettings(s: LeadsOppsSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent("byvaro:leads-opps-settings-change"));
}

export default function AjustesLeadsOportunidades() {
  const [settings, setSettings] = useState<LeadsOppsSettings>(() => loadSettings());
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const initial = loadSettings();
    setDirty(JSON.stringify(initial) !== JSON.stringify(settings));
  }, [settings]);

  const patch = (p: Partial<LeadsOppsSettings>) => setSettings((s) => ({ ...s, ...p }));

  const onSave = () => {
    saveSettings(settings);
    toast.success("Configuración guardada");
    setDirty(false);
  };

  return (
    <SettingsScreen
      title="Leads y oportunidades"
      description="Decide cómo entran y avanzan los clientes dentro del CRM — desde que llega un lead hasta que se convierte en una oportunidad comercial cerrada."
      actions={
        <Button onClick={onSave} disabled={!dirty} className="rounded-full" size="sm">
          Guardar cambios
        </Button>
      }
    >
      {/* ══════ 1. Flujo de entrada ══════ */}
      <SettingsCard
        title="Flujo de entrada"
        description="Qué pasa cuando entra un cliente nuevo por web, portal o formulario."
      >
        <div className="space-y-2.5">
          <FlowOption
            id="lead-to-opp"
            active={settings.flowMode === "lead-to-opp"}
            onClick={() => patch({ flowMode: "lead-to-opp" })}
            icon={Inbox}
            title="Lead → Oportunidad"
            recommended
            description="Todo cliente nuevo llega como lead y pasa al pipeline de oportunidades solo cuando está cualificado. Recomendado cuando el equipo recibe muchos leads y filtra antes."
          />
          <FlowOption
            id="direct-to-opp"
            active={settings.flowMode === "direct-to-opp"}
            onClick={() => patch({ flowMode: "direct-to-opp" })}
            icon={Target}
            title="Directo a Oportunidad"
            description="Los clientes entran directamente como oportunidades, saltándose la fase de lead. Adecuado para equipos con pocos leads muy cualificados o fuentes premium."
          />
        </div>
      </SettingsCard>

      {/* ══════ 2. Etapa inicial ══════ */}
      <SettingsCard
        title="Etapa inicial por defecto"
        description="En qué etapa del pipeline empieza una oportunidad recién creada."
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(["interes", "visita", "evaluacion", "negociacion"] as OpportunityStage[]).map((s) => {
            const cfg = opportunityStageConfig[s];
            const active = settings.defaultInitialStage === s;
            return (
              <button
                key={s}
                onClick={() => patch({ defaultInitialStage: s })}
                className={cn(
                  "flex flex-col items-start gap-1 px-3 py-2.5 rounded-xl border text-left transition-colors",
                  active ? "border-foreground bg-foreground/5" : "border-border hover:border-foreground/30",
                )}
              >
                <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5", cfg.badgeClass)}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dotClass)} />
                  {cfg.label}
                </span>
                {active && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-foreground font-medium mt-1">
                    <Check className="h-3 w-3" strokeWidth={2.5} /> seleccionada
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Recomendada: <strong>Interés</strong> — la oportunidad empieza fresca y avanza
          manualmente conforme el cliente progresa.
        </p>
      </SettingsCard>

      {/* ══════ 3. Registros dentro de oportunidades ══════ */}
      <SettingsCard
        title="Registros dentro de la oportunidad"
        description="Cómo se muestran los registros (altas del cliente en promociones) dentro de la ficha de la oportunidad."
      >
        <Toggle
          label="Mostrar bloque de registros en la ficha de oportunidad"
          hint="Cuando está activo, la ficha incluye una sección colapsable con los registros de ese cliente."
          checked={settings.showRegistrationsInOpp}
          onChange={(v) => patch({ showRegistrationsInOpp: v })}
        />
        <Toggle
          label='Badge "Registro pendiente"'
          hint="Muestra un aviso visible en el listado y en la cabecera si la oportunidad tiene algún registro sin resolver."
          checked={settings.showPendingRegBadge}
          onChange={(v) => patch({ showPendingRegBadge: v })}
          disabled={!settings.showRegistrationsInOpp}
        />
      </SettingsCard>

      {/* ══════ 4. Conversión Lead → Oportunidad ══════ */}
      <SettingsCard
        title="Conversión Lead → Oportunidad"
        description="Cómo se transforma un lead en una oportunidad comercial."
      >
        <div className="flex items-start gap-3 rounded-xl border border-border p-3.5">
          <div className="h-8 w-8 rounded-lg bg-muted grid place-items-center shrink-0">
            <Sparkles className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Manual con botón de conversión</p>
            <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">
              El comercial pulsa <strong>"Convertir a oportunidad"</strong> desde la ficha del lead.
              Se preserva la historia completa (timeline, emails, comentarios y promoción de
              origen) y se prefija el interés en la oportunidad.
            </p>
            <p className="text-[11px] text-muted-foreground/80 mt-2 inline-flex items-center gap-1">
              <AlertCircle className="h-3 w-3" strokeWidth={1.75} />
              La conversión automática por reglas llegará en próximas versiones.
            </p>
          </div>
        </div>
      </SettingsCard>
    </SettingsScreen>
  );
}

/* ══════ Subcomponentes ══════════════════════════════════════════════ */

function FlowOption({
  id, active, onClick, icon: Icon, title, description, recommended,
}: {
  id: string;
  active: boolean;
  onClick: () => void;
  icon: LucideIcon;
  title: string;
  description: string;
  recommended?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3 px-4 py-3 rounded-xl text-left transition-colors",
        active ? "border-2 border-foreground bg-foreground/5" : "border border-border hover:border-foreground/20",
      )}
    >
      <div className={cn("h-8 w-8 rounded-lg grid place-items-center shrink-0", active ? "bg-foreground text-background" : "bg-muted text-foreground")}>
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {recommended && (
            <span className="inline-flex items-center text-[9.5px] font-bold uppercase tracking-wider text-success bg-success/10 rounded-full px-1.5 py-0.5">
              Recomendado
            </span>
          )}
          {active && (
            <span className="inline-flex items-center gap-0.5 text-[9.5px] font-bold uppercase tracking-wider text-foreground">
              <Check className="h-3 w-3" strokeWidth={2.5} /> Activo
            </span>
          )}
        </div>
        <p className="text-[11.5px] text-muted-foreground mt-1 leading-relaxed">{description}</p>
      </div>
    </button>
  );
}

function Toggle({
  label, hint, checked, onChange, disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 py-2.5", disabled && "opacity-50")}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint && <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">{hint}</p>}
      </div>
      <button
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 rounded-full transition-colors shrink-0",
          checked ? "bg-foreground" : "bg-muted",
          disabled && "cursor-not-allowed",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-background shadow-sm transition-transform",
            checked ? "translate-x-[22px]" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}
