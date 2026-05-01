/**
 * Ventas · pipeline de ventas y reservas (Vista Promotor)
 *
 * QUÉ: panel donde el promotor gestiona el pipeline de formalización de
 * operaciones. Cada venta parte de un registro aprobado + unidad concreta y
 * avanza por cuatro estados: reservada → contratada → escriturada (o caída).
 *
 * CÓMO: dos vistas principales (Kanban por defecto, Tabla opcional), ambas
 * sobre el mismo dataset filtrado. Click en una venta abre un diálogo con
 * timeline de estado, datos cliente/unidad/agencia, historial de pagos y
 * acciones de transición.
 *
 * TODO(backend): GET /api/sales con query `promotionId[]`, `status[]`, `q`, `from`, `to`
 * TODO(backend): PATCH /api/sales/:id/transition { to: VentaEstado, meta? } → actualiza fechas
 * TODO(logic): cálculo real de comisión (base con/sin IVA, hitos parciales).
 */

import { useMemo, useState, useEffect, useRef } from "react";
import { format, parseISO, isThisMonth, subMonths, isSameMonth } from "date-fns";
import { es } from "date-fns/locale";
import {
  Search, X, Check, ChevronDown, LayoutGrid, Table2,
  FileSignature, KeyRound, XCircle, User, Home, Building2, Wallet,
  TrendingUp, TrendingDown, ArrowRight, CircleDollarSign, Calendar as CalendarIcon,
  ClipboardCheck, Hammer, Flag, CircleDot, AlertTriangle, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner"; // Toaster global en App.tsx

import {
  sales as salesMock, estadoLabel, metodoPagoLabel, getComisionImporte,
  getFechaReferencia, type Venta, type VentaEstado,
} from "@/data/sales";
import { promotions } from "@/data/promotions";
import { developerOnlyPromotions } from "@/data/developerPromotions";
import { agencies } from "@/data/agencies";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/currentUser";
import { currentOrgIdentity } from "@/lib/orgCollabRequests";
import { useVisibilityFilter, useVisibilityState } from "@/lib/visibility";
import { findTeamMember } from "@/lib/team";
import { NoAccessView } from "@/components/ui/NoAccessView";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { ViewToggle } from "@/components/ui/ViewToggle";

/* ═══════════════════════════════════════════════════════════════════
   Lookup maps + helpers de formato
   ═══════════════════════════════════════════════════════════════════ */

/** Join de todas las promociones (developer + legacy) para poder resolver nombres/ubicaciones. */
const allPromos = [
  ...developerOnlyPromotions,
  ...promotions.map(p => ({ ...p })),
];

const promoById = new Map(allPromos.map(p => [p.id, p] as const));
const agencyById = new Map(agencies.map(a => [a.id, a] as const));

function formatEur(n: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency", currency: "EUR", maximumFractionDigits: 0,
  }).format(n);
}

function formatEurShort(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M€`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}K€`;
  return `${n}€`;
}

function formatDate(iso: string | undefined, pattern: string = "d MMM yyyy") {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), pattern, { locale: es });
  } catch {
    return "—";
  }
}

/* Tokens visuales por estado (mantenemos tailwind semantic colors de design-system.md) */
const estadoStyles: Record<VentaEstado, {
  icon: LucideIcon;
  chip: string;
  dot: string;
  column: string;
  ring: string;
}> = {
  reservada: {
    icon: ClipboardCheck,
    chip: "bg-primary/10 text-primary border-primary/20",
    dot: "bg-primary",
    column: "border-primary/20 bg-primary/[0.03]",
    ring: "ring-primary/20",
  },
  contratada: {
    icon: FileSignature,
    chip: "bg-violet-500/10 text-violet-700 border-violet-500/20",
    dot: "bg-violet-500",
    column: "border-violet-500/20 bg-violet-500/[0.03]",
    ring: "ring-violet-500/20",
  },
  escriturada: {
    icon: KeyRound,
    chip: "bg-success/10 text-success border-success/20",
    dot: "bg-success",
    column: "border-success/20 bg-success/[0.03]",
    ring: "ring-success/20",
  },
  caida: {
    icon: XCircle,
    chip: "bg-destructive/10 text-destructive border-destructive/20",
    dot: "bg-destructive",
    column: "border-destructive/20 bg-destructive/[0.03]",
    ring: "ring-destructive/20",
  },
};

const ESTADOS_ORDERED: VentaEstado[] = ["reservada", "contratada", "escriturada", "caida"];

/* ═══════════════════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
   ═══════════════════════════════════════════════════════════════════ */
export default function Ventas() {
  const currentUser = useCurrentUser();
  const isAgencyUser = currentUser.accountType === "agency";

  // Estado "vivo" sobre el mock — permite simular transiciones desde el diálogo.
  // SCOPED por workspace · agencia ve solo sus propias ventas, developer
  // ve solo las ventas cuyo `promotionId` pertenece a SU workspace
  // (evita leak cross-developer · Carlos AEDAS no ve ventas de Luxinmo).
  // Member · además filtra por `audit.actor.email` (CLAUDE.md viewOwn).
  const myOrgId = currentOrgIdentity(currentUser).orgId;
  const myPromoIds = useMemo(() => new Set(
    allPromos
      .filter((p) => (p.ownerOrganizationId ?? "developer-default") === myOrgId)
      .map((p) => p.id),
  ), [myOrgId]);
  /* Visibilidad por OWNERSHIP · si el rol no tiene `sales.viewAll`,
   *  el predicado devuelto por `useVisibilityFilter` filtra por
   *  `agentName → TeamMember.id === user.id`. Admin tiene escudo en
   *  `useHasPermission`. Ortogonal al filtro org/agency-scope. */
  const visibilityFilter = useVisibilityFilter<Venta>("sales", (s) => {
    if (!s.agentName) return null;
    return findTeamMember(s.agentName)?.id ?? null;
  });

  const baseSales = useMemo(() => {
    let scoped: Venta[];
    if (isAgencyUser) {
      const byAgency = salesMock.filter((v) => v.agencyId === currentUser.agencyId);
      if (currentUser.role === "member") {
        const myEmail = currentUser.email.toLowerCase();
        scoped = byAgency.filter((v) => v.audit?.actor.email?.toLowerCase() === myEmail);
      } else {
        scoped = byAgency;
      }
    } else {
      /* Developer · solo ventas de mis promociones (workspace owner). */
      scoped = salesMock.filter((v) => v.promotionId && myPromoIds.has(v.promotionId));
    }
    return scoped.filter(visibilityFilter);
  }, [isAgencyUser, currentUser.agencyId, currentUser.role, currentUser.email, myPromoIds, visibilityFilter]);
  const [sales, setSales] = useState<Venta[]>(baseSales);
  useEffect(() => { setSales(baseSales); }, [baseSales]);
  const [viewMode, setViewMode] = useState<"kanban" | "tabla">("kanban");

  // Filtros
  const [search, setSearch] = useState("");
  const [promoFilter, setPromoFilter] = useState<string[]>([]);
  const [estadoFilter, setEstadoFilter] = useState<VentaEstado[]>([]);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Tabla: sort
  const [sortKey, setSortKey] = useState<SortKey>("fechaReserva");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Detalle (diálogo)
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(
    () => sales.find(s => s.id === selectedId) ?? null,
    [sales, selectedId],
  );

  /* ─── Opciones dinámicas de promoción (solo las que tienen ventas) ─── */
  const promotionOptions = useMemo(() => {
    const set = new Set(sales.map(s => s.promotionId));
    return Array.from(set)
      .map(id => ({ id, name: promoById.get(id)?.name ?? id }))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [sales]);

  /* ─── Filtrado ─── */
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return sales.filter(v => {
      if (q) {
        const promoName = promoById.get(v.promotionId)?.name ?? "";
        const agencyName = v.agencyId ? (agencyById.get(v.agencyId)?.name ?? "") : v.agentName;
        const hay =
          v.clienteNombre.toLowerCase().includes(q) ||
          v.unitLabel.toLowerCase().includes(q) ||
          v.unitId.toLowerCase().includes(q) ||
          agencyName.toLowerCase().includes(q) ||
          promoName.toLowerCase().includes(q);
        if (!hay) return false;
      }
      if (promoFilter.length > 0 && !promoFilter.includes(v.promotionId)) return false;
      if (estadoFilter.length > 0 && !estadoFilter.includes(v.estado)) return false;
      if (dateFrom) {
        if (getFechaReferencia(v) < dateFrom) return false;
      }
      if (dateTo) {
        if (getFechaReferencia(v) > dateTo) return false;
      }
      return true;
    });
  }, [sales, search, promoFilter, estadoFilter, dateFrom, dateTo]);

  /* ─── KPIs de cabecera ─── */
  const kpis = useMemo(() => computeKpis(sales), [sales]);

  /* ─── Transiciones (mock local) ─── */
  const transition = (id: string, to: VentaEstado) => {
    setSales(prev => prev.map(v => {
      if (v.id !== id) return v;
      const today = new Date().toISOString().slice(0, 10);
      const next: Venta = { ...v, estado: to };
      if (to === "contratada" && !next.fechaContrato) next.fechaContrato = today;
      if (to === "escriturada") {
        if (!next.fechaContrato) next.fechaContrato = today;
        if (!next.fechaEscritura) next.fechaEscritura = today;
      }
      if (to === "caida" && !next.fechaCaida) next.fechaCaida = today;
      return next;
    }));
    toast.success(`Venta marcada como ${estadoLabel[to].toLowerCase()}`, {
      description: "El cambio se refleja en el pipeline y se registrará en el historial.",
    });
  };

  const markCommissionPaid = (id: string) => {
    setSales(prev => prev.map(v => v.id === id ? { ...v, comisionPagada: true } : v));
    toast.success("Comisión marcada como pagada");
  };

  /* ─── Active filter count ─── */
  const activeFilterCount =
    (promoFilter.length > 0 ? 1 : 0) +
    (estadoFilter.length > 0 ? 1 : 0) +
    (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  const clearAll = () => {
    setSearch("");
    setPromoFilter([]);
    setEstadoFilter([]);
    setDateFrom("");
    setDateTo("");
  };

  /* ─── Total del mes (para subtítulo del header) ─── */
  const revenueMesActual = useMemo(() => {
    return sales
      .filter(v => v.estado === "escriturada" && v.fechaEscritura && isThisMonth(parseISO(v.fechaEscritura)))
      .reduce((s, v) => s + v.precioFinal, 0);
  }, [sales]);

  /* Sin permiso `sales.viewAll` ni `sales.viewOwn` · placeholder amigable.
   *  El admin queda fuera de este branch por escudo en `useHasPermission`. */
  const { hasAccess } = useVisibilityState("sales");
  if (!hasAccess) {
    return (
      <div className="flex-1 grid place-items-center p-8">
        <NoAccessView feature="Ventas" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-background">

      {/* ═══════════ HEADER ═══════════ */}
      <div className="px-3 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-3">
        <div className="max-w-content mx-auto flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
            <div className="shrink-0 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground leading-none">
                Comercial
              </p>
              <h1 className="text-[19px] sm:text-[22px] font-bold tracking-tight leading-tight mt-1">
                Ventas
              </h1>
              <p className="text-xs text-muted-foreground mt-1.5">
                <span className="font-semibold text-foreground tnum">{sales.length}</span> operaciones ·
                <span className="ml-1 tnum font-semibold text-success">{formatEur(revenueMesActual)}</span>{" "}
                escrituradas este mes
              </p>
            </div>

            {/* Toggle Kanban / Tabla */}
            <ViewToggle
              className="sm:ml-auto self-start sm:self-end"
              value={viewMode}
              onChange={setViewMode}
              options={[
                { value: "kanban", icon: LayoutGrid, label: "Kanban" },
                { value: "tabla",  icon: Table2,     label: "Tabla" },
              ]}
            />
          </div>
        </div>
      </div>

      <div className="h-px bg-border/60" />

      {/* ═══════════ KPIs ═══════════ */}
      <div className="px-3 sm:px-6 lg:px-8 pt-4 sm:pt-5">
        <div className="max-w-content mx-auto grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <KpiCard
            icon={ClipboardCheck}
            label="Reservas activas"
            value={String(kpis.reservasActivasCount)}
            delta={kpis.reservasActivasDelta}
            sub={`${formatEurShort(kpis.reservasActivasMonto)} en señales`}
            iconTone="bg-primary/10"
            iconColor="text-primary"
          />
          <KpiCard
            icon={FileSignature}
            label="Contratos del mes"
            value={formatEurShort(kpis.contratadoMes)}
            delta={kpis.contratadoDelta}
            sub={`${kpis.contratadoCount} operaciones`}
            iconTone="bg-violet-500/10"
            iconColor="text-violet-600"
          />
          <KpiCard
            icon={KeyRound}
            label="Escrituradas del mes"
            value={formatEurShort(kpis.escrituradoMes)}
            delta={kpis.escrituradoDelta}
            sub={`${kpis.escrituradoCount} entregas`}
            iconTone="bg-success/10"
            iconColor="text-success"
          />
          <KpiCard
            icon={Wallet}
            label="Comisiones pendientes"
            value={formatEurShort(kpis.comisionPendiente)}
            delta={kpis.comisionPagadaCount > 0 ? `${kpis.comisionPagadaCount} al día` : undefined}
            deltaTone="neutral"
            sub={`${kpis.comisionPendienteCount} por liquidar`}
            iconTone="bg-warning/10"
            iconColor="text-warning"
          />
        </div>
      </div>

      {/* ═══════════ FILTER BAR ═══════════ */}
      <div className="px-3 sm:px-6 lg:px-8 pt-4 sm:pt-5 pb-2">
        <div className="max-w-content mx-auto flex items-center flex-wrap gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 z-10" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente, unidad, agencia o promoción..."
              className="w-full h-9 pl-9 pr-9 text-sm bg-card border border-border rounded-full focus:border-primary outline-none transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Promoción (multi) */}
          <MultiFilterPill
            label="Promoción"
            options={promotionOptions.map(p => ({ value: p.id, label: p.name }))}
            values={promoFilter}
            onChange={setPromoFilter}
          />

          {/* Estado (multi) */}
          <MultiFilterPill
            label="Estado"
            options={ESTADOS_ORDERED.map(e => ({ value: e, label: estadoLabel[e] }))}
            values={estadoFilter}
            onChange={(v) => setEstadoFilter(v as VentaEstado[])}
          />

          {/* Rango fechas */}
          <DateRangePill
            from={dateFrom}
            to={dateTo}
            onChange={(f, t) => { setDateFrom(f); setDateTo(t); }}
          />

          {activeFilterCount > 0 && (
            <button
              onClick={clearAll}
              className="text-xs font-medium text-muted-foreground hover:text-destructive transition-colors px-2 h-8"
            >
              Limpiar ({activeFilterCount})
            </button>
          )}

          <span className="text-xs text-muted-foreground ml-auto tnum">
            <span className="font-semibold text-foreground">{filtered.length}</span> resultados
          </span>
        </div>
      </div>

      {/* ═══════════ CONTENT ═══════════ */}
      <div className="flex-1 px-3 sm:px-6 lg:px-8 pb-8 pt-2">
        <div className="max-w-content mx-auto">
          {filtered.length === 0 ? (
            <EmptyState onReset={clearAll} />
          ) : viewMode === "kanban" ? (
            <KanbanBoard
              sales={filtered}
              onSelect={setSelectedId}
            />
          ) : (
            <TablaVentas
              sales={filtered}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={(k) => {
                if (k === sortKey) setSortDir(d => d === "asc" ? "desc" : "asc");
                else { setSortKey(k); setSortDir("desc"); }
              }}
              onSelect={setSelectedId}
            />
          )}
        </div>
      </div>

      {/* ═══════════ DETALLE (DIALOG) ═══════════ */}
      <VentaDetalleDialog
        venta={selected}
        open={selected !== null}
        onClose={() => setSelectedId(null)}
        onTransition={transition}
        onMarkCommissionPaid={markCommissionPaid}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   KPIs
   ═══════════════════════════════════════════════════════════════════ */
type Kpis = {
  reservasActivasCount: number;
  reservasActivasMonto: number;
  reservasActivasDelta?: string;
  contratadoMes: number;
  contratadoCount: number;
  contratadoDelta?: string;
  escrituradoMes: number;
  escrituradoCount: number;
  escrituradoDelta?: string;
  comisionPendiente: number;
  comisionPendienteCount: number;
  comisionPagadaCount: number;
};

function computeKpis(sales: Venta[]): Kpis {
  const now = new Date();
  const prevMonth = subMonths(now, 1);

  const reservasActivas = sales.filter(v => v.estado === "reservada");
  const reservasActivasMonto = reservasActivas.reduce((s, v) => s + v.precioReserva, 0);

  const contratadasMes = sales.filter(v =>
    v.estado === "contratada" && v.fechaContrato && isSameMonth(parseISO(v.fechaContrato), now),
  );
  const contratadasPrev = sales.filter(v =>
    v.fechaContrato && isSameMonth(parseISO(v.fechaContrato), prevMonth) &&
    (v.estado === "contratada" || v.estado === "escriturada"),
  );
  const contratadoMes = contratadasMes.reduce((s, v) => s + v.precioFinal, 0);
  const contratadoPrev = contratadasPrev.reduce((s, v) => s + v.precioFinal, 0);

  const escrituradasMes = sales.filter(v =>
    v.estado === "escriturada" && v.fechaEscritura && isSameMonth(parseISO(v.fechaEscritura), now),
  );
  const escrituradasPrev = sales.filter(v =>
    v.estado === "escriturada" && v.fechaEscritura && isSameMonth(parseISO(v.fechaEscritura), prevMonth),
  );
  const escrituradoMes = escrituradasMes.reduce((s, v) => s + v.precioFinal, 0);
  const escrituradoPrev = escrituradasPrev.reduce((s, v) => s + v.precioFinal, 0);

  const comPendiente = sales
    .filter(v => !v.comisionPagada && v.comisionPct > 0 && (v.estado === "contratada" || v.estado === "escriturada"))
    .reduce((s, v) => s + getComisionImporte(v), 0);
  const comPendienteCount = sales.filter(v => !v.comisionPagada && v.comisionPct > 0 && (v.estado === "contratada" || v.estado === "escriturada")).length;
  const comPagadaCount = sales.filter(v => v.comisionPagada && v.comisionPct > 0 && v.estado === "escriturada").length;

  return {
    reservasActivasCount: reservasActivas.length,
    reservasActivasMonto,
    reservasActivasDelta: undefined,
    contratadoMes,
    contratadoCount: contratadasMes.length,
    contratadoDelta: deltaLabel(contratadoMes, contratadoPrev),
    escrituradoMes,
    escrituradoCount: escrituradasMes.length,
    escrituradoDelta: deltaLabel(escrituradoMes, escrituradoPrev),
    comisionPendiente: comPendiente,
    comisionPendienteCount: comPendienteCount,
    comisionPagadaCount: comPagadaCount,
  };
}

function deltaLabel(curr: number, prev: number): string | undefined {
  if (prev <= 0) return curr > 0 ? "Nuevo" : undefined;
  const diff = ((curr - prev) / prev) * 100;
  if (Math.abs(diff) < 1) return undefined;
  const sign = diff > 0 ? "+" : "";
  return `${sign}${diff.toFixed(0)}%`;
}

/* ═══════════════════════════════════════════════════════════════════
   KPI CARD
   ═══════════════════════════════════════════════════════════════════ */
function KpiCard({
  icon: Icon, label, value, delta, deltaTone = "positive", sub, iconTone, iconColor,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  delta?: string;
  deltaTone?: "positive" | "negative" | "neutral";
  sub?: string;
  iconTone: string;
  iconColor: string;
}) {
  const resolvedTone = deltaTone === "positive" && delta?.startsWith("-") ? "negative" : deltaTone;
  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between mb-3.5">
        <div className={cn("h-9 w-9 rounded-xl grid place-items-center shrink-0", iconTone)}>
          <Icon className={cn("h-4 w-4", iconColor)} />
        </div>
        {delta && (
          <span className={cn(
            "text-[11px] font-semibold tabular-nums inline-flex items-center gap-0.5",
            resolvedTone === "positive" && "text-success",
            resolvedTone === "negative" && "text-destructive",
            resolvedTone === "neutral" && "text-muted-foreground",
          )}>
            {resolvedTone === "positive" && <TrendingUp className="h-3 w-3" />}
            {resolvedTone === "negative" && <TrendingDown className="h-3 w-3" />}
            {delta}
          </span>
        )}
      </div>
      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</p>
      <p className="text-[22px] sm:text-[26px] font-bold leading-none tabular-nums tracking-tight mt-1.5">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-2 tnum">{sub}</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MultiFilterPill · botón pill con dropdown de opciones multi-select.
   Fondo bg-foreground cuando hay selección (patrón Byvaro).
   ═══════════════════════════════════════════════════════════════════ */
function MultiFilterPill({
  label, options, values, onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const active = values.length > 0;
  const toggle = (v: string) => {
    onChange(values.includes(v) ? values.filter(x => x !== v) : [...values, v]);
  };

  const summary = active
    ? values.length === 1
      ? (options.find(o => o.value === values[0])?.label ?? label)
      : `${label} · ${values.length}`
    : label;

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border text-[12.5px] font-medium transition-colors",
          active
            ? "bg-foreground text-background border-foreground"
            : "bg-card border-border text-foreground hover:border-foreground/30",
        )}
      >
        <span className="truncate max-w-[160px]">{summary}</span>
        <ChevronDown className={cn("h-3 w-3 opacity-70 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 bg-popover border border-border rounded-xl shadow-soft-lg z-30 min-w-[240px] p-1.5 max-h-[300px] overflow-y-auto">
          {options.length === 0 ? (
            <p className="text-[12px] text-muted-foreground italic px-3 py-2">Sin opciones</p>
          ) : (
            options.map(opt => {
              const selected = values.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  onClick={() => toggle(opt.value)}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors text-left",
                    selected ? "bg-muted/70 text-foreground" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {selected && <Check className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />}
                </button>
              );
            })
          )}
          {values.length > 0 && (
            <>
              <div className="h-px bg-border/60 my-1" />
              <button
                onClick={() => onChange([])}
                className="w-full text-left text-[12px] text-muted-foreground hover:text-destructive px-2.5 py-1.5 rounded-lg transition-colors"
              >
                Limpiar selección
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   DateRangePill · rango de fechas con inputs date nativos
   ═══════════════════════════════════════════════════════════════════ */
function DateRangePill({
  from, to, onChange,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const active = Boolean(from || to);
  const summary = active
    ? [from && formatDate(from, "d MMM"), to && formatDate(to, "d MMM")].filter(Boolean).join(" – ")
    : "Fechas";

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border text-[12.5px] font-medium transition-colors",
          active
            ? "bg-foreground text-background border-foreground"
            : "bg-card border-border text-foreground hover:border-foreground/30",
        )}
      >
        <CalendarIcon className="h-3.5 w-3.5" />
        <span className="truncate max-w-[200px]">{summary}</span>
        <ChevronDown className={cn("h-3 w-3 opacity-70 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 bg-popover border border-border rounded-xl shadow-soft-lg z-30 w-[280px] p-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                Desde
              </label>
              <input
                type="date"
                value={from}
                onChange={(e) => onChange(e.target.value, to)}
                className="w-full h-9 px-2.5 text-sm bg-card border border-border rounded-lg focus:border-primary outline-none transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                Hasta
              </label>
              <input
                type="date"
                value={to}
                onChange={(e) => onChange(from, e.target.value)}
                className="w-full h-9 px-2.5 text-sm bg-card border border-border rounded-lg focus:border-primary outline-none transition-colors"
              />
            </div>
          </div>
          {active && (
            <button
              onClick={() => onChange("", "")}
              className="mt-3 w-full h-8 rounded-lg text-[12px] font-medium text-muted-foreground hover:bg-muted/40 hover:text-destructive transition-colors"
            >
              Limpiar rango
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   KANBAN (4 columnas) — en móvil cae a secciones colapsables
   ═══════════════════════════════════════════════════════════════════ */
function KanbanBoard({
  sales, onSelect,
}: { sales: Venta[]; onSelect: (id: string) => void }) {
  // Agrupa por estado, preserva orden
  const grouped = useMemo(() => {
    const byEstado: Record<VentaEstado, Venta[]> = {
      reservada: [], contratada: [], escriturada: [], caida: [],
    };
    sales.forEach(v => { byEstado[v.estado].push(v); });
    // Ordena cada columna por fecha de referencia desc
    ESTADOS_ORDERED.forEach(e => {
      byEstado[e].sort((a, b) => getFechaReferencia(b).localeCompare(getFechaReferencia(a)));
    });
    return byEstado;
  }, [sales]);

  return (
    <>
      {/* Mobile / tablet: secciones colapsables apiladas */}
      <div className="lg:hidden flex flex-col gap-4">
        {ESTADOS_ORDERED.map(e => (
          <MobileKanbanSection
            key={e}
            estado={e}
            items={grouped[e]}
            onSelect={onSelect}
          />
        ))}
      </div>

      {/* Desktop: 4 columnas en grid */}
      <div className="hidden lg:grid grid-cols-4 gap-4">
        {ESTADOS_ORDERED.map(e => (
          <KanbanColumn
            key={e}
            estado={e}
            items={grouped[e]}
            onSelect={onSelect}
          />
        ))}
      </div>
    </>
  );
}

function KanbanColumn({
  estado, items, onSelect,
}: {
  estado: VentaEstado;
  items: Venta[];
  onSelect: (id: string) => void;
}) {
  const style = estadoStyles[estado];
  const Icon = style.icon;
  const totalValor = items.reduce((s, v) => s + v.precioFinal, 0);

  return (
    <div className={cn("rounded-2xl border bg-card shadow-soft flex flex-col overflow-hidden", style.column)}>
      {/* Header de columna */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className={cn("h-6 w-6 rounded-lg grid place-items-center", style.chip.split(" ").slice(0, 1).join(" "))}>
              <Icon className={cn("h-3.5 w-3.5", style.chip.split(" ").find(c => c.startsWith("text-")) ?? "")} />
            </div>
            <h3 className="text-[13px] font-semibold text-foreground">{estadoLabel[estado]}</h3>
            <span className="text-[11px] font-semibold text-muted-foreground tnum">{items.length}</span>
          </div>
          <p className="text-[11px] text-muted-foreground tnum">{formatEurShort(totalValor)} en cartera</p>
        </div>
      </div>
      <div className="h-px bg-border/60 mx-4" />
      {/* Items */}
      <div className="flex-1 px-3 py-3 flex flex-col gap-2 min-h-[120px] max-h-[calc(100vh-420px)] overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex-1 grid place-items-center text-center py-8">
            <div>
              <CircleDot className="h-4 w-4 text-muted-foreground/40 mx-auto mb-1.5" />
              <p className="text-[11.5px] text-muted-foreground">Sin operaciones</p>
            </div>
          </div>
        ) : (
          items.map(v => <KanbanCard key={v.id} venta={v} onSelect={onSelect} />)
        )}
      </div>
    </div>
  );
}

function MobileKanbanSection({
  estado, items, onSelect,
}: {
  estado: VentaEstado;
  items: Venta[];
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const style = estadoStyles[estado];
  const Icon = style.icon;
  const totalValor = items.reduce((s, v) => s + v.precioFinal, 0);

  return (
    <div className={cn("rounded-2xl border bg-card shadow-soft overflow-hidden", style.column)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn("h-7 w-7 rounded-lg grid place-items-center", style.chip.split(" ").slice(0, 1).join(" "))}>
            <Icon className={cn("h-4 w-4", style.chip.split(" ").find(c => c.startsWith("text-")) ?? "")} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-foreground">{estadoLabel[estado]}</p>
            <p className="text-[11px] text-muted-foreground tnum">
              {items.length} operaciones · {formatEurShort(totalValor)}
            </p>
          </div>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-border/60 px-3 py-3 flex flex-col gap-2">
          {items.length === 0 ? (
            <p className="text-[11.5px] text-muted-foreground italic text-center py-4">Sin operaciones</p>
          ) : (
            items.map(v => <KanbanCard key={v.id} venta={v} onSelect={onSelect} />)
          )}
        </div>
      )}
    </div>
  );
}

/** Card compacta del kanban. `hover:-translate-y-0.5` simula draggable sin drag real. */
function KanbanCard({
  venta: v, onSelect,
}: { venta: Venta; onSelect: (id: string) => void }) {
  const promo = promoById.get(v.promotionId);
  const agency = v.agencyId ? agencyById.get(v.agencyId) : null;
  return (
    <button
      type="button"
      onClick={() => onSelect(v.id)}
      className="group text-left bg-background border border-border rounded-xl p-3 shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 cursor-pointer"
      aria-label={`Abrir detalle de venta de ${v.clienteNombre}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-[13px] font-semibold text-foreground truncate">{v.clienteNombre}</p>
        <p className="text-[13px] font-bold text-foreground tnum shrink-0">{formatEurShort(v.precioFinal)}</p>
      </div>
      <p className="text-[11.5px] text-muted-foreground truncate mb-2">
        {promo?.name ?? "—"} · {v.unitLabel}
      </p>
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="truncate max-w-[60%]">
          {agency ? agency.name : v.agentName}
        </span>
        <span className="tnum shrink-0">{formatDate(getFechaReferencia(v), "d MMM")}</span>
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TABLA (sortable)
   ═══════════════════════════════════════════════════════════════════ */
type SortKey =
  | "clienteNombre"
  | "promotionId"
  | "unitLabel"
  | "agencyId"
  | "estado"
  | "fechaReserva"
  | "precioFinal"
  | "comision";

function TablaVentas({
  sales, sortKey, sortDir, onSort, onSelect,
}: {
  sales: Venta[];
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  onSelect: (id: string) => void;
}) {
  const sorted = useMemo(() => {
    const arr = [...sales];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      const va = sortValue(a, sortKey);
      const vb = sortValue(b, sortKey);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb), "es") * dir;
    });
    return arr;
  }, [sales, sortKey, sortDir]);

  return (
    <div className="bg-card border border-border rounded-2xl shadow-soft overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/30">
              <Th label="Cliente" k="clienteNombre" currentKey={sortKey} dir={sortDir} onSort={onSort} />
              <Th label="Promoción" k="promotionId" currentKey={sortKey} dir={sortDir} onSort={onSort} />
              <Th label="Unidad" k="unitLabel" currentKey={sortKey} dir={sortDir} onSort={onSort} />
              <Th label="Agencia" k="agencyId" currentKey={sortKey} dir={sortDir} onSort={onSort} />
              <Th label="Estado" k="estado" currentKey={sortKey} dir={sortDir} onSort={onSort} />
              <Th label="Fecha" k="fechaReserva" currentKey={sortKey} dir={sortDir} onSort={onSort} />
              <Th label="Precio" k="precioFinal" currentKey={sortKey} dir={sortDir} onSort={onSort} right />
              <Th label="Comisión" k="comision" currentKey={sortKey} dir={sortDir} onSort={onSort} right />
            </tr>
          </thead>
          <tbody>
            {sorted.map(v => {
              const promo = promoById.get(v.promotionId);
              const agency = v.agencyId ? agencyById.get(v.agencyId) : null;
              const style = estadoStyles[v.estado];
              return (
                <tr
                  key={v.id}
                  onClick={() => onSelect(v.id)}
                  className="border-b border-border/40 last:border-b-0 hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold text-foreground text-[13px] truncate max-w-[180px]">{v.clienteNombre}</p>
                    <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                      {v.clienteNacionalidad ?? "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-[13px] text-foreground truncate max-w-[160px]">{promo?.name ?? "—"}</p>
                    <p className="text-[11px] text-muted-foreground truncate max-w-[160px]">{promo?.location ?? ""}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-[12.5px] text-foreground truncate max-w-[200px]">{v.unitLabel}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-[12.5px] text-foreground truncate max-w-[160px]">
                      {agency ? agency.name : <span className="text-muted-foreground italic">Directa</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate max-w-[160px]">{v.agentName}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border text-[11px] font-semibold",
                      style.chip,
                    )}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", style.dot)} />
                      {estadoLabel[v.estado]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12.5px] text-muted-foreground tnum whitespace-nowrap">
                    {formatDate(getFechaReferencia(v), "d MMM yyyy")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="font-bold text-foreground tnum whitespace-nowrap">{formatEur(v.precioFinal)}</p>
                    {v.descuentoAplicado ? (
                      <p className="text-[10.5px] text-muted-foreground tnum">−{formatEur(v.descuentoAplicado)} desc.</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {v.comisionPct > 0 ? (
                      <>
                        <p className="font-semibold text-foreground tnum whitespace-nowrap">
                          {formatEur(getComisionImporte(v))}
                        </p>
                        <p className={cn(
                          "text-[10.5px] tnum",
                          v.comisionPagada ? "text-success" : "text-warning",
                        )}>
                          {v.comisionPct}% · {v.comisionPagada ? "Pagada" : "Pendiente"}
                        </p>
                      </>
                    ) : (
                      <span className="text-[11px] text-muted-foreground italic">Sin agencia</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function sortValue(v: Venta, k: SortKey): string | number {
  switch (k) {
    case "clienteNombre": return v.clienteNombre;
    case "promotionId": return promoById.get(v.promotionId)?.name ?? v.promotionId;
    case "unitLabel": return v.unitLabel;
    case "agencyId": return v.agencyId ? (agencyById.get(v.agencyId)?.name ?? "") : "~Directa";
    case "estado": return ESTADOS_ORDERED.indexOf(v.estado);
    case "fechaReserva": return getFechaReferencia(v);
    case "precioFinal": return v.precioFinal;
    case "comision": return getComisionImporte(v);
  }
}

function Th({
  label, k, currentKey, dir, onSort, right,
}: {
  label: string;
  k: SortKey;
  currentKey: SortKey;
  dir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  right?: boolean;
}) {
  const active = currentKey === k;
  return (
    <th
      className={cn(
        "px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground",
        right ? "text-right" : "text-left",
      )}
    >
      <button
        onClick={() => onSort(k)}
        className={cn(
          "inline-flex items-center gap-1 transition-colors hover:text-foreground",
          active && "text-foreground",
          right && "flex-row-reverse",
        )}
      >
        {label}
        <ChevronDown className={cn(
          "h-3 w-3 transition-all",
          !active && "opacity-30",
          active && dir === "asc" && "rotate-180",
        )} />
      </button>
    </th>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   DIALOG DE DETALLE
   ═══════════════════════════════════════════════════════════════════ */
function VentaDetalleDialog({
  venta, open, onClose, onTransition, onMarkCommissionPaid,
}: {
  venta: Venta | null;
  open: boolean;
  onClose: () => void;
  onTransition: (id: string, to: VentaEstado) => void;
  onMarkCommissionPaid: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">
        {venta ? (
          <VentaDetalleContent
            venta={venta}
            onTransition={onTransition}
            onMarkCommissionPaid={onMarkCommissionPaid}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function VentaDetalleContent({
  venta, onTransition, onMarkCommissionPaid,
}: {
  venta: Venta;
  onTransition: (id: string, to: VentaEstado) => void;
  onMarkCommissionPaid: (id: string) => void;
}) {
  const promo = promoById.get(venta.promotionId);
  const agency = venta.agencyId ? agencyById.get(venta.agencyId) : null;
  const style = estadoStyles[venta.estado];
  const Icon = style.icon;
  const comisionImporte = getComisionImporte(venta);

  const canContratar = venta.estado === "reservada";
  const canEscriturar = venta.estado === "reservada" || venta.estado === "contratada";
  const canCaer = venta.estado === "reservada" || venta.estado === "contratada";

  return (
    <>
      {/* Header del diálogo */}
      <DialogHeader className="p-5 sm:p-6 pb-4 border-b border-border/60 bg-muted/20">
        <div className="flex items-start gap-3">
          <div className={cn("h-10 w-10 rounded-xl grid place-items-center shrink-0", style.chip.split(" ").slice(0, 1).join(" "))}>
            <Icon className={cn("h-5 w-5", style.chip.split(" ").find(c => c.startsWith("text-")) ?? "")} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <DialogTitle className="text-[17px] truncate">{venta.clienteNombre}</DialogTitle>
              <span className={cn(
                "inline-flex items-center gap-1.5 h-5 px-2 rounded-full border text-[10.5px] font-semibold",
                style.chip,
              )}>
                <span className={cn("h-1 w-1 rounded-full", style.dot)} />
                {estadoLabel[venta.estado]}
              </span>
            </div>
            <DialogDescription className="text-[12.5px] mt-1">
              {promo?.name ?? "—"} · {venta.unitLabel}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      {/* Body scrollable */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-5 sm:p-6 space-y-5">

          {/* Summary chips (importe + comisión + método pago) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <SummaryBox
              label="Precio final"
              value={formatEur(venta.precioFinal)}
              sub={
                venta.descuentoAplicado
                  ? `Listado ${formatEur(venta.precioListado)} · −${formatEur(venta.descuentoAplicado)}`
                  : `Listado ${formatEur(venta.precioListado)}`
              }
            />
            <SummaryBox
              label="Comisión"
              value={venta.comisionPct > 0 ? formatEur(comisionImporte) : "—"}
              sub={
                venta.comisionPct > 0
                  ? `${venta.comisionPct}% · ${venta.comisionPagada ? "Pagada" : "Pendiente"}`
                  : "Venta directa"
              }
              valueTone={venta.comisionPct > 0 && !venta.comisionPagada ? "amber" : "default"}
            />
            <SummaryBox
              label="Método de pago"
              value={metodoPagoLabel[venta.metodoPago]}
              sub={`Reserva ${formatEur(venta.precioReserva)}`}
            />
          </div>

          {/* Timeline de estado */}
          <Section icon={Flag} title="Timeline">
            <Timeline venta={venta} />
          </Section>

          {/* Datos del cliente */}
          <Section icon={User} title="Cliente">
            <InfoGrid>
              <InfoItem label="Nombre" value={venta.clienteNombre} />
              <InfoItem label="Email" value={venta.clienteEmail ?? "—"} />
              <InfoItem label="Teléfono" value={venta.clienteTelefono ?? "—"} />
              <InfoItem label="Nacionalidad" value={venta.clienteNacionalidad ?? "—"} />
            </InfoGrid>
          </Section>

          {/* Datos de la unidad */}
          <Section icon={Home} title="Unidad">
            <InfoGrid>
              <InfoItem label="Promoción" value={promo?.name ?? "—"} />
              <InfoItem label="Ubicación" value={promo?.location ?? "—"} />
              <InfoItem label="Identificador" value={venta.unitLabel} />
              <InfoItem label="Código" value={promo?.code ?? "—"} mono />
            </InfoGrid>
          </Section>

          {/* Datos de la agencia */}
          <Section icon={Building2} title="Agencia">
            <div className="rounded-xl border border-border bg-muted/20 p-3.5">
              {agency ? (
                <>
                  <div className="flex items-center gap-2.5 mb-2.5">
                    {agency.logo && (
                      <img src={agency.logo} alt="" className="h-9 w-9 rounded-full bg-white shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold text-foreground truncate">{agency.name}</p>
                      <p className="text-[11.5px] text-muted-foreground truncate">{agency.location}</p>
                    </div>
                  </div>
                  <InfoGrid cols={2}>
                    <InfoItem label="Agente" value={venta.agentName} />
                    <InfoItem label="Tipo" value={agency.type} />
                  </InfoGrid>
                </>
              ) : (
                <>
                  <p className="text-[13px] font-semibold text-foreground">Venta directa</p>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5">
                    Sin intermediación de agencia.
                  </p>
                  <div className="mt-2">
                    <InfoItem label="Responsable" value={venta.agentName} />
                  </div>
                </>
              )}
            </div>
          </Section>

          {/* Historial de pagos */}
          <Section icon={Wallet} title="Historial de pagos">
            {venta.pagos.length === 0 ? (
              <p className="text-[12.5px] text-muted-foreground italic">Sin pagos registrados.</p>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                {venta.pagos.map((p, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center justify-between gap-3 px-3.5 py-2.5",
                      i < venta.pagos.length - 1 && "border-b border-border/60",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-medium text-foreground truncate">{p.concepto}</p>
                      <p className="text-[11px] text-muted-foreground tnum">{formatDate(p.fecha)}</p>
                    </div>
                    <p className={cn(
                      "text-[13px] font-semibold tnum shrink-0",
                      p.importe < 0 ? "text-destructive" : "text-foreground",
                    )}>
                      {p.importe < 0 ? "−" : ""}{formatEur(Math.abs(p.importe))}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Siguiente paso */}
          {venta.siguientePaso && venta.estado !== "caida" && (
            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-primary/5 border border-primary/20">
              <Hammer className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold text-primary">Siguiente paso</p>
                <p className="text-[12.5px] text-foreground">
                  {venta.siguientePaso}
                  {venta.siguientePasoFecha ? (
                    <span className="text-muted-foreground"> · {formatDate(venta.siguientePasoFecha)}</span>
                  ) : null}
                </p>
              </div>
            </div>
          )}

          {/* Nota */}
          {venta.nota && (
            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-muted/40 border border-border">
              <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-[12.5px] text-foreground leading-snug">{venta.nota}</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer con acciones */}
      <div className="shrink-0 border-t border-border bg-card p-4 sm:p-5 flex flex-wrap items-center gap-2">
        {canContratar && (
          <ActionBtn
            onClick={() => onTransition(venta.id, "contratada")}
            icon={FileSignature}
            label="Marcar contrato"
            variant="primary"
          />
        )}
        {canEscriturar && (
          <ActionBtn
            onClick={() => onTransition(venta.id, "escriturada")}
            icon={KeyRound}
            label="Marcar escritura"
            variant="success"
          />
        )}
        {canCaer && (
          <ActionBtn
            onClick={() => onTransition(venta.id, "caida")}
            icon={XCircle}
            label="Marcar caída"
            variant="destructive"
          />
        )}
        {venta.comisionPct > 0 && !venta.comisionPagada && (
          <ActionBtn
            onClick={() => onMarkCommissionPaid(venta.id)}
            icon={Check}
            label="Comisión pagada"
            variant="secondary"
          />
        )}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Timeline (dentro del diálogo)
   ═══════════════════════════════════════════════════════════════════ */
function Timeline({ venta }: { venta: Venta }) {
  // Pasos estándar: Reserva → Contrato → Escritura. La caída es exit point.
  const steps: Array<{
    key: VentaEstado | "reserved";
    label: string;
    date: string | undefined;
    reached: boolean;
  }> = [
    { key: "reserved", label: "Reserva firmada", date: venta.fechaReserva, reached: true },
    {
      key: "contratada",
      label: "Contrato privado",
      date: venta.fechaContrato,
      reached: venta.estado === "contratada" || venta.estado === "escriturada",
    },
    {
      key: "escriturada",
      label: "Escritura pública",
      date: venta.fechaEscritura,
      reached: venta.estado === "escriturada",
    },
  ];

  const caida = venta.estado === "caida";

  return (
    <div className="rounded-xl border border-border bg-muted/20 px-4 py-4">
      <div className="relative">
        {steps.map((s, i) => (
          <div key={s.key} className="relative flex items-start gap-3 pb-4 last:pb-0">
            {/* Conector vertical */}
            {i < steps.length - 1 && (
              <span
                className={cn(
                  "absolute left-[11px] top-6 bottom-0 w-px",
                  steps[i + 1].reached ? "bg-foreground/20" : "bg-border",
                )}
              />
            )}
            {/* Dot */}
            <span className={cn(
              "relative h-[22px] w-[22px] rounded-full grid place-items-center shrink-0",
              s.reached
                ? i === steps.length - 1 && !caida
                  ? "bg-success/15 text-success border border-success/30"
                  : "bg-primary/15 text-primary border border-primary/30"
                : "bg-muted text-muted-foreground border border-border",
            )}>
              {s.reached ? <Check className="h-3 w-3" strokeWidth={3} /> : <CircleDot className="h-2.5 w-2.5" />}
            </span>
            <div className="min-w-0 pt-0.5 flex-1">
              <p className={cn(
                "text-[12.5px] font-semibold",
                s.reached ? "text-foreground" : "text-muted-foreground",
              )}>
                {s.label}
              </p>
              <p className="text-[11px] text-muted-foreground tnum">{formatDate(s.date)}</p>
            </div>
          </div>
        ))}
        {/* Caída — slot aparte */}
        {caida && (
          <div className="mt-2 pt-3 border-t border-destructive/20 flex items-start gap-3">
            <span className="h-[22px] w-[22px] rounded-full grid place-items-center bg-destructive/15 border border-destructive/30 text-destructive shrink-0">
              <XCircle className="h-3 w-3" strokeWidth={2.5} />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-[12.5px] font-semibold text-destructive">Operación caída</p>
              <p className="text-[11px] text-muted-foreground tnum">{formatDate(venta.fechaCaida)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Sub-componentes del diálogo
   ═══════════════════════════════════════════════════════════════════ */
function Section({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-[10px] uppercase tracking-[0.14em] font-semibold text-muted-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function SummaryBox({
  label, value, sub, valueTone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  valueTone?: "default" | "amber";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</p>
      <p className={cn(
        "text-[15px] font-bold tnum mt-1",
        valueTone === "amber" ? "text-warning" : "text-foreground",
      )}>
        {value}
      </p>
      {sub && <p className="text-[10.5px] text-muted-foreground tnum mt-0.5">{sub}</p>}
    </div>
  );
}

function InfoGrid({ children, cols = 2 }: { children: React.ReactNode; cols?: 1 | 2 }) {
  return (
    <div className={cn("grid gap-x-4 gap-y-2", cols === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
      {children}
    </div>
  );
}

function InfoItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10.5px] uppercase tracking-wider font-semibold text-muted-foreground mb-0.5">{label}</p>
      <p className={cn("text-[12.5px] text-foreground break-words", mono && "font-mono tnum")}>{value}</p>
    </div>
  );
}

function ActionBtn({
  onClick, icon: Icon, label, variant,
}: {
  onClick: () => void;
  icon: LucideIcon;
  label: string;
  variant: "primary" | "secondary" | "success" | "destructive";
}) {
  const cls = {
    primary: "bg-foreground text-background hover:bg-foreground/90 shadow-soft",
    secondary: "bg-card border border-border text-foreground hover:bg-muted",
    success: "bg-success text-white hover:bg-success/90 shadow-soft",
    destructive: "bg-destructive/10 border border-destructive/30 text-destructive hover:bg-destructive/15",
  }[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-sm font-medium transition-colors",
        cls,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Empty state
   ═══════════════════════════════════════════════════════════════════ */
function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="py-16 text-center">
      <div className="h-12 w-12 rounded-2xl bg-muted grid place-items-center mx-auto mb-4">
        <CircleDollarSign className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">Sin operaciones</h3>
      <p className="text-[12.5px] text-muted-foreground mt-1 max-w-sm mx-auto">
        No hay ventas que coincidan con los filtros actuales. Ajusta los criterios o limpia los filtros para ver todas las operaciones.
      </p>
      <button
        onClick={onReset}
        className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
      >
        Limpiar filtros
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
