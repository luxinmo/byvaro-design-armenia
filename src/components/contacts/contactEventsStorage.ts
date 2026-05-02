/**
 * Storage append-only de eventos del HISTORIAL de un contacto.
 *
 * Patrón "audit log": cada acción que ocurre en el contacto (crear,
 * editar, asignar, vincular, evaluar visita, comentar, subir doc,
 * enviar email/whatsapp, cambio de status…) llama `recordEvent()`
 * y queda anotado aquí.
 *
 * El tab Historial mezcla los eventos guardados aquí con los del mock
 * determinista (compat con datos pre-existentes).
 *
 * TODO(backend): GET /api/contacts/:id/events (paginado) +
 *   POST /api/events { contactId, type, ... } o, mejor, eventos
 *   inferidos por el backend (cada PATCH/POST ya genera el evento).
 */

import type {
  ContactTimelineEvent, ContactTimelineEventType,
} from "./types";
import { memCache } from "@/lib/memCache";

const KEY = (contactId: string) => `byvaro.contact.${contactId}.events.v1`;

export function loadEvents(contactId: string): ContactTimelineEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = memCache.getItem(KEY(contactId));
    if (!raw) return [];
    return JSON.parse(raw) as ContactTimelineEvent[];
  } catch { return []; }
}

function saveAll(contactId: string, events: ContactTimelineEvent[]): void {
  if (typeof window === "undefined") return;
  /* Cap a 500 eventos por contacto para no llenar localStorage. En
   * producción el backend pagina y trunca con políticas reales. */
  const trimmed = events.slice(0, 500);
  memCache.setItem(KEY(contactId), JSON.stringify(trimmed));
}

/**
 * Registra un evento nuevo. Genera id + timestamp si no se proveen.
 * Se inserta al PRINCIPIO (más reciente arriba) para evitar tener que
 * ordenar al leer.
 */
export function recordEvent(
  contactId: string,
  event: Omit<ContactTimelineEvent, "id" | "timestamp"> & {
    id?: string;
    timestamp?: string;
  },
): ContactTimelineEvent {
  const full: ContactTimelineEvent = {
    id: event.id ?? `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: event.timestamp ?? new Date().toISOString(),
    ...event,
  };
  const existing = loadEvents(contactId);
  saveAll(contactId, [full, ...existing]);
  /* Write-through · contact_events table.
   *  Pre-auth skip · si no hay user, queda solo local. */
  void (async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import("@/lib/supabaseClient");
      if (!isSupabaseConfigured) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: members } = await supabase.from("organization_members")
        .select("organization_id").eq("user_id", user.id).eq("status", "active")
        .order("created_at", { ascending: true }).limit(1);
      const orgId = members?.[0]?.organization_id;
      if (!orgId) return;
      const { error } = await supabase.from("contact_events").insert({
        contact_id: contactId,
        organization_id: orgId,
        type: full.type,
        title: full.title ?? full.type,
        description: full.description ?? null,
        by_name: full.actor ?? null,
        by_email: full.actorEmail ?? null,
        metadata: full as unknown as Record<string, unknown>,
      });
      if (error) console.warn("[contact_events:insert]", error.message);
    } catch (e) { console.warn("[contact_events:insert] skipped:", e); }
  })();
  return full;
}

/**
 * Devuelve TODOS los eventos: locales (recientes) + mock (precargados),
 * ordenados descendentemente por timestamp.
 *
 * Si un evento del mock comparte id con uno local, gana el local
 * (permite "actualizar" un mock con datos reales).
 */
export function loadMergedEvents(
  contactId: string,
  mockEvents: ContactTimelineEvent[],
): ContactTimelineEvent[] {
  const local = loadEvents(contactId);
  const localIds = new Set(local.map((e) => e.id));
  const merged = [...local, ...mockEvents.filter((e) => !localIds.has(e.id))];
  return merged.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/* ══════════════════════════════════════════════════════════════════
   HELPERS TIPADOS · azúcar para registrar eventos comunes desde el
   resto del código sin repetir construcción del objeto.
   ══════════════════════════════════════════════════════════════════ */

type Actor = { name: string; email?: string };

const SYSTEM_ACTOR: Actor = { name: "Sistema" };

const isSystem = (a: Actor) => a.name === "Sistema" || !a.email;

function makeActor(actor: Actor): { actor: string; actorEmail?: string } {
  if (isSystem(actor)) return { actor: "Sistema" };
  return { actor: actor.name, actorEmail: actor.email };
}

export function recordContactCreated(contactId: string, by: Actor) {
  return recordEvent(contactId, {
    type: "contact_created",
    title: "Contacto creado",
    ...makeActor(by),
  });
}

export function recordContactEdited(
  contactId: string, by: Actor, changedFields: string[],
) {
  return recordEvent(contactId, {
    type: "contact_edited",
    title: "Contacto editado",
    description: changedFields.length > 0
      ? `Cambios en: ${changedFields.join(", ")}`
      : undefined,
    ...makeActor(by),
  });
}

export function recordAssigneeAdded(
  contactId: string, by: Actor, memberName: string,
) {
  return recordEvent(contactId, {
    type: "assignee_added",
    title: `Asignado: ${memberName}`,
    ...makeActor(by),
  });
}

export function recordAssigneeRemoved(
  contactId: string, by: Actor, memberName: string,
) {
  return recordEvent(contactId, {
    type: "assignee_removed",
    title: `Desasignado: ${memberName}`,
    ...makeActor(by),
  });
}

export function recordRelationLinked(
  contactId: string, by: Actor, otherName: string, relationLabel: string,
) {
  return recordEvent(contactId, {
    type: "relation_linked",
    title: `Vinculado con ${otherName}`,
    description: `Relación: ${relationLabel}`,
    ...makeActor(by),
  });
}

export function recordRelationUnlinked(
  contactId: string, by: Actor, otherName: string,
) {
  return recordEvent(contactId, {
    type: "relation_unlinked",
    title: `Desvinculado de ${otherName}`,
    ...makeActor(by),
  });
}

export function recordVisitEvaluated(
  contactId: string, by: Actor, args: {
    promotionName: string;
    unit?: string;
    outcome: "completed" | "cancelled" | "rescheduled";
    rating?: number;
  },
) {
  const where = `${args.promotionName}${args.unit ? ` · ${args.unit}` : ""}`;
  const outcomeLabel = args.outcome === "completed" ? "Realizada"
    : args.outcome === "cancelled" ? "Cancelada"
    : "Reprogramada";
  const titlePrefix = args.outcome === "completed"
    ? "Visita realizada"
    : args.outcome === "cancelled" ? "Visita cancelada" : "Visita reprogramada";
  return recordEvent(contactId, {
    type: args.outcome === "completed" ? "visit_done"
        : args.outcome === "cancelled" ? "visit_cancelled" : "visit_scheduled",
    title: `${titlePrefix} · ${where}`,
    description: args.outcome === "completed" && args.rating
      ? `${outcomeLabel} · ${args.rating}/5 estrellas`
      : outcomeLabel,
    ...makeActor(by),
  });
}

export function recordDocumentUploaded(
  contactId: string, by: Actor, docName: string,
) {
  return recordEvent(contactId, {
    type: "document_uploaded",
    title: `Documento subido: ${docName}`,
    ...makeActor(by),
  });
}

export function recordDocumentDeleted(
  contactId: string, by: Actor, docName: string,
) {
  return recordEvent(contactId, {
    type: "document_deleted",
    title: `Documento eliminado: ${docName}`,
    ...makeActor(by),
  });
}

export function recordCommentAdded(
  contactId: string, by: Actor, content: string, kind: "user" | "system",
) {
  return recordEvent(contactId, {
    type: "comment",
    title: kind === "system" ? "Nota del sistema" : "Comentario interno",
    description: content,
    ...(kind === "system" ? makeActor(SYSTEM_ACTOR) : makeActor(by)),
  });
}

export function recordEmailSent(
  contactId: string, by: Actor, to: string, subject: string, attachmentsCount = 0,
) {
  return recordEvent(contactId, {
    type: "email_sent",
    title: `Email enviado: ${subject || "(sin asunto)"}`,
    description: attachmentsCount > 0
      ? `Para ${to} · ${attachmentsCount} ${attachmentsCount === 1 ? "adjunto" : "adjuntos"}`
      : `Para ${to}`,
    ...makeActor(by),
  });
}

/**
 * Email entregado al servidor del destinatario (callback del SMTP).
 * Lo dispara el backend; en mock lo emitimos al enviar tras un timeout
 * para enseñar el ciclo completo en el Historial.
 */
export function recordEmailDelivered(
  contactId: string, to: string, subject: string,
) {
  return recordEvent(contactId, {
    type: "email_delivered",
    title: `Email entregado: ${subject || "(sin asunto)"}`,
    description: `Servidor de ${to} confirmó recepción.`,
    ...makeActor(SYSTEM_ACTOR),
  });
}

/**
 * Email abierto por el destinatario (pixel de tracking). Solo para
 * envíos en los que el tracking esté activo. Lo dispara el backend;
 * en mock se emite cuando el destinatario "abre" el email (random).
 */
export function recordEmailOpened(
  contactId: string, to: string, subject: string,
) {
  return recordEvent(contactId, {
    type: "email_opened",
    title: `Email abierto: ${subject || "(sin asunto)"}`,
    description: `${to} abrió el mensaje.`,
    ...makeActor(SYSTEM_ACTOR),
  });
}

/**
 * Email recibido del cliente (entrante). Lo dispara el backend al
 * matchear un correo entrante con un contacto existente.
 */
export function recordEmailReceived(
  contactId: string, from: string, subject: string,
) {
  return recordEvent(contactId, {
    type: "email_received",
    title: `Email recibido: ${subject || "(sin asunto)"}`,
    description: `De ${from}`,
    ...makeActor(SYSTEM_ACTOR),
  });
}

export function recordWhatsAppSent(
  contactId: string, by: Actor, summary: string,
) {
  return recordEvent(contactId, {
    type: "whatsapp_sent",
    title: "WhatsApp enviado",
    description: summary,
    ...makeActor(by),
  });
}

export function recordTypeAny(
  contactId: string, type: ContactTimelineEventType, title: string, description?: string, by: Actor = SYSTEM_ACTOR,
) {
  return recordEvent(contactId, {
    type, title, description, ...makeActor(by),
  });
}
