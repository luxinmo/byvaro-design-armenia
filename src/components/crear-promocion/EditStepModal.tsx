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
import type { StepId, WizardState, RoleOption, TipoPromocion, SubUni, SubVarias } from "./types";
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

/* ─── TipologiaQuickEdit · vista compacta de los 4 inline steps
 *  (role / tipo / subUni / subVarias) en una sola pantalla ·
 *  pensada para edición rápida desde el modal de Revisión sin
 *  navegar el wizard. */
function TipologiaQuickEdit({
  state, update,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
}) {
  const isUnifamiliar = state.tipo === "unifamiliar";
  const isVarias = isUnifamiliar && state.subUni === "varias";
  return (
    <div className="flex flex-col gap-5">
      {/* Rol */}
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

      {/* Tipo */}
      <section>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">Tipo de promoción</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {tipoOptions.map((o) => (
            <OptionCard
              key={o.value}
              option={o}
              selected={state.tipo === o.value}
              onSelect={(v) => {
                /* Al cambiar tipo, reseteamos sub-selecciones que ya no
                 * aplican · evita estado inconsistente. */
                update("tipo", v as TipoPromocion);
                if (v !== "unifamiliar") {
                  update("subUni", null);
                  update("subVarias", null);
                }
              }}
            />
          ))}
        </div>
      </section>

      {/* SubUni · solo unifamiliar */}
      {isUnifamiliar && (
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">Cantidad</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {subUniOptions.map((o) => (
              <OptionCard
                key={o.value}
                option={o}
                selected={state.subUni === o.value}
                onSelect={(v) => {
                  update("subUni", v as SubUni);
                  update("subVarias", null);
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* SubVarias · unifamiliar una sola */}
      {isUnifamiliar && state.subUni === "una_sola" && (
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">Tipología</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {subVariasOptions.map((o) => (
              <OptionCard
                key={o.value}
                option={o}
                selected={state.subVarias === o.value}
                onSelect={(v) => update("subVarias", v as SubVarias)}
              />
            ))}
          </div>
        </section>
      )}

      {/* SubVarias · unifamiliar varias · solo info read-only · la
          gestión completa de tipologías + cantidades sigue en el
          step "sub_varias" (con multi-select y contadores). */}
      {isVarias && (
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">Tipologías seleccionadas</p>
          {state.tipologiasSeleccionadas.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {state.tipologiasSeleccionadas.map((t) => (
                <span key={t.tipo} className="inline-flex items-center gap-1 rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-[11px] font-medium text-primary">
                  {subVariasOptions.find((o) => o.value === t.tipo)?.label} × {t.cantidad}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-muted-foreground italic">
              Aún no has seleccionado tipologías. Vuelve al wizard para configurarlas.
            </p>
          )}
          <p className="text-[11px] text-muted-foreground mt-3 leading-relaxed">
            Para cambiar las tipologías y cantidades, sal y entra al step <span className="font-medium text-foreground">"Tipología y estilo"</span> del wizard · ahí tienes los multi-selectores con contadores.
          </p>
        </section>
      )}
    </div>
  );
}
