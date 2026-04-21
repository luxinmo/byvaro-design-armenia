/**
 * signatures.ts — Almacenamiento + helpers para firmas de email.
 *
 * Las firmas son strings HTML que el usuario edita en el SignatureManager
 * (modo Visual o HTML). Se persisten en localStorage bajo:
 *
 *   byvaro.emailSignatures.v1           → array completo de firmas
 *   byvaro.emailSignatures.defaultId.v1 → id de la firma por defecto global
 *
 * La firma se inyecta en el body del draft (Reply / Forward / Nuevo)
 * entre marcadores HTML invisibles:
 *
 *   <!--byvaro-signature--> … <!--/byvaro-signature-->
 *
 * Esto permite reemplazarla (signature picker del InlineReply) sin tocar
 * el resto del cuerpo ni la cita.
 *
 * Portado desde figgy-friend-forge · ARCHITECTURE_EMAILS.md
 * Ver docs/screens/emails.md para el contrato completo.
 */

export type EmailSignature = {
  id: string;
  name: string;
  html: string;
  isDefault?: boolean;
  /** Si está bound a una cuenta concreta; si null/undefined, es global. */
  accountId?: string | null;
};

const STORAGE_KEY = "byvaro.emailSignatures.v1";
const DEFAULT_ID_KEY = "byvaro.emailSignatures.defaultId.v1";

export const SIGNATURE_MARKER_OPEN = "<!--byvaro-signature-->";
export const SIGNATURE_MARKER_CLOSE = "<!--/byvaro-signature-->";

const DEFAULT_SIGNATURES: EmailSignature[] = [
  {
    id: "sig-default",
    name: "Default",
    isDefault: true,
    html: `<p style="margin:0;font-family:Inter,Arial,sans-serif;color:#0f172a"><strong>Tu nombre</strong></p>
<p style="margin:0;font-family:Inter,Arial,sans-serif;color:#475569;font-size:13px">Responsable de ventas · Byvaro</p>
<p style="margin:0;font-family:Inter,Arial,sans-serif;color:#475569;font-size:13px">📞 +34 600 000 000 · 🌐 byvaro.com</p>`,
  },
  {
    id: "sig-short",
    name: "Corta",
    html: `<p style="margin:0;font-family:Inter,Arial,sans-serif;color:#475569;font-size:13px">— Enviado desde Byvaro</p>`,
  },
];

/* ══════ Persistencia ══════ */

export function loadSignatures(): EmailSignature[] {
  if (typeof window === "undefined") return DEFAULT_SIGNATURES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SIGNATURES;
    const parsed = JSON.parse(raw) as EmailSignature[];
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_SIGNATURES;
  } catch {
    return DEFAULT_SIGNATURES;
  }
}

export function saveSignatures(list: EmailSignature[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function getDefaultSignatureId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(DEFAULT_ID_KEY);
}

export function setDefaultSignatureId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem(DEFAULT_ID_KEY, id);
  else window.localStorage.removeItem(DEFAULT_ID_KEY);
}

/**
 * Resuelve la firma por defecto efectiva en este orden:
 *   1. Firma marcada como default y bound a la cuenta dada
 *   2. Id global guardado en localStorage
 *   3. Primera firma con `isDefault: true`
 *   4. Primera firma de la lista (o null si está vacía)
 */
export function getDefaultSignature(
  signatures: EmailSignature[],
  accountId?: string,
): EmailSignature | null {
  if (accountId) {
    const accDef = signatures.find((s) => s.accountId === accountId && s.isDefault);
    if (accDef) return accDef;
  }
  const storedId = getDefaultSignatureId();
  if (storedId) {
    const found = signatures.find((s) => s.id === storedId);
    if (found) return found;
  }
  const marked = signatures.find((s) => s.isDefault);
  if (marked) return marked;
  return signatures[0] ?? null;
}

/* ══════ Manipulación HTML ══════ */

/** Envuelve el HTML de la firma con los marcadores para poder detectarla luego. */
export function wrapSignature(html: string): string {
  return `${SIGNATURE_MARKER_OPEN}<div class="byvaro-signature" style="margin-top:24px;color:#475569">${html}</div>${SIGNATURE_MARKER_CLOSE}`;
}

/**
 * Añade (o reemplaza si ya existe) la firma dentro de un HTML de body.
 *
 * Siempre garantizamos que el body empiece con un bloque editable
 * `<div><br></div>` cuando no hay contenido previo — así el caret
 * del contentEditable tiene un home natural al inicio y no cae dentro
 * de la firma (bug común al inyectar firmas HTML en un editor vacío).
 */
export function applySignature(bodyHtml: string, signatureHtml: string | null): string {
  const stripped = stripSignature(bodyHtml);
  if (!signatureHtml) return stripped;
  const sep =
    stripped.endsWith("<br>") || stripped.endsWith("</p>") || stripped === "" ? "" : "<br>";
  /* Si el body está vacío, prefijar con un div editable para que el
   * caret al focus() del editor no caiga dentro del bloque de firma. */
  const leading = stripped === "" ? "<div><br></div>" : "";
  return `${leading}${stripped}${sep}<br>${wrapSignature(signatureHtml)}`;
}

/** Elimina el bloque entre marcadores (si existe). */
export function stripSignature(bodyHtml: string): string {
  const re = new RegExp(
    `${SIGNATURE_MARKER_OPEN}[\\s\\S]*?${SIGNATURE_MARKER_CLOSE}`,
    "g",
  );
  return bodyHtml
    .replace(re, "")
    .replace(/(<br\s*\/?>)+$/i, "")
    .trimEnd();
}

/** Escape básico para evitar XSS al serializar texto plano. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Convierte un texto plano (con saltos de línea) en HTML seguro. */
export function textToHtml(text: string): string {
  if (!text) return "";
  return escapeHtml(text)
    .split("\n")
    .map((line) => (line.trim() === "" ? "<br>" : `<div>${line}</div>`))
    .join("");
}

/**
 * Construye el bloque citado estilo Gmail para Reply / Forward.
 * El estilo queda inline porque este HTML viaja al destinatario.
 */
export function buildQuoteHtml(args: {
  fromName: string;
  fromEmail: string;
  date: string;
  bodyText: string;
}): string {
  const { fromName, fromEmail, date, bodyText } = args;
  const inner = textToHtml(bodyText);
  return `<br><div class="byvaro-quote" style="border-left:2px solid #cbd5e1;padding-left:12px;color:#64748b;margin-top:12px">
<div style="font-size:12px;margin-bottom:8px">El ${escapeHtml(date)}, ${escapeHtml(fromName)} &lt;${escapeHtml(fromEmail)}&gt; escribió:</div>
${inner}
</div>`;
}
