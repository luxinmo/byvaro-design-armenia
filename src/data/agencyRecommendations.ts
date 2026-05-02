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
export const recomendacionesAgencias: RecommendedAgency[] = [];

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
