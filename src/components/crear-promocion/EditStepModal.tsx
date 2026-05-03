/**
 * EditStepModal · modal genérico para editar un paso desde la
 * pantalla de Revisión (14/14) sin obligar al user a navegar de vuelta
 * por todo el flujo del wizard.
 *
 * Soporta los pasos cuyo contenido vive en componentes propios
 * (extras-v5, detalles, info-básica, descripción, multimedia, crear
 * unidades, colaboradores, plan-pagos). Los pasos "inline" del
 * wizard (role/tipo/sub_uni/sub_varias/estado) caen al fallback
 * `onFallbackNavigate` que el caller usa para navegar al step
 * correspondiente · son pasos cortos donde abrir un modal aporta
 * poco vs entrar y salir.
 *
 * Los cambios se persisten en `state` mediante `update` (mismo
 * contrato que los steps inline · cero plumbing extra). El user
 * cierra con "Hecho" y vuelve directo a la pantalla de revisión.
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { StepId, WizardState } from "./types";
import { ExtrasV5 } from "./extras-v5";
import { DetallesStep } from "./DetallesStep";
import { InfoBasicaStep } from "./InfoBasicaStep";
import { DescripcionStep } from "./DescripcionStep";
import { MultimediaStep } from "./MultimediaStep";
import { CrearUnidadesStep } from "./CrearUnidadesStep";
import { ColaboradoresStep } from "./ColaboradoresStep";
import { PlanPagosStep } from "./PlanPagosStep";

const STEP_TITLES: Partial<Record<StepId, string>> = {
  extras: "Características por defecto",
  detalles: "Detalles finales",
  info_basica: "Información básica",
  descripcion: "Descripción",
  multimedia: "Multimedia",
  crear_unidades: "Unidades",
  colaboradores: "Colaboradores",
  plan_pagos: "Plan de pagos",
};

/* Steps que se pueden editar en modal · si llega otro, el caller
 * cae al onFallbackNavigate. */
const SUPPORTED: StepId[] = [
  "extras", "detalles", "info_basica", "descripcion", "multimedia",
  "crear_unidades", "colaboradores", "plan_pagos",
];

export function isSupportedInModal(step: StepId): boolean {
  return SUPPORTED.includes(step);
}

export function EditStepModal({
  open,
  step,
  state,
  update,
  uploadScopeId,
  onClose,
}: {
  open: boolean;
  step: StepId | null;
  state: WizardState;
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  uploadScopeId?: string;
  onClose: () => void;
}) {
  if (!step) return null;

  const title = STEP_TITLES[step] ?? "Editar";

  /* Steps con tabla ancha (unidades) necesitan más espacio · sin
   * esto la tabla overflowea horizontalmente y el user tiene que
   * hacer scroll lateral · feo. El resto cabe bien en max-w-3xl. */
  const widthClass =
    step === "crear_unidades" ? "max-w-[min(1280px,95vw)]" :
    step === "multimedia" ? "max-w-4xl" :
    step === "extras" ? "max-w-2xl" :
    "max-w-3xl";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className={`${widthClass} max-h-[90vh] overflow-y-auto p-0`}>
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/40 sticky top-0 bg-background z-10">
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
        </DialogHeader>

        <div className="px-5 py-4">
          {step === "extras" && <ExtrasV5 state={state} update={update} />}
          {step === "detalles" && (
            <DetallesStep
              state={state}
              update={update}
              trimestreOptions={(() => {
                const y = new Date().getFullYear();
                return [
                  `T1 ${y}`, `T2 ${y}`, `T3 ${y}`, `T4 ${y}`,
                  `T1 ${y + 1}`, `T2 ${y + 1}`, `T3 ${y + 1}`, `T4 ${y + 1}`,
                  `T1 ${y + 2}`, `T2 ${y + 2}`, `T3 ${y + 2}`, `T4 ${y + 2}`,
                ];
              })()}
            />
          )}
          {step === "info_basica" && (
            <InfoBasicaStep state={state} update={update} defaultsCapturedInExtras />
          )}
          {step === "descripcion" && <DescripcionStep state={state} update={update} />}
          {step === "multimedia" && (
            <MultimediaStep state={state} update={update} uploadScopeId={uploadScopeId} />
          )}
          {step === "crear_unidades" && (
            <CrearUnidadesStep state={state} update={update} uploadScopeId={uploadScopeId} />
          )}
          {step === "colaboradores" && <ColaboradoresStep state={state} update={update} />}
          {step === "plan_pagos" && <PlanPagosStep state={state} update={update} />}
        </div>

        <DialogFooter className="px-5 py-3 border-t border-border/40 bg-background sticky bottom-0">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center h-10 px-5 rounded-full bg-foreground text-background text-[13px] font-medium hover:bg-foreground/90 transition-colors shadow-soft w-full sm:w-auto"
          >
            Hecho
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
