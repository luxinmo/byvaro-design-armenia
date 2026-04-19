/**
 * PhaseTimeline · Sidebar lateral del wizard Crear Promoción (v3).
 *
 * Agrupa los 14+1 pasos en 6 fases colapsables para evitar la
 * sensación de "hay demasiado que hacer". Muestra progreso por fase
 * (N/M completados), iconos de estado y permite saltar a cualquier
 * paso ya visitado.
 *
 * Estados por fase:
 *   - ◉ done       → todos sus pasos están completados
 *   - ● current    → contiene el paso actual
 *   - ○ upcoming   → ningún paso de la fase ha sido abordado todavía
 *
 * La fase `estructura` se oculta automáticamente cuando la promoción es
 * unifamiliar (no tiene edificio ni extras de anejos).
 */

import { useMemo, useState, useEffect } from "react";
import { Check, ChevronDown, Building2, Layers3, Megaphone, Camera, Wrench, CheckCircle2 } from "lucide-react";
import type { StepId, WizardState, PhaseDef } from "./types";
import { getAllSteps } from "./StepTimeline";
import { cn } from "@/lib/utils";

type PhaseStatus = "done" | "current" | "upcoming";

/* ─── Definición de fases ─────────────────────────────────────────── */
const PHASES: PhaseDef[] = [
  {
    id: "tipologia",
    label: "Tipología",
    description: "Qué tipo de promoción",
    steps: ["role", "tipo", "sub_uni", "sub_varias"],
  },
  {
    id: "estructura",
    label: "Estructura",
    description: "Edificio y distribución",
    steps: ["config_edificio", "extras"],
  },
  {
    id: "comercializacion",
    label: "Comercialización",
    description: "Estado, detalles e info",
    steps: ["estado", "detalles", "info_basica"],
  },
  {
    id: "marketing",
    label: "Marketing",
    description: "Fotos y descripción",
    steps: ["multimedia", "descripcion"],
  },
  {
    id: "operativa",
    label: "Operativa",
    description: "Unidades, agencias y pagos",
    steps: ["crear_unidades", "colaboradores", "plan_pagos"],
  },
  {
    id: "revision",
    label: "Revisión",
    description: "Publicar promoción",
    steps: ["revision"],
  },
];

const PHASE_ICONS = {
  tipologia: Building2,
  estructura: Layers3,
  comercializacion: Megaphone,
  marketing: Camera,
  operativa: Wrench,
  revision: CheckCircle2,
} as const;

/* ─── Utilidades ──────────────────────────────────────────────────── */
function getPhaseStatus(
  phase: PhaseDef,
  currentStep: StepId,
  doneSteps: Set<StepId>,
): PhaseStatus {
  // Si el paso actual está en esta fase → current
  if (phase.steps.includes(currentStep)) return "current";
  // Si todos los pasos visibles de la fase están done → done
  const allDone = phase.steps.every(s => doneSteps.has(s));
  if (allDone && phase.steps.length > 0) return "done";
  return "upcoming";
}

/* ─── Componente principal ────────────────────────────────────────── */
export function PhaseTimeline({
  state,
  currentStep,
  onGoToStep,
}: {
  state: WizardState;
  currentStep: StepId;
  onGoToStep: (step: StepId) => void;
}) {
  // Pasos efectivamente visibles (según la ramificación actual: unifamiliar no
  // tiene config_edificio/extras, etc.). Reutilizamos la lógica existente.
  const visibleStepIds = useMemo(
    () => new Set<StepId>(getAllSteps(state).map(s => s.id)),
    [state],
  );
  // Incluimos "revision" como paso final aunque no esté en getAllSteps todavía
  // (se añadirá en el commit 9).
  visibleStepIds.add("revision");

  const visibleStepsList = useMemo(() => getAllSteps(state).map(s => s.id), [state]);

  // Pasos considerados "done" = los que están ANTES del actual en el orden
  // visible. El paso actual en sí no es done.
  const doneSteps = useMemo(() => {
    const idx = visibleStepsList.indexOf(currentStep);
    if (idx <= 0) return new Set<StepId>();
    return new Set<StepId>(visibleStepsList.slice(0, idx));
  }, [visibleStepsList, currentStep]);

  // Filtramos fases: si la fase no tiene NINGÚN paso visible → no se muestra
  const activePhases = PHASES
    .map(phase => ({
      ...phase,
      steps: phase.steps.filter(s => visibleStepIds.has(s)),
    }))
    .filter(phase => phase.steps.length > 0);

  // Estado de fases colapsadas: por defecto colapsadas todas excepto la actual
  const currentPhase = activePhases.find(p => p.steps.includes(currentStep));
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(() => {
    return new Set(currentPhase ? [currentPhase.id] : []);
  });

  // Cuando el usuario cambia de paso, expande automáticamente la fase del
  // nuevo paso actual (sin cerrar las otras para no ser agresivo).
  useEffect(() => {
    if (!currentPhase) return;
    setExpandedPhases(prev => {
      if (prev.has(currentPhase.id)) return prev;
      const next = new Set(prev);
      next.add(currentPhase.id);
      return next;
    });
  }, [currentPhase]);

  const togglePhase = (phaseId: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  };

  // Sumarios cortos por step (aprovecha StepTimeline.getAllSteps).
  const stepSummaries = useMemo(() => {
    const map = new Map<StepId, string | null>();
    getAllSteps(state).forEach(s => map.set(s.id, s.getSummary(state)));
    return map;
  }, [state]);

  const stepLabels: Record<StepId, string> = {
    role: "Rol",
    tipo: "Tipo de promoción",
    sub_uni: "Vivienda unifamiliar",
    sub_varias: "Tipología y estilo",
    config_edificio: "Configuración edificio",
    extras: "Extras (trasteros, parking)",
    estado: "Estado",
    detalles: "Detalles finales",
    info_basica: "Información básica",
    multimedia: "Multimedia",
    descripcion: "Descripción",
    crear_unidades: "Crear unidades",
    colaboradores: "Colaboradores",
    plan_pagos: "Plan de pagos",
    revision: "Publicar promoción",
  };

  return (
    <nav className="flex flex-col gap-1 w-full" aria-label="Fases del asistente">
      {activePhases.map((phase, phaseIdx) => {
        const status = getPhaseStatus(phase, currentStep, doneSteps);
        const Icon = PHASE_ICONS[phase.id];
        const expanded = expandedPhases.has(phase.id) || status === "current";
        const doneCount = phase.steps.filter(s => doneSteps.has(s)).length;
        const total = phase.steps.length;

        return (
          <div key={phase.id} className="flex flex-col">
            {/* Fila de fase */}
            <button
              type="button"
              onClick={() => togglePhase(phase.id)}
              className={cn(
                "group flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors text-left",
                status === "current"
                  ? "bg-primary/5 border border-primary/20"
                  : "border border-transparent hover:bg-muted/60",
              )}
              aria-expanded={expanded}
            >
              {/* Icono fase */}
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-lg shrink-0 transition-colors",
                  status === "done"
                    ? "bg-primary text-primary-foreground"
                    : status === "current"
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {status === "done" ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Icon className="h-3.5 w-3.5" />}
              </div>

              {/* Texto */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={cn(
                      "text-[12.5px] font-semibold tracking-tight leading-tight",
                      status === "current" ? "text-primary" : status === "done" ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    <span className="text-[10px] text-muted-foreground font-medium mr-1.5 tnum">{phaseIdx + 1}</span>
                    {phase.label}
                  </p>
                  {/* Badge contador */}
                  <span
                    className={cn(
                      "shrink-0 tnum text-[10px] font-semibold rounded-full px-1.5 py-0.5 min-w-[28px] text-center",
                      status === "done"
                        ? "bg-primary/10 text-primary"
                        : status === "current"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {doneCount}/{total}
                  </span>
                </div>
                <p className="text-[10.5px] text-muted-foreground truncate mt-0.5">
                  {phase.description}
                </p>
              </div>

              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform",
                  expanded ? "rotate-180" : "rotate-0",
                )}
              />
            </button>

            {/* Sub-pasos */}
            {expanded && (
              <div className="mt-1 ml-3 pl-3 border-l border-border flex flex-col gap-0.5 pb-2">
                {phase.steps.map((stepId) => {
                  const isCurrent = stepId === currentStep;
                  const isDone = doneSteps.has(stepId);
                  const clickable = isDone || isCurrent;
                  const summary = stepSummaries.get(stepId) ?? null;

                  return (
                    <button
                      key={stepId}
                      type="button"
                      disabled={!clickable}
                      onClick={() => clickable && onGoToStep(stepId)}
                      className={cn(
                        "group flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors min-w-0",
                        clickable ? "hover:bg-muted/50 cursor-pointer" : "cursor-default",
                        isCurrent && "bg-primary/5",
                      )}
                    >
                      {/* Bullet */}
                      <div className="mt-1 shrink-0">
                        <div
                          className={cn(
                            "h-1.5 w-1.5 rounded-full transition-colors",
                            isDone
                              ? "bg-primary"
                              : isCurrent
                                ? "bg-primary ring-2 ring-primary/20"
                                : "bg-muted-foreground/30",
                          )}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "text-[11.5px] leading-tight",
                            isCurrent
                              ? "text-primary font-semibold"
                              : isDone
                                ? "text-foreground font-medium"
                                : "text-muted-foreground",
                          )}
                        >
                          {stepLabels[stepId]}
                        </p>
                        {summary && isDone && (
                          <p className="text-[10.5px] text-muted-foreground/80 truncate mt-0.5">
                            {summary}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
