import { type Promotion } from "./promotions";
import type { FormaPagoComision, ClasificacionCliente, CondicionRegistro, HitoComision } from "@/types/promotion-config";
import type { ModoValidacionRegistro } from "@/components/crear-promocion/types";

export type CollaborationConfig = {
  comisionInternacional: number;
  comisionNacional: number;
  diferenciarNacionalInternacional: boolean;
  diferenciarComisiones: boolean;
  agenciasRefusarNacional: boolean;
  clasificacionCliente: ClasificacionCliente;
  formaPagoComision: FormaPagoComision | null;
  hitosComision: HitoComision[];
  ivaIncluido: boolean;
  condicionesRegistro: CondicionRegistro[];
  validezRegistroDias: number; // 0 = no expira
  /** Modo de validación · "directo" o "por_visita". Opcional en seed
   *  para retro-compatibilidad: cuando falta, asumir "por_visita" (el
   *  default histórico de la copy del wizard).
   *  TODO(logic): la lógica que actúa sobre este flag aún no existe ·
   *  ver `docs/registration-system.md §2`. */
  modoValidacionRegistro?: ModoValidacionRegistro;
};

export type PuntoDeVenta = {
  id: string;
  nombre: string;
  direccion: string;
  telefono: string;
  email: string;
  whatsapp: string;
  coverUrl?: string;
};

export type ComercialPermissions = {
  canRegister: boolean;
  canShareWithAgencies: boolean;
  canEdit: boolean;
};

export type Comercial = {
  id: string;
  nombre: string;
  email: string;
  avatar?: string;
  permissions: ComercialPermissions;
};

export type DevPromotion = Promotion & {
  missingSteps?: string[];
  canShareWithAgencies?: boolean;
  collaboration?: CollaborationConfig;
  /** IDs de oficinas del workspace (`byvaro-oficinas`) que actúan
   *  como puntos de venta para esta promoción. La fuente de verdad de
   *  los datos de oficina es `useOficinas()` — aquí solo guardamos
   *  referencias. NUNCA inline data: una oficina referenciada SIEMPRE
   *  debe existir en el listado del workspace. */
  puntosDeVentaIds?: string[];
  comerciales?: Comercial[];
};

/* RAW seeds · el campo `code` legacy queda como breadcrumb · el real
 * lo derivamos abajo con `seedRef("promotion", id)` siguiendo el
 * scheme canónico (PR + 5 dígitos · CLAUDE.md). */
const RAW_DEV_PROMOTIONS: DevPromotion[] = [
  {
    id: "dev-1",
    ownerOrganizationId: "developer-default",
    code: "PRM-0050",
    name: "Villa Serena",
    location: "Marbella, Costa del Sol",
    priceMin: 1250000,
    priceMax: 1250000,
    availableUnits: 1,
    totalUnits: 1,
    status: "active",
    reservationCost: 30000,
    delivery: "Q4 2026",
    commission: 5,
    developer: "",
    agencies: 0,
    agencyAvatars: [],
    propertyTypes: ["Villa"],
    image: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=600&h=400&fit=crop",
    collaborating: false,
    updatedAt: "1 day ago",
    constructionProgress: 70,
    hasShowFlat: false,
    buildingType: "unifamiliar-single",
    canShareWithAgencies: true,
    collaboration: {
      comisionInternacional: 5,
      comisionNacional: 3,
      diferenciarNacionalInternacional: true,
      diferenciarComisiones: true,
      agenciasRefusarNacional: false,
      clasificacionCliente: "residencia",
      formaPagoComision: "escritura",
      hitosComision: [],
      ivaIncluido: true,
      condicionesRegistro: ["nombre_completo", "ultimas_4_cifras", "nacionalidad", "email_completo"],
      validezRegistroDias: 90,
    },
    puntosDeVentaIds: ["of-1", "of-2"],
    comerciales: [
      { id: "com-1", nombre: "Carlos Martínez", email: "carlos@mycompany.com", permissions: { canRegister: true, canShareWithAgencies: true, canEdit: false } },
      { id: "com-2", nombre: "Ana García", email: "ana@mycompany.com", permissions: { canRegister: true, canShareWithAgencies: false, canEdit: true } },
    ],
  },
  {
    id: "dev-2",
    ownerOrganizationId: "developer-default",
    code: "PRM-0051",
    name: "Villas del Pinar",
    location: "Jávea, Alicante",
    priceMin: 680000,
    priceMax: 1100000,
    availableUnits: 6,
    totalUnits: 12,
    status: "active",
    reservationCost: 15000,
    delivery: "Q2 2027",
    commission: 4.5,
    developer: "",
    agencies: 2,
    agencyAvatars: [],
    propertyTypes: ["Villas", "Townhouses"],
    image: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&h=400&fit=crop",
    badge: "new",
    collaborating: false,
    updatedAt: "3 hours ago",
    constructionProgress: 15,
    hasShowFlat: false,
    buildingType: "unifamiliar-multiple",
    canShareWithAgencies: true,
    activity: { inquiries: 22, reservations: 3, visits: 8, trend: 55 },
    collaboration: {
      comisionInternacional: 4.5,
      comisionNacional: 4.5,
      diferenciarNacionalInternacional: false,
      diferenciarComisiones: false,
      agenciasRefusarNacional: false,
      clasificacionCliente: "residencia",
      formaPagoComision: "proporcional",
      hitosComision: [],
      ivaIncluido: true,
      condicionesRegistro: ["nombre_completo", "ultimas_4_cifras", "nacionalidad"],
      validezRegistroDias: 0,
    },
    puntosDeVentaIds: ["of-3"],
  },
  {
    id: "dev-3",
    ownerOrganizationId: "developer-default",
    code: "PRM-0052",
    name: "Residencial Aurora",
    location: "Benalmádena, Málaga",
    priceMin: 290000,
    priceMax: 520000,
    availableUnits: 24,
    totalUnits: 36,
    status: "incomplete",
    reservationCost: 6000,
    delivery: "Q1 2027",
    commission: 0,
    developer: "",
    agencies: 0,
    agencyAvatars: [],
    propertyTypes: ["Apartments", "Penthouses"],
    collaborating: false,
    updatedAt: "2 days ago",
    buildingType: "plurifamiliar",
    missingSteps: ["Multimedia", "Description", "Units"],
    canShareWithAgencies: false,
  },
  {
    id: "dev-4",
    ownerOrganizationId: "developer-default",
    code: "PRM-0053",
    name: "Terrazas del Golf",
    location: "Mijas, Costa del Sol",
    priceMin: 345000,
    priceMax: 780000,
    availableUnits: 18,
    totalUnits: 28,
    status: "incomplete",
    reservationCost: 8000,
    delivery: "Q3 2026",
    commission: 4,
    developer: "",
    agencies: 0,
    agencyAvatars: [],
    propertyTypes: ["Apartments", "Townhouses"],
    image: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&h=400&fit=crop",
    collaborating: false,
    updatedAt: "5 days ago",
    constructionProgress: 40,
    buildingType: "plurifamiliar",
    missingSteps: ["Payment plan", "Basic info"],
    canShareWithAgencies: false,
  },
  {
    id: "dev-5",
    ownerOrganizationId: "developer-default",
    code: "PRM-0054",
    name: "Mar Azul Residences",
    location: "Torrevieja, Alicante",
    priceMin: 215000,
    priceMax: 410000,
    availableUnits: 30,
    totalUnits: 44,
    status: "active",
    reservationCost: 5000,
    delivery: "Q2 2026",
    commission: 4,
    developer: "",
    agencies: 0,
    agencyAvatars: [],
    propertyTypes: ["Apartments"],
    image: "https://images.unsplash.com/photo-1574362848149-11496d93a7c7?w=600&h=400&fit=crop",
    collaborating: false,
    updatedAt: "1 day ago",
    constructionProgress: 85,
    hasShowFlat: true,
    buildingType: "plurifamiliar",
    canShareWithAgencies: true,
  },
  /* Copia de PRM-0051 "Villas del Pinar" reasignada al workspace de
   * AEDAS Homes (`prom-1`). Mismos datos comerciales y de
   * configuración · cambian solo:
   *   · id (único)
   *   · code (referencia interna del workspace AEDAS)
   *   · ownerOrganizationId → "prom-1"
   *   · image (foto distinta · evita confusión visual con el original)
   *   · puntosDeVentaIds: [] (las oficinas of-1...of-6 son del seed
   *     de Luxinmo · AEDAS gestiona las suyas desde su propia ficha)
   *   · comerciales: [] (los com-1/com-2 pertenecen a Luxinmo)
   * Status "active" · publicada y visible en /promotor/ID8TAG9C. */
  {
    id: "dev-2-aedas-copy",
    ownerOrganizationId: "prom-1",
    code: "PRM-AED-0051",
    name: "Villas del Pinar",
    location: "Jávea, Alicante",
    priceMin: 680000,
    priceMax: 1100000,
    availableUnits: 6,
    totalUnits: 12,
    status: "active",
    reservationCost: 15000,
    delivery: "Q2 2027",
    commission: 4.5,
    developer: "",
    agencies: 2,
    agencyAvatars: [],
    propertyTypes: ["Villas", "Townhouses"],
    image: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=600&h=400&fit=crop",
    badge: "new",
    collaborating: false,
    updatedAt: "just now",
    constructionProgress: 15,
    hasShowFlat: false,
    buildingType: "unifamiliar-multiple",
    canShareWithAgencies: true,
    activity: { inquiries: 22, reservations: 3, visits: 8, trend: 55 },
    collaboration: {
      comisionInternacional: 4.5,
      comisionNacional: 4.5,
      diferenciarNacionalInternacional: false,
      diferenciarComisiones: false,
      agenciasRefusarNacional: false,
      clasificacionCliente: "residencia",
      formaPagoComision: "proporcional",
      hitosComision: [],
      ivaIncluido: true,
      condicionesRegistro: ["nombre_completo", "ultimas_4_cifras", "nacionalidad"],
      validezRegistroDias: 0,
    },
    puntosDeVentaIds: [],
    comerciales: [],
  },
  /* Seeds mínimos para developers no-Luxinmo · cada workspace ve al
   *  menos 1 promoción suya al hacer login. Mismo patrón que la
   *  AEDAS-copy de arriba · datos comerciales mock razonables. */
  {
    id: "dev-neinor-1",
    ownerOrganizationId: "prom-2",
    code: "PRM-NHO-0001",
    name: "Edificio Bilbao Alta",
    location: "Bilbao · Abando",
    priceMin: 420000,
    priceMax: 950000,
    availableUnits: 4,
    totalUnits: 56,
    status: "active",
    reservationCost: 12000,
    delivery: "Q1 2026",
    commission: 4,
    developer: "",
    agencies: 0,
    agencyAvatars: [],
    propertyTypes: ["Pisos"],
    image: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&h=400&fit=crop",
    badge: "last-units",
    collaborating: false,
    updatedAt: "1 day ago",
    constructionProgress: 80,
    hasShowFlat: true,
    buildingType: "plurifamiliar",
    canShareWithAgencies: true,
    puntosDeVentaIds: [],
    comerciales: [],
  },
  {
    id: "dev-habitat-1",
    ownerOrganizationId: "prom-3",
    code: "PRM-HBT-0001",
    name: "Habitat Diagonal Mar",
    location: "Barcelona · Diagonal Mar",
    priceMin: 510000,
    priceMax: 1200000,
    availableUnits: 11,
    totalUnits: 64,
    status: "active",
    reservationCost: 15000,
    delivery: "Q4 2026",
    commission: 4.5,
    developer: "",
    agencies: 0,
    agencyAvatars: [],
    propertyTypes: ["Pisos", "Áticos"],
    image: "https://images.unsplash.com/photo-1565953522043-baea26b83b7e?w=600&h=400&fit=crop",
    collaborating: false,
    updatedAt: "3 days ago",
    constructionProgress: 35,
    hasShowFlat: false,
    buildingType: "plurifamiliar",
    canShareWithAgencies: true,
    puntosDeVentaIds: [],
    comerciales: [],
  },
  {
    id: "dev-metrovacesa-1",
    ownerOrganizationId: "prom-4",
    code: "PRM-MVC-0001",
    name: "Mirador del Levante",
    location: "Valencia · Marina Real",
    priceMin: 380000,
    priceMax: 720000,
    availableUnits: 41,
    totalUnits: 110,
    status: "active",
    reservationCost: 10000,
    delivery: "Q3 2027",
    commission: 4,
    developer: "",
    agencies: 0,
    agencyAvatars: [],
    propertyTypes: ["Pisos", "Dúplex"],
    image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&h=400&fit=crop",
    collaborating: false,
    updatedAt: "2 days ago",
    constructionProgress: 10,
    hasShowFlat: false,
    buildingType: "plurifamiliar",
    canShareWithAgencies: true,
    puntosDeVentaIds: [],
    comerciales: [],
  },
];

import { seedRef } from "@/lib/publicRef";

/** Export final · `code` se sobrescribe con el formato canónico
 *  `PR + 5 dígitos` derivado del id via hash determinista. */
export const developerOnlyPromotions: DevPromotion[] = RAW_DEV_PROMOTIONS.map((p) => ({
  ...p,
  code: seedRef("promotion", p.id),
}));
