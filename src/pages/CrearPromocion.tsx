/**
 * Crear promoción · Wizard multi-paso (Fase 1: shell + pasos role/tipo)
 *
 * Port del CreatePromotion.tsx del repo original con el lenguaje visual Byvaro v2.
 * Estructura:
 *   - Timeline lateral izquierdo con los pasos visibles según el estado
 *   - Área central con el contenido del paso actual
 *   - Footer fijo con Atrás / Guardar borrador / Siguiente
 *   - Auto-save a localStorage en cada cambio
 *
 * Pasos implementados en Fase 1: role, tipo.
 * El resto muestra un placeholder hasta que se portenen Fases 2-4.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X, Sparkles } from "lucide-react";
import { Toaster, toast } from "sonner";

import type {
  StepId, WizardState, RoleOption, TipoPromocion,
  SubUni, SubVarias, EstadoPromocion, FaseConstruccion, EstiloVivienda,
} from "@/components/crear-promocion/types";
import { defaultWizardState } from "@/components/crear-promocion/types";
import {
  roleOptions, tipoOptions, subUniOptions, subVariasOptions,
  estadoOptions, faseConstruccionOptions, estiloViviendaOptions,
} from "@/components/crear-promocion/options";
import { OptionCard, InlineStepper } from "@/components/crear-promocion/SharedWidgets";
import { StepTimeline, getAllSteps } from "@/components/crear-promocion/StepTimeline";
import { cn } from "@/lib/utils";
import {
  FileCheck, FileX, Calendar as CalendarIconLucide, Home as HomeIcon, Store as StoreIcon,
  Minus, Plus,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════
   Persistencia en localStorage (idéntica al original)
   ═══════════════════════════════════════════════════════════════════ */
const DRAFT_KEY = "byvaro-crear-promocion-draft";
const loadDraft = (): WizardState | null => {
  try {
    const r = localStorage.getItem(DRAFT_KEY);
    return r ? { ...defaultWizardState, ...JSON.parse(r) } : null;
  } catch { return null; }
};
const saveDraftLS = (s: WizardState) => localStorage.setItem(DRAFT_KEY, JSON.stringify(s));
const clearDraft = () => localStorage.removeItem(DRAFT_KEY);

/* ═══════════════════════════════════════════════════════════════════
   Metadatos de cada paso (título + subtítulo mostrados en la cabecera)
   ═══════════════════════════════════════════════════════════════════ */
const stepMeta: Record<StepId, { title: string; subtitle: string }> = {
  role: { title: "Crear nueva promoción", subtitle: "¿Cómo deseas crear esta promoción?" },
  tipo: { title: "Tipo de promoción", subtitle: "Selecciona el tipo de promoción" },
  sub_uni: { title: "Vivienda unifamiliar", subtitle: "¿Cuántas viviendas tendrá la promoción?" },
  sub_varias: { title: "Tipología y estilo", subtitle: "Selecciona el tipo y estilo arquitectónico" },
  config_edificio: { title: "Configuración del edificio", subtitle: "Define la estructura y distribución de plantas" },
  extras: { title: "Anejos y extras", subtitle: "Configura trasteros y plazas de parking por vivienda" },
  estado: { title: "Estado de la promoción", subtitle: "¿En qué fase se encuentra?" },
  detalles: { title: "Detalles finales", subtitle: "Configuración adicional de la promoción" },
  info_basica: { title: "Información básica", subtitle: "Nombre, ubicación y características" },
  multimedia: { title: "Multimedia", subtitle: "Fotografías y videos de la promoción" },
  descripcion: { title: "Descripción", subtitle: "Describe la promoción para los compradores" },
  crear_unidades: { title: "Crear unidades", subtitle: "Configura las unidades de la promoción" },
  colaboradores: { title: "Colaboración", subtitle: "Define cómo se compensará a las agencias colaboradoras" },
  plan_pagos: { title: "Plan de pagos", subtitle: "Define cómo pagará el comprador durante el proceso de compra" },
};

/* ═══════════════════════════════════════════════════════════════════
   Página principal
   ═══════════════════════════════════════════════════════════════════ */
export default function CrearPromocion() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [state, setState] = useState<WizardState>(() => loadDraft() ?? defaultWizardState);
  const initialStep = (searchParams.get("step") as StepId) || "role";
  const [step, setStep] = useState<StepId>(initialStep);

  const update = useCallback(<K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setState(prev => ({ ...prev, [key]: value }));
  }, []);

  useEffect(() => { saveDraftLS(state); }, [state]);

  /* Pasos visibles según ramificación (depende de tipo/subUni) */
  const visibleSteps = useMemo(() => getAllSteps(state).map(s => s.id), [state]);

  /* Flags derivados del estado (usados en conditionals) */
  const isSingleHome = state.tipo === "unifamiliar" && state.subUni === "una_sola";
  const isVariasUni = state.tipo === "unifamiliar" && state.subUni === "varias";

  /* Opciones de trimestre (año actual +2) */
  const currentYear = new Date().getFullYear();
  const trimestreOptions = [
    `T1 ${currentYear}`, `T2 ${currentYear}`, `T3 ${currentYear}`, `T4 ${currentYear}`,
    `T1 ${currentYear + 1}`, `T2 ${currentYear + 1}`, `T3 ${currentYear + 1}`, `T4 ${currentYear + 1}`,
    `T1 ${currentYear + 2}`, `T2 ${currentYear + 2}`, `T3 ${currentYear + 2}`, `T4 ${currentYear + 2}`,
  ];

  /* Handlers auxiliares (multi-select con cantidades, estado con cascada) */
  const toggleTipologia = (tipo: SubVarias) => {
    const existing = state.tipologiasSeleccionadas.find(t => t.tipo === tipo);
    if (existing) {
      setState(prev => ({ ...prev, tipologiasSeleccionadas: prev.tipologiasSeleccionadas.filter(t => t.tipo !== tipo) }));
    } else {
      setState(prev => ({ ...prev, tipologiasSeleccionadas: [...prev.tipologiasSeleccionadas, { tipo, cantidad: 1 }] }));
    }
  };
  const updateTipologiaCantidad = (tipo: SubVarias, delta: number) => {
    setState(prev => ({
      ...prev,
      tipologiasSeleccionadas: prev.tipologiasSeleccionadas.map(t =>
        t.tipo === tipo ? { ...t, cantidad: Math.max(1, t.cantidad + delta) } : t
      ),
    }));
  };
  const toggleEstilo = (estilo: EstiloVivienda) => {
    setState(prev => ({
      ...prev,
      estilosSeleccionados: prev.estilosSeleccionados.includes(estilo)
        ? prev.estilosSeleccionados.filter(e => e !== estilo)
        : [...prev.estilosSeleccionados, estilo],
    }));
  };
  const handleEstadoSelect = (v: string) => {
    const estado = v as EstadoPromocion;
    setState(prev => ({
      ...prev,
      estado,
      faseConstruccion: null,
      trimestreEntrega: null,
      tieneLicencia: estado === "proyecto" ? prev.tieneLicencia : null,
      fechaEntrega: estado === "terminado" ? null : prev.fechaEntrega,
      fechaTerminacion: estado === "terminado" ? prev.fechaTerminacion : null,
    }));
  };
  const handleFaseSelect = (v: string) => {
    const fase = v as FaseConstruccion;
    if (fase === "llave_en_mano") {
      setState(prev => ({ ...prev, faseConstruccion: fase, estado: "terminado", trimestreEntrega: null }));
    } else {
      setState(prev => ({ ...prev, faseConstruccion: fase, trimestreEntrega: null }));
    }
  };
  const getNext = (): StepId | null => {
    const i = visibleSteps.indexOf(step);
    return i < visibleSteps.length - 1 ? visibleSteps[i + 1] : null;
  };
  const getPrev = (): StepId | null => {
    const i = visibleSteps.indexOf(step);
    return i > 0 ? visibleSteps[i - 1] : null;
  };

  /* Validación de "Siguiente" por paso */
  const canContinue = () => {
    if (step === "role") return !!state.role;
    if (step === "tipo") return !!state.tipo;
    if (step === "sub_uni") return !!state.subUni;
    if (step === "sub_varias") {
      if (isVariasUni) {
        return state.tipologiasSeleccionadas.length > 0 && state.estilosSeleccionados.length > 0;
      }
      return !!state.subVarias && !!state.estiloVivienda;
    }
    if (step === "estado") return !!state.estado;
    if (step === "detalles") return true;
    // Pasos aún no portados: siempre permitimos pasar
    return true;
  };

  /* Handlers */
  const handleContinue = () => {
    const next = getNext();
    if (next) setStep(next);
    else {
      clearDraft();
      toast.success("Promoción creada correctamente");
      navigate("/promociones");
    }
  };
  const handleBack = () => {
    const prev = getPrev();
    if (prev) setStep(prev);
    else navigate(-1);
  };
  const handleSaveDraft = () => {
    saveDraftLS(state);
    toast.success("Borrador guardado");
  };
  const handleClose = () => {
    if (confirm("¿Salir del asistente? El borrador se conserva.")) navigate("/promociones");
  };

  /* Selección de tipo reinicia sub-pasos */
  const handleTipoSelect = (v: string) => {
    setState(prev => ({ ...prev, tipo: v as TipoPromocion, subUni: null, subVarias: null, estado: null }));
  };

  const meta = stepMeta[step];

  return (
    <div className="fixed inset-0 z-40 flex bg-background">
      <Toaster position="top-center" richColors />

      {/* ═══════════ Sidebar Timeline ═══════════ */}
      <aside className="hidden lg:flex w-[280px] shrink-0 flex-col border-r border-border bg-card">
        <div className="h-14 flex items-center gap-2.5 px-5 border-b border-border">
          <div className="w-8 h-8 rounded-xl bg-primary grid place-items-center text-primary-foreground font-bold text-sm">B</div>
          <div className="font-bold text-[15px] tracking-tight">Byvaro</div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-4">
            Crear promoción
          </p>
          <StepTimeline state={state} currentStep={step} onGoToStep={setStep} />
        </div>
      </aside>

      {/* ═══════════ Main area ═══════════ */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile + desktop) */}
        <header className="h-14 shrink-0 flex items-center justify-between px-4 sm:px-6 border-b border-border bg-background/95 backdrop-blur">
          <div className="lg:hidden flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary grid place-items-center text-primary-foreground font-bold text-[13px]">B</div>
            <span className="font-bold text-[14px] tracking-tight">Crear promoción</span>
          </div>
          <div className="hidden lg:block text-xs text-muted-foreground">
            Paso {visibleSteps.indexOf(step) + 1} de {visibleSteps.length}
          </div>
          <button
            onClick={handleClose}
            className="p-2 -mr-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Cerrar asistente"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-10">
          <div className={cn(
            "mx-auto w-full",
            step === "crear_unidades" || step === "colaboradores" ? "max-w-[720px]" : "max-w-[580px]"
          )}>
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="flex flex-col gap-6"
              >
                {/* Step header */}
                <div>
                  <h1 className="text-[22px] sm:text-[24px] font-bold tracking-tight leading-tight">
                    {meta.title}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1.5">{meta.subtitle}</p>
                </div>

                {/* ─── Step: role ─── */}
                {step === "role" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {roleOptions.map((o) => (
                      <OptionCard key={o.value} option={o} selected={state.role === o.value}
                        onSelect={(v) => update("role", v as RoleOption)} />
                    ))}
                  </div>
                )}

                {/* ─── Step: tipo ─── */}
                {step === "tipo" && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {tipoOptions.map((o) => (
                      <OptionCard key={o.value} option={o} selected={state.tipo === o.value}
                        onSelect={handleTipoSelect} />
                    ))}
                  </div>
                )}

                {/* ─── Step: sub_uni ─── */}
                {step === "sub_uni" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {subUniOptions.map((o) => (
                      <OptionCard key={o.value} option={o} selected={state.subUni === o.value}
                        onSelect={(v) => { update("subUni", v as SubUni); update("subVarias", null); }} />
                    ))}
                  </div>
                )}

                {/* ─── Step: sub_varias ─── */}
                {step === "sub_varias" && (
                  <div className="flex flex-col gap-6">
                    {/* Variante una_sola: tipología única + estilo único */}
                    {isSingleHome && (
                      <>
                        <div>
                          <SectionLabel>Tipología</SectionLabel>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {subVariasOptions.map((o) => (
                              <OptionCard key={o.value} option={o} selected={state.subVarias === o.value}
                                onSelect={(v) => update("subVarias", v as SubVarias)} />
                            ))}
                          </div>
                        </div>
                        <div>
                          <SectionLabel>Estilo arquitectónico</SectionLabel>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {estiloViviendaOptions.map((o) => (
                              <OptionCard key={o.value} option={o} selected={state.estiloVivienda === o.value}
                                onSelect={(v) => update("estiloVivienda", v as EstiloVivienda)} />
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Variante varias: multi-select con contadores + multi-estilo */}
                    {isVariasUni && (
                      <>
                        <div>
                          <SectionLabel>Tipologías — selecciona una o más</SectionLabel>
                          <div className="flex flex-col gap-2">
                            {subVariasOptions.map((o) => {
                              const selected = state.tipologiasSeleccionadas.find(t => t.tipo === o.value);
                              const Icon = o.icon;
                              return (
                                <div key={o.value}
                                  className={cn(
                                    "flex items-center gap-3 rounded-2xl border px-4 py-3 transition-colors",
                                    selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"
                                  )}
                                >
                                  <button onClick={() => toggleTipologia(o.value)}
                                    className="flex items-center gap-3 flex-1 text-left">
                                    <div className={cn(
                                      "flex h-9 w-9 items-center justify-center rounded-xl shrink-0",
                                      selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                    )}>
                                      <Icon className="h-4 w-4" />
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-foreground">{o.label}</p>
                                      <p className="text-xs text-muted-foreground">{o.description}</p>
                                    </div>
                                  </button>
                                  {selected && (
                                    <InlineStepper value={selected.cantidad} min={1}
                                      onChange={(v) => updateTipologiaCantidad(o.value, v - selected.cantidad)} />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {state.tipologiasSeleccionadas.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-2 tnum">
                              Total: {state.tipologiasSeleccionadas.reduce((s, t) => s + t.cantidad, 0)} viviendas
                            </p>
                          )}
                        </div>
                        <div>
                          <SectionLabel>Estilos arquitectónicos — selecciona uno o más</SectionLabel>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {estiloViviendaOptions.map((o) => {
                              const selected = state.estilosSeleccionados.includes(o.value);
                              const Icon = o.icon;
                              return (
                                <button key={o.value} onClick={() => toggleEstilo(o.value)}
                                  className={cn(
                                    "group relative flex flex-col items-center gap-2 rounded-2xl border p-4 text-center shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 transition-all duration-200",
                                    selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"
                                  )}
                                >
                                  <div className={cn(
                                    "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
                                    selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                  )}>
                                    <Icon className="h-4 w-4" />
                                  </div>
                                  <p className="text-sm font-medium text-foreground">{o.label}</p>
                                  <p className="text-[11px] text-muted-foreground leading-snug">{o.description}</p>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* ─── Step: estado ─── */}
                {step === "estado" && (
                  <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {estadoOptions.map((o) => (
                        <OptionCard key={o.value} option={o} selected={state.estado === o.value}
                          onSelect={handleEstadoSelect} />
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
                            <OptionCard key={o.value} option={o} selected={state.faseConstruccion === o.value}
                              onSelect={handleFaseSelect} />
                          ))}
                        </div>

                        {state.faseConstruccion === "entrega_proxima" && (
                          <div className="pt-3 border-t border-border">
                            <SectionLabel>Fecha estimada de entrega</SectionLabel>
                            <div className="grid grid-cols-4 gap-2">
                              {trimestreOptions.map((t) => (
                                <button key={t} onClick={() => update("trimestreEntrega", t)}
                                  className={cn(
                                    "rounded-lg border px-2 py-2 text-xs font-medium transition-colors tnum",
                                    state.trimestreEntrega === t
                                      ? "border-primary bg-primary/10 text-primary"
                                      : "border-border bg-background text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                                  )}
                                >
                                  {t}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Fecha de terminación (cuando terminado) */}
                    {state.estado === "terminado" && (
                      <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                            <CalendarIconLucide className="h-4 w-4" />
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

                    {/* Mixto: informativo */}
                    {state.tipo === "mixto" && (
                      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex flex-col gap-2">
                        <p className="text-xs font-semibold text-foreground">Promoción mixta</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          Para crear una promoción mixta, primero configura la parte <strong>plurifamiliar</strong>.
                          Al finalizar podrás añadir las <strong>viviendas unifamiliares</strong> desde la ficha de la promoción.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* ─── Step: detalles ─── */}
                {step === "detalles" && (
                  <div className="flex flex-col gap-3">
                    {!isSingleHome && (
                      <ToggleRow
                        icon={HomeIcon}
                        title="Piso piloto"
                        desc="¿Hay piso piloto disponible para visitas?"
                        checked={state.pisoPiloto}
                        onChange={(v) => update("pisoPiloto", v)}
                      />
                    )}
                    <ToggleRow
                      icon={StoreIcon}
                      title="Oficinas de venta propias"
                      desc="¿Tienes una oficina donde recibes a los clientes?"
                      checked={state.oficinaVentas}
                      onChange={(v) => update("oficinaVentas", v)}
                    />
                    <p className="text-[11.5px] text-muted-foreground px-1 leading-relaxed">
                      Los puntos de venta concretos (direcciones, teléfonos, WhatsApp) se configuran
                      más adelante en la ficha de la promoción.
                    </p>
                  </div>
                )}

                {/* ─── Placeholder para pasos aún no portados ─── */}
                {!["role", "tipo", "sub_uni", "sub_varias", "estado", "detalles"].includes(step) && (
                  <UpcomingStep step={step} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* ═══════════ Footer nav ═══════════ */}
        <footer className="h-16 shrink-0 flex items-center justify-between px-4 sm:px-6 lg:px-10 border-t border-border bg-card">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            {!getPrev() ? "Cancelar" : "Atrás"}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveDraft}
              className="hidden sm:inline-flex items-center h-9 px-4 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Guardar borrador
            </button>
            <button
              onClick={handleContinue}
              disabled={!canContinue()}
              className="inline-flex items-center gap-1.5 h-9 px-4 sm:px-5 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors shadow-soft disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {!getNext() ? "Publicar" : "Siguiente"}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Sub-componentes auxiliares de los pasos
   ═══════════════════════════════════════════════════════════════════ */
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
        selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"
      )}
    >
      <div className={cn(
        "flex h-9 w-9 items-center justify-center rounded-xl shrink-0",
        selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
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

function ToggleRow({
  icon: Icon, title, desc, checked, onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string; desc: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 hover:border-foreground/20 transition-colors text-left"
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "flex h-9 w-9 items-center justify-center rounded-xl shrink-0 transition-colors",
          checked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>
      <div
        aria-checked={checked}
        role="switch"
        className={cn(
          "relative inline-flex h-5 w-9 rounded-full transition-colors shrink-0",
          checked ? "bg-primary" : "bg-muted"
        )}
      >
        <span className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-soft transition-transform",
          checked ? "translate-x-4.5" : "translate-x-0.5"
        )} style={{ transform: checked ? "translateX(18px)" : "translateX(2px)" }} />
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Placeholder para pasos aún no portados
   ═══════════════════════════════════════════════════════════════════ */
function UpcomingStep({ step }: { step: StepId }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 sm:p-8 text-center">
      <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center mx-auto mb-3">
        <Sparkles className="h-5 w-5 text-primary" />
      </div>
      <h3 className="text-[14.5px] font-semibold">Paso "{step}" · próximamente</h3>
      <p className="text-[12.5px] text-muted-foreground mt-1.5 max-w-sm mx-auto leading-relaxed">
        Este paso se portará en la siguiente fase del diseño. Puedes continuar al siguiente o volver atrás.
      </p>
    </div>
  );
}
