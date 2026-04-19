/**
 * Pantalla · Register (`/register`)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Pantalla pública de alta de usuario. Formulario de un solo paso (sin
 * wizard): pide datos personales + empresa (opcional) + contraseña con
 * confirmación + aceptación de términos.
 *
 * A diferencia del registro de la referencia (figgy, que tenía múltiples
 * steps con selección de rol y detección de empresa por dominio), aquí
 * preferimos un único form plano porque:
 *   1. La selección de rol la maneja Onboarding post-registro.
 *   2. La detección de empresa se hará server-side cuando exista backend.
 *   3. Un form simple convierte mejor.
 *
 * Layout split idéntico a `/login` (form a la izq, hero a la der en lg+).
 * Se renderiza fuera de `<AppLayout>` en `App.tsx` (fullscreen, como
 * `/crear-promocion`).
 *
 * Estados:
 *   - idle
 *   - loading      → CTA "Creando cuenta…"
 *   - error        → banner rojo con mensaje (validación local o backend)
 *
 * Submit real está mockeado: tras 700ms navega a `/inicio` con toast.
 * Cuando exista backend, sustituir por `POST /api/v1/auth/register` (ver
 * `docs/screens/auth.md`).
 *
 * Props: ninguna. Es una ruta top-level.
 *
 * TODOs:
 *   - TODO(backend): conectar con POST /api/v1/auth/register
 *   - TODO(backend): flujo de verificación por email (enviar enlace)
 *   - TODO(onboarding): tras crear cuenta redirigir a /onboarding, no a /inicio
 *   - TODO(a11y): aria-live en banner de error
 */

import { useMemo, useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast, Toaster } from "sonner"; // feedback no bloqueante post-submit
import {
  Mail, Lock, User, Building2, Eye, EyeOff, Loader2, AlertCircle, Check,
} from "lucide-react"; // iconos para inputs, toggles de password y feedback
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/BrandLogo"; // isotipo + wordmark oficial (SVG inline)

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

/** Calcula fuerza de contraseña con 4 heurísticas simples. */
function scorePassword(pwd: string): PasswordStrength {
  const hints = [
    { ok: pwd.length >= 8, text: "Al menos 8 caracteres" },
    { ok: /[A-Z]/.test(pwd), text: "Una mayúscula" },
    { ok: /[0-9]/.test(pwd), text: "Un número" },
    { ok: /[^A-Za-z0-9]/.test(pwd), text: "Un símbolo" },
  ];
  const score = hints.filter((h) => h.ok).length as 0 | 1 | 2 | 3 | 4;
  const labels = ["Muy débil", "Débil", "Aceptable", "Buena", "Fuerte"];
  return { score, label: labels[score], hints };
}

export default function Register() {
  const navigate = useNavigate();

  // Campos
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [acceptTos, setAcceptTos] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  // Envío
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derivados
  const strength = useMemo(() => scorePassword(password), [password]);
  const passwordsMatch = confirm.length > 0 && password === confirm;
  const emailError = email.length > 0 && !isValidEmail(email)
    ? "Email con formato inválido"
    : null;

  const canSubmit =
    name.trim().length >= 2 &&
    isValidEmail(email) &&
    password.length >= 8 &&
    password === confirm &&
    acceptTos &&
    !submitting;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (name.trim().length < 2) return setError("Escribe tu nombre completo.");
    if (!isValidEmail(email)) return setError("Introduce un email válido.");
    if (password.length < 8) {
      return setError("La contraseña debe tener al menos 8 caracteres.");
    }
    if (password !== confirm) {
      return setError("Las contraseñas no coinciden.");
    }
    if (!acceptTos) {
      return setError("Debes aceptar los términos para continuar.");
    }

    setSubmitting(true);
    // TODO(backend): reemplazar por:
    //   await fetch("/api/v1/auth/register", { method: "POST", body: JSON.stringify({ name, email, company, password }) })
    await new Promise((r) => setTimeout(r, 700));
    setSubmitting(false);

    toast.success("Cuenta creada", {
      description: "Te hemos enviado un email de verificación.",
    });
    // TODO(onboarding): cuando exista /onboarding, cambiar por navigate("/onboarding")
    navigate("/inicio", { replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster position="top-center" richColors closeButton />

      <div className="min-h-screen grid lg:grid-cols-2">
        {/* ══════ COLUMNA FORM ══════ */}
        <section className="flex flex-col px-5 py-8 sm:px-8 lg:px-12">
          {/* Logo · isotipo + wordmark oficial (ver docs/design-system.md) */}
          <Link to="/" className="self-start">
            <BrandLogo variant="lockup" iconSize={36} wordmarkHeight={18} />
          </Link>

          <div className="flex-1 flex items-center justify-center py-10">
            <div className="w-full max-w-md">
              <div className="rounded-2xl bg-card border border-border shadow-soft-lg p-6 sm:p-8">
                <header className="mb-6">
                  <h1 className="text-2xl font-semibold tracking-tight">
                    Crea tu cuenta
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Empieza gratis. Sin tarjeta, sin compromiso.
                  </p>
                </header>

                {error && (
                  <div
                    role="alert"
                    className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  >
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  {/* Nombre */}
                  <Field
                    id="reg-name"
                    label="Nombre completo"
                    icon={<User className="h-4 w-4" />}
                  >
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

                  {/* Email */}
                  <Field
                    id="reg-email"
                    label="Email de trabajo"
                    icon={<Mail className="h-4 w-4" />}
                    error={emailError}
                  >
                    <input
                      id="reg-email"
                      type="email"
                      autoComplete="email"
                      required
                      disabled={submitting}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ana@inmobiliaria.com"
                      className={cn(
                        inputClass,
                        emailError && "border-destructive focus:border-destructive focus:ring-destructive/20",
                      )}
                    />
                  </Field>

                  {/* Empresa (opcional) */}
                  <Field
                    id="reg-company"
                    label={
                      <span className="flex items-center gap-1.5">
                        Empresa
                        <span className="text-xs font-normal text-muted-foreground">
                          (opcional)
                        </span>
                      </span>
                    }
                    icon={<Building2 className="h-4 w-4" />}
                  >
                    <input
                      id="reg-company"
                      type="text"
                      autoComplete="organization"
                      disabled={submitting}
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="Ej. Luxinmo Real Estate"
                      className={inputClass}
                    />
                  </Field>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <label htmlFor="reg-password" className="text-sm font-medium">
                      Contraseña
                    </label>
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

                    {/* Meter */}
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
                                      ? "bg-amber-500"
                                      : strength.score === 3
                                        ? "bg-primary"
                                        : "bg-emerald-500"
                                  : "bg-border",
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
                                h.ok ? "text-emerald-600" : "text-muted-foreground",
                              )}
                            >
                              <Check
                                className={cn(
                                  "h-3 w-3",
                                  h.ok ? "opacity-100" : "opacity-30",
                                )}
                              />
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
                    error={
                      confirm.length > 0 && !passwordsMatch
                        ? "Las contraseñas no coinciden"
                        : null
                    }
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
                      <a href="#" className="text-primary font-medium hover:underline">
                        Términos de uso
                      </a>{" "}
                      y la{" "}
                      <a href="#" className="text-primary font-medium hover:underline">
                        Política de privacidad
                      </a>
                      .
                    </span>
                  </label>

                  {/* CTA */}
                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className={cn(
                      "w-full h-10 rounded-full px-4 text-sm font-semibold shadow-soft",
                      "bg-foreground text-background hover:opacity-90 transition-opacity",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      "inline-flex items-center justify-center gap-2",
                    )}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creando cuenta…
                      </>
                    ) : (
                      "Crear cuenta gratis"
                    )}
                  </button>
                </form>
              </div>

              {/* Link cruzado a Login */}
              <p className="mt-5 text-center text-sm text-muted-foreground">
                ¿Ya tienes cuenta?{" "}
                <Link
                  to="/login"
                  className="font-medium text-primary hover:underline"
                >
                  Inicia sesión
                </Link>
              </p>
            </div>
          </div>

          <footer className="pt-4 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} Byvaro · Todo el control de tu
            operación inmobiliaria en un solo sitio.
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
              Tu equipo, tus agencias y tus promociones, por fin en un mismo
              sitio.
            </h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Byvaro sincroniza promoción, disponibilidad y colaboradores.
              Dejarás de perseguir emails para saber qué unidad está libre.
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

const inputClass = cn(
  "w-full rounded-lg border border-border bg-card h-10 pl-9 pr-3 text-sm",
  "outline-none focus:border-primary focus:ring-1 focus:ring-primary/20",
  "disabled:opacity-60 disabled:cursor-not-allowed",
);

function Field({
  id,
  label,
  icon,
  error,
  children,
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
