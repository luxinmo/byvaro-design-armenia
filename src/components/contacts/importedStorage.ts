/**
 * Storage para contactos importados desde CSV/Excel.
 *
 * Mientras no haya backend, los contactos importados se guardan en
 * localStorage bajo `byvaro.contacts.imported.v1`. La página
 * /contactos los muestra junto a los MOCK_CONTACTS hardcodeados.
 *
 * En producción esto irá a `POST /api/contacts/bulk` y desaparece este
 * módulo.
 */

import type { Contact } from "./types";

const KEY = "byvaro.contacts.imported.v1";

/** Filas tal y como las construye el importador (campos del SystemField). */
export type ImportedRow = Record<string, string>;

export function loadImportedContacts(): Contact[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Contact[];
  } catch {
    return [];
  }
}

export function saveImportedContacts(arr: Contact[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(arr));
}

export function clearImportedContacts() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

/**
 * Convierte filas del importador en Contact[] válidos. Cada fila debe
 * tener al menos `email` (la garantía la da la validación de campos
 * requeridos del wizard). Genera id determinista a partir del email.
 */
export function rowsToContacts(rows: ImportedRow[]): Contact[] {
  const todayHuman = new Date().toLocaleDateString("es-ES", {
    day: "numeric", month: "short", year: "numeric",
  });
  return rows.map((r, i) => {
    const email = (r.email ?? "").trim().toLowerCase();
    /* En todo el sistema usamos un único campo "fullName". Si el CSV
     * traía firstName + lastName separados, el wizard del importer ya
     * los concatenó antes de llegar aquí. */
    const fullName = (r.fullName ?? "").trim() || email || `Contacto importado ${i + 1}`;
    const tagsRaw = (r.tags ?? "").split(/[;|,]/).map((t) => t.trim()).filter(Boolean);
    return {
      id: email ? `imp-${email}` : `imp-${Date.now()}-${i}`,
      reference: r.reference || undefined,
      name: fullName,
      nationality: r.nationality || undefined,
      email: email || undefined,
      phone: r.phone || undefined,
      tags: tagsRaw,
      source: r.source || "Imported",
      sourceType: "import",
      status: "pending",
      lastActivity: "Hoy",
      firstSeen: todayHuman,
      activeOpportunities: 0,
      hasUpcomingVisit: false,
      hasVisitDone: false,
      hasRecentWebActivity: false,
      totalRegistrations: 0,
      promotionsOfInterest: r.interest ? [r.interest] : [],
      assignedTo: [],
      languages: r.language ? [r.language] : undefined,
      notes: r.notes || undefined,
    };
  });
}

/** Adjunta un nuevo lote de filas a los importados existentes. */
export function appendImported(rows: ImportedRow[]): { added: number; total: number } {
  const existing = loadImportedContacts();
  const existingEmails = new Set(existing.map((c) => c.email).filter(Boolean));
  const newContacts = rowsToContacts(rows).filter(
    (c) => !c.email || !existingEmails.has(c.email),
  );
  const merged = [...existing, ...newContacts];
  saveImportedContacts(merged);
  return { added: newContacts.length, total: merged.length };
}
