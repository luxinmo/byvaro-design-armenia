/**
 * Cola temporal de adjuntos pendientes para el composer de email.
 *
 * Patrón: una pantalla (ej. ficha de contacto) selecciona unos
 * documentos y navega al composer (`/emails?compose=1&to=...`).
 * Antes de navegar, deja los adjuntos aquí. El composer al montar
 * (`GmailInterface`) los recoge y los limpia.
 *
 * Persistido en sessionStorage para que sobreviva la navegación pero
 * NO sobreviva un refresh de pestaña (intencionado — son adjuntos de
 * un flujo concreto, no datos del usuario).
 */

const KEY = "byvaro.email.pendingAttachments.v1";

export type PendingAttachment = {
  /** Nombre del archivo a mostrar. */
  name: string;
  /** Bytes del archivo. */
  size: number;
  /** dataURL completo (con MIME). */
  dataUrl: string;
};

export function setPendingAttachments(attachments: PendingAttachment[]): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(KEY, JSON.stringify(attachments));
}

export function consumePendingAttachments(): PendingAttachment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return [];
    window.sessionStorage.removeItem(KEY);
    return JSON.parse(raw) as PendingAttachment[];
  } catch { return []; }
}
