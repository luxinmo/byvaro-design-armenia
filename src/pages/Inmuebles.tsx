/**
 * Inmuebles — Catálogo de inmuebles del workspace actual.
 *
 * Lista los inmuebles del workspace logueado (developer o agency).
 * Cada org sólo ve los suyos · la separación se hace en
 * `useInmuebles()` (lib/inmueblesStorage.ts) por clave de
 * localStorage sufijada con `currentWorkspaceKey(user)`.
 *
 * Filtros (mock): operación · estado · búsqueda libre.
 * No hay vista grid/mapa todavía — empezamos por list.
 */

import { useMemo, useState } from "react";
import { Search, Plus, X, KeyRound, List, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInmuebles } from "@/lib/inmueblesStorage";
import {
  INMUEBLE_OPERATION_LABEL,
  INMUEBLE_STATUS_LABEL,
  type InmuebleOperation,
  type InmuebleStatus,
} from "@/data/inmuebles";
import { InmuebleListCard } from "@/components/inmuebles/InmuebleListCard";
import { InmuebleGridCard } from "@/components/inmuebles/InmuebleGridCard";
import { ViewToggle } from "@/components/ui/ViewToggle";

type OperationFilter = "all" | InmuebleOperation;
type StatusFilter = "all" | InmuebleStatus;

const OPERATION_OPTIONS: { key: OperationFilter; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "venta", label: "Venta" },
  { key: "alquiler", label: "Alquiler" },
  { key: "alquiler-vacacional", label: "Vacacional" },
  { key: "traspaso", label: "Traspaso" },
];

const STATUS_OPTIONS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "disponible", label: "Disponible" },
  { key: "reservado", label: "Reservado" },
  { key: "vendido", label: "Vendido" },
  { key: "alquilado", label: "Alquilado" },
  { key: "retirado", label: "Retirado" },
];

type ViewMode = "list" | "grid";

type Props = {
  /** Vista inicial al entrar · permite que el sidebar tenga dos
   *  entradas con la misma página y distinto modo por defecto. */
  defaultView?: ViewMode;
};

export default function Inmuebles({ defaultView = "list" }: Props) {
  const { inmuebles, toggleFavorite } = useInmuebles();
  const [search, setSearch] = useState("");
  const [operation, setOperation] = useState<OperationFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [view, setView] = useState<ViewMode>(defaultView);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inmuebles.filter((i) => {
      if (operation !== "all" && i.operation !== operation) return false;
      if (status !== "all" && i.status !== status) return false;
      if (!q) return true;
      return (
        i.reference.toLowerCase().includes(q) ||
        i.address.toLowerCase().includes(q) ||
        i.city.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [inmuebles, search, operation, status]);

  const kpis = useMemo(() => {
    const total = inmuebles.length;
    const disponibles = inmuebles.filter((i) => i.status === "disponible").length;
    const compartidos = inmuebles.filter((i) => i.shareWithNetwork).length;
    const reservados = inmuebles.filter((i) => i.status === "reservado").length;
    return { total, disponibles, compartidos, reservados };
  }, [inmuebles]);

  return (
    <div className="flex-1 flex flex-col min-h-full bg-background">
      <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-10 max-w-content mx-auto w-full">

        {/* ══ Cabecera ══ */}
        <header className="mb-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Comercial · catálogo
            </p>
            <h1 className="text-[19px] sm:text-[22px] font-bold tracking-tight text-foreground leading-tight mt-1">
              Inmuebles
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Tu catálogo de unidades sueltas. Habilita "Compartir con la red"
              en cada inmueble para que tus colaboradores puedan trabajarlo —
              el resto queda de uso interno del equipo.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-foreground text-background text-sm font-medium shadow-soft hover:bg-foreground/90 transition-colors shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Nuevo inmueble
          </button>
        </header>

        {/* ══ KPIs ══ */}
        <div className="rounded-2xl border border-border bg-card shadow-soft mb-5">
          <dl className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border/60">
            <KpiStat label="Total" value={kpis.total} />
            <KpiStat label="Disponibles" value={kpis.disponibles} accent="success" />
            <KpiStat label="Reservados" value={kpis.reservados} accent={kpis.reservados > 0 ? "warning" : undefined} />
            <KpiStat label="Compartidos con la red" value={kpis.compartidos} accent="primary" />
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
              placeholder="Buscar referencia, dirección, etiqueta…"
              className="w-full h-9 pl-8 pr-8 rounded-full border border-border bg-card text-[12.5px] text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/20"
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

          {/* Operación */}
          <PillGroup
            options={OPERATION_OPTIONS}
            value={operation}
            onChange={(v) => setOperation(v as OperationFilter)}
          />

          {/* Estado */}
          <PillGroup
            options={STATUS_OPTIONS}
            value={status}
            onChange={(v) => setStatus(v as StatusFilter)}
          />

          {/* View toggle · empuja a la derecha */}
          <div className="ml-auto">
            <ViewToggle
              value={view}
              onChange={setView}
              options={[
                { value: "list", icon: List, label: "Lista" },
                { value: "grid", icon: LayoutGrid, label: "Cuadrícula" },
              ]}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground tnum mb-4">
          {filtered.length} {filtered.length === 1 ? "inmueble" : "inmuebles"}
          {filtered.length !== inmuebles.length && (
            <> de <span className="text-foreground font-medium">{inmuebles.length}</span></>
          )}
        </p>

        {/* ══ Resultados ══ */}
        {filtered.length === 0 ? (
          <EmptyState hasAny={inmuebles.length > 0} onClear={() => { setSearch(""); setOperation("all"); setStatus("all"); }} />
        ) : view === "list" ? (
          <div className="space-y-3">
            {filtered.map((i) => (
              <InmuebleListCard
                key={i.id}
                inmueble={i}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((i) => (
              <InmuebleGridCard
                key={i.id}
                inmueble={i}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

function KpiStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "success" | "warning" | "primary";
}) {
  const accentClass =
    accent === "success" ? "text-success"
    : accent === "warning" ? "text-warning"
    : accent === "primary" ? "text-primary"
    : "text-foreground";
  return (
    <div className="px-4 py-3.5">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className={cn("text-xl font-semibold tnum mt-0.5", accentClass)}>{value}</dd>
    </div>
  );
}

function PillGroup<T extends string>({
  options, value, onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {options.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={cn(
              "h-9 px-3.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
              active
                ? "bg-foreground text-background"
                : "bg-card text-muted-foreground border border-border hover:text-foreground hover:bg-muted/50",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function EmptyState({
  hasAny, onClear,
}: {
  hasAny: boolean;
  onClear: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
      <div className="h-10 w-10 rounded-full bg-muted text-muted-foreground grid place-items-center mx-auto mb-3">
        <KeyRound className="h-4 w-4" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">
        {hasAny ? "No hay inmuebles con estos filtros" : "Aún no tienes inmuebles"}
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
        {hasAny
          ? "Prueba a quitar filtros o cambiar la búsqueda para ver más resultados."
          : "Crea tu primer inmueble para empezar a gestionar tu catálogo."}
      </p>
      {hasAny ? (
        <button
          type="button"
          onClick={onClear}
          className="h-9 px-4 rounded-full border border-border bg-card text-sm font-medium hover:bg-muted/50 transition-colors"
        >
          Limpiar filtros
        </button>
      ) : (
        <button
          type="button"
          className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-foreground text-background text-sm font-medium shadow-soft hover:bg-foreground/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Crear inmueble
        </button>
      )}
    </div>
  );
}
