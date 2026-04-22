/**
 * Helper único para leer el estado del 2FA del usuario.
 *
 * El detalle (qrcode, backup codes, método) vive en
 * src/pages/ajustes/seguridad/dos-fa.tsx. Aquí solo exponemos lo
 * mínimo para que otras pantallas sensibles (cambio de contraseña,
 * cerrar sesión, transferir propiedad…) decidan qué tipo de
 * verificación pedir al usuario:
 *  - 2FA activo → código TOTP del authenticator (sin email, instantáneo).
 *  - 2FA inactivo → enviamos código por email.
 */

const KEY = "byvaro.security.2fa.v1";

export type TwoFactorMethod = "app" | "sms";

export type TwoFactorState = {
  enabled: boolean;
  method?: TwoFactorMethod;
  backupCodes?: string[];
  /** Secret base32 — MOCK · TODO(backend): NO debe vivir en el cliente.
   *  En producción el backend lo persiste cifrado y el cliente solo
   *  manda el código a `/verify`. Aquí lo guardamos para que la
   *  validación local de `mockVerifyTotpCode` no acepte cualquier
   *  cosa. Se descarta al desactivar 2FA. */
  secret?: string;
  /** ISO timestamp del momento en que se activó. */
  enabledAt?: string;
};

export function loadTwoFactorState(): TwoFactorState {
  if (typeof window === "undefined") return { enabled: false };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { enabled: false };
    const parsed = JSON.parse(raw) as TwoFactorState;
    return {
      enabled: !!parsed.enabled,
      method: parsed.method,
      backupCodes: parsed.backupCodes,
      secret: parsed.secret,
      enabledAt: parsed.enabledAt,
    };
  } catch { return { enabled: false }; }
}

export function saveTwoFactorState(s: TwoFactorState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearTwoFactorState() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

/**
 * Consume un backup code (lo elimina del array para que no se reuse).
 * Devuelve true si el código existía. MOCK · TODO(backend): debe
 * hacerlo el backend con transacción y registrar evento de auditoría.
 */
export function consumeBackupCode(code: string): boolean {
  const state = loadTwoFactorState();
  if (!state.backupCodes) return false;
  const idx = state.backupCodes.findIndex((c) => c === code.trim());
  if (idx === -1) return false;
  const next = { ...state, backupCodes: [...state.backupCodes] };
  next.backupCodes!.splice(idx, 1);
  saveTwoFactorState(next);
  return true;
}

export function isTwoFactorEnabled(): boolean {
  return loadTwoFactorState().enabled;
}

/**
 * Validación MOCK de un código TOTP / backup code.
 *
 * IMPORTANTE — esto NO es validación TOTP real (RFC 6238). Aceptamos:
 *   - Cualquier código de 6 dígitos (mientras no haya backend, no
 *     podemos calcular el TOTP correcto sin replicar el algoritmo en
 *     cliente, y aunque pudiéramos, el secret tampoco viviría aquí).
 *   - Los backup codes guardados en el state (estos sí los validamos
 *     en serio porque el cliente los conoce).
 *
 * TODO(backend): POST /api/me/2fa/verify { code }
 *   → backend usa `speakeasy.totp.verify({ secret, token: code, window: 1 })`
 *   → 200 ok | 400 invalid-code | 429 too-many-attempts
 *   Y debe rate-limitar por usuario (ej. 5 intentos / 5 min).
 */
export function mockVerifyTotpCode(code: string): boolean {
  const clean = code.trim();
  if (/^\d{6}$/.test(clean)) return true;
  const state = loadTwoFactorState();
  if (state.backupCodes?.includes(clean)) return true;
  return false;
}
