import { NavLink, useLocation } from "react-router-dom";
import {
  Home, Tag, FileText, CircleDollarSign, CalendarDays,
  Handshake, Contact, Globe, Mail, Settings, ChevronsUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { title: string; url: string; icon: React.ComponentType<{ className?: string }>; badge?: string | number; accent?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const groups: NavGroup[] = [
  {
    label: "General",
    items: [{ title: "Inicio", url: "/inicio", icon: Home }],
  },
  {
    label: "Comercial",
    items: [
      { title: "Promociones", url: "/promociones", icon: Tag, badge: 12 },
      { title: "Registros", url: "/registros", icon: FileText, badge: 8, accent: true },
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

  return (
    <aside className="hidden lg:flex flex-col w-[236px] shrink-0 border-r border-sidebar-border bg-sidebar sticky top-0 h-screen">
      {/* Logo */}
      <div className="h-14 flex items-center gap-2.5 px-5 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded-xl bg-primary grid place-items-center text-primary-foreground font-bold text-sm">B</div>
        <div className="font-bold text-[15px] tracking-tight text-foreground">Byvaro</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 no-scrollbar">
        {groups.map((group) => (
          <div key={group.label} className="mb-5">
            <div className="px-5 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/50 mb-2">
              {group.label}
            </div>
            {group.items.map((item) => {
              const isActive = location.pathname === item.url;
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.url}
                  to={item.url}
                  className={cn(
                    "relative flex items-center gap-3 px-5 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-sidebar-accent/70 text-sidebar-accent-foreground font-medium nav-item-active"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/40"
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  <span>{item.title}</span>
                  {item.badge !== undefined && (
                    <span
                      className={cn(
                        "ml-auto text-[11px] tnum font-semibold rounded-md",
                        item.accent
                          ? "text-primary bg-primary/10 px-1.5 py-px"
                          : "text-sidebar-foreground/50"
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border py-3">
        <NavLink
          to="/ajustes"
          className={({ isActive }) => cn(
            "relative flex items-center gap-3 px-5 py-2 text-sm transition-colors",
            isActive
              ? "bg-sidebar-accent/70 text-sidebar-accent-foreground font-medium nav-item-active"
              : "text-sidebar-foreground hover:bg-sidebar-accent/40"
          )}
        >
          <Settings className="h-[18px] w-[18px]" />
          <span>Ajustes</span>
        </NavLink>
        <div className="px-4 mt-2 pt-3 border-t border-sidebar-border/60">
          <button className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-sidebar-accent/40 transition-colors">
            <div className="w-8 h-8 rounded-full bg-primary/15 text-primary grid place-items-center font-semibold text-xs tnum shrink-0">
              AR
            </div>
            <div className="text-left min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-foreground truncate leading-tight">Arman Rahmanov</div>
              <div className="text-[11px] text-muted-foreground truncate">Luxinmo · Promotor</div>
            </div>
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </button>
        </div>
      </div>
    </aside>
  );
}
