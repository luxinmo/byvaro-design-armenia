/**
 * deliveryFormat.ts · helper canónico para componer el string de
 * entrega de una promoción a partir del WizardState (o subset).
 *
 * Centralizado para que createPromotionFromWizard,
 * wizardStateToPromotion, seedHydrator.rowToDevPromotion y los
 * adapters createdAsDev del listado y la ficha usen el mismo
 * formato.
 *
 * REGLA CANÓNICA · `tipoEntrega` MANDA. Cuando está set, los demás
 * campos (fechaEntrega/trimestreEntrega) son IGNORADOS aunque tengan
 * valor stale del paso anterior del wizard. Sin esto, una promoción
 * configurada como "12 meses tras licencia" mostraba el trimestre
 * residual ("T2 2026") porque el wizard no limpia campos al cambiar
 * de tipo · bug visible en producción (PR47249).
 *
 * Mapping por `tipoEntrega`:
 *   · "fecha"            → fechaEntrega         ("YYYY-MM" o "DD/MM/YYYY")
 *   · "trimestre"        → trimestreEntrega     ("T2 2026")
 *   · "tras_contrato_cv" → "CPV + Nm"           (o "Tras CPV" si N=0)
 *   · "tras_licencia"    → "Lic. + Nm"          (o "Tras licencia" si N=0)
 *
 * Fallback (sin tipoEntrega · drafts legacy):
 *   · fechaEntrega o trimestreEntrega si alguno está rellenado.
 *   · "" si no hay nada.
 */

export interface DeliveryInputs {
  fechaEntrega?: string | null;
  trimestreEntrega?: string | null;
  tipoEntrega?: string | null;
  mesesTrasContrato?: number;
  mesesTrasLicencia?: number;
}

export function composeDelivery(input: DeliveryInputs): string {
  /* `tipoEntrega` es la fuente de verdad cuando está set · respetamos
   *  su elección y NO leemos campos de otros tipos (que pueden tener
   *  valor stale del paso anterior del wizard). */
  if (input.tipoEntrega === "fecha") {
    return input.fechaEntrega?.trim() ?? "";
  }
  if (input.tipoEntrega === "trimestre") {
    return input.trimestreEntrega?.trim() ?? "";
  }
  if (input.tipoEntrega === "tras_contrato_cv") {
    const m = input.mesesTrasContrato ?? 0;
    return m > 0 ? `CPV + ${m}m` : "Tras CPV";
  }
  if (input.tipoEntrega === "tras_licencia") {
    const m = input.mesesTrasLicencia ?? 0;
    return m > 0 ? `Lic. + ${m}m` : "Tras licencia";
  }
  /* Fallback · sin tipoEntrega (drafts legacy creados antes de añadir
   *  el campo) · usamos lo que haya rellenado. */
  if (input.fechaEntrega?.trim()) return input.fechaEntrega.trim();
  if (input.trimestreEntrega?.trim()) return input.trimestreEntrega.trim();
  return "";
}

/**
 * resolveDelivery · ÚNICA fuente de verdad de "delivery" para mostrar
 * al usuario. Usado por listado, ficha, drawer, panel agencia,
 * microsite, emails, validadores publicación.
 *
 * Estrategia · si la promo tiene `metadata.wizardSnapshot`, recompute
 * en runtime con `composeDelivery` (helper canónico, respeta
 * `tipoEntrega`). Solo cae a `p.delivery` plano si no hay snapshot
 * (legacy seeds, hidratación parcial).
 *
 * Por qué · la columna `promotions.delivery` se computó al CREAR/
 * EDITAR con la versión vieja del helper (antes de PR #112) y puede
 * estar stale ("T2 2026" cuando es "tras_licencia 12m"). Re-derivar
 * desde el snapshot garantiza consistencia entre TODAS las pantallas
 * sin esperar a la migración SQL.
 *
 * REGLA · siempre que vayas a leer "delivery" para mostrar al usuario,
 * usa este helper. NO leas `p.delivery` directamente.
 */
export function resolveDelivery(p: {
  delivery?: string | null;
  metadata?: {
    wizardSnapshot?: DeliveryInputs;
  } | null;
} | null | undefined): string {
  if (!p) return "";
  const snap = p.metadata?.wizardSnapshot;
  if (snap) {
    const fromSnap = composeDelivery(snap);
    if (fromSnap) return fromSnap;
  }
  return p.delivery ?? "";
}
