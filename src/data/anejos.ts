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
export const anejosByPromotion: Record<string, Anejo[]> = {
  "dev-1": [
    { id: "anejo-dev1-P1", promotionId: "dev-1", publicId: "P1", tipo: "parking",  precio: 18000, status: "available" },
    { id: "anejo-dev1-P2", promotionId: "dev-1", publicId: "P2", tipo: "parking",  precio: 18000, status: "reserved",  clientName: "María García", reservedAt: "2026-04-10" },
    { id: "anejo-dev1-P3", promotionId: "dev-1", publicId: "P3", tipo: "parking",  precio: 20000, status: "available" },
    { id: "anejo-dev1-T1", promotionId: "dev-1", publicId: "T1", tipo: "trastero", precio: 6500,  status: "available" },
    { id: "anejo-dev1-T2", promotionId: "dev-1", publicId: "T2", tipo: "trastero", precio: 6500,  status: "sold",      clientName: "Pedro Sánchez", soldAt: "2026-03-22" },
  ],
  "dev-2": [
    { id: "anejo-dev2-P1", promotionId: "dev-2", publicId: "P1", tipo: "parking",  precio: 15000, status: "available" },
    { id: "anejo-dev2-P2", promotionId: "dev-2", publicId: "P2", tipo: "parking",  precio: 15000, status: "available" },
    { id: "anejo-dev2-T1", promotionId: "dev-2", publicId: "T1", tipo: "trastero", precio: 5000,  status: "available" },
  ],
  "dev-3": [
    { id: "anejo-dev3-P1", promotionId: "dev-3", publicId: "P1", tipo: "parking",  precio: 22000, status: "reserved",  clientName: "Ana Martín", reservedAt: "2026-04-15" },
    { id: "anejo-dev3-P2", promotionId: "dev-3", publicId: "P2", tipo: "parking",  precio: 22000, status: "available" },
    { id: "anejo-dev3-T1", promotionId: "dev-3", publicId: "T1", tipo: "trastero", precio: 7000,  status: "available" },
    { id: "anejo-dev3-T2", promotionId: "dev-3", publicId: "T2", tipo: "trastero", precio: 7000,  status: "available", visibleToAgencies: false },
    { id: "anejo-dev3-T3", promotionId: "dev-3", publicId: "T3", tipo: "trastero", precio: 7000,  status: "withdrawn" },
  ],
  "dev-4": [
    { id: "anejo-dev4-P1", promotionId: "dev-4", publicId: "P1", tipo: "parking",  precio: 16000, status: "available" },
    { id: "anejo-dev4-P2", promotionId: "dev-4", publicId: "P2", tipo: "parking",  precio: 16000, status: "sold",      clientName: "Carlos López", soldAt: "2026-02-18" },
    { id: "anejo-dev4-P3", promotionId: "dev-4", publicId: "P3", tipo: "parking",  precio: 16000, status: "available" },
    { id: "anejo-dev4-T1", promotionId: "dev-4", publicId: "T1", tipo: "trastero", precio: 5500,  status: "available" },
    { id: "anejo-dev4-T2", promotionId: "dev-4", publicId: "T2", tipo: "trastero", precio: 5500,  status: "reserved",  clientName: "Laura Fernández", reservedAt: "2026-04-18" },
  ],
  "dev-5": [
    { id: "anejo-dev5-P1", promotionId: "dev-5", publicId: "P1", tipo: "parking",  precio: 12000, status: "available" },
    { id: "anejo-dev5-P2", promotionId: "dev-5", publicId: "P2", tipo: "parking",  precio: 12000, status: "available" },
    { id: "anejo-dev5-P3", promotionId: "dev-5", publicId: "P3", tipo: "parking",  precio: 12000, status: "available" },
    { id: "anejo-dev5-P4", promotionId: "dev-5", publicId: "P4", tipo: "parking",  precio: 12000, status: "reserved",  clientName: "Isabel Ruiz", reservedAt: "2026-04-20" },
    { id: "anejo-dev5-T1", promotionId: "dev-5", publicId: "T1", tipo: "trastero", precio: 4500,  status: "available" },
    { id: "anejo-dev5-T2", promotionId: "dev-5", publicId: "T2", tipo: "trastero", precio: 4500,  status: "available" },
  ],
};

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
