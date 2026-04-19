import { Bell, Home, Search } from "lucide-react";
import { useLocation } from "react-router-dom";

/**
 * Header global (desktop).
 * Responsabilidad: ubicación (breadcrumb) + utilidades (búsqueda ⌘K, notificaciones).
 * NO duplica elementos del header de cada página (título grande, CTAs, buscador local).
 */

const titles: Record<string, string> = {
  "/inicio": "Inicio",
  "/promociones": "Promociones",
  "/registros": "Registros",
  "/ventas": "Ventas",
  "/calendario": "Calendario",
  "/colaboradores": "Colaboradores",
  "/contactos": "Contactos",
  "/microsites": "Microsites",
  "/emails": "Emails",
  "/ajustes": "Ajustes",
};

export function AppHeader() {
  const location = useLocation();
  const title = titles[location.pathname] || "Inicio";

  return (
    <header className="hidden lg:flex h-14 sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-6 items-center justify-between gap-4">
      {/* Breadcrumb · solo contexto, no título */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Home className="h-3.5 w-3.5" />
        <span className="text-muted-foreground/60">/</span>
        <span className="font-medium text-foreground">{title}</span>
      </div>

      {/* Utilidades · ⌘K global + notificaciones */}
      <div className="flex items-center gap-1.5">
        <button
          className="inline-flex items-center gap-2 h-7 pl-2.5 pr-1.5 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors text-xs"
          aria-label="Buscar (⌘K)"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">Buscar</span>
          <span className="text-[10px] font-semibold bg-muted/60 border border-border rounded px-1 py-0.5 leading-none">⌘K</span>
        </button>
        <button
          className="relative p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Notificaciones"
        >
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary ring-2 ring-background" />
        </button>
      </div>
    </header>
  );
}
