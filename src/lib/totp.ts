/**
 * Helpers TOTP / 2FA.
 *
 * IMPORTANTE — separación cliente / backend:
 *
 * EN CLIENTE (este archivo):
 *   - Construir el URI `otpauth://` que va dentro del QR (UX).
 *   - Mock de generar secret y validar código mientras no haya backend.
 *
 * EN BACKEND (cuando exista, NO hacer en cliente):
 *   - Generar el secret base32 con CSPRNG (`crypto.randomBytes`).
 *   - Persistir el secret CIFRADO (KMS / AES-GCM, no en plaintext).
 *   - Validar el código TOTP server-side con la librería oficial
 *     (`speakeasy.totp.verify` u `otplib`), respetando ventana ±1 step
 *     y rate-limit por usuario para evitar brute-force.
 *   - Devolver al cliente solo: { secret_for_qr (one-time), otpauth_uri }
 *     y nunca persistir el secret en localStorage del cliente.
 *
 * Endpoints sugeridos:
 *   POST /api/me/2fa/setup          → { secret, otpauthUri }
 *   POST /api/me/2fa/activate       { code } → 200 ok / 400 invalid
 *   POST /api/me/2fa/verify         { code } → 200 ok / 400 invalid
 *   POST /api/me/2fa/disable        { code } → 200 ok
 *   POST /api/me/2fa/backup-codes/regenerate → { codes[] }
 *
 * Mientras tanto, esta capa simula esos endpoints en localStorage para
 * que la UI pueda probarse end-to-end.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Genera un secret base32 aleatorio de 32 caracteres (160 bits).
 *
 * MOCK · TODO(backend): este secret debe generarse en el backend con
 * `crypto.randomBytes(20).toString("base32")` y nunca devolverse al
 * cliente más que una vez para mostrar el QR.
 */
export function generateMockSecret(length = 32): string {
  let out = "";
  const cryptoApi = typeof window !== "undefined" ? window.crypto : undefined;
  if (cryptoApi?.getRandomValues) {
    const arr = new Uint8Array(length);
    cryptoApi.getRandomValues(arr);
    for (let i = 0; i < length; i++) {
      out += BASE32_ALPHABET[arr[i] % BASE32_ALPHABET.length];
    }
  } else {
    for (let i = 0; i < length; i++) {
      out += BASE32_ALPHABET[Math.floor(Math.random() * BASE32_ALPHABET.length)];
    }
  }
  return out;
}

/**
 * Formatea un secret en grupos de 4 caracteres separados por espacio
 * para que el usuario pueda introducirlo manualmente en su app si no
 * puede escanear el QR.
 */
export function formatSecret(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

export type OtpAuthParams = {
  /** Nombre del producto (aparece en la app autenticadora). */
  issuer: string;
  /** Cuenta del usuario, normalmente su email. */
  account: string;
  /** Secret base32 sin espacios. */
  secret: string;
  /** Algoritmo TOTP (default SHA1, lo soportan TODAS las apps). */
  algorithm?: "SHA1" | "SHA256" | "SHA512";
  /** Dígitos del código generado (default 6). */
  digits?: 6 | 8;
  /** Periodo de rotación en segundos (default 30). */
  period?: 30 | 60;
};

/**
 * Construye el URI `otpauth://` estándar (Key Uri Format de Google
 * Authenticator). Es lo que se codifica dentro del QR.
 *
 * Ref: https://github.com/google/google-authenticator/wiki/Key-Uri-Format
 */
export function buildOtpAuthUri({
  issuer, account, secret,
  algorithm = "SHA1", digits = 6, period = 30,
}: OtpAuthParams): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret: secret.replace(/\s+/g, ""),
    issuer,
    algorithm,
    digits: String(digits),
    period: String(period),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
