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

/** ¿El paso está completo según su contenido en el state?
 *  Misma lógica que `isStepComplete` del CrearPromocion (duplicada aquí
 *  para no crear dependencias cruzadas; el contrato es idéntico). */
function isStepComplete(s: WizardState, sid: StepId): boolean {
  switch (sid) {
    case "role": return !!s.role;
    case "tipo": return !!s.tipo;
    case "sub_uni": return !!s.subUni;
    case "sub_varias":
      if (s.subUni === "varias") {
        return s.tipologiasSeleccionadas.length > 0 && s.estilosSeleccionados.length > 0;
      }
      return !!s.subVarias && !!s.estiloVivienda;
    case "config_edificio": return s.numBloques >= 1 && s.plantas >= 1 && s.aptosPorPlanta >= 1;
    case "extras": return true; // opcional
    case "estado": return !!s.estado;
    case "detalles": return !!s.fechaEntrega || !!s.trimestreEntrega || !!s.tipoEntrega;
    case "info_basica":
      return !!s.nombrePromocion.trim()
        && !!s.direccionPromocion.pais.trim()
        && !!s.direccionPromocion.ciudad.trim();
    case "multimedia": return s.fotos.length > 0;
    case "descripcion": return !!s.descripcion || Object.keys(s.descripcionIdiomas ?? {}).length > 0;
    case "crear_unidades": return s.unidades.length > 0;
    case "colaboradores": return !s.colaboracion || !!s.formaPagoComision;
    case "plan_pagos": return !!s.metodoPago;
    case "revision": return false;
  }
}

/* `isStepRequired` removed · el sidebar ya no diferencia visualmente
 *  entre obligatorios y opcionales en pasos intermedios. La validación
 *  de qué falta para activar vive solo en `RevisionStep.tsx` ·
 *  consume `getMissingForWizard()` directamente. */

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
    description: "Activar promoción",
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

  // Pasos considerados "done" = los que tienen contenido válido en el
  // state (no solo porque se hayan visitado). El paso actual puede
  // seguir siendo "done" si ya está completo antes de avanzar.
  const doneSteps = useMemo(() => {
    const done = new Set<StepId>();
    visibleStepsList.forEach((sid) => { if (isStepComplete(state, sid)) done.add(sid); });
    return done;
  }, [visibleStepsList, state]);

  // Filtramos fases: si la fase no tiene NINGÚN paso visible → no se muestra
  const activePhases = PHASES
    .map(phase => ({
      ...phase,
      steps: phase.steps.filter(s => visibleStepIds.has(s)),
    }))
    .filter(phase => phase.steps.length > 0);

  // Estado de fases colapsadas: por defecto colapsadas todas excepto la
  // actual. Antes auto-expandíamos las fases con "pendientes obligatorios"
  // para hacer visibles los rojos · ahora el wizard es borrador-guiado y
  // no grita errores · el usuario navega por los pasos a su ritmo.
  const currentPhase = activePhases.find(p => p.steps.includes(currentStep));
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (currentPhase) initial.add(currentPhase.id);
    return initial;
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
    revision: "Activar promoción",
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
            {/* Fila de fase · estilo neutro · el wizard es un borrador
                guiado · NO mostramos errores rojos en pasos intermedios.
                La validación pre-publicación vive en el paso "Revisión". */}
            <button
              type="button"
              onClick={() => togglePhase(phase.id)}
              className={cn(
                "group flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors text-left relative",
                status === "current"
                  ? "bg-primary/5 border border-primary/20"
                  : "border border-transparent hover:bg-muted/60",
              )}
              aria-expanded={expanded}
            >
              {/* Icono fase */}
              <div className="relative shrink-0">
                <div
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
                    status === "done"
                      ? "bg-primary text-primary-foreground"
                      : status === "current"
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground",
                  )}
                >
                  {status === "done" ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Icon className="h-3.5 w-3.5" />}
                </div>
              </div>

              {/* Texto */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={cn(
                      "text-[12.5px] font-semibold tracking-tight leading-tight",
                      status === "current"
                        ? "text-primary"
                        : status === "done"
                          ? "text-foreground"
                          : "text-muted-foreground",
                    )}
                  >
                    <span className="text-[10px] text-muted-foreground font-medium mr-1.5 tnum">{phaseIdx + 1}</span>
                    {phase.label}
                  </p>
                  {/* Badge contador · neutro siempre · solo informa progreso. */}
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
                <p className="text-[10.5px] truncate mt-0.5 text-muted-foreground">
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

            {/* Sub-pasos · cada uno muestra estado real (done/pending)
                 con indicador rojo si es obligatorio para publicar. */}
            {expanded && (
              <div className="mt-1 ml-3 pl-3 border-l border-border flex flex-col gap-0.5 pb-2">
                {phase.steps.map((stepId) => {
                  const isCurrent = stepId === currentStep;
                  const isDone = doneSteps.has(stepId);
                  const summary = stepSummaries.get(stepId) ?? null;

                  return (
                    <button
                      key={stepId}
                      type="button"
                      onClick={() => onGoToStep(stepId)}
                      className={cn(
                        "group flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors min-w-0 cursor-pointer",
                        isCurrent ? "bg-primary/5" : "hover:bg-muted/50",
                      )}
                    >
                      {/* Bullet · check verde si done, dot azul si current,
                          círculo neutro vacío en el resto. Antes pintábamos
                          rojo "obligatorio pendiente" · era agresivo en
                          medio del flujo · el wizard es borrador, no
                          formulario validado. */}
                      <div className="mt-0.5 shrink-0">
                        {isDone ? (
                          <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            <Check className="h-2 w-2" strokeWidth={3} />
                          </span>
                        ) : isCurrent ? (
                          <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary/15">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                          </span>
                        ) : (
                          <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-muted-foreground/30" />
                        )}
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
