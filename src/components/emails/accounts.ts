/**
 * accounts.ts — Tipos + mocks del módulo Emails.
 *
 * Define la cuenta de correo (`EmailAccount`), sus variantes por provider
 * (gmail / microsoft / imap), la delegación de acceso (`Delegate`) y los
 * mocks iniciales que alimentan el cliente hasta que exista backend.
 *
 * Portado desde figgy-friend-forge · ARCHITECTURE_EMAILS.md
 * Ver docs/screens/emails.md para el contrato completo.
 */

export type EmailProvider = "gmail" | "microsoft" | "imap" | "byvaro";

/** Dominio del correo nativo de Byvaro · cada usuario obtiene una
 *  dirección `<localpart>@mail.byvaro.com` al darse de alta · útil
 *  como fallback cuando todavía no han conectado su email corporativo.
 *  TODO(backend): el dominio real lo gestiona Byvaro · MX records y
 *  storage del proveedor de email transaccional. */
export const BYVARO_MAIL_DOMAIN = "mail.byvaro.com";

/** Deriva la dirección Byvaro nativa para un usuario.
 *  - Si su email es `arman@luxinmo.com` → `arman@mail.byvaro.com`.
 *  - Si ya termina en `@mail.byvaro.com`, se mantiene tal cual.
 *  Sanitiza caracteres no válidos del localpart por seguridad. */
export function deriveByvaroEmail(userEmail: string): string {
  const trimmed = (userEmail ?? "").trim().toLowerCase();
  if (!trimmed) return `usuario@${BYVARO_MAIL_DOMAIN}`;
  if (trimmed.endsWith(`@${BYVARO_MAIL_DOMAIN}`)) return trimmed;
  const localpart = (trimmed.split("@")[0] || "usuario").replace(/[^a-z0-9._-]/g, "");
  return `${localpart}@${BYVARO_MAIL_DOMAIN}`;
}

export type ImapConfig = {
  imapHost: string;
  imapPort: string;
  smtpHost: string;
  smtpPort: string;
  username?: string;
  useSsl?: boolean;
};

export type EmailAccount = {
  id: string;
  provider: EmailProvider;
  email: string;
  name: string;
  unread: number;
  isDefault: boolean;
  pushEnabled: boolean;
  connectedAt?: string;
  delegated?: boolean;
  delegatedFrom?: string;
  imap?: ImapConfig;
};

export type Delegate = {
  id: string;
  email: string;
  name: string;
  grantedAt: string;
};

/* ══════ Mocks iniciales ══════ */

export const INITIAL_ACCOUNTS: EmailAccount[] = [
  {
    id: "a1",
    provider: "gmail",
    email: "arman@byvaro.com",
    name: "Arman Yeghiazaryan",
    unread: 2,
    isDefault: true,
    pushEnabled: true,
    connectedAt: "8 mar 2026",
  },
  {
    id: "a2",
    provider: "microsoft",
    email: "arman@luxinmo.com",
    name: "Arman · Luxinmo",
    unread: 5,
    isDefault: false,
    pushEnabled: true,
    connectedAt: "14 mar 2026",
  },
  {
    id: "a3",
    provider: "imap",
    email: "ventas@byvaro.com",
    name: "Ventas Byvaro",
    unread: 0,
    isDefault: false,
    pushEnabled: false,
    connectedAt: "2 abr 2026",
    imap: {
      imapHost: "imap.byvaro.com",
      imapPort: "993",
      smtpHost: "smtp.byvaro.com",
      smtpPort: "587",
      username: "ventas@byvaro.com",
      useSsl: true,
    },
  },
  {
    id: "a4",
    provider: "gmail",
    email: "maria.lopez@iberiahomes.com",
    name: "María López (delegada)",
    unread: 3,
    isDefault: false,
    pushEnabled: false,
    connectedAt: "10 abr 2026",
    delegated: true,
    delegatedFrom: "maria.lopez@iberiahomes.com",
  },
];

export const INITIAL_DELEGATES: Delegate[] = [
  {
    id: "d1",
    email: "laura.gomez@byvaro.com",
    name: "Laura Gómez",
    grantedAt: "12 abr 2026",
  },
];

/**
 * Colores usados para el dot de cuenta en la bandeja unificada.
 * Mapea `EmailAccount.id` → clase tailwind de fondo.
 * Se itera por orden de cuenta si no hay entrada específica.
 */
export const ACCOUNT_DOT_COLORS: Record<string, string> = {
  a1: "bg-primary",
  a2: "bg-success",
  a3: "bg-violet-500",
  a4: "bg-warning",
};

/** Fallback si la cuenta no tiene color asignado (hash simple por id). */
export function getAccountDotColor(id: string): string {
  if (ACCOUNT_DOT_COLORS[id]) return ACCOUNT_DOT_COLORS[id];
  const palette = [
    "bg-primary",
    "bg-success",
    "bg-violet-500",
    "bg-warning",
    "bg-rose-500",
    "bg-cyan-500",
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i)) % palette.length;
  return palette[hash];
}
