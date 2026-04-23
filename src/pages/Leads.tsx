/**
 * Leads · bandeja de entrada de potenciales compradores sin cualificar.
 *
 * Muestra los leads crudos (portales, microsite, agencias, WhatsApp…)
 * antes de ser promovidos a `Registro` o descartados. La IA de
 * duplicados marca los que probablemente ya existen como contacto
 * (`duplicateScore ≥ 70`).
 *
 * Actualmente es una pantalla de listado con:
 *   - 5 KPI chips arriba (Total · Nuevos · Cualificados · Duplicados · Convertidos).
 *   - Filter bar: buscador, segmentado rápido por estado.
 *   - Tabla con filas expandibles + kebab de acciones por lead.
 *
 * TODO(backend): `GET /api/leads` con paginación y filtros. Ver
 *   `docs/backend-integration.md §7.1`. Hoy data de `src/data/leads.ts`.
 * TODO(backend): kebab → endpoints de §7.1:
 *   - Llamar/email/whatsapp = telemetría + grabar `firstResponseAt`.
 *   - Convertir → `POST /api/leads/:id/convert`.
 *   - Descartar → `PATCH /api/leads/:id { status: "rejected" }`.
 * TODO(ui): filtros avanzados (origen, nacionalidad, presupuesto, asignado).
 * TODO(ui): ficha detalle `/leads/:id` con timeline + match duplicados.
 */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, X, Inbox, Mail, CheckCircle2,
  Copy, MoreVertical, ArrowUpRight, Filter, Clock, UserPlus, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  leads as allLeads, leadStatusConfig, leadSourceLabel,
  type Lead, type LeadStatus,
} from "@/data/leads";
import { developerOnlyPromotions } from "@/data/developerPromotions";
import { Building2 } from "lucide-react";
import { UserSelect } from "@/components/ui/UserSelect";
import { findTeamMember, memberInitials, getMemberAvatarUrl } from "@/lib/team";
import { useLeadAssignee, setLeadAssignee } from "@/components/leads/leadAssigneeStorage";
import { cn } from "@/lib/utils";

function flagOf(code?: string): string {
  if (!code || code.length !== 2) return "🏳️";
  const c = code.toUpperCase();
  return String.fromCodePoint(...[...c].map((ch) => 127397 + ch.charCodeAt(0)));
}

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
  return `hace ${weeks} sem`;
}

export default function Leads() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState<LeadStatus | "all">("all");

  const counts = useMemo(() => ({
    total:      allLeads.length,
    new:        allLeads.filter((l) => l.status === "new").length,
    qualified:  allLeads.filter((l) => l.status === "qualified").length,
    contacted:  allLeads.filter((l) => l.status === "contacted").length,
    duplicate:  allLeads.filter((l) => l.status === "duplicate").length,
    converted:  allLeads.filter((l) => l.status === "converted").length,
    rejected:   allLeads.filter((l) => l.status === "rejected").length,
  }), []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allLeads
      .filter((l) => {
        if (quickFilter !== "all" && l.status !== quickFilter) return false;
        if (q) {
          const hay = [
            l.fullName, l.email, l.phone, l.interest.promotionName ?? "",
            l.interest.zona ?? "",
          ].join(" ").toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [search, quickFilter]);

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
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-1">
                <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight text-foreground leading-tight">
                  Leads
                </h1>
                {/* Pill informativo · email único del workspace al que los
                   portales (Idealista, Fotocasa…) pueden reenviar leads para
                   crear entradas automáticas. Mock: hardcoded hoy · en real
                   vendrá del endpoint /api/workspace/leads-inbox. */}
                <LeadsInboxHint />
              </div>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-[640px] leading-relaxed">
                Bandeja de entrada con todos los potenciales compradores · IA marca duplicados.
              </p>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 mt-5">
            <KpiChip label="Total"        value={counts.total}     icon={Inbox}          tone="neutral" />
            <KpiChip label="Nuevos"       value={counts.new}       icon={UserPlus}       tone="primary" />
            <KpiChip label="Cualificados" value={counts.qualified} icon={CheckCircle2}   tone="sky" />
            <KpiChip label="Duplicados"   value={counts.duplicate} icon={AlertTriangle}  tone="destructive" />
            <KpiChip label="Convertidos"  value={counts.converted} icon={ArrowUpRight}   tone="emerald" />
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-2 mt-5 flex-wrap">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
              <input
                type="text"
                placeholder="Buscar por nombre, email, teléfono, promoción..."
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

            {/* Segmented quick filter */}
            <div className="inline-flex items-center bg-muted rounded-full p-1 gap-0.5 shrink-0 overflow-x-auto no-scrollbar">
              {([
                { key: "all" as const,       label: "Todos",       count: counts.total },
                { key: "new" as const,       label: "Nuevos",      count: counts.new },
                { key: "qualified" as const, label: "Cualificados",count: counts.qualified },
                { key: "contacted" as const, label: "Contactados", count: counts.contacted },
                { key: "duplicate" as const, label: "Duplicados",  count: counts.duplicate },
                { key: "converted" as const, label: "Convertidos", count: counts.converted },
              ]).map((opt) => {
                const selected = quickFilter === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => setQuickFilter(opt.key)}
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
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full border border-border bg-card text-sm font-medium text-foreground hover:bg-muted transition-colors shrink-0"
              onClick={() => toast.info("Filtros avanzados próximamente")}
            >
              <Filter className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span className="hidden sm:inline">Filtros</span>
            </button>
          </div>
        </div>
      </section>

      {/* Listado */}
      <section className="px-4 sm:px-6 lg:px-8 mt-6 pb-12">
        <div className="max-w-[1400px] mx-auto">
          <div className="mb-3 flex items-end justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "lead" : "leads"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Ordenados por entrada más reciente
            </p>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
              <Inbox className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-sm font-medium text-foreground mb-1">Sin leads</p>
              <p className="text-xs text-muted-foreground">
                {search || quickFilter !== "all"
                  ? "Prueba con otro filtro."
                  : "Cuando lleguen leads desde portales, microsite o agencias, aparecerán aquí."}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-semibold">Lead</th>
                      <th className="px-3 py-2.5 text-left font-semibold">Interés</th>
                      <th className="px-3 py-2.5 text-left font-semibold">Recibido</th>
                      <th className="px-3 py-2.5 text-left font-semibold">Responsable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((l) => (
                      <LeadRow key={l.id} lead={l} navigate={navigate} />
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
   FILA DE LEAD
   ═══════════════════════════════════════════════════════════════════ */

function LeadRow({
  lead: l, navigate,
}: {
  lead: Lead;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const status = leadStatusConfig[l.status];
  const isDup = l.status === "duplicate" || (l.duplicateScore ?? 0) >= 70;

  return (
    <tr
      onClick={() => navigate(`/leads/${l.id}`)}
      className="border-t border-border/60 hover:bg-muted/20 transition-colors cursor-pointer"
    >
      {/* Lead · nombre + email/teléfono */}
      <td className="px-4 py-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0 text-[11px] font-bold text-foreground">
            {l.fullName.split(" ").map((w) => w[0]).slice(0, 2).join("")}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
              {l.nationality && <span className="text-base leading-none">{flagOf(l.nationality)}</span>}
              {l.fullName}
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[9.5px] font-medium rounded-full px-1.5 py-0.5",
                  status.badgeClass,
                )}
                title={status.label}
              >
                <span className={cn("h-1 w-1 rounded-full", status.dotClass)} />
                {status.label}
              </span>
              {isDup && (
                <span
                  className="inline-flex items-center gap-0.5 text-[9.5px] font-bold text-destructive bg-destructive/10 border border-destructive/25 rounded-full px-1.5 py-0.5"
                  title={`IA de duplicados · ${l.duplicateScore ?? 100}% match`}
                >
                  <Copy className="h-2.5 w-2.5" strokeWidth={2.5} />
                  DUP
                </span>
              )}
            </p>
            <p className="text-[11.5px] text-muted-foreground truncate">{l.email}</p>
            <p className="text-[11px] text-muted-foreground/80 tabular-nums">{l.phone}</p>
          </div>
        </div>
      </td>

      {/* Interés · thumbnail + promoción + tipología + presupuesto */}
      <td className="px-3 py-3 align-middle">
        <div className="flex items-start gap-2.5 min-w-0">
          {/* Thumbnail de la promoción referenciada · mismo tamaño que las
              miniaturas del catálogo de Disponibilidad
              (`PromotionAvailabilityFull.tsx` · w-[80px] h-[54px]). */}
          <div className="w-[80px] h-[54px] rounded-md bg-muted/30 grid place-items-center shrink-0 overflow-hidden">
            {(() => {
              const promo = developerOnlyPromotions.find((p) => p.id === l.interest.promotionId);
              if (promo?.image) {
                return <img src={promo.image} alt="" className="w-full h-full object-cover" loading="lazy" />;
              }
              return <Building2 className="h-4 w-4 text-muted-foreground/60" strokeWidth={1.5} />;
            })()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-foreground truncate max-w-[220px]">
              {l.interest.promotionName ?? "—"}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {[
                l.interest.tipologia,
                l.interest.dormitorios && `${l.interest.dormitorios} dorm.`,
              ].filter(Boolean).join(" · ")}
            </p>
            <p className="text-[11px] text-muted-foreground tabular-nums">
              {formatPrice(l.interest.presupuestoMax)}
              {l.interest.zona && <span className="text-muted-foreground/60"> · {l.interest.zona}</span>}
            </p>
          </div>
        </div>
      </td>

      {/* Recibido · hora relativa arriba + origen (fuente) debajo */}
      <td className="px-3 py-3 align-middle">
        <p className="inline-flex items-center gap-1 text-[11px] text-foreground font-medium">
          <Clock className="h-3 w-3 text-muted-foreground" strokeWidth={1.75} />
          {relativeTime(l.createdAt)}
        </p>
        <p className="text-[10.5px] text-muted-foreground mt-0.5">
          {leadSourceLabel[l.source]}
        </p>
      </td>

      {/* Responsable · único · clic abre el selector de miembros */}
      <td className="px-3 py-3 align-middle" onClick={(e) => e.stopPropagation()}>
        <AssigneeCell lead={l} />
      </td>
    </tr>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   KPI CHIP
   ═══════════════════════════════════════════════════════════════════ */

function KpiChip({
  label, value, icon: Icon, tone,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  tone: "neutral" | "primary" | "sky" | "emerald" | "destructive";
}) {
  const toneClass = {
    neutral:     "bg-card border-border text-foreground",
    primary:     "bg-primary/5 border-primary/20 text-primary",
    sky:         "bg-sky-50 border-sky-200 text-sky-800",
    emerald:     "bg-success/10 border-success/25 text-success",
    destructive: "bg-destructive/5 border-destructive/20 text-destructive",
  }[tone];

  return (
    <div className={cn("rounded-2xl border px-3 py-2.5 shadow-soft", toneClass)}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">{label}</p>
        <Icon className="h-3.5 w-3.5 opacity-70" strokeWidth={1.75} />
      </div>
      <p className="text-xl font-bold tabular-nums leading-tight mt-1">{value}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CELDA RESPONSABLE · único asignado + opción de añadir/cambiar/quitar
   ═══════════════════════════════════════════════════════════════════ */

function AssigneeCell({ lead }: { lead: Lead }) {
  // Override del usuario (localStorage) tiene prioridad sobre el seed.
  const override = useLeadAssignee(lead.id);

  // Si hay override → ese es el miembro. Si no y el seed tiene
  // `assignedTo.email`, intentamos casarlo con TEAM_MEMBERS por email
  // (mejor que por nombre · es único).
  const seedMember = lead.assignedTo?.email
    ? findTeamMember(lead.assignedTo.email) // findTeamMember acepta id o email
    : undefined;
  const memberId = override ?? seedMember?.id ?? null;
  const member = memberId ? findTeamMember(memberId) : undefined;

  const handleChange = (newId: string) => {
    setLeadAssignee(lead.id, newId);
    toast.success(`Asignado a ${findTeamMember(newId)?.name ?? "miembro"}`);
  };

  if (!member) {
    // Sin asignar → botón "+ Asignar" que abre el selector canónico.
    return (
      <div className="inline-flex">
        <UserSelect
          value={null}
          onChange={handleChange}
          placeholder="+ Asignar responsable"
          onlyActive
        />
      </div>
    );
  }

  // Asignado → avatar + nombre + icono de cambio.  Al hacer click se
  // abre el mismo UserSelect (muestra checked en el actual) permitiendo
  // elegir otro miembro o quitar.
  return (
    <div className="flex items-center gap-2 min-w-0">
      {getMemberAvatarUrl(member) ? (
        <img src={getMemberAvatarUrl(member)!} alt="" className="h-6 w-6 rounded-full object-cover shrink-0" />
      ) : (
        <div className="h-6 w-6 rounded-full bg-muted grid place-items-center text-[9.5px] font-bold text-foreground shrink-0">
          {memberInitials(member)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] font-medium text-foreground truncate max-w-[130px]">{member.name}</p>
        {member.jobTitle && (
          <p className="text-[10px] text-muted-foreground truncate max-w-[130px]">{member.jobTitle}</p>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="h-6 w-6 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
            aria-label="Cambiar responsable"
          >
            <MoreVertical className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 p-1.5">
          <div className="px-1 pb-1.5">
            <UserSelect
              value={memberId}
              onChange={(id) => {
                handleChange(id);
              }}
              placeholder="Cambiar responsable"
              onlyActive
            />
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              setLeadAssignee(lead.id, null);
              toast.success("Responsable quitado");
            }}
            className="gap-2 text-xs text-destructive focus:text-destructive"
          >
            Quitar asignación
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   HINT · email del workspace para conectar portales
   ═══════════════════════════════════════════════════════════════════
   Los portales inmobiliarios (Idealista, Fotocasa, Habitaclia…) tienen
   un campo para reenviar automáticamente los emails de contacto de
   cada anuncio. Cada workspace recibe un email único que ingesta esos
   mensajes, los parsea y crea el `Lead` correspondiente.

   TODO(backend):
     · GET /api/workspace/leads-inbox → { address, portalsConnected[] }
     · El address se genera al crear el workspace y nunca cambia.
     · En `/ajustes/canales/portales` se listan los portales activos y
       su último email recibido. */
function LeadsInboxHint() {
  // Mock: en real esto viene del workspace actual del usuario.
  const inbox = "leads@luxinmo.byvaro.app";

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(inbox);
      toast.success("Email copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar · cópialo a mano");
    }
  };

  return (
    <button
      onClick={onCopy}
      className="inline-flex items-center gap-2 h-8 pl-2.5 pr-1 rounded-full border border-dashed border-border bg-muted/40 hover:bg-muted transition-colors shadow-soft group"
      title="Haz clic para copiar · añade este email a los portales (Idealista, Fotocasa…) para recibir los leads automáticamente"
    >
      <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeWidth={1.75} />
      <span className="text-[11.5px] text-muted-foreground hidden md:inline">
        Añade este email a los portales para recibir los leads automáticamente ·
      </span>
      <span className="text-[11.5px] text-muted-foreground md:hidden">
        Email inbox ·
      </span>
      <code className="text-[11.5px] font-mono text-foreground tabular-nums">{inbox}</code>
      <span
        className="h-6 w-6 inline-flex items-center justify-center rounded-full bg-card border border-border shrink-0 group-hover:bg-foreground group-hover:text-background transition-colors"
        aria-label="Copiar email"
      >
        <Copy className="h-3 w-3" strokeWidth={2} />
      </span>
    </button>
  );
}
