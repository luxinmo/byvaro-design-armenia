/**
 * Pantalla · `/invite/:token`
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Landing pública de aceptación de invitación · es a donde lleva el
 * link "Ver invitación" del email que el promotor/comercializador
 * envía a la agencia colaboradora.
 *
 * Detección automática de caso (CLAUDE.md regla "Vista de Agencia"):
 *
 *   · Token inválido / caducado / aceptado · → estado de error
 *     informativo · botón a /login.
 *
 *   · Caso 2a · ya hay sesión activa de agencia que matchea con el
 *     `agencyId` o el email de la invitación → auto-añade a cartera y
 *     redirige a `/promociones/:id`. Cero clicks.
 *
 *   · Caso 2b · email matchea un usuario YA existente en mockUsers
 *     (o `byvaro.users.created.v1`), pero NO hay sesión → muestra
 *     "Inicia sesión para añadir a tu cartera" + redirect a /login con
 *     `next=` que vuelve aquí ya logueado.
 *
 *   · Caso 1 · email completamente nuevo en Byvaro → wizard mínimo
 *     (nombre comercial · password · nombre admin) que crea la
 *     agencia + el usuario admin en localStorage, hace `loginAs`,
 *     añade la promoción a la cartera y redirige.
 *
 * En cualquier caso, al "añadir a cartera":
 *   · `aceptar(invitation.id)` muta el estado.
 *   · `addPromotionToCartera(agencyId, promotionId)` persiste la
 *     selección de la agencia.
 *   · `ensureAgencyContactForPromoter()` crea el contacto del
 *     promotor en el CRM de la agencia.
 *
 * TODO(backend): este flujo se sustituye por:
 *   - `GET  /api/invitations/:token`         → datos de la invitación.
 *   - `POST /api/invitations/:token/accept`  → si hay sesión.
 *   - `POST /api/auth/signup-from-invite`    → caso 1 alta atómica.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { memCache } from "@/lib/memCache";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Mail, Lock, Building2, Sparkles, ArrowRight, AlertTriangle, Check, Loader2, User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { promotionHrefById } from "@/lib/urls";
import { BrandLogo } from "@/components/BrandLogo";

import { useInvitaciones, type Invitacion } from "@/lib/invitaciones";
import { isInvitacionDescartada, descartarInvitacion } from "@/lib/invitacionesDescartadas";
import {
  saveCreatedAgency, saveCreatedUser, signUpAgencyAdmin, generateNewAgencyId, userExistsByEmail,
} from "@/lib/createdAgencies";
import { addPromotionToCartera } from "@/lib/agencyCartera";
import { ensureAgencyContactForPromoter } from "@/lib/invitationContacts";
import { loginAs, isAuthenticated } from "@/lib/accountType";
import { useAccountType } from "@/lib/accountType";
import { mockUsers } from "@/data/mockUsers";
import { agencies as SEED_AGENCIES } from "@/data/agencies";
import { promotions } from "@/data/promotions";
import { developerOnlyPromotions } from "@/data/developerPromotions";
import { useEmpresa } from "@/lib/empresa";
import { getOwnerRoleLabel } from "@/lib/promotionRole";
import { findAgencyByEmailDomain, type DomainMatchResult } from "@/lib/agencyDomainLookup";
import { getDomainMatchNotifyHtml } from "@/lib/domainMatchNotifyEmail";
import { recordSentEmail } from "@/lib/sentEmails";

type Phase =
  | "loading"
  | "invalid"
  | "case2a-auto"
  | "case2b-needs-login"
  | "case2c-domain-match"  // dominio match con agencia existente · usuario no registrado
  | "case1-signup"
  | "added";

/* ─── DEMO SEEDER ────────────────────────────────────────────────────
 * Para poder compartir URLs estáticas que "just work" sin tener que
 * pasar por el flujo completo de invitar, definimos tokens demo que
 * auto-crean la invitación correspondiente en localStorage si falta.
 *
 * URLs de demo:
 *   /invite/demo-caso1-nuevo       · email NUEVO en Byvaro (alta wizard)
 *   /invite/demo-caso2b-existente  · email YA registrado (login + add)
 *
 * Esto SOLO existe en el mock · cuando llegue backend, las invitaciones
 * vienen de `GET /api/invitations/:token` (server). */
const DEMO_INVITATIONS: Record<string, () => Invitacion> = {
  "demo-caso1-nuevo": () => ({
    id: "inv-demo-caso1",
    token: "demo-caso1-nuevo",
    emailAgencia: "fundadora@nuevaagencia.com",
    nombreAgencia: "Nueva Agencia Demo",
    agencyId: undefined,
    mensajePersonalizado: "",
    comisionOfrecida: 4.5,
    idiomaEmail: "es",
    estado: "pendiente",
    createdAt: Date.now(),
    expiraEn: Date.now() + 30 * 24 * 60 * 60 * 1000,
    promocionId: "dev-2",
    promocionNombre: "Villas del Pinar",
    duracionMeses: 12,
    formaPago: [
      { tramo: 1, completado: 25, colaborador: 75 },
      { tramo: 2, completado: 75, colaborador: 25 },
    ],
    datosRequeridos: ["Nombre completo", "Las 4 últimas cifras del teléfono", "Nacionalidad"],
    events: [{ id: "ev-demo-created-1", type: "created", at: Date.now() }],
  }),
  "demo-caso2b-existente": () => ({
    id: "inv-demo-caso2b",
    token: "demo-caso2b-existente",
    emailAgencia: "laura@primeproperties.com",
    nombreAgencia: "Prime Properties Costa del Sol",
    agencyId: "ag-1",
    mensajePersonalizado: "",
    comisionOfrecida: 4,
    idiomaEmail: "es",
    estado: "pendiente",
    createdAt: Date.now(),
    expiraEn: Date.now() + 30 * 24 * 60 * 60 * 1000,
    promocionId: "dev-2",
    promocionNombre: "Villas del Pinar",
    duracionMeses: 12,
    formaPago: [
      { tramo: 1, completado: 30, colaborador: 50 },
      { tramo: 2, completado: 70, colaborador: 50 },
    ],
    datosRequeridos: ["Nombre completo", "Las 4 últimas cifras del teléfono", "Nacionalidad"],
    events: [{ id: "ev-demo-created-2", type: "created", at: Date.now() }],
  }),
};

function seedDemoInvitationIfNeeded(token: string): boolean {
  const seedFn = DEMO_INVITATIONS[token];
  if (!seedFn) return false;
  const STORAGE = "byvaro-invitaciones";
  const raw = memCache.getItem(STORAGE);
  let list: Invitacion[] = [];
  try { list = raw ? JSON.parse(raw) : []; } catch { list = []; }
  if (list.some((i) => i.token === token)) return false;
  const inv = seedFn();
  list.push(inv);
  memCache.setItem(STORAGE, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent("byvaro:invitaciones-changed"));
  return true;
}

export default function InviteAccept() {
  const { token = "" } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const autoComplete = searchParams.get("auto") === "1";
  const navigate = useNavigate();
  /* Seed demo invitation BEFORE useInvitaciones reads · si el token
   * es uno de los demo y no existe, se crea sin esperar al re-render. */
  if (typeof window !== "undefined" && token in DEMO_INVITATIONS) {
    seedDemoInvitationIfNeeded(token);
  }
  const { lista, aceptar } = useInvitaciones();
  const { empresa: promotorEmpresa } = useEmpresa();
  const { type: accountType, agencyId: sessionAgencyId } = useAccountType();

  const invitation: Invitacion | undefined = useMemo(
    () => lista.find((i) => i.token === token),
    [lista, token],
  );

  const [phase, setPhase] = useState<Phase>("loading");
  const [autoError, setAutoError] = useState<string | null>(null);
  /* Guard one-shot · evita ejecutar completeSignup más de una vez
   * cuando React Strict Mode renderiza dos veces, o cuando el effect
   * se re-dispara por cambios de dependencias post-login. */
  const autoCompleteFiredRef = useRef(false);
  /* Caso 2c · dominio match con agencia existente · resultado del
   * lookup para mostrar copy con nombre del admin + agencia + para
   * disparar la notificación al admin una sola vez. */
  const [domainMatch, setDomainMatch] = useState<DomainMatchResult | null>(null);
  const domainNotifyFiredRef = useRef(false);

  /* Resolver promo asociada (si la invitación se ligó a una promo). */
  const promo = useMemo(() => {
    if (!invitation?.promocionId) return undefined;
    return promotions.find((p) => p.id === invitation.promocionId)
      ?? developerOnlyPromotions.find((p) => p.id === invitation.promocionId);
  }, [invitation]);

  /* ── Detección de caso · effect inicial ───────────────────────── */
  useEffect(() => {
    if (!token) { setPhase("invalid"); return; }
    if (!invitation) { setPhase("invalid"); return; }
    if (invitation.estado !== "pendiente") { setPhase("invalid"); return; }
    if (isInvitacionDescartada(invitation.id)) { setPhase("invalid"); return; }

    const invitedEmail = invitation.emailAgencia.trim().toLowerCase();
    const seedEmails = mockUsers.map((u) => u.email);
    const emailExists = userExistsByEmail(invitedEmail, seedEmails);

    /* Caso 2a · sesión activa de agencia que coincide con la invitación.
     *   - Match directo por agencyId si la invitación lo trae.
     *   - O por email del usuario logueado contra el contacto principal
     *     de la agencia · cubre invitaciones con email externo a una
     *     agencia ya activa con login. */
    if (isAuthenticated() && accountType === "agency") {
      const matchByAgencyId = invitation.agencyId && invitation.agencyId === sessionAgencyId;
      const sessAgency = SEED_AGENCIES.find((a) => a.id === sessionAgencyId);
      const matchByEmail =
        sessAgency?.contactoPrincipal?.email?.toLowerCase() === invitedEmail;
      if (matchByAgencyId || matchByEmail) {
        setPhase("case2a-auto");
        // Disparamos el "añadir" inmediatamente.
        try {
          aceptar(invitation.id);
          if (invitation.promocionId) {
            addPromotionToCartera(sessionAgencyId, invitation.promocionId);
          }
          ensureAgencyContactForPromoter({
            agencyId: sessionAgencyId,
            promotor: {
              nombreComercial: promotorEmpresa.nombreComercial,
              razonSocial: promotorEmpresa.razonSocial,
              cif: promotorEmpresa.cif,
              email: promotorEmpresa.email,
              telefono: promotorEmpresa.telefono,
              logoUrl: promotorEmpresa.logoUrl,
            },
            invitacionId: invitation.id,
          });
          setPhase("added");
        } catch (e) {
          setAutoError(String(e));
          setPhase("invalid");
        }
        return;
      }
    }

    if (emailExists) { setPhase("case2b-needs-login"); return; }

    /* Caso 2c · dominio match con agencia existente · email no
     * registrado. Mostramos landing pidiendo al admin que lo invite
     * + disparamos email de notificación al admin (una sola vez). */
    const dm = findAgencyByEmailDomain(invitation.emailAgencia);
    if (dm) {
      setDomainMatch(dm);
      setPhase("case2c-domain-match");
      if (!domainNotifyFiredRef.current && dm.adminUser) {
        domainNotifyFiredRef.current = true;
        const inviteMemberUrl = `${window.location.origin}/ajustes/usuarios/miembros`;
        const { asunto, html } = getDomainMatchNotifyHtml({
          adminName: dm.adminUser.name,
          adminEmail: dm.adminUser.email,
          agencyName: dm.agency.name,
          invitedEmail: invitation.emailAgencia,
          inviterName: promotorEmpresa.razonSocial || promotorEmpresa.nombreComercial || "Un promotor",
          inviterCompany: promotorEmpresa.nombreComercial || "Byvaro",
          inviteMemberUrl,
          promotionName: invitation.promocionNombre,
        });
        recordSentEmail({
          to: dm.adminUser.email,
          subject: asunto,
          html,
          kind: "invitation",
          refId: `domain-match-${invitation.id}`,
        });
        /* TODO(backend): además del email, crear `Notification` in-app
         * para el admin · tabla `notifications(user_id, kind,
         * payload)` · UI ya tiene `<NotificationsBell>`. */
      }
      return;
    }

    setPhase("case1-signup");
  }, [
    token, invitation, accountType, sessionAgencyId, aceptar,
    promotorEmpresa.nombreComercial, promotorEmpresa.razonSocial,
    promotorEmpresa.cif, promotorEmpresa.email, promotorEmpresa.telefono,
    promotorEmpresa.logoUrl,
  ]);

  /* Handler de signup · estable vía useCallback. Lo usan tanto el
   * SignupForm (rama UI) como el effect de auto-complete (?auto=1).
   * DEBE definirse antes de cualquier early return para no violar las
   * Rules of Hooks (mismo número de hooks en cada render). */
  const completeSignup = useCallback((payload: {
    agencyName: string; fullName: string; password: string;
  }) => {
    if (!invitation) return;
    const newAgencyId = generateNewAgencyId();
    /* Real auth · Supabase signUp + organizations + members.
     *  Async, no bloquea la UI · si falla cae al fallback local. */
    void signUpAgencyAdmin({
      email: invitation.emailAgencia,
      password: payload.password,
      fullName: payload.fullName,
      agencyId: newAgencyId,
      agencyName: payload.agencyName,
    });
    saveCreatedAgency({
      id: newAgencyId,
      name: payload.agencyName,
      logo: undefined,
      cover: undefined,
      location: "—",
      type: "Agency",
      description: "Agencia recién dada de alta vía invitación.",
      visitsCount: 0,
      registrations: 0,
      salesVolume: 0,
      status: "active",
      offices: [],
      promotionsCollaborating: invitation.promocionId ? [invitation.promocionId] : [],
      totalPromotionsAvailable: 0,
      isNewRequest: false,
      origen: "invited",
      estadoColaboracion: "activa",
      registrosAportados: 0,
      ventasCerradas: 0,
      comisionMedia: invitation.comisionOfrecida,
      solicitudPendiente: false,
      contactoPrincipal: {
        nombre: payload.fullName,
        rol: "Admin",
        email: invitation.emailAgencia,
        telefono: "",
      },
    });
    saveCreatedUser({
      email: invitation.emailAgencia,
      password: payload.password,
      name: payload.fullName,
      accountType: "agency",
      role: "admin",
      agencyId: newAgencyId,
      label: `${payload.agencyName} · Agencia (admin)`,
    });
    loginAs("agency", newAgencyId, invitation.emailAgencia);
    aceptar(invitation.id);
    if (invitation.promocionId) {
      addPromotionToCartera(newAgencyId, invitation.promocionId);
    }
    ensureAgencyContactForPromoter({
      agencyId: newAgencyId,
      promotor: {
        nombreComercial: promotorEmpresa.nombreComercial,
        razonSocial: promotorEmpresa.razonSocial,
        cif: promotorEmpresa.cif,
        email: promotorEmpresa.email,
        telefono: promotorEmpresa.telefono,
        logoUrl: promotorEmpresa.logoUrl,
      },
      invitacionId: invitation.id,
    });
    toast.success("Cuenta creada · ¡bienvenido a Byvaro!");
    navigate(invitation.promocionId ? promotionHrefById(invitation.promocionId) : "/inicio");
  }, [
    invitation, aceptar, navigate,
    promotorEmpresa.nombreComercial, promotorEmpresa.razonSocial,
    promotorEmpresa.cif, promotorEmpresa.email, promotorEmpresa.telefono,
    promotorEmpresa.logoUrl,
  ]);

  /* Auto-skip · cuando la URL trae `?auto=1` y se ha detectado caso 1,
   * disparamos completeSignup UNA sola vez fuera del render. */
  useEffect(() => {
    if (!autoComplete) return;
    if (phase !== "case1-signup") return;
    if (!invitation) return;
    if (autoCompleteFiredRef.current) return;
    autoCompleteFiredRef.current = true;
    completeSignup({
      agencyName: invitation.nombreAgencia || "Nueva Agencia Demo",
      fullName: "Agente Demo",
      password: "Luxinmo2026Byvaro",
    });
  }, [autoComplete, phase, invitation, completeSignup]);

  /* ── Render ──────────────────────────────────────────────────── */

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
          <h1 className="text-xl font-bold tracking-tight text-foreground">Invitación no disponible</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {autoError
              ? autoError
              : "Este enlace ya no es válido. Puede haber expirado, haber sido aceptado, o el remitente lo ha cancelado."}
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

  if (phase === "added") {
    return (
      <Shell>
        <div className="max-w-md text-center space-y-4">
          <div className="h-12 w-12 rounded-2xl bg-success/10 grid place-items-center mx-auto">
            <Check className="h-5 w-5 text-success" strokeWidth={2.5} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Añadida a tu cartera</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {promo?.name
              ? <>Ya puedes registrar clientes para <strong>{promo.name}</strong>.</>
              : "Ya formas parte de la red colaboradora."}
          </p>
          <button
            type="button"
            onClick={() =>
              navigate(invitation?.promocionId ? promotionHrefById(invitation.promocionId) : "/inicio")
            }
            className="inline-flex items-center gap-1.5 h-10 px-5 rounded-full bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors"
          >
            Ir a la promoción <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </Shell>
    );
  }

  /* Datos comunes a Caso 1 y 2b · pintamos la "tarjeta de invitación". */
  const inviterCompany = promotorEmpresa.nombreComercial || "Tu colaborador";
  const ownerLabel = getOwnerRoleLabel(promo);

  if (phase === "case2b-needs-login" && invitation) {
    return (
      <Shell>
        <InvitationCard
          inviterCompany={inviterCompany}
          ownerLabel={ownerLabel}
          promoName={promo?.name}
          comision={invitation.comisionOfrecida}
          duracionMeses={invitation.duracionMeses}
          email={invitation.emailAgencia}
        />
        <div className="mt-5 flex flex-col gap-2 max-w-md">
          <button
            type="button"
            onClick={() => {
              const next = encodeURIComponent(`/invite/${token}`);
              const email = encodeURIComponent(invitation.emailAgencia);
              navigate(`/login?email=${email}&next=${next}`);
            }}
            className="inline-flex items-center justify-center gap-1.5 h-11 px-5 rounded-full bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors"
          >
            Iniciar sesión y añadir a mi cartera
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              descartarInvitacion(invitation.id);
              toast("Invitación descartada");
              navigate("/login");
            }}
            className="inline-flex items-center justify-center h-10 px-4 rounded-full text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Descartar
          </button>
        </div>
      </Shell>
    );
  }

  if (phase === "case2c-domain-match" && invitation && domainMatch) {
    const adminName = domainMatch.adminUser?.name ?? "el administrador";
    const adminEmail = domainMatch.adminUser?.email;
    const agencyName = domainMatch.agency.name;
    return (
      <Shell>
        <div className="w-full max-w-md flex flex-col gap-5">
          <div className="rounded-2xl border border-border bg-card shadow-soft p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Invitación
            </p>
            <h1 className="text-[20px] sm:text-[22px] font-bold tracking-tight text-foreground leading-tight mt-1">
              Tu empresa <span className="text-primary">{agencyName}</span> ya está en Byvaro.
            </h1>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
              Este enlace de invitación llegó a <strong className="text-foreground">{invitation.emailAgencia}</strong>,
              pero ese email todavía no es miembro del equipo de {agencyName}.
            </p>

            <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                ¿Qué hacer?
              </p>
              <ol className="text-[12.5px] text-foreground/90 leading-relaxed list-decimal list-inside space-y-1.5">
                <li>
                  Pide a <strong className="text-foreground">{adminName}</strong>
                  {adminEmail ? <span className="text-muted-foreground"> ({adminEmail})</span> : null}
                  {" "}que te invite al equipo de {agencyName} en Byvaro.
                </li>
                <li>
                  Cuando tengas tu cuenta de miembro, vuelve a este enlace · podrás añadir la
                  promoción a la cartera de la agencia.
                </li>
              </ol>
            </div>

            <div className="mt-4 rounded-xl bg-success/5 border border-success/30 p-3 flex items-start gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-success/15 text-success grid place-items-center shrink-0">
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
              </div>
              <p className="text-[12px] text-foreground leading-snug">
                Ya hemos avisado a {adminName} por email · solo tienes que esperar a que te invite
                al equipo. Si no llega en unas horas, escríbele tú directamente.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate("/login")}
            className="inline-flex items-center justify-center h-10 px-4 rounded-full text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Volver
          </button>
        </div>
      </Shell>
    );
  }

  if (phase === "case1-signup" && invitation) {
    /* Mientras el auto-complete está procesando, mostramos un loading
     * en lugar del form. No dispara nada · el effect ya está en marcha. */
    if (autoComplete) {
      return (
        <Shell>
          <div className="flex items-center gap-3 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Creando cuenta y añadiendo a tu cartera…
          </div>
        </Shell>
      );
    }

    return (
      <Shell>
        <InvitationCard
          inviterCompany={inviterCompany}
          ownerLabel={ownerLabel}
          promoName={promo?.name}
          comision={invitation.comisionOfrecida}
          duracionMeses={invitation.duracionMeses}
          email={invitation.emailAgencia}
        />
        <SignupForm
          email={invitation.emailAgencia}
          defaultAgencyName={invitation.nombreAgencia}
          onCompleted={completeSignup}
          onDismiss={() => {
            descartarInvitacion(invitation.id);
            toast("Invitación descartada");
            navigate("/login");
          }}
        />
      </Shell>
    );
  }

  return null;
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

function InvitationCard({
  inviterCompany, ownerLabel,
  promoName, comision, duracionMeses, email,
}: {
  inviterCompany: string;
  ownerLabel: string;
  promoName?: string;
  comision: number;
  duracionMeses?: number;
  email: string;
}) {
  return (
    <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-soft p-5">
      <div className="flex items-center gap-2.5 mb-2.5">
        <span className="h-9 w-9 rounded-xl bg-primary/10 grid place-items-center">
          <Sparkles className="h-4 w-4 text-primary" strokeWidth={1.75} />
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Invitación · {ownerLabel}
        </p>
      </div>
      <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground leading-tight">
        {inviterCompany} te invita {promoName ? <>a <span className="text-primary">{promoName}</span></> : "a colaborar"}.
      </h1>
      <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
        Recibido en <span className="text-foreground font-medium">{email}</span>. Si lo añades a tu
        cartera podrás registrar a tus clientes a través de Byvaro y comercializar{" "}
        {promoName ? "esta promoción" : "las promociones"} desde tu cuenta.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Stat label="Comisión" value={`${comision}%`} />
        <Stat
          label="Duración"
          value={duracionMeses && duracionMeses > 0 ? `${duracionMeses} meses` : "Indefinida"}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <p className="text-base font-bold text-foreground tnum mt-0.5">{value}</p>
    </div>
  );
}

function SignupForm({
  email, defaultAgencyName, onCompleted, onDismiss,
}: {
  email: string;
  defaultAgencyName: string;
  onCompleted: (p: { agencyName: string; password: string; fullName: string }) => void;
  onDismiss: () => void;
}) {
  const [agencyName, setAgencyName] = useState(defaultAgencyName ?? "");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    agencyName.trim().length >= 2 && fullName.trim().length >= 2 && password.length >= 6;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    onCompleted({
      agencyName: agencyName.trim(),
      fullName: fullName.trim(),
      password,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mt-5 flex flex-col gap-3">
      <p className="text-[12px] text-muted-foreground">
        Crea tu cuenta de agencia para añadirla a tu cartera. Solo nombre, password y un punto de
        contacto · podrás completar el perfil después.
      </p>

      <Field icon={Mail} label="Email">
        <input
          type="email"
          value={email}
          readOnly
          className="h-10 w-full bg-muted/40 border border-border rounded-xl px-3 text-sm text-muted-foreground cursor-not-allowed"
        />
      </Field>

      <Field icon={Building2} label="Nombre comercial de la agencia">
        <input
          type="text"
          value={agencyName}
          onChange={(e) => setAgencyName(e.target.value)}
          placeholder="Ej. Costa Invest Homes"
          autoFocus
          className="h-10 w-full bg-card border border-border rounded-xl px-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
        />
      </Field>

      <Field icon={UserIcon} label="Tu nombre">
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Nombre y apellido"
          className="h-10 w-full bg-card border border-border rounded-xl px-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
        />
      </Field>

      <Field icon={Lock} label="Crea una contraseña">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 6 caracteres"
          minLength={6}
          className="h-10 w-full bg-card border border-border rounded-xl px-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
        />
      </Field>

      <button
        type="submit"
        disabled={!canSubmit || submitting}
        className={cn(
          "mt-2 h-11 rounded-full bg-foreground text-background text-sm font-semibold inline-flex items-center justify-center gap-1.5 transition-colors",
          canSubmit && !submitting ? "hover:bg-foreground/90" : "opacity-50 cursor-not-allowed",
        )}
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" strokeWidth={2.5} />}
        Crear cuenta y añadir a cartera
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="h-10 rounded-full text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        Descartar
      </button>
    </form>
  );
}

function Field({
  icon: Icon, label, children,
}: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
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
