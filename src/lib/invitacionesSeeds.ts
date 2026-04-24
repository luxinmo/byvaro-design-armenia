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
const SEED_DONE_KEY = "byvaro.invitaciones.seeded.v3";
const VALIDEZ_DIAS = 30;

function daysAgo(n: number) {
  return Date.now() - n * 24 * 60 * 60 * 1000;
}

const ARMAN = { name: "Arman Yeghiazaryan", email: "arman@luxinmo.com" };
const LAURA_ADMIN = { name: "Laura Sánchez", email: "laura@luxinmo.com" };

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
    createdBy: ARMAN,
    events: [
      { id: "ev-seed-1-1", type: "created", at: daysAgo(7), by: ARMAN },
      { id: "ev-seed-1-2", type: "resent",  at: daysAgo(3), by: ARMAN },
    ],
  },
  {
    id: "inv-seed-2",
    token: "xyz987abc654demotoken02",
    emailAgencia: "contact@urbanlivinggroup.com",
    nombreAgencia: "",
    mensajePersonalizado: "",
    comisionOfrecida: 4,
    createdBy: ARMAN,
    idiomaEmail: "en",
    estado: "pendiente",
    createdAt: daysAgo(26),
    expiraEn: daysAgo(26) + VALIDEZ_DIAS * 24 * 60 * 60 * 1000,
    promocionId: "dev-1",
    promocionNombre: "Villa Serena",
    duracionMeses: 6,
    datosRequeridos: ["Nombre completo", "Email"],
    events: [
      { id: "ev-seed-2-1", type: "created", at: daysAgo(26), by: ARMAN },
    ],
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
    createdBy: LAURA_ADMIN,
    events: [
      { id: "ev-seed-3-1", type: "created", at: daysAgo(2), by: LAURA_ADMIN },
    ],
  },
  /* Dos invitaciones más para dev-1 · así ese detail tiene 4 pendientes
     en total (inv-seed-1 + inv-seed-2 ya existen) para testear cómo
     escala el dialog con varios items a la vez. */
  {
    id: "inv-seed-4",
    token: "mno345pqr678demotoken04",
    emailAgencia: "info@costasalesgroup.com",
    nombreAgencia: "Costa Sales Group",
    mensajePersonalizado: "Buscamos operar exclusivamente con promotores premium en la Costa del Sol.",
    comisionOfrecida: 5,
    idiomaEmail: "es",
    estado: "pendiente",
    createdAt: daysAgo(12),
    expiraEn: daysAgo(12) + VALIDEZ_DIAS * 24 * 60 * 60 * 1000,
    promocionId: "dev-1",
    promocionNombre: "Villa Serena",
    duracionMeses: 12,
    datosRequeridos: ["Nombre completo", "Teléfono"],
    createdBy: ARMAN,
    events: [
      { id: "ev-seed-4-1", type: "created", at: daysAgo(12), by: ARMAN },
      { id: "ev-seed-4-2", type: "email_changed", at: daysAgo(8), by: ARMAN,
        previousEmail: "info@costa-sales.com", newEmail: "info@costasalesgroup.com" },
      { id: "ev-seed-4-3", type: "resent", at: daysAgo(8) + 1000, by: ARMAN },
    ],
  },
  {
    id: "inv-seed-5",
    token: "stu012vwx345demotoken05",
    emailAgencia: "partners@nordicbroker.com",
    nombreAgencia: "",
    mensajePersonalizado: "",
    comisionOfrecida: 4,
    idiomaEmail: "en",
    estado: "pendiente",
    createdAt: daysAgo(29),
    expiraEn: daysAgo(29) + VALIDEZ_DIAS * 24 * 60 * 60 * 1000,
    promocionId: "dev-1",
    promocionNombre: "Villa Serena",
    duracionMeses: 6,
    datosRequeridos: ["Nombre completo", "Email"],
    createdBy: LAURA_ADMIN,
    events: [
      { id: "ev-seed-5-1", type: "created", at: daysAgo(29), by: LAURA_ADMIN },
    ],
  },
];

export function seedInvitacionesIfEmpty() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(SEED_DONE_KEY)) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const current: Invitacion[] = raw ? JSON.parse(raw) : [];
    /* Merge idempotente · preservamos invitaciones del usuario y
       reemplazamos cualquiera con id "inv-seed-*" por la versión
       actualizada del seed. Así al bumpear SEED_DONE_KEY (ej. de v1 a
       v2) las nuevas invitaciones seeded aparecen sin perder trabajo
       del usuario. */
    const isSeed = (id: string) => id.startsWith("inv-seed-");
    const userInvs = Array.isArray(current) ? current.filter((i) => !isSeed(i.id)) : [];
    const merged = [...userInvs, ...seeds];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent("byvaro:invitaciones-changed"));
    localStorage.setItem(SEED_DONE_KEY, "1");
  } catch {
    /* storage bloqueado */
  }
}
