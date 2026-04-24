/**
 * Colaboradores · Vista V3 (comercial enriquecida)
 * ──────────────────────────────────────────────────
 * Variante V3 activable con `/colaboradores?v=3`. Añade señales comerciales
 * reales sobre la V2: mercados/banderas, conversión, ticket medio, última
 * actividad, antigüedad, team size, especialidad, rating, contacto
 * principal, incidencias.
 *
 * Rollback: borrar este archivo + el `if v=3` del `Colaboradores.tsx`.
 */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, X, Plus, Users, Star, ArrowUpRight, Sparkles, Mail, Phone,
  MoreHorizontal, Pause, Play, Trash2, Building2, FileSignature,
  AlertTriangle, TrendingUp, Activity, Calendar,
  Tag, SlidersHorizontal, Check,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster, toast } from "sonner";
import { agencies as baseAgencies, getContractStatus, getAgencyShareStats, type Agency } from "@/data/agencies";
import { InvitarAgenciaModal } from "@/components/empresa/InvitarAgenciaModal";
import { useInvitaciones, invitacionToSyntheticAgency } from "@/lib/invitaciones";
import { useFavoriteAgencies } from "@/lib/favoriteAgencies";
import { MinimalSort } from "@/components/ui/MinimalSort";
import { cn } from "@/lib/utils";

/* ─── helpers ─── */
function formatEuro(n: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}
function formatEuroCompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M €`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k €`;
  return `${n} €`;
}
function getEstado(a: Agency): "activa" | "contrato-pendiente" | "pausada" {
  if (a.estadoColaboracion) return a.estadoColaboracion;
  if (a.status === "active") return "activa";
  if (a.status === "pending") return "contrato-pendiente";
  return "pausada";
}
function getOrigen(a: Agency): "invited" | "marketplace" {
  return a.origen ?? "invited";
}
/** Una agencia está "pendiente" cuando hay una solicitud entrante (marketplace)
 *  o una invitación saliente sin responder. Viven fuera del grid principal y
 *  se listan sólo cuando el usuario abre el pill "Pendientes" o el drawer. */
function isPendiente(a: Agency): boolean {
  return Boolean(a.solicitudPendiente || a.isNewRequest);
}
const TYPE_LABELS: Record<string, string> = {
  Agency: "Agencia",
  Broker: "Broker",
  Network: "Network",
};
function typeLabel(t: string | undefined | null): string {
  if (!t) return "";
  return TYPE_LABELS[t] ?? t;
}
/** ISO2 → emoji flag. */
function flagOf(code: string): string {
  const c = code.toUpperCase();
  if (c.length !== 2) return "🏳️";
  return String.fromCodePoint(...[...c].map((ch) => 127397 + ch.charCodeAt(0)));
}
/** Devuelve texto relativo de última actividad. */
function relativeActivity(iso: string | undefined, ref = new Date()): { label: string; tone: "fresh" | "ok" | "stale" } {
  if (!iso) return { label: "Sin actividad", tone: "stale" };
  const diff = Math.floor((ref.getTime() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000));
  if (diff <= 0) return { label: "Hoy", tone: "fresh" };
  if (diff === 1) return { label: "Ayer", tone: "fresh" };
  if (diff < 7) return { label: `Hace ${diff} días`, tone: "fresh" };
  if (diff < 30) return { label: `Hace ${Math.round(diff / 7)} sem`, tone: "ok" };
  if (diff < 365) return { label: `Hace ${Math.round(diff / 30)} meses`, tone: "stale" };
  return { label: `Hace +1 año`, tone: "stale" };
}
/** Fotos por defecto cuando la agencia aún no ha subido las suyas. */
const DEFAULT_COVER = "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=900&h=260&fit=crop&q=80";
const DEFAULT_LOGO = "https://api.dicebear.com/9.x/shapes/svg?seed=default-agency&backgroundColor=94a3b8&size=120";

/** Resalta las coincidencias del buscador en un texto. Case-insensitive. */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark key={i} className="bg-warning/20 text-foreground rounded-sm px-0.5">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════ */

export default function Colaboradores() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<"todas" | "activa" | "pausada">("todas");
  /* Segmented rápido junto al buscador.
   *   · "todos"        → sin filtro.
   *   · "colaboran"    → estado activa.
   *   · "pendientes"   → estado contrato-pendiente (invitación saliente sin
   *                      responder, o solicitud entrante sin aprobar).
   *   · "no-colaboran" → estado pausada. */
  const [quickFilter, setQuickFilter] = useState<"todos" | "colaboran" | "pendientes" | "no-colaboran">("todos");
  const [invitarOpen, setInvitarOpen] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, Partial<Agency> | "deleted">>({});

  /* ─── Filtros avanzados (drawer) ─── */
  const [filtersOpen, setFiltersOpen] = useState(false);
  /* ─── Solicitudes pendientes (drawer) ─── */
  const [requestsOpen, setRequestsOpen] = useState(false);
  const [origenFilter, setOrigenFilter] = useState<string[]>([]);
  const [tipoFilter, setTipoFilter] = useState<string[]>([]);
  const [contratoFilter, setContratoFilter] = useState<string[]>([]);
  const [mercadosFilter, setMercadosFilter] = useState<string[]>([]);
  const [soloFavoritos, setSoloFavoritos] = useState(false);
  const [minRating, setMinRating] = useState<number | null>(null);

  /* Ordenación (MinimalSort) */
  const [sort, setSort] = useState<string>("volumen-desc");
  const sortOptions = [
    { value: "volumen-desc", label: "Volumen de ventas (mayor)" },
    { value: "ventas-desc", label: "Ventas cerradas (más)" },
    { value: "registros-desc", label: "Registros (más)" },
    { value: "google-desc", label: "Rating Google (mejor)" },
    { value: "activity-desc", label: "Actividad reciente" },
    { value: "antiguedad-asc", label: "Más antiguas" },
    { value: "name-asc", label: "Nombre (A-Z)" },
    { value: "name-desc", label: "Nombre (Z-A)" },
  ];

  const { isFavorite: isFavoriteGlobal } = useFavoriteAgencies();

  const activeFilterCount =
    (estadoFilter !== "todas" ? 1 : 0) +
    origenFilter.length +
    tipoFilter.length +
    contratoFilter.length +
    mercadosFilter.length +
    (soloFavoritos ? 1 : 0) +
    (minRating != null ? 1 : 0);

  const clearAllFilters = () => {
    setEstadoFilter("todas");
    setOrigenFilter([]);
    setTipoFilter([]);
    setContratoFilter([]);
    setMercadosFilter([]);
    setSoloFavoritos(false);
    setMinRating(null);
  };

  const { pendientes: invitaciones } = useInvitaciones();
  const invitacionesAgencies = useMemo<Agency[]>(() => invitaciones.map(invitacionToSyntheticAgency), [invitaciones]);

  const agencies = useMemo<Agency[]>(() => {
    return [...baseAgencies, ...invitacionesAgencies]
      .map((a) => {
        const ov = overrides[a.id];
        if (ov === "deleted") return null;
        return ov ? { ...a, ...ov } : a;
      })
      .filter(Boolean) as Agency[];
  }, [overrides, invitacionesAgencies]);

  const pendientes = useMemo(
    () => agencies.filter((a) => a.solicitudPendiente || a.isNewRequest),
    [agencies],
  );

  /* Mostramos todas las agencias como cards grandes tipo "Top performers". */

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return agencies.filter((a) => {
      /* Pendientes: el pill las muestra; el resto de vistas las excluye
       * para que vivan en su drawer y no se mezclen con la red activa. */
      if (quickFilter === "pendientes") {
        if (!isPendiente(a)) return false;
      } else {
        if (isPendiente(a)) return false;
        if (quickFilter === "colaboran" && getEstado(a) !== "activa") return false;
        if (quickFilter === "no-colaboran" && getEstado(a) !== "pausada") return false;
      }
      if (estadoFilter !== "todas" && getEstado(a) !== estadoFilter) return false;
      if (origenFilter.length > 0 && !origenFilter.includes(getOrigen(a))) return false;
      if (tipoFilter.length > 0 && !tipoFilter.includes(a.type)) return false;
      if (contratoFilter.length > 0 && !contratoFilter.includes(getContractStatus(a).state)) return false;
      if (mercadosFilter.length > 0) {
        const am = a.mercados ?? [];
        if (!mercadosFilter.some((m) => am.includes(m))) return false;
      }
      if (soloFavoritos && !isFavoriteGlobal(a.id)) return false;
      if (minRating != null && (a.googleRating ?? 0) < minRating) return false;
      if (q) {
        const hay =
          a.name.toLowerCase().includes(q) || a.location.toLowerCase().includes(q);
        if (!hay) return false;
      }
      return true;
    });
  }, [
    agencies, search, estadoFilter, quickFilter, origenFilter, tipoFilter, contratoFilter,
    mercadosFilter, soloFavoritos, minRating, isFavoriteGlobal,
  ]);

  /* Ordenación aplicada a la lista filtrada. */
  const sortedFiltered = useMemo(() => {
    const list = [...filtered];
    const by = (fn: (a: Agency) => number | string) => (a: Agency, b: Agency) => {
      const va = fn(a); const vb = fn(b);
      if (typeof va === "number" && typeof vb === "number") return vb - va;
      return String(va).localeCompare(String(vb));
    };
    switch (sort) {
      case "volumen-desc":   list.sort((a, b) => b.salesVolume - a.salesVolume); break;
      case "ventas-desc":    list.sort((a, b) => (b.ventasCerradas ?? 0) - (a.ventasCerradas ?? 0)); break;
      case "registros-desc": list.sort((a, b) => (b.registrosAportados ?? b.registrations) - (a.registrosAportados ?? a.registrations)); break;
      case "google-desc":    list.sort((a, b) => (b.googleRating ?? 0) - (a.googleRating ?? 0)); break;
      case "activity-desc":  list.sort((a, b) => {
        const ta = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
        const tb = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
        return tb - ta;
      }); break;
      case "antiguedad-asc": list.sort(by((a) => a.collaboratingSince ?? "ZZZ")); break;
      case "name-asc":       list.sort((a, b) => a.name.localeCompare(b.name)); break;
      case "name-desc":      list.sort((a, b) => b.name.localeCompare(a.name)); break;
    }
    return list;
  }, [filtered, sort]);

  /* Acciones */
  const handleAprobar = (id: string) => {
    setOverrides((prev) => ({
      ...prev,
      [id]: {
        ...(typeof prev[id] === "object" ? prev[id] : {}),
        solicitudPendiente: false, isNewRequest: false,
        estadoColaboracion: "activa", status: "active",
      },
    }));
    toast.success("Solicitud aprobada");
  };
  const handleRechazar = (id: string) => {
    setOverrides((prev) => ({ ...prev, [id]: "deleted" }));
    toast.success("Solicitud rechazada");
  };
  const handlePausar = (id: string) => {
    const a = agencies.find((x) => x.id === id);
    if (!a) return;
    const nuevo = getEstado(a) === "pausada" ? "activa" : "pausada";
    setOverrides((prev) => ({
      ...prev,
      [id]: {
        ...(typeof prev[id] === "object" ? prev[id] : {}),
        estadoColaboracion: nuevo,
      },
    }));
    toast.success(nuevo === "pausada" ? "Colaboración pausada" : "Colaboración reanudada");
  };

  return (
    <div className="flex flex-col min-h-full bg-background">
      <Toaster position="top-center" richColors closeButton />

      {/* Header limpio */}
      <section className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        <div className="max-w-[1400px] mx-auto">
          {/* Row 1 · título + CTAs */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Red comercial
              </p>
              <h1 className="text-[19px] sm:text-[22px] font-bold tracking-tight text-foreground mt-1 leading-tight">
                Tus colaboradores
              </h1>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-[560px] leading-relaxed">
                Señales comerciales, mercados cubiertos y actividad reciente de
                cada agencia con la que colaboras.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => navigate("/colaboradores/estadisticas")}
                className="group inline-flex items-center gap-1.5 h-10 px-4 rounded-full border border-border bg-card text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                Estadísticas
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" strokeWidth={1.75} />
              </button>
              <button
                onClick={() => setInvitarOpen(true)}
                className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 shadow-soft transition-colors"
              >
                <Plus className="h-4 w-4" strokeWidth={2} />
                Invitar agencia
              </button>
            </div>
          </div>

          {/* Row 2 · buscador + quick filter + filtros */}
          <div className="flex items-center gap-2 mt-5 flex-wrap">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
              <input
                type="text"
                placeholder="Buscar agencia o ciudad..."
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

            {/* Segmented · Todos / Colaboradores / Pendientes / No colaboradores.
             *  En viewport <400px no cabe en una línea: damos scroll horizontal
             *  al propio segmented sin que rompa el layout de la toolbar. */}
            <div className="inline-flex max-w-full items-center bg-muted rounded-full p-1 gap-0.5 shrink-0 overflow-x-auto no-scrollbar">
              {([
                { key: "todos", label: "Todos" },
                { key: "colaboran", label: "Colaboradores" },
                { key: "pendientes", label: "Pendientes" },
                { key: "no-colaboran", label: "No colaboradores" },
              ] as const).map((opt) => {
                const selected = quickFilter === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setQuickFilter(opt.key)}
                    className={cn(
                      "h-8 px-3.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0",
                      selected
                        ? "bg-card text-foreground shadow-soft"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setFiltersOpen(true)}
              className={cn(
                "relative inline-flex items-center gap-1.5 h-10 px-4 rounded-full border text-sm font-medium transition-colors shrink-0",
                activeFilterCount > 0
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card text-foreground border-border hover:bg-muted",
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span className="hidden sm:inline">Filtros</span>
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-background text-foreground text-[10px] font-bold tabular-nums">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Solicitudes pendientes · banner minimal */}
      {pendientes.length > 0 && (
        <section className="px-4 sm:px-6 lg:px-8 mt-4">
          <div className="max-w-[1400px] mx-auto">
            <button
              onClick={() => setRequestsOpen(true)}
              className="w-full group flex items-center gap-3 rounded-full border border-border bg-card px-4 py-2.5 text-left hover:bg-muted transition-colors"
            >
              <span className="h-2 w-2 rounded-full bg-warning shrink-0" />
              <span className="text-xs text-foreground min-w-0 flex-1 truncate">
                <span className="font-semibold">{pendientes.length}</span>
                {pendientes.length === 1 ? " solicitud pendiente" : " solicitudes pendientes"}
                <span className="text-muted-foreground"> · agencias esperando tu respuesta</span>
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-primary group-hover:text-primary/80 transition-colors shrink-0">
                Ver solicitudes
                <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
              </span>
            </button>
          </div>
        </section>
      )}


      {/* Red completa */}
      <section className="px-4 sm:px-6 lg:px-8 mt-8 pb-12">
        <div className="max-w-[1400px] mx-auto">
          <header className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Tu red
              </p>
              <h2 className="text-base font-semibold text-foreground leading-tight mt-0.5">
                {filtered.length} {filtered.length === 1 ? "agencia" : "agencias"}
              </h2>
            </div>
            <MinimalSort value={sort} options={sortOptions} onChange={setSort} label="Ordenar por" />
          </header>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
              <Users className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">Sin resultados</p>
              <p className="text-xs text-muted-foreground">
                Prueba con otro filtro o invita a una agencia nueva.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedFiltered.map((a) => (
                <FeatureCardV3
                  key={a.id}
                  agency={a}
                  highlight={search}
                  onPause={() => handlePausar(a.id)}
                  onDelete={() => handleRechazar(a.id)}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {invitarOpen && <InvitarAgenciaModal onClose={() => setInvitarOpen(false)} />}

      {/* ═══════════ Drawer de solicitudes pendientes ═══════════ */}
      <AnimatePresence>
        {requestsOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/25 backdrop-blur-sm"
              onClick={() => setRequestsOpen(false)}
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[460px] bg-card border-l border-border shadow-soft-lg flex flex-col"
            >
              <header className="h-14 shrink-0 flex items-center justify-between px-5 border-b border-border">
                <div>
                  <h2 className="text-[15px] font-semibold tracking-tight">Solicitudes</h2>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {pendientes.length === 1
                      ? "1 agencia esperando respuesta"
                      : `${pendientes.length} agencias esperando respuesta`}
                  </p>
                </div>
                <button
                  onClick={() => setRequestsOpen(false)}
                  className="p-2 -mr-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>

              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3">
                {pendientes.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center">
                    <Sparkles className="h-7 w-7 text-muted-foreground/40 mx-auto mb-2" strokeWidth={1.5} />
                    <p className="text-sm font-medium text-foreground mb-1">Sin solicitudes</p>
                    <p className="text-xs text-muted-foreground">
                      Cuando una agencia te solicite colaborar, aparecerá aquí.
                    </p>
                  </div>
                ) : (
                  pendientes.map((a) => (
                    <article
                      key={a.id}
                      className="rounded-2xl border border-border bg-card overflow-hidden"
                    >
                      {/* Cover */}
                      <div
                        className="h-20 bg-muted relative"
                        style={{
                          backgroundImage: `url(${a.cover || DEFAULT_COVER})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                        <span className="absolute top-2 right-2 text-[11px] font-semibold text-foreground bg-card/90 backdrop-blur px-2 py-0.5 rounded-full shadow-soft">
                          {a.origen === "marketplace" ? "Marketplace" : "Invitada"}
                        </span>
                      </div>

                      <div className="p-4 -mt-7 relative">
                        {/* Identidad */}
                        <img
                          src={a.logo || DEFAULT_LOGO}
                          alt=""
                          className="h-12 w-12 rounded-full object-cover border-2 border-card shadow-soft bg-background"
                        />
                        <div className="mt-2 flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-semibold text-foreground truncate">
                              {a.name}
                            </h3>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {a.location}{a.type ? ` · ${typeLabel(a.type)}` : ""}
                            </p>
                          </div>
                          <GoogleRatingBadge agency={a} size="xs" />
                        </div>

                        {/* Description */}
                        {a.description && (
                          <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed line-clamp-3">
                            {a.description}
                          </p>
                        )}

                        {/* Mercados + stats fila */}
                        <div className="mt-3 flex items-center gap-3 flex-wrap">
                          {a.mercados && a.mercados.length > 0 && (
                            <span className="text-sm leading-none">
                              <MercadosFlags codes={a.mercados} max={6} />
                            </span>
                          )}
                          {a.teamSize != null && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Users className="h-3 w-3" strokeWidth={1.75} />
                              {a.teamSize} agentes
                            </span>
                          )}
                          {a.offices && a.offices.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Building2 className="h-3 w-3" strokeWidth={1.75} />
                              {a.offices.length} {a.offices.length === 1 ? "oficina" : "oficinas"}
                            </span>
                          )}
                        </div>

                        {/* Mensaje */}
                        {a.mensajeSolicitud && (
                          <div className="mt-3 rounded-xl bg-muted/50 p-3 border-l-2 border-warning/50">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                              Mensaje
                            </p>
                            <p className="text-[12px] text-foreground/80 italic leading-relaxed">
                              "{a.mensajeSolicitud}"
                            </p>
                          </div>
                        )}

                        {/* CTA único · entrar a la ficha para decidir */}
                        <button
                          onClick={() => {
                            setRequestsOpen(false);
                            navigate(`/colaboradores/${a.id}`);
                          }}
                          className="mt-4 w-full h-9 rounded-full bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors inline-flex items-center justify-center gap-1.5"
                        >
                          Ver ficha y decidir
                          <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ═══════════ Drawer de filtros ═══════════ */}
      <AnimatePresence>
        {filtersOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/25 backdrop-blur-sm"
              onClick={() => setFiltersOpen(false)}
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[420px] bg-card border-l border-border shadow-soft-lg flex flex-col"
            >
              {/* Header */}
              <header className="h-14 shrink-0 flex items-center justify-between px-5 border-b border-border">
                <div>
                  <h2 className="text-[15px] font-semibold tracking-tight">Filtros</h2>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {activeFilterCount === 0
                      ? "Ningún filtro aplicado"
                      : `${activeFilterCount} filtro${activeFilterCount > 1 ? "s" : ""} activo${activeFilterCount > 1 ? "s" : ""}`}
                  </p>
                </div>
                <button
                  onClick={() => setFiltersOpen(false)}
                  className="p-2 -mr-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Cerrar filtros"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
                <ChipGroup
                  title="Estado"
                  options={[
                    { value: "activa", label: "Activas" },
                    { value: "pausada", label: "Pausadas" },
                  ]}
                  values={estadoFilter === "todas" ? [] : [estadoFilter]}
                  onChange={(v) => setEstadoFilter((v[v.length - 1] ?? "todas") as typeof estadoFilter)}
                  multi={false}
                />

                <ChipGroup
                  title="Origen"
                  options={[
                    { value: "invited", label: "Invitada" },
                    { value: "marketplace", label: "Marketplace" },
                  ]}
                  values={origenFilter}
                  onChange={setOrigenFilter}
                />

                <ChipGroup
                  title="Tipo"
                  options={[
                    { value: "Agency", label: "Agencia" },
                    { value: "Broker", label: "Broker" },
                    { value: "Network", label: "Network" },
                  ]}
                  values={tipoFilter}
                  onChange={setTipoFilter}
                />

                <ChipGroup
                  title="Contrato"
                  options={[
                    { value: "vigente", label: "Vigente" },
                    { value: "por-expirar", label: "Por expirar" },
                    { value: "expirado", label: "Expirado" },
                    { value: "sin-contrato", label: "Sin contrato" },
                  ]}
                  values={contratoFilter}
                  onChange={setContratoFilter}
                />

                <ChipGroup
                  title="Mercados que atiende"
                  options={Array.from(new Set(agencies.flatMap((a) => a.mercados ?? [])))
                    .sort()
                    .map((code) => ({ value: code, label: `${flagOf(code)} ${code}` }))}
                  values={mercadosFilter}
                  onChange={setMercadosFilter}
                />

                <ChipGroup
                  title="Rating de Google mínimo"
                  options={[
                    { value: "4", label: "≥ 4 ★" },
                    { value: "3", label: "≥ 3 ★" },
                  ]}
                  values={minRating != null ? [String(minRating)] : []}
                  onChange={(v) => setMinRating(v.length ? parseInt(v[v.length - 1], 10) : null)}
                  multi={false}
                />

                {/* Favoritos toggle */}
                <div>
                  <h4 className="text-[13px] font-semibold text-foreground mb-2">Otros</h4>
                  <button
                    onClick={() => setSoloFavoritos((v) => !v)}
                    className={cn(
                      "inline-flex items-center gap-2 h-8 px-3.5 rounded-full border text-xs font-medium transition-colors",
                      soloFavoritos
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                    )}
                  >
                    <Star className={cn("h-3 w-3", soloFavoritos && "fill-primary")} strokeWidth={1.75} />
                    Solo favoritos
                  </button>
                </div>
              </div>

              {/* Footer */}
              <footer className="border-t border-border px-5 py-3 flex items-center justify-between gap-2">
                <button
                  onClick={clearAllFilters}
                  disabled={activeFilterCount === 0}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Limpiar todo
                </button>
                <button
                  onClick={() => setFiltersOpen(false)}
                  className="inline-flex items-center h-10 px-5 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors shadow-soft"
                >
                  Ver {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
                </button>
              </footer>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ════════ SUBCOMPONENTES ════════ */

/** Grupo de chips multiselección estilo FilterGroup de Promociones. */
function ChipGroup({
  title, options, values, onChange, multi = true,
}: {
  title: string;
  options: { value: string; label: string }[];
  values: string[];
  onChange: (v: string[]) => void;
  multi?: boolean;
}) {
  if (options.length === 0) return null;
  const toggle = (v: string) => {
    if (multi) {
      onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
    } else {
      onChange(values.includes(v) ? [] : [v]);
    }
  };
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="text-[13px] font-semibold text-foreground">{title}</h4>
        {values.length > 0 && (
          <button
            onClick={() => onChange([])}
            className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
          >
            Limpiar
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const selected = values.includes(opt.value);
          return (
            <button
              key={opt.value}
              onClick={() => toggle(opt.value)}
              className={cn(
                "inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-medium transition-colors",
                selected
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
              )}
            >
              {selected && <Check className="h-3 w-3" strokeWidth={3} />}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}


/** Chip del estado del contrato. */
function ContractChip({ agency: a, size = "sm" }: { agency: Agency; size?: "sm" | "xs" }) {
  const c = getContractStatus(a);
  if (c.state === "sin-contrato") return null;
  const cls =
    c.state === "vigente"
      ? "bg-success/10 text-success border-success/25"
      : c.state === "por-expirar"
        ? "bg-warning/10 text-warning border-warning/25"
        : "bg-destructive/5 text-destructive border-destructive/25";
  const label =
    c.state === "vigente"
      ? "Contrato vigente"
      : c.state === "por-expirar"
        ? `Contrato · ${c.daysLeft}d`
        : `Contrato expirado`;
  const Icon = c.state === "expirado" ? AlertTriangle : FileSignature;
  return (
    <span className={cn(
      "inline-flex items-center gap-1 font-medium border rounded-full",
      size === "xs" ? "text-[10px] px-2 py-0.5" : "text-[11px] px-2.5 py-0.5",
      cls,
    )}>
      <Icon className="h-3 w-3" strokeWidth={2} />
      {label}
    </span>
  );
}

/** Rating en estrellas (1-5). */
function RatingStars({ value, size = "xs" }: { value: number; size?: "xs" | "sm" }) {
  const s = size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5";
  return (
    <span className="inline-flex items-center gap-0.5" title={`Rating: ${value}/5`}>
      {Array.from({ length: 5 }, (_, i) => {
        const filled = i < value;
        return (
          <Star
            key={i}
            className={cn(s, filled ? "fill-warning text-warning" : "text-muted-foreground/30")}
            strokeWidth={1.5}
          />
        );
      })}
    </span>
  );
}

/** Rating público de Google Business con atribución obligatoria (Places ToS).
 *  "G" en colores de marca, rating, estrella ámbar, nº de reseñas y link
 *  opcional a la ficha de Maps. */
function GoogleRatingBadge({
  agency: a, size = "sm",
}: { agency: Agency; size?: "xs" | "sm" }) {
  if (a.googleRating == null || a.googleRating <= 0) return null;
  const textSize = size === "xs" ? "text-[10px]" : "text-[11px]";
  const starSize = size === "xs" ? "h-2.5 w-2.5" : "h-3 w-3";

  const badge = (
    <span className={cn(
      "inline-flex items-center gap-1.5 border border-border bg-card rounded-full px-2 py-0.5",
      textSize,
    )}>
      {/* "G" Google */}
      <span className="relative inline-flex items-center justify-center h-4 w-4 rounded-full bg-white border border-border shrink-0">
        {/* 9px justificado: la "G" vive dentro de un círculo de 16px (h-4 w-4). */}
        <span className="font-bold text-[9px] leading-none" aria-hidden="true"
          style={{
            background: "linear-gradient(45deg,#4285F4 0%,#34A853 35%,#FBBC05 65%,#EA4335 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}>
          G
        </span>
      </span>
      <span className="font-semibold text-foreground tabular-nums">{a.googleRating.toFixed(1)}</span>
      <Star className={cn(starSize, "fill-warning text-warning")} strokeWidth={1.5} />
      <span className="text-muted-foreground tabular-nums">
        ({a.googleRatingsTotal?.toLocaleString("es-ES")})
      </span>
    </span>
  );

  return a.googleMapsUrl ? (
    <a
      href={a.googleMapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={`Rating en Google · ${a.googleRatingsTotal} reseñas · ver en Maps`}
      className="hover:border-foreground/30 transition-colors"
    >
      {badge}
    </a>
  ) : (
    <span title={`Rating en Google · ${a.googleRatingsTotal} reseñas`}>{badge}</span>
  );
}

/** Chips de banderas (mercados que atiende). */
function MercadosFlags({ codes, max = 5 }: { codes: string[]; max?: number }) {
  const visible = codes.slice(0, max);
  const rest = codes.length - visible.length;
  return (
    <span className="inline-flex items-center gap-0.5 text-base leading-none">
      {visible.map((c) => (
        <span key={c} title={c}>{flagOf(c)}</span>
      ))}
      {rest > 0 && (
        <span className="ml-1 text-[10px] text-muted-foreground font-medium">+{rest}</span>
      )}
    </span>
  );
}

/** Chip de última actividad con color por freshness. */
function ActivityChip({ iso, size = "xs" }: { iso?: string; size?: "xs" | "sm" }) {
  const { label, tone } = relativeActivity(iso);
  const cls =
    tone === "fresh"
      ? "bg-success/10 text-success border-success/25"
      : tone === "ok"
        ? "bg-muted text-foreground border-border"
        : "bg-muted/60 text-muted-foreground border-border";
  return (
    <span className={cn(
      "inline-flex items-center gap-1 font-medium border rounded-full",
      size === "xs" ? "text-[10px] px-2 py-0.5" : "text-[11px] px-2.5 py-0.5",
      cls,
    )}>
      <Activity className="h-3 w-3" strokeWidth={2} />
      {label}
    </span>
  );
}

/* Card grande · destacados */
export function FeatureCardV3({
  agency: a, onPause, onDelete, highlight = "",
}: { agency: Agency; onPause?: () => void; onDelete?: () => void; highlight?: string }) {
  const navigate = useNavigate();
  const { isFavorite, toggleFavorite } = useFavoriteAgencies();
  const fav = isFavorite(a.id);
  const goToFicha = () => navigate(`/colaboradores/${a.id}`);

  return (
    <article className="group relative overflow-hidden rounded-2xl bg-card border border-border shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 transition-all duration-200">
      {/* Cover */}
      <div
        className="h-28 bg-muted relative"
        style={{
          backgroundImage: `url(${a.cover || DEFAULT_COVER})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(a.id);
            toast.success(fav ? "Quitado de favoritos" : "Añadido a favoritos");
          }}
          className={cn(
            "absolute top-3 right-3 h-8 w-8 rounded-full backdrop-blur-md transition-colors flex items-center justify-center",
            fav ? "bg-background text-foreground" : "bg-background/80 text-muted-foreground hover:text-foreground",
          )}
          aria-label={fav ? "Quitar de favoritos" : "Añadir a favoritos"}
        >
          <Star className={cn("h-3.5 w-3.5", fav && "fill-foreground")} strokeWidth={1.75} />
        </button>
      </div>

      <div className="p-4 -mt-10 relative">
        <img
          src={a.logo || DEFAULT_LOGO}
          alt=""
          className="h-14 w-14 rounded-full object-cover border-2 border-card shadow-soft bg-background"
        />

        <div className="mt-3">
          <div className="flex items-start gap-2">
            <h3 className="text-base font-bold text-foreground truncate leading-tight flex-1 min-w-0">
              <Highlight text={a.name} query={highlight} />
            </h3>
            <GoogleRatingBadge agency={a} size="xs" />
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            <Highlight text={a.location} query={highlight} />
          </p>
        </div>

        {/* Mercados */}
        {a.mercados && a.mercados.length > 0 && (
          <div className="mt-3">
            <MercadosFlags codes={a.mercados} max={6} />
          </div>
        )}

        {/* Chips de estado */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {(() => {
            const s = getAgencyShareStats(a);
            return (
              <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full bg-success/10 border border-success/25 text-[10px] font-semibold text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                {s.sharedActive}/{s.activeTotal} compartidas
              </span>
            );
          })()}
          <ContractChip agency={a} size="xs" />
        </div>

        {/* Stats grid (3 cols) */}
        <div className="grid grid-cols-3 gap-2 mt-4 rounded-xl bg-muted/60 p-3">
          <MetricBlock label="Visitas" value={a.visitsCount ?? 0} />
          <MetricBlock label="Registros" value={a.registrosAportados ?? a.registrations} />
          <MetricBlock label="Ventas" value={a.ventasCerradas ?? 0} />
        </div>

        {/* Metadata row */}
        <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
          {a.collaboratingSince && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" strokeWidth={1.75} />
              Desde {a.collaboratingSince}
            </span>
          )}
          {a.teamSize != null && (
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" strokeWidth={1.75} />
              {a.teamSize} agentes
            </span>
          )}
        </div>



        <div className="flex items-center justify-between mt-3 gap-2">
          <button
            onClick={goToFicha}
            className="flex-1 h-9 rounded-full bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors inline-flex items-center justify-center gap-1.5"
          >
            Ver ficha
            <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
          </button>
          {(onPause || onDelete) && (
            <KebabMenu
              onPause={onPause ?? (() => {})}
              onDelete={onDelete ?? (() => {})}
              paused={getEstado(a) === "pausada"}
            />
          )}
        </div>
      </div>
    </article>
  );
}

function MetricBlock({
  label, value, icon: Icon,
}: { label: string; value: string | number; icon?: typeof Star }) {
  return (
    <div className="text-center min-w-0">
      {Icon && <Icon className="h-3 w-3 text-muted-foreground mx-auto mb-1" strokeWidth={1.75} />}
      <p className="text-[13px] font-bold text-foreground tabular-nums leading-none truncate">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1 truncate">{label}</p>
    </div>
  );
}


function KebabMenu({
  onPause, onDelete, paused,
}: { onPause: () => void; onDelete: () => void; paused: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="h-8 w-8 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center"
        aria-label="Acciones"
      >
        <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-xl shadow-soft-lg min-w-[160px] py-1.5">
            <MenuItem
              icon={paused ? Play : Pause}
              label={paused ? "Reanudar" : "Pausar"}
              onClick={() => { onPause(); setOpen(false); }}
            />
            <MenuItem icon={Mail} label="Enviar email" onClick={() => { toast.info("Email — próximamente"); setOpen(false); }} />
            <div className="h-px bg-border/60 my-1" />
            <MenuItem icon={Trash2} label="Eliminar" danger onClick={() => { onDelete(); setOpen(false); }} />
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon, label, onClick, danger,
}: { icon: typeof Users; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-left hover:bg-muted transition-colors",
        danger && "text-destructive hover:bg-destructive/10",
      )}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
      {label}
    </button>
  );
}
