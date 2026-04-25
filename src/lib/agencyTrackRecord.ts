/**
 * agencyTrackRecord · métricas de calidad de una agencia calculadas
 * sobre sus registros históricos.
 *
 * Se usa para mostrar un pill discreto junto al nombre de la agencia
 * en la lista de /registros · orienta el triaje: una agencia con 90%
 * de aprobación se revisa más rápido, una con muchos duplicados se
 * mira con lupa.
 *
 * TODO(backend): GET /api/agencies/:id/track-record con cache.
 * Backend debe calcular también: tiempo medio de respuesta del
 * promotor, conversión registro→venta, rating.
 */

import { registros as SEED_REGISTROS, type Registro } from "@/data/records";

export type AgencyTrackRecord = {
  total: number;            // registros totales enviados por la agencia
  approved: number;         // nº aprobados
  rejected: number;         // nº rechazados
  duplicates: number;       // nº marcados como duplicado (estado) o detectados con match >= 70
  approvalRate: number;     // 0-100 · approved / decided
  duplicateRate: number;    // 0-100 · duplicates / total
  /** Nivel cualitativo · determina el color del pill.
   *   "excellent" ≥ 85% aprobación + <5% duplicados
   *   "good"      ≥ 70% aprobación + <15% duplicados
   *   "mixed"     el resto con al menos 3 registros
   *   "new"       menos de 3 registros, sin histórico suficiente. */
  tier: "excellent" | "good" | "mixed" | "new";
};

/** Calcula el track-record sobre una lista de registros + opcional
 *  lista adicional (p. ej. los creados en localStorage en vivo). */
export function getAgencyTrackRecord(
  agencyId: string,
  extra: Registro[] = [],
): AgencyTrackRecord {
  const all = [...extra, ...SEED_REGISTROS].filter((r) => r.agencyId === agencyId);
  const total = all.length;
  const approved = all.filter((r) => r.estado === "aprobado").length;
  const rejected = all.filter((r) => r.estado === "rechazado").length;
  const duplicates = all.filter(
    (r) => r.estado === "duplicado" || r.matchPercentage >= 70,
  ).length;
  const decided = approved + rejected;
  const approvalRate = decided > 0 ? Math.round((approved / decided) * 100) : 0;
  const duplicateRate = total > 0 ? Math.round((duplicates / total) * 100) : 0;

  let tier: AgencyTrackRecord["tier"] = "new";
  if (total >= 3) {
    if (approvalRate >= 85 && duplicateRate < 5) tier = "excellent";
    else if (approvalRate >= 70 && duplicateRate < 15) tier = "good";
    else tier = "mixed";
  }

  return { total, approved, rejected, duplicates, approvalRate, duplicateRate, tier };
}
