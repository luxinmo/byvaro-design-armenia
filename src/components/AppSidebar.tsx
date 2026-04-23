/**
 * AppSidebar — Navbar principal desktop (≥lg).
 *
 * Modos:
 *   - **Expanded** (236px): grupos con labels, items con icono + título
 *     + badge. Es el estado por defecto.
 *   - **Collapsed** (56px): solo iconos centrados, labels y badges
 *     ocultos. Tooltip nativo (`title`) con el nombre. Se activa
 *     automáticamente en las rutas listadas en `COLLAPSED_ROUTES`
 *     (hoy: `/emails`) — patrón replicado del ref Lovable para dar
 *     ancho al cliente de correo sin hacer desaparecer la navegación.
 */

import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  Home, Tag, FileText, CircleDollarSign, CalendarDays,
  Handshake, Contact, Globe, Mail, Settings, ChevronsUpDown,
  Building2, Inbox, User as UserIcon, LogOut, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEmpresa } from "@/lib/empresa";
import { BrandLogo } from "@/components/BrandLogo";
import { useCurrentUser } from "@/lib/currentUser";
import { logout } from "@/lib/accountType";

type NavItem = { title: string; url: string; icon: React.ComponentType<{ className?: string }>; badge?: string | number; accent?: boolean };
type NavGroup = { label: string; items: NavItem[] };

/** Rutas donde la sidebar se colapsa automáticamente a icon-only. */
const COLLAPSED_ROUTES = ["/emails"];

const groups: NavGroup[] = [
  {
    label: "General",
    items: [{ title: "Inicio", url: "/inicio", icon: Home }],
  },
  {
    label: "Comercial",
    items: [
      { title: "Promociones", url: "/promociones", icon: Tag, badge: 12 },
      { title: "Leads", url: "/leads", icon: Inbox, badge: 24, accent: true },
      { title: "Registros", url: "/registros", icon: FileText, badge: 8 },
      { title: "Ventas", url: "/ventas", icon: CircleDollarSign },
      { title: "Calendario", url: "/calendario", icon: CalendarDays },
    ],
  },
  {
    label: "Red",
    items: [
      { title: "Colaboradores", url: "/colaboradores", icon: Handshake },
      { title: "Contactos", url: "/contactos", icon: Contact },
    ],
  },
  {
    label: "Contenido",
    items: [
      { title: "Microsites", url: "/microsites", icon: Globe },
      { title: "Emails", url: "/emails", icon: Mail },
    ],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { empresa } = useEmpresa();
  const currentUser = useCurrentUser();
  const isAgencyUser = currentUser.accountType === "agency";

  const onEmpresaRoute = location.pathname.startsWith("/empresa");
  const necesitaOnboarding = !empresa.onboardingCompleto;
  const collapsed = COLLAPSED_ROUTES.some((r) => location.pathname.startsWith(r));

  /* Dropdown del botón de usuario (pie del sidebar) · abre arriba porque
   * el botón vive en la última fila. Cierra al clicar fuera o elegir opción. */
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [userMenuOpen]);

  /* En modo agencia, oculta rutas que sólo tienen sentido para el
   * promotor. Estas mismas rutas se redirigen en App.tsx vía
   * <AgencyGuard> si el usuario entra por URL directa. */
  const agencyHiddenRoutes = new Set([
    "/colaboradores",
    "/microsites",
    "/leads",
    "/emails",
  ]);
  const visibleGroups = isAgencyUser
    ? groups
        .map((g) => ({
          ...g,
          items: g.items.filter((it) => !agencyHiddenRoutes.has(it.url)),
        }))
        .filter((g) => g.items.length > 0)
    : groups;

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col shrink-0 border-r border-sidebar-border bg-sidebar sticky top-0 h-screen transition-[width] duration-200",
        collapsed ? "w-14" : "w-[236px]",
      )}
    >
      {/* Logo — en modo colapsado, solo isotipo centrado */}
      <div
        className={cn(
          "h-14 flex items-center border-b border-sidebar-border",
          collapsed ? "justify-center px-2" : "px-5",
        )}
      >
        <BrandLogo
          variant={collapsed ? "icon" : "lockup"}
          iconSize={collapsed ? 28 : 32}
          wordmarkHeight={16}
        />
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 no-scrollbar">
        {visibleGroups.map((group) => (
          <div key={group.label} className={collapsed ? "mb-2" : "mb-5"}>
            {!collapsed && (
              <div className="px-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/50 mb-2">
                {group.label}
              </div>
            )}
            {group.items.map((item) => {
              const isActive = location.pathname === item.url;
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.url}
                  to={item.url}
                  title={collapsed ? item.title : undefined}
                  className={cn(
                    "relative flex items-center transition-colors",
                    collapsed
                      ? "justify-center h-10 mx-2 rounded-lg"
                      : "gap-3 px-5 py-2 text-sm",
                    isActive
                      ? "bg-sidebar-accent/70 text-sidebar-accent-foreground font-medium nav-item-active"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/40",
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed && <span>{item.title}</span>}
                  {!collapsed && item.badge !== undefined && (
                    <span
                      className={cn(
                        "ml-auto text-[11px] tnum font-semibold rounded-md",
                        item.accent
                          ? "text-primary bg-primary/10 px-1.5 py-px"
                          : "text-sidebar-foreground/50",
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                  {collapsed && item.badge !== undefined && (
                    <span
                      className={cn(
                        "absolute top-1 right-1 h-1.5 w-1.5 rounded-full",
                        item.accent ? "bg-primary" : "bg-sidebar-foreground/40",
                      )}
                      aria-hidden
                    />
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}

        {/* ═════ Administración · solo promotor ═════ */}
        {!isAgencyUser && (
        <div className={collapsed ? "mb-2" : "mb-5"}>
          {!collapsed && (
            <div className="px-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/50 mb-2">
              Administración
            </div>
          )}
          <NavLink
            to="/empresa"
            title={collapsed ? "Empresa" : undefined}
            className={cn(
              "relative flex items-center transition-colors",
              collapsed
                ? "justify-center h-10 mx-2 rounded-lg"
                : "gap-3 px-5 py-2 text-sm",
              onEmpresaRoute
                ? "bg-sidebar-accent/70 text-sidebar-accent-foreground font-medium nav-item-active"
                : "text-sidebar-foreground hover:bg-sidebar-accent/40",
            )}
          >
            <Building2 className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span>Empresa</span>}
            {necesitaOnboarding && (
              <span
                className={cn(
                  "rounded-full bg-primary animate-pulse",
                  collapsed ? "absolute top-1 right-1 h-1.5 w-1.5" : "ml-auto h-1.5 w-1.5",
                )}
                aria-label="Pendiente de configurar"
              />
            )}
          </NavLink>

          {/* Equipo · vive junto a Empresa porque conceptualmente es parte
           *  del perfil organizativo (miembros que aparecen en el microsite,
           *  plan de comisiones, invitaciones). */}
          <NavLink
            to="/equipo"
            title={collapsed ? "Equipo" : undefined}
            className={({ isActive }) =>
              cn(
                "relative flex items-center transition-colors",
                collapsed
                  ? "justify-center h-10 mx-2 rounded-lg"
                  : "gap-3 px-5 py-2 text-sm",
                isActive
                  ? "bg-sidebar-accent/70 text-sidebar-accent-foreground font-medium nav-item-active"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/40",
              )
            }
          >
            <Users className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && <span>Equipo</span>}
          </NavLink>
        </div>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border py-3">
        <NavLink
          to="/ajustes"
          title={collapsed ? "Ajustes" : undefined}
          className={({ isActive }) =>
            cn(
              "relative flex items-center transition-colors",
              collapsed
                ? "justify-center h-10 mx-2 rounded-lg"
                : "gap-3 px-5 py-2 text-sm",
              isActive
                ? "bg-sidebar-accent/70 text-sidebar-accent-foreground font-medium nav-item-active"
                : "text-sidebar-foreground hover:bg-sidebar-accent/40",
            )
          }
        >
          <Settings className="h-[18px] w-[18px]" />
          {!collapsed && <span>Ajustes</span>}
        </NavLink>
        <div
          ref={userMenuRef}
          className={cn(
            "relative mt-2 pt-3 border-t border-sidebar-border/60",
            collapsed ? "px-2" : "px-4",
          )}
        >
          <button
            type="button"
            onClick={() => setUserMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={userMenuOpen}
            title={collapsed ? currentUser.name : undefined}
            className={cn(
              "w-full flex items-center rounded-lg transition-colors",
              userMenuOpen ? "bg-sidebar-accent/60" : "hover:bg-sidebar-accent/40",
              collapsed ? "justify-center py-2" : "gap-3 px-2 py-2",
            )}
          >
            {currentUser.avatar ? (
              <img
                src={currentUser.avatar}
                alt=""
                className="w-8 h-8 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/15 text-primary grid place-items-center font-semibold text-xs tnum shrink-0">
                {currentUser.name
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </div>
            )}
            {!collapsed && (
              <>
                <div className="text-left min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-foreground truncate leading-tight">
                    {currentUser.name}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {isAgencyUser
                      ? `${currentUser.agencyName ?? "Agencia"} · Agencia`
                      : empresa.nombreComercial
                        ? `${empresa.nombreComercial} · Promotor`
                        : "Luxinmo · Promotor"}
                  </div>
                </div>
                <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </>
            )}
          </button>

          {userMenuOpen && (
            <div
              role="menu"
              className={cn(
                "absolute z-40 rounded-xl border border-border bg-card shadow-soft-lg overflow-hidden",
                // Abre arriba del botón · ancho fijo en modo expanded,
                // flotante a la derecha en modo collapsed.
                collapsed
                  ? "left-[calc(100%+8px)] bottom-0 w-56"
                  : "left-4 right-4 bottom-[calc(100%+6px)]",
              )}
            >
              <div className="px-3 py-2.5 border-b border-border">
                <p className="text-[13px] font-semibold text-foreground truncate">{currentUser.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{currentUser.email}</p>
              </div>
              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    navigate("/ajustes/perfil/personal");
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-foreground hover:bg-muted/60 transition-colors"
                >
                  <UserIcon className="h-4 w-4 text-muted-foreground" />
                  Mi perfil
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    navigate("/ajustes");
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-foreground hover:bg-muted/60 transition-colors"
                >
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  Ajustes
                </button>
              </div>
              <div className="border-t border-border py-1">
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setUserMenuOpen(false);
                    navigate("/login", { replace: true });
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Cerrar sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
