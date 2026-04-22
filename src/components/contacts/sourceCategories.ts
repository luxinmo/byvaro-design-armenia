/**
 * SourceCategory — categoría a la que pertenece un origen.
 *
 * Las categorías agrupan orígenes por canal (Portal inmobiliario, Web,
 * Eventos, Co-marketing, etc.). Son gestionables por el admin desde
 * `/ajustes/contactos/origenes` (sección "Categorías") y se aplican a
 * cada origen al crearlo/editarlo.
 *
 * En producción: tabla `contact_source_categories` (id, label, organization_id).
 */

export type SourceCategory = {
  id: string;
  label: string;
};

/** Categorías por defecto al crear un workspace nuevo. */
export const DEFAULT_ORG_SOURCE_CATEGORIES: SourceCategory[] = [
  { id: "cat-portal", label: "Portal inmobiliario" },
  { id: "cat-web", label: "Web propia" },
  { id: "cat-directo", label: "Directo" },
  { id: "cat-importacion", label: "Importación" },
];
