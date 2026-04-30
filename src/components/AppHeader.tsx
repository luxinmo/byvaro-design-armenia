import { Home, Search } from "lucide-react";
import { useLocation } from "react-router-dom";
import { UsagePill } from "./paywall/UsagePill";
import { NotificationsBell } from "./notifications/NotificationsBell";

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
  "/colaboradores": "Inmobiliarias",
  "/contactos": "Contactos",
  "/microsites": "Microsites",
  "/emails": "Emails",
  "/ajustes": "Ajustes",
  "/empresa": "Empresa",
};

export function AppHeader() {
  const location = useLocation();
  // Busca entrada exacta o con prefijo (para rutas tipo /empresa/…)
  const title = titles[location.pathname]
    || titles[Object.keys(titles).find(p => location.pathname.startsWith(p + "/")) ?? ""]
    || "Inicio";

  return (
    <header className="hidden lg:flex h-14 sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border px-6 items-center justify-between gap-4">
      {/* Breadcrumb · solo contexto, no título */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Home className="h-3.5 w-3.5" />
        <span className="text-muted-foreground/60">/</span>
        <span className="font-medium text-foreground">{title}</span>
      </div>

      {/* Utilidades · ⌘K global + notificaciones.
       *  El AccountSwitcher mock se eliminó al cablear auth real con
       *  Supabase · cambiar de cuenta requiere logout + login con
       *  credenciales reales. */}
      <div className="flex items-center gap-1.5">
        {/* Paywall · pill ámbar cuando trial llega ≥80% de algún tope. */}
        <UsagePill />
        <button
          className="inline-flex items-center gap-2 h-7 pl-2.5 pr-1.5 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors text-xs"
          aria-label="Buscar (⌘K)"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">Buscar</span>
          <span className="text-[10px] font-semibold bg-muted/60 border border-border rounded px-1 py-0.5 leading-none">⌘K</span>
        </button>
        <NotificationsBell />
      </div>
    </header>
  );
}
