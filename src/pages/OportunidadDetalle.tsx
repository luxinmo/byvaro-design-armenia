/**
 * Ficha de oportunidad · `/oportunidades/:id`.
 *
 * Reutiliza el layout canónico de detalle (header sticky + grid 2 col)
 * usado en `ContactoDetalle.tsx` y `LeadDetalle.tsx`. NO introduce un
 * nuevo idioma visual.
 *
 * Bloques (spec):
 *   1. Header · nombre + nacionalidad + etapa + temperatura + responsable + 5 CTAs principales + "Ver más opciones"
 *   2. Pipeline visual · Interés → Visita → Evaluación → Negociación → Ganada/Perdida
 *   3. Interés declarado (bloque estructurado, editable)
 *   4. Matching · promociones recomendadas + propiedades recomendadas
 *   5. Registros · colapsable · badge "Registro pendiente" si aplica
 *   6. Actividad (timeline)
 *   7. Comunicación (emails resumen + comentarios)
 *   8. Sidebar · identidad · origen · asignación · etiquetas
 *
 * TODO(backend): toda mutación emite evento en `opportunity.timeline` y
 *   en `contact.history` (regla de oro `CLAUDE.md §🥇 Historial del contacto`).
 *   Endpoints en `docs/backend-integration.md §7.3`.
 */

import { useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowLeft, Mail, MessageSquare, Calendar as CalendarIcon, ArrowRight,
  Flame, Snowflake, FileText, MoreHorizontal, ExternalLink, Clock,
  ChevronDown, ChevronUp, MapPin, Home, Euro, BedDouble, Sparkles,
  Send, Eye, AlertCircle, AlertTriangle, Check, X, TrendingUp,
  Target, UserPlus, Layers, Globe, Tag as TagIcon, Archive,
  Trash2, Pencil, RotateCw, Building2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Flag } from "@/components/ui/Flag";
import {
  findOpportunity, opportunityStageConfig, temperatureConfig,
  registrationStatusConfig, opportunitySourceLabel, hasPendingRegistration,
  nextStage,
  type Opportunity, type OpportunityStage, type OpportunityMatch,
} from "@/data/opportunities";
import { findTeamMember, memberInitials, getMemberAvatarUrl } from "@/lib/team";
import { formatDate } from "@/lib/dateFormat";
import { cn } from "@/lib/utils";

/* ══════ Helpers locales ══════════════════════════════════════════ */

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
  if (weeks < 8) return `hace ${weeks} sem`;
  const months = Math.floor(days / 30);
  return `hace ${months} m`;
}

const PIPELINE: OpportunityStage[] = ["interes", "visita", "evaluacion", "negociacion", "ganada"];

/* ══════ Página ═══════════════════════════════════════════════════ */

export default function OportunidadDetalle() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const opp = useMemo(() => findOpportunity(id), [id]);
  const [regsOpen, setRegsOpen] = useState(true);
  const [allTimelineOpen, setAllTimelineOpen] = useState(false);

  if (!opp) {
    return (
      <div className="flex flex-col min-h-full bg-background items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">Oportunidad no encontrada.</p>
        <button
          onClick={() => navigate("/oportunidades")}
          className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-border bg-card text-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Volver a oportunidades
        </button>
      </div>
    );
  }

  const stage = opportunityStageConfig[opp.stage];
  const temp = temperatureConfig[opp.temperature];
  const member = opp.assigneeUserId ? findTeamMember(opp.assigneeUserId) : undefined;
  const pendingReg = hasPendingRegistration(opp);
  const next = nextStage(opp.stage);

  return (
    <div className="flex flex-col min-h-full bg-background">
      {/* ══════ Header sticky ══════ */}
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <button
            onClick={() => navigate("/oportunidades")}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3 w-3" strokeWidth={2} />
            Oportunidades
          </button>

          <div className="mt-2 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            {/* Identidad */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-11 w-11 rounded-full bg-muted grid place-items-center text-[13px] font-bold text-foreground shrink-0">
                {opp.fullName.split(" ").map((w) => w[0]).slice(0, 2).join("")}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">
                    {opp.fullName}
                  </h1>
                  {opp.nationality && <Flag iso={opp.nationality} size={16} />}
                  <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5", stage.badgeClass)}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", stage.dotClass)} />
                    {stage.label}
                  </span>
                  <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5", temp.badgeClass)}>
                    {opp.temperature === "caliente" && <Flame className="h-2.5 w-2.5" strokeWidth={2.5} />}
                    {opp.temperature === "frio" && <Snowflake className="h-2.5 w-2.5" strokeWidth={2.5} />}
                    {temp.label}
                  </span>
                  {pendingReg && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 bg-warning/10 text-warning border border-warning/25">
                      <AlertCircle className="h-2.5 w-2.5" strokeWidth={2.5} />
                      Registro pendiente
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {opportunitySourceLabel[opp.source]}
                  {" · "}
                  Creada {relativeTime(opp.createdAt)}
                  {" · "}
                  Última actividad {relativeTime(opp.lastActivityAt)}
                </p>
              </div>
            </div>

            {/* CTAs principales · máximo 5 · resto en "Ver más opciones" */}
            <div className="flex items-center gap-2 flex-wrap">
              <CTAPill icon={MessageSquare} label="Comentar"        onClick={() => toast.info("Abriendo comentario")} />
              <CTAPill icon={Mail}           label="Enviar email"    onClick={() => toast.info("Abriendo composer de email")} />
              <CTAPill icon={UserPlus}       label="Registrar cliente" onClick={() => toast.info("Abriendo registro de cliente")} />
              <CTAPill icon={CalendarIcon}   label="Programar visita"  onClick={() => toast.info("Abriendo planificador de visita")} />
              {next && (
                <CTAPill
                  icon={ArrowRight}
                  label={`Mover a ${opportunityStageConfig[next].label}`}
                  primary
                  onClick={() => toast.success(`Etapa → ${opportunityStageConfig[next].label}`)}
                />
              )}

              {/* Ver más opciones */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="h-10 w-10 inline-flex items-center justify-center rounded-full border border-border bg-card text-foreground hover:bg-muted transition-colors">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuItem onClick={() => toast.info("Editar interés")}          className="gap-2 text-xs"><Pencil className="h-3.5 w-3.5" /> Editar interés</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setAllTimelineOpen(true)}              className="gap-2 text-xs"><Eye className="h-3.5 w-3.5" /> Ver historial completo</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setRegsOpen((v) => !v)}                className="gap-2 text-xs"><Layers className="h-3.5 w-3.5" /> {regsOpen ? "Ocultar" : "Mostrar"} registros</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast.info("Reasignar responsable")}   className="gap-2 text-xs"><RotateCw className="h-3.5 w-3.5" /> Reasignar responsable</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => toast.info("Marcar perdida")}          className="gap-2 text-xs text-destructive"><X className="h-3.5 w-3.5" /> Marcar como perdida</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast.info("Archivada (mock)")}        className="gap-2 text-xs text-muted-foreground"><Archive className="h-3.5 w-3.5" /> Archivar</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => toast.info("Vincular otra propiedad")} className="gap-2 text-xs"><Home className="h-3.5 w-3.5" /> Vincular otra propiedad</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast.info("Vincular otra promoción")} className="gap-2 text-xs"><Building2 className="h-3.5 w-3.5" /> Vincular otra promoción</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast.info("Crear tarea")}             className="gap-2 text-xs"><CalendarIcon className="h-3.5 w-3.5" /> Crear tarea</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => toast.info("Ver eventos de email")}    className="gap-2 text-xs"><Mail className="h-3.5 w-3.5" /> Ver eventos completos de email</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* ══════ Pipeline visual ══════ */}
      <section className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8 mt-5">
        <PipelineBar stage={opp.stage} />
      </section>

      {/* ══════ Body · grid 2 col ══════ */}
      <section className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8 mt-5 pb-12 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        {/* ─── Columna principal ─── */}
        <div className="min-w-0 space-y-5">
          {/* 1. Interés */}
          <Section title="Interés declarado" action={
            <button
              onClick={() => toast.info("Editor de interés · UI pendiente")}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <Pencil className="h-3 w-3" /> Editar
            </button>
          }>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <InterestField icon={Home}      label="Tipología"    value={opp.interest.propertyType} />
              <InterestField icon={BedDouble} label="Dormitorios"  value={opp.interest.bedrooms} />
              <InterestField icon={MapPin}    label="Zona"         value={opp.interest.area} />
              <InterestField
                icon={Euro} label="Presupuesto"
                value={
                  opp.interest.budgetMin != null && opp.interest.budgetMax != null
                    ? `${formatPrice(opp.interest.budgetMin)} – ${formatPrice(opp.interest.budgetMax)}`
                    : formatPrice(opp.interest.budgetMax ?? opp.interest.budgetMin)
                }
              />
              {opp.interest.originPromotionName && (
                <div className="col-span-2 sm:col-span-3 min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> Promoción origen
                  </p>
                  <Link
                    to={`/promociones/${opp.interest.originPromotionId}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:text-primary transition-colors"
                  >
                    {opp.interest.originPromotionName}
                    <ExternalLink className="h-3 w-3 text-muted-foreground" strokeWidth={1.75} />
                  </Link>
                </div>
              )}
            </div>

            {opp.interest.extras && opp.interest.extras.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border/50">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">Extras</p>
                <div className="flex flex-wrap gap-1.5">
                  {opp.interest.extras.map((x) => (
                    <span key={x} className="inline-flex items-center h-6 px-2 rounded-full bg-muted text-[11px] font-medium">
                      {x}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* 2. Matching · recomendadas */}
          <MatchingSection opp={opp} />

          {/* 3. Registros · colapsable */}
          <RegistrationsSection opp={opp} open={regsOpen} onToggle={() => setRegsOpen((v) => !v)} />

          {/* 4. Actividad timeline */}
          <Section title="Actividad" action={
            <button
              onClick={() => setAllTimelineOpen((v) => !v)}
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {allTimelineOpen ? "Ver resumen" : "Ver todo"}
            </button>
          }>
            <Timeline events={allTimelineOpen ? opp.timeline : opp.timeline.slice(-6)} />
          </Section>

          {/* 5. Comunicación */}
          <Section title="Comunicación"
            action={
              <button
                onClick={() => toast.info("Abriendo composer")}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                <Send className="h-3 w-3" /> Enviar email
              </button>
            }
          >
            <EmailResumen emails={opp.emails} />
            <hr className="my-4 border-border/50" />
            <Comments comments={opp.comments} />
          </Section>
        </div>

        {/* ─── Sidebar (~320px) ─── */}
        <aside className="space-y-5 min-w-0">
          <Section title="Identidad" dense>
            <dl className="space-y-2 text-xs">
              <DtDd label="Cliente">
                <Link to={`/contactos/${opp.contactId}`} className="text-foreground hover:text-primary inline-flex items-center gap-1">
                  {opp.fullName} <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </Link>
              </DtDd>
              {opp.nationality && (
                <DtDd label="Nacionalidad">
                  <span className="inline-flex items-center gap-1.5">
                    <Flag iso={opp.nationality} size={12} />
                    {opp.nationality}
                  </span>
                </DtDd>
              )}
              <DtDd label="Origen">{opportunitySourceLabel[opp.source]}</DtDd>
              {opp.sourceLeadId && (
                <DtDd label="Lead origen">
                  <Link to={`/leads/${opp.sourceLeadId}`} className="text-foreground hover:text-primary inline-flex items-center gap-1">
                    {opp.sourceLeadId} <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </Link>
                </DtDd>
              )}
              <DtDd label="Creada">{formatDate(opp.createdAt)}</DtDd>
            </dl>
          </Section>

          <Section title="Asignación" dense
            action={
              <button
                onClick={() => toast.info("Reasignar · disponible al conectar backend")}
                className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Reasignar
              </button>
            }
          >
            {member ? (
              <div className="flex items-center gap-2.5">
                {getMemberAvatarUrl(member) ? (
                  <img src={getMemberAvatarUrl(member)!} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-muted grid place-items-center text-[10px] font-bold">
                    {memberInitials(member)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{member.name}</p>
                  {member.jobTitle && <p className="text-[11px] text-muted-foreground truncate">{member.jobTitle}</p>}
                </div>
              </div>
            ) : (
              <button
                onClick={() => toast.info("Asignar responsable")}
                className="w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-full border border-dashed border-border text-[12px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                <UserPlus className="h-3 w-3" /> Asignar responsable
              </button>
            )}
          </Section>

          <Section title="Etiquetas" dense
            action={
              <button
                onClick={() => toast.info("Editor de tags · UI pendiente")}
                className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Editar
              </button>
            }
          >
            {opp.tags && opp.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {opp.tags.map((t) => (
                  <span key={t} className="inline-flex items-center h-6 px-2 rounded-full bg-muted text-[11px] font-medium">
                    <TagIcon className="h-2.5 w-2.5 mr-1 text-muted-foreground" strokeWidth={2} />
                    {t}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground italic">Sin etiquetas</p>
            )}
          </Section>

          {opp.stage === "perdida" && opp.lostReason && (
            <Section title="Motivo de pérdida" dense>
              <p className="text-[12px] text-foreground">{opp.lostReason}</p>
            </Section>
          )}
        </aside>
      </section>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SUBCOMPONENTES
   ═══════════════════════════════════════════════════════════════════ */

function CTAPill({
  icon: Icon, label, onClick, primary, danger, disabled,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  const base = "inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-sm font-medium transition-colors shadow-soft";
  const cls = disabled
    ? "bg-muted text-muted-foreground/50 cursor-not-allowed"
    : primary
      ? "bg-foreground text-background hover:bg-foreground/90"
      : danger
        ? "border border-destructive/25 bg-destructive/5 text-destructive hover:bg-destructive/10"
        : "border border-border bg-card text-foreground hover:bg-muted";
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled} className={cn(base, cls)}>
      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
      {label}
    </button>
  );
}

function Section({
  title, children, dense, action,
}: {
  title: string;
  children: React.ReactNode;
  dense?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
      <header className={cn("border-b border-border px-4 sm:px-5 flex items-center justify-between gap-3", dense ? "py-2.5" : "py-3")}>
        <h2 className={cn("font-semibold text-foreground", dense ? "text-[12.5px]" : "text-sm")}>{title}</h2>
        {action}
      </header>
      <div className={cn(dense ? "p-4" : "p-4 sm:p-5")}>{children}</div>
    </section>
  );
}

function DtDd({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[11px] text-muted-foreground uppercase tracking-wider shrink-0">{label}</dt>
      <dd className="text-right min-w-0 truncate">{children}</dd>
    </div>
  );
}

function InterestField({
  icon: Icon, label, value,
}: {
  icon: LucideIcon;
  label: string;
  value?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1 flex items-center gap-1">
        <Icon className="h-3 w-3" strokeWidth={1.75} /> {label}
      </p>
      <p className="text-sm font-medium text-foreground truncate">{value ?? "—"}</p>
    </div>
  );
}

/* ══════ Pipeline bar ══════════════════════════════════════════════ */

function PipelineBar({ stage }: { stage: OpportunityStage }) {
  const currentIdx = PIPELINE.indexOf(stage);
  const isClosed = stage === "ganada" || stage === "perdida";

  return (
    <div className="rounded-2xl border border-border bg-card p-3 sm:p-4 shadow-soft">
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {PIPELINE.map((s, i) => {
          const cfg = opportunityStageConfig[s];
          const isCurrent = s === stage;
          const isPast = currentIdx > i || (isClosed && s !== "ganada");
          const isLost = stage === "perdida" && s === "ganada";

          return (
            <div key={s} className="flex items-center gap-1.5 shrink-0">
              <div
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors",
                  isCurrent && "bg-foreground text-background",
                  !isCurrent && isPast && "bg-success/10 text-success border border-success/25",
                  !isCurrent && !isPast && "bg-muted text-muted-foreground",
                  isLost && "bg-muted text-muted-foreground",
                )}
              >
                {isPast && !isCurrent && !isLost && <Check className="h-3 w-3" strokeWidth={2.5} />}
                {cfg.label}
              </div>
              {i < PIPELINE.length - 1 && (
                <ArrowRight className="h-3 w-3 text-muted-foreground/60 shrink-0" strokeWidth={1.75} />
              )}
            </div>
          );
        })}
        {stage === "perdida" && (
          <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-semibold text-destructive bg-destructive/5 border border-destructive/25 rounded-full px-2 py-0.5">
            <X className="h-2.5 w-2.5" strokeWidth={2.5} /> Perdida
          </span>
        )}
      </div>
    </div>
  );
}

/* ══════ Matching ══════════════════════════════════════════════════ */

function MatchingSection({ opp }: { opp: Opportunity }) {
  const promos = opp.matches?.filter((m) => m.kind === "promotion") ?? [];
  const props  = opp.matches?.filter((m) => m.kind === "property") ?? [];

  return (
    <Section
      title="Recomendadas para esta oportunidad"
      action={
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
          IA · {(opp.matches?.length ?? 0)} sugerencias
        </span>
      }
    >
      {(promos.length === 0 && props.length === 0) ? (
        <div className="text-center py-6">
          <Sparkles className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-[12px] font-medium text-foreground">Sin sugerencias todavía</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            La IA generará matching cuando haya más datos de interés.
          </p>
          <button
            onClick={() => toast.info("Buscar manualmente · UI pendiente")}
            className="mt-3 inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-border bg-card text-[11.5px] font-medium hover:bg-muted"
          >
            Buscar manualmente
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {promos.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Promociones recomendadas
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {promos.map((m) => <MatchCard key={m.id} m={m} />)}
              </div>
            </div>
          )}
          {props.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Propiedades recomendadas
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {props.map((m) => <MatchCard key={m.id} m={m} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

function MatchCard({ m }: { m: OpportunityMatch }) {
  const href = m.kind === "promotion" ? `/promociones/${m.refId}` : `/propiedades/${m.refId}`;
  return (
    <div className="rounded-xl border border-border p-3 hover:shadow-soft-lg transition-shadow bg-card">
      <div className="flex items-start gap-3">
        <div className="h-14 w-14 rounded-lg bg-muted grid place-items-center text-muted-foreground/60 shrink-0 overflow-hidden">
          {m.image ? (
            <img src={m.image} alt="" className="h-full w-full object-cover" />
          ) : (
            m.kind === "promotion" ? <Building2 className="h-5 w-5" /> : <Home className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-semibold truncate flex-1">{m.name}</p>
            {m.score != null && (
              <span className="inline-flex items-center text-[10px] font-bold tabular-nums text-success bg-success/10 rounded-full px-1.5 py-0.5 shrink-0">
                {m.score}%
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground truncate">
            {m.location}
            {(m.priceFrom ?? m.priceExact) != null && (
              <>
                {" · "}
                {m.priceFrom != null ? `desde ${formatPrice(m.priceFrom)}` : formatPrice(m.priceExact)}
              </>
            )}
          </p>
          <p className="text-[11px] text-foreground/80 italic mt-1 line-clamp-2">{m.reason}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-3">
        <button
          onClick={() => toast.success("Enviado por email (mock)")}
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full border border-border bg-card text-[11px] font-medium hover:bg-muted"
        >
          <Send className="h-3 w-3" /> Enviar
        </button>
        <Link
          to={href}
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full border border-border bg-card text-[11px] font-medium hover:bg-muted"
        >
          <Eye className="h-3 w-3" /> Ver ficha
        </Link>
        <button
          onClick={() => toast.info("Registrar cliente · UI pendiente")}
          className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-foreground text-background text-[11px] font-medium ml-auto"
        >
          <UserPlus className="h-3 w-3" /> Registrar
        </button>
      </div>
    </div>
  );
}

/* ══════ Registros ═════════════════════════════════════════════════ */

function RegistrationsSection({
  opp, open, onToggle,
}: {
  opp: Opportunity;
  open: boolean;
  onToggle: () => void;
}) {
  const count = opp.registrations.length;
  const pendingCount = opp.registrations.filter((r) => r.status === "pendiente").length;

  return (
    <section className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 border-b border-border px-4 sm:px-5 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Registros asociados</h2>
          <span className="text-[10px] text-muted-foreground">{count}</span>
          {pendingCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 bg-warning/10 text-warning border border-warning/25">
              <AlertCircle className="h-2.5 w-2.5" strokeWidth={2.5} />
              {pendingCount} pendiente{pendingCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          {open ? <>Ocultar <ChevronUp className="h-3 w-3" /></> : <>Mostrar <ChevronDown className="h-3 w-3" /></>}
        </span>
      </button>

      {open && (
        <div className="p-4 sm:p-5">
          {count === 0 ? (
            <div className="text-center py-6">
              <UserPlus className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-[12px] font-medium text-foreground">Sin registros todavía</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Cuando registres al cliente en una promoción aparecerá aquí.
              </p>
              <button
                onClick={() => toast.info("Registrar cliente · UI pendiente")}
                className="mt-3 inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-foreground text-background text-[11.5px] font-medium"
              >
                <UserPlus className="h-3 w-3" /> Registrar cliente
              </button>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {opp.registrations.map((r) => {
                const cfg = registrationStatusConfig[r.status];
                const agent = r.agentUserId ? findTeamMember(r.agentUserId) : undefined;
                return (
                  <li key={r.id} className="rounded-xl border border-border p-3.5 bg-card">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-lg bg-muted grid place-items-center text-muted-foreground/60 shrink-0">
                        <Building2 className="h-4 w-4" strokeWidth={1.75} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3 mb-0.5">
                          <p className="text-sm font-semibold text-foreground truncate">{r.promotionName}</p>
                          <span className={cn("inline-flex items-center text-[10px] font-medium rounded-full px-2 py-0.5 shrink-0", cfg.badgeClass)}>
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-[11.5px] text-muted-foreground truncate">
                          {r.agencyName ? `${r.agencyName} · ` : ""}
                          {agent?.name ?? r.agentName}
                          {" · "}
                          <span className="tabular-nums">{relativeTime(r.createdAt)}</span>
                        </p>
                        {r.note && (
                          <p className="text-[11.5px] text-foreground/80 italic mt-1.5">"{r.note}"</p>
                        )}
                        {r.decidedAt && r.decidedByName && (
                          <p className="text-[10.5px] text-muted-foreground mt-1">
                            Decidido por {r.decidedByName} · {relativeTime(r.decidedAt)}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

/* ══════ Timeline ══════════════════════════════════════════════════ */

const TIMELINE_ICON: Record<string, LucideIcon> = {
  "lead-received":          Mail,
  "opportunity-created":    Sparkles,
  "stage-changed":          ArrowRight,
  "interest-updated":       Pencil,
  "email-sent":             Send,
  "email-opened":           Eye,
  "email-bounced":          AlertTriangle,
  "email-replied":          Mail,
  "property-sent":          Home,
  "promotion-sent":         Building2,
  "comment-added":          MessageSquare,
  "registration-created":   UserPlus,
  "registration-accepted":  Check,
  "registration-rejected":  X,
  "visit-scheduled":        CalendarIcon,
  "visit-completed":        CalendarIcon,
  "assignee-changed":       RotateCw,
  "won":                    TrendingUp,
  "lost":                   X,
};

function Timeline({ events }: { events: Opportunity["timeline"] }) {
  if (events.length === 0) {
    return <p className="text-[11px] text-muted-foreground italic text-center py-3">Sin actividad registrada.</p>;
  }
  const sorted = [...events].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  return (
    <ul className="space-y-3.5">
      {sorted.map((ev) => {
        const Icon = TIMELINE_ICON[ev.type] ?? Clock;
        const isNegative = ev.type === "email-bounced" || ev.type === "lost" || ev.type === "registration-rejected";
        const isPositive = ev.type === "won" || ev.type === "registration-accepted" || ev.type === "email-opened";
        return (
          <li key={ev.id} className="flex items-start gap-3 min-w-0">
            <div className={cn(
              "h-7 w-7 rounded-full grid place-items-center shrink-0",
              isNegative ? "bg-destructive/5 text-destructive" :
              isPositive ? "bg-success/10 text-success" :
              "bg-muted text-muted-foreground",
            )}>
              <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2 min-w-0">
                <p className="text-[12.5px] font-medium text-foreground truncate">{ev.title}</p>
                <p className="text-[10.5px] text-muted-foreground shrink-0 tabular-nums">{relativeTime(ev.occurredAt)}</p>
              </div>
              {ev.description && <p className="text-[11.5px] text-muted-foreground mt-0.5">{ev.description}</p>}
              {ev.byName && <p className="text-[10.5px] text-muted-foreground/80 mt-0.5">por {ev.byName}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ══════ Emails + comentarios ═══════════════════════════════════════ */

function EmailResumen({ emails }: { emails: Opportunity["emails"] }) {
  const sent = emails.filter((e) => e.direction === "sent").length;
  const received = emails.filter((e) => e.direction === "received").length;
  const opened = emails.filter((e) => e.status === "opened").length;
  const bounced = emails.filter((e) => e.status === "bounced").length;
  const replied = emails.filter((e) => e.status === "replied").length;

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3">
        <MiniStat label="Enviados"  value={sent}     tone="neutral" />
        <MiniStat label="Recibidos" value={received} tone="neutral" />
        <MiniStat label="Abiertos"  value={opened}   tone="success" />
        <MiniStat label="Respondidos" value={replied} tone="primary" />
        <MiniStat label="Rebotados" value={bounced}  tone="destructive" />
      </div>
      {emails.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic text-center py-3">Sin emails todavía.</p>
      ) : (
        <ul className="space-y-2">
          {emails.slice(-4).reverse().map((e) => (
            <li key={e.id} className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2 text-[12px]">
              <Mail className={cn(
                "h-3.5 w-3.5 shrink-0",
                e.direction === "sent" ? "text-primary" : "text-muted-foreground",
              )} strokeWidth={1.75} />
              <div className="flex-1 min-w-0">
                <p className="text-foreground truncate font-medium">{e.subject}</p>
                <p className="text-[10.5px] text-muted-foreground truncate">
                  {e.direction === "sent" ? `Enviado por ${e.fromName ?? "—"}` : `De ${e.fromName ?? "—"}`}
                  {" · "}{relativeTime(e.at)}
                </p>
              </div>
              {e.status && (
                <span className={cn(
                  "text-[10px] font-medium rounded-full px-2 py-0.5",
                  e.status === "opened"    && "bg-success/10 text-success",
                  e.status === "delivered" && "bg-muted text-muted-foreground",
                  e.status === "replied"   && "bg-primary/10 text-primary",
                  e.status === "bounced"   && "bg-destructive/5 text-destructive",
                )}>
                  {e.status === "opened" ? "Abierto" :
                   e.status === "delivered" ? "Entregado" :
                   e.status === "replied" ? "Respondido" :
                   "Rebotado"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MiniStat({
  label, value, tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "primary" | "success" | "destructive";
}) {
  const cls = {
    neutral: "bg-muted text-muted-foreground",
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/5 text-destructive",
  }[tone];
  return (
    <div className={cn("rounded-lg p-2 text-center", cls)}>
      <p className="text-[9px] uppercase tracking-wider font-semibold">{label}</p>
      <p className="text-sm font-bold tabular-nums leading-tight">{value}</p>
    </div>
  );
}

function Comments({ comments }: { comments: Opportunity["comments"] }) {
  const [draft, setDraft] = useState("");
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Comentarios internos</p>

      {comments.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic mb-3">Sin comentarios.</p>
      ) : (
        <ul className="space-y-2.5 mb-3">
          {[...comments].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((c) => (
            <li key={c.id} className="rounded-lg border border-border/60 p-3 bg-muted/10">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-[11.5px] font-semibold text-foreground truncate">{c.authorName}</p>
                <p className="text-[10px] text-muted-foreground">{relativeTime(c.createdAt)}</p>
              </div>
              <p className="text-[12px] text-foreground leading-relaxed">{c.body}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-start gap-2">
        <textarea
          rows={2}
          placeholder="Escribe un comentario interno…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm focus:border-foreground focus:outline-none resize-none"
        />
        <button
          disabled={!draft.trim()}
          onClick={() => {
            toast.success("Comentario añadido (mock)");
            setDraft("");
          }}
          className={cn(
            "inline-flex items-center gap-1 h-9 px-3 rounded-full text-sm font-medium",
            draft.trim()
              ? "bg-foreground text-background hover:bg-foreground/90"
              : "bg-muted text-muted-foreground/50 cursor-not-allowed",
          )}
        >
          <Send className="h-3 w-3" /> Enviar
        </button>
      </div>
    </div>
  );
}
