/**
 * marketingRulesStorage.ts · reglas de marketing por promoción.
 *
 * El promotor define, por promoción, qué canales están PROHIBIDOS
 * (portales inmobiliarios, redes sociales, ads). La agencia
 * colaboradora ve la misma regla en la ficha de la promoción y DEBE
 * respetarla — violarla puede acabar en extinción del contrato.
 *
 * Qué se guarda · array de ids del catálogo
 * (`src/lib/marketingChannels.ts`). Ausencia de clave = "todo
 * permitido" (default).
 *
 * Storage · localStorage por tenant (sin namespace porque aún somos
 * mock · el TODO(backend) lo mueve al backend con RLS).
 *
 * TODO(backend):
 *   GET  /api/promociones/:id → respuesta ya trae `marketingProhibitions`
 *   PATCH /api/promociones/:id { marketingProhibitions: string[] }
 *
 *   Cuando los conectores de portales estén activos
 *   (`src/lib/portalIntegrations/*`), al intentar publicar desde la
 *   agencia:
 *     1. El dispatcher de publicación DEBE leer esta lista antes de
 *        hacer push al portal.
 *     2. Si el canal está en `marketingProhibitions`, la petición se
 *        rechaza con 422 `channel_prohibited` y la UI de la agencia
 *        muestra el botón deshabilitado con tooltip "El promotor ha
 *        prohibido este canal".
 *     3. Webhook asíncrono: si un portal notifica una publicación
 *        que viola la regla (p. ej. la agencia publicó fuera del
 *        flujo), se registra incidencia en el historial cross-empresa
 *        (`recordCompanyEvent({ type: "marketing.violation", ... })`)
 *        y se notifica al admin.
 */

import { useEffect, useState } from "react";

const KEY_PREFIX = "byvaro.promotion.marketingProhibitions.v1:";
const EVENT = "byvaro:marketing-rules-change";

function keyFor(promotionId: string): string {
  return `${KEY_PREFIX}${promotionId}`;
}

export function getMarketingProhibitions(promotionId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(keyFor(promotionId));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.every((x) => typeof x === "string")) {
      return arr;
    }
    return [];
  } catch {
    return [];
  }
}

export function saveMarketingProhibitions(promotionId: string, ids: string[]): void {
  if (typeof window === "undefined") return;
  // Deduplica y recorta · el orden no importa (la UI ordena por catálogo).
  const clean = Array.from(new Set(ids.map((s) => s.trim()).filter(Boolean)));
  if (clean.length === 0) {
    window.localStorage.removeItem(keyFor(promotionId));
  } else {
    window.localStorage.setItem(keyFor(promotionId), JSON.stringify(clean));
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { promotionId } }));
}

export function toggleMarketingProhibition(promotionId: string, channelId: string): boolean {
  const current = getMarketingProhibitions(promotionId);
  const has = current.includes(channelId);
  const next = has ? current.filter((x) => x !== channelId) : [...current, channelId];
  saveMarketingProhibitions(promotionId, next);
  return !has; // true si quedó prohibido tras el toggle
}

/** Hook reactivo · se re-renderiza cuando cambian las reglas de esta
 *  promoción (local o cross-tab). */
export function useMarketingProhibitions(promotionId: string): string[] {
  const [ids, setIds] = useState<string[]>(() => getMarketingProhibitions(promotionId));

  useEffect(() => {
    const read = () => setIds(getMarketingProhibitions(promotionId));
    read(); // re-sync cuando cambia promotionId

    const onChange = (e: Event) => {
      // Ignora cambios de otras promociones.
      const detail = (e as CustomEvent<{ promotionId: string }>).detail;
      if (!detail || detail.promotionId === promotionId) read();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === keyFor(promotionId)) read();
    };

    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [promotionId]);

  return ids;
}

/** Helper puro · ¿este canal está prohibido en esta promoción? Útil
 *  para el dispatcher de publicación (fase backend · ver TODO arriba). */
export function isChannelProhibited(promotionId: string, channelId: string): boolean {
  return getMarketingProhibitions(promotionId).includes(channelId);
}
