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
import { promotions as promotionsLegacy } from "./promotions";
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

export const agencies: Agency[] = [];

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
  /* "Publicadas" segun CLAUDE.md (REGLA DE ORO Estados de promoción):
   *   status=active + canShare !== false + AL MENOS 1 agencia comparte.
   *  Cruza ambos arrays · `developerOnlyPromotions` (dev-X, prom-X) +
   *  `promotions` legacy. */
  const all = [
    ...developerOnlyPromotions,
    ...promotionsLegacy.filter(
      (p) => !developerOnlyPromotions.some((d) => d.id === p.id),
    ),
  ];
  /* Set de promoIds con al menos 1 agencia colaborando · cruza
   *  TODAS las agencies del seed. */
  const sharedAtLeastOnce = new Set<string>();
  for (const ag of agencies) {
    for (const id of ag.promotionsCollaborating ?? []) {
      sharedAtLeastOnce.add(id);
    }
  }
  const publicadas = all.filter((p) =>
    p.status === "active"
    && (p as { canShareWithAgencies?: boolean }).canShareWithAgencies !== false
    && sharedAtLeastOnce.has(p.id),
  );
  const publicadasIds = new Set(publicadas.map((p) => p.id));
  const declared = agency.promotionsCollaborating ?? [];
  const sharedActive = declared.filter((id) => publicadasIds.has(id)).length;
  return {
    activeTotal: publicadas.length,
    sharedActive,
    sharedDeclared: declared.length,
  };
}
