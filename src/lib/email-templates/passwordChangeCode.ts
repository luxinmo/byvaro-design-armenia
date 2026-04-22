/**
 * Plantilla: código de verificación para cambio de contraseña.
 *
 * Se envía al email principal del usuario cuando solicita cambiar
 * su contraseña en /ajustes/seguridad/contrasena. Validez: 10 min.
 *
 * Lo dispara: src/pages/ajustes/seguridad/contrasena.tsx
 * Persistencia mock: byvaro.security.passwordChange.pending.v1
 */

import { renderLayout, escape, palette } from "./layout";
import type { RenderedEmail } from "./types";

export type PasswordChangeCodeParams = {
  /** Nombre visible (saludo). Ej: "Arman". */
  userName: string;
  /** Email destinatario (usado solo en el preview / TODO backend). */
  userEmail: string;
  /** Código de 6 dígitos. */
  code: string;
  /** Minutos de validez. */
  ttlMinutes: number;
  /** IP/ubicación aproximada del solicitante (opcional). */
  requestContext?: {
    ip?: string;
    userAgent?: string;
    location?: string;
  };
};

export function renderPasswordChangeCode(p: PasswordChangeCodeParams): RenderedEmail {
  const subject = `Tu código de Byvaro: ${p.code}`;
  const preheader = `Código de verificación para cambiar tu contraseña: ${p.code}. Válido ${p.ttlMinutes} minutos.`;

  const ctx = p.requestContext;
  const ctxBlock = ctx && (ctx.ip || ctx.userAgent || ctx.location) ? `
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:24px 0 0 0;background:#FAFAFA;border:1px solid ${palette.BORDER};border-radius:12px;">
      <tr><td style="padding:14px 16px;font-size:12px;color:${palette.MUTED};line-height:1.6;">
        <strong style="color:${palette.TEXT};display:block;margin-bottom:6px;">Solicitud realizada desde:</strong>
        ${ctx.location ? `<div>📍 ${escape(ctx.location)}</div>` : ""}
        ${ctx.ip ? `<div>🌐 IP ${escape(ctx.ip)}</div>` : ""}
        ${ctx.userAgent ? `<div>💻 ${escape(ctx.userAgent)}</div>` : ""}
      </td></tr>
    </table>
  ` : "";

  const body = `
    <h1 style="margin:0 0 8px 0;font-size:20px;font-weight:700;color:${palette.TEXT};letter-spacing:-0.01em;">
      Verifica el cambio de contraseña
    </h1>
    <p style="margin:0 0 24px 0;font-size:14px;color:${palette.MUTED};line-height:1.6;">
      Hola ${escape(p.userName)}, has pedido cambiar la contraseña de tu cuenta. Introduce este código en Byvaro para completar el cambio:
    </p>

    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
      <tr>
        <td align="center" style="padding:8px 0 8px 0;">
          <div style="
            display:inline-block;
            background:#F4F4F5;
            border:1px solid ${palette.BORDER};
            border-radius:14px;
            padding:18px 28px;
            font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;
            font-size:32px;
            font-weight:700;
            letter-spacing:0.35em;
            color:${palette.TEXT};
          ">${escape(p.code)}</div>
        </td>
      </tr>
    </table>

    <p style="margin:18px 0 0 0;font-size:12px;color:${palette.MUTED};text-align:center;">
      Este código expira en <strong style="color:${palette.TEXT};">${p.ttlMinutes} minutos</strong>.
    </p>

    ${ctxBlock}

    <hr style="border:none;border-top:1px solid ${palette.BORDER};margin:28px 0;" />

    <p style="margin:0;font-size:13px;color:${palette.MUTED};line-height:1.6;">
      <strong style="color:${palette.TEXT};">¿No has sido tú?</strong><br/>
      Ignora este email y considera <a href="https://byvaro.com/ajustes/seguridad/2fa" style="color:${palette.TEXT};text-decoration:underline;">activar la verificación en dos pasos</a>. Si sospechas que alguien más conoce tu contraseña, escríbenos a <a href="mailto:seguridad@byvaro.com" style="color:${palette.TEXT};text-decoration:underline;">seguridad@byvaro.com</a> de inmediato.
    </p>
  `;

  const html = renderLayout({ preheader, body });

  const text = [
    `Verifica el cambio de contraseña`,
    ``,
    `Hola ${p.userName},`,
    ``,
    `Has pedido cambiar la contraseña de tu cuenta Byvaro. Introduce este código para completar el cambio:`,
    ``,
    `    ${p.code}`,
    ``,
    `Este código expira en ${p.ttlMinutes} minutos.`,
    ctx?.location ? `Solicitud realizada desde: ${ctx.location}${ctx.ip ? ` (IP ${ctx.ip})` : ""}` : "",
    ``,
    `Si no has sido tú, ignora este email y considera activar la verificación en dos pasos.`,
    ``,
    `— Byvaro`,
    `Email destinatario: ${p.userEmail}`,
  ].filter(Boolean).join("\n");

  return { subject, html, text };
}
