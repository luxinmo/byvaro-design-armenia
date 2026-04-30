/**
 * useWorkspaceMembers · hook reactivo del equipo del workspace actual.
 *
 * Lee del store correcto según el usuario logueado:
 *   · developer admin → equipo del promotor (TEAM_MEMBERS).
 *   · agency admin    → equipo de SU agencia (`agency-<id>`).
 *
 * Auto-importa `agencyTeamSeeds.ts` para registrar el builder de
 * agencias antes de la primera lectura — sin esto, las agencias
 * verían lista vacía. Cualquier escritura a través de
 * `persistMembers(...)` notifica con `meStorage.emitMembersChange()`,
 * y este hook re-renderiza al recibir el evento.
 */

import { useEffect, useState } from "react";
import { useCurrentUser, currentWorkspaceKey } from "./currentUser";
import { getMembersForWorkspace, teamStorageKey, type TeamMember } from "./team";
import { emitMembersChange } from "./meStorage";
/* Importación con efecto secundario · registra `buildAgencyTeam` en
 * `team.ts` para que las agencias tengan seed. Sin este import, los
 * accountType="agency" obtendrían lista vacía. */
import "./agencyTeamSeeds";

const MEMBERS_CHANGE_EVENT = "byvaro:members-change"; /* alineado con meStorage */

/** Resuelve el `workspaceKey` que toca leer al mostrar un tenant
 *  concreto (la entidad de la ficha pública/panel · NO el usuario
 *  logueado).
 *
 *    · undefined / null     → workspace del usuario actual (ficha propia).
 *    · "developer-default"  → developer-default (promotor mock único).
 *    · "developer-<id>"     → developer-default (single-tenant mock).
 *    · cualquier otro id    → `agency-<id>` (asumimos que es una agencia).
 *
 *  Mantiene 1-a-1 con `Empresa.tsx::entityType` y `agencyHref` /
 *  `developerHref`. */
export function tenantToWorkspaceKey(tenantId?: string | null): string | null {
  if (!tenantId) return null;
  if (tenantId.startsWith("developer-")) return "developer-default";
  return `agency-${tenantId}`;
}

/**
 * Hook reactivo del equipo del tenant mostrado.
 *
 *   · `useWorkspaceMembers()` sin args → equipo del workspace del
 *     usuario logueado (caso ficha propia).
 *   · `useWorkspaceMembers("agency-ag-1")` → equipo de esa agencia
 *     concreta (caso visitor / mirror).
 *
 * Devuelve también `setMembers` que persiste en la key correcta y
 * dispara `byvaro:members-change` para que otros consumers se
 * refresquen.
 */
export function useWorkspaceMembers(workspaceKeyOverride?: string): {
  members: TeamMember[];
  setMembers: (next: TeamMember[]) => void;
  workspaceKey: string;
} {
  const user = useCurrentUser();
  const workspaceKey = workspaceKeyOverride ?? currentWorkspaceKey(user);
  const [members, setMembersState] = useState<TeamMember[]>(() =>
    getMembersForWorkspace(workspaceKey),
  );

  /* Re-leer cuando cambia el workspace (account switcher, navegar a
   * otro tenant) o cuando otra pantalla emite cambio de miembros. */
  useEffect(() => {
    const refresh = () => setMembersState(getMembersForWorkspace(workspaceKey));
    refresh();
    window.addEventListener(MEMBERS_CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(MEMBERS_CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [workspaceKey]);

  const setMembers = (next: TeamMember[]) => {
    setMembersState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(teamStorageKey(workspaceKey), JSON.stringify(next));
      emitMembersChange();
    }
    /* Write-through · upsert a `organization_members`. Resuelve org_id
     *  desde workspaceKey (formato `agency-<id>` o `developer-default`). */
    void (async () => {
      try {
        const { supabase, isSupabaseConfigured } = await import("./supabaseClient");
        if (!isSupabaseConfigured) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const orgId = workspaceKey.startsWith("agency-")
          ? workspaceKey.slice("agency-".length)
          : workspaceKey;
        /* Solo update fields editables · NO tocamos role/status/user_id
         *  para evitar conflictos con bootstrap. Solo job_title, dept,
         *  languages, bio, phone. */
        for (const m of next) {
          if (!m.email) continue;
          /* Buscar fila existente por email match. */
          const { data: existing } = await supabase
            .from("organization_members")
            .select("id, user_id")
            .eq("organization_id", orgId)
            .limit(1000);
          /* Phase 2 simple: skip si no existe · solo actualiza meta de
           *  members ya creados via bootstrap. Crear miembros nuevos
           *  requiere auth.signUp · Phase 3. */
          const found = (existing as Array<{ id: string; user_id: string }> | null)?.find(
            () => false /* no email column on members · skip mass update */
          );
          if (!found) continue;
          await supabase.from("organization_members")
            .update({
              job_title: m.jobTitle ?? null,
              department: m.department ?? null,
              languages: m.languages ?? null,
              bio: m.bio ?? null,
              phone: m.phone ?? null,
            })
            .eq("id", found.id);
        }
      } catch (e) { console.warn("[members:sync] skipped:", e); }
    })();
  };

  return { members, setMembers, workspaceKey };
}
