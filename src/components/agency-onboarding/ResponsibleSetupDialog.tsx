/**
 * ResponsibleSetupDialog · primera entrada al workspace de agencia.
 *
 * Modal one-shot que aparece la primera vez que un usuario entra a un
 * workspace de agencia recién creado vía invitación (caso 1).
 * Pregunta UNA VEZ · ¿eres el Responsable o vas a invitar al
 * Responsable real (dueño/director)?
 *
 *   · "Soy el Responsable"   → el usuario actual queda como admin
 *     definitivo · cierre del modal · no vuelve a aparecer.
 *
 *   · "Añadir un Responsable" → form con email + nombre del
 *     Responsable real · al confirmar se guarda como pendiente,
 *     idealmente se le envía invitación. (Hoy mock · solo persiste
 *     la decisión.)
 *
 * Mounted desde `AppLayout` · el `<RequireAuth>` ya garantiza que el
 * usuario está logueado. Solo se renderiza cuando
 * `needsResponsibleSetup(agencyId)` devuelve true · si la cuenta es
 * promotor/comercializador, ni se monta.
 */

import { useEffect, useState, type FormEvent } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { ArrowRight, ArrowLeft, Crown, UserPlus, Mail, User as UserIcon, Check, Loader2, Phone, FileText, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  shouldAutoOpenResponsibleSetup, markResponsibleSetupComplete,
  deferResponsibleSetup, onAgencyOnboardingChanged,
} from "@/lib/agencyOnboarding";
import { useCurrentUser } from "@/lib/currentUser";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { recordSentEmail } from "@/lib/sentEmails";
import { getResponsibleInviteHtml } from "@/lib/responsibleInviteEmail";
import {
  createResponsibleInvitation, buildResponsibleInviteUrl,
} from "@/lib/responsibleInvitations";
import { loadCreatedUsers, saveCreatedUser } from "@/lib/createdAgencies";
import { loginAs } from "@/lib/accountType";
import { RESPONSIBLE_ACCEPTANCE_TERMS } from "@/lib/legalTerms";
import { useEmpresa } from "@/lib/empresa";

type Step = "choose" | "self-confirm" | "invite-form";
type Choice = "self" | "invite_other" | null;

interface Props {
  /** Si true · el dialog se abre forzado (independiente de
   *  `shouldAutoOpenResponsibleSetup`) · usado al disparar acciones
   *  críticas tras "Lo haré más tarde". */
  forceOpen?: boolean;
  /** Callback cuando el usuario completa o difiere · permite al caller
   *  decidir si continuar con la acción crítica que lo lanzó. */
  onClose?: () => void;
}

export function ResponsibleSetupDialog({ forceOpen, onClose }: Props = {}) {
  const user = useCurrentUser();
  const { empresa: agencyEmpresa } = useEmpresa();
  const isAgencyUser = user.accountType === "agency";
  const agencyId = isAgencyUser ? user.agencyId : undefined;

  /* Re-render reactivo cuando alguien marca el setup desde otro tab. */
  const [, tick] = useState(0);
  useEffect(() => onAgencyOnboardingChanged(() => tick((n) => n + 1)), []);

  const autoOpen = !!agencyId && shouldAutoOpenResponsibleSetup(agencyId);
  const open = autoOpen || (forceOpen ?? false);

  const [step, setStep] = useState<Step>("choose");
  const [choice, setChoice] = useState<Choice>(null);
  const [submitting, setSubmitting] = useState(false);

  /* Estado del form "invite-form". */
  const [responsibleName, setResponsibleName] = useState("");
  const [responsibleEmail, setResponsibleEmail] = useState("");
  const [responsibleTelefono, setResponsibleTelefono] = useState("");

  /* Estado de aceptación de T&C en "self-confirm" · obligatorio para
   * cerrar el setup como Responsable · paper trail legal. */
  const [tosAccepted, setTosAccepted] = useState(false);
  /* Scroll-to-bottom guard · el checkbox "He leído y acepto" solo se
   * habilita cuando el usuario ha llegado al final del texto legal.
   * Patrón obligatorio en T&C largos para asegurar lectura efectiva
   * (similar al `RegistrationTermsDialog` que usamos en aprobaciones
   * de registro). Una vez alcanzado el bottom, queda true y el resto
   * de scroll ya no afecta. */
  const [reachedBottom, setReachedBottom] = useState(false);
  const handleTermsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 24) {
      setReachedBottom(true);
    }
  };

  if (!open || !agencyId) return null;

  const handleNext = () => {
    if (choice === "self") {
      /* En lugar de cerrar el setup directamente, vamos al paso de
       * confirmación con T&C · al ser admin del workspace asume
       * obligaciones legales · necesitamos consentimiento explícito. */
      setStep("self-confirm");
      return;
    }
    if (choice === "invite_other") {
      setStep("invite-form");
    }
  };

  const handleSelfConfirm = () => {
    if (!tosAccepted) return;
    markResponsibleSetupComplete(agencyId, "self", {
      consent: {
        acceptedByName: user.name,
        acceptedByEmail: user.email,
      },
    });
    toast.success("Eres el Responsable de la agencia", {
      description: "Has aceptado los términos del Responsable.",
    });
    onClose?.();
  };

  const handleDefer = () => {
    deferResponsibleSetup(agencyId);
    toast("Lo recordaremos más tarde", {
      description: "Te volveremos a preguntar cuando hagas una acción importante.",
    });
    onClose?.();
  };

  const handleSubmitInvite = (e: FormEvent) => {
    e.preventDefault();
    if (!responsibleName.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(responsibleEmail)) return;
    setSubmitting(true);
    const agencyName = agencyEmpresa.nombreComercial || user.agencyName || "tu agencia";

    /* 1. Crear la responsible-invitation con token único · esto es lo
     *    que la landing `/responsible/:token` consume. */
    const respInv = createResponsibleInvitation({
      agencyId,
      agencyName,
      responsibleEmail: responsibleEmail.trim().toLowerCase(),
      responsibleName: responsibleName.trim(),
      responsibleTelefono: responsibleTelefono.trim() || undefined,
      inviterUserEmail: user.email,
      inviterUserName: user.name,
    });

    /* 2. Persistir la decisión de onboarding (con datos del responsable). */
    markResponsibleSetupComplete(agencyId, "invite_other", {
      email: respInv.responsibleEmail,
      name: respInv.responsibleName,
      telefono: respInv.responsibleTelefono,
    });

    /* 2.b · DOWNGRADE inmediato · el user actual declaró que NO es el
     * Responsable · queda como member desde ya. Si el Responsable real
     * nunca acepta, este user puede re-claimar admin desde el banner.
     * Solo afecta a usuarios creados via signup (caso 1) · seed users
     * no se mutan (no estarían en este flujo). */
    const me = loadCreatedUsers().find(
      (u) => u.email.toLowerCase() === user.email.toLowerCase()
        && u.agencyId === agencyId,
    );
    if (me) {
      saveCreatedUser({ ...me, role: "member" });
      /* Re-disparar `loginAs` para que `useCurrentUser` recoja el role
       * nuevo · sessionStorage no cambia, pero el evento fuerza
       * re-render con la nueva data del localStorage. */
      loginAs("agency", agencyId, user.email);
    }

    /* 3. Generar HTML del email + persistir en log + abrir preview. */
    const acceptUrl = buildResponsibleInviteUrl(respInv.token);
    const { asunto, html } = getResponsibleInviteHtml({
      responsibleName: respInv.responsibleName,
      responsibleEmail: respInv.responsibleEmail,
      agencyName,
      inviterName: user.name,
      inviterEmail: user.email,
      acceptUrl,
      expiraEnDias: 30,
    });
    recordSentEmail({
      to: respInv.responsibleEmail,
      subject: asunto,
      html,
      kind: "invitation",
      refId: respInv.id,
    });
    /* Preview visual · igual que en el flujo de invitación a agencia. */
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);

    toast.success("Invitación al Responsable enviada", {
      description: `${responsibleName} ha recibido el email · se abre en una pestaña nueva.`,
    });
    setSubmitting(false);
    onClose?.();
  };

  /* Cerrar el modal (X, click fuera, ESC) equivale a "Lo haré más
   * tarde" · NO confirma elección · solo aplaza · el banner persistente
   * y el guard de acciones críticas se hacen cargo del recordatorio. */
  const handleCloseAttempt = () => {
    deferResponsibleSetup(agencyId);
    onClose?.();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleCloseAttempt();
      }}
    >
      <DialogContent
        className="sm:max-w-[520px] p-0 gap-0 overflow-hidden"
      >
        {step === "choose" && (
          <>
            <DialogHeader className="px-6 pt-6 pb-4">
              <DialogTitle className="text-[19px] sm:text-[22px] font-bold tracking-tight leading-tight">
                Configura quién será el Responsable
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground leading-relaxed mt-2">
                El Responsable gestiona el perfil de la agencia, invita a otros usuarios y controla
                el acceso a la colaboración. Puedes ser tú o invitar al dueño / director real.
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 pb-3 flex flex-col gap-2.5">
              <ChoiceCard
                icon={Crown}
                title="Soy el Responsable"
                description="Sigo con esta cuenta como administrador principal del workspace."
                selected={choice === "self"}
                onClick={() => setChoice("self")}
              />
              <ChoiceCard
                icon={UserPlus}
                title="Quiero invitar al Responsable"
                description="Invita al dueño de la agencia o a otro autorizado · tú quedarás como miembro."
                selected={choice === "invite_other"}
                onClick={() => setChoice("invite_other")}
              />
            </div>

            <footer className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-between gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleDefer}
                title="Te lo recordaremos al hacer una acción importante"
                className="inline-flex items-center h-9 px-3 rounded-full text-[12.5px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                Lo haré más tarde
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={!choice}
                className={cn(
                  "inline-flex items-center gap-1.5 h-10 px-5 rounded-full bg-foreground text-background text-sm font-semibold transition-colors",
                  choice ? "hover:bg-foreground/90" : "opacity-40 cursor-not-allowed",
                )}
              >
                Continuar
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </footer>
          </>
        )}

        {step === "self-confirm" && (
          <>
            {/* Header fijo · título + versión + back. */}
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setStep("choose");
                  setTosAccepted(false);
                  setReachedBottom(false);
                }}
                className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground transition-colors mb-3"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Atrás
              </button>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="h-8 w-8 rounded-xl bg-foreground/5 flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-foreground/70" strokeWidth={1.5} />
                </div>
                <DialogTitle className="text-[17px] sm:text-[19px] font-bold tracking-tight leading-tight">
                  Términos del Responsable
                </DialogTitle>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Versión {RESPONSIBLE_ACCEPTANCE_TERMS.version} · Última actualización:{" "}
                {new Date(RESPONSIBLE_ACCEPTANCE_TERMS.updatedAt).toLocaleDateString("es-ES", {
                  day: "2-digit", month: "long", year: "numeric",
                })}
              </p>
            </DialogHeader>

            {/* Body scrollable · declaraciones + texto completo +
              hint de "lee hasta el final". El scroll-to-bottom
              habilita el checkbox del footer. */}
            <div
              onScroll={handleTermsScroll}
              className="flex-1 overflow-y-auto px-6 py-5 space-y-4 min-h-0"
              style={{ maxHeight: "55vh" }}
            >
              <DialogDescription className="text-[12.5px] text-muted-foreground leading-relaxed">
                Como Responsable de la agencia asumes obligaciones legales · gestión del
                workspace, datos de los miembros, contratos con promotores y pagos. Lee
                con atención los términos antes de aceptar.
              </DialogDescription>

              {/* Declaraciones · 4 bullets canónicos. */}
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                  Al activar tu rol declaras que:
                </p>
                <ul className="space-y-2">
                  {RESPONSIBLE_ACCEPTANCE_TERMS.declarations.map((d, i) => (
                    <BulletItem key={i}>{d}</BulletItem>
                  ))}
                </ul>
              </div>

              {/* Texto legal completo · siempre visible · NO toggle. */}
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Términos completos
                </p>
                <pre className="text-[11.5px] text-foreground/85 leading-relaxed whitespace-pre-wrap font-sans">
                  {RESPONSIBLE_ACCEPTANCE_TERMS.body}
                </pre>
              </div>

              {/* Marcador "fin del texto" · cuando el user llega aquí
                  consideramos lectura efectiva. */}
              <div className="rounded-xl bg-success/5 border border-success/30 p-3 flex items-start gap-2.5">
                <span className="h-5 w-5 rounded-full bg-success/15 text-success grid place-items-center shrink-0 mt-0.5">
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                </span>
                <p className="text-[12px] text-foreground leading-snug">
                  <span className="font-semibold">Has llegado al final del documento.</span>{" "}
                  Ya puedes marcar la casilla "He leído y acepto" en el pie y activar tu
                  rol de Responsable.
                </p>
              </div>
            </div>

            {/* Footer fijo · checkbox + CTA. */}
            <footer className="px-6 py-4 border-t border-border bg-muted/20 shrink-0 space-y-3">
              <label
                className={cn(
                  "flex items-start gap-2.5 rounded-xl border p-3 transition-colors",
                  reachedBottom
                    ? "border-border bg-card cursor-pointer hover:bg-muted/30"
                    : "border-border/40 bg-muted/30 opacity-60 cursor-not-allowed",
                )}
              >
                <input
                  type="checkbox"
                  checked={tosAccepted}
                  disabled={!reachedBottom}
                  onChange={(e) => setTosAccepted(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-border accent-primary disabled:cursor-not-allowed"
                />
                <span className="text-[12.5px] text-foreground leading-snug">
                  {reachedBottom
                    ? <>He leído y acepto los <strong>Términos del Responsable</strong> y autorizo el tratamiento de los datos conforme a la <a href="/legal/privacidad" target="_blank" rel="noopener" className="text-primary underline underline-offset-2 hover:text-primary/80">Política de privacidad</a> de Byvaro.</>
                    : <span className="text-muted-foreground">Desplázate hasta el final del documento para poder aceptar los términos.</span>}
                </span>
              </label>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-[10.5px] text-muted-foreground leading-snug">
                  Se registrará: <span className="text-foreground font-medium">{user.name}</span> ·
                  <span className="text-foreground font-medium"> {user.email}</span> ·
                  fecha de aceptación · v{RESPONSIBLE_ACCEPTANCE_TERMS.version}.
                </p>
                <button
                  type="button"
                  onClick={handleSelfConfirm}
                  disabled={!tosAccepted}
                  className={cn(
                    "inline-flex items-center gap-1.5 h-10 px-5 rounded-full bg-foreground text-background text-sm font-semibold transition-colors shrink-0",
                    tosAccepted ? "hover:bg-foreground/90" : "opacity-40 cursor-not-allowed",
                  )}
                >
                  <ShieldCheck className="h-4 w-4" />
                  Activar mi rol
                </button>
              </div>
            </footer>
          </>
        )}

        {step === "invite-form" && (
          <form onSubmit={handleSubmitInvite}>
            <DialogHeader className="px-6 pt-6 pb-4">
              <button
                type="button"
                onClick={() => setStep("choose")}
                className="inline-flex items-center gap-1 text-[12.5px] text-muted-foreground hover:text-foreground transition-colors mb-3"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Atrás
              </button>
              <DialogTitle className="text-[19px] sm:text-[22px] font-bold tracking-tight leading-tight">
                Invita al Responsable
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground leading-relaxed mt-2">
                Recibirá un email para activar la cuenta como Responsable. Mientras tanto, tú
                seguirás operando como miembro del equipo con permisos limitados.
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 pb-4 flex flex-col gap-3">
              <Field icon={UserIcon} label="Nombre del Responsable">
                <input
                  type="text"
                  value={responsibleName}
                  onChange={(e) => setResponsibleName(e.target.value)}
                  placeholder="Nombre y apellido"
                  autoFocus
                  className="h-10 w-full bg-card border border-border rounded-xl px-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </Field>
              <Field icon={Mail} label="Email">
                <input
                  type="email"
                  value={responsibleEmail}
                  onChange={(e) => setResponsibleEmail(e.target.value)}
                  placeholder="responsable@agencia.com"
                  className="h-10 w-full bg-card border border-border rounded-xl px-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </Field>
              <Field
                icon={Phone}
                label={<>Teléfono <span className="text-muted-foreground/70 font-normal">(opcional)</span></>}
              >
                <PhoneInput
                  value={responsibleTelefono}
                  onChange={setResponsibleTelefono}
                  placeholder="+34 600 000 000"
                />
              </Field>
            </div>

            <footer className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 h-10 px-5 rounded-full bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors disabled:opacity-40"
              >
                {submitting
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
                Enviar invitación
              </button>
            </footer>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ─── Sub-componentes ─── */

function ChoiceCard({
  icon: Icon, title, description, selected, onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left flex items-start gap-3 rounded-xl border px-4 py-3.5 transition-all",
        selected
          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
          : "border-border bg-card hover:border-primary/40 hover:bg-muted/30",
      )}
    >
      <div className={cn(
        "h-9 w-9 rounded-xl grid place-items-center shrink-0 mt-0.5 transition-colors",
        selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14.5px] font-semibold text-foreground">{title}</p>
        <p className="text-[12.5px] text-muted-foreground mt-0.5 leading-snug">{description}</p>
      </div>
      <span
        className={cn(
          "h-5 w-5 rounded-full border-2 grid place-items-center shrink-0 mt-1 transition-colors",
          selected ? "border-primary bg-primary" : "border-border bg-card",
        )}
      >
        {selected && (
          <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
        )}
      </span>
    </button>
  );
}

/* Bullet con check verde · usado en la lista de obligaciones del paso
 * "self-confirm" (T&C). */
function BulletItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-[12.5px] text-foreground/90 leading-relaxed">
      <span className="h-4 w-4 rounded-full bg-success/15 text-success grid place-items-center shrink-0 mt-0.5">
        <Check className="h-2.5 w-2.5" strokeWidth={2.75} />
      </span>
      <span>{children}</span>
    </li>
  );
}

function Field({
  icon: Icon, label, children,
}: { icon: React.ComponentType<{ className?: string }>; label: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11.5px] font-semibold text-foreground inline-flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        {label}
      </span>
      {children}
    </label>
  );
}
