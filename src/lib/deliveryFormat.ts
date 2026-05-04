/**
 * deliveryFormat.ts · helper canónico para componer el string de
 * entrega de una promoción a partir del WizardState (o subset).
 *
 * Centralizado para que createPromotionFromWizard,
 * wizardStateToPromotion, seedHydrator.rowToDevPromotion y los
 * adapters createdAsDev del listado y la ficha usen el mismo
 * formato.
 *
 * Formato COMPACTO (cabe en KPI tiles):
 *   · fechaEntrega (ISO o YYYY-MM)        → ese
 *   · trimestreEntrega ("T2 2026")        → ese
 *   · tras_contrato_cv + N meses          → "CPV + 18m"
 *   · tras_licencia + N meses             → "Lic. + 18m"
 *   · tras_contrato_cv (sin meses)        → "Tras CPV"
 *   · tras_licencia (sin meses)           → "Tras licencia"
 *   · sin info                            → ""
 */

export interface DeliveryInputs {
  fechaEntrega?: string | null;
  trimestreEntrega?: string | null;
  tipoEntrega?: string | null;
  mesesTrasContrato?: number;
  mesesTrasLicencia?: number;
}

export function composeDelivery(input: DeliveryInputs): string {
  if (input.fechaEntrega?.trim()) return input.fechaEntrega.trim();
  if (input.trimestreEntrega?.trim()) return input.trimestreEntrega.trim();
  if (input.tipoEntrega === "tras_contrato_cv") {
    const m = input.mesesTrasContrato ?? 0;
    return m > 0 ? `CPV + ${m}m` : "Tras CPV";
  }
  if (input.tipoEntrega === "tras_licencia") {
    const m = input.mesesTrasLicencia ?? 0;
    return m > 0 ? `Lic. + ${m}m` : "Tras licencia";
  }
  return "";
}
