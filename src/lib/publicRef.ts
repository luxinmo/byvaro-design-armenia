/**
 * publicRef.ts · Generador unificado de referencias públicas.
 *
 * Modelo final (`docs/public-references-audit.md`):
 *   · Contact      → coXXXXXX
 *   · Opportunity  → opXXXXXX  (= Lead · misma entidad, diferente fase)
 *   · Registration → reXXXXXX  (= Preregistration · misma entidad, otro estado)
 *
 * Las referencias son:
 *   · INMUTABLES durante la vida de la entidad
 *   · ÚNICAS por organización (Phase 1 single-tenant = únicas globales)
 *   · LOWERCASE prefix de 2 letras + 6 dígitos zero-padded
 *   · USO HUMANO solo (búsqueda, emails, documentos, UI · NUNCA FK)
 *   · UUID `id` sigue siendo PK técnica
 *
 * TODO(backend): cuando llegue Phase 2 multi-tenant, sustituir el
 * scan in-memory por sequence atómica `next_public_ref(org, entity)`
 * server-side · ver `docs/public-references-audit.md §3.1`.
 */

export type PublicRefEntity = "contact" | "opportunity" | "registration";

const PREFIX: Record<PublicRefEntity, string> = {
  contact:      "co",
  opportunity:  "op",
  registration: "re",
};

/** Match con cualquier publicRef del nuevo formato · regex único. */
const PUBLIC_REF_RE = /^(co|op|re)(\d{6})$/;

export function isPublicRef(s: unknown): s is string {
  return typeof s === "string" && PUBLIC_REF_RE.test(s);
}

/**
 * Genera la siguiente publicRef disponible para una entidad escaneando
 * las existentes. La lista debe contener todas las entidades del
 * tenant actual (en mock = todo el storage local).
 *
 * Caso ausente: si `existing` no contiene ninguna ref válida del
 * prefix, devuelve `prefix000001` (la primera).
 */
export function generatePublicRef(
  entity: PublicRefEntity,
  existing: ReadonlyArray<{ publicRef?: string }>,
): string {
  const prefix = PREFIX[entity];
  const re = new RegExp(`^${prefix}(\\d{6})$`);
  let max = 0;
  for (const item of existing) {
    const m = item.publicRef?.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return `${prefix}${String(max + 1).padStart(6, "0")}`;
}

/**
 * Migra una ref legacy (CON-0042 / OPP-0001) al nuevo formato manteniendo
 * el número original. Helper único para el backfill de seeds.
 *
 *   migrateLegacyRef("CON-0042") → "co000042"
 *   migrateLegacyRef("OPP-0001") → "op000001"
 */
export function migrateLegacyRef(legacy: string | undefined): string | undefined {
  if (!legacy) return undefined;
  const m = legacy.match(/^(CON|OPP)-(\d+)$/i);
  if (!m) return undefined;
  const [, oldPrefix, num] = m;
  const newPrefix = oldPrefix.toUpperCase() === "CON" ? "co" : "op";
  return `${newPrefix}${String(parseInt(num, 10)).padStart(6, "0")}`;
}
