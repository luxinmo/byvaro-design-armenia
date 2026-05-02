import { memCache } from "@/lib/memCache";
/**
 * Catálogo de TIPOS DE RELACIÓN entre contactos, gestionado desde
 * /ajustes/contactos/relaciones por el admin.
 *
 * Ejemplos por defecto: Cónyuge, Pareja, Familiar, Colega, Otro.
 * El admin puede añadir tipos propios (ej. Inversor conjunto, Heredero,
 * Asesor financiero, Tutor legal…).
 *
 * Storage: `byvaro.contacts.relationTypes.v1`.
 *
 * TODO(backend): GET/POST /api/contacts/relation-types.
 */

export type RelationType = {
  /** Slug inmutable (no se renombra; se usa en datos persistidos). */
  id: string;
  /** Etiqueta visible (editable). */
  label: string;
  /** Si false, el admin lo ha desactivado — sigue funcionando para
   *  vínculos ya creados pero no aparece en el selector de nuevos. */
  enabled?: boolean;
};

export const DEFAULT_RELATION_TYPES: RelationType[] = [
  { id: "spouse",    label: "Cónyuge",  enabled: true },
  { id: "partner",   label: "Pareja",   enabled: true },
  { id: "family",    label: "Familiar", enabled: true },
  { id: "colleague", label: "Colega",   enabled: true },
  { id: "other",     label: "Otro",     enabled: true },
];

const KEY = "byvaro.contacts.relationTypes.v1";

export function loadRelationTypes(): RelationType[] {
  if (typeof window === "undefined") return DEFAULT_RELATION_TYPES;
  try {
    const raw = memCache.getItem(KEY);
    if (!raw) return DEFAULT_RELATION_TYPES;
    const parsed = JSON.parse(raw) as RelationType[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_RELATION_TYPES;
    return parsed;
  } catch { return DEFAULT_RELATION_TYPES; }
}

export function saveRelationTypes(types: RelationType[]): void {
  if (typeof window === "undefined") return;
  memCache.setItem(KEY, JSON.stringify(types));
  void (async () => {
    const { mergeOrgMetadata } = await import("@/lib/orgMetadataSync");
    await mergeOrgMetadata({ contactRelationTypes: types });
  })();
}

/** Genera un id slug seguro a partir del label. Garantiza unicidad
 *  añadiendo sufijo numérico si choca. */
export function nextRelationTypeId(label: string, existing: RelationType[]): string {
  const base = label.trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 30) || "tipo";
  if (!existing.some((t) => t.id === base)) return base;
  let n = 2;
  while (existing.some((t) => t.id === `${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** Busca por id; si no existe (tipo eliminado, por ejemplo), devuelve
 *  el id como label fallback. */
export function getRelationLabel(id: string): string {
  const types = loadRelationTypes();
  return types.find((t) => t.id === id)?.label ?? id;
}
