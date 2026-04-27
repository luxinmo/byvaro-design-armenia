/**
 * party.ts · Modelo genérico de "parte" para soportar las 4
 * relaciones del roadmap sin reescribir el sistema:
 *
 *   · developer ↔ agency  (Phase 1 actual)
 *   · agency    ↔ agency  (subcolaboración · Phase 2)
 *   · owner     ↔ agency  (gestión propietario · Phase 2)
 *   · cualquier party ↔ direct  (registro propio sin terceros)
 *
 * Phase 2 frontend mock · solo TYPES + helpers de derivación. La UI
 * sigue rendereando el modelo `origen + agencyId` actual hasta que
 * lleguen owner/agency-as-host como personas reales.
 *
 * Ver `docs/registration-generic-model.md`.
 */

import type { Registro } from "@/data/records";
import { agencies } from "@/data/agencies";
import { promotions } from "@/data/promotions";

export type PartyKind = "developer" | "agency" | "owner";

export type Party = {
  kind: PartyKind;
  organizationId: string;
  /** Etiqueta humana cacheada · "Luxinmo", "Prime Properties", etc. */
  label?: string;
};

export type RelationshipType =
  | "developer-agency"
  | "developer-direct"
  | "agency-agency"
  | "agency-direct"
  | "owner-agency"
  | "owner-direct";

export type InventoryRef = {
  type: "promotion" | "property" | "listing";
  id: string;
  label?: string;
};

/**
 * Deriva las dos partes de un Registro existente · Phase 1 mantiene
 * la fuente actual (`origen` + `agencyId` + `promotionId`) y este
 * helper las traduce al modelo genérico para los componentes que ya
 * empiezan a hablar el lenguaje nuevo.
 *
 * Mock single-tenant · `developer` es siempre la org del workspace
 * actual (org1 / Luxinmo). Cuando exista `Promotion.owningPartyId`
 * server-side, sustituir.
 */
export function resolvePartiesFromRegistro(r: Registro): {
  owningParty: Party;
  submittingParty: Party;
  inventoryRef: InventoryRef;
  relationshipType: RelationshipType;
} {
  const promo = promotions.find((p) => p.id === r.promotionId);
  /* owningParty · en Phase 1 es siempre el developer (Luxinmo).
     TODO(phase-2): leer de promo.owningPartyId cuando exista owner/
     agency-as-host. */
  const owningParty: Party = {
    kind: "developer",
    organizationId: "org1",
    label: promo?.developer ?? "Promotor",
  };

  /* submittingParty · agency si origen=collaborator, developer si direct. */
  let submittingParty: Party;
  if (r.origen === "collaborator" && r.agencyId) {
    const agency = agencies.find((a) => a.id === r.agencyId);
    submittingParty = {
      kind: "agency",
      organizationId: r.agencyId,
      label: agency?.name ?? "Agencia colaboradora",
    };
  } else {
    submittingParty = { ...owningParty };
  }

  const relationshipType: RelationshipType = r.origen === "collaborator"
    ? "developer-agency"
    : "developer-direct";

  return {
    owningParty,
    submittingParty,
    inventoryRef: {
      type: "promotion",
      id: r.promotionId,
      label: promo?.name,
    },
    relationshipType,
  };
}

/**
 * Label humano del owningParty para copy genérico · sustituye los
 * "del promotor" hardcodeados cuando llegue owner/agency-as-host.
 *
 *   developer → "el promotor"
 *   agency    → "la agencia anfitrión"
 *   owner     → "el propietario"
 */
export function getOwningPartyLabel(kind: PartyKind): string {
  switch (kind) {
    case "developer": return "el promotor";
    case "agency":    return "la agencia anfitrión";
    case "owner":     return "el propietario";
  }
}

/* TODO(backend): tabla `registrations` extendida con owning_organization_id,
 * submitting_organization_id, relationship_type, inventory_type, inventory_id.
 * Ver `docs/registration-generic-model.md §7.1`. */
