/**
 * AgenciasPendientesDialog · dialog unificado para gestionar
 * pendientes en una promoción. Dos variantes controladas por prop
 * `mode`:
 *
 *   - `"solicitudes"`   · agencias que han pedido colaborar.
 *     Acción por fila: Rechazar / Aprobar.
 *   - `"invitaciones"`  · invitaciones enviadas sin aceptar.
 *     Acción por fila: Reenviar / Cancelar.
 *
 * Se abre desde los tiles de acción rápida al principio del tab
 * Agencias. Se mantiene confidencial al promotor (la ruta ya está
 * dentro de PromotorOnly).
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  MailPlus, Clock, RotateCw, X, Check, Inbox, ArrowUpRight,
  History, Mail, AtSign, Edit3,
} from "lucide-react";
import type { Invitacion, InvitacionEvent } from "@/lib/invitaciones";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/currentUser";
import { useInvitaciones } from "@/lib/invitaciones";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { agencies } from "@/data/agencies";
import {
  recordInvitationCancelled, recordCompanyAny,
  recordRequestApproved, recordRequestRejected,
} from "@/lib/companyEvents";

/* ─────────────── Helpers ─────────────── */

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

function findMatchingAgency(email: string) {
  const e = email.toLowerCase();
  return agencies.find((a) => a.contactoPrincipal?.email?.toLowerCase() === e);
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

/* ─────────────── Componente ─────────────── */

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "solicitudes" | "invitaciones";
  promotionId: string;
  promotionName: string;
}

export function AgenciasPendientesDialog({ open, onOpenChange, mode, promotionId, promotionName }: Props) {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const actor = { name: user.name, email: user.email };
  const confirm = useConfirm();
  const { pendientes, reenviar, eliminar } = useInvitaciones();

  /** Abrir ficha de agencia desde una fila del dialog. Cerramos el
   *  dialog antes de navegar para que el back del navegador devuelva
   *  al promotor a la tab Agencias, no al dialog flotante. */
  const openAgencyDetail = (agencyId: string) => {
    onOpenChange(false);
    navigate(`/colaboradores/${agencyId}`);
  };

  /** Invitación cuyo historial está expandido (acordeón en la lista). */
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null);
  /** Invitación en proceso de reenvío · al abrir se muestra un dialog
   *  anidado con el email editable antes de confirmar. */
  const [resendTarget, setResendTarget] = useState<Invitacion | null>(null);

  /* Solo las solicitudes dirigidas a ESTA promoción (ver
   * `requestedPromotionIds` en `src/data/agencies.ts`). Las solicitudes
   * globales viven en `/colaboradores`. */
  const solicitudes = useMemo(
    () => agencies.filter(
      (a) => (a.solicitudPendiente || a.isNewRequest)
        && a.requestedPromotionIds?.includes(promotionId),
    ),
    [promotionId],
  );

  const invitaciones = useMemo(
    () => pendientes.filter((i) => i.promocionId === promotionId),
    [pendientes, promotionId],
  );

  /* ═════ Handlers · solicitudes ═════ */
  const handleAprobar = (agencyId: string, agencyName: string) => {
    recordRequestApproved(agencyId, actor);
    toast.success("Solicitud aprobada", { description: `${agencyName} ya puede colaborar.` });
  };
  const handleRechazar = async (agencyId: string, agencyName: string) => {
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
  /** Confirmación final de reenvío · llamada desde el dialog anidado
   *  tras revisar/editar el email. Si `newEmail` difiere del anterior,
   *  se actualiza la invitación y se registra en su historial. */
  const confirmReenviar = (inv: Invitacion, newEmail: string) => {
    const emailChanged = newEmail.trim() !== inv.emailAgencia;
    reenviar(inv.id, { newEmail: newEmail.trim(), actor });
    recordCompanyAny(inv.id, "invitation_sent",
      emailChanged ? "Invitación reenviada (email corregido)" : "Invitación reenviada",
      emailChanged
        ? `Email actualizado: ${inv.emailAgencia} → ${newEmail.trim()}. Nueva validez: 30 días.`
        : `Link reenviado a ${newEmail.trim()}. Nueva validez: 30 días.`,
      actor);
    toast.success(emailChanged ? "Email corregido y invitación reenviada" : "Invitación reenviada");
    setResendTarget(null);
  };
  const handleCancelar = async (id: string, email: string) => {
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

  const isSolicitudes = mode === "solicitudes";
  const title = isSolicitudes ? "Solicitudes recibidas" : "Invitaciones enviadas";
  const description = isSolicitudes
    ? <>Agencias que han pedido colaborar en <span className="font-medium text-foreground">{promotionName}</span>.</>
    : <>Invitaciones que enviaste para <span className="font-medium text-foreground">{promotionName}</span> · pendientes de aceptar.</>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {isSolicitudes ? (
          solicitudes.length === 0 ? (
            <EmptyDialog icon={Inbox} label="Sin solicitudes pendientes" hint="Las solicitudes entrantes desde el marketplace aparecerán aquí." />
          ) : (
            <ul className="divide-y divide-border/60">
              {solicitudes.map((a) => (
                <li key={a.id} className="py-3">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => openAgencyDetail(a.id)}
                      className="shrink-0"
                      title="Ver ficha de la agencia"
                    >
                      <Mark name={a.name} logo={a.logo} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => openAgencyDetail(a.id)}
                        className="text-sm font-semibold text-foreground truncate hover:underline text-left"
                      >
                        {a.name}
                      </button>
                      <p className="text-[11.5px] text-muted-foreground truncate">
                        {a.location}{typeof a.teamSize === "number" && a.teamSize > 0 ? ` · ${a.teamSize} agentes` : ""}
                      </p>
                      {a.mensajeSolicitud && (
                        <p className="text-[11.5px] text-foreground/70 mt-1 line-clamp-3 italic">
                          "{a.mensajeSolicitud}"
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Acciones · fila propia para que quepan 3 botones
                      sin apretarse y mantener la jerarquía visual. */}
                  <div className="flex items-center justify-end gap-1 mt-2">
                    <button
                      onClick={() => openAgencyDetail(a.id)}
                      className="h-8 px-3 inline-flex items-center gap-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Ver ficha
                    </button>
                    <span className="w-px h-4 bg-border mx-1" aria-hidden />
                    <button
                      onClick={() => handleRechazar(a.id, a.name)}
                      className="h-8 px-3 inline-flex items-center rounded-full text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                    >
                      Rechazar
                    </button>
                    <button
                      onClick={() => handleAprobar(a.id, a.name)}
                      className="h-8 px-3.5 inline-flex items-center gap-1.5 rounded-full bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors"
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={2} />
                      Aprobar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : (
          invitaciones.length === 0 ? (
            <EmptyDialog icon={MailPlus} label="Sin invitaciones pendientes" hint="Invita agencias desde el botón Invitar agencia." />
          ) : (
            <ul className="divide-y divide-border/60">
              {invitaciones.map((inv) => {
                const matched = findMatchingAgency(inv.emailAgencia);
                const displayName = matched?.name
                  ?? (inv.nombreAgencia?.trim() ? inv.nombreAgencia : null)
                  ?? "Pendiente de registro";
                const placeholder = !matched && !inv.nombreAgencia?.trim();
                const dias = daysUntil(inv.expiraEn);
                const pocosDias = dias <= 5;

                const historyOpen = historyOpenId === inv.id;
                const eventsCount = inv.events?.length ?? 0;
                return (
                  <li key={inv.id} className="py-3">
                    <div className="flex items-start gap-3">
                      <Mark name={matched?.name ?? displayName} logo={matched?.logo} />
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm truncate",
                          placeholder ? "text-muted-foreground italic" : "font-semibold text-foreground",
                        )}>
                          {displayName}
                        </p>
                        <p className="text-[11.5px] text-muted-foreground truncate" title={inv.emailAgencia}>
                          {inv.emailAgencia}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[10.5px] text-muted-foreground flex-wrap">
                          <Clock className="h-2.5 w-2.5" strokeWidth={1.75} />
                          <span>enviada {formatRelative(inv.createdAt)}</span>
                          <span className="text-border">·</span>
                          <span className={pocosDias ? "text-warning font-medium" : ""}>
                            {dias === 0 ? "caduca hoy" : dias === 1 ? "caduca mañana" : `caduca en ${dias} días`}
                          </span>
                          {inv.createdBy?.name && (
                            <>
                              <span className="text-border">·</span>
                              <span>por {inv.createdBy.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
                        <button
                          onClick={() => setHistoryOpenId(historyOpen ? null : inv.id)}
                          aria-expanded={historyOpen}
                          title={historyOpen ? "Ocultar historial" : "Ver historial"}
                          className={cn(
                            "h-8 w-8 inline-flex items-center justify-center rounded-full transition-colors",
                            historyOpen
                              ? "bg-muted text-foreground"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted",
                          )}
                        >
                          <History className="h-3.5 w-3.5" strokeWidth={1.75} />
                        </button>
                        <button
                          onClick={() => setResendTarget(inv)}
                          className="h-8 px-3 inline-flex items-center gap-1.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          <RotateCw className="h-3.5 w-3.5" strokeWidth={1.75} />
                          Reenviar
                        </button>
                        <button
                          onClick={() => handleCancelar(inv.id, inv.emailAgencia)}
                          className="h-8 w-8 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                          title="Cancelar invitación"
                        >
                          <X className="h-3.5 w-3.5" strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                    {/* Historial expandido · timeline simple bajo la fila */}
                    {historyOpen && (
                      <div className="mt-3 ml-13 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                          Historial · {eventsCount} {eventsCount === 1 ? "evento" : "eventos"}
                        </p>
                        {eventsCount === 0 ? (
                          <p className="text-[11.5px] text-muted-foreground italic">
                            Sin eventos registrados.
                          </p>
                        ) : (
                          <ol className="space-y-1.5">
                            {[...(inv.events ?? [])]
                              .sort((a, b) => b.at - a.at)
                              .map((ev) => <InvitationEventRow key={ev.id} event={ev} />)}
                          </ol>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )
        )}
      </DialogContent>

      {/* Dialog anidado · confirmar reenvío con email editable */}
      <ResendInvitationDialog
        invitation={resendTarget}
        onCancel={() => setResendTarget(null)}
        onConfirm={confirmReenviar}
      />
    </Dialog>
  );
}

/** Contadores para los tiles · filtrados a esta promoción. */
export function usePromotionPendientes(promotionId: string) {
  const { pendientes } = useInvitaciones();
  const invitacionesCount = pendientes.filter((i) => i.promocionId === promotionId).length;
  const solicitudesCount = agencies.filter(
    (a) => (a.solicitudPendiente || a.isNewRequest)
      && a.requestedPromotionIds?.includes(promotionId),
  ).length;
  return { invitacionesCount, solicitudesCount };
}

/* ─── Sub-componentes ─── */

function Mark({ name, logo }: { name: string; logo?: string }) {
  return (
    <div className="shrink-0 h-10 w-10 rounded-md border border-border/60 bg-muted/40 overflow-hidden grid place-items-center font-semibold text-muted-foreground text-[11px] tracking-wider">
      {logo ? <img src={logo} alt={name} className="h-full w-full object-cover" /> : <span>{initials(name) || "—"}</span>}
    </div>
  );
}

/* ══════ Timeline item de evento de invitación ══════ */
const EVENT_LABEL: Record<InvitacionEvent["type"], { label: string; icon: typeof Mail }> = {
  created:       { label: "Invitación enviada",          icon: MailPlus },
  resent:        { label: "Invitación reenviada",        icon: RotateCw },
  email_changed: { label: "Email corregido",             icon: Edit3 },
  cancelled:     { label: "Invitación cancelada",        icon: X },
};

function InvitationEventRow({ event: e }: { event: InvitacionEvent }) {
  const meta = EVENT_LABEL[e.type] ?? EVENT_LABEL.created;
  const Icon = meta.icon;
  return (
    <li className="flex items-start gap-2 text-[11.5px]">
      <span className="h-4 w-4 rounded-full bg-background border border-border grid place-items-center shrink-0 mt-0.5">
        <Icon className="h-2.5 w-2.5 text-muted-foreground" strokeWidth={1.75} />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-foreground font-medium leading-tight">
          {meta.label}
          {e.type === "email_changed" && e.previousEmail && e.newEmail && (
            <span className="text-muted-foreground font-normal">
              {" · "}
              <span className="line-through">{e.previousEmail}</span>
              {" → "}
              <span className="text-foreground">{e.newEmail}</span>
            </span>
          )}
        </p>
        <p className="text-[10.5px] text-muted-foreground mt-0.5">
          {e.by?.name ? `Por ${e.by.name} · ` : ""}
          {new Intl.DateTimeFormat("es-ES", {
            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
          }).format(new Date(e.at))}
        </p>
      </div>
    </li>
  );
}

/* ══════ Dialog anidado · reenviar con email editable ══════
 * Se abre al pulsar "Reenviar" en una invitación. Muestra el email
 * pre-cargado para revisar/corregir antes de confirmar. Si el email
 * cambió, se registra como evento `email_changed` en el historial. */
function ResendInvitationDialog({
  invitation, onCancel, onConfirm,
}: {
  invitation: Invitacion | null;
  onCancel: () => void;
  onConfirm: (inv: Invitacion, newEmail: string) => void;
}) {
  const [email, setEmail] = useState("");
  useEffect(() => {
    if (invitation) setEmail(invitation.emailAgencia);
  }, [invitation?.id, invitation?.emailAgencia]);

  const trimmed = email.trim();
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  const hasChanged = invitation ? trimmed !== invitation.emailAgencia : false;

  return (
    <Dialog open={!!invitation} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reenviar invitación</DialogTitle>
          <DialogDescription>
            Revisa el email antes de enviarlo de nuevo. Puedes corregirlo
            aquí mismo si era erróneo · se actualizará en la invitación y
            quedará registrado en el historial.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Email de la agencia
            </label>
            <div className="relative mt-1.5">
              <AtSign className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={1.75} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                className="w-full h-10 pl-8 pr-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-foreground/30"
              />
            </div>
            {!isValid && trimmed.length > 0 && (
              <p className="text-[11px] text-destructive mt-1">Formato de email no válido.</p>
            )}
            {hasChanged && isValid && invitation && (
              <p className="text-[11px] text-warning mt-1.5 flex items-start gap-1">
                <Edit3 className="h-3 w-3 shrink-0 mt-0.5" strokeWidth={2} />
                El email cambia de <span className="font-medium">{invitation.emailAgencia}</span> a{" "}
                <span className="font-medium">{trimmed}</span>.
              </p>
            )}
          </div>

          {invitation?.promocionNombre && (
            <div className="rounded-xl bg-muted/40 px-3 py-2 text-[11.5px] text-muted-foreground">
              Sobre la promoción{" "}
              <span className="text-foreground font-medium">{invitation.promocionNombre}</span>
              {" · "}
              comisión{" "}
              <span className="text-foreground font-medium">{invitation.comisionOfrecida}%</span>.
              Nueva validez del link: 30 días.
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onCancel} className="rounded-full">
            Cancelar
          </Button>
          <Button
            onClick={() => invitation && isValid && onConfirm(invitation, trimmed)}
            disabled={!invitation || !isValid}
            className="rounded-full"
          >
            <RotateCw className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.75} />
            {hasChanged ? "Corregir y reenviar" : "Reenviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmptyDialog({ icon: Icon, label, hint }: { icon: typeof Inbox; label: string; hint: string }) {
  return (
    <div className="py-8 text-center">
      <Icon className="h-7 w-7 text-muted-foreground/40 mx-auto mb-2" strokeWidth={1.5} />
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground mt-1">{hint}</p>
    </div>
  );
}
