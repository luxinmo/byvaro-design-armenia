/**
 * Storage local de ediciones manuales de un contacto.
 *
 * Mientras no haya backend, cualquier cambio que el usuario haga sobre
 * un contacto desde la ficha (botón Editar) se persiste como
 * "overrides" en localStorage. Al cargar el ContactDetail, mergeamos
 * los overrides sobre los datos del seed/mock.
 *
 * TODO(backend): PATCH /api/contacts/:id { ...changes } y leer del
 * servidor. Este módulo desaparece o se vuelve cache cliente.
 */

import type { ContactDetail, ContactPhone, ContactEmailAddress } from "./types";

/** Sub-conjunto editable de ContactDetail. Hoy: campos del Resumen. */
export type ContactEdits = Partial<Pick<
  ContactDetail,
  "name" | "kind" | "companyName" | "tradeName" | "companyTaxId" |
  "nif" | "birthDate" | "address" |
  "nationality" | "flag" | "languages" | "notes" | "source" |
  "phone" | "email"
>> & {
  /** Multi-teléfonos del Resumen. Si está presente, sustituye el array
   *  generado por el mock. */
  phones?: ContactPhone[];
  /** Multi-emails del Resumen. Si está presente, sustituye el array
   *  generado por el mock. */
  emailAddresses?: ContactEmailAddress[];
};

const KEY = (contactId: string) => `byvaro.contact.${contactId}.edits.v1`;

export function loadContactEdits(contactId: string): ContactEdits | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY(contactId));
    if (!raw) return null;
    return JSON.parse(raw) as ContactEdits;
  } catch { return null; }
}

export function saveContactEdits(contactId: string, edits: ContactEdits): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY(contactId), JSON.stringify(edits));
}

export function clearContactEdits(contactId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY(contactId));
}

/** Aplica overrides sobre el detail original (no muta). */
export function applyContactEdits<T extends ContactDetail>(detail: T): T {
  const edits = loadContactEdits(detail.id);
  if (!edits) return detail;
  return { ...detail, ...edits };
}
