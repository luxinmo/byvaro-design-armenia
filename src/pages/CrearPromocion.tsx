/**
 * Crear promoción · Wizard multi-paso (Fase 1: shell + pasos role/tipo)
 *
 * Port del CreatePromotion.tsx del repo original con el lenguaje visual Byvaro v2.
 * Estructura:
 *   - Timeline lateral izquierdo con los pasos visibles según el estado
 *   - Área central con el contenido del paso actual
 *   - Footer fijo con Atrás / Guardar borrador / Siguiente
 *   - Auto-save a localStorage en cada cambio
 *
 * Pasos implementados en Fase 1: role, tipo.
 * El resto muestra un placeholder hasta que se portenen Fases 2-4.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X, Sparkles } from "lucide-react";
import { Toaster, toast } from "sonner";

import type {
  StepId, WizardState, RoleOption, TipoPromocion,
} from "@/components/crear-promocion/types";
import { defaultWizardState } from "@/components/crear-promocion/types";
import { roleOptions, tipoOptions } from "@/components/crear-promocion/options";
import { OptionCard } from "@/components/crear-promocion/SharedWidgets";
import { StepTimeline, getAllSteps } from "@/components/crear-promocion/StepTimeline";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════
   Persistencia en localStorage (idéntica al original)
   ═══════════════════════════════════════════════════════════════════ */
const DRAFT_KEY = "byvaro-crear-promocion-draft";
const loadDraft = (): WizardState | null => {
  try {
    const r = localStorage.getItem(DRAFT_KEY);
    return r ? { ...defaultWizardState, ...JSON.parse(r) } : null;
  } catch { return null; }
};
const saveDraftLS = (s: WizardState) => localStorage.setItem(DRAFT_KEY, JSON.stringify(s));
const clearDraft = () => localStorage.removeItem(DRAFT_KEY);

/* ═══════════════════════════════════════════════════════════════════
   Metadatos de cada paso (título + subtítulo mostrados en la cabecera)
   ═══════════════════════════════════════════════════════════════════ */
const stepMeta: Record<StepId, { title: string; subtitle: string }> = {
  role: { title: "Crear nueva promoción", subtitle: "¿Cómo deseas crear esta promoción?" },
  tipo: { title: "Tipo de promoción", subtitle: "Selecciona el tipo de promoción" },
  sub_uni: { title: "Vivienda unifamiliar", subtitle: "¿Cuántas viviendas tendrá la promoción?" },
  sub_varias: { title: "Tipología y estilo", subtitle: "Selecciona el tipo y estilo arquitectónico" },
  config_edificio: { title: "Configuración del edificio", subtitle: "Define la estructura y distribución de plantas" },
  extras: { title: "Anejos y extras", subtitle: "Configura trasteros y plazas de parking por vivienda" },
  estado: { title: "Estado de la promoción", subtitle: "¿En qué fase se encuentra?" },
  detalles: { title: "Detalles finales", subtitle: "Configuración adicional de la promoción" },
  info_basica: { title: "Información básica", subtitle: "Nombre, ubicación y características" },
  multimedia: { title: "Multimedia", subtitle: "Fotografías y videos de la promoción" },
  descripcion: { title: "Descripción", subtitle: "Describe la promoción para los compradores" },
  crear_unidades: { title: "Crear unidades", subtitle: "Configura las unidades de la promoción" },
  colaboradores: { title: "Colaboración", subtitle: "Define cómo se compensará a las agencias colaboradoras" },
  plan_pagos: { title: "Plan de pagos", subtitle: "Define cómo pagará el comprador durante el proceso de compra" },
};

/* ═══════════════════════════════════════════════════════════════════
   Página principal
   ═══════════════════════════════════════════════════════════════════ */
export default function CrearPromocion() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<WizardState>(() => loadDraft() ?? defaultWizardState);
  const initialStep = (searchParams.get("step") as StepId) || "role";
  const [step, setStep] = useState<StepId>(initialStep);

  const update = useCallback(<K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setState(prev => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => { saveDraftLS(state); }, [state]);

  /* Pasos visibles según ramificación (depende de tipo/subUni) */
  const visibleSteps = useMemo(() => getAllSteps(state).map(s => s.id), [state]);
  const getNext = (): StepId | null => {
    const i = visibleSteps.indexOf(step);
    return i < visibleSteps.length - 1 ? visibleSteps[i + 1] : null;
  };
  const getPrev = (): StepId | null => {
    const i = visibleSteps.indexOf(step);
    return i > 0 ? visibleSteps[i - 1] : null;
  };

  /* Validación de "Siguiente" por paso */
  const canContinue = () => {
    if (step === "role") return !!state.role;
    if (step === "tipo") return !!state.tipo;
    // Pasos aún no portados: siempre permitimos pasar (placeholder)
    return true;
  };

  /* Handlers */
  const handleContinue = () => {
    const next = getNext();
    if (next) setStep(next);
    else {
      clearDraft();
      toast.success("Promoción creada correctamente");
      navigate("/promociones");
    }
  };
  const handleBack = () => {
    const prev = getPrev();
    if (prev) setStep(prev);
    else navigate(-1);
  };
  const handleSaveDraft = () => {
    saveDraftLS(state);
    toast.success("Borrador guardado");
  };
  const handleClose = () => {
    if (confirm("¿Salir del asistente? El borrador se conserva.")) navigate("/promociones");
  };

  /* Selección de tipo reinicia sub-pasos */
  const handleTipoSelect = (v: string) => {
    setState(prev => ({ ...prev, tipo: v as TipoPromocion, subUni: null, subVarias: null, estado: null }));
  };

  const meta = stepMeta[step];

  return (
    <div className="fixed inset-0 z-40 flex bg-background">
      <Toaster position="top-center" richColors />

      {/* ═══════════ Sidebar Timeline ═══════════ */}
      <aside className="hidden lg:flex w-[280px] shrink-0 flex-col border-r border-border bg-card">
        <div className="h-14 flex items-center gap-2.5 px-5 border-b border-border">
          <div className="w-8 h-8 rounded-xl bg-primary grid place-items-center text-primary-foreground font-bold text-sm">B</div>
          <div className="font-bold text-[15px] tracking-tight">Byvaro</div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-4">
            Crear promoción
          </p>
          <StepTimeline state={state} currentStep={step} onGoToStep={setStep} />
        </div>
      </aside>

      {/* ═══════════ Main area ═══════════ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile + desktop) */}
        <header className="h-14 shrink-0 flex items-center justify-between px-4 sm:px-6 border-b border-border bg-background/95 backdrop-blur">
          <div className="lg:hidden flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary grid place-items-center text-primary-foreground font-bold text-[13px]">B</div>
            <span className="font-bold text-[14px] tracking-tight">Crear promoción</span>
          </div>
          <div className="hidden lg:block text-xs text-muted-foreground">
            Paso {visibleSteps.indexOf(step) + 1} de {visibleSteps.length}
          </div>
          <button
            onClick={handleClose}
            className="p-2 -mr-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Cerrar asistente"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-10">
          <div className={cn(
            "mx-auto w-full",
            step === "crear_unidades" || step === "colaboradores" ? "max-w-[720px]" : "max-w-[580px]"
          )}>
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col gap-6"
              >
                {/* Step header */}
                <div>
                  <h1 className="text-[22px] sm:text-[24px] font-bold tracking-tight leading-tight">
                    {meta.title}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1.5">{meta.subtitle}</p>
                </div>

                {/* ─── Step: role ─── */}
                {step === "role" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {roleOptions.map((o) => (
                      <OptionCard
                        key={o.value}
                        option={o}
                        selected={state.role === o.value}
                        onSelect={(v) => update("role", v as RoleOption)}
                      />
                    ))}
                  </div>
                )}

                {/* ─── Step: tipo ─── */}
                {step === "tipo" && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {tipoOptions.map((o) => (
                      <OptionCard
                        key={o.value}
                        option={o}
                        selected={state.tipo === o.value}
                        onSelect={handleTipoSelect}
                      />
                    ))}
                  </div>
                )}

                {/* ─── Placeholder for steps not yet ported ─── */}
                {step !== "role" && step !== "tipo" && (
                  <UpcomingStep step={step} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* ═══════════ Footer nav ═══════════ */}
        <footer className="h-16 shrink-0 flex items-center justify-between px-4 sm:px-6 lg:px-10 border-t border-border bg-card">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            {!getPrev() ? "Cancelar" : "Atrás"}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveDraft}
              className="hidden sm:inline-flex items-center h-9 px-4 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Guardar borrador
            </button>
            <button
              onClick={handleContinue}
              disabled={!canContinue()}
              className="inline-flex items-center gap-1.5 h-9 px-4 sm:px-5 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors shadow-soft disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {!getNext() ? "Publicar" : "Siguiente"}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Placeholder para pasos aún no portados
   ═══════════════════════════════════════════════════════════════════ */
function UpcomingStep({ step }: { step: StepId }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 sm:p-8 text-center">
      <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center mx-auto mb-3">
        <Sparkles className="h-5 w-5 text-primary" />
      </div>
      <h3 className="text-[14.5px] font-semibold">Paso "{step}" · próximamente</h3>
      <p className="text-[12.5px] text-muted-foreground mt-1.5 max-w-sm mx-auto leading-relaxed">
        Este paso se portará en la siguiente fase del diseño. Puedes continuar al siguiente o volver atrás.
      </p>
    </div>
  );
}
