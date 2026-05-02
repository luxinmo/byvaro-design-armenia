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
import { memCache } from "./memCache";

const STORAGE_KEY = "byvaro-invitaciones";
const SEED_DONE_KEY = "byvaro.invitaciones.seeded.v3";
const VALIDEZ_DIAS = 30;

function daysAgo(n: number) {
  return Date.now() - n * 24 * 60 * 60 * 1000;
}

const seeds: Invitacion[] = [];

export function seedInvitacionesIfEmpty() {
  if (typeof window === "undefined") return;
  if (memCache.getItem(SEED_DONE_KEY)) return;
  try {
    const raw = memCache.getItem(STORAGE_KEY);
    const current: Invitacion[] = raw ? JSON.parse(raw) : [];
    /* Merge idempotente · preservamos invitaciones del usuario y
       reemplazamos cualquiera con id "inv-seed-*" por la versión
       actualizada del seed. Así al bumpear SEED_DONE_KEY (ej. de v1 a
       v2) las nuevas invitaciones seeded aparecen sin perder trabajo
       del usuario. */
    const isSeed = (id: string) => id.startsWith("inv-seed-");
    const userInvs = Array.isArray(current) ? current.filter((i) => !isSeed(i.id)) : [];
    const merged = [...userInvs, ...seeds];
    memCache.setItem(STORAGE_KEY, JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent("byvaro:invitaciones-changed"));
    memCache.setItem(SEED_DONE_KEY, "1");
  } catch {
    /* storage bloqueado */
  }
}
