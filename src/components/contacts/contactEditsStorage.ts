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
  "nationality" | "nationalityIso" | "languages" | "notes" | "source" |
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
  /* Write-through · update columnas canónicas + merge metadata (resto). */
  void (async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import("@/lib/supabaseClient");
      if (!isSupabaseConfigured) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const e = edits as Record<string, unknown>;
      const update: Record<string, unknown> = {};
      if (typeof e.name === "string") update.full_name = e.name;
      if (typeof e.email === "string") update.email = e.email;
      if (typeof e.phone === "string") update.phone = e.phone;
      if (typeof e.nif === "string") update.dni = e.nif;
      if (typeof e.birthDate === "string") update.birth_date = e.birthDate || null;
      if (typeof e.nationality === "string") update.nationality = e.nationality;
      if (typeof e.nationalityIso === "string") update.nationality_iso = e.nationalityIso;
      if (typeof e.notes === "string") update.notes = e.notes;
      if (typeof e.source === "string") update.latest_source = e.source;
      if (Object.keys(update).length > 0) {
        const { error } = await supabase.from("contacts")
          .update(update).eq("id", contactId);
        if (error) console.warn("[contacts:edit]", error.message);
      }
      /* Resto en metadata (kind, companyName, tradeName, etc.). */
      const meta: Record<string, unknown> = {};
      for (const k of ["kind", "companyName", "tradeName", "companyTaxId",
        "address", "languages", "phones", "emailAddresses"] as const) {
        if (k in e) meta[k] = e[k];
      }
      if (Object.keys(meta).length > 0) {
        const { mergeContactMetadata } = await import("@/lib/contactMetadataSync");
        await mergeContactMetadata(contactId, meta);
      }
    } catch (err) { console.warn("[contacts:edit] skipped:", err); }
  })();
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
