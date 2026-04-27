/**
 * analytics.ts · Tracking ligero para validación del paywall (Fase 1).
 *
 * QUÉ
 * ----
 * Capa fina sobre `console.info` + ventana global de PostHog si está
 * cargada. NO inicializa PostHog · solo capta si ya existe en
 * `window.posthog` (cuando el equipo añada el snippet en `index.html`).
 *
 * El objetivo de Fase 1 es **validar willingness-to-pay** midiendo
 * cuántos promotores que ven el `<UpgradeModal>` pulsan "Suscribirme".
 * Los 4 eventos canónicos:
 *
 *   · paywall.shown            · el modal se mostró
 *   · paywall.subscribe_clicked · el promotor hizo click en el CTA principal
 *   · paywall.dismissed        · cerró el modal sin convertir
 *   · usage_pill.clicked       · click en el `<UsagePill>` ámbar del header
 *
 * Cada evento incluye contexto suficiente para segmentar:
 *   trigger, tier, used, limit, route, userRole, organizationId.
 *
 * TODO(backend/analytics): cuando PostHog esté configurado en
 *   `index.html` con `posthog.init()`, los `posthog.capture()` ya se
 *   ejecutan solos (la guarda `window.posthog` los detecta). Si en su
 *   lugar usamos Plausible o un endpoint propio, sustituye el bloque
 *   de despacho con la llamada apropiada — la API pública (`track()`,
 *   `usePaywallAnalytics()`) no debe cambiar.
 */

import { useCurrentUser } from "@/lib/currentUser";
import { usePlan, type PlanTier } from "@/lib/plan";
import type { PaywallTrigger } from "@/lib/usageGuard";

/* ══════ Tipos ════════════════════════════════════════════════════ */

export type PaywallEvent =
  | "paywall.shown"
  | "paywall.subscribe_clicked"
  | "paywall.dismissed"
  | "usage_pill.clicked";

export type AnalyticsPayload = {
  trigger: PaywallTrigger;
  tier: PlanTier;
  used: number;
  limit: number;
  /** Path activo al disparar el evento. Si no se pasa, lo deriva del DOM. */
  route?: string;
  /** Rol del usuario · "developer" | "agency" | "viewer" (sin sesión). */
  userRole?: string;
  /** Workspace al que pertenece el evento. Mock hoy · backend lo unifica. */
  organizationId?: string;
};

/* ══════ Núcleo · track() ═════════════════════════════════════════ */

declare global {
  interface Window {
    /** Snippet PostHog · presente si `posthog.init()` se ejecutó en index.html. */
    posthog?: {
      capture: (event: string, payload?: Record<string, unknown>) => void;
    };
  }
}

/**
 * Despacha un evento de analytics. Función pura · puede llamarse desde
 * componentes, handlers, stores singleton, etc.
 *
 * Si `window.posthog` está cargado, captura allí también. Si no,
 * solo logea a console (suficiente para iterar localmente).
 *
 * TODO(backend/analytics): añadir batching + retry + fallback Beacon
 * cuando se cablee al servicio definitivo.
 */
export function track(event: PaywallEvent, payload: AnalyticsPayload): void {
  const enriched = {
    ...payload,
    route: payload.route ?? (typeof window !== "undefined" ? window.location.pathname : ""),
    timestamp: new Date().toISOString(),
  };

  // 1. Console · siempre disponible · útil en dev y para debug producción
  //    sin depender de un servicio externo.
  // eslint-disable-next-line no-console
  console.info(`[analytics] ${event}`, enriched);

  // 2. PostHog · si el snippet está cargado.
  //    TODO(backend/analytics): cuando se decida proveedor (PostHog/
  //    Plausible/propio), conectar aquí. La firma `event + payload` es
  //    compatible con PostHog y la mayoría.
  if (typeof window !== "undefined" && window.posthog) {
    try {
      window.posthog.capture(event, enriched);
    } catch {
      /* no propagar errores de tracking · jamás bloquean UX */
    }
  }
}

/* ══════ Hook reactivo · azúcar para componentes ══════════════════ */

/**
 * Hook que devuelve un `track()` ya enriquecido con el contexto del
 * usuario actual (tier, userRole, organizationId). Conveniente para
 * componentes React que solo conocen `{ trigger, used, limit }`.
 *
 * Para emisores fuera de React (stores singleton) usa la función
 * `track()` directa pasando el contexto manualmente.
 */
export function usePaywallAnalytics() {
  const currentUser = useCurrentUser();
  const tier = usePlan();

  return {
    track(event: PaywallEvent, partial: {
      trigger: PaywallTrigger;
      used: number;
      limit: number;
    }) {
      track(event, {
        ...partial,
        tier,
        userRole: currentUser.accountType,
        organizationId: currentUser.organizationId,
      });
    },
  };
}
