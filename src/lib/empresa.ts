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
 */

import { useCallback, useEffect, useState } from "react";
import { agencies } from "@/data/agencies";
import { agencyToEmpresa } from "./agencyEmpresaAdapter";

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
   Persistencia low-level
   ═══════════════════════════════════════════════════════════════════ */
const EMPRESA_KEY = "byvaro-empresa";
const OFICINAS_KEY = "byvaro-oficinas";

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

export function loadEmpresa(): Empresa {
  try {
    const raw = localStorage.getItem(EMPRESA_KEY);
    if (!raw) return defaultEmpresa;
    return { ...defaultEmpresa, ...JSON.parse(raw) };
  } catch {
    return defaultEmpresa;
  }
}

function saveEmpresa(e: Empresa) {
  localStorage.setItem(EMPRESA_KEY, JSON.stringify({ ...e, updatedAt: Date.now() }));
  // Evento cross-hook para sincronizar múltiples useEmpresa en la misma pestaña
  window.dispatchEvent(new CustomEvent("byvaro:empresa-changed"));
}

function loadOficinas(): Oficina[] {
  try {
    const raw = localStorage.getItem(OFICINAS_KEY);
    if (raw === null) {
      // Primera carga · persiste el seed para que el usuario pueda
      // editar/borrar y los cambios se mantengan.
      localStorage.setItem(OFICINAS_KEY, JSON.stringify(OFICINAS_SEED));
      return [...OFICINAS_SEED];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Demo · si el array existe pero está vacío (sesión previa que aún
    // no había seedeado), re-seedeamos. Las promociones tienen
    // `puntosDeVentaIds` que apuntan a estas oficinas, y mostrar 0
    // oficinas en /empresa con esas promociones referenciándolas
    // dejaría "oficinas fantasma".
    if (parsed.length === 0) {
      localStorage.setItem(OFICINAS_KEY, JSON.stringify(OFICINAS_SEED));
      return [...OFICINAS_SEED];
    }
    return parsed as Oficina[];
  } catch {
    return [];
  }
}

function saveOficinas(list: Oficina[]) {
  localStorage.setItem(OFICINAS_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("byvaro:oficinas-changed"));
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
 *  el storage del workspace (`byvaro-empresa`) en vez de la lista
 *  de agencias · permite que la ruta `/promotor/:id` muestre la
 *  ficha pública del promotor en modo visitor. */
const DEVELOPER_TENANT_PREFIX = "developer-";

export function useEmpresa(tenantId?: string) {
  const isVisitor = !!tenantId;

  const loadTenant = useCallback((): Empresa => {
    if (!tenantId) return loadEmpresa();
    if (tenantId.startsWith(DEVELOPER_TENANT_PREFIX)) {
      // Promotor · datos vienen del workspace (mock single-tenant).
      return loadEmpresa();
    }
    // Resolución mock · cuando haya backend: fetch a /api/empresas/:id/public
    const agency = agencies.find((a) => a.id === tenantId);
    return agency ? agencyToEmpresa(agency) : defaultEmpresa;
  }, [tenantId]);

  const [empresa, setEmpresa] = useState<Empresa>(() => loadTenant());

  useEffect(() => {
    setEmpresa(loadTenant());
    if (isVisitor) return; // visitor no escucha cambios propios
    const onChange = () => setEmpresa(loadEmpresa());
    window.addEventListener("byvaro:empresa-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("byvaro:empresa-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [isVisitor, loadTenant]);

  const update = useCallback(<K extends keyof Empresa>(key: K, value: Empresa[K]) => {
    if (isVisitor) return; // visitor no edita datos ajenos
    setEmpresa(prev => {
      const next = { ...prev, [key]: value };
      next.onboardingCompleto = !!next.nombreComercial.trim() && !!next.razonSocial.trim() && !!next.cif.trim();
      saveEmpresa(next);
      return next;
    });
  }, [isVisitor]);

  const patch = useCallback((partial: Partial<Empresa>) => {
    if (isVisitor) return;
    setEmpresa(prev => {
      const next = { ...prev, ...partial };
      next.onboardingCompleto = !!next.nombreComercial.trim() && !!next.razonSocial.trim() && !!next.cif.trim();
      saveEmpresa(next);
      return next;
    });
  }, [isVisitor]);

  return { empresa, update, patch, isVisitor };
}

/* ═══════════════════════════════════════════════════════════════════
   useOficinas hook
   ═══════════════════════════════════════════════════════════════════ */
export function useOficinas() {
  const [oficinas, setOficinas] = useState<Oficina[]>(() => loadOficinas());

  useEffect(() => {
    const onChange = () => setOficinas(loadOficinas());
    window.addEventListener("byvaro:oficinas-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("byvaro:oficinas-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const persist = (list: Oficina[]) => {
    setOficinas(list);
    saveOficinas(list);
  };

  /** Crear nueva oficina. Si es la primera, se marca principal automáticamente. */
  const addOficina = useCallback((data: Partial<Oficina> & { nombre: string }) => {
    const list = loadOficinas();
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
  }, []);

  const updateOficina = useCallback((id: string, patch: Partial<Oficina>) => {
    const list = loadOficinas();
    let updated = list.map(o => (o.id === id ? { ...o, ...patch } : o));
    // Si el patch marca esta como principal, desmarca las demás
    if (patch.esPrincipal === true) {
      updated = updated.map(o => (o.id === id ? { ...o, esPrincipal: true } : { ...o, esPrincipal: false }));
    }
    persist(updated);
  }, []);

  const deleteOficina = useCallback((id: string) => {
    const list = loadOficinas();
    const oficinaBorrada = list.find(o => o.id === id);
    let next = list.filter(o => o.id !== id);
    // Si borramos la principal y quedan otras, la primera restante pasa a principal
    if (oficinaBorrada?.esPrincipal && next.length > 0) {
      next = next.map((o, i) => ({ ...o, esPrincipal: i === 0 }));
    }
    persist(next);
  }, []);

  const setPrincipal = useCallback((id: string) => {
    const list = loadOficinas();
    persist(list.map(o => ({ ...o, esPrincipal: o.id === id })));
  }, []);

  /** Devuelve la oficina principal, o undefined si no hay ninguna. */
  const oficinaPrincipal = oficinas.find(o => o.esPrincipal);

  return { oficinas, addOficina, updateOficina, deleteOficina, setPrincipal, oficinaPrincipal };
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
