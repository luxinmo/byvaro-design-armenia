/**
 * EstadoStep · Paso 6/14 del wizard "Crear Promoción".
 *
 * Selecciona el estado de obra (proyecto / en construcción / terminado)
 * y los campos cascada según el estado:
 *   · proyecto       → ¿tiene licencia? + tipo de entrega + meses
 *   · en_construccion → fase de construcción + trimestre estimado de entrega
 *   · terminado      → fecha de terminación
 *
 * Reusable · se usa en:
 *   · `CrearPromocion.tsx` paso 6/14 (wizard).
 *   · `EditStepModal` step "estado" (popup desde la ficha · bloque
 *     Estructura). Misma UI, mismas validaciones, misma cascada de
 *     limpieza al cambiar de estado.
 */

import { cn } from "@/lib/utils";
import { Calendar as CalendarIcon, FileCheck, FileX } from "lucide-react";
import type {
  WizardState, EstadoPromocion, FaseConstruccion, TipoEntrega,
} from "./types";
import { OptionCard } from "./SharedWidgets";
import { estadoOptions, faseConstruccionOptions } from "./options";
import { futureTrimesterOptions } from "@/lib/futureTrimesters";

interface Props {
  state: WizardState;
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2">
      {children}
    </p>
  );
}

function LicenciaCard({
  icon: Icon, title, desc, selected, onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string; desc: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 rounded-xl border px-4 py-3 transition-colors text-left",
        selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30",
      )}
    >
      <div className={cn(
        "flex h-9 w-9 items-center justify-center rounded-xl shrink-0",
        selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </button>
  );
}

export function EstadoStep({ state, update }: Props) {
  const trimestreOptions = futureTrimesterOptions();

  const handleEstadoSelect = (v: string) => {
    const estado = v as EstadoPromocion;
    /* Cascada · al cambiar de estado limpiamos los campos que solo
     *  aplican al anterior · evita state inconsistente (licencia=true
     *  con estado=en_construccion, etc.). update() es síncrono+síncrono
     *  vía getOverride en cascada · ver PromocionDetalle. */
    update("estado", estado);
    if (estado !== "proyecto") update("tieneLicencia", null);
    if (estado !== "en_construccion") update("faseConstruccion", null);
    if (estado === "terminado") {
      update("fechaEntrega", null);
      update("trimestreEntrega", null);
    }
    if (estado !== "terminado") update("fechaTerminacion", null);
  };

  const handleFaseSelect = (v: string) => {
    const fase = v as FaseConstruccion;
    update("faseConstruccion", fase);
  };

  const canShowTipoEntrega = state.estado === "proyecto"
    || state.estado === "en_construccion";
  const canShowTrasLicencia = state.estado === "proyecto" && state.tieneLicencia === false;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {estadoOptions.map((o) => (
          <OptionCard
            key={o.value}
            option={o}
            selected={state.estado === o.value}
            onSelect={handleEstadoSelect}
          />
        ))}
      </div>

      {/* Licencia (solo para proyecto) */}
      {state.estado === "proyecto" && (
        <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
          <SectionLabel>¿Tiene licencia de obra?</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <LicenciaCard icon={FileCheck} title="Con licencia" desc="Licencia concedida"
              selected={state.tieneLicencia === true} onClick={() => update("tieneLicencia", true)} />
            <LicenciaCard icon={FileX} title="Sin licencia" desc="Pendiente de licencia"
              selected={state.tieneLicencia === false} onClick={() => update("tieneLicencia", false)} />
          </div>
        </div>
      )}

      {/* Fase de construcción (cuando en_construccion) */}
      {state.estado === "en_construccion" && (
        <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
          <SectionLabel>Etapa de construcción</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {faseConstruccionOptions.map((o) => (
              <OptionCard key={o.value} option={o}
                selected={state.faseConstruccion === o.value}
                onSelect={handleFaseSelect}
              />
            ))}
          </div>
        </div>
      )}

      {/* Fecha estimada de entrega · disponible para CUALQUIER fase
       *  cuando estado = proyecto o en_construccion. Antes solo
       *  aparecía en "entrega_proxima" · el user puede estimar
       *  desde el inicio de obra. Trimestres acotados a futuros
       *  (próximos 4 años · sin pasados del año actual). */}
      {canShowTipoEntrega && (
        <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
          <SectionLabel>Tipo de entrega</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => update("tipoEntrega", "fecha_definida")}
              className={cn(
                "text-left rounded-lg border px-3 py-2.5 transition-colors",
                state.tipoEntrega === "fecha_definida"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/30",
              )}
            >
              <p className="text-[12px] font-semibold text-foreground">Fecha definida</p>
              <p className="text-[10.5px] text-muted-foreground">Trimestre concreto</p>
            </button>
            <button
              type="button"
              onClick={() => update("tipoEntrega", "tras_contrato_cv")}
              className={cn(
                "text-left rounded-lg border px-3 py-2.5 transition-colors",
                state.tipoEntrega === "tras_contrato_cv"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/30",
              )}
            >
              <p className="text-[12px] font-semibold text-foreground">Tras contrato C/V</p>
              <p className="text-[10.5px] text-muted-foreground">X meses después</p>
            </button>
            {canShowTrasLicencia && (
              <button
                type="button"
                onClick={() => update("tipoEntrega", "tras_licencia" as TipoEntrega)}
                className={cn(
                  "text-left rounded-lg border px-3 py-2.5 transition-colors",
                  state.tipoEntrega === "tras_licencia"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/30",
                )}
              >
                <p className="text-[12px] font-semibold text-foreground">Tras licencia</p>
                <p className="text-[10.5px] text-muted-foreground">X meses después</p>
              </button>
            )}
          </div>

          {state.tipoEntrega === "fecha_definida" && (
            <div className="pt-2">
              <SectionLabel>Trimestre estimado</SectionLabel>
              <div className="grid grid-cols-4 gap-2">
                {trimestreOptions.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => update("trimestreEntrega", t)}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-xs font-medium transition-colors tnum",
                      state.trimestreEntrega === t
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground hover:border-foreground/20 hover:text-foreground",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {state.tipoEntrega === "tras_contrato_cv" && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                inputMode="numeric"
                value={state.mesesTrasContrato > 0 ? String(state.mesesTrasContrato) : ""}
                placeholder="0"
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^0-9]/g, "");
                  update("mesesTrasContrato", digits === "" ? 0 : Math.min(120, Number(digits)));
                }}
                className="rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors h-9 w-24 px-2.5 text-[13px] tnum text-right"
              />
              <span className="text-[12px] text-muted-foreground">meses tras la firma del contrato</span>
            </div>
          )}

          {state.tipoEntrega === "tras_licencia" && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                inputMode="numeric"
                value={state.mesesTrasLicencia > 0 ? String(state.mesesTrasLicencia) : ""}
                placeholder="0"
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^0-9]/g, "");
                  update("mesesTrasLicencia", digits === "" ? 0 : Math.min(120, Number(digits)));
                }}
                className="rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors h-9 w-24 px-2.5 text-[13px] tnum text-right"
              />
              <span className="text-[12px] text-muted-foreground">meses tras obtener la licencia</span>
            </div>
          )}
        </div>
      )}

      {/* Fecha de terminación (cuando terminado) */}
      {state.estado === "terminado" && (
        <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <CalendarIcon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Fecha de terminación</p>
              <p className="text-xs text-muted-foreground">¿Cuándo se terminó la obra?</p>
            </div>
          </div>
          <input
            type="date"
            max={new Date().toISOString().split("T")[0]}
            value={state.fechaTerminacion ? state.fechaTerminacion.split("T")[0] : ""}
            onChange={(e) => update("fechaTerminacion", e.target.value ? new Date(e.target.value).toISOString() : null)}
            className="h-9 px-3 text-sm bg-card border border-border rounded-xl focus:border-primary outline-none transition-colors tnum"
          />
          <p className="text-[11px] text-muted-foreground">La fecha no puede ser posterior a hoy.</p>
        </div>
      )}
    </div>
  );
}
