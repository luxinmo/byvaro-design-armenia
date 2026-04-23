/**
 * audit.ts · Huella digital de acciones importantes.
 *
 * QUÉ
 * ----
 * Captura una "huella digital" mínima al ejecutar acciones sensibles
 * (crear un registro, aprobar un registro, cancelar una operación,
 * firmar un contrato). Se guarda junto al objeto de negocio para dejar
 * traza auditable ante disputas.
 *
 * CÓMO
 * ----
 * Lo que el frontend PUEDE capturar sin permisos extra:
 *   - Fecha/hora ISO (client clock).
 *   - User-agent (navigator.userAgent).
 *   - Plataforma (navigator.platform / userAgentData.platform).
 *   - Idioma (navigator.language).
 *   - Zona horaria (Intl.DateTimeFormat().resolvedOptions().timeZone).
 *   - Tamaño de pantalla (screen.width × height).
 *   - Color depth, device memory, hardware concurrency (fingerprint extra).
 *
 * Lo que NO puede capturar (debe rellenar backend):
 *   - IP pública real (requiere request al backend).
 *   - Geolocalización (requiere permiso explícito del usuario).
 *   - Hash fiscal / device ID persistente (requiere cookie httpOnly).
 *
 * TODO(backend): en el endpoint POST /api/promociones/:id/registros,
 * añadir al audit: { ip, ipCountry, ipCity, trueUserAgent, requestId }.
 * El `Registro.audit` del frontend es la parte confiada del cliente;
 * backend NO debe confiar en estos valores para decisiones de negocio,
 * solo como "dato complementario" para la auditoría.
 */

import type { CurrentUser } from "./currentUser";

export interface ActionFingerprint {
  /** Versión del esquema de huella — permite migrar sin romper registros antiguos. */
  v: number;
  /** ISO datetime del cliente en el momento de la acción. */
  capturedAt: string;
  /** User-agent completo del navegador (truncado a 512 chars). */
  userAgent: string;
  /** "MacIntel", "Win32", "Linux x86_64", etc. */
  platform: string;
  /** "es-ES", "en-US", etc. */
  language: string;
  /** IANA timezone, ej. "Europe/Madrid". */
  timezone: string;
  /** Offset en minutos respecto a UTC (negativo = este de Greenwich). */
  timezoneOffset: number;
  /** Dimensiones físicas de la pantalla. */
  screen: { width: number; height: number; pixelRatio: number };
  /** Dimensiones del viewport donde se disparó la acción. */
  viewport: { width: number; height: number };
  /** Quién lo disparó. Útil para trazar acciones sistema vs usuario. */
  actor: {
    id: string;
    name: string;
    email: string;
    role: "developer" | "agency";
    agencyId?: string;
  };
  /** Versión del texto legal aceptado (si aplica). */
  termsVersion?: string;
  /** ISO del momento exacto en que se aceptaron los términos. */
  termsAcceptedAt?: string;
  /* TODO(backend): el backend añade estos campos al recibir la petición:
   *   ip?: string;
   *   ipCountry?: string;
   *   ipCity?: string;
   *   serverReceivedAt?: string;
   */
}

export const AUDIT_FINGERPRINT_VERSION = 1;

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}

/**
 * Captura la huella digital del navegador actual. Llamar **inmediatamente
 * antes** de ejecutar la acción que se está auditando (envío de registro,
 * aprobación, etc.) para que el timestamp sea lo más preciso posible.
 */
export function captureFingerprint(
  user: CurrentUser,
  options?: { termsVersion?: string; termsAcceptedAt?: string },
): ActionFingerprint {
  const now = new Date();
  return {
    v: AUDIT_FINGERPRINT_VERSION,
    capturedAt: now.toISOString(),
    userAgent: safe(() => navigator.userAgent.slice(0, 512), "unknown"),
    platform: safe(() => navigator.platform || "unknown", "unknown"),
    language: safe(() => navigator.language || "unknown", "unknown"),
    timezone: safe(
      () => Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown",
      "unknown",
    ),
    timezoneOffset: now.getTimezoneOffset(),
    screen: {
      width: safe(() => window.screen.width, 0),
      height: safe(() => window.screen.height, 0),
      pixelRatio: safe(() => window.devicePixelRatio, 1),
    },
    viewport: {
      width: safe(() => window.innerWidth, 0),
      height: safe(() => window.innerHeight, 0),
    },
    actor: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.accountType,
      agencyId: user.agencyId,
    },
    termsVersion: options?.termsVersion,
    termsAcceptedAt: options?.termsAcceptedAt,
  };
}

/**
 * Devuelve un resumen humano para mostrar en la UI del detalle del
 * registro — no expone el user-agent completo, solo lo útil.
 */
export function summarizeFingerprint(fp: ActionFingerprint): {
  device: string;
  location: string;
  capturedAt: string;
  actor: string;
} {
  const ua = fp.userAgent.toLowerCase();
  const os =
    ua.includes("mac") ? "macOS" :
    ua.includes("windows") ? "Windows" :
    ua.includes("android") ? "Android" :
    ua.includes("iphone") || ua.includes("ipad") ? "iOS" :
    ua.includes("linux") ? "Linux" :
    "Desconocido";
  const browser =
    ua.includes("edg/") ? "Edge" :
    ua.includes("chrome/") ? "Chrome" :
    ua.includes("safari/") && !ua.includes("chrome/") ? "Safari" :
    ua.includes("firefox/") ? "Firefox" :
    "Navegador";
  return {
    device: `${browser} · ${os}`,
    location: `${fp.timezone}${fp.language ? ` · ${fp.language}` : ""}`,
    capturedAt: fp.capturedAt,
    actor: `${fp.actor.name} · ${fp.actor.email}`,
  };
}
