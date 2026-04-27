/**
 * domainMatchNotifyEmail.ts · Email al admin de una agencia existente
 * cuando se detecta una invitación entrante a un email de su mismo
 * dominio que NO es miembro registrado del workspace.
 *
 * Caso de uso:
 *   · Promotor invita a `juan@primeproperties.com`.
 *   · Prime Properties existe en Byvaro, pero Juan NO tiene cuenta.
 *   · Se envía a Juan el email canónico de invitación
 *     (`auth-agency-invitation`) PERO también se notifica a Laura
 *     (admin de Prime Properties) con esta plantilla para que pueda
 *     invitar a Juan al equipo · una vez aceptado, Juan podrá
 *     procesar la invitación del promotor.
 *
 * Registrada en `/ajustes/plantillas` como
 * `auth-domain-match-notify-admin`.
 *
 * TODO(backend): cuando llegue API real, este email se renderiza
 * server-side y el endpoint
 * `POST /api/agencies/:id/domain-match-notify` lo dispara
 * automáticamente al detectar el caso.
 */

import { BYVARO_LOGO_DATA_URL } from "./byvaroLogoDataUrl";

export interface DomainMatchNotifyEmailData {
  /** Datos del admin destinatario · saludo + footer. */
  adminName: string;
  adminEmail: string;
  /** Nombre de la agencia · contexto. */
  agencyName: string;
  /** Email del usuario externo invitado · el que comparte dominio. */
  invitedEmail: string;
  /** Quién invitó (nombre del promotor / comercializador). */
  inviterName: string;
  inviterCompany: string;
  /** Link directo al panel de invitar miembros · `/ajustes/usuarios/miembros`. */
  inviteMemberUrl: string;
  /** Nombre de la promoción a la que estaba invitando, si aplica. */
  promotionName?: string;
}

export function getDomainMatchNotifyHtml(d: DomainMatchNotifyEmailData): {
  asunto: string;
  html: string;
} {
  const {
    adminName, adminEmail, agencyName, invitedEmail,
    inviterName, inviterCompany, inviteMemberUrl, promotionName,
  } = d;

  const firstName = adminName.split(" ")[0] || adminName;
  const asunto = `Alguien con el email de ${agencyName} fue invitado a colaborar`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${asunto}</title>
  <style>
    body, table, td { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
    @media only screen and (max-width: 640px) {
      .wrap { padding: 12px 0 !important; }
      .card { width: 100% !important; max-width: 100% !important; border-radius: 0 !important; border-left: 0 !important; border-right: 0 !important; }
      .inner-pad { padding-left: 18px !important; padding-right: 18px !important; }
      .h1 { font-size: 20px !important; line-height: 1.3 !important; }
      .cta-btn { padding: 13px 24px !important; font-size: 14px !important; display: block !important; box-sizing: border-box !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#F5F7FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,Arial,sans-serif;color:#2B3040;">
  <center style="width:100%;background:#F5F7FA;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F5F7FA;">
      <tr>
        <td align="center" class="wrap" style="padding:40px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="520" class="card" style="width:520px;max-width:100%;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #E7EAF0;">

            <!-- Logo -->
            <tr><td align="center" class="inner-pad" style="padding:32px 32px 8px;">
              <img src="${BYVARO_LOGO_DATA_URL}" alt="Byvaro" width="120" style="display:inline-block;height:auto;width:120px;max-width:120px;" />
            </td></tr>

            <!-- Saludo -->
            <tr><td class="inner-pad" style="padding:24px 32px 0;">
              <h1 class="h1" style="margin:0;font-size:22px;line-height:1.35;color:#15181F;font-weight:700;">Hola ${firstName},</h1>
              <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#2B3040;">
                ${inviterName} (${inviterCompany}) ha enviado una invitación a <strong>${invitedEmail}</strong>${promotionName ? ` para colaborar en <strong>${promotionName}</strong>` : ""}, pero ese email todavía no está registrado en el equipo de <strong>${agencyName}</strong>.
              </p>
            </td></tr>

            <!-- Explicación + acción -->
            <tr><td class="inner-pad" style="padding:18px 32px 0;">
              <p style="margin:0;font-size:13.5px;line-height:1.6;color:#5B6170;">
                Para que esa persona pueda procesar la invitación necesita ser primero miembro de tu agencia en Byvaro. Invítale como miembro del equipo y, una vez acepte, podrá responder a la invitación del promotor con normalidad.
              </p>
            </td></tr>

            <!-- CTA -->
            <tr><td align="center" class="inner-pad" style="padding:28px 32px 24px;">
              <a href="${inviteMemberUrl}" class="cta-btn"
                 style="display:inline-block;background:#1D74E7;color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;padding:14px 30px;border-radius:999px;box-shadow:0 4px 14px rgba(29,116,231,0.25);">
                Invitar a ${invitedEmail.split("@")[0]} al equipo
              </a>
              <div style="margin-top:12px;font-size:11.5px;color:#8A8F9B;line-height:1.5;">
                Si esa persona no debería pertenecer a ${agencyName}, puedes ignorar este email.
              </div>
            </td></tr>

            <!-- Footer -->
            <tr><td class="inner-pad" style="padding:18px 32px;background:#FAFBFC;border-top:1px solid #EEF0F3;">
              <p style="margin:0;font-size:11px;line-height:1.6;color:#8A8F9B;">
                Email enviado a ${adminEmail} porque eres administrador de ${agencyName} en Byvaro.
              </p>
            </td></tr>

          </table>

          <div style="margin-top:14px;font-size:11px;color:#A0A5AF;">
            Byvaro · Plataforma para promotores y comercializadores de obra nueva.
          </div>
        </td>
      </tr>
    </table>
  </center>
</body>
</html>`;

  return { asunto, html };
}
