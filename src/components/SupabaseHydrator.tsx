/**
 * SupabaseHydrator · monta una vez en App.tsx para sincronizar datos
 * desde Supabase a localStorage scoped en cada cambio de auth.
 *
 * Estrategia híbrida · ver `src/lib/supabaseHydrate.ts` para detalles.
 * Este componente es solo el "trigger" reactivo · la lógica de fetch
 * y escritura vive en el helper.
 */

import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
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
    if (hasName && hasOrgId) return; // ya está poblado

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
    );
  } catch (e) {
    console.warn("[SupabaseHydrator] ensure session skipped:", e);
  }
}

/** Registry de hidradores por nombre · permite que cada ruta declare
 *  cuáles necesita ANTES de mostrar su pantalla. Cada uno se
 *  memoiza · si se llama 2 veces, devuelve la misma promesa
 *  (no re-pulla). */
type HydratorName =
  | "base" | "seeds" | "invitations" | "emails" | "promoCollabStatus"
  | "agencyLicenses" | "companyEvents" | "favoriteAgencies"
  | "agencyOnboarding" | "agencyProfiles" | "twoFactor"
  | "developerPacks" | "publicRefs" | "plan" | "team" | "drafts";

const HYDRATORS: Record<HydratorName, () => Promise<unknown>> = {
  base: hydrateFromSupabase,
  seeds: hydrateSeedsFromSupabase,
  invitations: hydrateInvitationsFromSupabase,
  emails: hydrateSentEmailsFromSupabase,
  promoCollabStatus: hydratePromoCollabStatusFromSupabase,
  agencyLicenses: hydrateAgencyLicensesFromSupabase,
  companyEvents: hydrateCompanyEventsFromSupabase,
  favoriteAgencies: hydrateFavoriteAgenciesFromSupabase,
  agencyOnboarding: hydrateAgencyOnboardingFromSupabase,
  agencyProfiles: hydrateAgencyProfilesFromSupabase,
  twoFactor: hydrateTwoFactorFromSupabase,
  developerPacks: hydrateDeveloperPacksFromSupabase,
  publicRefs: hydrateUserPublicRefs,
  plan: hydratePlanForCurrentUser,
  team: hydrateTeamFromSupabase,
  drafts: hydrateDraftsFromSupabase,
};

const promiseCache: Partial<Record<HydratorName, Promise<unknown>>> = {};
function runOnce(name: HydratorName): Promise<unknown> {
  if (!promiseCache[name]) {
    promiseCache[name] = HYDRATORS[name]().catch((e) => {
      console.warn(`[hydrator:${name}] failed`, e);
      /* Borrar del cache para que se reintente al próximo getCriticalForRoute. */
      delete promiseCache[name];
    });
  }
  return promiseCache[name]!;
}

/** Mapping ruta → hidradores que su pantalla NECESITA antes de
 *  pintarse coherente. El resto se carga en background y refresca
 *  reactivamente cuando llegue. Dimensionado para evitar el
 *  parpadeo "vacío → relleno" en las pantallas activas. */
function getCriticalForRoute(pathname: string): HydratorName[] {
  /* `base` y `team` están en casi todas las pantallas (selectores,
   *  identidad del workspace) · siempre los incluyo. */
  const always: HydratorName[] = ["base", "team", "plan"];

  if (pathname.startsWith("/promociones")) {
    return [...always, "seeds", "drafts", "favoriteAgencies"];
  }
  if (pathname.startsWith("/colaboradores") || pathname.startsWith("/promotores")) {
    return [...always, "seeds", "agencyProfiles", "agencyLicenses", "favoriteAgencies"];
  }
  if (pathname.startsWith("/contactos") || pathname.startsWith("/registros")
      || pathname.startsWith("/ventas") || pathname.startsWith("/leads")) {
    return [...always, "seeds"];
  }
  if (pathname.startsWith("/empresa") || pathname.startsWith("/ajustes")) {
    return [...always, "agencyOnboarding", "twoFactor", "developerPacks"];
  }
  if (pathname.startsWith("/calendario")) {
    return [...always, "seeds"];
  }
  if (pathname.startsWith("/inicio") || pathname === "/") {
    return [...always, "seeds", "drafts"];
  }
  if (pathname.startsWith("/crear-promocion")) {
    return [...always, "drafts"];
  }
  /* Fallback · solo lo "always" · cualquier ruta no listada. */
  return always;
}

/** Hidratación CRÍTICA · bloquea el splash hasta que termine `auth`
 *  + los hidradores que la pantalla actual necesita. El resto se
 *  fire-and-forget al volver. */
async function hydrateCritical(pathname: string): Promise<void> {
  await ensureSessionStorageHydrated();
  const critical = getCriticalForRoute(pathname);
  await Promise.allSettled(critical.map(runOnce));
}

/** Hidratación BACKGROUND · dispara TODOS los demás hidradores
 *  (los no críticos para la ruta actual). Los memoizados que ya
 *  resolvieron son no-op. */
function hydrateBackground(): void {
  void Promise.allSettled(
    (Object.keys(HYDRATORS) as HydratorName[]).map(runOnce),
  );
}

/** Splash bloqueante mientras hidrata DB → memoria.
 *
 * Sin localStorage como cache, recargar significa que la primera
 * pintura tendría todos los stores vacíos. Esperamos a que la
 * primera tanda de hidratación termine antes de mostrar la app · una
 * espera única (~500ms-1s) en vez de spinners por cada componente. */
export function SupabaseHydrator({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!isSupabaseConfigured);
  /* Ruta inicial · capturada al primer mount para decidir qué
   *  hidradores son críticos. Cambios de ruta posteriores NO
   *  bloquean el splash (ya está dismissed) · si la ruta nueva
   *  necesita hidradores que aún no han resuelto, esos componentes
   *  ven empty state hasta que llegue su data via background. */
  const location = useLocation();

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    /* Crítica · solo lo que la ruta actual necesita para pintar
     *  coherente. Background dispara el resto en paralelo · el
     *  user navega a otras rutas y la data ya está caché. */
    void hydrateCritical(location.pathname).finally(() => {
      setReady(true);
      hydrateBackground();
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        /* Tras login · invalidamos cache y volvemos a hidratar
         *  desde cero · sin esto el user logueado verías data del
         *  user anterior. */
        for (const k of Object.keys(promiseCache)) {
          delete promiseCache[k as HydratorName];
        }
        void hydrateCritical(location.pathname).finally(() => hydrateBackground());
      } else if (event === "SIGNED_OUT") {
        clearSupabaseCache();
        clearMemCache();
        for (const k of Object.keys(promiseCache)) {
          delete promiseCache[k as HydratorName];
        }
      }
    });
    return () => subscription.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
