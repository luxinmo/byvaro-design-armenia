/**
 * Storage local de los "asignados" y "contactos relacionados" por
 * contacto. Mientras no haya backend, los cambios desde la ficha
 * (botones Asignar / Vincular del Resumen) se persisten aquí y
 * sustituyen los del mock al renderizar.
 *
 * También gestiona la lista de contactos "eliminados" del seed para
 * que desaparezcan del listado y la ficha 404.
 *
 * TODO(backend):
 *   PATCH  /api/contacts/:id { assignedUserIds: [...] }
 *   PATCH  /api/contacts/:id { relatedContactIds: [{id, relationType}] }
 *   DELETE /api/contacts/:id
 */

import type { ContactAssignedUser, ContactRelation } from "./types";

/* ── Asignados ── */

const ASSIGNED_KEY = (contactId: string) => `byvaro.contact.${contactId}.assigned.v1`;

export function loadAssignedOverride(contactId: string): ContactAssignedUser[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ASSIGNED_KEY(contactId));
    if (!raw) return null;
    return JSON.parse(raw) as ContactAssignedUser[];
  } catch { return null; }
}

export function saveAssignedOverride(contactId: string, users: ContactAssignedUser[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ASSIGNED_KEY(contactId), JSON.stringify(users));
  void (async () => {
    const { mergeContactMetadata } = await import("@/lib/contactMetadataSync");
    await mergeContactMetadata(contactId, { assignedUsers: users });
  })();
}

/* ── Relacionados ── */

const REL_KEY = (contactId: string) => `byvaro.contact.${contactId}.related.v1`;

export function loadRelationsOverride(contactId: string): ContactRelation[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(REL_KEY(contactId));
    if (!raw) return null;
    return JSON.parse(raw) as ContactRelation[];
  } catch { return null; }
}

export function saveRelationsOverride(contactId: string, rels: ContactRelation[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REL_KEY(contactId), JSON.stringify(rels));
  void (async () => {
    const { mergeContactMetadata } = await import("@/lib/contactMetadataSync");
    await mergeContactMetadata(contactId, { relations: rels });
  })();
}

/* ── Eliminados (seed + cualquiera) ── */

const DELETED_KEY = "byvaro.contacts.deleted.v1";

export function loadDeletedContactIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DELETED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch { return new Set(); }
}

export function markContactDeleted(id: string): void {
  if (typeof window === "undefined") return;
  const set = loadDeletedContactIds();
  set.add(id);
  window.localStorage.setItem(DELETED_KEY, JSON.stringify([...set]));
  /* Hard delete · contacts table (RLS por org). */
  void (async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import("@/lib/supabaseClient");
      if (!isSupabaseConfigured) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) console.warn("[contacts:delete]", error.message);
    } catch (e) { console.warn("[contacts:delete] skipped:", e); }
  })();
}

export function unmarkContactDeleted(id: string): void {
  if (typeof window === "undefined") return;
  const set = loadDeletedContactIds();
  set.delete(id);
  window.localStorage.setItem(DELETED_KEY, JSON.stringify([...set]));
}
