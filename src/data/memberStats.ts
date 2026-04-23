/**
 * memberStats.ts · métricas comerciales y de actividad del miembro.
 *
 * QUÉ
 * ----
 * Mock del endpoint `GET /api/members/:id/stats?window=30d`. Usado por
 * el bloque "Rendimiento" del `MemberFormDialog` y la página completa
 * `/equipo/:id/estadisticas`.
 *
 * REGLA DE ORO (CLAUDE.md §📊 KPIs): cualquier nueva señal de actividad
 * del trabajador con valor para valorar desempeño debe añadirse aquí +
 * mostrarse en la pantalla de estadísticas. Si no, la IA no la ve y el
 * admin decide a ciegas.
 *
 * TODO(backend): sustituir `getMemberStats` por fetch al endpoint real.
 *   Agregaciones por ventana · caché 15 min · invalidar al cerrar venta.
 * TODO(ai): cuando exista el análisis IA, `POST /api/ai/analyze-member/:id`
 *   recibe este mismo shape y devuelve un informe (ver plan-equipo-
 *   estadisticas.md §3).
 */

export type StatsWindow = "7d" | "30d" | "90d" | "year";

export type MemberStats = {
  memberId: string;
  window: StatsWindow;

  /* ═══ Resultados comerciales ═══ */
  salesCount: number;
  salesValue: number;             // €
  commissionValue: number;        // €
  recordsApproved: number;
  recordsTotal: number;
  recordsDeclined: number;
  visitsDone: number;
  visitsScheduled: number;
  /** 0-1 · visitas hechas / registros aprobados. */
  conversionRate: number;

  /* ═══ Pipeline ═══ */
  openOpportunities: number;
  assignedLeads: number;
  pendingRecords: number;
  assignedPromotions: number;
  /** Próximas 7 días. */
  visitsUpcoming: number;

  /* ═══ Comunicación ═══ */
  emailsSent: number;
  emailsOpenRate: number;         // 0-1
  whatsappSent: number;
  callsLogged: number;
  /** Tiempo medio hasta el primer contacto con un lead (minutos). */
  avgLeadResponseMin: number;

  /* ═══ Actividad en CRM (para IA) ═══ */
  avgDailyActiveMin: number;
  avgSessionMin: number;
  /** Hora del día con más actividad (0-23). */
  peakHour: number;
  /** 168 celdas · [día 0=Lun ... 6=Dom] × [hora 0...23]. Conteos relativos 0-100. */
  hourlyHeatmap: number[];
  daysWithoutLogin: number;
  activeStreakDays: number;
  actionsPerSession: number;
  overduePendingTasks: number;
  duplicatesCreated: number;
  visitsUnevaluated: number;
};

/* ═══════════════════════════════════════════════════════════════════
   Generadores de heatmap realistas
   ═══════════════════════════════════════════════════════════════════ */

/** Patrón típico de comercial · pico 10-13 y 16-19, laboral L-V. */
function heatmapStandard(): number[] {
  const cells: number[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      let value = 0;
      const isWeekend = day >= 5;
      if (hour >= 9 && hour <= 13) value = isWeekend ? 8 : 60 + Math.random() * 35;
      else if (hour >= 16 && hour <= 19) value = isWeekend ? 12 : 55 + Math.random() * 40;
      else if (hour >= 14 && hour <= 15) value = isWeekend ? 5 : 25 + Math.random() * 20;
      else if (hour >= 20 && hour <= 22) value = isWeekend ? 2 : 15 + Math.random() * 15;
      else value = Math.random() * 5;
      cells.push(Math.round(value));
    }
  }
  return cells;
}

/** Patrón "nocturno" · pico tarde-noche. */
function heatmapEvening(): number[] {
  const cells: number[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      let value = 0;
      const isWeekend = day >= 5;
      if (hour >= 18 && hour <= 22) value = isWeekend ? 10 : 70 + Math.random() * 25;
      else if (hour >= 10 && hour <= 13) value = isWeekend ? 4 : 30 + Math.random() * 20;
      else value = Math.random() * 8;
      cells.push(Math.round(value));
    }
  }
  return cells;
}

/** Patrón "bajo" · actividad esporádica. */
function heatmapLow(): number[] {
  const cells: number[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const isWeekend = day >= 5;
      const base = hour >= 9 && hour <= 18 ? (isWeekend ? 2 : 15 + Math.random() * 10) : Math.random() * 3;
      cells.push(Math.round(base));
    }
  }
  return cells;
}

/* ═══════════════════════════════════════════════════════════════════
   Mocks · stats a 30 días para miembros activos (ver src/lib/team.ts).
   ═══════════════════════════════════════════════════════════════════ */

const STATS_30D: Record<string, MemberStats> = {
  /* Arman · admin, top performer */
  u1: {
    memberId: "u1", window: "30d",
    salesCount: 8, salesValue: 3_850_000, commissionValue: 115_500,
    recordsApproved: 34, recordsTotal: 42, recordsDeclined: 8,
    visitsDone: 22, visitsScheduled: 6, conversionRate: 0.36,
    openOpportunities: 12, assignedLeads: 18, pendingRecords: 3,
    assignedPromotions: 7, visitsUpcoming: 5,
    emailsSent: 142, emailsOpenRate: 0.68, whatsappSent: 89, callsLogged: 34,
    avgLeadResponseMin: 18,
    avgDailyActiveMin: 285, avgSessionMin: 52, peakHour: 11,
    hourlyHeatmap: heatmapStandard(),
    daysWithoutLogin: 0, activeStreakDays: 22, actionsPerSession: 38,
    overduePendingTasks: 2, duplicatesCreated: 0, visitsUnevaluated: 1,
  },
  /* Laura · senior comercial */
  u2: {
    memberId: "u2", window: "30d",
    salesCount: 5, salesValue: 2_120_000, commissionValue: 63_600,
    recordsApproved: 19, recordsTotal: 24, recordsDeclined: 5,
    visitsDone: 14, visitsScheduled: 4, conversionRate: 0.26,
    openOpportunities: 8, assignedLeads: 14, pendingRecords: 2,
    assignedPromotions: 5, visitsUpcoming: 3,
    emailsSent: 87, emailsOpenRate: 0.54, whatsappSent: 51, callsLogged: 22,
    avgLeadResponseMin: 24,
    avgDailyActiveMin: 215, avgSessionMin: 43, peakHour: 10,
    hourlyHeatmap: heatmapStandard(),
    daysWithoutLogin: 1, activeStreakDays: 14, actionsPerSession: 29,
    overduePendingTasks: 4, duplicatesCreated: 1, visitsUnevaluated: 2,
  },
  /* Diego · comercial junior con señales rojas */
  u3: {
    memberId: "u3", window: "30d",
    salesCount: 1, salesValue: 485_000, commissionValue: 14_550,
    recordsApproved: 6, recordsTotal: 11, recordsDeclined: 5,
    visitsDone: 5, visitsScheduled: 2, conversionRate: 0.17,
    openOpportunities: 3, assignedLeads: 9, pendingRecords: 4,
    assignedPromotions: 2, visitsUpcoming: 1,
    emailsSent: 43, emailsOpenRate: 0.31, whatsappSent: 18, callsLogged: 8,
    avgLeadResponseMin: 85,
    avgDailyActiveMin: 95, avgSessionMin: 22, peakHour: 19,
    hourlyHeatmap: heatmapEvening(),
    daysWithoutLogin: 4, activeStreakDays: 3, actionsPerSession: 12,
    overduePendingTasks: 9, duplicatesCreated: 3, visitsUnevaluated: 4,
  },
  /* Marta · coordinadora, poca actividad comercial */
  u4: {
    memberId: "u4", window: "30d",
    salesCount: 0, salesValue: 0, commissionValue: 0,
    recordsApproved: 0, recordsTotal: 0, recordsDeclined: 0,
    visitsDone: 2, visitsScheduled: 0, conversionRate: 0,
    openOpportunities: 0, assignedLeads: 0, pendingRecords: 0,
    assignedPromotions: 0, visitsUpcoming: 0,
    emailsSent: 0, emailsOpenRate: 0, whatsappSent: 0, callsLogged: 4,
    avgLeadResponseMin: 0,
    avgDailyActiveMin: 125, avgSessionMin: 35, peakHour: 14,
    hourlyHeatmap: heatmapLow(),
    daysWithoutLogin: 2, activeStreakDays: 8, actionsPerSession: 18,
    overduePendingTasks: 1, duplicatesCreated: 0, visitsUnevaluated: 0,
  },
  /* Isabel · comercial sólida */
  u7: {
    memberId: "u7", window: "30d",
    salesCount: 4, salesValue: 1_640_000, commissionValue: 49_200,
    recordsApproved: 16, recordsTotal: 19, recordsDeclined: 3,
    visitsDone: 11, visitsScheduled: 3, conversionRate: 0.29,
    openOpportunities: 7, assignedLeads: 11, pendingRecords: 1,
    assignedPromotions: 4, visitsUpcoming: 3,
    emailsSent: 64, emailsOpenRate: 0.62, whatsappSent: 38, callsLogged: 15,
    avgLeadResponseMin: 21,
    avgDailyActiveMin: 195, avgSessionMin: 40, peakHour: 12,
    hourlyHeatmap: heatmapStandard(),
    daysWithoutLogin: 0, activeStreakDays: 18, actionsPerSession: 26,
    overduePendingTasks: 3, duplicatesCreated: 0, visitsUnevaluated: 1,
  },
};

/** Fetcher mock · devuelve stats para un miembro + ventana (síncrono). */
export function getMemberStats(
  memberId: string,
  _window: StatsWindow = "30d",
): MemberStats | null {
  return STATS_30D[memberId] ?? null;
}

/** Agrupa para benchmarks del equipo · "¿soy mejor o peor que la media?". */
export function getTeamAverages(window: StatsWindow = "30d"): Partial<MemberStats> {
  const all = Object.values(STATS_30D).filter((s) => s.window === window);
  if (all.length === 0) return {};
  const avg = <K extends keyof MemberStats>(k: K): number =>
    all.reduce((acc, s) => acc + (s[k] as number), 0) / all.length;
  return {
    salesCount: avg("salesCount"),
    salesValue: avg("salesValue"),
    commissionValue: avg("commissionValue"),
    recordsApproved: avg("recordsApproved"),
    visitsDone: avg("visitsDone"),
    conversionRate: avg("conversionRate"),
    emailsSent: avg("emailsSent"),
    avgDailyActiveMin: avg("avgDailyActiveMin"),
    avgLeadResponseMin: avg("avgLeadResponseMin"),
  };
}

/* ═══════════════════════════════════════════════════════════════════
   Helpers de formato
   ═══════════════════════════════════════════════════════════════════ */

export function formatEur(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} M€`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)} k€`;
  return `${value.toFixed(0)} €`;
}

export function formatPct(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)} %`;
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}
