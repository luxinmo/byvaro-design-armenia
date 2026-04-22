/**
 * /ajustes/seguridad/contrasena — Cambio de contraseña con verificación
 * en dos factores adaptativa.
 *
 * Flujo en 2 pasos:
 *   1. Form: contraseña actual + nueva + confirmación. Validación de
 *      fortaleza en vivo.
 *   2. Verificación · DOS MÉTODOS según el estado del 2FA del usuario:
 *      a) 2FA activo (authenticator app) → no enviamos email; el
 *         usuario abre su app (Google Authenticator, Authy, 1Password…)
 *         e introduce el código TOTP de 6 dígitos. Más rápido y más
 *         seguro: no depende del email ni del proveedor SMTP.
 *      b) 2FA inactivo → generamos código de 6 dígitos, lo persistimos
 *         con expiración de 10 min, mostramos preview del email
 *         simulado y validamos contra él.
 *
 * Backend real (TODO):
 *   POST /api/me/change-password/request  { currentPassword, newPassword }
 *     → 200 { codeId, method: "totp" | "email" }
 *     → 401 wrong-current
 *   POST /api/me/change-password/verify   { codeId, code }
 *     → 200 ok
 *     → 400 invalid-code | expired | too-many-attempts
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Eye, EyeOff, Check, X, ShieldCheck, Mail, ArrowLeft,
  CheckCircle2, AlertCircle, RotateCw,
} from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { SettingsField } from "@/components/settings/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDirty } from "@/components/settings/SettingsDirtyContext";
import { useCurrentUser } from "@/lib/currentUser";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { renderPasswordChangeCode } from "@/lib/email-templates/passwordChangeCode";
import { EmailPreviewDialog } from "@/components/security/EmailPreviewDialog";
import { isTwoFactorEnabled, mockVerifyTotpCode } from "@/lib/twoFactor";
import { Smartphone } from "lucide-react";

const PENDING_KEY = "byvaro.security.passwordChange.pending.v1";
const TTL_MINUTES = 10;
const RESEND_COOLDOWN_SEC = 30;
const CODE_LENGTH = 6;

type PendingChange = {
  code: string;
  email: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
};

interface PasswordCheck { label: string; ok: boolean }

function checkPassword(p: string): PasswordCheck[] {
  return [
    { label: "Al menos 8 caracteres", ok: p.length >= 8 },
    { label: "Una mayúscula", ok: /[A-Z]/.test(p) },
    { label: "Una minúscula", ok: /[a-z]/.test(p) },
    { label: "Un número", ok: /\d/.test(p) },
    { label: "Un símbolo (!@#$%…)", ok: /[^A-Za-z0-9]/.test(p) },
  ];
}

function generateCode(): string {
  // 6 dígitos, sin ceros a la izquierda raros (entre 100000 y 999999)
  return String(Math.floor(100000 + Math.random() * 900000));
}

function loadPending(): PendingChange | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingChange;
    if (Date.now() > parsed.expiresAt) {
      window.localStorage.removeItem(PENDING_KEY);
      return null;
    }
    return parsed;
  } catch { return null; }
}

function savePending(p: PendingChange) {
  window.localStorage.setItem(PENDING_KEY, JSON.stringify(p));
}

function clearPending() {
  window.localStorage.removeItem(PENDING_KEY);
}

type Step = "form" | "verify" | "done";

export default function AjustesContrasena() {
  const user = useCurrentUser();
  const { setDirty } = useDirty();

  /* ══════ Step 1 — Form ══════ */
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);

  const checks = checkPassword(next);
  const allOk = checks.every((c) => c.ok);
  const matches = next.length > 0 && next === confirm;
  const canRequest = current.length > 0 && allOk && matches;

  /* ══════ Step 2 — Verify ══════ */
  const [step, setStep] = useState<Step>("form");
  /** Método con el que verificamos la 2ª factor de este intento.
   *  Se decide en el momento de pulsar "Continuar" leyendo el estado
   *  del 2FA del usuario — así si activa el 2FA en otra pestaña
   *  durante el flujo, el siguiente intento ya lo respeta. */
  const [verificationMethod, setVerificationMethod] = useState<"totp" | "email">("email");
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [codeError, setCodeError] = useState<string | null>(null);
  const [totpAttempts, setTotpAttempts] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const codeInputs = useRef<(HTMLInputElement | null)[]>([]);

  /** ¿Tiene 2FA activado AHORA mismo? Lo recalculamos en cada render
   * porque el usuario puede activarlo en otra pestaña (settings). */
  const twoFactorActive = useMemo(() => isTwoFactorEnabled(), [step]);

  /* ══════ Email preview dialog ══════ */
  const [previewOpen, setPreviewOpen] = useState(false);
  const renderedEmail = useMemo(
    () => pending ? renderPasswordChangeCode({
      userName: user.name.split(" ")[0],
      userEmail: pending.email,
      code: pending.code,
      ttlMinutes: TTL_MINUTES,
      requestContext: {
        ip: "192.168.1.45",
        location: "Madrid, España",
        userAgent: navigator.userAgent.split(" ").slice(-2).join(" "),
      },
    }) : null,
    [pending, user.name],
  );

  /* ══════ Cooldown ticker ══════ */
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  /* ══════ Recuperar pending email-flow al montar ══════
   * Solo aplica al flujo de email — el TOTP no persiste estado entre
   * recargas (siempre puedes pedir un código nuevo en tu app). */
  useEffect(() => {
    const p = loadPending();
    if (p) {
      setPending(p);
      setVerificationMethod("email");
      setStep("verify");
    }
  }, []);

  /* ══════ Dirty state ══════ */
  const isDirty = current.length > 0 || next.length > 0 || confirm.length > 0 || step !== "form";
  useEffect(() => { setDirty(isDirty); }, [isDirty, setDirty]);

  /* ══════ Handlers ══════ */

  const requestCode = () => {
    if (!canRequest) return;
    /* TODO(backend): POST /api/me/change-password/request
     *   { currentPassword: current, newPassword: next }
     *   → respuesta indica method: "totp" | "email"
     *   Aquí lo decidimos en cliente leyendo el storage del 2FA. */
    setCode(Array(CODE_LENGTH).fill(""));
    setCodeError(null);
    setTotpAttempts(0);

    if (twoFactorActive) {
      // Sin email — el usuario abre su app authenticator.
      setVerificationMethod("totp");
      setPending(null);
      setStep("verify");
      // Foco al primer input.
      setTimeout(() => codeInputs.current[0]?.focus(), 50);
      toast.info("Abre tu app de autenticación e introduce el código");
      return;
    }

    // Flujo email: generar y "enviar" código.
    const newCode = generateCode();
    const now = Date.now();
    const p: PendingChange = {
      code: newCode,
      email: user.email,
      createdAt: now,
      expiresAt: now + TTL_MINUTES * 60 * 1000,
      attempts: 0,
    };
    savePending(p);
    setPending(p);
    setVerificationMethod("email");
    setStep("verify");
    setResendCooldown(RESEND_COOLDOWN_SEC);
    setPreviewOpen(true);
    toast.success("Código enviado a tu email", {
      description: `Revisa ${user.email}`,
    });
  };

  const resendCode = () => {
    if (resendCooldown > 0 || !pending) return;
    const newCode = generateCode();
    const now = Date.now();
    const p: PendingChange = {
      ...pending,
      code: newCode,
      createdAt: now,
      expiresAt: now + TTL_MINUTES * 60 * 1000,
      attempts: 0,
    };
    savePending(p);
    setPending(p);
    setCode(Array(CODE_LENGTH).fill(""));
    setCodeError(null);
    setResendCooldown(RESEND_COOLDOWN_SEC);
    setPreviewOpen(true);
    toast.success("Nuevo código enviado");
  };

  const cancelChange = () => {
    clearPending();
    setPending(null);
    setStep("form");
    setCode(Array(CODE_LENGTH).fill(""));
    setCodeError(null);
    setTotpAttempts(0);
  };

  const onCodeChange = (idx: number, raw: string) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    setCodeError(null);
    setCode((prev) => {
      const arr = [...prev];
      arr[idx] = digit;
      return arr;
    });
    if (digit && idx < CODE_LENGTH - 1) {
      codeInputs.current[idx + 1]?.focus();
    }
  };

  const onCodeKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[idx] && idx > 0) {
      codeInputs.current[idx - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && idx > 0) codeInputs.current[idx - 1]?.focus();
    if (e.key === "ArrowRight" && idx < CODE_LENGTH - 1) codeInputs.current[idx + 1]?.focus();
  };

  const onCodePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;
    const arr = Array(CODE_LENGTH).fill("");
    for (let i = 0; i < pasted.length; i++) arr[i] = pasted[i];
    setCode(arr);
    setCodeError(null);
    const nextIdx = Math.min(pasted.length, CODE_LENGTH - 1);
    codeInputs.current[nextIdx]?.focus();
  };

  const verifyCode = () => {
    const entered = code.join("");
    if (entered.length !== CODE_LENGTH) {
      setCodeError("Introduce los 6 dígitos");
      return;
    }

    /* ── Verificación con app authenticator (TOTP) ── */
    if (verificationMethod === "totp") {
      if (!mockVerifyTotpCode(entered)) {
        const next = totpAttempts + 1;
        setTotpAttempts(next);
        if (next >= 5) {
          setStep("form");
          setTotpAttempts(0);
          toast.error("Demasiados intentos · vuelve a empezar");
          return;
        }
        setCodeError(`Código incorrecto · ${5 - next} intentos restantes`);
        return;
      }
    } else {
      /* ── Verificación con email ── */
      if (!pending) return;
      if (Date.now() > pending.expiresAt) {
        setCodeError("El código ha caducado · pulsa 'Reenviar'");
        return;
      }
      if (entered !== pending.code) {
        const newAttempts = pending.attempts + 1;
        const updated = { ...pending, attempts: newAttempts };
        savePending(updated);
        setPending(updated);
        if (newAttempts >= 5) {
          clearPending();
          setPending(null);
          setStep("form");
          toast.error("Demasiados intentos · vuelve a empezar");
          return;
        }
        setCodeError(`Código incorrecto · ${5 - newAttempts} intentos restantes`);
        return;
      }
    }

    /* TODO(backend): POST /api/me/change-password/verify { codeId, code } */
    clearPending();
    setPending(null);
    setStep("done");
    setCurrent(""); setNext(""); setConfirm("");
    setDirty(false);
    toast.success("Contraseña actualizada", {
      description: "Cierra sesión en otros dispositivos por seguridad",
    });
  };

  /* ══════ Tiempo restante de validez (solo flujo email) ══════ */
  const [timeLeft, setTimeLeft] = useState<string>("");
  useEffect(() => {
    if (verificationMethod !== "email" || !pending) return;
    const tick = () => {
      const ms = Math.max(0, pending.expiresAt - Date.now());
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setTimeLeft(`${m}:${String(s).padStart(2, "0")}`);
      if (ms === 0) {
        setCodeError("El código ha caducado · pulsa 'Reenviar'");
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [pending, verificationMethod]);

  return (
    <SettingsScreen
      title="Contraseña"
      description="Cambia tu contraseña con regularidad y nunca la reutilices entre servicios."
    >
      {/* ══════ STEP 1 — Form ══════ */}
      {step === "form" && (
        <SettingsCard
          title="Cambiar contraseña"
          description={twoFactorActive
            ? "Tras introducir la nueva contraseña, confirmarás el cambio con el código de tu app de autenticación."
            : "Tras introducir la nueva contraseña, te enviaremos un código de verificación a tu email para confirmar el cambio."}
        >
          <div className="space-y-4">
            <SettingsField label="Contraseña actual">
              <div className="relative">
                <Input
                  type={showCurrent ? "text" : "password"}
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowCurrent((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </SettingsField>

            <SettingsField label="Nueva contraseña">
              <div className="relative">
                <Input
                  type={showNext ? "text" : "password"}
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  className="pr-10"
                  autoComplete="new-password"
                />
                <button type="button" onClick={() => setShowNext((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showNext ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </SettingsField>

            <SettingsField label="Confirmar nueva contraseña">
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repite la nueva contraseña"
                autoComplete="new-password"
              />
              {confirm.length > 0 && !matches && (
                <p className="text-[11.5px] text-destructive mt-1">Las contraseñas no coinciden</p>
              )}
            </SettingsField>

            {next.length > 0 && (
              <div className="rounded-xl bg-muted/30 border border-border/40 p-3.5">
                <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                  Requisitos de seguridad
                </p>
                <ul className="space-y-1">
                  {checks.map((c) => (
                    <li key={c.label} className="flex items-center gap-2 text-[12.5px]">
                      {c.ok
                        ? <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={3} />
                        : <X className="h-3.5 w-3.5 text-muted-foreground/50" />}
                      <span className={cn(c.ok ? "text-foreground" : "text-muted-foreground")}>
                        {c.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-xl bg-muted/30 border border-border/40 p-3.5 flex items-start gap-3">
              {twoFactorActive ? (
                <Smartphone className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <Mail className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              )}
              <div className="text-[12.5px] text-muted-foreground leading-relaxed">
                {twoFactorActive ? (
                  <>
                    <span className="text-foreground font-semibold">2FA activo · </span>
                    Confirmarás con el código de 6 dígitos de tu app de autenticación. No enviaremos email.
                  </>
                ) : (
                  <>
                    Te enviaremos un código de 6 dígitos a <strong className="text-foreground">{user.email}</strong> para confirmar este cambio.{" "}
                    <a href="/ajustes/seguridad/2fa" className="text-foreground underline underline-offset-2">Activa 2FA</a> para verificar más rápido.
                  </>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button onClick={requestCode} disabled={!canRequest} className="rounded-full">
                {twoFactorActive ? <Smartphone className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                {twoFactorActive ? "Continuar con 2FA" : "Enviar código de verificación"}
              </Button>
            </div>
          </div>
        </SettingsCard>
      )}

      {/* ══════ STEP 2 — Verify ══════ */}
      {step === "verify" && (
        <SettingsCard
          title="Verifica tu identidad"
          description={verificationMethod === "totp"
            ? "Abre tu app de autenticación e introduce el código de 6 dígitos que muestra para Byvaro."
            : `Hemos enviado un código de 6 dígitos a ${pending?.email ?? user.email}.`}
        >
          <div className="space-y-5">
            {/* Banner según método */}
            {verificationMethod === "totp" ? (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 flex items-start gap-3">
                <Smartphone className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-[13px] text-foreground leading-relaxed">
                  <p><strong>Verificación con autenticador.</strong></p>
                  <p className="text-muted-foreground mt-0.5">
                    Abre Google Authenticator, Authy, 1Password o similar. El código rota cada 30 segundos. También puedes usar uno de tus códigos de respaldo.
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 flex items-start gap-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-[13px] text-foreground leading-relaxed">
                  <p><strong>Código enviado correctamente.</strong></p>
                  <p className="text-muted-foreground mt-0.5">Llega en menos de un minuto. Revisa también la carpeta de spam.</p>
                </div>
              </div>
            )}

            <SettingsField label={
              verificationMethod === "totp"
                ? "Código del autenticador (6 dígitos)"
                : "Código de verificación (6 dígitos)"
            }>
              <div className="flex items-center gap-2 sm:gap-3">
                {code.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { codeInputs.current[i] = el; }}
                    inputMode="numeric"
                    pattern="\d*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => onCodeChange(i, e.target.value)}
                    onKeyDown={(e) => onCodeKeyDown(i, e)}
                    onPaste={onCodePaste}
                    autoFocus={i === 0}
                    className={cn(
                      "h-12 w-10 sm:w-12 text-center text-lg font-bold tabular-nums",
                      "rounded-xl border bg-card outline-none transition-colors",
                      codeError ? "border-destructive focus:border-destructive" :
                      "border-border focus:border-foreground",
                    )}
                  />
                ))}
              </div>
              {codeError && (
                <div className="flex items-center gap-1.5 mt-2 text-[12px] text-destructive">
                  <AlertCircle className="h-3.5 w-3.5" /> {codeError}
                </div>
              )}
            </SettingsField>

            {/* Acciones meta — solo en flujo email */}
            {verificationMethod === "email" && pending && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-muted-foreground">
                <span>Caduca en <strong className="text-foreground tnum">{timeLeft}</strong></span>
                <span className="text-border">·</span>
                <button
                  onClick={resendCode}
                  disabled={resendCooldown > 0}
                  className={cn(
                    "inline-flex items-center gap-1 transition-colors",
                    resendCooldown > 0 ? "text-muted-foreground/50 cursor-not-allowed" :
                    "text-foreground hover:underline",
                  )}
                >
                  <RotateCw className="h-3 w-3" />
                  {resendCooldown > 0 ? `Reenviar en ${resendCooldown}s` : "Reenviar código"}
                </button>
                <span className="text-border">·</span>
                <button onClick={() => setPreviewOpen(true)} className="text-foreground hover:underline">
                  Ver email enviado
                </button>
              </div>
            )}

            {/* Footer TOTP — atajo a la pantalla 2FA */}
            {verificationMethod === "totp" && (
              <div className="text-[12px] text-muted-foreground">
                ¿Has perdido el acceso a tu app? <a href="/ajustes/seguridad/2fa" className="text-foreground underline underline-offset-2">Gestionar 2FA y códigos de respaldo</a>.
              </div>
            )}

            <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
              <Button onClick={cancelChange} variant="ghost" className="rounded-full" size="sm">
                <ArrowLeft className="h-3.5 w-3.5" /> Cancelar
              </Button>
              <Button onClick={verifyCode} className="rounded-full" disabled={code.join("").length !== CODE_LENGTH}>
                <ShieldCheck className="h-4 w-4" /> Confirmar cambio
              </Button>
            </div>
          </div>
        </SettingsCard>
      )}

      {/* ══════ STEP 3 — Done ══════ */}
      {step === "done" && (
        <SettingsCard>
          <div className="text-center py-8">
            <div className="h-14 w-14 mx-auto rounded-2xl bg-emerald-500/15 grid place-items-center mb-4">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
            <p className="text-base font-semibold text-foreground">Contraseña actualizada</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Tu nueva contraseña ya está activa. Por seguridad, te recomendamos cerrar sesión en el resto de tus dispositivos.
            </p>
            <div className="flex items-center justify-center gap-2 mt-5">
              <Button onClick={() => setStep("form")} variant="outline" className="rounded-full" size="sm">
                Cambiar de nuevo
              </Button>
              <Button asChild className="rounded-full" size="sm">
                <a href="/ajustes/seguridad/sesiones">Cerrar otras sesiones</a>
              </Button>
            </div>
          </div>
        </SettingsCard>
      )}

      {/* Preview del email simulado · solo si el método es email */}
      {verificationMethod === "email" && renderedEmail && pending && (
        <EmailPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          to={pending.email}
          email={renderedEmail}
        />
      )}
    </SettingsScreen>
  );
}
