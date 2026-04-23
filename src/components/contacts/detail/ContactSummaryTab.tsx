/**
 * Tab "Resumen" de la ficha de contacto.
 *
 * Layout 2 columnas en desktop:
 *  - Izquierda (más ancha): info personal + datos de contacto +
 *    idiomas + origen + tags.
 *  - Derecha (300px): asignados, contactos relacionados, próxima
 *    acción, operación en curso.
 *
 * En mobile colapsa a una columna, sidebar al final.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Mail, Phone, MapPin, Calendar as CalendarIcon,
  Globe, IdCard, Building2, Star, UserPlus, Users, Hash, Plus, X,
  AlertCircle, TrendingUp, Shield, ArrowRight, ChevronDown, Sparkles, Search,
  ClipboardCheck,
} from "lucide-react";
import { EvaluateVisitDialog } from "./EvaluateVisitDialog";
import { AssignMembersDialog } from "./AssignMembersDialog";
import { LinkContactDialog } from "./LinkContactDialog";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import type { ContactDetail, ContactVisitEntry, ContactTag, TagScope } from "@/components/contacts/types";
import {
  loadOrgTags, loadPersonalTags, savePersonalTags,
  TAG_COLOR_PALETTE, nextTagId,
} from "@/components/contacts/tagsStorage";
import { loadContactTags, saveContactTags } from "@/components/contacts/contactTagsStorage";
import { getRelationLabel } from "@/components/contacts/relationTypesStorage";
import { useCurrentUser } from "@/lib/currentUser";

type Props = {
  detail: ContactDetail;
  /** Callback que el padre pasa para refrescar el detalle tras editar
   *  asignados, relacionados, o cualquier otro override que persista
   *  en localStorage. */
  onRefresh?: () => void;
  /** WhatsApp ya no es un tab — pedimos al padre que abra el modal. */
  onOpenWhatsApp?: () => void;
};

function formatDate(iso?: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("es-ES", {
      day: "numeric", month: "long", year: "numeric",
    });
  } catch { return iso; }
}

export function ContactSummaryTab({ detail, onRefresh, onOpenWhatsApp }: Props) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  /* Próxima visita y operación en curso, candidatos para el banner
   * unificado "Estado actual". */
  const nextVisit: ContactVisitEntry | undefined = detail.visits
    .filter((v) => v.status === "scheduled")
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];
  /* "Operación en curso" = lead aprobado o ya convertido + unidad concreta. */
  const activeDeal = detail.records.find(
    (r) => (r.status === "approved" || r.status === "converted") && r.unit,
  );

  /* Visitas done sin evaluation = tareas pendientes del agente. La más
   * reciente se muestra en el banner del Resumen con CTA para evaluar
   * sin tener que ir al tab Visitas. */
  const pendingEvalVisits = useMemo(
    () => detail.visits
      .filter((v) => v.status === "done" && !v.evaluation)
      .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt)),
    [detail.visits],
  );
  const pendingEvalCount = pendingEvalVisits.length;
  const firstPendingEval = pendingEvalVisits[0];

  const [evalOpen, setEvalOpen] = useState(false);
  const [evalVersion, setEvalVersion] = useState(0); // refresca tras evaluar

  /** Toggle de campos vacíos en Información personal — escondidos
   *  por defecto para no llenar la card de "No registrado". */
  const [showEmptyFields, setShowEmptyFields] = useState(false);

  /** Definimos los campos en orden y los partimos en dos buckets:
   *  los que tienen valor y los que no. Solo mostramos los vacíos si
   *  el usuario abre el toggle. */
  const personalFields = [
    { icon: Hash,         label: "Referencia",         value: detail.reference, mono: true },
    { icon: IdCard,       label: "NIF / DNI",          value: detail.nif },
    { icon: CalendarIcon, label: "Fecha de nacimiento", value: detail.birthDate ? formatDate(detail.birthDate) : undefined },
    { icon: Globe,        label: "Nacionalidad",       value: detail.nationality ? `${detail.flag ?? ""} ${detail.nationality}`.trim() : undefined },
    { icon: Globe,        label: "Idiomas",            value: detail.languages?.join(" · ") },
    { icon: MapPin,       label: "Dirección",          value: detail.address },
    { icon: Building2,    label: "Ciudad",             value: [detail.city, detail.postalCode].filter(Boolean).join(" · ") || undefined },
  ];
  const filledFields = personalFields.filter((f) => f.value);
  const emptyFields = personalFields.filter((f) => !f.value);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
      {/* ══════ Columna izquierda ══════ */}
      <div className="space-y-5">

        {/* Banner unificado "Estado actual" — agrupa próxima visita + operación.
         *  Solo se renderiza si hay alguno; reduce el ruido de dos cards de
         *  color seguidas que competían con el header. */}
        {(nextVisit || activeDeal || pendingEvalCount > 0) && (
          <CurrentStatusCard
            nextVisit={nextVisit}
            activeDeal={activeDeal && {
              promotion: activeDeal.promotionName,
              unit: activeDeal.unit!,
              note: activeDeal.agentNote,
            }}
            pendingEval={firstPendingEval && {
              count: pendingEvalCount,
              promotion: firstPendingEval.promotionName,
              unit: firstPendingEval.unit,
              scheduledAt: firstPendingEval.scheduledAt,
              onEvaluate: () => setEvalOpen(true),
            }}
          />
        )}

        {/* Información personal · campos vacíos colapsados por defecto */}
        <Card title="Información personal">
          {filledFields.length === 0 ? (
            <Empty text="Sin datos personales registrados todavía." />
          ) : (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              {filledFields.map((f) => (
                <Field key={f.label} icon={f.icon} label={f.label} value={f.value} mono={f.mono} />
              ))}
              {showEmptyFields && emptyFields.map((f) => (
                <Field key={f.label} icon={f.icon} label={f.label} value={undefined} />
              ))}
            </dl>
          )}
          {emptyFields.length > 0 && (
            <button
              onClick={() => setShowEmptyFields((s) => !s)}
              className="mt-4 text-[11.5px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
            >
              <ChevronDown className={cn("h-3 w-3 transition-transform", showEmptyFields && "rotate-180")} />
              {showEmptyFields ? "Ocultar campos vacíos" : `Mostrar ${emptyFields.length} ${emptyFields.length === 1 ? "campo vacío" : "campos vacíos"}`}
            </button>
          )}
        </Card>

        {/* Teléfonos */}
        <Card title="Teléfonos">
          {detail.phones.length === 0 ? (
            <Empty text="Sin teléfonos registrados." />
          ) : (
            <ul className="space-y-2">
              {detail.phones.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-3 py-2 rounded-xl border border-border/40 bg-muted/30">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground tnum">{p.number}</p>
                    <p className="text-[11px] text-muted-foreground">{p.label}</p>
                  </div>
                  {p.primary && (
                    <span className="text-[10px] uppercase tracking-wider font-semibold bg-foreground text-background rounded-full px-2 py-0.5">
                      Principal
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenWhatsApp?.()}
                    className="h-8 w-8 rounded-full grid place-items-center text-success hover:bg-success/10 transition-colors"
                    title="Abrir conversación de WhatsApp"
                  >
                    <WhatsAppIcon className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Emails */}
        <Card title="Correos electrónicos">
          {detail.emailAddresses.length === 0 ? (
            <Empty text="Sin emails registrados." />
          ) : (
            <ul className="space-y-2">
              {detail.emailAddresses.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-3 py-2 rounded-xl border border-border/40 bg-muted/30">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/emails?compose=1&to=${encodeURIComponent(e.address)}`}
                      className="text-sm font-medium text-foreground truncate hover:underline"
                      title="Abrir cliente de email con este destinatario"
                    >
                      {e.address}
                    </Link>
                    <p className="text-[11px] text-muted-foreground">
                      {e.label ?? "Email"}
                      {e.verified && " · Verificado"}
                    </p>
                  </div>
                  {e.primary && (
                    <span className="text-[10px] uppercase tracking-wider font-semibold bg-foreground text-background rounded-full px-2 py-0.5">
                      Principal
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Tags + origen — ahora editable desde la propia ficha */}
        <Card title="Etiquetas y origen">
          <div className="space-y-4">
            <ContactTagsEditor contactId={detail.id} initialTags={detail.tags} />
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Origen:</span>
              <span className="text-foreground font-medium">{detail.source}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* ══════ Columna derecha (sidebar) ══════ */}
      <aside className="space-y-5">

        {/* Asignados */}
        <Card title="Asignados">
          {detail.assignedUsers.length === 0 ? (
            <Empty text="Sin usuarios asignados." />
          ) : (
            <ul className="space-y-2">
              {detail.assignedUsers.map((u) => (
                <li key={u.userId} className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-foreground/5 grid place-items-center text-foreground font-semibold text-xs shrink-0">
                    {u.userName.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{u.userName}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{u.role ?? "Miembro"}</p>
                  </div>
                  {u.permissions.canEdit && (
                    <span className="text-[10px] text-muted-foreground" title="Puede editar">
                      <Star className="h-3 w-3 fill-current" />
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={() => setAssignOpen(true)}
            className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1.5 py-2 border border-dashed border-border rounded-xl transition-colors"
          >
            <UserPlus className="h-3.5 w-3.5" /> Gestionar asignados
          </button>
        </Card>

        {/* Contactos relacionados */}
        <Card title="Contactos relacionados">
          {detail.relatedContacts.length === 0 ? (
            <Empty text="Sin contactos vinculados." />
          ) : (
            <ul className="space-y-2">
              {detail.relatedContacts.map((r) => (
                <li key={r.contactId}>
                  <Link to={`/contactos/${r.contactId}`}
                    className="flex items-center gap-3 px-2 py-1.5 -mx-2 rounded-xl hover:bg-muted/40 transition-colors">
                    <div className="h-8 w-8 rounded-full bg-foreground/5 grid place-items-center text-foreground font-semibold text-xs shrink-0">
                      {r.contactName.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{r.contactName}</p>
                      <p className="text-[11px] text-muted-foreground">{getRelationLabel(r.relationType)}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <button
            onClick={() => setLinkOpen(true)}
            className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1.5 py-2 border border-dashed border-border rounded-xl transition-colors"
          >
            <Users className="h-3.5 w-3.5" /> Vincular contacto
          </button>
        </Card>

        {/* Estado · fusiona métricas rápidas + consentimientos en una
         *  sola card. Las métricas son numéricas (lo importante) arriba;
         *  los consents son secundarios (footer sutil). */}
        <Card title="Estado">
          <dl className="space-y-2.5 text-sm">
            <div className="flex items-baseline justify-between">
              <dt className="text-muted-foreground text-xs">Oportunidades activas</dt>
              <dd className="font-bold text-foreground tnum">{detail.activeOpportunities}</dd>
            </div>
            <div className="flex items-baseline justify-between">
              <dt className="text-muted-foreground text-xs">Total registros</dt>
              <dd className="font-bold text-foreground tnum">{detail.totalRegistrations}</dd>
            </div>
            <div className="flex items-baseline justify-between">
              <dt className="text-muted-foreground text-xs">Visitas realizadas</dt>
              <dd className="font-bold text-foreground tnum">
                {detail.visits.filter((v) => v.status === "done").length}
              </dd>
            </div>
            <div className="flex items-baseline justify-between">
              <dt className="text-muted-foreground text-xs">Documentos</dt>
              <dd className="font-bold text-foreground tnum">{detail.documents.length}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-border/40 pt-2.5 mt-1">
              <dt className="text-muted-foreground text-xs">Primer contacto</dt>
              <dd className="text-xs text-foreground tnum">{detail.firstSeen}</dd>
            </div>
          </dl>

          {/* Consents discreto al pie */}
          <div className="mt-4 pt-4 border-t border-border/40 space-y-2">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70 inline-flex items-center gap-1">
              <Shield className="h-3 w-3" /> Consentimientos
            </p>
            <ConsentItem label="GDPR" granted={detail.consents.gdpr} signed={!!detail.consents.signedDocumentId} />
            <ConsentItem label="Newsletter" granted={detail.consents.newsletter} signed={!!detail.consents.signedDocumentId} />
            <ConsentItem label="Envíos comerciales" granted={detail.consents.commercialMailing} signed={!!detail.consents.signedDocumentId} />
          </div>
        </Card>
      </aside>

      {/* Dialog de evaluación — abre desde el banner de "visita por evaluar" */}
      <EvaluateVisitDialog
        open={evalOpen}
        onOpenChange={setEvalOpen}
        contactId={detail.id}
        visit={firstPendingEval ?? null}
        onSaved={() => { setEvalVersion((v) => v + 1); onRefresh?.(); }}
      />
      {/* Workaround para evitar warning de useMemo dep no usada */}
      <span className="hidden">{evalVersion}</span>

      <AssignMembersDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        contactId={detail.id}
        current={detail.assignedUsers}
        onSaved={() => onRefresh?.()}
      />

      <LinkContactDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        contactId={detail.id}
        current={detail.relatedContacts}
        onSaved={() => onRefresh?.()}
      />
    </div>
  );
}

/* ══════ Sub-componentes ══════ */

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card rounded-2xl border border-border/40 shadow-soft p-5">
      <h2 className="text-[11px] uppercase tracking-[0.16em] font-semibold text-muted-foreground/80 mb-4">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ icon: Icon, label, value, mono }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string;
  mono?: boolean;
}) {
  if (!value) {
    return (
      <div>
        <dt className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
          <Icon className="h-3 w-3" /> {label}
        </dt>
        <dd className="text-sm text-muted-foreground/50 italic mt-0.5">No registrado</dd>
      </div>
    );
  }
  return (
    <div>
      <dt className="text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
        <Icon className="h-3 w-3" /> {label}
      </dt>
      <dd className={cn("text-sm font-medium text-foreground mt-0.5", mono && "font-mono tnum text-[13px]")}>{value}</dd>
    </div>
  );
}

/** Card unificada "Estado actual" — agrupa la próxima visita y la
 *  operación activa en un único bloque sin colores agresivos, para que
 *  no compita con el header. Cada sub-bloque aparece solo si tiene
 *  contenido. */
function CurrentStatusCard({
  nextVisit, activeDeal, pendingEval,
}: {
  nextVisit?: ContactVisitEntry;
  activeDeal?: { promotion: string; unit: string; note?: string };
  pendingEval?: {
    count: number;
    promotion: string;
    unit?: string;
    /** ISO datetime de la visita ya realizada (para calcular días). */
    scheduledAt: string;
    onEvaluate: () => void;
  };
}) {
  /* Componer rows en orden de prioridad. Insertar separadores entre. */
  const rows: React.ReactNode[] = [];
  if (pendingEval) {
    const extra = pendingEval.count - 1;
    const baseTitle = `Evaluar visita · ${pendingEval.promotion}${pendingEval.unit ? ` · ${pendingEval.unit}` : ""}`;
    const title = extra > 0 ? `${baseTitle} + ${extra} más` : baseTitle;

    const visitDate = new Date(pendingEval.scheduledAt);
    const daysAgo = Math.max(0, Math.floor(
      (Date.now() - visitDate.getTime()) / 86400000,
    ));
    const dateLabel = visitDate.toLocaleDateString("es-ES", {
      weekday: "long", day: "numeric", month: "long",
    });
    const ago = daysAgo === 0 ? "hoy"
              : daysAgo === 1 ? "ayer"
              : `hace ${daysAgo} días`;
    /* Más rojizo cuanto más tiempo haya pasado. */
    const urgencyClass = daysAgo >= 7 ? "text-destructive font-semibold"
                        : daysAgo >= 3 ? "text-destructive"
                        : "text-warning dark:text-warning";

    rows.push(
      <StatusRow
        key="pending-eval"
        icon={<ClipboardCheck className="h-4 w-4" />}
        accent="amber"
        eyebrow="Tareas pendientes"
        title={title}
        subtitleNode={
          <span className={cn("inline-flex items-center gap-1", urgencyClass)}>
            <CalendarIcon className="h-3 w-3" />
            <span className="capitalize">{dateLabel}</span>
            <span aria-hidden>·</span>
            <span>{ago}</span>
          </span>
        }
        onClick={pendingEval.onEvaluate}
        ctaLabel="Evaluar"
      />,
    );
  }
  if (nextVisit) {
    rows.push(
      <StatusRow
        key="next-visit"
        icon={<AlertCircle className="h-4 w-4" />}
        accent="amber"
        eyebrow="Próxima visita"
        title={`${nextVisit.promotionName}${nextVisit.unit ? ` · ${nextVisit.unit}` : ""}`}
        subtitle={`${formatVisitDate(nextVisit.scheduledAt)} · ${nextVisit.agent}`}
        note={nextVisit.notes}
        to="?tab=visitas"
        ctaLabel="Ver"
      />,
    );
  }
  if (activeDeal) {
    rows.push(
      <StatusRow
        key="active-deal"
        icon={<TrendingUp className="h-4 w-4" />}
        accent="emerald"
        eyebrow="Operación en curso"
        title={`${activeDeal.promotion} · ${activeDeal.unit}`}
        subtitle={undefined}
        note={activeDeal.note}
        to="?tab=operaciones"
        ctaLabel="Detalle"
      />,
    );
  }

  return (
    <section className="bg-card rounded-2xl border border-border/40 shadow-soft overflow-hidden">
      {rows.map((row, i) => (
        <div key={i}>
          {row}
          {i < rows.length - 1 && <div className="h-px bg-border/40 mx-4" />}
        </div>
      ))}
    </section>
  );
}

function StatusRow({
  icon, accent, eyebrow, title, subtitle, subtitleNode, note, to, onClick, ctaLabel,
}: {
  icon: React.ReactNode;
  accent: "amber" | "emerald";
  eyebrow: string;
  title: string;
  subtitle?: string;
  /** Subtitle como nodo (ej. para colorear). Tiene precedencia sobre `subtitle`. */
  subtitleNode?: React.ReactNode;
  note?: string;
  /** Si se pasa `to`, el CTA es un Link. Si se pasa `onClick`, es un button. */
  to?: string;
  onClick?: () => void;
  ctaLabel: string;
}) {
  const cta = onClick ? (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs font-medium text-foreground hover:underline shrink-0"
    >
      {ctaLabel} <ArrowRight className="h-3 w-3" />
    </button>
  ) : to ? (
    <Link to={to} className="inline-flex items-center gap-1 text-xs font-medium text-foreground hover:underline shrink-0">
      {ctaLabel} <ArrowRight className="h-3 w-3" />
    </Link>
  ) : null;

  return (
    <div className="flex items-start gap-3 p-4">
      <div className={cn(
        "h-9 w-9 rounded-xl grid place-items-center shrink-0",
        accent === "amber"
          ? "bg-warning/15 text-warning dark:text-warning"
          : "bg-success/15 text-success dark:text-success",
      )}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
          {eyebrow}
        </p>
        <p className="text-sm font-semibold text-foreground mt-0.5">{title}</p>
        {subtitleNode ? (
          <div className="text-xs mt-0.5">{subtitleNode}</div>
        ) : subtitle ? (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        ) : null}
        {note && (
          <p className="text-[11.5px] text-muted-foreground mt-1 italic line-clamp-2">"{note}"</p>
        )}
      </div>
      {cta}
    </div>
  );
}

function formatVisitDate(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  const time = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}

/* ══════ Editor inline de etiquetas del contacto ══════
 *
 * Reúne tags de organización + tags personales del usuario actual.
 * Permite añadir / quitar tags, y crear nuevas tags personales sobre
 * la marcha. La selección se persiste en localStorage por contacto
 * (ver contactTagsStorage.ts) mientras no haya backend.
 */

function ContactTagsEditor({
  contactId, initialTags,
}: { contactId: string; initialTags: string[] }) {
  const user = useCurrentUser();

  /* Tags disponibles (org + personales del usuario) y selección actual.
   * La selección inicial respeta lo guardado localmente si existe. */
  const orgTags = useMemo(() => loadOrgTags(), []);
  const [personalTags, setPersonalTagsState] = useState<ContactTag[]>(
    () => loadPersonalTags(user.id),
  );
  const allTags = useMemo(() => [...orgTags, ...personalTags], [orgTags, personalTags]);
  const tagById = (id: string) => allTags.find((t) => t.id === id);

  const [selected, setSelected] = useState<string[]>(
    () => loadContactTags(contactId) ?? initialTags,
  );

  /* Persistencia automática al cambiar la selección. */
  useEffect(() => { saveContactTags(contactId, selected); }, [contactId, selected]);

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allTags;
    return allTags.filter((t) => t.label.toLowerCase().includes(q));
  }, [allTags, query]);

  const toggleTag = (id: string) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);
  };

  const removeTag = (id: string) => {
    setSelected((prev) => prev.filter((t) => t !== id));
  };

  const createPersonalTag = () => {
    const clean = newName.trim();
    if (!clean) return;
    if (personalTags.some((t) => t.label.toLowerCase() === clean.toLowerCase())) {
      toast.error("Ya tienes una etiqueta personal con ese nombre");
      return;
    }
    const id = nextTagId(allTags);
    const color = TAG_COLOR_PALETTE[allTags.length % TAG_COLOR_PALETTE.length];
    const tag: ContactTag = {
      id, label: clean, color, scope: "personal", createdBy: user.id,
    };
    const next = [...personalTags, tag];
    setPersonalTagsState(next);
    savePersonalTags(user.id, next);
    setSelected((prev) => [...prev, id]);
    setNewName("");
    setCreating(false);
    setQuery("");
    toast.success(`Etiqueta personal "${clean}" creada y asignada`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
          Etiquetas
        </p>
        <Popover open={popoverOpen} onOpenChange={(o) => { setPopoverOpen(o); if (!o) { setCreating(false); setNewName(""); setQuery(""); } }}>
          <PopoverTrigger asChild>
            <button className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">
              <Plus className="h-3 w-3" /> Añadir
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-[280px] p-0 rounded-2xl border-border shadow-soft-lg overflow-hidden"
          >
            {/* Buscador */}
            <div className="border-b border-border/60 px-3 py-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/60" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar o crear etiqueta…"
                  className="w-full h-8 pl-7 pr-2 text-xs bg-muted/40 border border-transparent rounded-full focus:bg-background focus:border-border outline-none transition-colors"
                />
              </div>
            </div>

            {/* Lista */}
            <div className="max-h-[260px] overflow-y-auto py-1.5">
              {filtered.length === 0 && !creating && (
                <div className="px-3 py-3 text-center">
                  <p className="text-[11px] text-muted-foreground italic">
                    {query.trim() ? `Sin coincidencias para "${query}"` : "Sin etiquetas todavía"}
                  </p>
                  {query.trim() && (
                    <button
                      onClick={() => { setNewName(query); setCreating(true); }}
                      className="inline-flex items-center gap-1 mt-2 text-[11px] font-medium text-foreground hover:underline"
                    >
                      <Plus className="h-3 w-3" /> Crear "{query}"
                    </button>
                  )}
                </div>
              )}
              {filtered.map((t) => {
                const isSelected = selected.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleTag(t.id)}
                    className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left hover:bg-muted/40 transition-colors"
                  >
                    <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", t.color)} />
                    <span className="flex-1 text-xs text-foreground truncate">{t.label}</span>
                    {t.scope === "personal" && (
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 shrink-0">
                        personal
                      </span>
                    )}
                    {isSelected && <span className="text-[10px] text-success shrink-0">✓</span>}
                  </button>
                );
              })}
            </div>

            {/* Crear nueva personal al pie */}
            <div className="border-t border-border/60 px-2 py-1.5 bg-muted/30">
              {!creating ? (
                <button
                  onClick={() => { setCreating(true); setNewName(query); }}
                  className="w-full inline-flex items-center justify-center gap-1.5 h-7 rounded-full text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="h-3 w-3" /> Crear etiqueta personal
                </button>
              ) : (
                <div className="flex items-center gap-1.5 px-1">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") createPersonalTag();
                      if (e.key === "Escape") { setCreating(false); setNewName(""); }
                    }}
                    placeholder="Nombre de la etiqueta…"
                    className="flex-1 h-7 px-2 text-xs bg-background border border-border rounded-full outline-none focus:border-primary"
                  />
                  <button
                    onClick={createPersonalTag}
                    disabled={!newName.trim()}
                    className="h-7 px-2 rounded-full bg-foreground text-background text-[11px] font-medium hover:bg-foreground/90 transition-colors disabled:opacity-40"
                  >
                    Crear
                  </button>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Chips actuales con × para quitar */}
      {selected.length === 0 ? (
        <p className="text-[11.5px] text-muted-foreground italic">
          Sin etiquetas asignadas. Pulsa "Añadir" para empezar.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((id) => {
            const tag = tagById(id);
            const label = tag?.label ?? id;
            const color = tag?.color ?? "bg-muted-foreground/30";
            return (
              <span
                key={id}
                className="group inline-flex items-center gap-1.5 text-xs bg-card border border-border/60 rounded-full pl-2 pr-1 py-1 hover:border-foreground/30 transition-colors"
              >
                <span className={cn("h-2 w-2 rounded-full", color)} />
                <span className="text-foreground">{label}</span>
                <button
                  onClick={() => removeTag(id)}
                  className="h-4 w-4 rounded-full grid place-items-center text-muted-foreground hover:bg-muted hover:text-destructive transition-colors"
                  aria-label="Quitar etiqueta"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ConsentItem({ label, granted, signed }: { label: string; granted: boolean; signed?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={cn("text-xs", signed ? "text-foreground" : "text-muted-foreground")}>{label}</span>
      <span className={cn(
        "inline-flex h-4 w-7 rounded-full transition-colors items-center px-0.5 shrink-0",
        granted ? "bg-success" : "bg-muted-foreground/30",
        !signed && "opacity-50",
      )}>
        <span className={cn(
          "h-3 w-3 rounded-full bg-white shadow transition-transform",
          granted ? "translate-x-3" : "translate-x-0",
        )} />
      </span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground italic text-center py-3">{text}</p>;
}
