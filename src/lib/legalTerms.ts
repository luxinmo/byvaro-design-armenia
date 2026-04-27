/**
 * legalTerms.ts · Catálogo de términos legales versionados.
 *
 * Phase 2 frontend mock · cuando el backend exista, los términos
 * vivirán en `legal_terms` table con auditoría server-side. Mientras
 * tanto, se almacenan aquí como constantes para que cuando un
 * promotor apruebe un registro, deje traza de QUÉ versión aceptó.
 *
 * Spec en `docs/registration-system.md §C "T&C popup en aprobación"`.
 *
 * TODO(backend): GET /api/legal-terms/:id → trae la última versión
 * aplicable al workspace (puede haber versiones por país / idioma).
 */

export type LegalTermsId = "registration_approval";

export type LegalTerms = {
  id: LegalTermsId;
  version: string;       // semver-ish · "v1.0", "v1.1"
  updatedAt: string;     // ISO
  /** Texto legal · soporta interpolación con {placeholder}. */
  body: string;
  /** Variantes de copy según el modo de la promoción. */
  bodyDirecto?: string;
  bodyPorVisita?: string;
};

export const REGISTRATION_APPROVAL_TERMS: LegalTerms = {
  id: "registration_approval",
  version: "v1.0",
  updatedAt: "2026-04-27",
  body:
    "Reconozco que he revisado los datos del cliente y declaro que la " +
    "atribución a {agencia} es correcta. La aprobación es vinculante " +
    "y queda registrada en el historial cross-empresa.",
  bodyDirecto:
    "Al aprobar, el cliente {cliente} queda formalmente registrado " +
    "a nombre de {agencia} en {promocion}. Esta atribución implica " +
    "el derecho a comisión según los términos de colaboración acordados.",
  bodyPorVisita:
    "Al aprobar, el cliente {cliente} queda en preregistro reservado " +
    "a {agencia} para {promocion}. La reserva se confirma como " +
    "registro definitivo cuando se realice la primera visita. Si la " +
    "visita no se ejecuta en el plazo configurado, el cliente queda " +
    "libre y la atribución se pierde.",
};

/** Resuelve los términos aplicables · Phase 2 puede tener i18n + per-org. */
export function getRegistrationTerms(
  modo: "directo" | "por_visita" = "por_visita",
  vars?: { agencia?: string; cliente?: string; promocion?: string },
): { id: LegalTermsId; version: string; body: string } {
  const t = REGISTRATION_APPROVAL_TERMS;
  const template = modo === "directo"
    ? (t.bodyDirecto ?? t.body)
    : (t.bodyPorVisita ?? t.body);
  const body = template
    .replace("{agencia}", vars?.agencia ?? "la agencia colaboradora")
    .replace("{cliente}", vars?.cliente ?? "el cliente")
    .replace("{promocion}", vars?.promocion ?? "la promoción");
  return { id: t.id, version: t.version, body };
}
