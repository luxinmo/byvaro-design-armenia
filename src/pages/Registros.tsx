/**
 * Registros · bandeja de entrada de leads (Vista Promotor)
 *
 * QUÉ
 * ----
 * Pantalla master-detail para gestionar los registros (leads) que las
 * agencias colaboradoras envían al promotor. Es el CORE diferencial del
 * producto (ver `docs/product.md` · IA de duplicados).
 *
 * El promotor debe poder:
 *   · Ver la lista filtrable por promoción, agencia, estado, duplicados.
 *   · Abrir un registro y comparar lado-a-lado con el contacto/registro
 *     con el que podría colisionar.
 *   · Aprobar, rechazar o revisar en bloque (selección múltiple).
 *
 * CÓMO
 * ----
 * - Datos: `src/data/records.ts` (mock).
 * - Sin backend: las acciones disparan `toast()` y mutan estado local.
 * - Responsive desde 375px. En móvil la lista y el detalle son pantallas
 *   separadas (se navega clicando). En desktop (>= lg) van lado a lado.
 * - Barra flotante de selección múltiple sube a bottom-[72px] en móvil
 *   para no chocar con `MobileBottomNav` (ver patrón en CLAUDE.md §3).
 *
 * TODO(backend): GET /api/records?status=&promotion=&agency= → Registro[]
 * TODO(backend): POST /api/records/:id/approve, /reject
 * TODO(backend): POST /api/records/bulk-approve { ids:[] }, /bulk-reject
 * TODO(logic): el matchPercentage vendrá del servicio de IA (Claude Haiku
 *   o GPT-4o-mini, decisión pendiente — ver docs/open-questions.md#Q1).
 */

import { useState, useMemo, useRef, useEffect } from "react";
import {
  Search, X, Check, ChevronDown, Filter, AlertTriangle, Shield,
  User as UserIcon, Mail, Phone, IdCard, Flag, Building2, Users,
  ArrowLeft, Clock, CheckCircle2, XCircle, Copy, FileText,
  ExternalLink, Sparkles, Eye,
} from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toast, Toaster } from "sonner";
import {
  registros as registrosMock,
  type Registro,
  type RegistroEstado,
  getMatchLevel,
  estadoLabel,
} from "@/data/records";
import { promotions } from "@/data/promotions";
import { agencies } from "@/data/agencies";
import { Switch } from "@/components/ui/Switch";
import { Tag } from "@/components/ui/Tag";
import { cn } from "@/lib/utils";
import { RegistrosKpis } from "@/components/registros/RegistrosKpis";
import { MatchRing } from "@/components/registros/MatchRing";
import { DuplicateResult } from "@/components/registros/DuplicateResult";

/* ═══════════════════════════════════════════════════════════════════
   Helpers visuales
   ═══════════════════════════════════════════════════════════════════ */

/** Iniciales a partir de un nombre completo. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0] + parts[parts.length - 1]![0]).toUpperCase();
}

/** Fecha relativa en español: "hace 2 h", "hace 3 días". */
function relativeDate(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: es });
  } catch {
    return iso;
  }
}

/** Color semántico para el % de match (reglas en CLAUDE.md + design-system.md). */
function matchBadgeClasses(pct: number): string {
  const level = getMatchLevel(pct);
  if (level === "high") return "bg-destructive/10 text-destructive border-destructive/20";
  if (level === "medium") return "bg-amber-50 text-amber-700 border-amber-200/60";
  if (level === "low") return "bg-emerald-50 text-emerald-700 border-emerald-200/60";
  return "bg-muted/50 text-muted-foreground border-border";
}

/** Tag variant del estado para `<Tag>`. */
function estadoTagVariant(e: RegistroEstado): "warning" | "success" | "danger" | "muted" {
  if (e === "pendiente") return "warning";
  if (e === "aprobado") return "success";
  if (e === "rechazado" || e === "duplicado") return "danger";
  return "muted";
}

/* ═══════════════════════════════════════════════════════════════════
   PÁGINA
   ═══════════════════════════════════════════════════════════════════ */
export default function Registros() {
  // Estado de datos (mutable para aprobar/rechazar en memoria).
  const [records, setRecords] = useState<Registro[]>(registrosMock);

  // Filtros.
  const [search, setSearch] = useState("");
  const [promotionFilter, setPromotionFilter] = useState<string[]>([]);
  const [agencyFilter, setAgencyFilter] = useState<string[]>([]);
  const [estadoFilter, setEstadoFilter] = useState<RegistroEstado | "todos">("todos");
  const [onlyDuplicates, setOnlyDuplicates] = useState(false);

  // Selección múltiple.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Registro activo (detalle).
  const [activeId, setActiveId] = useState<string | null>(null);

  /* ─── Opciones de filtros ─── */
  const promotionOptions = useMemo(
    () => promotions.map((p) => ({ value: p.id, label: p.name })),
    [],
  );
  const agencyOptions = useMemo(
    () => agencies.map((a) => ({ value: a.id, label: a.name })),
    [],
  );

  /* ─── Mapas de lookup (para pintar nombres rápido) ─── */
  const promotionById = useMemo(() => {
    const m = new Map<string, (typeof promotions)[number]>();
    promotions.forEach((p) => m.set(p.id, p));
    return m;
  }, []);
  const agencyById = useMemo(() => {
    const m = new Map<string, (typeof agencies)[number]>();
    agencies.forEach((a) => m.set(a.id, a));
    return m;
  }, []);

  /* ─── Filtrado ─── */
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return records.filter((r) => {
      if (estadoFilter !== "todos" && r.estado !== estadoFilter) return false;
      if (promotionFilter.length > 0 && !promotionFilter.includes(r.promotionId)) return false;
      if (agencyFilter.length > 0 && !agencyFilter.includes(r.agencyId)) return false;
      if (onlyDuplicates && r.matchPercentage < 30) return false;

      if (q) {
        const promo = promotionById.get(r.promotionId);
        const ag = agencyById.get(r.agencyId);
        const hay =
          r.cliente.nombre.toLowerCase().includes(q) ||
          r.cliente.email.toLowerCase().includes(q) ||
          r.cliente.telefono.toLowerCase().includes(q) ||
          r.cliente.dni.toLowerCase().includes(q) ||
          r.cliente.nacionalidad.toLowerCase().includes(q) ||
          (promo?.name.toLowerCase().includes(q) ?? false) ||
          (ag?.name.toLowerCase().includes(q) ?? false);
        if (!hay) return false;
      }
      return true;
    });
  }, [records, search, estadoFilter, promotionFilter, agencyFilter, onlyDuplicates, promotionById, agencyById]);

  /* ─── Mantener activeId válido ante cambios de filtro ─── */
  useEffect(() => {
    if (activeId && !filtered.some((r) => r.id === activeId)) {
      setActiveId(filtered[0]?.id ?? null);
    }
    if (!activeId && filtered.length > 0 && typeof window !== "undefined" && window.innerWidth >= 1024) {
      setActiveId(filtered[0]!.id);
    }
  }, [filtered, activeId]);

  /* ─── Derivados de contadores ─── */
  const pendientesCount = records.filter((r) => r.estado === "pendiente").length;
  const activeRecord = activeId ? records.find((r) => r.id === activeId) ?? null : null;

  /* ─── Acciones ─── */
  const setEstado = (id: string, estado: RegistroEstado) => {
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, estado } : r)));
  };

  const approve = (id: string) => {
    setEstado(id, "aprobado");
    toast.success("Registro aprobado", { description: "La agencia y el cliente recibirán confirmación." });
  };
  const reject = (id: string) => {
    setEstado(id, "rechazado");
    toast.error("Registro rechazado", { description: "Se notifica a la agencia." });
  };

  const bulkApprove = () => {
    const n = selectedIds.length;
    setRecords((prev) =>
      prev.map((r) => (selectedIds.includes(r.id) ? { ...r, estado: "aprobado" } : r)),
    );
    setSelectedIds([]);
    toast.success(`${n} registros aprobados`, { description: "Notificaciones enviadas." });
  };
  const bulkReject = () => {
    const n = selectedIds.length;
    setRecords((prev) =>
      prev.map((r) => (selectedIds.includes(r.id) ? { ...r, estado: "rechazado" } : r)),
    );
    setSelectedIds([]);
    toast.error(`${n} registros rechazados`);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const clearFilters = () => {
    setSearch("");
    setPromotionFilter([]);
    setAgencyFilter([]);
    setEstadoFilter("todos");
    setOnlyDuplicates(false);
  };
  const hasFilters =
    search.trim().length > 0 ||
    promotionFilter.length > 0 ||
    agencyFilter.length > 0 ||
    estadoFilter !== "todos" ||
    onlyDuplicates;

  const estadoTabs: Array<{ value: RegistroEstado | "todos"; label: string }> = [
    { value: "todos", label: "Todos" },
    { value: "pendiente", label: "Pendientes" },
    { value: "aprobado", label: "Aprobados" },
    { value: "rechazado", label: "Rechazados" },
    { value: "duplicado", label: "Duplicados" },
  ];

  return (
    <div className="flex flex-col min-h-full bg-background">
      <Toaster position="top-center" richColors closeButton />

      {/* ═══════════ HEADER ═══════════ */}
      <div className="px-3 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-3">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
          <div className="shrink-0 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground leading-none">
              Comercial
            </p>
            <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight leading-tight mt-1">Registros</h1>
          </div>

          {/* Buscador */}
          <div className="flex items-center gap-2 sm:ml-auto flex-1 sm:flex-initial sm:max-w-[520px]">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 z-10" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente, email, DNI, promoción…"
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
          </div>
        </div>

        {/* KPIs strip — visión rápida del estado del workspace. */}
        <div className="max-w-[1400px] mx-auto mt-4">
          <RegistrosKpis records={records} />
        </div>
      </div>

      <div className="h-px bg-border/60" />

      {/* ═══════════ Toolbar · filtros ═══════════ */}
      <div className="px-3 sm:px-6 lg:px-8 py-2.5">
        <div className="max-w-[1400px] mx-auto flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Tabs de estado */}
          <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar -mx-1 px-1 shrink-0">
            {estadoTabs.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setEstadoFilter(opt.value)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-[12.5px] font-medium transition-colors whitespace-nowrap",
                  estadoFilter === opt.value
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Separador visual */}
          <div className="h-5 w-px bg-border/60 mx-1 hidden sm:block" />

          {/* Filtros pill */}
          <MultiSelectPill
            label="Promoción"
            options={promotionOptions}
            values={promotionFilter}
            onChange={setPromotionFilter}
            icon={<Building2 className="h-3.5 w-3.5" />}
          />
          <MultiSelectPill
            label="Agencia"
            options={agencyOptions}
            values={agencyFilter}
            onChange={setAgencyFilter}
            icon={<Users className="h-3.5 w-3.5" />}
          />

          {/* Switch duplicados posibles */}
          <label className="inline-flex items-center gap-2 pl-3 pr-2 h-9 rounded-full border border-border bg-card cursor-pointer select-none hover:border-foreground/30 transition-colors">
            <Shield className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[12.5px] font-medium text-foreground">Solo duplicados</span>
            <Switch checked={onlyDuplicates} onCheckedChange={setOnlyDuplicates} ariaLabel="Solo duplicados posibles" />
          </label>

          {/* Contador + limpiar */}
          <div className="ml-auto flex items-center gap-3 shrink-0">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              <span className="font-semibold text-foreground tnum">{filtered.length}</span> resultado{filtered.length !== 1 ? "s" : ""}
            </span>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════ Contenido master-detail ═══════════ */}
      <div className="flex-1 px-3 sm:px-6 lg:px-8 pb-24 lg:pb-8">
        <div className="max-w-[1400px] mx-auto">
          {filtered.length === 0 ? (
            <EmptyState hasFilters={hasFilters} onReset={clearFilters} />
          ) : (
            <div className="flex gap-4 lg:gap-5">
              {/* ─── LISTA MAESTRA ─── */}
              <aside
                className={cn(
                  "w-full lg:w-[420px] shrink-0 flex flex-col gap-2.5",
                  // En móvil: si hay activeRecord ocultamos la lista (vista detalle)
                  activeRecord && "hidden lg:flex",
                )}
              >
                {filtered.map((r) => {
                  const promo = promotionById.get(r.promotionId);
                  const ag = agencyById.get(r.agencyId);
                  const selected = selectedIds.includes(r.id);
                  const isActive = activeId === r.id;

                  return (
                    <article
                      key={r.id}
                      onClick={() => setActiveId(r.id)}
                      className={cn(
                        "group relative flex items-start gap-3 p-4 bg-card border rounded-2xl shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer",
                        isActive ? "border-foreground/30 ring-1 ring-foreground/10" : "border-border",
                        selected && "ring-2 ring-primary/40 border-primary/40",
                      )}
                    >
                      {/* Checkbox selección múltiple */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(r.id);
                        }}
                        aria-label={selected ? "Deseleccionar registro" : "Seleccionar registro"}
                        className={cn(
                          "h-5 w-5 rounded-md border shrink-0 grid place-items-center transition-colors mt-0.5",
                          selected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-border bg-card hover:border-foreground/40",
                        )}
                      >
                        {selected && <Check className="h-3 w-3" strokeWidth={3} />}
                      </button>

                      {/* MatchRing si hay porcentaje · iniciales si no */}
                      {r.matchPercentage > 0 ? (
                        <MatchRing pct={r.matchPercentage} size={12} />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-muted text-foreground grid place-items-center shrink-0 text-xs font-bold tracking-tight">
                          {initials(r.cliente.nombre)}
                        </div>
                      )}

                      {/* Contenido */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground truncate inline-flex items-center gap-1.5">
                            {r.cliente.flag && <span>{r.cliente.flag}</span>}
                            <span className="truncate">{r.cliente.nombre}</span>
                            {r.tipo === "registration_visit" && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary uppercase shrink-0">
                                <Eye className="h-2.5 w-2.5" /> Visita
                              </span>
                            )}
                          </p>
                        </div>

                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {promo?.name ?? "Promoción"}
                          <span className="text-border mx-1.5">·</span>
                          {ag?.name ?? "Agencia"}
                        </p>

                        <div className="flex items-center justify-between gap-2 mt-2">
                          <span className="text-[11px] text-muted-foreground/80 inline-flex items-center gap-1">
                            {r.estado === "pendiente" && <Clock className="h-3 w-3 text-amber-500" />}
                            {relativeDate(r.fecha)}
                            {r.responseTime && r.estado !== "pendiente" && (
                              <span className="text-muted-foreground/50 inline-flex items-center gap-0.5 ml-1">
                                · <Clock className="h-2.5 w-2.5" /> {r.responseTime}
                              </span>
                            )}
                          </span>
                          <Tag variant={estadoTagVariant(r.estado)} size="sm" shape="pill">
                            {estadoLabel[r.estado]}
                          </Tag>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </aside>

              {/* ─── DETALLE ─── */}
              <section
                className={cn(
                  "flex-1 min-w-0",
                  // En móvil: si no hay registro activo, ocultamos el detalle
                  !activeRecord && "hidden lg:block",
                )}
              >
                {activeRecord ? (
                  <RegistroDetail
                    record={activeRecord}
                    promotionName={promotionById.get(activeRecord.promotionId)?.name ?? "—"}
                    promotionLocation={promotionById.get(activeRecord.promotionId)?.location ?? ""}
                    agencyName={agencyById.get(activeRecord.agencyId)?.name ?? "—"}
                    agencyLocation={agencyById.get(activeRecord.agencyId)?.location ?? ""}
                    onApprove={() => approve(activeRecord.id)}
                    onReject={() => reject(activeRecord.id)}
                    onBack={() => setActiveId(null)}
                  />
                ) : (
                  <div className="hidden lg:flex items-center justify-center h-full min-h-[400px] bg-card border border-dashed border-border rounded-2xl">
                    <div className="text-center px-6">
                      <div className="h-12 w-12 rounded-2xl bg-muted grid place-items-center mx-auto mb-4">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-semibold text-foreground">Selecciona un registro</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Elige una entrada de la lista para ver todos los datos.
                      </p>
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════ Barra flotante de selección múltiple ═══════════ */}
      {selectedIds.length > 0 && (
        <div
          className={cn(
            "fixed left-1/2 -translate-x-1/2 z-40",
            // Mobile: sube para no chocar con MobileBottomNav (60px h)
            "bottom-[72px] lg:bottom-6",
          )}
          role="region"
          aria-label="Acciones de selección múltiple"
        >
          <div className="flex items-center gap-2 px-3 py-2 bg-foreground text-background rounded-full shadow-soft-lg">
            <span className="text-xs font-semibold px-2 tnum">
              {selectedIds.length} seleccionado{selectedIds.length !== 1 ? "s" : ""}
            </span>
            <div className="h-5 w-px bg-background/20" />
            <button
              onClick={bulkApprove}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-background/10 hover:bg-background/20 text-xs font-medium transition-colors"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Aprobar todos
            </button>
            <button
              onClick={bulkReject}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-background/10 hover:bg-background/20 text-xs font-medium transition-colors"
            >
              <XCircle className="h-3.5 w-3.5" />
              Rechazar todos
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="inline-flex items-center justify-center h-8 w-8 rounded-full hover:bg-background/10 transition-colors"
              aria-label="Cancelar selección"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Detalle de registro (columna derecha en desktop, pantalla completa en móvil)
   ═══════════════════════════════════════════════════════════════════ */
function RegistroDetail({
  record,
  promotionName,
  promotionLocation,
  agencyName,
  agencyLocation,
  onApprove,
  onReject,
  onBack,
}: {
  record: Registro;
  promotionName: string;
  promotionLocation: string;
  agencyName: string;
  agencyLocation: string;
  onApprove: () => void;
  onReject: () => void;
  onBack: () => void;
}) {
  const level = getMatchLevel(record.matchPercentage);
  const canDecide = record.estado === "pendiente";

  return (
    <div className="bg-card border border-border rounded-2xl shadow-soft overflow-hidden">
      {/* Header del detalle */}
      <div className="px-4 sm:px-6 py-4 border-b border-border flex items-center gap-3">
        <button
          onClick={onBack}
          className="lg:hidden p-2 -ml-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Volver a la lista"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="h-11 w-11 rounded-full bg-muted text-foreground grid place-items-center shrink-0 text-sm font-bold">
          {initials(record.cliente.nombre)}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-foreground leading-tight truncate">
            {record.cliente.flag && <span className="mr-1.5">{record.cliente.flag}</span>}
            {record.cliente.nombre}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            Enviado {relativeDate(record.fecha)}
          </p>
        </div>
        <Tag variant={estadoTagVariant(record.estado)} size="sm" shape="pill">
          {estadoLabel[record.estado]}
        </Tag>
      </div>

      {/* DuplicateResult — bloque rico con anillo + tabla side-by-side
       *  + recomendación. Solo si la IA detectó una coincidencia. */}
      {record.matchPercentage > 0 && (
        <div className="px-4 sm:px-6 mt-4">
          <DuplicateResult record={record} />
        </div>
      )}

      {/* Visita propuesta — solo si tipo === registration_visit */}
      {record.tipo === "registration_visit" && record.visitDate && (
        <div className="mx-4 sm:mx-6 mt-3 rounded-xl border border-primary/25 bg-primary/[0.03] p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center text-primary shrink-0">
            <Eye className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-primary">Visita solicitada</p>
            <p className="text-sm font-bold text-foreground mt-0.5">
              {new Date(record.visitDate).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
              {record.visitTime && ` · ${record.visitTime}h`}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary shrink-0">
            <Clock className="h-3 w-3" /> Pendiente
          </span>
        </div>
      )}

      {/* Body: grid 2 columnas en desktop (cliente | promoción/agencia), apilado en móvil */}
      <div className="px-4 sm:px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Cliente */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">
            Cliente
          </p>
          <dl className="space-y-2.5">
            <DetailRow icon={UserIcon} label="Nombre" value={record.cliente.nombre} highlight={record.matchCliente?.nombre === record.cliente.nombre} />
            <DetailRow icon={Mail} label="Email" value={record.cliente.email} mono highlight={record.matchCliente?.email === record.cliente.email} />
            <DetailRow icon={Phone} label="Teléfono" value={record.cliente.telefono} mono highlight={record.matchCliente?.telefono === record.cliente.telefono} />
            <DetailRow icon={IdCard} label="DNI / NIE" value={record.cliente.dni} mono highlight={record.matchCliente?.dni === record.cliente.dni} />
            <DetailRow icon={Flag} label="Nacionalidad" value={record.cliente.nacionalidad} highlight={record.matchCliente?.nacionalidad === record.cliente.nacionalidad} />
          </dl>
        </div>

        {/* Promoción + agencia + consent */}
        <div className="space-y-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">
              Promoción objetivo
            </p>
            <div className="p-3 rounded-xl border border-border bg-muted/20">
              <p className="text-sm font-semibold text-foreground">{promotionName}</p>
              {promotionLocation && (
                <p className="text-xs text-muted-foreground mt-0.5">{promotionLocation}</p>
              )}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">
              Agencia origen
            </p>
            <div className="p-3 rounded-xl border border-border bg-muted/20">
              <p className="text-sm font-semibold text-foreground">{agencyName}</p>
              {agencyLocation && (
                <p className="text-xs text-muted-foreground mt-0.5">{agencyLocation}</p>
              )}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">
              Consentimiento RGPD
            </p>
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl border text-sm",
                record.consent
                  ? "border-emerald-200/60 bg-emerald-50/60 text-emerald-700"
                  : "border-destructive/20 bg-destructive/5 text-destructive",
              )}
            >
              {record.consent ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              <span className="font-medium">
                {record.consent ? "Cliente ha dado su consentimiento" : "Consentimiento no marcado"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Notas */}
      {record.notas && (
        <div className="px-4 sm:px-6 pb-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">
            Notas del agente
          </p>
          <div className="p-3 rounded-xl border border-border bg-muted/20 text-sm text-foreground">
            {record.notas}
          </div>
        </div>
      )}

      {/* Comparación lado-a-lado si hay match */}
      {record.matchPercentage > 0 && record.matchCliente && (
        <div className="border-t border-border bg-muted/20 px-4 sm:px-6 py-5">
          <div className="flex items-center gap-2 mb-3">
            <Copy className="h-4 w-4 text-muted-foreground" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Comparación lado-a-lado
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <CompareCard
              title="Registro entrante"
              subtitle={agencyName}
              accent="primary"
              cliente={record.cliente}
              matchCliente={record.matchCliente}
              self
            />
            <CompareCard
              title="Cliente existente"
              subtitle={record.matchWith ?? "Candidato a duplicado"}
              accent="amber"
              cliente={record.matchCliente}
              matchCliente={record.cliente}
            />
          </div>
        </div>
      )}

      {/* Footer de acciones */}
      <div className="border-t border-border bg-card px-4 sm:px-6 py-4 flex flex-wrap items-center gap-2">
        {record.matchPercentage > 0 && (
          <button
            onClick={() => toast.info("Abriendo ficha del cliente existente…")}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Ver cliente existente
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={onReject}
            disabled={!canDecide}
            className={cn(
              "inline-flex items-center gap-1.5 h-9 px-4 rounded-full border text-sm font-medium transition-colors",
              canDecide
                ? "border-border bg-card text-foreground hover:bg-destructive/5 hover:text-destructive hover:border-destructive/30"
                : "border-border bg-muted text-muted-foreground cursor-not-allowed",
            )}
          >
            <XCircle className="h-3.5 w-3.5" />
            Rechazar
          </button>
          <button
            onClick={onApprove}
            disabled={!canDecide}
            className={cn(
              "inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-sm font-medium transition-colors shadow-soft",
              canDecide
                ? "bg-foreground text-background hover:bg-foreground/90"
                : "bg-muted text-muted-foreground cursor-not-allowed shadow-none",
            )}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Aprobar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   DetailRow · fila label/valor con icono y resaltado opcional
   ═══════════════════════════════════════════════════════════════════ */
function DetailRow({
  icon: Icon, label, value, mono, highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="h-7 w-7 rounded-lg bg-muted text-muted-foreground grid place-items-center shrink-0">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </p>
        <p
          className={cn(
            "text-sm text-foreground break-words leading-snug mt-0.5",
            mono && "tnum",
            highlight && "bg-amber-100/60 px-1.5 -mx-1.5 rounded font-semibold",
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CompareCard · tarjeta de un lado de la comparación lado-a-lado
   Resalta en ámbar los campos que coinciden con la contraparte.
   ═══════════════════════════════════════════════════════════════════ */
function CompareCard({
  title, subtitle, accent, cliente, matchCliente, self,
}: {
  title: string;
  subtitle: string;
  accent: "primary" | "amber";
  cliente: Partial<import("@/data/records").RegistroCliente>;
  matchCliente: Partial<import("@/data/records").RegistroCliente>;
  self?: boolean;
}) {
  const borderTone =
    accent === "primary" ? "border-primary/30 bg-primary/5" : "border-amber-200/60 bg-amber-50/40";
  const labelTone = accent === "primary" ? "text-primary" : "text-amber-700";

  const Line = ({ label, value, otherValue }: { label: string; value?: string; otherValue?: string }) => {
    const matches = !!value && !!otherValue && value === otherValue;
    return (
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        <p
          className={cn(
            "text-sm text-foreground break-words leading-snug mt-0.5",
            matches && "bg-amber-100/60 px-1.5 -mx-1.5 rounded font-semibold inline-block",
          )}
        >
          {value || <span className="text-muted-foreground italic">—</span>}
        </p>
      </div>
    );
  };

  return (
    <div className={cn("p-4 rounded-xl border", borderTone)}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className={cn("text-[10px] font-semibold uppercase tracking-[0.14em]", labelTone)}>
            {title}
          </p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</p>
        </div>
        {self && (
          <Tag variant="active" size="sm" shape="pill">
            Este
          </Tag>
        )}
      </div>
      <div className="space-y-2.5">
        <Line label="Nombre" value={cliente.nombre} otherValue={matchCliente.nombre} />
        <Line label="Email" value={cliente.email} otherValue={matchCliente.email} />
        <Line label="Teléfono" value={cliente.telefono} otherValue={matchCliente.telefono} />
        <Line label="DNI / NIE" value={cliente.dni} otherValue={matchCliente.dni} />
        <Line label="Nacionalidad" value={cliente.nacionalidad} otherValue={matchCliente.nacionalidad} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MultiSelectPill · filtro pill que cambia a negro cuando tiene selección.
   Patrón idéntico al `MultiSelectDropdown` de Promociones.tsx pero sin
   exportar de allí (allí vive inline). Aquí lo mantenemos local.
   ═══════════════════════════════════════════════════════════════════ */
function MultiSelectPill({
  label, options, values, onChange, icon,
}: {
  label: string;
  options: { value: string; label: string }[];
  values: string[];
  onChange: (v: string[]) => void;
  icon?: React.ReactNode;
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
  const display = active
    ? values.length === 1
      ? options.find((o) => o.value === values[0])?.label ?? label
      : `${label} · ${values.length}`
    : label;

  const toggle = (v: string) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-[12.5px] font-medium transition-colors max-w-[200px]",
          active
            ? "bg-foreground text-background border-foreground"
            : "bg-card border-border text-foreground hover:border-foreground/30",
        )}
      >
        {icon}
        <span className="truncate">{display}</span>
        <ChevronDown className={cn("h-3 w-3 opacity-70 transition-transform shrink-0", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 bg-popover border border-border rounded-xl shadow-soft-lg z-30 min-w-[240px] max-h-[320px] overflow-y-auto py-1.5">
          {values.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="w-full text-left px-3 py-1.5 text-[11.5px] text-muted-foreground hover:text-destructive transition-colors"
            >
              Limpiar selección
            </button>
          )}
          {options.map((opt) => {
            const selected = values.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggle(opt.value)}
                className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-sm hover:bg-muted/40 transition-colors text-left"
              >
                <span className={cn("truncate", selected ? "text-foreground font-medium" : "text-muted-foreground")}>
                  {opt.label}
                </span>
                {selected && <Check className="h-3.5 w-3.5 text-primary shrink-0" strokeWidth={2.5} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   EmptyState
   ═══════════════════════════════════════════════════════════════════ */
function EmptyState({ hasFilters, onReset }: { hasFilters: boolean; onReset: () => void }) {
  return (
    <div className="py-20 text-center">
      <div className="h-12 w-12 rounded-2xl bg-muted grid place-items-center mx-auto mb-4">
        <Filter className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">Sin registros</h3>
      <p className="text-[12.5px] text-muted-foreground mt-1">
        {hasFilters
          ? "Prueba a ajustar los filtros o a limpiar la búsqueda."
          : "Cuando las agencias envíen registros aparecerán aquí."}
      </p>
      {hasFilters && (
        <button
          onClick={onReset}
          className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
