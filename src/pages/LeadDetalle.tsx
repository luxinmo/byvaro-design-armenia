/**
 * Ficha completa de una oportunidad (`/oportunidades/:id`).
 *
 * Estructura:
 *   - Header sticky: back + identidad + etapa + CTAs principales.
 *   - Grid 2-col desktop:
 *       Izq  (2/3): Interés · Mensaje del cliente · Timeline · Match de
 *                   duplicados (si aplica).
 *       Der  (1/3): Identidad · Asignación · Origen · Etiquetas.
 *
 * Nota: el archivo se llama LeadDetalle.tsx por historia del repo, pero
 * el concepto que maneja es "Oportunidad" (pipeline unificado · ADR-053).
 *
 * TODO(backend): endpoints en `docs/backend-integration.md §7.1`
 *   - `GET /api/opportunities/:id` → Oportunidad completa
 *   - `PATCH /api/opportunities/:id { status }` → avanzar/retroceder etapa
 *   - `PATCH /api/opportunities/:id/assignee { userId }` → reasignar
 */

import { useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useTabParam } from "@/lib/useTabParam";
import { PublicRefBadge } from "@/components/ui/PublicRefBadge";
import {
  ArrowLeft, Phone, Mail, MessageCircle, CheckCircle2, XCircle,
  Clock, User, UserPlus, Tag, Copy, AlertTriangle, Home, MapPin,
  Euro, Bed, Inbox, ExternalLink, Sparkles, History as HistoryIcon,
  FileText, Receipt, ThumbsDown, ThumbsUp, Flame,
  Calendar as CalendarIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  leads, leadStatusConfig, leadSourceLabel,
  type Lead, type LeadStatus,
} from "@/data/leads";
import { developerOnlyPromotions } from "@/data/developerPromotions";
import { Building2 } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { ContactWhatsAppDialog } from "@/components/contacts/detail/ContactWhatsAppDialog";
import { CreateCalendarEventDialog } from "@/components/calendar/CreateCalendarEventDialog";
import type { ContactDetail } from "@/components/contacts/types";
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

  /* Tabs del cuerpo · deep-linkables vía ?tab= (ver `useTabParam`).
     'actividad' es el default — concentra el evento de entrada +
     timeline y es donde vive el trabajo diario del comercial. */
  const tabs = [
    { id: "actividad",  label: "Actividad",  icon: HistoryIcon },
    { id: "emails",     label: "Emails",     icon: Mail },
    { id: "documentos", label: "Documentos", icon: FileText },
    { id: "registros",  label: "Registros",  icon: Receipt },
  ] as const;
  type TabId = typeof tabs[number]["id"];
  const TAB_IDS = tabs.map((t) => t.id) as readonly TabId[];
  const [activeTab, setTab] = useTabParam<TabId>(TAB_IDS, "actividad");

  /* WhatsApp · mismo modal lateral que la ficha de contacto
     (ContactWhatsAppDialog). Reutilizamos el componente con un shim
     del Lead como ContactDetail — sólo se consultan `id`, `name`,
     `flag`, `phones[].number` / `phones[].hasWhatsapp`. */
  const [whatsappOpen, setWhatsappOpen] = useState(false);

  /* "Programar visita" · abre CreateCalendarEventDialog con lead +
     promoción prefilleados. Al confirmar en el dialog se crea una
     Visit y el status de la oportunidad debería pasar a "visita" (TODO
     backend · de momento el dialog solo crea el evento).
     Si la visita viene de un registro, el dialog recibe
     status="pending-confirmation" y se pinta atenuada en el calendario. */
  const [scheduleVisitOpen, setScheduleVisitOpen] = useState(false);

  /* Cualificación rápida (mock) · "No es lead" / "Es lead" / "Tiene interés". */
  const [qualif, setQualif] = useState<"no" | "yes" | "interest" | null>(null);
  const onQualif = (v: "no" | "yes" | "interest") => {
    setQualif(v);
    const msg = {
      no: "Marcado como no-lead",
      yes: "Confirmado como lead",
      interest: "Marcado con interés · oportunidad viva",
    }[v];
    toast.success(msg);
  };

  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <Inbox className="h-10 w-10 text-muted-foreground/40 mb-3" strokeWidth={1.5} />
        <h1 className="text-base font-semibold text-foreground mb-1">Oportunidad no encontrada</h1>
        <p className="text-xs text-muted-foreground mb-5">La oportunidad con id <code className="bg-muted px-1.5 rounded">{id}</code> no existe o ya fue eliminada.</p>
        <button
          onClick={() => navigate("/oportunidades")}
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 shadow-soft transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
          Volver a oportunidades
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
              onClick={() => navigate("/oportunidades")}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
              Oportunidades
            </button>

            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
              <div className="flex items-start gap-4 min-w-0">
                <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center shrink-0 text-base font-bold text-foreground">
                  {lead.fullName.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {lead.nationality && <span className="text-xl leading-none">{flagOf(lead.nationality)}</span>}
                    <h1 className="text-[19px] sm:text-[22px] font-bold tracking-tight text-foreground leading-tight">
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
                    <PublicRefBadge value={lead.publicRef} size="sm" />
                    <span className="text-muted-foreground/60">·</span>
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

                  {/* Accesos rápidos · mismo patrón que ContactSummaryTab:
                     - Email → Link a `/emails?compose=1&to=...` (cliente
                       de email interno, igual que contact).
                     - Teléfono → `<a href={tel:}>`.
                     - WhatsApp → abre ContactWhatsAppDialog (modal lateral). */}
                  <div className="mt-2 inline-flex items-center gap-1.5">
                    <Link
                      to={`/emails?compose=1&to=${encodeURIComponent(lead.email)}`}
                      title={`Abrir cliente de email con destinatario ${lead.email}`}
                      className="inline-flex items-center gap-1.5 h-8 pl-2.5 pr-3 rounded-full border border-border bg-card text-[11.5px] font-medium text-foreground hover:bg-muted transition-colors"
                    >
                      <Mail className="h-3 w-3 text-muted-foreground" strokeWidth={1.75} />
                      <span className="truncate max-w-[220px]">{lead.email}</span>
                    </Link>
                    <a
                      href={`tel:${lead.phone.replace(/\s/g, "")}`}
                      title={`Llamar a ${lead.phone}`}
                      className="inline-flex items-center gap-1.5 h-8 pl-2.5 pr-3 rounded-full border border-border bg-card text-[11.5px] font-medium text-foreground hover:bg-muted transition-colors tabular-nums"
                    >
                      <Phone className="h-3 w-3 text-muted-foreground" strokeWidth={1.75} />
                      {lead.phone}
                    </a>
                    <button
                      onClick={() => setWhatsappOpen(true)}
                      title={`Abrir conversación de WhatsApp con ${lead.fullName}`}
                      className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full border border-border bg-card text-[11.5px] font-medium text-foreground hover:bg-muted transition-colors"
                    >
                      <WhatsAppIcon className="h-3.5 w-3.5 text-[#25D366]" />
                      WhatsApp
                    </button>
                  </div>
                </div>
              </div>

              {/* CTAs · Llamar/Email/WhatsApp viven abajo del nombre
                 como pills clicables (mismo patrón que el contacto).
                 Aquí "Programar visita" abre el dialog del calendario
                 con lead/promoción prefilleados · y el destructivo. */}
              <div className="flex items-center gap-2 flex-wrap shrink-0">
                <CTAPill
                  icon={CalendarIcon} label="Programar visita" primary
                  disabled={lead.status === "perdida" || lead.status === "duplicate" || lead.status === "ganada"}
                  onClick={() => setScheduleVisitOpen(true)}
                />
                <CTAPill
                  icon={XCircle} label="Descartar" danger
                  disabled={lead.status === "perdida" || lead.status === "duplicate"}
                  onClick={() => toast.success("Oportunidad descartada")}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ─── Tabs del cuerpo (no afectan la sidebar derecha) ─── */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <div className="border-b border-border/60">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                {tabs.map((t) => {
                  const Icon = t.icon;
                  const active = activeTab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTab(t.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-2.5 -mb-px border-b-2 text-sm font-medium whitespace-nowrap transition-colors",
                        active
                          ? "border-foreground text-foreground"
                          : "border-transparent text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="hidden lg:block" />
        </div>
      </div>

      {/* ─── Contenido ─── */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-5 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* ─── Columna izquierda · 2/3 ─── */}
          <div className="lg:col-span-2 space-y-4">

            {activeTab === "actividad" && (
              <>
                {/* Match de duplicados · alerta de la IA que se muestra
                   arriba del todo cuando aplica. Antes vivía en el tab
                   Resumen · Resumen se ha eliminado. */}
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

                <Section title="Actividad">
                  {/* Primer evento · entrada del lead. Si aún no se ha
                     cualificado, se muestra expandido con foto 125px,
                     mensaje y 3 botones del sistema. Al responder se
                     colapsa: queda línea pequeña "usuario consideró que
                     es lead" y el mensaje sigue visible. */}
                  <LeadEntryEvent
                    lead={lead}
                    promo={promo}
                    qualif={qualif}
                    onQualif={onQualif}
                  />

                  <hr className="my-4 border-border/50" />

                  {/* Timeline normal debajo */}
                  <Timeline lead={lead} />
                </Section>
              </>
            )}

            {activeTab === "emails" && (
              <Section title="Emails">
                <p className="text-[12px] text-muted-foreground italic text-center py-8">
                  Conversación de email · disponible al conectar el buzón del workspace
                  (<code className="text-[10px] not-italic">TODO(backend)</code>).
                </p>
              </Section>
            )}

            {activeTab === "documentos" && (
              <Section title="Documentos">
                <p className="text-[12px] text-muted-foreground italic text-center py-8">
                  Sin documentos adjuntos. El cliente podrá aportar DNI / preaprobación bancaria
                  cuando se programe la visita.
                </p>
              </Section>
            )}

            {activeTab === "registros" && (
              <Section title="Registros en promociones">
                <p className="text-[12px] text-muted-foreground italic text-center py-8">
                  Si una agencia registra a este cliente en una promoción, aparecerá aquí.
                </p>
              </Section>
            )}
          </div>

          {/* ─── Columna derecha · 1/3 ─── */}
          <aside className="space-y-4">

            {/* Interés declarado · movido a la sidebar (petición usuario) */}
            <Section title="Interés declarado" dense>
              <dl className="space-y-2.5 text-[12.5px]">
                {lead.interest.promotionName && (
                  <DtDd label="Promoción">
                    {lead.interest.promotionId ? (
                      <Link to={`/promociones/${lead.interest.promotionId}`} className="text-foreground hover:text-primary truncate inline-flex items-center gap-1">
                        {lead.interest.promotionName}
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </Link>
                    ) : (
                      <span className="text-foreground truncate">{lead.interest.promotionName}</span>
                    )}
                  </DtDd>
                )}
                <DtDd label="Tipología">{lead.interest.tipologia ?? "—"}</DtDd>
                <DtDd label="Dormitorios">{lead.interest.dormitorios ?? "—"}</DtDd>
                <DtDd label="Presupuesto">
                  <span className="tabular-nums">{formatPrice(lead.interest.presupuestoMax)}</span>
                </DtDd>
                {lead.interest.zona && <DtDd label="Zona">{lead.interest.zona}</DtDd>}
              </dl>
            </Section>

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

      {/* Modal de WhatsApp · reutiliza el mismo Dialog que la ficha
         de contacto. Shim: construimos un objeto con los campos que
         ContactWhatsAppTab consulta (id, name, flag, phones[]). */}
      <ContactWhatsAppDialog
        open={whatsappOpen}
        onOpenChange={setWhatsappOpen}
        detail={{
          id: lead.id,
          name: lead.fullName,
          flag: lead.nationality ? flagOf(lead.nationality) : undefined,
          phone: lead.phone,
          phones: [{ number: lead.phone, hasWhatsapp: true, isPrimary: true }],
        } as unknown as ContactDetail}
      />

      {/* Dialog · Programar visita · preset con lead + promoción. */}
      <CreateCalendarEventDialog
        open={scheduleVisitOpen}
        onOpenChange={setScheduleVisitOpen}
        preset={{
          type: "visit",
          title: promo ? `Visita · ${promo.name}` : `Visita · ${lead.fullName}`,
          date: new Date(),
          hour: 10,
          contactId: lead.id,
          contactName: lead.fullName,
          leadId: lead.id,
          promotionId: promo?.id,
          promotionName: promo?.name,
          status: "confirmed",
        }}
        onSaved={() => toast.success("Visita programada · marca la oportunidad como 'En visita' cuando se confirme")}
      />
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
    title: "Oportunidad recibida",
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
      title: "Oportunidad perdida",
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

/* ═══════════════════════════════════════════════════════════════════
   BOTÓN DE CUALIFICACIÓN · No es lead / Es lead / Tiene interés
   ═══════════════════════════════════════════════════════════════════ */

function QualifyButton({
  icon: Icon, label, hint, tone, active, onClick,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  hint: string;
  tone: "danger" | "neutral" | "primary";
  active: boolean;
  onClick: () => void;
}) {
  const toneClass = {
    danger:  active
      ? "bg-destructive/10 border-destructive/40 text-destructive"
      : "bg-card border-border text-foreground hover:border-destructive/30 hover:bg-destructive/5",
    neutral: active
      ? "bg-foreground text-background border-foreground"
      : "bg-card border-border text-foreground hover:bg-muted",
    primary: active
      ? "bg-primary/10 border-primary/40 text-primary"
      : "bg-card border-border text-foreground hover:border-primary/30 hover:bg-primary/5",
  }[tone];

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition-all",
        toneClass,
        active && "ring-2 ring-offset-1 ring-offset-background",
        active && tone === "danger"  && "ring-destructive",
        active && tone === "neutral" && "ring-foreground",
        active && tone === "primary" && "ring-primary",
      )}
      type="button"
    >
      <div className="inline-flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        <span className="text-[12.5px] font-semibold">{label}</span>
      </div>
      <span className="text-[10.5px] opacity-70 leading-tight">{hint}</span>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MINI-FACT · celda compacta label + valor
   ═══════════════════════════════════════════════════════════════════ */

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-[13px] font-medium text-foreground mt-1 truncate">{value}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   LEAD ENTRY EVENT · primera tarjeta del timeline
   ───────────────────────────────────────────────────────────────────
   Dos estados:
   - Sin responder (qualif === null): tarjeta "expandida"
       · Foto promoción 125×85px (a la izquierda)
       · Fuente · fecha · mensaje del cliente
       · 3 botones del sistema: "No es lead" / "Es lead" / "Tiene interés"
   - Respondida: tarjeta "colapsada"
       · Línea pequeña "Ha entrado un lead · [fuente]"
       · Nota "[Usuario] consideró que es [lead/interés/no-lead]"
       · El mensaje sigue visible debajo
   ═══════════════════════════════════════════════════════════════════ */

function LeadEntryEvent({
  lead, promo, qualif, onQualif,
}: {
  lead: Lead;
  promo: { id: string; name: string; image?: string } | undefined;
  qualif: "no" | "yes" | "interest" | null;
  onQualif: (v: "no" | "yes" | "interest") => void;
}) {
  const answered = qualif !== null;
  const qualifLabel = qualif === "no"       ? "No es lead"
                     : qualif === "yes"      ? "Es lead"
                     : qualif === "interest" ? "Tiene interés"
                     : "";

  /* Colapsado (respondido) — resumen pequeño con mensaje visible. */
  if (answered) {
    return (
      <div className="rounded-xl border border-border bg-muted/20 p-3 min-w-0">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="h-6 w-6 rounded-full bg-muted grid place-items-center shrink-0 text-muted-foreground">
            <Inbox className="h-3 w-3" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] text-foreground">
              <strong>Ha entrado un lead</strong>
              <span className="text-muted-foreground">
                {" "}· {leadSourceLabel[lead.source]} · {relativeTime(lead.createdAt)}
              </span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Tú consideraste que: <strong className="text-foreground">{qualifLabel}</strong>
            </p>
            {lead.message && (
              <blockquote className="mt-2 text-[12px] italic text-foreground/90 border-l-2 border-primary/40 pl-2.5 py-0.5">
                "{lead.message}"
              </blockquote>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* Expandido (sin responder) — foto 125px + mensaje + botones. */
  return (
    <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 shadow-soft">
      <div className="flex items-start gap-3 min-w-0">
        <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-foreground">
            Ha entrado un lead
          </p>
          <p className="text-[11px] text-muted-foreground">
            {leadSourceLabel[lead.source]} · {relativeTime(lead.createdAt)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-start gap-3">
        {/* Foto 125px */}
        {promo && (
          <Link
            to={`/promociones/${promo.id}`}
            className="w-[125px] h-[85px] rounded-lg overflow-hidden bg-muted grid place-items-center shrink-0 border border-border shadow-soft hover:shadow-soft-lg transition-shadow"
            title={`Ir a la promoción · ${promo.name}`}
          >
            {promo.image ? (
              <img src={promo.image} alt="" className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <Building2 className="h-5 w-5 text-muted-foreground/60" strokeWidth={1.5} />
            )}
          </Link>
        )}

        {/* Mensaje + preview promoción */}
        <div className="min-w-0 flex-1">
          {promo && (
            <p className="text-[11px] text-muted-foreground mb-1.5">
              Promoción: <Link to={`/promociones/${promo.id}`} className="text-foreground font-medium hover:text-primary">
                {promo.name}
              </Link>
            </p>
          )}
          {lead.message ? (
            <blockquote className="text-[12.5px] italic text-foreground leading-relaxed border-l-2 border-primary/40 pl-3 py-0.5">
              "{lead.message}"
            </blockquote>
          ) : (
            <p className="text-[12px] text-muted-foreground italic">
              El cliente no dejó mensaje.
            </p>
          )}
        </div>
      </div>

      {/* Botones del sistema */}
      <div className="mt-3.5 pt-3 border-t border-primary/20">
        <p className="text-[10.5px] uppercase tracking-wider text-muted-foreground mb-2">
          ¿Qué opinas de este lead?
        </p>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onQualif("no")}
            className="inline-flex items-center justify-center gap-1 h-8 px-2 rounded-full border border-border bg-card text-[11.5px] font-medium text-foreground hover:border-destructive/30 hover:bg-destructive/5 hover:text-destructive transition-colors"
          >
            <ThumbsDown className="h-3 w-3" strokeWidth={1.75} />
            No es lead
          </button>
          <button
            onClick={() => onQualif("yes")}
            className="inline-flex items-center justify-center gap-1 h-8 px-2 rounded-full border border-border bg-card text-[11.5px] font-medium text-foreground hover:bg-muted transition-colors"
          >
            <ThumbsUp className="h-3 w-3" strokeWidth={1.75} />
            Es lead
          </button>
          <button
            onClick={() => onQualif("interest")}
            className="inline-flex items-center justify-center gap-1 h-8 px-2 rounded-full bg-foreground text-background text-[11.5px] font-semibold hover:bg-foreground/90 transition-colors"
          >
            <Flame className="h-3 w-3" strokeWidth={2} />
            Tiene interés
          </button>
        </div>
      </div>
    </div>
  );
}
