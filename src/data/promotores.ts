/**
 * Mock dataset de PROMOTORES & COMERCIALIZADORES con los que el
 * workspace actual colabora EN ROL DE COMERCIALIZADOR.
 *
 * El modelo de Byvaro permite que un mismo workspace opere como
 * "promotor" en sus propias promociones (las que crea él) y como
 * "comercializador" en promociones de otros promotores que le han
 * delegado la venta. Esta lista representa esa SEGUNDA cara: con
 * quién comercializo cuando NO soy el dueño de la promoción.
 *
 * Mismos campos que `Agency` para reusar componentes de cards
 * (`AgenciasTabStats` GridView). Cuando aterrice el backend real:
 *
 *   GET /api/workspace/promotores
 *     → lista de organizaciones (kind: "developer" | "comercializador")
 *       con las que el workspace actual tiene una relación de
 *       comercialización activa o histórica.
 */

import type { Agency } from "./agencies";

/** Mock de promotores · misma shape que Agency para reuse de UI. */
export const promotores: Agency[] = [
  {
    id: "prom-1",
    publicRef: "ID8TAG9C",
    name: "AEDAS Homes",
    logo: "https://api.dicebear.com/9.x/shapes/svg?seed=aedas&backgroundColor=1d4ed8&size=120",
    cover: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&h=200&fit=crop",
    location: "Madrid, España",
    type: "Network",
    description: "Promotora cotizada española · obra nueva residencial premium.",
    visitsCount: 142,
    registrations: 38,
    salesVolume: 8_950_000,
    collaboratingSince: "Mar 2025",
    status: "active",
    offices: [
      { city: "Madrid", address: "Paseo de la Castellana, 130, 28046 Madrid" },
      { city: "Barcelona", address: "Av. Diagonal, 640, 08017 Barcelona" },
    ],
    promotionsCollaborating: [],
    totalPromotionsAvailable: 12,
    origen: "invited",
    estadoColaboracion: "activa",
    registrosAportados: 38,
    ventasCerradas: 14,
    comisionMedia: 3,
    contractSignedAt: "2025-03-10",
    contractExpiresAt: "2026-09-10",
    mercados: ["ES"],
    conversionRate: 22,
    ticketMedio: 640_000,
    lastActivityAt: "2026-04-25",
    teamSize: 24,
    especialidad: "obra-nueva",
    ratingPromotor: 5,
    contactoPrincipal: {
      nombre: "Carlos Mendieta", rol: "Director comercial",
      email: "carlos.mendieta@aedashomes.es", telefono: "+34 91 555 0142",
      idiomas: ["ES", "EN"],
    },
    incidencias: { duplicados: 0, cancelaciones: 1, reclamaciones: 0 },
    googleRating: 4.4,
    googleRatingsTotal: 287,
    razonSocial: "AEDAS Homes S.A.",
    cif: "ESA12345678",
    fundadaEn: "2017",
    sitioWeb: "aedashomes.com",
  },
  {
    id: "prom-2",
    publicRef: "IDUV83Y2",
    name: "Neinor Homes",
    logo: "https://api.dicebear.com/9.x/shapes/svg?seed=neinor&backgroundColor=ec4899&size=120",
    cover: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&h=200&fit=crop",
    location: "Bilbao, España",
    type: "Network",
    description: "Mayor promotora cotizada por capitalización · BTR + BTS.",
    visitsCount: 98,
    registrations: 24,
    salesVolume: 6_200_000,
    collaboratingSince: "Jul 2025",
    status: "active",
    offices: [
      { city: "Bilbao", address: "Alameda de Recalde, 27, 48009 Bilbao" },
      { city: "Madrid", address: "C. de Velázquez, 105, 28006 Madrid" },
      { city: "Málaga", address: "Av. Andalucía, 26, 29002 Málaga" },
    ],
    promotionsCollaborating: [],
    totalPromotionsAvailable: 8,
    origen: "invited",
    estadoColaboracion: "activa",
    registrosAportados: 24,
    ventasCerradas: 9,
    comisionMedia: 3.5,
    contractSignedAt: "2025-07-22",
    contractExpiresAt: "2026-12-31",
    mercados: ["ES"],
    conversionRate: 18,
    ticketMedio: 530_000,
    lastActivityAt: "2026-04-21",
    teamSize: 35,
    especialidad: "obra-nueva",
    ratingPromotor: 4,
    contactoPrincipal: {
      nombre: "Marta Ribera", rol: "Head of channel sales",
      email: "marta.ribera@neinor.com", telefono: "+34 944 123 456",
      idiomas: ["ES", "EN"],
    },
    incidencias: { duplicados: 0, cancelaciones: 0, reclamaciones: 0 },
    googleRating: 4.2,
    googleRatingsTotal: 412,
    razonSocial: "Neinor Homes S.A.",
    cif: "ESA98765432",
    fundadaEn: "2015",
    sitioWeb: "neinorhomes.com",
  },
  {
    id: "prom-3",
    publicRef: "IDBZPYXX",
    name: "Habitat Inmobiliaria",
    logo: "https://api.dicebear.com/9.x/shapes/svg?seed=habitat&backgroundColor=059669&size=120",
    cover: "https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=600&h=200&fit=crop",
    location: "Barcelona, España",
    type: "Network",
    description: "Promotora histórica con 70 años · obra nueva costera.",
    visitsCount: 64,
    registrations: 15,
    salesVolume: 3_840_000,
    collaboratingSince: "Sep 2025",
    status: "active",
    offices: [
      { city: "Barcelona", address: "Av. Diagonal, 477, 08036 Barcelona" },
    ],
    promotionsCollaborating: [],
    totalPromotionsAvailable: 5,
    origen: "marketplace",
    estadoColaboracion: "activa",
    registrosAportados: 15,
    ventasCerradas: 5,
    comisionMedia: 4,
    contractSignedAt: "2025-09-01",
    contractExpiresAt: "2026-06-30",
    mercados: ["ES"],
    conversionRate: 16,
    ticketMedio: 480_000,
    lastActivityAt: "2026-04-20",
    teamSize: 12,
    especialidad: "second-home",
    ratingPromotor: 4,
    contactoPrincipal: {
      nombre: "Jordi Puig", rol: "Director comercial",
      email: "jordi.puig@habitatinmobiliaria.com", telefono: "+34 93 222 5588",
      idiomas: ["ES", "CA", "EN"],
    },
    incidencias: { duplicados: 1, cancelaciones: 0, reclamaciones: 0 },
    googleRating: 4.0,
    googleRatingsTotal: 156,
    razonSocial: "Habitat Inmobiliaria S.L.",
    cif: "ESB55667788",
    fundadaEn: "1953",
    sitioWeb: "habitatinmobiliaria.com",
  },
  {
    id: "prom-4",
    publicRef: "ID2BQYHF",
    name: "Metrovacesa",
    logo: "https://api.dicebear.com/9.x/shapes/svg?seed=metrovacesa&backgroundColor=f59e0b&size=120",
    cover: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&h=200&fit=crop",
    location: "Madrid, España",
    type: "Network",
    description: "Inmobiliaria con cartera de suelo más grande de España.",
    visitsCount: 0,
    registrations: 0,
    salesVolume: 0,
    collaboratingSince: "Abr 2026",
    status: "pending",
    offices: [
      { city: "Madrid", address: "Quintanavides 13, 28050 Madrid" },
    ],
    promotionsCollaborating: [],
    totalPromotionsAvailable: 0,
    origen: "invited",
    estadoColaboracion: "contrato-pendiente",
    registrosAportados: 0,
    ventasCerradas: 0,
    comisionMedia: 3,
    mercados: ["ES"],
    conversionRate: 0,
    ticketMedio: 0,
    lastActivityAt: "2026-04-26",
    teamSize: 18,
    especialidad: "obra-nueva",
    ratingPromotor: 0,
    contactoPrincipal: {
      nombre: "Sara Llorente", rol: "Channel manager",
      email: "sara.llorente@metrovacesa.com", telefono: "+34 91 444 6677",
      idiomas: ["ES", "EN"],
    },
    incidencias: { duplicados: 0, cancelaciones: 0, reclamaciones: 0 },
    googleRating: 3.9,
    googleRatingsTotal: 89,
    razonSocial: "Metrovacesa S.A.",
    cif: "ESA87654321",
    fundadaEn: "1918",
    sitioWeb: "metrovacesa.com",
  },
];

/* ═══════════════════════════════════════════════════════════════════
   Mini portfolio por promotor externo · solo para PortfolioShowcase.

   Propósito: cuando una agencia (o el workspace logueado actuando
   como comercializador) entra a `/promotor/prom-1`, debe ver el
   portfolio del PROMOTOR mostrado, no las promociones del
   workspace logueado. En el mock no tenemos un dataset completo de
   promociones por promotor externo · usamos esta tabla con 2
   promociones representativas de cada uno.

   Cuando aterrice backend: `GET /api/promotor/:id/portfolio?status=active`
   reemplaza esto.

   Shape compatible con `PortfolioShowcase` (subset de `Promotion`).
   ═══════════════════════════════════════════════════════════════════ */
export interface ExternalPortfolioEntry {
  id: string;
  /** ID del workspace dueño (FK a `organizations`) · siempre el id
   *  del promotor externo (`prom-1`, `prom-2`…). Cuando llegue
   *  multi-tenant real, este campo se valida server-side. */
  ownerOrganizationId: string;
  name: string;
  location: string;
  image?: string;
  status?: "active" | "incomplete" | "inactive" | "sold-out";
  badge?: "new" | "last-units";
  priceMin: number;
  priceMax: number;
  totalUnits: number;
  availableUnits: number;
  delivery?: string;
}

export const EXTERNAL_PROMOTOR_PORTFOLIO: Record<string, ExternalPortfolioEntry[]> = {
  "prom-1": [
    {
      id: "aedas-1", ownerOrganizationId: "prom-1", name: "Célere Castellana",
      location: "Madrid · Chamartín",
      image: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&h=600&fit=crop",
      status: "active", badge: "new",
      priceMin: 580_000, priceMax: 1_400_000,
      totalUnits: 96, availableUnits: 38, delivery: "Q2 2027",
    },
    {
      id: "aedas-2", ownerOrganizationId: "prom-1", name: "Aura Rivas",
      location: "Rivas Vaciamadrid",
      image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop",
      status: "active",
      priceMin: 320_000, priceMax: 480_000,
      totalUnits: 142, availableUnits: 17, delivery: "Q4 2025",
    },
  ],
  "prom-2": [
    {
      id: "neinor-1", ownerOrganizationId: "prom-2", name: "Edificio Bilbao Alta",
      location: "Bilbao · Abando",
      image: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop",
      status: "active", badge: "last-units",
      priceMin: 420_000, priceMax: 950_000,
      totalUnits: 56, availableUnits: 4, delivery: "Q1 2026",
    },
    {
      id: "neinor-2", ownerOrganizationId: "prom-2", name: "Vegas del Saz",
      location: "Madrid · El Saz",
      image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop",
      status: "active",
      priceMin: 290_000, priceMax: 410_000,
      totalUnits: 82, availableUnits: 22, delivery: "Q3 2026",
    },
  ],
  "prom-3": [
    {
      id: "habitat-1", ownerOrganizationId: "prom-3", name: "Habitat Diagonal Mar",
      location: "Barcelona · Diagonal Mar",
      image: "https://images.unsplash.com/photo-1565953522043-baea26b83b7e?w=800&h=600&fit=crop",
      status: "active",
      priceMin: 510_000, priceMax: 1_200_000,
      totalUnits: 64, availableUnits: 11, delivery: "Q4 2026",
    },
  ],
  "prom-4": [
    {
      id: "metrovacesa-1", ownerOrganizationId: "prom-4", name: "Mirador del Levante",
      location: "Valencia · Marina Real",
      image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=600&fit=crop",
      status: "active",
      priceMin: 380_000, priceMax: 720_000,
      totalUnits: 110, availableUnits: 41, delivery: "Q3 2027",
    },
    {
      id: "metrovacesa-2", ownerOrganizationId: "prom-4", name: "Skyline Plaza",
      location: "Sevilla · Cartuja",
      image: "https://images.unsplash.com/photo-1494526585095-c41746248156?w=800&h=600&fit=crop",
      status: "active", badge: "new",
      priceMin: 260_000, priceMax: 410_000,
      totalUnits: 88, availableUnits: 64, delivery: "Q2 2027",
    },
  ],
};

export function getExternalPromotorPortfolio(id: string): ExternalPortfolioEntry[] {
  return EXTERNAL_PROMOTOR_PORTFOLIO[id] ?? [];
}
