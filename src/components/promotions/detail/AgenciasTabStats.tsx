/**
 * AgenciasTabStats · contenido de la tab "Agencias" dentro de una
 * promoción. Enfoque del promotor:
 *
 *   1. KPIs agregados de rendimiento (visitas, registros, ventas, conv).
 *   2. Solicitudes entrantes · agencias que quieren colaborar en esta
 *      promoción (Aprobar / Rechazar inline).
 *   3. Invitaciones enviadas pendientes · a las que he invitado y aún
 *      no aceptaron (Reenviar / Cancelar inline).
 *   4. Agencias colaborando · lista enriquecida (logo redondo o
 *      rectangular según el asset de cada agencia, especialidad,
 *      contacto principal, rating Google, última actividad, KPIs).
 *
 * La ruta de perfil completa vive en `/colaboradores/:id` · desde cada
 * fila de colaborando hay atajo (click → navigate). El historial
 * cross-empresa sigue siendo un drill-down desde ahí (Historial conmigo).
 *
 * TODO(backend): ver `docs/backend-integration.md` §4 y §5:
 *   - GET /api/promociones/:id/agencias → colaborando con su último KPI
 *   - GET /api/promociones/:id/solicitudes
 *   - GET /api/promociones/:id/invitaciones (estado=pendiente)
 */

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3, ArrowUpRight, Users, Inbox, Plus, TrendingUp,
  Eye, FileText, Home, MailPlus, Clock, RotateCw, X, Check,
  Building2, Star, MapPin, Activity,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { agencies, type Agency } from "@/data/agencies";
import { useCurrentUser } from "@/lib/currentUser";
import { useInvitaciones } from "@/lib/invitaciones";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import {
  recordRequestApproved, recordRequestRejected,
  recordInvitationCancelled, recordCompanyAny,
} from "@/lib/companyEvents";
import type { Promotion } from "@/data/promotions";

function formatEur(n: number) {
  if (!Number.isFinite(n) || n === 0) return "0 €";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M€`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K€`;
  return `${n} €`;
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

function daysUntil(ms: number) {
  const diff = ms - Date.now();
  return Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000)));
}

/** Relativo "hace X días" sobre ISO yyyy-mm-dd. */
function formatRelativeISO(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (!Number.isFinite(d)) return null;
  return formatRelative(d);
}

function findMatchingAgency(email: string) {
  const e = email.toLowerCase();
  return agencies.find((a) => a.contactoPrincipal?.email?.toLowerCase() === e);
}

const especialidadLabel: Record<NonNullable<Agency["especialidad"]>, string> = {
  luxury: "Lujo",
  residential: "Residencial",
  commercial: "Comercial",
  tourist: "Turístico",
  "second-home": "Segunda residencia",
};

/* ══════════════════════════════════════════════════════════════════
 * AgencyLogo · pinta el logo adaptándose al asset disponible.
 * - Si hay `logoRect` y `variant=full` → wordmark rectangular (w-24 h-10).
 * - Si no, cae al `logo` cuadrado/redondo (h-10 w-10, rounded-full).
 * - Fallback → icono Building2 sobre bg-muted.
 * ════════════════════════════════════════════════════════════════ */
function AgencyLogo({
  agency, variant = "full", size = "md",
}: {
  agency: Agency | { logo?: string; logoRect?: string; name?: string };
  /** `full` acepta rectangular si existe; `icon` siempre cuadrado/redondo. */
  variant?: "full" | "icon";
  size?: "sm" | "md";
}) {
  const sq = size === "sm"
    ? "h-9 w-9 rounded-full"
    : "h-11 w-11 rounded-full";
  const rect = size === "sm"
    ? "h-8 w-[72px] rounded-md"
    : "h-10 w-[96px] rounded-md";

  if (variant === "full" && agency.logoRect) {
    return (
      <div className={cn("shrink-0 bg-white border border-border/60 grid place-items-center overflow-hidden", rect)}>
        <img
          src={agency.logoRect}
          alt={agency.name ?? ""}
          className="max-h-full max-w-full object-contain"
        />
      </div>
    );
  }
  return (
    <div className={cn("shrink-0 bg-muted overflow-hidden grid place-items-center", sq)}>
      {agency.logo ? (
        <img src={agency.logo} alt={agency.name ?? ""} className="h-full w-full object-cover" />
      ) : (
        <Building2 className="h-4 w-4 text-muted-foreground/60" strokeWidth={1.5} />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */

interface Props {
  promotion: Promotion;
  canShare: boolean;
  onInvitar: () => void;
  onOpenStats: () => void;
  onOpenPendientes: () => void;
}

export function AgenciasTabStats({ promotion: p, canShare, onInvitar, onOpenStats }: Props) {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const actor = { name: user.name, email: user.email };
  const confirm = useConfirm();
  const { pendientes: invitacionesAll, reenviar, eliminar } = useInvitaciones();

  const agenciasEnPromo = useMemo(
    () => agencies.filter((a) => a.promotionsCollaborating?.includes(p.id) && !a.solicitudPendiente),
    [p.id],
  );

  /* Solicitudes entrantes · por ahora son globales; en backend vendrán
     filtradas por `requestedPromotionId === p.id`. */
  const solicitudes = useMemo(
    () => agencies.filter((a) => a.solicitudPendiente || a.isNewRequest),
    [],
  );

  /* Invitaciones enviadas pendientes a esta promoción. */
  const invitaciones = useMemo(
    () => invitacionesAll.filter((i) => i.promocionId === p.id),
    [invitacionesAll, p.id],
  );

  /* KPIs agregados. */
  const kpis = useMemo(() => {
    const totales = agenciasEnPromo.reduce(
      (acc, a) => {
        acc.visitas    += a.visitsCount ?? 0;
        acc.registros  += a.registrations ?? a.registrosAportados ?? 0;
        acc.ventas     += a.ventasCerradas ?? 0;
        acc.volumen    += a.salesVolume ?? 0;
        return acc;
      },
      { visitas: 0, registros: 0, ventas: 0, volumen: 0 },
    );
    const conversion = totales.registros > 0
      ? Math.round((totales.ventas / totales.registros) * 100)
      : 0;
    return { ...totales, conversion };
  }, [agenciasEnPromo]);

  /* ═════ Handlers · solicitudes ═════ */
  const handleAprobarSolicitud = (agencyId: string, agencyName: string) => {
    recordRequestApproved(agencyId, actor);
    toast.success("Solicitud aprobada", { description: `${agencyName} ya puede colaborar.` });
  };
  const handleRechazarSolicitud = async (agencyId: string, agencyName: string) => {
    const ok = await confirm({
      title: "¿Descartar solicitud?",
      description: `${agencyName} no podrá colaborar hasta volver a solicitarlo.`,
      confirmLabel: "Descartar",
      destructive: true,
    });
    if (!ok) return;
    recordRequestRejected(agencyId, actor);
    toast.success("Solicitud descartada");
  };

  /* ═════ Handlers · invitaciones ═════ */
  const handleReenviar = (id: string, email: string) => {
    reenviar(id);
    recordCompanyAny(id, "invitation_sent", "Invitación reenviada",
      `Link reenviado a ${email}. Nueva validez: 30 días.`, actor);
    toast.success("Invitación reenviada");
  };
  const handleCancelarInvitacion = async (id: string, email: string) => {
    const ok = await confirm({
      title: "¿Cancelar invitación?",
      description: `El link enviado a ${email} dejará de funcionar.`,
      confirmLabel: "Cancelar invitación",
      destructive: true,
    });
    if (!ok) return;
    recordInvitationCancelled(id, actor);
    eliminar(id);
    toast.success("Invitación cancelada");
  };

  return (
    <div className="space-y-5">
      {/* ═════ Header ═════ */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Rendimiento de tu red
          </p>
          <h2 className="text-base font-semibold text-foreground leading-tight mt-0.5">
            {agenciasEnPromo.length} {agenciasEnPromo.length === 1 ? "agencia" : "agencias"} colaborando
          </h2>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={onOpenStats}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <BarChart3 className="h-3.5 w-3.5" strokeWidth={1.75} />
            Detalle
          </button>
          {canShare && (
            <button
              onClick={onInvitar}
              className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors ml-1"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              Invitar agencia
            </button>
          )}
        </div>
      </header>

      {/* ═════ KPIs ═════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={Eye}        label="Visitas"    value={kpis.visitas} tone="primary" />
        <KpiCard icon={FileText}   label="Registros"  value={kpis.registros} tone="muted" />
        <KpiCard icon={Home}       label="Ventas"     value={kpis.ventas} tone="success" />
        <KpiCard icon={TrendingUp} label="Conversión" value={`${kpis.conversion}%`} tone="warning" sub={formatEur(kpis.volumen)} />
      </div>

      {/* ═════ Solicitudes entrantes ═════ */}
      {solicitudes.length > 0 && (
        <section className="rounded-2xl border border-border bg-card shadow-soft">
          <SectionHeader
            icon={Inbox}
            title="Quieren colaborar contigo"
            subtitle={`${solicitudes.length} ${solicitudes.length === 1 ? "solicitud" : "solicitudes"} pendiente${solicitudes.length === 1 ? "" : "s"} de responder`}
            tone="violet"
          />
          <ul className="divide-y divide-border/50">
            {solicitudes.map((a) => (
              <li key={a.id} className="flex items-start gap-3 px-4 sm:px-5 py-3.5">
                <AgencyLogo agency={a} variant="full" />
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => navigate(`/colaboradores/${a.id}`)}
                    className="text-sm font-semibold text-foreground truncate hover:underline text-left"
                  >
                    {a.name}
                  </button>
                  <AgencyMetaLine agency={a} />
                  {a.mensajeSolicitud && (
                    <p className="text-[11.5px] text-foreground/70 mt-1.5 line-clamp-2 italic">
                      "{a.mensajeSolicitud}"
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                  <button
                    onClick={() => handleRechazarSolicitud(a.id, a.name)}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/5 transition-colors"
                    title="Rechazar"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                  <button
                    onClick={() => handleAprobarSolicitud(a.id, a.name)}
                    className="h-8 px-3.5 inline-flex items-center gap-1.5 rounded-full bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors"
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                    Aprobar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ═════ Invitaciones enviadas pendientes ═════ */}
      {invitaciones.length > 0 && (
        <section className="rounded-2xl border border-border bg-card shadow-soft">
          <SectionHeader
            icon={MailPlus}
            title="Agencias que has invitado a colaborar"
            subtitle={`${invitaciones.length} ${invitaciones.length === 1 ? "invitación enviada" : "invitaciones enviadas"} · pendientes de aceptar`}
            tone="blue"
          />
          <ul className="divide-y divide-border/50">
            {invitaciones.map((inv) => {
              const matched = findMatchingAgency(inv.emailAgencia);
              const displayName = matched?.name
                ?? (inv.nombreAgencia?.trim() ? inv.nombreAgencia : null)
                ?? "(aún sin registrarse)";
              const placeholder = !matched && !inv.nombreAgencia?.trim();
              const dias = daysUntil(inv.expiraEn);
              const pocosDias = dias <= 5;

              return (
                <li key={inv.id} className="flex items-start gap-3 px-4 sm:px-5 py-3.5">
                  <AgencyLogo
                    agency={matched ?? { logo: undefined, logoRect: undefined, name: displayName }}
                    variant="full"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "text-sm font-semibold truncate",
                      placeholder ? "text-muted-foreground italic font-normal" : "text-foreground",
                    )}>
                      {displayName}
                    </p>
                    <p className="text-[11.5px] text-muted-foreground truncate" title={inv.emailAgencia}>
                      {inv.emailAgencia}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 text-[10.5px] text-muted-foreground flex-wrap">
                      <Clock className="h-2.5 w-2.5" strokeWidth={1.75} />
                      <span>enviada {formatRelative(inv.createdAt)}</span>
                      <span className="text-border">·</span>
                      <span className={pocosDias ? "text-warning font-medium" : ""}>
                        {dias === 0 ? "caduca hoy" : dias === 1 ? "caduca mañana" : `caduca en ${dias}d`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                    <button
                      onClick={() => handleReenviar(inv.id, inv.emailAgencia)}
                      className="h-8 w-8 inline-flex items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title="Reenviar"
                    >
                      <RotateCw className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                    <button
                      onClick={() => handleCancelarInvitacion(inv.id, inv.emailAgencia)}
                      className="h-8 w-8 inline-flex items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/5 transition-colors"
                      title="Cancelar"
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ═════ Agencias colaborando ═════ */}
      {agenciasEnPromo.length > 0 && (
        <section className="rounded-2xl border border-border bg-card shadow-soft">
          <SectionHeader
            icon={Users}
            title="Agencias colaborando"
            subtitle={`${agenciasEnPromo.length} activ${agenciasEnPromo.length === 1 ? "a" : "as"} en esta promoción · ordenadas por ventas cerradas`}
            tone="neutral"
            rightSlot={
              <button
                onClick={() => navigate("/colaboradores")}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
              >
                Ver todas <ArrowUpRight className="h-3 w-3" />
              </button>
            }
          />
          <ul className="divide-y divide-border/50">
            {[...agenciasEnPromo]
              .sort((a, b) => (b.ventasCerradas ?? 0) - (a.ventasCerradas ?? 0))
              .map((a) => {
                const ventas = a.ventasCerradas ?? 0;
                const registros = a.registrations ?? a.registrosAportados ?? 0;
                const conversion = registros > 0 ? Math.round((ventas / registros) * 100) : 0;
                const lastActivity = formatRelativeISO(a.lastActivityAt);
                return (
                  <li
                    key={a.id}
                    className="px-4 sm:px-5 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => navigate(`/colaboradores/${a.id}`)}
                  >
                    <div className="flex items-start gap-3">
                      <AgencyLogo agency={a} variant="full" />
                      <div className="flex-1 min-w-0">
                        {/* Nombre + chips */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground truncate">{a.name}</p>
                          {a.especialidad && (
                            <span className="inline-flex items-center h-5 px-2 rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
                              {especialidadLabel[a.especialidad]}
                            </span>
                          )}
                          {typeof a.googleRating === "number" && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
                              <Star className="h-3 w-3 fill-warning text-warning" strokeWidth={0} />
                              <span className="font-semibold text-foreground">{a.googleRating.toFixed(1)}</span>
                              {a.googleRatingsTotal ? <span>({a.googleRatingsTotal})</span> : null}
                            </span>
                          )}
                        </div>
                        <AgencyMetaLine agency={a} />
                        {/* Contacto + última actividad */}
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground flex-wrap">
                          {a.contactoPrincipal?.nombre && (
                            <span className="truncate">
                              {a.contactoPrincipal.nombre}
                              {a.contactoPrincipal.rol ? ` · ${a.contactoPrincipal.rol}` : ""}
                            </span>
                          )}
                          {lastActivity && (
                            <>
                              <span className="text-border">·</span>
                              <span className="inline-flex items-center gap-1">
                                <Activity className="h-2.5 w-2.5" strokeWidth={1.75} />
                                {lastActivity}
                              </span>
                            </>
                          )}
                          {typeof a.comisionMedia === "number" && a.comisionMedia > 0 && (
                            <>
                              <span className="text-border">·</span>
                              <span>Com. <span className="text-foreground font-medium tabular-nums">{a.comisionMedia}%</span></span>
                            </>
                          )}
                        </div>
                      </div>
                      {/* KPIs compactos a la derecha */}
                      <div className="hidden sm:flex items-center gap-4 shrink-0 pt-0.5 text-xs text-muted-foreground tabular-nums">
                        <MetricInline label="reg." value={registros} />
                        <MetricInline label="ventas" value={ventas} />
                        <div className="text-right">
                          <p className={cn(
                            "text-sm font-bold tabular-nums leading-none",
                            conversion > 0 ? "text-success" : "text-muted-foreground",
                          )}>
                            {conversion}%
                          </p>
                          <p className="text-[9.5px] uppercase tracking-wider mt-0.5">conv.</p>
                        </div>
                      </div>
                    </div>
                    {/* KPIs compactos en móvil, debajo */}
                    <div className="sm:hidden flex items-center gap-4 mt-2 text-[11px] text-muted-foreground tabular-nums">
                      <MetricInline label="reg." value={registros} />
                      <MetricInline label="ventas" value={ventas} />
                      <span className={cn(
                        "font-semibold",
                        conversion > 0 ? "text-success" : "text-muted-foreground",
                      )}>
                        {conversion}% conv.
                      </span>
                    </div>
                  </li>
                );
              })}
          </ul>
        </section>
      )}

      {/* ═════ Empty state · sin colaboradoras ni pendientes ═════ */}
      {agenciasEnPromo.length === 0 && solicitudes.length === 0 && invitaciones.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <Users className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium text-foreground mb-1">Aún no colabora ninguna agencia</p>
          <p className="text-xs text-muted-foreground mb-4">
            Cuando invites a una agencia y acepte, verás aquí sus métricas agregadas para esta promoción.
          </p>
          {canShare && (
            <button
              onClick={onInvitar}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-border bg-background text-xs font-semibold text-foreground hover:bg-muted transition-colors"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              Invitar agencia
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Sub-componentes
 * ════════════════════════════════════════════════════════════════ */

function SectionHeader({
  icon: Icon, title, subtitle, tone, rightSlot,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  subtitle: string;
  tone: "violet" | "blue" | "neutral";
  rightSlot?: React.ReactNode;
}) {
  const toneClass = {
    violet:  "bg-violet-500/10 text-violet-700 dark:text-violet-400",
    blue:    "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    neutral: "bg-muted text-foreground",
  }[tone];
  return (
    <div className="px-4 sm:px-5 py-3 border-b border-border/60 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={cn("h-7 w-7 rounded-full grid place-items-center shrink-0", toneClass)}>
          <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground truncate">{title}</h3>
          <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>
        </div>
      </div>
      {rightSlot}
    </div>
  );
}

function AgencyMetaLine({ agency: a }: { agency: Agency }) {
  return (
    <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground flex-wrap">
      {a.location && (
        <span className="inline-flex items-center gap-1 min-w-0 truncate">
          <MapPin className="h-2.5 w-2.5 shrink-0" strokeWidth={1.75} />
          <span className="truncate">{a.location}</span>
        </span>
      )}
      {typeof a.teamSize === "number" && a.teamSize > 0 && (
        <>
          <span className="text-border">·</span>
          <span>
            <span className="text-foreground font-medium tabular-nums">{a.teamSize}</span> agente{a.teamSize === 1 ? "" : "s"}
          </span>
        </>
      )}
    </div>
  );
}

function MetricInline({ label, value }: { label: string; value: number }) {
  return (
    <span className="text-[11px] text-muted-foreground">
      <span className="text-foreground font-semibold tabular-nums">{value}</span> {label}
    </span>
  );
}

function KpiCard({
  icon: Icon, label, value, tone, sub,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: number | string;
  tone: "primary" | "success" | "warning" | "muted";
  sub?: string;
}) {
  const toneClass = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    muted:   "bg-muted text-muted-foreground",
  }[tone];
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
      <div className={cn("h-8 w-8 rounded-lg grid place-items-center", toneClass)}>
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-2.5">{label}</p>
      <p className="text-[22px] font-bold tabular-nums leading-none mt-1">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">{sub}</p>}
    </div>
  );
}
