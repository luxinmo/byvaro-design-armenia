/**
 * seedHydrator.ts · Reemplaza los arrays seed de `src/data/*` con
 * los datos vivos de Supabase mediante mutación in-place.
 *
 * QUÉ
 * ----
 * Los arrays exportados (`promotions`, `developerOnlyPromotions`,
 * `unitsByPromotion`) se inicializan con seed estático al cargar el
 * módulo. Cuando llega Supabase, esta función:
 *   1. Vacía el contenido del array (length = 0 / delete keys).
 *   2. Vuelve a poblar con los datos de DB.
 *
 * Como JavaScript pasa arrays por referencia, cualquier consumer
 * que importó el array tras la mutación verá los nuevos datos
 * automáticamente · sin tocar 58 archivos.
 *
 * LIMITACIONES
 * ------------
 *  · Componentes ya renderizados con seed NO re-renderizan
 *    automáticamente. Disparamos un evento `byvaro:seed-hydrated`
 *    que useSyncExternalStore o suscriptores pueden escuchar para
 *    forzar refresh. La mayoría de pages re-renderizan
 *    naturalmente al cambiar de ruta o al recibir nuevos eventos.
 *  · La hidratación es BEST-EFFORT · si Supabase falla, los seeds
 *    siguen siendo válidos (paridad esperada DB ↔ seed).
 */

import { promotions } from "@/data/promotions";
import { developerOnlyPromotions, type DevPromotion } from "@/data/developerPromotions";
import { unitsByPromotion } from "@/data/units";
import { agencies, type Agency } from "@/data/agencies";
import { promotores } from "@/data/promotores";
import { leads, type Lead, type LeadSource, type LeadStatus } from "@/data/leads";
import { sales, type Venta, type VentaEstado } from "@/data/sales";
import { registros, type Registro } from "@/data/records";
import type { Promotion } from "@/data/promotions";
import type { Unit, UnitStatus } from "@/data/units";
import { seedRef } from "@/lib/publicRef";

const SEED_HYDRATED_EVENT = "byvaro:seed-hydrated";

let hydrated = false;
let hydratePromise: Promise<void> | null = null;

interface PromotionRow {
  id: string;
  owner_organization_id: string;
  owner_role: string | null;
  name: string;
  reference: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  status: string;
  total_units: number;
  available_units: number;
  price_from: number | null;
  price_to: number | null;
  delivery: string | null;
  image_url: string | null;
  can_share_with_agencies: boolean;
  metadata: Record<string, unknown> | null;
}

interface UnitRow {
  id: string;
  promotion_id: string;
  label: string;
  reference: string | null;
  rooms: number | null;
  bathrooms: number | null;
  surface_m2: number | null;
  terrace_m2: number | null;
  price: number | null;
  status: string | null;
  floor: string | null;
  orientation: string | null;
  metadata: Record<string, unknown> | null;
}

/** Construye una DevPromotion a partir de una row DB · best-effort
 *  para entidades que existen SOLO en DB y no en seed (no debería
 *  pasar en Phase 1 pero cubrimos el edge). Los campos no presentes
 *  en metadata caen a defaults vacíos. */
function rowToDevPromotion(r: PromotionRow): DevPromotion {
  const location = [r.city, r.province].filter(Boolean).join(", ");
  const status = r.status === "sold_out" ? "sold-out" : r.status;
  const meta = (r.metadata ?? {}) as {
    propertyTypes?: string[];
    buildingType?: string;
    constructionProgress?: number;
    hasShowFlat?: boolean;
    commission?: number;
    reservationCost?: number;
    collaboration?: unknown;
    wizardSnapshot?: {
      colaboracion?: boolean;
      comisionInternacional?: number;
      comisionNacional?: number;
      diferenciarNacionalInternacional?: boolean;
      diferenciarComisiones?: boolean;
      agenciasRefusarNacional?: boolean;
      clasificacionCliente?: string;
      formaPagoComision?: string | null;
      hitosComision?: unknown[];
      ivaIncluido?: boolean;
      condicionesRegistro?: unknown[];
      validezRegistroDias?: number;
      modoValidacionRegistro?: string;
    };
  };
  /* CollaborationConfig · 2 fuentes en orden de preferencia:
   *  1. `meta.collaboration` (escrito por createPromotionFromWizard
   *     desde el fix del PR #95).
   *  2. Fallback · reconstruir desde `meta.wizardSnapshot` para
   *     promos creadas ANTES del fix (PR07696 y similares) ·
   *     wizardSnapshot.colaboracion=true significa que el user
   *     activó colaboración · sin este fallback, el validador dice
   *     "Sin estructura de comisiones definida" para siempre. */
  const collaboration = meta.collaboration ?? (
    meta.wizardSnapshot?.colaboracion === true
      ? {
          comisionInternacional: meta.wizardSnapshot.comisionInternacional ?? 0,
          comisionNacional: meta.wizardSnapshot.comisionNacional ?? 0,
          diferenciarNacionalInternacional: meta.wizardSnapshot.diferenciarNacionalInternacional ?? false,
          diferenciarComisiones: meta.wizardSnapshot.diferenciarComisiones ?? false,
          agenciasRefusarNacional: meta.wizardSnapshot.agenciasRefusarNacional ?? false,
          clasificacionCliente: meta.wizardSnapshot.clasificacionCliente,
          formaPagoComision: meta.wizardSnapshot.formaPagoComision,
          hitosComision: meta.wizardSnapshot.hitosComision ?? [],
          ivaIncluido: meta.wizardSnapshot.ivaIncluido ?? false,
          condicionesRegistro: meta.wizardSnapshot.condicionesRegistro ?? [],
          validezRegistroDias: meta.wizardSnapshot.validezRegistroDias ?? 0,
          modoValidacionRegistro: meta.wizardSnapshot.modoValidacionRegistro,
        }
      : undefined
  );
  return {
    id: r.id,
    code: r.reference ?? r.id,
    name: r.name,
    location,
    priceMin: r.price_from ?? 0,
    priceMax: r.price_to ?? 0,
    availableUnits: r.available_units,
    totalUnits: r.total_units,
    status: status as DevPromotion["status"],
    reservationCost: meta.reservationCost ?? 0,
    delivery: r.delivery ?? "",
    commission: meta.commission ?? 0,
    developer: "",
    agencies: 0,
    agencyAvatars: [],
    propertyTypes: meta.propertyTypes ?? [],
    image: r.image_url ?? undefined,
    updatedAt: "",
    constructionProgress: meta.constructionProgress,
    hasShowFlat: meta.hasShowFlat,
    buildingType: meta.buildingType as DevPromotion["buildingType"],
    canShareWithAgencies: r.can_share_with_agencies,
    ownerOrganizationId: r.owner_organization_id,
    ownerRole: (r.owner_role as DevPromotion["ownerRole"]) ?? undefined,
    ...(collaboration ? { collaboration } : {}),
    /* Metadata RAW · contiene `wizardSnapshot` con state completo
     *  (fotos, videos, descripcion, hitos, etc.). Cast porque el
     *  tipo Promotion no la declara · pero la ficha la lee
     *  defensivamente con `(p as ...).metadata?.wizardSnapshot`. */
    metadata: r.metadata ?? {},
  } as DevPromotion;
}

/** MERGE in-place de campos identitarios DB → entry seed existente.
 *  Pisa solo los campos que SON la fuente de verdad de DB · preserva
 *  los campos que aún no migraron (commission, constructionProgress,
 *  hasShowFlat, propertyTypes, buildingType, comerciales,
 *  puntosDeVentaIds, collaboration, missingSteps, agencies, etc.).
 *  Esta es la regla v2 · Wave 2 in-place mutation. */
function mergePromotionFromDb(target: DevPromotion, r: PromotionRow): void {
  const location = [r.city, r.province].filter(Boolean).join(", ");
  const status = r.status === "sold_out" ? "sold-out" : r.status;
  const meta = (r.metadata ?? {}) as {
    propertyTypes?: string[];
    buildingType?: string;
    constructionProgress?: number;
    hasShowFlat?: boolean;
    commission?: number;
    reservationCost?: number;
  };
  target.name = r.name;
  if (r.reference) target.code = r.reference;
  if (location) target.location = location;
  target.status = status as DevPromotion["status"];
  if (typeof r.total_units === "number") target.totalUnits = r.total_units;
  if (typeof r.available_units === "number") target.availableUnits = r.available_units;
  if (r.price_from != null) target.priceMin = r.price_from;
  if (r.price_to != null) target.priceMax = r.price_to;
  if (r.delivery) target.delivery = r.delivery;
  if (r.image_url) target.image = r.image_url;
  if (typeof r.can_share_with_agencies === "boolean") target.canShareWithAgencies = r.can_share_with_agencies;
  if (r.owner_organization_id) target.ownerOrganizationId = r.owner_organization_id;
  if (r.owner_role) target.ownerRole = r.owner_role as DevPromotion["ownerRole"];
  /* Campos en metadata · solo pisamos si DB los tiene · de lo
   *  contrario respetamos el seed (commission=5, etc.). */
  if (typeof meta.commission === "number") target.commission = meta.commission;
  if (typeof meta.reservationCost === "number") target.reservationCost = meta.reservationCost;
  if (typeof meta.constructionProgress === "number") target.constructionProgress = meta.constructionProgress;
  if (typeof meta.hasShowFlat === "boolean") target.hasShowFlat = meta.hasShowFlat;
  if (Array.isArray(meta.propertyTypes) && meta.propertyTypes.length > 0) target.propertyTypes = meta.propertyTypes;
  if (meta.buildingType) target.buildingType = meta.buildingType as DevPromotion["buildingType"];
}

function rowToUnit(r: UnitRow): Unit {
  /* Metadata · todos los campos no-columna del wizard viajan aquí.
   *  Crítico mantener `fotosUnidad` para que la tab Disponibilidad
   *  (`PromotionAvailabilityFull`) muestre fotos por unidad · sin
   *  esto el thumbnail caía siempre al placeholder. */
  const meta = (r.metadata ?? {}) as {
    block?: string; door?: string; type?: string;
    usableArea?: number; parcela?: number;
    piscinaPrivada?: boolean;
    fotosUnidad?: string[];
    usarFotosPromocion?: boolean;
  };
  return {
    id: r.id,
    /* `ref` canónico · "UN" + 8 dígitos · viene de DB. Si no está
     *  (legacy), fallback al id interno. */
    ref: r.reference ?? r.id,
    promotionId: r.promotion_id,
    /* Block / door · vacíos cuando es unifamiliar (las villas no
     *  tienen bloque ni puerta). Antes había hardcode "11A"/"A"
     *  que producía labels absurdos como "11A-0A · 3 Hab" en cards
     *  de villas. Ahora cadena vacía · el render decide qué mostrar
     *  (publicId si existe, fallback al pattern si no). */
    block: meta.block ?? "",
    floor: r.floor ? Number(r.floor) : 0,
    door: meta.door ?? "",
    publicId: r.label,
    type: meta.type ?? "Apartamento",
    bedrooms: r.rooms ?? 0,
    bathrooms: r.bathrooms ?? 0,
    builtArea: r.surface_m2 ?? 0,
    usableArea: meta.usableArea ?? 0,
    terrace: r.terrace_m2 ?? 0,
    garden: 0,
    parcel: meta.parcela ?? 0,
    hasPool: !!meta.piscinaPrivada,
    orientation: r.orientation ?? "Sur",
    price: r.price ?? 0,
    status: (r.status ?? "available") as UnitStatus,
    /* Fotos propias subidas en el wizard. Si vacío Y el user marcó
     *  `usarFotosPromocion`, el render cae a la galería de la promo. */
    fotos: meta.fotosUnidad ?? [],
  };
}

/** Reemplaza in-place los arrays/maps seed con datos de Supabase.
 *  Idempotente · solo corre la primera vez que llega data. */
export function hydrateSeedsFromSupabase(): Promise<void> {
  if (hydrated) return Promise.resolve();
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
      if (!isSupabaseConfigured) return;

      const [promosRes, unitsRes, orgsRes, profilesRes, leadsRes, salesRes, registrosRes, privateMetaRes] = await Promise.all([
        supabase.from("promotions").select("*"),
        supabase.from("promotion_units").select("*"),
        supabase.from("organizations").select("*"),
        supabase.from("organization_profiles").select("*"),
        supabase.from("leads").select("*"),
        supabase.from("sales").select("*"),
        supabase.from("registros").select("*"),
        /* RPC · devuelve private_metadata SOLO para promociones donde
         *  el caller es owner o colaborador activo. Cross-tenant queries
         *  reciben array vacío para esa promo (nunca expone commission,
         *  comerciales, collaboration config a no participantes). */
        supabase.rpc("list_promotion_private_metadata"),
      ]);

      /* Merge private_metadata en cada PromotionRow.metadata antes de
       *  pasar a mergePromotionFromDb · para participantes restituye
       *  commission/comerciales/collaboration; para no participantes la
       *  RPC no devuelve esa fila y los campos quedan en seed defaults. */
      const privByPromo = new Map<string, Record<string, unknown>>();
      if (!privateMetaRes.error && privateMetaRes.data) {
        for (const r of privateMetaRes.data as Array<{ promotion_id: string; private_metadata: Record<string, unknown> }>) {
          privByPromo.set(r.promotion_id, r.private_metadata ?? {});
        }
      }

      if (promosRes.error) {
        console.warn("[seedHydrator:promos]", promosRes.error.message);
      } else if (promosRes.data && promosRes.data.length > 0) {
        /* MERGE in-place · pisamos solo campos identitarios de DB y
         *  preservamos los campos del seed que aún no migraron a DB
         *  (commission, constructionProgress, agencies, comerciales,
         *  collaboration config, etc.). Promos en DB sin match en
         *  seed se añaden como nueva entrada. */
        const dbById = new Map<string, PromotionRow>();
        for (const r of promosRes.data as PromotionRow[]) {
          /* Merge private_metadata en metadata si el viewer puede verlo.
           *  Para no-participantes, privByPromo no tiene la entrada y la
           *  promo queda con metadata público. */
          const priv = privByPromo.get(r.id);
          if (priv) {
            r.metadata = { ...(r.metadata ?? {}), ...priv };
          }
          dbById.set(r.id, r);
        }
        /* Patch existing developerOnlyPromotions */
        for (const p of developerOnlyPromotions) {
          const r = dbById.get(p.id);
          if (!r) continue;
          mergePromotionFromDb(p, r);
          dbById.delete(p.id);
        }
        /* Patch existing promotions (legacy marketplace) */
        for (const p of promotions) {
          const r = dbById.get(p.id);
          if (!r) continue;
          mergePromotionFromDb(p as DevPromotion, r);
          dbById.delete(p.id);
        }
        /* Cualquier promo en DB sin match en seed → añadir a
         *  developerOnlyPromotions con defaults de DB. */
        for (const r of dbById.values()) {
          developerOnlyPromotions.push(rowToDevPromotion(r));
        }
      }

      if (unitsRes.error) {
        console.warn("[seedHydrator:units]", unitsRes.error.message);
      } else if (unitsRes.data && unitsRes.data.length > 0) {
        /* MERGE in-place · pisamos solo lo que viene de DB (ref,
         *  precio, status, label) y preservamos los campos del seed
         *  no migrados (block, door, type, usableArea, garden, parcel,
         *  hasPool). */
        const seedById = new Map<string, Unit>();
        for (const promoUnits of Object.values(unitsByPromotion)) {
          for (const u of promoUnits) seedById.set(u.id, u);
        }
        for (const r of unitsRes.data as UnitRow[]) {
          const seedUnit = seedById.get(r.id);
          const meta = (r.metadata ?? {}) as { block?: string; door?: string; type?: string; usableArea?: number };
          if (seedUnit) {
            if (r.reference) seedUnit.ref = r.reference;
            if (r.label) seedUnit.publicId = r.label;
            if (r.rooms != null) seedUnit.bedrooms = r.rooms;
            if (r.bathrooms != null) seedUnit.bathrooms = r.bathrooms;
            if (r.surface_m2 != null) seedUnit.builtArea = r.surface_m2;
            if (r.terrace_m2 != null) seedUnit.terrace = r.terrace_m2;
            if (r.price != null) seedUnit.price = r.price;
            if (r.status) seedUnit.status = r.status as UnitStatus;
            if (r.floor) seedUnit.floor = Number(r.floor);
            if (r.orientation) seedUnit.orientation = r.orientation;
            if (meta.block) seedUnit.block = meta.block;
            if (meta.door) seedUnit.door = meta.door;
            if (meta.type) seedUnit.type = meta.type;
            if (typeof meta.usableArea === "number") seedUnit.usableArea = meta.usableArea;
          } else {
            /* Unit nueva en DB no presente en seed → añadir. */
            const u = rowToUnit(r);
            if (!unitsByPromotion[u.promotionId]) unitsByPromotion[u.promotionId] = [];
            unitsByPromotion[u.promotionId].push(u);
          }
        }
      }

      /* Hydrate AGENCIES + PROMOTORES desde organizations + profiles ·
       *  REFRESH solo de identity (name, logo, location, type). Las
       *  métricas operativas (visits, sales, comisión, contracts…) NO
       *  están en DB todavía · se mantienen del seed. */
      if (!orgsRes.error && orgsRes.data) {
        const orgs = orgsRes.data as Array<{
          id: string; kind: string; legal_name: string | null;
          display_name: string | null; address_city: string | null;
          address_province: string | null; country: string | null;
        }>;
        const profiles = (profilesRes.data ?? []) as Array<{
          organization_id: string; logo_url: string | null;
          cover_url: string | null; description: string | null;
        }>;
        const profileById = new Map<string, typeof profiles[number]>();
        for (const pr of profiles) profileById.set(pr.organization_id, pr);

        /* Patch agencies in place · solo entradas que matchean por id. */
        for (const ag of agencies) {
          const o = orgs.find((x) => x.id === ag.id && x.kind === "agency");
          if (!o) continue;
          const pr = profileById.get(o.id);
          ag.name = o.display_name ?? o.legal_name ?? ag.name;
          if (pr?.logo_url) ag.logo = pr.logo_url;
          if (pr?.cover_url) ag.cover = pr.cover_url;
          const loc = [o.address_city, o.address_province].filter(Boolean).join(", ");
          if (loc) ag.location = loc;
          if (pr?.description) ag.description = pr.description;
        }

        /* Patch promotores externos in place. */
        for (const pm of promotores) {
          const o = orgs.find((x) => x.id === pm.id && x.kind === "developer");
          if (!o) continue;
          const pr = profileById.get(o.id);
          pm.name = o.display_name ?? o.legal_name ?? pm.name;
          if (pr?.logo_url) pm.logo = pr.logo_url;
          if (pr?.cover_url) pm.cover = pr.cover_url;
          const loc = [o.address_city, o.address_province].filter(Boolean).join(", ");
          if (loc) pm.location = loc;
          if (pr?.description) pm.description = pr.description;
        }
      }

      /* Hydrate LEADS desde public.leads. */
      if (!leadsRes.error && leadsRes.data && leadsRes.data.length > 0) {
        const dbLeads: Lead[] = (leadsRes.data as Array<{
          id: string; source: string | null; full_name: string | null;
          email: string | null; phone: string | null; message: string | null;
          status: string | null; promotion_id: string | null;
          metadata: Record<string, unknown> | null; created_at: string;
        }>).map((r) => {
          const meta = (r.metadata ?? {}) as {
            reference?: string; nationality?: string; idioma?: string;
            interest?: { promotionId?: string; promotionName?: string; tipologia?: string; dormitorios?: string; presupuestoMax?: number; zona?: string };
            tags?: string[];
          };
          return {
            id: r.id,
            reference: meta.reference ?? r.id,
            publicRef: seedRef("registro", r.id),
            fullName: r.full_name ?? "",
            email: r.email ?? "",
            phone: r.phone ?? "",
            nationality: meta.nationality,
            idioma: meta.idioma,
            source: (r.source ?? "microsite") as LeadSource,
            status: (r.status ?? "solicitud") as LeadStatus,
            interest: meta.interest ?? { promotionId: r.promotion_id ?? undefined },
            createdAt: r.created_at,
            message: r.message ?? undefined,
            tags: meta.tags ?? [],
          };
        });
        leads.length = 0;
        leads.push(...dbLeads);
      }

      /* Hydrate SALES desde public.sales. */
      if (!salesRes.error && salesRes.data && salesRes.data.length > 0) {
        const dbSales: Venta[] = (salesRes.data as Array<{
          id: string; agency_organization_id: string | null;
          promotion_id: string; unit_id: string | null;
          unit_label: string | null; cliente_nombre: string;
          cliente_email: string | null; cliente_telefono: string | null;
          cliente_nacionalidad: string | null; agent_name: string | null;
          estado: string; fecha_reserva: string | null;
          fecha_contrato: string | null; fecha_escritura: string | null;
          fecha_caida: string | null; precio_reserva: number | null;
          precio_final: number | null; precio_listado: number | null;
          descuento_aplicado: number | null;
          metadata: Record<string, unknown> | null;
        }>).map((r) => {
          const meta = (r.metadata ?? {}) as {
            legacyRegistroId?: string; comisionPct?: number;
            comisionPagada?: boolean; metodoPago?: string;
            siguientePaso?: string; siguientePasoFecha?: string;
            nota?: string; pagos?: Array<{ fecha: string; concepto: string; importe: number }>;
            motivoCaida?: string;
          };
          return {
            id: r.id,
            registroId: meta.legacyRegistroId ?? "",
            promotionId: r.promotion_id,
            unitId: r.unit_id ?? undefined,
            unitLabel: r.unit_label ?? "",
            clienteNombre: r.cliente_nombre,
            clienteEmail: r.cliente_email ?? "",
            clienteTelefono: r.cliente_telefono ?? "",
            clienteNacionalidad: r.cliente_nacionalidad ?? undefined,
            agencyId: r.agency_organization_id ?? undefined,
            agentName: r.agent_name ?? "",
            estado: r.estado as VentaEstado,
            fechaReserva: r.fecha_reserva ?? "",
            fechaContrato: r.fecha_contrato ?? undefined,
            fechaEscritura: r.fecha_escritura ?? undefined,
            fechaCaida: r.fecha_caida ?? undefined,
            precioReserva: r.precio_reserva ?? 0,
            precioFinal: r.precio_final ?? 0,
            precioListado: r.precio_listado ?? 0,
            descuentoAplicado: r.descuento_aplicado ?? 0,
            comisionPct: meta.comisionPct ?? 0,
            comisionPagada: meta.comisionPagada ?? false,
            metodoPago: meta.metodoPago,
            siguientePaso: meta.siguientePaso,
            siguientePasoFecha: meta.siguientePasoFecha,
            nota: meta.nota,
            pagos: meta.pagos ?? [],
            motivoCaida: meta.motivoCaida,
          } as Venta;
        });
        sales.length = 0;
        sales.push(...dbSales);
      }

      /* Hydrate REGISTROS desde public.registros · solo identity
       *  básica · si registros tiene campos complejos del seed que
       *  no están en DB, se mantienen del seed actual (best-effort
       *  identity refresh sin destruir datos derivados). */
      if (!registrosRes.error && registrosRes.data && registrosRes.data.length > 0) {
        const byId = new Map<string, Record<string, unknown>>();
        for (const r of registrosRes.data) byId.set((r as { id: string }).id, r as Record<string, unknown>);
        for (const reg of registros) {
          const r = byId.get(reg.id);
          if (!r) continue;
          /* Refresh básico · si DB tiene el registro, actualizamos
           *  estado y datos del cliente. El resto se mantiene del seed
           *  por compatibilidad con campos no migrados (metadata
           *  embedded, eventos, etc.). */
          if (typeof r.cliente_nombre === "string") reg.clienteNombre = r.cliente_nombre;
          if (typeof r.cliente_email === "string") reg.clienteEmail = r.cliente_email;
          if (typeof r.estado === "string") reg.estado = r.estado as Registro["estado"];
        }
      }

      hydrated = true;
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(SEED_HYDRATED_EVENT));
      }
    } catch (e) {
      console.warn("[seedHydrator] skipped:", e);
    } finally {
      hydratePromise = null;
    }
  })();
  return hydratePromise;
}

/** Suscríbete a "datos de seeds actualizados desde Supabase".
 *  Los componentes pueden escuchar este evento para forzar re-render
 *  via `useState`/`useSyncExternalStore`. */
export function subscribeToSeedHydrated(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(SEED_HYDRATED_EVENT, handler);
  return () => window.removeEventListener(SEED_HYDRATED_EVENT, handler);
}

export function isSeedsHydrated(): boolean {
  return hydrated;
}
