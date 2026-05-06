/**
 * RevisionStep · Paso final "Revisión antes de publicar".
 *
 * Resumen navegable de todo el WizardState agrupado por DOMINIO ·
 * cada bloque representa UNA cosa (no mezcla construcción con
 * comercialización · no duplica amenities en 2 sitios). Click en
 * "Editar" abre modal del step correspondiente sin re-navegar
 * todo el wizard.
 *
 * 7 bloques canónicos (orden de arriba abajo):
 *   1. Identidad                      · rol · nombre · referencia
 *   2. Tipo y estructura              · tipo · cantidad · modelos · edificio
 *   3. Construcción y entrega         · estado · fase · cert · entrega
 *   4. Ubicación                      · dirección
 *   5. Características                · extras del wizard step 5 (V5)
 *   6. Multimedia y comunicación      · descripción · fotos · vídeos
 *   7. Unidades y comercialización    · inventario + comisiones + pagos
 *                                       + piso piloto + oficinas
 *
 * Banners arriba: "Faltan X requisitos" / "Todo listo" + "Solo uso
 * interno" si aplica. Footer "Lo que se activará" lista qué se
 * encenderá al pulsar Activar.
 */

import {
  CheckCircle2, AlertCircle, Pencil, Home, Building2, Users, Banknote,
  MapPin, AlertTriangle, FileText,
  Sparkles, HardHat, Hash, Camera, Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { resolvePriceRange } from "@/lib/priceRange";
import {
  tipoOptions, subUniOptions, subVariasOptions, estadoOptions,
  faseConstruccionOptions, formaPagoComisionOptions,
} from "./options";
import type { WizardState, StepId } from "./types";
import { getMissingForWizard } from "@/lib/publicationRequirements"; // validación de requisitos mínimos para publicar

interface Props {
  state: WizardState;
  onEditStep: (step: StepId) => void;
  /** Callback opcional para eliminar la promoción · solo se renderiza
   *  el bloque danger si está presente (= modo edición de promo
   *  existente, NO modo creación). */
  onDeletePromotion?: () => void | Promise<void>;
}

/* ─── Utils ─── */
const eur = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

const dash = "—";

/* ─── Primitivas ─── */
function SectionCard({
  icon: Icon, title, onEdit, complete, children,
}: {
  icon: React.ElementType;
  title: string;
  onEdit?: () => void;
  complete: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-soft overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
            <Icon className="h-4 w-4" strokeWidth={1.5} />
          </div>
          <h3 className="text-sm font-semibold text-foreground truncate">{title}</h3>
          {complete ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" strokeWidth={2} />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 text-warning shrink-0" strokeWidth={2} />
          )}
        </div>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 h-7 px-3 rounded-full border border-border bg-card text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Pencil className="h-3 w-3" strokeWidth={1.5} />
            Editar
          </button>
        )}
      </div>
      <div className="px-5 py-3">{children}</div>
    </div>
  );
}

function Row({ label, value, muted = false }: { label: string; value: React.ReactNode; muted?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-1.5 text-xs">
      <span className="text-muted-foreground min-w-[128px] shrink-0">{label}</span>
      <span className={cn("text-foreground flex-1 min-w-0", muted && "text-muted-foreground")}>
        {value || <span className="text-muted-foreground/60">{dash}</span>}
      </span>
    </div>
  );
}

/* ─── Step principal ─── */
export function RevisionStep({ state, onEditStep, onDeletePromotion }: Props) {
  /* ──── Tipología ──── */
  const tipoLabel = tipoOptions.find((o) => o.value === state.tipo)?.label ?? dash;
  const subUniLabel = state.tipo === "unifamiliar"
    ? subUniOptions.find((o) => o.value === state.subUni)?.label ?? dash
    : null;
  /* Modelo individual SOLO aplica a "una sola vivienda" · cuando es
   * "varias" el modelo de cada villa vive en `tipologiasSeleccionadas`
   * (chips × cantidad) · evita la fila "Modelo: —" duplicada arriba. */
  const subVariasLabel = state.tipo === "unifamiliar" && state.subUni === "una_sola"
    ? subVariasOptions.find((o) => o.value === state.subVarias)?.label ?? dash
    : null;

  const edificioResumen = (state.tipo === "plurifamiliar" || state.tipo === "mixto")
    ? `${state.numBloques} bloque${state.numBloques > 1 ? "s" : ""} · ${state.plantas} planta${state.plantas > 1 ? "s" : ""} · ${state.aptosPorPlanta} viviendas/planta`
    : null;

  const tipologiaComplete = !!state.role && !!state.tipo;

  /* ──── Comercialización ──── */
  const estadoLabel = estadoOptions.find((o) => o.value === state.estado)?.label ?? dash;
  const faseLabel = faseConstruccionOptions.find((o) => o.value === state.faseConstruccion)?.label ?? null;
  const comercComplete = !!state.estado;

  /* ──── Marketing ──── */
  const direccionCompleta = [
    state.direccionPromocion.direccion,
    state.direccionPromocion.ciudad,
    state.direccionPromocion.provincia,
    state.direccionPromocion.pais,
  ].filter(Boolean).join(", ");

  const totalIdiomas = 1 + Object.values(state.descripcionIdiomas).filter(Boolean).length;
  const marketingComplete = !!state.nombrePromocion && !!direccionCompleta;

  /* ──── Características por defecto (V5 extras) ────
   *  Lista PLANA de labels activos · agrupa esenciales (anejos) +
   *  adicionales (equipamiento/seguridad/vistas/orientación).
   *  Bug histórico · faltaba `basement` (sótano) y la lista de
   *  vistas estaba truncada (solo 4 de 10 tipos). Ahora se valida
   *  con `Object.values(d.views).some(...)` para cubrir todas las
   *  variantes futuras sin tener que mantener una lista en sync. */
  const d = state.promotionDefaults;
  const extrasActiveLabels: string[] = [];
  if (d) {
    if (d.privatePool.enabled) extrasActiveLabels.push("Piscina privada");
    if (d.parking.enabled) extrasActiveLabels.push("Parking");
    if (d.storageRoom.enabled) extrasActiveLabels.push("Trastero");
    if (d.basement?.enabled) extrasActiveLabels.push("Sótano");
    if (d.plot.enabled) extrasActiveLabels.push("Parcela");
    if (d.solarium.enabled) extrasActiveLabels.push("Solárium");
    if (d.terraces.covered || d.terraces.uncovered) extrasActiveLabels.push("Terrazas");
    /* "Más opciones" · cualquier flag true en cada sub-objeto. */
    if (Object.values(d.equipment).some((v) => v === true)) extrasActiveLabels.push("Equipamiento");
    if (Object.values(d.security).some((v) => v === true)) extrasActiveLabels.push("Seguridad");
    if (Object.values(d.views).some((v) => v === true)) extrasActiveLabels.push("Vistas");
    if (d.orientation) extrasActiveLabels.push("Orientación");
  }
  /* No es obligatorio · siempre "completo" para no bloquear publicación. */
  const extrasComplete = true;

  /* ──── Unidades + comercialización ──── */
  const unidadesCount = state.unidades.length;
  const precioMedio = unidadesCount > 0
    ? state.unidades.reduce((s, u) => s + (u.precio || 0), 0) / unidadesCount
    : 0;
  /* Helper canónico · snapshot all-units · al revisar mostramos
   *  el rango total porque aún no hay ventas (estamos creando). */
  const { min: rangoMin, max: rangoMax } = resolvePriceRange(state.unidades);

  const formaPagoLabel = formaPagoComisionOptions.find((o) => o.value === state.formaPagoComision)?.label ?? dash;
  const metodoPagoLabel = state.metodoPago === "contrato" ? "Definido en contrato"
    : state.metodoPago === "manual" ? "Plan manual"
    : state.metodoPago === "certificaciones" ? "Por certificación" : dash;

  /* ──── Completness por bloque (los 7 nuevos) ──── */
  const identidadComplete = !!state.role && !!state.nombrePromocion?.trim();
  const ubicacionComplete = !!direccionCompleta;
  const multimediaComplete = state.fotos.length > 0;
  const unidadesComercComplete = unidadesCount > 0 && !!state.metodoPago;

  // ══ Requisitos obligatorios para publicar (bloquean el botón) ══
  // Ver src/lib/publicationRequirements.ts
  const missing = getMissingForWizard(state);
  const canPublish = missing.length === 0;

  return (
    <div className="flex flex-col gap-4">
      {/* ═════ Banner de requisitos (bloquea publicación) ═════
            La checklist completa de publicación vive en la sidebar
            (PhaseTimeline) — aquí sólo mostramos aviso compacto. */}
      {missing.length > 0 ? (
        <div className="rounded-xl border border-warning/30 bg-warning/10 px-5 py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" strokeWidth={1.5} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">
                Faltan {missing.length} requisito{missing.length > 1 ? "s" : ""} para activar
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Revisa la checklist lateral para completarlos. El botón "Activar" se habilitará cuando estén todos resueltos.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-5 py-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" strokeWidth={1.8} />
          <div>
            <p className="text-sm font-semibold text-foreground">Todo listo para activar</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cumples los requisitos. Pulsa <span className="font-medium text-foreground">Activar</span> abajo a la derecha para lanzar la promoción.
            </p>
          </div>
        </div>
      )}

      {/* ═════ Banner "uso interno" ═════
            Cuando colaboracion=false la promo NO se comparte con
            agencias · queda activa solo para uso interno del workspace
            (catálogo propio + microsite si lo activan luego). Lo
            llamamos explícitamente para que el user sepa qué publica. */}
      {!state.colaboracion && missing.length === 0 && (
        <div className="rounded-xl border border-foreground/15 bg-muted/30 px-5 py-4 flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground/5 text-foreground shrink-0">
            <Home className="h-4 w-4" strokeWidth={1.6} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Solo para uso interno</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              No has activado la colaboración con agencias · esta promoción
              queda en tu catálogo interno y <span className="font-medium text-foreground">no se compartirá con tu red de colaboradores</span>.
              Podrás activar la colaboración más adelante desde la ficha.
            </p>
          </div>
        </div>
      )}

      {/* Card de progreso global ELIMINADA · era redundante con el
          banner de arriba (que ya dice "todo listo" o "faltan X
          requisitos") y con la sección "Lo que se activará" de abajo.
          Tres veces el mismo mensaje en una pantalla = ruido. */}

      {/* ═════ 1 · IDENTIDAD ═════
          Editar abre `IdentidadQuickEdit` (mini-modal) · solo Rol +
          Nombre + Ref(ro) · sin contaminar con campos de otros bloques. */}
      <SectionCard icon={Hash} title="Identidad" complete={identidadComplete} onEdit={() => onEditStep("identidad")}>
        <Row label="Rol" value={state.role === "promotor" ? "Promotor" : state.role === "comercializador" ? "Comercializador" : null} />
        <Row label="Nombre comercial" value={state.nombrePromocion || null} />
        <Row label="Referencia" value={state.publicRef || state.refPromocion || null} />
      </SectionCard>

      {/* ═════ 2 · TIPO Y ESTRUCTURA ═════
          Una sola fila "Tipo" que ya incluye unifamiliar/plurifamiliar
          + cantidad (vivienda/viviendas/edificio). Antes "Tipo de
          promoción" + "Cantidad" daban la misma info dos veces. */}
      {(() => {
        const combinedTipo = state.tipo === "unifamiliar"
          ? state.subUni === "una_sola" ? "Vivienda unifamiliar"
            : state.subUni === "varias" ? "Viviendas unifamiliares"
            : tipoLabel
          : state.tipo === "plurifamiliar" ? "Edificio plurifamiliar"
          : tipoLabel;
        return (
      <SectionCard icon={Building2} title="Tipo y estructura" complete={tipologiaComplete} onEdit={() => onEditStep("tipo")}>
        <Row label="Tipo" value={combinedTipo} />
        {subVariasLabel && <Row label="Modelo" value={subVariasLabel} />}
        {state.tipologiasSeleccionadas.length > 0 && (
          <Row
            label="Modelos"
            value={
              <div className="flex flex-wrap gap-1.5">
                {state.tipologiasSeleccionadas.map((t) => (
                  <span key={t.tipo} className="inline-flex items-center gap-1 rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary">
                    {subVariasOptions.find((o) => o.value === t.tipo)?.label} × {t.cantidad}
                  </span>
                ))}
              </div>
            }
          />
        )}
        {edificioResumen && <Row label="Edificio" value={edificioResumen} />}
      </SectionCard>
        );
      })()}

      {/* ═════ 3 · CONSTRUCCIÓN Y ENTREGA ═════
          Antes mezclaba con piso piloto / oficinas (eso es comerciali-
          zación). Aquí solo lo que toca a la OBRA · estado legal,
          fase de obra granular y cuando entrega. */}
      <SectionCard icon={HardHat} title="Construcción y entrega" complete={comercComplete} onEdit={() => onEditStep("detalles")}>
        <Row label="Estado legal" value={estadoLabel} />
        {faseLabel && <Row label="Fase de obra" value={faseLabel} />}
        {state.certificadoEnergetico && <Row label="Cert. energético" value={state.certificadoEnergetico} />}
        {state.fechaEntrega && <Row label="Fecha entrega" value={state.fechaEntrega} />}
        {state.trimestreEntrega && <Row label="Trimestre entrega" value={state.trimestreEntrega} />}
      </SectionCard>

      {/* ═════ 4 · UBICACIÓN ═════
          Editar abre `UbicacionQuickEdit` (mini-modal) · solo
          dirección · sin contaminar con cert. energético, amenities
          o cualquier otra cosa de info_basica. */}
      <SectionCard icon={MapPin} title="Ubicación" complete={ubicacionComplete} onEdit={() => onEditStep("ubicacion")}>
        <Row label="Dirección" value={direccionCompleta || null} />
      </SectionCard>

      {/* ═════ 5 · CARACTERÍSTICAS ═════
          Lo del wizard step 5 (V5 extras). Antes había DOS bloques
          casi iguales · "Características por defecto" + "Amenities/
          Características" en Información. Unificado aquí. */}
      <SectionCard icon={Sparkles} title="Características" complete={extrasComplete} onEdit={() => onEditStep("extras")}>
        {extrasActiveLabels.length > 0 ? (
          <Row
            label="Activadas"
            value={
              <div className="flex flex-wrap gap-1.5">
                {extrasActiveLabels.map((l) => (
                  <span key={l} className="inline-flex items-center rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary">
                    {l}
                  </span>
                ))}
              </div>
            }
          />
        ) : (
          <Row label="Activadas" value={null} />
        )}
        <p className="text-[10.5px] text-muted-foreground/80 mt-2 leading-relaxed">
          Cada vivienda hereda estas características al generarse. Edita aquí para cambiar las opciones esenciales y las "Más opciones" (equipamiento, vistas, seguridad, etc.).
        </p>
      </SectionCard>

      {/* ═════ 6 · MULTIMEDIA Y COMUNICACIÓN ═════
          Bloque propio · 2 sub-secciones separadas:
            - Multimedia · strip de thumbnails reales (no chip count)
              + count de vídeos · click abre el editor de fotos.
            - Descripción · preview del texto + idiomas · click abre
              el editor de descripción. Antes los 3 sub-cards (Desc ·
              Fotos · Vídeos) eran cajitas con count seco · poco útil
              para validar de un vistazo qué hay subido. */}
      <SectionCard icon={Camera} title="Multimedia y comunicación" complete={multimediaComplete} onEdit={() => onEditStep("multimedia")}>
        {/* Sub-sección 1 · Fotos + Vídeos */}
        <button
          type="button"
          onClick={() => onEditStep("multimedia")}
          className="w-full rounded-xl border border-border bg-muted/20 px-3 py-3 hover:bg-muted/40 transition-colors text-left mb-3 group"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Multimedia
            </p>
            <span className="text-[10.5px] text-muted-foreground tnum">
              {state.fotos.length > 0
                ? `${state.fotos.length} ${state.fotos.length === 1 ? "foto" : "fotos"}`
                : "Sin fotos"}
              {state.videos.length > 0 && ` · ${state.videos.length} ${state.videos.length === 1 ? "vídeo" : "vídeos"}`}
            </span>
          </div>
          {state.fotos.length > 0 ? (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {state.fotos.slice(0, 8).map((f, i) => (
                <div key={f.url ?? i} className="relative h-14 w-14 rounded-md overflow-hidden bg-background shrink-0 border border-border/40">
                  {f.url ? (
                    <img src={f.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full bg-muted" />
                  )}
                  {f.esPrincipal && (
                    <span className="absolute top-0.5 left-0.5 inline-flex items-center justify-center h-3 px-1 rounded bg-primary text-primary-foreground text-[8px] font-semibold uppercase">
                      Principal
                    </span>
                  )}
                </div>
              ))}
              {state.fotos.length > 8 && (
                <div className="h-14 w-14 rounded-md bg-muted/60 shrink-0 flex items-center justify-center border border-border/40">
                  <span className="text-[11px] font-medium text-muted-foreground">+{state.fotos.length - 8}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="h-14 rounded-md border border-dashed border-border bg-background/40 flex items-center justify-center">
              <p className="text-[10.5px] text-muted-foreground/70">Aún no hay fotos · click para subir</p>
            </div>
          )}
        </button>

        {/* Sub-sección 2 · Descripción · separada visualmente */}
        <button
          type="button"
          onClick={() => onEditStep("descripcion")}
          className="w-full rounded-xl border border-border bg-muted/20 px-3 py-3 hover:bg-muted/40 transition-colors text-left"
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Descripción
            </p>
            <span className="text-[10.5px] text-muted-foreground">
              {state.descripcionMode === "ai"
                ? "Generar con IA"
                : state.descripcion
                  ? `${totalIdiomas} ${totalIdiomas === 1 ? "idioma" : "idiomas"}`
                  : "Sin redactar"}
            </span>
          </div>
          {state.descripcion ? (
            <p className="text-xs text-foreground/85 line-clamp-3 leading-relaxed">
              {state.descripcion}
            </p>
          ) : (
            <p className="text-[10.5px] text-muted-foreground/70">
              Aún no hay descripción · click para redactar
            </p>
          )}
        </button>
      </SectionCard>

      {/* ═════ 7 · ARCHIVOS ═════
          Planos + Brochure (catálogo) · cada uno tiene SU PROPIO
          modal · sub-cards llevan a `planos` o `brochure` step. */}
      {(() => {
        const planosGeneral = state.documentosPlanos?.length ?? 0;
        const brochureGeneral = state.documentosBrochure?.length ?? 0;
        const planosPorUnidad = state.unidades.reduce((sum, u) => sum + (u.planoUrls?.length ?? 0), 0);
        const brochurePorUnidad = state.unidades.reduce((sum, u) => sum + (u.brochureUrls?.length ?? 0), 0);
        const totalPlanos = planosGeneral + planosPorUnidad;
        const totalBrochure = brochureGeneral + brochurePorUnidad;
        const archivosComplete = totalPlanos > 0 || totalBrochure > 0;
        return (
      <SectionCard icon={FileText} title="Archivos" complete={archivosComplete} onEdit={() => onEditStep("planos")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onEditStep("planos")}
            className="rounded-lg border border-border bg-muted/20 px-3 py-2 flex items-center gap-2 hover:bg-muted/40 transition-colors text-left"
          >
            <FileText className="h-4 w-4 text-primary shrink-0" strokeWidth={1.5} />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Planos</p>
              <p className="text-xs text-foreground truncate">
                {totalPlanos === 0 ? "Sin planos subidos"
                  : `${totalPlanos} ${totalPlanos === 1 ? "archivo" : "archivos"}${planosPorUnidad > 0 ? ` · ${planosPorUnidad} por unidad` : ""}`}
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => onEditStep("brochure")}
            className="rounded-lg border border-border bg-muted/20 px-3 py-2 flex items-center gap-2 hover:bg-muted/40 transition-colors text-left"
          >
            <FileText className="h-4 w-4 text-primary shrink-0" strokeWidth={1.5} />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Brochure / Catálogo</p>
              <p className="text-xs text-foreground truncate">
                {totalBrochure === 0 ? "Sin brochure subido"
                  : `${totalBrochure} ${totalBrochure === 1 ? "archivo" : "archivos"}${brochurePorUnidad > 0 ? ` · ${brochurePorUnidad} por unidad` : ""}`}
              </p>
            </div>
          </button>
        </div>
      </SectionCard>
        );
      })()}

      {/* ═════ 8 · UNIDADES Y COMERCIALIZACIÓN ═════
          Inventario + ventas. Cada sub-acción tiene su propio modal:
            · Editar (botón card) → unidades (tabla bulk-edit)
            · Sub-card Piso piloto/Oficinas → operativa
            · Sub-card Comisiones → colaboradores
            · Sub-card Plan de pagos → plan_pagos */}
      <SectionCard icon={Layers} title="Unidades y comercialización" complete={unidadesComercComplete} onEdit={() => onEditStep("crear_unidades")}>
        {unidadesCount > 0 ? (
          <>
            <Row label="Unidades" value={`${unidadesCount}`} />
            <Row label="Rango de precios" value={rangoMin === rangoMax ? eur(rangoMin) : `${eur(rangoMin)} — ${eur(rangoMax)}`} />
            <Row label="Precio medio" value={eur(Math.round(precioMedio))} />
          </>
        ) : (
          <Row label="Unidades" value={null} />
        )}

        <div className="mt-3 pt-3 border-t border-border grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => onEditStep("operativa")}
            className="rounded-lg border border-border bg-muted/20 px-3 py-2 flex items-center gap-2 hover:bg-muted/40 transition-colors text-left"
          >
            <Building2 className="h-4 w-4 text-primary shrink-0" strokeWidth={1.5} />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Piso piloto · Oficinas</p>
              <p className="text-xs text-foreground truncate">
                {state.pisoPiloto ? "Con piso piloto" : "Sin piso piloto"}
                {state.oficinasVentaSeleccionadas.length > 0 && ` · ${state.oficinasVentaSeleccionadas.length} ${state.oficinasVentaSeleccionadas.length === 1 ? "oficina" : "oficinas"}`}
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => onEditStep("colaboradores")}
            className="rounded-lg border border-border bg-muted/20 px-3 py-2 flex items-center gap-2 hover:bg-muted/40 transition-colors text-left"
          >
            <Users className="h-4 w-4 text-primary shrink-0" strokeWidth={1.5} />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Comisiones</p>
              <p className="text-xs text-foreground truncate tnum">
                {!state.colaboracion
                  ? "Uso interno · sin colaboración"
                  : !state.formaPagoComision || state.comisionInternacional === 0
                    ? "Sin configurar"
                    : state.diferenciarNacionalInternacional
                      ? `${state.comisionInternacional}% intl · ${state.comisionNacional}% nac · pago ${formaPagoLabel.toLowerCase()}`
                      : `${state.comisionInternacional}% · pago ${formaPagoLabel.toLowerCase()}`}
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => onEditStep("plan_pagos")}
            className="rounded-lg border border-border bg-muted/20 px-3 py-2 flex items-center gap-2 hover:bg-muted/40 transition-colors text-left"
          >
            <Banknote className="h-4 w-4 text-primary shrink-0" strokeWidth={1.5} />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Plan de pagos</p>
              <p className="text-xs text-foreground truncate">
                {metodoPagoLabel}
                {state.requiereReserva === true && ` · reserva ${eur(state.importeReserva)}`}
              </p>
            </div>
          </button>
        </div>
      </SectionCard>

      {/* ═════ Lo que se activará ═════ */}
      <div className="rounded-xl border border-primary/30 bg-primary/5 px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary mb-2">
          Lo que se activará
        </p>
        <ul className="flex flex-col gap-1.5 text-xs text-foreground">
          {state.nombrePromocion && (
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" strokeWidth={2} />
              <span>
                Microsite público en <span className="font-medium">byvaro.com/{state.nombrePromocion.toLowerCase().replace(/\s+/g, "-")}</span>
              </span>
            </li>
          )}
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" strokeWidth={2} />
            <span>
              {unidadesCount > 0 ? `${unidadesCount} unidades` : "Sin unidades"} disponibles en tu catálogo interno{state.colaboracion ? " y para tus colaboradores" : ""}.
            </span>
          </li>
          {state.colaboracion && (
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" strokeWidth={2} />
              <span>
                Podrás compartir la promoción con agencias colaboradoras desde la ficha (botón "Compartir").
              </span>
            </li>
          )}
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" strokeWidth={2} />
            <span>Podrás seguir editando todos los datos desde la ficha de la promoción.</span>
          </li>
        </ul>
        <p className="text-[11px] text-muted-foreground mt-3 italic">
          Pulsa <span className="font-medium text-foreground">Activar</span> abajo a la derecha para lanzar la promoción.
        </p>
      </div>

      {/* ═════ Zona danger · Eliminar promoción ═════
        * Solo visible cuando estamos editando una promo existente
        * (callback `onDeletePromotion` provisto por el caller). El
        * botón estaba antes en el rail de la ficha · movido aquí
        * para agrupar acciones destructivas en un solo sitio
        * (Configuración) y evitar clicks accidentales en la ficha. */}
      {onDeletePromotion && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-destructive">
                Eliminar promoción
              </p>
              <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">
                Borra la promoción permanentemente del catálogo y de la base
                de datos. Esta acción NO se puede deshacer · perderás todas
                las unidades, fotos, colaboradores y registros asociados.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void onDeletePromotion()}
              className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-full text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors shrink-0"
            >
              Eliminar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
