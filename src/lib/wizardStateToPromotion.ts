/**
 * wizardStateToPromotion.ts · Mapper inverso · `WizardState` →
 * `Promotion`/`DevPromotion`.
 *
 * QUÉ
 * ----
 * Cuando el promotor edita una promoción ya creada desde el wizard
 * (`/crear-promocion?promotionId=PR44444`), los cambios se guardan en
 * `byvaro.promotion.wizard-override.v1::<id>` (ver
 * `promotionWizardOverrides.ts`). El detail page (`/promociones/:id`)
 * lee la `Promotion` original del seed · sin merge, los validadores
 * (`getMissingForPromotion`, statusTag, KPIs) reportan los mismos
 * campos pendientes aunque el usuario ya los haya rellenado en el
 * wizard. UX rota.
 *
 * Este mapper resuelve la diferencia · transforma `WizardState` al
 * shape `Promotion` · el detail page mergea con la base y trabaja
 * sobre `effectiveP`. La `Promotion` real solo se sobrescribe al
 * pulsar "Publicar" · el override es la "preview en vivo" antes de
 * publicar.
 *
 * REGLAS
 * ------
 *  · `wizardStateToPromotion(state, base)` recibe siempre la
 *    Promotion base · solo sobrescribe los campos que el wizard
 *    realmente trackea. Los campos derivados (`updatedAt`,
 *    `agencyAvatars`, `developer`, `agencies` count) NO se tocan.
 *  · Si el wizard NO tiene un valor (campo nulo / vacío), el campo
 *    de `base` se preserva · NUNCA se borran datos por estar el
 *    wizard a medio rellenar.
 *  · Idempotente · pasar el resultado por `promotionToWizardState`
 *    y volver a este mapper devuelve el mismo Promotion shape.
 *
 * TODO(backend) · cuando aterrice backend con `WizardState` persistido
 * por promoción, el merge se hace server-side en
 * `PATCH /api/promotions/:id` y el cliente recibe un `Promotion`
 * normalizado · este mapper deja de ser necesario en cliente.
 */

import type { Promotion } from "@/data/promotions";
import type { DevPromotion, CollaborationConfig } from "@/data/developerPromotions";
import type { WizardState, EstadoPromocion } from "@/components/crear-promocion/types";

/* ══════════════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════════════ */

import { composeDelivery } from "./deliveryFormat";
import { resolvePropertyTypes } from "./propertyTypes";

/** Reconstruye el string de delivery · delega en `composeDelivery`
 *  helper canónico (formato compacto: "CPV + 18m" / "Lic. + 18m" /
 *  trimestre / fecha). */
function deliveryString(state: WizardState): string {
  return composeDelivery({
    fechaEntrega: state.fechaEntrega,
    trimestreEntrega: state.trimestreEntrega,
    tipoEntrega: state.tipoEntrega,
    mesesTrasContrato: state.mesesTrasContrato,
    mesesTrasLicencia: state.mesesTrasLicencia,
  });
}

/** Construye el string de location · "Ciudad, Provincia". */
function locationString(state: WizardState): string {
  const c = state.direccionPromocion?.ciudad?.trim() ?? "";
  const p = state.direccionPromocion?.provincia?.trim() ?? "";
  if (c && p) return `${c}, ${p}`;
  return c || p || "";
}

/** Mapea `EstadoPromocion` a `constructionProgress` numérico para
 *  que `getMissingForPromotion` lo considere "definido". El override
 *  manual (`constructionProgressOverride`) gana si existe. */
function deriveProgress(state: WizardState): number | undefined {
  if (typeof state.constructionProgressOverride === "number") {
    return state.constructionProgressOverride;
  }
  const e: EstadoPromocion | null = state.estado;
  if (e === "proyecto") return 0;
  if (e === "en_construccion") return 50;
  if (e === "terminado") return 100;
  return undefined;
}

/** Construye `CollaborationConfig` desde `WizardState` · solo si
 *  `state.colaboracion` está activado. Si no, devuelve undefined ·
 *  el caller decide preservar `base.collaboration` o limpiarla. */
function buildCollaboration(state: WizardState): CollaborationConfig | undefined {
  if (!state.colaboracion) return undefined;
  return {
    comisionInternacional: state.comisionInternacional,
    comisionNacional: state.comisionNacional,
    diferenciarNacionalInternacional: state.diferenciarNacionalInternacional,
    diferenciarComisiones: state.diferenciarComisiones,
    agenciasRefusarNacional: state.agenciasRefusarNacional,
    clasificacionCliente: state.clasificacionCliente,
    formaPagoComision: state.formaPagoComision,
    hitosComision: state.hitosComision,
    ivaIncluido: state.ivaIncluido,
    condicionesRegistro: state.condicionesRegistro,
    validezRegistroDias: state.validezRegistroDias,
    modoValidacionRegistro: state.modoValidacionRegistro,
  };
}

/* ══════════════════════════════════════════════════════════════════
   Mapper principal
   ══════════════════════════════════════════════════════════════════ */

export function wizardStateToPromotion<T extends Promotion>(
  state: WizardState,
  base: T,
): T {
  const merged: T = { ...base };

  /* ─── Identidad ─── */
  if (state.refPromocion?.trim()) merged.code = state.refPromocion.trim();
  if (state.nombrePromocion?.trim()) merged.name = state.nombrePromocion.trim();
  if (state.role) merged.ownerRole = state.role;

  /* ─── Ubicación ─── */
  const loc = locationString(state);
  if (loc) merged.location = loc;

  /* ─── Multimedia · primera foto = principal ─── */
  const principal = state.fotos.find((f) => f.esPrincipal) ?? state.fotos[0];
  if (principal?.url) merged.image = principal.url;

  /* ─── Estado / construcción ─── */
  const progress = deriveProgress(state);
  if (typeof progress === "number") merged.constructionProgress = progress;
  if (typeof state.pisoPiloto === "boolean") merged.hasShowFlat = state.pisoPiloto;

  /* ─── Entrega ─── */
  const deliv = deliveryString(state);
  if (deliv) merged.delivery = deliv;

  /* ─── Tipologías + edificación ─── */
  if (Array.isArray(state.tipologiasSeleccionadas) && state.tipologiasSeleccionadas.length > 0) {
    /* Helper canónico · guarda RAW ids del wizard
     *  (`independiente`/`adosados`/`pareados`/etc.). El mapeo a
     *  label visible se aplica al renderizar vía
     *  `getPropertyTypeLabel`. Antes este path mapeaba inline a
     *  labels y divergía con `deriveFlatMetadata` (que guarda raw)
     *  · los filtros del listado dejaban de matchear al editar. */
    merged.propertyTypes = resolvePropertyTypes(state);
  }
  if (state.tipo === "unifamiliar" && state.subUni === "una_sola") {
    merged.buildingType = "unifamiliar-single";
  } else if (state.tipo === "unifamiliar" && state.subUni === "varias") {
    merged.buildingType = "unifamiliar-multiple";
  } else if (state.tipo === "plurifamiliar") {
    merged.buildingType = "plurifamiliar";
  }

  /* ─── Inventario ─── */
  if (Array.isArray(state.unidades) && state.unidades.length > 0) {
    merged.totalUnits = state.unidades.length;
    /* available · todo lo que NO sea reserved/sold */
    merged.availableUnits = state.unidades.filter(
      (u) => u.status !== "reserved" && u.status !== "sold",
    ).length;
    /* Rango de precios · derivado de las unidades cuando hay datos */
    const precios = state.unidades.map((u) => u.precio).filter((n) => typeof n === "number" && n > 0);
    if (precios.length > 0) {
      merged.priceMin = Math.min(...precios);
      merged.priceMax = Math.max(...precios);
    }
  }

  /* ─── Plan de pagos ─── */
  if (typeof state.importeReserva === "number" && state.importeReserva > 0) {
    merged.reservationCost = state.importeReserva;
  }

  /* ─── Comisiones ─── */
  if (state.colaboracion) {
    if (typeof state.comisionInternacional === "number" && state.comisionInternacional > 0) {
      merged.commission = state.comisionInternacional;
    }
    const collab = buildCollaboration(state);
    if (collab) {
      (merged as DevPromotion).collaboration = collab;
    }
    (merged as DevPromotion).canShareWithAgencies = true;
  } else {
    /* Uso interno · explicito · valida `willShare===false` en
     *  publicationRequirements.ts y excluye los comisión-missings.
     *  CRÍTICO · LIMPIA `commission` y `collaboration` que pudieran
     *  venir del base seed o de un override anterior · sin esto, si
     *  el user pasa de "compartir con agencias" → "uso interno", la
     *  ficha seguía mostrando los % de comisión + estructura de
     *  colaboración fantasma. */
    (merged as DevPromotion).canShareWithAgencies = false;
    merged.commission = 0;
    delete (merged as { collaboration?: unknown }).collaboration;
  }

  /* ─── Modo de validación de registro ─── */
  if (state.modoValidacionRegistro) {
    merged.modoValidacionRegistro = state.modoValidacionRegistro;
  }

  /* ─── missingSteps · si el wizard ya tiene fotos / unidades /
   *     comisiones llenas, eliminamos las flags declarativas que
   *     marcaban esos pasos como pendientes en el seed. El validador
   *     se basa en datos reales · esto es para que la lista de chips
   *     y banners no muestre "Multimedia" cuando ya hay foto. */
  const ms = (base as DevPromotion).missingSteps;
  if (Array.isArray(ms)) {
    const filtered = ms.filter((step) => {
      if (step === "Multimedia" && state.fotos.length > 0) return false;
      if (step === "Description" && state.descripcion?.trim()) return false;
      if (step === "Units" && state.unidades.length > 0) return false;
      if (step === "Payment plan" && state.metodoPago) return false;
      if (step === "Basic info" && (loc || state.nombrePromocion)) return false;
      if (step === "Collaborators") {
        if (!state.colaboracion) return false; // uso interno · no aplica
        if (state.formaPagoComision && state.comisionInternacional > 0) return false;
      }
      return true;
    });
    (merged as DevPromotion).missingSteps = filtered;
  }

  return merged;
}
