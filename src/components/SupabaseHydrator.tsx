/**
 * SupabaseHydrator · monta una vez en App.tsx para sincronizar datos
 * desde Supabase a localStorage scoped en cada cambio de auth.
 *
 * Estrategia híbrida · ver `src/lib/supabaseHydrate.ts` para detalles.
 * Este componente es solo el "trigger" reactivo · la lógica de fetch
 * y escritura vive en el helper.
 */

import { useEffect } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { hydrateFromSupabase, clearSupabaseCache } from "@/lib/supabaseHydrate";

export function SupabaseHydrator() {
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    /* Hidratamos al montar · si ya hay sesión activa (refresh, deep link),
     * los datos se ponen al día sin esperar a un nuevo login. */
    hydrateFromSupabase();

    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        hydrateFromSupabase();
      } else if (event === "SIGNED_OUT") {
        clearSupabaseCache();
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  return null;
}
