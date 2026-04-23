/**
 * /equipo/:id/estadisticas — Dashboard completo de rendimiento del miembro.
 *
 * Muestra las métricas detalladas que alimentarán el análisis IA
 * (`POST /api/ai/analyze-member/:id` · pendiente). Objetivo: el dueño
 * de la agencia abre esta pantalla y en <30 segundos sabe si un miembro
 * produce, si tiene pipeline sano, si comunica bien y si su patrón
 * de actividad está en verde.
 *
 * Layout (top-to-bottom):
 *   1. Header · foto + nombre + rol + botón "Análisis IA" (placeholder).
 *   2. Filtro temporal · 7d / 30d / 90d / año.
 *   3. Hero · 6 KPIs principales.
 *   4. Funnel · leads → registros → visitas → ventas.
 *   5. Comunicación · panel con email, WhatsApp, llamadas, tiempo respuesta.
 *   6. Heatmap · día × hora de actividad.
 *   7. Señales de alerta · tareas pendientes, visitas sin evaluar, etc.
 *
 * TODO(backend): reemplazar mocks por GET /api/members/:id/stats.
 * TODO(ai): conectar `POST /api/ai/analyze-member/:id` cuando exista.
 */

import { useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowLeft, TrendingUp, Euro, FileText, CalendarDays, Target, Clock,
  Activity, Mail, MessageCircle, Phone, Sparkles, AlertTriangle,
  CheckCircle2, Users, Building2,
} from "lucide-react";
import { TEAM_MEMBERS, type TeamMember } from "@/lib/team";
import { findLanguageByCode } from "@/lib/languages";
import { findJobTitle } from "@/data/jobTitles";
import {
  getMemberStats, getTeamAverages, formatEur, formatPct, formatMinutes,
  type MemberStats, type StatsWindow,
} from "@/data/memberStats";
import { Button } from "@/components/ui/button";
import { ViewToggle } from "@/components/ui/ViewToggle";
import { Flag } from "@/components/ui/Flag";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const KEY_MEMBERS = "byvaro.organization.members.v4";

function loadMembers(): TeamMember[] {
  if (typeof window === "undefined") return TEAM_MEMBERS;
  try {
    const raw = window.localStorage.getItem(KEY_MEMBERS);
    return raw ? JSON.parse(raw) : TEAM_MEMBERS;
  } catch { return TEAM_MEMBERS; }
}

/* ═══════════════════════════════════════════════════════════════════ */

export default function EquipoMiembroEstadisticas() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [window, setWindow] = useState<StatsWindow>("30d");

  const members = useMemo(loadMembers, []);
  const member = members.find((m) => m.id === id);
  const stats = id ? getMemberStats(id, window) : null;
  const teamAvg = useMemo(() => getTeamAverages(window), [window]);

  if (!member) {
    return (
      <div className="flex flex-col min-h-full items-center justify-center px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">Miembro no encontrado.</p>
        <Button variant="outline" size="sm" className="rounded-full mt-4" onClick={() => navigate("/equipo")}>
          <ArrowLeft className="h-3.5 w-3.5" /> Volver al equipo
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-background">
      {/* ═══ Header ═══ */}
      <div className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-4 border-b border-border/60">
        <div className="max-w-[1400px] mx-auto">
          <button
            onClick={() => navigate("/equipo")}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-3 w-3" /> Volver al equipo
          </button>

          <div className="flex items-start gap-4 flex-wrap">
            {member.avatarUrl ? (
              <img
                src={member.avatarUrl}
                alt={member.name}
                className="h-16 w-16 rounded-2xl object-cover shrink-0 shadow-soft"
              />
            ) : (
              <div className="h-16 w-16 rounded-2xl bg-primary/15 text-primary grid place-items-center text-xl font-semibold shrink-0 shadow-soft">
                {member.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?"}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground leading-none">
                Estadísticas
              </p>
              <h1 className="text-[22px] sm:text-[26px] font-bold tracking-tight leading-tight mt-1">
                {member.name}
              </h1>
              <p className="text-xs text-muted-foreground mt-1">
                {member.jobTitle && <span>{member.jobTitle}</span>}
                {member.jobTitle && member.department && <span className="text-muted-foreground/50 mx-1.5">·</span>}
                {member.department && <span>{member.department}</span>}
              </p>
              {member.languages && member.languages.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {member.languages.map((l) => {
                    const lang = findLanguageByCode(l);
                    return (
                      <span
                        key={l}
                        title={lang?.name ?? l}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground bg-muted/60 rounded-full pl-1 pr-1.5 py-0.5"
                      >
                        <Flag iso={lang?.countryIso} size={12} />
                        <span className="tracking-wider">{l}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              {(member.commissionCapturePct !== undefined || member.commissionSalePct !== undefined) && (
                <div className="inline-flex items-center gap-2 h-9 px-3 rounded-full border border-border bg-muted/30">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Comisión
                  </span>
                  {member.commissionCapturePct !== undefined && (
                    <span className="text-xs font-bold text-foreground tnum">
                      {member.commissionCapturePct}% capt.
                    </span>
                  )}
                  {member.commissionCapturePct !== undefined && member.commissionSalePct !== undefined && (
                    <span className="text-muted-foreground/50">·</span>
                  )}
                  {member.commissionSalePct !== undefined && (
                    <span className="text-xs font-bold text-foreground tnum">
                      {member.commissionSalePct}% venta
                    </span>
                  )}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => toast.info("Análisis IA · próximamente con Claude Haiku")}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Análisis IA
              </Button>
            </div>
          </div>

          {/* Filtro temporal */}
          <div className="mt-5 flex items-center gap-3 flex-wrap">
            <span className="text-[11px] text-muted-foreground">Ventana:</span>
            <ViewToggle
              value={window}
              onChange={setWindow}
              options={[
                { value: "7d",   icon: Activity, label: "7 días" },
                { value: "30d",  icon: Activity, label: "30 días" },
                { value: "90d",  icon: Activity, label: "90 días" },
                { value: "year", icon: Activity, label: "1 año" },
              ]}
            />
          </div>
        </div>
      </div>

      {/* ═══ Contenido ═══ */}
      <div className="flex-1 px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-[1400px] mx-auto space-y-6">
          {!stats ? (
            <EmptyStats />
          ) : (
            <>
              <HeroKpis stats={stats} teamAvg={teamAvg} />
              <Funnel stats={stats} />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <CommunicationPanel stats={stats} />
                <AlertsPanel stats={stats} />
              </div>
              <Heatmap heatmap={stats.hourlyHeatmap} peakHour={stats.peakHour} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Hero · 6 KPIs principales con benchmark vs media equipo
   ═══════════════════════════════════════════════════════════════════ */

function HeroKpis({ stats, teamAvg }: { stats: MemberStats; teamAvg: Partial<MemberStats> }) {
  const approvalRate = stats.recordsTotal > 0
    ? stats.recordsApproved / stats.recordsTotal
    : 0;

  const delta = (value: number, avg?: number): number => {
    if (!avg || avg === 0) return 0;
    return (value - avg) / avg;
  };

  return (
    <section>
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">
        Resultados · {stats.window === "30d" ? "últimos 30 días" :
                      stats.window === "7d"  ? "últimos 7 días"  :
                      stats.window === "90d" ? "últimos 90 días" : "último año"}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <HeroTile
          icon={Euro} label="Ventas (€)" value={formatEur(stats.salesValue)}
          sub={`${stats.salesCount} ${stats.salesCount === 1 ? "op" : "ops"}`}
          deltaPct={delta(stats.salesValue, teamAvg.salesValue)}
          tone="emerald"
        />
        <HeroTile
          icon={Euro} label="Comisión" value={formatEur(stats.commissionValue)}
          sub="generada"
        />
        <HeroTile
          icon={FileText} label="Registros aprob." value={`${stats.recordsApproved}`}
          sub={`${formatPct(approvalRate)} approval rate`}
          deltaPct={delta(stats.recordsApproved, teamAvg.recordsApproved)}
        />
        <HeroTile
          icon={CalendarDays} label="Visitas realizadas" value={`${stats.visitsDone}`}
          sub={`${stats.visitsUpcoming} próximas 7d`}
          deltaPct={delta(stats.visitsDone, teamAvg.visitsDone)}
        />
        <HeroTile
          icon={Target} label="Conversión" value={formatPct(stats.conversionRate)}
          sub="visita → venta"
          deltaPct={delta(stats.conversionRate, teamAvg.conversionRate)}
        />
        <HeroTile
          icon={Clock} label="Respuesta a lead" value={formatMinutes(stats.avgLeadResponseMin)}
          sub="tiempo medio"
          deltaPct={-delta(stats.avgLeadResponseMin, teamAvg.avgLeadResponseMin)}
          /* Nota: menos tiempo es mejor, invertimos el delta. */
        />
      </div>
    </section>
  );
}

function HeroTile({
  icon: Icon, label, value, sub, deltaPct, tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  deltaPct?: number;
  tone?: "default" | "emerald";
}) {
  const hasDelta = deltaPct !== undefined && Math.abs(deltaPct) >= 0.02;
  const deltaTone = (deltaPct ?? 0) > 0 ? "text-success" : "text-destructive";
  return (
    <div className="rounded-2xl border border-border bg-card shadow-soft p-4">
      <div className="flex items-center justify-between gap-2">
        <Icon className={cn("h-4 w-4", tone === "emerald" ? "text-success" : "text-muted-foreground")} />
        {hasDelta && (
          <span className={cn("text-[10px] font-semibold tnum", deltaTone)}>
            {(deltaPct as number) > 0 ? "↑" : "↓"} {Math.abs((deltaPct as number) * 100).toFixed(0)}%
          </span>
        )}
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-3 leading-none">
        {label}
      </p>
      <p className="text-xl font-bold tnum leading-tight mt-1.5">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Funnel · leads → registros → visitas → ventas
   ═══════════════════════════════════════════════════════════════════ */

function Funnel({ stats }: { stats: MemberStats }) {
  const stages = [
    { label: "Leads",       value: stats.assignedLeads,    icon: Users,        color: "hsl(var(--muted-foreground))" },
    { label: "Registros",   value: stats.recordsTotal,     icon: FileText,     color: "hsl(var(--primary))" },
    { label: "Aprobados",   value: stats.recordsApproved,  icon: CheckCircle2, color: "hsl(var(--primary))" },
    { label: "Visitas",     value: stats.visitsDone,       icon: CalendarDays, color: "hsl(var(--warning))" },
    { label: "Ventas",      value: stats.salesCount,       icon: Euro,         color: "hsl(var(--success))" },
  ];
  const max = Math.max(...stages.map((s) => s.value), 1);

  return (
    <section className="rounded-2xl border border-border bg-card shadow-soft p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Funnel de conversión
        </h2>
        <p className="text-[11px] text-muted-foreground">
          {stats.assignedLeads > 0 && (
            <>Lead → Venta · <b className="text-foreground tnum">{formatPct(stats.salesCount / stats.assignedLeads)}</b></>
          )}
        </p>
      </div>
      <div className="space-y-2">
        {stages.map((s) => {
          const Icon = s.icon;
          const pct = (s.value / max) * 100;
          return (
            <div key={s.label} className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-1.5 sm:gap-2 w-[110px] sm:w-[180px] shrink-0">
                <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground shrink-0" />
                <span className="text-[11px] sm:text-xs text-foreground truncate">{s.label}</span>
              </div>
              <div className="flex-1 h-7 bg-muted/40 rounded-lg overflow-hidden relative">
                <div
                  className="h-full rounded-lg transition-all duration-500"
                  style={{ width: `${Math.max(pct, 4)}%`, background: s.color }}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold tnum text-foreground">
                  {s.value}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Comunicación · emails, WhatsApp, llamadas
   ═══════════════════════════════════════════════════════════════════ */

function CommunicationPanel({ stats }: { stats: MemberStats }) {
  return (
    <section className="lg:col-span-2 rounded-2xl border border-border bg-card shadow-soft p-5">
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-4">
        Comunicación con cliente
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <CommStat
          icon={Mail} label="Emails enviados"
          value={`${stats.emailsSent}`}
          sub={stats.emailsSent > 0 ? `${formatPct(stats.emailsOpenRate)} apertura` : undefined}
        />
        <CommStat
          icon={MessageCircle} label="WhatsApp"
          value={`${stats.whatsappSent}`}
          sub="mensajes enviados"
        />
        <CommStat
          icon={Phone} label="Llamadas"
          value={`${stats.callsLogged}`}
          sub="registradas"
        />
        <CommStat
          icon={Clock} label="Respuesta"
          value={stats.avgLeadResponseMin > 0 ? formatMinutes(stats.avgLeadResponseMin) : "—"}
          sub="tiempo medio"
        />
      </div>
    </section>
  );
}

function CommStat({
  icon: Icon, label, value, sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
      <Icon className="h-3.5 w-3.5 text-muted-foreground mb-2" />
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-none">{label}</p>
      <p className="text-base font-bold tnum leading-tight mt-1.5">{value}</p>
      {sub && <p className="text-[10.5px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Alertas · señales que necesitan atención del admin
   ═══════════════════════════════════════════════════════════════════ */

function AlertsPanel({ stats }: { stats: MemberStats }) {
  const alerts: Array<{ level: "red" | "amber" | "green"; msg: string }> = [];

  if (stats.daysWithoutLogin >= 3) {
    alerts.push({ level: "red", msg: `${stats.daysWithoutLogin} días sin conectarse` });
  }
  if (stats.overduePendingTasks >= 5) {
    alerts.push({ level: "amber", msg: `${stats.overduePendingTasks} tareas vencidas` });
  }
  if (stats.visitsUnevaluated >= 3) {
    alerts.push({ level: "amber", msg: `${stats.visitsUnevaluated} visitas sin evaluar` });
  }
  if (stats.duplicatesCreated >= 2) {
    alerts.push({ level: "amber", msg: `${stats.duplicatesCreated} contactos duplicados creados` });
  }
  if (stats.avgLeadResponseMin > 60 && stats.avgLeadResponseMin > 0) {
    alerts.push({ level: "amber", msg: `Respuesta a lead >1h (${formatMinutes(stats.avgLeadResponseMin)})` });
  }
  if (stats.activeStreakDays >= 15) {
    alerts.push({ level: "green", msg: `Racha activa de ${stats.activeStreakDays} días` });
  }
  if (alerts.length === 0) {
    alerts.push({ level: "green", msg: "Sin señales de atención" });
  }

  return (
    <section className="rounded-2xl border border-border bg-card shadow-soft p-5">
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">
        Señales a revisar
      </h2>
      <div className="space-y-1.5">
        {alerts.map((a, i) => (
          <div
            key={i}
            className={cn(
              "flex items-start gap-2 p-2 rounded-lg text-xs",
              a.level === "red"   && "bg-destructive/10 text-destructive",
              a.level === "amber" && "bg-warning/10 text-warning",
              a.level === "green" && "bg-success/10 text-success",
            )}
          >
            {a.level === "red" || a.level === "amber" ? (
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            )}
            <span className="leading-snug">{a.msg}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Heatmap · día × hora de actividad (168 celdas)
   ═══════════════════════════════════════════════════════════════════ */

const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

function Heatmap({ heatmap, peakHour }: { heatmap: number[]; peakHour: number }) {
  if (heatmap.length !== 168) return null;
  const max = Math.max(...heatmap, 1);

  return (
    <section className="rounded-2xl border border-border bg-card shadow-soft p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Patrón de actividad · día × hora
        </h2>
        <p className="text-[11px] text-muted-foreground">
          Hora pico · <b className="text-foreground tnum">{String(peakHour).padStart(2, "0")}:00</b>
        </p>
      </div>
      {/* Hint móvil: scrollea horizontal para ver el heatmap completo */}
      <p className="sm:hidden text-[10px] text-muted-foreground/80 italic mb-2 inline-flex items-center gap-1">
        ← Desliza para ver las 24 horas →
      </p>
      <div className="overflow-x-auto relative sm:static">
        {/* Fade gradiente a la derecha · solo móvil mientras hay overflow */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-card to-transparent sm:hidden" aria-hidden />
        <div className="min-w-[600px]">
          {/* Cabecera de horas */}
          <div className="grid grid-cols-[24px_repeat(24,1fr)] gap-px mb-1">
            <span />
            {Array.from({ length: 24 }).map((_, h) => (
              <span
                key={h}
                className={cn(
                  "text-[9px] text-center tnum",
                  h % 3 === 0 ? "text-muted-foreground" : "text-transparent",
                )}
              >
                {String(h).padStart(2, "0")}
              </span>
            ))}
          </div>
          {/* Filas por día */}
          {DAY_LABELS.map((label, day) => (
            <div key={label} className="grid grid-cols-[24px_repeat(24,1fr)] gap-px mb-px">
              <span className="text-[10px] text-muted-foreground font-medium self-center">{label}</span>
              {Array.from({ length: 24 }).map((_, hour) => {
                const value = heatmap[day * 24 + hour] ?? 0;
                const intensity = value / max;
                return (
                  <div
                    key={hour}
                    title={`${label} ${String(hour).padStart(2, "0")}:00 · intensidad ${value}`}
                    className="aspect-square rounded-[2px] transition-colors"
                    style={{
                      background: intensity > 0.05
                        ? `hsl(var(--primary) / ${Math.max(intensity * 0.9, 0.1)})`
                        : "hsl(var(--muted))",
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-end gap-1.5 mt-3">
        <span className="text-[10px] text-muted-foreground">Menos</span>
        <div className="h-2.5 w-2.5 rounded-[2px] bg-muted" />
        <div className="h-2.5 w-2.5 rounded-[2px]" style={{ background: "hsl(var(--primary) / 0.25)" }} />
        <div className="h-2.5 w-2.5 rounded-[2px]" style={{ background: "hsl(var(--primary) / 0.5)" }} />
        <div className="h-2.5 w-2.5 rounded-[2px]" style={{ background: "hsl(var(--primary) / 0.75)" }} />
        <div className="h-2.5 w-2.5 rounded-[2px]" style={{ background: "hsl(var(--primary))" }} />
        <span className="text-[10px] text-muted-foreground">Más</span>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Empty state · miembro sin datos (p. ej. invitado recién creado)
   ═══════════════════════════════════════════════════════════════════ */

function EmptyStats() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
      <Building2 className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
      <p className="text-sm font-medium text-foreground">Sin datos todavía</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
        Este miembro aún no ha generado actividad en el CRM. Los KPIs aparecerán
        aquí en cuanto empiece a operar.
      </p>
    </div>
  );
}
