export type PromotionStatus = "active" | "incomplete" | "inactive" | "sold-out";
export type BuildingType = "plurifamiliar" | "unifamiliar-single" | "unifamiliar-multiple";

import type { ModoValidacionRegistro, RoleOption } from "@/components/crear-promocion/types";

export type Promotion = {
  id: string;
  code: string;
  name: string;
  location: string;
  priceMin: number;
  priceMax: number;
  availableUnits: number;
  totalUnits: number;
  status: PromotionStatus;
  reservationCost: number;
  delivery: string;
  commission: number;
  developer: string;
  agencies: number;
  agencyAvatars: string[];
  propertyTypes: string[];
  image?: string;
  badge?: "new" | "last-units";
  collaborating?: boolean;
  updatedAt: string;
  constructionProgress?: number;
  hasShowFlat?: boolean;
  buildingType?: BuildingType;
  activity?: {
    inquiries: number;
    reservations: number;
    visits: number;
    trend: number;
  };
  /** Modo de validación · `directo` o `por_visita`. Si falta, asumir
   *  `por_visita` (alineado con la copy histórica del wizard que
   *  prometía preregistro tras visita). Ver `WizardState.modoValidacionRegistro`
   *  y `docs/registration-system.md §2`. */
  modoValidacionRegistro?: ModoValidacionRegistro;
  /** Rol del workspace dueño de esta promoción · "promotor" (construye)
   *  o "comercializador" (vende en exclusiva la obra de un tercero).
   *  Set en el wizard de creación · CLAUDE.md regla de oro. Si falta,
   *  asumir "promotor" para retrocompatibilidad con seeds antiguos.
   *  Toda copy en la UI ("Esperando decisión del promotor", "Aprobado
   *  por el promotor"…) DEBE leer este campo · usar el helper
   *  `getOwnerRoleLabel()` de `src/lib/promotionRole.ts`. */
  ownerRole?: RoleOption;

  /** ID del workspace (organization) dueño de la promoción.
   *
   *  **Backend**: mapea a `promotions.owner_organization_id`
   *  (FK NOT NULL a `organizations.id`). TODA query de promociones
   *  DEBE filtrar por este campo · es la columna de aislamiento
   *  multi-tenant. Sin este filtro hay fuga de datos cross-tenant.
   *
   *  **Mock single-tenant**:
   *    · `"developer-default"` → promociones de Luxinmo (workspace
   *      logueado) en `promotions.ts` + `developerOnlyPromotions.ts`.
   *    · `"prom-1"`, `"prom-2"`… → portfolios mock de promotores
   *      externos en `EXTERNAL_PROMOTOR_PORTFOLIO`.
   *
   *  Helper canónico para resolver portfolio per-tenant:
   *  `getPromotionsByOwner(orgId)` en `src/lib/promotionsByOwner.ts`.
   *  NUNCA leer `promotions` o `developerOnlyPromotions` directamente
   *  desde un componente que renderiza data per-tenant · usa el
   *  helper para que el filtro sea explícito y trazable.
   *
   *  Si falta (seeds legacy), tratar como `"developer-default"`. */
  ownerOrganizationId?: string;
};

export function getBuildingTypeLabel(type?: BuildingType): string | null {
  if (!type) return null;
  const map: Record<BuildingType, string> = {
    "plurifamiliar": "Plurifamiliar",
    "unifamiliar-single": "Única vivienda",
    "unifamiliar-multiple": "Varias viviendas",
  };
  return map[type] ?? null;
}

export const promotions: Promotion[] = [
  {
    id: "1",
    ownerOrganizationId: "developer-default",
    code: "PRM-0042",
    name: "Altea Hills Residences",
    location: "Altea, Alicante",
    priceMin: 344000,
    priceMax: 1400000,
    availableUnits: 12,
    totalUnits: 48,
    status: "active",
    reservationCost: 6000,
    delivery: "Q2 2026",
    commission: 5,
    developer: "Kronos Homes",
    agencies: 4,
    agencyAvatars: ["https://i.pravatar.cc/40?img=1", "https://i.pravatar.cc/40?img=2", "https://i.pravatar.cc/40?img=3", "https://i.pravatar.cc/40?img=4"],
    propertyTypes: ["Apartments", "Penthouses"],
    image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&h=400&fit=crop",
    badge: "new",
    collaborating: true,
    updatedAt: "2 hours ago",
    constructionProgress: 45,
    hasShowFlat: true,
    buildingType: "plurifamiliar",
    activity: { inquiries: 34, reservations: 6, visits: 18, trend: 65 },
  },
  {
    id: "2",
    ownerOrganizationId: "developer-default",
    code: "PRM-0041",
    name: "Marina Bay Towers",
    location: "Málaga, Costa del Sol",
    priceMin: 385000,
    priceMax: 920000,
    availableUnits: 3,
    totalUnits: 32,
    status: "active",
    reservationCost: 10000,
    delivery: "Q4 2025",
    commission: 4.5,
    developer: "Metrovacesa",
    agencies: 6,
    agencyAvatars: ["https://i.pravatar.cc/40?img=5", "https://i.pravatar.cc/40?img=6", "https://i.pravatar.cc/40?img=7"],
    propertyTypes: ["Apartments", "Duplexes"],
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=400&fit=crop",
    badge: "last-units",
    collaborating: true,
    updatedAt: "5 hours ago",
    constructionProgress: 92,
    hasShowFlat: true,
    buildingType: "plurifamiliar",
    activity: { inquiries: 48, reservations: 8, visits: 22, trend: 120 },
  },
  {
    id: "3",
    ownerOrganizationId: "developer-default",
    code: "PRM-0040",
    name: "Serena Golf Villas",
    location: "Estepona, Costa del Sol",
    priceMin: 890000,
    priceMax: 2100000,
    availableUnits: 18,
    totalUnits: 24,
    status: "active",
    reservationCost: 25000,
    delivery: "Q1 2027",
    commission: 6,
    developer: "Taylor Wimpey",
    agencies: 2,
    agencyAvatars: ["https://i.pravatar.cc/40?img=8", "https://i.pravatar.cc/40?img=9"],
    propertyTypes: ["Villas", "Townhouses"],
    image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&h=400&fit=crop",
    badge: "new",
    collaborating: false,
    updatedAt: "1 day ago",
    constructionProgress: 10,
    hasShowFlat: false,
    buildingType: "unifamiliar-multiple",
    activity: { inquiries: 12, reservations: 2, visits: 5, trend: 15 },
  },
  {
    id: "4",
    ownerOrganizationId: "developer-default",
    code: "PRM-0039",
    name: "Skyline Residences",
    location: "Valencia, Ciudad de las Artes",
    priceMin: 265000,
    priceMax: 580000,
    availableUnits: 34,
    totalUnits: 80,
    status: "active",
    reservationCost: 5000,
    delivery: "Q3 2026",
    commission: 4,
    developer: "Neinor Homes",
    agencies: 8,
    agencyAvatars: ["https://i.pravatar.cc/40?img=10", "https://i.pravatar.cc/40?img=11", "https://i.pravatar.cc/40?img=12"],
    propertyTypes: ["Apartments", "Penthouses", "Studios"],
    image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&h=400&fit=crop",
    collaborating: true,
    updatedAt: "1 day ago",
    constructionProgress: 60,
    hasShowFlat: true,
    buildingType: "plurifamiliar",
    activity: { inquiries: 8, reservations: 1, visits: 3, trend: -5 },
  },
  {
    id: "5",
    ownerOrganizationId: "developer-default",
    code: "PRM-0038",
    name: "Puerta del Mar",
    location: "Alicante, Playa de San Juan",
    priceMin: 310000,
    priceMax: 490000,
    availableUnits: 1,
    totalUnits: 56,
    status: "active",
    reservationCost: 8000,
    delivery: "Q2 2025",
    commission: 3.5,
    developer: "Aedas Homes",
    agencies: 3,
    agencyAvatars: ["https://i.pravatar.cc/40?img=13", "https://i.pravatar.cc/40?img=14"],
    propertyTypes: ["Apartments"],
    image: "https://images.unsplash.com/photo-1580587771525-78b9dbd7c4ce?w=600&h=400&fit=crop",
    badge: "last-units",
    collaborating: false,
    updatedAt: "3 days ago",
    constructionProgress: 98,
    hasShowFlat: false,
    buildingType: "plurifamiliar",
    activity: { inquiries: 41, reservations: 5, visits: 15, trend: 85 },
  },
  {
    id: "6",
    ownerOrganizationId: "developer-default",
    code: "PRM-0037",
    name: "Bosque Real",
    location: "Madrid, Las Rozas",
    priceMin: 720000,
    priceMax: 1800000,
    availableUnits: 9,
    totalUnits: 16,
    status: "active",
    reservationCost: 15000,
    delivery: "Q4 2026",
    commission: 5.5,
    developer: "Acciona Inmobiliaria",
    agencies: 1,
    agencyAvatars: ["https://i.pravatar.cc/40?img=15"],
    propertyTypes: ["Villas", "Apartments"],
    image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&h=400&fit=crop",
    collaborating: true,
    updatedAt: "4 days ago",
    constructionProgress: 30,
    hasShowFlat: false,
    buildingType: "unifamiliar-multiple",
    activity: { inquiries: 5, reservations: 0, visits: 1, trend: -10 },
  },
  {
    id: "7",
    ownerOrganizationId: "developer-default",
    code: "PRM-0036",
    name: "Incomplete Project",
    location: "",
    priceMin: 0,
    priceMax: 0,
    availableUnits: 0,
    totalUnits: 0,
    status: "incomplete",
    reservationCost: 0,
    delivery: "",
    commission: 0,
    developer: "",
    agencies: 0,
    agencyAvatars: [],
    propertyTypes: [],
    collaborating: false,
    updatedAt: "1 week ago",
  },
  {
    id: "8",
    ownerOrganizationId: "developer-default",
    code: "PRM-0035",
    name: "Terramar Beach",
    location: "Sitges, Barcelona Coast",
    priceMin: 550000,
    priceMax: 1200000,
    availableUnits: 0,
    totalUnits: 40,
    status: "sold-out",
    reservationCost: 12000,
    delivery: "Q1 2026",
    commission: 4.5,
    developer: "Habitat Inmobiliaria",
    agencies: 11,
    agencyAvatars: ["https://i.pravatar.cc/40?img=16", "https://i.pravatar.cc/40?img=17", "https://i.pravatar.cc/40?img=18"],
    propertyTypes: ["Apartments", "Penthouses"],
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&h=400&fit=crop",
    collaborating: false,
    updatedAt: "2 weeks ago",
    constructionProgress: 100,
    hasShowFlat: true,
    buildingType: "plurifamiliar",
  },
];