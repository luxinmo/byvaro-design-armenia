/**
 * Oportunidades · pipeline comercial activo.
 *
 * Lista de oportunidades (contactos comercialmente cualificados) en
 * distintas etapas del embudo. Se alimenta de:
 *   - Leads convertidos (`CLAUDE.md §Dual mode · Lead → Oportunidad`).
 *   - Altas directas (setting "Direct to Opportunity").
 *
 * Layout replica el patrón de `Leads.tsx` (KPIs + toolbar + tabla) para
 * no introducir un nuevo idioma visual. Filtros compactos arriba + "Más
 * filtros" para los secundarios (regla UI del spec).
 *
 * TODO(backend): `GET /api/opportunities?stage&assignee&promotion&...`
 *   Ver `docs/backend-integration.md §7.3 Oportunidades`.
 */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, X, Target, Flame, Snowflake, Clock, Filter, MoreVertical,
  MessageSquare, Mail, ArrowRight, AlertCircle, Inbox, Users,
  TrendingUp, CheckCircle2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Flag } from "@/components/ui/Flag";
import {
  opportunities as allOpportunities, opportunityStageConfig,
  temperatureConfig, hasPendingRegistration,
  type Opportunity, type OpportunityStage, type OpportunityTemperature,
} from "@/data/opportunities";
import { findTeamMember, memberInitials, getMemberAvatarUrl } from "@/lib/team";
import { cn } from "@/lib/utils";

function formatPrice(n?: number) {
  if (n == null) return "—";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 8) return `hace ${weeks} sem`;
  const months = Math.floor(days / 30);
  return `hace ${months} m`;
}

/** Filtros compactos visibles arriba (el resto va en "Más filtros"). */
type QuickStage = "all" | "activas" | OpportunityStage;

export default function Oportunidades() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<QuickStage>("activas");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [pendingRegOnly, setPendingRegOnly] = useState(false);
  const [promotionFilter, setPromotionFilter] = useState<string>("all");
  const [staleOnly, setStaleOnly] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const counts = useMemo(() => ({
    total:        allOpportunities.length,
    activas:      allOpportunities.filter((o) => !["ganada", "perdida"].includes(o.stage)).length,
    interes:      allOpportunities.filter((o) => o.stage === "interes").length,
    visita:       allOpportunities.filter((o) => o.stage === "visita").length,
    evaluacion:   allOpportunities.filter((o) => o.stage === "evaluacion").length,
    negociacion:  allOpportunities.filter((o) => o.stage === "negociacion").length,
    ganada:       allOpportunities.filter((o) => o.stage === "ganada").length,
    perdida:      allOpportunities.filter((o) => o.stage === "perdida").length,
    pendingReg:   allOpportunities.filter(hasPendingRegistration).length,
  }), []);

  const assignees = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    allOpportunities.forEach((o) => {
      if (o.assigneeUserId) {
        const m = findTeamMember(o.assigneeUserId);
        map.set(o.assigneeUserId, { id: o.assigneeUserId, name: m?.name ?? o.assigneeName ?? "—" });
      }
    });
    return Array.from(map.values());
  }, []);

  const promotions = useMemo(() => {
    const set = new Set<string>();
    allOpportunities.forEach((o) => { if (o.interest.originPromotionName) set.add(o.interest.originPromotionName); });
    return Array.from(set).sort();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allOpportunities
      .filter((o) => {
        if (stageFilter === "activas" && ["ganada", "perdida"].includes(o.stage)) return false;
        if (stageFilter !== "all" && stageFilter !== "activas" && o.stage !== stageFilter) return false;
        if (assigneeFilter !== "all" && o.assigneeUserId !== assigneeFilter) return false;
        if (pendingRegOnly && !hasPendingRegistration(o)) return false;
        if (promotionFilter !== "all" && o.interest.originPromotionName !== promotionFilter) return false;
        if (staleOnly) {
          const days = (Date.now() - new Date(o.lastActivityAt).getTime()) / (1000 * 60 * 60 * 24);
          if (days < 14) return false;
        }
        if (q) {
          const hay = [
            o.fullName, o.interest.propertyType ?? "", o.interest.area ?? "",
            o.interest.originPromotionName ?? "",
          ].join(" ").toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
  }, [search, stageFilter, assigneeFilter, pendingRegOnly, promotionFilter, staleOnly]);

  return (
    <div className="flex flex-col min-h-full bg-background">
      {/* Header */}
      <section className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Comercial
              </p>
              <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight text-foreground mt-1 leading-tight">
                Oportunidades
              </h1>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-[640px] leading-relaxed">
                Pipeline de clientes comercialmente activos. Cada oportunidad
                agrupa interés, matching, registros y visitas alrededor de un contacto.
              </p>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 mt-5">
            <KpiChip label="Activas"      value={counts.activas}     icon={Target}          tone="primary" />
            <KpiChip label="Visita"       value={counts.visita}      icon={Users}           tone="sky" />
            <KpiChip label="Negociación"  value={counts.negociacion} icon={TrendingUp}      tone="warning" />
            <KpiChip label="Ganadas"      value={counts.ganada}      icon={CheckCircle2}    tone="emerald" />
            <KpiChip label="Registro pendiente" value={counts.pendingReg} icon={AlertCircle} tone="destructive" />
          </div>

          {/* Toolbar · filtros compactos */}
          <div className="flex items-center gap-2 mt-5 flex-wrap">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
              <input
                type="text"
                placeholder="Buscar por cliente, zona, promoción..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-9 rounded-full border border-border bg-card text-sm focus:border-foreground focus:outline-none transition-colors"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X className="h-3 w-3" strokeWidth={2} />
                </button>
              )}
            </div>

            {/* Segmented etapa */}
            <div className="inline-flex items-center bg-muted rounded-full p-1 gap-0.5 shrink-0 overflow-x-auto no-scrollbar">
              {([
                { key: "activas" as const,     label: "Activas",     count: counts.activas },
                { key: "interes" as const,     label: "Interés",     count: counts.interes },
                { key: "visita" as const,      label: "Visita",      count: counts.visita },
                { key: "evaluacion" as const,  label: "Evaluación",  count: counts.evaluacion },
                { key: "negociacion" as const, label: "Negociación", count: counts.negociacion },
                { key: "ganada" as const,      label: "Ganadas",     count: counts.ganada },
                { key: "all" as const,         label: "Todas",       count: counts.total },
              ]).map((opt) => {
                const selected = stageFilter === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setStageFilter(opt.key)}
                    className={cn(
                      "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
                      selected
                        ? "bg-card text-foreground shadow-soft"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {opt.label}
                    {opt.count > 0 && (
                      <span className={cn(
                        "inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[9.5px] font-bold tabular-nums",
                        selected ? "bg-foreground text-background" : "bg-background text-muted-foreground",
                      )}>
                        {opt.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setMoreOpen((m) => !m)}
              className={cn(
                "inline-flex items-center gap-1.5 h-10 px-4 rounded-full border text-sm font-medium transition-colors shrink-0",
                moreOpen
                  ? "bg-foreground text-background border-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              <Filter className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span className="hidden sm:inline">Más filtros</span>
            </button>
          </div>

          {/* Panel "Más filtros" — responsable / promoción / registro / sin actividad */}
          {moreOpen && (
            <div className="mt-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Responsable</span>
                  <select
                    value={assigneeFilter}
                    onChange={(e) => setAssigneeFilter(e.target.value)}
                    className="h-9 rounded-full border border-border bg-card px-3 text-sm focus:border-foreground focus:outline-none"
                  >
                    <option value="all">Todos</option>
                    {assignees.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Promoción</span>
                  <select
                    value={promotionFilter}
                    onChange={(e) => setPromotionFilter(e.target.value)}
                    className="h-9 rounded-full border border-border bg-card px-3 text-sm focus:border-foreground focus:outline-none"
                  >
                    <option value="all">Todas</option>
                    {promotions.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </label>

                <label className="flex items-center gap-2 mt-[18px] text-sm">
                  <input
                    type="checkbox"
                    checked={pendingRegOnly}
                    onChange={(e) => setPendingRegOnly(e.target.checked)}
                    className="rounded border-border"
                  />
                  Con registro pendiente
                </label>

                <label className="flex items-center gap-2 mt-[18px] text-sm">
                  <input
                    type="checkbox"
                    checked={staleOnly}
                    onChange={(e) => setStaleOnly(e.target.checked)}
                    className="rounded border-border"
                  />
                  Sin actividad hace +14 días
                </label>
              </div>

              <p className="mt-3 text-[11px] text-muted-foreground">
                Filtros adicionales (nacionalidad · rango presupuesto · visitas · email)
                disponibles al conectar backend — <code className="text-[10px]">TODO(backend)</code>.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Listado */}
      <section className="px-4 sm:px-6 lg:px-8 mt-6 pb-12">
        <div className="max-w-[1400px] mx-auto">
          <div className="mb-3 flex items-end justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "oportunidad" : "oportunidades"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Ordenadas por última actividad
            </p>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
              <Target className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-sm font-medium text-foreground mb-1">Sin oportunidades</p>
              <p className="text-xs text-muted-foreground">
                {search || stageFilter !== "activas" || pendingRegOnly || staleOnly || assigneeFilter !== "all" || promotionFilter !== "all"
                  ? "Prueba con otros filtros."
                  : "Cuando conviertas leads o crees oportunidades directas, aparecerán aquí."}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-semibold">Cliente</th>
                      <th className="px-3 py-2.5 text-left font-semibold">Interés</th>
                      <th className="px-3 py-2.5 text-left font-semibold">Promoción origen</th>
                      <th className="px-3 py-2.5 text-center font-semibold">Etapa</th>
                      <th className="px-3 py-2.5 text-center font-semibold">Temperatura</th>
                      <th className="px-3 py-2.5 text-left font-semibold">Responsable</th>
                      <th className="px-3 py-2.5 text-left font-semibold">Última actividad</th>
                      <th className="px-2 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((o) => (
                      <OpportunityRow key={o.id} o={o} navigate={navigate} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   FILA DE OPORTUNIDAD
   ═══════════════════════════════════════════════════════════════════ */

function OpportunityRow({
  o, navigate,
}: {
  o: Opportunity;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const stage = opportunityStageConfig[o.stage];
  const temp = temperatureConfig[o.temperature];
  const pendingReg = hasPendingRegistration(o);
  const member = o.assigneeUserId ? findTeamMember(o.assigneeUserId) : undefined;

  return (
    <tr
      onClick={() => navigate(`/oportunidades/${o.id}`)}
      className="border-t border-border/60 hover:bg-muted/20 transition-colors cursor-pointer"
    >
      {/* Cliente */}
      <td className="px-4 py-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0 text-[11px] font-bold text-foreground">
            {o.fullName.split(" ").map((w) => w[0]).slice(0, 2).join("")}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
              {o.nationality && <Flag iso={o.nationality} size={14} />}
              {o.fullName}
              {pendingReg && (
                <span
                  className="inline-flex items-center gap-0.5 text-[9.5px] font-bold text-warning bg-warning/10 border border-warning/25 rounded-full px-1.5 py-0.5"
                  title="Tiene un registro pendiente de aprobación"
                >
                  <AlertCircle className="h-2.5 w-2.5" strokeWidth={2.5} />
                  REG
                </span>
              )}
            </p>
            {o.interest.area && <p className="text-[11.5px] text-muted-foreground truncate">{o.interest.area}</p>}
            {o.tags && o.tags.length > 0 && (
              <p className="text-[10px] text-muted-foreground/80 truncate">
                {o.tags.slice(0, 2).map((t) => `#${t}`).join(" · ")}
              </p>
            )}
          </div>
        </div>
      </td>

      {/* Interés resumen */}
      <td className="px-3 py-3 align-top">
        <p className="text-xs font-medium text-foreground truncate max-w-[240px]">
          {o.interest.propertyType ?? "—"}
          {o.interest.bedrooms && <span className="text-muted-foreground"> · {o.interest.bedrooms} dorm.</span>}
        </p>
        <p className="text-[11px] text-muted-foreground tabular-nums">
          {o.interest.budgetMin != null && o.interest.budgetMax != null
            ? `${formatPrice(o.interest.budgetMin)} – ${formatPrice(o.interest.budgetMax)}`
            : formatPrice(o.interest.budgetMax ?? o.interest.budgetMin)}
        </p>
      </td>

      {/* Promoción origen */}
      <td className="px-3 py-3 align-top">
        {o.interest.originPromotionName ? (
          <p className="text-xs font-medium text-foreground truncate max-w-[180px]">
            {o.interest.originPromotionName}
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground/60 italic">—</p>
        )}
      </td>

      {/* Etapa */}
      <td className="px-3 py-3 text-center align-top">
        <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5", stage.badgeClass)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", stage.dotClass)} />
          {stage.label}
        </span>
      </td>

      {/* Temperatura */}
      <td className="px-3 py-3 text-center align-top">
        <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5", temp.badgeClass)}>
          {o.temperature === "caliente" && <Flame className="h-2.5 w-2.5" strokeWidth={2.5} />}
          {o.temperature === "frio" && <Snowflake className="h-2.5 w-2.5" strokeWidth={2.5} />}
          {temp.label}
        </span>
      </td>

      {/* Responsable */}
      <td className="px-3 py-3 align-top">
        <div className="inline-flex items-center gap-1.5 min-w-0">
          {member ? (
            getMemberAvatarUrl(member) ? (
              <img src={getMemberAvatarUrl(member)!} alt="" className="h-5 w-5 rounded-full object-cover shrink-0" />
            ) : (
              <div className="h-5 w-5 rounded-full bg-muted grid place-items-center text-[8.5px] font-bold text-foreground shrink-0">
                {memberInitials(member)}
              </div>
            )
          ) : (
            <div className="h-5 w-5 rounded-full bg-muted shrink-0" />
          )}
          <span className="text-[11px] text-muted-foreground truncate max-w-[110px]">
            {member?.name ?? o.assigneeName ?? "Sin asignar"}
          </span>
        </div>
      </td>

      {/* Última actividad */}
      <td className="px-3 py-3 align-top">
        <p className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" strokeWidth={1.75} />
          {relativeTime(o.lastActivityAt)}
        </p>
      </td>

      {/* Kebab */}
      <td className="px-2 py-3 text-right align-top" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              onClick={() => toast.info("Abriendo composer de email")}
              className="gap-2 text-xs"
            >
              <Mail className="h-3.5 w-3.5" /> Enviar email
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => toast.info("Abriendo composer de comentario")}
              className="gap-2 text-xs"
            >
              <MessageSquare className="h-3.5 w-3.5" /> Comentar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => navigate(`/oportunidades/${o.id}`)}
              className="gap-2 text-xs"
            >
              <ArrowRight className="h-3.5 w-3.5" /> Abrir ficha
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => toast.info("Reasignación disponible al conectar backend")}
              className="gap-2 text-xs"
            >
              Reasignar responsable
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => toast.info("Mover etapa · disponible en la ficha")}
              className="gap-2 text-xs"
            >
              Mover etapa
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => toast.info("Oportunidad archivada (mock)")}
              className="gap-2 text-xs text-muted-foreground"
            >
              Archivar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   KPI CHIP (alineado al estilo de Leads.tsx)
   ═══════════════════════════════════════════════════════════════════ */

type KpiTone = "neutral" | "primary" | "sky" | "warning" | "emerald" | "destructive";

function KpiChip({
  label, value, icon: Icon, tone,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: KpiTone;
}) {
  const toneClasses: Record<KpiTone, { bg: string; text: string; icon: string }> = {
    neutral:     { bg: "bg-muted",                text: "text-foreground",     icon: "text-muted-foreground" },
    primary:     { bg: "bg-primary/10",           text: "text-primary",        icon: "text-primary" },
    sky:         { bg: "bg-sky-50",               text: "text-sky-800",        icon: "text-sky-600" },
    warning:     { bg: "bg-warning/10",           text: "text-warning",        icon: "text-warning" },
    emerald:     { bg: "bg-emerald-50",           text: "text-emerald-800",    icon: "text-emerald-600" },
    destructive: { bg: "bg-destructive/5",        text: "text-destructive",    icon: "text-destructive" },
  };
  const t = toneClasses[tone];
  return (
    <div className={cn("rounded-xl border border-border p-3 flex items-center gap-2.5", t.bg)}>
      <Icon className={cn("h-4 w-4 shrink-0", t.icon)} strokeWidth={1.75} />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">{label}</p>
        <p className={cn("text-lg font-bold tabular-nums leading-tight", t.text)}>{value}</p>
      </div>
    </div>
  );
}
