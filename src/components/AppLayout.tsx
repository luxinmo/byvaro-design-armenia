import { useEffect } from "react";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { MobileHeader } from "./MobileHeader";
import { MobileBottomNav } from "./MobileBottomNav";
import { hasUnsavedChanges } from "@/lib/unsavedGuard";

export function AppLayout({ children }: { children: React.ReactNode }) {
  // Interceptor global: cualquier click en un <a href> interno se
  // cancela si hay cambios sin guardar registrados. Confirmación nativa
  // del navegador (robusta y trivial). Se engancha en fase de captura
  // para interceptar antes que React Router haga el push.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!hasUnsavedChanges()) return;
      const target = (e.target as HTMLElement)?.closest("a,button") as HTMLElement | null;
      if (!target) return;
      // Anchor con href interno (ruta SPA)
      if (target.tagName === "A") {
        const href = (target as HTMLAnchorElement).getAttribute("href");
        if (!href || href.startsWith("http") || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      } else {
        // Botones de navegación — por convención marcamos con data-nav-guard
        if (!target.hasAttribute("data-nav-guard")) return;
      }
      const ok = window.confirm(
        "Tienes cambios sin guardar.\n\n¿Descartar los cambios y salir?"
      );
      if (!ok) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Desktop sidebar */}
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop header */}
        <AppHeader />

        {/* Mobile header */}
        <MobileHeader />

        <main className="flex-1 overflow-auto pb-20 lg:pb-8">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <MobileBottomNav />
      </div>
    </div>
  );
}
