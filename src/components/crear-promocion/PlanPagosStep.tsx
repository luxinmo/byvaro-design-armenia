/**
 * PlanPagosStep · Paso "Plan de pagos" del wizard Crear Promoción.
 *
 * Tres métodos posibles, seleccionables como OptionCard:
 *   1. "contrato"        → Las condiciones se definirán en el contrato.
 *                         Muestra solo un bloque informativo.
 *   2. "manual"          → El promotor define hitos libres con % y
 *                         descripción (reserva, firma, construcción,
 *                         escritura…). Suma debe cerrar en 100%.
 *   3. "certificaciones" → Los pagos se vinculan a fases de obra
 *                         (cimentación, estructura, acabados…) o hitos
 *                         contractuales (contrato CV / escritura).
 *
 * Independiente del método, al final se pregunta si la compra requiere
 * contrato de reserva. Si sí, importe € + validez en días.
 *
 * Port adaptado de figgy-friend-forge/src/components/create-promotion/
 * StepPlanPagos.tsx — sin shadcn, usando primitivas nativas con tokens
 * del sistema Byvaro + OptionCard de SharedWidgets.
 */

import {
  Plus, Trash2, Info, FileText, ListChecks, HardHat, ShieldCheck, ShieldOff, Landmark,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { OptionCard } from "./SharedWidgets";
import type { WizardState, MetodoPago, HitoPago, HitoCertificacion } from "./types";

/* ─── Opciones ─────────────────────────────────────────────────────── */
const fasesObraOptions = [
  "Movimiento de tierras / Excavación",
  "Cimentación",
  "Estructura",
  "Albañilería / Cerramientos exteriores",
  "Cubierta / Tejado",
  "Carpintería exterior / Ventanas",
  "Instalaciones básicas (electricidad, fontanería, climatización)",
  "Tabiquería interior",
  "Acabados interiores",
  "Solados y alicatados",
  "Carpintería interior",
  "Pintura interior",
  "Aparatos sanitarios / Grifería",
  "Ascensores / Instalaciones comunes",
  "Zonas comunes / Urbanización",
  "Fin de obra (certificado final)",
  "Licencia de primera ocupación",
  "Entrega de llaves / Cierre del proyecto",
];

const fasesHitosOptions = ["Contrato CV", "Escritura Pública"];

const metodoPagoOptions = [
  {
    value: "contrato" as MetodoPago,
    label: "Definido en contrato",
    description: "Las condiciones de pago se definirán en el contrato de reserva o compraventa",
    icon: FileText,
  },
  {
    value: "manual" as MetodoPago,
    label: "Plan de pagos manual",
    description: "Define los hitos de pago y porcentajes manualmente",
    icon: ListChecks,
  },
  {
    value: "certificaciones" as MetodoPago,
    label: "Por certificación o hitos",
    description: "Los pagos se vinculan a fases de construcción o hitos contractuales",
    icon: HardHat,
  },
];

/* Opciones canónicas de validez del contrato de reserva · ventanas
 * cortas reales del mercado · pasado este plazo el comprador firma
 * CPV o pierde la señal. Si necesitas otro valor, cámbialo aquí (es
 * la única fuente). */
const validezReservaOptions = [7, 14, 30, 60];

/* ─── Estilos compartidos ──────────────────────────────────────────── */
const inputBase =
  "rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors";
const selectBase =
  "appearance-none rounded-lg border border-border bg-card text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors bg-[url('data:image/svg+xml;utf8,<svg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2020%2020%22%20fill=%22%239ca3af%22><path%20d=%22M5.23%207.21a.75.75%200%200%201%201.06.02L10%2011.06l3.71-3.83a.75.75%200%201%201%201.08%201.04l-4.25%204.39a.75.75%200%200%201-1.08%200L5.21%208.27a.75.75%200%200%201%20.02-1.06z%22/></svg>')] bg-[length:16px_16px] bg-[right_8px_center] bg-no-repeat pr-8";

export function PlanPagosStep({
  state,
  update,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
}) {
  /* ── Hitos manuales ── */
  const addHitoPago = () => {
    update("hitosPago", [...state.hitosPago, { porcentaje: 0, descripcion: "" }]);
  };
  const removeHitoPago = (idx: number) => {
    update("hitosPago", state.hitosPago.filter((_, i) => i !== idx));
  };
  const updateHitoPago = (idx: number, field: keyof HitoPago, value: string | number) => {
    const next = [...state.hitosPago];
    next[idx] = { ...next[idx], [field]: value };
    update("hitosPago", next);
  };

  /* ── Hitos certificación ── */
  const addHitoCert = () => {
    update("hitosCertificacion", [...state.hitosCertificacion, { porcentaje: 0, fase: "" }]);
  };
  const removeHitoCert = (idx: number) => {
    update("hitosCertificacion", state.hitosCertificacion.filter((_, i) => i !== idx));
  };
  const updateHitoCert = (idx: number, field: keyof HitoCertificacion, value: string | number) => {
    const next = [...state.hitosCertificacion];
    next[idx] = { ...next[idx], [field]: value };
    update("hitosCertificacion", next);
  };

  const totalManual = state.hitosPago.reduce((s, h) => s + h.porcentaje, 0);
  const totalCert = state.hitosCertificacion.reduce((s, h) => s + h.porcentaje, 0);

  return (
    <div className="flex flex-col gap-4">
      {/* ═════ Método de pago ═════ */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {metodoPagoOptions.map((o) => (
          <OptionCard
            key={o.value}
            option={o}
            selected={state.metodoPago === o.value}
            onSelect={(v) => update("metodoPago", v as MetodoPago)}
          />
        ))}
      </div>

      {/* ═════ Plan manual ═════ */}
      {state.metodoPago === "manual" && (
        <div className="rounded-xl border border-border bg-card px-4 py-3 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Hitos de pago
            </p>
            <span
              className={cn(
                "text-xs font-semibold tnum",
                totalManual > 100
                  ? "text-destructive"
                  : totalManual === 100
                    ? "text-primary"
                    : "text-muted-foreground",
              )}
            >
              {totalManual}% / 100%
            </span>
          </div>

          {state.hitosPago.length > 0 && (
            <div className="flex items-center gap-2 px-1">
              <span className="w-20 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                %
              </span>
              <span className="flex-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Descripción
              </span>
              <div className="w-7" />
            </div>
          )}

          {state.hitosPago.map((hito, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className="relative w-20">
                <input
                  type="number"
                  value={hito.porcentaje}
                  onChange={(e) =>
                    updateHitoPago(
                      idx,
                      "porcentaje",
                      Math.max(0, Math.min(100, Number(e.target.value))),
                    )
                  }
                  min={0}
                  max={100}
                  className={cn(inputBase, "h-8 w-full text-xs text-center pr-6 tnum")}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  %
                </span>
              </div>
              <input
                type="text"
                value={hito.descripcion}
                onChange={(e) => updateHitoPago(idx, "descripcion", e.target.value)}
                placeholder="Ej: Reserva, Firma contrato privado…"
                className={cn(inputBase, "h-8 flex-1 text-xs px-3")}
              />
              <button
                type="button"
                onClick={() => removeHitoPago(idx)}
                aria-label="Eliminar hito"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors"
              >
                <Trash2 className="h-3 w-3" strokeWidth={1.5} />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={addHitoPago}
            disabled={totalManual >= 100}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Plus className="h-3 w-3" strokeWidth={1.5} />
            Añadir hito
          </button>

          {state.hitosPago.length === 0 && (
            <div className="rounded-lg bg-muted/40 border border-border px-3 py-2 flex gap-2 text-xs text-muted-foreground leading-relaxed">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" strokeWidth={1.5} />
              Ejemplo: 5% Reserva · 25% Firma contrato · 30% Durante construcción · 40% Escritura pública
            </div>
          )}
        </div>
      )}

      {/* ═════ Certificaciones ═════ */}
      {state.metodoPago === "certificaciones" && (
        <div className="rounded-xl border border-border bg-card px-4 py-3 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Certificaciones de obra
            </p>
            <span
              className={cn(
                "text-xs font-semibold tnum",
                totalCert > 100
                  ? "text-destructive"
                  : totalCert === 100
                    ? "text-primary"
                    : "text-muted-foreground",
              )}
            >
              {totalCert}% / 100%
            </span>
          </div>

          {state.hitosCertificacion.length > 0 && (
            <div className="flex items-center gap-2 px-1">
              <span className="w-20 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                %
              </span>
              <span className="flex-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Fase de obra
              </span>
              <div className="w-7" />
            </div>
          )}

          {state.hitosCertificacion.map((hito, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className="relative w-20">
                <input
                  type="number"
                  value={hito.porcentaje}
                  onChange={(e) =>
                    updateHitoCert(
                      idx,
                      "porcentaje",
                      Math.max(0, Math.min(100, Number(e.target.value))),
                    )
                  }
                  min={0}
                  max={100}
                  className={cn(inputBase, "h-8 w-full text-xs text-center pr-6 tnum")}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  %
                </span>
              </div>
              <select
                value={hito.fase}
                onChange={(e) => updateHitoCert(idx, "fase", e.target.value)}
                className={cn(selectBase, "h-8 flex-1 text-xs px-3")}
              >
                <option value="" disabled>
                  Seleccionar fase…
                </option>
                <optgroup label="Fases de obra">
                  {fasesObraOptions.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Hitos contractuales">
                  {fasesHitosOptions.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </optgroup>
              </select>
              <button
                type="button"
                onClick={() => removeHitoCert(idx)}
                aria-label="Eliminar certificación"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors"
              >
                <Trash2 className="h-3 w-3" strokeWidth={1.5} />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={addHitoCert}
            disabled={totalCert >= 100}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Plus className="h-3 w-3" strokeWidth={1.5} />
            Añadir hito
          </button>
        </div>
      )}

      {/* ═════ Contrato (modo informativo) ═════ */}
      {state.metodoPago === "contrato" && (
        <div className="rounded-xl border border-border bg-card px-4 py-3">
          <div className="rounded-lg bg-muted/40 border border-border px-3 py-2.5 flex gap-2 text-xs text-muted-foreground leading-relaxed">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" strokeWidth={1.5} />
            Las condiciones de pago se definirán en el contrato de reserva o compraventa privado. No es necesario configurar hitos adicionales en este paso.
          </div>
        </div>
      )}

      {/* ═════ Reserva ═════ */}
      <div className="rounded-xl border border-border bg-card px-4 py-3 flex flex-col gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Reserva
        </p>
        <p className="text-sm font-medium text-foreground">¿La compra requiere contrato de reserva?</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => update("requiereReserva", true)}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border px-4 py-3 text-left transition-colors",
              state.requiereReserva === true
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/30",
            )}
          >
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
                state.requiereReserva === true
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <ShieldCheck className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Con reserva</p>
              <p className="text-xs text-muted-foreground">Se requiere contrato de reserva</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => update("requiereReserva", false)}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border px-4 py-3 text-left transition-colors",
              state.requiereReserva === false
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/30",
            )}
          >
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
                state.requiereReserva === false
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <ShieldOff className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Sin reserva</p>
              <p className="text-xs text-muted-foreground">Sin contrato de reserva previo</p>
            </div>
          </button>
        </div>

        {state.requiereReserva === true && (
          <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-border">
            <div className="flex flex-col gap-1.5 flex-1 sm:max-w-[200px]">
              <label className="text-xs font-medium text-muted-foreground">Importe de reserva</label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={Number(state.importeReserva || 0).toLocaleString("es-ES")}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^0-9]/g, "");
                    update("importeReserva", digits === "" ? 0 : Number(digits));
                  }}
                  placeholder="5.000"
                  className={cn(inputBase, "h-9 w-full text-sm px-3 pr-8 tnum")}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                  €
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 flex-1 sm:max-w-[200px]">
              <label className="text-xs font-medium text-muted-foreground">
                Validez del contrato de reserva
              </label>
              <select
                value={String(state.validezReserva)}
                onChange={(e) => update("validezReserva", Number(e.target.value))}
                className={cn(selectBase, "h-9 w-full text-sm px-3")}
              >
                {validezReservaOptions.map((d) => (
                  <option key={d} value={d}>
                    {d} días
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Aval bancario ═══ Ley 38/1999 · garantía sobre cantidades
           anticipadas por el comprador. El promotor puede declararlo
           para mostrarlo en la ficha pública y en el PDF. */}
      <div className="rounded-2xl bg-card border border-border p-5 shadow-soft">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
            <Landmark className="h-3.5 w-3.5" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-[13.5px] font-semibold text-foreground leading-tight">Aval bancario</p>
            <p className="text-[11.5px] text-muted-foreground">
              Garantía sobre cantidades anticipadas (Ley 38/1999)
            </p>
          </div>
        </div>

        {/* `selected = true|false|null` · null = ninguna opción
         *  marcada (estado inicial · obliga al user a elegir). Antes
         *  era `boolean` con default false → "Sin aval" salía
         *  preseleccionado · publicabas sin querer. */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => update("avalBancario", true)}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl border transition-colors text-left",
              state.avalBancario === true
                ? "border-primary/40 bg-primary/5"
                : "border-border hover:border-foreground/30"
            )}
          >
            <div className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
              state.avalBancario === true ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}>
              <ShieldCheck className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Sí, con aval</p>
              <p className="text-xs text-muted-foreground">Aval individual entregado al firmar</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => update("avalBancario", false)}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl border transition-colors text-left",
              state.avalBancario === false
                ? "border-primary/40 bg-primary/5"
                : "border-border hover:border-foreground/30"
            )}
          >
            <div className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
              state.avalBancario === false ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
            )}>
              <ShieldOff className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Sin aval</p>
              <p className="text-xs text-muted-foreground">Garantía no constituida</p>
            </div>
          </button>
        </div>

        {state.avalBancario === true && (
          <div className="flex flex-col gap-1.5 pt-3 mt-3 border-t border-border">
            <label className="text-xs font-medium text-muted-foreground">Entidad emisora (opcional)</label>
            <input
              type="text"
              value={state.avalEntidad}
              onChange={(e) => update("avalEntidad", e.target.value)}
              placeholder="Ej. Banco Santander, CaixaBank, BBVA…"
              className={cn(inputBase, "h-9 w-full text-sm px-3")}
            />
          </div>
        )}
      </div>
    </div>
  );
}
