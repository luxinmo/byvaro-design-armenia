/**
 * Pantalla · Login (`/login`)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Pantalla pública de autenticación. Permite al usuario iniciar sesión
 * con email + contraseña o con un proveedor OAuth (Google, Microsoft —
 * por ahora solo botones visuales sin lógica).
 *
 * Layout split:
 *   - Columna izquierda (siempre visible): form en tarjeta `bg-card`
 *     de ancho máximo `md` con logo Byvaro arriba.
 *   - Columna derecha (solo `lg+`): hero con gradiente de marca y lema.
 *
 * En móvil solo se ve la columna del form (la derecha queda oculta).
 *
 * Se renderiza fuera de `<AppLayout>` en `App.tsx` (pantalla fullscreen,
 * igual que `/crear-promocion`).
 *
 * Estados implementados:
 *   - idle         → form editable
 *   - loading      → CTA muestra "Entrando…" y deshabilita inputs
 *   - error        → banner rojo arriba del form (errores sincronicos
 *                    de validación o simulados "credenciales inválidas")
 *
 * Submit real está mockeado: tras 600ms navega a `/inicio` con un
 * `toast.success`. Cuando exista backend hay que sustituir el setTimeout
 * por un `POST /api/v1/auth/login` (ver `docs/screens/auth.md`).
 *
 * Props: ninguna. Es una ruta top-level.
 *
 * TODOs:
 *   - TODO(backend): conectar con POST /api/v1/auth/login
 *   - TODO(a11y): añadir `aria-live` al banner de error
 *   - TODO(oauth): implementar Google y Microsoft OAuth con redirección
 */

import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast, Toaster } from "sonner"; // feedback no bloqueante post-submit
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, Building2, Handshake } from "lucide-react"; // iconos inline en inputs y estados
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/BrandLogo"; // isotipo + wordmark oficial (SVG inline)
import { findMockUser, mockUsers, DEMO_PASSWORD, type MockUser } from "@/data/mockUsers";
import { loginAs } from "@/lib/accountType";

/* ═════════════════════════════════════════════════════════════════════
   Validaciones puras (sin zod para evitar acoplamiento pesado aquí).
   La validación "de verdad" se delega al backend; esto es solo UX.
   ═════════════════════════════════════════════════════════════════════ */
function isValidEmail(v: string) {
  // Regex intencionalmente laxa — el backend hará la validación final.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export default function Login() {
  const navigate = useNavigate();

  // Estado del formulario
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPwd, setShowPwd] = useState(false);

  // Estado de envío
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailError = email.length > 0 && !isValidEmail(email)
    ? "Email con formato inválido"
    : null;

  const canSubmit = isValidEmail(email) && password.length >= 6 && !submitting;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isValidEmail(email)) {
      setError("Introduce un email válido.");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setSubmitting(true);
    // TODO(backend): reemplazar este setTimeout + findMockUser por:
    //   await fetch("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password, remember }) })
    await new Promise((r) => setTimeout(r, 500));

    const user = findMockUser(email, password);
    if (!user) {
      setSubmitting(false);
      setError("Email o contraseña incorrectos.");
      return;
    }

    /* Login exitoso — escribimos el accountType en sessionStorage antes de
     * navegar para que la primera renderización de /inicio vea el contexto
     * correcto (vista promotor vs vista agencia). */
    loginAs(user.accountType, user.agencyId);
    setSubmitting(false);

    toast.success(`Bienvenido, ${user.name.split(" ")[0]}`, {
      description: user.label,
    });
    navigate("/inicio", { replace: true });
  }

  /** Quick login desde las cards de demo · rellena inputs y dispara submit. */
  const handleQuickLogin = async (u: MockUser) => {
    setEmail(u.email);
    setPassword(u.password);
    setError(null);
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 300));
    loginAs(u.accountType, u.agencyId);
    setSubmitting(false);
    toast.success(`Bienvenido, ${u.name.split(" ")[0]}`, { description: u.label });
    navigate("/inicio", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Toaster local — la app raíz no lo monta aún en /login */}
      <Toaster position="top-center" richColors closeButton />

      <div className="min-h-screen grid lg:grid-cols-2">
        {/* ══════ COLUMNA FORM ══════ */}
        <section className="flex flex-col px-5 py-8 sm:px-8 lg:px-12">
          {/* Logo · isotipo + wordmark oficial (ver docs/design-system.md) */}
          <Link to="/" className="self-start">
            <BrandLogo variant="lockup" iconSize={36} wordmarkHeight={18} />
          </Link>

          {/* Contenedor centrado */}
          <div className="flex-1 flex items-center justify-center py-10">
            <div className="w-full max-w-md">
              <div className="rounded-2xl bg-card border border-border shadow-soft-lg p-6 sm:p-8">
                <header className="mb-6">
                  <h1 className="text-2xl font-semibold tracking-tight">
                    Inicia sesión
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Accede a tu cuenta para gestionar tus promociones.
                  </p>
                </header>

                {/* Banner de error */}
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
                  {/* Email */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="login-email"
                      className="text-sm font-medium"
                    >
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <input
                        id="login-email"
                        type="email"
                        autoComplete="email"
                        required
                        disabled={submitting}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tu@empresa.com"
                        className={cn(
                          "w-full rounded-lg border border-border bg-card h-10 pl-9 pr-3 text-sm",
                          "outline-none focus:border-primary focus:ring-1 focus:ring-primary/20",
                          "disabled:opacity-60 disabled:cursor-not-allowed",
                          emailError && "border-destructive focus:border-destructive focus:ring-destructive/20",
                        )}
                      />
                    </div>
                    {emailError && (
                      <p className="text-xs text-destructive">{emailError}</p>
                    )}
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="login-password"
                        className="text-sm font-medium"
                      >
                        Contraseña
                      </label>
                      <Link
                        to="/forgot-password"
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Olvidé mi contraseña
                      </Link>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <input
                        id="login-password"
                        type={showPwd ? "text" : "password"}
                        autoComplete="current-password"
                        required
                        disabled={submitting}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className={cn(
                          "w-full rounded-lg border border-border bg-card h-10 pl-9 pr-10 text-sm",
                          "outline-none focus:border-primary focus:ring-1 focus:ring-primary/20",
                          "disabled:opacity-60 disabled:cursor-not-allowed",
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd((v) => !v)}
                        aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        {showPwd ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Recuérdame */}
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="h-4 w-4 rounded border-border accent-[hsl(var(--primary))]"
                    />
                    <span className="text-sm text-muted-foreground">
                      Recuérdame en este dispositivo
                    </span>
                  </label>

                  {/* CTA principal */}
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
                        Entrando…
                      </>
                    ) : (
                      "Iniciar sesión"
                    )}
                  </button>
                </form>

                {/* Separador */}
                <div className="my-6 flex items-center gap-3">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    o continúa con
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>

                {/* OAuth (solo visual) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <OAuthButton
                    provider="Google"
                    onClick={() =>
                      toast("Google OAuth pendiente", {
                        description: "Se conectará cuando exista backend.",
                      })
                    }
                  />
                  <OAuthButton
                    provider="Microsoft"
                    onClick={() =>
                      toast("Microsoft OAuth pendiente", {
                        description: "Se conectará cuando exista backend.",
                      })
                    }
                  />
                </div>
              </div>

              {/* Cuentas de demostración · atajo para entrar sin escribir
                   credenciales. Solo visible en el mock; en producción
                   este bloque desaparece. */}
              <section className="mt-5 rounded-2xl border border-dashed border-border bg-muted/30 p-4">
                <header className="mb-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Cuentas de demo
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Click para entrar. Password:{" "}
                      <code className="font-mono bg-card px-1 py-0.5 rounded border border-border">
                        {DEMO_PASSWORD}
                      </code>
                    </p>
                  </div>
                </header>
                <div className="space-y-1.5">
                  {mockUsers.map((u) => {
                    const Icon = u.accountType === "developer" ? Building2 : Handshake;
                    return (
                      <button
                        key={u.email}
                        type="button"
                        onClick={() => handleQuickLogin(u)}
                        disabled={submitting}
                        className={cn(
                          "w-full flex items-center gap-2.5 rounded-xl border border-border bg-card p-2.5 text-left",
                          "hover:border-foreground/30 hover:shadow-soft transition-all duration-150",
                          "disabled:opacity-50 disabled:cursor-not-allowed",
                        )}
                      >
                        <span
                          className={cn(
                            "h-7 w-7 rounded-full grid place-items-center shrink-0",
                            u.accountType === "developer"
                              ? "bg-foreground/10 text-foreground"
                              : "bg-primary/10 text-primary",
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-foreground truncate">
                            {u.name}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {u.email} · {u.label}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* Link cruzado a Registro */}
              <p className="mt-5 text-center text-sm text-muted-foreground">
                ¿No tienes cuenta?{" "}
                <Link
                  to="/register"
                  className="font-medium text-primary hover:underline"
                >
                  Regístrate gratis
                </Link>
              </p>
            </div>
          </div>

          <footer className="pt-4 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} Byvaro · Diseño para promotores y
            agencias inmobiliarias.
          </footer>
        </section>

        {/* ══════ COLUMNA HERO (solo desktop) ══════ */}
        <aside
          aria-hidden="true"
          className="hidden lg:flex relative overflow-hidden bg-gradient-to-br from-primary/10 via-muted/30 to-primary/5 items-center justify-center p-12"
        >
          {/* Decorativos */}
          <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />

          <div className="relative max-w-md">
            <span className="inline-flex items-center gap-2 rounded-full bg-card border border-border px-3 py-1 text-xs font-medium shadow-soft">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Nueva plataforma Byvaro
            </span>
            <h2 className="mt-5 text-3xl font-semibold leading-tight tracking-tight">
              Convierte tus promociones en operaciones cerradas.
            </h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Un espacio único para promotor y agencia: promociones, registros,
              visitas y ventas sincronizados. Sin hojas de cálculo ni cadenas
              de email.
            </p>

            <ul className="mt-6 space-y-3 text-sm">
              <HeroFeature>Panel de KPIs con insights automáticos.</HeroFeature>
              <HeroFeature>Colaboración real con tu red de agencias.</HeroFeature>
              <HeroFeature>Microsite por promoción en 1 clic.</HeroFeature>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════════
   Subcomponentes privados
   ═════════════════════════════════════════════════════════════════════ */

function OAuthButton({
  provider,
  onClick,
}: {
  provider: "Google" | "Microsoft";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-10 rounded-full px-4 text-sm font-medium",
        "border border-border bg-card hover:bg-muted transition-colors",
        "inline-flex items-center justify-center gap-2",
      )}
    >
      <GlyphFor provider={provider} />
      {provider}
    </button>
  );
}

function GlyphFor({ provider }: { provider: "Google" | "Microsoft" }) {
  // Glyphs minimalistas en SVG — evitamos depender de logos oficiales
  // por ahora (solo diseño). Cuando se implemente OAuth real, sustituir
  // por el SVG oficial de Google / Microsoft.
  if (provider === "Google") {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M21.35 11.1H12v2.8h5.35c-.23 1.45-1.69 4.26-5.35 4.26-3.22 0-5.85-2.66-5.85-5.95S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.77 3.84 14.6 3 12 3 6.96 3 2.88 7.08 2.88 12.12S6.96 21.25 12 21.25c6.93 0 9.12-4.84 9.12-7.35 0-.49-.06-.86-.12-1.16z" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="3" width="8" height="8" fill="currentColor" opacity="0.9" />
      <rect x="13" y="3" width="8" height="8" fill="currentColor" opacity="0.7" />
      <rect x="3" y="13" width="8" height="8" fill="currentColor" opacity="0.7" />
      <rect x="13" y="13" width="8" height="8" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

function HeroFeature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
      <span className="text-foreground/80">{children}</span>
    </li>
  );
}
