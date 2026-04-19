import { NavLink, useLocation } from "react-router-dom";
import { Home, Tag, Plus, Handshake, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Inicio", url: "/inicio", icon: Home },
  { label: "Promos", url: "/promociones", icon: Tag },
  { label: "FAB", url: "", icon: Plus, fab: true },
  { label: "Red", url: "/colaboradores", icon: Handshake },
  { label: "Yo", url: "/ajustes", icon: User },
];

export function MobileBottomNav() {
  const location = useLocation();

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-background/95 backdrop-blur border-t border-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-5 h-[60px]">
        {tabs.map((tab) => {
          const Icon = tab.icon;

          if (tab.fab) {
            return (
              <button
                key="fab"
                className="flex items-center justify-center"
                aria-label="Acción rápida"
              >
                <div className="h-11 w-11 rounded-full bg-foreground text-background grid place-items-center shadow-soft-lg -mt-5 ring-4 ring-background">
                  <Icon className="h-5 w-5" />
                </div>
              </button>
            );
          }

          const isActive = location.pathname === tab.url;
          return (
            <NavLink
              key={tab.url}
              to={tab.url}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="h-[20px] w-[20px]" strokeWidth={isActive ? 2.2 : 1.75} />
              <span className={cn("text-[10px]", isActive ? "font-semibold" : "font-medium")}>
                {tab.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
