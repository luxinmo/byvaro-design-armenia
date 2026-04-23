/**
 * LeadDetalle · ficha completa de un lead (`/leads/:id`).
 *
 * Estructura:
 *   - Header sticky: back + identidad + status + 5 CTAs (Llamar · Email ·
 *     WhatsApp · Convertir · Descartar).
 *   - Grid 2-col desktop:
 *       Izq  (2/3): Interés · Mensaje del lead · Timeline · Match de
 *                   duplicados (si aplica).
 *       Der  (1/3): Identidad · Asignación · Origen · Etiquetas.
 *
 * TODO(backend): endpoints en `docs/backend-integration.md §7.1`
 *   - `GET /api/leads/:id` → Lead completo
 *   - `POST /api/leads/:id/convert` → promover a Registro
 *   - `PATCH /api/leads/:id { status }` → cualificar / descartar
 *   - `PATCH /api/leads/:id/assign { userId }` → reasignar
 */

import { useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, Phone, Mail, MessageCircle, CheckCircle2, XCircle,
  Clock, User, UserPlus, Tag, Copy, AlertTriangle, Home, MapPin,
  Euro, Bed, Inbox, ExternalLink, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  leads, leadStatusConfig, leadSourceLabel,
  type Lead, type LeadStatus,
} from "@/data/leads";
import { developerOnlyPromotions } from "@/data/developerPromotions";
import { Building2 } from "lucide-react";
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

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
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

export default function LeadDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const lead = useMemo(() => leads.find((l) => l.id === id), [id]);

  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <Inbox className="h-10 w-10 text-muted-foreground/40 mb-3" strokeWidth={1.5} />
        <h1 className="text-base font-semibold text-foreground mb-1">Lead no encontrado</h1>
        <p className="text-xs text-muted-foreground mb-5">El lead con id <code className="bg-muted px-1.5 rounded">{id}</code> no existe o ya fue eliminado.</p>
        <button
          onClick={() => navigate("/leads")}
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 shadow-soft transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
          Volver a Leads
        </button>
      </div>
    );
  }

  const status = leadStatusConfig[lead.status];
  const isDup = lead.status === "duplicate" || (lead.duplicateScore ?? 0) >= 70;
  const promo = lead.interest.promotionId
    ? developerOnlyPromotions.find((p) => p.id === lead.interest.promotionId)
    : undefined;

  return (
    <div className="flex flex-col min-h-full bg-background pb-12">
      {/* ─── Back + Header sticky ─── */}
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="pt-5 pb-3">
            <button
              onClick={() => navigate("/leads")}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
              Leads
            </button>

            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
              <div className="flex items-start gap-4 min-w-0">
                <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center shrink-0 text-base font-bold text-foreground">
                  {lead.fullName.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {lead.nationality && <span className="text-xl leading-none">{flagOf(lead.nationality)}</span>}
                    <h1 className="text-[22px] sm:text-[26px] font-bold tracking-tight text-foreground leading-tight">
                      {lead.fullName}
                    </h1>
                    <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2.5 py-0.5", status.badgeClass)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", status.dotClass)} />
                      {status.label}
                    </span>
                    {isDup && (
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-destructive bg-destructive/10 border border-destructive/25 rounded-full px-2 py-0.5"
                        title={`IA de duplicados · ${lead.duplicateScore ?? 100}% match`}
                      >
                        <Copy className="h-3 w-3" strokeWidth={2.5} />
                        DUPLICADO {lead.duplicateScore != null ? `${lead.duplicateScore}%` : ""}
                      </span>
                    )}
                  </div>
                  <p className="text-[11.5px] text-muted-foreground mt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <Inbox className="h-3 w-3" strokeWidth={1.75} />
                      {leadSourceLabel[lead.source]}
                    </span>
                    <span className="text-muted-foreground/60">·</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" strokeWidth={1.75} />
                      {relativeTime(lead.createdAt)}
                    </span>
                    {lead.assignedTo && (
                      <>
                        <span className="text-muted-foreground/60">·</span>
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3 w-3" strokeWidth={1.75} />
                          {lead.assignedTo.name}
                        </span>
                      </>
                    )}
                  </p>

                  {/* Promoción/propiedad referenciada · spec §B.1
                     "related property or promotion · image thumbnail if reference exists". */}
                  {promo && (
                    <Link
                      to={`/promociones/${promo.id}`}
                      className="mt-2 inline-flex items-center gap-2.5 rounded-xl border border-border bg-card pl-1 pr-3 py-1 hover:bg-muted transition-colors shadow-soft max-w-full"
                      title={`Ir a la promoción · ${promo.name}`}
                    >
                      {/* Thumbnail · mismo tamaño que Disponibilidad
                          (w-[80px] h-[54px]). */}
                      <span className="w-[80px] h-[54px] rounded-md bg-muted/30 overflow-hidden shrink-0 grid place-items-center">
                        {promo.image ? (
                          <img src={promo.image} alt="" className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <Building2 className="h-4 w-4 text-muted-foreground/60" strokeWidth={1.5} />
                        )}
                      </span>
                      <span className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground leading-none">
                          Promoción referenciada
                        </p>
                        <p className="text-[13px] font-semibold text-foreground truncate max-w-[260px] leading-tight mt-0.5">
                          {promo.name}
                        </p>
                      </span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground/60 shrink-0" strokeWidth={1.75} />
                    </Link>
                  )}
                </div>
              </div>

              {/* CTAs */}
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <CTAPill icon={Phone} label="Llamar"
                  onClick={() => toast.success(`Llamando a ${lead.phone}`)}
                />
                <CTAPill icon={Mail} label="Email"
                  onClick={() => toast.success(`Email a ${lead.email}`)}
                />
                <CTAPill icon={MessageCircle} label="WhatsApp"
                  onClick={() => toast.success(`WhatsApp a ${lead.phone}`)}
                />
                <CTAPill
                  icon={XCircle} label="Descartar" danger
                  disabled={lead.status === "perdida" || lead.status === "duplicate"}
                  onClick={() => toast.success("Lead descartado")}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Contenido ─── */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* ─── Columna izquierda · 2/3 ─── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Interés */}
            <Section title="Interés declarado">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <InfoCell icon={Home} label="Promoción" value={lead.interest.promotionName}
                  link={lead.interest.promotionId ? `/promociones/${lead.interest.promotionId}` : undefined} />
                <InfoCell icon={Home} label="Tipología" value={lead.interest.tipologia} />
                <InfoCell icon={Bed} label="Dormitorios" value={lead.interest.dormitorios} />
                <InfoCell icon={Euro} label="Presupuesto" value={formatPrice(lead.interest.presupuestoMax)} />
              </div>
              {lead.interest.zona && (
                <div className="mt-4 pt-4 border-t border-border/60">
                  <InfoCell icon={MapPin} label="Zona preferida" value={lead.interest.zona} inline />
                </div>
              )}
            </Section>

            {/* Mensaje */}
            {lead.message && (
              <Section title="Mensaje del lead">
                <blockquote className="text-sm text-foreground leading-relaxed italic border-l-2 border-primary/40 pl-4 py-1">
                  {lead.message}
                </blockquote>
              </Section>
            )}

            {/* Match de duplicados */}
            {isDup && (
              <section className="rounded-2xl border border-destructive/25 bg-destructive/5 p-5 shadow-soft">
                <header className="flex items-start gap-3 mb-4">
                  <div className="h-9 w-9 rounded-xl bg-destructive/15 text-destructive flex items-center justify-center shrink-0">
                    <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-destructive">
                      IA de duplicados
                    </p>
                    <h2 className="text-sm font-semibold text-foreground mt-0.5">
                      Posible duplicado · {lead.duplicateScore ?? 92}% match
                    </h2>
                    <p className="text-[11.5px] text-muted-foreground mt-1 leading-relaxed">
                      Este lead coincide con un contacto existente en tu red. Revisa la ficha
                      para decidir si fusionar, crear nuevo registro o descartar.
                    </p>
                  </div>
                </header>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11.5px]">
                  <DupMatchCell label="Email"    match="exact"   detail={lead.email} />
                  <DupMatchCell label="Teléfono" match="partial" detail={`${lead.phone.slice(0, 6)}… (últimos 4)`} />
                  <DupMatchCell label="Nombre"   match="fuzzy"   detail="90% similar" />
                </div>

                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={() => toast.success("Abriendo contacto existente")}
                    className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-foreground text-background text-[11.5px] font-semibold hover:bg-foreground/90 shadow-soft transition-colors"
                  >
                    Ver contacto existente
                    <ExternalLink className="h-3 w-3" strokeWidth={2} />
                  </button>
                  <button
                    onClick={() => toast.success("Marcado como no duplicado")}
                    className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full border border-border bg-card text-[11.5px] font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    No es duplicado
                  </button>
                </div>
              </section>
            )}

            {/* Timeline */}
            <Section title="Actividad">
              <Timeline lead={lead} />
            </Section>
          </div>

          {/* ─── Columna derecha · 1/3 ─── */}
          <aside className="space-y-4">

            <Section title="Identidad" dense>
              <dl className="space-y-2.5 text-[12.5px]">
                <DtDd label="Email">
                  <a href={`mailto:${lead.email}`} className="text-foreground hover:text-primary transition-colors truncate">{lead.email}</a>
                </DtDd>
                <DtDd label="Teléfono">
                  <a href={`tel:${lead.phone}`} className="text-foreground hover:text-primary transition-colors tabular-nums">{lead.phone}</a>
                </DtDd>
                {lead.nationality && (
                  <DtDd label="Nacionalidad">
                    <span className="inline-flex items-center gap-1 text-foreground">
                      {flagOf(lead.nationality)} {lead.nationality}
                    </span>
                  </DtDd>
                )}
                {lead.idioma && (
                  <DtDd label="Idioma">
                    <span className="text-foreground">{flagOf(lead.idioma)} {lead.idioma}</span>
                  </DtDd>
                )}
              </dl>
            </Section>

            <Section title="Asignación" dense>
              {lead.assignedTo ? (
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-bold shrink-0">
                    {lead.assignedTo.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{lead.assignedTo.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{lead.assignedTo.email}</p>
                  </div>
                  <button
                    onClick={() => toast.info("Reasignar · próximamente")}
                    className="text-[11px] font-medium text-primary hover:text-primary/80"
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => toast.info("Asignar · próximamente")}
                  className="w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-xl border border-dashed border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                >
                  <UserPlus className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Asignar a un comercial
                </button>
              )}
            </Section>

            <Section title="Origen" dense>
              <dl className="space-y-2.5 text-[12.5px]">
                <DtDd label="Canal"><span className="text-foreground">{leadSourceLabel[lead.source]}</span></DtDd>
                <DtDd label="Recibido"><span className="text-foreground tabular-nums">{formatDateTime(lead.createdAt)}</span></DtDd>
                {lead.firstResponseAt && (
                  <DtDd label="1ª respuesta"><span className="text-foreground tabular-nums">{formatDateTime(lead.firstResponseAt)}</span></DtDd>
                )}
              </dl>
            </Section>

            {(lead.tags?.length ?? 0) > 0 && (
              <Section title="Etiquetas" dense>
                <div className="flex flex-wrap gap-1.5">
                  {lead.tags!.map((t) => (
                    <span key={t} className="inline-flex items-center gap-1 text-[10.5px] font-medium bg-muted text-foreground rounded-full px-2 py-0.5">
                      <Tag className="h-2.5 w-2.5" strokeWidth={2} />
                      {t}
                    </span>
                  ))}
                </div>
              </Section>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SUBCOMPONENTES
   ═══════════════════════════════════════════════════════════════════ */

function CTAPill({
  icon: Icon, label, onClick, primary, danger, disabled,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
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
  title, children, dense,
}: { title: string; children: React.ReactNode; dense?: boolean }) {
  return (
    <section className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
      <header className={cn("border-b border-border px-4 sm:px-5", dense ? "py-2.5" : "py-3")}>
        <h2 className={cn("font-semibold text-foreground", dense ? "text-[12.5px]" : "text-sm")}>{title}</h2>
      </header>
      <div className={cn(dense ? "p-4" : "p-4 sm:p-5")}>{children}</div>
    </section>
  );
}

function InfoCell({
  icon: Icon, label, value, link, inline,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value?: string;
  link?: string;
  inline?: boolean;
}) {
  const content = link && value ? (
    <Link to={link} className="text-foreground hover:text-primary transition-colors inline-flex items-center gap-1">
      {value}
      <ExternalLink className="h-3 w-3 text-muted-foreground" strokeWidth={1.75} />
    </Link>
  ) : (
    <span className="text-foreground">{value ?? "—"}</span>
  );

  if (inline) {
    return (
      <div className="flex items-center gap-2 text-[12.5px]">
        <Icon className="h-3.5 w-3.5 text-muted-foreground/60" strokeWidth={1.75} />
        <span className="text-muted-foreground">{label}:</span>
        {content}
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3 w-3 text-muted-foreground/60" strokeWidth={1.75} />
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-sm font-medium leading-snug truncate">{content}</p>
    </div>
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

function DupMatchCell({
  label, match, detail,
}: {
  label: string;
  match: "exact" | "partial" | "fuzzy";
  detail: string;
}) {
  const tone = match === "exact" ? "destructive" : match === "partial" ? "amber" : "muted";
  const cls = tone === "destructive"
    ? "bg-destructive/10 text-destructive border-destructive/25"
    : tone === "amber"
      ? "bg-warning/10 text-warning border-warning/25"
      : "bg-muted text-muted-foreground border-border";
  const matchLabel = match === "exact" ? "Coincide" : match === "partial" ? "Parcial" : "Similar";
  return (
    <div className={cn("rounded-xl border p-2.5", cls)}>
      <p className="text-[9.5px] font-bold uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-[11px] font-medium mt-0.5">{matchLabel}</p>
      <p className="text-[10px] opacity-70 mt-0.5 truncate">{detail}</p>
    </div>
  );
}

function Timeline({ lead }: { lead: Lead }) {
  /* Eventos derivados del estado del lead. En producción vendrán del
   *  endpoint GET /api/leads/:id/events con un array de eventos reales. */
  const events: { iso: string; icon: typeof Inbox; title: string; body?: string; tone: "primary" | "neutral" | "emerald" | "destructive" | "amber" }[] = [];

  events.push({
    iso: lead.createdAt,
    icon: Inbox,
    title: "Lead recibido",
    body: `Entró por ${leadSourceLabel[lead.source]}${lead.interest.promotionName ? ` interesado en ${lead.interest.promotionName}` : ""}.`,
    tone: "primary",
  });

  if ((lead.duplicateScore ?? 0) >= 70) {
    events.push({
      iso: lead.createdAt,
      icon: Sparkles,
      title: `IA de duplicados · ${lead.duplicateScore}% match`,
      body: "Posible duplicado detectado automáticamente.",
      tone: "destructive",
    });
  }

  if (lead.assignedTo) {
    events.push({
      iso: lead.createdAt,
      icon: UserPlus,
      title: `Asignado a ${lead.assignedTo.name}`,
      tone: "neutral",
    });
  }

  if (lead.firstResponseAt) {
    events.push({
      iso: lead.firstResponseAt,
      icon: MessageCircle,
      title: "1ª respuesta del equipo",
      body: `${Math.round((new Date(lead.firstResponseAt).getTime() - new Date(lead.createdAt).getTime()) / 3600000 * 10) / 10}h desde la entrada.`,
      tone: "emerald",
    });
  }

  if (lead.status === "ganada") {
    events.push({
      iso: lead.firstResponseAt ?? lead.createdAt,
      icon: CheckCircle2,
      title: "Oportunidad ganada",
      body: "El lead se cerró con éxito · reserva/escritura firmada.",
      tone: "emerald",
    });
  }

  if (lead.status === "perdida") {
    events.push({
      iso: lead.createdAt,
      icon: XCircle,
      title: "Lead perdido",
      body: "Oportunidad marcada como perdida.",
      tone: "destructive",
    });
  }

  events.sort((a, b) => a.iso.localeCompare(b.iso));

  return (
    <ol className="space-y-4">
      {events.map((e, i) => {
        const toneBg = e.tone === "primary" ? "bg-primary/10 text-primary"
          : e.tone === "emerald" ? "bg-success/10 text-success"
          : e.tone === "destructive" ? "bg-destructive/10 text-destructive"
          : e.tone === "amber" ? "bg-warning/10 text-warning"
          : "bg-muted text-foreground";
        const Icon = e.icon;
        return (
          <li key={i} className="flex items-start gap-3">
            <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center shrink-0", toneBg)}>
              <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-foreground leading-tight">{e.title}</p>
              {e.body && <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">{e.body}</p>}
              <p className="text-[10.5px] text-muted-foreground/70 mt-0.5 tabular-nums">{formatDateTime(e.iso)} · {relativeTime(e.iso)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
