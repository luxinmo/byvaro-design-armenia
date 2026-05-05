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

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { MapPin, Upload, X, Building2, Home as HomeIcon, ArrowLeft } from "lucide-react";
import type { StepId, WizardState, RoleOption } from "./types";
import { ExtrasV5 } from "./extras-v5";
import { DetallesStep } from "./DetallesStep";
import { InfoBasicaStep } from "./InfoBasicaStep";
import { DescripcionStep } from "./DescripcionStep";
import { MultimediaStep } from "./MultimediaStep";
import { CrearUnidadesStep } from "./CrearUnidadesStep";
import { ColaboradoresStep } from "./ColaboradoresStep";
import { PlanPagosStep } from "./PlanPagosStep";
import { EstadoStep } from "./EstadoStep";
import { OptionCard } from "./SharedWidgets";
import { roleOptions, tipoOptions, subUniOptions, subVariasOptions, estadoOptions, faseConstruccionOptions } from "./options";
import { FileCheck, FileX } from "lucide-react";
import { futureTrimesterOptions } from "@/lib/futureTrimesters";

const STEP_TITLES: Partial<Record<StepId, string>> = {
  identidad: "Identidad",
  tipo: "Tipo y estructura",
  extras: "Características por defecto",
  estado: "Estructura · estado y entrega",
  detalles: "Construcción y entrega",
  ubicacion: "Ubicación",
  info_basica: "Características y amenidades",
  descripcion: "Descripción",
  multimedia: "Multimedia",
  crear_unidades: "Unidades",
  operativa: "Piso piloto y oficinas",
  planos: "Planos",
  brochure: "Brochure / Catálogo",
  colaboradores: "Colaboradores",
  plan_pagos: "Plan de pagos",
};

/* Steps que se pueden editar en modal · si llega otro, el caller
 * cae al onFallbackNavigate. Mini-steps `identidad/ubicacion/operativa/
 * planos/brochure` son fragmentos accesibles solo desde Revisión · no
 * aparecen en la timeline lineal. */
const SUPPORTED: StepId[] = [
  "identidad", "tipo", "extras", "estado", "detalles", "ubicacion", "info_basica",
  "descripcion", "multimedia", "crear_unidades", "operativa",
  "planos", "brochure",
  "colaboradores", "plan_pagos",
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
  infoBasicaSection,
}: {
  open: boolean;
  step: StepId | null;
  state: WizardState;
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  uploadScopeId?: string;
  onClose: () => void;
  /** Cuando step="info_basica", filtra el render para mostrar SOLO
   *  esa sub-sección · permite mini-modales por feature (amenidades
   *  sola, características solas, urbanización sola). Si no se pasa,
   *  muestra todo el step (modal grande). */
  infoBasicaSection?: "amenidades" | "caracteristicas" | "urbanizacion" | "estilo" | "energia";
}) {
  if (!step) return null;

  const SECTION_TITLES: Record<string, string> = {
    amenidades: "Amenities de la urbanización",
    caracteristicas: "Características de la vivienda",
    urbanizacion: "Urbanización",
    estilo: "Estilo arquitectónico",
    energia: "Certificado energético",
  };
  const title = (step === "info_basica" && infoBasicaSection)
    ? (SECTION_TITLES[infoBasicaSection] ?? "Editar")
    : (STEP_TITLES[step] ?? "Editar");

  /* Steps con tabla ancha (unidades) necesitan más espacio · sin
   * esto la tabla overflowea horizontalmente y el user tiene que
   * hacer scroll lateral · feo. Los mini-steps caben en xl/lg. */
  const widthClass =
    step === "crear_unidades" ? "max-w-[min(1280px,95vw)]" :
    step === "multimedia" ? "max-w-4xl" :
    step === "extras" ? "max-w-2xl" :
    step === "tipo" ? "max-w-2xl" :
    step === "identidad" || step === "ubicacion" || step === "operativa" ? "max-w-xl" :
    step === "planos" || step === "brochure" ? "max-w-2xl" :
    /* "estado" combina pantallas 6+7 del wizard · necesita más
     * espacio que un mini-step. */
    step === "estado" ? "max-w-3xl" :
    "max-w-3xl";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className={`${widthClass} max-h-[90vh] overflow-y-auto p-0`}>
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/40 sticky top-0 bg-background z-10">
          <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
        </DialogHeader>

        <div className="px-5 py-4">
          {step === "identidad" && <IdentidadQuickEdit state={state} update={update} />}
          {step === "ubicacion" && <UbicacionQuickEdit state={state} update={update} />}
          {step === "operativa" && <OperativaQuickEdit state={state} update={update} />}
          {step === "planos" && (
            <ArchivosSection
              kind="planos"
              description="Plano general de urbanización o planos individuales por unidad."
              state={state}
              update={update}
            />
          )}
          {step === "brochure" && (
            <ArchivosSection
              kind="brochure"
              description="Folleto comercial general o uno específico por unidad."
              state={state}
              update={update}
            />
          )}
          {step === "tipo" && <TipologiaQuickEdit state={state} />}
          {step === "estado" && (
            /* El step "estado" del wizard (6/14) depende del step
             *  "detalles" (7/14) · van juntos en flow lineal. En el
             *  modal de Estructura los renderizamos AMBOS apilados
             *  para reflejar el mismo dominio (estado de obra +
             *  entrega + piso piloto). `hideOfficesSection` evita
             *  duplicar oficinas (ya tienen su propio popup
             *  `operativa` desde otro bloque de la ficha). */
            <div className="flex flex-col gap-6">
              <EstadoStep state={state} update={update} />
              <DetallesStep
                state={state}
                update={update}
                trimestreOptions={futureTrimesterOptions()}
                hideOfficesSection
              />
            </div>
          )}
          {step === "extras" && <ExtrasV5 state={state} update={update} />}
          {step === "detalles" && (
            <DetallesStep
              state={state}
              update={update}
              trimestreOptions={futureTrimesterOptions()}
            />
          )}
          {step === "info_basica" && (
            /* Modal · si `infoBasicaSection` está set, mini-modal de
             * UNA sola sub-sección (amenidades / características /
             * urbanización / estilo / energía). Si no, modal grande
             * que combina pantallas 5/14 (ExtrasV5) + 8/14
             * (InfoBasicaStep sin nombre/ubicación). */
            infoBasicaSection ? (
              <InfoBasicaStep
                state={state}
                update={update}
                defaultsCapturedInExtras
                hideNameSection
                hideLocationSection
                onlySection={infoBasicaSection}
              />
            ) : (
              <div className="flex flex-col gap-6">
                {/* "plot" (Parcela) oculta · pertenece al unidad ·
                  * se edita desde la ficha de unidad. */}
                <ExtrasV5
                  state={state}
                  update={update}
                  hideCategoryKeys={["plot"]}
                />
                <InfoBasicaStep
                  state={state}
                  update={update}
                  defaultsCapturedInExtras
                  hideNameSection
                  hideLocationSection
                />
              </div>
            )
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

/* ─── IdentidadQuickEdit · Rol + Nombre comercial.
 *  Referencia (publicRef) es immutable · NUNCA editable. Sin ella el
 *  usuario podría romper enlaces compartidos del microsite. */
function IdentidadQuickEdit({
  state, update,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {/* Rol · radio cards */}
      <section>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">Actuamos como</p>
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

      {/* Nombre comercial */}
      <section>
        <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2 block">
          Nombre comercial
        </label>
        <input
          type="text"
          value={state.nombrePromocion}
          onChange={(e) => update("nombrePromocion", e.target.value)}
          placeholder="Ej. Villa Esmeralda, Residencial Marina…"
          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <p className="text-[10.5px] text-muted-foreground/70 mt-1.5">
          Es el nombre que verá el cliente en el microsite y en la ficha pública.
        </p>
      </section>

      {/* Referencia · read-only · sello inmutable */}
      <section>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">Referencia pública</p>
        <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5 flex items-center justify-between">
          <span className="text-sm font-mono font-medium text-foreground">
            {state.publicRef || state.refPromocion || "—"}
          </span>
          <span className="text-[11px] text-muted-foreground">No se puede cambiar</span>
        </div>
      </section>
    </div>
  );
}

/* ─── UbicacionQuickEdit · dirección (calle/ciudad/provincia/país)
 *  + MOCK visual de mapa con pin. El mapa real (Google Maps / Leaflet
 *  + lat/lng draggable) NO está implementado · esto solo es un
 *  placeholder visual para validar el diseño. Cuando se cablee la
 *  API el bloque del mapa se sustituye por el componente real. */
function UbicacionQuickEdit({
  state, update,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
}) {
  const dir = state.direccionPromocion;
  const patch = (k: keyof typeof dir, v: string) =>
    update("direccionPromocion", { ...dir, [k]: v });
  const inputCls = "w-full h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";
  return (
    <div className="flex flex-col gap-4">
      {/* MOCK · mapa con pin · diseño placeholder · sin funcionalidad
          real (no hay lat/lng en state · no hay tile provider · no se
          puede mover el pin). Cuando se enchufe Google Maps/Leaflet se
          sustituye el bloque entero. */}
      <div className="relative h-[200px] rounded-xl overflow-hidden border border-border">
        {/* Fondo · simula tile de mapa con gradiente + grid sutil */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, #e8eef5 0%, #dbe4ed 50%, #d2dde7 100%)",
            backgroundImage:
              "linear-gradient(135deg, #e8eef5 0%, #dbe4ed 50%, #d2dde7 100%), linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
            backgroundSize: "auto, 28px 28px, 28px 28px",
          }}
        />
        {/* "Calles" decorativas · diagonales con curvas suaves */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
          <path d="M 0 130 Q 100 100 200 120 T 400 90" stroke="rgba(255,255,255,0.7)" strokeWidth="6" fill="none" />
          <path d="M 50 0 Q 80 80 60 200" stroke="rgba(255,255,255,0.55)" strokeWidth="4" fill="none" />
          <path d="M 280 0 L 260 200" stroke="rgba(255,255,255,0.55)" strokeWidth="4" fill="none" />
        </svg>
        {/* Pin centrado · sombra para destacar sobre el fondo */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative -mt-4">
            <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
              <MapPinSolid />
            </div>
            {/* Sombra del pin · pequeña elipse debajo */}
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 h-1.5 w-3 rounded-full bg-foreground/20 blur-sm" />
          </div>
        </div>
        {/* Etiqueta arriba a la izquierda · marca el placeholder */}
        <div className="absolute top-2 left-2 inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-background/90 backdrop-blur text-[10px] font-medium text-muted-foreground border border-border">
          <span className="h-1.5 w-1.5 rounded-full bg-warning" />
          Vista previa · mapa interactivo próximamente
        </div>
      </div>

      {/* Campo único · estilo Google Places autocomplete · una sola
          búsqueda devuelve calle + ciudad + provincia + país + lat/lng.
          Para el mock escribimos el texto a `direccion` · cuando se
          cablee Places el handler parsea el resultado y rellena los
          4 sub-campos automáticamente. Los inputs separados (ciudad,
          provincia, país) ya no se ven · el user no los rellena
          manualmente nunca. */}
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2 block">
          Dirección
        </label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" strokeWidth={1.75} />
          <input
            type="text"
            value={dir.direccion}
            onChange={(e) => patch("direccion", e.target.value)}
            placeholder="Buscar dirección · ej. Calle del Mar 42, Marbella"
            className={`${inputCls} pl-9`}
          />
        </div>
        <p className="text-[10.5px] text-muted-foreground/70 mt-1.5">
          Empieza a escribir y elige una sugerencia · Google rellenará
          ciudad, provincia, país y coordenadas automáticamente.
        </p>
      </div>
    </div>
  );
}

/* ─── ArchivosSection · usado por dos steps distintos · `planos` y
 *  `brochure`. Cada uno abre el mismo componente con `kind` diferente
 *  · sub-bloques "Para toda la promoción" + "Específicos por unidad"
 *  visibles a la vez, sin elección obligatoria.
 *
 *  Storage paths cuando se cablee Supabase:
 *   - promotion-public/{promoId}/planos/                · general
 *   - promotion-public/{promoId}/brochure/              · general
 *   - promotion-public/{promoId}/units/{unitId}/planos/ · per-unit
 *   - promotion-public/{promoId}/units/{unitId}/brochure/
 *  Las "carpetas" por unitId se crean solas al subir el primer
 *  archivo (Storage usa prefixes virtuales).
 *
 *  TODO(backend) · `fakeUpload()` simula upload con URL mock ·
 *  sustituir por upload real cuando se enchufe Supabase Storage. */
function ArchivosSection({
  kind, description, state, update,
}: {
  kind: "planos" | "brochure";
  description: string;
  state: WizardState;
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
}) {
  const generalKey: "documentosPlanos" | "documentosBrochure" =
    kind === "planos" ? "documentosPlanos" : "documentosBrochure";
  const unitKey: "planoUrls" | "brochureUrls" =
    kind === "planos" ? "planoUrls" : "brochureUrls";

  const generalDocs = state[generalKey] ?? [];
  const hasGeneral = generalDocs.length > 0;
  const hasAnyIndividual = state.unidades.some((u) => (u[unitKey] ?? []).length > 0);
  const totalIndividual = state.unidades.reduce((sum, u) => sum + (u[unitKey] ?? []).length, 0);

  /* Mode state machine:
   *   - "choose"      · pantalla inicial · 2 OptionCards
   *   - "general"     · vista de planos generales (urbanización)
   *   - "individual"  · vista de planos por unidad
   *  Si ya hay datos, arranca directamente en el modo correspondiente. */
  const initialMode: "choose" | "general" | "individual" =
    hasGeneral ? "general"
    : hasAnyIndividual ? "individual"
    : "choose";
  const [mode, setMode] = useState<"choose" | "general" | "individual">(initialMode);

  /* TODO(backend) · generador fake hasta que se cablee Storage. */
  const fakeUpload = () => `mock://${kind}/${Date.now()}.pdf`;

  const addGeneral = () => update(generalKey, [...generalDocs, fakeUpload()]);
  const removeGeneral = (i: number) => update(generalKey, generalDocs.filter((_, idx) => idx !== i));

  const addToUnit = (unitId: string) => {
    const next = state.unidades.map((u) =>
      u.id === unitId ? { ...u, [unitKey]: [...(u[unitKey] ?? []), fakeUpload()] } : u
    );
    update("unidades", next);
  };
  const removeFromUnit = (unitId: string, idx: number) => {
    const next = state.unidades.map((u) => {
      if (u.id !== unitId) return u;
      const arr = u[unitKey] ?? [];
      return { ...u, [unitKey]: arr.filter((_, i) => i !== idx) };
    });
    update("unidades", next);
  };

  /* Etiquetas según kind · la pantalla de elección y el subtitle
   *  del general usan terminología distinta para planos vs brochure. */
  const labels = kind === "planos"
    ? {
        generalTitle: "Planos generales",
        generalDesc: "Para toda la urbanización · 1 plano común",
        generalHint: "Planos de la urbanización · zonas comunes, accesos, distribución del solar.",
        individualTitle: "Planos individuales",
        individualDesc: "1 plano específico por cada unidad",
        uploadGeneral: "Subir plano general",
        uploadUnit: "Subir plano",
        addUnit: "Añadir plano",
      }
    : {
        generalTitle: "Brochure general",
        generalDesc: "Catálogo común para toda la promoción",
        generalHint: "Brochure / catálogo comercial general · presentación global de la promoción.",
        individualTitle: "Brochures individuales",
        individualDesc: "1 brochure específico por cada unidad",
        uploadGeneral: "Subir brochure general",
        uploadUnit: "Subir brochure",
        addUnit: "Añadir brochure",
      };

  /* ═══════════ PANTALLA "CHOOSE" ═══════════ */
  if (mode === "choose") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-[12px] text-muted-foreground leading-relaxed">{description}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMode("general")}
            className="relative flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-5 text-center shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 hover:border-primary/30 transition-all"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Building2 className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{labels.generalTitle}</p>
              <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{labels.generalDesc}</p>
            </div>
            {hasGeneral && (
              <span className="absolute top-2.5 right-2.5 inline-flex items-center justify-center h-5 px-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold tnum">
                {generalDocs.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setMode("individual")}
            disabled={state.unidades.length === 0}
            className="relative flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-5 text-center shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 hover:border-primary/30 transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-soft disabled:hover:border-border disabled:cursor-not-allowed"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <HomeIcon className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{labels.individualTitle}</p>
              <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                {state.unidades.length === 0
                  ? "Crea primero las unidades"
                  : `${labels.individualDesc} · ${state.unidades.length} ${state.unidades.length === 1 ? "unidad" : "unidades"}`}
              </p>
            </div>
            {hasAnyIndividual && (
              <span className="absolute top-2.5 right-2.5 inline-flex items-center justify-center h-5 px-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold tnum">
                {totalIndividual}
              </span>
            )}
          </button>
        </div>
      </div>
    );
  }

  /* ═══════════ PANTALLA "GENERAL" ═══════════ */
  if (mode === "general") {
    return (
      <div className="flex flex-col gap-4">
        <BackHeader onBack={() => setMode("choose")} title={labels.generalTitle} hint={labels.generalHint} />
        {generalDocs.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {generalDocs.map((url, i) => (
              <PdfTile key={i} url={url} onRemove={() => removeGeneral(i)} />
            ))}
            <UploadTile onClick={addGeneral} label={labels.addUnit.replace("plano", "Añadir plano").replace("brochure", "Añadir brochure")} />
          </div>
        ) : (
          <UploadTileBig onClick={addGeneral} label={labels.uploadGeneral} />
        )}
      </div>
    );
  }

  /* ═══════════ PANTALLA "INDIVIDUAL" ═══════════ */
  return (
    <div className="flex flex-col gap-4">
      <BackHeader
        onBack={() => setMode("choose")}
        title={labels.individualTitle}
        hint={`Cada unidad puede tener su propio ${kind === "planos" ? "plano" : "brochure"} · click en "Añadir" para subir uno.`}
      />
      <div className="flex flex-col gap-3 max-h-[420px] overflow-y-auto pr-1 -mr-1">
        {state.unidades.map((u) => {
          const docs = u[unitKey] ?? [];
          const thumb = u.fotosUnidad?.[0]?.url;
          const label = u.nombre || u.ref || u.id;
          return (
            <div key={u.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-lg overflow-hidden bg-muted shrink-0">
                  {thumb ? (
                    <img src={thumb} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <HomeIcon className="h-3.5 w-3.5 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{label}</p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    {u.precio > 0
                      ? new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(u.precio)
                      : "Sin precio"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {docs.map((url, i) => (
                  <PdfTile key={i} url={url} onRemove={() => removeFromUnit(u.id, i)} />
                ))}
                <UploadTile onClick={() => addToUnit(u.id)} label={docs.length === 0 ? labels.uploadUnit : labels.addUnit} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Header con botón back · usado en pantallas "general" e "individual"
 *  · idéntico patrón que TipologiaQuickEdit. */
function BackHeader({
  onBack, title, hint,
}: {
  onBack: () => void;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        onClick={onBack}
        className="h-7 w-7 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 mt-0.5"
        aria-label="Volver"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {hint && <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">{hint}</p>}
      </div>
    </div>
  );
}

/* Tile grande de PDF · icono visible + nombre + ✕. Reemplaza al
 *  chip pequeño (`FileChip`) cuando se quiere mostrar bien los
 *  archivos subidos en el modal de archivos. */
function PdfTile({ url, onRemove }: { url: string; onRemove: () => void }) {
  const name = url.split("/").pop() || url;
  return (
    <div className="relative rounded-xl border border-border bg-background overflow-hidden hover:border-foreground/30 hover:shadow-soft transition-all group">
      <button
        type="button"
        onClick={onRemove}
        aria-label="Eliminar archivo"
        className="absolute top-1 right-1 h-6 w-6 inline-flex items-center justify-center rounded-full bg-background/95 backdrop-blur text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all shadow-soft border border-border"
      >
        <X className="h-3 w-3" />
      </button>
      <div className="aspect-square flex items-center justify-center bg-muted/30">
        <PdfIconLarge />
      </div>
      <div className="px-2 py-1.5 border-t border-border/40">
        <p className="text-[10.5px] font-medium text-foreground truncate" title={name}>{name}</p>
      </div>
    </div>
  );
}

/* Tile de upload · misma forma que PdfTile pero con + grande
 *  + dashed border para indicar "drop zone". Usado al lado de
 *  los PdfTiles para añadir más archivos. */
function UploadTile({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border-2 border-dashed border-border bg-background hover:border-foreground/40 hover:bg-muted/30 transition-colors flex flex-col items-center justify-center gap-1.5 aspect-square"
    >
      <Upload className="h-4 w-4 text-muted-foreground" />
      <span className="text-[10.5px] font-medium text-muted-foreground text-center px-2 leading-tight">{label}</span>
    </button>
  );
}

/* Tile grande · empty state cuando no hay archivos subidos en
 *  general · más prominent que el pequeño UploadTile. */
function UploadTileBig({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl border-2 border-dashed border-border bg-muted/20 hover:border-foreground/40 hover:bg-muted/40 transition-colors flex flex-col items-center justify-center gap-2 py-12"
    >
      <Upload className="h-6 w-6 text-muted-foreground/60" strokeWidth={1.5} />
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span className="text-[10.5px] text-muted-foreground">Click para seleccionar PDF</span>
    </button>
  );
}

/* Icono PDF grande para el tile · más visual que un FileText
 *  pequeño · cuadrado coloreado con "PDF" en grande. */
function PdfIconLarge() {
  return (
    <svg width="48" height="56" viewBox="0 0 48 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 4h22l10 10v34a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4z" fill="hsl(var(--destructive) / 0.1)" stroke="hsl(var(--destructive))" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M30 4v10h10" stroke="hsl(var(--destructive))" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
      <text x="24" y="40" textAnchor="middle" fontSize="12" fontWeight="700" fill="hsl(var(--destructive))" fontFamily="system-ui, sans-serif">PDF</text>
    </svg>
  );
}

/* `FileChip` y `FilePdfIcon` (chips pequeños) ELIMINADOS · sustituidos
 *  por `PdfTile` y `UploadTile` (tiles grandes con icono visible) ·
 *  el user pidió iconos más grandes y prominentes en el modal de
 *  archivos. */

/* Pin SVG · más compacto que el de lucide, alineado con el círculo
 *  del badge para que parezca un único elemento. */
function MapPinSolid() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
    </svg>
  );
}

/* ─── OperativaQuickEdit · piso piloto + oficinas de venta.
 *  Toggle pisoPiloto · si Sí, lista de unidades con radio para
 *  elegir cuál es el piloto. Si vuelve a No, limpia la selección. */
function OperativaQuickEdit({
  state, update,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
}) {
  const togglePiloto = (v: boolean) => {
    update("pisoPiloto", v);
    /* Off · limpiar el id seleccionado para no dejar un puntero
     *  huérfano en metadata. */
    if (!v && state.pisoPilotoUnidadId) {
      update("pisoPilotoUnidadId", null);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Piso piloto · toggle binario */}
      <section>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">¿Hay piso piloto?</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: true, label: "Sí" },
            { value: false, label: "No" },
          ].map((o) => (
            <button
              key={String(o.value)}
              type="button"
              onClick={() => togglePiloto(o.value)}
              className={`h-11 rounded-xl border text-sm font-medium transition-colors ${
                state.pisoPiloto === o.value
                  ? "border-primary/40 bg-primary/5 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/30"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </section>

      {/* Selector de unidad · solo cuando pisoPiloto=true. Mismo
          patrón que el dialog de la ficha (PromocionDetalle.tsx
          §Show Flat Picker) · radio cards con info compacta de cada
          unidad. */}
      {state.pisoPiloto && (
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">
            Elige la unidad que actuará como piso piloto
          </p>
          {state.unidades.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center">
              <p className="text-xs text-muted-foreground">
                Aún no has creado unidades · primero genera el inventario
                desde el paso "Unidades".
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-[320px] overflow-y-auto pr-1 -mr-1">
              {state.unidades.map((u) => {
                const selected = state.pisoPilotoUnidadId === u.id;
                const label = u.nombre || u.ref || u.id;
                const meta: string[] = [];
                if (u.dormitorios) meta.push(`${u.dormitorios} hab`);
                if (u.banos) meta.push(`${u.banos} baños`);
                if (u.superficieConstruida) meta.push(`${u.superficieConstruida} m²`);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => update("pisoPilotoUnidadId", u.id)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-foreground/30 hover:bg-muted/20"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-semibold text-muted-foreground">{u.planta ?? "—"}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{label}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {meta.length > 0 ? meta.join(" · ") : "Sin datos"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {u.precio > 0 && (
                        <p className="text-sm font-bold text-foreground tabular-nums">
                          {new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(u.precio)}
                        </p>
                      )}
                      {selected && (
                        <span className="text-[10px] font-semibold text-primary uppercase">Seleccionada</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Oficinas de venta · count + hint */}
      <section className="rounded-2xl border border-border bg-muted/20 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">Oficinas de venta</p>
        <p className="text-sm font-medium text-foreground">
          {state.oficinasVentaSeleccionadas.length === 0
            ? "Sin oficinas asignadas"
            : `${state.oficinasVentaSeleccionadas.length} ${state.oficinasVentaSeleccionadas.length === 1 ? "oficina" : "oficinas"} asignadas`}
        </p>
        <p className="text-[10.5px] text-muted-foreground/70 mt-1.5">
          Para añadir o quitar oficinas concretas, abre el paso completo
          desde la timeline lateral del wizard. Aquí solo verás el resumen.
        </p>
      </section>
    </div>
  );
}

/* ─── TipologiaQuickEdit · cambios destructivos · todo read-only +
 *  hint para entrar al wizard si el user quiere cambiarlo.
 *
 *  Antes había un toggle de Rol aquí · ahora vive en IdentidadQuickEdit
 *  para evitar duplicar surfaces. */
function TipologiaQuickEdit({ state }: { state: WizardState }) {
  const isUnifamiliar = state.tipo === "unifamiliar";
  const tipoLabel = tipoOptions.find((o) => o.value === state.tipo)?.label ?? "—";
  const subUniLabel = subUniOptions.find((o) => o.value === state.subUni)?.label ?? null;
  const subVariasLabel = subVariasOptions.find((o) => o.value === state.subVarias)?.label ?? null;

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl border border-border bg-muted/20 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">
          Estructura de la promoción
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <ReadOnlyRow label="Tipo" value={tipoLabel} />
          {isUnifamiliar && subUniLabel && <ReadOnlyRow label="Cantidad" value={subUniLabel} />}
          {isUnifamiliar && state.subUni === "una_sola" && subVariasLabel && (
            <ReadOnlyRow label="Modelo" value={subVariasLabel} />
          )}
          {isUnifamiliar && state.subUni === "varias" && state.tipologiasSeleccionadas.length > 0 && (
            <ReadOnlyRow
              label="Modelos"
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

/* ─── EstadoQuickEdit · Estado de obra + Licencia + Hito de
 *  construcción + Tipo de entrega + Meses tras contrato/licencia.
 *  Combina lo que el wizard pone en los pasos "estado" y
 *  "detalles" en un mini-popup compacto · pensado para el bloque
 *  Estructura de la ficha de promoción donde el promotor cambia
 *  estos campos a menudo. */
function EstadoQuickEdit({
  state, update,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
}) {
  const inputBase = "rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors";
  const trimestreOptions = futureTrimesterOptions();

  return (
    <div className="flex flex-col gap-5">
      {/* Estado de obra · 3 OptionCards */}
      <section>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">
          Estado de obra
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {estadoOptions.map((o) => (
            <OptionCard
              key={o.value}
              option={o}
              selected={state.estado === o.value}
              onSelect={(v) => {
                update("estado", v as WizardState["estado"]);
                /* Limpiar campos no aplicables al cambiar de estado · evita
                 * estado inconsistente (ej. licencia=true en proyecto
                 * cuando el user ya pasó a en_construccion). */
                if (v !== "proyecto") update("tieneLicencia", null);
                if (v !== "en_construccion") update("faseConstruccion", null);
              }}
            />
          ))}
        </div>
      </section>

      {/* Licencia · solo cuando estado=proyecto */}
      {state.estado === "proyecto" && (
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">
            ¿Tiene licencia de obra?
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => update("tieneLicencia", true)}
              className={`text-left rounded-lg border px-3.5 py-3 transition-colors flex items-center gap-2.5 ${
                state.tieneLicencia === true
                  ? "border-success bg-success/5"
                  : "border-border hover:border-success/30"
              }`}
            >
              <FileCheck className="h-4 w-4 text-success shrink-0" strokeWidth={1.75} />
              <div>
                <p className="text-xs font-semibold text-foreground">Con licencia</p>
                <p className="text-[10.5px] text-muted-foreground">Licencia concedida</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => update("tieneLicencia", false)}
              className={`text-left rounded-lg border px-3.5 py-3 transition-colors flex items-center gap-2.5 ${
                state.tieneLicencia === false
                  ? "border-warning bg-warning/5"
                  : "border-border hover:border-warning/30"
              }`}
            >
              <FileX className="h-4 w-4 text-warning shrink-0" strokeWidth={1.75} />
              <div>
                <p className="text-xs font-semibold text-foreground">Sin licencia</p>
                <p className="text-[10.5px] text-muted-foreground">Pendiente de licencia</p>
              </div>
            </button>
          </div>
        </section>
      )}

      {/* Fase de construcción · solo cuando estado=en_construccion */}
      {state.estado === "en_construccion" && (
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">
            Etapa de construcción
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {faseConstruccionOptions.map((o) => (
              <OptionCard
                key={o.value}
                option={o}
                selected={state.faseConstruccion === o.value}
                onSelect={(v) => update("faseConstruccion", v as WizardState["faseConstruccion"])}
              />
            ))}
          </div>
        </section>
      )}

      {/* Fecha de entrega · siempre visible salvo "terminado" */}
      {state.estado !== "terminado" && (
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">
            Tipo de entrega
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => update("tipoEntrega", "fecha_definida")}
              className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${
                state.tipoEntrega === "fecha_definida" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
              }`}
            >
              <p className="text-[12px] font-semibold text-foreground">Fecha definida</p>
              <p className="text-[10.5px] text-muted-foreground">Trimestre concreto</p>
            </button>
            <button
              type="button"
              onClick={() => update("tipoEntrega", "tras_contrato_cv")}
              className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${
                state.tipoEntrega === "tras_contrato_cv" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
              }`}
            >
              <p className="text-[12px] font-semibold text-foreground">Tras contrato C/V</p>
              <p className="text-[10.5px] text-muted-foreground">X meses después</p>
            </button>
            {state.estado === "proyecto" && state.tieneLicencia === false && (
              <button
                type="button"
                onClick={() => update("tipoEntrega", "tras_licencia")}
                className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${
                  state.tipoEntrega === "tras_licencia" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                }`}
              >
                <p className="text-[12px] font-semibold text-foreground">Tras licencia</p>
                <p className="text-[10.5px] text-muted-foreground">X meses después</p>
              </button>
            )}
          </div>

          {/* Trimestre · si fecha_definida */}
          {state.tipoEntrega === "fecha_definida" && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {trimestreOptions.map((t) => {
                const on = state.trimestreEntrega === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => update("trimestreEntrega", t)}
                    className={`rounded-lg border px-2 py-2 text-[11.5px] font-semibold transition-colors tnum ${
                      on ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          )}

          {/* Meses · si tras_contrato_cv */}
          {state.tipoEntrega === "tras_contrato_cv" && (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={state.mesesTrasContrato > 0 ? String(state.mesesTrasContrato) : ""}
                placeholder="0"
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^0-9]/g, "");
                  update("mesesTrasContrato", digits === "" ? 0 : Math.min(120, Number(digits)));
                }}
                className={`${inputBase} h-9 w-24 px-2.5 text-[13px] tnum text-right`}
              />
              <span className="text-[12px] text-muted-foreground">meses tras la firma del contrato</span>
            </div>
          )}

          {/* Meses · si tras_licencia */}
          {state.tipoEntrega === "tras_licencia" && (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={state.mesesTrasLicencia > 0 ? String(state.mesesTrasLicencia) : ""}
                placeholder="0"
                onChange={(e) => {
                  const digits = e.target.value.replace(/[^0-9]/g, "");
                  update("mesesTrasLicencia", digits === "" ? 0 : Math.min(120, Number(digits)));
                }}
                className={`${inputBase} h-9 w-24 px-2.5 text-[13px] tnum text-right`}
              />
              <span className="text-[12px] text-muted-foreground">meses tras obtener la licencia</span>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
