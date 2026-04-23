/**
 * flags.ts · helper único para resolver banderas del sistema.
 *
 * QUÉ
 * ----
 * Todas las banderas del sistema (PhoneInput, nacionalidades, idiomas,
 * perfil de empresa, etc.) deben servirse desde `/flags/{iso}.svg` —
 * los SVG viven en `public/flags/` y son públicos MIT (flagcdn.com).
 * No usar emojis de banderas — Windows no los renderiza y Kazajistán /
 * Canadá comparten prefijo con Rusia / USA, cosa que los emojis no
 * distinguen visualmente bien.
 *
 * CÓMO
 * ----
 *   flagUrl("ES")    → "/flags/es.svg"
 *   flagUrl("kz")    → "/flags/kz.svg"
 *   flagUrl(null)    → ""  (componente Flag mostrará el globo)
 *
 * El componente `<Flag iso="...">` se encarga del fallback a globo si
 * el iso es inválido o no está descargado.
 */

const VALID_ISO_REGEX = /^[a-z]{2}$/i;

export function flagUrl(iso?: string | null): string {
  if (!iso || !VALID_ISO_REGEX.test(iso)) return "";
  return `/flags/${iso.toLowerCase()}.svg`;
}

/** Normaliza cualquier input a ISO-2 minúscula, o null si no es válido. */
export function normalizeIso(iso?: string | null): string | null {
  if (!iso || !VALID_ISO_REGEX.test(iso)) return null;
  return iso.toLowerCase();
}
