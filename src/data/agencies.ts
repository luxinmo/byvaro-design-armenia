/**
 * Agency · vista del promotor sobre una agencia colaboradora.
 *
 * ⚠️ TODO(backend): en producción este tipo NO debe ser una tabla plana.
 * Es el resultado de un JOIN entre:
 *   - `Empresa` (tenant de la agencia) → name, logo, cover, location, type,
 *     teamSize, mercados, googleRating, offices[], etc.
 *   - `Collaboration` (relación promotor↔agencia) → estadoColaboracion,
 *     origen, contractSignedAt, contractExpiresAt, comisionMedia,
 *     ventasCerradas, registrosAportados, salesVolume, visitsCount,
 *     solicitudPendiente, incidencias, ratingPromotor.
 *
 * Ver `docs/backend-integration.md` §0 y §4 para el contrato completo.
 * Cuando se conecte backend: los campos públicos (logo, cover, name, …)
 * deben venir del Empresa del tenant de la agencia — no duplicados aquí.
 */

import { developerOnlyPromotions } from "./developerPromotions";
import { getAllContracts } from "@/lib/collaborationContracts";
import type { LicenciaInmobiliaria } from "@/lib/licenses";

export type Agency = {
  id: string;
  name: string;
  /** Logo cuadrado/circular (iconmark · avatar). Usado en listados,
   *  chips, avatar-stacks. Recomendado ≥256×256 cuadrado.
   *  TODO(backend): debe venir de `Empresa.logoUrl` del tenant agencia. */
  logo?: string;
  /** Logo rectangular tipo wordmark. Usado en headers de ficha, firma
   *  de email, portadas. Recomendado ~250×100 o 125×60 (2:1). Mapea al
   *  `empresa.logoRect` cuando la agencia sincroniza su perfil. */
  logoRect?: string;
  cover?: string;
  location: string;
  type: "Agency" | "Broker" | "Network";
  description: string;
  visitsCount: number;
  registrations: number;
  salesVolume: number;
  collaboratingSince?: string;
  status: "active" | "pending" | "inactive" | "expired";
  offices: { city: string; address: string }[];
  /** Which promotions this agency collaborates in (by id) */
  promotionsCollaborating: string[];
  /** Total promotions from this developer the agency has access to */
  totalPromotionsAvailable: number;
  /** Is this a new request for collaboration? */
  isNewRequest?: boolean;

  /* ─── Byvaro v2 · módulo Colaboradores ─── */
  /** Origen de la agencia en la red del promotor:
   *  - "invited"     · la trajo el promotor (plan 0€)
   *  - "marketplace" · llegó desde el marketplace (plan 99€) */
  origen?: "invited" | "marketplace";
  /** Estado operativo de la colaboración dentro de Byvaro v2.
   *  Se solapa con `status` (legacy). Para la vista Colaboradores usamos
   *  estados del negocio actual: activa, contrato pendiente, pausada. */
  estadoColaboracion?: "activa" | "contrato-pendiente" | "pausada";
  /** Nº de registros que la agencia ha aportado al promotor (histórico). */
  registrosAportados?: number;
  /** Nº de ventas cerradas originadas por la agencia. */
  ventasCerradas?: number;
  /** Comisión media pactada con la agencia (%). */
  comisionMedia?: number;
  /** Si tiene una solicitud pendiente de aprobar (flag UI). Equivalente
   *  funcional a isNewRequest pero en nomenclatura español. */
  solicitudPendiente?: boolean;
  /** Mensaje opcional que la agencia envió al solicitar colaboración. */
  mensajeSolicitud?: string;
  /** Promociones concretas a las que la agencia solicita colaborar.
   *  Si viene vacío o undefined, la solicitud es global (al promotor
   *  entero, no a una promoción). Las solicitudes GLOBALES solo
   *  aparecen en `/colaboradores` — en la tab Agencias de una
   *  promoción solo se muestran las que tienen esta promoción en
   *  `requestedPromotionIds`.
   *  TODO(backend): migrar a tabla `CollaborationRequest(agency_id,
   *  promotion_id?, message, created_at)`. */
  requestedPromotionIds?: string[];

  /* ─── Contrato firmado con el promotor ─── */
  /** Fecha de firma del contrato (ISO yyyy-mm-dd). */
  contractSignedAt?: string;
  /** Fecha de caducidad del contrato (ISO yyyy-mm-dd). Null/undefined =
   *  sin caducidad. Para renderizar indicadores "vigente / a punto
   *  de expirar / expirado" usar `getContractStatus()`. */
  contractExpiresAt?: string;
  /** URL al PDF del contrato (opcional · GET /api/contratos/:id). */
  contractDocUrl?: string;

  /* ─── Señales comerciales avanzadas (V3) ─── */
  /** Códigos ISO de los mercados/nacionalidades que atiende la agencia.
   *  Ej. ["GB", "NL", "SE"]. Usado para filtrar qué promos encajan. */
  mercados?: string[];
  /** Tasa de conversión registros → ventas, 0-100. Calculado en backend. */
  conversionRate?: number;
  /** Ticket medio de venta en EUR (salesVolume / ventasCerradas). */
  ticketMedio?: number;
  /** Última fecha con registro/venta/login (ISO yyyy-mm-dd). Usado para
   *  mostrar "activa hoy" / "sin actividad hace 45 días" (freshness). */
  lastActivityAt?: string;
  /** Nº de agentes que tiene la agencia. */
  teamSize?: number;
  /** Especialidad comercial. */
  especialidad?: "luxury" | "residential" | "commercial" | "tourist" | "second-home";
  /** Rating subjetivo del promotor sobre esta agencia (1-5). */
  ratingPromotor?: number;
  /** Persona de contacto principal en la agencia. */
  contactoPrincipal?: {
    nombre: string;
    rol?: string;
    email: string;
    telefono?: string;
    /** Idiomas que habla esta persona en concreto · subset de
     *  `Empresa.idiomasAtencion`. Puede diferir: la agencia atiende
     *  en 6 idiomas pero el contacto asignado habla solo 3. */
    idiomas?: string[];
  };
  /** Incidencias acumuladas — banderas de alerta. */
  incidencias?: { duplicados: number; cancelaciones: number; reclamaciones: number };

  /* ─── Rating público de Google Business (Places API) ─── */
  /** place_id de Google Places API (backend lo resuelve en alta). */
  googlePlaceId?: string;
  /** Rating público 0-5 (cacheado, refrescado semanalmente por backend). */
  googleRating?: number;
  /** Nº de reseñas en Google Business. */
  googleRatingsTotal?: number;
  /** ISO date del último refresco (ToS: ≤30 días). */
  googleFetchedAt?: string;
  /** URL pública de la ficha de Maps. */
  googleMapsUrl?: string;

  /* ─── Ficha operativa (Empresa) · lo que la agencia mantiene en su
         workspace · backend: `GET /api/empresas/:id/public` ─── */
  /** Referencia pública del tenant (`IDXXXXXX`). Inmutable. */
  publicRef?: string;
  /** Razón social (nombre jurídico). */
  razonSocial?: string;
  /** CIF / número de identificación fiscal. */
  cif?: string;
  /** Año de fundación, texto libre ("2015"). */
  fundadaEn?: string;
  /** Sitio web corporativo. */
  sitioWeb?: string;
  /** Horario de atención en texto libre. */
  horario?: string;
  /** Códigos de idioma en los que atiende (BCP 47 corto · "es","en","sv"). */
  idiomasAtencion?: string[];
  /** URLs de redes sociales. */
  redes?: {
    linkedin?: string;
    instagram?: string;
    facebook?: string;
    youtube?: string;
    tiktok?: string;
  };
  /** Dirección fiscal completa · a futuro viene de Google Places. */
  direccionFiscal?: {
    direccion?: string;
    codigoPostal?: string;
    ciudad?: string;
    provincia?: string;
    pais?: string;
  };
  /** Licencias y registros inmobiliarios que tiene la agencia (AICAT,
   *  RAICV, COAPI, FMI…). Ver `src/lib/licenses.ts` para el catálogo
   *  completo y los metadatos por tipo. */
  licencias?: LicenciaInmobiliaria[];
};

/** Calcula el estado del contrato real de una agencia consultando los
 *  `CollaborationContract` firmados (no archivados). Lo que pintaba
 *  "Contrato vigente" en cualquier sitio salía del mock legacy
 *  `Agency.contractSignedAt` — mentira, porque la app v2 vive en
 *  localStorage y puede estar vacía.
 *
 *  Reglas:
 *    · Sin ningún contrato firmado vivo → `sin-contrato`.
 *    · Con contratos firmados · tomamos el que más lejos expira
 *      (si alguno no expira nunca, vence infinito).
 *    · `por-expirar` si quedan ≤ `CONTRACT_NEAR_EXPIRY_DAYS` (60d ·
 *      fuente única de verdad en `collaborationContracts.ts`).
 */
import { CONTRACT_NEAR_EXPIRY_DAYS } from "@/lib/collaborationContracts";

/* ═══════════════════════════════════════════════════════════════════
   Agency.status SPLIT · helper anticipatorio para backend

   PROBLEMA · `Agency.status` (active|pending|inactive|expired) y
   `Agency.estadoColaboracion` (activa|contrato-pendiente|pausada)
   mezclan dos cosas que en backend van en tablas distintas:

     · `organizations.status` (active|inactive|suspended)        → el
       ESTADO DE LA EMPRESA (KYC, suspendida por billing, etc.).
     · `organization_collaborations.status` (active|paused|ended) → el
       ESTADO DEL VÍNCULO entre dos orgs.

   Doc canónico · `docs/backend-dual-role-architecture.md §3.1, §3.7
   y §9 Phase 2`.

   Este helper EXPONE el split sin romper el seed actual ·
   los consumers del frontend pueden empezar a leer estos campos
   ahora mismo. La migración Phase 2 reescribe el seed para
   eliminar `Agency.status` y `Agency.estadoColaboracion` reemplazándolos
   por las dos columnas separadas.

   TODO(backend) · split `Agency.status` y `Agency.estadoColaboracion`
   en:
     · `organizations.status` (default 'active' para mock).
     · `organization_collaborations.status` (active|paused|ended) +
       fila en `collab_requests` para el estado pre-aceptación
       (pending invitation / pending request).
   ═══════════════════════════════════════════════════════════════════ */

export type OrganizationStatus = "active" | "inactive" | "suspended";
export type OrganizationCollabStatus =
  | "active"           // colaboración firmada y operativa
  | "paused"           // pausada · datos preservados
  | "ended"            // terminada · histórica
  | "pending_contract" // invitación/solicitud aceptada · contrato pendiente
  | "pending_request"  // solicitud o invitación SIN responder
  | "none";            // sin vínculo

export interface AgencyStatusSplit {
  organizationStatus: OrganizationStatus;
  collabStatus: OrganizationCollabStatus;
}

/** Mapea los campos legacy de `Agency` (status + estadoColaboracion)
 *  al split canónico backend (`organizations.status` +
 *  `organization_collaborations.status`).
 *
 *  Reglas (decidir en producto si alguna varía antes de Phase 2):
 *    · `Agency.status === 'inactive'` → org inactive (raro · seed
 *      casi siempre lo deja active).
 *    · resto → org active.
 *
 *    · `estadoColaboracion === 'activa'`  → collab `active`.
 *    · `estadoColaboracion === 'pausada'` → collab `paused`.
 *    · `estadoColaboracion === 'contrato-pendiente'` → collab `pending_contract`.
 *    · `Agency.status === 'pending'` (sin estadoColaboracion) o
 *      `solicitudPendiente`/`isNewRequest` → collab `pending_request`.
 *    · sin nada → collab `none`. */
export function mapAgencyToCollabStatus(a: Agency): AgencyStatusSplit {
  const organizationStatus: OrganizationStatus =
    a.status === "inactive" ? "inactive" : "active";

  let collabStatus: OrganizationCollabStatus;
  if (a.estadoColaboracion === "activa") {
    collabStatus = "active";
  } else if (a.estadoColaboracion === "pausada") {
    collabStatus = "paused";
  } else if (a.estadoColaboracion === "contrato-pendiente") {
    collabStatus = "pending_contract";
  } else if (a.solicitudPendiente || a.isNewRequest || a.status === "pending") {
    collabStatus = "pending_request";
  } else {
    collabStatus = "none";
  }

  return { organizationStatus, collabStatus };
}

export function getContractStatus(
  a: Agency,
  refDate: Date = new Date(),
): { state: "vigente" | "por-expirar" | "expirado" | "sin-contrato"; daysLeft?: number } {
  const signed = getAllContracts().filter(
    (c) => c.agencyId === a.id && !c.archived && c.status === "signed",
  );
  if (signed.length === 0) return { state: "sin-contrato" };
  /* Un contrato sin expiresAt se trata como infinito · basta con él
     para que la agencia esté "vigente". */
  const someNoExpiry = signed.some((c) => !c.expiresAt);
  if (someNoExpiry) return { state: "vigente" };
  const maxExpires = Math.max(...signed.map((c) => c.expiresAt!));
  const daysLeft = Math.ceil((maxExpires - refDate.getTime()) / (24 * 60 * 60 * 1000));
  if (daysLeft < 0) return { state: "expirado", daysLeft };
  if (daysLeft <= CONTRACT_NEAR_EXPIRY_DAYS) return { state: "por-expirar", daysLeft };
  return { state: "vigente", daysLeft };
}

export const agencies: Agency[] = [
  {
    id: "ag-1",
    publicRef: "IDB4WM3K",
    name: "Prime Properties Costa del Sol",
    logo: "https://api.dicebear.com/9.x/shapes/svg?seed=prime-properties&backgroundColor=3b82f6&size=120",
    cover: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&h=200&fit=crop",
    location: "Marbella, Spain",
    type: "Agency",
    description: "Agencia boutique especializada en propiedades de lujo en la Costa del Sol. Red sólida de compradores internacionales.",
    visitsCount: 42,
    registrations: 14,
    salesVolume: 2350000,
    collaboratingSince: "Mar 2025",
    status: "active",
    offices: [
      { city: "Marbella", address: "Av. Ricardo Soriano, 72, 29601 Marbella" },
      { city: "Estepona", address: "Calle Real, 15, 29680 Estepona" },
    ],
    promotionsCollaborating: ["dev-1", "dev-2"],
    totalPromotionsAvailable: 4,
    origen: "invited",
    estadoColaboracion: "activa",
    registrosAportados: 38,
    ventasCerradas: 6,
    comisionMedia: 4,
    logoRect: "https://placehold.co/250x100/3b82f6/ffffff?text=Prime+Properties&font=inter",
    contractSignedAt: "2025-03-01",
    contractExpiresAt: "2027-03-01",
    mercados: ["GB", "IE", "NL", "SE", "FI"],
    conversionRate: 16,
    ticketMedio: 392000,
    lastActivityAt: "2026-04-20",
    teamSize: 12,
    especialidad: "luxury",
    ratingPromotor: 5,
    contactoPrincipal: {
      nombre: "Laura Sánchez", rol: "Sales Manager",
      email: "laura@primeproperties.com", telefono: "+34 612 345 678",
    },
    incidencias: { duplicados: 0, cancelaciones: 0, reclamaciones: 0 },
    googlePlaceId: "ChIJDEMO_PrimeProperties",
    googleRating: 4.8,
    googleRatingsTotal: 247,
    googleFetchedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    googleMapsUrl: "https://maps.app.goo.gl/DEMO_Prime",
    licencias: [
      { tipo: "RAIA",  numero: "RAIA-MA-000247", desde: "2018-06-14", verificada: true },
      { tipo: "COAPI", numero: "COAPI-MA-01234", desde: "2017-03-02", verificada: true, publicUrl: "https://www.coapi.org" },
      { tipo: "GIPE",  numero: "GIPE-3456",      desde: "2019-11-20" },
    ],
    /* ─── Ficha Empresa · datos editables del workspace agencia ───
     *  Sin estos campos, `hasMinimumIdentityData()` falla y la
     *  agencia ve el banner "Tu empresa no es visible" + no puede
     *  enviar `org_request`. */
    razonSocial: "Prime Properties Costa del Sol S.L.",
    cif: "B92345678",
    fundadaEn: "2014",
    sitioWeb: "primeproperties.com",
    horario: "L-V 9:00-19:00 · S 10:00-14:00",
    idiomasAtencion: ["ES", "EN", "DE", "SV"],
    redes: {
      linkedin:  "https://www.linkedin.com/company/prime-properties-costadelsol",
      instagram: "https://www.instagram.com/primeproperties.es",
      facebook:  "https://www.facebook.com/primeproperties.es",
    },
    direccionFiscal: {
      direccion: "Av. Ricardo Soriano 72, 3º",
      codigoPostal: "29601",
      ciudad: "Marbella",
      provincia: "Málaga",
      pais: "España",
    },
  },
  {
    id: "ag-2",
    publicRef: "IDHE7TBV",
    name: "Nordic Home Finders",
    logo: "https://api.dicebear.com/9.x/shapes/svg?seed=nordic-home&backgroundColor=10b981&size=120",
    cover: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&h=200&fit=crop",
    location: "Stockholm, Sweden",
    type: "Broker",
    description: "Broker escandinavo de referencia que conecta compradores nórdicos con propiedades en la costa española. Especializados en servicios de relocación.",
    visitsCount: 78,
    registrations: 22,
    salesVolume: 4120000,
    collaboratingSince: "Ene 2025",
    status: "active",
    offices: [
      { city: "Stockholm", address: "Birger Jarlsgatan 44, 114 29 Stockholm" },
    ],
    promotionsCollaborating: ["dev-1", "dev-2", "dev-3", "dev-4"],
    totalPromotionsAvailable: 4,
    origen: "invited",
    estadoColaboracion: "activa",
    registrosAportados: 62,
    ventasCerradas: 11,
    comisionMedia: 5,
    logoRect: "https://placehold.co/250x100/10b981/ffffff?text=Nordic+Home+Finders&font=inter",
    contractSignedAt: "2025-01-15",
    contractExpiresAt: "2026-05-15",
    mercados: ["SE", "NO", "DK", "FI", "IS"],
    conversionRate: 18,
    ticketMedio: 375000,
    lastActivityAt: "2026-04-22",
    teamSize: 8,
    especialidad: "second-home",
    ratingPromotor: 5,
    contactoPrincipal: {
      nombre: "Erik Lindqvist", rol: "Partner",
      email: "erik@nordichomefinders.com", telefono: "+46 70 123 4567",
      idiomas: ["SV", "EN", "ES"],
    },
    incidencias: { duplicados: 1, cancelaciones: 0, reclamaciones: 0 },
    googlePlaceId: "ChIJDEMO_Nordic",
    googleRating: 4.6,
    googleRatingsTotal: 183,
    googleFetchedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    googleMapsUrl: "https://maps.app.goo.gl/DEMO_Nordic",
    /* ─── Ficha operativa Empresa · lo que la agencia mantiene ─── */
    razonSocial: "Nordic Home Finders AB",
    cif: "SE559234567801",
    fundadaEn: "2015",
    sitioWeb: "nordichomefinders.com",
    horario: "L-V 9:00-17:00 (CET)",
    idiomasAtencion: ["SV", "EN", "ES", "NO", "DA", "FI"],
    redes: {
      linkedin:  "https://www.linkedin.com/company/nordic-home-finders",
      instagram: "https://www.instagram.com/nordichomefinders",
      facebook:  "https://www.facebook.com/nordichomefinders",
      youtube:   "https://www.youtube.com/@nordichomefinders",
    },
    direccionFiscal: {
      direccion: "Birger Jarlsgatan 44",
      codigoPostal: "114 29",
      ciudad: "Stockholm",
      provincia: "Stockholms län",
      pais: "Suecia",
    },
    licencias: [
      { tipo: "FMI",    numero: "FMI-2018-4567",  desde: "2018-02-10", verificada: true, publicUrl: "https://fmi.se" },
      { tipo: "FIABCI", numero: "FIABCI-SE-04321", desde: "2020-09-01", verificada: true, publicUrl: "https://www.fiabci.org" },
      { tipo: "RAICV",  numero: "RAICV-A-002158", desde: "2024-01-15", verificada: true, publicUrl: "https://habitatge.gva.es" },
    ],
  },
  {
    id: "ag-3",
    publicRef: "ID2WEUSZ",
    name: "Dutch & Belgian Realty",
    logo: "https://api.dicebear.com/9.x/shapes/svg?seed=dutch-belgian&backgroundColor=f59e0b&size=120",
    cover: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&h=200&fit=crop",
    location: "Amsterdam, Netherlands",
    type: "Network",
    description: "Red inmobiliaria pan-Benelux con oficinas en Ámsterdam, Bruselas y Amberes. Foco en compradores de segunda residencia.",
    visitsCount: 31,
    registrations: 8,
    salesVolume: 890000,
    collaboratingSince: "Feb 2026",
    status: "active",
    offices: [
      { city: "Amsterdam", address: "Herengracht 180, 1016 BR Amsterdam" },
      { city: "Brussels", address: "Avenue Louise 54, 1050 Bruxelles" },
      { city: "Antwerp", address: "Meir 85, 2000 Antwerpen" },
    ],
    promotionsCollaborating: ["dev-2", "dev-3"],
    totalPromotionsAvailable: 4,
    origen: "marketplace",
    estadoColaboracion: "activa",
    registrosAportados: 21,
    ventasCerradas: 3,
    comisionMedia: 4.5,
    logoRect: "https://placehold.co/250x100/f59e0b/ffffff?text=Dutch+%26+Belgian+Realty&font=inter",
    contractSignedAt: "2026-02-01",
    contractExpiresAt: "2027-02-01",
    mercados: ["NL", "BE", "LU"],
    conversionRate: 14,
    ticketMedio: 297000,
    lastActivityAt: "2026-04-10",
    teamSize: 15,
    especialidad: "second-home",
    ratingPromotor: 4,
    contactoPrincipal: {
      nombre: "Pieter De Vries", rol: "Director",
      email: "pieter@dutchbelgianrealty.com", telefono: "+31 20 555 1234",
    },
    incidencias: { duplicados: 0, cancelaciones: 0, reclamaciones: 0 },
    googlePlaceId: "ChIJDEMO_DutchBelgian",
    googleRating: 4.3,
    googleRatingsTotal: 92,
    googleFetchedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    googleMapsUrl: "https://maps.app.goo.gl/DEMO_Dutch",
    /* ─── Ficha Empresa · datos editables del workspace agencia ─── */
    razonSocial: "Dutch & Belgian Realty B.V.",
    cif: "NL854321987B01",
    fundadaEn: "2013",
    sitioWeb: "dutchbelgianrealty.com",
    horario: "L-V 9:00-18:00 (CET)",
    idiomasAtencion: ["NL", "FR", "EN", "DE", "ES"],
    redes: {
      linkedin:  "https://www.linkedin.com/company/dutch-belgian-realty",
      instagram: "https://www.instagram.com/dutchbelgianrealty",
      facebook:  "https://www.facebook.com/dutchbelgianrealty",
    },
    direccionFiscal: {
      direccion: "Herengracht 180",
      codigoPostal: "1016 BR",
      ciudad: "Amsterdam",
      provincia: "Noord-Holland",
      pais: "Países Bajos",
    },
  },
  {
    id: "ag-4",
    publicRef: "IDMQSTD7",
    name: "Meridian Real Estate Group",
    logo: "https://api.dicebear.com/9.x/shapes/svg?seed=meridian-group&backgroundColor=ef4444&size=120",
    cover: "https://images.unsplash.com/photo-1464938050520-ef2571e0d6d2?w=600&h=200&fit=crop",
    location: "London, UK",
    type: "Agency",
    description: "Agencia británica especializada en inversión inmobiliaria en el Mediterráneo. El contrato de colaboración anterior ha expirado.",
    visitsCount: 15,
    registrations: 5,
    salesVolume: 620000,
    collaboratingSince: "Jun 2024",
    status: "expired",
    offices: [
      { city: "London", address: "32 Mayfair Place, W1J 8JR London" },
    ],
    promotionsCollaborating: [],
    totalPromotionsAvailable: 4,
    origen: "invited",
    estadoColaboracion: "pausada",
    registrosAportados: 12,
    ventasCerradas: 1,
    comisionMedia: 3,
    logoRect: "https://placehold.co/250x100/ef4444/ffffff?text=Meridian+Real+Estate&font=inter",
    contractSignedAt: "2024-06-10",
    contractExpiresAt: "2026-02-10",
    mercados: ["GB", "IE"],
    conversionRate: 8,
    ticketMedio: 620000,
    lastActivityAt: "2026-02-05",
    teamSize: 5,
    especialidad: "residential",
    ratingPromotor: 2,
    contactoPrincipal: {
      nombre: "James Whitfield", rol: "Broker",
      email: "james@meridianrealestate.co.uk", telefono: "+44 20 7946 0018",
    },
    incidencias: { duplicados: 2, cancelaciones: 1, reclamaciones: 1 },
    googlePlaceId: "ChIJDEMO_Meridian",
    googleRating: 3.4,
    googleRatingsTotal: 56,
    googleFetchedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    googleMapsUrl: "https://maps.app.goo.gl/DEMO_Meridian",
    /* ─── Ficha Empresa · datos editables del workspace agencia ─── */
    razonSocial: "Meridian Real Estate Group Ltd",
    cif: "GB938472615",
    fundadaEn: "2009",
    sitioWeb: "meridianrealestate.co.uk",
    horario: "Mon-Fri 9:00-18:00 (GMT)",
    idiomasAtencion: ["EN", "ES", "FR"],
    redes: {
      linkedin:  "https://www.linkedin.com/company/meridian-real-estate-group",
      instagram: "https://www.instagram.com/meridian.realestate",
    },
    direccionFiscal: {
      direccion: "32 Mayfair Place",
      codigoPostal: "W1J 8JR",
      ciudad: "London",
      provincia: "Greater London",
      pais: "Reino Unido",
    },
  },
  {
    id: "ag-5",
    publicRef: "ID4RMQ3M",
    name: "Iberia Luxury Homes",
    logo: "https://api.dicebear.com/9.x/shapes/svg?seed=iberia-luxury&backgroundColor=8b5cf6&size=120",
    cover: "https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=600&h=200&fit=crop",
    location: "Lisbon, Portugal",
    type: "Agency",
    description: "Agencia portuguesa de lujo expandiéndose al mercado español. Solicita colaboración por primera vez.",
    visitsCount: 0,
    registrations: 0,
    salesVolume: 0,
    status: "pending",
    offices: [
      { city: "Lisbon", address: "Av. da Liberdade 110, 1250-146 Lisboa" },
      { city: "Porto", address: "Rua de Santa Catarina 200, 4000-451 Porto" },
    ],
    promotionsCollaborating: [],
    totalPromotionsAvailable: 4,
    isNewRequest: true,
    origen: "marketplace",
    estadoColaboracion: "contrato-pendiente",
    registrosAportados: 0,
    ventasCerradas: 0,
    comisionMedia: 0,
    solicitudPendiente: true,
    mensajeSolicitud:
      "Nos especializamos en compradores portugueses y brasileños con presupuesto premium. Nos encantaría colaborar en las promociones de la Costa del Sol.",
    requestedPromotionIds: ["dev-1", "dev-2"],
    teamSize: 7,
    especialidad: "luxury",
    mercados: ["PT", "ES", "BR"],
    contactoPrincipal: {
      nombre: "João Almeida", rol: "Managing Director",
      email: "joao@iberialuxuryhomes.pt", telefono: "+351 21 350 7000",
      idiomas: ["PT", "EN", "ES"],
    },
    googleRating: 4.5,
    googleRatingsTotal: 78,
    googleFetchedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    googleMapsUrl: "https://maps.app.goo.gl/DEMO_Iberia",
    /* ─── Ficha Empresa · datos editables del workspace agencia ─── */
    razonSocial: "Iberia Luxury Homes Lda",
    cif: "PT512345678",
    fundadaEn: "2017",
    sitioWeb: "iberialuxuryhomes.pt",
    horario: "Seg-Sex 9:30-18:30 (WET)",
    idiomasAtencion: ["PT", "EN", "ES", "FR"],
    redes: {
      linkedin:  "https://www.linkedin.com/company/iberia-luxury-homes",
      instagram: "https://www.instagram.com/iberialuxuryhomes",
    },
    direccionFiscal: {
      direccion: "Av. da Liberdade 110, 4º",
      codigoPostal: "1250-146",
      ciudad: "Lisboa",
      provincia: "Lisboa",
      pais: "Portugal",
    },
  },
  {
    id: "ag-6",
    publicRef: "IDVX3TE9",
    name: "Baltic Property Partners",
    logo: "https://ui-avatars.com/api/?name=BP&background=06b6d4&color=fff&size=120&font-size=0.4&bold=true",
    cover: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=600&h=200&fit=crop",
    location: "Helsinki, Finland",
    type: "Broker",
    description: "Broker finlandés con una red sólida en el Báltico, buscando partnerships en promociones de la Costa Blanca.",
    visitsCount: 0,
    registrations: 0,
    salesVolume: 0,
    status: "pending",
    offices: [
      { city: "Helsinki", address: "Mannerheimintie 14, 00100 Helsinki" },
    ],
    promotionsCollaborating: [],
    totalPromotionsAvailable: 4,
    isNewRequest: true,
    origen: "marketplace",
    estadoColaboracion: "contrato-pendiente",
    registrosAportados: 0,
    ventasCerradas: 0,
    comisionMedia: 0,
    solicitudPendiente: true,
    mensajeSolicitud:
      "Buscamos partnerships en Costa Blanca para nuestra red de clientes escandinavos. Ya colaboramos con 3 promotores en España.",
    requestedPromotionIds: ["dev-3"],
  },
  /* ─── Seeds de volumen para dev-1 ("Villa Serena") · completan 5 solicitudes
   *  entrantes en esa promoción para ver cómo escala el dialog. */
  {
    id: "ag-7",
    publicRef: "IDJ22C7G",
    name: "Mediterranean Lux Homes",
    logo: "https://api.dicebear.com/9.x/shapes/svg?seed=med-lux&backgroundColor=a855f7&size=120",
    cover: "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?w=600&h=200&fit=crop",
    location: "Nice, France",
    type: "Agency",
    description: "Boutique inmobiliaria en la Costa Azul con cartera de clientes franceses de alto poder adquisitivo.",
    visitsCount: 0,
    registrations: 0,
    salesVolume: 0,
    status: "pending",
    offices: [
      { city: "Nice", address: "12 Promenade des Anglais, 06000 Nice" },
      { city: "Cannes", address: "48 Boulevard de la Croisette, 06400 Cannes" },
    ],
    promotionsCollaborating: [],
    totalPromotionsAvailable: 4,
    isNewRequest: true,
    origen: "marketplace",
    estadoColaboracion: "contrato-pendiente",
    registrosAportados: 0,
    ventasCerradas: 0,
    comisionMedia: 0,
    teamSize: 6,
    especialidad: "luxury",
    mercados: ["FR", "CH", "MC"],
    contactoPrincipal: {
      nombre: "Élodie Laurent", rol: "Partner",
      email: "elodie@medluxhomes.fr", telefono: "+33 4 92 12 34 56",
    },
    googleRating: 4.7,
    googleRatingsTotal: 134,
    solicitudPendiente: true,
    mensajeSolicitud:
      "Hemos cerrado 12 operaciones en Villa Serena el año pasado a través de otros brokers. Queremos trabajar directos con ustedes.",
    requestedPromotionIds: ["dev-1"],
  },
  {
    id: "ag-8",
    publicRef: "IDNQW4JN",
    name: "Moscow Estates",
    logo: "https://api.dicebear.com/9.x/shapes/svg?seed=moscow-estates&backgroundColor=dc2626&size=120",
    cover: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=600&h=200&fit=crop",
    location: "Moscow, Russia",
    type: "Broker",
    description: "Broker ruso enfocado en clientela VIP que busca segunda residencia en España y Portugal.",
    visitsCount: 0,
    registrations: 0,
    salesVolume: 0,
    status: "pending",
    offices: [
      { city: "Moscow", address: "Tverskaya 25, 125009 Moscow" },
    ],
    promotionsCollaborating: [],
    totalPromotionsAvailable: 4,
    isNewRequest: true,
    origen: "marketplace",
    estadoColaboracion: "contrato-pendiente",
    registrosAportados: 0,
    ventasCerradas: 0,
    comisionMedia: 0,
    teamSize: 9,
    especialidad: "luxury",
    mercados: ["RU", "KZ", "AE"],
    contactoPrincipal: {
      nombre: "Dmitri Volkov", rol: "Managing Broker",
      email: "dmitri@moscowestates.ru", telefono: "+7 495 123 4567",
    },
    googleRating: 4.4,
    googleRatingsTotal: 68,
    solicitudPendiente: true,
    mensajeSolicitud:
      "Nuestros clientes compran al contado y buscan villas > 2M€. Podemos aportar 20+ leads cualificados al trimestre.",
    requestedPromotionIds: ["dev-1"],
  },
  {
    id: "ag-9",
    publicRef: "IDYA87BX",
    name: "Alpine Living",
    logo: "https://api.dicebear.com/9.x/shapes/svg?seed=alpine-living&backgroundColor=0ea5e9&size=120",
    cover: "https://images.unsplash.com/photo-1519741497674-611481863552?w=600&h=200&fit=crop",
    location: "Zurich, Switzerland",
    type: "Network",
    description: "Red suiza con oficinas en los cantones alpinos, especializada en segunda residencia mediterránea.",
    visitsCount: 0,
    registrations: 0,
    salesVolume: 0,
    status: "pending",
    offices: [
      { city: "Zurich", address: "Bahnhofstrasse 45, 8001 Zurich" },
      { city: "Geneva", address: "Rue du Rhône 30, 1204 Geneva" },
      { city: "Basel", address: "Freie Strasse 78, 4001 Basel" },
    ],
    promotionsCollaborating: [],
    totalPromotionsAvailable: 4,
    isNewRequest: true,
    origen: "marketplace",
    estadoColaboracion: "contrato-pendiente",
    registrosAportados: 0,
    ventasCerradas: 0,
    comisionMedia: 0,
    teamSize: 18,
    especialidad: "second-home",
    mercados: ["CH", "DE", "AT", "LI"],
    contactoPrincipal: {
      nombre: "Markus Zimmermann", rol: "Director Internacional",
      email: "markus@alpineliving.ch", telefono: "+41 44 123 4567",
    },
    googleRating: 4.9,
    googleRatingsTotal: 312,
    solicitudPendiente: true,
    mensajeSolicitud:
      "Operamos en 3 cantones suizos. Nuestros clientes DACH tienen presupuestos desde 800K€ y cierran rápido.",
    requestedPromotionIds: ["dev-1"],
  },
  {
    id: "ag-10",
    publicRef: "IDM6HZZX",
    name: "Gulf Premium Realty",
    logo: "https://api.dicebear.com/9.x/shapes/svg?seed=gulf-premium&backgroundColor=eab308&size=120",
    cover: "https://images.unsplash.com/photo-1583422409516-2895a77efded?w=600&h=200&fit=crop",
    location: "Dubai, UAE",
    type: "Agency",
    description: "Agencia con sede en Dubai y red de clientes GCC con intereses en Europa del Sur.",
    visitsCount: 0,
    registrations: 0,
    salesVolume: 0,
    status: "pending",
    offices: [
      { city: "Dubai", address: "Sheikh Zayed Road 200, DIFC, Dubai" },
    ],
    promotionsCollaborating: [],
    totalPromotionsAvailable: 4,
    isNewRequest: true,
    origen: "marketplace",
    estadoColaboracion: "contrato-pendiente",
    registrosAportados: 0,
    ventasCerradas: 0,
    comisionMedia: 0,
    teamSize: 14,
    especialidad: "luxury",
    mercados: ["AE", "SA", "QA", "KW"],
    contactoPrincipal: {
      nombre: "Khalid Al-Rashid", rol: "Sales Director",
      email: "khalid@gulfpremium.ae", telefono: "+971 4 123 4567",
    },
    googleRating: 4.6,
    googleRatingsTotal: 89,
    solicitudPendiente: true,
    mensajeSolicitud:
      "Trabajamos con family offices y HNWI del Golfo. La Costa del Sol es prioridad para nuestros clientes.",
    requestedPromotionIds: ["dev-1"],
  },
];

/**
 * Nº real de agencias que colaboran hoy en una promoción.
 *
 * El mock tenía un campo `Promotion.agencies` suelto que solo era
 * un número ilustrativo — podía mentir respecto al dataset real.
 * Este helper cuenta las agencias que TIENEN esta promoción en su
 * `promotionsCollaborating`, que es la fuente de verdad tanto en
 * el mock como en el modelo backend futuro
 * (tabla `Collaboration(promotion_id, agency_id)`).
 *
 * TODO(backend): sustituir por GET /api/promociones/:id/agencies/count
 * o incluirlo en el response del listado de promociones.
 */
export function countAgenciesForPromotion(promotionId: string): number {
  return agencies.filter((a) => a.promotionsCollaborating.includes(promotionId)).length;
}

/**
 * Estadísticas de colaboración de UNA agencia respecto al catálogo
 * real de promociones del promotor.
 *
 * `Agency.totalPromotionsAvailable` es mock histórico y mentía — cuenta
 * genérica puesta a mano en cada agency. La fuente de verdad debe
 * derivarse del catálogo de `developerOnlyPromotions`:
 *   - `activeTotal`  · nº de promociones ACTIVAS (publicables) del promotor.
 *   - `sharedActive` · cuántas de ellas están efectivamente compartidas.
 *   - `sharedDeclared` · cuántas tiene declaradas en
 *                        `promotionsCollaborating` aunque algunas ya
 *                        estén cerradas/incomplete.
 *
 * Importa perezoso para evitar ciclo (developerPromotions importa
 * tipos de promotions; si agencias.ts lo importa arriba podría romper).
 *
 * TODO(backend): al conectar, `GET /api/agencias/:id/share-stats`
 * sustituye esto con números precalculados en el backend.
 */
export function getAgencyShareStats(agency: Agency): {
  activeTotal: number;
  sharedActive: number;
  sharedDeclared: number;
} {
  const activePromos = developerOnlyPromotions.filter((p) => p.status === "active");
  const activeIds = new Set(activePromos.map((p) => p.id));
  const declared = agency.promotionsCollaborating ?? [];
  const sharedActive = declared.filter((id) => activeIds.has(id)).length;
  return {
    activeTotal: activePromos.length,
    sharedActive,
    sharedDeclared: declared.length,
  };
}
