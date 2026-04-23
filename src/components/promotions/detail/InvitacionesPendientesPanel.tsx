/**
 * InvitacionesPendientesPanel · listado de invitaciones pendientes
 * de respuesta para una promoción concreta.
 *
 * Aparece dentro de la tab Agencias del promotor. Una invitación es
 * pendiente cuando:
 *   - El promotor la envió (SharePromotionDialog).
 *   - La agencia destino aún no respondió (no aceptó ni rechazó).
 *   - No ha caducado (30 días).
 *
 * Estado inicial · al crear la invitación solo tenemos el email.
 * La agencia puede no estar registrada aún en Byvaro — no hay logo
 * ni nombre comercial. Cuando se registre con ese email el backend
 * rellenará los huecos y la tarjeta pasará automáticamente a
 * "agencia colaborando" en cuanto acepte.
 *
 * Solo visible para el promotor (la tab Agencies no existe en la
 * vista colaborador).
 */

import {
  Clock, MailPlus, RotateCw, X, Building2,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/lib/currentUser";
import { useInvitaciones } from "@/lib/invitaciones";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { recordInvitationCancelled, recordCompanyAny } from "@/lib/companyEvents";
import { agencies } from "@/data/agencies";

function formatRelative(ms: number) {
  const diff = Date.now() - ms;
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days <= 0) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return hours <= 0 ? "hace unos minutos" : `hace ${hours} h`;
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

/** Si el email coincide con una agencia ya registrada, devolvemos
 *  su logo / nombre · así la tarjeta se "rellena sola" cuando la
 *  agencia entra a Byvaro (aunque todavía no haya aceptado). */
function findMatchingAgency(email: string) {
  const emailLower = email.toLowerCase();
  return agencies.find(
    (a) => a.contactoPrincipal?.email?.toLowerCase() === emailLower,
  );
}

export function InvitacionesPendientesPanel({
  promotionId,
  promotionName,
}: {
  promotionId: string;
  promotionName: string;
}) {
  const { pendientes, reenviar, eliminar } = useInvitaciones();
  const confirm = useConfirm();
  const user = useCurrentUser();
  const actor = { name: user.name, email: user.email };

  const pendientesDeEstaPromo = pendientes.filter(
    (i) => i.promocionId === promotionId,
  );

  if (pendientesDeEstaPromo.length === 0) return null;

  const handleReenviar = (id: string, email: string) => {
    reenviar(id);
    recordCompanyAny(
      id,
      "invitation_sent",
      "Invitación reenviada",
      `Link de invitación reenviado a ${email}. Nueva validez: 30 días.`,
      actor,
    );
    toast.success("Invitación reenviada", {
      description: `${email} · nueva validez 30 días.`,
    });
  };

  const handleCancelar = async (id: string, email: string) => {
    const ok = await confirm({
      title: "¿Cancelar invitación?",
      description:
        `El link enviado a ${email} dejará de funcionar. ` +
        "Si la agencia intenta aceptarlo, verá un mensaje de que la invitación fue cancelada. " +
        "Podrás enviar una nueva cuando quieras.",
      confirmLabel: "Cancelar invitación",
      destructive: true,
    });
    if (!ok) return;
    /* Nota: el storage de invitaciones usa `inv.id` como key; como no
     * hay agencyId real, registramos el evento bajo el id de la
     * invitación para que la próxima vez que la agencia se registre,
     * el backend pueda rematchear en el historial. */
    recordInvitationCancelled(id, actor);
    eliminar(id);
    toast.success("Invitación cancelada");
  };

  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MailPlus className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          <h3 className="text-sm font-semibold text-foreground">
            Invitaciones pendientes
            <span className="ml-1.5 text-xs font-normal text-muted-foreground tabular-nums">
              · {pendientesDeEstaPromo.length}
            </span>
          </h3>
        </div>
        <p className="text-[11px] text-muted-foreground italic">
          Pasan a colaborando en cuanto la agencia acepta.
        </p>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {pendientesDeEstaPromo.map((inv) => {
          const matched = findMatchingAgency(inv.emailAgencia);
          const displayName =
            matched?.name ??
            (inv.nombreAgencia?.trim() ? inv.nombreAgencia : null) ??
            "(aún sin registrarse)";
          const logoUrl = matched?.logo;
          const diasRestantes = daysUntil(inv.expiraEn);
          const pocosDias = diasRestantes <= 5;

          return (
            <li
              key={inv.id}
              className="rounded-2xl border border-dashed border-border bg-card p-4 shadow-soft"
            >
              <div className="flex items-start gap-3">
                {/* Avatar · logo si la agencia se registró, placeholder si no */}
                <div className="h-10 w-10 rounded-xl bg-muted overflow-hidden shrink-0 grid place-items-center">
                  {logoUrl ? (
                    <img src={logoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Building2 className="h-5 w-5 text-muted-foreground/60" strokeWidth={1.5} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
                  <p className="text-xs text-muted-foreground truncate" title={inv.emailAgencia}>
                    {inv.emailAgencia}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" strokeWidth={1.5} />
                      enviada {formatRelative(inv.createdAt)}
                    </span>
                    <span className="text-border">·</span>
                    <span className={pocosDias ? "text-warning font-medium" : ""}>
                      {diasRestantes === 0
                        ? "caduca hoy"
                        : diasRestantes === 1
                        ? "caduca mañana"
                        : `caduca en ${diasRestantes} días`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-end gap-1.5">
                <button
                  onClick={() => handleReenviar(inv.id, inv.emailAgencia)}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-border bg-background text-[11.5px] font-medium text-foreground hover:bg-muted/50 transition-colors"
                  title="Envía otra vez el link con nueva validez"
                >
                  <RotateCw className="h-3 w-3" strokeWidth={1.75} />
                  Reenviar
                </button>
                <button
                  onClick={() => handleCancelar(inv.id, inv.emailAgencia)}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-border bg-background text-[11.5px] font-medium text-muted-foreground hover:text-destructive hover:border-destructive/30 hover:bg-destructive/5 transition-colors"
                  title="Anular el link enviado"
                >
                  <X className="h-3 w-3" strokeWidth={1.75} />
                  Cancelar
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
