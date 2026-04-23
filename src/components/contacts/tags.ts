/**
 * Tags por defecto del módulo Contacts.
 *
 * Vienen como tags de **organización** — todas las cuentas de la
 * organización las ven. En producción serán las que el admin
 * configura en el setup inicial; el usuario podrá añadir luego sus
 * propias tags **personales** desde el drawer de filtros.
 */

import type { ContactTag } from "./types";

export const DEFAULT_ORG_TAGS: ContactTag[] = [
  { id: "vip", label: "VIP", color: "bg-warning", scope: "organization" },
  { id: "investor", label: "Investor", color: "bg-success", scope: "organization" },
  { id: "first-home", label: "First home", color: "bg-sky-500", scope: "organization" },
  { id: "urgent", label: "Urgent", color: "bg-rose-500", scope: "organization" },
  { id: "international", label: "International", color: "bg-violet-500", scope: "organization" },
  { id: "follow-up", label: "Follow-up", color: "bg-orange-500", scope: "organization" },
  { id: "qualified", label: "Qualified", color: "bg-cyan-500", scope: "organization" },
  { id: "cash-buyer", label: "Cash buyer", color: "bg-indigo-500", scope: "organization" },
];
