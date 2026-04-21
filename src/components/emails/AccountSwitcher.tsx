/**
 * AccountSwitcher · Popover de cuentas del header del cliente de email.
 *
 * Permite al usuario:
 *   - Cambiar entre cuentas conectadas
 *   - Entrar en la bandeja unificada ("all inboxes")
 *   - Añadir una cuenta nueva (dispara EmailSetup en modo addingAccount)
 *   - Gestionar cuentas (abre ManageAccountsDialog)
 *   - Desconectar la cuenta activa
 *
 * En el trigger, si la cuenta activa no es la unificada, muestra un badge
 * con los no-leídos del resto de cuentas no visibles. En bandeja unificada
 * el badge se oculta porque ya se está viendo todo.
 */

import { ChevronDown, Plus, Settings as SettingsIcon, Inbox } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { EmailAccount } from "./accounts";

interface Props {
  accounts: EmailAccount[];
  activeId: string;
  onSwitch: (id: string) => void;
  onManage: () => void;
  onAddAccount: () => void;
}

const providerInitial = (p: EmailAccount["provider"]) =>
  p === "gmail" ? "G" : p === "microsoft" ? "O" : "@";

const providerColor = (p: EmailAccount["provider"]) =>
  p === "gmail" ? "bg-red-500" : p === "microsoft" ? "bg-sky-600" : "bg-foreground";

export default function AccountSwitcher({
  accounts,
  activeId,
  onSwitch,
  onManage,
  onAddAccount,
}: Props) {
  const isAll = activeId === "all";
  const active = !isAll ? (accounts.find((a) => a.id === activeId) ?? accounts[0]) : null;

  const totalUnread = accounts.reduce((sum, a) => sum + a.unread, 0);

  const triggerBadge = isAll
    ? 0
    : accounts.filter((a) => a.id !== active!.id).reduce((sum, a) => sum + a.unread, 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative inline-flex items-center gap-2 h-9 pl-1 pr-2.5 rounded-full hover:bg-muted transition-colors max-w-[260px]">
          {isAll ? (
            <div className="h-7 w-7 rounded-full bg-foreground flex items-center justify-center text-background shrink-0 relative">
              <Inbox className="h-3.5 w-3.5" />
            </div>
          ) : (
            <div
              className={cn(
                "h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0 relative",
                providerColor(active!.provider),
              )}
            >
              {providerInitial(active!.provider)}
              {triggerBadge > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center ring-2 ring-card">
                  {triggerBadge > 99 ? "99+" : triggerBadge}
                </span>
              )}
            </div>
          )}
          <span className="hidden sm:inline text-xs text-foreground truncate">
            {isAll ? "Todas las cuentas" : active!.email}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[320px] p-0 rounded-2xl border-border shadow-soft-lg"
      >
        {/* Active header */}
        <div className="px-4 py-4 border-b border-border bg-muted/30 rounded-t-2xl">
          <div className="flex items-center gap-3">
            {isAll ? (
              <>
                <div className="h-10 w-10 rounded-full bg-foreground flex items-center justify-center text-background shrink-0">
                  <Inbox className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">Todas las cuentas</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {accounts.length} cuentas · {totalUnread} sin leer
                  </p>
                </div>
              </>
            ) : (
              <>
                <div
                  className={cn(
                    "h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0",
                    providerColor(active!.provider),
                  )}
                >
                  {providerInitial(active!.provider)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{active!.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{active!.email}</p>
                </div>
                {active!.isDefault && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                    Por defecto
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Unified inbox option */}
        {!isAll && accounts.length > 1 && (
          <div className="py-2 border-b border-border">
            <button
              onClick={() => onSwitch("all")}
              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-muted/50 transition-colors text-left"
            >
              <div className="h-8 w-8 rounded-full bg-foreground flex items-center justify-center text-background shrink-0">
                <Inbox className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground truncate font-medium">Todas las cuentas</p>
                <p className="text-[11px] text-muted-foreground">Bandeja unificada · {accounts.length} cuentas</p>
              </div>
              {totalUnread > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
                  {totalUnread}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Other accounts */}
        <div className="py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-4 mb-1">
            {isAll ? "Abrir una cuenta concreta" : "Cambiar de cuenta"}
          </p>
          {accounts
            .filter((a) => isAll || a.id !== active!.id)
            .map((acc) => (
              <button
                key={acc.id}
                onClick={() => onSwitch(acc.id)}
                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-muted/50 transition-colors text-left"
              >
                <div
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0",
                    providerColor(acc.provider),
                  )}
                >
                  {providerInitial(acc.provider)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm text-foreground truncate">{acc.email}</p>
                    {acc.delegated && (
                      <span className="text-[10px] font-medium px-1.5 py-0 rounded-full bg-amber-100 text-amber-700 shrink-0">
                        Delegada
                      </span>
                    )}
                  </div>
                  {acc.unread > 0 && (
                    <p className="text-[11px] text-destructive font-medium">{acc.unread} sin leer</p>
                  )}
                </div>
                {acc.unread > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
                    {acc.unread}
                  </span>
                )}
              </button>
            ))}

          {!isAll && accounts.length === 1 && (
            <p className="text-xs text-muted-foreground text-center py-3 px-4">
              No hay otras cuentas conectadas.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="border-t border-border py-1.5">
          <button
            onClick={onAddAccount}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
          >
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Plus className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="text-sm text-foreground">Añadir nueva cuenta</span>
          </button>
          <button
            onClick={onManage}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
          >
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
              <SettingsIcon className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="text-sm text-foreground">Gestionar cuentas</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
