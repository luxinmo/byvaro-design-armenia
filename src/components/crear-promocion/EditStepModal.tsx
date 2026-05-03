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
import type { StepId, WizardState, RoleOption } from "./types";
import { ExtrasV5 } from "./extras-v5";
import { DetallesStep } from "./DetallesStep";
import { InfoBasicaStep } from "./InfoBasicaStep";
import { DescripcionStep } from "./DescripcionStep";
import { MultimediaStep } from "./MultimediaStep";
import { CrearUnidadesStep } from "./CrearUnidadesStep";
import { ColaboradoresStep } from "./ColaboradoresStep";
import { PlanPagosStep } from "./PlanPagosStep";
import { OptionCard } from "./SharedWidgets";
import { roleOptions, tipoOptions, subUniOptions, subVariasOptions } from "./options";

const STEP_TITLES: Partial<Record<StepId, string>> = {
  tipo: "Tipología",
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
 * cae al onFallbackNavigate. "tipo" englobamos los 4 inline
 * (role/tipo/subUni/subVarias) en una sola vista compacta. */
const SUPPORTED: StepId[] = [
  "tipo", "extras", "detalles", "info_basica", "descripcion", "multimedia",
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
    step === "tipo" ? "max-w-2xl" :
    "max-w-3xl";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className={`${widthClass} max-h-[90vh] overflow-y-auto p-0`}>
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/40 sticky top-0 bg-background z-10">
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
        </DialogHeader>

        <div className="px-5 py-4">
          {step === "tipo" && <TipologiaQuickEdit state={state} update={update} />}
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

/* ─── TipologiaQuickEdit · solo permite cambiar ROL desde aquí.
 *
 *  El resto (tipo · cantidad · tipología) se muestra como read-only
 *  con un hint indicando dónde cambiarlo. Razón · cambiar de
 *  plurifamiliar a unifamiliar (o al revés) es destructivo · regenera
 *  unidades, resetea estructura del edificio, invalida configuración.
 *  Mejor obligar a entrar al wizard donde el cambio es explícito. */
function TipologiaQuickEdit({
  state, update,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
}) {
  const isUnifamiliar = state.tipo === "unifamiliar";
  const tipoLabel = tipoOptions.find((o) => o.value === state.tipo)?.label ?? "—";
  const subUniLabel = subUniOptions.find((o) => o.value === state.subUni)?.label ?? null;
  const subVariasLabel = subVariasOptions.find((o) => o.value === state.subVarias)?.label ?? null;

  return (
    <div className="flex flex-col gap-5">
      {/* Rol · ÚNICO editable aquí */}
      <section>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">Rol</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {roleOptions.map((o) => (
            <OptionCard
              key={o.value}
              option={o}
              selected={state.role === o.value}
              onSelect={(v) => update("role", v as RoleOption)}
            />
          ))}
        </div>
      </section>

      {/* Resto · read-only + hint */}
      <section className="rounded-2xl border border-border bg-muted/20 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">
          Estructura de la promoción
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <ReadOnlyRow label="Tipo" value={tipoLabel} />
          {isUnifamiliar && subUniLabel && <ReadOnlyRow label="Cantidad" value={subUniLabel} />}
          {isUnifamiliar && state.subUni === "una_sola" && subVariasLabel && (
            <ReadOnlyRow label="Tipología" value={subVariasLabel} />
          )}
          {isUnifamiliar && state.subUni === "varias" && state.tipologiasSeleccionadas.length > 0 && (
            <ReadOnlyRow
              label="Tipologías"
              value={
                <div className="flex flex-wrap gap-1.5">
                  {state.tipologiasSeleccionadas.map((t) => (
                    <span key={t.tipo} className="inline-flex items-center gap-1 rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-[11px] font-medium text-primary">
                      {subVariasOptions.find((o) => o.value === t.tipo)?.label} × {t.cantidad}
                    </span>
                  ))}
                </div>
              }
            />
          )}
        </div>
        <div className="rounded-lg bg-warning/10 border border-warning/30 px-3 py-2 text-[12px] text-foreground leading-relaxed">
          <span className="font-medium">No puedes cambiarlo desde aquí.</span>{" "}
          Cambiar el tipo de promoción regenera todas las unidades y resetea
          la estructura. Si lo necesitas, sal del modal y entra al paso{" "}
          <span className="font-medium">"Tipo de promoción"</span> del wizard
          desde el sidebar lateral.
        </div>
      </section>
    </div>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-[12.5px]">
      <span className="text-muted-foreground min-w-[100px] shrink-0">{label}</span>
      <span className="text-foreground flex-1 min-w-0">{value}</span>
    </div>
  );
}
