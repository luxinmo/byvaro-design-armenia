/**
 * Seeds iniciales del historial cross-empresa. En producción estos
 * eventos los escribe el backend cuando ocurren las acciones reales
 * (crear invitación, aprobar registro, etc.); aquí los publicamos en
 * localStorage una sola vez para que la UI de `/colaboradores/:id`
 * muestre actividad desde el principio.
 *
 * Se ejecuta desde `src/main.tsx` antes de montar la app. Es
 * idempotente: si la clave ya tiene eventos, no reescribe nada.
 */

import { recordCompanyEvent } from "./companyEvents";
import { memCache } from "./memCache";

const SEED_DONE_KEY = "byvaro.companyEvents.seeded.v1";

type Seed = Parameters<typeof recordCompanyEvent>;

const seeds: Seed[] = [
  /* Prime Properties (ag-2) · relación activa y madura */
  ["ag-2", "invitation_sent", "Invitación enviada · Villas del Pinar", {
    by: { name: "Arman Rahmanov", email: "arman@byvaro.com" },
    related: { promotionId: "dev-2", promotionName: "Villas del Pinar" },
  }],
  ["ag-2", "invitation_accepted", "Invitación aceptada", {
    by: { name: "Laura Sánchez", email: "laura@primeproperties.com" },
  }],
  ["ag-2", "registration_created", "Registro nuevo · Émilie Rousseau · Altea Hills", {
    by: { name: "Laura Sánchez", email: "laura@primeproperties.com" },
    related: { clientName: "Émilie Rousseau", promotionName: "Altea Hills Residences" },
  }],
  ["ag-2", "registration_approved", "Registro aprobado · Émilie Rousseau", {
    by: { name: "Arman Rahmanov", email: "arman@byvaro.com" },
    related: { clientName: "Émilie Rousseau" },
  }],
  ["ag-2", "visit_scheduled", "Visita programada · Émilie Rousseau · 14 abr 10:00", {
    by: { name: "Laura Sánchez", email: "laura@primeproperties.com" },
    related: { clientName: "Émilie Rousseau", promotionName: "Altea Hills Residences" },
  }],
  ["ag-2", "visit_completed", "Visita realizada · Émilie Rousseau · interesada · 5★", {
    by: { name: "Laura Sánchez", email: "laura@primeproperties.com" },
    related: { clientName: "Émilie Rousseau" },
  }],
  ["ag-2", "sale_reserved", "Reserva · Émilie Rousseau · B-204", {
    by: { name: "Arman Rahmanov", email: "arman@byvaro.com" },
    related: { clientName: "Émilie Rousseau", unit: "B-204" },
    description: "Señal 6.000€ pagada. Reserva en vigor hasta contrato.",
  }],
  ["ag-2", "contract_sent", "Contrato enviado · Émilie Rousseau · B-204", {
    by: { name: "Arman Rahmanov", email: "arman@byvaro.com" },
    related: { clientName: "Émilie Rousseau", unit: "B-204" },
  }],

  /* Nordic Home Finders (ag-1) · aceptado con incidencia pasada */
  ["ag-1", "request_received", "Solicitud entrante desde marketplace", {
    by: { name: "Sistema", system: true },
    description: "Me gustaría colaborar en Villas del Pinar y Residencial Aurora.",
  }],
  ["ag-1", "request_approved", "Solicitud aprobada", {
    by: { name: "Arman Rahmanov", email: "arman@byvaro.com" },
  }],
  ["ag-1", "registration_rejected", "Registro rechazado · Magnus Eriksson", {
    by: { name: "Arman Rahmanov", email: "arman@byvaro.com" },
    description: "Duplicado: el cliente ya figuraba en CRM del promotor desde hace 2 meses.",
    related: { clientName: "Magnus Eriksson" },
  }],
  ["ag-1", "incident_duplicate", "Incidencia · 2 duplicados en 30 días", {
    by: { name: "Sistema", system: true },
  }],

  /* Dutch & Belgian Realty (ag-3) · invitada sin respuesta (pendiente) */
  ["ag-3", "invitation_sent", "Invitación enviada · Villa Serena", {
    by: { name: "Arman Rahmanov", email: "arman@byvaro.com" },
    related: { promotionId: "dev-1", promotionName: "Villa Serena" },
    description: "Pendiente de respuesta · enviada hace 7 días.",
  }],
];

export function seedCompanyEventsIfEmpty() {
  if (typeof window === "undefined") return;
  if (memCache.getItem(SEED_DONE_KEY)) return;
  try {
    /* Los insertamos en orden inverso para que, al quedar ordenados
     * por fecha descendente, el más reciente (contract_sent) aparezca
     * primero en el timeline. */
    for (const [id, type, title, opts] of [...seeds].reverse()) {
      recordCompanyEvent(id, type, title, opts ?? {});
    }
    memCache.setItem(SEED_DONE_KEY, "1");
  } catch {
    /* storage bloqueado: seguimos sin fallar */
  }
}
