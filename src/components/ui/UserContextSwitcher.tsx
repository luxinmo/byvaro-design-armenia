/**
 * UserContextSwitcher · pill compacto con avatar + nombre + chevron.
 *
 * Cambia el contexto del dashboard actual: el usuario puede elegir
 * ver actividades/eventos/datos "de todo el equipo" o filtrados a un
 * miembro concreto. Usado en:
 *   - `/inicio` · filtra contadores de Actividades + agenda de hoy.
 *   - `/calendario` · filtra los eventos del grid.
 *
 * Mobile-friendly: esconde el texto del nombre (solo avatar + chevron)
 * en anchos pequeños.
 *
 * Reutiliza el componente canónico `<Popover>` con el fix de scroll
 * global ya aplicado (ver ADR-055).
 */

import { useMemo, useState } from "react";
import { Check, ChevronDown, Users } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getAllTeamMembers, memberInitials, getMemberAvatarUrl } from "@/lib/team";
import { cn } from "@/lib/utils";

type Props = {
  /** Id del miembro activo · `null` = "Todo el equipo". */
  selectedUserId: string | null;
  onChange: (id: string | null) => void;
  /** Etiqueta del opción por defecto. */
  allLabel?: string;
  /** Alineación del popover. Default "end" (sale a la izquierda del trigger). */
  align?: "start" | "center" | "end";
};

export function UserContextSwitcher({
  selectedUserId, onChange, allLabel = "Todo el equipo", align = "end",
}: Props) {
  const [open, setOpen] = useState(false);
  const teamMembers = useMemo(
    () => getAllTeamMembers().filter((m) => !m.status || m.status === "active"),
    [],
  );
  const selected = selectedUserId
    ? teamMembers.find((m) => m.id === selectedUserId)
    : null;
  const avatarUrl = selected ? getMemberAvatarUrl(selected) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 h-10 pl-1 pr-3 sm:pr-4 rounded-full border border-border bg-card text-sm font-medium hover:bg-muted transition-colors shrink-0"
          title={selected ? `Filtrando · ${selected.name}` : `Contexto · ${allLabel}`}
        >
          {selected ? (
            avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-muted grid place-items-center text-[11px] font-bold shrink-0">
                {memberInitials(selected)}
              </div>
            )
          ) : (
            <div className="h-8 w-8 rounded-full bg-muted grid place-items-center shrink-0">
              <Users className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
            </div>
          )}
          <span className="hidden sm:inline truncate max-w-[120px]">
            {selected ? selected.name.split(" ")[0] : allLabel}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" strokeWidth={1.75} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-64 p-1.5"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Contexto
        </p>
        <button
          onClick={() => { onChange(null); setOpen(false); }}
          className={cn(
            "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors",
            selectedUserId === null ? "bg-muted" : "hover:bg-muted/60",
          )}
        >
          <div className="h-8 w-8 rounded-full bg-muted grid place-items-center shrink-0">
            <Users className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-medium text-foreground">{allLabel}</p>
            <p className="text-[10.5px] text-muted-foreground">Totales agregados</p>
          </div>
          {selectedUserId === null && <Check className="h-3.5 w-3.5 text-foreground shrink-0" strokeWidth={2.5} />}
        </button>

        <div className="border-t border-border/60 my-1" />

        <div className="max-h-[260px] overflow-y-auto overscroll-contain">
          {teamMembers.map((m) => {
            const url = getMemberAvatarUrl(m);
            const active = selectedUserId === m.id;
            return (
              <button
                key={m.id}
                onClick={() => { onChange(m.id); setOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors",
                  active ? "bg-muted" : "hover:bg-muted/60",
                )}
              >
                {url ? (
                  <img src={url} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-muted grid place-items-center text-[11px] font-bold shrink-0">
                    {memberInitials(m)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-foreground truncate">{m.name}</p>
                  {m.jobTitle && (
                    <p className="text-[10.5px] text-muted-foreground truncate">{m.jobTitle}</p>
                  )}
                </div>
                {active && <Check className="h-3.5 w-3.5 text-foreground shrink-0" strokeWidth={2.5} />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
