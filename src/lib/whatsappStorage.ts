import { memCache } from "./memCache";
/**
 * Storage de la configuración de WhatsApp del workspace.
 *
 * Source of truth · `public.whatsapp_settings` (Supabase). El localStorage
 * cache (`byvaro.workspace.whatsapp.v1::<orgId>`) solo existe para que
 * `loadWhatsAppSetup()` sea síncrono · NO es la fuente de verdad.
 *
 * El workspace conecta UN proveedor (Business API o Web) y el resto
 * del equipo lo comparte. Cada agente tiene su identidad cuando envía
 * mensajes, pero el número/canal subyacente es único.
 *
 * NOTA seguridad:
 *  - El token de Meta NO se guarda en `whatsapp_settings` · va en una
 *    tabla server-only con encryption-at-rest (TODO backend).
 *  - El "ver conversaciones de otros agentes" requiere `whatsapp.viewAll`.
 *  - El "enviar mensajes" solo permite firmar como el currentUser.
 */

export type WhatsAppMethod = "businessApi" | "web";

export type WhatsAppSetup = {
  method: WhatsAppMethod;
  connectedAt: string;
  businessNumber?: string;
  displayName?: string;
};

const KEY_PREFIX = "byvaro.workspace.whatsapp.v1::";
const CHANGE = "byvaro:whatsapp-setup-change";

function keyFor(orgId: string): string { return `${KEY_PREFIX}${orgId}`; }

/* ══════ Cache local · render-only ════════════════════════════════ */

function readCache(orgId: string): WhatsAppSetup | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = memCache.getItem(keyFor(orgId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WhatsAppSetup;
    if (!parsed.method) return null;
    return parsed;
  } catch { return null; }
}

function writeCache(orgId: string, setup: WhatsAppSetup | null): void {
  if (typeof window === "undefined") return;
  if (setup) {
    memCache.setItem(keyFor(orgId), JSON.stringify(setup));
  } else {
    memCache.removeItem(keyFor(orgId));
  }
  window.dispatchEvent(new CustomEvent(CHANGE, { detail: { orgId } }));
}

/* ══════ Source of truth · Supabase ═══════════════════════════════ */

async function getCurrentOrgId(): Promise<string | null> {
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return null;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();
    return (data?.organization_id as string) ?? null;
  } catch { return null; }
}

export async function hydrateWhatsAppFromSupabase(): Promise<WhatsAppSetup | null> {
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return null;
    const orgId = await getCurrentOrgId();
    if (!orgId) return null;
    const { data, error } = await supabase
      .from("whatsapp_settings")
      .select("is_connected, phone_number_id, display_phone, metadata")
      .eq("organization_id", orgId)
      .maybeSingle();
    if (error) {
      console.warn("[whatsapp:hydrate]", error.message);
      return null;
    }
    if (!data || !data.is_connected) {
      writeCache(orgId, null);
      return null;
    }
    const meta = (data.metadata ?? {}) as Partial<WhatsAppSetup>;
    const setup: WhatsAppSetup = {
      method: (meta.method as WhatsAppMethod) ?? "web",
      connectedAt: meta.connectedAt ?? new Date().toISOString(),
      businessNumber: (data.display_phone as string) ?? meta.businessNumber,
      displayName: meta.displayName,
    };
    writeCache(orgId, setup);
    return setup;
  } catch (e) {
    console.warn("[whatsapp:hydrate] skipped:", e);
    return null;
  }
}

/* ══════ API pública ══════════════════════════════════════════════ */

/** Lee setup · sync · safe-server. Si el cache está vacío devuelve null
 *  · llama a `hydrateWhatsAppFromSupabase()` para refrescar. */
export function loadWhatsAppSetup(): WhatsAppSetup | null {
  if (typeof window === "undefined") return null;
  /* Itera todas las claves · single-tenant lookup pragmático para
   *  call sites legacy que no tienen orgId. */
  for (let i = 0; i < memCache.length; i++) {
    const k = memCache.key(i);
    if (k && k.startsWith(KEY_PREFIX)) {
      try {
        const raw = memCache.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw) as WhatsAppSetup;
          if (parsed.method) return parsed;
        }
      } catch {}
    }
  }
  return null;
}

export function saveWhatsAppSetup(setup: WhatsAppSetup): void {
  if (typeof window === "undefined") return;

  void (async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
      if (!isSupabaseConfigured) return;
      const orgId = await getCurrentOrgId();
      if (!orgId) return;
      writeCache(orgId, setup);
      const { error } = await supabase
        .from("whatsapp_settings")
        .upsert({
          organization_id: orgId,
          is_connected: true,
          display_phone: setup.businessNumber ?? null,
          metadata: setup,
          updated_at: new Date().toISOString(),
        }, { onConflict: "organization_id" });
      if (error) console.warn("[whatsapp:save]", error.message);
    } catch (e) {
      console.warn("[whatsapp:save] skipped:", e);
    }
  })();
}

export function clearWhatsAppSetup(): void {
  if (typeof window === "undefined") return;

  void (async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
      if (!isSupabaseConfigured) return;
      const orgId = await getCurrentOrgId();
      if (!orgId) return;
      writeCache(orgId, null);
      const { error } = await supabase
        .from("whatsapp_settings")
        .upsert({
          organization_id: orgId,
          is_connected: false,
          phone_number_id: null,
          display_phone: null,
          metadata: null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "organization_id" });
      if (error) console.warn("[whatsapp:clear]", error.message);
    } catch (e) {
      console.warn("[whatsapp:clear] skipped:", e);
    }
  })();
}

export function isWhatsAppConnected(): boolean {
  return loadWhatsAppSetup() !== null;
}
