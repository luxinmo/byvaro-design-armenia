/**
 * assetOwnership.ts · inventario de "cosas" asignadas a un miembro.
 *
 * QUÉ
 * ----
 * Antes de desactivar a un miembro, el sistema obliga al admin a
 * reasignar TODOS sus activos (contactos, oportunidades, registros,
 * visitas, propiedades, email). Sin reasignar, se perderían leads,
 * follow-ups o visitas programadas al desaparecer su dueño.
 *
 * Este módulo devuelve el **inventario** de activos por miembro,
 * que el `DeactivateUserDialog` consume para mostrar al admin qué
 * tiene que reasignar.
 *
 * CÓMO
 * ----
 * Mock síncrono. Cada categoría tiene un `count` (cuántos elementos
 * hay asignados) y un `label` (cómo aparece en el dialog).
 *
 * El email es especial: no se "reasigna" — se **delega automáticamente**
 * al destinatario que el admin elija globalmente. Queda como forward
 * desde la dirección vieja → la nueva durante X meses para capturar
 * emails entrantes.
 *
 * TODO(backend):
 *   GET /api/members/:id/assets?types=contacts,opportunities,records,visits,promotions,email
 *     → { contacts: number, opportunities: number, records: number,
 *         visits: number, promotions: number, emailAccounts: number }
 *   POST /api/members/:id/handover
 *     body: {
 *       reassignments: { [category]: newMemberId },
 *       deactivate: true,           // hace el deactivate en la misma tx
 *       reason?: string,
 *     }
 *   El backend reasigna en la DB, añade al historial de cada elemento
 *   un evento "Heredado de <oldMember>" con fecha, autor (admin) y
 *   origen (deactivation) — ver regla de oro en CLAUDE.md §🔄.
 */

import { TEAM_MEMBERS } from "@/lib/team";

export type AssetCategory =
  | "contacts"
  | "opportunities"
  | "records"
  | "visits"
  | "promotions"
  | "email";

export type AssetInventoryItem = {
  category: AssetCategory;
  label: string;
  description: string;
  count: number;
  /** Cuando es true, no se pide dropdown — el email se delega auto. */
  autoDelegated?: boolean;
};

/* ═══════════════════════════════════════════════════════════════════
   Mocks por miembro · counts aproximados realistas.
   En backend real, esto viene de queries agregadas por owner_id.
   ═══════════════════════════════════════════════════════════════════ */

const MOCK_INVENTORY: Record<string, Partial<Record<AssetCategory, number>>> = {
  u1: { contacts: 48, opportunities: 12, records: 34, visits: 22, promotions: 7, email: 2 },
  u2: { contacts: 31, opportunities: 8,  records: 19, visits: 14, promotions: 5, email: 1 },
  u3: { contacts: 9,  opportunities: 3,  records: 6,  visits: 5,  promotions: 2, email: 1 },
  u4: { contacts: 0,  opportunities: 0,  records: 0,  visits: 2,  promotions: 0, email: 0 },
  u7: { contacts: 22, opportunities: 7,  records: 16, visits: 11, promotions: 4, email: 1 },
  u8: { contacts: 14, opportunities: 2,  records: 4,  visits: 0,  promotions: 1, email: 1 },
};

const LABELS: Record<AssetCategory, { label: string; description: string }> = {
  contacts: {
    label: "Contactos asignados",
    description: "Leads y clientes activos · se transfieren al nuevo responsable.",
  },
  opportunities: {
    label: "Oportunidades abiertas",
    description: "Operaciones en pipeline · el nuevo agente las continúa.",
  },
  records: {
    label: "Registros activos",
    description: "Registros aprobados con validez vigente · pasan al nuevo agente.",
  },
  visits: {
    label: "Visitas programadas",
    description: "Visitas futuras y las pendientes de evaluar.",
  },
  promotions: {
    label: "Promociones asignadas",
    description: "Si era el agente de referencia en alguna promoción, se reemplaza.",
  },
  email: {
    label: "Cuentas de email",
    description: "Se configura forward automático de la cuenta antigua durante 6 meses.",
  },
};

/** Devuelve el inventario de un miembro · solo categorías con count > 0. */
export function getMemberInventory(memberId: string): AssetInventoryItem[] {
  const mock = MOCK_INVENTORY[memberId] ?? {};
  return (Object.keys(LABELS) as AssetCategory[])
    .map((category) => ({
      category,
      label: LABELS[category].label,
      description: LABELS[category].description,
      count: mock[category] ?? 0,
      autoDelegated: category === "email",
    }))
    .filter((item) => item.count > 0);
}

/** Candidatos a recibir activos · todos los miembros activos excepto el propio. */
export function getActiveAssignees(excludeId: string) {
  return TEAM_MEMBERS.filter(
    (m) => m.id !== excludeId && (!m.status || m.status === "active"),
  ).map((m) => ({ id: m.id, name: m.name, email: m.email, avatarUrl: m.avatarUrl }));
}

/* ═══════════════════════════════════════════════════════════════════
   Tipos del handover · lo que devuelve el dialog al confirmar
   ═══════════════════════════════════════════════════════════════════ */

export type HandoverPlan = {
  /** Miembro que se desactiva. */
  fromMemberId: string;
  /** Por categoría · el id del nuevo propietario. */
  reassignments: Partial<Record<AssetCategory, string>>;
  /** Motivo opcional (queda registrado en historiales). */
  reason?: string;
};
