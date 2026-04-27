/**
 * Pantalla · `/responsible/:token`
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Landing pública del email "magic link" que recibe el Responsable de
 * una agencia (caso 1 · admin actual lo invitó desde el modal
 * `<ResponsibleSetupDialog>`).
 *
 * Flujo:
 *   1. Lee `:token` de la URL → busca la `ResponsibleInvitation`
 *      en localStorage.
 *   2. Si está aceptada / caducada / inexistente → estado de error.
 *   3. Si está pendiente → tarjeta "Vas a ser Responsable de {Agencia}"
 *      con lista corta de qué podrá hacer + form de password
 *      (1 campo + 1 botón "Activar mi cuenta").
 *   4. Al activar:
 *        a. Crea (o actualiza) el `MockUser` del Responsable como
 *           admin de la agencia.
 *        b. Si el invitador original era admin del workspace, lo
 *           degrada a `member`.
 *        c. Marca la responsible-invitation como `aceptada`.
 *        d. `loginAs` con la cuenta del Responsable.
 *        e. `markResponsibleSetupComplete(agencyId, "self")` · cierra
 *           el banner pendiente del workspace.
 *        f. Redirect a `/inicio`.
 *
 * Pública · NO envuelta en `<RequireAuth>` (mismo patrón que
 * `/invite/:token`).
 *
 * TODO(backend):
 *   - GET  /api/responsible-invitations/:token (server lee la
 *     invitación · si no existe / está aceptada / caducada → 404 / 410).
 *   - POST /api/responsible-invitations/:token/accept { password }
 *     server crea user + downgrade en una transacción + cookie httpOnly.
 */

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Lock, Loader2, ArrowRight, Check, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/BrandLogo";
import {
  findResponsibleInvitationByToken, markResponsibleInvitationAccepted,
  type ResponsibleInvitation,
} from "@/lib/responsibleInvitations";
import {
  loadCreatedUsers, saveCreatedUser,
} from "@/lib/createdAgencies";
import { loginAs } from "@/lib/accountType";
import { markResponsibleSetupComplete } from "@/lib/agencyOnboarding";

type Phase = "loading" | "invalid" | "form" | "done";

export default function ResponsibleAccept() {
  const { token = "" } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const invitation: ResponsibleInvitation | undefined = useMemo(
    () => findResponsibleInvitationByToken(token),
    [token],
  );

  const [phase, setPhase] = useState<Phase>("loading");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setPhase("invalid"); return; }
    if (!invitation) { setPhase("invalid"); return; }
    if (invitation.estado !== "pendiente") { setPhase("invalid"); return; }
    setPhase("form");
  }, [token, invitation]);

  const canSubmit = password.length >= 6 && !submitting;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !invitation) return;
    setSubmitting(true);

    /* 1. Crear / actualizar MockUser del Responsable como admin. */
    saveCreatedUser({
      email: invitation.responsibleEmail,
      password,
      name: invitation.responsibleName,
      accountType: "agency",
      role: "admin",
      agencyId: invitation.agencyId,
      label: `${invitation.agencyName} · Agencia (admin)`,
    });

    /* 2. Degradar al invitador original a `member` (si era admin de
     *    la misma agencia). Si no estaba en localStorage, lo dejamos
     *    como está · seed users no se mutan. */
    const inviterEmail = invitation.inviterUserEmail.toLowerCase();
    const all = loadCreatedUsers();
    const inviterEntry = all.find(
      (u) => u.email.toLowerCase() === inviterEmail
        && u.agencyId === invitation.agencyId,
    );
    if (inviterEntry) {
      saveCreatedUser({ ...inviterEntry, role: "member" });
    }

    /* 3. Marcar la responsible-invitation como aceptada. */
    markResponsibleInvitationAccepted(invitation.id);

    /* 4. Cerrar el setup de onboarding del workspace · ya hay
     *    Responsable real. Lo marcamos como "self" (este usuario lo es). */
    markResponsibleSetupComplete(invitation.agencyId, "self");

    /* 5. Login como Responsable · ya queda dentro del workspace. */
    loginAs("agency", invitation.agencyId, invitation.responsibleEmail);

    setPhase("done");
    toast.success("Cuenta activada", {
      description: `Eres el Responsable de ${invitation.agencyName}.`,
    });
    /* Pequeño delay para que vea el "done" antes del redirect. */
    setTimeout(() => navigate("/inicio"), 800);
  };

  if (phase === "loading") {
    return (
      <Shell>
        <div className="flex items-center gap-3 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando invitación…
        </div>
      </Shell>
    );
  }

  if (phase === "invalid") {
    return (
      <Shell>
        <div className="max-w-md text-center space-y-4">
          <div className="h-12 w-12 rounded-2xl bg-destructive/10 grid place-items-center mx-auto">
            <AlertTriangle className="h-5 w-5 text-destructive" strokeWidth={1.75} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Enlace no disponible</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Este enlace ya no es válido. Puede haber expirado, haber sido aceptado, o el remitente
            lo ha cancelado.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 h-10 px-5 rounded-full bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors"
          >
            Iniciar sesión <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </Shell>
    );
  }

  if (phase === "done") {
    return (
      <Shell>
        <div className="max-w-md text-center space-y-4">
          <div className="h-12 w-12 rounded-2xl bg-success/10 grid place-items-center mx-auto">
            <Check className="h-5 w-5 text-success" strokeWidth={2.5} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            ¡Cuenta activada!
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Te llevamos al panel de {invitation?.agencyName}…
          </p>
        </div>
      </Shell>
    );
  }

  /* phase === "form" */
  if (!invitation) return null;
  const firstName = invitation.responsibleName.split(" ")[0] || invitation.responsibleName;

  return (
    <Shell>
      <div className="w-full max-w-md flex flex-col gap-5">
        {/* Tarjeta de contexto */}
        <div className="rounded-2xl border border-border bg-card shadow-soft p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Invitación
          </p>
          <h1 className="text-[20px] sm:text-[22px] font-bold tracking-tight text-foreground leading-tight mt-1">
            Hola {firstName}, vas a ser <span className="text-primary">Responsable</span> de {invitation.agencyName}.
          </h1>
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
            {invitation.inviterUserName} ha creado la cuenta y te propone como Responsable.
            Como Responsable podrás:
          </p>
          <ul className="mt-3 space-y-1.5">
            <Bullet>Gestionar el perfil de la agencia y sus oficinas.</Bullet>
            <Bullet>Invitar a tu equipo y asignar roles.</Bullet>
            <Bullet>Aprobar contratos de colaboración con promotores.</Bullet>
            <Bullet>Cambiar el plan y los datos de facturación.</Bullet>
          </ul>
        </div>

        {/* Form de password */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border bg-card shadow-soft p-5 flex flex-col gap-3"
        >
          <p className="text-sm font-semibold text-foreground">Crea tu contraseña para activar la cuenta</p>
          <p className="text-[12px] text-muted-foreground -mt-1">
            Email de acceso · <span className="text-foreground font-medium">{invitation.responsibleEmail}</span>
          </p>

          <label className="flex flex-col gap-1.5 mt-1">
            <span className="text-[11.5px] font-semibold text-foreground inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              Contraseña
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              minLength={6}
              autoFocus
              className="h-10 w-full bg-card border border-border rounded-xl px-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </label>

          <button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              "mt-1 h-11 rounded-full bg-foreground text-background text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors",
              canSubmit ? "hover:bg-foreground/90" : "opacity-50 cursor-not-allowed",
            )}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" strokeWidth={2.25} />}
            Activar mi cuenta
          </button>
        </form>
      </div>
    </Shell>
  );
}

/* ─── Sub-componentes ─── */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-6 py-5 border-b border-border/50">
        <BrandLogo variant="lockup" />
      </header>
      <main className="flex-1 grid place-items-center px-4 py-8">
        <div className="w-full max-w-xl flex flex-col items-center">{children}</div>
      </main>
      <footer className="px-6 py-4 text-[11px] text-muted-foreground text-center border-t border-border/50">
        Byvaro · Plataforma para promotores y comercializadores de obra nueva.
      </footer>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-[12.5px] text-foreground/85 leading-relaxed">
      <span className="h-4 w-4 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0 mt-0.5">
        <Check className="h-2.5 w-2.5" strokeWidth={2.5} />
      </span>
      <span>{children}</span>
    </li>
  );
}
