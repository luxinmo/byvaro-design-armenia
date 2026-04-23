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
 *   · "Agentes" → el resto de miembros visibles.
 *
 * Idiomas renderizados con <Flag> (CLAUDE.md §🧱 Componentes canónicos).
 */

import { useEffect, useMemo, useState } from "react";
import { EyeOff } from "lucide-react";
import { Flag } from "@/components/ui/Flag";
import { findLanguageByCode } from "@/lib/languages";
import { TEAM_MEMBERS, memberInitials, type TeamMember } from "@/lib/team";

const KEY_MEMBERS = "byvaro.organization.members.v4";

function loadMembers(): TeamMember[] {
  if (typeof window === "undefined") return TEAM_MEMBERS;
  try {
    const raw = window.localStorage.getItem(KEY_MEMBERS);
    return raw ? JSON.parse(raw) : TEAM_MEMBERS;
  } catch { return TEAM_MEMBERS; }
}

function useTeamMembers(): TeamMember[] {
  const [list, setList] = useState<TeamMember[]>(() => loadMembers());
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reload = () => setList(loadMembers());
    window.addEventListener("byvaro:members-change", reload);
    window.addEventListener("byvaro:me-change", reload);
    window.addEventListener("storage", reload);
    return () => {
      window.removeEventListener("byvaro:members-change", reload);
      window.removeEventListener("byvaro:me-change", reload);
      window.removeEventListener("storage", reload);
    };
  }, []);
  return list;
}

/* Heurística para clasificar cada miembro visible. */
function isDirection(m: TeamMember): boolean {
  if (m.role === "admin") return true;
  const dept = m.department?.toLowerCase() ?? "";
  return dept === "dirección" || dept === "administración";
}

function PersonCard({ member }: { member: TeamMember }) {
  return (
    <div className="w-28 flex flex-col gap-2">
      <div className="w-28 h-32 rounded-xl overflow-hidden bg-muted/30">
        {member.avatarUrl ? (
          <img src={member.avatarUrl} alt={member.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center text-2xl font-semibold text-muted-foreground/40">
            {memberInitials(member)}
          </div>
        )}
      </div>
      <div>
        <p className="text-[12px] font-semibold text-foreground truncate">{member.name}</p>
        {member.jobTitle && (
          <p className="text-[10.5px] text-muted-foreground truncate">{member.jobTitle}</p>
        )}
        {member.languages && member.languages.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {member.languages.map((code) => {
              const lang = findLanguageByCode(code);
              return (
                <Flag
                  key={code}
                  iso={lang?.countryIso ?? code}
                  size={12}
                  title={lang?.name ?? code}
                />
              );
            })}
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

export function EmpresaAgentsTab() {
  const members = useTeamMembers();
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
          <h2 className="text-[13.5px] font-semibold text-foreground">Agentes</h2>
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
      <HiddenInfo hiddenCount={hidden.length} />
    </div>
  );
}
