/**
 * /notificaciones · Histórico completo de notificaciones del usuario.
 *
 * Lista cronológica · filtros leídas/no-leídas · bulk mark-read.
 * Phase 2 · cuando exista backend, sustituir el `useNotifications`
 * local por fetch paginado a `GET /api/notifications`.
 */

import { Link } from "react-router-dom";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import { useCurrentUser } from "@/lib/currentUser";
import { useNotifications, markRead, markAllRead } from "@/lib/notifications";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";

type Filter = "all" | "unread";

export default function Notificaciones() {
  const user = useCurrentUser();
  const { all, unreadCount } = useNotifications(user.id);
  const [filter, setFilter] = useState<Filter>("all");

  const visible = filter === "unread"
    ? all.filter((n) => !n.readAt)
    : all;

  return (
    <div className="flex flex-col min-h-full bg-background">
      <div className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        <div className="max-w-[900px] mx-auto">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Bandeja
          </p>
          <h1 className="text-[19px] sm:text-[22px] font-bold tracking-tight leading-tight mt-1">
            Notificaciones
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Todo lo que pasa con tus registros, agencias y promociones.
          </p>
        </div>
      </div>

      <div className="h-px bg-border/60 mt-6" />

      <div className="px-4 sm:px-6 lg:px-8 py-4">
        <div className="max-w-[900px] mx-auto flex items-center gap-3">
          <div className="flex items-center gap-1">
            {(["all", "unread"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-[12.5px] font-medium transition-colors",
                  filter === f
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                )}
              >
                {f === "all" ? `Todas (${all.length})` : `No leídas (${unreadCount})`}
              </button>
            ))}
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllRead(user.id)}
              className="ml-auto inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-border bg-card text-[12.5px] hover:border-foreground/30 transition-colors"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todas leídas
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 px-4 sm:px-6 lg:px-8 pb-8">
        <div className="max-w-[900px] mx-auto">
          {visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card py-16 text-center">
              <div className="h-14 w-14 rounded-2xl bg-muted grid place-items-center mx-auto mb-3">
                {filter === "unread" ? <Inbox className="h-6 w-6 text-muted-foreground" /> : <Bell className="h-6 w-6 text-muted-foreground" />}
              </div>
              <p className="text-sm font-semibold">
                {filter === "unread" ? "Estás al día" : "Aún no tienes notificaciones"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Cuando llegue algo, lo verás aquí.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {visible.map((n) => (
                <li key={n.id}>
                  <Link
                    to={n.href ?? "#"}
                    onClick={() => markRead(n.id)}
                    className={cn(
                      "block rounded-2xl border bg-card px-4 py-3 transition-colors hover:shadow-soft",
                      !n.readAt
                        ? "border-primary/40 bg-primary/[0.03]"
                        : "border-border",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span className={cn(
                        "h-2 w-2 rounded-full shrink-0 mt-1.5",
                        !n.readAt ? "bg-primary" : "bg-muted-foreground/30",
                      )} />
                      <div className="min-w-0 flex-1">
                        <p className={cn(
                          "text-sm leading-snug",
                          !n.readAt ? "font-semibold text-foreground" : "text-foreground/85",
                        )}>
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed">
                            {n.body}
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground/70 mt-2 tabular-nums">
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
      </div>
    </div>
  );
}
