/**
 * Pantalla · Register (`/register`)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Alta de usuario con el **flujo completo** del original de figgy
 * (wizard de 2 pasos + rama "company-exists") adaptado al sistema
 * visual Byvaro (split layout, BrandLogo, pill buttons, tokens HSL).
 *
 * Flujo:
 *   Step 1  ── selector de rol (Promotor/Agencia/Propietario)
 *              + email profesional + nombre comercial empresa
 *              + botón "Continuar"
 *              ├─ Si el dominio del email coincide con una empresa
 *              │  ya registrada  →  rama "company-exists"
 *              └─ Si no         →  Step 2
 *
 *   company-exists
 *              Card con logo + nombre de la empresa detectada + email
 *              en read-only con "Editar" que vuelve a step 1 + botón
 *              "Solicitar acceso". Al pulsar Solicitar acceso se
 *              muestra una pantalla final "Solicitud enviada".
 *
 *   Step 2   ── sub-rol (Propietario/Director o Empleado) + nombre +
 *              email read-only editable + teléfono + password con
 *              medidor de fuerza + confirmar + ToS + CTA "Crear cuenta".
 *
 *   requestSent (flag lateral)
 *              Si true, se renderiza la pantalla "Solicitud enviada"
 *              con el email del administrador de la empresa al que se
 *              mandó la solicitud.
 *
 * Layout (lg+): 2 columnas — form a la izquierda, hero decorativo a la
 * derecha con stats. En móvil solo el form. Se renderiza fuera de
 * `<AppLayout>` en `App.tsx` (como `/login` y `/crear-promocion`).
 *
 * Dependencias:
 *   - react-router-dom     → navegación (Link a /login, navigate a /inicio)
 *   - sonner               → toast no bloqueante al crear cuenta
 *   - lucide-react         → iconos inline en inputs, roles, estados
 *   - @/components/ui/     → NO usamos shadcn Button/Input aquí; inputs y
 *                            botones son nativos con clases Byvaro
 *   - @/components/BrandLogo → isotipo + wordmark oficiales
 *
 * Tokens usados (todos HSL, `src/index.css`):
 *   bg-background · bg-card · text-foreground · text-muted-foreground
 *   border-border · bg-primary/5 · text-primary · bg-destructive/10
 *   text-destructive · shadow-soft · shadow-soft-lg
 *
 * TODOs:
 *   - TODO(backend): POST /api/v1/auth/register  {role, email, companyName,
 *     subRole, name, phone, password} → {userId, token}
 *   - TODO(backend): POST /api/v1/companies/join-request {email, companyId}
 *     → {status: "sent"|"already-member"}
 *   - TODO(backend): GET  /api/v1/companies/lookup?domain=<x>  para la
 *     detección de empresa (ahora mock in-memory en `existingCompanies`).
 *   - TODO(onboarding): tras crear cuenta redirigir a /onboarding en vez
 *     de /inicio, cuando exista.
 *   - TODO(a11y): poner aria-live en el banner de error.
 */

import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner"; // Toaster global en App.tsx
import {
  Mail, Lock, User, Building2, Users, Home, Crown, Eye, EyeOff,
  Loader2, AlertCircle, Check, Phone, ArrowLeft, CheckCircle2,
} from "lucide-react"; // iconos para roles, subRoles, inputs, estados
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/BrandLogo"; // isotipo + wordmark oficiales

/* ═════════════════════════════════════════════════════════════════════
   Tipos y datos
   ═════════════════════════════════════════════════════════════════════ */

type Role = "developer" | "agency" | "owner";
type SubRole = "director" | "employee";
type Step = 1 | 2 | "company-exists";

interface ExistingCompany {
  name: string;
  domain: string;
  logo: string;
  adminEmail: string;
}

/**
 * Mock de empresas ya registradas en el sistema. En producción lo
 * sustituye un lookup: GET /api/v1/companies/lookup?domain=<x>.
 * Vacío hasta que el primer signup real cree organizaciones reales ·
 * la lógica `getCompanyFromEmail` retorna null y el flujo de "ya
 * existe esta empresa" no se activa hasta que tengamos data viva.
 */
const dicebearLogo = (name) => `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=1D74E7&textColor=ffffff`;
const existingCompanies: ExistingCompany[] = [];

function getCompanyFromEmail(email: string): ExistingCompany | null {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain) return null;
  return existingCompanies.find((c) => c.domain === domain) || null;
}

/* ═════════════════════════════════════════════════════════════════════
   Validaciones puras
   ═════════════════════════════════════════════════════════════════════ */

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  hints: Array<{ ok: boolean; text: string }>;
};

function scorePassword(pwd: string): PasswordStrength {
  const hints = [
    { ok: pwd.length >= 8,            text: "Al menos 8 caracteres" },
    { ok: /[A-Z]/.test(pwd),          text: "Una mayúscula" },
    { ok: /[0-9]/.test(pwd),          text: "Un número" },
    { ok: /[^A-Za-z0-9]/.test(pwd),   text: "Un símbolo" },
  ];
  const score = hints.filter((h) => h.ok).length as 0 | 1 | 2 | 3 | 4;
  const labels = ["Muy débil", "Débil", "Aceptable", "Buena", "Fuerte"];
  return { score, label: labels[score], hints };
}

/* ═════════════════════════════════════════════════════════════════════
   Opciones de rol (step 1)
   ═════════════════════════════════════════════════════════════════════ */

const roleOptions: { value: Role; label: string; sub: string; icon: React.ElementType }[] = [
  { value: "developer", label: "Promotor o comercializador",    sub: "Construyo o comercializo obra nueva",      icon: Building2 },
  { value: "agency",    label: "Agente o agencia inmobiliaria", sub: "Vendo inmuebles a compradores finales",    icon: Users },
  { value: "owner",     label: "Propietario",                   sub: "Quiero vender o alquilar un inmueble mío", icon: Home },
];

/* ═════════════════════════════════════════════════════════════════════
   Componente principal
   ═════════════════════════════════════════════════════════════════════ */

export default function Register() {
  const navigate = useNavigate();

  // ── Estado del wizard ──
  const [step, setStep] = useState<Step>(1);
  const [requestSent, setRequestSent] = useState(false);

  // ── Campos ──
  const [role, setRole]               = useState<Role | null>(null);
  const [email, setEmail]             = useState("");
  const [companyName, setCompanyName] = useState("");
  const [subRole, setSubRole]         = useState<SubRole | null>(null);
  const [name, setName]               = useState("");
  const [phone, setPhone]             = useState("");
  const [password, setPassword]       = useState("");
  const [confirm, setConfirm]         = useState("");
  const [acceptTos, setAcceptTos]     = useState(false);

  // ── UI local ──
  const [showPwd, setShowPwd]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // ── Derivados ──
  const matchedCompany = useMemo(() => getCompanyFromEmail(email), [email]);
  const strength       = useMemo(() => scorePassword(password), [password]);
  const passwordsMatch = confirm.length > 0 && password === confirm;
  const emailError = email.length > 0 && !isValidEmail(email) ? "Email con formato inválido" : null;

  const canContinueStep1 = !!role && isValidEmail(email);
  const canSubmitStep2 =
    !!subRole &&
    name.trim().length >= 2 &&
    phone.trim().length >= 6 &&
    password.length >= 8 &&
    password === confirm &&
    acceptTos &&
    !submitting;

  // ── Handlers ──
  function handleContinueStep1() {
    setError(null);
    if (!role) return setError("Selecciona tu rol.");
    if (!isValidEmail(email)) return setError("Introduce un email válido.");
    if (matchedCompany) {
      setStep("company-exists");
    } else {
      setStep(2);
    }
  }

  function handleRequestToJoin() {
    // TODO(backend): POST /api/v1/companies/join-request
    setRequestSent(true);
  }

  async function handleSubmitStep2(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!subRole) return setError("Selecciona si eres propietario/director o empleado.");
    if (name.trim().length < 2) return setError("Escribe tu nombre completo.");
    if (phone.trim().length < 6) return setError("Introduce un teléfono válido.");
    if (password.length < 8)   return setError("La contraseña debe tener al menos 8 caracteres.");
    if (password !== confirm)  return setError("Las contraseñas no coinciden.");
    if (!acceptTos)            return setError("Debes aceptar los términos para continuar.");

    setSubmitting(true);

    /* Registro real contra Supabase Auth · si Supabase no está
     *  configurado, fallback al mock (sessionStorage). */
    const { supabase, isSupabaseConfigured } = await import("@/lib/supabaseClient");
    if (!isSupabaseConfigured) {
      setSubmitting(false);
      setError("Supabase no está configurado · revisa VITE_SUPABASE_* en env.");
      return;
    }

    try {
      /* 1. Crear el user en auth.users con metadata. Supabase enviará
       *  email de confirmación automáticamente si el setting
       *  `mailer_autoconfirm` está OFF (default). */
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { name: name.trim(), phone: phone.trim() },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });
      if (signUpError) {
        setSubmitting(false);
        setError(signUpError.message.includes("already registered")
          ? "Ya existe una cuenta con este email · ve a iniciar sesión."
          : signUpError.message);
        return;
      }
      if (!signUpData.user) {
        setSubmitting(false);
        setError("No se pudo crear la cuenta · reintenta.");
        return;
      }

      /* 2. Crear la organización con kind correspondiente al role.
       *  El role "owner" (propietario individual) lo mapeamos a
       *  "developer" en Phase 1 · refinar cuando exista persona owner. */
      const orgKind: "developer" | "agency" =
        role === "agency" ? "agency" : "developer";
      const orgId = `${orgKind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      const { error: orgErr } = await supabase.from("organizations").insert({
        id: orgId,
        kind: orgKind,
        legal_name: companyName.trim(),
        display_name: companyName.trim(),
        country: "ES",
        status: "active",
      });
      if (orgErr) {
        console.warn("[register] org insert:", orgErr.message);
        setSubmitting(false);
        setError(`No se pudo crear la organización: ${orgErr.message}`);
        return;
      }

      /* 3. Crear membership con role=admin (el primer user es admin
       *  de su workspace por construcción). */
      const memberRole: "admin" | "member" =
        subRole === "director" ? "admin" : "admin"; // Phase 1 · cualquier alta es admin
      const { error: memErr } = await supabase.from("organization_members").insert({
        organization_id: orgId,
        user_id: signUpData.user.id,
        role: memberRole,
        status: "active",
      });
      if (memErr) console.warn("[register] member insert:", memErr.message);

      setSubmitting(false);

      /* Si Supabase requiere confirmación email, signUpData.session
       *  será null. Mostramos pantalla de "verifica tu email". */
      if (!signUpData.session) {
        toast.success("Cuenta creada", {
          description: `Te hemos enviado un email de verificación a ${email}. Revisa tu bandeja de entrada (y spam).`,
          duration: 8000,
        });
        navigate("/login", { replace: true });
        return;
      }

      /* Si autoconfirm está ON, ya hay session · entramos directo. */
      toast.success(`Bienvenido, ${name.split(" ")[0]}`, {
        description: "Tu cuenta está lista.",
      });
      navigate("/inicio", { replace: true });
    } catch (err) {
      setSubmitting(false);
      console.warn("[register] unexpected:", err);
      setError(err instanceof Error ? err.message : "Error inesperado al registrar.");
    }
  }

  /* ═══════════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════════ */

  // ══ Pantalla fin: "Solicitud enviada" ══
  if (requestSent && matchedCompany) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-5 py-10">
        <Link to="/" className="mb-10">
          <BrandLogo variant="lockup" iconSize={40} wordmarkHeight={20} />
        </Link>
        <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-soft-lg p-6 sm:p-8 text-center space-y-4">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 text-primary grid place-items-center">
            <CheckCircle2 className="h-6 w-6" strokeWidth={1.8} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Solicitud enviada</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Tu solicitud para unirte a <span className="font-semibold text-foreground">{matchedCompany.name}</span> se ha enviado al administrador:
          </p>
          <p className="text-sm font-semibold text-foreground tnum">{matchedCompany.adminEmail}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Un administrador revisará tu solicitud. Recibirás un email en cuanto se apruebe tu acceso.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 mt-2 text-xs font-medium text-primary hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Volver al inicio de sesión
          </Link>
        </div>
      </div>
    );
  }

  // ══ Pantalla normal: wizard ══
  return (
    <div className="min-h-screen bg-background text-foreground">

      <div className="min-h-screen grid lg:grid-cols-2">
        {/* ══════ COLUMNA FORM ══════ */}
        <section className="flex flex-col px-5 py-8 sm:px-8 lg:px-12">
          {/* Logo · isotipo + wordmark oficial (ver docs/brand.md) */}
          <Link to="/" className="self-start">
            <BrandLogo variant="lockup" iconSize={36} wordmarkHeight={18} />
          </Link>

          <div className="flex-1 flex items-center justify-center py-8">
            <div className="w-full max-w-md">
              <div className="rounded-2xl bg-card border border-border shadow-soft-lg p-6 sm:p-8">
                {/* Error banner global */}
                {error && (
                  <div
                    role="alert"
                    className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* ═════ STEP 1 ═════ */}
                {step === 1 && (
                  <>
                    <header className="mb-6">
                      <h1 className="text-2xl font-semibold tracking-tight">Regístrate como</h1>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Crea tu cuenta y empieza a automatizar tu negocio inmobiliario.
                      </p>
                    </header>

                    {/* Selector de rol · 3 pills grandes verticales */}
                    <div className="space-y-2 mb-5">
                      {roleOptions.map((r) => {
                        const Icon = r.icon;
                        const active = role === r.value;
                        return (
                          <button
                            key={r.value}
                            type="button"
                            onClick={() => setRole(r.value)}
                            className={cn(
                              "w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                              active
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/30",
                            )}
                          >
                            <div
                              className={cn(
                                "h-9 w-9 rounded-lg grid place-items-center shrink-0",
                                active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                              )}
                            >
                              <Icon className="h-4 w-4" strokeWidth={1.5} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium">{r.label}</p>
                              <p className="text-xs text-muted-foreground">{r.sub}</p>
                            </div>
                            {active && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                          </button>
                        );
                      })}
                    </div>

                    {/* Email */}
                    <Field id="reg-email" label="Email profesional" icon={<Mail className="h-4 w-4" />} error={emailError}>
                      <input
                        id="reg-email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="ana@inmobiliaria.com"
                        className={cn(
                          inputClass,
                          emailError && "border-destructive focus:border-destructive focus:ring-destructive/20",
                        )}
                      />
                    </Field>

                    {/* Nombre empresa */}
                    <Field
                      id="reg-company"
                      label={
                        <span className="flex items-center gap-1.5">
                          Nombre comercial de la empresa
                          <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
                        </span>
                      }
                      icon={<Building2 className="h-4 w-4" />}
                    >
                      <input
                        id="reg-company"
                        type="text"
                        autoComplete="organization"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Nombre comercial de tu empresa"
                        className={inputClass}
                      />
                    </Field>

                    {/* CTA */}
                    <button
                      type="button"
                      onClick={handleContinueStep1}
                      disabled={!canContinueStep1}
                      className={cn(primaryBtn, "w-full mt-5")}
                    >
                      Continuar
                    </button>

                    {/* Volver a login */}
                    <div className="mt-4 text-center">
                      <Link to="/login" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                        <ArrowLeft className="h-3 w-3" /> Volver al inicio de sesión
                      </Link>
                    </div>
                  </>
                )}

                {/* ═════ COMPANY-EXISTS ═════ */}
                {step === "company-exists" && matchedCompany && (
                  <>
                    <header className="mb-5 text-center">
                      <h1 className="text-xl font-semibold tracking-tight">Tu empresa ya está registrada</h1>
                    </header>

                    {/* Card empresa */}
                    <div className="rounded-xl bg-muted/40 border border-border px-5 py-5 flex flex-col items-center gap-3 mb-4">
                      <div className="h-14 w-14 rounded-full bg-card border border-border overflow-hidden grid place-items-center">
                        <img
                          src={matchedCompany.logo}
                          alt={matchedCompany.name}
                          className="h-full w-full object-cover"
                          onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                        />
                      </div>
                      <span className="text-sm font-semibold text-foreground">{matchedCompany.name}</span>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed text-center mb-4">
                      Esta empresa ya está en nuestro sistema. Para acceder, envía una solicitud de aprobación al administrador.
                    </p>

                    {/* Email read-only + editar */}
                    <Field id="reg-email-ro" label="Tu email" icon={<Mail className="h-4 w-4" />}>
                      <input
                        id="reg-email-ro"
                        type="email"
                        value={email}
                        disabled
                        className={cn(inputClass, "pr-16 text-muted-foreground")}
                      />
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-primary hover:underline"
                      >
                        Editar
                      </button>
                    </Field>

                    <button
                      type="button"
                      onClick={handleRequestToJoin}
                      className={cn(primaryBtn, "w-full mt-5")}
                    >
                      Solicitar acceso
                    </button>

                    <div className="mt-4 text-center">
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                      >
                        <ArrowLeft className="h-3 w-3" /> Volver atrás
                      </button>
                    </div>
                  </>
                )}

                {/* ═════ STEP 2 ═════ */}
                {step === 2 && (
                  <form onSubmit={handleSubmitStep2} className="space-y-4" noValidate>
                    <header>
                      <h1 className="text-2xl font-semibold tracking-tight">Casi listo</h1>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Completa tus datos para crear la cuenta.
                      </p>
                    </header>

                    {/* Sub-rol */}
                    <div>
                      <p className="text-sm font-medium mb-2">¿Cuál es tu rol en la empresa?</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setSubRole("director")}
                          className={cn(
                            "inline-flex items-center gap-2 h-10 px-4 rounded-full border text-sm font-medium transition-colors",
                            subRole === "director"
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border text-foreground hover:border-primary/30",
                          )}
                        >
                          <Crown className="h-4 w-4" strokeWidth={1.5} />
                          Propietario o director
                        </button>
                        <button
                          type="button"
                          onClick={() => setSubRole("employee")}
                          className={cn(
                            "inline-flex items-center gap-2 h-10 px-4 rounded-full border text-sm font-medium transition-colors",
                            subRole === "employee"
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border text-foreground hover:border-primary/30",
                          )}
                        >
                          <User className="h-4 w-4" strokeWidth={1.5} />
                          Empleado
                        </button>
                      </div>
                    </div>

                    {/* Nombre */}
                    <Field id="reg-name" label="Nombre completo" icon={<User className="h-4 w-4" />}>
                      <input
                        id="reg-name"
                        type="text"
                        autoComplete="name"
                        required
                        disabled={submitting}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ana Gómez"
                        className={inputClass}
                      />
                    </Field>

                    {/* Email read-only + editar */}
                    <Field id="reg-email-step2" label="Email profesional" icon={<Mail className="h-4 w-4" />}>
                      <input
                        id="reg-email-step2"
                        type="email"
                        value={email}
                        disabled
                        className={cn(inputClass, "pr-16 text-muted-foreground")}
                      />
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-primary hover:underline"
                      >
                        Editar
                      </button>
                    </Field>

                    {/* Teléfono */}
                    <Field id="reg-phone" label="Teléfono" icon={<Phone className="h-4 w-4" />}>
                      <input
                        id="reg-phone"
                        type="tel"
                        autoComplete="tel"
                        required
                        disabled={submitting}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+34 600 000 000"
                        className={inputClass}
                      />
                    </Field>

                    {/* Password */}
                    <div className="space-y-1.5">
                      <label htmlFor="reg-password" className="text-sm font-medium">Contraseña</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <input
                          id="reg-password"
                          type={showPwd ? "text" : "password"}
                          autoComplete="new-password"
                          required
                          disabled={submitting}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Mínimo 8 caracteres"
                          className={cn(inputClass, "pl-9 pr-10")}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPwd((v) => !v)}
                          aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                          className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        >
                          {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>

                      {/* Medidor de fuerza */}
                      {password.length > 0 && (
                        <div className="pt-1 space-y-1.5">
                          <div className="flex gap-1">
                            {[0, 1, 2, 3].map((i) => (
                              <span
                                key={i}
                                className={cn(
                                  "h-1 flex-1 rounded-full transition-colors",
                                  i < strength.score
                                    ? strength.score <= 1
                                      ? "bg-destructive"
                                      : strength.score === 2
                                        ? "bg-warning"
                                        : "bg-primary"
                                    : "bg-border"
                                )}
                              />
                            ))}
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1">
                            {strength.hints.map((h) => (
                              <span
                                key={h.text}
                                className={cn(
                                  "text-[11px] inline-flex items-center gap-1",
                                  h.ok ? "text-primary" : "text-muted-foreground",
                                )}
                              >
                                <Check className={cn("h-3 w-3", h.ok ? "opacity-100" : "opacity-30")} />
                                {h.text}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Confirmar password */}
                    <Field
                      id="reg-confirm"
                      label="Confirmar contraseña"
                      icon={<Lock className="h-4 w-4" />}
                      error={confirm.length > 0 && !passwordsMatch ? "Las contraseñas no coinciden" : null}
                    >
                      <input
                        id="reg-confirm"
                        type={showPwd ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        disabled={submitting}
                        value={confirm}
                        onChange={(e) => setConfirm(e.target.value)}
                        placeholder="Repite la contraseña"
                        className={cn(
                          inputClass,
                          confirm.length > 0 && !passwordsMatch &&
                            "border-destructive focus:border-destructive focus:ring-destructive/20",
                        )}
                      />
                    </Field>

                    {/* ToS */}
                    <label className="flex items-start gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={acceptTos}
                        onChange={(e) => setAcceptTos(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-border accent-[hsl(var(--primary))]"
                      />
                      <span className="text-xs text-muted-foreground leading-relaxed">
                        Acepto los{" "}
                        <a href="#" className="text-primary font-medium hover:underline">Términos de uso</a>{" "}
                        y la{" "}
                        <a href="#" className="text-primary font-medium hover:underline">Política de privacidad</a>.
                      </span>
                    </label>

                    {/* CTA */}
                    <button
                      type="submit"
                      disabled={!canSubmitStep2}
                      className={cn(primaryBtn, "w-full")}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Creando cuenta…
                        </>
                      ) : (
                        "Crear cuenta"
                      )}
                    </button>

                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                      >
                        <ArrowLeft className="h-3 w-3" /> Volver al paso 1
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Link cruzado a Login (no aplica en success / company-exists) */}
              {step === 1 && (
                <p className="mt-5 text-center text-sm text-muted-foreground">
                  ¿Ya tienes cuenta?{" "}
                  <Link to="/login" className="font-medium text-primary hover:underline">
                    Inicia sesión
                  </Link>
                </p>
              )}
            </div>
          </div>

          <footer className="pt-4 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} Byvaro · Todo el control de tu operación inmobiliaria en un solo sitio.
          </footer>
        </section>

        {/* ══════ COLUMNA HERO ══════ */}
        <aside
          aria-hidden="true"
          className="hidden lg:flex relative overflow-hidden bg-gradient-to-br from-primary/10 via-muted/30 to-primary/5 items-center justify-center p-12"
        >
          <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />

          <div className="relative max-w-md">
            <span className="inline-flex items-center gap-2 rounded-full bg-card border border-border px-3 py-1 text-xs font-medium shadow-soft">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Empieza en 2 minutos
            </span>
            <h2 className="mt-5 text-3xl font-semibold leading-tight tracking-tight">
              Tu equipo, tus agencias y tus promociones, por fin en un mismo sitio.
            </h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Byvaro sincroniza promoción, disponibilidad y colaboradores. Dejarás de perseguir emails para saber qué unidad está libre.
            </p>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <StatCard value="+40%" label="visitas calificadas" />
              <StatCard value="-60%" label="tiempo en gestión" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   Helpers visuales
   ═════════════════════════════════════════════════════════════════════ */

/**
 * Clase base de input Byvaro: rounded-lg con token border, foco con
 * ring primario sutil. Se compone con `pl-9` cuando hay icono a la izq.
 */
const inputClass = cn(
  "w-full rounded-lg border border-border bg-card h-10 pl-9 pr-3 text-sm",
  "outline-none focus:border-primary focus:ring-1 focus:ring-primary/20",
  "disabled:opacity-60 disabled:cursor-not-allowed",
);

/** CTA primario Byvaro: pill dark (`bg-foreground text-background`). */
const primaryBtn = cn(
  "inline-flex items-center justify-center gap-2 h-10 px-4 rounded-full text-sm font-semibold shadow-soft",
  "bg-foreground text-background hover:opacity-90 transition-opacity",
  "disabled:opacity-50 disabled:cursor-not-allowed",
);

function Field({
  id, label, icon, error, children,
}: {
  id: string;
  label: React.ReactNode;
  icon: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
          {icon}
        </span>
        {children}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-card border border-border p-4 shadow-soft">
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
