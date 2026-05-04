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
  Settings, ChevronDown,
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
  canManage = true,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  /** Solo el admin del workspace o el creador de la promoción pueden
   *  activar/desactivar la colaboración. Otros members ven el toggle
   *  bloqueado y un mensaje explícito. Default true (retro-compat).
   *  TODO(backend): cuando exista `Promotion.createdByUserId`, este
   *  prop se computa como `isAdmin(user) || promo.createdByUserId === user.id`. */
  canManage?: boolean;
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

  /* Activación implícita ELIMINADA (2026-05) · ahora el user debe
   * activar la colaboración explícitamente con el toggle. Razón ·
   * arrastrar al usuario a "todo el mundo colabora" oculta la
   * decisión real y deja el step en estado inconsistente (toggle on,
   * pero comisiones vacías). El nuevo banner de arriba explica las
   * dos opciones (uso interno vs colaboración). */

  return (
    <div className="flex flex-col gap-5">
      {/* Banner explicativo · dos opciones claras · uso interno vs
          colaboración con agencias. Sin auto-activar nada · el user
          decide. */}
      <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
            <Info className="h-4 w-4" strokeWidth={1.7} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13.5px] font-semibold text-foreground mb-1.5">
              ¿Quieres colaborar con agencias inmobiliarias?
            </p>
            <ul className="text-[12.5px] text-foreground/80 leading-relaxed space-y-1">
              <li>
                <span className="font-medium">Sí · activa la colaboración</span> ·
                podrás compartir esta promoción con agencias colaboradoras y
                recibir registros de sus clientes. Configura comisiones y forma
                de pago abajo.
              </li>
              <li>
                <span className="font-medium">No · uso interno</span> · deja el
                toggle desactivado. La promoción seguirá funcionando para tu
                equipo (registros, visitas, ventas) pero <strong>no será visible
                ni se podrá compartir con colaboradores</strong>.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Read-only · solo admin/creador puede gestionar · TODO(backend):
       *  comprobar `createdByUserId` cuando exista en el modelo. */}
      {!canManage && (
        <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground leading-relaxed">
          <Shield className="h-4 w-4 shrink-0 mt-0.5" strokeWidth={1.75} />
          <span>
            Solo el administrador del workspace o quien creó esta promoción
            puede activar o desactivar la colaboración con agencias. Puedes
            consultar la estructura abajo · los cambios no se guardarán.
          </span>
        </div>
      )}

      {/* ═════ TOGGLE · activar/desactivar comisiones ═════
        * UN SOLO bloque · switch + descripción contextual que cambia
        * según el state. Antes había 2 avisos (este toggle + un
        * banner warning aparte cuando estaba OFF) · duplicaban el
        * mismo mensaje y ocupaban espacio innecesario. */}
      <div className={cn(
        "rounded-xl border px-4 py-3 flex items-center gap-3",
        state.colaboracion ? "border-border bg-card" : "border-warning/30 bg-warning/5",
      )}>
        <div className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
          state.colaboracion ? "bg-primary/10 text-primary" : "bg-warning/15 text-warning",
        )}>
          {state.colaboracion
            ? <Handshake className="h-4 w-4" strokeWidth={1.5} />
            : <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            {state.colaboracion ? "Compartir con colaboradores" : "Solo uso interno"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {state.colaboracion
              ? "La promoción se podrá compartir con agencias colaboradoras · configura comisiones y forma de pago abajo."
              : "La promoción funciona para tu equipo pero NO se compartirá con colaboradores. Activa el switch para abrir colaboración."}
          </p>
        </div>
        <Switch
          checked={state.colaboracion}
          disabled={!canManage}
          onCheckedChange={(checked) => {
            if (!canManage) return;
            update("colaboracion", checked);
          }}
        />
      </div>

      {/* Si está desactivado · no mostramos la config de comisiones · cero
       *  ruido · el user puede activar arriba. */}
      {!state.colaboracion ? null : (
      <>
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
                type="text"
                inputMode="numeric"
                value={state.comisionInternacional > 0 ? String(state.comisionInternacional) : ""}
                placeholder="0"
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^0-9]/g, "");
                  const n = digits === "" ? 0 : Math.min(100, Number(digits));
                  update("comisionInternacional", n);
                }}
                className={cn(inputBase, "w-20 h-9 text-center text-sm tnum")}
              />
              <span className="text-sm text-muted-foreground font-medium">
                %{!state.ivaIncluido && <span className="ml-1 text-foreground">+ IVA</span>}
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <Switch
                  checked={state.ivaIncluido}
                  onCheckedChange={(checked) => update("ivaIncluido", checked)}
                />
                <span className="text-xs text-muted-foreground">{state.ivaIncluido ? "IVA incluido" : "IVA excluido"}</span>
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
                  type="text"
                  inputMode="numeric"
                  value={state.comisionInternacional > 0 ? String(state.comisionInternacional) : ""}
                  placeholder="0"
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^0-9]/g, "");
                    const n = digits === "" ? 0 : Math.min(100, Number(digits));
                    update("comisionInternacional", n);
                  }}
                  className={cn(inputBase, "w-20 h-9 text-center text-sm tnum")}
                />
                <span className="text-sm text-muted-foreground font-medium">
                  %{!state.ivaIncluido && <span className="ml-1 text-foreground">+ IVA</span>}
                </span>
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
                  type="text"
                  inputMode="numeric"
                  value={state.comisionNacional > 0 ? String(state.comisionNacional) : ""}
                  placeholder="0"
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^0-9]/g, "");
                    const n = digits === "" ? 0 : Math.min(100, Number(digits));
                    update("comisionNacional", n);
                  }}
                  className={cn(inputBase, "w-20 h-9 text-center text-sm tnum")}
                />
                <span className="text-sm text-muted-foreground font-medium">
                  %{!state.ivaIncluido && <span className="ml-1 text-foreground">+ IVA</span>}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">Comprador residente en el mismo país</p>
            </div>
            <div className="sm:col-span-2 flex items-center gap-2 justify-end">
              <Switch
                checked={state.ivaIncluido}
                onCheckedChange={(checked) => update("ivaIncluido", checked)}
              />
              <span className="text-xs text-muted-foreground">{state.ivaIncluido ? "IVA incluido" : "IVA excluido"}</span>
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

        {/* ═════ AVANZADO · Modo de validación + Caducidad ═════
         *  Estos dos controles son raros (la mayoría de promotores no
         *  los toca) · los movemos a un <details> colapsado por
         *  defecto · cero ruido en el flujo principal · el promotor
         *  que los necesite los abre. */}
        <details className="group rounded-xl border border-border bg-muted/20 px-4 py-2.5">
          <summary className="cursor-pointer list-none flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <Settings className="h-3.5 w-3.5" strokeWidth={1.75} />
              Opciones avanzadas
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" strokeWidth={1.5} />
          </summary>

          <div className="flex flex-col gap-5 pt-4 mt-3 border-t border-border">
            {/* Modo de validación del registro · radios "directo" vs "por_visita".
                TODO(logic): el flag se persiste en `WizardState.modoValidacionRegistro`
                y en `Promotion`, pero la lógica que actúa sobre él (transición
                preregistro_activo → aprobado tras visita realizada) NO está
                implementada todavía. Hoy `Registros.tsx::approve()` formaliza
                todo registro al instante. Ver `docs/registration-system.md §2`. */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                <HandshakeIcon className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
                Modo de validación
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                {/* REGLA CANÓNICA · ninguna opción lleva badge "Recomendado". */}
                {([
                  {
                    value: "directo" as const,
                    label: "Directo al aprobar",
                    desc: "El cliente queda formalmente registrado al aprobar · sin condicionar a visita.",
                  },
                  {
                    value: "por_visita" as const,
                    label: "Tras la visita",
                    desc: "Preregistro reservado a nombre del colaborador · se confirma tras la primera visita.",
                  },
                ]).map((opt) => {
                  const active = state.modoValidacionRegistro === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => update("modoValidacionRegistro", opt.value)}
                      className={cn(
                        "text-left rounded-lg border px-3.5 py-3 transition-colors",
                        active ? "border-primary bg-primary/5" : "border-border hover:border-primary/30",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "h-4 w-4 rounded-full border-2 shrink-0 grid place-items-center",
                          active ? "border-primary" : "border-muted-foreground/30",
                        )}>
                          {active && <div className="h-2 w-2 rounded-full bg-primary" />}
                        </div>
                        <span className="text-xs font-semibold text-foreground">{opt.label}</span>
                      </div>
                      <p className="text-[10.5px] text-muted-foreground leading-relaxed mt-1.5">
                        {opt.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Caducidad del registro */}
            <div className="flex flex-col gap-3">
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
        </details>
      </div>

      {/* ═════ CARD 5 · Forma de pago ═════
        * Si la colaboración está activa pero no se ha elegido forma
        * de pago · campo obligatorio · pintamos el card en rojizo
        * (border-destructive/40 + bg-destructive/5 + chip "Obligatorio")
        * para que el promotor lo identifique de un vistazo. */}
      {(() => {
        const formaPagoMissing = state.colaboracion && !state.formaPagoComision;
        return (
      <div className={cn(
        "rounded-xl border bg-card px-5 py-4 flex flex-col gap-4",
        formaPagoMissing
          ? "border-2 border-destructive/50 bg-destructive/5"
          : "border-border",
      )}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
              formaPagoMissing ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
            )}>
              <Home className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <div>
              <p className={cn(
                "text-sm font-semibold",
                formaPagoMissing ? "text-destructive" : "text-foreground",
              )}>
                Forma de pago de comisiones
              </p>
              <p className={cn(
                "text-xs",
                formaPagoMissing ? "text-destructive/70" : "text-muted-foreground",
              )}>
                {formaPagoMissing
                  ? "Campo obligatorio · selecciona una opción"
                  : "¿Cuándo se abona la comisión al colaborador?"}
              </p>
            </div>
          </div>
          {formaPagoMissing && (
            <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-destructive/15 border border-destructive/30 text-destructive text-[10.5px] font-semibold shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
              Obligatorio
            </span>
          )}
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
                  type="text"
                  inputMode="numeric"
                  value={hito.pagoCliente > 0 ? String(hito.pagoCliente) : ""}
                  placeholder="0"
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^0-9]/g, "");
                    const val = digits === "" ? 0 : Math.min(100, Number(digits));
                    const next = [...state.hitosComision];
                    next[idx] = { ...next[idx], pagoCliente: val };
                    update("hitosComision", next);
                  }}
                  className={cn(inputBase, "h-8 flex-1 text-xs text-center tnum")}
                />
                <input
                  type="text"
                  inputMode="numeric"
                  value={hito.pagoColaborador > 0 ? String(hito.pagoColaborador) : ""}
                  placeholder="0"
                  onChange={(e) => {
                    const digits = e.target.value.replace(/[^0-9]/g, "");
                    const val = digits === "" ? 0 : Math.min(100, Number(digits));
                    const next = [...state.hitosComision];
                    next[idx] = { ...next[idx], pagoColaborador: val };
                    update("hitosComision", next);
                  }}
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
        );
      })()}

      </>
      )}

    </div>
  );
}
