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

import { useCallback, useEffect, useState } from "react";

export type EstadoInvitacion = "pendiente" | "aceptada" | "rechazada" | "caducada";

export interface Invitacion {
  id: string;
  token: string;                 // token único del link
  emailAgencia: string;
  nombreAgencia: string;
  mensajePersonalizado: string;
  comisionOfrecida: number;      // %
  idiomaEmail: "es" | "en" | "fr" | "de" | "pt" | "it";
  estado: EstadoInvitacion;
  createdAt: number;
  expiraEn: number;              // timestamp ms
  respondidoEn?: number;
}

const STORAGE_KEY = "byvaro-invitaciones";
const VALIDEZ_DIAS = 30;

function loadAll(): Invitacion[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    // Marcar caducadas automáticamente
    const now = Date.now();
    return list.map((i: Invitacion) =>
      i.estado === "pendiente" && i.expiraEn < now ? { ...i, estado: "caducada" as EstadoInvitacion } : i
    );
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
    mensajePersonalizado: string;
    comisionOfrecida: number;
    idiomaEmail: Invitacion["idiomaEmail"];
  }) => {
    const actual = loadAll();
    const nueva: Invitacion = {
      id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      token: generateToken(),
      emailAgencia: data.emailAgencia.trim().toLowerCase(),
      nombreAgencia: data.nombreAgencia.trim(),
      mensajePersonalizado: data.mensajePersonalizado.trim(),
      comisionOfrecida: data.comisionOfrecida,
      idiomaEmail: data.idiomaEmail,
      estado: "pendiente",
      createdAt: Date.now(),
      expiraEn: Date.now() + VALIDEZ_DIAS * 24 * 60 * 60 * 1000,
    };
    saveAll([...actual, nueva]);
    return nueva;
  }, []);

  const revocar = useCallback((id: string) => {
    const list = loadAll();
    saveAll(list.map(i => i.id === id ? { ...i, estado: "rechazada" as EstadoInvitacion, respondidoEn: Date.now() } : i));
  }, []);

  const eliminar = useCallback((id: string) => {
    const list = loadAll();
    saveAll(list.filter(i => i.id !== id));
  }, []);

  const reenviar = useCallback((id: string) => {
    const list = loadAll();
    saveAll(list.map(i => i.id === id ? {
      ...i,
      expiraEn: Date.now() + VALIDEZ_DIAS * 24 * 60 * 60 * 1000,
      estado: "pendiente" as EstadoInvitacion,
    } : i));
  }, []);

  const pendientes = lista.filter(i => i.estado === "pendiente");
  const aceptadas  = lista.filter(i => i.estado === "aceptada");
  const rechazadas = lista.filter(i => i.estado === "rechazada");
  const caducadas  = lista.filter(i => i.estado === "caducada");

  return {
    lista, pendientes, aceptadas, rechazadas, caducadas,
    invitar, revocar, eliminar, reenviar,
  };
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
