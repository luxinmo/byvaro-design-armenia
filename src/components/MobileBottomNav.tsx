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
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Home, Building, Activity, Handshake, FileText, Mail, Contact, Lock } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/currentUser";
import { usePlanState } from "@/lib/plan";

/** Mismo modelo que `AppSidebar.NavAudience` · ver doc allí. */
type NavAudience = "promoter" | "agency";

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
  /** Packs que desbloquean la tab · si todos están inactivos, la
   *  tab aparece bloqueada con candado · click muestra toast
   *  ("admin activa el módulo X" / "pídele al admin"). */
  audiences?: NavAudience[];
};

const tabs: Tab[] = [
  { label: "Inicio", url: "/inicio", icon: Home },
  { label: "Promociones", url: "/promociones", icon: Building, audiences: ["promoter", "agency"] },
  { label: "Registros", url: "/registros", icon: FileText, tabletOnly: true },
  { label: "Actividades", url: "#actividades", icon: Activity, pending: true },
  { label: "Red", url: "/colaboradores", icon: Handshake, audiences: ["promoter"] },
  { label: "Contactos", url: "/contactos", icon: Contact },
  { label: "Emails", url: "/emails", icon: Mail, tabletOnly: true },
  { label: "Perfil", url: "/empresa", avatar: true },
];

const AVATAR_URL =
  "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=64&h=64&fit=crop&crop=faces&q=80";

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const isAgencyUser = currentUser.accountType === "agency";
  const isAdmin = currentUser.role === "admin";

  /* Plan packs activos · usados para resolver el lock por audiences.
   *  Un tab se bloquea si su array `audiences` no incluye ningún
   *  pack activo · click muestra toast (admin → /planes, member →
   *  pídele al admin). */
  const planState = usePlanState();
  const promoterActive = planState.promoterPack !== "none";
  const agencyActive = planState.agencyPack !== "none";

  const isLocked = (audiences?: NavAudience[]): boolean => {
    if (!audiences || audiences.length === 0) return false;
    return !audiences.some((a) =>
      (a === "promoter" && promoterActive) ||
      (a === "agency" && agencyActive),
    );
  };

  const audienceLabel = (audiences?: NavAudience[]): string => {
    if (!audiences || audiences.length === 0) return "";
    if (audiences.length === 2) return "Promotor o Agencia Inmobiliaria";
    return audiences[0] === "agency" ? "Agencia Inmobiliaria" : "Promotor";
  };

  const handleLockedClick = (audiences?: NavAudience[]) => {
    const moduleLabel = audienceLabel(audiences);
    if (isAdmin) {
      toast.info(`Activa el módulo ${moduleLabel}`, {
        description: "Necesitas activarlo para acceder.",
        action: {
          label: "Ver planes",
          onClick: () => navigate("/planes"),
        },
      });
    } else {
      toast.info(`Pídele al admin que active el módulo ${moduleLabel}`, {
        description: "Solo el administrador puede activar módulos del plan.",
      });
    }
  };

  const visibleTabs = tabs
    /* Label dinámico para /promociones · developer ve "Mis Promociones",
     *  agency ve "Promociones". Ver REGLA en sidebar. */
    .map((t) =>
      t.url === "/promociones" && !isAgencyUser
        ? { ...t, label: "Mis Promociones" }
        : t,
    );

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
        {visibleTabs.map((tab) => {
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
              fill={isActive && (tab.label === "Inicio" || tab.label === "Promociones" || tab.label === "Mis Promociones") ? "currentColor" : "none"}
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

          /* Tab bloqueado · pack inactivo · greyed + candado · click
           *  dispara toast con guidance (admin → /planes, member →
           *  ask admin). */
          const locked = isLocked(tab.audiences);
          if (locked) {
            return (
              <button
                key={tab.url}
                onClick={() => handleLockedClick(tab.audiences)}
                className={cn(
                  cls,
                  "text-muted-foreground/40 hover:text-muted-foreground/60",
                )}
              >
                {content}
                {label}
                <Lock
                  className="absolute top-1 right-1 h-2.5 w-2.5 text-muted-foreground/40"
                  strokeWidth={2.25}
                />
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
