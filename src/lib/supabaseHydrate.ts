/**
 * supabaseHydrate.ts · hidrata localStorage scoped keys desde Supabase.
 *
 * ESTRATEGIA HÍBRIDA · evita romper la API síncrona de los hooks
 * (`useEmpresa`, `useOficinas`, etc.) que asumen lectura inmediata.
 * Al hacer login (o al montarse la app con sesión activa):
 *   1. Pulamos datos canónicos de Supabase (orgs, profiles, offices,
 *      promotions, collab_requests).
 *   2. Escribimos en las claves scoped que el frontend ya consume
 *      (`byvaro-empresa:<orgId>`, `byvaro-oficinas:<orgId>`, etc.).
 *   3. Emitimos los eventos existentes (`byvaro:empresa-changed`,
 *      `byvaro:oficinas-changed`...) para que hooks reactivos
 *      refresquen sus snapshots.
 *
 * Las MUTACIONES van por write-through (ver `lib/empresa.ts ::
 * saveEmpresaForOrg`) · escriben primero a Supabase, luego al cache
 * local. Si Supabase falla, revertimos.
 *
 * TODO(backend): sustituir el cache localStorage por TanStack Query +
 * subscriptions Realtime de Supabase. Phase 3 · cuando todos los hooks
 * sean async-aware.
 */

import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { defaultEmpresa, type Empresa, type Oficina } from "./empresa";

/* ─── Mappers · DB row → Empresa/Oficina shape ──────────────────────── */

interface OrgRow {
  id: string;
  kind: "developer" | "agency";
  legal_name: string | null;
  display_name: string | null;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  logo_url: string | null;
  cover_url: string | null;
  address_line: string | null;
  address_street: string | null;
  address_postal_code: string | null;
  address_city: string | null;
  address_province: string | null;
  country: string | null;
  status: string;
  verified: boolean;
  verified_at: string | null;
}

interface ProfileRow {
  organization_id: string;
  description: string | null;
  public_description: string | null;
  tagline: string | null;
  quote: string | null;
  quote_description: string | null;
  founded_year: number | null;
  license_number: string | null;
  licenses: unknown;
  attention_languages: string[] | null;
  commission_national_default: number | null;
  commission_international_default: number | null;
  commission_payment_term_days: number | null;
  main_contact_name: string | null;
  main_contact_email: string | null;
  main_contact_phone: string | null;
  schedule: string | null;
  linkedin: string | null;
  instagram: string | null;
  facebook: string | null;
  youtube: string | null;
  tiktok: string | null;
  marketing_top_nationalities: unknown;
  marketing_product_types: unknown;
  marketing_client_sources: unknown;
  marketing_portals: string[] | null;
  google_place_id: string | null;
  google_rating: number | null;
  google_ratings_total: number | null;
  google_fetched_at: string | null;
  google_maps_url: string | null;
  visibility_status: string | null;
}

interface OfficeRow {
  id: string;
  organization_id: string;
  name: string;
  address: string | null;
  city: string | null;
  province: string | null;
  postal_code: string | null;
  country: string | null;
  phone: string | null;
  phone_prefix: string | null;
  email: string | null;
  whatsapp: string | null;
  schedule: string | null;
  logo_url: string | null;
  cover_url: string | null;
  is_main: boolean;
  status: string;
  created_at: string;
}

function rowToEmpresa(o: OrgRow, p: ProfileRow | null): Empresa {
  return {
    ...defaultEmpresa,
    nombreComercial: o.display_name ?? "",
    razonSocial: o.legal_name ?? "",
    cif: o.tax_id ?? "",
    logoUrl: o.logo_url ?? "",
    logoShape: "circle",
    coverUrl: o.cover_url ?? "",
    fundadaEn: p?.founded_year ? String(p.founded_year) : "",
    subtitle: "",
    tagline: p?.tagline ?? "",
    overview: p?.description ?? "",
    aboutOverview: p?.public_description ?? "",
    quote: p?.quote ?? "",
    quoteDescription: p?.quote_description ?? "",
    email: o.email ?? "",
    telefono: o.phone ?? "",
    horario: p?.schedule ?? "",
    sitioWeb: o.website ?? "",
    linkedin: p?.linkedin ?? "",
    instagram: p?.instagram ?? "",
    facebook: p?.facebook ?? "",
    youtube: p?.youtube ?? "",
    tiktok: p?.tiktok ?? "",
    zonasOperacion: [],
    especialidades: [],
    idiomasAtencion: p?.attention_languages ?? [],
    comisionNacionalDefault: p?.commission_national_default ?? 3,
    comisionInternacionalDefault: p?.commission_international_default ?? 5,
    plazoPagoComisionDias: p?.commission_payment_term_days ?? 30,
    certificaciones: [],
    licencias: (p?.licenses as Empresa["licencias"]) ?? undefined,
    marketingTopNacionalidades: (p?.marketing_top_nationalities as Empresa["marketingTopNacionalidades"]) ?? undefined,
    marketingTiposProducto: (p?.marketing_product_types as Empresa["marketingTiposProducto"]) ?? undefined,
    marketingFuentesClientes: (p?.marketing_client_sources as Empresa["marketingFuentesClientes"]) ?? undefined,
    marketingPortales: p?.marketing_portals ?? undefined,
    direccionFiscal: {
      pais: o.country ?? "",
      provincia: o.address_province ?? "",
      ciudad: o.address_city ?? "",
      direccion: o.address_street ?? "",
      codigoPostal: o.address_postal_code ?? "",
    },
    direccionFiscalCompleta: o.address_line ?? "",
    moneda: "EUR",
    idiomaDefault: "es",
    zonaHoraria: "Europe/Madrid",
    verificada: o.verified,
    verificadaEl: o.verified_at ?? "",
    googlePlaceId: p?.google_place_id ?? "",
    googleRating: p?.google_rating ?? 0,
    googleRatingsTotal: p?.google_ratings_total ?? 0,
    googleFetchedAt: p?.google_fetched_at ?? "",
    googleMapsUrl: p?.google_maps_url ?? "",
    onboardingCompleto: !!(o.legal_name && o.tax_id && o.address_city),
    updatedAt: 0,
  };
}

function rowToOficina(o: OfficeRow): Oficina {
  return {
    id: o.id,
    nombre: o.name,
    direccion: o.address ?? "",
    ciudad: o.city ?? "",
    provincia: o.province ?? "",
    telefono: o.phone ?? "",
    phonePrefix: o.phone_prefix ?? "+34",
    email: o.email ?? "",
    whatsapp: o.whatsapp ?? "",
    horario: o.schedule ?? "",
    logoUrl: o.logo_url ?? "",
    coverUrl: o.cover_url ?? "",
    esPrincipal: o.is_main,
    activa: o.status === "active",
    createdAt: Date.parse(o.created_at) || Date.now(),
  };
}

/* ─── Hidratación ─────────────────────────────────────────────────────── */

let hydratePromise: Promise<void> | null = null;
let lastHydratedAt = 0;
const REHYDRATE_THROTTLE_MS = 5_000;

/** Pulla orgs + profiles + offices y los escribe en localStorage scoped.
 *  Idempotente · throttled a 5s para evitar loops si algo dispara múltiples
 *  llamadas. Resuelve al terminar. */
export function hydrateFromSupabase(): Promise<void> {
  if (!isSupabaseConfigured) return Promise.resolve();
  if (hydratePromise) return hydratePromise;
  if (Date.now() - lastHydratedAt < REHYDRATE_THROTTLE_MS) return Promise.resolve();

  hydratePromise = (async () => {
    try {
      const [orgsRes, profilesRes, officesRes] = await Promise.all([
        supabase.from("organizations").select("*"),
        supabase.from("organization_profiles").select("*"),
        supabase.from("offices").select("*").eq("status", "active"),
      ]);

      if (orgsRes.error) {
        console.warn("[hydrate] organizations error:", orgsRes.error.message);
        return;
      }
      if (profilesRes.error) console.warn("[hydrate] profiles error:", profilesRes.error.message);
      if (officesRes.error) console.warn("[hydrate] offices error:", officesRes.error.message);

      const orgs = (orgsRes.data ?? []) as OrgRow[];
      const profiles = (profilesRes.data ?? []) as ProfileRow[];
      const offices = (officesRes.data ?? []) as OfficeRow[];

      const profileByOrg = new Map<string, ProfileRow>();
      for (const p of profiles) profileByOrg.set(p.organization_id, p);

      const officesByOrg = new Map<string, OfficeRow[]>();
      for (const o of offices) {
        const arr = officesByOrg.get(o.organization_id) ?? [];
        arr.push(o);
        officesByOrg.set(o.organization_id, arr);
      }

      /* Escribir cada org en su clave scoped. */
      for (const o of orgs) {
        const p = profileByOrg.get(o.id) ?? null;
        const empresa = rowToEmpresa(o, p);
        try {
          localStorage.setItem(
            `byvaro-empresa:${o.id}`,
            JSON.stringify({ ...empresa, updatedAt: Date.now() }),
          );
        } catch { /* QuotaExceeded · skip */ }
      }

      /* Oficinas · agrupadas por org. Si una org no tiene oficinas en DB,
       * NO escribimos array vacío para no pisar seeds locales. */
      for (const [orgId, list] of officesByOrg.entries()) {
        try {
          localStorage.setItem(
            `byvaro-oficinas:${orgId}`,
            JSON.stringify(list.map(rowToOficina)),
          );
        } catch { /* skip */ }
      }

      /* Compat · `developer-default` también escribe a la clave legacy
       * porque algunos helpers (`promotionRole.ts`, etc.) la leen. */
      const luxinmoOrg = orgs.find((o) => o.id === "developer-default");
      if (luxinmoOrg) {
        const empresa = rowToEmpresa(luxinmoOrg, profileByOrg.get("developer-default") ?? null);
        try {
          localStorage.setItem(
            "byvaro-empresa",
            JSON.stringify({ ...empresa, updatedAt: Date.now() }),
          );
        } catch { /* skip */ }
        const luxOffices = officesByOrg.get("developer-default");
        if (luxOffices) {
          try {
            localStorage.setItem("byvaro-oficinas", JSON.stringify(luxOffices.map(rowToOficina)));
          } catch { /* skip */ }
        }
      }

      window.dispatchEvent(new CustomEvent("byvaro:empresa-changed"));
      window.dispatchEvent(new CustomEvent("byvaro:oficinas-changed"));

      /* ─── collab_requests · split entre los 3 stores legacy ───
       *  RLS solo devuelve filas donde mi org participa. Mapeamos al
       *  shape mock para que los hooks `useOrgCollabRequests`,
       *  `useAllSolicitudes`, `useInvitaciones` los lean síncrono. */
      try {
        const { data: requests } = await supabase
          .from("collab_requests").select("*");
        if (requests) {
          const orgRequests: unknown[] = [];
          const promoRequests: unknown[] = [];
          const invitations: unknown[] = [];
          for (const r of requests as Array<{
            id: string; kind: string; status: string;
            from_organization_id: string; to_organization_id: string;
            promotion_id: string | null;
            message: string | null;
            metadata: Record<string, unknown> | null;
            created_at: string;
            responded_at: string | null;
          }>) {
            const status = r.status === "pending" ? "pendiente"
              : r.status === "accepted" ? "aceptada"
              : r.status === "rejected" ? "rechazada"
              : "rechazada";
            const createdAt = Date.parse(r.created_at);
            const decidedAt = r.responded_at ? Date.parse(r.responded_at) : undefined;
            const meta = r.metadata ?? {};
            if (r.kind === "org_request") {
              orgRequests.push({
                id: (meta.localId as string) ?? r.id,
                fromOrgId: r.from_organization_id,
                fromOrgName: meta.fromOrgName ?? "",
                fromOrgKind: meta.fromOrgKind ?? "agency",
                toOrgId: r.to_organization_id,
                toOrgName: meta.toOrgName ?? "",
                toOrgKind: meta.toOrgKind ?? "agency",
                message: r.message ?? undefined,
                status,
                createdAt,
                requestedBy: meta.requestedBy,
                decidedAt,
              });
            } else if (r.kind === "promotion_request") {
              promoRequests.push({
                id: (meta.localId as string) ?? r.id,
                agencyId: r.from_organization_id,
                promotionId: r.promotion_id,
                message: r.message ?? undefined,
                status,
                createdAt,
                requestedBy: meta.requestedBy,
                decidedAt,
                decidedBy: meta.decidedBy,
              });
            } else if (r.kind === "invitation") {
              invitations.push({
                id: (meta.localId as string) ?? r.id,
                token: meta.token ?? "",
                emailAgencia: meta.emailAgencia ?? "",
                nombreAgencia: meta.nombreAgencia ?? "",
                agencyId: r.to_organization_id,
                mensajePersonalizado: r.message ?? "",
                comisionOfrecida: meta.commissionPercentage ?? 0,
                idiomaEmail: meta.emailLanguage ?? "es",
                estado: r.status === "accepted" ? "aceptada"
                  : r.status === "rejected" ? "rechazada"
                  : r.status === "cancelled" ? "caducada"
                  : "pendiente",
                createdAt,
                expiraEn: r.responded_at ? Date.parse(r.responded_at) : (createdAt + 30 * 24 * 60 * 60 * 1000),
                respondidoEn: decidedAt,
                promocionId: r.promotion_id ?? undefined,
                promocionNombre: meta.promotionName ?? undefined,
                duracionMeses: meta.durationMonths,
                formaPago: meta.paymentPlan,
                datosRequeridos: meta.requiredFields,
                events: [],
              });
            }
          }
          try {
            localStorage.setItem("byvaro.org-collab-requests.v1", JSON.stringify(orgRequests));
            localStorage.setItem("byvaro.agency.collab-requests.v1", JSON.stringify(promoRequests));
            localStorage.setItem("byvaro-invitaciones", JSON.stringify(invitations));
          } catch { /* skip */ }
          window.dispatchEvent(new CustomEvent("byvaro:org-collab-requests-changed"));
          window.dispatchEvent(new CustomEvent("byvaro:collab-requests-changed"));
          window.dispatchEvent(new CustomEvent("byvaro:invitaciones-changed"));
        }
      } catch (e) {
        console.warn("[hydrate] collab_requests skipped:", e);
      }

      lastHydratedAt = Date.now();
    } finally {
      hydratePromise = null;
    }
  })();

  return hydratePromise;
}

/** Limpia las claves scoped al hacer logout · evita que la siguiente
 *  cuenta vea data del workspace anterior si la nueva tiene menos
 *  permisos. */
export function clearSupabaseCache() {
  if (typeof localStorage === "undefined") return;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (k.startsWith("byvaro-empresa:") || k.startsWith("byvaro-oficinas:")) {
      keysToRemove.push(k);
    }
  }
  for (const k of keysToRemove) localStorage.removeItem(k);
  /* También las legacy single-tenant. */
  localStorage.removeItem("byvaro-empresa");
  localStorage.removeItem("byvaro-oficinas");
}
