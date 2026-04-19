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
  Image as ImageIcon, FileText, MapPin, Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  tipoOptions, subUniOptions, subVariasOptions, estadoOptions,
  faseConstruccionOptions, formaPagoComisionOptions,
} from "./options";
import type { WizardState, StepId } from "./types";

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
            <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" strokeWidth={2} />
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
  const subVariasLabel = state.tipo === "unifamiliar" && state.subUni === "varias"
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

  return (
    <div className="flex flex-col gap-4">
      {/* ═════ Progreso global ═════ */}
      <div className="rounded-xl border border-border bg-card px-5 py-4 flex items-center gap-4">
        <div className="relative h-14 w-14 shrink-0">
          <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15.9" fill="none"
              stroke="hsl(var(--primary))" strokeWidth="3"
              strokeDasharray={`${percent}, 100`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-foreground tnum">
            {percent}%
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {percent === 100 ? "¡Todo listo!" : "Casi listo para publicar"}
          </p>
          <p className="text-xs text-muted-foreground">
            {percent === 100
              ? "Puedes publicar la promoción cuando quieras. Podrás seguir editando después."
              : `Faltan ${sections.length - completedCount} secciones por revisar antes de publicar.`}
          </p>
        </div>
      </div>

      {/* ═════ TIPOLOGÍA ═════ */}
      <SectionCard icon={Home} title="Tipología" complete={tipologiaComplete} onEdit={() => onEditStep("tipo")}>
        <Row label="Rol" value={state.role === "promotor" ? "Promotor" : state.role === "comercializador" ? "Comercializador exclusivo" : null} />
        <Row label="Tipo de promoción" value={tipoLabel} />
        {subUniLabel && <Row label="Nº de unidades" value={subUniLabel} />}
        {subVariasLabel && <Row label="Tipología de varias" value={subVariasLabel} />}
        {edificioResumen && <Row label="Estructura" value={edificioResumen} />}
        {state.tipologiasSeleccionadas.length > 0 && (
          <Row
            label="Tipologías"
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

      {/* ═════ COMERCIALIZACIÓN ═════ */}
      <SectionCard icon={Building2} title="Comercialización" complete={comercComplete} onEdit={() => onEditStep("estado")}>
        <Row label="Estado" value={estadoLabel} />
        {faseLabel && <Row label="Fase de obra" value={faseLabel} />}
        {state.fechaEntrega && <Row label="Entrega" value={state.fechaEntrega} />}
        {state.trimestreEntrega && <Row label="Trimestre entrega" value={state.trimestreEntrega} />}
        <Row label="Piso piloto" value={state.pisoPiloto ? "Sí" : "No"} />
        <Row label="Oficinas de venta" value={state.oficinasVentaSeleccionadas.length > 0 ? `${state.oficinasVentaSeleccionadas.length}` : "No"} />
      </SectionCard>

      {/* ═════ MARKETING ═════ */}
      <SectionCard icon={MapPin} title="Marketing" complete={marketingComplete} onEdit={() => onEditStep("info_basica")}>
        <Row label="Nombre" value={state.nombrePromocion || null} />
        <Row label="Dirección" value={direccionCompleta || null} />
        {state.certificadoEnergetico && <Row label="Cert. energético" value={state.certificadoEnergetico} />}
        <Row
          label="Amenities"
          value={state.amenities.length > 0 ? `${state.amenities.length} selecciondas` : null}
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
                {state.diferenciarNacionalInternacional
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

      {/* ═════ Lo que se publicará ═════ */}
      <div className="rounded-xl border border-primary/30 bg-primary/5 px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary mb-2">
          Lo que se publicará
        </p>
        <ul className="flex flex-col gap-1.5 text-xs text-foreground">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" strokeWidth={2} />
            <span>
              Microsite público en <span className="font-medium">byvaro.com/{state.nombrePromocion ? state.nombrePromocion.toLowerCase().replace(/\s+/g, "-") : "tu-promocion"}</span>
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" strokeWidth={2} />
            <span>
              {unidadesCount > 0 ? `${unidadesCount} unidades` : "Sin unidades"} disponibles en el catálogo interno para ti y tus colaboradores.
            </span>
          </li>
          {state.colaboracion && (
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" strokeWidth={2} />
              <span>
                La promoción podrá ser vista por agencias colaboradoras. Podrás invitarlas después.
              </span>
            </li>
          )}
          <li className="flex items-start gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" strokeWidth={2} />
            <span>Podrás seguir editando todos los datos desde la ficha de la promoción.</span>
          </li>
        </ul>
        <p className="text-[11px] text-muted-foreground mt-3 italic">
          Pulsa <span className="font-medium text-foreground">Publicar</span> abajo a la derecha para lanzar la promoción.
        </p>
      </div>
    </div>
  );
}
