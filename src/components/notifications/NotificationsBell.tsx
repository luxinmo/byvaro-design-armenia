/**
 * NotificationsBell — campanita del topbar con badge de no-leídas
 * y dropdown con las últimas 10 notificaciones.
 *
 * Reemplaza al icono "Bell" estático que había en `AppHeader.tsx`
 * (que solo decoraba sin hacer nada). Ahora:
 *
 *   · Badge rojo con count si hay no-leídas.
 *   · Click abre dropdown con lista · cada item link al recurso.
 *   · Botón "Marcar todas como leídas" + link a /notificaciones.
 *
 * Phase 2 · in-app only · cuando exista backend, suscripción WS
 * empuja eventos en tiempo real.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCurrentUser } from "@/lib/currentUser";
import { useNotifications, markAllRead, markRead } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export function NotificationsBell() {
  const user = useCurrentUser();
  const { all, unreadCount } = useNotifications(user.id);
  const [open, setOpen] = useState(false);
  const recent = all.slice(0, 10);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label={`Notificaciones${unreadCount > 0 ? ` · ${unreadCount} sin leer` : ""}`}
        >
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9.5px] font-bold tabular-nums ring-2 ring-background">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[380px] p-0 max-h-[520px] flex flex-col"
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Notificaciones</h3>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllRead(user.id)}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <CheckCheck className="h-3 w-3" />
              Marcar todas leídas
            </button>
          )}
        </header>

        <div className="flex-1 overflow-y-auto">
          {recent.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Bell className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-[12.5px] text-muted-foreground">No hay notificaciones</p>
            </div>
          ) : (
            <ul>
              {recent.map((n) => (
                <li key={n.id}>
                  <Link
                    to={n.href ?? "/notificaciones"}
                    onClick={() => {
                      markRead(n.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "block px-4 py-3 border-b border-border/40 hover:bg-muted/40 transition-colors",
                      !n.readAt && "bg-primary/[0.04]",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span className={cn(
                        "h-1.5 w-1.5 rounded-full shrink-0 mt-1.5",
                        !n.readAt ? "bg-primary" : "bg-transparent",
                      )} />
                      <div className="min-w-0 flex-1">
                        <p className={cn(
                          "text-[12.5px] leading-snug",
                          !n.readAt ? "font-semibold text-foreground" : "text-foreground/80",
                        )}>
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                            {n.body}
                          </p>
                        )}
                        <p className="text-[10.5px] text-muted-foreground/70 mt-1 tabular-nums">
                          {formatDistanceToNow(parseISO(n.createdAt), { addSuffix: true, locale: es })}
                        </p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="px-4 py-2.5 border-t border-border bg-muted/30">
          <Link
            to="/notificaciones"
            onClick={() => setOpen(false)}
            className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Ver todas →
          </Link>
        </footer>
      </PopoverContent>
    </Popover>
  );
}
