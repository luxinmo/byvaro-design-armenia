/**
 * contactOrigins.ts · Mutación canónica de `Contact.origins[]`.
 *
 * Único punto de entrada para añadir un origen nuevo a un contacto:
 * `appendOrigin(contact, origin)` actualiza `latestSource` y mete
 * el origen al array sin sobrescribir `primarySource`.
 *
 * Ver `docs/contact-origins-audit.md`.
 *
 * Idempotencia · ventana ±1h: si llega el mismo `(source, refId)` en
 * un margen de 1 hora del último, NO se duplica · evita ruido de
 * webhooks repetidos.
 */

import type { Contact, ContactOrigin } from "@/components/contacts/types";

const DEDUP_WINDOW_MS = 60 * 60 * 1000;

/**
 * Devuelve un Contact con el origen añadido. NUNCA sobrescribe
 * `primarySource`. Actualiza `latestSource` siempre que el nuevo
 * origen sea más reciente que el actual.
 *
 * Función pura · no muta el Contact original.
 */
export function appendOrigin(contact: Contact, origin: ContactOrigin): Contact {
  const incomingTs = new Date(origin.occurredAt).getTime();

  // Dedup · si ya hay un entry con misma source + misma refId dentro
  // de la ventana, no añadir.
  const duplicate = contact.origins.find((o) => {
    if (o.source !== origin.source) return false;
    if (o.refId && origin.refId && o.refId === origin.refId) return true;
    const ts = new Date(o.occurredAt).getTime();
    return Math.abs(ts - incomingTs) < DEDUP_WINDOW_MS;
  });
  if (duplicate) return contact;

  const nextOrigins = [...contact.origins, origin];
  // latestSource se actualiza solo si la nueva entry es más reciente.
  const currentLatestTs = new Date(contact.latestSource.occurredAt).getTime();
  const nextLatest = incomingTs >= currentLatestTs ? origin : contact.latestSource;

  return {
    ...contact,
    origins: nextOrigins,
    latestSource: nextLatest,
  };
}

/**
 * Conveniencia · construye un `ContactOrigin` con defaults sensatos
 * para los call-sites que no necesitan personalizar todos los campos.
 */
export function buildOrigin(input: Partial<ContactOrigin> & {
  source: ContactOrigin["source"];
  label: string;
}): ContactOrigin {
  return {
    occurredAt: new Date().toISOString(),
    refType: "manual",
    ...input,
  };
}

/**
 * Cuenta cuántas veces este contacto ha llegado por cada canal · útil
 * para badges de "Visto en N canales" en la UI.
 */
export function countByChannel(contact: Contact): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const o of contact.origins) {
    acc[o.source] = (acc[o.source] ?? 0) + 1;
  }
  return acc;
}

/**
 * Número total de canales DISTINTOS (no entradas) por los que ha venido.
 * Útil para el badge "+N más" en el listado.
 */
export function distinctChannelCount(contact: Contact): number {
  return new Set(contact.origins.map((o) => o.source)).size;
}
