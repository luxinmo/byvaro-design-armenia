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
  const nowIso = new Date().toISOString();
  return rows.map((r, i) => {
    const email = (r.email ?? "").trim().toLowerCase();
    /* En todo el sistema usamos un único campo "fullName". Si el CSV
     * traía firstName + lastName separados, el wizard del importer ya
     * los concatenó antes de llegar aquí. */
    const fullName = (r.fullName ?? "").trim() || email || `Contacto importado ${i + 1}`;
    const tagsRaw = (r.tags ?? "").split(/[;|,]/).map((t) => t.trim()).filter(Boolean);
    /* Origen estructurado · entrada por importación. */
    const importOrigin = {
      source: "import" as const,
      label: r.source || "Imported",
      occurredAt: nowIso,
      refType: "import" as const,
    };
    return {
      id: email ? `imp-${email}` : `imp-${Date.now()}-${i}`,
      reference: r.reference || undefined,
      /* Sin publicRef estable en imports · se generará al persistir
         vía `saveCreatedContact` si el usuario los confirma. Aquí
         usamos un placeholder determinista basado en el email. */
      publicRef: `imp${String(i + 1).padStart(6, "0")}`,
      name: fullName,
      nationality: r.nationality || undefined,
      email: email || undefined,
      phone: r.phone || undefined,
      tags: tagsRaw,
      source: r.source || "Imported",
      sourceType: "import",
      primarySource: importOrigin,
      latestSource: importOrigin,
      origins: [importOrigin],
      lastActivityAt: nowIso,
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

/** Adjunta un nuevo lote de filas a los importados existentes.
 *  Optimistic local + write-through bulk a Supabase. */
export function appendImported(rows: ImportedRow[]): { added: number; total: number } {
  const existing = loadImportedContacts();
  const existingEmails = new Set(existing.map((c) => c.email).filter(Boolean));
  const newContacts = rowsToContacts(rows).filter(
    (c) => !c.email || !existingEmails.has(c.email),
  );
  const merged = [...existing, ...newContacts];
  saveImportedContacts(merged);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("byvaro:contacts-changed"));
  }
  /* Async bulk write-through. */
  void syncImportedContactsToSupabase(newContacts);
  return { added: newContacts.length, total: merged.length };
}

async function syncImportedContactsToSupabase(contacts: Contact[]) {
  if (contacts.length === 0) return;
  try {
    const { supabase, isSupabaseConfigured } = await import("@/lib/supabaseClient");
    if (!isSupabaseConfigured) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: members } = await supabase.from("organization_members")
      .select("organization_id").eq("user_id", user.id).eq("status", "active")
      .order("created_at", { ascending: true }).limit(1);
    const orgId = members?.[0]?.organization_id;
    if (!orgId) return;

    const rows = contacts.map((c) => {
      const ce = c as unknown as Record<string, unknown>;
      return {
        id: c.id,
        organization_id: orgId,
        full_name: (ce.name as string) ?? (ce.fullName as string) ?? "Sin nombre",
        email: (ce.email as string) ?? null,
        phone: (ce.phone as string) ?? null,
        nationality: (ce.nationality as string) ?? null,
        status: "lead",
        primary_source: "import",
        latest_source: "import",
        origins: ce.origins ?? null,
        public_ref: (ce.publicRef as string) ?? null,
        last_activity_at: (ce.lastActivityAt as string) ?? null,
        notes: (ce.notes as string) ?? null,
      };
    });
    /* Insert en chunks de 500 para no superar límites de payload. */
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabase.from("contacts").upsert(chunk, { onConflict: "id" });
      if (error) console.warn("[importContacts] chunk failed:", error.message);
    }
  } catch (e) { console.warn("[importContacts] skipped:", e); }
}
