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
  logoUrl: string;              // data: URL o URL externa
  coverUrl: string;             // portada grande del perfil público
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
  // KPIs editables en Home
  aniosOperando: string;        // "13"
  oficinasCount: string;        // "01"
  agentesCount: string;         // "01"
  promocionesCount: string;     // "42"
  unidadesVendidas: string;     // "250"
  agenciasColaboradoras: string;// "47"
  ventasAnuales: string;        // "0"
  ingresosAnuales: string;      // "0"
  portfolio: string;            // "0"
  // Zonas y especialidades
  zonasOperacion: string[];     // ["Costa del Sol", "Costa Blanca"]
  especialidades: string[];     // ["Luxury", "Coastal", "Residencial"]
  idiomasAtencion: string[];    // ["es","en","de","fr"]
  // Términos de colaboración por defecto
  comisionNacionalDefault: number;      // 3
  comisionInternacionalDefault: number; // 5
  plazoPagoComisionDias: number;        // 30
  // Certificaciones y testimonios
  certificaciones: { nombre: string; logoUrl?: string; desde?: string }[];
  testimonios: { autor: string; empresa: string; texto: string; rating: number }[];
  // Fiscal
  direccionFiscal: DireccionFiscal;
  // Preferencias
  moneda: "EUR" | "USD" | "GBP";
  idiomaDefault: "es" | "en" | "fr" | "de" | "pt" | "it" | "nl" | "ar";
  zonaHoraria: string;          // "Europe/Madrid"
  // Verificación
  verificada: boolean;
  verificadaEl: string;         // ISO date
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
export const defaultEmpresa: Empresa = {
  nombreComercial: "",
  razonSocial: "",
  cif: "",
  logoUrl: "",
  coverUrl: "",
  colorCorporativo: "#AA2417",       // brand Byvaro por defecto
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
  aniosOperando: "0",
  oficinasCount: "0",
  agentesCount: "0",
  promocionesCount: "0",
  unidadesVendidas: "0",
  agenciasColaboradoras: "0",
  ventasAnuales: "0",
  ingresosAnuales: "0",
  portfolio: "0",
  zonasOperacion: [],
  especialidades: [],
  idiomasAtencion: ["es"],
  comisionNacionalDefault: 3,
  comisionInternacionalDefault: 5,
  plazoPagoComisionDias: 30,
  certificaciones: [],
  testimonios: [],
  direccionFiscal: { pais: "", provincia: "", ciudad: "", direccion: "", codigoPostal: "" },
  moneda: "EUR",
  idiomaDefault: "es",
  zonaHoraria: "Europe/Madrid",
  verificada: false,
  verificadaEl: "",
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

function loadEmpresa(): Empresa {
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
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
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
   ═══════════════════════════════════════════════════════════════════ */
export function useEmpresa() {
  const [empresa, setEmpresa] = useState<Empresa>(() => loadEmpresa());

  // Re-cargar al montar + suscribir a cambios
  useEffect(() => {
    const onChange = () => setEmpresa(loadEmpresa());
    window.addEventListener("byvaro:empresa-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("byvaro:empresa-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const update = useCallback(<K extends keyof Empresa>(key: K, value: Empresa[K]) => {
    setEmpresa(prev => {
      const next = { ...prev, [key]: value };
      next.onboardingCompleto = !!next.nombreComercial.trim() && !!next.razonSocial.trim() && !!next.cif.trim();
      saveEmpresa(next);
      return next;
    });
  }, []);

  const patch = useCallback((partial: Partial<Empresa>) => {
    setEmpresa(prev => {
      const next = { ...prev, ...partial };
      next.onboardingCompleto = !!next.nombreComercial.trim() && !!next.razonSocial.trim() && !!next.cif.trim();
      saveEmpresa(next);
      return next;
    });
  }, []);

  return { empresa, update, patch };
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
