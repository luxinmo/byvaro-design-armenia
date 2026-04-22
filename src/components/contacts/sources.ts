/**
 * Sources de la organización — orígenes desde los que entran los
 * contactos al CRM (portales, formulario web, referidos, agencias…).
 *
 * Definidos por el admin desde Ajustes. Los contactos guardan el
 * `source` como string libre, pero la lista oficial vive aquí y se
 * usa para el dropdown del filtro.
 *
 * En producción: tabla `contact_sources` (id, label, organization_id,
 * type?, created_at). Solo admins CRUD.
 */

import type { ContactSourceType } from "./types";

export type ContactSource = {
  id: string;
  label: string;
  /** Tipo opcional para iconografía / categorización futura. */
  type?: ContactSourceType;
};

export const DEFAULT_ORG_SOURCES: ContactSource[] = [
  { id: "idealista", label: "Idealista", type: "portal" },
  { id: "fotocasa", label: "Fotocasa", type: "portal" },
  { id: "web-form", label: "Web form", type: "direct" },
  { id: "direct", label: "Direct", type: "direct" },
  { id: "imported", label: "Imported", type: "import" },
];
