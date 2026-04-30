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
import { generatePublicRef } from "@/lib/publicRef";

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
    window.dispatchEvent(new CustomEvent("byvaro:contacts-changed"));
  }
  void syncContactToSupabase(contact);
}

export function removeCreatedContact(id: string): void {
  const all = loadCreatedContacts();
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(all.filter((c) => c.id !== id)));
    window.dispatchEvent(new CustomEvent("byvaro:contacts-changed"));
  }
  void deleteContactFromSupabase(id);
}

/** Bulk insert · usado por el flow de importación. Idempotente: si el
 *  contacto ya existe (mismo id) lo upsertea. */
export function bulkSaveContacts(contacts: Contact[]): void {
  const all = loadCreatedContacts();
  const existingIds = new Set(all.map((c) => c.id));
  const newOnes = contacts.filter((c) => !existingIds.has(c.id));
  const merged = [...newOnes, ...all];
  if (typeof window !== "undefined") {
    window.localStorage.setItem(KEY, JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent("byvaro:contacts-changed"));
  }
  /* Async write-through · uno a uno para evitar payload > 1MB. */
  void (async () => {
    for (const c of contacts) {
      await syncContactToSupabase(c);
    }
  })();
}

/* ─── Supabase write-through ───────────────────────────────────────── */

async function syncContactToSupabase(c: Contact) {
  try {
    const { supabase, isSupabaseConfigured } = await import("@/lib/supabaseClient");
    if (!isSupabaseConfigured) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    /* Resolver organization_id de la primera membership activa del user. */
    const { data: members } = await supabase.from("organization_members")
      .select("organization_id").eq("user_id", user.id).eq("status", "active")
      .order("created_at", { ascending: true }).limit(1);
    const orgId = members?.[0]?.organization_id;
    if (!orgId) return;

    const ce = c as unknown as Record<string, unknown>;
    const { error } = await supabase.from("contacts").upsert({
      id: c.id,
      organization_id: orgId,
      full_name: (ce.fullName as string) ?? (ce.name as string) ?? "Sin nombre",
      email: (ce.email as string) ?? null,
      phone: (ce.phone as string) ?? null,
      phone_prefix: (ce.phonePrefix as string) ?? null,
      nationality: (ce.nationality as string) ?? null,
      nationality_iso: (ce.nationalityIso as string) ?? null,
      dni: (ce.dni as string) ?? null,
      language: (ce.language as string) ?? null,
      status: (ce.status as string) ?? "lead",
      primary_source: (ce.primarySource as string) ?? null,
      latest_source: (ce.latestSource as string) ?? null,
      origins: (ce.origins as unknown) ?? null,
      public_ref: (ce.publicRef as string) ?? null,
      last_activity_at: (ce.lastActivityAt as string) ?? null,
      notes: (ce.notes as string) ?? null,
    });
    if (error) console.warn("[contacts:sync] upsert failed:", error.message);
  } catch (e) { console.warn("[contacts:sync] skipped:", e); }
}

async function deleteContactFromSupabase(id: string) {
  try {
    const { supabase, isSupabaseConfigured } = await import("@/lib/supabaseClient");
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.from("contacts").delete().eq("id", id);
    if (error) console.warn("[contacts:delete] failed:", error.message);
  } catch (e) { console.warn("[contacts:delete] skipped:", e); }
}

/**
 * Calcula la siguiente referencia disponible (`coXXXXXX`) escaneando
 * todas las publicRef existentes. Reemplaza al legacy `CON-NNNN`.
 *
 * Mantiene el nombre `nextContactReference` por compatibilidad con
 * call-sites · ahora delega en `generatePublicRef("contact", ...)`.
 */
export function nextContactReference(existingContacts: Contact[]): string {
  return generatePublicRef("contact", existingContacts);
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
