/**
 * Anejos sueltos · parkings y trasteros que se venden separados de la
 * vivienda, con su propio precio y estado.
 *
 * Se crean desde el wizard (`CrearUnidadesStep.tsx`, sección "Anejos
 * sueltos") cuando el promotor configura que NO van incluidos en el
 * precio de la vivienda o cuando hay más plazas/trasteros que
 * viviendas.
 *
 * En el modelo de ficha se exponen en la tab Disponibilidad como un
 * segmento paralelo a "Viviendas" — misma tabla, mismo kebab, mismas
 * acciones (Ver · Editar · Enviar por email · Iniciar compra).
 *
 * TODO(backend): endpoints en `docs/backend-integration.md §3`
 *   - `GET /api/promociones/:id/anejos` → Anejo[]
 *   - `PATCH /api/anejos/:id`
 *   - `POST /api/anejos/:id/reservations`
 */

export type AnejoTipo = "parking" | "trastero";
export type AnejoStatus = "available" | "reserved" | "sold" | "withdrawn";

export type Anejo = {
  id: string;
  promotionId: string;
  /** ID visible (P1, T2, etc.). */
  publicId: string;
  tipo: AnejoTipo;
  precio: number;
  status: AnejoStatus;
  clientName?: string;
  agencyName?: string;
  reservedAt?: string;
  soldAt?: string;
  /** Si es `false`, el anejo existe para el promotor pero NO se muestra
   *  a agencias colaboradoras (no aparece en tabla ni KPIs). Por
   *  defecto `true` (visible). Se controla desde el kebab "Visible
   *  para agencias" en la ficha de promoción. */
  visibleToAgencies?: boolean;
};

/**
 * Mock de anejos por promoción. En producción se rellenan desde el
 * wizard al publicar una promoción.
 */
export const anejosByPromotion: Record<string, Anejo[]> = {};

export const anejoStatusConfig: Record<AnejoStatus, { label: string; dotClass: string; badgeClass: string }> = {
  available: { label: "Disponible",   dotClass: "bg-success",    badgeClass: "bg-success/10 text-success border border-success/25" },
  reserved:  { label: "Reservado",    dotClass: "bg-warning",      badgeClass: "bg-warning/10 text-warning border border-warning/25" },
  sold:      { label: "Vendido",      dotClass: "bg-muted-foreground",badgeClass: "bg-muted text-foreground border border-border" },
  withdrawn: { label: "Retirado",     dotClass: "bg-destructive/70", badgeClass: "bg-destructive/5 text-destructive border border-destructive/25" },
};

export const anejoTipoLabel: Record<AnejoTipo, string> = {
  parking:  "Parking",
  trastero: "Trastero",
};
