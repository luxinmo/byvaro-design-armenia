/**
 * jobTitles.ts · catálogo canónico de cargos del equipo.
 *
 * QUÉ
 * ----
 * Cada miembro puede elegir hasta 2 cargos del catálogo (ej.
 * "Founder & Co-Founder"). Los cargos están agrupados en 3 secciones
 * que se muestran en el picker, y cada cargo implica un departamento
 * sugerido — cuando el admin elige "Sales Director" el sistema
 * autoasigna `department = "Dirección"` (por ser leadership), aunque
 * el usuario puede override si quiere.
 *
 * CÓMO
 * ----
 * - `key` = valor canónico (inglés · igual que la referencia Lovable).
 * - `group` = sección en la que aparece en el picker.
 * - `department` = departamento sugerido para autoasignación.
 *
 * USO
 * ---
 *   <JobTitlePicker value={["Founder", "Co-Founder"]} onChange={...} max={2} />
 *
 * TODO(backend): si al montar backend se decide catálogo editable por
 *   workspace, exponer GET /api/workspace/job-titles. De momento lista
 *   cerrada y estática.
 */

export type JobTitleGroup = "leadership" | "sales" | "technical";

export const JOB_TITLE_GROUPS: Record<JobTitleGroup, string> = {
  leadership: "Leadership & Management",
  sales: "Sales & Commercial",
  technical: "Technical, Support & Other",
};

export type JobTitle = {
  /** Etiqueta mostrada en UI y guardada en modelo · usa inglés para
   *  mantener consistencia con el catálogo Lovable. */
  key: string;
  group: JobTitleGroup;
  /** Departamento sugerido al seleccionar este cargo. */
  department: string;
};

/**
 * ⚠️ Cada entrada debe tener `department`. Si añades una nueva, asegúrate
 * de asignar el departamento correcto — se usa para auto-agrupar miembros
 * en `/equipo` y `/empresa`.
 */
export const JOB_TITLES: JobTitle[] = [
  /* ─── Leadership & Management ─── */
  { key: "President",            group: "leadership", department: "Dirección" },
  { key: "CEO",                  group: "leadership", department: "Dirección" },
  { key: "Founder",              group: "leadership", department: "Dirección" },
  { key: "Co-Founder",           group: "leadership", department: "Dirección" },
  { key: "Managing Director",    group: "leadership", department: "Dirección" },
  { key: "General Manager",      group: "leadership", department: "Dirección" },
  { key: "Partner",              group: "leadership", department: "Dirección" },
  { key: "Lawyer",               group: "leadership", department: "Legal" },
  { key: "Legal Department",     group: "leadership", department: "Legal" },
  /* Los `*Director` van todos al departamento "Dirección" · un director
   *  es alta dirección, independientemente del área funcional que lidere. */
  { key: "Finance Director",     group: "leadership", department: "Dirección" },
  { key: "Finance Responsible",  group: "leadership", department: "Administración" },
  { key: "Sales Director",       group: "leadership", department: "Dirección" },
  { key: "Operations Director",  group: "leadership", department: "Dirección" },
  { key: "Office Manager",       group: "leadership", department: "Administración" },
  { key: "Marketing Director",   group: "leadership", department: "Dirección" },
  { key: "Project Director",     group: "leadership", department: "Dirección" },
  { key: "New-Build Manager",    group: "leadership", department: "Operaciones" },
  { key: "After-Sales Manager",  group: "leadership", department: "Atención al cliente" },

  /* ─── Sales & Commercial ─── */
  { key: "Real Estate Agent",          group: "sales", department: "Comercial" },
  { key: "Rental Agent",               group: "sales", department: "Comercial" },
  { key: "Sales Advisor",              group: "sales", department: "Comercial" },
  { key: "Property Consultant",        group: "sales", department: "Comercial" },
  { key: "Listings Coordinator",       group: "sales", department: "Comercial" },
  { key: "Listing Agent",              group: "sales", department: "Comercial" },
  { key: "Customer Relations",         group: "sales", department: "Atención al cliente" },
  { key: "Senior Property Consultant", group: "sales", department: "Comercial" },
  { key: "Junior Property Consultant", group: "sales", department: "Comercial" },

  /* ─── Technical, Support & Other ─── */
  { key: "Architect",                    group: "technical", department: "Operaciones" },
  { key: "Technical Architect",          group: "technical", department: "Operaciones" },
  { key: "Project Manager",              group: "technical", department: "Operaciones" },
  { key: "Construction Manager",         group: "technical", department: "Operaciones" },
  { key: "Marketing Specialist",         group: "technical", department: "Marketing" },
  { key: "Photographer / Videographer",  group: "technical", department: "Marketing" },
  { key: "Accountant",                   group: "technical", department: "Administración" },
  { key: "Administrative Assistant",     group: "technical", department: "Administración" },
  { key: "IT Specialist",                group: "technical", department: "Operaciones" },
  { key: "Maintenance Technician",       group: "technical", department: "Operaciones" },
  { key: "Cleaning Staff",               group: "technical", department: "Operaciones" },
  { key: "SEO/SEM Specialist",           group: "technical", department: "Marketing" },
  { key: "Data Analyst",                 group: "technical", department: "Operaciones" },
  { key: "AI Specialist",                group: "technical", department: "Operaciones" },
  { key: "Receptionist",                 group: "technical", department: "Administración" },
  { key: "Interior Designer",            group: "technical", department: "Marketing" },
  { key: "Business Development Manager", group: "technical", department: "Comercial" },
  { key: "Marketing Strategy",           group: "technical", department: "Marketing" },
];

const BY_KEY: Record<string, JobTitle> = Object.fromEntries(
  JOB_TITLES.map((t) => [t.key, t]),
);

export function findJobTitle(key: string): JobTitle | undefined {
  return BY_KEY[key];
}

/** Decodifica `"Founder & Co-Founder"` → `["Founder", "Co-Founder"]`. */
export function parseJobTitle(s?: string): string[] {
  if (!s) return [];
  return s.split(" & ").map((x) => x.trim()).filter(Boolean);
}

/** Codifica `["Founder", "Co-Founder"]` → `"Founder & Co-Founder"`. */
export function encodeJobTitle(keys: string[]): string {
  return keys.slice(0, 2).join(" & ");
}

/** Departamento derivado · del primer cargo que tenga department. */
export function derivedDepartment(keys: string[]): string | undefined {
  for (const k of keys) {
    const t = BY_KEY[k];
    if (t?.department) return t.department;
  }
  return undefined;
}

/** Títulos agrupados por sección · para renderizar el picker. */
export const JOB_TITLES_BY_GROUP: Record<JobTitleGroup, JobTitle[]> = {
  leadership: JOB_TITLES.filter((t) => t.group === "leadership"),
  sales:      JOB_TITLES.filter((t) => t.group === "sales"),
  technical:  JOB_TITLES.filter((t) => t.group === "technical"),
};
