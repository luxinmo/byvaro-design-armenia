/**
 * promotionsStorage.ts · helper canónico para creación/edición de
 * promociones desde el wizard `/promociones/crear`.
 *
 * REGLA DE ORO · ver `docs/backend-development-rules.md §5` y
 * `docs/contract-index.md §2.1`.
 *
 * Hoy: el seed estático en `src/data/promotions.ts` y
 * `src/data/developerPromotions.ts` sigue siendo la fuente de las
 * promociones EXISTENTES. Las NUEVAS (creadas desde el wizard) se
 * persisten en Supabase + localStorage scoped, y la pantalla
 * `/promociones` debería mergear ambas (TODO).
 */

import type {
  WizardState, UnitData, FotoItem, VideoItem, HitoPago,
} from "@/components/crear-promocion/types";
import { memCache } from "./memCache";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

const CREATED_KEY = "byvaro.promotions.created.v1";

interface CreatedPromotion {
  id: string;
  /** Referencia pública canónica `PR + 5 dígitos`. Heredada del
   *  borrador (WizardState.publicRef) · garantiza que la promoción
   *  publicada conserva el mismo identificador humano que el draft. */
  code?: string;
  name: string;
  ownerOrganizationId: string;
  ownerRole: "promotor" | "comercializador";
  status: string;
  city?: string;
  country?: string;
  address?: string;
  totalUnits: number;
  availableUnits: number;
  priceFrom: number | null;
  priceTo: number | null;
  delivery: string | null;
  imageUrl: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

function readCreated(): CreatedPromotion[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = memCache.getItem(CREATED_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CreatedPromotion[];
  } catch { return []; }
}

function writeCreated(list: CreatedPromotion[]) {
  if (typeof window === "undefined") return;
  memCache.setItem(CREATED_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("byvaro:promotions-changed"));
}

export function getCreatedPromotions(): CreatedPromotion[] {
  return readCreated();
}

/** Resultado de la creación · indica si la sincronización a Supabase
 *  tuvo éxito · el caller decide qué hacer si falla (NO borrar el
 *  draft, mostrar toast, etc.). El cache local SIEMPRE se escribe
 *  primero · `created` está garantizado. */
export interface CreatePromotionResult {
  created: CreatedPromotion;
  /** true si Supabase confirmó el insert principal · false si falló
   *  (RLS, schema mismatch, conexión...). Si false, el draft NO debe
   *  borrarse para que el user no pierda los datos. */
  supabaseOk: boolean;
  /** Mensaje de error si supabaseOk=false · para mostrar al user. */
  supabaseError?: string;
}

/** Convierte WizardState → fila DB + persiste a Supabase + localStorage.
 *  Optimistic local · sync escritura local + AWAIT escritura Supabase.
 *  El caller debe `await` para saber si fue OK antes de borrar el draft. */
export async function createPromotionFromWizard(
  state: WizardState,
  ownerOrgId: string,
  ownerRole: "promotor" | "comercializador" = "promotor",
  status: "active" | "incomplete" = "active",
): Promise<CreatePromotionResult> {
  const now = new Date().toISOString();
  const id = `prom-c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  /* Extraer campos del WizardState. El shape exacto del wizard
   * varía · usamos getters defensivos para no acoplar. */
  const s = state as unknown as Record<string, unknown>;
  const name = (s.nombrePromocion as string) || "Sin título";
  const city = (s.ciudad as string) ?? null;
  const country = (s.pais as string) ?? "ES";
  const address = (s.direccion as string) ?? null;
  const description = (s.descripcion as string) ?? null;
  const totalUnits = Number((s.totalUnidades as number) ?? (s.unidadesTotal as number) ?? 0);
  const priceFrom = Number((s.precioMin as number) ?? (s.precioDesde as number) ?? 0) || null;
  const priceTo = Number((s.precioMax as number) ?? (s.precioHasta as number) ?? 0) || null;
  const delivery = (s.entrega as string) ?? null;
  const imageUrl = (s.heroImage as string) ?? (s.imagenPrincipal as string) ?? null;

  const created: CreatedPromotion = {
    id,
    code: (s.publicRef as string) || undefined,
    name,
    ownerOrganizationId: ownerOrgId,
    ownerRole,
    status,
    city: city ?? undefined,
    country: country ?? undefined,
    address: address ?? undefined,
    totalUnits,
    availableUnits: totalUnits,
    priceFrom,
    priceTo,
    delivery,
    imageUrl,
    description,
    metadata: { wizardSnapshot: state },
    createdAt: now,
  };

  const list = readCreated();
  writeCreated([created, ...list]);

  /* Write-through SÍNCRONO (await) a Supabase · si falla el insert
   * principal, devolvemos `supabaseOk: false` · el caller NO debe
   * borrar el draft para que el user pueda re-intentar / recuperar. */
  if (!isSupabaseConfigured) {
    /* Sin Supabase configurado tratamos como OK (entorno dev sin
     * backend) · el cache local es la fuente. */
    return { created, supabaseOk: true };
  }
  const { error } = await supabase.from("promotions").insert({
    id: created.id,
    owner_organization_id: ownerOrgId,
    owner_role: ownerRole,
    name: created.name,
    status: status === "active" ? "active" : "incomplete",
    total_units: created.totalUnits,
    available_units: created.availableUnits,
    price_from: created.priceFrom,
    price_to: created.priceTo,
    delivery: created.delivery,
    image_url: created.imageUrl,
    description: created.description,
    address: created.address,
    city: created.city,
    country: created.country,
    can_share_with_agencies: true,
    metadata: created.metadata,
  });
  if (error) {
    console.warn("[promotions:create] insert failed:", error.message);
    return { created, supabaseOk: false, supabaseError: error.message };
  }
  /* Promo creada · ahora persistir las sub-entidades a sus tablas
   * dedicadas. Si alguna falla NO marcamos supabaseOk=false (la promo
   * principal sí está) · solo loggeamos. El user puede re-subir
   * desde la ficha. */
  const unidades = (s.unidades as UnitData[] | undefined) ?? [];
  const fotos = (s.fotos as FotoItem[] | undefined) ?? [];
  const videos = (s.videos as VideoItem[] | undefined) ?? [];
  const hitosPago = (s.hitosPago as HitoPago[] | undefined) ?? [];
  await Promise.all([
    unidades.length > 0 ? saveUnitsToSupabase(created.id, unidades) : null,
    (fotos.length > 0 || videos.length > 0)
      ? saveGalleryToSupabase(created.id, fotos, videos) : null,
    hitosPago.length > 0 ? savePaymentPlanToSupabase(created.id, hitosPago) : null,
  ]);
  return { created, supabaseOk: true };
}

/** Maps `UnitData[]` del wizard → filas de `promotion_units` y hace
 *  upsert (idempotente por id). Usado en createPromotionFromWizard
 *  y disponible para futuras ediciones de unidades sin recrear la
 *  promoción.
 *
 *  Mapping según el schema real (migración `20260429100001_phase2_schema`):
 *    - label = `nombre` del wizard ("Villa 1", "1ºA"…)
 *    - rooms = dormitorios · bathrooms = baños
 *    - surface_m2 = superficieConstruida
 *    - terrace_m2 = superficieTerraza
 *    - price = precio · floor = planta (text)
 *    - status: si el wizard trae status custom (reservada/vendida) lo
 *      respetamos · default 'available'.
 *    - metadata: bundle JSONB con todo el resto (ref, parking, trastero,
 *      vistas, fotos, planos, overrides…) para no perder info.
 */
export async function saveUnitsToSupabase(
  promotionId: string,
  unidades: UnitData[],
): Promise<void> {
  if (!isSupabaseConfigured || unidades.length === 0) return;
  const rows = unidades.map((u) => ({
    id: u.id,
    promotion_id: promotionId,
    label: u.nombre || u.ref || u.id,
    rooms: Number(u.dormitorios) || null,
    bathrooms: Number(u.banos) || null,
    surface_m2: Number(u.superficieConstruida) || null,
    terrace_m2: Number(u.superficieTerraza) || null,
    price: Number(u.precio) || null,
    status: (u.status as string) || "available",
    floor: u.planta != null ? String(u.planta) : null,
    orientation: u.orientacion || null,
    /* Todo lo que no encaja en columnas dedicadas viaja en metadata ·
     * el hidrator lo recompone en `rowToUnit`. */
    metadata: {
      ref: u.ref,
      superficieUtil: u.superficieUtil,
      parcela: u.parcela,
      parking: u.parking,
      trastero: u.trastero,
      piscinaPrivada: u.piscinaPrivada,
      vistas: u.vistas,
      subtipo: u.subtipo,
      caracteristicas: u.caracteristicas,
      planoUrls: u.planoUrls,
      fotosUnidad: u.fotosUnidad,
      videosUnidad: u.videosUnidad,
      usarFotosPromocion: u.usarFotosPromocion,
      descripcionOverride: u.descripcionOverride,
      caracteristicasOverride: u.caracteristicasOverride,
      hitosPagoOverride: u.hitosPagoOverride,
      deliveryYearOverride: u.deliveryYearOverride,
      energyCertOverride: u.energyCertOverride,
      faseConstruccionOverride: u.faseConstruccionOverride,
    },
  }));
  const { error } = await supabase
    .from("promotion_units")
    .upsert(rows, { onConflict: "id" });
  if (error) console.warn("[units:save] upsert failed:", error.message);
}

/** Maps las fotos + vídeos del wizard → filas de `promotion_gallery`.
 *
 *  Estrategia · borrar todas las filas existentes de la promo y
 *  re-insertar (delete-then-insert) · simple, idempotente y evita
 *  tener que rastrear ids individuales. La tabla usa `uuid` autogenerado
 *  para `id` (no podemos reusar el FotoItem.id que es del frontend).
 *
 *  Mapping según el schema (ver migración 20260429100001):
 *    - url       = FotoItem.url / VideoItem.url
 *    - alt       = FotoItem.nombre / VideoItem.nombre
 *    - position  = FotoItem.orden (vídeos van al final)
 *    - kind      = 'photo' | 'video' (default 'photo' en la tabla)
 *
 *  Limitación · `promotion_gallery` no tiene columna `metadata` ·
 *  perdemos `categoria`, `esPrincipal`, `bloqueada` y `tipo` (youtube
 *  vs vimeo360). Si más adelante se necesitan, hace falta migración
 *  añadiendo `metadata jsonb`. Out of scope ahora · la galería pública
 *  funciona con url+alt+position+kind.
 */
export async function saveGalleryToSupabase(
  promotionId: string,
  fotos: FotoItem[],
  videos: VideoItem[],
): Promise<void> {
  if (!isSupabaseConfigured) return;
  if (fotos.length === 0 && videos.length === 0) return;

  /* Wipe-then-insert · delete cascade limpio antes de meter las nuevas. */
  await supabase.from("promotion_gallery").delete().eq("promotion_id", promotionId);

  const photoRows = fotos
    .filter((f) => !!f.url)
    .map((f) => ({
      promotion_id: promotionId,
      url: f.url,
      alt: f.nombre || null,
      position: f.orden,
      kind: "photo",
    }));

  const videoRows = videos
    .filter((v) => !!v.url)
    .map((v, i) => ({
      promotion_id: promotionId,
      url: v.url,
      alt: v.nombre || null,
      /* Vídeos van DESPUÉS de las fotos · empiezan en `fotos.length + i`
       * para no chocar con el orden. */
      position: fotos.length + i,
      kind: "video",
    }));

  const rows = [...photoRows, ...videoRows];
  if (rows.length === 0) return;
  const { error } = await supabase.from("promotion_gallery").insert(rows);
  if (error) console.warn("[gallery:save] insert failed:", error.message);
}

/** Maps `HitoPago[]` del wizard → filas de `payment_plans`.
 *
 *  Cada hito = un tramo. `tramo` se asigna por orden (1-based). El
 *  `metodoPago` (contrato | manual | certificaciones) es global de la
 *  promoción · viaja en `promotions.metadata.wizardSnapshot.metodoPago`
 *  · NO se replica por hito.
 *
 *  Mapping según el schema:
 *    - tramo        = índice 1-based del hito en el array
 *    - pct          = HitoPago.porcentaje
 *    - label        = HitoPago.descripcion
 *    - due_at_event = null (el wizard no captura un evento ligado todavía)
 *    - metadata     = bundle JSONB con cualquier extra futuro
 *
 *  Estrategia delete-then-insert · idempotente.
 */
export async function savePaymentPlanToSupabase(
  promotionId: string,
  hitos: HitoPago[],
): Promise<void> {
  if (!isSupabaseConfigured || hitos.length === 0) return;

  await supabase.from("payment_plans").delete().eq("promotion_id", promotionId);

  const rows = hitos.map((h, i) => ({
    promotion_id: promotionId,
    tramo: i + 1,
    label: h.descripcion || null,
    pct: Number(h.porcentaje) || null,
    due_at_event: null,
    metadata: {},
  }));
  const { error } = await supabase.from("payment_plans").insert(rows);
  if (error) console.warn("[payment_plans:save] insert failed:", error.message);
}
