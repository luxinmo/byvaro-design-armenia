/**
 * EmpresaAgentsTab · réplica con mock data. Cuando esté listo el
 * módulo Usuarios se conectará a `useUsuarios()`.
 *
 * Sigue la regla de CLAUDE.md §🧱 Componentes canónicos:
 *   - Idiomas por código ISO (no emoji) renderizados con <Flag>.
 *   - Banderas SVG desde `public/flags/` vía `flagUrl()`.
 */

import { Flag } from "@/components/ui/Flag";
import { findLanguageByCode } from "@/lib/languages";
import { cn } from "@/lib/utils";

/** Idiomas como códigos ISO (ES/EN/FR…) · se renderizan con <Flag>. */
const managementTeam = [
  { name: "Isabel Fernández", role: "Directora",      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop", languages: ["ES", "DE", "FR"] },
  { name: "Haruki Saito",     role: "Administración", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop", languages: ["ES", "EN", "JA"] },
  { name: "Sofía Morales",    role: "Finanzas",       avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop", languages: ["ES", "EN"] },
];

const agents = [
  { name: "Aiko Nakamura",    role: "Property Consultant", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop", languages: ["ES", "JA", "EN"] },
  { name: "Carmen Rodríguez", role: "Client Advisor",      avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop", languages: ["ES", "EN"] },
  { name: "Isabel Fernández", role: "Luxury Specialist",   avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop", languages: ["ES", "DE"] },
  { name: "Sofía Morales",    role: "Broker",              avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop", languages: ["ES", "FR"] },
];

function PersonCard({
  name, role, avatar, languages, className,
}: { name: string; role: string; avatar: string; languages: string[]; className?: string }) {
  return (
    <div className={cn("w-28 flex flex-col gap-2", className)}>
      <div className="w-28 h-32 rounded-xl overflow-hidden bg-muted/30">
        <img src={avatar} alt={name} className="w-full h-full object-cover" />
      </div>
      <div>
        <p className="text-[12px] font-semibold text-foreground truncate">{name}</p>
        <p className="text-[10.5px] text-muted-foreground truncate">{role}</p>
        <div className="flex flex-wrap gap-1 mt-1">
          {languages.map((code) => {
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
      </div>
    </div>
  );
}

export function EmpresaAgentsTab() {
  return (
    <div className="flex flex-col gap-5">
      <section className="bg-card rounded-2xl border border-border shadow-soft p-6 flex flex-col gap-4">
        <h2 className="text-[13.5px] font-semibold text-foreground">Equipo directivo</h2>
        <div className="flex flex-wrap gap-4">
          {managementTeam.map((m) => (
            <PersonCard key={m.name} {...m} />
          ))}
        </div>
      </section>

      <section className="bg-card rounded-2xl border border-border shadow-soft p-6 flex flex-col gap-4">
        <h2 className="text-[13.5px] font-semibold text-foreground">Agentes</h2>
        <div className="flex flex-wrap gap-4">
          {agents.map((a) => (
            <PersonCard key={a.name + a.role} {...a} />
          ))}
        </div>
        <button type="button" className="text-[11.5px] text-muted-foreground hover:text-foreground transition-colors mx-auto">
          Cargar más…
        </button>
      </section>
    </div>
  );
}
