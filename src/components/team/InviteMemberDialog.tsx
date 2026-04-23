/**
 * InviteMemberDialog · alta de un nuevo miembro del equipo.
 *
 * Dos flujos seleccionables con ViewToggle:
 *
 * 1. **Invitar por email** (recomendado)
 *    - Admin introduce email + rol.
 *    - Backend envía email con link de activación (expira 7 días).
 *    - Usuario define su propia contraseña al aceptar.
 *
 * 2. **Crear cuenta directa** (onboarding rápido · presencial)
 *    - Admin rellena todos los datos del miembro.
 *    - Sistema genera contraseña temporal de 12 chars.
 *    - Admin copia y la comparte por canal seguro.
 *    - Al primer login, usuario forzado a cambiarla.
 *
 * Regla fuerte: **un email solo puede pertenecer a una organización**.
 * El backend valida con 409 EMAIL_TAKEN. El frontend muestra aviso
 * (simulado con `EXISTING_EMAILS` hasta que haya backend).
 *
 * TODO(backend):
 *   POST /api/organization/invitations { email, role } → 201
 *   POST /api/organization/members     { ...fullData, generateTempPassword: true }
 *     → 201 { member, tempPassword } · 409 EMAIL_TAKEN { existingWorkspace }
 */

import { useMemo, useState } from "react";
import {
  Mail, Send, UserPlus, Shield, ShieldCheck, Copy, Check, AlertCircle,
  RefreshCw, Eye, EyeOff, KeyRound,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ViewToggle } from "@/components/ui/ViewToggle";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { JobTitlePicker } from "@/components/team/JobTitlePicker";
import {
  derivedDepartment, encodeJobTitle,
} from "@/data/jobTitles";
import type { TeamMember } from "@/lib/team";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Mode = "invite" | "create";

/* Mock · emails ya asociados a otra organización (simula el 409). */
const EXISTING_EMAILS: Record<string, string> = {
  "carlos@primeproperties.com": "Prime Properties",
  "admin@iberiahomes.com":     "Iberia Homes",
  "info@nordicrealty.se":      "Nordic Home Finders",
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** Se llama al confirmar. El padre crea el miembro y persiste. */
  onInvite: (payload: { email: string; role: TeamMember["role"] }) => void;
  onCreate: (payload: Omit<TeamMember, "id"> & { tempPassword: string }) => void;
};

/* ═══════════════════════════════════════════════════════════════════
   Generador de contraseña · 12 chars alfanuméricos + símbolo.
   Excluye caracteres ambiguos (0 O 1 l I) para dictado/lectura.
   ═══════════════════════════════════════════════════════════════════ */
function generatePassword(): string {
  const letters = "abcdefghijkmnopqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "!@#$%*";
  const all = letters + upper + digits + symbols;

  /* Garantizamos al menos 1 de cada categoría. */
  const required = [
    letters[Math.floor(Math.random() * letters.length)],
    upper[Math.floor(Math.random() * upper.length)],
    digits[Math.floor(Math.random() * digits.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ];
  const extras = Array.from({ length: 8 }, () => all[Math.floor(Math.random() * all.length)]);
  /* Shuffle simple. */
  return [...required, ...extras].sort(() => Math.random() - 0.5).join("");
}

/* ═══════════════════════════════════════════════════════════════════ */

export function InviteMemberDialog({ open, onClose, onInvite, onCreate }: Props) {
  const [mode, setMode] = useState<Mode>("invite");

  /* ─── Campos comunes ─── */
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamMember["role"]>("member");

  /* ─── Solo modo "create" ─── */
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitleKeys, setJobTitleKeys] = useState<string[]>([]);
  const [department, setDepartment] = useState("");
  const [tempPassword, setTempPassword] = useState(() => generatePassword());
  const [showPassword, setShowPassword] = useState(false);

  const reset = () => {
    setMode("invite");
    setEmail("");
    setRole("member");
    setFullName("");
    setPhone("");
    setJobTitleKeys([]);
    setDepartment("");
    setTempPassword(generatePassword());
    setShowPassword(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  /* Detectamos si el email ya está en otra organización (mock). */
  const emailClash = useMemo(() => {
    const key = email.trim().toLowerCase();
    return key && EXISTING_EMAILS[key] ? EXISTING_EMAILS[key] : null;
  }, [email]);

  const emailValid = useMemo(() => /\S+@\S+\.\S+/.test(email.trim()), [email]);

  const canSubmitInvite = emailValid && !emailClash;
  const canSubmitCreate = emailValid && !emailClash && fullName.trim().length > 0;

  /* ─── Acciones ─── */
  const handleInvite = () => {
    if (!canSubmitInvite) return;
    onInvite({ email: email.trim().toLowerCase(), role });
    toast.success(`Invitación enviada a ${email.trim()}`, {
      description: "El enlace de activación caduca en 7 días.",
    });
    handleClose();
  };

  const handleCreate = () => {
    if (!canSubmitCreate) return;
    onCreate({
      name: fullName.trim(),
      email: email.trim().toLowerCase(),
      role,
      phone: phone.trim() || undefined,
      jobTitle: encodeJobTitle(jobTitleKeys) || undefined,
      department: department.trim() || undefined,
      status: "active",
      joinedAt: new Date().toISOString(),
      tempPassword,
    });
    toast.success(`${fullName.trim()} creado`, {
      description: "Comparte la contraseña temporal por un canal seguro.",
    });
    handleClose();
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(tempPassword);
      toast.success("Contraseña copiada al portapapeles");
    } catch {
      toast.error("No se pudo copiar · cópiala manualmente");
    }
  };

  const onJobTitleChange = (next: string[]) => {
    setJobTitleKeys(next);
    setDepartment(derivedDepartment(next) ?? "");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-[560px] p-0 gap-0 rounded-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border">
          <DialogTitle className="text-sm font-bold">Añadir miembro</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Invita a un nuevo miembro o crea su cuenta directamente con una contraseña temporal.
          </DialogDescription>
        </DialogHeader>

        {/* Toggle de modo */}
        <div className="px-6 pt-4 pb-3 border-b border-border">
          <ViewToggle
            value={mode}
            onChange={(v) => setMode(v)}
            options={[
              { value: "invite", icon: Send,      label: "Invitar por email" },
              { value: "create", icon: UserPlus,  label: "Crear cuenta" },
            ]}
          />
          <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
            {mode === "invite"
              ? "Recibirá un email con un enlace de activación. Él define su contraseña."
              : "Genera la cuenta ya activa con contraseña temporal. Útil para onboarding presencial."}
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Email · común a los dos modos */}
          <Field label="Email" required>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                autoFocus
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@empresa.com"
                className={cn("pl-9", emailClash && "border-destructive")}
              />
            </div>
            {emailClash && (
              <p className="text-[11px] text-destructive mt-1.5 inline-flex items-start gap-1.5">
                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                <span>
                  Este email ya pertenece a <b>{emailClash}</b>. Un email solo puede estar en
                  una organización.
                </span>
              </p>
            )}
          </Field>

          {/* Rol · común */}
          <Field label="Rol del workspace">
            <div className="inline-flex items-center bg-muted/40 border border-border rounded-full p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setRole("member")}
                className={cn(
                  "inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full transition-all text-[12.5px] font-medium",
                  role === "member"
                    ? "bg-background text-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Shield className="h-3.5 w-3.5" /> Miembro
              </button>
              <button
                type="button"
                onClick={() => setRole("admin")}
                className={cn(
                  "inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full transition-all text-[12.5px] font-medium",
                  role === "admin"
                    ? "bg-background text-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <ShieldCheck className="h-3.5 w-3.5" /> Admin
              </button>
            </div>
          </Field>

          {/* Campos extra · sólo modo "create" */}
          {mode === "create" && (
            <>
              <Field label="Nombre completo" required>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ej. María González Pérez"
                />
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Cargo · máx 2" className="sm:col-span-2">
                  <JobTitlePicker
                    value={jobTitleKeys}
                    onChange={onJobTitleChange}
                    max={2}
                    placeholder="Selecciona un cargo"
                  />
                </Field>
                <Field label="Departamento" className="sm:col-span-2">
                  <Input
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Auto desde el cargo"
                  />
                </Field>
              </div>

              <Field label="Teléfono">
                <PhoneInput value={phone} onChange={setPhone} placeholder="600 000 000" />
              </Field>

              {/* Password temporal */}
              <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5">
                    <KeyRound className="h-3 w-3" />
                    Contraseña temporal
                  </span>
                  <button
                    type="button"
                    onClick={() => setTempPassword(generatePassword())}
                    className="text-[11px] font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Regenerar
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <Input
                      value={tempPassword}
                      readOnly
                      type={showPassword ? "text" : "password"}
                      className="pr-9 font-mono tnum text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full shrink-0"
                    onClick={copyPassword}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copiar
                  </Button>
                </div>
                <p className="text-[10.5px] text-muted-foreground leading-relaxed">
                  12 caracteres · se le pedirá cambiarla al primer login. Compártela por
                  un canal seguro (WhatsApp, en persona). No la envíes por email.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-3 border-t border-border flex-row justify-end gap-2 sm:gap-2">
          <Button variant="outline" size="sm" className="rounded-full" onClick={handleClose}>
            Cancelar
          </Button>
          {mode === "invite" ? (
            <Button
              size="sm"
              className="rounded-full"
              onClick={handleInvite}
              disabled={!canSubmitInvite}
            >
              <Send className="h-3.5 w-3.5" />
              Enviar invitación
            </Button>
          ) : (
            <Button
              size="sm"
              className="rounded-full"
              onClick={handleCreate}
              disabled={!canSubmitCreate}
            >
              <Check className="h-3.5 w-3.5" />
              Crear miembro
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Campo con label opcional "required" ─── */
function Field({
  label, required, children, className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
