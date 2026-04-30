/**
 * tenantRef.ts · Referencia pública de empresa (tenant) en Byvaro.
 *
 * QUÉ
 * ----
 * Cada `organization` lleva una referencia inmutable de la forma
 * `IDXXXXXX` con 6 dígitos aleatorios (alfabeto `0-9`). Espacio de
 * 10^6 = 1.000.000 posibilidades por dígitos. La aleatoriedad es
 * obligatoria · NUNCA se generan secuenciales (`ID000001`, `ID000002`)
 * porque eso filtraría el orden de registro.
 *
 * Ver `src/lib/publicRef.ts` para el scheme completo de referencias
 * de las demás entidades (usuarios, promociones, registros, etc.) y
 * la regla de oro en `CLAUDE.md`.
 *
 * REGLA DE INMUTABILIDAD
 * -----------------------
 * Una vez asignada (al INSERT en `organizations`), JAMÁS se modifica.
 * Backend lo enforça vía trigger. Si el usuario quiere "cambiar la
 * ref", la única vía legítima es crear una nueva organización.
 */

const DIGITS = "0123456789";
const TENANT_REF_LENGTH = 6;
const TENANT_REF_RE = /^ID\d{6}$/;

/** Genera una ref aleatoria · solo para uso en mocks/tests · el
 *  backend siempre la genera vía trigger `gen_tenant_public_ref()`. */
export function generateTenantRef(): string {
  let out = "ID";
  for (let i = 0; i < TENANT_REF_LENGTH; i++) {
    out += DIGITS[Math.floor(Math.random() * 10)];
  }
  return out;
}

/** Valida formato · `ID` + 6 dígitos. */
export function isValidTenantRef(s: string | undefined | null): s is string {
  if (typeof s !== "string") return false;
  return TENANT_REF_RE.test(s);
}

/** Formatea para display · devuelve el valor canónico tal cual (sin
 *  separadores ni guiones). El usuario indicó explícitamente "sin
 *  guiones, no inventes cosas" · respetar el formato crudo. */
export function formatTenantRef(ref: string): string {
  return ref;
}
