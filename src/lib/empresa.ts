/**
 * lib/empresa.ts · modelo, persistencia y hooks para los datos de la
 * empresa (tenant) y sus oficinas.
 *
 * Arquitectura:
 *   - Hoy → todo en localStorage (MVP sin backend).
 *   - Mañana → los hooks se reemplazan por fetch al backend
 *     multi-tenant. La firma pública (`useEmpresa`, `useOficinas`) no
 *     cambia, solo la implementación.
 *
 * Regla de negocio clave:
 *   - Una empresa (tenant) tiene N oficinas.
 *   - EXACTAMENTE una oficina debe ser `esPrincipal=true`. La UI lo
 *     garantiza a la hora de crear/editar/eliminar.
 *   - Si al eliminar la principal quedan otras, la primera restante
 *     se convierte en principal automáticamente.
 *
 * BACKEND ENDPOINT NAMING · paths en INGLÉS (ver
 * `docs/backend-dual-role-architecture.md §7`).
 * NOTE · Los TODO(backend) heredados que mencionan rutas en español
 * (`/api/empresas/...`, `/api/oficinas/...`) se mapean 1:1 a los
 * canónicos en inglés:
 *   · `/api/empresas/me`              → `GET/PATCH /organizations/me`
 *   · `/api/empresas/:id/public`      → `GET /organizations/:id/public`
 *   · `/api/empresas/:id/sensitive`   → `GET /organizations/:id/sensitive`
 *   · `/api/empresas/:id/oficinas`    → `GET /organizations/:id/offices`
 *   · `/api/empresas/me/oficinas`     → `GET /organizations/me/offices`
 *   · `POST /api/oficinas`            → `POST /organizations/me/offices`
 */

import { useCallback, useEffect, useState } from "react";
import { agencies } from "@/data/agencies";
import { promotores } from "@/data/promotores";
import { agencyToEmpresa } from "./agencyEmpresaAdapter";
import { useCurrentUser } from "./currentUser";

/* ═══════════════════════════════════════════════════════════════════
   Tipos
   ═══════════════════════════════════════════════════════════════════ */
export interface DireccionFiscal {
  pais: string;
  provincia: string;
  ciudad: string;
  direccion: string;
  codigoPostal: string;
}

export interface Empresa {
  /** Referencia pública INMUTABLE del tenant · `IDXXXXXX` aleatoria.
   *  Generada server-side por el trigger `gen_tenant_public_ref()` al
   *  crear la organización. NUNCA editable desde la UI · sirve como
   *  handle externo (invitaciones, marketplace, links cross-tenant).
   *  Ver `src/lib/tenantRef.ts` y la regla "Referencia pública del
   *  tenant" en CLAUDE.md. */
  publicRef?: string;
  // Identidad pública
  nombreComercial: string;
  razonSocial: string;
  cif: string;
  logoUrl: string;              // data: URL o URL externa (recortada · para mostrar en UI)
  logoShape: "circle" | "square"; // forma del logo en el hero
  coverUrl: string;             // portada grande del perfil público (recortada · para mostrar)
  /* Imagen ORIGINAL sin recortar · sirve solo al editor para que el
   * usuario pueda volver a entrar y ajustar el encuadre desde el
   * mismo material de partida. Si está vacío, el editor cae a
   * `logoUrl`/`coverUrl` (legacy o uploads externos). */
  logoSourceUrl?: string;
  coverSourceUrl?: string;
  /* Parámetros de recorte (zoom + drag) que se usaron al guardar.
   * Permite restaurar la vista del editor exactamente como la dejó
   * el usuario · `posX/posY` se interpretan en coords del contenedor
   * que el editor decida (escala se mantiene relativa). */
  logoCrop?: { zoom: number; posX: number; posY: number };
  coverCrop?: { zoom: number; posX: number; posY: number };
  colorCorporativo: string;     // hex "#AA2417"
  fundadaEn: string;            // "2012"
  subtitle: string;             // "{Town}, {Province}, {Country} · Founded in {year}"
  // Descripciones
  tagline: string;              // slogan corto bajo el nombre del hero ("Inversión segura en la Costa del Sol")
  overview: string;             // corta (Home → Overview card)
  aboutOverview: string;        // larga (About → Overview card)
  quote: string;                // lema
  quoteDescription: string;     // descripción del lema
  // Contacto
  email: string;
  telefono: string;
  horario: string;              // "L-V 9:30-14:00 / 16:30-19:00"
  sitioWeb: string;             // www.luxinmo.com
  linkedin: string;
  instagram: string;
  facebook: string;
  youtube: string;
  tiktok: string;
  // KPIs derivados del sistema · ver `useEmpresaStats()` en
  // `src/lib/empresaStats.ts`. NO se almacenan aquí — los conteos se
  // calculan en runtime desde los datasets reales (promociones,
  // agencias, sales, oficinas, team) para evitar desincronía.
  // Zonas y especialidades
  zonasOperacion: string[];     // ["Costa del Sol", "Costa Blanca"]
  especialidades: string[];     // ["Luxury", "Coastal", "Residencial"]
  idiomasAtencion: string[];    // ["es","en","de","fr"]
  // Términos de colaboración por defecto
  comisionNacionalDefault: number;      // 3
  comisionInternacionalDefault: number; // 5
  plazoPagoComisionDias: number;        // 30
  // Certificaciones (testimonios eliminados del producto · ver
  // ADR sobre simplificación de la ficha pública).
  certificaciones: { nombre: string; logoUrl?: string; desde?: string }[];
  /* Licencias inmobiliarias por región española / internacional ·
   * mismo shape canónico que las agencias (`LicenciaInmobiliaria`
   * en `src/lib/licenses.ts`). Una empresa puede tener varias si
   * opera en distintas CCAA con registros propios (Cataluña → AICAT,
   * Comunitat Valenciana → RAICV, País Vasco → EKAIA, etc.). */
  licencias?: import("./licenses").LicenciaInmobiliaria[];

  /* ─── Marketing y mercado ─────────────────────────────────────
   *  Datos que ayudan a las agencias a saber con quién están
   *  hablando · % de clientes por nacionalidad, tipo de producto que
   *  comercializan, fuentes de clientes. Se ven en la ficha pública
   *  + en el panel del colaborador.
   *
   *  Reglas:
   *    · Las distribuciones porcentuales suman 100 (validación UI).
   *      El último ítem "OTROS" se computa automáticamente como
   *      complemento (100 - suma del resto).
   *    · Tipos de producto son chips libres (villa-moderna,
   *      villa-lujo, obra-nueva, parcela, comercial, …) con un
   *      precio "desde" opcional por tipo.
   */
  marketingTopNacionalidades?: Array<{
    /** ISO 3166-1 alpha-2 · "OTROS" sentinel para el resto. */
    countryIso: string;
    pct: number; // 0-100 entero
  }>;
  marketingTiposProducto?: Array<{
    /** Slug libre · ver catálogo sugerido en `MARKETING_PRODUCT_TYPES`. */
    tipo: string;
    /** Precio mínimo desde el que comercializan ese tipo · EUR. */
    precioDesde?: number;
  }>;
  marketingFuentesClientes?: Array<{
    fuente: "portales" | "colab-nac" | "colab-int" | "referidos" | "cartera-propia";
    pct: number; // 0-100 entero
  }>;
  /** Portales y canales donde la empresa publica sus inmuebles ·
   *  array de ids del catálogo canónico `MARKETING_CHANNELS`
   *  (ver `src/lib/marketingChannels.ts`). Se reusa el mismo
   *  catálogo que los `marketingProhibitions` de las promociones
   *  para que matchear por id sea trivial cuando se conecten los
   *  conectores reales (Idealista API, Fotocasa API, etc.). */
  marketingPortales?: string[];
  // Fiscal
  direccionFiscal: DireccionFiscal;
  /* Dirección fiscal en una sola línea · futuro `formatted_address`
   * de Google Places Autocomplete. Cuando está rellena se prioriza
   * sobre los campos estructurados de `direccionFiscal` para el
   * subtitle del hero · es lo que el promotor edita realmente.
   * TODO(backend/ui): conectar `<input>` con Places Autocomplete y
   * además guardar los componentes estructurados (street, locality,
   * postalCode, country) en `direccionFiscal` para uso interno. */
  direccionFiscalCompleta?: string;
  // Preferencias
  moneda: "EUR" | "USD" | "GBP";
  idiomaDefault: "es" | "en" | "fr" | "de" | "pt" | "it" | "nl" | "ar";
  zonaHoraria: string;          // "Europe/Madrid"
  // Verificación
  verificada: boolean;
  verificadaEl: string;         // ISO date
  /* Solicitud de verificación · datos que el promotor envía al
   * superadmin de Byvaro para iniciar el KYC. Se persisten aquí solo
   * mientras dura el proceso · al verificar (`verificada=true`) se
   * conservan como histórico (auditoría: ¿quién pidió la verificación
   * y cuándo?). Ver `docs/screens/empresa.md §Verificación`. */
  verificacionEstado?:
    | "no-iniciada"        // estado por defecto
    | "datos-pendientes"   // form abierto, sin enviar
    | "firmafy-pendiente"  // datos enviados, esperando firma del representante
    | "revision-byvaro"    // firmado, esperando validación del superadmin
    | "verificada"         // aprobada (alineado con `verificada=true`)
    | "rechazada";         // superadmin rechaza · puede reintentar
  verificacionRepresentante?: {
    /** Id del miembro del workspace seleccionado · trazable contra
     *  `useWorkspaceMembers()`. Vacío si el promotor introduce los
     *  datos manualmente. */
    memberId?: string;
    nombreCompleto: string;
    email: string;
    telefono: string;
    phonePrefix?: string;          // "+34" por defecto
  };
  /* Firmantes en nombre de la empresa.
   *  - `firmaUnica = true` → solo el representante puede firmar
   *    documentos legales en nombre de la empresa.
   *  - `firmaUnica = false` → hay otras personas autorizadas
   *    listadas en `autorizados`. Al verificar, todas deben aparecer
   *    en los poderes notariales o ser apoderados solidariamente. La
   *    asignación de QUIÉN firma QUÉ documento se decide más adelante
   *    al lanzar cada flujo de Firmafy. */
  verificacionFirmaUnica?: boolean;
  verificacionAutorizados?: Array<{
    nombreCompleto: string;
    email: string;
    telefono: string;
    phonePrefix?: string;
  }>;
  /* Cada doc puede tener uno o varios ficheros (p.ej. DNI necesita
   * frontal + dorso, o el promotor sube PDF + foto del registro). En
   * backend cada ítem es un `fileId` referenciando un blob storage. */
  verificacionDocs?: {
    cifEmpresa?: Array<{ name: string; dataUrl: string; uploadedAt: string; mime?: string }>;
    identidadRepresentante?: Array<{ name: string; dataUrl: string; uploadedAt: string; mime?: string }>;
  };
  verificacionSolicitadaEl?: string; // ISO · cuándo el promotor pulsó "Solicitar"
  // Rating Google (Places API · refrescado semanal por el backend)
  googlePlaceId: string;        // id devuelto por Places API
  googleRating: number;         // 0-5 (0 = sin datos)
  googleRatingsTotal: number;   // nº de reseñas
  googleFetchedAt: string;      // ISO · último refresco (ToS: ≤30 días)
  googleMapsUrl: string;        // link a la ficha pública de Maps
  // Meta
  onboardingCompleto: boolean;  // true cuando nombreComercial + razonSocial + cif están
  updatedAt: number;            // timestamp ms
}

export interface Oficina {
  id: string;
  nombre: string;
  direccion: string;
  ciudad: string;
  provincia: string;
  telefono: string;
  phonePrefix: string;          // "+34"
  email: string;
  whatsapp: string;
  horario: string;              // free-text, ej "L-V 9:00-18:00"
  logoUrl: string;              // logo de oficina (opcional)
  coverUrl: string;             // portada de oficina (opcional)
  esPrincipal: boolean;
  activa: boolean;              // alias de "visible" en el perfil público
  createdAt: number;
}

/* ═══════════════════════════════════════════════════════════════════
   Defaults
   ═══════════════════════════════════════════════════════════════════ */
/* Default `defaultEmpresa` · TODOS los campos VACÍOS · sin demo data.
 *  El nombre real se rellena en el onboarding del workspace
 *  (`/empresa` o equivalente) · NUNCA hardcodear "Luxinmo" o similar
 *  · sería data de demo filtrándose a producción. Cuando un componente
 *  pinta el nombre y está vacío, debe mostrar un placeholder genérico
 *  ("Tu empresa") o un CTA al onboarding · NO un nombre fake. */
export const defaultEmpresa: Empresa = {
  nombreComercial: "",
  razonSocial: "",
  cif: "",
  logoUrl: "",
  coverUrl: "",
  logoShape: "circle",
  colorCorporativo: "#1D74E7",       // brand color Byvaro · neutro
  fundadaEn: "",
  subtitle: "",
  tagline: "",
  overview: "",
  aboutOverview: "",
  quote: "",
  quoteDescription: "",
  email: "",
  telefono: "",
  horario: "",
  sitioWeb: "",
  linkedin: "",
  instagram: "",
  facebook: "",
  youtube: "",
  tiktok: "",
  zonasOperacion: [],
  especialidades: [],
  idiomasAtencion: ["es"],
  comisionNacionalDefault: 3,
  comisionInternacionalDefault: 5,
  plazoPagoComisionDias: 30,
  certificaciones: [],
  direccionFiscal: { pais: "", provincia: "", ciudad: "", direccion: "", codigoPostal: "" },
  moneda: "EUR",
  idiomaDefault: "es",
  zonaHoraria: "Europe/Madrid",
  verificada: false,
  verificadaEl: "",
  // Seed de demo para que el card se vea poblado (hasta que el backend
  // conecte con Places API real). Un valor real tiene `googleFetchedAt`
  // reciente; aquí simulamos un refresco hace 2 días.
  googlePlaceId: "ChIJDEMO_PlaceId",
  googleRating: 4.7,
  googleRatingsTotal: 312,
  googleFetchedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  googleMapsUrl: "https://maps.app.goo.gl/DEMO",
  onboardingCompleto: false,
  updatedAt: 0,
};

/** Oficina semilla — cuando el usuario crea su primera promoción y aún
 * no tiene ninguna oficina, se crea una "Sede Principal" vacía que
 * luego puede rellenar. */
export function createOficinaSemilla(): Oficina {
  return {
    id: `ofc-${Date.now()}`,
    nombre: "Sede principal",
    direccion: "",
    ciudad: "",
    provincia: "",
    telefono: "",
    phonePrefix: "+34",
    email: "",
    whatsapp: "",
    horario: "L-V 9:00-18:00",
    logoUrl: "",
    coverUrl: "",
    esPrincipal: true,
    activa: true,
    createdAt: Date.now(),
  };
}

/* ═══════════════════════════════════════════════════════════════════
   Validación CIF (España)
   ═══════════════════════════════════════════════════════════════════ */
/** Validación básica de CIF español (formato: letra + 7 dígitos + control). */
export function isValidCifBasico(cif: string): boolean {
  const c = cif.trim().toUpperCase();
  if (!/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(c)) return false;
  // La validación completa del dígito de control (algoritmo Luhn
  // modificado) la omitimos en el MVP; el backend la reforzará.
  return true;
}

/* ═══════════════════════════════════════════════════════════════════
   Persistencia low-level · multi-tenant (mock)

   REGLA · cada org tiene su propio perfil editable. Las claves
   canónicas son scoped por orgId:
     · `byvaro-empresa:developer-default`
     · `byvaro-empresa:ag-1`, `byvaro-empresa:ag-2`, …
     · `byvaro-empresa:prom-1`, `byvaro-empresa:prom-2`, …
     · `byvaro-oficinas:<orgId>` (mismo patrón)

   Compatibilidad temporal · las claves antiguas single-tenant
   `byvaro-empresa` y `byvaro-oficinas` siguen leídas como FALLBACK
   solo para `developer-default`, para no perder los datos editados
   por el promotor antes de la migración. Una vez se escribe en la
   nueva clave scoped, ésta toma prioridad. Después de un par de
   releases podemos retirar el fallback legacy.

   TODO(backend): replace with `organizations.id` scoping vía RLS y
   endpoint `GET /api/empresas/:orgId/public`. Las claves localStorage
   desaparecen — el JWT lleva `organization_id` y el backend filtra.
   ═══════════════════════════════════════════════════════════════════ */
const EMPRESA_KEY_LEGACY  = "byvaro-empresa";
const OFICINAS_KEY_LEGACY = "byvaro-oficinas";

export const DEFAULT_DEVELOPER_TENANT_ID = "developer-default";

function empresaKeyFor(orgId: string): string {
  return `byvaro-empresa:${orgId}`;
}

function oficinasKeyFor(orgId: string): string {
  return `byvaro-oficinas:${orgId}`;
}

/* Seed inicial · `byvaro-oficinas` es la ÚNICA fuente de verdad de
 * oficinas del workspace. Toda promoción que muestre un punto de
 * venta lo hace referenciando un id de esta lista (campo
 * `Promotion.puntosDeVentaIds`). REGLA: nunca puede haber una oficina
 * que aparezca en una promoción y no exista aquí — sería una "oficina
 * fantasma".
 *
 * Se persiste al primer load si localStorage no tiene
 * `byvaro-oficinas` declarado. Si el usuario las borra, localStorage
 * queda como `[]` (set pero vacío) y NO se re-seedean. */
const OFICINAS_SEED: Oficina[] = [
  {
    id: "of-1",
    nombre: "Oficina Central Marbella",
    direccion: "Av. del Mar 15",
    ciudad: "Marbella",
    provincia: "Málaga",
    telefono: "+34 952 123 456",
    phonePrefix: "+34",
    email: "marbella@luxinmo.com",
    whatsapp: "+34 652 123 456",
    horario: "L-V 9:00-19:00 · S 10:00-14:00",
    logoUrl: "",
    coverUrl: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=400&fit=crop",
    esPrincipal: true,
    activa: true,
    createdAt: Date.parse("2024-01-15") || 0,
  },
  {
    id: "of-2",
    nombre: "Showroom Puerto Banús",
    direccion: "Puerto Banús, Local 8",
    ciudad: "Marbella",
    provincia: "Málaga",
    telefono: "+34 952 654 321",
    phonePrefix: "+34",
    email: "banus@luxinmo.com",
    whatsapp: "+34 652 654 321",
    horario: "L-V 10:00-20:00 · S-D 11:00-19:00",
    logoUrl: "",
    coverUrl: "https://images.unsplash.com/photo-1604328698692-f76ea9498e76?w=600&h=400&fit=crop",
    esPrincipal: false,
    activa: true,
    createdAt: Date.parse("2024-06-01") || 0,
  },
  {
    id: "of-3",
    nombre: "Sales Office Jávea",
    direccion: "Av. del Plá 12",
    ciudad: "Jávea",
    provincia: "Alicante",
    telefono: "+34 965 123 456",
    phonePrefix: "+34",
    email: "javea@luxinmo.com",
    whatsapp: "+34 665 123 456",
    horario: "L-V 9:30-18:30",
    logoUrl: "",
    coverUrl: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=800&h=500&fit=crop&q=80",
    esPrincipal: false,
    activa: true,
    createdAt: Date.parse("2025-03-10") || 0,
  },
  {
    id: "of-4",
    nombre: "Madrid HQ",
    direccion: "Paseo de la Castellana 89",
    ciudad: "Madrid",
    provincia: "Madrid",
    telefono: "+34 910 123 456",
    phonePrefix: "+34",
    email: "madrid@luxinmo.com",
    whatsapp: "",
    horario: "L-V 9:00-19:00",
    logoUrl: "",
    coverUrl: "https://images.unsplash.com/photo-1554469384-e58fac16e23a?w=600&h=400&fit=crop",
    esPrincipal: false,
    activa: true,
    createdAt: Date.parse("2024-09-01") || 0,
  },
  {
    id: "of-5",
    nombre: "Costa Blanca Office",
    direccion: "C/ del Sol 22",
    ciudad: "Torrevieja",
    provincia: "Alicante",
    telefono: "+34 966 100 200",
    phonePrefix: "+34",
    email: "torrevieja@luxinmo.com",
    whatsapp: "",
    horario: "L-V 10:00-18:00",
    logoUrl: "",
    coverUrl: "",
    esPrincipal: false,
    activa: true,
    createdAt: Date.parse("2025-01-15") || 0,
  },
  {
    id: "of-6",
    nombre: "Mijas Showroom",
    direccion: "Av. de Mijas 5",
    ciudad: "Mijas",
    provincia: "Málaga",
    telefono: "+34 952 555 010",
    phonePrefix: "+34",
    email: "mijas@luxinmo.com",
    whatsapp: "",
    horario: "L-V 9:30-19:00 · S 10:00-14:00",
    logoUrl: "",
    coverUrl: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=600&h=400&fit=crop",
    esPrincipal: false,
    activa: true,
    createdAt: Date.parse("2025-02-01") || 0,
  },
];

/** Lee el perfil empresa de un orgId concreto (mock).
 *
 *  Cadena de fallbacks (en orden):
 *    1. Clave scoped `byvaro-empresa:<orgId>` (canónica).
 *    2. Si `orgId === "developer-default"` y la scoped no existe →
 *       `byvaro-empresa` legacy (compat).
 *    3. Seed correspondiente al tipo de org:
 *         · `developer-*`  → `LUXINMO_PROFILE` fixture.
 *         · `ag-*`         → `agencyToEmpresa(agencies.find(id))`.
 *         · `prom-*`       → `agencyToEmpresa(promotores.find(id))`.
 *    4. `defaultEmpresa` · vacío.
 *
 *  TODO(backend): reemplazar por `GET /api/empresas/:orgId/public` ·
 *  RLS scoped al organization_id del JWT. */
export function loadEmpresaForOrg(orgId: string): Empresa {
  if (typeof window === "undefined") return defaultEmpresa;
  // 1. Scoped key (canónica)
  try {
    const raw = window.localStorage.getItem(empresaKeyFor(orgId));
    if (raw) return { ...defaultEmpresa, ...JSON.parse(raw) };
  } catch { /* fallthrough */ }
  // 2. Legacy fallback solo para developer-default (single-tenant histórico)
  if (orgId === DEFAULT_DEVELOPER_TENANT_ID) {
    try {
      const raw = window.localStorage.getItem(EMPRESA_KEY_LEGACY);
      if (raw) return { ...defaultEmpresa, ...JSON.parse(raw) };
    } catch { /* fallthrough */ }
  }
  // 3. Seed según tipo de org
  if (orgId.startsWith(DEVELOPER_TENANT_PREFIX)) {
    return getDeveloperProfile(orgId) ?? defaultEmpresa;
  }
  const promotor = promotores.find((p) => p.id === orgId);
  if (promotor) return agencyToEmpresa(promotor);
  const agency = agencies.find((a) => a.id === orgId);
  if (agency) return agencyToEmpresa(agency);
  // 4. Empty
  return defaultEmpresa;
}

/** Wrapper legacy · sigue pidiendo el perfil de `developer-default`.
 *  Helpers no-React (`promotionRole`, `publicationRequirements`,
 *  `empresaOnboarding`) lo siguen llamando. NO usar en componentes
 *  nuevos · usa `useEmpresa(tenantId)` o `loadEmpresaForOrg(orgId)`
 *  con el orgId resuelto del usuario. */
export function loadEmpresa(): Empresa {
  return loadEmpresaForOrg(DEFAULT_DEVELOPER_TENANT_ID);
}

function saveEmpresaForOrg(orgId: string, e: Empresa) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({ ...e, updatedAt: Date.now() });
  /* Optimistic local write · UI refresca inmediato. Si Supabase
   * rechaza (RLS, network), revertimos y re-emitimos. */
  window.localStorage.setItem(empresaKeyFor(orgId), payload);
  if (orgId === DEFAULT_DEVELOPER_TENANT_ID) {
    window.localStorage.setItem(EMPRESA_KEY_LEGACY, payload);
  }
  window.dispatchEvent(new CustomEvent("byvaro:empresa-changed", { detail: { orgId } }));

  /* Write-through a Supabase · async sin bloquear el caller.
   *  El cliente Supabase no se importa estáticamente para evitar
   *  acoplar este módulo (que también se usa server-side en scripts).
   *  Si Supabase no está configurado · no-op. */
  void (async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
      if (!isSupabaseConfigured) return;

      /* Map Empresa shape → split entre `organizations` (campos core)
       * y `organization_profiles` (resto). Mantenemos la convención
       * de que el cliente nunca toca `kind` ni `id` del row. */
      const orgPatch: Record<string, unknown> = {
        legal_name: e.razonSocial || null,
        display_name: e.nombreComercial || null,
        tax_id: e.cif || null,
        email: e.email || null,
        phone: e.telefono || null,
        website: e.sitioWeb || null,
        logo_url: e.logoUrl || null,
        cover_url: e.coverUrl || null,
        address_line: e.direccionFiscalCompleta || null,
        address_street: e.direccionFiscal?.direccion || null,
        address_postal_code: e.direccionFiscal?.codigoPostal || null,
        address_city: e.direccionFiscal?.ciudad || null,
        address_province: e.direccionFiscal?.provincia || null,
        country: e.direccionFiscal?.pais || null,
        verified: e.verificada,
        verified_at: e.verificadaEl || null,
      };
      const { error: orgErr } = await supabase
        .from("organizations").update(orgPatch).eq("id", orgId);
      if (orgErr) {
        console.warn("[saveEmpresa] organizations update failed:", orgErr.message);
      }

      const profilePatch: Record<string, unknown> = {
        organization_id: orgId,
        description: e.overview || null,
        public_description: e.aboutOverview || null,
        tagline: e.tagline || null,
        quote: e.quote || null,
        quote_description: e.quoteDescription || null,
        founded_year: e.fundadaEn ? parseInt(e.fundadaEn, 10) : null,
        license_number: e.licencias?.[0]?.numero ?? null,
        licenses: e.licencias ?? null,
        attention_languages: e.idiomasAtencion ?? null,
        commission_national_default: e.comisionNacionalDefault,
        commission_international_default: e.comisionInternacionalDefault,
        commission_payment_term_days: e.plazoPagoComisionDias,
        main_contact_email: e.email || null,
        main_contact_phone: e.telefono || null,
        schedule: e.horario || null,
        linkedin: e.linkedin || null,
        instagram: e.instagram || null,
        facebook: e.facebook || null,
        youtube: e.youtube || null,
        tiktok: e.tiktok || null,
        marketing_top_nationalities: e.marketingTopNacionalidades ?? null,
        marketing_product_types: e.marketingTiposProducto ?? null,
        marketing_client_sources: e.marketingFuentesClientes ?? null,
        marketing_portals: e.marketingPortales ?? null,
        google_place_id: e.googlePlaceId || null,
        google_rating: e.googleRating || null,
        google_ratings_total: e.googleRatingsTotal || null,
        google_fetched_at: e.googleFetchedAt || null,
        google_maps_url: e.googleMapsUrl || null,
      };
      const { error: profErr } = await supabase
        .from("organization_profiles").upsert(profilePatch, { onConflict: "organization_id" });
      if (profErr) {
        console.warn("[saveEmpresa] organization_profiles upsert failed:", profErr.message);
      }
    } catch (err) {
      console.warn("[saveEmpresa] supabase write skipped:", err);
    }
  })();
}

/** Lee oficinas de un orgId concreto (mock).
 *
 *  Cadena de fallbacks:
 *    1. Clave scoped `byvaro-oficinas:<orgId>`.
 *    2. Solo para `developer-default` · `byvaro-oficinas` legacy.
 *    3. Seed: `OFICINAS_SEED` (Luxinmo) o `visitorOfficesFor(orgId)`.
 *
 *  REGLA · nunca leas la clave legacy global desde una agencia o
 *  promotor externo · es la fuga histórica documentada en
 *  CLAUDE.md "Datos del workspace son por tenant".
 *
 *  TODO(backend): `GET /api/empresas/:orgId/oficinas` scoped por RLS. */
export function loadOficinasForOrg(orgId: string): Oficina[] {
  if (typeof window === "undefined") return [];
  // 1. Scoped key (canónica)
  try {
    const raw = window.localStorage.getItem(oficinasKeyFor(orgId));
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed as Oficina[];
      // Si scoped existe pero vacío para developer-default, re-seedea
      if (orgId === DEFAULT_DEVELOPER_TENANT_ID && Array.isArray(parsed) && parsed.length === 0) {
        window.localStorage.setItem(oficinasKeyFor(orgId), JSON.stringify(OFICINAS_SEED));
        return [...OFICINAS_SEED];
      }
      if (Array.isArray(parsed)) return parsed as Oficina[];
    }
  } catch { /* fallthrough */ }
  // 2. Legacy fallback solo para developer-default
  if (orgId === DEFAULT_DEVELOPER_TENANT_ID) {
    try {
      const raw = window.localStorage.getItem(OFICINAS_KEY_LEGACY);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Migrar a scoped key automáticamente · la siguiente lectura ya
          // pasa por la canónica.
          window.localStorage.setItem(oficinasKeyFor(orgId), JSON.stringify(parsed));
          return parsed as Oficina[];
        }
      }
    } catch { /* fallthrough */ }
    // Primera carga developer-default · persiste seed
    window.localStorage.setItem(oficinasKeyFor(orgId), JSON.stringify(OFICINAS_SEED));
    return [...OFICINAS_SEED];
  }
  // 3. Seed por tenant · agencias y promotores externos
  return visitorOfficesFor(orgId);
}

/** Wrapper legacy · oficinas de developer-default. Solo para módulos
 *  históricos · NO usar en código nuevo. */
function loadOficinas(): Oficina[] {
  return loadOficinasForOrg(DEFAULT_DEVELOPER_TENANT_ID);
}

function saveOficinasForOrg(orgId: string, list: Oficina[]) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify(list);
  /* Optimistic local write. */
  window.localStorage.setItem(oficinasKeyFor(orgId), payload);
  if (orgId === DEFAULT_DEVELOPER_TENANT_ID) {
    window.localStorage.setItem(OFICINAS_KEY_LEGACY, payload);
  }
  window.dispatchEvent(new CustomEvent("byvaro:oficinas-changed", { detail: { orgId } }));

  /* Write-through · sync diff con Supabase. Estrategia simple para
   *  Phase 2: borrar todas las oficinas del orgId y re-insertar.
   *  Cuando aterricen tests con cantidades grandes lo cambiamos a
   *  upsert + delete-de-las-que-no-aparecen. */
  void (async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
      if (!isSupabaseConfigured) return;

      /* Borramos las existentes y re-insertamos · evita inconsistencias
       *  cuando se borra una oficina del UI. */
      await supabase.from("offices").delete().eq("organization_id", orgId);
      if (list.length === 0) return;

      const rows = list.map((o) => ({
        id: o.id,
        organization_id: orgId,
        name: o.nombre,
        address: o.direccion || null,
        city: o.ciudad || null,
        province: o.provincia || null,
        phone: o.telefono || null,
        phone_prefix: o.phonePrefix || null,
        email: o.email || null,
        whatsapp: o.whatsapp || null,
        schedule: o.horario || null,
        logo_url: o.logoUrl || null,
        cover_url: o.coverUrl || null,
        is_main: o.esPrincipal,
        status: o.activa ? "active" : "archived",
      }));
      const { error } = await supabase.from("offices").insert(rows);
      if (error) {
        console.warn("[saveOficinas] insert failed:", error.message);
      }
    } catch (err) {
      console.warn("[saveOficinas] supabase write skipped:", err);
    }
  })();
}

/* ═══════════════════════════════════════════════════════════════════
   useEmpresa hook

   - Sin argumentos → carga la empresa del tenant logueado (localStorage).
     `update` y `patch` persisten.
   - Con `tenantId` → modo **visitor**: carga el perfil público de OTRO
     tenant (hoy mock desde `agencies.ts` vía `agencyToEmpresa`, en prod
     `GET /api/empresas/:id/public`). `update` y `patch` son NO-OP.

   Permite que `Empresa.tsx` sirva dos casos con un solo componente:
     · /empresa                → useEmpresa()                ← owner
     · /colaboradores/:id      → useEmpresa(id)               ← visitor
   ═══════════════════════════════════════════════════════════════════ */
/** Sentinel del promotor único en single-tenant mock · ver
 *  `src/lib/developerNavigation.ts`. Cuando `tenantId` arranca con
 *  este prefijo, `useEmpresa` resuelve los datos del promotor desde
 *  el fixture canónico `LUXINMO_PROFILE` (representa el equivalente
 *  a `GET /api/promotor/:id/profile` del backend real). NO se lee
 *  `byvaro-empresa` del navegador actual: en una agencia logueada
 *  ese key contiene los datos de la PROPIA agencia, no del promotor
 *  · ver REGLA DE ORO "Datos del workspace son por tenant" en
 *  CLAUDE.md y `docs/backend/domains/agency-developer-mirror.md`. */
const DEVELOPER_TENANT_PREFIX = "developer-";
/* `DEFAULT_DEVELOPER_TENANT_ID` · re-export en bloque de claves scoped
 * arriba en el archivo · NO redeclarar aquí. */

/* ═══════════════════════════════════════════════════════════════════
   Fixture canónico del promotor mock (Luxinmo)

   Single source of truth para el lado AGENCIA cuando visita
   `/promotor/:id` y `/promotor/:id/panel`. El fixture coincide en
   espíritu con lo que devolverá `GET /api/promotor/:id/profile`
   cuando aterrice multi-tenant · campos públicos del workspace
   developer. NO se lee `byvaro-empresa` porque ese key es local al
   navegador y representa al workspace logueado (la agencia).

   TODO(backend): borrar este fixture y resolver vía fetch real.
   ═══════════════════════════════════════════════════════════════════ */
export const LUXINMO_PROFILE: Empresa = {
  ...defaultEmpresa,
  publicRef: "ID384729",
  nombreComercial: "Luxinmo",
  razonSocial: "Luxinmo Inversiones SL",
  cif: "B98765432",
  logoUrl: "https://api.dicebear.com/9.x/shapes/svg?seed=luxinmo&backgroundColor=1d4ed8&size=120",
  logoShape: "circle",
  coverUrl: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1600&q=80",
  colorCorporativo: "#1D74E7",
  fundadaEn: "2012",
  subtitle: "Alicante, España · Fundada en 2012",
  tagline: "Inversión segura en la Costa Blanca",
  overview:
    "Promotor inmobiliario especializado en obra nueva premium en la Costa Blanca. Más de una década entregando proyectos a clientes nacionales e internacionales.",
  aboutOverview:
    "Desde 2012 hemos entregado más de 800 viviendas en Alicante, Valencia y Murcia. Trabajamos con un equipo internacional que atiende a compradores en cinco idiomas y colaboramos con agencias verificadas en toda Europa.",
  quote: "Construimos lo que firmaríamos.",
  quoteDescription:
    "Cada promoción se diseña pensando en cómo viviríamos nosotros allí · materiales nobles, ubicaciones estratégicas y atención post-venta de por vida.",
  email: "info@luxinmo.com",
  telefono: "+34 965 123 456",
  horario: "L-V 9:30-19:00",
  sitioWeb: "www.luxinmo.com",
  linkedin: "luxinmo",
  instagram: "luxinmo.es",
  facebook: "",
  youtube: "",
  tiktok: "",
  zonasOperacion: ["Costa Blanca", "Costa del Sol", "Comunitat Valenciana"],
  especialidades: ["Obra nueva premium", "Costa", "Inversores extranjeros"],
  idiomasAtencion: ["es", "en", "fr", "de", "ru"],
  comisionNacionalDefault: 3,
  comisionInternacionalDefault: 5,
  plazoPagoComisionDias: 30,
  certificaciones: [],
  licencias: [
    { tipo: "RAICV", numero: "RAICV-V-2345", verificada: true },
  ],
  marketingTopNacionalidades: [
    { countryIso: "ES", pct: 35 },
    { countryIso: "GB", pct: 20 },
    { countryIso: "DE", pct: 12 },
    { countryIso: "FR", pct: 10 },
    { countryIso: "BE", pct: 8 },
    { countryIso: "NL", pct: 8 },
    { countryIso: "OTROS", pct: 7 },
  ],
  marketingTiposProducto: [
    { tipo: "obra-nueva", precioDesde: 350000 },
    { tipo: "villa-lujo", precioDesde: 1500000 },
  ],
  marketingFuentesClientes: [
    { fuente: "portales", pct: 40 },
    { fuente: "colab-int", pct: 30 },
    { fuente: "colab-nac", pct: 15 },
    { fuente: "referidos", pct: 10 },
    { fuente: "cartera-propia", pct: 5 },
  ],
  marketingPortales: ["idealista", "fotocasa", "thinkspain", "kyero"],
  direccionFiscal: {
    pais: "España",
    provincia: "Alicante",
    ciudad: "Alicante",
    direccion: "Av. de la Estación 5",
    codigoPostal: "03001",
  },
  direccionFiscalCompleta: "Av. de la Estación 5, 03001 Alicante, España",
  moneda: "EUR",
  idiomaDefault: "es",
  zonaHoraria: "Europe/Madrid",
  verificada: true,
  verificadaEl: "2025-09-10",
  googlePlaceId: "ChIJ_LuxinmoDemoPlaceId",
  googleRating: 4.7,
  googleRatingsTotal: 312,
  googleFetchedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  googleMapsUrl: "https://maps.app.goo.gl/luxinmo",
  onboardingCompleto: true,
  updatedAt: 0,
};

/** Resuelve el perfil público del workspace developer mock · alias de
 *  `GET /api/promotor/:id/profile` cuando aterrice backend. Devuelve
 *  `undefined` si el id no matchea ningún developer conocido (caller
 *  debe tener un fallback). */
export function getDeveloperProfile(tenantId: string): Empresa | undefined {
  if (tenantId === DEFAULT_DEVELOPER_TENANT_ID) return LUXINMO_PROFILE;
  return undefined;
}

/** Resuelve el orgId desde un usuario actual sin importar de
 *  `currentUser.ts` para evitar ciclos · usa solo accountType+agencyId. */
function userOrgId(user: { accountType: string; agencyId?: string } | null | undefined): string {
  if (user?.accountType === "agency" && user.agencyId) return user.agencyId;
  return DEFAULT_DEVELOPER_TENANT_ID;
}

export function useEmpresa(tenantId?: string) {
  /* Resolvemos el orgId efectivo · si el caller pasa `tenantId`, ése
   *  manda. Si no, usamos el del workspace logueado. Esto permite que
   *  `/empresa` (sin tenantId) sea editable para el dueño y que
   *  `/colaboradores/:id` o `/promotor/:id` (con tenantId) sea
   *  visitor cuando NO coincide con mi org.
   *
   *  REGLA · `isVisitor` se decide al final comparando contra mi
   *  propio orgId · NUNCA por el mero hecho de que `tenantId` venga
   *  rellenado (un caller puede pasar mi propio orgId explícitamente
   *  · es own ficha igualmente). */
  const user = useCurrentUser();
  const myOrgId = userOrgId(user);
  const effectiveOrgId = tenantId ?? myOrgId;
  const isVisitor = effectiveOrgId !== myOrgId;

  const loadTenant = useCallback((): Empresa => {
    return loadEmpresaForOrg(effectiveOrgId);
  }, [effectiveOrgId]);

  const [empresa, setEmpresa] = useState<Empresa>(() => loadTenant());

  useEffect(() => {
    setEmpresa(loadTenant());
    /* Listener · refrescamos siempre · los eventos llevan el `orgId`
     *  del cambio en `detail`. Si el evento es de OTRO orgId, ignoramos.
     *  TODO(backend): listener desaparece · invalidate via SWR/TanStack
     *  Query al recibir webhook/SSE de cambio. */
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ orgId?: string }>).detail;
      if (detail?.orgId && detail.orgId !== effectiveOrgId) return;
      setEmpresa(loadTenant());
    };
    const onStorage = () => setEmpresa(loadTenant());
    window.addEventListener("byvaro:empresa-changed", onChange as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("byvaro:empresa-changed", onChange as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, [effectiveOrgId, loadTenant]);

  const update = useCallback(<K extends keyof Empresa>(key: K, value: Empresa[K]) => {
    if (isVisitor) return; // visitor no edita datos ajenos
    setEmpresa(prev => {
      const next = { ...prev, [key]: value };
      next.onboardingCompleto = !!next.nombreComercial.trim() && !!next.razonSocial.trim() && !!next.cif.trim();
      saveEmpresaForOrg(effectiveOrgId, next);
      return next;
    });
  }, [isVisitor, effectiveOrgId]);

  const patch = useCallback((partial: Partial<Empresa>) => {
    if (isVisitor) return;
    setEmpresa(prev => {
      const next = { ...prev, ...partial };
      next.onboardingCompleto = !!next.nombreComercial.trim() && !!next.razonSocial.trim() && !!next.cif.trim();
      saveEmpresaForOrg(effectiveOrgId, next);
      return next;
    });
  }, [isVisitor, effectiveOrgId]);

  return { empresa, update, patch, isVisitor };
}

/* ═══════════════════════════════════════════════════════════════════
   useOficinas hook · multi-tenant aware

   `byvaro-oficinas` localStorage es la fuente de verdad SOLO para el
   workspace logueado (que en mock single-tenant es el developer
   Luxinmo). Para visitor mode (ficha de OTRO tenant), las oficinas
   se resuelven desde el shape público del tenant:
     · `developer-*`   → seed Luxinmo (loadOficinas).
     · `prom-*`        → `promotores` seed (offices array mapeado).
     · cualquier otro  → `agencies` seed (offices array mapeado).
   Sin esto, una agencia o promotor externo mostraría las oficinas
   del workspace logueado · fuga grave reportada 2026-04-29.

   TODO(backend): GET /api/empresas/:id/oficinas público devuelve la
   lista del tenant scoped al organization_id del JWT.
   ═══════════════════════════════════════════════════════════════════ */
function visitorOfficesFor(tenantId: string): Oficina[] {
  const found = promotores.find((p) => p.id === tenantId)
    ?? agencies.find((a) => a.id === tenantId);
  if (!found?.offices) return [];
  return found.offices.map((o, idx) => ({
    id: `${tenantId}-of-${idx}`,
    nombre: `Oficina ${o.city}`,
    direccion: o.address ?? "",
    ciudad: o.city ?? "",
    provincia: "",
    telefono: "",
    phonePrefix: "+34",
    email: "",
    whatsapp: "",
    horario: "",
    logoUrl: "",
    coverUrl: "",
    esPrincipal: idx === 0,
    activa: true,
    createdAt: 0,
  }));
}

export function useOficinas(tenantId?: string) {
  /* Resolución del orgId · si el caller pasa un `tenantId` explícito,
   *  manda. Si no, usamos el orgId del workspace logueado. Las
   *  oficinas se persisten en clave scoped `byvaro-oficinas:<orgId>`
   *  · cada org edita las suyas sin contaminar a otras.
   *
   *  REGLA · `isVisitor` se decide comparando contra mi propio orgId,
   *  NO por el simple hecho de que `tenantId` venga rellenado. */
  const user = useCurrentUser();
  const myOrgId = userOrgId(user);
  const effectiveOrgId = tenantId ?? myOrgId;
  const isVisitor = effectiveOrgId !== myOrgId;

  const [oficinas, setOficinas] = useState<Oficina[]>(() =>
    loadOficinasForOrg(effectiveOrgId),
  );

  useEffect(() => {
    setOficinas(loadOficinasForOrg(effectiveOrgId));
    /* Listener · solo refrescamos si el evento es del mismo orgId.
     *  Visitor de otra org no necesita escuchar nuestros cambios
     *  pero igual lo dejamos por simplicidad · el predicado de orgId
     *  filtra. */
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ orgId?: string }>).detail;
      if (detail?.orgId && detail.orgId !== effectiveOrgId) return;
      setOficinas(loadOficinasForOrg(effectiveOrgId));
    };
    const onStorage = () => setOficinas(loadOficinasForOrg(effectiveOrgId));
    window.addEventListener("byvaro:oficinas-changed", onChange as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("byvaro:oficinas-changed", onChange as EventListener);
      window.removeEventListener("storage", onStorage);
    };
  }, [effectiveOrgId]);

  const persist = (list: Oficina[]) => {
    if (isVisitor) return; // visitor no edita oficinas ajenas
    setOficinas(list);
    saveOficinasForOrg(effectiveOrgId, list);
  };

  /** Crear nueva oficina. Si es la primera, se marca principal automáticamente. */
  const addOficina = useCallback((data: Partial<Oficina> & { nombre: string }) => {
    const list = loadOficinasForOrg(effectiveOrgId);
    const nuevaId = `ofc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const esPrincipal = list.length === 0 ? true : !!data.esPrincipal;
    const next: Oficina = {
      id: nuevaId,
      nombre: data.nombre,
      direccion: data.direccion ?? "",
      ciudad: data.ciudad ?? "",
      provincia: data.provincia ?? "",
      telefono: data.telefono ?? "",
      phonePrefix: data.phonePrefix ?? "+34",
      email: data.email ?? "",
      whatsapp: data.whatsapp ?? "",
      horario: data.horario ?? "L-V 9:00-18:00",
      logoUrl: data.logoUrl ?? "",
      coverUrl: data.coverUrl ?? "",
      esPrincipal,
      activa: data.activa ?? true,
      createdAt: Date.now(),
    };
    // Si el usuario la marca principal, desmarca las otras
    const normalizadas = esPrincipal ? list.map(o => ({ ...o, esPrincipal: false })) : list;
    persist([...normalizadas, next]);
    return next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveOrgId]);

  const updateOficina = useCallback((id: string, patch: Partial<Oficina>) => {
    const list = loadOficinasForOrg(effectiveOrgId);
    let updated = list.map(o => (o.id === id ? { ...o, ...patch } : o));
    // Si el patch marca esta como principal, desmarca las demás
    if (patch.esPrincipal === true) {
      updated = updated.map(o => (o.id === id ? { ...o, esPrincipal: true } : { ...o, esPrincipal: false }));
    }
    persist(updated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveOrgId]);

  const deleteOficina = useCallback((id: string) => {
    const list = loadOficinasForOrg(effectiveOrgId);
    const oficinaBorrada = list.find(o => o.id === id);
    let next = list.filter(o => o.id !== id);
    // Si borramos la principal y quedan otras, la primera restante pasa a principal
    if (oficinaBorrada?.esPrincipal && next.length > 0) {
      next = next.map((o, i) => ({ ...o, esPrincipal: i === 0 }));
    }
    persist(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveOrgId]);

  const setPrincipal = useCallback((id: string) => {
    const list = loadOficinasForOrg(effectiveOrgId);
    persist(list.map(o => ({ ...o, esPrincipal: o.id === id })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveOrgId]);

  /** Devuelve la oficina principal, o undefined si no hay ninguna. */
  const oficinaPrincipal = oficinas.find(o => o.esPrincipal);

  return { oficinas, addOficina, updateOficina, deleteOficina, setPrincipal, oficinaPrincipal, isVisitor };
}

/* ═══════════════════════════════════════════════════════════════════
   Utilidades de formateo
   ═══════════════════════════════════════════════════════════════════ */
export function formatMoneda(value: number, moneda: Empresa["moneda"] = "EUR"): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: moneda, maximumFractionDigits: 0 }).format(value);
}

export function getInitials(nombre: string): string {
  const words = nombre.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
