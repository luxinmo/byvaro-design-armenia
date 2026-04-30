/**
 * tenantRef.ts · Referencia pública de empresa (tenant) en Byvaro.
 *
 * QUÉ
 * ----
 * Cada `organization` (developer, agency, comercializador) lleva una
 * referencia inmutable de la forma `IDXXXXXX` con 6 caracteres
 * aleatorios del alfabeto sin ambigüedades (sin 0/O/1/I/L). Espacio
 * de 32^6 ≈ 1.07 mil millones · imposible deducir orden de registro.
 *
 * POR QUÉ NO ES SECUENCIAL
 * -------------------------
 * Si fuera 000001, 000002… cualquier observador podría inferir cuándo
 * se registró un tenant respecto a otro · señal competitiva no deseada.
 * Aleatoriedad uniforme rompe esa correlación.
 *
 * USO
 * ----
 * · Discovery cross-tenant · invitaciones llevan la ref del invitador,
 *   el invitado puede verificar contra `find_org_by_ref()`.
 * · Display público · /empresa "Sobre nosotros" lo muestra read-only
 *   junto al CIF / razón social como handle externo.
 * · Base de la tabla `tenant_links` · cada vínculo cross-tenant se
 *   identifica por (from_ref, to_ref) en vez de exponer ids internos.
 *
 * REGLA DE INMUTABILIDAD
 * -----------------------
 * Una vez asignada (al INSERT en `organizations`), JAMÁS se modifica.
 * Backend lo enforça vía trigger · frontend nunca debe ofrecer un input
 * editable. Si el usuario quiere "cambiar la ref", hay que crear una
 * nueva organización (que es un evento legal, no un rebrand).
 */

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Genera una ref aleatoria · solo para uso en mocks/tests · el
 *  backend siempre la genera vía trigger `gen_tenant_public_ref()`. */
export function generateTenantRef(): string {
  let out = "ID";
  for (let i = 0; i < 6; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

/** Valida formato · `ID` + 6 chars del alfabeto canónico. */
export function isValidTenantRef(s: string | undefined | null): s is string {
  if (typeof s !== "string") return false;
  if (s.length !== 8) return false;
  if (!s.startsWith("ID")) return false;
  for (let i = 2; i < 8; i++) {
    if (!ALPHABET.includes(s[i])) return false;
  }
  return true;
}

/** Formatea para display · agrupa en bloques de 3 para legibilidad
 *  humana sin afectar al valor canónico. `IDA1B2C3` → `ID·A1B·2C3`. */
export function formatTenantRef(ref: string): string {
  if (!isValidTenantRef(ref)) return ref;
  return `${ref.slice(0, 2)}·${ref.slice(2, 5)}·${ref.slice(5, 8)}`;
}
