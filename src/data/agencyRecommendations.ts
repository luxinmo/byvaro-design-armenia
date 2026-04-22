/**
 * Recomendaciones de agencias que Byvaro sugiere al promotor.
 *
 * ⚠️ TODO(backend): este dataset no vive en el cliente en producción.
 * Sustituir por `GET /api/colaboradores/recomendaciones` (ver
 * `docs/backend-integration.md` §4.1). El motor de recomendación vive en
 * backend con señal cross-tenant agregada que ningún promotor puede
 * computar por sí solo:
 *
 *   - Agencias activas en las zonas del promotor (no colaboran aún).
 *   - Mercados / nacionalidades donde el promotor tiene gaps.
 *   - Aprobación media con **otros promotores similares** (nunca
 *     identificados).
 *   - Conversión histórica, SLA de respuesta, duplicados detectados.
 *
 * ⚠️ Privacidad · nunca exponer "Agencia X trabaja con Promotor B". Las
 * señales van **agregadas** (ej. "95% aprobación con 3+ promotores de
 * obra nueva en Costa del Sol").
 */

import { useMemo } from "react";

export type RecommendedAgency = {
  id: string;
  name: string;
  logo: string;
  location: string;
  type: "Agency" | "Broker" | "Network";
  /** Códigos ISO2 de nacionalidades que atiende. */
  mercados: string[];
  /** Zonas donde es activa (ciudades). Empareja con la ubicación de las
   *  promociones del promotor para justificar la recomendación. */
  zonasActivas: string[];
  /** Señal cross-tenant agregada (nunca identifica promotores). */
  signal: {
    /** % aprobación media con promotores similares (0-100). */
    aprobacionPct: number;
    /** Conversión histórica (0-100). */
    conversionPct: number;
    /** Nº de promotores con los que ya colabora en Byvaro (agregado). */
    promotoresActivos: number;
  };
  /** Rating público de Google Business (cached). */
  googleRating?: number;
  /** Razón principal generada por el motor · frase corta en español. */
  razon: string;
  /** Motivos secundarios (pills). */
  razones: string[];
};

/* Catálogo mock · en prod se genera en backend matching por promotor */
export const recomendacionesAgencias: RecommendedAgency[] = [
  {
    id: "rec-1",
    name: "Riviera Elite Partners",
    logo: "https://api.dicebear.com/9.x/shapes/svg?seed=riviera-elite&backgroundColor=f97316&size=120",
    location: "Marbella, Spain",
    type: "Agency",
    mercados: ["DE", "CH", "AT"],
    zonasActivas: ["Marbella", "Estepona", "Benahavís"],
    signal: { aprobacionPct: 94, conversionPct: 11, promotoresActivos: 8 },
    googleRating: 4.7,
    razon: "Especialista DACH activa en Marbella",
    razones: ["Activa en tu zona", "Cubre hueco alemán/suizo", "94% aprobación"],
  },
  {
    id: "rec-2",
    name: "Alpine International Realty",
    logo: "https://api.dicebear.com/9.x/shapes/svg?seed=alpine-intl&backgroundColor=0ea5e9&size=120",
    location: "Múnich, Germany",
    type: "Broker",
    mercados: ["DE", "AT", "CH"],
    zonasActivas: ["Marbella", "Mijas", "Jávea"],
    signal: { aprobacionPct: 89, conversionPct: 9, promotoresActivos: 5 },
    googleRating: 4.5,
    razon: "Cartera alemana con tracción en Costa del Sol",
    razones: ["12 promotores de obra nueva similares", "SLA respuesta 2,1h"],
  },
  {
    id: "rec-3",
    name: "London Bridge Estates",
    logo: "https://api.dicebear.com/9.x/shapes/svg?seed=london-bridge&backgroundColor=a855f7&size=120",
    location: "London, UK",
    type: "Network",
    mercados: ["GB", "IE"],
    zonasActivas: ["Marbella", "Mijas", "Torrevieja"],
    signal: { aprobacionPct: 91, conversionPct: 8, promotoresActivos: 12 },
    googleRating: 4.4,
    razon: "Red británica más activa en España 2026",
    razones: ["Activa en 3 de tus zonas", "91% aprobación", "12 promotores activos"],
  },
  {
    id: "rec-4",
    name: "Russian Costa Partners",
    logo: "https://api.dicebear.com/9.x/shapes/svg?seed=russian-costa&backgroundColor=dc2626&size=120",
    location: "Marbella, Spain",
    type: "Agency",
    mercados: ["RU", "UA", "KZ"],
    zonasActivas: ["Marbella", "Estepona"],
    signal: { aprobacionPct: 87, conversionPct: 10, promotoresActivos: 4 },
    googleRating: 4.3,
    razon: "Comprador ruso premium · ticket alto",
    razones: ["Cubre hueco ruso", "Activa en Marbella"],
  },
  {
    id: "rec-5",
    name: "Côte d'Azur Partners",
    logo: "https://api.dicebear.com/9.x/shapes/svg?seed=cote-azur&backgroundColor=10b981&size=120",
    location: "Nice, France",
    type: "Broker",
    mercados: ["FR", "MC", "BE"],
    zonasActivas: ["Mijas", "Marbella"],
    signal: { aprobacionPct: 86, conversionPct: 7, promotoresActivos: 3 },
    googleRating: 4.6,
    razon: "Clientela francesa con interés en Costa del Sol",
    razones: ["Activa en Mijas", "86% aprobación"],
  },
  {
    id: "rec-6",
    name: "Mediterranean US Partners",
    logo: "https://api.dicebear.com/9.x/shapes/svg?seed=med-us&backgroundColor=6366f1&size=120",
    location: "New York, USA",
    type: "Broker",
    mercados: ["US", "CA"],
    zonasActivas: ["Marbella", "Jávea"],
    signal: { aprobacionPct: 93, conversionPct: 6, promotoresActivos: 2 },
    googleRating: 4.8,
    razon: "Comprador norteamericano · nicho creciente",
    razones: ["2 promotores activos en Byvaro", "93% aprobación"],
  },
];

/**
 * Hook · filtra recomendaciones excluyendo agencias con las que el
 * promotor ya colabora (por `existingAgencyIds`) y opcionalmente
 * prioriza por mercados donde el promotor tiene gaps.
 *
 * El matching real vive en backend — este hook es pass-through para UI.
 */
export function useAgencyRecommendations({
  existingAgencyIds = [],
  limit = 8,
}: {
  existingAgencyIds?: string[];
  limit?: number;
} = {}): RecommendedAgency[] {
  return useMemo(() => {
    return recomendacionesAgencias
      .filter((r) => !existingAgencyIds.includes(r.id))
      .slice(0, limit);
  }, [existingAgencyIds, limit]);
}
