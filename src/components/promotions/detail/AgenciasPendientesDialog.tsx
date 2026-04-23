/**
 * AgenciasPendientesDialog · todas las agencias que aún no
 * colaboran pero están en juego. Dos secciones en el mismo modal:
 *
 *   1. Solicitudes entrantes · agencias del marketplace que han
 *      pedido colaborar con el promotor. Acción: Aprobar / Rechazar.
 *
 *   2. Invitaciones enviadas · invitaciones que el promotor mandó
 *      por email y aún no han sido aceptadas. Acción: Reenviar /
 *      Cancelar. Inicialmente sin logo ni nombre; cuando la
 *      agencia se registra con ese email se rellena automáticamente.
 *
 * Se abre desde un botón pequeño en la tab Agencias de la ficha de
 * promoción. Si no hay nada pendiente, el botón ni aparece.
 *
 * Solo lo ve el promotor (la ruta ya está dentro de PromotorOnly y
 * la tab Agencies no existe para agencia).
 */

import { useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  MailPlus, Clock, RotateCw, X, Check, Building2, Inbox,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/currentUser";
import { useInvitaciones } from "@/lib/invitaciones";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { agencies } from "@/data/agencies";
import {
  recordInvitationCancelled, recordCompanyAny, recordRequestApproved,
  recordRequestRejected,
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

/* ─────────────── Componente ─────────────── */

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promotionId: string;
  promotionName: string;
}

export function AgenciasPendientesDialog({ open, onOpenChange, promotionId, promotionName }: Props) {
  const user = useCurrentUser();
  const actor = { name: user.name, email: user.email };
  const confirm = useConfirm();
  const { pendientes, reenviar, eliminar } = useInvitaciones();

  /* Solicitudes entrantes · agencias con solicitudPendiente=true que
   * no colaboran aún. Por ahora son globales (no por promoción); en
   * backend cada solicitud traerá un `requestedPromotionId`. */
  const solicitudesEntrantes = useMemo(
    () => agencies.filter((a) => a.solicitudPendiente || a.isNewRequest),
    [],
  );

  /* Invitaciones pendientes enviadas para ESTA promoción. */
  const invitaciones = useMemo(
    () => pendientes.filter((i) => i.promocionId === promotionId),
    [pendientes, promotionId],
  );

  const total = solicitudesEntrantes.length + invitaciones.length;

  const handleAprobarSolicitud = (agencyId: string, agencyName: string) => {
    recordRequestApproved(agencyId, actor);
    toast.success("Solicitud aprobada", { description: `${agencyName} ya puede colaborar.` });
    // TODO(backend): PATCH /api/agencies/:id/request { approved: true }
  };

  const handleRechazarSolicitud = async (agencyId: string, agencyName: string) => {
    const ok = await confirm({
      title: "¿Descartar solicitud?",
      description: `${agencyName} no podrá colaborar contigo hasta volver a solicitarlo.`,
      confirmLabel: "Descartar",
      destructive: true,
    });
    if (!ok) return;
    recordRequestRejected(agencyId, actor);
    toast.success("Solicitud descartada");
  };

  const handleReenviar = (id: string, email: string) => {
    reenviar(id);
    recordCompanyAny(id, "invitation_sent", "Invitación reenviada",
      `Link de invitación reenviado a ${email}. Nueva validez: 30 días.`, actor);
    toast.success("Invitación reenviada");
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agencias pendientes</DialogTitle>
          <DialogDescription>
            Solicitudes entrantes e invitaciones enviadas que están a la espera de respuesta
            en <span className="font-medium text-foreground">{promotionName}</span>.
          </DialogDescription>
        </DialogHeader>

        {total === 0 ? (
          <div className="py-8 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" strokeWidth={1.5} />
            <p className="text-sm font-medium text-foreground">Sin pendientes</p>
            <p className="text-xs text-muted-foreground mt-1">
              Todo limpio. Invita agencias desde el botón "Invitar agencia".
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Sección 1 · Solicitudes entrantes */}
            {solicitudesEntrantes.length > 0 && (
              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 inline-flex items-center gap-1.5">
                  <Inbox className="h-3 w-3" strokeWidth={1.75} />
                  Solicitudes entrantes · {solicitudesEntrantes.length}
                </h3>
                <ul className="space-y-2">
                  {solicitudesEntrantes.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-start gap-3 rounded-xl border border-border bg-card p-3"
                    >
                      <div className="h-9 w-9 rounded-lg bg-muted overflow-hidden shrink-0 grid place-items-center">
                        {a.logo ? (
                          <img src={a.logo} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Building2 className="h-4 w-4 text-muted-foreground/60" strokeWidth={1.5} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{a.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {a.location} · {a.teamSize ?? 0} agentes
                        </p>
                        {a.mensajeSolicitud && (
                          <p className="text-[11.5px] text-foreground/70 mt-1.5 line-clamp-2 italic">
                            "{a.mensajeSolicitud}"
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleRechazarSolicitud(a.id, a.name)}
                          className="h-7 w-7 inline-flex items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/5 transition-colors"
                          title="Rechazar"
                        >
                          <X className="h-3 w-3" strokeWidth={2} />
                        </button>
                        <button
                          onClick={() => handleAprobarSolicitud(a.id, a.name)}
                          className="h-7 px-3 inline-flex items-center gap-1 rounded-full bg-foreground text-background text-[11px] font-semibold hover:bg-foreground/90 transition-colors"
                          title="Aprobar"
                        >
                          <Check className="h-3 w-3" strokeWidth={2.5} />
                          Aprobar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Sección 2 · Invitaciones enviadas */}
            {invitaciones.length > 0 && (
              <section>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 inline-flex items-center gap-1.5">
                  <MailPlus className="h-3 w-3" strokeWidth={1.75} />
                  Invitaciones enviadas · {invitaciones.length}
                </h3>
                <ul className="space-y-2">
                  {invitaciones.map((inv) => {
                    const matched = findMatchingAgency(inv.emailAgencia);
                    const displayName = matched?.name
                      ?? (inv.nombreAgencia?.trim() ? inv.nombreAgencia : null)
                      ?? "(aún sin registrarse)";
                    const logo = matched?.logo;
                    const dias = daysUntil(inv.expiraEn);
                    const pocosDias = dias <= 5;
                    const placeholder = !matched && !inv.nombreAgencia?.trim();

                    return (
                      <li
                        key={inv.id}
                        className="flex items-start gap-3 rounded-xl border border-dashed border-border bg-card p-3"
                      >
                        <div className="h-9 w-9 rounded-lg bg-muted overflow-hidden shrink-0 grid place-items-center">
                          {logo ? (
                            <img src={logo} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <Building2 className="h-4 w-4 text-muted-foreground/40" strokeWidth={1.5} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm font-semibold truncate",
                            placeholder ? "text-muted-foreground italic font-normal" : "text-foreground",
                          )}>
                            {displayName}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate" title={inv.emailAgencia}>
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
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => handleReenviar(inv.id, inv.emailAgencia)}
                            className="h-7 w-7 inline-flex items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="Reenviar"
                          >
                            <RotateCw className="h-3 w-3" strokeWidth={2} />
                          </button>
                          <button
                            onClick={() => handleCancelar(inv.id, inv.emailAgencia)}
                            className="h-7 w-7 inline-flex items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/5 transition-colors"
                            title="Cancelar"
                          >
                            <X className="h-3 w-3" strokeWidth={2} />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Helper expuesto para contar pendientes desde fuera del dialog
 *  (ej. para badgear el botón). */
export function useTotalAgenciasPendientes(promotionId: string) {
  const { pendientes } = useInvitaciones();
  const invitacionesCount = pendientes.filter((i) => i.promocionId === promotionId).length;
  const solicitudesCount = agencies.filter((a) => a.solicitudPendiente || a.isNewRequest).length;
  return { invitacionesCount, solicitudesCount, total: invitacionesCount + solicitudesCount };
}
