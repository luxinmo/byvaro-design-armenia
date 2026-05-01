/**
 * promoActivity.ts · Actividad LIVE de una promoción.
 *
 * Reemplaza el campo seed `Promotion.activity` (estático · fake ·
 * idéntico para todos los viewers) por un cálculo en vivo desde:
 *
 *   · `registros` (data/records.ts + createdRegistros · localStorage)
 *   · `calendarEvents` (visitas · llamadas · meetings)
 *   · `sales` (data/sales.ts + salesStorage)
 *
 * Window de 14 días (alineado con el copy "Últimas 2 semanas" en
 * cards). Trend se computa comparando los últimos 14 días contra los
 * 14 días anteriores · positivo = subiendo · negativo = bajando.
 *
 * REGLA · cero números hardcoded en seeds. Si un workspace recién
 * creado no tiene actividad, devuelve { inquiries:0, reservations:0,
 * visits:0, trend:0 } y la card simplemente no muestra el box de
 * trending (umbral `>= 20`).
 *
 * TODO(backend): `GET /api/promotions/:id/activity?since=14d` con
 * agregación SQL · este helper se sustituye por un fetch sin tocar
 * consumers.
 */

import { useMemo } from "react";
import { registros as SEED_REGISTROS } from "@/data/records";
import { useCreatedRegistros } from "@/lib/registrosStorage";
import { useCalendarEvents } from "@/lib/calendarStorage";
import { useAllSales } from "@/lib/salesStorage";

export type PromoActivity = {
  /** Registros entrantes en los últimos 14 días. */
  inquiries: number;
  /** Reservas (estado `reservada`) en los últimos 14 días. */
  reservations: number;
  /** Visitas realizadas (estado `done`) en los últimos 14 días. */
  visits: number;
  /** % cambio vs los 14 días anteriores · positivo = subiendo. */
  trend: number;
};

const WINDOW_DAYS = 14;

function isWithinDays(iso: string | undefined, daysAgoMin: number, daysAgoMax: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  const now = Date.now();
  const min = now - daysAgoMax * 24 * 3600 * 1000;
  const max = now - daysAgoMin * 24 * 3600 * 1000;
  return t >= min && t <= max;
}

/** Hook reactivo · se refresca cuando cambia cualquier source. */
export function usePromoActivity(promoId: string): PromoActivity {
  const created = useCreatedRegistros();
  const events = useCalendarEvents();
  const sales = useAllSales();

  return useMemo(() => {
    if (!promoId) return { inquiries: 0, reservations: 0, visits: 0, trend: 0 };

    const allRegistros = [...created, ...SEED_REGISTROS].filter((r) => r.promotionId === promoId);

    /* Ventana actual · últimos 14 días. */
    const inquiriesNow = allRegistros.filter((r) => isWithinDays(r.fecha, 0, WINDOW_DAYS)).length;
    const reservationsNow = sales.filter(
      (s) => s.promotionId === promoId && s.estado === "reservada"
        && isWithinDays(s.fechaReserva, 0, WINDOW_DAYS),
    ).length;
    const visitsNow = events.filter(
      (ev) => ev.type === "visit" && ev.status === "done"
        && (ev as { promotionId?: string }).promotionId === promoId
        && isWithinDays(ev.start, 0, WINDOW_DAYS),
    ).length;

    /* Ventana anterior · días 14-28. Para trend. */
    const inquiriesPrev = allRegistros.filter((r) => isWithinDays(r.fecha, WINDOW_DAYS, WINDOW_DAYS * 2)).length;
    const reservationsPrev = sales.filter(
      (s) => s.promotionId === promoId && s.estado === "reservada"
        && isWithinDays(s.fechaReserva, WINDOW_DAYS, WINDOW_DAYS * 2),
    ).length;
    const visitsPrev = events.filter(
      (ev) => ev.type === "visit" && ev.status === "done"
        && (ev as { promotionId?: string }).promotionId === promoId
        && isWithinDays(ev.start, WINDOW_DAYS, WINDOW_DAYS * 2),
    ).length;

    const totalNow = inquiriesNow + reservationsNow + visitsNow;
    const totalPrev = inquiriesPrev + reservationsPrev + visitsPrev;
    const trend = totalPrev === 0
      ? (totalNow > 0 ? 100 : 0)
      : Math.round(((totalNow - totalPrev) / totalPrev) * 100);

    return {
      inquiries: inquiriesNow,
      reservations: reservationsNow,
      visits: visitsNow,
      trend,
    };
  }, [promoId, created, events, sales]);
}

/** Versión non-reactive para builders / sort. Acepta los datasets ya
 *  resueltos. */
export function getPromoActivity(
  promoId: string,
  sources: {
    registros: Array<{ promotionId?: string; fecha?: string }>;
    events: Array<{ type: string; status: string; start: string; promotionId?: string }>;
    sales: Array<{ promotionId?: string; estado: string; fechaReserva?: string }>;
  },
): PromoActivity {
  if (!promoId) return { inquiries: 0, reservations: 0, visits: 0, trend: 0 };

  const inquiriesNow = sources.registros.filter(
    (r) => r.promotionId === promoId && isWithinDays(r.fecha, 0, WINDOW_DAYS),
  ).length;
  const reservationsNow = sources.sales.filter(
    (s) => s.promotionId === promoId && s.estado === "reservada"
      && isWithinDays(s.fechaReserva, 0, WINDOW_DAYS),
  ).length;
  const visitsNow = sources.events.filter(
    (ev) => ev.type === "visit" && ev.status === "done"
      && ev.promotionId === promoId
      && isWithinDays(ev.start, 0, WINDOW_DAYS),
  ).length;

  const inquiriesPrev = sources.registros.filter(
    (r) => r.promotionId === promoId && isWithinDays(r.fecha, WINDOW_DAYS, WINDOW_DAYS * 2),
  ).length;
  const reservationsPrev = sources.sales.filter(
    (s) => s.promotionId === promoId && s.estado === "reservada"
      && isWithinDays(s.fechaReserva, WINDOW_DAYS, WINDOW_DAYS * 2),
  ).length;
  const visitsPrev = sources.events.filter(
    (ev) => ev.type === "visit" && ev.status === "done"
      && ev.promotionId === promoId
      && isWithinDays(ev.start, WINDOW_DAYS, WINDOW_DAYS * 2),
  ).length;

  const totalNow = inquiriesNow + reservationsNow + visitsNow;
  const totalPrev = inquiriesPrev + reservationsPrev + visitsPrev;
  const trend = totalPrev === 0
    ? (totalNow > 0 ? 100 : 0)
    : Math.round(((totalNow - totalPrev) / totalPrev) * 100);

  return {
    inquiries: inquiriesNow,
    reservations: reservationsNow,
    visits: visitsNow,
    trend,
  };
}
