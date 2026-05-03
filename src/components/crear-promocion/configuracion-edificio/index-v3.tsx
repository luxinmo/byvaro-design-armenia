/**
 * V3 · Orden alternativo de preguntas con auto-advance binario.
 *
 * Flujo:
 *   1. Escaleras (binary "Una sola" / "Más de una") · auto-advance en
 *      "Una sola" · sub-stepper si "Más de una".
 *   2. Bloques (igual mecánica).
 *   3. Plantas (stepper big · siguiente manual).
 *   4. Viviendas por planta (stepper big · siguiente manual).
 *   5. Planta baja (3 cards · auto-advance al click).
 *   6. Resumen.
 *
 * Modelo simple compartido con V2 · misma lógica de mapping al
 * WizardState canónico. Componentes BuildingViz/PreviewPane reusados.
 */

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WizardState } from "../types";
import { wizardToSimple, simpleToWizardPatch } from "./types";
import type { ModeloSimple, UsoPlantaBaja } from "./types";

import { DotsNav } from "./DotsNav";
import { PreviewPane } from "./PreviewPane";
import { QuestionEscalerasV3 } from "./QuestionEscalerasV3";
import { QuestionBloquesV3 } from "./QuestionBloquesV3";
import { QuestionPlantas } from "./QuestionPlantas";
import { QuestionViviendas } from "./QuestionViviendas";
import { QuestionPlantaBaja } from "./QuestionPlantaBaja";
import { Resumen } from "./Resumen";

type V3Step = 0 | 1 | 2 | 3 | 4 | 5;
// 0=Escaleras · 1=Bloques · 2=Plantas · 3=Viviendas · 4=PB · 5=Resumen

export function ConfiguracionEdificioV3({
  state,
  update,
  onContinueOuter,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  onContinueOuter: () => void;
}) {
  const [subStep, setSubStep] = useState<V3Step>(0);
  const modelo = useMemo(() => wizardToSimple(state), [state]);

  const applyPatch = useCallback((m: Partial<ModeloSimple>) => {
    const patch = simpleToWizardPatch(m, state);
    if (patch.plantas !== undefined) update("plantas", patch.plantas);
    if (patch.aptosPorPlanta !== undefined) update("aptosPorPlanta", patch.aptosPorPlanta);
    if (patch.numBloques !== undefined) update("numBloques", patch.numBloques);
    if (patch.escalerasPorBloque !== undefined) update("escalerasPorBloque", patch.escalerasPorBloque);
    if (patch.plantaBajaTipo !== undefined) update("plantaBajaTipo", patch.plantaBajaTipo);
  }, [state, update]);

  const setEscaleras = (n: number) => applyPatch({ escaleras: n });
  const setBloques = (n: number) => applyPatch({ bloques: n });
  const setPlantas = (n: number) => applyPatch({ plantas: n });
  const setViviendas = (n: number) => applyPatch({ viviendas: n });
  const setPlantaBaja = (v: UsoPlantaBaja) => {
    applyPatch({ plantaBaja: v });
    /* PB también auto-advance al elegir cualquier opción. */
    setTimeout(() => goNext(), 0);
  };

  const goNext = () => setSubStep((s) => (s < 5 ? ((s + 1) as V3Step) : s));
  const goPrev = () => setSubStep((s) => (s > 0 ? ((s - 1) as V3Step) : s));

  /* DotsNav espera 0-4 (5 slots). En V3 tenemos 6 slots. Mapeo
   * simplificado: comprimimos escaleras+bloques en el primer dot
   * (estructura) para mantener visual consistente con V2. Mejor:
   * adaptamos DotsNav a 6 dots dinámicos. */
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 lg:h-[calc(100vh-260px)] lg:max-h-[calc(100vh-260px)] min-h-0">
      {/* ─── COLUMNA IZQUIERDA · pregunta activa + nav ─── */}
      <div className="flex flex-col min-h-0">
        <div className="flex-1 flex items-center justify-center py-2 min-h-0 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={subStep}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
              className="w-full"
            >
              {subStep === 0 && (
                <QuestionEscalerasV3
                  escaleras={modelo.escaleras}
                  onEscalerasChange={setEscaleras}
                  onAutoAdvance={goNext}
                />
              )}
              {subStep === 1 && (
                <QuestionBloquesV3
                  bloques={modelo.bloques}
                  onBloquesChange={setBloques}
                  onAutoAdvance={goNext}
                />
              )}
              {subStep === 2 && (
                <QuestionPlantas value={modelo.plantas} onChange={setPlantas} />
              )}
              {subStep === 3 && (
                <QuestionViviendas value={modelo.viviendas} onChange={setViviendas} />
              )}
              {subStep === 4 && (
                <QuestionPlantaBaja value={modelo.plantaBaja} onChange={setPlantaBaja} />
              )}
              {subStep === 5 && (
                <Resumen
                  modelo={modelo}
                  onEdit={(s) => {
                    /* Map del SubStep de V2 (0-3) al V3Step equivalente. */
                    const map: Record<number, V3Step> = { 0: 2, 1: 3, 2: 0, 3: 4 };
                    setSubStep(map[s] ?? 0);
                  }}
                  onContinue={onContinueOuter}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navegación · prev / dots / next (oculto next en resumen) */}
        <div className="flex items-center justify-between gap-4 pt-3 border-t border-border/40">
          <button
            type="button"
            onClick={goPrev}
            disabled={subStep === 0}
            className={cn(
              "inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[13px] font-medium transition-colors",
              "disabled:opacity-30 disabled:cursor-not-allowed",
              "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
            Atrás
          </button>

          <DotsNavV3 current={subStep} onGo={setSubStep} />

          {subStep < 5 ? (
            <button
              type="button"
              onClick={goNext}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-foreground text-background text-[13px] font-medium hover:bg-foreground/90 transition-colors shadow-soft"
            >
              Siguiente
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          ) : (
            <span className="w-[88px]" />
          )}
        </div>
      </div>

      {/* ─── COLUMNA DERECHA · preview sticky ─── */}
      <aside className="lg:sticky lg:top-4 self-start w-full h-full">
        <PreviewPane modelo={modelo} />
      </aside>
    </div>
  );
}

/* DotsNav local con 6 dots para V3. */
function DotsNavV3({
  current,
  onGo,
}: {
  current: V3Step;
  onGo: (s: V3Step) => void;
}) {
  const labels = ["Escaleras", "Bloques", "Plantas", "Viviendas", "Planta baja", "Resumen"];
  return (
    <nav aria-label="Pasos" className="inline-flex items-center gap-2">
      {([0, 1, 2, 3, 4, 5] as V3Step[]).map((s) => {
        const active = s === current;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onGo(s)}
            aria-current={active ? "step" : undefined}
            aria-label={`Ir a ${labels[s]}`}
            className={cn(
              "h-2 rounded-full transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              active ? "w-7 bg-foreground" : "w-2 bg-foreground/20 hover:bg-foreground/40",
            )}
          />
        );
      })}
    </nav>
  );
}
