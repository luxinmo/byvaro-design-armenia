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
import { unitsByPromotion, type Unit } from "@/data/units";
import { composeDelivery } from "./deliveryFormat";

const CREATED_KEY = "byvaro.promotions.created.v1";

export interface CreatedPromotion {
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
  /** Flag de visibilidad cross-tenant · idéntico al campo de DB.
   *  Persistirlo en el cache local evita que el adapter del detail
   *  page tenga que abrir `metadata.wizardSnapshot.colaboracion` para
   *  saber si la promo es uso interno o compartida. */
  canShareWithAgencies?: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
}

/* Helper canónico · deriva los campos planos de metadata desde un
 * WizardState. Usado por:
 *   - createPromotionFromWizard (al crear nueva promo)
 *   - saveOverride en promotionWizardOverrides.ts (al editar
 *     existente desde Configuración)
 * Sin centralizar este derivado · cada save path escribía un subset
 * distinto · ediciones de comisión/tipo/etc. no se reflejaban en el
 * listado tras refresh (porque metadata flat seguía con valores
 * viejos del create inicial). */
export function deriveFlatMetadata(state: WizardState): {
  propertyTypes: string[];
  buildingType: "plurifamiliar" | "unifamiliar-single" | "unifamiliar-multiple" | undefined;
  constructionProgress: number | undefined;
  reservationCost: number;
  commission: number;
} {
  const propertyTypes = (state.tipologiasSeleccionadas ?? [])
    .map((t) => t.tipo)
    .filter((t): t is string => !!t);
  if (propertyTypes.length === 0 && state.subVarias) propertyTypes.push(state.subVarias);

  const buildingType =
    state.tipo === "unifamiliar"
      ? (state.subUni === "una_sola" ? "unifamiliar-single" : "unifamiliar-multiple")
      : state.tipo === "plurifamiliar" ? "plurifamiliar"
      : undefined;

  const FASE_PROGRESS: Record<string, number> = {
    inicio_obra: 10, estructura: 30, cerramientos: 50, instalaciones: 65,
    acabados: 80, entrega_proxima: 95, llave_en_mano: 100, definir_mas_tarde: 0,
  };
  const ESTADO_PROGRESS: Record<string, number> = {
    proyecto: 0, en_construccion: 50, terminado: 100,
  };
  const constructionProgress: number | undefined =
    (state.faseConstruccion && FASE_PROGRESS[state.faseConstruccion] != null
      ? FASE_PROGRESS[state.faseConstruccion]
      : undefined)
    ?? (state.estado && ESTADO_PROGRESS[state.estado] != null
      ? ESTADO_PROGRESS[state.estado]
      : undefined);

  return {
    propertyTypes,
    buildingType,
    constructionProgress,
    reservationCost: typeof state.importeReserva === "number" ? state.importeReserva : 0,
    commission: typeof state.comisionInternacional === "number" ? state.comisionInternacional : 0,
  };
}

/** Patcher canónico para el cache local `byvaro.promotions.created.v1`
 *  · usado por saveOverride al editar desde Configuración. Sin esto
 *  el listado seguía mostrando comisión/tipologías/etc. viejas hasta
 *  el siguiente full reload. */
export function patchCreatedPromotionInCache(
  promotionId: string,
  patch: Partial<CreatedPromotion> & { metadata?: Record<string, unknown> },
): void {
  const list = readCreated();
  const idx = list.findIndex((p) => p.id === promotionId);
  if (idx === -1) return; // no era una promo de las creadas via wizard
  const existing = list[idx];
  const next: CreatedPromotion = {
    ...existing,
    ...patch,
    metadata: { ...(existing.metadata ?? {}), ...(patch.metadata ?? {}) },
  };
  const newList = [...list];
  newList[idx] = next;
  writeCreated(newList);
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

/** Borra una promoción · 3 lugares:
 *   1. Cache local `byvaro.promotions.created.v1` (síncrono).
 *   2. Cache hidratado `developerOnlyPromotions` (módulo-level array
 *      mutado por seedHydrator). Sin esto, la promo desaparece del
 *      cache local pero sigue en el listado al volver hasta el
 *      próximo full hydrate.
 *   3. Tabla `promotions` en Supabase (write-through async).
 *  Dispara `byvaro:promotions-changed` para refrescar listados
 *  reactivos. */
export async function deleteCreatedPromotion(id: string): Promise<{ ok: boolean; error?: string }> {
  /* 1 · cache local */
  const list = readCreated();
  const next = list.filter((p) => p.id !== id);
  writeCreated(next);

  /* 2 · cache hidratado · in-place mutation con splice para mantener
   * la misma referencia de array (consumers que importaron el array
   * la siguen viendo viva). */
  try {
    const { developerOnlyPromotions } = await import("@/data/developerPromotions");
    const idx = developerOnlyPromotions.findIndex((p) => p.id === id);
    if (idx !== -1) {
      developerOnlyPromotions.splice(idx, 1);
    }
  } catch (e) {
    console.warn("[promotions:delete] no se pudo limpiar cache hidratado:", e);
  }

  /* Dispara el evento SIEMPRE (no solo cuando cambió el cache local) ·
   * cubre el caso de promo que vivía solo en developerOnlyPromotions ·
   * el listado se suscribe a este evento para refrescar `promosTick`
   * y re-evaluar `allPromotions`. */
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("byvaro:promotions-changed"));
  }

  /* 3 · Supabase */
  if (!isSupabaseConfigured) return { ok: true };
  const { error } = await supabase.from("promotions").delete().eq("id", id);
  if (error) {
    console.warn("[promotions:delete]", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
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
  console.info("[wizard:create] start", {
    id,
    ownerOrgId,
    ownerRole,
    status,
    state: {
      nombre: state.nombrePromocion,
      tipo: state.tipo,
      ciudad: state.direccionPromocion?.ciudad,
      unidades: state.unidades?.length ?? 0,
      fotos: state.fotos?.length ?? 0,
      videos: state.videos?.length ?? 0,
      hitosPago: state.hitosPago?.length ?? 0,
      publicRef: state.publicRef,
    },
  });

  /* Extraer campos del WizardState · los nombres reales viven en
   * `src/components/crear-promocion/types.ts`. Antes este extractor
   * usaba nombres inventados (s.ciudad, s.totalUnidades, s.precioMin,
   * s.entrega) que NO existen en WizardState · resultado · cada
   * campo era null/0 aunque el wizard tuviera los datos · la ficha
   * mostraba "Sin configurar" en todo. */
  const name = state.nombrePromocion?.trim() || "Sin título";
  const city = state.direccionPromocion?.ciudad?.trim() || null;
  const country = state.direccionPromocion?.pais?.trim() || "ES";
  const address = state.direccionPromocion?.direccion?.trim() || null;
  const description = state.descripcion?.trim() || null;
  /* totalUnits · count de unidades creadas en el wizard. */
  const totalUnits = state.unidades?.length ?? 0;
  /* Rango de precios · derivado de las unidades con precio > 0. */
  const unitPrices = (state.unidades ?? [])
    .map((u) => u.precio ?? 0)
    .filter((p) => p > 0);
  const priceFrom = unitPrices.length > 0 ? Math.min(...unitPrices) : null;
  const priceTo = unitPrices.length > 0 ? Math.max(...unitPrices) : null;
  /* Entrega · helper canónico `composeDelivery` · formato compacto
   *  ("CPV + 18m" / "Lic. + 18m" / "T2 2026"). Mantener un único
   *  punto de composición evita strings divergentes en cada
   *  callsite. */
  const delivery = composeDelivery({
    fechaEntrega: state.fechaEntrega,
    trimestreEntrega: state.trimestreEntrega,
    tipoEntrega: state.tipoEntrega,
    mesesTrasContrato: state.mesesTrasContrato,
    mesesTrasLicencia: state.mesesTrasLicencia,
  }) || null;
  /* Imagen principal · primera foto marcada como esPrincipal o la
   * primera del array. */
  const heroFoto = state.fotos?.find((f) => f.esPrincipal) ?? state.fotos?.[0];
  const imageUrl = heroFoto?.url ?? null;

  /* Campos derivados para metadata flat · el hydrator
   *  (`seedHydrator.rowToDevPromotion`) los lee directamente para
   *  reconstruir el shape DevPromotion. Lógica centralizada en
   *  `deriveFlatMetadata` para que tanto el create como el save
   *  override usen el mismo derivado. */
  const flat = deriveFlatMetadata(state);
  const { propertyTypes, buildingType, constructionProgress, reservationCost, commission } = flat;
  const canShareWithAgencies = state.colaboracion === true;
  /* CollaborationConfig completa · solo cuando se comparte con
   *  agencias. Sin esto, al refrescar la ficha tras crear, el
   *  validador `getMissingForPromotion` decía "Sin estructura de
   *  comisiones definida" porque la promo se hidrataba desde DB sin
   *  collaboration · banner falso de "no publicable". Con esto el
   *  seedHydrator + adapter local pueden reconstruirla desde
   *  metadata.collaboration. */
  const collaboration = canShareWithAgencies ? {
    comisionInternacional: state.comisionInternacional,
    comisionNacional: state.comisionNacional,
    diferenciarNacionalInternacional: state.diferenciarNacionalInternacional,
    diferenciarComisiones: state.diferenciarComisiones,
    agenciasRefusarNacional: state.agenciasRefusarNacional,
    clasificacionCliente: state.clasificacionCliente,
    formaPagoComision: state.formaPagoComision,
    hitosComision: state.hitosComision,
    ivaIncluido: state.ivaIncluido,
    condicionesRegistro: state.condicionesRegistro,
    validezRegistroDias: state.validezRegistroDias,
    modoValidacionRegistro: state.modoValidacionRegistro,
  } : undefined;

  const created: CreatedPromotion = {
    id,
    code: state.publicRef || undefined,
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
    canShareWithAgencies,
    metadata: {
      /* Campos planos · consumidos por seedHydrator + ficha. */
      propertyTypes,
      buildingType,
      constructionProgress,
      reservationCost,
      commission,
      collaboration,
      /* Snapshot completo del state · usado por adapters que
       *  necesitan info granular (Promociones.tsx createdAsDev,
       *  PromocionDetalle, etc.). Mantener al final · grande. */
      wizardSnapshot: state,
    },
    createdAt: now,
  };

  const list = readCreated();
  writeCreated([created, ...list]);
  console.info("[wizard:create] cache local OK · ahora intento Supabase");

  /* Write-through SÍNCRONO (await) a Supabase · si falla el insert
   * principal, devolvemos `supabaseOk: false` · el caller NO debe
   * borrar el draft para que el user pueda re-intentar / recuperar. */
  if (!isSupabaseConfigured) {
    /* Sin Supabase configurado tratamos como OK (entorno dev sin
     * backend) · el cache local es la fuente. */
    console.warn("[wizard:create] Supabase NO configurado · saltando insert");
    return { created, supabaseOk: true };
  }
  const { error } = await supabase.from("promotions").insert({
    id: created.id,
    /* `reference` · publicRef canónico (PR + 5 dígitos) · sin
     *  esto, al re-hidratar desde DB el code quedaba undefined y
     *  `promotionHref(p)` caía al id interno (`prom-c-1234...`)
     *  en vez del PR... bonito. */
    reference: created.code ?? null,
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
    /* `can_share_with_agencies` · desde el toggle del wizard · si el
     *  user marcó "Solo uso interno" (colaboracion=false) NO se debe
     *  compartir con agencias · antes estaba hardcoded a true · el
     *  validador exigía comisiones aunque el user no quisiera. */
    can_share_with_agencies: canShareWithAgencies,
    metadata: created.metadata,
  });
  if (error) {
    console.error("[wizard:create] ❌ insert principal Supabase FALLÓ:", error.message, error);
    return { created, supabaseOk: false, supabaseError: error.message };
  }
  console.info("[wizard:create] ✓ insert principal Supabase OK · ahora sub-entidades");
  /* Promo creada · ahora persistir las sub-entidades a sus tablas
   * dedicadas. Si alguna falla NO marcamos supabaseOk=false (la promo
   * principal sí está) · solo loggeamos. El user puede re-subir
   * desde la ficha. */
  const unidades = state.unidades ?? [];
  const fotos = state.fotos ?? [];
  const videos = state.videos ?? [];
  const hitosPago = state.hitosPago ?? [];
  console.info("[wizard:create] sub-entidades a persistir:", {
    unidades: unidades.length,
    fotos: fotos.length,
    videos: videos.length,
    hitosPago: hitosPago.length,
  });
  const subResults = await Promise.allSettled([
    unidades.length > 0 ? saveUnitsToSupabase(created.id, unidades) : Promise.resolve(),
    (fotos.length > 0 || videos.length > 0)
      ? saveGalleryToSupabase(created.id, fotos, videos) : Promise.resolve(),
    hitosPago.length > 0 ? savePaymentPlanToSupabase(created.id, hitosPago) : Promise.resolve(),
  ]);
  const labels = ["units", "gallery", "paymentPlan"];
  const failures: string[] = [];
  subResults.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`[wizard:create] ❌ sub-entidad ${labels[i]} FALLÓ:`, r.reason);
      failures.push(`${labels[i]}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
    } else {
      console.info(`[wizard:create] ✓ sub-entidad ${labels[i]} OK`);
    }
  });
  /* CRÍTICO · si alguna sub-entidad falla, marcamos supabaseOk=false ·
   * el caller (CrearPromocion) muestra toast error y NO borra el draft ·
   * el user puede reintentar. Antes los fallos eran silenciosos · la
   * promo quedaba con datos solo en cache local · al limpiar cache,
   * desaparecían (Villa Belgica + Villa 18 meses · bug confirmado en
   * producción). */
  if (failures.length > 0) {
    return {
      created,
      supabaseOk: false,
      supabaseError: `Sub-entidades no persistidas · ${failures.join(" · ")}`,
    };
  }

  /* Hidratación local INMEDIATA · `unitsByPromotion` lo popula
   *  `seedHydrator` SOLO al mount inicial de la app. Si no
   *  inyectamos las unidades aquí, el listado y la ficha de la
   *  promo recién creada salen "sin datos" hasta el próximo
   *  refresh (cuando seedHydrator vuelve a correr). Mejor sembrar
   *  ahora · esto es CACHE LOCAL · el source of truth ya está en
   *  Supabase. */
  if (unidades.length > 0) {
    unitsByPromotion[created.id] = unidades.map((u): Unit => ({
      id: u.id,
      ref: u.ref ?? u.id,
      promotionId: created.id,
      block: "",
      floor: typeof u.planta === "number" ? u.planta : 0,
      door: "",
      publicId: u.nombre || u.ref || u.id,
      type: typeof u.subtipo === "string" ? u.subtipo : "",
      bedrooms: Number(u.dormitorios) || 0,
      bathrooms: Number(u.banos) || 0,
      builtArea: Number(u.superficieConstruida) || 0,
      usableArea: Number(u.superficieUtil) || 0,
      terrace: Number(u.superficieTerraza) || 0,
      garden: 0,
      parcel: Number(u.parcela) || 0,
      hasPool: !!u.piscinaPrivada,
      orientation: u.orientacion || "Sur",
      price: Number(u.precio) || 0,
      status: (u.status ?? "available") as Unit["status"],
      /* Fotos propias subidas en el wizard · sin esto la tab
       *  Disponibilidad muestra placeholder en cada thumbnail. */
      fotos: u.fotosUnidad ?? [],
    }));
    /* Notifica a consumidores reactivos (Promociones.tsx escucha
     *  byvaro:promotions-changed para refrescar cards). */
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("byvaro:promotions-changed"));
    }
  }
  console.info("[wizard:create] DONE", { id: created.id, name: created.name });
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
  /* CRÍTICO · scoping del id por promo · si el wizard usa ids
   * genéricos (`unit-1`, `unit-2`) y el upsert tiene
   * onConflict="id", la unit-1 de una promo nueva PISA la unit-1
   * de cualquier otra promo previa (cross-tenant en el peor caso).
   * Bug confirmado en producción: Villa 18 meses pisó la unit de
   * Villa Belgica · esta última quedó sin filas en promotion_units.
   * Prefijamos `${promotionId}::` para garantizar unicidad global
   * sin tocar los ids del wizard (que se quedan en metadata.ref). */
  const rows = unidades.map((u) => ({
    id: u.id?.startsWith(`${promotionId}::`) ? u.id : `${promotionId}::${u.id}`,
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
  if (error) {
    /* THROW para que Promise.allSettled del caller marque rejected ·
     * antes solo loggeaba warn y la promo quedaba con unidades en
     * cache local pero NO en Supabase · al limpiar cache (sesión
     * nueva, otro device) las unidades desaparecían silenciosamente. */
    console.error("[units:save] upsert failed:", error.message);
    throw new Error(`Unidades no persistidas: ${error.message}`);
  }
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
  if (error) {
    console.error("[gallery:save] insert failed:", error.message);
    throw new Error(`Galería no persistida: ${error.message}`);
  }
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
  if (error) {
    console.error("[payment_plans:save] insert failed:", error.message);
    throw new Error(`Plan de pagos no persistido: ${error.message}`);
  }
}
