/**
 * notifications.ts · Sistema de notificaciones in-app (Phase 2 mock).
 *
 * Storage local en `byvaro.notifications.v1` · cada notificación es
 * para un userId concreto. La campanita del topbar muestra el badge
 * con el count de no-leídas y el dropdown lista las últimas N. La
 * página `/notificaciones` da histórico completo con filtros.
 *
 * Cuando exista backend real, sustituir el storage local por una
 * suscripción WebSocket o long-polling al endpoint
 * `GET /api/notifications?since=...`. La API pública (`recordNotification`,
 * `useNotifications`, `markRead`) no debe cambiar.
 *
 * Ver `docs/registration-system.md §5 Matriz de notificaciones`.
 */

import { useEffect, useState } from "react";

const STORAGE_KEY = "byvaro.notifications.v1";
const CHANGE_EVENT = "byvaro:notifications-change";

/** Catálogo cerrado · alineado con la matriz de notificaciones canónica. */
export type NotificationEvent =
  /* Lado agencia · 9 eventos */
  | "registration.approved"
  | "preregistration.approved"
  | "registration.duplicate"
  | "registration.rejected"
  | "registration.priority_lost"
  | "preregistration.confirmed_after_visit"
  | "preregistration.near_expiry"
  | "preregistration.expired"
  /* Lado promotor · 6 eventos */
  | "registration.received"
  | "registration.duplicate_detected"
  | "cross_promo.duplicate_promotion"
  | "visit.completed_ready_to_register"
  | "registration.pending_decision"
  | "preregistration.expired_admin"
  /* Visita Bloque A */
  | "visit.rescheduled_by_agency"
  | "visit.rescheduled_by_developer"
  | "visit.cancelled_by_agency"
  | "visit.cancelled_by_developer";

export type Notification = {
  id: string;
  /** Recipient · userId al que va dirigida. */
  recipientUserId: string;
  event: NotificationEvent;
  title: string;
  body?: string;
  /** Severity para el icono / color · informativa por defecto. */
  severity?: "info" | "success" | "warning" | "danger";
  /** Deep-link al recurso afectado · ej. `/registros?active=re000042`. */
  href?: string;
  createdAt: string;     // ISO
  readAt?: string;       // ISO · undefined = unread
  /** Payload arbitrario · útil para reconstruir contexto en /notificaciones. */
  meta?: Record<string, string | number>;
};

function read(): Notification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Notification[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(list: Notification[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/**
 * Persiste una notificación en storage.
 *
 * TODO(backend): POST /api/notifications · server crea la fila + emite
 * push WS al recipient. El cliente no debe llamar a este helper en el
 * futuro · será side-effect server-side de cada acción que dispare
 * notificación (approve/reject/cancel/reschedule/etc.).
 */
export function recordNotification(input: Omit<Notification, "id" | "createdAt">): Notification {
  const notif: Notification = {
    ...input,
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  const list = read();
  /* Insert al principio · más reciente arriba. Cap a 200 para que el
     storage no crezca sin límite. */
  const trimmed = [notif, ...list].slice(0, 200);
  write(trimmed);
  return notif;
}

/** Marca como leída una notificación · idempotente. */
export function markRead(id: string) {
  const list = read();
  const idx = list.findIndex((n) => n.id === id);
  if (idx < 0 || list[idx].readAt) return;
  list[idx] = { ...list[idx], readAt: new Date().toISOString() };
  write(list);
}

/** Marca todas como leídas para un usuario · útil en bulk. */
export function markAllRead(userId: string) {
  const now = new Date().toISOString();
  const list = read().map((n) =>
    n.recipientUserId === userId && !n.readAt ? { ...n, readAt: now } : n,
  );
  write(list);
}

/** Hook reactivo · devuelve la lista filtrada por recipient. */
export function useNotifications(userId: string): {
  all: Notification[];
  unread: Notification[];
  unreadCount: number;
} {
  const [list, setList] = useState<Notification[]>(() =>
    read().filter((n) => n.recipientUserId === userId),
  );
  useEffect(() => {
    const cb = () => setList(read().filter((n) => n.recipientUserId === userId));
    window.addEventListener(CHANGE_EVENT, cb);
    window.addEventListener("storage", cb);
    return () => {
      window.removeEventListener(CHANGE_EVENT, cb);
      window.removeEventListener("storage", cb);
    };
  }, [userId]);
  const unread = list.filter((n) => !n.readAt);
  return { all: list, unread, unreadCount: unread.length };
}
