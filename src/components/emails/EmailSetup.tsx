/**
 * EmailSetup · Onboarding inicial del módulo Emails.
 *
 * Se muestra cuando el usuario entra en `/emails` sin cuentas conectadas,
 * o desde el AccountSwitcher al añadir una nueva cuenta.
 *
 * Dos pasos:
 *   1. "choose" → elegir provider (Gmail / Microsoft / IMAP)
 *   2. "imap"   → formulario manual IMAP/SMTP (si eligió IMAP)
 *
 * OAuth es simulado en este mock: callback con setTimeout y toast.
 */

import { useState } from "react";
import { Info, Copy, Check, ChevronRight, Server, Shield, ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Provider = "gmail" | "microsoft" | "imap";

interface Props {
  /**
   * Se invoca al terminar el onboarding con la cuenta nueva ya
   * autenticada (mock). El padre la inserta en su lista.
   *
   * @param displayName Nombre visible que el usuario eligió. Cuando
   *  conecta por OAuth no lo pedimos (lo trae el provider) y se
   *  pasa undefined → el wrapper usa un default basado en el email.
   */
  onConfigured: (provider: Provider, email: string, displayName?: string) => void;
  /**
   * Se invoca cuando el usuario cancela el onboarding. Sólo tiene
   * sentido cuando entra desde "Añadir nueva cuenta" con cuentas
   * existentes — si es la primera conexión (accounts === 0), no se
   * pasa y no se renderiza el botón Cancelar.
   */
  onCancel?: () => void;
}

const SYSTEM_EMAIL = "user1234@mail.byvaro.com";
const SYSTEM_NOTICE_HIDDEN_KEY = "byvaro.emailSystemNoticeHidden.v1";

const GoogleLogo = () => (
  <svg viewBox="0 0 48 48" className="h-6 w-6">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 7.9-21l5.7-5.7A20 20 0 1 0 44 24c0-1.2-.1-2.3-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8A12 12 0 0 1 24 12c3 0 5.8 1.2 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3A12 12 0 0 1 12.7 28l-6.6 5.1A20 20 0 0 0 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.5l6.3 5.3C37.2 39.9 44 34 44 24c0-1.2-.1-2.3-.4-3.5z" />
  </svg>
);

const MicrosoftLogo = () => (
  <svg viewBox="0 0 48 48" className="h-6 w-6">
    <path fill="#F25022" d="M6 6h18v18H6z" />
    <path fill="#7FBA00" d="M24 6h18v18H24z" />
    <path fill="#00A4EF" d="M6 24h18v18H6z" />
    <path fill="#FFB900" d="M24 24h18v18H24z" />
  </svg>
);

export default function EmailSetup({ onConfigured, onCancel }: Props) {
  const [step, setStep] = useState<"choose" | "imap">("choose");
  const [copied, setCopied] = useState(false);
  const [systemNoticeHidden, setSystemNoticeHidden] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SYSTEM_NOTICE_HIDDEN_KEY) === "1";
  });

  const dismissSystemNotice = () => {
    setSystemNoticeHidden(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SYSTEM_NOTICE_HIDDEN_KEY, "1");
    }
    toast.success("Email de sistema deshabilitado");
  };

  const [imapForm, setImapForm] = useState({
    name: "",
    email: "",
    password: "",
    imapHost: "",
    imapPort: "993",
    smtpHost: "",
    smtpPort: "587",
  });

  const copySystemEmail = () => {
    navigator.clipboard.writeText(SYSTEM_EMAIL);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleProvider = (p: Provider) => {
    if (p === "imap") {
      setStep("imap");
      return;
    }
    toast.success(`Conectando con ${p === "gmail" ? "Gmail" : "Microsoft"}…`);
    setTimeout(() => {
      onConfigured(p, p === "gmail" ? "tu.email@gmail.com" : "tu.email@outlook.com");
    }, 700);
  };

  const handleImapConnect = () => {
    if (!imapForm.email || !imapForm.password || !imapForm.imapHost || !imapForm.smtpHost) {
      toast.error("Completa todos los campos");
      return;
    }
    toast.success("Conexión IMAP establecida");
    setTimeout(() => onConfigured("imap", imapForm.email, imapForm.name.trim() || undefined), 600);
  };

  return (
    <div className="min-h-full bg-muted/30">
      <div className="max-w-2xl mx-auto px-5 sm:px-8 lg:px-10 pt-8 pb-16">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4 min-h-[28px]">
            {step === "imap" ? (
              <button
                onClick={() => setStep("choose")}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> Proveedores
              </button>
            ) : onCancel ? (
              <button
                onClick={onCancel}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" /> Volver al correo
              </button>
            ) : (
              <span />
            )}
            {onCancel && step === "choose" && (
              <Button variant="ghost" size="sm" onClick={onCancel} className="rounded-full">
                Cancelar
              </Button>
            )}
          </div>
          <h1 className="text-xl font-bold text-foreground">Configura tu correo electrónico</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Conecta tu cuenta para enviar y recibir correos directamente desde Byvaro.
          </p>
        </div>

        {/* System email notice (deshabilitable) */}
        {!systemNoticeHidden && (
          <div className="bg-card border border-border rounded-2xl p-5 mb-6 shadow-soft relative">
            <button
              onClick={dismissSystemNotice}
              title="Deshabilitar email de sistema"
              className="absolute top-3 right-3 h-7 w-7 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-start gap-3 pr-8">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Info className="h-[18px] w-[18px] text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">Email de sistema activo</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Actualmente puedes enviar y recibir correos usando el email de sistema{" "}
                  <button
                    onClick={copySystemEmail}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted hover:bg-muted/70 font-mono text-[11px] font-medium text-foreground transition-colors"
                  >
                    {SYSTEM_EMAIL}
                    {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                  </button>
                  . Cuando configures tu email podrás importar todos los correos enviados y recibidos
                  desde {SYSTEM_EMAIL}.
                </p>
              </div>
            </div>
          </div>
        )}

        {step === "choose" && (
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
              Elige un proveedor
            </p>

            <ProviderCard
              icon={<GoogleLogo />}
              title="Gmail"
              description="Conectar con Google Workspace o cuenta personal de Gmail"
              badge="Recomendado"
              onClick={() => handleProvider("gmail")}
            />
            <ProviderCard
              icon={<MicrosoftLogo />}
              title="Microsoft 365 / Outlook"
              description="Conectar cuenta empresarial de Microsoft o personal de Outlook"
              onClick={() => handleProvider("microsoft")}
            />
            <ProviderCard
              icon={
                <div className="h-6 w-6 rounded-md bg-foreground/90 flex items-center justify-center">
                  <Server className="h-3.5 w-3.5 text-background" />
                </div>
              }
              title="IMAP / SMTP"
              description="Cualquier otro proveedor (iCloud, Yahoo, Zoho, hosting propio…)"
              onClick={() => handleProvider("imap")}
            />

            <div className="flex items-center gap-2 mt-6 px-1">
              <Shield className="h-3.5 w-3.5 text-muted-foreground/70" />
              <p className="text-xs text-muted-foreground">
                Todas las conexiones están cifradas. Nunca compartiremos tus datos.
              </p>
            </div>
          </div>
        )}

        {step === "imap" && (
          <div className="bg-card border border-border rounded-2xl p-6 shadow-soft space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-foreground/90 flex items-center justify-center">
                <Server className="h-5 w-5 text-background" />
              </div>
              <div>
                <h2 className="text-base font-semibold">Configuración IMAP / SMTP</h2>
                <p className="text-xs text-muted-foreground">Introduce los datos de tu proveedor</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nombre visible" className="sm:col-span-2">
                <Input
                  placeholder="Aparecerá como remitente · Ej. Arman Rahmanov"
                  value={imapForm.name}
                  onChange={(e) => setImapForm({ ...imapForm, name: e.target.value })}
                  className="h-9 rounded-full"
                />
              </Field>
              <Field label="Email" className="sm:col-span-2">
                <Input
                  type="email"
                  placeholder="tu@dominio.com"
                  value={imapForm.email}
                  onChange={(e) => setImapForm({ ...imapForm, email: e.target.value })}
                  className="h-9 rounded-full"
                />
              </Field>
              <Field label="Contraseña" className="sm:col-span-2">
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={imapForm.password}
                  onChange={(e) => setImapForm({ ...imapForm, password: e.target.value })}
                  className="h-9 rounded-full"
                />
              </Field>
              <Field label="Servidor IMAP">
                <Input
                  placeholder="imap.dominio.com"
                  value={imapForm.imapHost}
                  onChange={(e) => setImapForm({ ...imapForm, imapHost: e.target.value })}
                  className="h-9 rounded-full"
                />
              </Field>
              <Field label="Puerto IMAP">
                <Input
                  value={imapForm.imapPort}
                  onChange={(e) => setImapForm({ ...imapForm, imapPort: e.target.value })}
                  className="h-9 rounded-full"
                />
              </Field>
              <Field label="Servidor SMTP">
                <Input
                  placeholder="smtp.dominio.com"
                  value={imapForm.smtpHost}
                  onChange={(e) => setImapForm({ ...imapForm, smtpHost: e.target.value })}
                  className="h-9 rounded-full"
                />
              </Field>
              <Field label="Puerto SMTP">
                <Input
                  value={imapForm.smtpPort}
                  onChange={(e) => setImapForm({ ...imapForm, smtpPort: e.target.value })}
                  className="h-9 rounded-full"
                />
              </Field>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setStep("choose")} className="rounded-full">
                Cancelar
              </Button>
              <Button onClick={handleImapConnect} className="rounded-full">
                Conectar cuenta
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProviderCard({
  icon,
  title,
  description,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 bg-card border border-border rounded-2xl p-4 hover:shadow-soft-lg hover:-translate-y-0.5 transition-all duration-200 text-left"
    >
      <div className="h-11 w-11 rounded-xl bg-muted/40 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {badge && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />
    </button>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</Label>
      {children}
    </div>
  );
}
