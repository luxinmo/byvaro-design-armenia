/**
 * developerDirectory · catálogo canónico de promotores conocidos en
 * el mock + helpers para resolver logo + avatar de cualquier promotor
 * (incluyendo los que aún no están en el directorio).
 *
 * En backend este archivo se reemplaza por `GET /api/developers`
 * (o un lookup contra `organizations` con `kind="developer"`).
 *
 * Estructura: cada promotor tiene `name`, `logoUrl` y opcionalmente
 * `id` (cuando es identificable a nivel sistema · solo el workspace
 * propio "developer-default" lo usa hoy).
 */

export interface DeveloperDirectoryEntry {
  /** Id estable cuando se conoce · "developer-default" para el
   *  workspace actual del mock single-tenant. */
  id?: string;
  /** Nombre comercial canónico · sirve de match contra `p.developer`. */
  name: string;
  /** URL del logo · idealmente cuadrado / círculo, mínimo 64x64. */
  logoUrl: string;
}

/* Logos REALES de los promotores presentes en el seed de marketplace.
 * Cuando un promotor no está aquí caemos a un avatar generado con
 * `getDeveloperAvatar(name)`. Los URLs de Clearbit están públicos · si
 * algún logo no carga se ve el fallback determinista. */
export const DEVELOPER_DIRECTORY: DeveloperDirectoryEntry[] = [
  { id: "developer-default", name: "Luxinmo",            logoUrl: "https://logo.clearbit.com/luxinmo.com" },
  {                          name: "Kronos Homes",       logoUrl: "https://logo.clearbit.com/kronoshomes.com" },
  {                          name: "Metrovacesa",        logoUrl: "https://logo.clearbit.com/metrovacesa.com" },
  {                          name: "Taylor Wimpey",      logoUrl: "https://logo.clearbit.com/taylorwimpey.es" },
  {                          name: "Neinor Homes",       logoUrl: "https://logo.clearbit.com/neinorhomes.com" },
  {                          name: "Aedas Homes",        logoUrl: "https://logo.clearbit.com/aedashomes.com" },
  {                          name: "Acciona Inmobiliaria", logoUrl: "https://logo.clearbit.com/acciona-inmobiliaria.com" },
  {                          name: "Habitat Inmobiliaria", logoUrl: "https://logo.clearbit.com/habitatinmobiliaria.com" },
];

/* Avatar fallback determinista por nombre · dicebear initials. Garantiza
 * que cualquier promotor (conocido o nuevo) tenga un avatar coherente
 * sin depender de que el logo externo cargue. */
export function getDeveloperAvatar(name: string): string {
  return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=1D74E7&textColor=ffffff`;
}

/* Resolver canónico de logo · busca por id primero (workspace propio),
 * luego por nombre (case-insensitive). Si no hay match, devuelve el
 * avatar fallback. */
export function resolveDeveloperLogo(opts: { id?: string; name?: string }): string {
  if (opts.id) {
    const byId = DEVELOPER_DIRECTORY.find((d) => d.id === opts.id);
    if (byId) return byId.logoUrl;
  }
  if (opts.name) {
    const q = opts.name.trim().toLowerCase();
    const byName = DEVELOPER_DIRECTORY.find((d) => d.name.toLowerCase() === q);
    if (byName) return byName.logoUrl;
    return getDeveloperAvatar(opts.name);
  }
  return getDeveloperAvatar("?");
}
