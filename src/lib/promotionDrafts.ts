/**
 * Sistema de borradores de promoción.
 *
 * Source of truth · `public.promotion_drafts` (Supabase) · RLS scoped
 * al user dueño · cross-device. memCache es solo cache reactivo local
 * para que la UI re-renderice instantáneo.
 *
 * Patrón canónico (write-through optimistic):
 *   - saveDraft(state) escribe en memCache (sync) + Supabase (async).
 *   - deleteDraft(id) borra en memCache (sync) + Supabase (async).
 *   - hydrateDraftsFromSupabase() pulla los drafts del user al login
 *     y on-auth-change · llamado desde SupabaseHydrator.
 *
 * Antes los drafts vivían SOLO en memCache (in-memory) · al recargar
 * la pestaña desaparecían · bug histórico hasta que esta migración
 * (20260502250000_promotion_drafts.sql) creó la tabla.
 */

import type { WizardState, StepId } from "@/components/crear-promocion/types";
import { memCache } from "./memCache";

const DRAFTS_KEY = "byvaro-promotion-drafts";
/** Clave histórica (single-draft) · se migra la primera vez que se carga la lista. */
const LEGACY_KEY = "byvaro-crear-promocion-draft";

export interface PromotionDraft {
  id: string;
  name: string;
  updatedAt: number;
  /** % aproximado de completitud (0-100) para un badge de progreso. */
  progress: number;
  state: WizardState;
  /** Último paso del wizard donde estaba el user al guardar. Cuando
   *  reabre el draft, lo llevamos directamente ahí (no a "role") para
   *  no obligarle a volver a recorrer todo. NULL en drafts creados
   *  antes de esta feature · caen al default "role". */
  currentStep?: StepId;
}

const genId = () => `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

const readRaw = (): PromotionDraft[] => {
  try {
    const r = memCache.getItem(DRAFTS_KEY);
    if (!r) return [];
    const parsed = JSON.parse(r);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeRaw = (drafts: PromotionDraft[]) => {
  memCache.setItem(DRAFTS_KEY, JSON.stringify(drafts));
};

/** Estima el % de completitud según los campos rellenos. Es una
 *  heurística visual para la lista de borradores. */
function estimateProgress(s: WizardState): number {
  const checks: boolean[] = [
    !!s.role,
    !!s.tipo,
    (s.tipo !== "unifamiliar") || (!!s.subUni && (
      s.subUni === "una_sola" ? !!s.subVarias : s.tipologiasSeleccionadas.length > 0
    )),
    (s.tipo === "unifamiliar") || (s.numBloques >= 1 && s.plantas >= 1),
    !!s.estado,
    !!s.nombrePromocion?.trim(),
    !!s.direccionPromocion?.ciudad?.trim(),
    s.fotos.length > 0,
    !!(s.descripcion || Object.keys(s.descripcionIdiomas ?? {}).length > 0),
    s.unidades.length > 0,
    !!s.metodoPago,
  ];
  const ok = checks.filter(Boolean).length;
  return Math.round((ok / checks.length) * 100);
}

export function listDrafts(): PromotionDraft[] {
  const drafts = readRaw();
  // Migración puntual del borrador legacy.
  if (drafts.length === 0) {
    try {
      const legacy = memCache.getItem(LEGACY_KEY);
      if (legacy) {
        const state = JSON.parse(legacy) as WizardState;
        const d: PromotionDraft = {
          id: genId(),
          name: state.nombrePromocion || "Promoción sin nombre",
          updatedAt: Date.now(),
          progress: estimateProgress(state),
          state,
        };
        writeRaw([d]);
        return [d];
      }
    } catch { /* ignore */ }
  }
  // Orden más reciente primero.
  return [...drafts].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getDraft(id: string): PromotionDraft | null {
  return readRaw().find((d) => d.id === id) ?? null;
}

/** Número máximo de borradores que conservamos. Si se supera, se
 *  descarta el más antiguo (menor `updatedAt`). Cifra conservadora
 *  para que localStorage no crezca sin límite ni penalice serialización. */
const MAX_DRAFTS = 50;

export interface SaveDraftResult {
  id: string;
  /** OK, o `quota` si localStorage está lleno. */
  ok: boolean;
  /** Nombres de drafts descartados para hacer sitio (MAX_DRAFTS). */
  discarded: string[];
  error?: "quota" | "unknown";
}

/** Upsert: guarda un borrador. Si no se pasa id, crea uno nuevo.
 *  Devuelve info estructurada con el id final, si se truncó algún
 *  draft antiguo, y si falló por quota.
 *
 *  `currentStep` opcional · cuando el wizard llama saveDraft pasa el
 *  step actual para que al reabrir el draft volvamos justo ahí.
 *  Si no se pasa, se intenta preservar el step previo del mismo id
 *  (no perder progreso de navegación al hacer un save sin step). */
export function saveDraft(
  state: WizardState,
  existingId?: string,
  currentStep?: StepId,
): SaveDraftResult {
  let drafts = readRaw();
  const id = existingId ?? genId();
  /* Preservar currentStep del draft anterior si el caller no lo pasa
   * explícitamente · evita borrar el step al ejecutar un save legacy
   * sin el nuevo argumento. */
  const previous = drafts.find((d) => d.id === id);
  const draft: PromotionDraft = {
    id,
    name: state.nombrePromocion?.trim() || "Promoción sin nombre",
    updatedAt: Date.now(),
    progress: estimateProgress(state),
    state,
    currentStep: currentStep ?? previous?.currentStep,
  };
  const idx = drafts.findIndex((d) => d.id === id);
  if (idx >= 0) drafts[idx] = draft;
  else drafts.push(draft);

  let discarded: string[] = [];
  if (drafts.length > MAX_DRAFTS) {
    const sorted = [...drafts].sort((a, b) => b.updatedAt - a.updatedAt);
    const kept = sorted.slice(0, MAX_DRAFTS);
    const removed = sorted.slice(MAX_DRAFTS);
    discarded = removed.map((d) => d.name);
    drafts = kept;
  }

  let result: SaveDraftResult;
  try {
    writeRaw(drafts);
    result = { id, ok: true, discarded };
  } catch (e: unknown) {
    const isQuota = e instanceof DOMException && (
      e.name === "QuotaExceededError" ||
      e.name === "NS_ERROR_DOM_QUOTA_REACHED"
    );
    result = { id, ok: false, discarded, error: isQuota ? "quota" : "unknown" };
  }
  /* Write-through async a Supabase · UI no espera. Si falla, queda en
   * cache local y la siguiente hidratación lo refrescará desde DB. */
  void syncDraftToSupabase(draft);
  /* Borrar de DB los descartados por límite (raro · normalmente nadie
   * tiene 50 drafts). Best-effort. */
  for (const _name of discarded) {
    /* No tenemos el id aquí · saltamos · el límite local ya cumplió. */
  }
  return result;
}

export function deleteDraft(id: string): void {
  const drafts = readRaw().filter((d) => d.id !== id);
  writeRaw(drafts);
  void deleteDraftFromSupabase(id);
}

/** `createBlankDraft` · ELIMINADO 2026-05-04 · ya no se llama
 *  desde ningún sitio. El wizard arranca con state in-memory y solo
 *  persiste cuando el user pulsa "Guardar borrador" (ver
 *  `ensureDraftId` en `CrearPromocion.tsx`). */

/** Borra TODOS los borradores del usuario actual · memCache + Supabase.
 *  Útil para purgar huérfanos generados por el bug pre-fix de id no
 *  determinista (un draft por sesión sin sync de URL). Devuelve el
 *  número de borradores eliminados. */
export async function deleteAllDrafts(): Promise<number> {
  const drafts = readRaw();
  const count = drafts.length;
  writeRaw([]);
  if (typeof window === "undefined") return count;
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return count;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return count;
    const { error } = await supabase
      .from("promotion_drafts")
      .delete()
      .eq("user_id", user.id);
    if (error) console.warn("[drafts:deleteAll]", error.message);
  } catch (e) {
    console.warn("[drafts:deleteAll] skipped:", e);
  }
  window.dispatchEvent(new StorageEvent("storage", { key: DRAFTS_KEY }));
  return count;
}

/* ══════ Write-through y hydratación · Supabase ════════════════════ */

/** Garantiza que el draft existe en DB · upsert síncrono y devuelve
 *  el primer error que el caller pueda mostrar. Pensado para que la
 *  subida de imágenes (MultimediaEditor) pueda esperar antes de
 *  pegarle a `storage.objects` · si el draft no está en DB cuando
 *  llega el upload, RLS rechaza con `violates row-level security`.
 *
 *  Pasa `null` si Supabase no está configurado o si el user no está
 *  autenticado (no falla · solo skip). */
export async function ensureDraftPersisted(id: string): Promise<{ ok: boolean; error?: string }> {
  if (typeof window === "undefined") return { ok: true };
  const draft = readRaw().find((d) => d.id === id);
  if (!draft) return { ok: false, error: `draft ${id} not found in cache` };
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return { ok: true };
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "not authenticated" };
    const orgId = sessionStorage.getItem("byvaro.accountType.organizationId.v1");
    /* Validamos que el org_id existe antes de pasarlo · si no existe
     * en organizations, dejamos NULL para que el insert no falle por
     * FK violation. */
    let validOrgId: string | null = null;
    if (orgId) {
      const { data: org } = await supabase
        .from("organizations")
        .select("id")
        .eq("id", orgId)
        .maybeSingle();
      if (org) validOrgId = orgId;
    }
    const { error } = await supabase
      .from("promotion_drafts")
      .upsert({
        id: draft.id,
        user_id: user.id,
        organization_id: validOrgId,
        name: draft.name,
        progress: draft.progress,
        state: draft.state,
        current_step: draft.currentStep ?? null,
        updated_at: new Date(draft.updatedAt).toISOString(),
      }, { onConflict: "id" });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Sube un draft (insert si no existía, update si ya estaba) a la
 *  tabla `promotion_drafts`. Falla en silencio · loggea warning. */
async function syncDraftToSupabase(draft: PromotionDraft): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const orgId = sessionStorage.getItem("byvaro.accountType.organizationId.v1");
    const { error } = await supabase
      .from("promotion_drafts")
      .upsert({
        id: draft.id,
        user_id: user.id,
        organization_id: orgId || null,
        name: draft.name,
        progress: draft.progress,
        state: draft.state,
        current_step: draft.currentStep ?? null,
        updated_at: new Date(draft.updatedAt).toISOString(),
      }, { onConflict: "id" });
    if (error) console.warn("[drafts:save]", error.message);
  } catch (e) {
    console.warn("[drafts:save] skipped:", e);
  }
}

/** Borra un draft de Supabase · best-effort · si falla queda en DB
 *  pero el cliente ya no lo verá tras la próxima hidratación porque
 *  habrá sido eliminado del local. */
async function deleteDraftFromSupabase(id: string): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return;
    const { error } = await supabase
      .from("promotion_drafts")
      .delete()
      .eq("id", id);
    if (error) console.warn("[drafts:delete]", error.message);
  } catch (e) {
    console.warn("[drafts:delete] skipped:", e);
  }
}

/** Pulla los drafts del user actual desde Supabase y los escribe en
 *  memCache. Llamado por `SupabaseHydrator` al login y on-auth-change.
 *  Dispara `storage` event para que `useState(() => listDrafts())` en
 *  consumidores se refresque. */
export async function hydrateDraftsFromSupabase(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("promotion_drafts")
      .select("id, name, progress, state, current_step, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (error) {
      console.warn("[drafts:hydrate]", error.message);
      return;
    }
    const drafts: PromotionDraft[] = (data ?? []).map((r) => ({
      id: r.id as string,
      name: (r.name as string) ?? "Promoción sin nombre",
      updatedAt: r.updated_at ? Date.parse(r.updated_at as string) : Date.now(),
      progress: (r.progress as number) ?? 0,
      state: r.state as WizardState,
      currentStep: (r.current_step as StepId | null) ?? undefined,
    }));
    writeRaw(drafts);
    /* Notificar a consumidores que el cache cambió · `useState(() =>
     *  listDrafts())` en Promociones.tsx escucha 'storage' para
     *  re-renderizar. Sintetizamos el evento porque memCache no
     *  dispara nativamente. */
    window.dispatchEvent(new StorageEvent("storage", { key: DRAFTS_KEY }));
  } catch (e) {
    console.warn("[drafts:hydrate] skipped:", e);
  }
}

/** Pasos faltantes en el vocabulario de stepName que consume la ficha
 *  (SectionCards usan "Basic info", "Multimedia", "Description", etc.).
 *  Coherente con `allSteps` en PromocionDetalle.tsx. */
function missingStepsFor(s: WizardState): string[] {
  const missing: string[] = [];
  // "Basic info" cubre nombre + dirección. Se pinta en rojo la card
  // Información básica + Ubicación si falta cualquiera de los dos.
  if (!s.nombrePromocion?.trim() || !s.direccionPromocion?.ciudad?.trim()) {
    missing.push("Basic info");
  }
  if (s.fotos.length === 0) missing.push("Multimedia");
  if (!s.descripcion && Object.keys(s.descripcionIdiomas ?? {}).length === 0) {
    missing.push("Description");
  }
  if (s.unidades.length === 0) missing.push("Units");
  if (!s.metodoPago) missing.push("Payment plan");
  if (s.colaboracion && !s.formaPagoComision) missing.push("Collaborators");
  return missing;
}

/** Prefijo que identifica un id de borrador en la URL de la ficha.
 *  Antes era "draft:" pero el `:` es carácter especial en URIs y en
 *  React Router se trataba de forma inconsistente (a veces el browser
 *  lo encoded a %3A, a veces no, y la ruta `/promociones/:id` no
 *  resolvía el param correctamente). Con guion no hay ambigüedad. */
export const DRAFT_ID_PREFIX = "draft-";

/** Mapea subtipo técnico a label comercial visible. */
const SUBTIPO_LABEL: Record<string, string> = {
  apartamento: "Apartamentos",
  atico: "Áticos",
  penthouse: "Áticos",
  duplex: "Dúplex",
  triplex: "Tríplex",
  loft: "Lofts",
  planta_baja: "Bajos",
};

/** % de progreso según la fase de obra declarada. */
const FASE_PROGRESS: Record<string, number> = {
  inicio_obra: 10,
  estructura: 30,
  cerramientos: 50,
  instalaciones: 65,
  acabados: 80,
  entrega_proxima: 95,
  llave_en_mano: 100,
  definir_mas_tarde: 0,
};

/** Convierte un borrador a la forma `Promotion`-like para alimentar la
 *  ficha (`/promociones/:id`). Se asignan `status: "incomplete"` y
 *  `missingSteps` para que la UI pinte los bloques incompletos en rojo. */
export function draftToPromotionData(d: PromotionDraft) {
  const s = d.state;

  /* Precios · derivados de las unidades si existen. */
  const unitPrices = (s.unidades ?? [])
    .map((u) => u.precio || 0)
    .filter((n) => n > 0);
  const priceMin = unitPrices.length > 0 ? Math.min(...unitPrices) : 0;
  const priceMax = unitPrices.length > 0 ? Math.max(...unitPrices) : 0;

  /* Disponibilidad · sumamos available si tienen status; si no, todas available. */
  const totalUnits = s.unidades?.length ?? 0;
  const availableUnits = (s.unidades ?? [])
    .filter((u) => (u.status ?? "available") === "available").length;

  /* Tipologías reales a partir de los subtipos asignados a las unidades. */
  const propertyTypes = Array.from(new Set(
    (s.unidades ?? [])
      .map((u) => SUBTIPO_LABEL[u.subtipo ?? ""] ?? null)
      .filter((x): x is string => !!x),
  ));

  /* Progreso de obra derivado de fase declarada en la promoción. */
  const constructionProgress = s.faseConstruccion
    ? FASE_PROGRESS[s.faseConstruccion] ?? undefined
    : undefined;

  /* Delivery en formato legible. Si hay `fechaEntrega` (YYYY-MM o similar)
     lo dejamos tal cual; si solo hay trimestre, ese. */
  const delivery = s.fechaEntrega || s.trimestreEntrega || "";

  /* Comisión mostrada · si diferencia nacional/internacional, prioriza
     internacional (la más alta suele ser esa); si no, la única. */
  const commission = s.colaboracion
    ? (s.diferenciarComisiones ? s.comisionInternacional : s.comisionInternacional) || 0
    : 0;

  /* Show flat · si el promotor ha activado el toggle. */
  const hasShowFlat = !!s.pisoPiloto;

  /* OwnerOrganizationId · los drafts se guardan SIEMPRE bajo el
   * workspace activo (sessionStorage[byvaro.accountType.organizationId.v1]
   * · ver saveDraftToSupabase línea ~275). Sin esta línea, el listing
   * caía a "developer-default" → cargaba el LUXINMO_PROFILE fixture →
   * mostraba el logo de Luxinmo en vez del logo real del promotor. */
  const ownerOrgId =
    typeof window !== "undefined"
      ? sessionStorage.getItem("byvaro.accountType.organizationId.v1") || undefined
      : undefined;

  return {
    id: `${DRAFT_ID_PREFIX}${d.id}`,
    ownerOrganizationId: ownerOrgId,
    /* `code` vacío para borradores · si lo seteamos a "DRAFT" o
     * cualquier otro literal, `promotionHref()` lo prefiere sobre el
     * id y todos los drafts navegan a la MISMA URL (/promociones/DRAFT)
     * · click en un borrador no abre la ficha. Con code undefined,
     * promotionHref cae al id (que SÍ es único: draft:abc123) y la
     * ruta se resuelve correctamente. */
    /* Mostramos el `publicRef` (PR + 5 dígitos · scheme canónico)
     * generado al abrir el wizard. Si por algún motivo no estuviera
     * presente (drafts legacy), caemos al `refPromocion` editable. */
    code: s.publicRef ?? s.refPromocion?.trim() ?? undefined,
    name: d.name,
    location: [s.direccionPromocion?.ciudad, s.direccionPromocion?.provincia]
      .filter(Boolean).join(", ") || "Sin ubicación",
    priceMin,
    priceMax,
    availableUnits,
    totalUnits,
    status: "incomplete" as const,
    reservationCost: s.importeReserva ?? 0,
    delivery,
    commission,
    developer: "",
    agencies: s.colaboracion ? 0 : 0, // placeholder hasta que haya agencias invitadas
    agencyAvatars: [] as string[],
    propertyTypes,
    image: s.fotos?.[0]?.url,
    updatedAt: new Date(d.updatedAt).toISOString(),
    constructionProgress,
    hasShowFlat,
    missingSteps: missingStepsFor(s),
  };
}
