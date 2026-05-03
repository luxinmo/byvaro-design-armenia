/**
 * ConfiguracionEdificio v2 · Wizard conversacional para el paso 3 del
 * wizard exterior. Una pregunta a la vez, vista previa siempre visible
 * a la derecha, resumen final.
 *
 * Modelo SIMPLIFICADO interno (`escaleras` y `bloques` globales) con
 * mapping a/desde el WizardState canónico via `types.ts::wizardToSimple`
 * y `simpleToWizardPatch`.
 *
 * El sub-step (0-4) vive solo en componente · NO se persiste · si el
 * user cierra y vuelve, arranca en P1. La info numérica (plantas,
 * viviendas, etc.) sí se persiste en WizardState como hasta ahora.
 *
 * Feature flag · activado con `?wizardV2=1` desde la URL del wizard.
 * El componente actual queda intacto cuando la flag no está · cero
 * riesgo en producción mientras se valida.
 */

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { WizardState } from "../types";
import { wizardToSimple, simpleToWizardPatch } from "./types";
import type { SubStep, ModeloSimple, EstructuraEdificio, UsoPlantaBaja } from "./types";

import { DotsNav } from "./DotsNav";
import { PreviewPane } from "./PreviewPane";
import { QuestionPlantas } from "./QuestionPlantas";
import { QuestionViviendas } from "./QuestionViviendas";
import { QuestionEstructura } from "./QuestionEstructura";
import { QuestionPlantaBaja } from "./QuestionPlantaBaja";
import { Resumen } from "./Resumen";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function ConfiguracionEdificio({
  state,
  update,
  onContinueOuter,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  /** Callback cuando el user pulsa "Continuar al paso 4" en el resumen.
   *  El padre (CrearPromocion) avanza al siguiente step del wizard. */
  onContinueOuter: () => void;
}) {
  const [subStep, setSubStep] = useState<SubStep>(0);
  const modelo = useMemo(() => wizardToSimple(state), [state]);

  /** Aplica un patch parcial del modelo simple al WizardState canónico.
   *  Encadena varios `update()` (una key cada uno · el wizard no tiene
   *  patch atómico). React batchea las llamadas dentro del mismo
   *  handler · una sola re-render. */
  const applyPatch = useCallback((m: Partial<ModeloSimple>) => {
    const patch = simpleToWizardPatch(m, state);
    if (patch.plantas !== undefined) update("plantas", patch.plantas);
    if (patch.aptosPorPlanta !== undefined) update("aptosPorPlanta", patch.aptosPorPlanta);
    if (patch.numBloques !== undefined) update("numBloques", patch.numBloques);
    if (patch.escalerasPorBloque !== undefined) update("escalerasPorBloque", patch.escalerasPorBloque);
    if (patch.plantaBajaTipo !== undefined) update("plantaBajaTipo", patch.plantaBajaTipo);
  }, [state, update]);

  const setPlantas = (n: number) => applyPatch({ plantas: n });
  const setViviendas = (n: number) => applyPatch({ viviendas: n });
  const setEstructura = (e: EstructuraEdificio) => applyPatch({ estructura: e });
  const setEscaleras = (n: number) => applyPatch({ escaleras: n });
  const setBloques = (n: number) => applyPatch({ bloques: n });
  const setPlantaBaja = (v: UsoPlantaBaja) => applyPatch({ plantaBaja: v });

  const goNext = () => setSubStep((s) => (s < 4 ? ((s + 1) as SubStep) : s));
  const goPrev = () => setSubStep((s) => (s > 0 ? ((s - 1) as SubStep) : s));

  return (
    /* Outer container · alto fijado a viewport - chrome (topbar 56 +
       footer 64 + main padding ~80 = 200px). Nunca permite scroll en
       el step. min-h-0 garantiza que los hijos puedan encogerse. */
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 lg:h-[calc(100vh-260px)] lg:max-h-[calc(100vh-260px)] min-h-0">
      {/* ─── COLUMNA IZQUIERDA · pregunta activa + nav ─── */}
      <div className="flex flex-col min-h-0">
        {/* Pregunta activa con animación de entrada · centrada
           verticalmente para que no quede pegada arriba. */}
        <div className="flex-1 flex items-center justify-center py-2">
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
                <QuestionPlantas value={modelo.plantas} onChange={setPlantas} />
              )}
              {subStep === 1 && (
                <QuestionViviendas value={modelo.viviendas} onChange={setViviendas} />
              )}
              {subStep === 2 && (
                <QuestionEstructura
                  estructura={modelo.estructura}
                  escaleras={modelo.escaleras}
                  bloques={modelo.bloques}
                  onEstructuraChange={setEstructura}
                  onEscalerasChange={setEscaleras}
                  onBloquesChange={setBloques}
                />
              )}
              {subStep === 3 && (
                <QuestionPlantaBaja value={modelo.plantaBaja} onChange={setPlantaBaja} />
              )}
              {subStep === 4 && (
                <Resumen
                  modelo={modelo}
                  onEdit={(s) => setSubStep(s)}
                  onContinue={onContinueOuter}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navegación inferior · prev / dots / next (oculto next en resumen) */}
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

          <DotsNav current={subStep} onGo={setSubStep} />

          {subStep < 4 ? (
            <button
              type="button"
              onClick={goNext}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-foreground text-background text-[13px] font-medium hover:bg-foreground/90 transition-colors shadow-soft"
            >
              Siguiente
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          ) : (
            <span className="w-[88px]" /> /* spacer · mantiene dots centrados */
          )}
        </div>
      </div>

      {/* ─── COLUMNA DERECHA · preview sticky ───
         La altura del aside la define PreviewPane por dentro
         (max-h calculado contra viewport · ver PreviewPane.tsx) ·
         aquí solo posicionamos sticky para que siga al scroll. */}
      <aside className="lg:sticky lg:top-4 self-start w-full">
        <PreviewPane modelo={modelo} />
      </aside>
    </div>
  );
}
