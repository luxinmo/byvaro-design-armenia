/**
 * Estado de la colaboración POR PROMOCIÓN entre un quien-comparte
 * (promotor / comercializador / agencia que comparte con otra) y la
 * agencia receptora.
 *
 * Distinto del campo global `Agency.estadoColaboracion` (que es a nivel
 * agencia, todas las promos juntas). Aquí el estado vive por par
 * `(agencyId, promotionId)`.
 *
 * Estados:
 *   · `activa` (default · no se persiste fila) → la agencia opera con
 *     normalidad en esta promo: ve disponibilidad, registra clientes,
 *     programa visitas, comparte, etc.
 *   · `pausada` → la colaboración queda en stand-by. La agencia NO
 *     puede registrar nuevos clientes ni compartir la promo, pero las
 *     ventas/registros/visitas existentes se MANTIENEN intactas.
 *     Quien comparte puede reanudar en cualquier momento.
 *   · `anulada` → fin de la colaboración para esta promo. La agencia
 *     deja de verla en su panel (de cara a futuro). Los datos
 *     históricos (ventas, registros, visitas, comisiones devengadas)
 *     se preservan · solo se cierra la puerta a actividad nueva.
 *
 * REGLA CRÍTICA: cambiar el estado NUNCA borra datos históricos. Las
 * comisiones devengadas siguen pagándose, las ventas siguen contando
 * en estadísticas, los registros siguen apareciendo en el historial.
 *
 * TODO(backend):
 *   GET    /api/agencias/:agencyId/promotions/:promoId/collab-status
 *          → { status: "activa"|"pausada"|"anulada", changedAt?, by?, reason? }
 *   PATCH  /api/agencias/:agencyId/promotions/:promoId/collab-status
 *          body: { status, reason? } · audit log obligatorio.
 *   El cambio de estado dispara `recordCompanyEvent` en el historial
 *   cross-empresa de ambos lados (promotor ↔ agencia).
 */

import { useEffect, useState } from "react";

export type PromoCollabStatus = "activa" | "pausada" | "anulada";

export interface PromoCollabRecord {
  agencyId: string;
  promotionId: string;
  status: PromoCollabStatus;
  changedAt: number;
  by?: { name: string; email?: string };
  reason?: string;
}

const STORAGE_KEY = "byvaro.promoCollabStatus.v1";
const CHANGE_EVENT = "byvaro:promo-collab-status-changed";

function readStore(): PromoCollabRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function writeStore(list: PromoCollabRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

function makeKey(agencyId: string, promotionId: string): string {
  return `${agencyId}__${promotionId}`;
}

export function getPromoCollabStatus(agencyId: string, promotionId: string): PromoCollabStatus {
  const list = readStore();
  const r = list.find((x) => x.agencyId === agencyId && x.promotionId === promotionId);
  return r?.status ?? "activa";
}

export function getPromoCollabRecord(agencyId: string, promotionId: string): PromoCollabRecord | undefined {
  return readStore().find((x) => x.agencyId === agencyId && x.promotionId === promotionId);
}

export function setPromoCollabStatus(
  agencyId: string,
  promotionId: string,
  status: PromoCollabStatus,
  by?: { name: string; email?: string },
  reason?: string,
) {
  const list = readStore();
  const idx = list.findIndex((x) => x.agencyId === agencyId && x.promotionId === promotionId);
  const record: PromoCollabRecord = {
    agencyId,
    promotionId,
    status,
    changedAt: Date.now(),
    by,
    reason,
  };
  if (status === "activa") {
    /* Volver a "activa" es el default · no necesita persistirse. */
    if (idx >= 0) {
      list.splice(idx, 1);
      writeStore(list);
    }
    return;
  }
  if (idx >= 0) list[idx] = record;
  else list.push(record);
  writeStore(list);
}

/** Hook reactivo · devuelve un Map(`agencyId__promoId` → status) para
 *  renderizar chips/menús sin re-leer en cada item. */
export function usePromoCollabStatusMap(agencyId: string): Map<string, PromoCollabStatus> {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const handler = () => setTick((t) => t + 1);
    window.addEventListener(CHANGE_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(CHANGE_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  const list = readStore().filter((x) => x.agencyId === agencyId);
  const m = new Map<string, PromoCollabStatus>();
  for (const r of list) m.set(makeKey(r.agencyId, r.promotionId), r.status);
  return m;
}

export function getPromoCollabStatusFromMap(
  m: Map<string, PromoCollabStatus>,
  agencyId: string,
  promotionId: string,
): PromoCollabStatus {
  return m.get(makeKey(agencyId, promotionId)) ?? "activa";
}
