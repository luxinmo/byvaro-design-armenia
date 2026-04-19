import { Bell, Home, Plus, Search } from "lucide-react";
import { useLocation } from "react-router-dom";

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
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Home className="h-4 w-4" />
        <span className="font-medium text-foreground">{title}</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
          <input
            type="text"
            placeholder="Buscar promociones, contactos…"
            className="w-[320px] h-9 pl-9 pr-16 text-sm bg-muted/40 border border-transparent rounded-full focus:bg-background focus:border-border outline-none transition-colors"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-muted-foreground/70 bg-background border border-border rounded px-1.5 py-0.5">
            ⌘K
          </span>
        </div>
        <button className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
          <Bell className="h-[18px] w-[18px]" />
        </button>
        <div className="w-px h-6 bg-border mx-1" />
        <button className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors shadow-soft">
          <Plus className="h-3.5 w-3.5" /> Nueva promoción
        </button>
      </div>
    </header>
  );
}
