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
import { hydratePlanForCurrentUser } from "@/lib/plan";
import { hydrateTeamFromSupabase } from "@/lib/teamHydrator";
import { hydrateMyProfile } from "@/lib/meProfileHydrator";
import { hydrateDraftsFromSupabase } from "@/lib/promotionDrafts";
import { clearMemCache } from "@/lib/memCache";
import { loginAs } from "@/lib/accountType";

/** Si hay sesión Supabase activa pero el sessionStorage NO tiene los
 *  datos del user (puede pasar tras un reload, o si el user logueó
 *  con un build viejo de la app que no los seteaba), los pulla del
 *  JWT + organization_members y los rellena. Resuelve el caso del
 *  user que ve "arman" (split email) en vez de "Arman Yeghiazaryan"
 *  porque sessionStorage está vacío. */
async function ensureSessionStorageHydrated(): Promise<void> {
  if (!isSupabaseConfigured) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const hasName = sessionStorage.getItem("byvaro.accountType.userName.v1");
    const hasOrgId = sessionStorage.getItem("byvaro.accountType.organizationId.v1");
    const hasUserId = sessionStorage.getItem("byvaro.accountType.userId.v1");
    if (hasName && hasOrgId && hasUserId) return; // ya está poblado

    const { data: members } = await supabase
      .from("organization_members")
      .select("organization_id, role, organizations(kind)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1);
    const m = members?.[0] as
      | { organization_id: string; role: string; organizations: { kind: string } | { kind: string }[] }
      | undefined;
    if (!m) return;

    const orgKind = Array.isArray(m.organizations) ? m.organizations[0]?.kind : m.organizations?.kind;
    const accountType: "developer" | "agency" = orgKind === "agency" ? "agency" : "developer";
    const userName = (user.user_metadata?.name as string | undefined)
      ?? user.email?.split("@")[0]
      ?? "";
    loginAs(
      accountType,
      accountType === "agency" ? m.organization_id : user.email!,
      accountType === "agency" ? user.email! : undefined,
      m.organization_id,
      userName,
      user.id,
    );
  } catch (e) {
    console.warn("[SupabaseHydrator] ensure session skipped:", e);
  }
}

/** Pulla TODOS los stores · devuelve cuando termina la primera carga.
 *  Llamado on-mount + on-auth-change. */
async function hydrateAll(): Promise<void> {
  /* Primero · garantizar que sessionStorage tiene name + orgId del
   *  JWT activo · sin esto useCurrentUser/useEmpresa rinden con
   *  fallbacks vacíos hasta que el user haga logout+login. */
  await ensureSessionStorageHydrated();

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
    hydratePlanForCurrentUser(),
    /* Equipo del workspace · sin esto los users registrados via
     *  /register no aparecen en /equipo, /ajustes/usuarios/miembros
     *  ni en los selectores de asignación (UserSelect, calendario). */
    hydrateTeamFromSupabase(),
    /* Perfil canónico del user actual · cubre el caso de no aparecer
     *  todavía en list_workspace_members (workspace pending, primer
     *  login). Sin esto, /ajustes/perfil/personal arrancaría con seed
     *  mock "u1" para users reales con UUID auth.uid() distinto. */
    hydrateMyProfile(),
    /* Borradores de promoción del user · cross-device. Antes vivían
     *  solo en memCache (in-memory) y se perdían al recargar. */
    hydrateDraftsFromSupabase(),
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
