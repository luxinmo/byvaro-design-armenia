/**
 * EmpresaAgentsTab · equipo mostrado en la ficha PÚBLICA de Empresa.
 *
 * Fuente única: `TEAM_MEMBERS` del workspace (`src/lib/team.ts`) +
 * localStorage `byvaro.organization.members.v4` (cambios del admin).
 *
 * **Regla de visibilidad (ADR-050 · CLAUDE.md §🔒):** solo se
 * muestran los miembros con `visibleOnProfile === true` y
 * `status === "active"`. Esto permite al admin ocultar personal
 * interno (backoffice, administración) del perfil público mientras
 * conserva la visibilidad comercial (directores, agentes).
 *
 * Agrupación:
 *   · "Equipo directivo" → admin o departamento Dirección/Administración.
 *   · "Equipo" → el resto de miembros visibles.
 *
 * Idiomas renderizados con <Flag> (CLAUDE.md §🧱 Componentes canónicos).
 */

import { useMemo, useState } from "react";
import { EyeOff } from "lucide-react";
import { Flag } from "@/components/ui/Flag";
import { findLanguageByCode, sortLanguagesByImportance } from "@/lib/languages";
import { memberInitials, type TeamMember } from "@/lib/team";
import { useWorkspaceMembers, tenantToWorkspaceKey } from "@/lib/useWorkspaceMembers";

const LANG_PREVIEW_COUNT = 5;

/* useTeamMembers(tenantId) · equipo del TENANT MOSTRADO.
 *   · sin tenantId → workspace del usuario actual (ficha propia).
 *   · tenantId="developer-default" → equipo del promotor.
 *   · tenantId="ag-1" → equipo de la agencia ag-1.
 *
 * Antes era el workspace del usuario actual SIEMPRE · fugaba el
 * equipo de la agencia visitante a la ficha del promotor visitado. */
function useTeamMembers(tenantId?: string | null): TeamMember[] {
  const workspaceKey = tenantToWorkspaceKey(tenantId) ?? undefined;
  return useWorkspaceMembers(workspaceKey).members;
}

/* Heurística para clasificar cada miembro visible. */
function isDirection(m: TeamMember): boolean {
  if (m.role === "admin") return true;
  const dept = m.department?.toLowerCase() ?? "";
  return dept === "dirección" || dept === "administración";
}

function PersonCard({ member }: { member: TeamMember }) {
  /* Idiomas · ordenados por importancia (TOP_LANGUAGES primero) y
   *  cortados a 5. Si hay más se muestra un toggle "+N · ver más"
   *  que expande el listado · click en "ver menos" lo colapsa. */
  const sortedLangs = useMemo(
    () => sortLanguagesByImportance(member.languages ?? []),
    [member.languages],
  );
  const [langExpanded, setLangExpanded] = useState(false);
  const visibleLangs = langExpanded ? sortedLangs : sortedLangs.slice(0, LANG_PREVIEW_COUNT);
  const hiddenCount = sortedLangs.length - LANG_PREVIEW_COUNT;

  return (
    <div className="w-[154px] flex flex-col gap-2">
      <div className="w-[154px] h-[176px] rounded-xl overflow-hidden bg-muted/30">
        {member.avatarUrl ? (
          <img src={member.avatarUrl} alt={member.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center text-[34px] font-semibold text-muted-foreground/40">
            {memberInitials(member)}
          </div>
        )}
      </div>
      <div>
        <p className="text-[14px] font-semibold text-foreground truncate">{member.name}</p>
        {member.jobTitle && (
          <p className="text-[12.5px] text-muted-foreground truncate">{member.jobTitle}</p>
        )}
        {sortedLangs.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mt-1">
            {visibleLangs.map((code) => {
              const lang = findLanguageByCode(code);
              return (
                <Flag
                  key={code}
                  iso={lang?.countryIso ?? code}
                  size={15}
                  title={lang?.name ?? code}
                />
              );
            })}
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setLangExpanded((v) => !v)}
                className="text-[10.5px] font-medium text-muted-foreground hover:text-foreground transition-colors px-1"
              >
                {langExpanded ? "ver menos" : `+${hiddenCount}`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Banner informativo para el admin si hay miembros ocultos. */
function HiddenInfo({ hiddenCount }: { hiddenCount: number }) {
  if (hiddenCount === 0) return null;
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 p-3 flex items-start gap-2.5">
      <EyeOff className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0 mt-0.5" />
      <p className="text-[11.5px] text-muted-foreground leading-relaxed">
        <b className="text-foreground">{hiddenCount} {hiddenCount === 1 ? "miembro oculto" : "miembros ocultos"}</b> en este perfil público ·
        configurable en <a href="/equipo" className="underline hover:text-foreground">Equipo</a> con el toggle
        <span className="mx-1 font-semibold">Visible en el perfil público</span>.
      </p>
    </div>
  );
}

export function EmpresaAgentsTab({
  isVisitor = false,
  viewMode = "edit",
  tenantId,
}: {
  /** Cuando se monta desde la ficha pública vista por OTRO tenant
   *  (agencia mirando a un promotor o viceversa), `isVisitor` es
   *  true. El visitor NO ve el aviso "X miembros ocultos" · es
   *  metadato interno del workspace. */
  isVisitor?: boolean;
  /** En modo preview el promotor está simulando lo que ve un
   *  usuario externo · también ocultamos el aviso. */
  viewMode?: "edit" | "preview";
  /** Tenant mostrado · si lo pasas, el equipo se lee del workspace
   *  del tenant (developer o agency-XX). Sin él se lee del workspace
   *  del usuario actual (ficha propia). */
  tenantId?: string;
} = {}) {
  const members = useTeamMembers(tenantId);
  const { visible, hidden } = useMemo(() => {
    const active = members.filter((m) => !m.status || m.status === "active");
    return {
      visible: active.filter((m) => m.visibleOnProfile),
      hidden: active.filter((m) => !m.visibleOnProfile),
    };
  }, [members]);

  const direction = visible.filter(isDirection);
  const agents = visible.filter((m) => !isDirection(m));

  return (
    <div className="flex flex-col gap-5">
      {direction.length > 0 && (
        <section className="bg-card rounded-2xl border border-border shadow-soft p-6 flex flex-col gap-4">
          <h2 className="text-[13.5px] font-semibold text-foreground">Equipo directivo</h2>
          <div className="flex flex-wrap gap-4">
            {direction.map((m) => (
              <PersonCard key={m.id} member={m} />
            ))}
          </div>
        </section>
      )}

      {agents.length > 0 && (
        <section className="bg-card rounded-2xl border border-border shadow-soft p-6 flex flex-col gap-4">
          <h2 className="text-[13.5px] font-semibold text-foreground">Equipo</h2>
          <div className="flex flex-wrap gap-4">
            {agents.map((m) => (
              <PersonCard key={m.id} member={m} />
            ))}
          </div>
        </section>
      )}

      {visible.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <EyeOff className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">Sin miembros visibles</p>
          <p className="text-[11.5px] text-muted-foreground mt-1 max-w-sm mx-auto">
            Ningún miembro del equipo tiene el toggle "Visible en el perfil público" activado.
            Actívalo desde <a href="/equipo" className="underline hover:text-foreground">Equipo</a>.
          </p>
        </div>
      )}

      {/* Info al admin: cuántos quedan ocultos */}
      {/* Solo el admin del workspace en su propia ficha en modo
          edición ve cuántos miembros tiene ocultos. La agencia (o
          cualquier visitor) y el promotor en preview NO ven este
          aviso · es metadato de gestión interna. */}
      {!isVisitor && viewMode === "edit" && <HiddenInfo hiddenCount={hidden.length} />}
    </div>
  );
}
