/**
 * emailDomains.ts · Catálogos canónicos de dominios de email.
 *
 * QUÉ
 * ----
 * Dos sets cerrados, mantenidos a mano:
 *
 *   1. PUBLIC_EMAIL_DOMAINS · proveedores de email gratuitos /
 *      personales · NO deben tratarse como "dominio corporativo" al
 *      detectar pertenencia a una agencia. Si un usuario llega con
 *      `juan@gmail.com` jamás debe enlazarse con otra cuenta
 *      `pedro@gmail.com` por dominio común.
 *
 *   2. DISPOSABLE_EMAIL_DOMAINS · proveedores de email temporales /
 *      "throwaway" · usados típicamente para evadir registros,
 *      crear cuentas falsas y testing. Recomendado RECHAZAR el alta
 *      (no solo tratarlo como público) · el sistema debería pedir
 *      un email permanente.
 *
 * POR QUÉ
 * -------
 * Sin esto, la detección por dominio del flujo `/invite/:token`
 * (`src/lib/agencyDomainLookup.ts`) generaría falsos positivos · el
 * sistema "uniría" a usuarios distintos que casualmente comparten
 * proveedor de email gratuito.
 *
 * MANTENIMIENTO
 * -------------
 * - Añadir cualquier nuevo dominio público en orden alfabético dentro
 *   del bloque regional correspondiente · facilita mergeo de PRs
 *   futuros.
 * - Si Microsoft / Google / Apple lanza un TLD nuevo
 *   (ej. `outlook.es-mx`), añadirlo aquí. Buscar fuentes oficiales.
 * - Para `DISPOSABLE_EMAIL_DOMAINS` mantener sincronizado con la
 *   lista de https://github.com/disposable/disposable-email-domains
 *   o equivalente cuando se actualice.
 *
 * BACKEND PRODUCCIÓN
 * ------------------
 * Cuando exista API real, este catálogo debe vivir en una tabla
 * `email_domain_classifications(domain text PK, kind enum, source,
 * updated_at)` que se pueda actualizar sin redeploy. Mientras tanto,
 * mantener este archivo como fuente única de verdad y exportarlo
 * para reutilización en:
 *   - Frontend · gates de invitación, validación de signup.
 *   - Backend · endpoint `GET /api/agencies/by-domain` (ver
 *     `docs/backend-integration.md §17`) · debe usar la misma lista
 *     para garantizar consistencia entre cliente/server.
 *   - Tests · evitar magic strings y mantener fixtures coherentes.
 *
 * REFERENCIAS
 * -----------
 * - `docs/backend-integration.md §17 · Detección por dominio`.
 * - `src/lib/agencyDomainLookup.ts · findAgencyByEmailDomain`.
 * - CLAUDE.md REGLA DE ORO · Plantillas del sistema (las plantillas
 *   `auth-domain-match-notify-admin` dependen de esta detección).
 */

/* ════════════════════════════════════════════════════════════════
 *  PUBLIC EMAIL DOMAINS
 *  ~80 dominios · proveedores personales / gratuitos globales
 *  agrupados por región para mantenibilidad.
 * ════════════════════════════════════════════════════════════════ */

const PUBLIC_DOMAINS_LIST = [
  /* ── Google ── */
  "gmail.com", "googlemail.com",

  /* ── Microsoft (global + localizados) ──
   *  Outlook / Hotmail / Live · MS opera distintos TLDs por región
   *  pero todos son cuentas personales gratuitas. */
  "outlook.com", "outlook.es", "outlook.fr", "outlook.de", "outlook.it",
  "outlook.com.br", "outlook.com.ar", "outlook.com.mx", "outlook.com.au",
  "hotmail.com", "hotmail.es", "hotmail.fr", "hotmail.de", "hotmail.it",
  "hotmail.co.uk", "hotmail.com.ar", "hotmail.com.mx", "hotmail.com.br",
  "live.com", "live.es", "live.fr", "live.de", "live.it",
  "live.co.uk", "live.com.mx", "live.com.ar",
  "msn.com",

  /* ── Yahoo (global + localizados + alias) ── */
  "yahoo.com", "yahoo.es", "yahoo.fr", "yahoo.de", "yahoo.it",
  "yahoo.co.uk", "yahoo.com.mx", "yahoo.com.ar", "yahoo.com.br",
  "ymail.com", "rocketmail.com",

  /* ── Apple ── */
  "icloud.com", "me.com", "mac.com",

  /* ── AOL (Verizon Media) ── */
  "aol.com", "aim.com",

  /* ── Privacidad / encriptado ── */
  "proton.me", "protonmail.com", "pm.me",
  "tutanota.com", "tutamail.com", "tuta.io",
  "hushmail.com", "mailbox.org",

  /* ── GMX (alemán pero global) ── */
  "gmx.com", "gmx.net", "gmx.de", "gmx.es", "gmx.fr", "gmx.it",
  "gmx.co.uk", "gmx.us", "gmx.at",

  /* ── Otros providers globales ── */
  "fastmail.com", "fastmail.fm", "mail.com",
  "zoho.com",

  /* ── España · ISPs históricos ── */
  "terra.es", "ya.com", "telefonica.net", "ono.com", "jazztel.es",

  /* ── Francia · operadoras / ISPs ── */
  "orange.fr", "wanadoo.fr", "free.fr", "sfr.fr",
  "laposte.net", "numericable.fr", "neuf.fr", "club-internet.fr",
  "bbox.fr",

  /* ── Alemania ── */
  "web.de", "t-online.de", "freenet.de", "arcor.de",

  /* ── Italia ── */
  "libero.it", "tin.it", "alice.it", "virgilio.it", "tiscali.it",
  "email.it",

  /* ── Reino Unido · ISPs ── */
  "btinternet.com", "sky.com", "talktalk.net", "virginmedia.com",
  "ntlworld.com", "blueyonder.co.uk",

  /* ── Rusia / CIS ── */
  "mail.ru", "list.ru", "bk.ru", "inbox.ru", "rambler.ru",
  "yandex.com", "yandex.ru", "ukr.net",

  /* ── Asia ── */
  "qq.com", "163.com", "126.com", "sina.com", "sohu.com",
  "naver.com", "daum.net", "hanmail.net",

  /* ── Brasil / LATAM ── */
  "uol.com.br", "terra.com.br", "bol.com.br", "ig.com.br",
] as const;

export const PUBLIC_EMAIL_DOMAINS: ReadonlySet<string> = new Set(PUBLIC_DOMAINS_LIST);

/* ════════════════════════════════════════════════════════════════
 *  DISPOSABLE EMAIL DOMAINS
 *  Sub-lista curada · subset frecuentemente usado de
 *  https://github.com/disposable/disposable-email-domains. NO
 *  pretende ser exhaustivo · sirve para bloquear los más comunes.
 *  En backend real, importar el dataset completo y refrescar
 *  semanalmente.
 * ════════════════════════════════════════════════════════════════ */

const DISPOSABLE_DOMAINS_LIST = [
  /* Mailinator family · alias de proxy a un mismo inbox público. */
  "mailinator.com", "mailinator.net", "mailinator2.com",
  "binkmail.com", "bobmail.info", "chammy.info", "devnullmail.com",
  "letthemeatspam.com", "mailin8r.com", "mailinator.org",
  "mailinator2.net", "notmailinator.com", "reallymymail.com",
  "safetymail.info", "sendspamhere.com", "sogetthis.com",
  "spambooger.com", "streetwisemail.com", "thisisnotmyrealemail.com",
  "tradermail.info", "veryrealemail.com",
  /* Guerrilla Mail family. */
  "guerrillamail.com", "guerrillamail.biz", "guerrillamail.de",
  "guerrillamail.info", "guerrillamail.net", "guerrillamail.org",
  "guerrillamailblock.com", "spam4.me", "grr.la", "sharklasers.com",
  /* 10MinuteMail. */
  "10minutemail.com", "10minutemail.net",
  "10minutemail.de", "10minutemail.us",
  /* Yopmail. */
  "yopmail.com", "yopmail.fr", "yopmail.net", "cool.fr.nf",
  "courriel.fr.nf", "jetable.fr.nf", "moncourrier.fr.nf",
  /* Throwaway / Trashmail / temp-mail. */
  "throwaway.email", "throwawaymail.com", "trashmail.com",
  "trashmail.de", "trashmail.io", "trashmail.me", "trashmail.net",
  "trashmail.ws", "temp-mail.io", "temp-mail.org", "tempmail.com",
  "tempmailaddress.com", "tempmailo.com",
  "dispostable.com", "fakeinbox.com", "getairmail.com",
  /* Maildrop / Mailcatch / Spamgourmet. */
  "maildrop.cc", "mailcatch.com", "spamgourmet.com", "spamgourmet.net",
  "spamgourmet.org",
  /* Discard / nada / others. */
  "discard.email", "discardmail.com", "discardmail.de",
  "nada.email", "anonbox.net", "incognitomail.org",
  "mytemp.email", "mt2014.com", "mt2015.com",
] as const;

export const DISPOSABLE_EMAIL_DOMAINS: ReadonlySet<string> = new Set(DISPOSABLE_DOMAINS_LIST);

/* ════════════════════════════════════════════════════════════════
 *  Helpers
 * ════════════════════════════════════════════════════════════════ */

/** Devuelve el dominio en minúscula, o null si el email es inválido. */
export function getEmailDomain(email: string | null | undefined): string | null {
  if (!email) return null;
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 0) return null;
  const dom = e.slice(at + 1).trim();
  return dom || null;
}

/** ¿El email pertenece a un proveedor público / personal? */
export function isPublicEmailDomain(email: string | null | undefined): boolean {
  const dom = getEmailDomain(email);
  return !!dom && PUBLIC_EMAIL_DOMAINS.has(dom);
}

/** ¿El email es un proveedor temporal / throwaway? Recomendado RECHAZAR
 *  el alta · pedir email permanente. */
export function isDisposableEmailDomain(email: string | null | undefined): boolean {
  const dom = getEmailDomain(email);
  return !!dom && DISPOSABLE_EMAIL_DOMAINS.has(dom);
}

/** ¿El email puede considerarse "corporativo" (susceptible de
 *  pertenecer a una agencia)? · NO si es público ni si es disposable. */
export function isCorporateEmailDomain(email: string | null | undefined): boolean {
  if (!email) return false;
  if (isPublicEmailDomain(email)) return false;
  if (isDisposableEmailDomain(email)) return false;
  /* Subdominios distintos no se consideran "del dominio corporativo
   * principal" para evitar lookups laxos · ver
   * `agencyDomainLookup.ts`. Aquí solo decimos que el dominio NO es
   * público / temporal · la decisión de subdominio la hace el caller. */
  return getEmailDomain(email) !== null;
}
