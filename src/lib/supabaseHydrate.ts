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
import { memCache } from "./memCache";
import { defaultEmpresa, type Empresa, type Oficina } from "./empresa";

/* ─── Mappers · DB row → Empresa/Oficina shape ──────────────────────── */

interface OrgRow {
  id: string;
  public_ref: string | null;
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

interface PrivateData {
  tax_id: string | null;
  internal_email: string | null;
  internal_phone: string | null;
  fiscal_street: string | null;
  fiscal_postal_code: string | null;
  fiscal_address_line: string | null;
  commission_national_default: number | null;
  commission_international_default: number | null;
  commission_payment_term_days: number | null;
  marketing_top_nationalities: unknown;
  marketing_product_types: unknown;
  marketing_client_sources: unknown;
  marketing_portals: string[] | null;
  main_contact_name: string | null;
  main_contact_email: string | null;
  main_contact_phone: string | null;
  /* Escape hatch JSONB · alberga payloads que aún no justifican
   * columnas dedicadas. Hoy: `verification` (estado del KYC ·
   * representante, autorizados, docs, fechas). RLS scoped al
   * propio workspace · cross-tenant queries devuelven {}. */
  private_metadata: Record<string, unknown> | null;
}

function rowToEmpresa(o: OrgRow, p: ProfileRow | null, priv: PrivateData | null): Empresa {
  /* `priv` solo está poblado para el propio workspace (RLS). Para
   *  workspaces ajenos (directorio), tax_id / comisiones / marketing
   *  vuelven a sus defaults · NO se exponen datos sensibles. */
  /* Bundle de verificación · vive en `private_metadata.verification`.
   *  Sin esto, el form de "Verificar empresa" perdía estado en cada
   *  reload (memCache se sobrescribía al hidratar y la DB no tenía
   *  columna). Ahora persistimos el form completo (representante,
   *  autorizados, firma única, docs, estado, fecha de envío). */
  const verification = (priv?.private_metadata?.verification ?? null) as null | {
    estado?: Empresa["verificacionEstado"];
    representante?: Empresa["verificacionRepresentante"];
    firmaUnica?: boolean;
    autorizados?: Empresa["verificacionAutorizados"];
    docs?: Empresa["verificacionDocs"];
    solicitadaEl?: string;
  };
  return {
    ...defaultEmpresa,
    publicRef: o.public_ref ?? undefined,
    nombreComercial: o.display_name ?? "",
    razonSocial: o.legal_name ?? "",
    cif: priv?.tax_id ?? "",
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
    email: priv?.internal_email ?? "",
    telefono: priv?.internal_phone ?? "",
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
    comisionNacionalDefault: priv?.commission_national_default ?? 3,
    comisionInternacionalDefault: priv?.commission_international_default ?? 5,
    plazoPagoComisionDias: priv?.commission_payment_term_days ?? 30,
    certificaciones: [],
    licencias: (p?.licenses as Empresa["licencias"]) ?? undefined,
    marketingTopNacionalidades: (priv?.marketing_top_nationalities as Empresa["marketingTopNacionalidades"]) ?? undefined,
    marketingTiposProducto: (priv?.marketing_product_types as Empresa["marketingTiposProducto"]) ?? undefined,
    marketingFuentesClientes: (priv?.marketing_client_sources as Empresa["marketingFuentesClientes"]) ?? undefined,
    marketingPortales: priv?.marketing_portals ?? undefined,
    direccionFiscal: {
      pais: o.country ?? "",
      provincia: o.address_province ?? "",
      ciudad: o.address_city ?? "",
      direccion: priv?.fiscal_street ?? "",
      codigoPostal: priv?.fiscal_postal_code ?? "",
    },
    direccionFiscalCompleta: priv?.fiscal_address_line ?? "",
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
    onboardingCompleto: !!(o.legal_name && priv?.tax_id && o.address_city),
    /* Verificación KYC · solo aparece poblado en el propio workspace
     *  (RLS de organization_private_data). Cross-tenant queda undefined. */
    verificacionEstado: verification?.estado ?? "no-iniciada",
    verificacionRepresentante: verification?.representante,
    verificacionFirmaUnica: verification?.firmaUnica,
    verificacionAutorizados: verification?.autorizados,
    verificacionDocs: verification?.docs,
    verificacionSolicitadaEl: verification?.solicitadaEl,
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
      /* Datos públicos · cualquier authenticated puede leerlos · directorio. */
      const [orgsRes, profilesRes, officesRes, privateRes] = await Promise.all([
        supabase.from("organizations").select("*"),
        supabase.from("organization_profiles").select("*"),
        supabase.from("offices").select("*").eq("status", "active"),
        /* Datos PRIVADOS · RLS solo devuelve la fila del propio workspace.
         *  tax_id, comisiones default, marketing intel, contactos
         *  internos · NUNCA cross-tenant. */
        supabase.from("organization_private_data").select("*"),
      ]);

      if (orgsRes.error) {
        console.warn("[hydrate] organizations error:", orgsRes.error.message);
        return;
      }
      if (profilesRes.error) console.warn("[hydrate] profiles error:", profilesRes.error.message);
      if (officesRes.error) console.warn("[hydrate] offices error:", officesRes.error.message);
      if (privateRes.error) console.warn("[hydrate] private_data error:", privateRes.error.message);

      const orgs = (orgsRes.data ?? []) as OrgRow[];
      const profiles = (profilesRes.data ?? []) as ProfileRow[];
      const offices = (officesRes.data ?? []) as OfficeRow[];
      const privateData = (privateRes.data ?? []) as Array<PrivateData & {
        organization_id: string;
        internal_phone_prefix: string | null;
      }>;

      const profileByOrg = new Map<string, ProfileRow>();
      for (const p of profiles) profileByOrg.set(p.organization_id, p);
      const privateByOrg = new Map<string, typeof privateData[number]>();
      for (const pd of privateData) privateByOrg.set(pd.organization_id, pd);

      const officesByOrg = new Map<string, OfficeRow[]>();
      for (const o of offices) {
        const arr = officesByOrg.get(o.organization_id) ?? [];
        arr.push(o);
        officesByOrg.set(o.organization_id, arr);
      }

      /* Escribir cada org en su clave scoped. La PrivateData solo
       *  estará en `privateByOrg` para el propio workspace (RLS) ·
       *  el resto de orgs se hidratan SIN datos sensibles. */
      for (const o of orgs) {
        const p = profileByOrg.get(o.id) ?? null;
        const priv = privateByOrg.get(o.id) ?? null;
        const empresa = rowToEmpresa(o, p, priv);
        try {
          memCache.setItem(
            `byvaro-empresa:${o.id}`,
            JSON.stringify({ ...empresa, updatedAt: Date.now() }),
          );
        } catch { /* QuotaExceeded · skip */ }
      }

      /* Oficinas · agrupadas por org. Si una org no tiene oficinas en DB,
       * NO escribimos array vacío para no pisar seeds locales. */
      for (const [orgId, list] of officesByOrg.entries()) {
        try {
          memCache.setItem(
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
          memCache.setItem(
            "byvaro-empresa",
            JSON.stringify({ ...empresa, updatedAt: Date.now() }),
          );
        } catch { /* skip */ }
        const luxOffices = officesByOrg.get("developer-default");
        if (luxOffices) {
          try {
            memCache.setItem("byvaro-oficinas", JSON.stringify(luxOffices.map(rowToOficina)));
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
            memCache.setItem("byvaro.org-collab-requests.v1", JSON.stringify(orgRequests));
            memCache.setItem("byvaro.agency.collab-requests.v1", JSON.stringify(promoRequests));
            memCache.setItem("byvaro-invitaciones", JSON.stringify(invitations));
          } catch { /* skip */ }
          window.dispatchEvent(new CustomEvent("byvaro:org-collab-requests-changed"));
          window.dispatchEvent(new CustomEvent("byvaro:collab-requests-changed"));
          window.dispatchEvent(new CustomEvent("byvaro:invitaciones-changed"));
        }
      } catch (e) {
        console.warn("[hydrate] collab_requests skipped:", e);
      }

      /* ─── CRM core · registros, sales, calendar_events,
       *      notifications, user_favorites, contacts ───
       *  Pulamos los datos relevantes al workspace y los escribimos
       *  en las claves localStorage que ya consumen los stores
       *  legacy (`byvaro.registros.created.v1`, etc.). RLS filtra
       *  cross-tenant automáticamente. */
      try {
        const [registrosR, salesR, calR, notifR, favsR] = await Promise.all([
          supabase.from("registros").select("*"),
          supabase.from("sales").select("*, sale_payments(*)"),
          supabase.from("calendar_events").select("*"),
          supabase.from("notifications").select("*").order("created_at", { ascending: false }),
          supabase.from("user_favorites").select("*").eq("kind", "agency"),
        ]);

        if (registrosR.data) {
          /* Map columnas snake_case → shape mock TS. */
          type DBRegistro = {
            id: string; organization_id: string; agency_organization_id: string | null;
            promotion_id: string; estado: string; tipo: string; origen: string;
            cliente_nombre: string; cliente_email: string | null;
            cliente_telefono: string | null; cliente_nacionalidad: string | null;
            cliente_nationality_iso: string | null; cliente_dni: string | null;
            match_percentage: number | null; match_with: string | null;
            match_cliente: unknown; recommendation: string | null;
            visit_date: string | null; visit_time: string | null;
            visit_outcome: string | null; origin_registro_id: string | null;
            decided_at: string | null; decided_by_name: string | null;
            decided_by_role: string | null;
            notas: string | null; consent: boolean | null;
            response_time: string | null; public_ref: string | null;
            fecha: string;
          };
          const mapped = (registrosR.data as DBRegistro[]).map((r) => ({
            id: r.id,
            origen: r.origen,
            promotionId: r.promotion_id,
            agencyId: r.agency_organization_id ?? undefined,
            tipo: r.tipo,
            estado: r.estado,
            cliente: {
              nombre: r.cliente_nombre,
              email: r.cliente_email ?? undefined,
              telefono: r.cliente_telefono ?? undefined,
              nacionalidad: r.cliente_nacionalidad ?? undefined,
              nationalityIso: r.cliente_nationality_iso ?? undefined,
              dni: r.cliente_dni ?? undefined,
            },
            matchPercentage: r.match_percentage ?? 0,
            matchWith: r.match_with ?? undefined,
            matchCliente: r.match_cliente ?? undefined,
            recommendation: r.recommendation ?? undefined,
            visitDate: r.visit_date ?? undefined,
            visitTime: r.visit_time ?? undefined,
            visitOutcome: r.visit_outcome ?? undefined,
            originRegistroId: r.origin_registro_id ?? undefined,
            decidedAt: r.decided_at ?? undefined,
            decidedBy: r.decided_by_name ?? undefined,
            decidedByRole: r.decided_by_role ?? undefined,
            notas: r.notas ?? undefined,
            consent: r.consent ?? false,
            responseTime: r.response_time ?? undefined,
            publicRef: r.public_ref ?? undefined,
            fecha: r.fecha,
          }));
          try {
            memCache.setItem("byvaro.registros.created.v1", JSON.stringify(mapped));
          } catch { /* skip */ }
        }

        if (salesR.data) {
          type DBSale = {
            id: string; organization_id: string; agency_organization_id: string | null;
            promotion_id: string; registro_id: string | null;
            unit_id: string | null; unit_label: string | null;
            cliente_nombre: string; cliente_email: string | null;
            cliente_telefono: string | null; cliente_nacionalidad: string | null;
            agent_name: string | null; estado: string;
            fecha_reserva: string | null; fecha_contrato: string | null;
            fecha_escritura: string | null; fecha_caida: string | null;
            precio_reserva: number | null; precio_final: number | null;
            precio_listado: number | null; descuento_aplicado: number | null;
            comision_pct: number | null; comision_pagada: boolean | null;
            metodo_pago: string | null; siguiente_paso: string | null;
            siguiente_paso_fecha: string | null; nota: string | null;
            sale_payments: Array<{ fecha: string; concepto: string; importe: number }>;
          };
          const mapped = (salesR.data as DBSale[]).map((s) => ({
            id: s.id,
            registroId: s.registro_id ?? undefined,
            promotionId: s.promotion_id,
            unitId: s.unit_id ?? undefined,
            unitLabel: s.unit_label ?? undefined,
            clienteNombre: s.cliente_nombre,
            clienteEmail: s.cliente_email ?? undefined,
            clienteTelefono: s.cliente_telefono ?? undefined,
            clienteNacionalidad: s.cliente_nacionalidad ?? undefined,
            agencyId: s.agency_organization_id ?? undefined,
            agentName: s.agent_name ?? undefined,
            estado: s.estado,
            fechaReserva: s.fecha_reserva ?? undefined,
            fechaContrato: s.fecha_contrato ?? undefined,
            fechaEscritura: s.fecha_escritura ?? undefined,
            fechaCaida: s.fecha_caida ?? undefined,
            precioReserva: s.precio_reserva ?? undefined,
            precioFinal: s.precio_final ?? undefined,
            precioListado: s.precio_listado ?? undefined,
            descuentoAplicado: s.descuento_aplicado ?? undefined,
            comisionPct: s.comision_pct ?? undefined,
            comisionPagada: s.comision_pagada ?? false,
            metodoPago: s.metodo_pago ?? undefined,
            siguientePaso: s.siguiente_paso ?? undefined,
            siguientePasoFecha: s.siguiente_paso_fecha ?? undefined,
            nota: s.nota ?? undefined,
            pagos: (s.sale_payments ?? []).map((p) => ({
              fecha: p.fecha, concepto: p.concepto, importe: Number(p.importe),
            })),
          }));
          try {
            memCache.setItem("byvaro.sales.created.v1", JSON.stringify(mapped));
          } catch { /* skip */ }
        }

        if (calR.data) {
          type DBCal = {
            id: string; type: string; status: string;
            title: string; description: string | null;
            starts_at: string; ends_at: string;
            contact_id: string | null; registro_id: string | null;
            promotion_id: string | null; lead_id: string | null;
            location: string | null; assignee_user_id: string | null;
          };
          const mapped = (calR.data as DBCal[]).map((c) => ({
            id: c.id, type: c.type, status: c.status,
            title: c.title, description: c.description ?? undefined,
            startsAt: c.starts_at, endsAt: c.ends_at,
            start: c.starts_at, end: c.ends_at,
            contactId: c.contact_id ?? undefined,
            registroId: c.registro_id ?? undefined,
            promotionId: c.promotion_id ?? undefined,
            leadId: c.lead_id ?? undefined,
            location: c.location ?? undefined,
            assigneeUserId: c.assignee_user_id ?? undefined,
          }));
          try {
            memCache.setItem("byvaro.calendar.created.v1", JSON.stringify(mapped));
          } catch { /* skip */ }
        }

        if (notifR.data) {
          type DBNotif = {
            id: string; type: string; title: string; body: string | null;
            link: string | null; read_at: string | null;
            recipient_user_id: string | null; metadata: unknown;
            created_at: string; priority: string;
          };
          const mapped = (notifR.data as DBNotif[]).map((n) => ({
            id: n.id,
            recipientUserId: n.recipient_user_id ?? undefined,
            type: n.type,
            title: n.title,
            body: n.body ?? undefined,
            link: n.link ?? undefined,
            priority: n.priority,
            readAt: n.read_at ?? null,
            createdAt: Date.parse(n.created_at),
            metadata: n.metadata ?? undefined,
          }));
          try {
            memCache.setItem("byvaro.notifications.v1", JSON.stringify(mapped));
          } catch { /* skip */ }
        }

        if (favsR.data) {
          const ids = (favsR.data as Array<{ target_id: string }>).map((f) => f.target_id);
          try {
            memCache.setItem("byvaro-favoritos-agencias", JSON.stringify(ids));
          } catch { /* skip */ }
        }

        window.dispatchEvent(new CustomEvent("byvaro:registros-change"));
        window.dispatchEvent(new CustomEvent("byvaro:notifications-change"));
        window.dispatchEvent(new CustomEvent("byvaro:favoritos-agencias-changed"));
        window.dispatchEvent(new CustomEvent("byvaro:calendar-change"));
      } catch (e) {
        console.warn("[hydrate] CRM data skipped:", e);
      }

      /* ─── Inmuebles · contactos · promociones creadas ───
       *  Datos del workspace logueado · RLS los devuelve scoped. */
      try {
        const [inmR, contactsR, promosR] = await Promise.all([
          supabase.from("inmuebles").select("*"),
          supabase.from("contacts").select("*"),
          supabase.from("promotions").select("*").like("id", "prom-c-%"),
        ]);

        if (inmR.data) {
          /* Group por organization_id y escribir clave scoped del helper. */
          type DBInm = {
            id: string; organization_id: string; reference: string | null;
            type: string; operation: string; status: string;
            price: number | null; address: string | null; city: string | null;
            province: string | null; bedrooms: number | null; bathrooms: number | null;
            useful_area_m2: number | null; built_area_m2: number | null;
            branch_label: string | null; photos: unknown;
            description: string | null; tags: string[] | null;
            share_with_network: boolean; is_favorite: boolean | null;
            created_at: string; updated_at: string;
          };
          const byOrg: Record<string, unknown[]> = {};
          for (const r of inmR.data as DBInm[]) {
            const wsKey = r.organization_id === "developer-default"
              ? "developer-default"
              : `agency-${r.organization_id}`;
            (byOrg[wsKey] ??= []).push({
              id: r.id,
              organizationId: r.organization_id,
              reference: r.reference ?? "",
              type: r.type, operation: r.operation, status: r.status,
              price: r.price ?? 0,
              address: r.address ?? "", city: r.city ?? "", province: r.province ?? "",
              bedrooms: r.bedrooms ?? undefined,
              bathrooms: r.bathrooms ?? undefined,
              usefulArea: r.useful_area_m2 ?? undefined,
              builtArea: r.built_area_m2 ?? undefined,
              branchLabel: r.branch_label ?? undefined,
              photos: Array.isArray(r.photos) ? r.photos : [],
              description: r.description ?? "",
              tags: r.tags ?? [],
              shareWithNetwork: r.share_with_network,
              isFavorite: r.is_favorite ?? false,
              createdAt: r.created_at, updatedAt: r.updated_at,
            });
          }
          for (const [ws, list] of Object.entries(byOrg)) {
            try {
              memCache.setItem(`byvaro.inmuebles.v1:${ws}`, JSON.stringify(list));
            } catch { /* skip */ }
          }
          window.dispatchEvent(new CustomEvent("byvaro:inmuebles-changed"));
        }

        if (contactsR.data) {
          /* Mappea a shape Contact que usa el frontend. Mezclamos en
           *  byvaro.contacts.created.v1 (creados manualmente) · los
           *  importados se mantienen por separado en
           *  byvaro.contacts.imported.v1 si vienen del flow de import. */
          type DBContact = {
            id: string; full_name: string; email: string | null;
            phone: string | null; nationality: string | null;
            status: string; public_ref: string | null;
            primary_source: string | null; latest_source: string | null;
            origins: unknown; last_activity_at: string | null;
            notes: string | null; created_at: string;
          };
          const mapped = (contactsR.data as DBContact[]).map((c) => ({
            id: c.id,
            name: c.full_name,
            fullName: c.full_name,
            email: c.email ?? undefined,
            phone: c.phone ?? undefined,
            nationality: c.nationality ?? undefined,
            status: c.status,
            publicRef: c.public_ref ?? undefined,
            primarySource: c.primary_source ? { source: c.primary_source, label: c.primary_source } : undefined,
            latestSource: c.latest_source ? { source: c.latest_source, label: c.latest_source } : undefined,
            origins: c.origins ?? [],
            lastActivityAt: c.last_activity_at ?? undefined,
            notes: c.notes ?? undefined,
            tags: [],
            assignedTo: [],
            totalRegistrations: 0,
            activeOpportunities: 0,
            hasUpcomingVisit: false,
            hasVisitDone: false,
            hasRecentWebActivity: false,
            firstSeen: c.created_at,
            lastActivity: "",
          }));
          try {
            memCache.setItem("byvaro.contacts.created.v1", JSON.stringify(mapped));
          } catch { /* skip */ }
          window.dispatchEvent(new CustomEvent("byvaro:contacts-changed"));
        }

        if (promosR.data) {
          /* Promociones creadas desde el wizard (id `prom-c-*`).
           *  Las del seed estático no se rehidratan · siguen viviendo
           *  en `data/promotions.ts`. Cuando Phase 3 migre todo,
           *  cambiamos el filtro. */
          type DBPromo = {
            id: string; name: string; status: string;
            reference: string | null;
            owner_organization_id: string; owner_role: string;
            description: string | null; address: string | null;
            city: string | null; country: string | null;
            total_units: number; available_units: number;
            price_from: number | null; price_to: number | null;
            delivery: string | null; image_url: string | null;
            metadata: Record<string, unknown> | null;
          };
          const mapped = (promosR.data as DBPromo[]).map((p) => ({
            id: p.id,
            /* `code` · publicRef canónico para construir URLs
             *  bonitas (`/promociones/PR12345`). Sin esto, los
             *  helpers `promotionHref(p)` caen al id interno
             *  (`prom-c-1234...`) tras la hidratación. */
            code: p.reference ?? undefined,
            name: p.name,
            ownerOrganizationId: p.owner_organization_id,
            ownerRole: p.owner_role,
            status: p.status,
            description: p.description ?? "",
            address: p.address ?? "",
            city: p.city ?? "",
            country: p.country ?? "ES",
            totalUnits: p.total_units,
            availableUnits: p.available_units,
            priceFrom: p.price_from,
            priceTo: p.price_to,
            delivery: p.delivery ?? null,
            imageUrl: p.image_url ?? null,
            /* Metadata · CRÍTICO conservar el wizardSnapshot que el
             *  adapter `createdAsDev` lee para enriquecer la card
             *  (propertyTypes, buildingType, comisión, etc.). Si lo
             *  pisamos a {} la card de la promo recién hidratada
             *  pierde información. */
            metadata: p.metadata ?? {},
            createdAt: "",
          }));
          try {
            memCache.setItem("byvaro.promotions.created.v1", JSON.stringify(mapped));
          } catch { /* skip */ }
          window.dispatchEvent(new CustomEvent("byvaro:promotions-changed"));
        }
      } catch (e) {
        console.warn("[hydrate] inmuebles/contacts/promotions skipped:", e);
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
  for (let i = 0; i < memCache.length; i++) {
    const k = memCache.key(i);
    if (!k) continue;
    if (k.startsWith("byvaro-empresa:") || k.startsWith("byvaro-oficinas:")) {
      keysToRemove.push(k);
    }
  }
  for (const k of keysToRemove) memCache.removeItem(k);
  /* También las legacy single-tenant. */
  memCache.removeItem("byvaro-empresa");
  memCache.removeItem("byvaro-oficinas");
}
