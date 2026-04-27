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
  puntosDeVenta?: PuntoDeVenta[];
  comerciales?: Comercial[];
};

export const developerOnlyPromotions: DevPromotion[] = [
  {
    id: "dev-1",
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
    developer: "My Company",
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
    puntosDeVenta: [
      { id: "pv-1", nombre: "Oficina Central Marbella", direccion: "Av. del Mar 15, Marbella", telefono: "+34 952 123 456", email: "marbella@mycompany.com", whatsapp: "+34 652 123 456", coverUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=400&fit=crop" },
      { id: "pv-2", nombre: "Showroom Puerto Banús", direccion: "Puerto Banús, Local 8", telefono: "+34 952 654 321", email: "banus@mycompany.com", whatsapp: "+34 652 654 321", coverUrl: "https://images.unsplash.com/photo-1604328698692-f76ea9498e76?w=600&h=400&fit=crop" },
    ],
    comerciales: [
      { id: "com-1", nombre: "Carlos Martínez", email: "carlos@mycompany.com", permissions: { canRegister: true, canShareWithAgencies: true, canEdit: false } },
      { id: "com-2", nombre: "Ana García", email: "ana@mycompany.com", permissions: { canRegister: true, canShareWithAgencies: false, canEdit: true } },
    ],
  },
  {
    id: "dev-2",
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
    developer: "My Company",
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
    puntosDeVenta: [
      { id: "pv-3", nombre: "Sales Office Jávea", direccion: "Av. del Plá 12, Jávea", telefono: "+34 965 123 456", email: "javea@mycompany.com", whatsapp: "+34 665 123 456", coverUrl: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=800&h=500&fit=crop&q=80" },
    ],
  },
  {
    id: "dev-3",
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
    developer: "My Company",
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
    developer: "My Company",
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
    commission: 0,
    developer: "My Company",
    agencies: 0,
    agencyAvatars: [],
    propertyTypes: ["Apartments"],
    image: "https://images.unsplash.com/photo-1574362848149-11496d93a7c7?w=600&h=400&fit=crop",
    collaborating: false,
    updatedAt: "1 day ago",
    constructionProgress: 85,
    hasShowFlat: true,
    buildingType: "plurifamiliar",
    missingSteps: ["Collaborators"],
    canShareWithAgencies: false,
  },
];
