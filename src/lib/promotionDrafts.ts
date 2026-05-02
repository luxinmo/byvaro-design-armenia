/**
 * Sistema de borradores de promoción · localStorage.
 *
 * Hasta que haya backend, guardamos los borradores del wizard
 * "Crear promoción" en localStorage bajo la clave `DRAFTS_KEY`.
 * Cada borrador lleva metadatos de visualización (id, nombre,
 * updatedAt, % completado) + el `WizardState` entero.
 *
 * Los borradores completados/publicados se eliminan del almacén al
 * navegar fuera del wizard.
 *
 * TODO(backend): sustituir por GET/POST/DELETE /api/promociones?estado=borrador.
 */

import type { WizardState } from "@/components/crear-promocion/types";
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
 *  draft antiguo, y si falló por quota. */
export function saveDraft(state: WizardState, existingId?: string): SaveDraftResult {
  let drafts = readRaw();
  const id = existingId ?? genId();
  const draft: PromotionDraft = {
    id,
    name: state.nombrePromocion?.trim() || "Promoción sin nombre",
    updatedAt: Date.now(),
    progress: estimateProgress(state),
    state,
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

  try {
    writeRaw(drafts);
    return { id, ok: true, discarded };
  } catch (e: unknown) {
    const isQuota = e instanceof DOMException && (
      e.name === "QuotaExceededError" ||
      e.name === "NS_ERROR_DOM_QUOTA_REACHED"
    );
    return { id, ok: false, discarded, error: isQuota ? "quota" : "unknown" };
  }
}

export function deleteDraft(id: string): void {
  const drafts = readRaw().filter((d) => d.id !== id);
  writeRaw(drafts);
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

/** Prefijo que identifica un id de borrador en la URL de la ficha. */
export const DRAFT_ID_PREFIX = "draft:";

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

  return {
    id: `${DRAFT_ID_PREFIX}${d.id}`,
    code: s.refPromocion?.trim() || "DRAFT",
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
