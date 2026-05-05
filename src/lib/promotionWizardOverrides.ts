/**
 * promotionWizardOverrides.ts · Persistencia de cambios del wizard
 * sobre promociones YA CREADAS · backend real (Supabase).
 *
 * QUÉ
 * ----
 * Cuando un promotor entra al wizard desde una promoción ya en
 * producción (`/crear-promocion?promotionId=PR44444`) y edita campos
 * (descripción, fotos, ajustes de comisiones), esos cambios se
 * persisten en `public.promotions`:
 *
 *   · Campos canónicos (name, description, image_url, address, city,
 *     country, price_from, price_to, delivery, total_units,
 *     available_units, can_share_with_agencies) se escriben en sus
 *     columnas dedicadas → cualquier otro cliente que lea la
 *     promoción (panel de la agencia, listado público, microsite)
 *     ve los cambios sin pasar por el override.
 *   · El snapshot completo del WizardState se guarda en
 *     `metadata.wizard_override` (JSONB) → al reabrir el wizard se
 *     hidrata 1:1 con todos los campos auxiliares (hitos de comisión,
 *     condiciones de registro, validez, etc.) que NO tienen columna
 *     propia.
 *
 * REGLA DE ORO · `CLAUDE.md` §🥇 · backend acoplado:
 *   · Cero `localStorage.byvaro-promotion-wizard-override` como fuente
 *     de verdad · es solo CACHÉ síncrona para hooks que necesitan
 *     leer en render (no podemos hacer async dentro de useMemo).
 *   · La FUENTE DE VERDAD es `public.promotions.metadata.wizard_override`.
 *   · `saveOverride` escribe a Supabase primero (await) y al cache
 *     local · si Supabase falla, el cache local se mantiene como
 *     fallback offline pero se loggea el error.
 *   · `clearOverride` también limpia ambos.
 *
 * USO EN EL WIZARD
 * ----------------
 *  · Hidratación · al abrir `/crear-promocion?promotionId=X`,
 *    `getOverride()` lee del cache local. Si el cache está vacío,
 *    `hydrateOverrideFromSupabase(id)` pulla `metadata.wizard_override`
 *    y lo escribe al cache antes de que el wizard se monte.
 *  · Save · cada autosave llama `saveOverride(id, state)` · escribe
 *    a Supabase (cols + metadata) y refresca el cache.
 *
 * USO EN EL DETAIL PAGE
 * ---------------------
 *  · `useOverride(id)` devuelve el último WizardState para que la
 *    ficha refleje los edits aún no publicados (descripción, fotos,
 *    estructura de comisiones). Hidrata desde Supabase en mount si
 *    el cache está vacío.
 */

import { useEffect, useState } from "react";
import { memCache } from "./memCache";
import type { WizardState } from "@/components/crear-promocion/types";
import { wizardStateToPromotion } from "./wizardStateToPromotion";
import { composeDelivery } from "./deliveryFormat";
import type { Promotion } from "@/data/promotions";

const KEY_PREFIX = "byvaro.promotion.wizard-override.v1::";
const EVENT = "byvaro:promotion-wizard-override-change";

function keyFor(promotionId: string): string {
  return `${KEY_PREFIX}${promotionId}`;
}

/* ══════════════════════════════════════════════════════════════════
   Cache síncrona local · render-only · NO es la fuente de verdad
   ══════════════════════════════════════════════════════════════════ */

function readCache(promotionId: string): WizardState | null {
  if (typeof window === "undefined" || !promotionId) return null;
  try {
    const raw = memCache.getItem(keyFor(promotionId));
    if (!raw) return null;
    return JSON.parse(raw) as WizardState;
  } catch {
    return null;
  }
}

function writeCache(promotionId: string, state: WizardState): void {
  if (typeof window === "undefined") return;
  memCache.setItem(keyFor(promotionId), JSON.stringify(state));
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { promotionId } }));
}

function clearCache(promotionId: string): void {
  if (typeof window === "undefined") return;
  memCache.removeItem(keyFor(promotionId));
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { promotionId } }));
}

/* ══════════════════════════════════════════════════════════════════
   Source of truth · Supabase
   ══════════════════════════════════════════════════════════════════ */

/** Mapper · WizardState → columnas canónicas de `public.promotions`.
 *  Los campos sin columna propia (hitos comisión, condiciones registro,
 *  videos, planos…) van en `metadata.wizard_override` para reabrir
 *  el wizard idéntico. Los campos planos de metadata (commission,
 *  propertyTypes, etc.) los añade el caller (saveOverride) con
 *  `deriveFlatMetadata`. */
function buildPromotionPatch(state: WizardState): Record<string, unknown> {
  /* `wizardStateToPromotion(state, base)` construye un objeto Promotion
   *  shape · de ahí extraemos las columnas que existen en DB. Usamos
   *  un base mínimo · solo importan las claves que el state cambia. */
  const base = {} as Promotion;
  const merged = wizardStateToPromotion(state, base);

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (merged.name) patch.name = merged.name;
  if (merged.location) {
    /* `location` viene "Ciudad, Provincia". Splitting al backend. */
    const parts = merged.location.split(",").map((s) => s.trim());
    if (parts[0]) patch.city = parts[0];
    if (parts[1]) patch.province = parts[1];
    patch.country = "ES"; // ES-first · TODO(backend) cuando i18n.
  }
  if (merged.image) patch.image_url = merged.image;
  if (typeof merged.priceMin === "number" && merged.priceMin > 0) patch.price_from = merged.priceMin;
  if (typeof merged.priceMax === "number" && merged.priceMax > 0) patch.price_to = merged.priceMax;
  if (typeof merged.totalUnits === "number") patch.total_units = merged.totalUnits;
  if (typeof merged.availableUnits === "number") patch.available_units = merged.availableUnits;
  if (merged.delivery) patch.delivery = merged.delivery;
  if (typeof (merged as { canShareWithAgencies?: boolean }).canShareWithAgencies === "boolean") {
    patch.can_share_with_agencies = (merged as { canShareWithAgencies?: boolean }).canShareWithAgencies;
  }
  if (state.descripcion?.trim()) patch.description = state.descripcion.trim();
  /* `owner_role` · si el user cambia de Promotor a Comercializador
   *  desde el modal de Tipología, persistir en la columna canónica
   *  además del wizard_override · sin esto el listado y otros
   *  consumidores que leen `owner_role` directo seguían viendo el
   *  rol viejo aunque la ficha ya mostrara el nuevo. */
  if (state.role === "promotor" || state.role === "comercializador") {
    patch.owner_role = state.role;
  }

  return patch;
}

/** Pulls `metadata.wizard_override` desde Supabase y lo escribe al
 *  cache local. Devuelve el state recuperado o null. */
export async function hydrateOverrideFromSupabase(
  promotionId: string,
): Promise<WizardState | null> {
  if (!promotionId) return null;
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase
      .from("promotions")
      .select("metadata")
      .eq("id", promotionId)
      .maybeSingle();
    if (error) {
      console.warn("[promoWizardOverride:hydrate]", error.message);
      return null;
    }
    const meta = (data?.metadata ?? null) as { wizard_override?: WizardState } | null;
    const state = meta?.wizard_override ?? null;
    if (state) writeCache(promotionId, state);
    return state;
  } catch (e) {
    console.warn("[promoWizardOverride:hydrate] skipped:", e);
    return null;
  }
}

/* ══════════════════════════════════════════════════════════════════
   API pública
   ══════════════════════════════════════════════════════════════════ */

/** Lectura síncrona del cache local (rendered en el wizard / detail).
 *  Si está vacío, devuelve null · el caller debe disparar la hidratación
 *  via `useOverride()` (que llama a `hydrateOverrideFromSupabase`). */
export function getOverride(promotionId: string): WizardState | null {
  return readCache(promotionId);
}

/** Persiste a Supabase + cache local. Source of truth = Supabase.
 *  El cache local solo existe para que los hooks puedan leer síncrono
 *  durante el render. Si Supabase falla, loggea pero NO bloquea la UI. */
export function saveOverride(promotionId: string, state: WizardState): void {
  if (typeof window === "undefined" || !promotionId) return;

  /* Cache local primero · el wizard sigue funcionando aunque Supabase
   *  esté caído. Es solo cache, no fuente de verdad. */
  writeCache(promotionId, state);

  /* CRÍTICO · actualizamos también `byvaro.promotions.created.v1`
   *  con los campos planos derivados del state. Sin esto el listado
   *  de promociones no reflejaba ediciones (comisión, tipologías,
   *  etc.) hasta el siguiente full reload · el cache mantenía los
   *  valores del create inicial. */
  import("./promotionsStorage").then(({ deriveFlatMetadata, patchCreatedPromotionInCache }) => {
    const flat = deriveFlatMetadata(state);
    /* Delivery · helper canónico `composeDelivery` (respeta
     * `tipoEntrega`). Antes este path tenía una fórmula adhoc
     * que ignoraba tipoEntrega y leía trimestreEntrega/fechaEntrega
     * en orden · escribía valores stale (T2 2026 cuando era
     * tras_licencia 12m). */
    const composedDelivery = composeDelivery({
      fechaEntrega: state.fechaEntrega,
      trimestreEntrega: state.trimestreEntrega,
      tipoEntrega: state.tipoEntrega,
      mesesTrasContrato: state.mesesTrasContrato,
      mesesTrasLicencia: state.mesesTrasLicencia,
    });
    patchCreatedPromotionInCache(promotionId, {
      name: state.nombrePromocion?.trim() || undefined,
      ownerRole: state.role === "comercializador" ? "comercializador" : "promotor",
      city: state.direccionPromocion?.ciudad?.trim() || undefined,
      address: state.direccionPromocion?.direccion?.trim() || undefined,
      delivery: composedDelivery || undefined,
      description: state.descripcion?.trim() || undefined,
      metadata: {
        propertyTypes: flat.propertyTypes,
        buildingType: flat.buildingType,
        constructionProgress: flat.constructionProgress,
        reservationCost: flat.reservationCost,
        commission: flat.commission,
        wizardSnapshot: state,
      },
    });
  });

  /* Write-through · async fire-and-forget · canonical pattern. */
  void (async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
      const { deriveFlatMetadata } = await import("./promotionsStorage");
      if (!isSupabaseConfigured) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      /* Read-modify-write del campo metadata para no pisar otros
       *  campos que conviven en el JSONB. */
      const { data: row, error: readErr } = await supabase
        .from("promotions")
        .select("metadata")
        .eq("id", promotionId)
        .maybeSingle();
      if (readErr) {
        console.warn("[promoWizardOverride:save:read]", readErr.message);
        return;
      }
      const currentMeta = (row?.metadata ?? {}) as Record<string, unknown>;
      /* Metadata flat fields actualizados desde state · sin esto el
       *  hydrator tras refresh seguía leyendo valores viejos del
       *  create inicial · ediciones se "perdían" hasta editar otra
       *  vez. */
      const flat = deriveFlatMetadata(state);
      const nextMeta = {
        ...currentMeta,
        wizard_override: state,
        propertyTypes: flat.propertyTypes,
        buildingType: flat.buildingType,
        constructionProgress: flat.constructionProgress,
        reservationCost: flat.reservationCost,
        commission: flat.commission,
        wizardSnapshot: state,
      };

      const patch = buildPromotionPatch(state);
      patch.metadata = nextMeta;

      const { error: updErr } = await supabase
        .from("promotions")
        .update(patch)
        .eq("id", promotionId);
      if (updErr) console.warn("[promoWizardOverride:save:update]", updErr.message);
    } catch (e) {
      console.warn("[promoWizardOverride:save] skipped:", e);
    }
  })();
}

/** Limpia el override (cache local + columna metadata.wizard_override).
 *  Se llama tras "Publicar" cuando los cambios ya están en columnas
 *  canónicas y el override deja de aplicar. */
export function clearOverride(promotionId: string): void {
  if (typeof window === "undefined" || !promotionId) return;
  clearCache(promotionId);

  void (async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
      if (!isSupabaseConfigured) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: row, error: readErr } = await supabase
        .from("promotions")
        .select("metadata")
        .eq("id", promotionId)
        .maybeSingle();
      if (readErr) return;
      const currentMeta = (row?.metadata ?? {}) as Record<string, unknown>;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { wizard_override, ...rest } = currentMeta;
      await supabase
        .from("promotions")
        .update({ metadata: rest, updated_at: new Date().toISOString() })
        .eq("id", promotionId);
    } catch (e) {
      console.warn("[promoWizardOverride:clear] skipped:", e);
    }
  })();
}

/** Hook reactivo · útil para que el detail page muestre los cambios
 *  pendientes de publicar. Hidrata desde Supabase en mount si el
 *  cache está vacío. */
export function useOverride(promotionId: string | null): WizardState | null {
  const [state, setState] = useState<WizardState | null>(() =>
    promotionId ? readCache(promotionId) : null,
  );

  /* Hidratación desde Supabase si el cache está frío. Idempotente ·
   *  si el override no existe en DB se queda null, sin bucles. */
  useEffect(() => {
    if (!promotionId) return;
    if (state) return; // ya hidratado o no aplicaba
    let cancelled = false;
    void (async () => {
      const fromDb = await hydrateOverrideFromSupabase(promotionId);
      if (cancelled) return;
      if (fromDb) setState(fromDb);
    })();
    return () => { cancelled = true; };
  }, [promotionId, state]);

  /* Subscripción al evento del cache · refresca al guardar/limpiar. */
  useEffect(() => {
    if (!promotionId) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ promotionId?: string }>).detail;
      if (!detail?.promotionId || detail.promotionId === promotionId) {
        setState(readCache(promotionId));
      }
    };
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, [promotionId]);

  return state;
}
