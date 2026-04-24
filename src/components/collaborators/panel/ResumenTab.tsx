/**
 * Tab "Resumen" del panel de colaboración.
 *
 * Dashboard de 1 vistazo con lo que el promotor debe saber AHORA:
 *  · Pipeline comercial (5 KPI cards + venta iniciada placeholder).
 *  · Avisos (promociones no compartidas aún, contratos por vencer,
 *    documentos bloqueando pagos).
 *  · Visitas programadas próximas.
 *  · Actividad reciente (últimos 5 eventos cross-empresa).
 *  · Agentes activos en la promoción (si se llegó con `fromPromoId`).
 *  · Incidencias abiertas (si hay).
 *
 * Cada bloque remite al tab correspondiente con CTA "Ver todo".
 */

import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle, Calendar, ChevronRight, FileText, Home,
  Share2, Sparkles, TrendingUp, UserCog,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Agency } from "@/data/agencies";
import { developerOnlyPromotions } from "@/data/developerPromotions";
import { useCompanyEvents } from "@/lib/companyEvents";
import { useContractsForAgency } from "@/lib/collaborationContracts";
import { useAgencyPayments, summarizePayments } from "@/lib/agencyPayments";
import { SectionHeader } from "./shared";

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

function formatRelative(ms: number) {
  const diff = Date.now() - ms;
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days <= 0) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return hours <= 0 ? "hace minutos" : `hace ${hours} h`;
  }
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? "hace 1 semana" : `hace ${weeks} semanas`;
}

function formatEur(n: number) {
  if (!Number.isFinite(n) || n === 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M€`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} K€`;
  return `${n} €`;
}

interface Props {
  agency: Agency;
  fromPromoId?: string;
  /** Cambiar a otro tab del panel. */
  onGoTo: (tab: "documentacion" | "pagos") => void;
}

export function ResumenTab({ agency: a, fromPromoId, onGoTo }: Props) {
  const events = useCompanyEvents(a.id);
  const contracts = useContractsForAgency(a.id);
  const payments = useAgencyPayments(a.id);
  const paySummary = summarizePayments(payments);

  /* Promociones no compartidas aún con esta agencia · en backend esto
     vendrá de un GET que cruce `promotions` del promotor con el
     `promotionsCollaborating` de la agencia. */
  const notSharedPromos = useMemo(() => {
    return developerOnlyPromotions.filter(
      (pr) => pr.status === "active" && !a.promotionsCollaborating?.includes(pr.id),
    );
  }, [a.promotionsCollaborating]);

  /* Contratos con estado relevante. */
  const pendingContracts = contracts.filter((c) => c.status === "sent" || c.status === "viewed" || c.status === "draft");
  const signedContracts = contracts.filter((c) => c.status === "signed");

  /* Documentos bloqueando pagos. */
  const blockedAmount = paySummary.onHoldTotal;
  const blockedCount = paySummary.counts.onHold;

  const registros = a.registrations ?? a.registrosAportados ?? 0;
  const ventas = a.ventasCerradas ?? 0;
  const visitas = a.visitsCount ?? 0;
  const conversion = registros > 0 ? Math.round((ventas / registros) * 100) : 0;
  const incidenciasTotal =
    (a.incidencias?.duplicados ?? 0) +
    (a.incidencias?.cancelaciones ?? 0) +
    (a.incidencias?.reclamaciones ?? 0);

  return (
    <div className="space-y-6">
      {/* ═══ Pipeline comercial ═══ */}
      <section>
        <SectionHeader title="Pipeline comercial" subtitle="Estado del embudo con esta agencia" />
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <FunnelCard icon={FileText}   label="Registros"       value={registros} hint="aportados" />
          <FunnelCard icon={Calendar}   label="Visitas"         value={visitas}   hint="hechas" />
          <FunnelCard icon={TrendingUp} label="Venta iniciada"  value={0} hint="en algún paso" planned />
          <FunnelCard icon={Home}       label="Ventas cerradas" value={ventas} hint={formatEur(a.salesVolume)} accent="success" />
          <FunnelCard icon={TrendingUp} label="Conversión"      value={`${conversion}%`} hint="reg. → venta" accent={conversion >= 15 ? "success" : undefined} />
        </div>
        {/* Venta iniciada · preview dibujo de pasos */}
        <div className="mt-3 rounded-2xl border border-dashed border-border bg-card/60 px-4 py-3">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            <Sparkles className="h-3 w-3" strokeWidth={1.75} />
            Venta iniciada · por paso
            <span className="text-muted-foreground/70 normal-case tracking-normal">(preview · se conecta con el módulo de ventas)</span>
          </div>
          <ol className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Reserva firmada" },
              { label: "Contrato privado" },
              { label: "Escritura" },
              { label: "Entrega llaves" },
            ].map((step) => (
              <li key={step.label} className="rounded-xl bg-muted/40 border border-border/50 px-3 py-2">
                <p className="text-[10.5px] text-muted-foreground">Paso</p>
                <p className="text-xs font-semibold text-foreground mt-0.5">{step.label}</p>
                <p className="text-[10.5px] text-muted-foreground/70 mt-1 tabular-nums">— ventas aquí</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ═══ Avisos ═══ */}
      <section>
        <SectionHeader title="Avisos · a tu atención" subtitle="Acciones pendientes que desbloquean valor con esta agencia" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {notSharedPromos.length > 0 && (
            <AlertCard
              tone="primary"
              icon={Share2}
              title={`${notSharedPromos.length} promoción${notSharedPromos.length === 1 ? "" : "es"} activa${notSharedPromos.length === 1 ? "" : "s"} sin compartir`}
              body={`Esta agencia no colabora aún en ${notSharedPromos.slice(0, 2).map((p) => p.name).join(", ")}${notSharedPromos.length > 2 ? " y más" : ""}. Invítala y podrá trabajar esas oportunidades.`}
              ctaLabel="Compartir ahora"
              onClick={() => toast.info("Compartir promoción · próximamente")}
            />
          )}
          {blockedCount > 0 && (
            <AlertCard
              tone="warning"
              icon={AlertTriangle}
              title={`${blockedCount} pago${blockedCount === 1 ? "" : "s"} bloqueado${blockedCount === 1 ? "" : "s"} por documentación`}
              body={`${formatEur(blockedAmount)} a la espera de factura u otros documentos. Revísalos en Pagos para desbloquear.`}
              ctaLabel="Ir a Pagos"
              onClick={() => onGoTo("pagos")}
            />
          )}
          {pendingContracts.length > 0 && (
            <AlertCard
              tone="muted"
              icon={FileText}
              title={`${pendingContracts.length} contrato${pendingContracts.length === 1 ? "" : "s"} sin firmar`}
              body="Borradores subidos o enviados que aún no están firmados por la agencia."
              ctaLabel="Abrir documentación"
              onClick={() => onGoTo("documentacion")}
            />
          )}
          {notSharedPromos.length === 0 && blockedCount === 0 && pendingContracts.length === 0 && (
            <div className="md:col-span-2 rounded-2xl border border-dashed border-border bg-card p-6 text-center">
              <Sparkles className="h-5 w-5 text-muted-foreground/40 mx-auto mb-1.5" strokeWidth={1.5} />
              <p className="text-xs text-muted-foreground">Todo al día · nada pendiente por ahora.</p>
            </div>
          )}
        </div>
      </section>

      {/* ═══ Dos columnas · visitas programadas + actividad ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <SectionHeader
            title="Próximas visitas"
            subtitle="Visitas con clientes registrados por esta agencia"
          />
          <UpcomingVisits agencyId={a.id} fromPromoId={fromPromoId} />
        </section>

        <section>
          <SectionHeader
            title="Actividad reciente"
            subtitle="Últimos 5 eventos entre tu empresa y esta agencia"
            right={
              <Link
                to={`/colaboradores/${a.id}/historial`}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-0.5"
              >
                Ver historial completo
                <ChevronRight className="h-3 w-3" />
              </Link>
            }
          />
          <ActivityRecap events={events.slice(0, 5)} />
        </section>
      </div>

      {/* ═══ Agentes ═══ */}
      <section>
        <SectionHeader
          title={fromPromoId ? "Agentes activos en esta promoción" : "Agentes que han interactuado"}
          subtitle="Solo agentes que han aportado trabajo · el resto queda privado en la agencia"
        />
        <AgentsRecap agencyId={a.id} fromPromoId={fromPromoId} />
      </section>

      {/* ═══ Incidencias ═══ */}
      {incidenciasTotal > 0 && (
        <section>
          <SectionHeader title="Incidencias abiertas" subtitle="Revísalas para evitar penalizar el rating de la agencia" />
          <IncidentsPanel agency={a} />
        </section>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Sub-componentes
 * ════════════════════════════════════════════════════════════════ */

function FunnelCard({
  icon: Icon, label, value, hint, accent, planned,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: number | string;
  hint?: string;
  accent?: "success";
  planned?: boolean;
}) {
  return (
    <div className={cn(
      "rounded-2xl border bg-card shadow-soft p-3.5",
      planned ? "border-dashed border-border/70" : "border-border",
    )}>
      <div className="flex items-center gap-2">
        <span className="h-7 w-7 rounded-lg bg-muted/60 grid place-items-center shrink-0">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
        </span>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground truncate">{label}</p>
      </div>
      <p className={cn(
        "text-[20px] font-bold tabular-nums leading-none mt-2",
        accent === "success" ? "text-success" : planned ? "text-muted-foreground/70" : "text-foreground",
      )}>
        {value}
      </p>
      {hint && <p className="text-[10.5px] text-muted-foreground mt-1 tabular-nums">{hint}</p>}
    </div>
  );
}

function AlertCard({
  tone, icon: Icon, title, body, ctaLabel, onClick,
}: {
  tone: "primary" | "warning" | "muted";
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  body: string;
  ctaLabel: string;
  onClick: () => void;
}) {
  const ring = {
    primary: "border-primary/25 bg-primary/5",
    warning: "border-warning/30 bg-warning/5",
    muted:   "border-border bg-card",
  }[tone];
  const iconTone = {
    primary: "bg-primary/10 text-primary",
    warning: "bg-warning/10 text-warning",
    muted:   "bg-muted text-muted-foreground",
  }[tone];
  return (
    <div className={cn("rounded-2xl border p-4 shadow-soft", ring)}>
      <div className="flex items-start gap-3">
        <span className={cn("h-8 w-8 rounded-lg grid place-items-center shrink-0", iconTone)}>
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-[11.5px] text-muted-foreground mt-1 leading-relaxed">{body}</p>
          <button
            type="button"
            onClick={onClick}
            className="mt-2.5 inline-flex items-center gap-1 text-[12px] font-semibold text-foreground hover:underline"
          >
            {ctaLabel}
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* Mock de visitas próximas · determinista. */
function UpcomingVisits({ agencyId, fromPromoId }: { agencyId: string; fromPromoId?: string }) {
  const mock = useMemo(() => {
    /* Para la demo seedeamos por agency · cuando exista dataset real
       de visitas, esto pasa a fetch filtrado por agency y promoción. */
    const base: Record<string, Array<{ when: number; client: string; promo: string; unit: string; status: "confirmada" | "pendiente" }>> = {
      "ag-1": [
        { when: Date.now() + 2 * 86400e3,  client: "María García",     promo: "Villa Serena",     unit: "Villa 12-B", status: "confirmada" },
        { when: Date.now() + 5 * 86400e3,  client: "Pedro Sánchez",    promo: "Villas del Pinar", unit: "Apt. 04-2",  status: "pendiente" },
        { when: Date.now() + 8 * 86400e3,  client: "Isabel Ruiz",      promo: "Villa Serena",     unit: "Villa 08-C", status: "confirmada" },
      ],
      "ag-2": [
        { when: Date.now() + 3 * 86400e3,  client: "Erik Lindqvist",   promo: "Villa Serena",     unit: "Villa 14-A", status: "confirmada" },
      ],
    };
    const list = base[agencyId] ?? [];
    return fromPromoId
      ? list.filter((v) => /* mock scope · filter by promoName containing key */ true)
      : list;
  }, [agencyId, fromPromoId]);

  if (mock.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
        <Calendar className="h-5 w-5 text-muted-foreground/40 mx-auto mb-1.5" strokeWidth={1.5} />
        <p className="text-xs text-muted-foreground">Sin visitas programadas.</p>
      </div>
    );
  }
  return (
    <ul className="rounded-2xl border border-border bg-card shadow-soft divide-y divide-border/50 overflow-hidden">
      {mock.map((v, i) => {
        const date = new Date(v.when);
        const dd = date.getDate();
        const mm = date.toLocaleDateString("es-ES", { month: "short" });
        return (
          <li key={i} className="px-4 py-3 flex items-center gap-3">
            <div className="shrink-0 h-10 w-10 rounded-lg bg-muted/60 grid place-items-center">
              <div className="text-center">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground leading-none">{mm}</p>
                <p className="text-sm font-bold text-foreground leading-none tabular-nums mt-0.5">{dd}</p>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{v.client}</p>
              <p className="text-[11.5px] text-muted-foreground truncate">
                {v.promo} · {v.unit}
              </p>
            </div>
            <span className={cn(
              "inline-flex items-center h-5 px-2 rounded-full border text-[10px] font-medium shrink-0",
              v.status === "confirmada"
                ? "border-success/25 bg-success/10 text-success"
                : "border-warning/30 bg-warning/10 text-warning",
            )}>
              {v.status}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function ActivityRecap({ events }: { events: ReturnType<typeof useCompanyEvents> }) {
  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
        <Sparkles className="h-5 w-5 text-muted-foreground/40 mx-auto mb-1.5" strokeWidth={1.5} />
        <p className="text-xs text-muted-foreground">Sin actividad registrada todavía.</p>
      </div>
    );
  }
  return (
    <ul className="rounded-2xl border border-border bg-card shadow-soft divide-y divide-border/50 overflow-hidden">
      {events.map((e) => (
        <li key={e.id} className="px-4 py-2.5 flex items-start gap-3">
          <span className="h-7 w-7 rounded-full bg-muted/60 grid place-items-center shrink-0 mt-0.5">
            <Sparkles className="h-3 w-3 text-muted-foreground" strokeWidth={1.75} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground leading-tight truncate">{e.title}</p>
            {e.description && (
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{e.description}</p>
            )}
            <p className="text-[10.5px] text-muted-foreground/80 mt-0.5">
              {formatRelative(new Date(e.happenedAt).getTime())}
              {e.by?.name ? ` · ${e.by.name}` : ""}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function AgentsRecap({ agencyId, fromPromoId }: { agencyId: string; fromPromoId?: string }) {
  const mockAgents = useMemo(() => {
    const buckets: Record<string, Array<{ name: string; role: string; registros: number; visitas: number; ventas: number; respH: number }>> = {
      "ag-1-dev-1": [
        { name: "Laura Sánchez",   role: "Sales Manager", registros: 12, visitas: 18, ventas: 3, respH: 1.8 },
        { name: "Diego Romero",    role: "Senior Agent",  registros: 9,  visitas: 11, ventas: 2, respH: 3.4 },
        { name: "Carmen Ortega",   role: "Agent",         registros: 5,  visitas: 7,  ventas: 0, respH: 5.1 },
      ],
      "ag-2-dev-1": [
        { name: "Erik Lindqvist",  role: "Partner",       registros: 22, visitas: 31, ventas: 6, respH: 2.2 },
        { name: "Sofia Bergman",   role: "Senior Agent",  registros: 14, visitas: 19, ventas: 3, respH: 2.9 },
      ],
    };
    const seed = `${agencyId}-${fromPromoId ?? "all"}`;
    return buckets[seed] ?? buckets[`${agencyId}-dev-1`] ?? [];
  }, [agencyId, fromPromoId]);

  if (mockAgents.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
        <UserCog className="h-5 w-5 text-muted-foreground/40 mx-auto mb-1.5" strokeWidth={1.5} />
        <p className="text-xs font-medium text-foreground">Sin interacciones registradas</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[280px] mx-auto">
          Cuando algún agente aporte registros o visitas, aparecerá aquí.
        </p>
      </div>
    );
  }
  return (
    <ul className="rounded-2xl border border-border bg-card shadow-soft divide-y divide-border/50 overflow-hidden">
      {mockAgents.map((ag, i) => (
        <li key={i} className="px-4 py-3 flex items-center gap-3">
          <span className="h-9 w-9 rounded-full bg-muted/60 grid place-items-center shrink-0 text-[11px] font-semibold text-muted-foreground">
            {initials(ag.name)}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{ag.name}</p>
            <p className="text-[11.5px] text-muted-foreground truncate">{ag.role}</p>
          </div>
          <div className="flex items-center gap-4 shrink-0 text-[11px] text-muted-foreground tabular-nums">
            <span><span className="text-foreground font-semibold">{ag.registros}</span> reg.</span>
            <span><span className="text-foreground font-semibold">{ag.visitas}</span> vis.</span>
            <span><span className="text-foreground font-semibold">{ag.ventas}</span> v.</span>
            <span className="hidden sm:inline"><span className="text-foreground font-semibold">{ag.respH}h</span> resp.</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function IncidentsPanel({ agency: a }: { agency: Agency }) {
  const inc = a.incidencias!;
  const rows = [
    { label: "Duplicados detectados",  value: inc.duplicados,    tone: "warning" as const },
    { label: "Cancelaciones",          value: inc.cancelaciones, tone: "warning" as const },
    { label: "Reclamaciones",          value: inc.reclamaciones, tone: "destructive" as const },
  ].filter((r) => r.value > 0);
  return (
    <ul className="rounded-2xl border border-border bg-card shadow-soft divide-y divide-border/50 overflow-hidden">
      {rows.map((r) => (
        <li key={r.label} className="px-4 py-3 flex items-center gap-3">
          <span className={cn(
            "h-8 w-8 rounded-lg grid place-items-center shrink-0",
            r.tone === "warning" ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive",
          )}>
            <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">{r.label}</p>
            <p className="text-[11px] text-muted-foreground">{r.value} abiertas.</p>
          </div>
          <button
            onClick={() => toast.info("Revisión de incidencias · próximamente")}
            className="inline-flex items-center gap-1 h-8 px-3 rounded-full border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            Revisar <ChevronRight className="h-3 w-3" />
          </button>
        </li>
      ))}
    </ul>
  );
}

