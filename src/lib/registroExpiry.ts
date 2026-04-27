/**
 * registroExpiry.ts · Caducidad por inactividad client-side (Phase 2).
 *
 * El cliente NO modifica datos en backend · solo CALCULA on-demand si
 * un Registro debería estar caducado y muestra el aviso. Cuando exista
 * cron real, el backend hará la transición y ya no hace falta este
 * helper · pero hasta entonces, evita que la UI mienta sobre estados
 * que técnicamente ya expiraron.
 *
 * Reglas (alineadas con `docs/registration-system.md §2.3`):
 *
 *   · `preregistro_activo` con `validezRegistroDias` configurada en la
 *     promo → caduca si `daysSince(decidedAt) >= validezRegistroDias`
 *     y NO hay `visitOutcome === "realizada"`.
 *   · Si la visita ya está agendada en el futuro, NO caduca (la fecha
 *     futura "extiende" la atribución hasta esa fecha + buffer).
 *   · Buffer post-visita: 7 días sin marcar realizada/no_show → caduca.
 *
 * TODO(backend): cron diario `expirePreregistrations` que:
 *   1. Selecciona `preregistro_activo` con `decided_at + validez < now`
 *      AND (visit_date IS NULL OR visit_date + 7d < now).
 *   2. Update masivo a `estado = 'caducado'` con
 *      `visit_outcome = 'no_show_cliente'` (default · sin acción humana).
 *   3. Notifica a la agencia (in-app + digest).
 *
 * Mientras tanto · el frontend usa `isExpired()` para:
 *   - Pintar pill "Próximo a caducar" 48h antes (UI hint).
 *   - Pintar el registro como `caducado` aunque el estado en localStorage
 *     siga siendo `preregistro_activo` (visualmente coherente).
 */

import type { Registro } from "@/data/records";

const DEFAULT_VALIDITY_DAYS = 30;       // si la promo no declara · 30 días
const POST_VISIT_GRACE_DAYS = 7;        // si visita pasada sin outcome → cadua
const NEAR_EXPIRY_WARNING_DAYS = 2;     // 48h antes muestra "próximo a caducar"

export type ExpiryStatus = {
  /** El registro técnicamente debería estar `caducado` ya. */
  expired: boolean;
  /** Está dentro del umbral de aviso (48h antes). */
  nearExpiry: boolean;
  /** Días restantes hasta caducidad (negativo si ya pasó). */
  daysRemaining: number;
  /** Razón humana (para tooltip / banner). */
  reason: string;
};

/**
 * Calcula si un Registro está caducado (o próximo a caducar) basado en
 * la fecha de decisión + visitDate + validezRegistroDias.
 *
 * @param registro · el registro a evaluar.
 * @param validezRegistroDias · plazo configurado en la promo.
 *   Si 0 o undefined · se asume `DEFAULT_VALIDITY_DAYS`.
 * @param now · permite testear con fechas distintas. Default Date.now().
 */
export function getExpiryStatus(
  registro: Registro,
  validezRegistroDias: number | undefined,
  now: number = Date.now(),
): ExpiryStatus {
  /* Solo aplicamos a preregistro_activo · otros estados no caducan. */
  if (registro.estado !== "preregistro_activo") {
    return { expired: false, nearExpiry: false, daysRemaining: Infinity, reason: "" };
  }

  const validity = validezRegistroDias && validezRegistroDias > 0
    ? validezRegistroDias
    : DEFAULT_VALIDITY_DAYS;

  /* Si hay visita futura programada, la fecha de visita marca el
     límite (en lugar de decidedAt + validity). */
  const visitTs = registro.visitDate ? new Date(registro.visitDate).getTime() : null;
  if (visitTs && visitTs > now) {
    /* Visita en el futuro · no caduca aún · pero si está cerca,
       avisamos solo si la visita es <= 2 días. */
    const daysToVisit = Math.ceil((visitTs - now) / (1000 * 60 * 60 * 24));
    return {
      expired: false,
      nearExpiry: false,        // pre-visita · no consideramos near-expiry
      daysRemaining: daysToVisit,
      reason: `Visita en ${daysToVisit}d`,
    };
  }

  /* Visita pasada · gracia post-visita de 7 días sin outcome. */
  if (visitTs && visitTs <= now) {
    const daysSinceVisit = Math.floor((now - visitTs) / (1000 * 60 * 60 * 24));
    const remaining = POST_VISIT_GRACE_DAYS - daysSinceVisit;
    return {
      expired: remaining < 0,
      nearExpiry: remaining >= 0 && remaining <= NEAR_EXPIRY_WARNING_DAYS,
      daysRemaining: remaining,
      reason: remaining < 0
        ? `Visita pasada hace ${daysSinceVisit}d sin outcome`
        : `Marca el resultado de la visita en ${remaining}d`,
    };
  }

  /* Sin visita programada · cuenta desde decidedAt + validity. */
  const startTs = registro.decidedAt
    ? new Date(registro.decidedAt).getTime()
    : new Date(registro.fecha).getTime();
  const expiryTs = startTs + validity * 24 * 60 * 60 * 1000;
  const remaining = Math.ceil((expiryTs - now) / (1000 * 60 * 60 * 24));

  return {
    expired: remaining < 0,
    nearExpiry: remaining >= 0 && remaining <= NEAR_EXPIRY_WARNING_DAYS,
    daysRemaining: remaining,
    reason: remaining < 0
      ? `Caducó hace ${Math.abs(remaining)}d sin visita`
      : remaining === 0
        ? "Caduca hoy si no se programa visita"
        : `Caduca en ${remaining}d sin visita programada`,
  };
}

/** Versión booleana simple · útil para filtros. */
export function isExpired(registro: Registro, validezRegistroDias?: number): boolean {
  return getExpiryStatus(registro, validezRegistroDias).expired;
}

/** Versión booleana para "muéstrame banner amarillo". */
export function isNearExpiry(registro: Registro, validezRegistroDias?: number): boolean {
  return getExpiryStatus(registro, validezRegistroDias).nearExpiry;
}
