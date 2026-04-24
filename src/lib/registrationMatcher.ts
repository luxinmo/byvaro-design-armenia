/**
 * registrationMatcher.ts · helpers para saber en qué promociones
 * está ya registrado un cliente.
 *
 * Se usa al programar una visita: cuando el comercial elige un
 * cliente, queremos mostrarle primero las promociones donde ya tiene
 * el registro aceptado (→ la visita está "cubierta" por ese registro)
 * y luego el resto.
 *
 * Si el cliente no tiene registro en la promoción que se quiere
 * visitar, se crea un registro pendiente junto con la visita
 * (`pending-confirmation`). El promotor lo aprueba y la visita pasa
 * a confirmada.
 *
 * TODO(backend): `GET /api/clients/:id/registrations?status=aprobado`
 * o, más simple, `GET /api/promotions?clientId=:id&withRegistrationStatus=1`.
 */

import { registros, type Registro } from "@/data/records";
import {
  developerOnlyPromotions, type DevPromotion,
} from "@/data/developerPromotions";

/** Un cliente para el matcher · admitimos nombre + email como claves
 *  porque la UI puede tener un contacto con id (ya existente) o un
 *  cliente nuevo (solo nombre/email tecleados). */
export type MatcherClient = {
  id?: string;         // contactId si viene de contactos canónicos
  name?: string;       // nombre libre
  email?: string;      // match alternativo
};

export type PromotionWithRegistrationStatus = {
  promotion: DevPromotion;
  /** Registro aceptado para este cliente en esta promoción, si existe. */
  acceptedRegistration?: Registro;
  /** Registro pendiente (aún no aprobado). */
  pendingRegistration?: Registro;
  /** Registro rechazado (el comercial podría querer saberlo para no
   *  enviarlo otra vez sin avisar). */
  rejectedRegistration?: Registro;
};

/** Compara por nombre+email normalizados. Backend real usaría
 *  `clientId` como clave estricta. */
function matchesClient(reg: Registro, client: MatcherClient): boolean {
  if (!client.name && !client.email) return false;
  const regEmail = reg.cliente.email?.toLowerCase().trim() ?? "";
  const regName = reg.cliente.nombre?.toLowerCase().trim() ?? "";
  if (client.email && regEmail && regEmail === client.email.toLowerCase().trim()) {
    return true;
  }
  if (client.name && regName && regName === client.name.toLowerCase().trim()) {
    return true;
  }
  return false;
}

/** Devuelve todas las promociones del catálogo anotadas con el estado
 *  de registro para este cliente · ordenadas: primero las que tienen
 *  registro aprobado, luego el resto. */
export function getPromotionsForClient(
  client: MatcherClient,
): PromotionWithRegistrationStatus[] {
  const regs = registros.filter((r) => matchesClient(r, client));

  const withStatus: PromotionWithRegistrationStatus[] = developerOnlyPromotions.map(
    (promotion) => {
      const matching = regs.filter((r) => r.promotionId === promotion.id);
      return {
        promotion,
        acceptedRegistration: matching.find((r) => r.estado === "aprobado"),
        pendingRegistration: matching.find((r) => r.estado === "pendiente"),
        rejectedRegistration: matching.find((r) => r.estado === "rechazado"),
      };
    },
  );

  // Ordenamos: 1) aprobadas, 2) pendientes, 3) resto (orden original del catálogo).
  return withStatus.sort((a, b) => {
    const rank = (x: PromotionWithRegistrationStatus) =>
      x.acceptedRegistration ? 0 :
      x.pendingRegistration  ? 1 :
      2;
    return rank(a) - rank(b);
  });
}

/** Convenience · promociones agrupadas para UI de 2 secciones. */
export function groupPromotionsByRegistration(client: MatcherClient): {
  accepted: PromotionWithRegistrationStatus[];
  others:   PromotionWithRegistrationStatus[];
} {
  const list = getPromotionsForClient(client);
  return {
    accepted: list.filter((p) => !!p.acceptedRegistration),
    others:   list.filter((p) => !p.acceptedRegistration),
  };
}
