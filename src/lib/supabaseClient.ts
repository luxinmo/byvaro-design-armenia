/**
 * supabaseClient.ts · cliente Supabase singleton para el frontend.
 *
 * REGLA CANÓNICA · NUNCA llamar a `supabase.from(...)` directamente
 * desde un componente React. Toda interacción con Supabase pasa por
 * los helpers de la capa de servicios (`empresa.ts`, `orgCollabRequests.ts`,
 * `collabRequests.ts`, etc.). Si el día de mañana se migra a un backend
 * custom, solo cambia esa capa · los componentes ni se enteran.
 *
 * Backend doc · `docs/backend-dual-role-architecture.md §9` (migration
 * strategy mock → Supabase → custom).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  /* En dev, lanzamos error claro · sin Supabase, los hooks que dependen
   * del cliente no pueden funcionar. En build de producción, Vite
   * evalúa esto en runtime · Vercel debe tener las vars configuradas. */
  // eslint-disable-next-line no-console
  console.warn(
    "[supabase] VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY no definidos. "
    + "Copia `.env.example` a `.env.local` y rellena los valores del proyecto Supabase."
  );
}

/** Cliente singleton · Auth en localStorage (key configurable abajo) +
 *  PKCE flow para mayor seguridad. Realtime activo por defecto · si
 *  algún hook quiere subscribirse a cambios, lo hace via este cliente. */
export const supabase: SupabaseClient = createClient(
  url ?? "https://placeholder.supabase.co",
  anonKey ?? "placeholder-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      storageKey: "byvaro.supabase.auth.v1",
    },
    /* `app.current_org` se setea en cada query · ver hook
     * `useCurrentOrganization` que despacha el `set_config` antes de
     * cada batch. RLS lee este setting para filtrar por organización. */
  }
);

/** Indica si el cliente está cableado a un proyecto real · usado por
 *  los helpers para decidir si caen al fallback mock (compat
 *  transitorio durante la migración) o lanzan error explícito. */
export const isSupabaseConfigured = !!url && !!anonKey
  && !url.startsWith("https://placeholder");
