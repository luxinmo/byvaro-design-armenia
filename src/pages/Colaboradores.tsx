/**
 * Pantalla · Colaboradores (`/colaboradores`) · Vista Promotor
 *
 * QUÉ HACE
 * ────────
 * Vista del promotor sobre su red de agencias colaboradoras. Sustituye al
 * módulo legacy "Agencies". Tiene dos sub-tabs con estilo subrayado (no
 * pills): **Red** (default) y **Analítica**.
 *
 * - Tab "Red": grid de cards de agencias con KPIs operativos (promociones
 *   donde colabora, registros aportados, ventas cerradas, comisión media),
 *   badges de estado y origen (invited vs marketplace), filtros y bandeja
 *   de solicitudes pendientes destacada arriba.
 * - Tab "Analítica": 4 KPIs top, heatmap mensual (12m × N agencias),
 *   top 5 agencias por ventas y barra de conversión registros→ventas.
 *
 * Acciones: invitar agencia (modal reusable), aprobar/rechazar solicitud
 * marketplace, pausar/reactivar, abrir ficha (TODO: ruta `/colaboradores/:id`).
 *
 * CÓMO SE USA
 * ───────────
 * Se monta en `/colaboradores` via App.tsx. Solo visible para Promotor
 * (la vista Agencia no tiene acceso a este menú — ver docs/ia-menu.md).
 *
 * BACKEND
 * ───────
 * Ver endpoints esperados en docs/screens/colaboradores.md.
 */

import { useMemo, useState } from "react";
import {
  Handshake, Search, X, Plus, Check, TrendingUp, Users, Euro, FileText,
  Star, Store, UserPlus, MoreHorizontal, Pause, Play, ExternalLink,
  Trash2, Mail, Sparkles, Building2,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { agencies as baseAgencies, type Agency } from "@/data/agencies";
import {
  activityMonths, collaboratorActivity, getActivityAgencies, getMaxActivity,
  getLastMonthRegistrations,
} from "@/data/collaboratorActivity";
import { Switch } from "@/components/ui/Switch";
import { Tag } from "@/components/ui/Tag";
import { InvitarAgenciaModal } from "@/components/empresa/InvitarAgenciaModal";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════ */
function formatEuro(n: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

/** Devuelve el estado operativo normalizado de una agencia. Si no tiene
 *  `estadoColaboracion` explícito (datos legacy), lo deriva de `status`. */
function getEstado(a: Agency): "activa" | "contrato-pendiente" | "pausada" {
  if (a.estadoColaboracion) return a.estadoColaboracion;
  if (a.status === "active") return "activa";
  if (a.status === "pending") return "contrato-pendiente";
  return "pausada";
}

/** Devuelve el origen de la agencia — default "invited" si no está en
 *  el dataset (datos legacy previos al módulo Colaboradores v2). */
function getOrigen(a: Agency): "invited" | "marketplace" {
  return a.origen ?? "invited";
}

const estadoLabels: Record<string, { label: string; variant: "success" | "warning" | "muted" }> = {
  "activa": { label: "Activa", variant: "success" },
  "contrato-pendiente": { label: "Contrato pendiente", variant: "warning" },
  "pausada": { label: "Pausada", variant: "muted" },
};

/* ═══════════════════════════════════════════════════════════════════
   PAGE · Colaboradores
   ═══════════════════════════════════════════════════════════════════ */
export default function Colaboradores() {
  /* ─── Estado local ─── */
  const [tab, setTab] = useState<"red" | "analitica">("red");
  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<string[]>([]);
  const [origenFilter, setOrigenFilter] = useState<string[]>([]);
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [invitarOpen, setInvitarOpen] = useState(false);
  // Overlay local que permite "mutar" agencias (aprobar/rechazar/pausar)
  // sin tocar el mock global. Se mapea por id a un estado parcial.
  const [overrides, setOverrides] = useState<Record<string, Partial<Agency> | "deleted">>({});

  /* ─── Dataset efectivo (aplicando overrides) ─── */
  const agencies = useMemo<Agency[]>(() => {
    return baseAgencies
      .map((a) => {
        const ov = overrides[a.id];
        if (ov === "deleted") return null;
        return ov ? { ...a, ...ov } : a;
      })
      .filter(Boolean) as Agency[];
  }, [overrides]);

  /* ─── Pendientes destacadas (bandeja superior) ─── */
  const pendientes = useMemo(
    () => agencies.filter((a) => a.solicitudPendiente || a.isNewRequest),
    [agencies],
  );

  /* ─── Filtros combinados para el grid principal ─── */
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return agencies.filter((a) => {
      if (a.solicitudPendiente || a.isNewRequest) {
        // Las solicitudes viven en su sección destacada. Si `soloPendientes`
        // está ON, entonces sí queremos verlas aquí mezcladas; si no, se
        // renderizan arriba y se ocultan del grid.
        if (!soloPendientes) return false;
      }
      if (q) {
        const hay =
          a.name.toLowerCase().includes(q) ||
          a.location.toLowerCase().includes(q);
        if (!hay) return false;
      }
      if (estadoFilter.length > 0) {
        if (!estadoFilter.includes(getEstado(a))) return false;
      }
      if (origenFilter.length > 0) {
        if (!origenFilter.includes(getOrigen(a))) return false;
      }
      return true;
    });
  }, [agencies, search, estadoFilter, origenFilter, soloPendientes]);

  /* ─── Acciones ─── */
  const handleAprobar = (id: string) => {
    setOverrides((prev) => ({
      ...prev,
      [id]: {
        ...(typeof prev[id] === "object" ? prev[id] : {}),
        solicitudPendiente: false,
        isNewRequest: false,
        estadoColaboracion: "activa",
        status: "active",
      },
    }));
    toast.success("Solicitud aprobada", {
      description: "La agencia ya puede colaborar en tus promociones.",
    });
    // TODO(backend): POST /api/collaborators/:id/approve
  };
  const handleRechazar = (id: string) => {
    setOverrides((prev) => ({ ...prev, [id]: "deleted" }));
    toast.success("Solicitud rechazada");
    // TODO(backend): POST /api/collaborators/:id/reject
  };
  const handlePausar = (id: string) => {
    const a = agencies.find((x) => x.id === id);
    if (!a) return;
    const nuevoEstado = getEstado(a) === "pausada" ? "activa" : "pausada";
    setOverrides((prev) => ({
      ...prev,
      [id]: {
        ...(typeof prev[id] === "object" ? prev[id] : {}),
        estadoColaboracion: nuevoEstado,
      },
    }));
    toast.success(
      nuevoEstado === "pausada" ? "Colaboración pausada" : "Colaboración reanudada",
    );
    // TODO(backend): POST /api/collaborators/:id/pause  o  /resume
  };

  /* ─── Contadores top ─── */
  const counters = useMemo(() => {
    const act = agencies.filter((a) => getEstado(a) === "activa").length;
    return { total: agencies.length, activas: act, pendientes: pendientes.length };
  }, [agencies, pendientes]);

  return (
    <div className="flex flex-col min-h-full bg-background">
      <Toaster position="top-center" richColors closeButton />

      {/* ══════════ HEADER ══════════ */}
      <div className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-3">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
          {/* Título */}
          <div className="shrink-0 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground leading-none">
              Red
            </p>
            <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight leading-tight mt-1">
              Colaboradores
            </h1>
            <p className="text-[12.5px] text-muted-foreground mt-1">
              <span className="font-semibold text-foreground tnum">{counters.total}</span>{" "}
              agencias ·{" "}
              <span className="text-emerald-600 font-semibold tnum">{counters.activas}</span>{" "}
              activas
              {counters.pendientes > 0 && (
                <>
                  {" · "}
                  <span className="text-amber-700 font-semibold tnum">
                    {counters.pendientes}
                  </span>{" "}
                  pendientes
                </>
              )}
            </p>
          </div>

          {/* CTA */}
          <div className="flex items-center gap-2 sm:ml-auto">
            <button
              onClick={() => setInvitarOpen(true)}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors shadow-soft shrink-0"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Invitar agencia</span>
            </button>
          </div>
        </div>
      </div>

      <div className="h-px bg-border/60" />

      {/* ══════════ TABS (subrayado · patrón DeveloperPromotionDetail) ══════════ */}
      <nav
        role="tablist"
        className="px-4 sm:px-6 lg:px-8 border-b border-border overflow-x-auto no-scrollbar"
      >
        <div className="max-w-[1400px] mx-auto flex items-center gap-1">
          {([
            { key: "red", label: "Red" },
            { key: "analitica", label: "Analítica" },
          ] as const).map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={cn(
                  "relative px-4 sm:px-5 py-3 text-[13px] font-medium whitespace-nowrap transition-colors inline-flex items-center gap-1.5",
                  active
                    ? "text-primary after:absolute after:bottom-[-1px] after:left-0 after:right-0 after:h-[2px] after:bg-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                {t.key === "red" && pendientes.length > 0 && (
                  <span className="h-4 min-w-[16px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold inline-flex items-center justify-center tnum">
                    {pendientes.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ══════════ BODY ══════════ */}
      <div className="flex-1 px-4 sm:px-6 lg:px-8 pt-5 pb-8">
        <div className="max-w-[1400px] mx-auto">
          {tab === "red" ? (
            <RedTab
              agencies={filtered}
              pendientes={soloPendientes ? [] : pendientes}
              search={search}
              setSearch={setSearch}
              estadoFilter={estadoFilter}
              setEstadoFilter={setEstadoFilter}
              origenFilter={origenFilter}
              setOrigenFilter={setOrigenFilter}
              soloPendientes={soloPendientes}
              setSoloPendientes={setSoloPendientes}
              onAprobar={handleAprobar}
              onRechazar={handleRechazar}
              onPausar={handlePausar}
              onInvitar={() => setInvitarOpen(true)}
            />
          ) : (
            <AnaliticaTab agencies={agencies} />
          )}
        </div>
      </div>

      {/* ══════════ Modal Invitar Agencia ══════════ */}
      {invitarOpen && (
        <InvitarAgenciaModal onClose={() => setInvitarOpen(false)} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TAB · Red
   ═══════════════════════════════════════════════════════════════════ */
function RedTab({
  agencies, pendientes, search, setSearch,
  estadoFilter, setEstadoFilter, origenFilter, setOrigenFilter,
  soloPendientes, setSoloPendientes,
  onAprobar, onRechazar, onPausar, onInvitar,
}: {
  agencies: Agency[];
  pendientes: Agency[];
  search: string; setSearch: (v: string) => void;
  estadoFilter: string[]; setEstadoFilter: (v: string[]) => void;
  origenFilter: string[]; setOrigenFilter: (v: string[]) => void;
  soloPendientes: boolean; setSoloPendientes: (v: boolean) => void;
  onAprobar: (id: string) => void;
  onRechazar: (id: string) => void;
  onPausar: (id: string) => void;
  onInvitar: () => void;
}) {
  return (
    <div className="space-y-5">
      {/* ─── Filter bar sticky en móvil ─── */}
      <div className="sticky top-0 z-10 -mx-4 sm:mx-0 px-4 sm:px-0 py-2 sm:py-0 bg-background/95 backdrop-blur sm:backdrop-blur-none sm:bg-transparent">
        <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-3">
          {/* Buscador */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 z-10" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar agencia por nombre o ciudad..."
              className="w-full h-9 pl-9 pr-9 text-sm bg-card border border-border rounded-full focus:border-primary outline-none transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filtros de estado y origen + switch pendientes */}
          <div className="flex items-center gap-2 flex-wrap">
            <FilterPill
              label="Estado"
              options={[
                { value: "activa", label: "Activa" },
                { value: "contrato-pendiente", label: "Contrato pendiente" },
                { value: "pausada", label: "Pausada" },
              ]}
              values={estadoFilter}
              onChange={setEstadoFilter}
            />
            <FilterPill
              label="Origen"
              options={[
                { value: "invited", label: "Invitada" },
                { value: "marketplace", label: "Marketplace" },
              ]}
              values={origenFilter}
              onChange={setOrigenFilter}
            />
            <label className="inline-flex items-center gap-2 h-9 px-3 rounded-full border border-border bg-card cursor-pointer hover:border-foreground/30 transition-colors">
              <Switch
                checked={soloPendientes}
                onCheckedChange={setSoloPendientes}
                ariaLabel="Solo con solicitud pendiente"
              />
              <span className="text-[12.5px] font-medium">Solo pendientes</span>
            </label>
          </div>
        </div>
      </div>

      {/* ─── Bandeja de solicitudes pendientes ─── */}
      {pendientes.length > 0 && (
        <section
          aria-label="Solicitudes pendientes"
          className="rounded-2xl border border-amber-300/40 bg-amber-50/30 p-4 sm:p-5"
        >
          <header className="flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-xl bg-amber-500/15 grid place-items-center">
              <Sparkles className="h-4 w-4 text-amber-700" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                {pendientes.length}{" "}
                {pendientes.length === 1 ? "solicitud pendiente" : "solicitudes pendientes"}
              </h2>
              <p className="text-[11.5px] text-muted-foreground">
                Agencias que quieren unirse a tu red desde el marketplace.
              </p>
            </div>
          </header>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendientes.map((a) => (
              <PendienteCard
                key={a.id}
                agency={a}
                onAprobar={() => onAprobar(a.id)}
                onRechazar={() => onRechazar(a.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* ─── Grid principal ─── */}
      {agencies.length === 0 ? (
        <EmptyState onInvitar={onInvitar} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {agencies.map((a) => (
            <AgencyCard
              key={a.id}
              agency={a}
              onPausar={() => onPausar(a.id)}
              onRechazar={() => onRechazar(a.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   AgencyCard · tarjeta principal del grid de Red
   ═══════════════════════════════════════════════════════════════════ */
function AgencyCard({
  agency: a, onPausar, onRechazar,
}: {
  agency: Agency;
  onPausar: () => void;
  onRechazar: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const estado = getEstado(a);
  const estadoCfg = estadoLabels[estado];
  const origen = getOrigen(a);

  return (
    <article
      className={cn(
        "relative group bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-soft",
        "hover:shadow-soft-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer",
      )}
      onClick={() => {
        // TODO(ui): abrir ficha de agencia cuando exista /colaboradores/:id
        toast.info("Ficha de agencia", {
          description: "La ficha detallada se diseña en una próxima iteración.",
        });
      }}
    >
      {/* Header: avatar + nombre + menú */}
      <header className="flex items-start gap-3 mb-3">
        <img
          src={a.logo}
          alt=""
          className="h-10 w-10 rounded-full bg-muted shrink-0 border border-border"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground truncate">
              {a.name}
            </h3>
          </div>
          <p className="text-[11.5px] text-muted-foreground truncate mt-0.5">
            {a.location}
          </p>
        </div>

        {/* Kebab menu */}
        <div
          className="relative shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Acciones"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-xl shadow-soft-lg min-w-[180px] py-1.5">
                <MenuItem icon={ExternalLink} label="Abrir ficha" onClick={() => { toast.info("Ficha — próximamente"); setMenuOpen(false); }} />
                <MenuItem icon={Mail} label="Enviar email" onClick={() => { toast.info("Email compuesto — próximamente"); setMenuOpen(false); }} />
                <div className="h-px bg-border/60 my-1" />
                {estado === "pausada" ? (
                  <MenuItem icon={Play} label="Reanudar" onClick={() => { onPausar(); setMenuOpen(false); }} />
                ) : (
                  <MenuItem icon={Pause} label="Pausar" onClick={() => { onPausar(); setMenuOpen(false); }} />
                )}
                <MenuItem
                  icon={Trash2}
                  label="Eliminar"
                  danger
                  onClick={() => { onRechazar(); setMenuOpen(false); }}
                />
              </div>
            </>
          )}
        </div>
      </header>

      {/* Badges fila 1: estado + origen */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        <Tag variant={estadoCfg.variant} size="sm" shape="pill">
          {estadoCfg.label}
        </Tag>
        <Tag
          variant={origen === "marketplace" ? "active" : "default"}
          size="sm"
          shape="pill"
          icon={origen === "marketplace" ? <Store className="h-3 w-3" /> : <UserPlus className="h-3 w-3" />}
        >
          {origen === "marketplace" ? "Marketplace" : "Invitada"}
        </Tag>
      </div>

      {/* KPIs row */}
      <div className="grid grid-cols-4 gap-2 pt-3 border-t border-border/60">
        <KpiMini
          label="Promos"
          value={String(a.promotionsCollaborating.length)}
        />
        <KpiMini
          label="Registros"
          value={String(a.registrosAportados ?? a.registrations ?? 0)}
        />
        <KpiMini
          label="Ventas"
          value={String(a.ventasCerradas ?? 0)}
        />
        <KpiMini
          label="Comisión"
          value={a.comisionMedia ? `${a.comisionMedia}%` : "—"}
        />
      </div>
    </article>
  );
}

function KpiMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium truncate">
        {label}
      </p>
      <p className="text-sm font-semibold text-foreground tnum mt-0.5">{value}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PendienteCard · card más estrecha para solicitudes
   ═══════════════════════════════════════════════════════════════════ */
function PendienteCard({
  agency: a, onAprobar, onRechazar,
}: {
  agency: Agency;
  onAprobar: () => void;
  onRechazar: () => void;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-3 sm:p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <img
          src={a.logo}
          alt=""
          className="h-9 w-9 rounded-full bg-muted shrink-0 border border-border"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">{a.name}</p>
          <p className="text-[11.5px] text-muted-foreground truncate">
            {a.location} ·{" "}
            <span className="text-amber-700 font-medium">
              {getOrigen(a) === "marketplace" ? "Marketplace" : "Invitada"}
            </span>
          </p>
        </div>
      </div>

      {a.mensajeSolicitud && (
        <p className="text-[12px] text-muted-foreground leading-relaxed italic border-l-2 border-border pl-2.5">
          "{a.mensajeSolicitud}"
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={onAprobar}
          className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-full bg-foreground text-background text-xs font-medium hover:bg-foreground/90 transition-colors"
        >
          <Check className="h-3.5 w-3.5" />
          Aprobar
        </button>
        <button
          onClick={onRechazar}
          className="inline-flex items-center justify-center h-8 px-3 rounded-full border border-border bg-card text-xs font-medium text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-colors"
        >
          Rechazar
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   FilterPill · dropdown multi-select compacto (bg-foreground si activo)
   ═══════════════════════════════════════════════════════════════════ */
function FilterPill({
  label, options, values, onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const activeCount = values.length;
  const active = activeCount > 0;

  const toggle = (v: string) => {
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-[12.5px] font-medium transition-colors",
          active
            ? "bg-foreground text-background border-foreground"
            : "bg-card text-foreground border-border hover:border-foreground/30",
        )}
      >
        {label}
        {active && (
          <span className="h-4 min-w-[16px] px-1 rounded-full bg-background/20 text-[10px] font-bold inline-flex items-center justify-center tnum">
            {activeCount}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-xl shadow-soft-lg min-w-[220px] p-1.5">
            {options.map((opt) => {
              const selected = values.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  onClick={() => toggle(opt.value)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-1.5 rounded-lg hover:bg-muted/40 text-left transition-colors"
                >
                  <span
                    className={cn(
                      "text-[12.5px]",
                      selected ? "font-medium text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {opt.label}
                  </span>
                  {selected && (
                    <Check className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />
                  )}
                </button>
              );
            })}
            {values.length > 0 && (
              <>
                <div className="h-px bg-border/60 my-1" />
                <button
                  onClick={() => onChange([])}
                  className="w-full px-3 py-1.5 text-[12px] text-muted-foreground hover:text-destructive text-left rounded-lg hover:bg-muted/40 transition-colors"
                >
                  Limpiar
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MenuItem · fila del dropdown kebab
   ═══════════════════════════════════════════════════════════════════ */
function MenuItem({
  icon: Icon, label, onClick, danger,
}: {
  icon: typeof ExternalLink;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-1.5 text-[12.5px] hover:bg-muted/40 text-left transition-colors",
        danger ? "text-destructive" : "text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   EmptyState
   ═══════════════════════════════════════════════════════════════════ */
function EmptyState({ onInvitar }: { onInvitar: () => void }) {
  return (
    <div className="py-20 text-center">
      <div className="h-12 w-12 rounded-2xl bg-muted grid place-items-center mx-auto mb-4">
        <Handshake className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold">Sin resultados</h3>
      <p className="text-[12.5px] text-muted-foreground mt-1 mb-4">
        Prueba a cambiar los filtros o invita a una agencia nueva.
      </p>
      <button
        onClick={onInvitar}
        className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors shadow-soft"
      >
        <Plus className="h-3.5 w-3.5" /> Invitar agencia
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TAB · Analítica
   ═══════════════════════════════════════════════════════════════════ */
function AnaliticaTab({ agencies }: { agencies: Agency[] }) {
  const totalAgencias = agencies.length;
  const registrosMes = getLastMonthRegistrations();
  const totalVentasMes = useMemo(() => {
    // Aproximamos: suma de ventasCerradas (mock agregado, no por mes)
    // dividido por 6 → rango razonable de "este mes" vs histórico.
    const total = agencies.reduce((acc, a) => acc + (a.ventasCerradas ?? 0), 0);
    return Math.max(1, Math.round(total / 6));
  }, [agencies]);

  const comisionProm = useMemo(() => {
    const valores = agencies
      .map((a) => a.comisionMedia ?? 0)
      .filter((v) => v > 0);
    if (valores.length === 0) return 0;
    return valores.reduce((a, b) => a + b, 0) / valores.length;
  }, [agencies]);

  const totalRegistros = agencies.reduce(
    (acc, a) => acc + (a.registrosAportados ?? 0),
    0,
  );
  const totalVentas = agencies.reduce(
    (acc, a) => acc + (a.ventasCerradas ?? 0),
    0,
  );
  const conversion =
    totalRegistros > 0 ? (totalVentas / totalRegistros) * 100 : 0;

  const top5 = useMemo(() => {
    return [...agencies]
      .filter((a) => !(a.solicitudPendiente || a.isNewRequest))
      .sort((a, b) => (b.ventasCerradas ?? 0) - (a.ventasCerradas ?? 0))
      .slice(0, 5);
  }, [agencies]);

  const heatAgencies = getActivityAgencies();
  const maxActivity = getMaxActivity();

  return (
    <div className="space-y-5">
      {/* ─── 4 KPIs top ─── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          icon={Handshake}
          label="Agencias totales"
          value={String(totalAgencias)}
          iconTone="bg-amber-500/10"
          iconColor="text-amber-600"
          sub="En tu red"
        />
        <KpiCard
          icon={FileText}
          label="Registros (mes)"
          value={String(registrosMes)}
          iconTone="bg-primary/10"
          iconColor="text-primary"
          sub={`${totalRegistros} histórico`}
        />
        <KpiCard
          icon={TrendingUp}
          label="Ventas (mes)"
          value={String(totalVentasMes)}
          iconTone="bg-emerald-500/10"
          iconColor="text-emerald-600"
          sub={`${totalVentas} histórico`}
        />
        <KpiCard
          icon={Euro}
          label="Comisión media"
          value={`${comisionProm.toFixed(1)}%`}
          iconTone="bg-violet-500/10"
          iconColor="text-violet-600"
          sub="Media ponderada"
        />
      </section>

      {/* ─── Grid: Top 5 + Conversión ─── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* Top 5 agencias */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl shadow-soft overflow-hidden">
          <header className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-border">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                Top 5 agencias
              </h3>
              <p className="text-[11.5px] text-muted-foreground mt-0.5">
                Por ventas cerradas
              </p>
            </div>
          </header>
          <ul className="divide-y divide-border">
            {top5.map((a, i) => (
              <li
                key={a.id}
                className="flex items-center gap-3 px-4 sm:px-5 py-3"
              >
                <div
                  className={cn(
                    "h-7 w-7 rounded-full grid place-items-center text-[11px] font-bold tnum shrink-0",
                    i === 0
                      ? "bg-amber-500/15 text-amber-700"
                      : i === 1
                      ? "bg-muted-foreground/10 text-muted-foreground"
                      : i === 2
                      ? "bg-amber-700/10 text-amber-800"
                      : "bg-muted/40 text-muted-foreground",
                  )}
                >
                  {i + 1}
                </div>
                <img
                  src={a.logo}
                  alt=""
                  className="h-8 w-8 rounded-full bg-muted shrink-0 border border-border"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-foreground truncate">
                    {a.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {a.location} · {a.promotionsCollaborating.length} promo·
                    {(a.registrosAportados ?? 0)} registros
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-foreground tnum">
                    {a.ventasCerradas ?? 0}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    ventas
                  </p>
                </div>
              </li>
            ))}
            {top5.length === 0 && (
              <li className="px-5 py-8 text-center text-xs text-muted-foreground">
                Aún no hay ventas cerradas.
              </li>
            )}
          </ul>
        </div>

        {/* Conversión */}
        <div className="bg-card border border-border rounded-2xl shadow-soft p-4 sm:p-5 flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Conversión registros → ventas
            </h3>
            <p className="text-[11.5px] text-muted-foreground mt-0.5">
              Global de la red
            </p>
          </div>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-[32px] font-bold tnum tracking-tight leading-none">
              {conversion.toFixed(1)}
            </span>
            <span className="text-lg font-semibold text-muted-foreground">%</span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-500"
              style={{ width: `${Math.min(100, conversion * 5)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
            <span>
              <span className="font-semibold text-foreground tnum">
                {totalRegistros}
              </span>{" "}
              registros
            </span>
            <span>
              <span className="font-semibold text-foreground tnum">
                {totalVentas}
              </span>{" "}
              ventas
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-auto leading-relaxed">
            La conversión objetivo del sector inmobiliario de obra nueva suele
            situarse entre el <strong>4%</strong> y el <strong>8%</strong>.
          </p>
        </div>
      </section>

      {/* ─── Heatmap ─── */}
      <section className="bg-card border border-border rounded-2xl shadow-soft overflow-hidden">
        <header className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-border">
          <div>
            <h3 className="text-sm font-semibold">Actividad mensual</h3>
            <p className="text-[11.5px] text-muted-foreground mt-0.5">
              Registros aportados por agencia · últimos 12 meses
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span>Menos</span>
            {[0.08, 0.16, 0.32, 0.48, 0.72].map((op) => (
              <span
                key={op}
                className="h-3 w-3 rounded-sm bg-primary"
                style={{ opacity: op }}
              />
            ))}
            <span>Más</span>
          </div>
        </header>

        <div className="p-4 sm:p-5 overflow-x-auto">
          <div
            className="grid gap-1.5 min-w-[640px]"
            style={{
              gridTemplateColumns: `minmax(160px, 1fr) repeat(${activityMonths.length}, minmax(28px, 1fr))`,
            }}
          >
            {/* Header row */}
            <div />
            {activityMonths.map((m) => (
              <div
                key={m}
                className="text-[10px] text-muted-foreground uppercase tracking-wider text-center font-medium"
              >
                {m}
              </div>
            ))}

            {/* Rows */}
            {heatAgencies.map((a) => {
              const row = collaboratorActivity[a.id] ?? [];
              return (
                <HeatmapRow
                  key={a.id}
                  agency={a}
                  values={row}
                  maxValue={maxActivity}
                />
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   KpiCard (versión ligera para tab Analítica)
   ═══════════════════════════════════════════════════════════════════ */
function KpiCard({
  icon: Icon, label, value, sub, iconTone, iconColor,
}: {
  icon: typeof Handshake;
  label: string;
  value: string;
  sub?: string;
  iconTone: string;
  iconColor: string;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-soft">
      <div className={cn("h-9 w-9 rounded-xl grid place-items-center mb-3", iconTone)}>
        <Icon className={cn("h-4 w-4", iconColor)} />
      </div>
      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
        {label}
      </p>
      <p className="text-[22px] sm:text-[24px] font-bold leading-none tnum tracking-tight mt-1.5">
        {value}
      </p>
      {sub && <p className="text-[11px] text-muted-foreground mt-2">{sub}</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   HeatmapRow · fila por agencia con 12 celdas
   ═══════════════════════════════════════════════════════════════════ */
function HeatmapRow({
  agency, values, maxValue,
}: {
  agency: Agency;
  values: number[];
  maxValue: number;
}) {
  return (
    <>
      <div className="flex items-center gap-2 min-w-0">
        <img
          src={agency.logo}
          alt=""
          className="h-6 w-6 rounded-full bg-muted shrink-0 border border-border"
        />
        <p className="text-[12px] text-foreground truncate">{agency.name}</p>
      </div>
      {values.map((v, i) => {
        const ratio = v / maxValue;
        const opacity = v === 0 ? 0.05 : 0.1 + ratio * 0.8;
        return (
          <div
            key={i}
            className="h-6 rounded-md bg-primary"
            style={{ opacity }}
            title={`${v} registros`}
          />
        );
      })}
    </>
  );
}
