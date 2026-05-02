import { memCache } from "./memCache";
/**
 * sentEmails.ts · Log local de emails "enviados" (mock).
 *
 * Mientras no hay backend que envíe emails reales, cada vez que la
 * UI dispara un envío (invitación a agencia, T&C aceptado, registro
 * aprobado…) llamamos a `recordSentEmail()` para guardar el HTML
 * renderizado + metadata. Visible en `/ajustes/email/historial`
 * (futuro) o abriendo el HTML en una pestaña nueva.
 *
 * TODO(backend): POST /api/emails/send + tabla `sent_emails`. El
 * frontend ya genera el HTML correcto con las plantillas oficiales ·
 * el backend solo retransmite vía Resend / SendGrid / similar.
 */

const STORAGE_KEY = "byvaro.sent-emails.v1";
const MAX_LOG = 100;

export type SentEmail = {
  id: string;
  to: string;
  subject: string;
  html: string;
  /** Tipo del email · facilita filtros en el log futuro. */
  kind: "invitation" | "registration_approved" | "registration_rejected" | "other";
  /** Referencia opcional al recurso · ej. invitacionId, registroId. */
  refId?: string;
  /** ISO timestamp. */
  sentAt: string;
};

function read(): SentEmail[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = memCache.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SentEmail[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(list: SentEmail[]) {
  /* Cap a MAX_LOG · descarta los más antiguos. */
  const trimmed = list.slice(0, MAX_LOG);
  memCache.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function recordSentEmail(input: Omit<SentEmail, "id" | "sentAt">): SentEmail {
  const sent: SentEmail = {
    ...input,
    id: `email-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sentAt: new Date().toISOString(),
  };
  write([sent, ...read()]);
  /* Write-through · log a `emails_sent` table. RLS valida member del org.
   *  Skip si pre-auth seed. */
  void (async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
      if (!isSupabaseConfigured) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: members } = await supabase.from("organization_members")
        .select("organization_id").eq("user_id", user.id).eq("status", "active")
        .order("created_at", { ascending: true }).limit(1);
      const orgId = members?.[0]?.organization_id;
      if (!orgId) return;
      const { error } = await supabase.from("emails_sent").insert({
        organization_id: orgId,
        by_user_id: user.id,
        audience: input.kind === "invitation" ? "collaborator" : "client",
        template_id: input.kind,
        language: "es",
        subject: input.subject,
        body_html: input.html,
        recipients: [{ email: input.to }],
        status: "sent",
        metadata: { kind: input.kind, refId: input.refId },
      });
      if (error) console.warn("[emails_sent:insert]", error.message);
    } catch (e) { console.warn("[emails_sent:insert] skipped:", e); }
  })();
  return sent;
}

/** Helper específico para invitación de agencia. */
export function recordSentInvitationEmail(input: {
  to: string;
  subject: string;
  html: string;
  invitacionId: string;
}): SentEmail {
  return recordSentEmail({
    to: input.to,
    subject: input.subject,
    html: input.html,
    kind: "invitation",
    refId: input.invitacionId,
  });
}

export function listSentEmails(): SentEmail[] {
  return read();
}

/** Pull desde `emails_sent` a localStorage · llamar al iniciar. */
export async function hydrateSentEmailsFromSupabase(): Promise<void> {
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return;
    const { data, error } = await supabase
      .from("emails_sent")
      .select("*")
      .order("sent_at", { ascending: false })
      .limit(MAX_LOG);
    if (error || !data) return;
    const list: SentEmail[] = data.map((r: Record<string, unknown>) => {
      const meta = (r.metadata ?? {}) as { kind?: SentEmail["kind"]; refId?: string };
      const recipients = (r.recipients ?? []) as Array<{ email?: string }>;
      return {
        id: r.id as string,
        to: recipients[0]?.email ?? "",
        subject: (r.subject as string) ?? "",
        html: (r.body_html as string) ?? "",
        kind: meta.kind ?? "other",
        refId: meta.refId,
        sentAt: (r.sent_at as string) ?? new Date().toISOString(),
      };
    });
    write(list);
  } catch (e) {
    console.warn("[sentEmails] hydrate skipped:", e);
  }
}

/**
 * Abre el HTML del email en una pestaña nueva del navegador.
 * Útil para preview · usuario ve cómo quedaría el email real.
 */
export function openSentEmailInNewTab(html: string): void {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  /* Liberamos el objectURL tras un momento · el navegador ya tiene
     el contenido cargado en la pestaña, no lo necesitamos colgando. */
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
