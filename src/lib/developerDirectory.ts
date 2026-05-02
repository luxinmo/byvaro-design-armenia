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
  /** URL del logo · opcional. Cuando undefined, `resolveDeveloperLogo`
   *  cae a `getDeveloperAvatar(name)` (dicebear). En backend este
   *  campo lo lee de `organization_profiles.logo_url`. */
  logoUrl?: string;
}

/* Directorio mínimo · solo `id` y `name`. El logo se resuelve en
 * runtime contra `organization_profiles.logo_url` (Supabase) cuando
 * la org está en DB · si no, se usa `getDeveloperAvatar(name)` que
 * genera un avatar determinista con dicebear. NUNCA usamos servicios
 * de logo externos (clearbit.com está dead desde 2024). */
export const DEVELOPER_DIRECTORY: DeveloperDirectoryEntry[] = [
  { id: "developer-default", name: "Luxinmo" },
  {                          name: "Kronos Homes" },
  {                          name: "Metrovacesa" },
  {                          name: "Taylor Wimpey" },
  {                          name: "Neinor Homes" },
  {                          name: "Aedas Homes" },
  {                          name: "Acciona Inmobiliaria" },
  {                          name: "Habitat Inmobiliaria" },
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
    if (byId?.logoUrl) return byId.logoUrl;
    if (byId) return getDeveloperAvatar(byId.name);
  }
  if (opts.name) {
    const q = opts.name.trim().toLowerCase();
    const byName = DEVELOPER_DIRECTORY.find((d) => d.name.toLowerCase() === q);
    if (byName?.logoUrl) return byName.logoUrl;
    return getDeveloperAvatar(opts.name);
  }
  return getDeveloperAvatar("?");
}
