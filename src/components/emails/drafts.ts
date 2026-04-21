/**
 * drafts.ts — Persistencia ligera de borradores en localStorage.
 *
 * Hoy sólo persistimos el último borrador del Compose flotante
 * (Nuevo mensaje). Los InlineReply no se persisten: viven dentro de
 * un email abierto y se pierden al cambiar de email (limitación
 * conocida, documentada en docs/screens/emails.md).
 *
 * Clave usada:
 *   byvaro.emailComposeDraft.v1 → { to, subject, body, savedAt }
 *
 * TODO(backend): mover a una tabla `drafts` y listarlos en un folder
 *  "Borradores" en el sidebar, recuperables desde cualquier sesión.
 */

export type PersistedComposeDraft = {
  to: string;
  subject: string;
  body: string;
  /** ISO timestamp del último save — útil para mostrar "hace X". */
  savedAt: string;
};

const KEY = "byvaro.emailComposeDraft.v1";

export function loadComposeDraft(): PersistedComposeDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedComposeDraft;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveComposeDraft(draft: { to: string; subject: string; body: string }) {
  if (typeof window === "undefined") return;
  const payload: PersistedComposeDraft = {
    to: draft.to,
    subject: draft.subject,
    body: draft.body,
    savedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(KEY, JSON.stringify(payload));
}

export function clearComposeDraft() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

/**
 * Helper para comprobar si un borrador tiene contenido real —
 * evita guardar borradores vacíos tras aplicar la firma por defecto.
 *
 * Considera "vacío" si `to`, `subject` y el body (tras quitar HTML
 * y la firma entre marcadores) no tienen nada tras trim.
 */
export function isDraftEmpty(draft: { to: string; subject: string; body: string }): boolean {
  const toEmpty = !draft.to.trim();
  const subjectEmpty = !draft.subject.trim();
  const bodyNoSignature = draft.body.replace(
    /<!--byvaro-signature-->[\s\S]*?<!--\/byvaro-signature-->/g,
    "",
  );
  const bodyText = bodyNoSignature.replace(/<[^>]*>/g, "").trim();
  return toEmpty && subjectEmpty && bodyText === "";
}
