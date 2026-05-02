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
import { memCache } from "./memCache";

const KEY_PREFIX = "byvaro.promotion.marketingProhibitions.v1:";
const EVENT = "byvaro:marketing-rules-change";

function keyFor(promotionId: string): string {
  return `${KEY_PREFIX}${promotionId}`;
}

export function getMarketingProhibitions(promotionId: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = memCache.getItem(keyFor(promotionId));
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
    memCache.removeItem(keyFor(promotionId));
  } else {
    memCache.setItem(keyFor(promotionId), JSON.stringify(clean));
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { promotionId } }));
  /* Write-through · escribir a `promotions.marketing_prohibitions text[]`. */
  void (async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
      if (!isSupabaseConfigured) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from("promotions")
        .update({ marketing_prohibitions: clean.length > 0 ? clean : null })
        .eq("id", promotionId);
      if (error) console.warn("[marketingRules:sync]", error.message);
    } catch (e) { console.warn("[marketingRules:sync] skipped:", e); }
  })();
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

/* ═══════════════════════════════════════════════════════════════════
   Flag "ya configuró las reglas" · se usa para apagar la animación
   de atención en el sidebar card tras la primera interacción explícita
   (Guardar · Permitir todos · Prohibir todos).

   Se guarda POR PROMOCIÓN. Una vez true, nunca vuelve a false salvo
   que alguien llame resetMarketingConfigured() (no expuesto en UI).
   ═══════════════════════════════════════════════════════════════════ */

const CONFIGURED_KEY_PREFIX = "byvaro.promotion.marketingConfigured.v1:";
const CONFIGURED_EVENT = "byvaro:marketing-configured-change";

function configuredKeyFor(id: string): string {
  return `${CONFIGURED_KEY_PREFIX}${id}`;
}

export function getMarketingConfigured(promotionId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return memCache.getItem(configuredKeyFor(promotionId)) === "1";
  } catch {
    return false;
  }
}

export function setMarketingConfigured(promotionId: string, value: boolean = true): void {
  if (typeof window === "undefined") return;
  if (value) {
    memCache.setItem(configuredKeyFor(promotionId), "1");
  } else {
    memCache.removeItem(configuredKeyFor(promotionId));
  }
  window.dispatchEvent(new CustomEvent(CONFIGURED_EVENT, { detail: { promotionId } }));
}

export function useMarketingConfigured(promotionId: string): boolean {
  const [v, setV] = useState<boolean>(() => getMarketingConfigured(promotionId));

  useEffect(() => {
    const read = () => setV(getMarketingConfigured(promotionId));
    read();

    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ promotionId: string }>).detail;
      if (!detail || detail.promotionId === promotionId) read();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === configuredKeyFor(promotionId)) read();
    };

    window.addEventListener(CONFIGURED_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CONFIGURED_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [promotionId]);

  return v;
}
