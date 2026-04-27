/**
 * Render manual del email "Invitación al Responsable" con datos demo.
 * Usado para que se pueda abrir el HTML directamente sin pasar por la
 * UI · útil para revisar copy con marketing / negocio.
 *
 * Uso:  node scripts/_render-responsible-email.mjs
 * Output: /tmp/byvaro-email-responsible.html
 */
import { writeFileSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = resolve(__dirname, "..", "src/assets/byvaro-logo.svg");
const svgB64 = readFileSync(svgPath).toString("base64");
const LOGO_DATA_URL = `data:image/svg+xml;base64,${svgB64}`;

/* Replicamos la función `getResponsibleInviteHtml()` aquí para evitar
 * el coste de un loader TS · la copy debe mantenerse en paridad con
 * `src/lib/responsibleInviteEmail.ts`. Si toca cambiar esto, cambia
 * AMBOS archivos. */
function getResponsibleInviteHtml(d) {
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
            <tr><td align="center" class="inner-pad" style="padding:32px 32px 8px;">
              <img src="${LOGO_DATA_URL}" alt="Byvaro" width="120" style="display:inline-block;height:auto;width:120px;max-width:120px;" />
            </td></tr>
            <tr><td class="inner-pad" style="padding:24px 32px 0;">
              <h1 class="h1" style="margin:0;font-size:22px;line-height:1.35;color:#15181F;font-weight:700;">Hola ${firstName},</h1>
              <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#2B3040;">${inviterName} ha creado la cuenta de <strong>${agencyName}</strong> en Byvaro y te propone como <strong>Responsable</strong>.</p>
            </td></tr>
            <tr><td class="inner-pad" style="padding:18px 32px 0;">
              <p style="margin:0;font-size:13.5px;line-height:1.6;color:#5B6170;">Byvaro es la plataforma donde promotores y comercializadores de obra nueva trabajan con sus agencias colaboradoras. Como Responsable gestionarás el perfil, el equipo y los contratos de ${agencyName}.</p>
            </td></tr>
            <tr><td align="center" class="inner-pad" style="padding:28px 32px 24px;">
              <a href="${acceptUrl}" class="cta-btn" style="display:inline-block;background:#1D74E7;color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;padding:14px 30px;border-radius:999px;box-shadow:0 4px 14px rgba(29,116,231,0.25);">Acceder y crear contraseña</a>
              <div style="margin-top:12px;font-size:11.5px;color:#8A8F9B;line-height:1.5;">El enlace caduca en ${expiraEnDias} días.</div>
            </td></tr>
            <tr><td class="inner-pad" style="padding:18px 32px;background:#FAFBFC;border-top:1px solid #EEF0F3;">
              <p style="margin:0;font-size:11px;line-height:1.6;color:#8A8F9B;">Email enviado a ${responsibleEmail} a petición de ${inviterEmail}. Si no esperabas este mensaje, ignóralo · sin tu acceso no se cambia nada en la cuenta.</p>
            </td></tr>
          </table>
          <div style="margin-top:14px;font-size:11px;color:#A0A5AF;">Byvaro · Plataforma para promotores y comercializadores de obra nueva.</div>
        </td>
      </tr>
    </table>
  </center>
</body>
</html>`;
  return { asunto, html };
}

const { asunto, html } = getResponsibleInviteHtml({
  responsibleName: "Carlos Dueño Real",
  responsibleEmail: "carlos@miagencia.com",
  agencyName: "Mi Agencia Inmobiliaria",
  inviterName: "Laura Empleada",
  inviterEmail: "laura@miagencia.com",
  acceptUrl: "https://app.byvaro.com/responsible/abc123demo456",
  expiraEnDias: 30,
});

const out = "/tmp/byvaro-email-responsible.html";
writeFileSync(out, html, "utf8");
console.log("✓ Email generado:", out);
console.log("  Asunto:", asunto);
console.log("  Ábrelo en el navegador: file://" + out);
