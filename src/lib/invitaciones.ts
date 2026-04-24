/**
 * lib/invitaciones.ts · modelo y hook de invitaciones a agencias.
 *
 * El promotor invita a agencias para que colaboren en sus promociones.
 * Cada invitación genera un link único (magic-link-style) que la
 * agencia usa para registrarse y aceptar.
 *
 * Estados:
 *   - pendiente: enviada, sin respuesta
 *   - aceptada:  la agencia aceptó y ya es colaboradora
 *   - rechazada: la agencia rechazó
 *   - caducada:  expiró sin respuesta (>30 días)
 *
 * Hoy → todo en localStorage (MVP). Mañana → backend + email real.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Agency } from "@/data/agencies";
import { developerOnlyPromotions } from "@/data/developerPromotions";
import { promotions } from "@/data/promotions";

export type EstadoInvitacion = "pendiente" | "aceptada" | "rechazada" | "caducada";

/** Tramo de pago de comisión: % de cobro del cliente → % del pago al colaborador. */
export interface PagoTramo {
  tramo: number;
  completado: number; // % del cobro del cliente
  colaborador: number; // % de la comisión al colaborador en este tramo
}

/** Evento en el historial de una invitación · quién hizo qué y cuándo. */
export type InvitacionEventType =
  | "created"        // creada y enviada por primera vez
  | "resent"         // reenviada (mismo email)
  | "email_changed"  // email corregido antes/durante el reenvío
  | "accepted"       // aceptada por la agencia
  | "rejected"       // rechazada por la agencia
  | "cancelled";     // cancelada

export interface InvitacionEvent {
  id: string;
  type: InvitacionEventType;
  at: number;                             // timestamp ms
  by?: { name: string; email?: string };  // actor · undefined = sistema
  /** Solo para `email_changed`. */
  previousEmail?: string;
  /** Solo para `email_changed`. */
  newEmail?: string;
}

export interface Invitacion {
  id: string;
  token: string;                 // token único del link
  emailAgencia: string;
  nombreAgencia: string;
  /** Id de la agencia destinataria en el mock · se rellena cuando la
   *  invitación parte de una agencia YA existente en nuestra red
   *  (p. ej. desde el panel de colaboración). Si la invitación es a
   *  un email externo, queda `undefined`. */
  agencyId?: string;
  mensajePersonalizado: string;
  comisionOfrecida: number;      // %
  idiomaEmail: "es" | "en" | "fr" | "de" | "pt" | "it";
  estado: EstadoInvitacion;
  createdAt: number;
  expiraEn: number;              // timestamp ms
  respondidoEn?: number;
  /** Actor que creó la invitación (promotor que la envió). */
  createdBy?: { name: string; email?: string };
  /** Historial de acciones sobre esta invitación (creación, reenvíos,
   *  ediciones de email, cancelación). Orden cronológico ascendente. */
  events?: InvitacionEvent[];

  /* ── Compartir promoción (opcional · flujo SharePromotionDialog) ── */
  /** Promoción sobre la que se ofrece la colaboración. */
  promocionId?: string;
  promocionNombre?: string;
  /** Duración de la colaboración en meses (0 = indefinida). */
  duracionMeses?: number;
  /** Forma de pago de la comisión al colaborador. */
  formaPago?: PagoTramo[];
  /** Datos mínimos requeridos al registrar un cliente. */
  datosRequeridos?: string[];
}

const STORAGE_KEY = "byvaro-invitaciones";
const VALIDEZ_DIAS = 30;

/** Catálogo de promociones que SÍ se pueden compartir con agencias ·
 *  se usa para auto-limpiar invitaciones huérfanas que quedaron en
 *  localStorage apuntando a promos que nunca debieron compartirse
 *  (p. ej. promos con `canShareWithAgencies: false`). */
function shareablePromoIds(): Set<string> {
  const ids = new Set<string>();
  for (const p of developerOnlyPromotions) {
    if (p.status === "active" && p.canShareWithAgencies !== false) ids.add(p.id);
  }
  for (const p of promotions) {
    if (p.status === "active") ids.add(p.id);
  }
  return ids;
}

function loadAll(): Invitacion[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    const now = Date.now();
    const shareable = shareablePromoIds();
    let dirty = false;
    const cleaned = (list as Invitacion[]).filter((i) => {
      /* Self-heal · si la invitación está pendiente sobre una
         promoción que no es compartible (no existe, no publicada,
         canShareWithAgencies=false) la descartamos · es data
         huérfana de algún bug histórico. */
      if (i.promocionId && !shareable.has(i.promocionId)) {
        dirty = true;
        return false;
      }
      return true;
    }).map((i) =>
      i.estado === "pendiente" && i.expiraEn < now
        ? { ...i, estado: "caducada" as EstadoInvitacion }
        : i,
    );
    if (dirty) {
      /* Persistimos la limpieza para que no se repita en cada load. */
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return [];
  }
}

function saveAll(list: Invitacion[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("byvaro:invitaciones-changed"));
}

function generateToken(): string {
  // MVP: token random de 24 chars. En prod usaría nanoid/uuid v7 + firmar con JWT.
  return Array.from({ length: 24 }, () =>
    "abcdefghjkmnpqrstuvwxyz23456789"[Math.floor(Math.random() * 31)]
  ).join("");
}

export function buildInvitacionUrl(token: string): string {
  return `${window.location.origin}/invite/${token}`;
}

export function useInvitaciones() {
  const [lista, setLista] = useState<Invitacion[]>(() => loadAll());

  useEffect(() => {
    const onChange = () => setLista(loadAll());
    window.addEventListener("byvaro:invitaciones-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("byvaro:invitaciones-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const invitar = useCallback((data: {
    emailAgencia: string;
    nombreAgencia: string;
    /** Id de la agencia si la invitación parte de una existente. */
    agencyId?: string;
    mensajePersonalizado: string;
    comisionOfrecida: number;
    idiomaEmail: Invitacion["idiomaEmail"];
    /* Campos opcionales · compartir promoción */
    promocionId?: string;
    promocionNombre?: string;
    duracionMeses?: number;
    formaPago?: PagoTramo[];
    datosRequeridos?: string[];
    /* Actor que creó la invitación · registro en historial. */
    actor?: { name: string; email?: string };
  }) => {
    const actual = loadAll();
    const now = Date.now();
    const nueva: Invitacion = {
      id: `inv-${now}-${Math.random().toString(36).slice(2, 6)}`,
      token: generateToken(),
      emailAgencia: data.emailAgencia.trim().toLowerCase(),
      nombreAgencia: data.nombreAgencia.trim(),
      agencyId: data.agencyId,
      mensajePersonalizado: data.mensajePersonalizado.trim(),
      comisionOfrecida: data.comisionOfrecida,
      idiomaEmail: data.idiomaEmail,
      estado: "pendiente",
      createdAt: now,
      expiraEn: now + VALIDEZ_DIAS * 24 * 60 * 60 * 1000,
      promocionId: data.promocionId,
      promocionNombre: data.promocionNombre,
      duracionMeses: data.duracionMeses,
      formaPago: data.formaPago,
      datosRequeridos: data.datosRequeridos,
      createdBy: data.actor,
      events: [{
        id: `ev-${now}-created`,
        type: "created",
        at: now,
        by: data.actor,
      }],
    };
    saveAll([...actual, nueva]);
    return nueva;
  }, []);

  const revocar = useCallback((id: string) => {
    const list = loadAll();
    saveAll(list.map(i => i.id === id ? { ...i, estado: "rechazada" as EstadoInvitacion, respondidoEn: Date.now() } : i));
  }, []);

  const aceptar = useCallback((id: string) => {
    const list = loadAll();
    const now = Date.now();
    saveAll(list.map(i => i.id === id ? {
      ...i,
      estado: "aceptada" as EstadoInvitacion,
      respondidoEn: now,
      events: [...(i.events ?? []), { id: `ev-${now}-accepted`, type: "accepted" as const, at: now }],
    } : i));
  }, []);

  const eliminar = useCallback((id: string) => {
    const list = loadAll();
    saveAll(list.filter(i => i.id !== id));
  }, []);

  /** Reenvía una invitación. Si se pasa `newEmail` distinto al actual,
   *  primero actualiza el email y registra un evento `email_changed`;
   *  después registra el `resent` y extiende la validez. */
  const reenviar = useCallback((id: string, opts?: {
    newEmail?: string;
    actor?: { name: string; email?: string };
  }) => {
    const list = loadAll();
    const now = Date.now();
    saveAll(list.map(i => {
      if (i.id !== id) return i;
      const events = [...(i.events ?? [])];
      const finalEmail = opts?.newEmail?.trim() || i.emailAgencia;
      if (finalEmail && finalEmail !== i.emailAgencia) {
        events.push({
          id: `ev-${now}-email`,
          type: "email_changed",
          at: now,
          by: opts?.actor,
          previousEmail: i.emailAgencia,
          newEmail: finalEmail,
        });
      }
      events.push({
        id: `ev-${now}-resent`,
        type: "resent",
        at: now + 1,
        by: opts?.actor,
      });
      return {
        ...i,
        emailAgencia: finalEmail,
        expiraEn: now + VALIDEZ_DIAS * 24 * 60 * 60 * 1000,
        estado: "pendiente" as EstadoInvitacion,
        events,
      };
    }));
  }, []);

  const pendientes = lista.filter(i => i.estado === "pendiente");
  const aceptadas  = lista.filter(i => i.estado === "aceptada");
  const rechazadas = lista.filter(i => i.estado === "rechazada");
  const caducadas  = lista.filter(i => i.estado === "caducada");

  return {
    lista, pendientes, aceptadas, rechazadas, caducadas,
    invitar, revocar, aceptar, eliminar, reenviar,
  };
}

/** Filtra invitaciones asociadas a una agencia concreta · cruzando
 *  `agencyId` directo (moderno) y por email del contacto principal
 *  como fallback (invitaciones antiguas sin agencyId). */
export function useInvitacionesForAgency(
  agencyId: string,
  agencyEmail?: string,
): Invitacion[] {
  const { lista } = useInvitaciones();
  return useMemo(() => {
    const email = agencyEmail?.trim().toLowerCase();
    return lista.filter((i) => {
      if (i.agencyId === agencyId) return true;
      if (email && i.emailAgencia.toLowerCase() === email) return true;
      return false;
    });
  }, [lista, agencyId, agencyEmail]);
}

/* ─── Templates de email (para preview en el modal) ──────────────── */
export function getEmailPreview(
  inv: Pick<Invitacion, "emailAgencia" | "nombreAgencia" | "mensajePersonalizado" | "comisionOfrecida" | "idiomaEmail" | "token">,
  promotorNombre: string,
): { asunto: string; cuerpo: string } {
  const link = buildInvitacionUrl(inv.token);
  const templates: Record<Invitacion["idiomaEmail"], { asunto: string; cuerpo: string }> = {
    es: {
      asunto: `${promotorNombre} te invita a colaborar en Byvaro`,
      cuerpo: `Hola ${inv.nombreAgencia || "equipo"},

${promotorNombre} te invita a ser agencia colaboradora en Byvaro. Podrás acceder a su cartera de promociones y comercializarlas con una comisión del ${inv.comisionOfrecida}%.

${inv.mensajePersonalizado ? inv.mensajePersonalizado + "\n\n" : ""}Acepta la invitación aquí:
${link}

El enlace caduca en 30 días.

Un saludo,
${promotorNombre}`,
    },
    en: {
      asunto: `${promotorNombre} invites you to collaborate on Byvaro`,
      cuerpo: `Hi ${inv.nombreAgencia || "team"},

${promotorNombre} is inviting you to be a collaborating agency on Byvaro. You'll get access to their promotions with a ${inv.comisionOfrecida}% commission.

${inv.mensajePersonalizado ? inv.mensajePersonalizado + "\n\n" : ""}Accept the invitation here:
${link}

This link expires in 30 days.

Best,
${promotorNombre}`,
    },
    fr: {
      asunto: `${promotorNombre} vous invite à collaborer sur Byvaro`,
      cuerpo: `Bonjour ${inv.nombreAgencia || "équipe"},

${promotorNombre} vous invite à devenir agence collaboratrice sur Byvaro. Vous aurez accès à son portefeuille de promotions avec une commission de ${inv.comisionOfrecida}%.

${inv.mensajePersonalizado ? inv.mensajePersonalizado + "\n\n" : ""}Acceptez l'invitation ici :
${link}

Ce lien expire dans 30 jours.

Cordialement,
${promotorNombre}`,
    },
    de: {
      asunto: `${promotorNombre} lädt Sie zur Zusammenarbeit auf Byvaro ein`,
      cuerpo: `Hallo ${inv.nombreAgencia || "Team"},

${promotorNombre} lädt Sie ein, als kooperierende Agentur auf Byvaro mitzuwirken. Sie erhalten Zugriff auf das Portfolio mit einer Provision von ${inv.comisionOfrecida}%.

${inv.mensajePersonalizado ? inv.mensajePersonalizado + "\n\n" : ""}Einladung annehmen:
${link}

Dieser Link läuft in 30 Tagen ab.

Mit freundlichen Grüßen,
${promotorNombre}`,
    },
    pt: {
      asunto: `${promotorNombre} convida-o a colaborar na Byvaro`,
      cuerpo: `Olá ${inv.nombreAgencia || "equipa"},

${promotorNombre} convida-o a ser agência colaboradora na Byvaro. Terá acesso à carteira de promoções com uma comissão de ${inv.comisionOfrecida}%.

${inv.mensajePersonalizado ? inv.mensajePersonalizado + "\n\n" : ""}Aceite o convite aqui:
${link}

O link expira em 30 dias.

Saudações,
${promotorNombre}`,
    },
    it: {
      asunto: `${promotorNombre} ti invita a collaborare su Byvaro`,
      cuerpo: `Ciao ${inv.nombreAgencia || "team"},

${promotorNombre} ti invita a essere un'agenzia collaboratrice su Byvaro. Avrai accesso al portafoglio di promozioni con una commissione del ${inv.comisionOfrecida}%.

${inv.mensajePersonalizado ? inv.mensajePersonalizado + "\n\n" : ""}Accetta l'invito qui:
${link}

Il link scade in 30 giorni.

Cordiali saluti,
${promotorNombre}`,
    },
  };
  return templates[inv.idiomaEmail] ?? templates.es;
}

/* ─── Plantilla HTML de invitación (compartir promoción) ────────────
   Devuelve un HTML email-safe (tablas + estilos inline) para usar con
   cualquier proveedor de envío (SendGrid, Resend, Postmark, SMTP…).
   Variables dinámicas: promotor, agencia, promoción, comisión, duración,
   forma de pago, datos requeridos, mensaje y link de aceptación.
   ──────────────────────────────────────────────────────────────────── */
export interface InvitacionEmailData {
  promotorNombre: string;
  promotorLogo?: string;
  nombreAgencia?: string;
  emailAgencia: string;
  promocionNombre?: string;
  /** Foto hero de la promoción (URL absoluta) */
  promocionFoto?: string;
  /** Rango de precios desde-hasta en euros */
  precioDesde?: number;
  precioHasta?: number;
  /** Entrega: texto libre, p.ej. "Q4 2026" */
  entrega?: string;
  /** Unidades actualmente disponibles */
  unidadesDisponibles?: number;
  /** Total de unidades de la promoción (para mostrar "N de M") */
  unidadesTotales?: number;
  comisionOfrecida: number;
  duracionMeses?: number;
  formaPago?: PagoTramo[];
  datosRequeridos?: string[];
  mensajePersonalizado?: string;
  acceptUrl: string;
  expiraEnDias?: number;
}

/** Formatea precio en EUR con separadores (sin decimales). */
function formatEur(n: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export function getInvitacionHtml(d: InvitacionEmailData): { asunto: string; html: string } {
  const {
    promotorNombre, promotorLogo, nombreAgencia, promocionNombre,
    promocionFoto, precioDesde, precioHasta, entrega,
    unidadesDisponibles, unidadesTotales,
    comisionOfrecida, duracionMeses, formaPago, datosRequeridos,
    mensajePersonalizado, acceptUrl, expiraEnDias = 30,
  } = d;

  const asunto = promocionNombre
    ? `${promotorNombre} te invita a colaborar en ${promocionNombre}`
    : `${promotorNombre} te invita a colaborar en Byvaro`;

  const saludo = nombreAgencia ? `Hola ${nombreAgencia}` : "Hola";
  const duracionTxt = duracionMeses
    ? (duracionMeses === 1 ? "1 mes" : `${duracionMeses} meses`)
    : "Indefinida";

  // Rango de precios
  const precioTxt = (precioDesde != null && precioHasta != null)
    ? `${formatEur(precioDesde)} — ${formatEur(precioHasta)}`
    : precioDesde != null
      ? `Desde ${formatEur(precioDesde)}`
      : precioHasta != null
        ? `Hasta ${formatEur(precioHasta)}`
        : "";

  const pagoRows = (formaPago && formaPago.length > 0)
    ? formaPago.map(p => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #EEF0F3;color:#4A5260;font-size:13px;">${p.tramo}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #EEF0F3;color:#2B3040;font-size:13px;font-weight:600;">${p.completado}%</td>
          <td style="padding:10px 12px;border-bottom:1px solid #EEF0F3;color:#2B3040;font-size:13px;font-weight:600;">${p.colaborador}%</td>
        </tr>`).join("")
    : "";

  const datosList = (datosRequeridos && datosRequeridos.length > 0)
    ? datosRequeridos.map(d => `
        <tr>
          <td valign="top" style="padding:4px 0;width:22px;">
            <span style="display:inline-block;width:18px;height:18px;border-radius:999px;background:#EAF3FF;text-align:center;line-height:18px;font-size:11px;color:#2C6FDB;font-weight:700;">✓</span>
          </td>
          <td style="padding:4px 0 4px 8px;color:#2B3040;font-size:13px;">${d}</td>
        </tr>`).join("")
    : "";

  const logoBlock = promotorLogo
    ? `<img src="${promotorLogo}" alt="${promotorNombre}" width="36" height="36" style="display:block;border-radius:10px;object-fit:cover;" />`
    : `<div style="width:36px;height:36px;border-radius:10px;background:#2C6FDB;color:#fff;font-size:14px;font-weight:700;text-align:center;line-height:36px;">${(promotorNombre[0] || "B").toUpperCase()}</div>`;

  // Hero con la foto de la promoción (placeholder oscuro si no hay foto)
  const heroBlock = promocionFoto
    ? `
      <tr>
        <td style="padding:0;">
          <div style="position:relative;">
            <img src="${promocionFoto}" alt="${promocionNombre ?? ""}" width="640" class="hero-img" style="display:block;width:100%;height:240px;object-fit:cover;border-radius:0;" />
            <!-- Overlay gradient -->
            <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 40%,rgba(0,0,0,0.55) 100%);"></div>
            <!-- Badge top-left -->
            <div style="position:absolute;top:14px;left:14px;">
              <span style="display:inline-block;padding:5px 10px;border-radius:999px;background:rgba(255,255,255,0.94);color:#2C6FDB;font-size:10px;font-weight:700;letter-spacing:0.6px;">BYVARO · INVITACIÓN</span>
            </div>
            <!-- Title bottom -->
            ${promocionNombre ? `
            <div style="position:absolute;bottom:14px;left:18px;right:18px;color:#FFFFFF;">
              <div style="font-size:11px;opacity:0.9;letter-spacing:0.5px;text-transform:uppercase;">Promoción</div>
              <div class="hero-title" style="font-size:20px;font-weight:700;line-height:1.2;text-shadow:0 2px 12px rgba(0,0,0,0.4);">${promocionNombre}</div>
            </div>` : ""}
          </div>
        </td>
      </tr>` : "";

  // Promotion details card: precios + entrega (solo si hay datos)
  const hasPromoDetails = precioTxt || entrega;
  const promoDetailsBlock = hasPromoDetails
    ? `
      <tr>
        <td class="inner-pad" style="padding:18px 28px 6px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              ${precioTxt ? `
              <td width="${entrega ? "62%" : "100%"}" class="col-stack" style="padding-right:${entrega ? "6px" : "0"};vertical-align:top;">
                <div style="padding:14px 16px;border:1px solid #E7EAF0;border-radius:12px;">
                  <div style="font-size:10px;color:#8A8F9B;text-transform:uppercase;letter-spacing:0.6px;">Precio desde — hasta</div>
                  <div style="font-size:16px;font-weight:700;color:#15181F;margin-top:4px;">${precioTxt}</div>
                </div>
              </td>` : ""}
              ${entrega ? `
              <td width="${precioTxt ? "38%" : "100%"}" class="col-stack col-stack-gap" style="padding-left:${precioTxt ? "6px" : "0"};vertical-align:top;">
                <div style="padding:14px 16px;border:1px solid #E7EAF0;border-radius:12px;">
                  <div style="font-size:10px;color:#8A8F9B;text-transform:uppercase;letter-spacing:0.6px;">Entrega</div>
                  <div style="font-size:16px;font-weight:700;color:#15181F;margin-top:4px;">${entrega}</div>
                </div>
              </td>` : ""}
            </tr>
          </table>
        </td>
      </tr>` : "";

  // Unidades disponibles — pill destacada
  const unidadesTxt = (unidadesDisponibles != null)
    ? (unidadesTotales != null
        ? `${unidadesDisponibles} de ${unidadesTotales} unidades disponibles`
        : `${unidadesDisponibles} ${unidadesDisponibles === 1 ? "unidad disponible" : "unidades disponibles"}`)
    : "";

  const unidadesBlock = unidadesTxt
    ? `
      <tr>
        <td class="inner-pad" style="padding:6px 28px 10px;">
          <span style="display:inline-block;padding:7px 14px;border-radius:999px;background:#E8F5EC;color:#0F7B41;font-size:12px;font-weight:600;letter-spacing:0.2px;">
            <span style="display:inline-block;width:6px;height:6px;border-radius:999px;background:#0F7B41;margin-right:6px;vertical-align:middle;"></span>${unidadesTxt}
          </span>
        </td>
      </tr>` : "";

  const mensajeBlock = mensajePersonalizado && mensajePersonalizado.trim().length > 0
    ? `
      <tr>
        <td class="inner-pad" style="padding:0 28px 20px;">
          <div style="padding:14px 16px;background:#F5F7FA;border-left:3px solid #2C6FDB;border-radius:8px;color:#3A4150;font-size:14px;line-height:1.55;font-style:italic;">
            "${mensajePersonalizado.replace(/</g, "&lt;")}"
          </div>
        </td>
      </tr>` : "";

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${asunto}</title>
  <style>
    /* Base: evita scroll horizontal a toda costa */
    body, table, td { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }

    /* Responsive — clientes que soportan media queries (Gmail app, Apple Mail, iOS, Outlook web) */
    @media only screen and (max-width: 640px) {
      .wrap { padding: 12px 0 !important; }
      .card { width: 100% !important; max-width: 100% !important; border-radius: 0 !important; border-left: 0 !important; border-right: 0 !important; }
      .inner-pad { padding-left: 16px !important; padding-right: 16px !important; }
      .hero-img { height: 200px !important; }
      .hero-title { font-size: 18px !important; }
      .h1 { font-size: 19px !important; line-height: 1.3 !important; word-break: break-word !important; }
      .col-stack { display: block !important; width: 100% !important; padding: 0 !important; box-sizing: border-box !important; }
      .col-stack-gap { padding-top: 8px !important; }
      .comm-num { font-size: 26px !important; }
      .cta-btn { padding: 13px 24px !important; font-size: 14px !important; display: block !important; box-sizing: border-box !important; }
    }
    @media only screen and (max-width: 420px) {
      .h1 { font-size: 17px !important; }
      .hero-img { height: 160px !important; }
      .hero-title { font-size: 16px !important; }
      .inner-pad { padding-left: 14px !important; padding-right: 14px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#F5F7FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,Arial,sans-serif;color:#2B3040;">
  <center style="width:100%;background:#F5F7FA;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F5F7FA;">
      <tr>
        <td align="center" class="wrap" style="padding:32px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" class="card" style="width:640px;max-width:100%;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #E7EAF0;">

            ${heroBlock}

            <!-- Invitador -->
            <tr>
              <td class="inner-pad" style="padding:20px 28px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td style="vertical-align:middle;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="vertical-align:middle;padding-right:10px;">${logoBlock}</td>
                          <td style="vertical-align:middle;">
                            <div style="font-size:12px;color:#8A8F9B;line-height:1.2;">Invitación de</div>
                            <div style="font-size:14px;font-weight:700;color:#2B3040;line-height:1.2;">${promotorNombre}</div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Title -->
            <tr>
              <td class="inner-pad" style="padding:18px 28px 4px;">
                <h1 class="h1" style="margin:0;font-size:22px;line-height:1.3;color:#15181F;font-weight:700;">
                  ${saludo}, ${promotorNombre} te invita a colaborar${promocionNombre ? ` en <span style="color:#2C6FDB;">${promocionNombre}</span>` : ""}.
                </h1>
              </td>
            </tr>

            <!-- Subtitle -->
            <tr>
              <td class="inner-pad" style="padding:10px 28px 6px;">
                <p style="margin:0;font-size:14px;line-height:1.6;color:#4A5260;">
                  Podrás comercializar ${promocionNombre ? "esta promoción" : `las promociones de ${promotorNombre}`} desde tu cuenta Byvaro en un entorno seguro, con registros protegidos y comisiones transparentes.
                </p>
              </td>
            </tr>

            ${promoDetailsBlock}

            ${unidadesBlock}

            ${mensajeBlock}

            <!-- Commission highlight -->
            <tr>
              <td class="inner-pad" style="padding:14px 28px 18px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F5F7FA;border-radius:14px;">
                  <tr>
                    <td style="padding:20px 22px;">
                      <div style="font-size:15px;color:#2B3040;font-weight:600;line-height:1.3;">Comisión por venta</div>
                      <div style="font-size:11px;color:#8A8F9B;margin-top:2px;">IVA incluido · sobre el importe de la venta</div>
                    </td>
                    <td align="right" style="padding:20px 22px;">
                      <div class="comm-num" style="font-size:34px;font-weight:700;color:#15181F;line-height:1;">${comisionOfrecida}%</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Key conditions grid -->
            <tr>
              <td class="inner-pad" style="padding:0 28px 20px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td width="50%" class="col-stack" style="padding-right:6px;vertical-align:top;">
                      <div style="padding:14px 16px;border:1px solid #E7EAF0;border-radius:12px;">
                        <div style="font-size:11px;color:#8A8F9B;text-transform:uppercase;letter-spacing:0.6px;">Duración</div>
                        <div style="font-size:16px;font-weight:700;color:#15181F;margin-top:4px;">${duracionTxt}</div>
                      </div>
                    </td>
                    <td width="50%" class="col-stack col-stack-gap" style="padding-left:6px;vertical-align:top;">
                      <div style="padding:14px 16px;border:1px solid #E7EAF0;border-radius:12px;">
                        <div style="font-size:11px;color:#8A8F9B;text-transform:uppercase;letter-spacing:0.6px;">Validez del link</div>
                        <div style="font-size:16px;font-weight:700;color:#15181F;margin-top:4px;">${expiraEnDias} días</div>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            ${pagoRows ? `
            <!-- Payment splits -->
            <tr>
              <td class="inner-pad" style="padding:0 28px 20px;">
                <div style="font-size:11px;color:#8A8F9B;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:8px;">Forma de pago al colaborador</div>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #E7EAF0;border-radius:12px;overflow:hidden;border-collapse:separate;">
                  <tr style="background:#F5F7FA;">
                    <td style="padding:10px 12px;font-size:11px;color:#8A8F9B;text-transform:uppercase;letter-spacing:0.5px;">Tramo</td>
                    <td style="padding:10px 12px;font-size:11px;color:#8A8F9B;text-transform:uppercase;letter-spacing:0.5px;">Pago completado</td>
                    <td style="padding:10px 12px;font-size:11px;color:#8A8F9B;text-transform:uppercase;letter-spacing:0.5px;">A colaborador</td>
                  </tr>
                  ${pagoRows}
                </table>
              </td>
            </tr>` : ""}

            ${datosList ? `
            <!-- Datos obligatorios -->
            <tr>
              <td class="inner-pad" style="padding:0 28px 24px;">
                <div style="font-size:11px;color:#8A8F9B;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px;">Datos obligatorios para el registro</div>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="padding:14px 16px;background:#FAFBFC;border:1px solid #E7EAF0;border-radius:12px;">
                  ${datosList}
                </table>
              </td>
            </tr>` : ""}

            <!-- CTA -->
            <tr>
              <td align="center" class="inner-pad" style="padding:8px 28px 28px;">
                <a href="${acceptUrl}" class="cta-btn"
                   style="display:inline-block;background:#2C6FDB;color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;padding:14px 34px;border-radius:999px;box-shadow:0 4px 14px rgba(44,111,219,0.25);">
                  Ver invitación
                </a>
                <div style="margin-top:12px;font-size:11px;color:#8A8F9B;line-height:1.5;word-break:break-all;">
                  O copia este enlace: <a href="${acceptUrl}" style="color:#2C6FDB;text-decoration:none;">${acceptUrl}</a>
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td class="inner-pad" style="padding:20px 28px;background:#FAFBFC;border-top:1px solid #E7EAF0;">
                <p style="margin:0;font-size:11px;line-height:1.6;color:#8A8F9B;">
                  Recibes este email porque ${promotorNombre} te ha invitado a colaborar en Byvaro.
                  Si no quieres recibir más invitaciones de este promotor, ignora este mensaje.
                </p>
              </td>
            </tr>

          </table>

          <div style="margin-top:14px;font-size:11px;color:#A0A5AF;">
            Byvaro · Plataforma para promotores inmobiliarios de obra nueva.
          </div>
        </td>
      </tr>
    </table>
  </center>
</body>
</html>`;

  return { asunto, html };
}

/* ─── Helper · convertir invitación pendiente en fila sintética de agencia
   para que aparezca en la lista de Colaboradores y en la ficha de promoción
   mientras la agencia no ha respondido. ───────────────────────────────── */

export function invitacionToSyntheticAgency(inv: Invitacion): Agency {
  const displayName = inv.nombreAgencia?.trim() || inv.emailAgencia;
  return {
    id: inv.id,
    name: displayName,
    logo: undefined,
    cover: undefined,
    location: inv.emailAgencia,
    type: "Agency",
    description: inv.promocionNombre
      ? `Invitación pendiente · ${inv.promocionNombre}`
      : "Invitación pendiente",
    visitsCount: 0,
    registrations: 0,
    salesVolume: 0,
    status: "pending",
    offices: [],
    promotionsCollaborating: inv.promocionId ? [inv.promocionId] : [],
    totalPromotionsAvailable: 0,
    isNewRequest: false,
    origen: "invited",
    estadoColaboracion: "contrato-pendiente",
    registrosAportados: 0,
    ventasCerradas: 0,
    comisionMedia: inv.comisionOfrecida,
    solicitudPendiente: false,
    mensajeSolicitud: inv.mensajePersonalizado || undefined,
  };
}
