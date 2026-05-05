import { Check } from "lucide-react";
import type { StepId, WizardState } from "./types";
import {
  roleOptions, tipoOptions, subUniOptions, subVariasOptions,
  estadoOptions, faseConstruccionOptions,
  estiloViviendaOptions,
} from "./options";

interface TimelineStep {
  id: StepId;
  label: string;
  getSummary: (state: WizardState) => string | null;
}

function getAllSteps(state: WizardState): TimelineStep[] {
  const steps: TimelineStep[] = [
    {
      id: "role",
      label: "Rol",
      getSummary: (s) => roleOptions.find(o => o.value === s.role)?.label ?? null,
    },
    {
      id: "tipo",
      label: "Tipo de promoción",
      getSummary: (s) => tipoOptions.find(o => o.value === s.tipo)?.label ?? null,
    },
  ];

  if (state.tipo === "unifamiliar") {
    steps.push({
      id: "sub_uni",
      label: "Vivienda unifamiliar",
      getSummary: (s) => subUniOptions.find(o => o.value === s.subUni)?.label ?? null,
    });
    steps.push({
      id: "sub_varias",
      label: "Tipología y estilo",
      getSummary: (s) => {
        if (s.subUni === "varias" && s.tipologiasSeleccionadas.length > 0) {
          const total = s.tipologiasSeleccionadas.reduce((sum, t) => sum + t.cantidad, 0);
          const styles = s.estilosSeleccionados.length;
          return `${total} uds. · ${styles} est.`;
        }
        const sub = subVariasOptions.find(o => o.value === s.subVarias)?.label ?? null;
        const estilo = estiloViviendaOptions.find(o => o.value === s.estiloVivienda)?.label ?? null;
        if (sub && estilo) return `${sub} · ${estilo}`;
        return sub;
      },
    });
  }

  if (state.tipo === "plurifamiliar" || state.tipo === "mixto") {
    steps.push({
      id: "config_edificio",
      label: "Configuración",
      getSummary: (s) => {
        const totalEsc = s.escalerasPorBloque.reduce((sum, n) => sum + n, 0);
        const parts: string[] = [];
        if (s.numBloques > 1) parts.push(`${s.numBloques} bloq.`);
        if (totalEsc > 1) parts.push(`${totalEsc} esc.`);
        parts.push(`${s.plantas}P × ${s.aptosPorPlanta}V`);
        return parts.join(" · ");
      },
    });
  }

  /* Orden canónico · BLOQUE EDIFICIO antes que BLOQUE VIVIENDA.
   *
   * Antes el flujo era zigzag · config_edificio (edificio) → extras
   * (vivienda) → estado/detalles (edificio) → info_basica (edificio
   * + un sub-bloque de vivienda) → … → crear_unidades (vivienda).
   * El user empezaba a configurar viviendas antes de terminar de
   * describir el edificio.
   *
   * Orden nuevo · agrupa por dominio comercial:
   *   1. Estructura del edificio · config_edificio
   *   2. Estado y entrega · estado · detalles
   *   3. Qué ofrece la promoción · info_basica (amenidades,
   *      urbanización, estilo, energía)
   *   4. Las viviendas · qué incluyen · extras (anejos,
   *      equipamiento, vistas, orientación, seguridad)
   *   5. Crear las viviendas · crear_unidades
   *   6. Marketing · multimedia · descripcion
   *   7. Comercial · colaboradores · plan_pagos · revision
   */

  // 1. Estado de obra del edificio · estado y entrega
  steps.push({
    id: "estado",
    label: "Estado",
    getSummary: (s) => {
      const label = estadoOptions.find(o => o.value === s.estado)?.label ?? null;
      if (s.estado === "proyecto" && s.tieneLicencia !== null) {
        return `${label} · ${s.tieneLicencia ? "Con lic." : "Sin lic."}`;
      }
      if (s.estado === "en_construccion" && s.faseConstruccion) {
        const fase = faseConstruccionOptions.find(o => o.value === s.faseConstruccion)?.label;
        return `${label} · ${fase}`;
      }
      if (s.estado === "terminado" && s.fechaTerminacion) {
        return `${label} · Term.`;
      }
      return label;
    },
  });

  steps.push({
    id: "detalles",
    label: "Detalles finales",
    getSummary: (s) => {
      const parts: string[] = [];
      if (s.pisoPiloto) parts.push("Piso piloto");
      if (s.oficinaVentas) parts.push("Oficina ventas");
      if (s.tipoEntrega) parts.push("Entrega");
      if (s.fechaEntrega) parts.push("Fecha entrega");
      return parts.length > 0 ? parts.join(" · ") : null;
    },
  });

  // 2. Qué ofrece la promoción · amenidades del edificio + urbanización
  steps.push({
    id: "info_basica",
    label: "Información básica",
    getSummary: (s) => s.nombrePromocion || null,
  });

  // 3. Las viviendas · anejos per-unidad + equipamiento + vistas + …
  steps.push({
    id: "extras",
    label: "Las viviendas",
    getSummary: (s) => {
      const parts: string[] = [];
      if ((s.locales ?? 0) > 0) parts.push(`${s.locales} loc.`);
      if ((s.trasteros ?? 0) > 0) parts.push(`${s.trasteros} trast.`);
      if ((s.parkings ?? 0) > 0) parts.push(`${s.parkings} park.`);
      return parts.length > 0 ? parts.join(" · ") : null;
    },
  });

  // 4. Crear las viviendas · tabla de unidades con precios
  steps.push({
    id: "crear_unidades",
    label: "Crear unidades",
    getSummary: (s) => (s.unidades?.length ?? 0) > 0 ? `${s.unidades.length} uds.` : null,
  });

  // 5. Marketing · multimedia + descripción
  steps.push({
    id: "multimedia",
    label: "Multimedia",
    getSummary: (s) => {
      const parts: string[] = [];
      if (s.fotos.length > 0) parts.push(`${s.fotos.length} fotos`);
      if (s.videos.length > 0) parts.push(`${s.videos.length} videos`);
      return parts.length > 0 ? parts.join(" · ") : null;
    },
  });

  steps.push({
    id: "descripcion",
    label: "Descripción",
    getSummary: (s) => {
      if (s.descripcionMode === "ai") return "IA";
      if (s.descripcionMode === "manual") return s.descripcion ? "Manual" : null;
      return null;
    },
  });

  steps.push({
    id: "colaboradores",
    label: "Colaboradores",
    getSummary: (s) => {
      if (!s.colaboracion) return null;
      return `${s.comisionInternacional}%${s.diferenciarComisiones ? ` / ${s.comisionNacional}%` : ""}`;
    },
  });

  steps.push({
    id: "plan_pagos",
    label: "Plan de pagos",
    getSummary: (s) => {
      if (s.metodoPago === "contrato") return "En contrato";
      if (s.metodoPago === "manual") return "Manual";
      if (s.metodoPago === "certificaciones") return "Certificaciones";
      return null;
    },
  });

  steps.push({
    id: "revision",
    label: "Revisión",
    getSummary: () => null,
  });

  return steps;
}

function getStepStatus(stepId: StepId, currentStep: StepId, allStepIds: StepId[]): "done" | "current" | "upcoming" {
  const currentIdx = allStepIds.indexOf(currentStep);
  const thisIdx = allStepIds.indexOf(stepId);
  if (thisIdx < currentIdx) return "done";
  if (thisIdx === currentIdx) return "current";
  return "upcoming";
}

export function StepTimeline({
  state,
  currentStep,
  onGoToStep,
}: {
  state: WizardState;
  currentStep: StepId;
  onGoToStep: (step: StepId) => void;
}) {
  const steps = getAllSteps(state);
  const stepIds = steps.map(s => s.id);

  return (
    <nav className="flex flex-col gap-0.5 w-full">
      {steps.map((step, i) => {
        const status = getStepStatus(step.id, currentStep, stepIds);
        const summary = step.getSummary(state);
        const isClickable = status === "done";

        return (
          <div key={step.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full border transition-colors text-[10px] font-bold shrink-0
                  ${status === "done"
                    ? "border-primary bg-primary text-primary-foreground"
                    : status === "current"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted text-muted-foreground"
                  }`}
              >
                {status === "done" ? <Check className="h-3 w-3" strokeWidth={2} /> : <span>{i + 1}</span>}
              </div>
              {i < steps.length - 1 && (
                <div className={`w-px flex-1 min-h-[20px] ${status === "done" ? "bg-primary/25" : "bg-border"}`} />
              )}
            </div>

            <button
              onClick={() => isClickable && onGoToStep(step.id)}
              disabled={!isClickable}
              className={`text-left pb-4 transition-colors min-w-0
                ${isClickable ? "cursor-pointer hover:text-foreground" : "cursor-default"}
                ${status === "current" ? "text-foreground" : status === "done" ? "text-muted-foreground" : "text-muted-foreground/50"}
              `}
            >
              <p className={`text-xs font-medium leading-tight ${status === "current" ? "text-primary font-semibold" : ""}`}>
                {step.label}
              </p>
              {summary && status === "done" && (
                <p className="text-xs text-muted-foreground/70 truncate mt-0.5 max-w-[140px]">{summary}</p>
              )}
            </button>
          </div>
        );
      })}
    </nav>
  );
}

export { getAllSteps };
