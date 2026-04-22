/**
 * tagsStorage.ts — Persistencia de tags por scope.
 *
 *   - Organization tags  → byvaro.contactTags.organization.v1
 *     Visibles a todos los miembros de la org. Solo admins las
 *     pueden CRUD (la UI ya hace enforcement; el backend deberá
 *     hacer su propio check con el JWT).
 *
 *   - Personal tags      → byvaro.contactTags.personal.{userId}.v1
 *     Solo el usuario que las creó las ve. Cualquier usuario puede
 *     CRUD las suyas.
 *
 * En producción ambas tablas vivirán en Postgres:
 *   - contact_tags (id, label, color, scope, organization_id, created_by_user_id, created_at)
 *   - Constraint: scope = "organization" → unique por (label, organization_id)
 *   - Constraint: scope = "personal" → unique por (label, created_by_user_id)
 */

import type { ContactTag } from "./types";
import { DEFAULT_ORG_TAGS } from "./tags";

const ORG_KEY = "byvaro.contactTags.organization.v1";
const PERSONAL_KEY_PREFIX = "byvaro.contactTags.personal.";

/* ── Organization ── */

export function loadOrgTags(): ContactTag[] {
  if (typeof window === "undefined") return DEFAULT_ORG_TAGS;
  try {
    const raw = window.localStorage.getItem(ORG_KEY);
    if (!raw) return DEFAULT_ORG_TAGS;
    const parsed = JSON.parse(raw) as ContactTag[];
    return Array.isArray(parsed) ? parsed : DEFAULT_ORG_TAGS;
  } catch {
    return DEFAULT_ORG_TAGS;
  }
}

export function saveOrgTags(tags: ContactTag[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ORG_KEY, JSON.stringify(tags));
}

/* ── Personal (per user) ── */

export function loadPersonalTags(userId: string): ContactTag[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PERSONAL_KEY_PREFIX + userId);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ContactTag[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePersonalTags(userId: string, tags: ContactTag[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PERSONAL_KEY_PREFIX + userId, JSON.stringify(tags));
}

/* ── Helpers comunes ── */

export const TAG_COLOR_PALETTE = [
  "bg-amber-500",
  "bg-emerald-500",
  "bg-sky-500",
  "bg-rose-500",
  "bg-violet-500",
  "bg-orange-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-pink-500",
  "bg-lime-500",
];

export function nextTagId(existing: ContactTag[]): string {
  const used = new Set(existing.map((t) => t.id));
  for (let i = 1; i < 9999; i++) {
    const candidate = `tag-${i}`;
    if (!used.has(candidate)) return candidate;
  }
  return `tag-${Date.now()}`;
}
