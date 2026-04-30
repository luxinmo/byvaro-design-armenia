/**
 * Generador determinista de la conversación WhatsApp con un contacto +
 * persistencia local de mensajes nuevos.
 *
 * - Los mensajes "históricos" se generan a partir del id del contacto
 *   (mismo contacto = mismo historial).
 * - Los mensajes nuevos que el usuario envíe desde la UI se persisten
 *   en `byvaro.contact.<id>.whatsapp.v1` y se mezclan en orden con los
 *   históricos.
 *
 * TODO(backend): GET /api/contacts/:id/whatsapp/messages reemplaza este
 *   mock; el envío va por POST y los nuevos llegan vía socket / poll.
 */

import type { Contact } from "./types";

export type WhatsAppMessageKind =
  | "text" | "voice" | "image" | "document" | "location" | "contact" | "template";

export type WhatsAppMessage = {
  id: string;
  direction: "incoming" | "outgoing";
  /** Solo en outgoing: agente del workspace que envió el mensaje. */
  authorId?: string;
  authorName?: string;
  /** Tipo de mensaje. Default "text". */
  kind?: WhatsAppMessageKind;
  /** Texto principal — en voice es undefined, en image es caption opcional. */
  text?: string;
  /** Metadatos según el tipo:
   *   voice    → { durationSec }
   *   image    → { fileName, sizeKb, dataUrl } — dataUrl es el contenido real del archivo
   *   document → { fileName, sizeKb }
   *   location → { lat, lng, label }
   *   contact  → { contactName, phone }
   *   template → { templateName }
   */
  meta?: Record<string, string | number>;
  /** ISO datetime. */
  timestamp: string;
  read?: boolean;
};

const STORAGE_KEY = (contactId: string) => `byvaro.contact.${contactId}.whatsapp.v1`;

/* ══════ PRNG determinista (mismo generador que contactDetailMock) ══════ */
function seedFromId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(id.length - 1 - i); // invertimos para diferenciar del seed del detail
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number) {
  let a = seed;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TEAM = [
  { id: "u1", name: "Arman Rahmanov" },
  { id: "u2", name: "Laura Gómez" },
  { id: "u3", name: "Diego Sánchez" },
  { id: "u4", name: "Marta Jiménez" },
];

const INCOMING_SAMPLES = [
  "Hola, ¿podríamos visitar el ático mañana por la mañana?",
  "Gracias por la info, lo comento con mi pareja.",
  "¿La unidad incluye plaza de garaje?",
  "Perfecto, confirmamos visita el viernes 17:00.",
  "¿Aceptáis financiación con un banco extranjero?",
  "Estoy interesado en ver más opciones similares.",
  "He leído el contrato, tengo dos dudas.",
  "Mañana llegamos a Málaga, podemos pasar.",
];

const OUTGOING_SAMPLES = [
  "¡Hola! Sí, mañana a las 11h tengo disponibilidad.",
  "Te envío ahora la ficha técnica completa.",
  "Sí, todas las unidades incluyen una plaza de garaje y trastero.",
  "Perfecto, te confirmo la visita y te envío ubicación.",
  "Trabajamos con varios bancos, te paso un contacto.",
  "Te he enviado por email otras 3 opciones similares.",
  "Por supuesto, las resolvemos en la visita o por aquí.",
  "Genial, podemos vernos en la oficina o directamente en obra.",
];

/** Resta `minutes` minutos a "ahora" y devuelve ISO. */
function minutesAgoISO(minutes: number): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - minutes);
  return d.toISOString();
}

/**
 * Genera la conversación histórica entre el contacto y el equipo.
 * Determinista por id: mismo contacto → siempre mismos mensajes.
 */
export function buildHistoricalMessages(contact: Contact): WhatsAppMessage[] {
  const rng = mulberry32(seedFromId(contact.id));
  const count = 8 + Math.floor(rng() * 8); // 8-15 mensajes
  const messages: WhatsAppMessage[] = [];

  /* Vamos hacia atrás en el tiempo: el último mensaje es el más cercano
   * a "ahora", el primero es el más viejo. Insertamos al principio. */
  let minutesBack = 5 + Math.floor(rng() * 30);
  let currentDirection: "incoming" | "outgoing" = rng() > 0.5 ? "incoming" : "outgoing";

  for (let i = 0; i < count; i++) {
    const isIncoming = currentDirection === "incoming";
    const sampleArr = isIncoming ? INCOMING_SAMPLES : OUTGOING_SAMPLES;
    const text = sampleArr[Math.floor(rng() * sampleArr.length)];

    let outgoingMeta: { authorId: string; authorName: string } | undefined;
    if (!isIncoming) {
      const agent = TEAM[Math.floor(rng() * TEAM.length)];
      outgoingMeta = { authorId: agent.id, authorName: agent.name };
    }

    messages.unshift({
      id: `wa-${contact.id}-${i}`,
      direction: currentDirection,
      ...(outgoingMeta ?? {}),
      text,
      timestamp: minutesAgoISO(minutesBack),
      read: true,
    });

    /* Avanzamos hacia atrás entre 30 min y 6 horas. Algunos saltos
     * grandes para simular días distintos. */
    minutesBack += 30 + Math.floor(rng() * 360);
    if (rng() > 0.7) minutesBack += 60 * 24; // a veces saltamos un día

    /* La dirección alterna pero a veces el mismo lado manda 2 seguidos. */
    if (rng() > 0.3) {
      currentDirection = currentDirection === "incoming" ? "outgoing" : "incoming";
    }
  }

  return messages;
}

/** Lee mensajes guardados localmente (los que el usuario envía). */
export function loadStoredMessages(contactId: string): WhatsAppMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY(contactId));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

/** Añade un mensaje nuevo enviado por el usuario actual. */
export function appendOutgoingMessage(
  contactId: string,
  msg: {
    authorId: string;
    authorName: string;
    kind?: WhatsAppMessageKind;
    text?: string;
    meta?: Record<string, string | number>;
  },
): WhatsAppMessage {
  const message: WhatsAppMessage = {
    id: `wa-${contactId}-out-${Date.now()}`,
    direction: "outgoing",
    authorId: msg.authorId,
    authorName: msg.authorName,
    kind: msg.kind ?? "text",
    text: msg.text,
    meta: msg.meta,
    timestamp: new Date().toISOString(),
    read: true,
  };
  const existing = loadStoredMessages(contactId);
  const next = [...existing, message];
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY(contactId), JSON.stringify(next));
  }
  /* Write-through · contacts.metadata.whatsappMessages.
   *  Cuando el backend conecte Twilio/WhatsApp Business API real, esto
   *  cambia a INSERT en whatsapp_messages con conversation_id resuelto. */
  void (async () => {
    const { mergeContactMetadata } = await import("@/lib/contactMetadataSync");
    await mergeContactMetadata(contactId, { whatsappMessages: next });
  })();
  return message;
}

/** Devuelve toda la conversación: histórica + persistida, ordenada. */
export function loadConversation(contact: Contact): WhatsAppMessage[] {
  const all = [...buildHistoricalMessages(contact), ...loadStoredMessages(contact.id)];
  return all.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
