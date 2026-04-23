/**
 * teamInvitationEmail.ts · plantillas de email para invitación al equipo.
 *
 * Renderiza el asunto y el cuerpo del email que el sistema envía cuando
 * un admin usa el flow "Invitar por email" del `InviteMemberDialog`.
 *
 * Dos formatos disponibles:
 *   - `renderTeamInvitation({ plain: true })` · plain text (backend SMTP).
 *   - `renderTeamInvitationHtml()` · HTML formateado para email clients.
 *
 * El backend solo necesita sustituir el token `{{activationLink}}`
 * por el URL real (`https://app.byvaro.com/activate?token=...`).
 *
 * TODO(backend):
 *   POST /api/organization/invitations { email, role }
 *     → 201 · el backend genera el token, persiste la invitación con
 *            expiración 7 días y envía este email.
 *   El asunto, cuerpo y HTML viven aquí (frontend lib) para que el
 *   admin pueda ver preview ANTES de enviar y el backend reuse la
 *   misma plantilla.
 */

import type { TeamMember } from "@/lib/team";

export type TeamInvitationLang = "es" | "en";

export type TeamInvitationPayload = {
  /** Nombre legible del admin que invita (para firmar el email). */
  inviterName: string;
  /** Nombre comercial de la empresa (p. ej. "Luxinmo"). */
  companyName: string;
  /** Email al que se envía la invitación. */
  email: string;
  /** Rol que tendrá el nuevo miembro al aceptar. */
  role: TeamMember["role"];
  /** Mensaje personalizado opcional del admin (2-3 frases). */
  personalMessage?: string;
  /** URL completa del link de activación (backend lo construye). */
  activationLink: string;
  /** Días hasta que el token expire · default 7. */
  expiresInDays?: number;
  /** Idioma de la plantilla · default `es`. */
  lang?: TeamInvitationLang;
};

export type RenderedEmail = {
  subject: string;
  /** Cuerpo en texto plano (sin HTML). */
  plainText: string;
  /** Cuerpo HTML listo para el SMTP. */
  html: string;
};

/* ═══════════════════════════════════════════════════════════════════
   Render principal
   ═══════════════════════════════════════════════════════════════════ */

export function renderTeamInvitation(p: TeamInvitationPayload): RenderedEmail {
  const lang = p.lang ?? "es";
  const days = p.expiresInDays ?? 7;
  const roleLabel = roleLabelFor(p.role, lang);

  if (lang === "en") {
    return {
      subject: `${p.inviterName} invited you to join ${p.companyName} on Byvaro`,
      plainText: plainEn(p, roleLabel, days),
      html: htmlTemplate({
        lang: "en",
        title: `You've been invited to ${p.companyName}`,
        intro: `${p.inviterName} has invited you to join the ${p.companyName} workspace on Byvaro as ${roleLabel}.`,
        personalMessage: p.personalMessage,
        ctaLabel: "Accept invitation",
        ctaUrl: p.activationLink,
        footer: `This link expires in ${days} days. If you weren't expecting this email, you can safely ignore it.`,
        inviter: p.inviterName,
      }),
    };
  }

  /* Default · Spanish */
  return {
    subject: `${p.inviterName} te invita a unirte a ${p.companyName} en Byvaro`,
    plainText: plainEs(p, roleLabel, days),
    html: htmlTemplate({
      lang: "es",
      title: `Te han invitado a ${p.companyName}`,
      intro: `${p.inviterName} te ha invitado a unirte al workspace de ${p.companyName} en Byvaro como ${roleLabel}.`,
      personalMessage: p.personalMessage,
      ctaLabel: "Aceptar invitación",
      ctaUrl: p.activationLink,
      footer: `El enlace caduca en ${days} días. Si no esperabas este email, puedes ignorarlo con total seguridad.`,
      inviter: p.inviterName,
    }),
  };
}

/* ═══════════════════════════════════════════════════════════════════
   Plain text (para cliente SMTP legacy o fallback)
   ═══════════════════════════════════════════════════════════════════ */

function plainEs(p: TeamInvitationPayload, roleLabel: string, days: number): string {
  return [
    `Hola,`,
    ``,
    `${p.inviterName} te ha invitado a unirte al workspace de ${p.companyName} en Byvaro como ${roleLabel}.`,
    ``,
    p.personalMessage ? `${p.personalMessage}\n` : null,
    `Acepta la invitación y configura tu contraseña aquí:`,
    p.activationLink,
    ``,
    `Este enlace caduca en ${days} días.`,
    ``,
    `Un saludo,`,
    p.inviterName,
  ].filter((x) => x !== null).join("\n");
}

function plainEn(p: TeamInvitationPayload, roleLabel: string, days: number): string {
  return [
    `Hi,`,
    ``,
    `${p.inviterName} has invited you to join the ${p.companyName} workspace on Byvaro as ${roleLabel}.`,
    ``,
    p.personalMessage ? `${p.personalMessage}\n` : null,
    `Accept the invitation and set your password here:`,
    p.activationLink,
    ``,
    `This link expires in ${days} days.`,
    ``,
    `Best,`,
    p.inviterName,
  ].filter((x) => x !== null).join("\n");
}

/* ═══════════════════════════════════════════════════════════════════
   Template HTML · inline styles (obligatorio para clientes de email)
   Se mantiene intencionalmente simple · ningún include externo.
   ═══════════════════════════════════════════════════════════════════ */

type HtmlArgs = {
  lang: TeamInvitationLang;
  title: string;
  intro: string;
  personalMessage?: string;
  ctaLabel: string;
  ctaUrl: string;
  footer: string;
  inviter: string;
};

function htmlTemplate(a: HtmlArgs): string {
  const ctaBtn = `
    <a href="${escapeHtml(a.ctaUrl)}"
       style="display:inline-block;background:#1c1c1e;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:9999px;font-size:14px;font-weight:600;line-height:1;">
      ${escapeHtml(a.ctaLabel)}
    </a>`;

  const personalBlock = a.personalMessage
    ? `<div style="margin:24px 0;padding:16px 20px;background:#f5f6f8;border-radius:12px;color:#42464d;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(a.personalMessage)}</div>`
    : "";

  return `<!doctype html>
<html lang="${a.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${escapeHtml(a.title)}</title></head>
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7f9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;box-shadow:0 2px 16px -6px rgba(0,0,0,0.06);overflow:hidden;">
        <tr><td style="padding:32px 32px 24px 32px;">
          <div style="font-size:20px;font-weight:800;color:#1c1c1e;letter-spacing:-0.01em;">Byvaro</div>
        </td></tr>
        <tr><td style="padding:0 32px 8px 32px;">
          <h1 style="margin:0 0 12px 0;font-size:22px;line-height:1.3;font-weight:800;color:#1c1c1e;">${escapeHtml(a.title)}</h1>
          <p style="margin:0;font-size:15px;line-height:1.55;color:#42464d;">${escapeHtml(a.intro)}</p>
        </td></tr>
        ${personalBlock ? `<tr><td style="padding:0 32px;">${personalBlock}</td></tr>` : ""}
        <tr><td style="padding:24px 32px 32px 32px;">
          ${ctaBtn}
        </td></tr>
        <tr><td style="padding:0 32px 32px 32px;">
          <p style="margin:0;font-size:12.5px;line-height:1.55;color:#8b8e95;">${escapeHtml(a.footer)}</p>
          <p style="margin:16px 0 0 0;font-size:12.5px;line-height:1.55;color:#8b8e95;">— ${escapeHtml(a.inviter)}</p>
        </td></tr>
      </table>
      <p style="max-width:560px;margin:18px auto 0 auto;font-size:11px;color:#a0a3a8;text-align:center;line-height:1.5;">
        ${a.lang === "es"
          ? "Enviado por Byvaro · el CRM inmobiliario de tu equipo"
          : "Sent by Byvaro · your team's real-estate CRM"}
      </p>
    </td></tr>
  </table>
</body></html>`;
}

/* ═══════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════ */

function roleLabelFor(role: TeamMember["role"], lang: TeamInvitationLang): string {
  if (lang === "en") return role === "admin" ? "administrator" : "member";
  return role === "admin" ? "administrador" : "miembro";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
