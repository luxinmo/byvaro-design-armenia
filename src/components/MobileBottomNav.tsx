/**
 * MobileBottomNav · barra de navegación inferior tipo app nativa.
 *
 * Comportamiento:
 *   · Móvil (<md):  5 tabs — Home · Promociones · Actividades · Red · Perfil.
 *   · Tablet (md+): 7 tabs (se añaden Registros y Emails).
 *   · Desktop (lg+): oculta.
 *
 * Dos características "tipo Instagram":
 *   1) El item "Perfil" renderiza un avatar circular (no icono User)
 *      con anillo primary cuando la ruta está activa.
 *   2) "Actividades" es un placeholder sin ruta destino por ahora
 *      (navega a # y muestra toast de "próximamente").
 */
import { NavLink, useLocation } from "react-router-dom";
import { Home, Tag, Activity, Handshake, FileText, Mail } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Tab = {
  label: string;
  url: string;
  icon?: typeof Home;
  /** Sólo se muestra en tablet (md+). */
  tabletOnly?: boolean;
  /** Avatar en lugar de icono (Perfil estilo Instagram). */
  avatar?: boolean;
  /** Ruta aún no implementada → toast informativo. */
  pending?: boolean;
};

const tabs: Tab[] = [
  { label: "Inicio", url: "/inicio", icon: Home },
  { label: "Promociones", url: "/promociones", icon: Tag },
  { label: "Registros", url: "/registros", icon: FileText, tabletOnly: true },
  { label: "Actividades", url: "#actividades", icon: Activity, pending: true },
  { label: "Red", url: "/colaboradores", icon: Handshake },
  { label: "Emails", url: "/emails", icon: Mail, tabletOnly: true },
  { label: "Perfil", url: "/empresa", avatar: true },
];

const AVATAR_URL =
  "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=64&h=64&fit=crop&crop=faces&q=80";

export function MobileBottomNav() {
  const location = useLocation();

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div
        className={cn(
          "grid h-[60px]",
          // 5 tabs en móvil, 7 en tablet (md+)
          "grid-cols-5 md:grid-cols-7"
        )}
      >
        {tabs.map((tab) => {
          const isActive =
            location.pathname === tab.url ||
            (tab.url === "/colaboradores" && location.pathname === "/contactos");
          const cls = cn(
            "flex flex-col items-center justify-center gap-0.5 relative",
            // En móvil, ocultamos las tablet-only (Registros, Emails).
            tab.tabletOnly && "hidden md:flex",
            isActive ? "text-foreground" : "text-muted-foreground"
          );

          const content = tab.avatar ? (
            <span
              className={cn(
                "h-7 w-7 rounded-full overflow-hidden bg-muted/60 ring-2 transition-all",
                isActive ? "ring-primary" : "ring-transparent"
              )}
            >
              <img src={AVATAR_URL} alt="Perfil" className="w-full h-full object-cover" />
            </span>
          ) : tab.icon ? (
            <tab.icon
              className="h-[22px] w-[22px]"
              strokeWidth={isActive ? 2.2 : 1.75}
              fill={isActive && (tab.label === "Inicio" || tab.label === "Promociones") ? "currentColor" : "none"}
            />
          ) : null;

          const label = (
            <span
              className={cn(
                "text-[10px] leading-tight",
                isActive ? "font-semibold" : "font-medium"
              )}
            >
              {tab.label}
            </span>
          );

          // Indicador superior (barra) en el activo — look app.
          const indicator = isActive && (
            <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-b-full bg-foreground" />
          );

          if (tab.pending) {
            return (
              <button
                key={tab.url}
                onClick={() =>
                  toast.info(`${tab.label} — próximamente`, {
                    description: "Esta sección estará disponible en una próxima versión.",
                  })
                }
                className={cls}
              >
                {indicator}
                {content}
                {label}
              </button>
            );
          }

          return (
            <NavLink key={tab.url} to={tab.url} className={cls}>
              {indicator}
              {content}
              {label}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
