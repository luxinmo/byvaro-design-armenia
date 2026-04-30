/**
 * publicRef.ts · Generador unificado de referencias públicas.
 *
 * Scheme canónico (regla de oro · CLAUDE.md):
 *
 *   Entidad      | Prefijo | Dígitos | Total | Espacio
 *   -------------+---------+---------+-------+------------
 *   Tenant (org) | ID      | 6       | 8     | 10^6   = 1M
 *   Usuario      | US      | 7       | 9     | 10^7   = 10M
 *   Promoción    | PR      | 5       | 7     | 10^5   = 100k
 *   Unidad       | UN      | 8       | 10    | 10^8   = 100M
 *   Registro     | RG      | 9       | 11    | 10^9   = 1B
 *   Contacto     | CO      | 7       | 9     | 10^7   = 10M
 *
 * REGLAS:
 *   1. Solo dígitos `0-9`.
 *   2. Aleatorio · NUNCA secuencial (`ID000001`, `ID000002`...).
 *      Si fuera secuencial cualquier observador podría inferir el
 *      orden de creación · señal competitiva no deseada.
 *   3. Inmutable durante la vida de la entidad.
 *   4. Único por tenant para entidades del workspace
 *      (Phase 1 single-tenant = únicos globales).
 *   5. Uso humano solo (búsqueda, emails, documentos, UI). NUNCA FK ·
 *      el `id` técnico (UUID/text) sigue siendo PK.
 *
 * Tenant (`ID...`) tiene su propio módulo `tenantRef.ts` por
 * historial · este archivo cubre las otras 5 entidades.
 *
 * TODO(backend): cuando llegue Phase 2 multi-tenant, sustituir el
 * generador in-memory por funciones SQL `gen_<entity>_public_ref()`
 * (igual que `gen_tenant_public_ref` ya existe). El frontend
 * mantiene esta API · solo cambia la implementación.
 */

export type PublicRefEntity =
  | "user" | "promotion" | "unit" | "registro" | "contact"
  /* Aliases legacy · `opportunity` y `registration` son variantes
   *  de "registro" en el modelo unificado · prefiere `registro` para
   *  nuevos calls. */
  | "opportunity" | "registration";

const SCHEME: Record<PublicRefEntity, { prefix: string; digits: number }> = {
  user:         { prefix: "US", digits: 7 },
  promotion:    { prefix: "PR", digits: 5 },
  unit:         { prefix: "UN", digits: 8 },
  registro:     { prefix: "RG", digits: 9 },
  contact:      { prefix: "CO", digits: 7 },
  opportunity:  { prefix: "RG", digits: 9 }, // legacy alias
  registration: { prefix: "RG", digits: 9 }, // legacy alias
};

const DIGIT_RE = /^\d+$/;

/** Match con cualquier publicRef válido del scheme. */
export function isPublicRef(s: unknown): s is string {
  if (typeof s !== "string") return false;
  for (const { prefix, digits } of Object.values(SCHEME)) {
    if (s.length !== prefix.length + digits) continue;
    if (!s.startsWith(prefix)) continue;
    if (DIGIT_RE.test(s.slice(prefix.length))) return true;
  }
  return false;
}

function randomDigits(n: number): string {
  let out = "";
  for (let i = 0; i < n; i++) out += Math.floor(Math.random() * 10).toString();
  return out;
}

/**
 * Genera una publicRef aleatoria para la entidad indicada · cifras
 * solo · NO secuencial.
 *
 * Si pasas `existing[]` (entidades del mismo tipo · mock), reintenta
 * hasta encontrar un id que no choque (probabilidad de colisión muy
 * baja con los espacios indicados, pero por si acaso).
 */
export function generatePublicRef(
  entity: PublicRefEntity,
  existing?: ReadonlyArray<{ publicRef?: string }>,
): string {
  const { prefix, digits } = SCHEME[entity];
  const used = new Set(
    (existing ?? []).map((x) => x.publicRef).filter(Boolean) as string[],
  );
  /* 50 intentos · suficiente para los espacios de 10^5 a 10^9. */
  for (let i = 0; i < 50; i++) {
    const candidate = `${prefix}${randomDigits(digits)}`;
    if (!used.has(candidate)) return candidate;
  }
  /* Fallback · espacio agotado o demasiadas colisiones · timestamp
   *  fragmento + random para garantizar unicidad. NO debería pasar. */
  const ts = Date.now().toString().slice(-Math.min(digits, 9));
  const pad = randomDigits(Math.max(0, digits - ts.length));
  return `${prefix}${ts}${pad}`.slice(0, prefix.length + digits);
}

/** Valida una publicRef contra el scheme de la entidad esperada. */
export function isValidPublicRef(s: string | undefined | null, entity: PublicRefEntity): s is string {
  if (typeof s !== "string") return false;
  const { prefix, digits } = SCHEME[entity];
  if (s.length !== prefix.length + digits) return false;
  if (!s.startsWith(prefix)) return false;
  return DIGIT_RE.test(s.slice(prefix.length));
}

/** Genera una publicRef DETERMINISTA a partir de un seedId estable
 *  (ej. el `id` del seed). El output parece aleatorio pero es estable
 *  entre reloads · imprescindible para seed data, donde la ref debe
 *  ser la misma cada vez que la app arranca (de lo contrario las
 *  URLs `/registros/RGXXXXXXXXX` no funcionarían).
 *
 *  Para entidades creadas en runtime (no seeds), usa `generatePublicRef`
 *  que SÍ es aleatorio puro · cada llamada un id distinto.
 *
 *  Algoritmo · FNV-1a hash del seedId truncado al espacio de la
 *  entidad. Distribución uniforme · sin patrón visible. NO se debe
 *  usar como handle de seguridad (es predecible si conoces el seedId
 *  · pero el seedId es interno y no público).
 */
export function seedRef(entity: PublicRefEntity, seedId: string): string {
  const { prefix, digits } = SCHEME[entity];
  let h = 0x811c9dc5;
  for (let i = 0; i < seedId.length; i++) {
    h ^= seedId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  /* Convertir hash a entero positivo, modular al espacio, padding a
   *  N dígitos. Math.imul puede dar negativos, normalizamos con >>>0. */
  const max = 10 ** digits;
  const num = (h >>> 0) % max;
  return prefix + String(num).padStart(digits, "0");
}

/* ══════ Helpers de migración legacy ════════════════════════════════
 *
 * Datos seed antiguos llevan formatos:
 *   · `coXXXXXX`   (lowercase + 6 dígitos secuenciales)
 *   · `opXXXXXX`
 *   · `reXXXXXX`
 *   · `CON-0042`   (legacy V1)
 *   · `OPP-0001`
 *
 * Estos NO matchean el scheme nuevo (UPPERCASE + N dígitos · N != 6).
 * Para no romper la app durante la transición, los seeds existentes
 * mantienen sus refs antiguas hasta su próximo "regenerado". El
 * scheme nuevo aplica a:
 *   · Entidades creadas por la app desde ahora.
 *   · Cualquier seed que se regenere explícitamente.
 *
 * Si necesitas detectar que una ref es legacy:
 *   isPublicRef(ref) === false  Y  /^(co|op|re)\d{6}$/i.test(ref)
 *
 * `migrateLegacyRef` queda exportado por compat · hoy convertía
 * `CON-0042` a `co000042`. NO se usa en runtime · se mantiene como
 * referencia histórica. */
export function migrateLegacyRef(legacy: string | undefined): string | undefined {
  if (!legacy) return undefined;
  const m = legacy.match(/^(CON|OPP)-(\d+)$/i);
  if (!m) return undefined;
  const [, oldPrefix, num] = m;
  const newPrefix = oldPrefix.toUpperCase() === "CON" ? "co" : "op";
  return `${newPrefix}${String(parseInt(num, 10)).padStart(6, "0")}`;
}
