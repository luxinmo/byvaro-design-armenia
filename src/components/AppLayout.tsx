import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { MobileHeader } from "./MobileHeader";
import { MobileBottomNav } from "./MobileBottomNav";
import { hasUnsavedChanges } from "@/lib/unsavedGuard";

export function AppLayout({ children }: { children: React.ReactNode }) {
  // Guard global para cambios sin guardar. Intercepta clicks en
  // enlaces internos y en botones marcados con `data-nav-guard`, y
  // muestra un dialog Byvaro con backdrop difuminado (estilo ChatGPT)
  // en lugar del confirm nativo del navegador.
  const [pendingTarget, setPendingTarget] = useState<HTMLElement | null>(null);
  const bypassNextRef = useRef(false);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (bypassNextRef.current) return; // click programático post-confirm
      if (!hasUnsavedChanges()) return;
      const target = (e.target as HTMLElement)?.closest("a,button") as HTMLElement | null;
      if (!target) return;
      // Anchor con href interno (ruta SPA).
      if (target.tagName === "A") {
        const href = (target as HTMLAnchorElement).getAttribute("href");
        if (!href || href.startsWith("http") || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      } else {
        // Botones de navegación marcados explícitamente.
        if (!target.hasAttribute("data-nav-guard")) return;
      }
      e.preventDefault();
      e.stopPropagation();
      setPendingTarget(target);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  const confirmDiscard = () => {
    const t = pendingTarget;
    setPendingTarget(null);
    if (!t) return;
    // Reemitimos el click saltándonos el guard una vez. Esto dispara
    // la navegación original (href del <a> o onClick del botón).
    bypassNextRef.current = true;
    try { t.click(); } finally { bypassNextRef.current = false; }
  };

  // ESC cierra el dialog (equivale a "Seguir editando").
  useEffect(() => {
    if (!pendingTarget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPendingTarget(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingTarget]);

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Desktop sidebar — se colapsa a iconos automáticamente en
       * rutas como /emails (ver COLLAPSED_ROUTES en AppSidebar). */}
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader />

        {/* Mobile header */}
        <MobileHeader />

        <main className="flex-1 overflow-auto pb-20 lg:pb-8">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <MobileBottomNav />
      </div>

      {/* Dialog de confirmación al navegar con cambios sin guardar —
          estilo ChatGPT: backdrop difuminado, card centrada con tokens
          Byvaro, dos acciones (descartar / seguir editando). */}
      {pendingTarget && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-md animate-in fade-in duration-150"
            onClick={() => setPendingTarget(null)}
          />
          <div className="relative w-full max-w-[440px] bg-card border border-border rounded-2xl shadow-soft-lg p-6 animate-in zoom-in-95 fade-in duration-200">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-warning" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-[15px] font-semibold text-foreground leading-tight">
                  ¿Descartar los cambios?
                </h2>
                <p className="text-[13px] text-muted-foreground leading-relaxed mt-1">
                  Tienes cambios sin guardar. Si sales ahora se perderán.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingTarget(null)}
                className="inline-flex items-center justify-center h-9 px-4 rounded-full border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                Seguir editando
              </button>
              <button
                type="button"
                onClick={confirmDiscard}
                className="inline-flex items-center justify-center h-9 px-4 rounded-full bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors shadow-soft"
              >
                Descartar y salir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
