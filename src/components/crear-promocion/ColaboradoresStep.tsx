/**
 * ColaboradoresStep · Paso "Colaboradores" del wizard Crear Promoción.
 *
 * 5 cards apiladas:
 *   1. Estructura de comisiones (con toggle nacional/internacional).
 *   2. Preferencias de agencias (permitir rechazar nacionales) — solo
 *      si el toggle anterior está ON.
 *   3. Clasificación del cliente nacional (residencia/fiscal/manual).
 *   4. Condiciones de registro + validez en días.
 *   5. Forma de pago de comisiones (proporcional/escritura/personalizado).
 *      En modo personalizado: hitos con % cliente + % colaborador.
 *
 * Acaba con un preview block que resume los % activos.
 *
 * Port adaptado de figgy-friend-forge/src/components/create-promotion/
 * StepColaboradores.tsx — usando Switch + Checkbox de Byvaro, OptionCard
 * de SharedWidgets y tokens HSL.
 */

import {
  Globe, Home, Handshake, Info, Users, Shield, ClipboardList, Clock,
  Plus, Trash2, AlertTriangle, Handshake as HandshakeIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/Switch";
import { Checkbox } from "@/components/ui/Checkbox";
import { OptionCard } from "./SharedWidgets";
import { formaPagoComisionOptions } from "./options";
import type {
  WizardState, ClasificacionCliente, FormaPagoComision, CondicionRegistro,
} from "./types";

const inputBase =
  "rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors";

const condicionesOptions: { value: CondicionRegistro; label: string; required: boolean }[] = [
  { value: "nombre_completo", label: "Nombre completo", required: true },
  { value: "ultimas_4_cifras", label: "4 últimas cifras del teléfono", required: true },
  { value: "nacionalidad", label: "Nacionalidad", required: true },
  { value: "email_completo", label: "Email completo", required: false },
];

const clasificacionOpts: { value: ClasificacionCliente; label: string; recommended?: boolean }[] = [
  { value: "residencia", label: "País de residencia coincide con la promoción", recommended: true },
  { value: "fiscal", label: "Residencia fiscal en el mismo país" },
  { value: "manual", label: "Clasificación manual" },
];

export function ColaboradoresStep({
  state,
  update,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
}) {
  const addHito = () =>
    update("hitosComision", [...state.hitosComision, { pagoCliente: 0, pagoColaborador: 0 }]);
  const removeHito = (idx: number) =>
    update("hitosComision", state.hitosComision.filter((_, i) => i !== idx));

  const toggleCondicion = (v: CondicionRegistro) => {
    const required = condicionesOptions.find((c) => c.value === v)?.required;
    if (required) return;
    const cur = state.condicionesRegistro;
    update(
      "condicionesRegistro",
      cur.includes(v) ? cur.filter((c) => c !== v) : [...cur, v],
    );
  };

  const totalCliente = state.hitosComision.reduce((s, h) => s + h.pagoCliente, 0);
  const totalColab = state.hitosComision.reduce((s, h) => s + h.pagoColaborador, 0);

  return (
    <div className="flex flex-col gap-5">
      {/* ─── Header info ─── */}
      <div className="rounded-lg bg-muted/30 border border-border px-3 py-2.5 flex gap-2 text-xs text-muted-foreground leading-relaxed">
        <Handshake className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" strokeWidth={1.5} />
        <span>Define cómo se compensará a las agencias colaboradoras según el origen del comprador.</span>
      </div>

      {/* ═════ CARD 1 · Estructura de comisiones ═════ */}
      <div className="rounded-xl border border-border bg-card px-5 py-4 flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
            <Globe className="h-4 w-4" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Estructura de comisiones</p>
            <p className="text-xs text-muted-foreground">Porcentaje que percibe la agencia colaboradora</p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground">¿Hay diferencias entre clientes nacionales e internacionales?</p>
            <p className="text-[10px] text-muted-foreground">Permite configurar comisiones distintas según origen</p>
          </div>
          <Switch
            checked={state.diferenciarNacionalInternacional}
            onCheckedChange={(checked) => {
              update("diferenciarNacionalInternacional", checked);
              if (!checked) {
                update("diferenciarComisiones", false);
                update("agenciasRefusarNacional", false);
              }
            }}
          />
        </div>

        {!state.diferenciarNacionalInternacional ? (
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Comisión de colaboración
            </label>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="number"
                value={state.comisionInternacional}
                onChange={(e) => update("comisionInternacional", Number(e.target.value))}
                min={0} max={100}
                className={cn(inputBase, "w-20 h-9 text-center text-sm tnum")}
              />
              <span className="text-sm text-muted-foreground font-medium">%</span>
              <div className="flex items-center gap-2 ml-auto">
                <Switch
                  checked={state.ivaIncluido}
                  onCheckedChange={(checked) => update("ivaIncluido", checked)}
                />
                <span className="text-xs text-muted-foreground">IVA incluido</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5 rounded-lg border border-border px-4 py-3">
              <div className="flex items-center gap-1.5">
                <Globe className="h-3 w-3 text-primary" strokeWidth={1.5} />
                <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Internacional
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={state.comisionInternacional}
                  onChange={(e) => update("comisionInternacional", Number(e.target.value))}
                  min={0} max={100}
                  className={cn(inputBase, "w-20 h-9 text-center text-sm tnum")}
                />
                <span className="text-sm text-muted-foreground font-medium">%</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Comprador residente fuera del país</p>
            </div>
            <div className="flex flex-col gap-1.5 rounded-lg border border-border px-4 py-3">
              <div className="flex items-center gap-1.5">
                <Home className="h-3 w-3 text-primary" strokeWidth={1.5} />
                <label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Nacional
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={state.comisionNacional}
                  onChange={(e) => update("comisionNacional", Number(e.target.value))}
                  min={0} max={100}
                  className={cn(inputBase, "w-20 h-9 text-center text-sm tnum")}
                />
                <span className="text-sm text-muted-foreground font-medium">%</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Comprador residente en el mismo país</p>
            </div>
            <div className="sm:col-span-2 flex items-center gap-2 justify-end">
              <Switch
                checked={state.ivaIncluido}
                onCheckedChange={(checked) => update("ivaIncluido", checked)}
              />
              <span className="text-xs text-muted-foreground">IVA incluido</span>
            </div>
          </div>
        )}
      </div>

      {/* ═════ CARD 2 · Preferencias de agencias ═════ */}
      {state.diferenciarNacionalInternacional && (
        <div className="rounded-xl border border-border bg-card px-5 py-4 flex flex-col gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <Users className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Preferencias de agencias</p>
              <p className="text-xs text-muted-foreground">Algunas agencias prefieren trabajar solo con compradores internacionales.</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground">Permitir rechazar clientes nacionales</p>
              <p className="text-[10px] text-muted-foreground">Las agencias podrán elegir no recibir compradores nacionales</p>
            </div>
            <Switch
              checked={state.agenciasRefusarNacional}
              onCheckedChange={(checked) => update("agenciasRefusarNacional", checked)}
            />
          </div>

          {state.agenciasRefusarNacional && (
            <div className="rounded-lg bg-muted/40 border border-border px-4 py-3 flex flex-col gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Vista previa — preferencia de la agencia
              </p>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-primary bg-primary/20" />
                  Aceptar clientes nacionales e internacionales
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-border" />
                  Solo aceptar clientes internacionales
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground italic">
                Las agencias que elijan la segunda opción solo recibirán leads de compradores internacionales.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ═════ CARD 3 · Clasificación del cliente ═════ */}
      {state.diferenciarNacionalInternacional && (
        <div className="rounded-xl border border-border bg-card px-5 py-4 flex flex-col gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <Shield className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">¿Cómo se identifica un cliente nacional?</p>
              <p className="text-xs text-muted-foreground">Criterio para clasificar al comprador</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {clasificacionOpts.map((opt) => {
              const active = state.clasificacionCliente === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => update("clasificacionCliente", opt.value)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                    active ? "border-primary bg-primary/5" : "border-border hover:border-primary/30",
                  )}
                >
                  <div className={cn(
                    "h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center",
                    active ? "border-primary" : "border-muted-foreground/30",
                  )}>
                    {active && <div className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                  <span className="text-xs font-medium text-foreground">{opt.label}</span>
                  {opt.recommended && (
                    <span className="ml-auto text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      Recomendado
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <p className="text-[10px] text-muted-foreground">
            Un cliente se considera internacional si su residencia está fuera del país donde se ubica la promoción.
          </p>
        </div>
      )}

      {/* ═════ CARD 4 · Condiciones de registro ═════ */}
      <div className="rounded-xl border border-border bg-card px-5 py-4 flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
            <ClipboardList className="h-4 w-4" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Condiciones de registro de clientes</p>
            <p className="text-xs text-muted-foreground">Datos mínimos que el colaborador debe aportar al registrar un cliente</p>
          </div>
        </div>

        {/* Copy comercial · ciclo del registro */}
        <div className="rounded-lg bg-primary/5 border border-primary/15 px-4 py-3 flex items-start gap-2.5">
          <HandshakeIcon className="h-4 w-4 text-primary shrink-0 mt-0.5" strokeWidth={1.5} />
          <div className="text-[11px] text-foreground leading-relaxed">
            <p className="font-medium text-foreground mb-0.5">Así funciona el registro</p>
            <p className="text-muted-foreground">
              El cliente queda como <span className="text-foreground font-medium">preregistro</span> reservado a nombre del colaborador. La reserva se confirma <span className="text-foreground font-medium">definitivamente tras la primera visita</span>. Mientras tanto, ningún otro colaborador puede registrar al mismo cliente.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {condicionesOptions.map((cond) => {
            const checked = state.condicionesRegistro.includes(cond.value);
            return (
              <div
                key={cond.value}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors",
                  checked ? "border-primary/30 bg-primary/5" : "border-border",
                )}
              >
                <Checkbox
                  checked={checked}
                  disabled={cond.required}
                  onCheckedChange={() => toggleCondicion(cond.value)}
                />
                <span className="text-xs font-medium text-foreground">{cond.label}</span>
                {cond.required && (
                  <span className="ml-auto text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    Obligatorio
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Aviso si se exige email completo */}
        {state.condicionesRegistro.includes("email_completo") && (
          <div className="rounded-lg bg-warning/10 border border-warning/25 px-4 py-3 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" strokeWidth={1.5} />
            <div className="text-[11px] text-warning leading-relaxed">
              <p className="font-medium mb-0.5">Puedes perder registros</p>
              <p className="text-warning/90">
                No todas las agencias están dispuestas a facilitar el email de sus clientes. Actívalo solo si es imprescindible para tu operativa.
              </p>
            </div>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground">
          Los campos obligatorios (nombre, 4 cifras y nacionalidad) no se pueden desactivar.
        </p>

        {/* Validez del registro · toggle + desplegable */}
        <div className="pt-3 border-t border-border flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground">Caducidad del registro</p>
                <p className="text-[10px] text-muted-foreground">Tras ese plazo sin visita, el cliente queda libre para otro colaborador</p>
              </div>
            </div>
            <Switch
              checked={state.validezRegistroDias > 0}
              onCheckedChange={(on) => update("validezRegistroDias", on ? 180 : 0)}
            />
          </div>

          {state.validezRegistroDias > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { days: 30,  label: "1 mes" },
                { days: 60,  label: "2 meses" },
                { days: 90,  label: "3 meses" },
                { days: 180, label: "6 meses" },
                { days: 360, label: "12 meses" },
              ].map((opt) => {
                const active = state.validezRegistroDias === opt.days;
                return (
                  <button
                    key={opt.days}
                    type="button"
                    onClick={() => update("validezRegistroDias", opt.days)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ═════ CARD 5 · Forma de pago ═════ */}
      <div className="rounded-xl border border-border bg-card px-5 py-4 flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
            <Home className="h-4 w-4" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Forma de pago de comisiones</p>
            <p className="text-xs text-muted-foreground">¿Cuándo se abona la comisión al colaborador?</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {formaPagoComisionOptions.map((o) => (
            <OptionCard
              key={o.value}
              option={o}
              selected={state.formaPagoComision === o.value}
              onSelect={(v) => update("formaPagoComision", v as FormaPagoComision)}
            />
          ))}
        </div>

        {state.formaPagoComision === "personalizado" && (
          <div className="flex flex-col gap-2 pt-2 border-t border-border">
            <div className="rounded-lg bg-muted/40 border border-border px-3 py-2 flex gap-2 text-xs text-muted-foreground leading-relaxed">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" strokeWidth={1.5} />
              Define en cada hito qué % ha pagado el cliente y qué % de la comisión se abona al colaborador.
            </div>

            {state.hitosComision.length > 0 && (
              <div className="flex items-center gap-2 px-1">
                <span className="flex-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  % Cliente
                </span>
                <span className="flex-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  % Colaborador
                </span>
                <div className="w-7" />
              </div>
            )}

            {state.hitosComision.map((hito, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="number"
                  value={hito.pagoCliente}
                  onChange={(e) => {
                    const val = Math.max(0, Math.min(100, Number(e.target.value)));
                    const next = [...state.hitosComision];
                    next[idx] = { ...next[idx], pagoCliente: val };
                    update("hitosComision", next);
                  }}
                  min={0} max={100}
                  className={cn(inputBase, "h-8 flex-1 text-xs text-center tnum")}
                />
                <input
                  type="number"
                  value={hito.pagoColaborador}
                  onChange={(e) => {
                    const val = Math.max(0, Math.min(100, Number(e.target.value)));
                    const next = [...state.hitosComision];
                    next[idx] = { ...next[idx], pagoColaborador: val };
                    update("hitosComision", next);
                  }}
                  min={0} max={100}
                  className={cn(inputBase, "h-8 flex-1 text-xs text-center tnum")}
                />
                <button
                  type="button"
                  onClick={() => removeHito(idx)}
                  aria-label="Eliminar hito"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors"
                >
                  <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                </button>
              </div>
            ))}

            <div className="flex items-center gap-2 px-1 pt-1 border-t border-border">
              <span className={cn(
                "flex-1 text-xs font-semibold tnum",
                totalCliente > 100 ? "text-destructive" : totalCliente === 100 ? "text-primary" : "text-muted-foreground",
              )}>
                {totalCliente}% / 100%
              </span>
              <span className={cn(
                "flex-1 text-xs font-semibold tnum",
                totalColab > 100 ? "text-destructive" : totalColab === 100 ? "text-primary" : "text-muted-foreground",
              )}>
                {totalColab}% / 100%
              </span>
              <div className="w-7" />
            </div>

            <button
              type="button"
              onClick={addHito}
              disabled={totalCliente >= 100 && totalColab >= 100}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Plus className="h-3 w-3" strokeWidth={1.5} />
              Añadir hito
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
