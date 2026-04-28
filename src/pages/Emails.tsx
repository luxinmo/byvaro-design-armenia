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

import { useMemo, useState } from "react";
import EmailSetup from "@/components/emails/EmailSetup";
import GmailInterface from "@/components/emails/GmailInterface";
import {
  INITIAL_ACCOUNTS,
  INITIAL_DELEGATES,
  EmailAccount,
  Delegate,
  EmailProvider,
  deriveByvaroEmail,
} from "@/components/emails/accounts";
import { useCurrentUser } from "@/lib/currentUser";

export default function Emails() {
  const user = useCurrentUser();

  /* Cuenta nativa de Byvaro · cada usuario tiene <localpart>@mail.byvaro.com
   * al darse de alta. Se prepone a la lista de cuentas para que el
   * usuario pueda usar Byvaro Mail sin conectar nada externo. Si más
   * tarde conecta un email corporativo, esta cuenta sigue ahí · es la
   * "cuenta de la casa". */
  const byvaroAccount: EmailAccount = useMemo(() => ({
    id: `byvaro-${user.email.replace(/[^a-z0-9]/gi, "")}`,
    provider: "byvaro",
    email: deriveByvaroEmail(user.email),
    name: user.name,
    unread: 0,
    isDefault: true,
    pushEnabled: true,
    connectedAt: undefined,
  }), [user.email, user.name]);

  /* Para el promotor (seed user `arman@byvaro.com`) mantenemos las
   * cuentas demo para que la pantalla siga rica · para agencias
   * recién creadas (caso 1 invitación) solo se ven la Byvaro nativa
   * más las que vayan conectando. */
  const isSeedDeveloper = user.email === "arman@byvaro.com";

  const [accounts, setAccounts] = useState<EmailAccount[]>(() =>
    isSeedDeveloper
      ? [byvaroAccount, ...INITIAL_ACCOUNTS.map((a) => ({ ...a, isDefault: false }))]
      : [byvaroAccount],
  );
  const [delegates, setDelegates] = useState<Delegate[]>(INITIAL_DELEGATES);
  // activeId: id real de cuenta O la cadena "all" (bandeja unificada).
  const [activeId, setActiveId] = useState<string | null>(byvaroAccount.id);
  const [addingAccount, setAddingAccount] = useState(false);

  const isAll = activeId === "all";
  const activeAccount = isAll ? null : accounts.find((a) => a.id === activeId) ?? null;

  const CURRENT_USER_NAME = user.name;

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

  /* Banner informativo cuando el usuario solo tiene la cuenta Byvaro
   * nativa · le explicamos qué es y le ofrecemos conectar la
   * corporativa. Una vez tenga ≥2 cuentas, asumimos que ya conoce el
   * sistema y el banner desaparece. */
  const showByvaroBanner = accounts.length === 1 && accounts[0]?.provider === "byvaro";

  return (
    <div className="flex flex-col h-full min-h-0">
      {showByvaroBanner && (
        <div className="shrink-0 bg-primary/5 border-b border-primary/15 px-4 sm:px-6 lg:px-8 py-2.5">
          <div className="max-w-content mx-auto flex items-start gap-3 flex-wrap">
            <span className="h-7 w-7 rounded-lg bg-primary/15 text-primary grid place-items-center shrink-0 mt-0.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            </span>
            <p className="flex-1 min-w-0 text-[12.5px] text-foreground leading-snug">
              <span className="font-semibold">Tu email de Byvaro está activo</span>{" "}
              <code className="text-foreground bg-muted/60 px-1.5 py-0.5 rounded">{accounts[0].email}</code>{" "}
              <span className="text-muted-foreground">
                · enviar y recibir desde aquí ya funciona. Si quieres usar tu email corporativo (Gmail, Outlook, IMAP),
              </span>{" "}
              <button
                type="button"
                onClick={() => setAddingAccount(true)}
                className="text-primary font-semibold underline-offset-2 hover:underline"
              >
                configúralo
              </button>
              <span className="text-muted-foreground">.</span>
            </p>
          </div>
        </div>
      )}
      <div className="flex-1 min-h-0">
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
      </div>
    </div>
  );
}
