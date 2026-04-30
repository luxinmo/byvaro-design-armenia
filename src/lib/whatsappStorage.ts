/**
 * Storage de la configuración de WhatsApp del workspace.
 *
 * El workspace conecta UN proveedor (Business API o Web) y el resto
 * del equipo lo comparte. Cada agente tiene su identidad cuando envía
 * mensajes, pero el número/canal subyacente es único.
 *
 * Persistencia local mientras no haya backend (`byvaro.workspace.whatsapp.v1`).
 *
 * TODO(backend) — endpoints reales:
 *   POST /api/workspace/whatsapp/setup    { method, ... }   → crea setup
 *   GET  /api/workspace/whatsapp                            → estado actual
 *   POST /api/workspace/whatsapp/disconnect                 → reset
 *   GET  /api/contacts/:id/whatsapp/messages                → conversación
 *   POST /api/contacts/:id/whatsapp/messages { text }       → enviar (firma con currentUser)
 *
 * NOTA seguridad:
 *  - El "ver conversaciones de otros agentes" requiere que el rol del
 *    usuario tenga permiso `whatsapp.viewAll`. Por defecto solo admin.
 *  - El "enviar mensajes" solo permite firmar como el currentUser; el
 *    backend NUNCA debe aceptar `authorId` desde el cliente.
 */

export type WhatsAppMethod = "businessApi" | "web";

export type WhatsAppSetup = {
  method: WhatsAppMethod;
  /** ISO datetime de cuando se conectó. */
  connectedAt: string;
  /** Solo para Business API: número de empresa registrado. */
  businessNumber?: string;
  /** Nombre humano del proveedor / dispositivo (display). */
  displayName?: string;
};

const KEY = "byvaro.workspace.whatsapp.v1";

export function loadWhatsAppSetup(): WhatsAppSetup | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WhatsAppSetup;
    if (!parsed.method) return null;
    return parsed;
  } catch { return null; }
}

export function saveWhatsAppSetup(setup: WhatsAppSetup): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(setup));
  void (async () => {
    const { mergeOrgMetadata } = await import("./orgMetadataSync");
    await mergeOrgMetadata({ whatsappSetup: setup });
  })();
}

export function clearWhatsAppSetup(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  void (async () => {
    const { mergeOrgMetadata } = await import("./orgMetadataSync");
    await mergeOrgMetadata({ whatsappSetup: null });
  })();
}

export function isWhatsAppConnected(): boolean {
  return loadWhatsAppSetup() !== null;
}
