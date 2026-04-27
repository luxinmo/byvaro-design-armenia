/**
 * responsibleInviteEmail.ts · Plantilla HTML del email de invitación
 * al Responsable de una agencia.
 *
 * Patrón "magic link → set password" tipo Slack/Notion · el destinatario
 * llega al email sin saber qué es Byvaro · el body explica en una frase
 * qué pasa, una frase qué es Byvaro y un único CTA "Acceder y crear
 * contraseña" que aterriza en `/responsible/:token` (la landing decide
 * todo el detalle del rol).
 *
 * Diferente del email "Promotor invita a Agencia" (`getInvitacionHtml`
 * en `src/lib/invitaciones.ts`):
 *
 *   · Aquí el remitente es el USUARIO ADMIN de la agencia recién dada
 *     de alta (caso 1) que declara "no soy yo el Responsable".
 *   · El destinatario es el Responsable real (dueño / director del
 *     negocio) que tomará el rol admin del workspace.
 *
 * Registrado en `/ajustes/plantillas` con id `auth-responsible-invitation`.
 *
 * TODO(backend): cuando llegue la API real, este HTML se renderiza
 * server-side con override del tenant (subject/body/brand). El frontend
 * solo dispara `POST /api/agencies/:id/invite-responsible`.
 */

import { BYVARO_LOGO_DATA_URL } from "./byvaroLogoDataUrl";

export interface ResponsibleInviteEmailData {
  /** Nombre del Responsable propuesto · usado en saludo. */
  responsibleName: string;
  /** Email del Responsable · solo para mostrar en el footer. */
  responsibleEmail: string;
  /** Nombre comercial de la agencia. */
  agencyName: string;
  /** Quién está invitando (admin actual de la agencia). */
  inviterName: string;
  inviterEmail: string;
  /** URL de aceptación (`/responsible/:token`). */
  acceptUrl: string;
  /** Días que el link de aceptación es válido. */
  expiraEnDias?: number;
}

export function getResponsibleInviteHtml(d: ResponsibleInviteEmailData): {
  asunto: string;
  html: string;
} {
  const {
    responsibleName, responsibleEmail, agencyName,
    inviterName, inviterEmail, acceptUrl, expiraEnDias = 30,
  } = d;

  const asunto = `${inviterName} te propone como Responsable de ${agencyName}`;
  const firstName = responsibleName.split(" ")[0] || responsibleName;

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

            <!-- Logo Byvaro · wordmark SVG embebido como data URL ·
                 centrado · mismo logo que la navbar del CRM. -->
            <tr>
              <td align="center" class="inner-pad" style="padding:32px 32px 8px;">
                <img
                  src="${BYVARO_LOGO_DATA_URL}"
                  alt="Byvaro"
                  width="120"
                  style="display:inline-block;height:auto;width:120px;max-width:120px;"
                />
              </td>
            </tr>

            <!-- Saludo + acción -->
            <tr>
              <td class="inner-pad" style="padding:24px 32px 0;">
                <h1 class="h1" style="margin:0;font-size:22px;line-height:1.35;color:#15181F;font-weight:700;">
                  Hola ${firstName},
                </h1>
                <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#2B3040;">
                  ${inviterName} ha creado la cuenta de <strong>${agencyName}</strong> en Byvaro y te propone como <strong>Responsable</strong>.
                </p>
              </td>
            </tr>

            <!-- Qué es Byvaro · una sola frase -->
            <tr>
              <td class="inner-pad" style="padding:18px 32px 0;">
                <p style="margin:0;font-size:13.5px;line-height:1.6;color:#5B6170;">
                  Byvaro es la plataforma donde promotores y comercializadores de obra nueva trabajan con sus agencias colaboradoras. Como Responsable gestionarás el perfil, el equipo y los contratos de ${agencyName}.
                </p>
              </td>
            </tr>

            <!-- CTA único -->
            <tr>
              <td align="center" class="inner-pad" style="padding:28px 32px 24px;">
                <a href="${acceptUrl}" class="cta-btn"
                   style="display:inline-block;background:#1D74E7;color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;padding:14px 30px;border-radius:999px;box-shadow:0 4px 14px rgba(29,116,231,0.25);">
                  Acceder y crear contraseña
                </a>
                <div style="margin-top:12px;font-size:11.5px;color:#8A8F9B;line-height:1.5;">
                  El enlace caduca en ${expiraEnDias} días.
                </div>
              </td>
            </tr>

            <!-- Footer minimal -->
            <tr>
              <td class="inner-pad" style="padding:18px 32px;background:#FAFBFC;border-top:1px solid #EEF0F3;">
                <p style="margin:0;font-size:11px;line-height:1.6;color:#8A8F9B;">
                  Email enviado a ${responsibleEmail} a petición de ${inviterEmail}. Si no esperabas este mensaje, ignóralo · sin tu acceso no se cambia nada en la cuenta.
                </p>
              </td>
            </tr>

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
