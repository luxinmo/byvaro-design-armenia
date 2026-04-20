/**
 * lib/publicationRequirements · requisitos mínimos para publicar una
 * promoción.
 *
 * Estas reglas se aplican en dos contextos distintos:
 *
 *   1. **Durante el wizard** (`/crear-promocion`): el usuario no puede
 *      pulsar "Publicar" en el paso de Revisión si alguno de los
 *      requisitos no se cumple. Se valida sobre `WizardState`.
 *
 *   2. **En la ficha** (`/promociones/:id`): una promoción publicada
 *      puede quedarse "incompleta" si el promotor retira datos. El
 *      badge pasa de "Activa" a "Incompleta" y se muestra un CTA
 *      "Publicar" que sólo se habilita cuando se completen los
 *      requisitos. Se valida sobre `Promotion`.
 *
 * Los 7 requisitos son los mismos en ambos contextos (aunque las
 * fuentes de datos difieren):
 *
 *   1. Fotos            — al menos 1
 *   2. Unidades         — al menos 1 disponible
 *   3. Comisiones       — solo obligatorio si colaboración=true
 *   4. Plan de pagos    — método definido
 *   5. Ubicación        — ciudad y país rellenos
 *   6. Entrega          — fecha, trimestre o condición
 *   7. Estado de construcción — proyecto / en construcción / terminado
 *
 * Dependencias:
 *   - `@/components/crear-promocion/types` → `WizardState`, `StepId`
 *   - `@/data/promotions`                  → `Promotion`
 *
 * TODO(backend):
 *   - Cuando exista backend, estos chequeos se replican server-side
 *     en `POST /api/promociones/:id/publish`. El cliente los usa para
 *     affordance visual, no como única capa de validación.
 */

import type { WizardState, StepId } from "@/components/crear-promocion/types";
import type { Promotion } from "@/data/promotions";

/** Un requisito faltante con contexto suficiente para guiar al usuario. */
export interface MissingRequirement {
  /** Clave estable para diffs y keys de React. */
  key: string;
  /** Etiqueta humana en español ("Añadir al menos una foto"). */
  label: string;
  /** Paso del wizard al que se salta al hacer click (si aplica). */
  jumpTo?: StepId;
  /** Sección de la ficha a la que apunta (si aplica). */
  ficha?: "multimedia" | "units" | "collaborators" | "paymentPlan" | "location" | "delivery" | "estado";
}

/* ═══════════════════════════════════════════════════════════════════
   Contexto 1 · Wizard (`WizardState`)
   ═══════════════════════════════════════════════════════════════════ */

export function getMissingForWizard(state: WizardState): MissingRequirement[] {
  const missing: MissingRequirement[] = [];

  // 1. Fotos
  if (state.fotos.length === 0) {
    missing.push({
      key: "fotos",
      label: "Añade al menos una fotografía de la promoción",
      jumpTo: "multimedia",
    });
  }

  // 2. Unidades (al menos 1)
  if (state.unidades.length === 0) {
    missing.push({
      key: "unidades",
      label: "Genera al menos una unidad",
      jumpTo: "crear_unidades",
    });
  }

  // 3. Comisiones (solo si colabora)
  if (state.colaboracion) {
    if (!state.formaPagoComision) {
      missing.push({
        key: "comisiones-forma",
        label: "Define la forma de pago de comisiones",
        jumpTo: "colaboradores",
      });
    }
    if (!state.comisionInternacional || state.comisionInternacional <= 0) {
      missing.push({
        key: "comisiones-pct",
        label: "Define el % de comisión",
        jumpTo: "colaboradores",
      });
    }
  }

  // 4. Plan de pagos
  if (!state.metodoPago) {
    missing.push({
      key: "plan-pagos",
      label: "Define el plan de pagos",
      jumpTo: "plan_pagos",
    });
  }

  // 5. Ubicación (país + ciudad mínimos)
  const loc = state.direccionPromocion;
  if (!loc.pais.trim() || !loc.ciudad.trim()) {
    missing.push({
      key: "ubicacion",
      label: "Completa la ubicación (país + ciudad)",
      jumpTo: "info_basica",
    });
  }

  // 6. Entrega (al menos uno de los tres: fecha, trimestre o condición).
  //    Si la promoción está "terminada", la entrega ya ocurrió y no
  //    aplica — DetallesStep oculta esa pregunta, así que aquí tampoco
  //    debe exigirla.
  if (state.estado !== "terminado") {
    const tieneEntrega =
      !!state.fechaEntrega || !!state.trimestreEntrega || !!state.tipoEntrega;
    if (!tieneEntrega) {
      missing.push({
        key: "entrega",
        label: "Define cuándo se entrega la promoción",
        jumpTo: "detalles",
      });
    }
  }

  // 7. Estado de construcción
  if (!state.estado) {
    missing.push({
      key: "estado-construccion",
      label: "Selecciona el estado de construcción",
      jumpTo: "estado",
    });
  }

  return missing;
}

/* ═══════════════════════════════════════════════════════════════════
   Contexto 2 · Ficha (`Promotion`)
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Verifica los requisitos sobre la Promoción ya creada. Los mocks
 * tienen menos campos que el `WizardState`, así que inferimos lo que
 * podemos y ofrecemos un fallback razonable:
 *
 *   - Fotos        → `p.image` existe
 *   - Unidades     → `p.availableUnits > 0`
 *   - Ubicación    → `p.location.trim()` no vacío
 *   - Entrega      → `p.delivery` no vacío
 *   - Comisiones   → si `p.collaborating`, `p.commission > 0`
 *   - Plan de pagos → no trackeado en el shape actual (placeholder
 *     basado en `p.reservationCost > 0` como señal)
 *   - Estado construcción → `p.constructionProgress` definido o
 *     `p.delivery` indica fase → pragmático en prototipo
 */
export function getMissingForPromotion(p: Promotion): MissingRequirement[] {
  const missing: MissingRequirement[] = [];

  if (!p.image) {
    missing.push({ key: "fotos", label: "Sin fotografías", ficha: "multimedia" });
  }

  if (p.availableUnits <= 0 && p.totalUnits > 0) {
    missing.push({ key: "unidades", label: "Sin unidades disponibles", ficha: "units" });
  } else if (p.totalUnits === 0) {
    missing.push({ key: "unidades", label: "No hay unidades generadas", ficha: "units" });
  }

  if (p.collaborating && (!p.commission || p.commission <= 0)) {
    missing.push({ key: "comisiones", label: "Comisiones no configuradas", ficha: "collaborators" });
  }

  if (!p.reservationCost || p.reservationCost <= 0) {
    missing.push({ key: "plan-pagos", label: "Sin plan de pagos definido", ficha: "paymentPlan" });
  }

  if (!p.location || !p.location.trim()) {
    missing.push({ key: "ubicacion", label: "Ubicación sin completar", ficha: "location" });
  }

  if (!p.delivery || !p.delivery.trim()) {
    missing.push({ key: "entrega", label: "Falta fecha de entrega", ficha: "delivery" });
  }

  if (p.constructionProgress === undefined || p.constructionProgress === null) {
    missing.push({ key: "estado-construccion", label: "Estado de construcción sin definir", ficha: "estado" });
  }

  return missing;
}

/** ¿Se puede publicar? true si no hay requisitos pendientes. */
export function canPublishWizard(state: WizardState): boolean {
  return getMissingForWizard(state).length === 0;
}

/** ¿Está una promoción completa para publicar? */
export function canPublishPromotion(p: Promotion): boolean {
  return getMissingForPromotion(p).length === 0;
}
