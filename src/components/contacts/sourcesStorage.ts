/**
 * sourcesStorage.ts — Persistencia de sources de la organización.
 *
 * Las sources son a nivel de organización: solo admins CRUD; todos
 * los miembros las usan en filtros y al crear contactos. En el mock
 * persistimos en localStorage; en producción → tabla
 * `contact_sources` con organization_id FK.
 */

import type { ContactSource } from "./sources";
import { DEFAULT_ORG_SOURCES } from "./sources";
import type { SourceCategory } from "./sourceCategories";
import { DEFAULT_ORG_SOURCE_CATEGORIES } from "./sourceCategories";

const KEY = "byvaro.contactSources.v1";
const CATEGORIES_KEY = "byvaro.contactSourceCategories.v1";

export function loadSources(): ContactSource[] {
  if (typeof window === "undefined") return DEFAULT_ORG_SOURCES;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_ORG_SOURCES;
    const parsed = JSON.parse(raw) as ContactSource[];
    return Array.isArray(parsed) ? parsed : DEFAULT_ORG_SOURCES;
  } catch {
    return DEFAULT_ORG_SOURCES;
  }
}

export function saveSources(sources: ContactSource[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(sources));
}

export function nextSourceId(existing: ContactSource[]): string {
  const used = new Set(existing.map((s) => s.id));
  for (let i = 1; i < 9999; i++) {
    const candidate = `source-${i}`;
    if (!used.has(candidate)) return candidate;
  }
  return `source-${Date.now()}`;
}
