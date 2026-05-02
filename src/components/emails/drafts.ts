import { memCache } from "@/lib/memCache";
/**
 * drafts.ts — Persistencia ligera de borradores en localStorage.
 *
 * Hoy sólo persistimos el último borrador del Compose flotante
 * (Nuevo mensaje). Los InlineReply no se persisten: viven dentro de
 * un email abierto y se pierden al cambiar de email (limitación
 * conocida, documentada en docs/screens/emails.md).
 *
 * Clave usada:
 *   byvaro.emailComposeDraft.v1 → { to, subject, body, savedAt }
 *
 * TODO(backend): mover a una tabla `drafts` y listarlos en un folder
 *  "Borradores" en el sidebar, recuperables desde cualquier sesión.
 */

export type PersistedComposeDraft = {
  to: string;
  subject: string;
  body: string;
  /** ISO timestamp del último save — útil para mostrar "hace X". */
  savedAt: string;
};

const KEY = "byvaro.emailComposeDraft.v1";

/**
 * Source of truth · `public.email_drafts` (Supabase). Mantiene 1 fila
 * por usuario para el borrador del Compose flotante (kind=compose).
 * El localStorage cache solo existe para que el Compose pueda
 * restaurar al instante al abrir.
 */

async function getCurrentOrgUser(): Promise<{ orgId: string; userId: string } | null> {
  try {
    const { supabase, isSupabaseConfigured } = await import("@/lib/supabaseClient");
    if (!isSupabaseConfigured) return null;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const orgId = (data?.organization_id as string) ?? null;
    if (!orgId) return null;
    return { orgId, userId: user.id };
  } catch { return null; }
}

export function loadComposeDraft(): PersistedComposeDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = memCache.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedComposeDraft;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveComposeDraft(draft: { to: string; subject: string; body: string }) {
  if (typeof window === "undefined") return;
  const payload: PersistedComposeDraft = {
    to: draft.to,
    subject: draft.subject,
    body: draft.body,
    savedAt: new Date().toISOString(),
  };
  memCache.setItem(KEY, JSON.stringify(payload));

  void (async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import("@/lib/supabaseClient");
      if (!isSupabaseConfigured) return;
      const ctx = await getCurrentOrgUser();
      if (!ctx) return;
      /* 1 borrador "compose" por usuario · delete-then-insert porque
       *  email_drafts no tiene unique constraint en user_id. */
      const toEmails = draft.to.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
      await supabase
        .from("email_drafts")
        .delete()
        .eq("user_id", ctx.userId)
        .filter("metadata->>kind", "eq", "compose");
      const { error } = await supabase
        .from("email_drafts")
        .insert({
          organization_id: ctx.orgId,
          user_id: ctx.userId,
          subject: draft.subject,
          body: draft.body,
          to_emails: toEmails,
          metadata: { kind: "compose" },
        });
      if (error) console.warn("[drafts:save]", error.message);
    } catch (e) {
      console.warn("[drafts:save] skipped:", e);
    }
  })();
}

export function clearComposeDraft() {
  if (typeof window === "undefined") return;
  memCache.removeItem(KEY);
  void (async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import("@/lib/supabaseClient");
      if (!isSupabaseConfigured) return;
      const ctx = await getCurrentOrgUser();
      if (!ctx) return;
      const { error } = await supabase
        .from("email_drafts")
        .delete()
        .eq("user_id", ctx.userId);
      if (error) console.warn("[drafts:clear]", error.message);
    } catch (e) {
      console.warn("[drafts:clear] skipped:", e);
    }
  })();
}

/**
 * Helper para comprobar si un borrador tiene contenido real —
 * evita guardar borradores vacíos tras aplicar la firma por defecto.
 *
 * Considera "vacío" si `to`, `subject` y el body (tras quitar HTML
 * y la firma entre marcadores) no tienen nada tras trim.
 */
export function isDraftEmpty(draft: { to: string; subject: string; body: string }): boolean {
  const toEmpty = !draft.to.trim();
  const subjectEmpty = !draft.subject.trim();
  const bodyNoSignature = draft.body.replace(
    /<!--byvaro-signature-->[\s\S]*?<!--\/byvaro-signature-->/g,
    "",
  );
  const bodyText = bodyNoSignature.replace(/<[^>]*>/g, "").trim();
  return toEmpty && subjectEmpty && bodyText === "";
}
