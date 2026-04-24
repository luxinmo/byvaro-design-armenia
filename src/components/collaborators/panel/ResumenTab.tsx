/**
 * Tab "Resumen" del panel de colaboración.
 *
 * Vista hero operativa: al entrar, el promotor debe captar en 2
 * segundos cómo está la relación con esta agencia y qué hay que
 * resolver. No hay estadísticas — todo son señales accionables.
 *
 * Estructura:
 *   1. Hero · frase grande con el estado de la colaboración
 *      (ej. "Trabaja en 2 de 5 promociones · 3 cosas pendientes").
 *   2. Pendiente · tiles destacados (si hay algo) con CTA directo.
 *   3. Promociones · grid de chips · visibles las compartidas y
 *      huecos punteados para las que faltan por compartir.
 *   4. Próximas visitas · lista compacta · si hay.
 */

import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Calendar, ChevronRight, FileSignature, Home, Plus, Share2,
  Upload, ArrowRight, Check, MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Agency } from "@/data/agencies";
import { developerOnlyPromotions } from "@/data/developerPromotions";
import { promotions } from "@/data/promotions";
import { useContractsForAgency } from "@/lib/collaborationContracts";
import { useAgencyDocRequests } from "@/lib/agencyDocRequests";

/* ─── Helpers ─────────────────────────────────────────────────────── */

function formatWhen(ms: number) {
  const d = new Date(ms);
  return {
    day: d.getDate(),
    month: d.toLocaleDateString("es-ES", { month: "short" }).replace(".", ""),
    time: d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
  };
}

function usePromoCatalog() {
  return useMemo(() => {
    const m = new Map<string, { id: string; name: string; active: boolean }>();
    for (const p of developerOnlyPromotions) {
      m.set(p.id, { id: p.id, name: p.name, active: p.status === "active" });
    }
    for (const p of promotions) {
      if (m.has(p.id)) continue;
      m.set(p.id, { id: p.id, name: p.name, active: true });
    }
    return m;
  }, []);
}

interface Props {
  agency: Agency;
  fromPromoId?: string;
  onGoTo: (tab: "documentacion" | "pagos") => void;
}

export function ResumenTab({ agency: a, fromPromoId, onGoTo }: Props) {
  const navigate = useNavigate();
  const contracts = useContractsForAgency(a.id);
  const docRequests = useAgencyDocRequests(a.id);
  const promoCatalog = usePromoCatalog();

  const activePromos = useMemo(
    () => developerOnlyPromotions.filter((p) => p.status === "active"),
    [],
  );
  const sharedPromos = useMemo(() => {
    return (a.promotionsCollaborating ?? [])
      .map((id) => promoCatalog.get(id))
      .filter(Boolean) as Array<{ id: string; name: string; active: boolean }>;
  }, [a.promotionsCollaborating, promoCatalog]);
  const notSharedPromos = useMemo(
    () => activePromos.filter((pr) => !(a.promotionsCollaborating ?? []).includes(pr.id)),
    [activePromos, a.promotionsCollaborating],
  );

  const pendingContracts = useMemo(
    () => contracts.filter((c) => !c.archived && (c.status === "draft" || c.status === "sent" || c.status === "viewed")),
    [contracts],
  );
  const pendingDocs = useMemo(
    () => docRequests.filter((d) => d.status === "pending" || d.status === "uploaded"),
    [docRequests],
  );

  const upcomingVisits = useMemo(() => {
    const base: Record<string, Array<{ when: number; client: string; promo: string; unit: string; status: "confirmada" | "pendiente" }>> = {
      "ag-1": [
        { when: Date.now() + 2 * 86400e3, client: "María García",  promo: "Villa Serena",     unit: "Villa 12-B", status: "confirmada" },
        { when: Date.now() + 5 * 86400e3, client: "Pedro Sánchez", promo: "Villas del Pinar", unit: "Apt. 04-2",  status: "pendiente" },
        { when: Date.now() + 8 * 86400e3, client: "Isabel Ruiz",   promo: "Villa Serena",     unit: "Villa 08-C", status: "confirmada" },
      ],
      "ag-2": [
        { when: Date.now() + 3 * 86400e3, client: "Erik Lindqvist", promo: "Villa Serena", unit: "Villa 14-A", status: "confirmada" },
      ],
    };
    return (base[a.id] ?? []).slice(0, 3);
  }, [a.id]);

  /* Señal total · lo que decide el tono del hero. */
  const pendingCount = pendingContracts.length + pendingDocs.length + notSharedPromos.length;

  const createSale = () => {
    const params = new URLSearchParams({ agencyId: a.id });
    if (fromPromoId) params.set("promotionId", fromPromoId);
    navigate(`/ventas?nueva=1&${params.toString()}`);
  };

  /* ════════════════════════════════════════════════════════════════ */

  return (
    <div className="space-y-5">

      {/* ══════════════════ HERO ══════════════════ */}
      <section className="relative rounded-3xl border border-border bg-gradient-to-br from-card via-card to-muted/30 p-5 sm:p-7 overflow-hidden shadow-soft">
        {/* Blob decorativo */}
        <div className="absolute -top-20 -right-16 h-48 w-48 rounded-full bg-foreground/[0.03] blur-3xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Estado de la colaboración
            </p>
            <h2 className="text-[22px] sm:text-[26px] font-bold tracking-tight text-foreground leading-tight mt-2">
              Trabaja en{" "}
              <span className="tabular-nums">{sharedPromos.length}</span>
              <span className="text-muted-foreground"> de </span>
              <span className="tabular-nums">{activePromos.length}</span>
              <span className="text-muted-foreground">
                {activePromos.length === 1 ? " promoción" : " promociones"} activas
              </span>
              {pendingCount > 0 ? (
                <>
                  <span className="text-muted-foreground"> · </span>
                  <span className={cn(
                    "tabular-nums",
                    pendingCount > 3 ? "text-warning" : "text-foreground",
                  )}>
                    {pendingCount}
                  </span>{" "}
                  <span className={cn(pendingCount > 3 ? "text-warning/90" : "text-foreground")}>
                    {pendingCount === 1 ? "cosa pendiente" : "cosas pendientes"}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-muted-foreground"> · </span>
                  <span className="text-success">todo al día</span>
                </>
              )}
            </h2>
            <p className="text-[12.5px] text-muted-foreground mt-2 leading-relaxed max-w-xl">
              {pendingCount === 0 && sharedPromos.length > 0 && (
                <>Relación sana · sin acciones urgentes por parte del promotor.</>
              )}
              {pendingCount === 0 && sharedPromos.length === 0 && (
                <>Aún no colabora en ninguna promoción · comparte una para empezar.</>
              )}
              {pendingCount > 0 && (
                <>Resuelve lo pendiente para seguir moviendo visitas, contratos y pagos.</>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={createSale}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-foreground text-background text-[13px] font-semibold hover:bg-foreground/90 transition-all hover:shadow-soft-lg"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
              Crear venta
            </button>
            {notSharedPromos.length > 0 && (
              <button
                type="button"
                onClick={() => toast.info("Compartir promoción · próximamente")}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-border bg-card text-[13px] font-medium text-foreground hover:bg-muted transition-colors"
              >
                <Share2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                Compartir promoción
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ══════════════════ Pendiente · tiles ══════════════════ */}
      {pendingCount > 0 && (
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <PendingTile
            tone={notSharedPromos.length > 0 ? "primary" : "done"}
            icon={Share2}
            value={notSharedPromos.length}
            label={notSharedPromos.length === 1 ? "promoción sin compartir" : "promociones sin compartir"}
            doneLabel="Todas compartidas"
            onClick={notSharedPromos.length > 0 ? () => toast.info("Compartir promoción · próximamente") : undefined}
          />
          <PendingTile
            tone={pendingContracts.length > 0 ? "muted" : "done"}
            icon={FileSignature}
            value={pendingContracts.length}
            label={pendingContracts.length === 1 ? "contrato sin firmar" : "contratos sin firmar"}
            doneLabel="Contratos al día"
            onClick={pendingContracts.length > 0 ? () => onGoTo("documentacion") : undefined}
          />
          <PendingTile
            tone={pendingDocs.length > 0 ? "warning" : "done"}
            icon={Upload}
            value={pendingDocs.length}
            label={pendingDocs.length === 1 ? "documento pendiente" : "documentos pendientes"}
            doneLabel="Documentación al día"
            onClick={pendingDocs.length > 0 ? () => onGoTo("documentacion") : undefined}
          />
        </section>
      )}

      {/* ══════════════════ Promociones ══════════════════ */}
      <section>
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Promociones
          </h3>
          {notSharedPromos.length > 0 && (
            <button
              type="button"
              onClick={() => toast.info("Compartir promoción · próximamente")}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-0.5"
            >
              Compartir más
              <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>

        {sharedPromos.length === 0 && notSharedPromos.length === 0 ? (
          <EmptyCard
            icon={Share2}
            title="No hay promociones activas"
            body="Cuando publiques una promoción activa aparecerá aquí para compartirla."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sharedPromos.map((p) => (
              <Link
                key={p.id}
                to={`/promociones/${p.id}?tab=Agencies`}
                className="group rounded-2xl border border-border bg-card shadow-soft p-4 hover:-translate-y-0.5 hover:shadow-soft-lg transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="h-8 w-8 rounded-lg bg-success/10 text-success grid place-items-center shrink-0">
                    <Check className="h-4 w-4" strokeWidth={2.25} />
                  </span>
                  <span className="inline-flex items-center h-5 px-2 rounded-full border border-success/25 bg-success/10 text-[10px] font-medium text-success shrink-0">
                    Compartida
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground mt-3 truncate group-hover:underline">
                  {p.name}
                </p>
                {!p.active && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">Promoción cerrada</p>
                )}
                <div className="mt-2 inline-flex items-center gap-0.5 text-[11px] text-muted-foreground group-hover:text-foreground transition-colors">
                  Ver en promoción
                  <ArrowRight className="h-3 w-3" />
                </div>
              </Link>
            ))}
            {notSharedPromos.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => toast.info("Compartir promoción · próximamente")}
                className="group text-left rounded-2xl border border-dashed border-border bg-card/50 p-4 hover:bg-card hover:border-foreground/30 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="h-8 w-8 rounded-lg bg-muted text-muted-foreground grid place-items-center shrink-0">
                    <Home className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <span className="inline-flex items-center h-5 px-2 rounded-full border border-border bg-muted/40 text-[10px] font-medium text-muted-foreground shrink-0">
                    Sin compartir
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground mt-3 truncate">{p.name}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{p.location ?? "—"}</p>
                <div className="mt-2 inline-flex items-center gap-0.5 text-[11px] text-foreground font-medium">
                  <Plus className="h-3 w-3" strokeWidth={2.25} />
                  Compartir con {a.name.split(" ")[0]}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ══════════════════ Próximas visitas ══════════════════ */}
      {upcomingVisits.length > 0 && (
        <section>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Próximas visitas
            </h3>
            <Link
              to="/calendario"
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-0.5"
            >
              Ver calendario
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <ul className="rounded-2xl border border-border bg-card shadow-soft divide-y divide-border/50 overflow-hidden">
            {upcomingVisits.map((v, i) => {
              const w = formatWhen(v.when);
              return (
                <li key={i} className="px-4 py-3 flex items-center gap-3">
                  <div className="shrink-0 h-10 w-10 rounded-lg bg-muted/60 grid place-items-center">
                    <div className="text-center">
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground leading-none">{w.month}</p>
                      <p className="text-sm font-bold text-foreground leading-none tabular-nums mt-0.5">{w.day}</p>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{v.client}</p>
                    <p className="text-[11.5px] text-muted-foreground truncate">
                      {v.promo} · {v.unit} · {w.time}
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
        </section>
      )}

      {/* ══════════════════ Más ══════════════════ */}
      <div className="flex flex-wrap gap-2 pt-2">
        <Link
          to={`/colaboradores/${a.id}?tab=historial`}
          className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors"
        >
          <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
          Ver toda la actividad
        </Link>
      </div>
    </div>
  );
}

/* ═══════════════ Sub-componentes ═══════════════ */

function PendingTile({
  tone, icon: Icon, value, label, doneLabel, onClick,
}: {
  tone: "primary" | "warning" | "muted" | "done";
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  value: number;
  label: string;
  doneLabel: string;
  onClick?: () => void;
}) {
  const cls = {
    primary: "border-primary/30 bg-primary/5 hover:bg-primary/10",
    warning: "border-warning/30 bg-warning/5 hover:bg-warning/10",
    muted:   "border-border bg-card hover:bg-muted/40",
    done:    "border-border/60 bg-muted/20",
  }[tone];
  const iconCls = {
    primary: "bg-primary/15 text-primary",
    warning: "bg-warning/15 text-warning",
    muted:   "bg-muted text-muted-foreground",
    done:    "bg-success/10 text-success",
  }[tone];

  const isDone = tone === "done";
  const Wrapper: any = onClick ? "button" : "div";
  const wrapperProps = onClick ? { type: "button", onClick } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={cn(
        "rounded-2xl border p-4 text-left transition-all shadow-soft",
        cls,
        onClick && "hover:-translate-y-0.5 hover:shadow-soft-lg cursor-pointer",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className={cn("h-9 w-9 rounded-xl grid place-items-center shrink-0", iconCls)}>
          {isDone ? <Check className="h-4 w-4" strokeWidth={2.25} /> : <Icon className="h-4 w-4" strokeWidth={1.75} />}
        </span>
        <span className={cn(
          "text-[28px] font-bold tabular-nums leading-none",
          tone === "primary" && "text-primary",
          tone === "warning" && "text-warning",
          tone === "muted" && "text-foreground",
          tone === "done" && "text-success",
        )}>
          {isDone ? "✓" : value}
        </span>
      </div>
      <p className={cn(
        "text-xs mt-3",
        isDone ? "text-muted-foreground" : "text-foreground font-medium",
      )}>
        {isDone ? doneLabel : label}
      </p>
      {onClick && (
        <div className="mt-1 inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
          Resolver
          <ChevronRight className="h-3 w-3" />
        </div>
      )}
    </Wrapper>
  );
}

function EmptyCard({
  icon: Icon, title, body,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
      <Icon className="h-5 w-5 text-muted-foreground/50 mx-auto mb-1.5" strokeWidth={1.5} />
      <p className="text-xs font-medium text-foreground">{title}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[320px] mx-auto">{body}</p>
    </div>
  );
}
