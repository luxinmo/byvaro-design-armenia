/**
 * leadsStorage.ts · helper canónico para leads (entradas crudas).
 *
 * Pattern híbrido idéntico a salesStorage / registrosStorage.
 * Ver `docs/backend-development-rules.md §5`.
 */

import { useEffect, useState } from "react";
import { memCache } from "./memCache";
import { leads as SEED_LEADS, type Lead } from "@/data/leads";

const KEY_OVERRIDES = "byvaro.leads.overrides.v1";
const KEY_CREATED   = "byvaro.leads.created.v1";
const KEY_DELETED   = "byvaro.leads.deleted.v1";
const EVENT = "byvaro:leads-change";

function loadOverrides(): Record<string, Lead> {
  if (typeof window === "undefined") return {};
  try { const raw = memCache.getItem(KEY_OVERRIDES); return raw ? JSON.parse(raw) : {}; }
  catch { return {}; }
}
function loadCreated(): Lead[] {
  if (typeof window === "undefined") return [];
  try { const raw = memCache.getItem(KEY_CREATED); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}
function loadDeletedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try { const raw = memCache.getItem(KEY_DELETED); return raw ? new Set(JSON.parse(raw)) : new Set(); }
  catch { return new Set(); }
}

export function getAllLeads(): Lead[] {
  const overrides = loadOverrides();
  const created = loadCreated();
  const deleted = loadDeletedIds();
  const out: Lead[] = [];
  const seen = new Set<string>();
  for (const l of SEED_LEADS) {
    if (deleted.has(l.id)) continue;
    out.push(overrides[l.id] ?? l);
    seen.add(l.id);
  }
  for (const c of created) {
    if (!seen.has(c.id) && !deleted.has(c.id)) out.push(c);
  }
  return out;
}

function saveOverrides(map: Record<string, Lead>) {
  memCache.setItem(KEY_OVERRIDES, JSON.stringify(map));
  window.dispatchEvent(new CustomEvent(EVENT));
}
function saveCreated(list: Lead[]) {
  memCache.setItem(KEY_CREATED, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(EVENT));
}
function saveDeleted(set: Set<string>) {
  memCache.setItem(KEY_DELETED, JSON.stringify(Array.from(set)));
  window.dispatchEvent(new CustomEvent(EVENT));
}

async function syncLeadToSupabase(l: Lead, ownerOrgId: string) {
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("leads").upsert({
      id: l.id,
      organization_id: ownerOrgId,
      source: l.source,
      full_name: l.fullName,
      email: l.email,
      phone: l.phone,
      message: l.message ?? null,
      status: l.status,
      metadata: {
        publicRef: l.publicRef, nationality: l.nationality, idioma: l.idioma,
        interest: l.interest, duplicateScore: l.duplicateScore,
        duplicateOfContactId: l.duplicateOfContactId, tags: l.tags,
        firstResponseAt: l.firstResponseAt, assignedTo: l.assignedTo,
      },
    });
    if (error) console.warn("[leads:sync]", error.message);
  } catch (e) { console.warn("[leads:sync] skipped:", e); }
}

async function deleteLeadFromSupabase(id: string) {
  try {
    const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
    if (!isSupabaseConfigured) return;
    await supabase.from("leads").delete().eq("id", id);
  } catch (e) { console.warn("[leads:delete] skipped:", e); }
}

export function createLead(l: Lead): void {
  saveCreated([l, ...loadCreated()]);
  void syncLeadToSupabase(l, "developer-default");
}

export function updateLead(id: string, patch: Partial<Lead>): void {
  const all = getAllLeads();
  const existing = all.find((x) => x.id === id);
  if (!existing) return;
  const updated = { ...existing, ...patch };
  const isSeed = SEED_LEADS.some((s) => s.id === id);
  if (isSeed) {
    const o = loadOverrides();
    o[id] = updated;
    saveOverrides(o);
  } else {
    saveCreated(loadCreated().map((c) => c.id === id ? updated : c));
  }
  void syncLeadToSupabase(updated, "developer-default");
}

export function deleteLead(id: string): void {
  const isSeed = SEED_LEADS.some((s) => s.id === id);
  if (isSeed) {
    const d = loadDeletedIds(); d.add(id); saveDeleted(d);
  } else {
    saveCreated(loadCreated().filter((c) => c.id !== id));
  }
  void deleteLeadFromSupabase(id);
}

export function useAllLeads(): Lead[] {
  const [list, setList] = useState<Lead[]>(() => getAllLeads());
  useEffect(() => {
    const refresh = () => setList(getAllLeads());
    window.addEventListener(EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return list;
}
