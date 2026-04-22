/**
 * Storage local de comentarios internos del contacto.
 *
 * Los comentarios añadidos por el usuario se guardan en localStorage
 * por contacto (`byvaro.contact.<id>.comments.v1`). Al renderizar se
 * mergean con los del mock determinista (contactDetailMock).
 *
 * TODO(backend):
 *   GET    /api/contacts/:id/comments
 *   POST   /api/contacts/:id/comments       { content, attachments }
 *   PATCH  /api/contacts/:id/comments/:cid  { content }
 *   DELETE /api/contacts/:id/comments/:cid
 */

import type { ContactCommentEntry } from "./types";

const KEY = (contactId: string) => `byvaro.contact.${contactId}.comments.v1`;

export function loadAddedComments(contactId: string): ContactCommentEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY(contactId));
    if (!raw) return [];
    return JSON.parse(raw) as ContactCommentEntry[];
  } catch { return []; }
}

function saveAll(contactId: string, comments: ContactCommentEntry[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY(contactId), JSON.stringify(comments));
}

export function addComment(contactId: string, comment: ContactCommentEntry): void {
  const all = loadAddedComments(contactId);
  saveAll(contactId, [comment, ...all]);
}

export function updateComment(contactId: string, commentId: string, content: string): void {
  const all = loadAddedComments(contactId);
  saveAll(contactId, all.map((c) =>
    c.id === commentId ? { ...c, content } : c,
  ));
}

export function removeComment(contactId: string, commentId: string): void {
  const all = loadAddedComments(contactId);
  saveAll(contactId, all.filter((c) => c.id !== commentId));
}

/** Mergea comentarios mock + añadidos localmente. Más recientes arriba. */
export function loadAllComments(
  contactId: string,
  mockComments: ContactCommentEntry[],
): ContactCommentEntry[] {
  const local = loadAddedComments(contactId);
  return [...local, ...mockComments].sort((a, b) =>
    b.timestamp.localeCompare(a.timestamp),
  );
}
