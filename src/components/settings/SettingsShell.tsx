/**
 * SettingsShell · Layout fullscreen para todas las páginas /ajustes/*.
 *
 * Estructura:
 *   - Top bar (sticky): logo "Ajustes" + buscador + Cerrar (→ Inicio)
 *   - Body: nav lateral 240px (desktop) o Sheet (mobile) + contenido.
 *     En la home (/ajustes) el sidebar se oculta para que el directorio
 *     de cards ocupe todo el ancho.
 *
 * El search del topbar:
 *   - Filtra el nav lateral (sub-páginas)
 *   - Comparte el query vía SettingsSearchContext con AjustesHome
 *     (el directorio también filtra y resalta en amarillo)
 *
 * Dirty guard:
 *   - Cualquier sub-página puede llamar a `useDirty().setDirty(true)`
 *     cuando el usuario cambia un campo
 *   - Si dirty=true al pulsar "← Ajustes" o "Cerrar", aparece un
 *     ConfirmDialog "¿Descartar los cambios sin guardar?"
 */

import { type ReactNode, useMemo, useState } from "react";
import { useLocation, useNavigate, NavLink } from "react-router-dom";
import { Check, ChevronLeft, Menu, Search, Settings as SettingsIcon, X } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { SETTINGS_SECTIONS, SHOW_DONE_TICKS, findContext } from "./registry";
import { SettingsSearchProvider } from "./SettingsSearchContext";
import { SettingsDirtyProvider, useSettingsDirtyValue } from "./SettingsDirtyContext";
import { Highlight } from "@/components/ui/Highlight";
import { useConfirm } from "@/components/ui/ConfirmDialog";

interface Props {
  children: ReactNode;
}

export function SettingsShell({ children }: Props) {
  /* El provider del dirty va por fuera para que `children` lo pueda
   * consumir; el shell también lo lee para warn en navegación. */
  return (
    <SettingsDirtyProvider>
      <SettingsShellInner>{children}</SettingsShellInner>
    </SettingsDirtyProvider>
  );
}

function SettingsShellInner({ children }: Props) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const confirm = useConfirm();
  const { dirty, setDirty } = useSettingsDirtyValue();

  const isHome = pathname === "/ajustes" || pathname === "/ajustes/";
  const ctx = findContext(pathname);

  /** Navegación con guard: si hay cambios sin guardar, pide confirmación. */
  const guardedNavigate = async (to: string) => {
    if (!dirty) {
      navigate(to);
      return;
    }
    const ok = await confirm({
      title: "¿Descartar los cambios sin guardar?",
      description: "Tienes ajustes modificados que no has guardado. Si sales ahora se perderán.",
      confirmLabel: "Descartar y salir",
      cancelLabel: "Seguir editando",
      variant: "destructive",
    });
    if (ok) {
      setDirty(false);
      navigate(to);
    }
  };

  /** Filtra el nav por el query del search. */
  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SETTINGS_SECTIONS;
    return SETTINGS_SECTIONS.map((s) => ({
      ...s,
      groups: s.groups
        .map((g) => ({
          ...g,
          links: g.links.filter(
            (l) =>
              l.label.toLowerCase().includes(q) ||
              g.title.toLowerCase().includes(q) ||
              s.title.toLowerCase().includes(q),
          ),
        }))
        .filter((g) => g.links.length > 0),
    })).filter((s) => s.groups.length > 0);
  }, [query]);

  const Nav = (
    <nav className="space-y-6">
      {filteredSections.map((s) => (
        <div key={s.id}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-2 px-2">
            <Highlight text={s.title} query={query} />
          </p>
          <ul className="space-y-2">
            {s.groups.map((g) => {
              const Icon = g.icon;
              const groupActive = g.links.some((l) => pathname.startsWith(l.to));
              return (
                <li key={g.id}>
                  <div
                    className={cn(
                      "flex items-center gap-2.5 px-2 py-1.5 text-sm",
                      groupActive ? "text-foreground font-semibold" : "text-foreground/80 font-medium",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                    <span className="truncate">
                      <Highlight text={g.title} query={query} />
                    </span>
                  </div>
                  <ul className="mt-0.5 mb-1 ml-7 space-y-0.5 border-l border-border/40 pl-3">
                    {g.links.map((l) => {
                      const active = pathname === l.to;
                      return (
                        <li key={l.to}>
                          <NavLink
                            to={l.to}
                            onClick={(e) => {
                              if (dirty && !active) {
                                e.preventDefault();
                                guardedNavigate(l.to);
                              } else {
                                setMobileOpen(false);
                              }
                            }}
                            className={cn(
                              "flex items-center gap-1.5 w-full text-left text-sm py-1.5 transition-colors",
                              active
                                ? "text-foreground font-medium"
                                : l.live
                                  ? "text-muted-foreground hover:text-foreground"
                                  : "text-muted-foreground/45 hover:text-muted-foreground italic",
                            )}
                            title={l.live ? undefined : "En diseño · pendiente de implementar"}
                          >
                            <span className="truncate">
                              <Highlight text={l.label} query={query} />
                              {l.external && (
                                <span className="ml-1.5 text-[9px] text-muted-foreground/60 align-middle">↗</span>
                              )}
                            </span>
                            {SHOW_DONE_TICKS && l.done && (
                              <Check
                                className="h-3 w-3 text-success shrink-0 ml-auto"
                                strokeWidth={3}
                                aria-label="Confirmado"
                              />
                            )}
                          </NavLink>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {filteredSections.length === 0 && (
        <p className="text-xs text-muted-foreground italic px-2">
          Sin coincidencias para "{query}"
        </p>
      )}
    </nav>
  );

  return (
    <SettingsSearchProvider value={{ query }}>
      <div className="min-h-screen bg-muted/30">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-card/90 backdrop-blur-md border-b border-border/40">
          <div className="max-w-[1250px] mx-auto px-4 sm:px-8 lg:px-10 h-14 flex items-center gap-3 sm:gap-6">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button className="lg:hidden h-9 w-9 rounded-full hover:bg-muted flex items-center justify-center">
                  <Menu className="h-4 w-4" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-0 bg-card">
                <div className="p-5 border-b border-border/40 flex items-center gap-2">
                  <SettingsIcon className="h-4 w-4" />
                  <p className="text-sm font-semibold">Ajustes</p>
                </div>
                <div className="p-4 overflow-y-auto h-[calc(100vh-65px)]">{Nav}</div>
              </SheetContent>
            </Sheet>

            <button
              onClick={() => guardedNavigate("/ajustes")}
              className="hidden lg:flex items-center gap-2 shrink-0 hover:opacity-80 transition-opacity"
            >
              <SettingsIcon className="h-4 w-4 text-foreground" />
              <p className="text-sm font-semibold text-foreground">Ajustes</p>
            </button>

            <div className="flex-1 max-w-[480px] mx-auto w-full">
              <div className="flex items-center h-9 rounded-full border border-border/40 bg-background focus-within:border-foreground/20 transition-colors px-3">
                <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar ajustes…"
                  className="flex-1 min-w-0 bg-transparent outline-none text-sm px-3 placeholder:text-muted-foreground/60"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="h-6 w-6 rounded-full hover:bg-muted flex items-center justify-center shrink-0"
                    title="Limpiar búsqueda"
                  >
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={() => guardedNavigate("/inicio")}
              className="inline-flex items-center gap-1.5 h-9 px-3 sm:px-4 rounded-full text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
              title="Cerrar ajustes"
            >
              <span className="hidden sm:inline">Cerrar</span>
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Body */}
        <div
          className={cn(
            "mx-auto",
            isHome
              ? "max-w-[1250px] px-4 sm:px-6 lg:px-10 pt-8 sm:pt-10 pb-16"
              : "max-w-[1250px] px-4 sm:px-8 lg:px-10 pt-6 pb-12 flex gap-8",
          )}
        >
          {!isHome && (
            <aside className="hidden lg:block w-[240px] shrink-0">
              <div className="sticky top-[80px] max-h-[calc(100vh-100px)] overflow-y-auto pr-2">
                {Nav}
              </div>
            </aside>
          )}

          <main className={cn(isHome ? "w-full" : "flex-1 min-w-0")}>
            {/* Breadcrumb / back en sub-páginas (no en home) */}
            {!isHome && ctx && (
              <button
                onClick={() => guardedNavigate("/ajustes")}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4 group"
              >
                <ChevronLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
                <span>Ajustes</span>
                <span className="text-muted-foreground/50">·</span>
                <span>{ctx.section.title}</span>
                <span className="text-muted-foreground/50">·</span>
                <span className="text-foreground/70">{ctx.group.title}</span>
              </button>
            )}
            {children}
          </main>
        </div>
      </div>
    </SettingsSearchProvider>
  );
}
