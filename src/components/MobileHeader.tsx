import { Menu, X, ArrowLeft } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import {
  Home, Tag, FileText, CircleDollarSign, CalendarDays,
  Handshake, Contact, Globe, Mail, Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/BrandLogo";

const drawerGroups = [
  { label: "General", items: [{ title: "Inicio", url: "/inicio", icon: Home }] },
  { label: "Comercial", items: [
    { title: "Promociones", url: "/promociones", icon: Tag },
    { title: "Registros", url: "/registros", icon: FileText },
    { title: "Ventas", url: "/ventas", icon: CircleDollarSign },
    { title: "Calendario", url: "/calendario", icon: CalendarDays },
  ]},
  { label: "Red", items: [
    { title: "Colaboradores", url: "/colaboradores", icon: Handshake },
    { title: "Contactos", url: "/contactos", icon: Contact },
  ]},
  { label: "Contenido", items: [
    { title: "Microsites", url: "/microsites", icon: Globe },
    { title: "Emails", url: "/emails", icon: Mail },
  ]},
];

export function MobileHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // Rutas "raíz" del menú principal — fuera de ellas mostramos la
  // flecha de volver en lugar del logo.
  const rootPaths = ["/inicio", "/promociones", "/registros", "/ventas", "/calendario", "/colaboradores", "/contactos", "/microsites", "/emails", "/ajustes", "/empresa"];
  const isRoot = rootPaths.includes(location.pathname);

  return (
    <>
      {/* Topbar 3-cols · el logo SIEMPRE en el centro; izquierda cede
          espacio para la flecha atrás cuando estamos en un detalle;
          derecha: campana + hamburguesa. */}
      <header className="lg:hidden sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="h-12 px-3 grid grid-cols-[auto_1fr_auto] items-center gap-2">
          {/* Izquierda */}
          <div className="flex items-center">
            {!isRoot && (
              <button
                onClick={() => navigate(-1)}
                className="p-2 -ml-2 rounded-lg hover:bg-muted text-foreground"
                aria-label="Volver"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
          </div>
          {/* Centro · wordmark fijo (sólo "byvaro" sin icono). */}
          <div className="flex items-center justify-center">
            <BrandLogo variant="wordmark" wordmarkHeight={18} />
          </div>
          {/* Derecha · menú (las notificaciones viven en la bottom bar). */}
          <div className="flex items-center justify-end">
            <button
              onClick={() => setOpen(true)}
              className="p-2 -mr-2 rounded-lg hover:bg-muted text-foreground"
              aria-label="Abrir menú"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute right-0 top-0 bottom-0 w-[280px] bg-sidebar shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            <div className="h-14 flex items-center justify-between px-5 border-b border-sidebar-border">
              <BrandLogo variant="lockup" iconSize={32} wordmarkHeight={16} />
              <button onClick={() => setOpen(false)} className="p-2 -mr-2 rounded-lg hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-4">
              {drawerGroups.map((group) => (
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
                        onClick={() => setOpen(false)}
                        className={cn(
                          "relative flex items-center gap-3 px-5 py-2 text-sm transition-colors",
                          isActive
                            ? "bg-sidebar-accent/70 text-sidebar-accent-foreground font-medium nav-item-active"
                            : "text-sidebar-foreground hover:bg-sidebar-accent/40"
                        )}
                      >
                        <Icon className="h-[18px] w-[18px]" />
                        {item.title}
                      </NavLink>
                    );
                  })}
                </div>
              ))}
            </nav>
            <div className="border-t border-sidebar-border p-4">
              <NavLink
                to="/ajustes"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-2 py-2 text-sm text-sidebar-foreground rounded-lg hover:bg-sidebar-accent/40"
              >
                <Settings className="h-[18px] w-[18px]" /> Ajustes
              </NavLink>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
