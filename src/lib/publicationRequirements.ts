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
import { loadEmpresa } from "./empresa";

/** Devuelve true si la empresa del workspace tiene mínimamente
 *  identificada su entidad legal (nombre comercial o razón social).
 *  Sin uno de los dos no se puede publicar nada — la promoción
 *  necesita atribuir al promotor/comercializador en la ficha pública,
 *  microsites, registros, contratos. */
function empresaTieneIdentidad(): boolean {
  if (typeof window === "undefined") return true; // SSR · skip check
  try {
    const e = loadEmpresa();
    return !!(e.nombreComercial?.trim() || e.razonSocial?.trim());
  } catch {
    return false;
  }
}

/** Un requisito faltante con contexto suficiente para guiar al usuario. */
export interface MissingRequirement {
  /** Clave estable para diffs y keys de React. */
  key: string;
  /** Etiqueta humana en español ("Añadir al menos una foto"). */
  label: string;
  /** Paso del wizard al que se salta al hacer click (si aplica). */
  jumpTo?: StepId;
  /** Sección de la ficha a la que apunta (si aplica). */
  ficha?: "multimedia" | "units" | "collaborators" | "paymentPlan" | "location" | "delivery" | "estado" | "basicInfo" | "description";
}

/* ═══════════════════════════════════════════════════════════════════
   Contexto 1 · Wizard (`WizardState`)
   ═══════════════════════════════════════════════════════════════════ */

export function getMissingForWizard(state: WizardState): MissingRequirement[] {
  const missing: MissingRequirement[] = [];

  // 0. Identidad de la empresa (nombre comercial o razón social).
  //    Sin esto la promoción no se puede publicar — falta el "quién"
  //    en la ficha pública, microsites y registros.
  if (!empresaTieneIdentidad()) {
    missing.push({
      key: "empresa-identidad",
      label: "Configura el nombre comercial o razón social de tu empresa en /ajustes/empresa/datos",
    });
  }

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

  /* ── Identidad ─────────────────────────────────────────── */
  if (!p.code || !p.code.trim()) {
    missing.push({ key: "codigo", label: "Sin código de referencia", ficha: "basicInfo" });
  }
  // El "quién publica" sale del workspace · si no hay nombre comercial
  // ni razón social configurados en /ajustes/empresa/datos, la
  // promoción no se puede publicar (no hay manera de atribuirla en la
  // ficha pública, microsites o registros).
  if (!empresaTieneIdentidad()) {
    missing.push({
      key: "empresa-identidad",
      label: "Configura el nombre comercial o razón social en /ajustes/empresa/datos",
    });
  }

  /* ── Multimedia ────────────────────────────────────────── */
  if (!p.image) {
    missing.push({ key: "fotos", label: "Sin fotografía principal", ficha: "multimedia" });
  }

  /* ── Ubicación ─────────────────────────────────────────── */
  if (!p.location || !p.location.trim()) {
    missing.push({ key: "ubicacion", label: "Ubicación sin completar", ficha: "location" });
  }

  /* ── Tipología + edificación ──────────────────────────── */
  if (!Array.isArray(p.propertyTypes) || p.propertyTypes.length === 0) {
    missing.push({ key: "tipologia", label: "Sin tipologías (apartamento/ático...)", ficha: "basicInfo" });
  }
  if (!p.buildingType) {
    missing.push({ key: "tipo-edificacion", label: "Sin tipo de edificación", ficha: "basicInfo" });
  }

  /* ── Precios + entrega ────────────────────────────────── */
  if (!p.priceMin || p.priceMin <= 0 || !p.priceMax || p.priceMax <= 0) {
    missing.push({ key: "rango-precios", label: "Sin rango de precios", ficha: "basicInfo" });
  }
  if (!p.delivery || !p.delivery.trim()) {
    missing.push({ key: "entrega", label: "Falta fecha de entrega", ficha: "delivery" });
  }
  if (p.constructionProgress === undefined || p.constructionProgress === null) {
    missing.push({ key: "estado-construccion", label: "Estado de construcción sin definir", ficha: "estado" });
  }

  /* ── Inventario ───────────────────────────────────────── */
  if (p.totalUnits === 0) {
    missing.push({ key: "unidades", label: "No hay unidades generadas", ficha: "units" });
  } else if (p.availableUnits <= 0 && p.status !== "sold-out") {
    // Tolerante: si p.status = "sold-out" no lo marcamos como faltante.
    missing.push({ key: "unidades-disponibles", label: "Sin unidades disponibles", ficha: "units" });
  }

  /* ── Plan de pagos ──────────────────────────────────────
     El plan se considera DEFINIDO si:
      - Hay `reservationCost > 0` (plan con reserva), O
      - El wizard guardó `metodoPago` (puede ser "contrato",
        "manual" o "certificaciones" · ninguno exige reserva).
     Antes solo chequeábamos reservationCost · falsos positivos
     en promos cuyo plan se define en contrato (sin reserva
     adelantada) · el banner decía "Sin plan de pagos" aunque
     el user SÍ había configurado el método. */
  const wizardSnap = (p as { metadata?: { wizardSnapshot?: { metodoPago?: string | null } } })
    .metadata?.wizardSnapshot;
  const planDefined =
    (typeof p.reservationCost === "number" && p.reservationCost > 0)
    || !!wizardSnap?.metodoPago;
  if (!planDefined) {
    missing.push({ key: "plan-pagos", label: "Sin plan de pagos definido", ficha: "paymentPlan" });
  }

  /* ── Comisiones (solo obligatorio si se comparte con agencias) ────
     Si el promotor marcó "No compartir" (canShareWithAgencies === false),
     la promoción es de uso interno y NO necesita comisiones — eso no
     la hace incompleta, solo cambia el badge a "Solo uso interno".

     Cuando SÍ se comparte, exigimos DOS cosas:
       a) `commission` > 0 (el porcentaje suelto del listado).
       b) `collaboration` presente (estructura completa: tipos de
          cliente, forma de pago, hitos, etc. · solo en DevPromotion).
     Sin (b) la tab Comisiones muestra "Sin estructura de comisiones
     definida", con lo cual la agencia no puede calcular su
     liquidación — no es publicable. */
  const willShare = (p as { canShareWithAgencies?: boolean }).canShareWithAgencies !== false;
  if (willShare) {
    if (!p.commission || p.commission <= 0) {
      missing.push({ key: "comisiones", label: "Comisiones sin porcentaje", ficha: "collaborators" });
    }
    const collab = (p as { collaboration?: unknown }).collaboration;
    if (!collab) {
      missing.push({
        key: "estructura-comisiones",
        label: "Sin estructura de comisiones definida",
        ficha: "collaborators",
      });
    }
  }

  /* ── missingSteps declarativos del mock ──────────────────
     Cuando developerPromotions.ts declara campos pendientes que
     el validador no puede derivar del shape plano (ej. "Description",
     "Multimedia" en el sentido de galería extendida, "Collaborators"),
     los incorporamos para que la ficha y el listado los vean. Si
     la promoción es de uso interno (willShare=false), el paso
     "Collaborators" deja de aplicar porque no va a compartirse. */
  const fichaByStep: Record<string, string> = {
    "Multimedia": "multimedia",
    "Description": "description",
    "Units": "units",
    "Payment plan": "paymentPlan",
    "Basic info": "basicInfo",
    "Collaborators": "collaborators",
  };
  if (Array.isArray(p.missingSteps)) {
    for (const step of p.missingSteps) {
      if (!willShare && step === "Collaborators") continue;
      const key = `step-${step.toLowerCase().replace(/\s+/g, "-")}`;
      if (missing.some((m) => m.key === key)) continue;
      missing.push({ key, label: step, ficha: fichaByStep[step] });
    }
  }

  return missing;
}

/** ¿Se puede publicar? true si no hay requisitos pendientes. */
export function canPublishWizard(state: WizardState): boolean {
  return getMissingForWizard(state).length === 0;
}

/** ¿Está una promoción completa para publicar?
 *  Regla de negocio: una promoción solo puede considerarse activa si
 *  pasa TODOS los requisitos. Delegamos a `getMissingForPromotion`,
 *  que ya tiene en cuenta los missingSteps declarativos del mock
 *  filtrados según el modo de compartición (Collaborators no aplica
 *  si canShareWithAgencies === false). */
export function canPublishPromotion(p: Promotion): boolean {
  if (p.status === "incomplete") return false;
  return getMissingForPromotion(p).length === 0;
}
