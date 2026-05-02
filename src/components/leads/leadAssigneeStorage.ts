/**
 * leadAssigneeStorage.ts · responsable del lead (mock).
 *
 * Cada lead puede tener un **solo** responsable (id de TEAM_MEMBERS).
 * Si no hay override en localStorage, la UI cae al `lead.assignedTo`
 * del seed (snapshot nombre+email) — preserva leads que ya venían
 * asignados.
 *
 * TODO(backend): PATCH /api/leads/:id/assignee { userId | null }
 *   → emite evento `assignee-changed` en timeline del lead.
 *   Ver docs/backend-integration.md §7.1.
 */

import { useEffect, useState } from "react";
import { memCache } from "@/lib/memCache";

const EVENT = "byvaro:lead-assignee-change";

function keyFor(leadId: string): string {
  return `byvaro.lead.${leadId}.assignee.v1`;
}

export function getLeadAssignee(leadId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return memCache.getItem(keyFor(leadId));
  } catch {
    return null;
  }
}

export function setLeadAssignee(leadId: string, memberId: string | null): void {
  if (typeof window === "undefined") return;
  const key = keyFor(leadId);
  if (memberId) {
    memCache.setItem(key, memberId);
  } else {
    memCache.removeItem(key);
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { leadId } }));
  /* Write-through · leads.metadata.assigneeMemberId. */
  void (async () => {
    try {
      const { supabase, isSupabaseConfigured } = await import("@/lib/supabaseClient");
      if (!isSupabaseConfigured) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: row } = await supabase.from("leads")
        .select("metadata").eq("id", leadId).maybeSingle();
      const meta = (row?.metadata as Record<string, unknown> | null) ?? {};
      const next = { ...meta, assigneeMemberId: memberId };
      const { error } = await supabase.from("leads")
        .update({ metadata: next }).eq("id", leadId);
      if (error) console.warn("[leads:assignee]", error.message);
    } catch (e) { console.warn("[leads:assignee] skipped:", e); }
  })();
}

/** Hook reactivo · se refresca cuando cambia el override de este lead. */
export function useLeadAssignee(leadId: string): string | null {
  const [assignee, setAssignee] = useState<string | null>(() => getLeadAssignee(leadId));
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ leadId: string }>;
      if (ce.detail?.leadId === leadId) setAssignee(getLeadAssignee(leadId));
    };
    const storageHandler = () => setAssignee(getLeadAssignee(leadId));
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", storageHandler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", storageHandler);
    };
  }, [leadId]);
  return assignee;
}
