/**
 * UserSelect · selector único de miembro del equipo.
 *
 * Usar en TODOS los sitios donde se elige un agente/usuario:
 *  - Evaluar visita (qué agente la realizó)
 *  - Asignar contacto a otro miembro
 *  - Filtros por agente
 *  - Crear visita / tarea / etc.
 *
 * Datos: viene siempre de `TEAM_MEMBERS` (src/lib/team.ts).
 */

import { useMemo, useState } from "react";
import { ChevronDown, Search, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  TEAM_MEMBERS, memberInitials, findTeamMember, type TeamMember,
} from "@/lib/team";

type Props = {
  /** id del miembro o `null` si nadie. */
  value: string | null;
  onChange: (memberId: string) => void;
  placeholder?: string;
  /** Si true, no permite cerrar el popover sin elegir. */
  required?: boolean;
};

export function UserSelect({ value, onChange, placeholder = "Selecciona miembro…", required }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = value ? findTeamMember(value) : undefined;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TEAM_MEMBERS;
    return TEAM_MEMBERS.filter(
      (m) => m.name.toLowerCase().includes(q) ||
             m.email.toLowerCase().includes(q) ||
             (m.jobTitle?.toLowerCase().includes(q) ?? false),
    );
  }, [query]);

  const handleClose = (next: boolean) => {
    if (!next && required && !value) return;
    setOpen(next);
    if (!next) setQuery("");
  };

  return (
    <Popover open={open} onOpenChange={handleClose}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full h-9 px-2 text-sm rounded-xl border border-border bg-card outline-none focus:border-primary flex items-center gap-2"
        >
          {selected ? (
            <>
              <Avatar member={selected} size={24} />
              <span className="flex-1 truncate text-left text-foreground">{selected.name}</span>
              {selected.jobTitle && (
                <span className="hidden sm:inline text-[11px] text-muted-foreground truncate max-w-[100px]">
                  {selected.jobTitle}
                </span>
              )}
            </>
          ) : (
            <span className="flex-1 text-left text-muted-foreground pl-1">{placeholder}</span>
          )}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        collisionPadding={8}
        className="w-[--radix-popover-trigger-width] min-w-[260px] p-0 rounded-xl border-border shadow-soft-lg overflow-hidden"
      >
        <div className="border-b border-border/60 px-3 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/60" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, email, cargo…"
              className="w-full h-8 pl-7 pr-2 text-xs bg-muted/40 border border-transparent rounded-full focus:bg-background focus:border-border outline-none"
            />
          </div>
        </div>
        <div className="max-h-[260px] overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="text-[11px] text-muted-foreground italic text-center py-3">Sin coincidencias</p>
          ) : filtered.map((m) => {
            const isSelected = m.id === value;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => { onChange(m.id); setOpen(false); setQuery(""); }}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors",
                  isSelected ? "bg-muted text-foreground" : "text-foreground hover:bg-muted/40",
                )}
              >
                <Avatar member={m} size={28} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{m.name}</p>
                  {m.jobTitle && (
                    <p className="text-[10px] text-muted-foreground truncate">{m.jobTitle}</p>
                  )}
                </div>
                {isSelected && <Check className="h-3 w-3 text-emerald-600 shrink-0" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Avatar({ member, size }: { member: TeamMember; size: number }) {
  return (
    <div
      className="rounded-full bg-foreground/10 grid place-items-center text-foreground font-semibold shrink-0 overflow-hidden"
      style={{ width: size, height: size, fontSize: size / 2.4 }}
    >
      {member.avatarUrl ? (
        <img src={member.avatarUrl} alt={member.name} className="w-full h-full object-cover" />
      ) : (
        <span>{memberInitials(member)}</span>
      )}
    </div>
  );
}
