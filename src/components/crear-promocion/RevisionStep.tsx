/**
 * RevisionStep · Paso final "Revisión antes de publicar".
 *
 * NO existe en la referencia figgy-friend-forge — se diseña aquí por
 * primera vez. Muestra un resumen navegable de todo el WizardState
 * agrupado por fase, con acceso directo a cada paso para editar.
 *
 * Bloques:
 *   1. Tipología        → role · tipo · subUni / config edificio
 *   2. Comercialización → estado · entrega · detalles finales
 *   3. Marketing        → info básica · descripción · multimedia (counts)
 *   4. Operativa        → unidades (count + precio medio) · colaboradores
 *                         (% comisión) · plan de pagos (método)
 *
 * Al final, checklist de "Lo que se publicará" + hint CTA sobre el
 * botón "Publicar" del footer. El paso no tiene validación propia
 * (el botón Publicar solo se activa si `canContinue()` del padre pasa).
 */

import {
  CheckCircle2, AlertCircle, Pencil, Home, Building2, Users, Banknote,
  Image as ImageIcon, FileText, MapPin, Globe, AlertTriangle, ArrowRight, Check,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  tipoOptions, subUniOptions, subVariasOptions, estadoOptions,
  faseConstruccionOptions, formaPagoComisionOptions,
} from "./options";
import type { WizardState, StepId } from "./types";
import { getMissingForWizard } from "@/lib/publicationRequirements"; // validación de requisitos mínimos para publicar

interface Props {
  state: WizardState;
  onEditStep: (step: StepId) => void;
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
export function RevisionStep({ state, onEditStep }: Props) {
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

  /* ──── Características por defecto (V5 extras) ──── */
  const d = state.promotionDefaults;
  const extrasActiveLabels: string[] = [];
  if (d) {
    if (d.privatePool.enabled) extrasActiveLabels.push("Piscina privada");
    if (d.parking.enabled) extrasActiveLabels.push("Parking");
    if (d.storageRoom.enabled) extrasActiveLabels.push("Trastero");
    if (d.plot.enabled) extrasActiveLabels.push("Parcela");
    if (d.solarium.enabled) extrasActiveLabels.push("Solárium");
    if (d.terraces.covered || d.terraces.uncovered) extrasActiveLabels.push("Terrazas");
    /* "Más opciones" */
    if (Object.values(d.equipment).some((v) => v && v !== null)) extrasActiveLabels.push("Equipamiento");
    if (d.security.alarm || d.security.reinforcedDoor || d.security.videoSurveillance) extrasActiveLabels.push("Seguridad");
    if (d.views.sea || d.views.mountain || d.views.golf || d.views.panoramic) extrasActiveLabels.push("Vistas");
    if (d.orientation) extrasActiveLabels.push("Orientación");
  }
  /* No es obligatorio · siempre "completo" para no bloquear publicación. */
  const extrasComplete = true;

  /* ──── Operativa ──── */
  const unidadesCount = state.unidades.length;
  const precioMedio = unidadesCount > 0
    ? state.unidades.reduce((s, u) => s + (u.precio || 0), 0) / unidadesCount
    : 0;
  const rangoMin = unidadesCount > 0 ? Math.min(...state.unidades.map((u) => u.precio || 0)) : 0;
  const rangoMax = unidadesCount > 0 ? Math.max(...state.unidades.map((u) => u.precio || 0)) : 0;

  const formaPagoLabel = formaPagoComisionOptions.find((o) => o.value === state.formaPagoComision)?.label ?? dash;
  const metodoPagoLabel = state.metodoPago === "contrato" ? "Definido en contrato"
    : state.metodoPago === "manual" ? "Plan manual"
    : state.metodoPago === "certificaciones" ? "Por certificación" : dash;

  const operativaComplete = unidadesCount > 0 && !!state.metodoPago;

  /* ──── Progreso global ──── */
  const sections = [tipologiaComplete, comercComplete, marketingComplete, operativaComplete];
  const completedCount = sections.filter(Boolean).length;
  const percent = Math.round((completedCount / sections.length) * 100);

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

      {/* ═════ TIPOLOGÍA ═════ */}
      <SectionCard icon={Home} title="Tipología" complete={tipologiaComplete} onEdit={() => onEditStep("tipo")}>
        <Row label="Rol" value={state.role === "promotor" ? "Promotor" : state.role === "comercializador" ? "Comercializador" : null} />
        <Row label="Tipo de promoción" value={tipoLabel} />
        {subUniLabel && <Row label="Cantidad" value={subUniLabel} />}
        {subVariasLabel && <Row label="Modelo" value={subVariasLabel} />}
        {edificioResumen && <Row label="Estructura" value={edificioResumen} />}
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
      </SectionCard>

      {/* ═════ CARACTERÍSTICAS POR DEFECTO (V5 extras) ═════ */}
      <SectionCard icon={Sparkles} title="Características por defecto" complete={extrasComplete} onEdit={() => onEditStep("extras")}>
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

      {/* ═════ COMERCIALIZACIÓN ═════
          onEditStep("detalles") · DetallesStep cubre estado + fase +
          fecha entrega + piso piloto + oficinas (todo lo de esta
          sección) · y SÍ tiene componente para abrirse en modal. */}
      <SectionCard icon={Building2} title="Comercialización" complete={comercComplete} onEdit={() => onEditStep("detalles")}>
        <Row label="Estado" value={estadoLabel} />
        {faseLabel && <Row label="Fase de obra" value={faseLabel} />}
        {state.fechaEntrega && <Row label="Entrega" value={state.fechaEntrega} />}
        {state.trimestreEntrega && <Row label="Trimestre entrega" value={state.trimestreEntrega} />}
        <Row label="Piso piloto" value={state.pisoPiloto ? "Sí" : "No"} />
        <Row label="Oficinas de venta" value={state.oficinasVentaSeleccionadas.length > 0 ? `${state.oficinasVentaSeleccionadas.length}` : "No"} />
      </SectionCard>

      {/* ═════ INFORMACIÓN ═════ */}
      <SectionCard icon={MapPin} title="Información" complete={marketingComplete} onEdit={() => onEditStep("info_basica")}>
        <Row label="Nombre" value={state.nombrePromocion || null} />
        <Row label="Dirección" value={direccionCompleta || null} />
        {state.certificadoEnergetico && <Row label="Cert. energético" value={state.certificadoEnergetico} />}
        <Row
          label="Amenities"
          value={state.amenities.length > 0 ? `${state.amenities.length} seleccionadas` : null}
        />
        <Row
          label="Características"
          value={state.caracteristicasVivienda.length > 0 ? `${state.caracteristicasVivienda.length} seleccionadas` : null}
        />
        <div className="mt-2 pt-2 border-t border-border grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => onEditStep("descripcion")}
            className="rounded-lg border border-border bg-muted/20 px-3 py-2 flex items-center gap-2 hover:bg-muted/40 transition-colors text-left"
          >
            <FileText className="h-4 w-4 text-primary shrink-0" strokeWidth={1.5} />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Descripción</p>
              <p className="text-xs text-foreground truncate">
                {state.descripcionMode === "ai" ? "Generar con IA" : state.descripcion ? `${totalIdiomas} idioma${totalIdiomas > 1 ? "s" : ""}` : "Sin configurar"}
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => onEditStep("multimedia")}
            className="rounded-lg border border-border bg-muted/20 px-3 py-2 flex items-center gap-2 hover:bg-muted/40 transition-colors text-left"
          >
            <ImageIcon className="h-4 w-4 text-primary shrink-0" strokeWidth={1.5} />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Fotos</p>
              <p className="text-xs text-foreground truncate tnum">
                {state.fotos.length > 0 ? `${state.fotos.length} · ${state.fotos.find((f) => f.esPrincipal)?.nombre ?? "sin principal"}` : "Sin fotos"}
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => onEditStep("multimedia")}
            className="rounded-lg border border-border bg-muted/20 px-3 py-2 flex items-center gap-2 hover:bg-muted/40 transition-colors text-left"
          >
            <Globe className="h-4 w-4 text-primary shrink-0" strokeWidth={1.5} />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Vídeos</p>
              <p className="text-xs text-foreground truncate tnum">
                {state.videos.length > 0 ? `${state.videos.length}` : "Sin vídeos"}
              </p>
            </div>
          </button>
        </div>
      </SectionCard>

      {/* ═════ OPERATIVA ═════ */}
      <SectionCard icon={Users} title="Operativa" complete={operativaComplete} onEdit={() => onEditStep("crear_unidades")}>
        {unidadesCount > 0 ? (
          <>
            <Row label="Unidades" value={`${unidadesCount}`} />
            <Row label="Rango de precios" value={rangoMin === rangoMax ? eur(rangoMin) : `${eur(rangoMin)} — ${eur(rangoMax)}`} />
            <Row label="Precio medio" value={eur(Math.round(precioMedio))} />
          </>
        ) : (
          <Row label="Unidades" value={null} />
        )}

        <div className="mt-3 pt-3 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onEditStep("colaboradores")}
            className="rounded-lg border border-border bg-muted/20 px-3 py-2 flex items-center gap-2 hover:bg-muted/40 transition-colors text-left"
          >
            <Users className="h-4 w-4 text-primary shrink-0" strokeWidth={1.5} />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Colaboradores</p>
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
    </div>
  );
}
