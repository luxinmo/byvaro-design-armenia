/**
 * ManageAccountsDialog · Gestión de cuentas de email y delegación.
 *
 * Diálogo con 2 tabs:
 *   1. "Cuentas conectadas" — lista + acciones por cuenta:
 *      - Marcar como por defecto
 *      - Toggle push (notificaciones)
 *      - Editar configuración IMAP (sólo provider === "imap")
 *      - Reconectar OAuth (simulado)
 *      - Eliminar cuenta
 *   2. "Delegación de acceso" — usuarios a los que el usuario cede
 *      acceso a sus cuentas. Con aviso explícito y checkbox de
 *      aceptación antes de conceder.
 *
 * El editor IMAP se inserta inline en el tab "accounts" (no es un
 * sub-diálogo) y usa un botón "Volver a cuentas" para cerrar.
 */

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/Switch";
import { Checkbox } from "@/components/ui/Checkbox";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, Check, Plus, Trash2, UserPlus, Bell, BellOff, Shield, Server,
  Settings2, ChevronLeft, PenLine, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { EmailAccount, Delegate, ImapConfig } from "./accounts";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: EmailAccount[];
  delegates: Delegate[];
  onUpdateAccounts: (next: EmailAccount[]) => void;
  onUpdateDelegates: (next: Delegate[]) => void;
  onOpenSignatures?: () => void;
  /** Abre el EmailSetup para conectar una cuenta nueva. El dialog se
   * cierra primero para que el usuario vea el flujo de onboarding. */
  onAddAccount?: () => void;
}

const providerLabel = (p: EmailAccount["provider"]) =>
  p === "gmail" ? "Gmail" : p === "microsoft" ? "Microsoft 365" : "IMAP";

const providerColor = (p: EmailAccount["provider"]) =>
  p === "gmail" ? "bg-red-500" : p === "microsoft" ? "bg-sky-600" : "bg-foreground";

const providerInitial = (p: EmailAccount["provider"]) =>
  p === "gmail" ? "G" : p === "microsoft" ? "O" : "@";

export default function ManageAccountsDialog({
  open,
  onOpenChange,
  accounts,
  delegates,
  onUpdateAccounts,
  onUpdateDelegates,
  onOpenSignatures,
  onAddAccount,
}: Props) {
  const [tab, setTab] = useState<"accounts" | "delegation">("accounts");
  const [newDelegateEmail, setNewDelegateEmail] = useState("");
  const [newDelegateName, setNewDelegateName] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [imapEditId, setImapEditId] = useState<string | null>(null);
  const [imapDraft, setImapDraft] = useState<ImapConfig | null>(null);
  /** id de la cuenta cuyo nombre visible está siendo editado inline. */
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  /** name draft adicional cuando estamos en el editor IMAP. */
  const [imapNameDraft, setImapNameDraft] = useState<string>("");

  const editingAccount = imapEditId ? accounts.find((a) => a.id === imapEditId) ?? null : null;

  const openImapEditor = (acc: EmailAccount) => {
    if (!acc.imap) return;
    setImapEditId(acc.id);
    setImapDraft({ ...acc.imap });
    setImapNameDraft(acc.name);
  };

  const closeImapEditor = () => {
    setImapEditId(null);
    setImapDraft(null);
    setImapNameDraft("");
  };

  const saveImapConfig = () => {
    if (!imapEditId || !imapDraft) return;
    if (!imapDraft.imapHost || !imapDraft.smtpHost) {
      toast.error("Servidores IMAP y SMTP son obligatorios");
      return;
    }
    const cleanName = imapNameDraft.trim();
    onUpdateAccounts(
      accounts.map((a) =>
        a.id === imapEditId
          ? { ...a, imap: { ...imapDraft }, name: cleanName || a.name }
          : a,
      ),
    );
    toast.success("Configuración IMAP actualizada");
    closeImapEditor();
  };

  /* Edición inline del nombre visible de cualquier cuenta. */
  const startRename = (acc: EmailAccount) => {
    setRenamingId(acc.id);
    setRenameDraft(acc.name);
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameDraft("");
  };

  const saveRename = () => {
    if (!renamingId) return;
    const clean = renameDraft.trim();
    if (!clean) {
      cancelRename();
      return;
    }
    onUpdateAccounts(accounts.map((a) => (a.id === renamingId ? { ...a, name: clean } : a)));
    toast.success("Nombre visible actualizado");
    cancelRename();
  };

  const testImapConnection = () => {
    toast.success("Conexión verificada correctamente");
  };

  const setDefault = (id: string) => {
    onUpdateAccounts(accounts.map((a) => ({ ...a, isDefault: a.id === id })));
    toast.success("Cuenta por defecto actualizada");
  };

  const togglePush = (id: string, enabled: boolean) => {
    onUpdateAccounts(accounts.map((a) => (a.id === id ? { ...a, pushEnabled: enabled } : a)));
  };

  const removeAccount = (id: string) => {
    onUpdateAccounts(accounts.filter((a) => a.id !== id));
    toast.success("Cuenta eliminada");
  };

  const addDelegate = () => {
    if (!newDelegateEmail || !newDelegateName) {
      toast.error("Introduce nombre y email del usuario");
      return;
    }
    if (!acknowledged) {
      toast.error("Debes aceptar el aviso de delegación");
      return;
    }
    const next: Delegate = {
      id: `d${Date.now()}`,
      email: newDelegateEmail,
      name: newDelegateName,
      grantedAt: new Date().toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    };
    onUpdateDelegates([...delegates, next]);
    setNewDelegateEmail("");
    setNewDelegateName("");
    setAcknowledged(false);
    toast.success(`Acceso delegado a ${next.name}`);
  };

  const removeDelegate = (id: string) => {
    onUpdateDelegates(delegates.filter((d) => d.id !== id));
    toast.success("Delegación revocada");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-muted border-border p-0 gap-0 max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border bg-card">
          <DialogTitle className="text-base font-semibold">Gestionar cuentas de email</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Administra tus cuentas conectadas, notificaciones y delegación de acceso.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 px-6 pt-3 bg-card border-b border-border shrink-0">
          <div className="flex gap-1">
            {(
              [
                { id: "accounts", label: "Cuentas conectadas" },
                { id: "delegation", label: "Delegación de acceso" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "relative px-3 py-2.5 text-sm transition-colors",
                  tab === t.id
                    ? "text-foreground font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          {onOpenSignatures && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenSignatures}
              className="rounded-full h-8 text-xs gap-1.5 mb-2"
            >
              <PenLine className="h-3.5 w-3.5" />
              Firmas
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {tab === "accounts" && editingAccount && imapDraft && (
            <div className="space-y-4">
              <button
                onClick={closeImapEditor}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Volver a cuentas
              </button>

              <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-foreground/90 flex items-center justify-center">
                    <Server className="h-5 w-5 text-background" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{editingAccount.email}</p>
                    <p className="text-xs text-muted-foreground">Configuración IMAP / SMTP</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      Nombre visible
                      <span className="text-muted-foreground/70 ml-1 font-normal">
                        · aparece como remitente al enviar
                      </span>
                    </Label>
                    <Input
                      value={imapNameDraft}
                      onChange={(e) => setImapNameDraft(e.target.value)}
                      placeholder="Ej. Arman Rahmanov"
                      className="h-9 rounded-full"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Usuario</Label>
                    <Input
                      value={imapDraft.username ?? editingAccount.email}
                      onChange={(e) => setImapDraft({ ...imapDraft, username: e.target.value })}
                      className="h-9 rounded-full"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Servidor IMAP</Label>
                    <Input
                      value={imapDraft.imapHost}
                      onChange={(e) => setImapDraft({ ...imapDraft, imapHost: e.target.value })}
                      className="h-9 rounded-full"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Puerto IMAP</Label>
                    <Input
                      value={imapDraft.imapPort}
                      onChange={(e) => setImapDraft({ ...imapDraft, imapPort: e.target.value })}
                      className="h-9 rounded-full"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Servidor SMTP</Label>
                    <Input
                      value={imapDraft.smtpHost}
                      onChange={(e) => setImapDraft({ ...imapDraft, smtpHost: e.target.value })}
                      className="h-9 rounded-full"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Puerto SMTP</Label>
                    <Input
                      value={imapDraft.smtpPort}
                      onChange={(e) => setImapDraft({ ...imapDraft, smtpPort: e.target.value })}
                      className="h-9 rounded-full"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nueva contraseña</Label>
                    <Input
                      type="password"
                      placeholder="Dejar vacío para mantener la actual"
                      className="h-9 rounded-full"
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/40">
                  <div className="flex items-center gap-2 min-w-0">
                    <Shield className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-foreground">Usar conexión segura (SSL/TLS)</span>
                  </div>
                  <Switch
                    checked={imapDraft.useSsl ?? true}
                    onCheckedChange={(v) => setImapDraft({ ...imapDraft, useSsl: v })}
                  />
                </div>

                <div className="mt-5 flex items-center justify-between gap-2">
                  <Button variant="ghost" size="sm" onClick={testImapConnection} className="rounded-full">
                    Probar conexión
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={closeImapEditor} className="rounded-full">
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={saveImapConfig} className="rounded-full">
                      Guardar cambios
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "accounts" && !editingAccount && (
            <>
              {accounts.map((acc) => (
                <div key={acc.id} className="bg-card border border-border rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0",
                        providerColor(acc.provider),
                      )}
                    >
                      {providerInitial(acc.provider)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground truncate">{acc.email}</p>
                        {acc.isDefault && (
                          <Badge className="rounded-full bg-primary/10 text-primary hover:bg-primary/10 text-[10px] font-medium px-2 py-0">
                            Por defecto
                          </Badge>
                        )}
                        {acc.delegated && (
                          <Badge className="rounded-full bg-amber-100 text-amber-700 hover:bg-amber-100 text-[10px] font-medium px-2 py-0">
                            Delegada
                          </Badge>
                        )}
                      </div>
                      {renamingId === acc.id ? (
                        <div className="mt-1 flex items-center gap-1">
                          <Input
                            autoFocus
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveRename();
                              if (e.key === "Escape") cancelRename();
                            }}
                            placeholder="Nombre visible"
                            className="h-7 rounded-full text-xs"
                          />
                          <button
                            onClick={saveRename}
                            title="Guardar"
                            className="h-7 w-7 rounded-full hover:bg-muted flex items-center justify-center text-foreground"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={cancelRename}
                            title="Cancelar"
                            className="h-7 w-7 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                          {providerLabel(acc.provider)} · <span className="text-foreground/80">{acc.name}</span>
                          {!acc.delegated && (
                            <button
                              onClick={() => startRename(acc)}
                              title="Cambiar nombre visible"
                              className="h-5 w-5 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <PenLine className="h-3 w-3" />
                            </button>
                          )}
                          {acc.unread > 0 && (
                            <span className="text-destructive font-medium ml-auto">{acc.unread} sin leer</span>
                          )}
                        </p>
                      )}
                    </div>
                    {!acc.delegated && (
                      <button
                        onClick={() => removeAccount(acc.id)}
                        title="Eliminar cuenta"
                        className="h-8 w-8 rounded-full hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="mt-4 space-y-3 pl-13 border-t border-border pt-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {acc.provider === "imap" ? (
                          <Server className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        ) : (
                          <Shield className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span className="text-xs text-foreground truncate">
                          {acc.provider === "imap"
                            ? "Conectada por IMAP / SMTP"
                            : `Conectada por OAuth · ${providerLabel(acc.provider)}`}
                          {acc.connectedAt && (
                            <span className="text-muted-foreground"> · {acc.connectedAt}</span>
                          )}
                        </span>
                      </div>
                      {acc.provider === "imap" && acc.imap && !acc.delegated && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openImapEditor(acc)}
                          className="rounded-full h-7 text-xs gap-1.5 shrink-0"
                        >
                          <Settings2 className="h-3.5 w-3.5" />
                          Editar configuración
                        </Button>
                      )}
                      {acc.provider !== "imap" && !acc.delegated && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            toast.success(`Reautenticación con ${providerLabel(acc.provider)} iniciada`)
                          }
                          className="rounded-full h-7 text-xs shrink-0"
                        >
                          Reconectar
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs text-foreground">Cuenta por defecto al redactar</span>
                      </div>
                      {acc.isDefault ? (
                        <span className="text-xs text-emerald-600 font-medium">Activa</span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDefault(acc.id)}
                          className="rounded-full h-7 text-xs"
                        >
                          Hacer por defecto
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {acc.pushEnabled ? (
                          <Bell className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        ) : (
                          <BellOff className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span className="text-xs text-foreground">Notificaciones push</span>
                      </div>
                      <Switch
                        checked={acc.pushEnabled}
                        onCheckedChange={(v) => togglePush(acc.id, v)}
                      />
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={() => {
                  onOpenChange(false);
                  if (onAddAccount) {
                    /* Retrasamos el onAddAccount un tick para que el
                     * dialog tenga tiempo de cerrarse con animación. */
                    window.setTimeout(() => onAddAccount(), 50);
                  } else {
                    toast.info("Abre el selector de cuenta y pulsa 'Añadir nueva cuenta'");
                  }
                }}
                className="w-full flex items-center justify-center gap-2 bg-card border border-dashed border-border rounded-2xl py-3.5 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Añadir nueva cuenta
              </button>
            </>
          )}

          {tab === "delegation" && (
            <>
              <div className="bg-card border border-border rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <Shield className="h-4 w-4 text-amber-700" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">¿Qué es la delegación de acceso?</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Permite que otro usuario (por ejemplo, un compañero) gestione tus correos cuando estés
                      ausente o de vacaciones. Esa persona verá tus cuentas marcadas como "delegadas" y
                      podrá leer, responder y archivar emails en tu nombre.
                    </p>
                  </div>
                </div>
              </div>

              {delegates.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-1">
                    Usuarios con acceso delegado
                  </p>
                  <div className="space-y-2">
                    {delegates.map((d) => (
                      <div
                        key={d.id}
                        className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3"
                      >
                        <div className="h-9 w-9 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-semibold shrink-0">
                          {d.name
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">{d.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {d.email} · concedido {d.grantedAt}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDelegate(d.id)}
                          className="rounded-full h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          Revocar
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <UserPlus className="h-4 w-4 text-foreground" />
                  <p className="text-sm font-semibold text-foreground">Conceder acceso a un usuario</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      Nombre del usuario
                    </label>
                    <Input
                      placeholder="Ej. Laura Gómez"
                      value={newDelegateName}
                      onChange={(e) => setNewDelegateName(e.target.value)}
                      className="h-9 rounded-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      Email del usuario
                    </label>
                    <Input
                      type="email"
                      placeholder="usuario@empresa.com"
                      value={newDelegateEmail}
                      onChange={(e) => setNewDelegateEmail(e.target.value)}
                      className="h-9 rounded-full"
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <Checkbox
                      checked={acknowledged}
                      onCheckedChange={setAcknowledged}
                      className="mt-0.5"
                    />
                    <span className="text-xs text-amber-900 leading-relaxed">
                      Entiendo que esta persona podrá <strong>leer, enviar y gestionar</strong> los emails
                      de todas mis cuentas conectadas en mi nombre. Concedo este acceso a sabiendas y
                      bajo mi responsabilidad.
                    </span>
                  </label>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button
                    onClick={addDelegate}
                    disabled={!acknowledged || !newDelegateEmail || !newDelegateName}
                    className="rounded-full"
                    size="sm"
                  >
                    <UserPlus className="h-4 w-4" />
                    Conceder acceso
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border bg-card flex justify-end shrink-0">
          <Button onClick={() => onOpenChange(false)} className="rounded-full" size="sm">
            Hecho
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
