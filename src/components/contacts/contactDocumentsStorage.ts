/**
 * Storage local de documentos subidos por el usuario en la ficha de
 * contacto. Mientras no haya backend, los archivos viven en
 * localStorage como `dataUrl` (cap 1.5 MB / archivo).
 *
 * Al renderizar el tab Documentos se mergean con los documentos mock
 * generados por `contactDetailMock`.
 *
 * TODO(backend): POST /api/contacts/:id/documents (multipart),
 *   GET /api/contacts/:id/documents, DELETE /api/documents/:id.
 *   El cliente no debería persistir el binario, solo metadatos +
 *   URL firmada de S3/equivalente.
 */

import type { ContactDocumentEntry } from "./types";

/** Documento subido localmente — añade `dataUrl` para poder descargarlo. */
export type StoredDocument = ContactDocumentEntry & {
  dataUrl: string;
};

const KEY = (contactId: string) => `byvaro.contact.${contactId}.documents.v1`;

export function loadAddedDocuments(contactId: string): StoredDocument[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY(contactId));
    if (!raw) return [];
    return JSON.parse(raw) as StoredDocument[];
  } catch { return []; }
}

function saveAll(contactId: string, docs: StoredDocument[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY(contactId), JSON.stringify(docs));
}

/* Sync metadata-only (sin dataUrl · el binario sigue en localStorage
 *  hasta que migremos a Supabase Storage). Los IDs + nombres + tipo
 *  cruzan así de un dispositivo a otro. TODO: subir binarios a bucket
 *  `contact-documents` cuando esté provisionado. */
function syncDocsMetadata(contactId: string, docs: StoredDocument[]) {
  void (async () => {
    const { mergeContactMetadata } = await import("@/lib/contactMetadataSync");
    const meta = docs.map(({ dataUrl: _drop, ...rest }) => rest);
    await mergeContactMetadata(contactId, { documents: meta });
  })();
}

export function addDocument(contactId: string, doc: StoredDocument): void {
  const existing = loadAddedDocuments(contactId);
  const next = [...existing, doc];
  saveAll(contactId, next);
  syncDocsMetadata(contactId, next);
}

export function removeDocument(contactId: string, docId: string): void {
  const existing = loadAddedDocuments(contactId);
  const next = existing.filter((d) => d.id !== docId);
  saveAll(contactId, next);
  syncDocsMetadata(contactId, next);
}
