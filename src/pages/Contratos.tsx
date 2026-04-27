/**
 * Pantalla · Contratos de colaboración (`/contratos`)
 *
 * Listado global de TODOS los contratos de colaboración cruzando
 * todas las agencias · la forma rápida de ver qué contratos hay
 * firmados, cuáles están pendientes, cuáles vencen pronto, sin
 * tener que entrar a cada agencia.
 *
 * · KPIs arriba (total · firmados · pendientes · por vencer).
 * · Filtros: búsqueda, estado, agencia.
 * · Lista cliqueable · abre `ContractDetailDialog` con el detalle.
 * · Click en la agencia de la fila · abre panel de colaboración.
 *
 * Permiso · requiere `collaboration.contracts.view`.
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileSignature, Search, X, Clock, AlertTriangle,
  Filter, Shield, Check, ChevronDown,
} from "lucide-react";
import { PdfIcon } from "@/components/icons/PdfIcon";
import { cn } from "@/lib/utils";
import { useHasPermission } from "@/lib/permissions";
import { useCurrentUser } from "@/lib/currentUser";
import { agencies } from "@/data/agencies";
import { agencyHref } from "@/lib/agencyNavigation";
import {
  useAllContracts, getDerivedStatus,
  type CollaborationContract,
} from "@/lib/collaborationContracts";
import { ContractDetailDialog } from "@/components/collaborators/ContractDetailDialog";
import { ContractRowKebab } from "@/components/collaborators/ContractRowKebab";
import { ContractFloatingBar } from "@/components/collaborators/ContractFloatingBar";
import { MinimalSort } from "@/components/ui/MinimalSort";

/* ═════════════ Helpers ═════════════ */

function formatDateShort(ms: number): string {
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" }).format(new Date(ms));
}
function formatRelative(ms: number): string {
  const diff = Date.now() - ms;
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days <= 0) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return hours <= 0 ? "hace minutos" : `hace ${hours} h`;
  }
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  return formatDateShort(ms);
}
function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}
function daysUntil(ms: number): number {
  return Math.floor((ms - Date.now()) / (24 * 60 * 60 * 1000));
}

type StatusFilter = "all" | "draft" | "pending" | "signed" | "expired" | "revoked";

const STATUS_FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: "all",     label: "Todos" },
  { key: "draft",   label: "Borradores" },
  { key: "pending", label: "Pendientes de firma" },
  { key: "signed",  label: "Firmados" },
  { key: "expired", label: "Expirados" },
  { key: "revoked", label: "Revocados" },
];

type SortKey = "recent" | "oldest" | "agency" | "expires";

const SORT_OPTIONS = [
  { value: "recent",  label: "Más recientes" },
  { value: "oldest",  label: "Más antiguos" },
  { value: "agency",  label: "Por agencia (A–Z)" },
  { value: "expires", label: "Próximos a expirar" },
];

/* ════════════════════════════════════════════════════════════════ */

export default function Contratos() {
  const navigate = useNavigate();
  const canView = useHasPermission("collaboration.contracts.view");
  const currentUser = useCurrentUser();
  const allRaw = useAllContracts();
  /* Privacy cross-tenant · si el viewer es agencia, solo puede ver
   * contratos donde ELLA es la parte (`agencyId === su id`). El
   * promotor ve todos los del workspace. */
  const all = useMemo(() => {
    if (currentUser.accountType === "agency" && currentUser.agencyId) {
      return allRaw.filter((c) => c.agencyId === currentUser.agencyId);
    }
    return allRaw;
  }, [allRaw, currentUser.accountType, currentUser.agencyId]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [agencyFilter, setAgencyFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [detailContractId, setDetailContractId] = useState<string | null>(null);
  const detailContract = all.find((c) => c.id === detailContractId) ?? null;

  /* Selección múltiple · hover revela el checkbox · acciones en ContractFloatingBar. */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    setSelectedIds((prev) => {
      const valid = new Set(all.map((c) => c.id));
      return new Set([...prev].filter((id) => valid.has(id)));
    });
  }, [all]);
  const toggleSelect = (id: string) => setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const clearSelection = () => setSelectedIds(new Set());

  const agencyMap = useMemo(() => {
    const m = new Map<string, typeof agencies[number]>();
    for (const a of agencies) m.set(a.id, a);
    return m;
  }, []);

  /* Split activos/archivados. El listado principal filtra por
     `!archived`. Los archivados viven en una sección aparte al pie. */
  const activeAll = useMemo(() => all.filter((c) => !c.archived), [all]);
  const archivedAll = useMemo(
    () => [...all.filter((c) => !!c.archived)].sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0)),
    [all],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = [...activeAll];
    if (statusFilter !== "all") {
      list = list.filter((c) => {
        if (statusFilter === "pending") return c.status === "sent" || c.status === "viewed";
        return c.status === statusFilter;
      });
    }
    if (agencyFilter !== "all") list = list.filter((c) => c.agencyId === agencyFilter);
    if (q) {
      list = list.filter((c) => {
        const ag = agencyMap.get(c.agencyId);
        return c.title.toLowerCase().includes(q)
          || c.pdfFilename.toLowerCase().includes(q)
          || (ag?.name.toLowerCase().includes(q) ?? false)
          || (c.csv?.toLowerCase().includes(q) ?? false);
      });
    }
    switch (sort) {
      case "recent":  list.sort((a, b) => b.createdAt - a.createdAt); break;
      case "oldest":  list.sort((a, b) => a.createdAt - b.createdAt); break;
      case "agency":  list.sort((a, b) => {
        const na = agencyMap.get(a.agencyId)?.name ?? "";
        const nb = agencyMap.get(b.agencyId)?.name ?? "";
        return na.localeCompare(nb);
      }); break;
      case "expires": list.sort((a, b) => (a.expiresAt ?? Infinity) - (b.expiresAt ?? Infinity)); break;
    }
    return list;
  }, [activeAll, search, statusFilter, agencyFilter, sort, agencyMap]);

  /* KPIs. */
  const kpis = useMemo(() => {
    const total = all.length;
    const signed = all.filter((c) => c.status === "signed").length;
    const pending = all.filter((c) => c.status === "sent" || c.status === "viewed" || c.status === "draft").length;
    const soon = all.filter((c) => c.status !== "signed" && c.status !== "revoked" && c.expiresAt && daysUntil(c.expiresAt) <= 7 && daysUntil(c.expiresAt) >= 0).length;
    return { total, signed, pending, soon };
  }, [all]);

  /* Agencias con algún contrato · para dropdown del filtro. */
  const agenciesWithContracts = useMemo(() => {
    const seen = new Set<string>();
    const out: typeof agencies = [];
    for (const c of all) {
      if (seen.has(c.agencyId)) continue;
      const a = agencyMap.get(c.agencyId);
      if (a) { seen.add(c.agencyId); out.push(a); }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [all, agencyMap]);

  if (!canView) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 text-center">
        <Shield className="h-10 w-10 text-muted-foreground/40 mb-3" strokeWidth={1.5} />
        <h1 className="text-base font-semibold text-foreground mb-1">Sin acceso</h1>
        <p className="text-sm text-muted-foreground max-w-md">
          Los contratos de colaboración son información sensible. Solo administradores y
          miembros con el permiso{" "}
          <code className="text-[11px] bg-muted px-1.5 rounded">collaboration.contracts.view</code> pueden verlos.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-full bg-background">
      <div className="px-4 sm:px-6 lg:px-10 pt-6 pb-10 max-w-[1400px] mx-auto w-full">

        {/* ══ Cabecera ══ */}
        <header className="mb-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Red · contratos
          </p>
          <h1 className="text-[19px] sm:text-[22px] font-bold tracking-tight text-foreground leading-tight mt-1">
            Contratos de colaboración
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Todos los contratos firmados y pendientes con tus agencias colaboradoras.
            Lo que cada agencia puede operar depende de su contrato vigente.
          </p>
        </header>

        {/* ══ KPIs ══ */}
        <div className="rounded-2xl border border-border bg-card shadow-soft mb-5">
          <dl className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border/60">
            <KpiStat label="Total"         value={kpis.total} />
            <KpiStat label="Firmados"      value={kpis.signed} accent="success" />
            <KpiStat label="Pendientes"    value={kpis.pending} accent={kpis.pending > 0 ? "primary" : undefined} />
            <KpiStat label="Expiran en 7d" value={kpis.soon}    accent={kpis.soon > 0 ? "warning" : undefined} />
          </dl>
        </div>

        {/* ══ Filtros ══ */}
        <div className="flex items-center gap-3 flex-wrap mb-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={1.75} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar título, agencia, CSV…"
              className="w-full h-9 pl-8 pr-3 rounded-full border border-border bg-card text-[12.5px] text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted grid place-items-center"
                aria-label="Limpiar"
              >
                <X className="h-3 w-3" strokeWidth={2} />
              </button>
            )}
          </div>

          {/* Pills de estado */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {STATUS_FILTERS.map((s) => {
              const active = statusFilter === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setStatusFilter(s.key)}
                  className={cn(
                    "h-7 px-3 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors",
                    active
                      ? "bg-foreground text-background"
                      : "bg-card border border-border text-foreground hover:bg-muted",
                  )}
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-3 sm:gap-4">
            {/* Filtro agencia */}
            {agenciesWithContracts.length > 0 && (
              <div className="relative">
                <Filter className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.75} />
                <select
                  value={agencyFilter}
                  onChange={(e) => setAgencyFilter(e.target.value)}
                  className="h-9 pl-8 pr-8 rounded-full border border-border bg-card text-[12.5px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
                >
                  <option value="all">Todas las agencias</option>
                  {agenciesWithContracts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            )}
            <span className="text-xs text-muted-foreground hidden sm:inline">
              <span className="font-semibold text-foreground tabular-nums">{filtered.length}</span> resultados
            </span>
            <MinimalSort
              value={sort}
              options={SORT_OPTIONS}
              onChange={(v) => setSort(v as SortKey)}
              label="Ordenar por"
            />
          </div>
        </div>

        {/* ══ Lista ══ */}
        {all.length === 0 ? (
          <EmptyZero />
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <p className="text-sm font-medium text-foreground mb-1">Sin resultados</p>
            <p className="text-xs text-muted-foreground">Prueba con otra búsqueda o filtro.</p>
          </div>
        ) : (
          <ul className="rounded-2xl border border-border bg-card shadow-soft divide-y divide-border/50 overflow-hidden">
            {filtered.map((c) => (
              <ContractRow
                key={c.id}
                contract={c}
                agency={agencyMap.get(c.agencyId)}
                selected={selectedIds.has(c.id)}
                onToggleSelect={() => toggleSelect(c.id)}
                onOpenDetail={() => setDetailContractId(c.id)}
                onOpenAgency={(e) => {
                  e.stopPropagation();
                  const ag = agencyMap.get(c.agencyId);
                  if (ag) navigate(agencyHref(ag));
                }}
              />
            ))}
          </ul>
        )}

        {/* Sección Archivados al pie · muestra top 3 · expandir. */}
        {archivedAll.length > 0 && (
          <ArchivedSection
            contracts={archivedAll}
            agencyMap={agencyMap}
            onOpenDetail={(id) => setDetailContractId(id)}
            onOpenAgency={(agencyId) => {
              const ag = agencyMap.get(agencyId);
              if (ag) navigate(agencyHref(ag));
            }}
          />
        )}
      </div>

      <ContractDetailDialog
        open={!!detailContractId}
        onOpenChange={(v) => { if (!v) setDetailContractId(null); }}
        contract={detailContract}
      />

      <ContractFloatingBar
        selectedIds={selectedIds}
        totalVisible={filtered.length}
        allVisibleIds={filtered.map((c) => c.id)}
        onSelectAll={(ids) => setSelectedIds(new Set(ids))}
        onClear={clearSelection}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */

function EmptyZero() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
      <FileSignature className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" strokeWidth={1.5} />
      <p className="text-sm font-medium text-foreground mb-1">Aún no hay contratos</p>
      <p className="text-xs text-muted-foreground max-w-md mx-auto">
        Cuando subas el primer contrato de colaboración con una agencia desde su panel ·
        aparecerá aquí. Accede a una agencia en{" "}
        <span className="text-foreground font-medium">Colaboradores</span> para empezar.
      </p>
    </div>
  );
}

function ContractRow({
  contract: c, agency, onOpenDetail, onOpenAgency, selected, onToggleSelect,
}: {
  contract: CollaborationContract;
  agency: typeof agencies[number] | undefined;
  onOpenDetail: () => void;
  onOpenAgency: (e: React.MouseEvent) => void;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const status = getDerivedStatus(c);
  const toneClasses = {
    muted:       "bg-muted text-muted-foreground border-border",
    primary:     "bg-primary/10 text-primary border-primary/25",
    success:     "bg-success/10 text-success border-success/25",
    warning:     "bg-warning/10 text-warning border-warning/25",
    destructive: "bg-destructive/10 text-destructive border-destructive/25",
  }[status.tone];

  const expiresSoon = c.expiresAt
    && c.status !== "signed"
    && c.status !== "revoked"
    && daysUntil(c.expiresAt) <= 7
    && daysUntil(c.expiresAt) >= 0;

  return (
    <li
      onClick={onOpenDetail}
      className={cn(
        "group px-4 sm:px-5 py-3 flex items-start gap-3 transition-colors cursor-pointer",
        selected ? "bg-foreground/5" : "hover:bg-muted/20",
      )}
    >
      {/* Checkbox a la IZQUIERDA · aparece en hover o cuando está marcado. */}
      <div
        className="w-5 h-9 flex items-center shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onToggleSelect}
          aria-pressed={selected}
          aria-label={selected ? "Deseleccionar contrato" : "Seleccionar contrato"}
          className={cn(
            "h-5 w-5 rounded-[6px] border grid place-items-center transition-all duration-150",
            selected
              ? "opacity-100 bg-foreground border-foreground text-background"
              : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 border-border bg-card hover:border-foreground/40 text-transparent hover:text-foreground",
          )}
        >
          {selected && <Check className="h-3 w-3" strokeWidth={3} />}
        </button>
      </div>
      {/* Icono PDF · siempre visible. */}
      <span className="h-9 w-8 grid place-items-center shrink-0">
        <PdfIcon className="h-8 w-7 text-muted-foreground/80" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-foreground truncate">{c.title}</p>
          <span className={cn("inline-flex items-center h-5 px-2 rounded-full border text-[10.5px] font-medium", toneClasses)}>
            {status.label}
          </span>
          {expiresSoon && (
            <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full border border-warning/30 bg-warning/10 text-[10.5px] font-medium text-warning">
              <AlertTriangle className="h-2.5 w-2.5" strokeWidth={2} />
              Vence en {daysUntil(c.expiresAt!)}d
            </span>
          )}
        </div>
        <p className="text-[11.5px] text-muted-foreground truncate mt-0.5">
          {c.pdfFilename}
          {typeof c.comision === "number" && c.comision > 0 ? ` · ${c.comision}% comisión` : ""}
          {typeof c.duracionMeses === "number" ? (c.duracionMeses === 0 ? " · indefinido" : ` · ${c.duracionMeses}m`) : ""}
          {c.signers.length > 0 ? ` · ${c.signers.length} firmante${c.signers.length === 1 ? "" : "s"}` : ""}
        </p>
        <div className="flex items-center gap-1.5 mt-1 text-[10.5px] text-muted-foreground flex-wrap">
          {/* Agencia · clicable a su panel */}
          {agency && (
            <button
              type="button"
              onClick={onOpenAgency}
              className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-muted/60 hover:bg-muted text-foreground font-medium transition-colors"
              title="Ir al panel de la agencia"
            >
              <span className="h-3 w-3 rounded-full bg-background grid place-items-center text-[7.5px] font-bold text-muted-foreground overflow-hidden">
                {agency.logo
                  ? <img src={agency.logo} alt="" className="h-full w-full object-cover" />
                  : <span>{initials(agency.name)}</span>
                }
              </span>
              {agency.name}
            </button>
          )}
          <span className="text-border">·</span>
          <span>Subido {formatRelative(c.createdAt)}</span>
          {c.signedAt && <><span className="text-border">·</span><span>Firmado {formatRelative(c.signedAt)}</span></>}
          {c.expiresAt && c.status !== "signed" && c.status !== "revoked" && (
            <>
              <span className="text-border">·</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" strokeWidth={1.75} />
                Vence {formatDateShort(c.expiresAt)}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="pt-0.5 shrink-0">
        <ContractRowKebab contract={c} onOpenDetail={onOpenDetail} />
      </div>
    </li>
  );
}

/* ══════ Sección Archivados · colapsada por defecto · click en el
        header para mostrar/ocultar la lista completa ══════ */
function ArchivedSection({
  contracts, agencyMap, onOpenDetail, onOpenAgency,
}: {
  contracts: CollaborationContract[];
  agencyMap: Map<string, typeof agencies[number]>;
  onOpenDetail: (id: string) => void;
  onOpenAgency: (agencyId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mt-4 rounded-2xl border border-border bg-muted/20 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className={cn(
          "w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/40",
          expanded && "border-b border-border/50",
        )}
      >
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Archivados · {contracts.length}
        </p>
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          {expanded ? "Ocultar" : "Ver"}
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")}
            strokeWidth={1.75}
          />
        </span>
      </button>
      {expanded && (
        <ul className="divide-y divide-border/40">
          {contracts.map((c) => (
            <ArchivedRow
              key={c.id}
              contract={c}
              agency={agencyMap.get(c.agencyId)}
              onOpenDetail={() => onOpenDetail(c.id)}
              onOpenAgency={(e) => { e.stopPropagation(); onOpenAgency(c.agencyId); }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ArchivedRow({
  contract: c, agency, onOpenDetail, onOpenAgency,
}: {
  contract: CollaborationContract;
  agency: typeof agencies[number] | undefined;
  onOpenDetail: () => void;
  onOpenAgency: (e: React.MouseEvent) => void;
}) {
  const status = getDerivedStatus(c);
  const toneClasses = {
    muted:       "bg-muted text-muted-foreground border-border",
    primary:     "bg-primary/10 text-primary border-primary/25",
    success:     "bg-success/10 text-success border-success/25",
    warning:     "bg-warning/10 text-warning border-warning/25",
    destructive: "bg-destructive/10 text-destructive border-destructive/25",
  }[status.tone];
  return (
    <li
      className="group px-3 sm:px-4 py-2.5 flex items-center gap-3 hover:bg-muted/30 transition-colors cursor-pointer"
      onClick={onOpenDetail}
    >
      <span className="h-8 w-7 grid place-items-center shrink-0 opacity-60">
        <PdfIcon className="h-7 w-6 text-muted-foreground/60" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[13px] font-medium text-foreground truncate">{c.title}</p>
          <span className={cn("inline-flex items-center h-5 px-2 rounded-full border text-[10.5px] font-medium", toneClasses)}>
            {status.label}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
          {c.pdfFilename}
          {c.archivedAt ? ` · archivado ${formatRelative(c.archivedAt)}` : ""}
        </p>
        {agency && (
          <div className="mt-1">
            <button
              type="button"
              onClick={onOpenAgency}
              className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-muted/60 hover:bg-muted text-foreground text-[10.5px] font-medium transition-colors"
              title="Ir al panel de la agencia"
            >
              <span className="h-3 w-3 rounded-full bg-background grid place-items-center text-[7.5px] font-bold text-muted-foreground overflow-hidden">
                {agency.logo
                  ? <img src={agency.logo} alt="" className="h-full w-full object-cover" />
                  : <span>{initials(agency.name)}</span>
                }
              </span>
              {agency.name}
            </button>
          </div>
        )}
      </div>
      <ContractRowKebab contract={c} onOpenDetail={onOpenDetail} canSend={false} />
    </li>
  );
}

function KpiStat({
  label, value, accent,
}: {
  label: string;
  value: number;
  accent?: "success" | "primary" | "warning";
}) {
  return (
    <div className="px-5 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className={cn(
        "text-[22px] font-bold tabular-nums leading-none mt-1.5",
        accent === "success" ? "text-success" :
        accent === "warning" ? "text-warning" :
        accent === "primary" ? "text-primary" :
        "text-foreground",
      )}>
        {value}
      </p>
    </div>
  );
}
