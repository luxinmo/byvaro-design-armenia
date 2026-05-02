import { memCache } from "@/lib/memCache";
/**
 * Storage local de las tags asignadas a un contacto.
 *
 * Mientras no haya backend, las modificaciones de tags desde la ficha
 * de contacto se persisten en localStorage por contacto. Si existe
 * una entrada para `contactId`, se usa; si no, se cae al valor del
 * mock/seed.
 *
 * TODO(backend): PATCH /api/contacts/:id { tags: [...] } y leer la
 * fuente de la verdad del servidor.
 */

const KEY = (contactId: string) => `byvaro.contact.${contactId}.tags.v1`;

export function loadContactTags(contactId: string): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = memCache.getItem(KEY(contactId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === "string") : null;
  } catch { return null; }
}

export function saveContactTags(contactId: string, tags: string[]): void {
  if (typeof window === "undefined") return;
  memCache.setItem(KEY(contactId), JSON.stringify(tags));
  void (async () => {
    const { mergeContactMetadata } = await import("@/lib/contactMetadataSync");
    await mergeContactMetadata(contactId, { tags });
  })();
}

export function clearContactTags(contactId: string): void {
  if (typeof window === "undefined") return;
  memCache.removeItem(KEY(contactId));
  void (async () => {
    const { mergeContactMetadata } = await import("@/lib/contactMetadataSync");
    await mergeContactMetadata(contactId, { tags: [] });
  })();
}
