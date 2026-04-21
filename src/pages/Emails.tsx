/**
 * /emails · Cliente de correo tipo Gmail.
 *
 * Wrapper que decide entre EmailSetup (onboarding) y GmailInterface
 * (cliente completo) según el estado `accounts` y `addingAccount`.
 *
 * Estado persistido en memoria (resetea al recargar). Las firmas SÍ
 * se persisten en localStorage (ver signatures.ts).
 *
 * Ver docs/screens/emails.md para el contrato completo del módulo.
 */

import { useState } from "react";
import EmailSetup from "@/components/emails/EmailSetup";
import GmailInterface from "@/components/emails/GmailInterface";
import {
  INITIAL_ACCOUNTS,
  INITIAL_DELEGATES,
  EmailAccount,
  Delegate,
  EmailProvider,
} from "@/components/emails/accounts";

export default function Emails() {
  const [accounts, setAccounts] = useState<EmailAccount[]>(INITIAL_ACCOUNTS);
  const [delegates, setDelegates] = useState<Delegate[]>(INITIAL_DELEGATES);
  // activeId: id real de cuenta O la cadena "all" (bandeja unificada).
  const [activeId, setActiveId] = useState<string | null>(
    INITIAL_ACCOUNTS.find((a) => a.isDefault)?.id ?? INITIAL_ACCOUNTS[0]?.id ?? null,
  );
  const [addingAccount, setAddingAccount] = useState(false);

  const isAll = activeId === "all";
  const activeAccount = isAll ? null : accounts.find((a) => a.id === activeId) ?? null;

  // TODO(auth): cuando exista user state global, leer aquí el
  // nombre del usuario logueado para usarlo como default.
  const CURRENT_USER_NAME = "Arman Rahmanov";

  // Primera conexión o añadir cuenta nueva desde el switcher.
  if (accounts.length === 0 || addingAccount) {
    return (
      <EmailSetup
        onConfigured={(provider: EmailProvider, email: string, displayName?: string) => {
          const newAcc: EmailAccount = {
            id: `a${Date.now()}`,
            provider,
            email,
            name: displayName?.trim() || CURRENT_USER_NAME,
            unread: 0,
            isDefault: accounts.length === 0,
            pushEnabled: true,
          };
          const next = [...accounts, newAcc];
          setAccounts(next);
          setActiveId(newAcc.id);
          setAddingAccount(false);
        }}
        /* Sólo mostramos Cancelar cuando el usuario ya tiene al menos
         * una cuenta configurada — para el onboarding inicial, quedarse
         * sin conectar rompe el flujo. */
        onCancel={accounts.length > 0 ? () => setAddingAccount(false) : undefined}
      />
    );
  }

  if (!isAll && !activeAccount) return null;

  return (
    <GmailInterface
      account={activeAccount}
      isAll={isAll}
      accounts={accounts}
      delegates={delegates}
      onSwitchAccount={setActiveId}
      onAddAccount={() => setAddingAccount(true)}
      onUpdateAccounts={(next) => {
        setAccounts(next);
        // Si la cuenta activa fue eliminada desde "Gestionar cuentas",
        // movemos el activeId a la primera cuenta disponible o "all".
        if (activeId && activeId !== "all" && !next.find((a) => a.id === activeId)) {
          setActiveId(next[0]?.id ?? null);
        }
      }}
      onUpdateDelegates={setDelegates}
    />
  );
}
