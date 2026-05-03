/**
 * V4 · Flujo per-bloque.
 *
 *   1. Bloques (binary, sin selección por defecto, auto-advance).
 *   2..N+1. Configura bloque K (escaleras + plantas + viviendas) ·
 *      uno por bloque · cada uno con su propio set de valores.
 *   N+2. Planta baja.
 *   N+3. Resumen.
 *
 * Modelo · usa el WizardState canónico para escaleras
 * (`escalerasPorBloque[i]`) que YA es per-bloque. Para plantas y
 * viviendas, V4 mantiene su propio array INTERNO (`plantasPorBloque`,
 * `viviendasPorBloque`) porque el WizardState canónico solo tiene
 * `plantas` y `aptosPorPlanta` globales. Al avanzar fuera del paso,
 * escribimos los valores del PRIMER bloque a los campos canónicos
 * (compromiso para no romper el modelo central · puede revisarse en
 * un cleanup posterior).
 */

import { useState, useMemo, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WizardState } from "../types";
import { wizardToSimple, simpleToWizardPatch } from "./types";
import type { ModeloSimple, UsoPlantaBaja } from "./types";

import { PreviewPane } from "./PreviewPane";
import { QuestionBloquesV4 } from "./QuestionBloquesV4";
import { BloqueConfigV4 } from "./BloqueConfigV4";
import { QuestionPlantaBaja } from "./QuestionPlantaBaja";
import { Resumen } from "./Resumen";

export function ConfiguracionEdificioV4({
  state,
  update,
  onContinueOuter,
  onSubstepChange,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  onContinueOuter: () => void;
  /* Notifica al padre el sub-step interno · usado para gatear el
   * Siguiente global del wizard exterior. */
  onSubstepChange?: (s: string) => void;
}) {
  /* ── Estado local del flujo V4 ── */
  /* substep: 0=Bloques · 1..N=Config bloque K · N+1=PB · N+2=Resumen */
  const [hasChosenBloques, setHasChosenBloques] = useState(false);
  const [bloques, setBloques] = useState<number>(state.numBloques || 1);
  const [currentBloque, setCurrentBloque] = useState(0);
  const [substep, setSubstep] = useState<"bloques" | "config" | "pb" | "resumen">("bloques");

  /* Datos per-bloque · arrays gestionados aquí porque el WizardState
   * solo tiene `plantas` y `aptosPorPlanta` globales. Al inicializar,
   * propagamos el valor global a TODOS los slots del array. */
  const [escPorBloque, setEscPorBloque] = useState<number[]>(() => {
    const escs = state.escalerasPorBloque[0] || 1;
    return Array.from({ length: state.numBloques || 1 }, (_, i) =>
      state.escalerasPorBloque[i] || escs);
  });
  const [plantasPorBloque, setPlantasPorBloque] = useState<number[]>(() =>
    Array.from({ length: state.numBloques || 1 }, () => state.plantas || 4));
  const [vivPorBloque, setVivPorBloque] = useState<number[]>(() =>
    Array.from({ length: state.numBloques || 1 }, () => state.aptosPorPlanta || 4));
  const [nombresPorBloque, setNombresPorBloque] = useState<string[]>(() =>
    Array.from({ length: state.numBloques || 1 }, (_, i) =>
      state.blockNames[`B${i + 1}`] || `Bloque ${i + 1}`));

  /* ── Sincronizar arrays cuando cambia `bloques` ── */
  useEffect(() => {
    const grow = (arr: number[], def: number) => {
      if (bloques === arr.length) return arr;
      if (bloques < arr.length) return arr.slice(0, bloques);
      return [...arr, ...Array.from({ length: bloques - arr.length }, () => def)];
    };
    setEscPorBloque((a) => grow(a, 1));
    setPlantasPorBloque((a) => grow(a, 4));
    setVivPorBloque((a) => grow(a, 4));
    setNombresPorBloque((a) => {
      if (bloques === a.length) return a;
      if (bloques < a.length) return a.slice(0, bloques);
      return [...a, ...Array.from({ length: bloques - a.length }, (_, i) => `Bloque ${a.length + i + 1}`)];
    });
  }, [bloques]);

  /* ── Modelo simple para la preview · usa el bloque actual cuando
   *    estamos en config, o el primero como referencia general. ── */
  const previewModelo: ModeloSimple = useMemo(() => {
    /* Para la preview, mostramos el bloque que estás configurando ·
     * o el primero si estás en otra pantalla. Solo 1 bloque visible
     * en la preview (no todos los multi-bloques) · más entendible. */
    const idx = substep === "config" ? currentBloque : 0;
    const baseSimple = wizardToSimple(state);
    return {
      ...baseSimple,
      bloques: 1, // siempre mostramos 1 a la vez
      escaleras: escPorBloque[idx] || 1,
      plantas: plantasPorBloque[idx] || 4,
      viviendas: vivPorBloque[idx] || 4,
    };
  }, [state, substep, currentBloque, escPorBloque, plantasPorBloque, vivPorBloque]);

  /* ── Persistencia al WizardState ── */
  /* Cada cambio en el flujo V4 escribe al WizardState canónico para
   * que el draft se guarde · usamos el primer bloque como
   * "representante" para los campos globales (`plantas`, `aptos`).
   * Los demás bloques se preservan en escalerasPorBloque + nombres. */
  const persistAll = useCallback(() => {
    update("numBloques", bloques);
    update("escalerasPorBloque", escPorBloque);
    update("plantas", plantasPorBloque[0] || 4);
    update("aptosPorPlanta", vivPorBloque[0] || 4);
    /* Nombres de bloque mergeados al state · solo si difieren del default */
    const names: Record<string, string> = {};
    nombresPorBloque.forEach((name, i) => {
      const def = `Bloque ${i + 1}`;
      if (name !== def) names[`B${i + 1}`] = name;
    });
    update("blockNames", names);
  }, [bloques, escPorBloque, plantasPorBloque, vivPorBloque, nombresPorBloque, update]);

  useEffect(() => { persistAll(); }, [persistAll]);

  /* Notificar al padre el sub-step actual · gatear Siguiente global. */
  useEffect(() => {
    onSubstepChange?.(substep);
  }, [substep, onSubstepChange]);

  /* ── Handlers ── */
  const handleBloqueSelect = (single: boolean) => {
    setHasChosenBloques(true);
    setBloques(single ? 1 : 2);
    setCurrentBloque(0);
    /* Pequeño defer para que el state visual confirme la selección
     * antes de cambiar de pantalla. */
    setTimeout(() => setSubstep("config"), 120);
  };

  const handleEscChange = (n: number) => {
    setEscPorBloque((a) => a.map((v, i) => (i === currentBloque ? n : v)));
  };
  const handlePlantasChange = (n: number) => {
    setPlantasPorBloque((a) => a.map((v, i) => (i === currentBloque ? n : v)));
  };
  const handleVivChange = (n: number) => {
    setVivPorBloque((a) => a.map((v, i) => (i === currentBloque ? n : v)));
  };
  const handleRename = (name: string) => {
    setNombresPorBloque((a) => a.map((v, i) => (i === currentBloque ? name : v)));
  };

  const handleNext = () => {
    if (substep === "config") {
      if (currentBloque < bloques - 1) {
        setCurrentBloque((i) => i + 1);
      } else {
        setSubstep("pb");
      }
    } else if (substep === "pb") {
      setSubstep("resumen");
    } else if (substep === "resumen") {
      onContinueOuter();
    }
  };

  const handlePrev = () => {
    if (substep === "config") {
      if (currentBloque > 0) {
        setCurrentBloque((i) => i - 1);
      } else {
        setSubstep("bloques");
      }
    } else if (substep === "pb") {
      setSubstep("config");
      setCurrentBloque(bloques - 1);
    } else if (substep === "resumen") {
      setSubstep("pb");
    }
  };

  const setPlantaBaja = (v: UsoPlantaBaja) => {
    const patch = simpleToWizardPatch({ plantaBaja: v }, state);
    if (patch.plantaBajaTipo !== undefined) update("plantaBajaTipo", patch.plantaBajaTipo);
    setTimeout(() => setSubstep("resumen"), 120);
  };

  /* ── Render ── */
  const motionKey = substep === "config" ? `config-${currentBloque}` : substep;
  const showPrev = !(substep === "bloques");
  const showNext = substep !== "bloques" && substep !== "resumen";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 lg:h-[calc(100vh-260px)] lg:max-h-[calc(100vh-260px)] min-h-0">
      <div className="flex flex-col min-h-0">
        <div className="flex-1 flex items-center justify-center py-2 min-h-0 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={motionKey}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
              className="w-full"
            >
              {substep === "bloques" && (
                <QuestionBloquesV4
                  hasChosen={hasChosenBloques}
                  isSingle={bloques === 1}
                  onSelect={handleBloqueSelect}
                />
              )}
              {substep === "config" && (
                <BloqueConfigV4
                  blockName={nombresPorBloque[currentBloque] || `Bloque ${currentBloque + 1}`}
                  isMultiBlock={bloques > 1}
                  bloqueIdx={currentBloque}
                  totalBloques={bloques}
                  escaleras={escPorBloque[currentBloque] || 1}
                  plantas={plantasPorBloque[currentBloque] || 4}
                  viviendas={vivPorBloque[currentBloque] || 4}
                  onRename={handleRename}
                  onEscalerasChange={handleEscChange}
                  onPlantasChange={handlePlantasChange}
                  onViviendasChange={handleVivChange}
                />
              )}
              {substep === "pb" && (
                <QuestionPlantaBaja
                  value={previewModelo.plantaBaja}
                  onChange={setPlantaBaja}
                />
              )}
              {substep === "resumen" && (
                <Resumen
                  modelo={{
                    ...previewModelo,
                    bloques,
                    escaleras: escPorBloque[0] || 1,
                    plantas: plantasPorBloque[0] || 4,
                    viviendas: vivPorBloque[0] || 4,
                    estructura: bloques > 1 || (escPorBloque[0] || 1) > 1 ? "multiple" : "simple",
                  }}
                  onEdit={(s) => {
                    /* Map del SubStep V2 (0-3) al substep V4 equivalente. */
                    if (s === 0 || s === 1 || s === 2) {
                      setSubstep("config");
                      setCurrentBloque(0);
                    } else {
                      setSubstep("pb");
                    }
                  }}
                  onContinue={onContinueOuter}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between gap-4 pt-3 border-t border-border/40">
          <button
            type="button"
            onClick={handlePrev}
            disabled={!showPrev}
            className={cn(
              "inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[13px] font-medium transition-colors",
              "disabled:opacity-30 disabled:cursor-not-allowed",
              "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
            Atrás
          </button>

          {/* Indicador de bloque actual cuando estamos en config multi */}
          {substep === "config" && bloques > 1 && (
            <div className="flex items-center gap-1.5">
              {Array.from({ length: bloques }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCurrentBloque(i)}
                  aria-label={`Ir a Bloque ${i + 1}`}
                  className={cn(
                    "h-2 rounded-full transition-all",
                    i === currentBloque ? "w-7 bg-foreground" : "w-2 bg-foreground/20 hover:bg-foreground/40",
                  )}
                />
              ))}
            </div>
          )}

          {showNext ? (
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-foreground text-background text-[13px] font-medium hover:bg-foreground/90 transition-colors shadow-soft"
            >
              {substep === "config" && bloques > 1 && currentBloque < bloques - 1
                ? `Siguiente bloque`
                : "Siguiente"}
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          ) : (
            <span className="w-[88px]" />
          )}
        </div>
      </div>

      <aside className="lg:sticky lg:top-4 self-start w-full h-full">
        <PreviewPane modelo={previewModelo} />
      </aside>
    </div>
  );
}
