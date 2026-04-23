/**
 * Seeds iniciales de invitaciones pendientes para que la tab
 * "Agencias" de la promoción muestre la sección "Invitaciones
 * pendientes" desde la primera carga.
 *
 * Idempotente · solo escribe si no hay ninguna invitación guardada
 * todavía (y deja intacto lo que el usuario haya creado por su
 * cuenta).
 */

import type { Invitacion } from "./invitaciones";

const STORAGE_KEY = "byvaro-invitaciones";
const SEED_DONE_KEY = "byvaro.invitaciones.seeded.v1";
const VALIDEZ_DIAS = 30;

function daysAgo(n: number) {
  return Date.now() - n * 24 * 60 * 60 * 1000;
}

const seeds: Invitacion[] = [
  {
    id: "inv-seed-1",
    token: "abc123xyz456demotoken01",
    emailAgencia: "hola@bristolinternational.com",
    nombreAgencia: "Bristol International",
    mensajePersonalizado: "Buscamos partner para clientes UK en Costa Blanca.",
    comisionOfrecida: 5,
    idiomaEmail: "en",
    estado: "pendiente",
    createdAt: daysAgo(7),
    expiraEn: daysAgo(7) + VALIDEZ_DIAS * 24 * 60 * 60 * 1000,
    promocionId: "dev-1",
    promocionNombre: "Villa Serena",
    duracionMeses: 12,
    datosRequeridos: ["Nombre completo", "Teléfono", "Nacionalidad"],
  },
  {
    id: "inv-seed-2",
    token: "xyz987abc654demotoken02",
    emailAgencia: "contact@urbanlivinggroup.com",
    nombreAgencia: "",
    mensajePersonalizado: "",
    comisionOfrecida: 4,
    idiomaEmail: "en",
    estado: "pendiente",
    createdAt: daysAgo(26),
    expiraEn: daysAgo(26) + VALIDEZ_DIAS * 24 * 60 * 60 * 1000,
    promocionId: "dev-1",
    promocionNombre: "Villa Serena",
    duracionMeses: 6,
    datosRequeridos: ["Nombre completo", "Email"],
  },
  {
    id: "inv-seed-3",
    token: "def456ghi789demotoken03",
    emailAgencia: "equipo@madridpremium.es",
    nombreAgencia: "Madrid Premium Sales",
    mensajePersonalizado: "Equipo boutique con 6 agentes senior.",
    comisionOfrecida: 5,
    idiomaEmail: "es",
    estado: "pendiente",
    createdAt: daysAgo(2),
    expiraEn: daysAgo(2) + VALIDEZ_DIAS * 24 * 60 * 60 * 1000,
    promocionId: "dev-2",
    promocionNombre: "Villas del Pinar",
    duracionMeses: 0,
    datosRequeridos: ["Nombre completo", "Teléfono", "Nacionalidad", "Email"],
  },
];

export function seedInvitacionesIfEmpty() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(SEED_DONE_KEY)) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const current: Invitacion[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(current) || current.length > 0) {
      /* Ya hay invitaciones del usuario — no tocamos. */
      localStorage.setItem(SEED_DONE_KEY, "1");
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeds));
    window.dispatchEvent(new CustomEvent("byvaro:invitaciones-changed"));
    localStorage.setItem(SEED_DONE_KEY, "1");
  } catch {
    /* storage bloqueado */
  }
}
