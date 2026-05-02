/**
 * SupabaseHydrator · monta una vez en App.tsx para sincronizar datos
 * desde Supabase a localStorage scoped en cada cambio de auth.
 *
 * Estrategia híbrida · ver `src/lib/supabaseHydrate.ts` para detalles.
 * Este componente es solo el "trigger" reactivo · la lógica de fetch
 * y escritura vive en el helper.
 */

import { useEffect, useState, type ReactNode } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { hydrateFromSupabase, clearSupabaseCache } from "@/lib/supabaseHydrate";
import { hydrateSeedsFromSupabase } from "@/lib/seedHydrator";
import { hydrateInvitationsFromSupabase } from "@/lib/invitaciones";
import { hydrateSentEmailsFromSupabase } from "@/lib/sentEmails";
import { hydratePromoCollabStatusFromSupabase } from "@/lib/promoCollabStatus";
import { hydrateAgencyLicensesFromSupabase } from "@/lib/agencyLicenses";
import { hydrateCompanyEventsFromSupabase } from "@/lib/companyEvents";
import { hydrateFavoriteAgenciesFromSupabase } from "@/lib/favoriteAgencies";
import { hydrateAgencyOnboardingFromSupabase } from "@/lib/agencyOnboarding";
import { hydrateAgencyProfilesFromSupabase } from "@/lib/agencyProfile";
import { hydrateTwoFactorFromSupabase } from "@/lib/twoFactor";
import { hydrateDeveloperPacksFromSupabase } from "@/lib/empresaCategories";
import { hydrateUserPublicRefs } from "@/lib/userPublicRef";
import { clearMemCache } from "@/lib/memCache";

/** Pulla TODOS los stores · devuelve cuando termina la primera carga.
 *  Llamado on-mount + on-auth-change. */
async function hydrateAll(): Promise<void> {
  await Promise.all([
    hydrateFromSupabase(),
    hydrateSeedsFromSupabase(),
    hydrateInvitationsFromSupabase(),
    hydrateSentEmailsFromSupabase(),
    hydratePromoCollabStatusFromSupabase(),
    hydrateAgencyLicensesFromSupabase(),
    hydrateCompanyEventsFromSupabase(),
    hydrateFavoriteAgenciesFromSupabase(),
    hydrateAgencyOnboardingFromSupabase(),
    hydrateAgencyProfilesFromSupabase(),
    hydrateTwoFactorFromSupabase(),
    hydrateDeveloperPacksFromSupabase(),
    hydrateUserPublicRefs(),
  ]);
}

/** Splash bloqueante mientras hidrata DB → memoria.
 *
 * Sin localStorage como cache, recargar significa que la primera
 * pintura tendría todos los stores vacíos. Esperamos a que la
 * primera tanda de hidratación termine antes de mostrar la app · una
 * espera única (~500ms-1s) en vez de spinners por cada componente. */
export function SupabaseHydrator({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    /* Primera hidratación bloqueante. */
    void hydrateAll().finally(() => setReady(true));

    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        void hydrateAll();
      } else if (event === "SIGNED_OUT") {
        clearSupabaseCache();
        clearMemCache();
      }
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  if (!ready) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-foreground border-t-transparent animate-spin" />
          <p className="text-xs text-muted-foreground">Cargando workspace…</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
