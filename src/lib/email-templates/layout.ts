/**
 * Layout HTML compartido por todas las plantillas transaccionales de
 * Byvaro. Container 600px max, fondo gris muy claro, card blanca con
 * sombra sutil, header con marca, footer con enlaces legales.
 *
 * Inline-styles a propósito: clientes de email (Gmail, Outlook,
 * Apple Mail) ignoran <style> en mucho casos. Tipografía system para
 * evitar webfonts, que no cargan fiable en email.
 *
 * Marca Byvaro: foreground #0A0A0A · background #FFFFFF · accent
 * primary #4F46E5 (mismo que el sistema de la app, en hex puro
 * porque los HSL tokens no aplican fuera de la app).
 */

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const BG = "#F4F4F5";
const CARD = "#FFFFFF";
const BORDER = "#E4E4E7";
const TEXT = "#0A0A0A";
const MUTED = "#71717A";
const ACCENT = "#0A0A0A";

export type LayoutOptions = {
  /** Texto pre-header (preview en lista de bandeja). */
  preheader?: string;
  /** Contenido HTML del cuerpo (entre header y footer). */
  body: string;
};

export function renderLayout({ preheader = "", body }: LayoutOptions): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light only" />
<title>Byvaro</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:${FONT};color:${TEXT};-webkit-font-smoothing:antialiased;">

<!-- Pre-header (oculto, aparece como preview en bandeja) -->
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;color:${BG};">
  ${escape(preheader)}
</div>

<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background:${BG};">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <table role="presentation" width="600" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;">

        <!-- Header con marca -->
        <tr>
          <td style="padding:0 4px 16px 4px;">
            <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
              <tr>
                <td>
                  <span style="display:inline-flex;align-items:center;gap:8px;font-size:18px;font-weight:700;letter-spacing:-0.01em;color:${TEXT};">
                    <span style="display:inline-block;width:24px;height:24px;border-radius:6px;background:${ACCENT};color:${CARD};text-align:center;line-height:24px;font-size:13px;font-weight:800;">B</span>
                    Byvaro
                  </span>
                </td>
                <td align="right" style="font-size:11px;color:${MUTED};">
                  Email transaccional
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Card principal -->
        <tr>
          <td style="background:${CARD};border:1px solid ${BORDER};border-radius:16px;padding:32px;">
            ${body}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 4px 0 4px;font-size:11px;color:${MUTED};line-height:1.6;">
            Byvaro · Software para promotores inmobiliarios<br/>
            Recibes este email porque tienes una cuenta activa en Byvaro.<br/>
            Si crees que es un error, escríbenos a <a href="mailto:soporte@byvaro.com" style="color:${MUTED};text-decoration:underline;">soporte@byvaro.com</a>.<br/><br/>
            <a href="https://byvaro.com" style="color:${MUTED};text-decoration:none;">byvaro.com</a>
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>

</body>
</html>`;
}

/* ══════ Helpers compartidos ══════ */

export function escape(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const palette = { FONT, BG, CARD, BORDER, TEXT, MUTED, ACCENT };
