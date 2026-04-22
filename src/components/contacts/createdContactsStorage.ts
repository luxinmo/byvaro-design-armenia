/**
 * Storage local de contactos CREADOS desde la app.
 *
 * Mientras no haya backend, los contactos que el usuario crea desde
 * el listado (botón "Nuevo contacto") se guardan aquí y se mezclan
 * con los del seed (MOCK_CONTACTS) y los importados (importedStorage)
 * al renderizar.
 *
 * TODO(backend): POST /api/contacts → server genera id + reference.
 *   Este módulo se elimina cuando exista API real.
 */

import type { Contact } from "./types";

const KEY = "byvaro.contacts.created.v1";

export function loadCreatedContacts(): Contact[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Contact[];
  } catch { return []; }
}

export function saveCreatedContact(contact: Contact): void {
  const all = loadCreatedContacts();
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify([contact, ...all]));
  }
}

export function removeCreatedContact(id: string): void {
  const all = loadCreatedContacts();
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(all.filter((c) => c.id !== id)));
  }
}

/**
 * Calcula la siguiente referencia disponible tipo "CON-NNNN" mirando
 * todas las referencias existentes (seed + importados + creados).
 */
export function nextContactReference(existingContacts: Contact[]): string {
  let max = 0;
  for (const c of existingContacts) {
    const m = c.reference?.match(/^CON-(\d+)$/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return `CON-${String(max + 1).padStart(4, "0")}`;
}

/**
 * Genera un id determinista a partir del nombre (slugify) + sufijo
 * de tiempo para evitar colisiones.
 */
export function generateContactId(name: string): string {
  const slug = name.trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40) || "contacto";
  const suffix = Date.now().toString(36).slice(-4);
  return `${slug}-${suffix}`;
}
