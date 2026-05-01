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
    publicRef: "ID172658",
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
    publicRef: "ID859421",
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
    publicRef: "ID936174",
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
    publicRef: "ID457820",
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

/* ─── DEPRECATED · `EXTERNAL_PROMOTOR_PORTFOLIO` ─────────────────
 *
 *  Antes existía un store paralelo con entries lite (`ExternalPortfolioEntry`)
 *  para que las fichas de promotores externos no salieran vacías. Hoy
 *  TODAS las promociones reales viven en `developerOnlyPromotions`
 *  con shape `DevPromotion` completo (ver entries `dev-aedas-1`,
 *  `dev-aedas-2`, `dev-neinor-1`, `dev-neinor-2`, `dev-habitat-1`,
 *  `dev-metrovacesa-1`, `dev-metrovacesa-2`).
 *
 *  El helper `getPromotionsByOwner(orgId)` en `src/lib/promotionsByOwner.ts`
 *  es la ÚNICA fuente · filtra `developerOnlyPromotions` por
 *  `ownerOrganizationId === orgId`.
 *
 *  Beneficio · IDs son clickables, las promos aparecen en el `/promociones`
 *  del owner cuando entra a su workspace, y no hay duplicados (Edificio
 *  Bilbao Alta solía aparecer 2 veces en la ficha de Neinor).
 *
 *  Backend · single SELECT desde `promotions WHERE owner_organization_id = $1`.
 * ────────────────────────────────────────────────────────────── */
