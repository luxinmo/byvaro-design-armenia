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

import type { WizardState, UnitData } from "@/components/crear-promocion/types";
import { memCache } from "./memCache";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

const CREATED_KEY = "byvaro.promotions.created.v1";

interface CreatedPromotion {
  id: string;
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

/** Convierte WizardState → fila DB + persiste a Supabase + localStorage.
 *  Optimistic local · async write-through. */
export function createPromotionFromWizard(
  state: WizardState,
  ownerOrgId: string,
  ownerRole: "promotor" | "comercializador" = "promotor",
  status: "active" | "incomplete" = "active",
): CreatedPromotion {
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

  /* Write-through · async fire-and-forget. */
  void (async () => {
    if (!isSupabaseConfigured) return;
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
      return;
    }
    /* Promo creada · ahora persistir las unidades a `promotion_units`.
     *  Antes vivían SOLO en `promotions.metadata.wizardSnapshot` (JSONB)
     *  y la tab Availability mostraba 0 unidades porque lee de la
     *  tabla dedicada. Sin esto no había paridad local↔producción. */
    const unidades = (state as unknown as { unidades?: UnitData[] }).unidades ?? [];
    if (unidades.length > 0) {
      await saveUnitsToSupabase(created.id, unidades);
    }
  })();

  return created;
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
