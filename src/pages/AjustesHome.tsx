/**
 * /ajustes (home) — Directorio estilo Lovable.
 *
 * Filtra por el query del SettingsSearchContext (compartido con el
 * topbar del shell). Resalta matches en amarillo.
 *
 * Links no funcionales (placeholders) se renderizan con color más
 * claro para que el usuario distinga de un vistazo qué está activo.
 * Cuando una página deja de ser placeholder se marca `live: true`
 * en `registry.ts` y el indicador desaparece automáticamente.
 */

import { Link } from "react-router-dom";
import { useMemo } from "react";
import { Check } from "lucide-react";
import { SETTINGS_SECTIONS, SHOW_DONE_TICKS } from "@/components/settings/registry";
import { useSettingsSearch } from "@/components/settings/SettingsSearchContext";
import { Highlight } from "@/components/ui/Highlight";
import { cn } from "@/lib/utils";

export default function AjustesHome() {
  const query = useSettingsSearch();

  /** Filtra secciones/grupos/links por el query (case-insensitive). */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SETTINGS_SECTIONS;
    return SETTINGS_SECTIONS.map((s) => ({
      ...s,
      groups: s.groups
        .map((g) => {
          /* Si el match es en el título del grupo o de la sección,
           * dejamos todos los links visibles. Si es en un link
           * concreto, mostramos solo los que matchean. */
          const sectionOrGroupMatch =
            s.title.toLowerCase().includes(q) || g.title.toLowerCase().includes(q);
          const links = sectionOrGroupMatch
            ? g.links
            : g.links.filter((l) => l.label.toLowerCase().includes(q));
          return { ...g, links };
        })
        .filter((g) => g.links.length > 0),
    })).filter((s) => s.groups.length > 0);
  }, [query]);

  if (filtered.length === 0) {
    return (
      <div className="w-full max-w-[600px] mx-auto py-20 text-center">
        <p className="text-sm text-muted-foreground">
          Sin coincidencias para <strong className="text-foreground">"{query}"</strong>
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1250px] mx-auto space-y-6">
      {filtered.map((section) => (
        <section
          key={section.id}
          className="bg-card rounded-2xl border border-border/40 shadow-soft overflow-hidden"
        >
          <header className="px-6 sm:px-10 lg:px-12 pt-8 pb-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
              <Highlight text={section.title} query={query} />
            </p>
          </header>

          <div className="px-6 sm:px-10 lg:px-12 pb-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-10 gap-y-10">
            {section.groups.map((group) => {
              const Icon = group.icon;
              const firstLive = group.links.find((l) => l.live) ?? group.links[0];
              return (
                <div key={group.id} className="min-w-0">
                  <Link
                    to={firstLive?.to ?? "/ajustes"}
                    className="inline-flex items-center gap-2.5 group mb-4"
                  >
                    <Icon className="h-[18px] w-[18px] text-foreground" strokeWidth={1.75} />
                    <h3 className="text-[15px] font-semibold text-foreground group-hover:text-primary transition-colors">
                      <Highlight text={group.title} query={query} />
                    </h3>
                  </Link>

                  <ul className="space-y-2.5">
                    {group.links.map((link) => (
                      <li key={link.to}>
                        <Link
                          to={link.to}
                          className={cn(
                            "inline-flex items-center gap-1.5 text-[14px] truncate transition-colors max-w-full",
                            link.live
                              ? "text-muted-foreground hover:text-foreground"
                              : "text-muted-foreground/45 hover:text-muted-foreground italic",
                          )}
                          title={
                            link.live
                              ? undefined
                              : "En diseño · pendiente de implementar"
                          }
                        >
                          <span className="truncate">
                            <Highlight text={link.label} query={query} />
                            {link.external && (
                              <span className="ml-1 text-[10px] text-muted-foreground/50 align-middle">↗</span>
                            )}
                          </span>
                          {SHOW_DONE_TICKS && link.done && (
                            <Check
                              className="h-3.5 w-3.5 text-success shrink-0"
                              strokeWidth={3}
                              aria-label="Confirmado"
                            />
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
