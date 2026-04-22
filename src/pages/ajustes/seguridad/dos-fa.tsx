/**
 * /ajustes/seguridad/2fa — Verificación en dos pasos.
 *
 * Setup wizard con QR escaneable real y verificación previa antes de
 * activar. Estado persiste en `byvaro.security.2fa.v1`.
 *
 * Flujo de activación:
 *   0. Toggle off → botón "Activar 2FA" abre el wizard.
 *   1. Setup: muestra QR + secret manual. El secret es MOCK (ver
 *      TODO abajo) — en producción lo da el backend.
 *   2. Verify: el usuario escanea el QR, abre su app y mete el código
 *      de 6 dígitos actual. Solo si valida correctamente se activa.
 *   3. Activated: muestra códigos de respaldo (8). El usuario los
 *      copia/descarga ANTES de cerrar.
 *
 * TODO(backend) — endpoints reales:
 *   POST /api/me/2fa/setup     → { secret, otpauthUri }     (genera secret server-side)
 *   POST /api/me/2fa/activate  { code } → 200 ok | 400      (valida y persiste)
 *   POST /api/me/2fa/disable   { code } → 200 ok            (requiere código actual)
 *   POST /api/me/2fa/backup-codes/regenerate → { codes[] }
 *
 * Mientras no haya backend, generamos el secret en cliente y validamos
 * con `mockVerifyTotpCode` (acepta cualquier 6 dígitos). Cuando se
 * conecte, sustituir las llamadas marcadas con TODO.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  Smartphone, Shield, Copy, Check, Download, ArrowLeft,
  AlertCircle, CheckCircle2, RefreshCw,
} from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { SettingsField } from "@/components/settings/fields";
import { Button } from "@/components/ui/button";
import { useDirty } from "@/components/settings/SettingsDirtyContext";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useCurrentUser } from "@/lib/currentUser";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  loadTwoFactorState, saveTwoFactorState, clearTwoFactorState,
  mockVerifyTotpCode, type TwoFactorState,
} from "@/lib/twoFactor";
import { generateMockSecret, formatSecret, buildOtpAuthUri } from "@/lib/totp";

const ISSUER = "Byvaro";
const CODE_LENGTH = 6;

function generateBackupCodes(): string[] {
  const cryptoApi = typeof window !== "undefined" ? window.crypto : undefined;
  return Array.from({ length: 8 }, () => {
    const buf = new Uint8Array(5);
    if (cryptoApi?.getRandomValues) cryptoApi.getRandomValues(buf);
    else for (let i = 0; i < 5; i++) buf[i] = Math.floor(Math.random() * 256);
    const hex = Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
    return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
  });
}

type WizardStep = "setup" | "verify";

export default function AjustesDos2FA() {
  const user = useCurrentUser();
  const confirm = useConfirm();
  const { setDirty } = useDirty();

  const [state, setState] = useState<TwoFactorState>(() => loadTwoFactorState());

  /* ══════ Wizard de activación ══════ */
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>("setup");
  /** Secret generado cuando empieza el wizard. NO se persiste hasta
   * que el usuario verifique correctamente el código. */
  const [pendingSecret, setPendingSecret] = useState<string>("");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [codeError, setCodeError] = useState<string | null>(null);
  const [secretCopied, setSecretCopied] = useState(false);
  const [backupCopied, setBackupCopied] = useState(false);
  const codeInputs = useRef<(HTMLInputElement | null)[]>([]);

  const otpauthUri = useMemo(() => pendingSecret
    ? buildOtpAuthUri({ issuer: ISSUER, account: user.email, secret: pendingSecret })
    : "",
    [pendingSecret, user.email]);

  /* Genera el QR cada vez que cambia el URI. */
  useEffect(() => {
    if (!otpauthUri) { setQrDataUrl(""); return; }
    QRCode.toDataURL(otpauthUri, {
      width: 240,
      margin: 1,
      color: { dark: "#0A0A0A", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
    }).then(setQrDataUrl).catch(() => setQrDataUrl(""));
  }, [otpauthUri]);

  /* ══════ Acciones ══════ */

  const startSetup = () => {
    /* TODO(backend): POST /api/me/2fa/setup
     *   El backend genera el secret server-side con CSPRNG, lo guarda
     *   en estado "pending" y devuelve { secret, otpauthUri } SOLO
     *   esta vez. Aquí lo simulamos en cliente. */
    const newSecret = generateMockSecret(32);
    setPendingSecret(newSecret);
    setWizardStep("setup");
    setCode(Array(CODE_LENGTH).fill(""));
    setCodeError(null);
    setWizardOpen(true);
    setDirty(true);
  };

  const cancelSetup = () => {
    setWizardOpen(false);
    setPendingSecret("");
    setQrDataUrl("");
    setCode(Array(CODE_LENGTH).fill(""));
    setCodeError(null);
    setDirty(false);
  };

  const verifyAndActivate = () => {
    const entered = code.join("");
    if (entered.length !== CODE_LENGTH) {
      setCodeError("Introduce los 6 dígitos del autenticador");
      return;
    }
    /* TODO(backend): POST /api/me/2fa/activate { code }
     *   El backend hace `speakeasy.totp.verify({ secret, token: code, window: 1 })`,
     *   y solo si valida promueve el secret de "pending" a "active",
     *   genera los backup codes, guarda enabledAt y devuelve los codes
     *   al cliente para mostrarlos UNA vez.
     *   Mientras tanto, mockVerifyTotpCode acepta cualquier 6 dígitos. */
    if (!mockVerifyTotpCode(entered)) {
      setCodeError("Código incorrecto · revisa que el reloj de tu teléfono esté sincronizado");
      return;
    }
    const next: TwoFactorState = {
      enabled: true,
      method: "app",
      secret: pendingSecret,
      backupCodes: generateBackupCodes(),
      enabledAt: new Date().toISOString(),
    };
    setState(next);
    saveTwoFactorState(next);
    setWizardOpen(false);
    setPendingSecret("");
    setCode(Array(CODE_LENGTH).fill(""));
    setDirty(false);
    toast.success("Verificación en dos pasos activada", {
      description: "Guarda los códigos de respaldo en un sitio seguro",
    });
  };

  const disable = async () => {
    const ok = await confirm({
      title: "¿Desactivar verificación en dos pasos?",
      description: "Tu cuenta quedará protegida solo por contraseña. En producción se te pedirá un código del autenticador para confirmar este cambio.",
      confirmLabel: "Desactivar 2FA",
      variant: "destructive",
    });
    if (!ok) return;
    /* TODO(backend): POST /api/me/2fa/disable { code }
     *   Por seguridad, debe pedir un código actual del autenticador
     *   antes de desactivar (igual que pedir contraseña actual al
     *   cambiarla). Aquí lo desactivamos directo tras confirm dialog. */
    clearTwoFactorState();
    setState({ enabled: false });
    toast.info("Verificación en dos pasos desactivada");
  };

  const regenerateBackupCodes = async () => {
    const ok = await confirm({
      title: "¿Regenerar códigos de respaldo?",
      description: "Los códigos antiguos dejarán de funcionar inmediatamente. Asegúrate de guardar los nuevos.",
      confirmLabel: "Regenerar",
    });
    if (!ok) return;
    /* TODO(backend): POST /api/me/2fa/backup-codes/regenerate */
    const next = { ...state, backupCodes: generateBackupCodes() };
    setState(next);
    saveTwoFactorState(next);
    toast.success("Nuevos códigos de respaldo generados");
  };

  const copySecret = () => {
    if (!pendingSecret) return;
    navigator.clipboard.writeText(pendingSecret);
    setSecretCopied(true);
    setTimeout(() => setSecretCopied(false), 1500);
  };

  const copyBackup = () => {
    if (!state.backupCodes) return;
    navigator.clipboard.writeText(state.backupCodes.join("\n"));
    setBackupCopied(true);
    setTimeout(() => setBackupCopied(false), 1500);
  };

  const downloadBackup = () => {
    if (!state.backupCodes) return;
    const txt = [
      `Códigos de respaldo · Byvaro 2FA`,
      `Cuenta: ${user.email}`,
      `Generados: ${new Date().toLocaleString("es-ES")}`,
      ``,
      `Cada código se puede usar UNA sola vez. Guárdalos en un sitio seguro.`,
      ``,
      ...state.backupCodes,
    ].join("\n");
    const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "byvaro-2fa-backup-codes.txt"; a.click();
    URL.revokeObjectURL(url);
  };

  /* ══════ Code input handlers ══════ */

  const onCodeChange = (idx: number, raw: string) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    setCodeError(null);
    setCode((prev) => {
      const arr = [...prev]; arr[idx] = digit; return arr;
    });
    if (digit && idx < CODE_LENGTH - 1) codeInputs.current[idx + 1]?.focus();
  };

  const onCodeKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !code[idx] && idx > 0) codeInputs.current[idx - 1]?.focus();
    if (e.key === "ArrowLeft" && idx > 0) codeInputs.current[idx - 1]?.focus();
    if (e.key === "ArrowRight" && idx < CODE_LENGTH - 1) codeInputs.current[idx + 1]?.focus();
    if (e.key === "Enter") verifyAndActivate();
  };

  const onCodePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (!pasted) return;
    const arr = Array(CODE_LENGTH).fill("");
    for (let i = 0; i < pasted.length; i++) arr[i] = pasted[i];
    setCode(arr);
    setCodeError(null);
    codeInputs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
  };

  /* ══════ Render ══════ */

  return (
    <SettingsScreen
      title="Verificación en dos pasos"
      description="Añade una capa extra de seguridad pidiendo un código de tu app de autenticación además de tu contraseña."
    >
      {/* ══════ Estado actual ══════ */}
      <SettingsCard>
        <div className="flex items-start gap-4">
          <div className={cn(
            "h-12 w-12 rounded-2xl grid place-items-center shrink-0",
            state.enabled ? "bg-emerald-500/15 text-emerald-700" : "bg-muted text-muted-foreground",
          )}>
            <Shield className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {state.enabled ? "2FA activado" : "2FA desactivado"}
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {state.enabled
                ? `Método: aplicación autenticadora. Cada acción sensible (cambio de contraseña, cierre de sesiones, eliminación de cuenta) te pedirá un código de 6 dígitos.`
                : "Sin protección extra. Recomendamos activar 2FA cuanto antes — especialmente si gestionas datos de clientes."}
            </p>
            {state.enabled && state.enabledAt && (
              <p className="text-[11px] text-muted-foreground/70 mt-1 tnum">
                Activado el {new Date(state.enabledAt).toLocaleString("es-ES")}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              {state.enabled ? (
                <Button variant="outline" onClick={disable} className="rounded-full" size="sm">
                  Desactivar 2FA
                </Button>
              ) : (
                <Button onClick={startSetup} className="rounded-full" size="sm">
                  <Shield className="h-3.5 w-3.5" /> Activar 2FA
                </Button>
              )}
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* ══════ Wizard de activación ══════ */}
      {wizardOpen && !state.enabled && wizardStep === "setup" && (
        <SettingsCard
          title="1. Escanea el código QR"
          description="Abre Google Authenticator, Authy, 1Password o cualquier app TOTP y escanea este código para vincular tu cuenta."
        >
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row items-center gap-5">
              <div className="bg-white p-3 rounded-2xl border border-border/40 shrink-0">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Código QR para 2FA" className="block" width={200} height={200} />
                ) : (
                  <div className="h-[200px] w-[200px] rounded-xl bg-muted animate-pulse" />
                )}
              </div>
              <div className="flex-1 min-w-0 space-y-3 w-full">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-xl bg-foreground text-background grid place-items-center shrink-0">
                    <Smartphone className="h-4 w-4" />
                  </div>
                  <div className="text-[12.5px] text-muted-foreground leading-relaxed">
                    Tu app generará un código de 6 dígitos que cambia cada 30 segundos. Lo necesitarás para los próximos pasos.
                  </div>
                </div>

                <div>
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">
                    ¿No puedes escanear?
                  </p>
                  <p className="text-[12px] text-muted-foreground mb-2">
                    Introduce este código manualmente en tu app:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-muted/60 border border-border/40 rounded-xl px-3 py-2 font-mono text-[12.5px] text-foreground tracking-wider break-all">
                      {formatSecret(pendingSecret)}
                    </code>
                    <Button onClick={copySecret} variant="outline" size="icon" className="h-9 w-9 rounded-full shrink-0">
                      {secretCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={cancelSetup} className="rounded-full" size="sm">
                <ArrowLeft className="h-3.5 w-3.5" /> Cancelar
              </Button>
              <Button onClick={() => { setWizardStep("verify"); setTimeout(() => codeInputs.current[0]?.focus(), 50); }} className="rounded-full" size="sm">
                Ya he escaneado el QR
              </Button>
            </div>
          </div>
        </SettingsCard>
      )}

      {wizardOpen && !state.enabled && wizardStep === "verify" && (
        <SettingsCard
          title="2. Verifica el código"
          description="Introduce el código de 6 dígitos que muestra tu app de autenticación. Si no validas correctamente, el 2FA no se activará."
        >
          <div className="space-y-5">
            <SettingsField label="Código del autenticador">
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

            <div className="text-[12px] text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Consejo:</strong> el código rota cada 30 segundos. Si te falla, espera al siguiente y vuelve a probar. Asegúrate de que la hora de tu teléfono esté sincronizada automáticamente.
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setWizardStep("setup")} className="rounded-full" size="sm">
                <ArrowLeft className="h-3.5 w-3.5" /> Volver al QR
              </Button>
              <Button onClick={verifyAndActivate} className="rounded-full" size="sm" disabled={code.join("").length !== CODE_LENGTH}>
                <CheckCircle2 className="h-4 w-4" /> Activar 2FA
              </Button>
            </div>
          </div>
        </SettingsCard>
      )}

      {/* ══════ Códigos de respaldo (cuando 2FA activo) ══════ */}
      {state.enabled && state.backupCodes && (
        <SettingsCard
          title="Códigos de respaldo"
          description="Sirven para recuperar el acceso si pierdes el teléfono. Cada código solo se puede usar una vez. Guárdalos en un gestor de contraseñas o impresos en sitio seguro."
          footer={
            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="outline" onClick={regenerateBackupCodes} className="rounded-full" size="sm">
                <RefreshCw className="h-3.5 w-3.5" /> Regenerar
              </Button>
              <Button variant="outline" onClick={copyBackup} className="rounded-full" size="sm">
                {backupCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {backupCopied ? "Copiado" : "Copiar todos"}
              </Button>
              <Button variant="outline" onClick={downloadBackup} className="rounded-full" size="sm">
                <Download className="h-3.5 w-3.5" /> Descargar .txt
              </Button>
            </div>
          }
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {state.backupCodes.map((c) => (
              <code key={c}
                className="bg-muted/50 font-mono text-[12.5px] text-foreground text-center py-2 rounded-lg border border-border/40 tracking-wider">
                {c}
              </code>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 p-3 flex items-start gap-2 text-[12px] text-amber-700 dark:text-amber-300">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>Quedan <strong className="tnum">{state.backupCodes.length}</strong> códigos. Cuando bajen de 3, te pediremos regenerarlos.</p>
          </div>
        </SettingsCard>
      )}
    </SettingsScreen>
  );
}
