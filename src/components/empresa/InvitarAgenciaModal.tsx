/**
 * InvitarAgenciaModal · wizard de 3 pasos para enviar una invitación
 * a una agencia colaboradora.
 *
 * Paso 1 · Datos de la agencia (email + nombre opcional + mensaje)
 * Paso 2 · Condiciones (comisión ofrecida + idioma del email)
 * Paso 3 · Preview del email + enlace + acciones (Copiar · Enviar)
 */

import { useState } from "react";
import {
  X, Mail, Percent, Globe, Copy, Check, ArrowLeft, ArrowRight,
  Send, Building2, MessageSquare, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  useInvitaciones, getEmailPreview, buildInvitacionUrl, type Invitacion,
} from "@/lib/invitaciones";
import { useEmpresa } from "@/lib/empresa";
import { cn } from "@/lib/utils";
import { Flag } from "@/components/ui/Flag";
import { useUsageGuard } from "@/lib/usageGuard";

type Step = "datos" | "condiciones" | "preview";

const inputClass = "h-10 w-full px-3 text-[13.5px] bg-card border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/60";
const textareaClass = cn(inputClass, "h-auto py-2.5 resize-y min-h-[100px]");

/* Idiomas soportados por el backend de email · `code` debe encajar
 * con `Invitacion["idiomaEmail"]`. La bandera se renderiza con <Flag>. */
const IDIOMAS = [
  { code: "es", label: "Español",   countryIso: "ES" },
  { code: "en", label: "English",   countryIso: "GB" },
  { code: "fr", label: "Français",  countryIso: "FR" },
  { code: "de", label: "Deutsch",   countryIso: "DE" },
  { code: "pt", label: "Português", countryIso: "PT" },
  { code: "it", label: "Italiano",  countryIso: "IT" },
] as const;

export function InvitarAgenciaModal({ onClose }: { onClose: () => void }) {
  const { empresa } = useEmpresa();
  const { invitar } = useInvitaciones();
  /* Paywall · Fase 1 · 5 invitaciones en trial. */
  const inviteGuard = useUsageGuard("inviteAgency");

  const [step, setStep] = useState<Step>("datos");
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [comision, setComision] = useState(empresa.comisionNacionalDefault ?? 3);
  const [idioma, setIdioma] = useState<Invitacion["idiomaEmail"]>("es");
  const [creada, setCreada] = useState<Invitacion | null>(null);
  const [copied, setCopied] = useState(false);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const next = () => {
    if (step === "datos") setStep("condiciones");
    else if (step === "condiciones") {
      /* Paywall guard · si trial llegó al tope (5), abrimos modal y
       *  cerramos este sin enviar. TODO(backend): el endpoint
       *  POST /api/agencies/invite devolverá 402 con `{trigger,used,limit}`. */
      if (inviteGuard.blocked) {
        inviteGuard.openUpgrade();
        onClose();
        return;
      }
      const inv = invitar({
        emailAgencia: email,
        nombreAgencia: nombre,
        mensajePersonalizado: mensaje,
        comisionOfrecida: comision,
        idiomaEmail: idioma,
      });
      setCreada(inv);
      setStep("preview");
    }
  };
  const back = () => {
    if (step === "condiciones") setStep("datos");
    else if (step === "preview") setStep("condiciones");
  };

  const handleCopyLink = async () => {
    if (!creada) return;
    try {
      await navigator.clipboard.writeText(buildInvitacionUrl(creada.token));
      setCopied(true);
      toast.success("Enlace copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const handleSend = () => {
    // Mock: en v1 localStorage. En v2 se llama al backend que envía email via Resend.
    toast.success("Invitación registrada", {
      description: `${nombre || email} recibirá el email en breve.`,
    });
    onClose();
  };

  const stepIdx = step === "datos" ? 0 : step === "condiciones" ? 1 : 2;
  const canContinue =
    step === "datos" ? emailOk :
    step === "condiciones" ? comision >= 0 && comision <= 100 :
    true;

  const preview = creada
    ? getEmailPreview(creada, empresa.nombreComercial || "Tu empresa")
    : getEmailPreview({
        emailAgencia: email || "agencia@example.com",
        nombreAgencia: nombre,
        mensajePersonalizado: mensaje,
        comisionOfrecida: comision,
        idiomaEmail: idioma,
        token: "preview",
      }, empresa.nombreComercial || "Tu empresa");

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-card rounded-2xl border border-border shadow-lg w-full max-w-[640px] max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ═════ Header ═════ */}
        <header className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
              <Mail className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[15px] font-bold tracking-tight truncate">Invitar agencia a colaborar</h2>
              <p className="text-[11.5px] text-muted-foreground truncate">
                Paso {stepIdx + 1} de 3 · {step === "datos" ? "Datos de la agencia" : step === "condiciones" ? "Condiciones" : "Vista previa y envío"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 -mr-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* ═════ Progress ═════ */}
        <div className="px-6 py-3 border-b border-border flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i <= stepIdx ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>

        {/* ═════ Body ═════ */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === "datos" && (
            <div className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[11.5px] font-medium text-foreground flex items-center gap-1">
                  Email de la agencia<span className="text-primary">*</span>
                </span>
                <input
                  autoFocus
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contacto@tuagencia.com"
                  className={inputClass}
                />
                {email && !emailOk && (
                  <span className="text-[11px] text-destructive">Formato de email inválido</span>
                )}
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11.5px] font-medium text-foreground flex items-center gap-1">
                  Nombre de la agencia <span className="text-muted-foreground font-normal">(opcional)</span>
                </span>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                  <input
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Ej. Costa Invest Homes"
                    className={cn(inputClass, "pl-9")}
                  />
                </div>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11.5px] font-medium text-foreground flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  Mensaje personalizado <span className="text-muted-foreground font-normal">(opcional)</span>
                </span>
                <textarea
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  placeholder="Hola, nos encantaría colaborar con vosotros en nuestras promociones de la Costa del Sol..."
                  className={textareaClass}
                  maxLength={500}
                />
                <span className="text-[10px] text-muted-foreground self-end tnum">{mensaje.length}/500</span>
              </label>
            </div>
          )}

          {step === "condiciones" && (
            <div className="flex flex-col gap-5">
              <div>
                <label className="text-[11.5px] font-medium text-foreground flex items-center gap-1 mb-1.5">
                  <Percent className="h-3 w-3" />
                  Comisión ofrecida (%)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={15}
                    step={0.5}
                    value={comision}
                    onChange={(e) => setComision(Number(e.target.value))}
                    className="flex-1 h-1.5 rounded-full bg-muted accent-primary"
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={comision}
                    onChange={(e) => setComision(Number(e.target.value))}
                    className={cn(inputClass, "w-20 tnum text-center")}
                  />
                  <span className="text-[16px] font-bold text-primary tnum">%</span>
                </div>
                <p className="text-[10.5px] text-muted-foreground mt-2">
                  Tu comisión por defecto es <strong>{empresa.comisionNacionalDefault}%</strong> nacional y <strong>{empresa.comisionInternacionalDefault}%</strong> internacional. Puedes ajustarla por agencia.
                </p>
              </div>

              <div>
                <label className="text-[11.5px] font-medium text-foreground flex items-center gap-1 mb-2">
                  <Globe className="h-3 w-3" />
                  Idioma del email
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {IDIOMAS.map((i) => {
                    const on = idioma === i.code;
                    return (
                      <button
                        key={i.code}
                        type="button"
                        onClick={() => setIdioma(i.code)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
                          on
                            ? "bg-primary/10 text-primary border-primary/30"
                            : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                        )}
                      >
                        <Flag iso={i.countryIso} size={14} />
                        {i.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl bg-muted/40 border border-border p-3 flex items-start gap-2.5">
                <Sparkles className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <p className="text-[11.5px] text-muted-foreground leading-relaxed">
                  La agencia recibirá un email con el enlace de aceptación. El enlace caduca en <strong>30 días</strong>.
                  Podrás revocar, reenviar o eliminar la invitación en cualquier momento.
                </p>
              </div>
            </div>
          )}

          {step === "preview" && (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl bg-success/5 border border-success/30 p-3 flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-success/15 text-success dark:text-success shrink-0">
                  <Check className="h-4 w-4" strokeWidth={3} />
                </div>
                <p className="text-[12.5px] text-foreground">
                  Invitación creada. Puedes copiar el enlace y enviarlo tú mismo, o pulsar <strong>"Enviar por email"</strong>.
                </p>
              </div>

              <div className="rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-2.5 bg-muted/40 border-b border-border flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">Para:</span>
                  {email}
                </div>
                <div className="px-4 py-2.5 bg-muted/40 border-b border-border flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">Asunto:</span>
                  {preview.asunto}
                </div>
                <pre className="px-4 py-4 text-[12px] text-foreground leading-relaxed whitespace-pre-wrap font-sans">
                  {preview.cuerpo}
                </pre>
              </div>

              {creada && (
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-2 h-10 px-3 bg-muted/40 border border-border rounded-xl font-mono text-[11.5px] text-foreground/80 truncate">
                    <Globe className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                    <span className="truncate">{buildInvitacionUrl(creada.token)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border border-border text-[12px] font-semibold text-foreground hover:bg-muted transition-colors shrink-0"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copiado" : "Copiar enlace"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ═════ Footer ═════ */}
        <footer className="flex items-center justify-between gap-2 px-6 py-4 border-t border-border bg-muted/20">
          <button
            type="button"
            onClick={step === "datos" ? onClose : back}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[12.5px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {step === "datos" ? "Cancelar" : "Atrás"}
          </button>
          {step !== "preview" ? (
            <button
              type="button"
              onClick={next}
              disabled={!canContinue}
              className="inline-flex items-center gap-1.5 h-9 px-5 rounded-full bg-primary text-primary-foreground text-[12.5px] font-semibold hover:bg-primary/90 transition-colors shadow-soft disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {step === "condiciones" ? "Crear invitación" : "Siguiente"}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              className="inline-flex items-center gap-1.5 h-9 px-5 rounded-full bg-primary text-primary-foreground text-[12.5px] font-semibold hover:bg-primary/90 transition-colors shadow-soft"
            >
              <Send className="h-3.5 w-3.5" />
              Enviar por email
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
