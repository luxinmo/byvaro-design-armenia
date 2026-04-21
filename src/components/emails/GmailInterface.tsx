/**
 * GmailInterface · Cliente de correo tipo Gmail.
 *
 * Estructura:
 *   - Top Bar: Menú móvil + búsqueda + AccountSwitcher
 *   - Body:
 *       · Sidebar (desktop) / Sheet (mobile) con folders + labels
 *       · Panel principal: lista de emails ó EmailDetail abierto
 *   - Compose flotante (solo "Nuevo mensaje")
 *   - FAB Compose en móvil
 *
 * Reply / Reply all / Forward → siempre inline dentro del EmailDetail
 * (componente InlineReply). El Compose flotante se reserva para
 * "Nuevo mensaje" con textarea plano.
 *
 * Portado desde figgy-friend-forge, adaptado al sistema visual
 * Byvaro v2 (tokens HSL, shadow-soft, border-border, string en
 * español).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, Inbox, Star, Send, Tag as TagIcon, ChevronDown,
  Trash2, Plus, RefreshCw, MoreVertical, ChevronLeft, FileText,
  Archive, MailOpen, Reply, Forward, Paperclip, Image as ImageIcon,
  Smile, Link2, X, Minus, Maximize2, Sparkles, Pencil,
  ArrowLeft, Menu, Check, Printer, Flag, Eye, MousePointerClick,
  AlertTriangle, CheckCircle2, SlidersHorizontal,
  Bold, Italic, Underline, List, ListOrdered, RemoveFormatting,
  CalendarClock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import AccountSwitcher from "./AccountSwitcher";
import ManageAccountsDialog from "./ManageAccountsDialog";
import SignatureManagerDialog from "./SignatureManagerDialog";
import InlineReply, { type InlineDraft } from "./InlineReply";
import {
  EmailSignature,
  loadSignatures,
  getDefaultSignature,
  applySignature,
  buildQuoteHtml,
} from "./signatures";
import {
  loadComposeDraft,
  saveComposeDraft,
  clearComposeDraft,
  isDraftEmpty,
  type PersistedComposeDraft,
} from "./drafts";
import { loadLabels, saveLabels, type Label } from "./labels";
import type { EmailAccount, Delegate } from "./accounts";

type ComposeDraft = { to: string; subject: string; body: string };
type ComposeMode = "new" | "reply" | "replyAll" | "forward";

interface Props {
  account: EmailAccount | null;
  isAll?: boolean;
  accounts: EmailAccount[];
  delegates: Delegate[];
  onSwitchAccount: (id: string) => void;
  onAddAccount: () => void;
  onUpdateAccounts: (next: EmailAccount[]) => void;
  onUpdateDelegates: (next: Delegate[]) => void;
}

type EmailFolder = "inbox" | "sent" | "trash" | "drafts";

/**
 * Tracking de entrega cuando el email se envía a través del sistema
 * Byvaro (SMTP propio con pixel de tracking + click tracking).
 * Sólo aplica a emails en folder "sent" enviados desde cuentas
 * conectadas vía el gateway Byvaro.
 *
 * TODO(backend): rellenar con datos reales del webhook de entrega
 *  (provider: Resend/Sendgrid/propio). Por ahora es mock en memoria.
 */
type EmailTracking = {
  /** Enviado correctamente al servidor SMTP. */
  sent: boolean;
  /** Entregado a la bandeja del destinatario (no rebotado). */
  delivered: boolean;
  /** Timestamp ISO de la primera apertura, si se ha abierto. */
  openedAt?: string;
  /** Número de aperturas totales (tracker pixel). */
  openCount?: number;
  /** Número de clicks en enlaces del email. */
  clickCount?: number;
  /** Marcado como rebotado por el servidor SMTP. */
  bounced?: boolean;
  /** Razón del rebote si bounced. */
  bounceReason?: string;
};

type EmailItem = {
  id: string;
  accountId: string;
  folder: EmailFolder;
  from: string;
  fromEmail: string;
  toEmail?: string;
  subject: string;
  snippet: string;
  body: string;
  date: string;
  unread: boolean;
  starred: boolean;
  important: boolean;
  category?: "primary" | "promotions" | "social" | "updates";
  labels?: string[];
  attachments?: { name: string; size: string }[];
  tracking?: EmailTracking;
};

/** Paleta rotativa para asignar color a etiquetas nuevas. */
const LABEL_COLORS = [
  "bg-amber-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-sky-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-orange-500",
];

/* ══════ Tracking UI ══════ */

/** Badges compactos que se muestran inline en la lista (folder Enviados). */
function TrackingBadges({ tracking }: { tracking?: EmailTracking }) {
  if (!tracking) return null;
  if (tracking.bounced) {
    return (
      <span
        title={tracking.bounceReason ?? "Rebotado"}
        className="inline-flex items-center gap-1 text-[10px] font-medium text-destructive"
      >
        <AlertTriangle className="h-3 w-3" />
        Rebotado
      </span>
    );
  }
  if (!tracking.delivered) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
        <Send className="h-3 w-3" />
        Enviando…
      </span>
    );
  }
  if (tracking.openedAt) {
    return (
      <span
        title={`Abierto ${tracking.openCount ?? 1} ${(tracking.openCount ?? 1) === 1 ? "vez" : "veces"}`}
        className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600"
      >
        <Eye className="h-3 w-3" />
        Abierto
      </span>
    );
  }
  return (
    <span
      title="Entregado"
      className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground"
    >
      <CheckCircle2 className="h-3 w-3" />
      Entregado
    </span>
  );
}

/** Tarjeta de tracking completa que se muestra dentro del EmailDetail. */
function TrackingCard({ tracking, toEmail }: { tracking: EmailTracking; toEmail?: string }) {
  const formatDate = (iso?: string) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString("es-ES", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="sm:ml-14 mt-6 bg-muted/30 border border-border rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          Tracking · Enviado vía sistema Byvaro
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <TrackingStat
          icon={Send}
          label="Enviado"
          value={tracking.sent ? "Sí" : "No"}
          state={tracking.sent ? "ok" : "warn"}
        />
        <TrackingStat
          icon={tracking.bounced ? AlertTriangle : CheckCircle2}
          label={tracking.bounced ? "Rebotado" : "Entregado"}
          value={tracking.bounced ? "Sí" : tracking.delivered ? "Sí" : "Pendiente"}
          state={tracking.bounced ? "error" : tracking.delivered ? "ok" : "warn"}
        />
        <TrackingStat
          icon={Eye}
          label="Aperturas"
          value={tracking.openCount != null ? String(tracking.openCount) : "—"}
          state={tracking.openCount && tracking.openCount > 0 ? "ok" : "muted"}
        />
        <TrackingStat
          icon={MousePointerClick}
          label="Clicks"
          value={tracking.clickCount != null ? String(tracking.clickCount) : "—"}
          state={tracking.clickCount && tracking.clickCount > 0 ? "ok" : "muted"}
        />
      </div>
      {(tracking.openedAt || tracking.bounceReason || toEmail) && (
        <div className="mt-3 pt-3 border-t border-border space-y-1.5 text-xs text-muted-foreground">
          {toEmail && (
            <p>
              Destinatario: <span className="text-foreground">{toEmail}</span>
            </p>
          )}
          {tracking.openedAt && (
            <p>
              Primera apertura: <span className="text-foreground">{formatDate(tracking.openedAt)}</span>
            </p>
          )}
          {tracking.bounceReason && (
            <p>
              Motivo del rebote: <span className="text-destructive">{tracking.bounceReason}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function TrackingStat({
  icon: Icon,
  label,
  value,
  state,
}: {
  icon: typeof Send;
  label: string;
  value: string;
  state: "ok" | "warn" | "error" | "muted";
}) {
  const colorMap = {
    ok: "text-emerald-600",
    warn: "text-amber-600",
    error: "text-destructive",
    muted: "text-muted-foreground",
  } as const;
  return (
    <div className="bg-card border border-border rounded-xl p-3">
      <div className={cn("flex items-center gap-1.5 mb-1", colorMap[state])}>
        <Icon className="h-3.5 w-3.5" />
        <p className="text-[10px] uppercase tracking-wider font-semibold">{label}</p>
      </div>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

/** Input usado dentro del popover de filtros avanzados del buscador. */
function SearchField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-8 px-3 rounded-full bg-muted/40 border border-transparent focus:bg-card focus:border-border outline-none text-sm placeholder:text-muted-foreground transition-colors"
      />
    </div>
  );
}

/* Color por cuenta para el dot en bandeja unificada. Mapea por posición
 * en el array de cuentas, con palette rotativa. */
const ACCOUNT_DOT_COLORS = [
  "bg-primary", "bg-emerald-500", "bg-amber-500", "bg-violet-500",
  "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-orange-500",
];
const dotColorFor = (accountId: string, accounts: EmailAccount[]) => {
  const idx = Math.max(0, accounts.findIndex((a) => a.id === accountId));
  return ACCOUNT_DOT_COLORS[idx % ACCOUNT_DOT_COLORS.length];
};

const MOCK_EMAILS: EmailItem[] = [
  {
    id: "1",
    accountId: "a1",
    folder: "inbox",
    from: "Ana Martínez",
    fromEmail: "ana.martinez@iberiahomes.com",
    subject: "Confirmación visita Promoción Sotogrande · Sábado 11:00",
    snippet: "Hola, confirmo la visita programada para el sábado a las 11:00 con el cliente Carlos Ruiz…",
    body: "Hola,\n\nConfirmo la visita programada para el sábado a las 11:00 con el cliente Carlos Ruiz. Estaremos en la entrada principal de la promoción.\n\n¿Podrías enviarme el dossier comercial actualizado y la lista de unidades disponibles antes de mañana? Sería muy útil para preparar la reunión.\n\nGracias,\nAna Martínez\nIberia Homes",
    date: "10:42",
    unread: true,
    starred: true,
    important: true,
    category: "primary",
    labels: ["Visitas"],
  },
  {
    id: "2",
    accountId: "a1",
    folder: "inbox",
    from: "Byvaro · Notificaciones",
    fromEmail: "noreply@byvaro.com",
    subject: "Nueva oferta recibida · Unidad B-204",
    snippet: "Has recibido una nueva oferta de 285.000 € para la unidad B-204 de la promoción Marina Bay…",
    body: "Has recibido una nueva oferta de 285.000 € para la unidad B-204 de la promoción Marina Bay. El cliente solicita financiación del 70% y desea cerrar antes del 30 de mayo.",
    date: "09:15",
    unread: true,
    starred: false,
    important: true,
    category: "updates",
  },
  {
    id: "3",
    accountId: "a2",
    folder: "inbox",
    from: "Carlos Ruiz",
    fromEmail: "carlos.ruiz@gmail.com",
    subject: "Re: Información financiación Sotogrande",
    snippet: "Perfecto, muchas gracias por la información. Me gustaría agendar una llamada esta semana…",
    body: "Perfecto, muchas gracias por la información. Me gustaría agendar una llamada esta semana para revisar las condiciones de financiación con calma. ¿Tienes disponibilidad el jueves por la tarde?\n\nUn saludo,\nCarlos",
    date: "Ayer",
    unread: false,
    starred: false,
    important: false,
    category: "primary",
  },
  {
    id: "4",
    accountId: "a2",
    folder: "inbox",
    from: "Idealista Pro",
    fromEmail: "alertas@idealista.com",
    subject: "📊 Tu informe semanal de leads",
    snippet: "Esta semana has recibido 47 leads nuevos en tus 12 promociones publicadas. Tasa de conversión…",
    body: "Esta semana has recibido 47 leads nuevos en tus 12 promociones publicadas. Tasa de conversión: 8,3%.",
    date: "Ayer",
    unread: false,
    starred: false,
    important: false,
    category: "promotions",
  },
  {
    id: "5",
    accountId: "a3",
    folder: "inbox",
    from: "María López",
    fromEmail: "maria@arquitecturalopez.es",
    subject: "Planos finales Marina Bay · Bloque C",
    snippet: "Te adjunto los planos finales del bloque C ya con todas las modificaciones aprobadas…",
    body: "Te adjunto los planos finales del bloque C ya con todas las modificaciones aprobadas en la última reunión. Por favor revisa antes del viernes.",
    date: "23 abr",
    unread: false,
    starred: true,
    important: false,
    attachments: [{ name: "planos_bloque_C_v3.pdf", size: "4.2 MB" }],
  },
  {
    id: "6",
    accountId: "a4",
    folder: "inbox",
    from: "LinkedIn",
    fromEmail: "messaging-noreply@linkedin.com",
    subject: "Tienes 3 nuevas conexiones esta semana",
    snippet: "Amplía tu red profesional. 3 personas relacionadas con el sector inmobiliario quieren conectar…",
    body: "Amplía tu red profesional. 3 personas relacionadas con el sector inmobiliario quieren conectar contigo.",
    date: "22 abr",
    unread: false,
    starred: false,
    important: false,
    category: "social",
  },
  {
    id: "7",
    accountId: "a2",
    folder: "inbox",
    from: "Notaría Pérez & Asoc.",
    fromEmail: "agenda@notariaperez.com",
    subject: "Cita firma escritura · 15 mayo 12:00",
    snippet: "Le confirmamos la cita de firma de escritura para el día 15 de mayo a las 12:00 horas…",
    body: "Le confirmamos la cita de firma de escritura para el día 15 de mayo a las 12:00 horas en nuestra oficina de Marbella.",
    date: "20 abr",
    unread: false,
    starred: false,
    important: true,
  },
  {
    id: "s1",
    accountId: "a1",
    folder: "sent",
    from: "Yo",
    fromEmail: "arman@byvaro.com",
    toEmail: "ana.martinez@iberiahomes.com",
    subject: "Dossier Sotogrande actualizado",
    snippet: "Hola Ana, te adjunto el dossier comercial actualizado con los precios finales…",
    body: "Hola Ana,\n\nTe adjunto el dossier comercial actualizado con los precios finales de todas las unidades disponibles. Nos vemos el sábado a las 11:00.\n\nUn saludo,\nArman",
    date: "Ayer",
    unread: false,
    starred: false,
    important: false,
    attachments: [{ name: "dossier_sotogrande_v4.pdf", size: "8.1 MB" }],
    tracking: {
      sent: true,
      delivered: true,
      openedAt: "2026-04-20T11:17:00Z",
      openCount: 3,
      clickCount: 1,
    },
  },
  {
    id: "s2",
    accountId: "a1",
    folder: "sent",
    from: "Yo",
    fromEmail: "arman@byvaro.com",
    toEmail: "noreply-ofertas@byvaro.com",
    subject: "Re: Nueva oferta recibida · Unidad B-204",
    snippet: "Recibida la oferta. La estudiamos y te contestamos antes del viernes…",
    body: "Recibida la oferta. La estudiamos y te contestamos antes del viernes.\n\nGracias,\nArman",
    date: "09:40",
    unread: false,
    starred: false,
    important: false,
    tracking: {
      sent: true,
      delivered: false,
      bounced: true,
      bounceReason: "Dominio no encontrado (MX inválido)",
    },
  },
];

type FolderDef = {
  id: "inbox" | "starred" | "sent" | "drafts" | "trash";
  label: string;
  icon: typeof Inbox;
};

const SIDEBAR_ITEMS: FolderDef[] = [
  { id: "inbox", label: "Bandeja de entrada", icon: Inbox },
  { id: "starred", label: "Destacados", icon: Star },
  { id: "sent", label: "Enviados", icon: Send },
  { id: "drafts", label: "Borradores", icon: FileText },
  { id: "trash", label: "Papelera", icon: Trash2 },
];

const INITIAL_LABELS: Label[] = [
  { name: "Visitas", color: "bg-amber-500" },
  { name: "Ofertas", color: "bg-emerald-500" },
  { name: "Clientes VIP", color: "bg-violet-500" },
  { name: "Proveedores", color: "bg-sky-500" },
];

export default function GmailInterface({
  account,
  isAll = false,
  accounts,
  delegates,
  onSwitchAccount,
  onAddAccount,
  onUpdateAccounts,
  onUpdateDelegates,
}: Props) {
  const [selectedFolder, setSelectedFolder] = useState<FolderDef["id"]>("inbox");
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  /* Firma actual del Compose flotante. Se inicializa al abrir un draft. */
  const [composeSignatureId, setComposeSignatureId] = useState<string | null>(null);
  /** Cache del draft persistido — se reevalúa tras open/close del Compose
   * para mostrar el borrador como un pseudo-email en folder "drafts". */
  const [persistedDraft, setPersistedDraft] = useState<PersistedComposeDraft | null>(() =>
    loadComposeDraft(),
  );
  const refreshPersistedDraft = () => setPersistedDraft(loadComposeDraft());
  const [labels, setLabelsState] = useState<Label[]>(() => loadLabels(INITIAL_LABELS));
  const setLabels = (next: Label[] | ((prev: Label[]) => Label[])) => {
    setLabelsState((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      saveLabels(resolved);
      return resolved;
    });
  };
  const [newLabelMode, setNewLabelMode] = useState(false);
  const [newLabelName, setNewLabelName] = useState("");
  /* Búsqueda: texto libre + filtros avanzados tipo Gmail. */
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFilters, setSearchFilters] = useState<{
    from: string;
    to: string;
    subject: string;
    contains: string;
    hasAttachment: boolean;
    unreadOnly: boolean;
  }>({
    from: "",
    to: "",
    subject: "",
    contains: "",
    hasAttachment: false,
    unreadOnly: false,
  });
  const [searchPopoverOpen, setSearchPopoverOpen] = useState(false);
  const activeFilterCount =
    (searchFilters.from ? 1 : 0) +
    (searchFilters.to ? 1 : 0) +
    (searchFilters.subject ? 1 : 0) +
    (searchFilters.contains ? 1 : 0) +
    (searchFilters.hasAttachment ? 1 : 0) +
    (searchFilters.unreadOnly ? 1 : 0);
  const [openEmail, setOpenEmail] = useState<EmailItem | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeDraft, setComposeDraft] = useState<ComposeDraft>({ to: "", subject: "", body: "" });
  const [composeMode, setComposeMode] = useState<ComposeMode>("new");
  const [emails, setEmails] = useState<EmailItem[]>(MOCK_EMAILS);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [manageOpen, setManageOpen] = useState(false);

  const [signatures, setSignatures] = useState<EmailSignature[]>(() => loadSignatures());
  const [signatureManagerOpen, setSignatureManagerOpen] = useState(false);

  const [inlineMode, setInlineMode] = useState<"reply" | "replyAll" | "forward" | null>(null);
  const [inlineDraft, setInlineDraft] = useState<InlineDraft>({ to: "", subject: "", bodyHtml: "" });
  const [inlineSignatureId, setInlineSignatureId] = useState<string | null>(null);

  useEffect(() => {
    if (!signatureManagerOpen) setSignatures(loadSignatures());
  }, [signatureManagerOpen]);

  const accountIdForCurrentScope = isAll ? undefined : account?.id;

  const startCompose = (mode: ComposeMode, src?: EmailItem) => {
    const defaultSig = getDefaultSignature(signatures, accountIdForCurrentScope);
    const sigHtml = defaultSig?.html ?? null;

    if (mode === "new" || !src) {
      /* Si hay un borrador guardado en localStorage lo restauramos. */
      const saved = loadComposeDraft();
      if (saved && !isDraftEmpty(saved)) {
        setComposeDraft({ to: saved.to, subject: saved.subject, body: saved.body });
        toast.info("Borrador recuperado");
      } else {
        const initialBody = sigHtml ? applySignature("", sigHtml) : "";
        setComposeDraft({ to: "", subject: "", body: initialBody });
      }
      setComposeSignatureId(defaultSig?.id ?? null);
      setComposeMode(mode);
      setComposeOpen(true);
      return;
    }

    const isReply = mode === "reply" || mode === "replyAll";
    const cleanSubj = src.subject.replace(/^(Re|Fwd):\s*/i, "");
    const subject = isReply ? `Re: ${cleanSubj}` : `Fwd: ${cleanSubj}`;
    const quote = buildQuoteHtml({
      fromName: src.from,
      fromEmail: src.fromEmail,
      date: src.date,
      bodyText: src.body,
    });
    const body = applySignature(`<div><br></div>${quote}`, sigHtml);

    /* Si estamos respondiendo a un mensaje que YO envié (está en Sent),
     * el destinatario correcto es el que recibió el email original
     * (`src.toEmail`), no el remitente (que es el usuario). */
    const replyTarget = src.folder === "sent" ? src.toEmail ?? "" : src.fromEmail;

    setInlineDraft({
      to: isReply ? replyTarget : "",
      subject,
      bodyHtml: body,
    });
    setInlineSignatureId(defaultSig?.id ?? null);
    setInlineMode(mode);
  };

  const closeInline = () => {
    setInlineMode(null);
    setInlineDraft({ to: "", subject: "", bodyHtml: "" });
  };

  /**
   * Crea un EmailItem nuevo en folder "sent" con tracking mock.
   * Se usa al enviar desde Compose o InlineReply.
   */
  const commitSentEmail = (args: {
    to: string;
    subject: string;
    bodyHtml: string;
    accountId?: string;
    systemEmail?: boolean;
  }) => {
    const currentAccount = accounts.find((a) => a.id === args.accountId) ?? account ?? accounts[0];
    const primaryTo = args.to.split(/[,;]/)[0]?.trim() ?? "";
    /* Para el snippet sí strippeamos HTML (vista previa en la lista).
     * Para el body conservamos el HTML — el detalle lo renderiza como
     * whitespace-pre-wrap pero si existe <br>/<p> también funciona. */
    const snippetText = args.bodyHtml
      .replace(/<!--byvaro-signature-->[\s\S]*?<!--\/byvaro-signature-->/g, "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const snippet = snippetText.slice(0, 140);
    /* body se guarda como texto plano básico (saltos de línea) para que
     * el detalle (que es whitespace-pre-wrap) lo muestre legible. */
    const bodyPlain = args.bodyHtml
      .replace(/<!--byvaro-signature-->[\s\S]*?<!--\/byvaro-signature-->/g, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<[^>]*>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
    const newEmail: EmailItem = {
      id: `sent-${Date.now()}`,
      accountId: currentAccount?.id ?? "a1",
      folder: "sent",
      from: "Yo",
      fromEmail: currentAccount?.email ?? "arman@byvaro.com",
      toEmail: primaryTo,
      subject: args.subject || "(Sin asunto)",
      snippet,
      body: bodyPlain,
      date: new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
      unread: false,
      starred: false,
      important: false,
      /* Tracking mock: sent + delivered tras delay (simulamos webhook SMTP). */
      tracking: { sent: true, delivered: false },
    };
    setEmails((prev) => [newEmail, ...prev]);

    // Simulamos que el webhook de delivery llega 1.2s después.
    window.setTimeout(() => {
      setEmails((prev) =>
        prev.map((e) =>
          e.id === newEmail.id
            ? { ...e, tracking: { ...(e.tracking ?? { sent: true }), delivered: true } }
            : e,
        ),
      );
    }, 1200);
  };

  const sendInline = () => {
    if (!inlineDraft.to.trim()) {
      toast.error("Añade al menos un destinatario");
      return;
    }
    commitSentEmail({
      to: inlineDraft.to,
      subject: inlineDraft.subject,
      bodyHtml: inlineDraft.bodyHtml,
      accountId: account?.id,
    });
    toast.success("Mensaje enviado");
    closeInline();
  };

  const accountById = (id: string) => accounts.find((a) => a.id === id);

  /** Convierte un draft persistido en un EmailItem "virtual" para
   * renderizarlo en el folder Borradores como una fila más. No vive
   * en el array `emails` — se inyecta al filtrar. */
  const draftAsEmail = useMemo<EmailItem | null>(() => {
    if (!persistedDraft) return null;
    if (isDraftEmpty(persistedDraft)) return null;
    const preview = persistedDraft.body
      .replace(/<!--byvaro-signature-->[\s\S]*?<!--\/byvaro-signature-->/g, "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return {
      id: "__draft__",
      accountId: account?.id ?? accounts[0]?.id ?? "a1",
      folder: "drafts",
      from: "Borrador",
      fromEmail: account?.email ?? "",
      toEmail: persistedDraft.to.split(/[,;]/)[0]?.trim(),
      subject: persistedDraft.subject || "(Sin asunto)",
      snippet: preview.slice(0, 140),
      body: preview,
      date: new Date(persistedDraft.savedAt).toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
      }),
      unread: false,
      starred: false,
      important: false,
    };
  }, [persistedDraft, account, accounts]);

  /** Pipeline de filtrado: scope cuenta → scope folder/etiqueta →
   * inyección del draft virtual → búsqueda libre → filtros avanzados. */
  const filtered = (() => {
    /* Drafts: pseudo-vista con el borrador persistido. */
    if (selectedFolder === "drafts" && !selectedLabel) {
      return draftAsEmail ? [draftAsEmail] : [];
    }

    const matchesSearch = (e: EmailItem) => {
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const haystack = `${e.from} ${e.fromEmail} ${e.subject} ${e.snippet} ${e.body}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (searchFilters.from.trim()) {
        const q = searchFilters.from.trim().toLowerCase();
        if (!`${e.from} ${e.fromEmail}`.toLowerCase().includes(q)) return false;
      }
      if (searchFilters.to.trim()) {
        const q = searchFilters.to.trim().toLowerCase();
        if (!(e.toEmail ?? "").toLowerCase().includes(q)) return false;
      }
      if (searchFilters.subject.trim()) {
        const q = searchFilters.subject.trim().toLowerCase();
        if (!e.subject.toLowerCase().includes(q)) return false;
      }
      if (searchFilters.contains.trim()) {
        const q = searchFilters.contains.trim().toLowerCase();
        if (!`${e.body} ${e.snippet}`.toLowerCase().includes(q)) return false;
      }
      if (searchFilters.hasAttachment && !(e.attachments && e.attachments.length > 0)) return false;
      if (searchFilters.unreadOnly && !e.unread) return false;
      return true;
    };

    return emails.filter((e) => {
      /* Scope cuenta */
      if (!isAll && account && e.accountId !== account.id) return false;

      /* Scope folder/etiqueta */
      if (selectedLabel) {
        if (e.folder === "trash") return false;
        if (!e.labels?.includes(selectedLabel)) return false;
      } else if (selectedFolder === "starred") {
        if (!(e.starred && e.folder !== "trash")) return false;
      } else if (selectedFolder === "sent") {
        if (e.folder !== "sent") return false;
      } else if (selectedFolder === "trash") {
        if (e.folder !== "trash") return false;
      } else {
        if (e.folder !== "inbox") return false;
      }

      return matchesSearch(e);
    });
  })();

  const resetSearchFilters = () =>
    setSearchFilters({
      from: "",
      to: "",
      subject: "",
      contains: "",
      hasAttachment: false,
      unreadOnly: false,
    });

  const hasActiveSearch = searchQuery.trim() !== "" || activeFilterCount > 0;

  /** Contadores visibles en el sidebar. Para Borradores contamos 1
   * si hay un draft no vacío persistido (por ahora guardamos uno solo). */
  const folderCounts: Record<FolderDef["id"], number> = {
    inbox: emails.filter((e) => e.folder === "inbox" && e.unread && (isAll || e.accountId === account?.id)).length,
    starred: emails.filter((e) => e.starred && e.folder !== "trash" && (isAll || e.accountId === account?.id)).length,
    sent: emails.filter((e) => e.folder === "sent" && (isAll || e.accountId === account?.id)).length,
    drafts: draftAsEmail ? 1 : 0,
    trash: emails.filter((e) => e.folder === "trash" && (isAll || e.accountId === account?.id)).length,
  };

  const toggleStar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEmails((prev) => prev.map((m) => (m.id === id ? { ...m, starred: !m.starred } : m)));
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((e) => e.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const archiveSelected = () => {
    // Archive = mover a papelera en este mock (no existe folder "archive" en la UI).
    setEmails((prev) =>
      prev.map((e) => (selectedIds.has(e.id) ? { ...e, folder: "trash" as EmailFolder } : e)),
    );
    toast.success(`${selectedIds.size} mensaje${selectedIds.size > 1 ? "s" : ""} archivado${selectedIds.size > 1 ? "s" : ""}`);
    clearSelection();
  };

  const deleteSelected = () => {
    if (selectedFolder === "trash") {
      // En papelera, delete = borrar permanentemente.
      setEmails((prev) => prev.filter((e) => !selectedIds.has(e.id)));
      toast.success(`${selectedIds.size} mensaje${selectedIds.size > 1 ? "s" : ""} eliminado${selectedIds.size > 1 ? "s" : ""} permanentemente`);
    } else {
      setEmails((prev) =>
        prev.map((e) => (selectedIds.has(e.id) ? { ...e, folder: "trash" as EmailFolder } : e)),
      );
      toast.success(`${selectedIds.size} mensaje${selectedIds.size > 1 ? "s" : ""} movido${selectedIds.size > 1 ? "s" : ""} a la papelera`);
    }
    clearSelection();
  };

  const markReadSelected = () => {
    setEmails((prev) => prev.map((e) => (selectedIds.has(e.id) ? { ...e, unread: false } : e)));
    clearSelection();
  };

  /** Toggle de una etiqueta sobre los emails seleccionados: si TODOS
   * los seleccionados ya tienen la etiqueta → la quita; si no → la
   * añade a todos. Es el patrón de Gmail (el popover marca los que
   * ya la tienen con un check). */
  const assignLabelToSelection = (labelName: string) => {
    const selected = emails.filter((e) => selectedIds.has(e.id));
    const allHaveIt = selected.length > 0 && selected.every((e) => e.labels?.includes(labelName));
    setEmails((prev) =>
      prev.map((e) => {
        if (!selectedIds.has(e.id)) return e;
        const existing = e.labels ?? [];
        if (allHaveIt) {
          return { ...e, labels: existing.filter((l) => l !== labelName) };
        }
        if (existing.includes(labelName)) return e;
        return { ...e, labels: [...existing, labelName] };
      }),
    );
    toast.success(
      allHaveIt
        ? `Etiqueta "${labelName}" quitada de ${selectedIds.size} mensaje${selectedIds.size > 1 ? "s" : ""}`
        : `Etiqueta "${labelName}" asignada a ${selectedIds.size} mensaje${selectedIds.size > 1 ? "s" : ""}`,
    );
    clearSelection();
  };

  /** Toggle de etiqueta sobre el email abierto actualmente (detalle). */
  const toggleLabelOnOpen = (labelName: string) => {
    if (!openEmail) return;
    const existing = openEmail.labels ?? [];
    const has = existing.includes(labelName);
    const nextLabels = has
      ? existing.filter((l) => l !== labelName)
      : [...existing, labelName];
    const nextEmail = { ...openEmail, labels: nextLabels };
    setOpenEmail(nextEmail);
    setEmails((prev) => prev.map((e) => (e.id === openEmail.id ? nextEmail : e)));
    toast.success(has ? `Etiqueta "${labelName}" quitada` : `Etiqueta "${labelName}" añadida`);
  };

  /* Acciones sobre el email abierto actualmente (3 puntos del detalle). */
  const toggleImportantOpen = () => {
    if (!openEmail) return;
    const next = { ...openEmail, important: !openEmail.important };
    setOpenEmail(next);
    setEmails((prev) => prev.map((e) => (e.id === next.id ? next : e)));
    toast.success(next.important ? "Marcado como importante" : "Ya no es importante");
  };

  const markUnreadOpen = () => {
    if (!openEmail) return;
    setEmails((prev) => prev.map((e) => (e.id === openEmail.id ? { ...e, unread: true } : e)));
    setOpenEmail(null);
    toast.success("Marcado como no leído");
  };

  const archiveOpen = () => {
    if (!openEmail) return;
    setEmails((prev) =>
      prev.map((e) => (e.id === openEmail.id ? { ...e, folder: "trash" as EmailFolder } : e)),
    );
    setOpenEmail(null);
    toast.success("Mensaje archivado");
  };

  const deleteOpen = () => {
    if (!openEmail) return;
    if (openEmail.folder === "trash") {
      setEmails((prev) => prev.filter((e) => e.id !== openEmail.id));
      toast.success("Mensaje eliminado permanentemente");
    } else {
      setEmails((prev) =>
        prev.map((e) => (e.id === openEmail.id ? { ...e, folder: "trash" as EmailFolder } : e)),
      );
      toast.success("Mensaje movido a la papelera");
    }
    setOpenEmail(null);
  };

  const printOpen = () => {
    window.print();
  };

  const toggleStarOpen = () => {
    if (!openEmail) return;
    const next = { ...openEmail, starred: !openEmail.starred };
    setOpenEmail(next);
    setEmails((prev) => prev.map((e) => (e.id === next.id ? next : e)));
  };

  /* Etiquetas */
  const createLabel = () => {
    const clean = newLabelName.trim();
    if (!clean) {
      setNewLabelMode(false);
      return;
    }
    if (labels.some((l) => l.name.toLowerCase() === clean.toLowerCase())) {
      toast.error("Ya existe una etiqueta con ese nombre");
      return;
    }
    const color = LABEL_COLORS[labels.length % LABEL_COLORS.length];
    setLabels([...labels, { name: clean, color }]);
    toast.success(`Etiqueta "${clean}" creada`);
    setNewLabelName("");
    setNewLabelMode(false);
  };

  const hasSelection = selectedIds.size > 0;

  const initials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();

  const avatarColors = [
    "bg-primary", "bg-orange-500", "bg-amber-500", "bg-emerald-500",
    "bg-sky-500", "bg-indigo-500", "bg-violet-500", "bg-rose-500",
  ];
  const colorFor = (s: string) => avatarColors[s.charCodeAt(0) % avatarColors.length];

  const SidebarContent = (
    <>
      <Button
        onClick={() => {
          startCompose("new");
          setMobileNavOpen(false);
        }}
        size="lg"
        className="m-2 mt-0 self-start rounded-full"
      >
        <Pencil className="h-4 w-4" />
        Redactar
      </Button>

      <nav className="mt-2">
        {SIDEBAR_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = selectedFolder === item.id && !selectedLabel;
          const count = folderCounts[item.id];
          return (
            <button
              key={item.id}
              onClick={() => {
                setSelectedFolder(item.id);
                setSelectedLabel(null);
                setOpenEmail(null);
                setMobileNavOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-4 h-9 pl-4 pr-3 rounded-r-full text-sm transition-colors whitespace-nowrap",
                active
                  ? "bg-primary/10 text-foreground font-semibold"
                  : "text-foreground/80 hover:bg-muted",
              )}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2.2 : 1.8} />
              <span className="flex-1 text-left truncate">{item.label}</span>
              {count > 0 && <span className="text-xs tnum shrink-0">{count}</span>}
            </button>
          );
        })}
      </nav>

      {/* Etiquetas */}
      <div className="mt-4 px-5">
        <div className="flex items-center justify-between h-8">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Etiquetas
          </span>
          <button
            onClick={() => {
              setNewLabelMode(true);
              setNewLabelName("");
            }}
            className="h-7 w-7 rounded-full hover:bg-muted flex items-center justify-center"
            title="Nueva etiqueta"
          >
            <Plus className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
      <nav className="mt-1">
        {labels.map((l) => {
          const active = selectedLabel === l.name;
          return (
            <button
              key={l.name}
              onClick={() => {
                setSelectedLabel(l.name);
                setSelectedFolder("inbox");
                setOpenEmail(null);
                setMobileNavOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-4 h-9 pl-4 pr-3 rounded-r-full text-sm transition-colors whitespace-nowrap",
                active
                  ? "bg-primary/10 text-foreground font-semibold"
                  : "text-foreground/80 hover:bg-muted",
              )}
            >
              <TagIcon className="h-[18px] w-[18px] shrink-0" />
              <span className="flex-1 text-left truncate">{l.name}</span>
              <span className={cn("h-2 w-2 rounded-full shrink-0", l.color)} />
            </button>
          );
        })}

        {newLabelMode && (
          <div className="px-5 py-2 flex items-center gap-2">
            <TagIcon className="h-[18px] w-[18px] text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={newLabelName}
              onChange={(e) => setNewLabelName(e.target.value)}
              onBlur={createLabel}
              onKeyDown={(e) => {
                if (e.key === "Enter") createLabel();
                if (e.key === "Escape") {
                  setNewLabelMode(false);
                  setNewLabelName("");
                }
              }}
              placeholder="Nombre de etiqueta"
              className="flex-1 min-w-0 bg-transparent outline-none text-sm border-b border-border focus:border-primary py-1"
            />
          </div>
        )}
      </nav>
    </>
  );

  return (
    <div className="h-full min-h-0 flex flex-col bg-muted/40">
      {/* Top Bar (Gmail-style — sub-header del cliente de email) */}
      <header className="h-14 sm:h-16 flex items-center gap-2 sm:gap-4 px-3 sm:px-6 shrink-0 border-b border-border bg-card">
        {/* Mobile menu trigger */}
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger asChild>
            <button className="md:hidden h-9 w-9 rounded-full hover:bg-muted flex items-center justify-center shrink-0">
              <Menu className="h-5 w-5 text-foreground" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[280px] p-2 pt-10">
            {SidebarContent}
          </SheetContent>
        </Sheet>

        {/* Atrás a Inicio (estilo Lovable · sale del cliente de correo) */}
        <Link
          to="/inicio"
          title="Volver a Inicio"
          className="inline-flex h-9 items-center gap-2 pl-2 pr-2 sm:pr-3 rounded-full text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Inicio</span>
        </Link>

        {/* Search + filtros avanzados */}
        <div className="flex-1 max-w-[720px] min-w-0">
          <div className="flex items-center h-10 bg-muted/40 border border-transparent rounded-full focus-within:bg-card focus-within:border-border focus-within:shadow-soft transition-all px-2">
            <button className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center shrink-0">
              <Search className="h-4 w-4 text-muted-foreground" />
            </button>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar en el correo"
              className="flex-1 min-w-0 bg-transparent outline-none text-sm px-2 sm:px-3 placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                title="Limpiar búsqueda"
                className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center shrink-0"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
            <Popover open={searchPopoverOpen} onOpenChange={setSearchPopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  title="Filtros avanzados"
                  className="relative h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center shrink-0"
                >
                  <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                sideOffset={8}
                className="w-[360px] p-4 rounded-2xl border-border shadow-soft-lg"
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-foreground">Filtros</p>
                  {activeFilterCount > 0 && (
                    <button
                      onClick={resetSearchFilters}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  <SearchField
                    label="De"
                    value={searchFilters.from}
                    onChange={(v) => setSearchFilters({ ...searchFilters, from: v })}
                    placeholder="nombre o email del remitente"
                  />
                  <SearchField
                    label="Para"
                    value={searchFilters.to}
                    onChange={(v) => setSearchFilters({ ...searchFilters, to: v })}
                    placeholder="email del destinatario"
                  />
                  <SearchField
                    label="Asunto"
                    value={searchFilters.subject}
                    onChange={(v) => setSearchFilters({ ...searchFilters, subject: v })}
                    placeholder="palabras del asunto"
                  />
                  <SearchField
                    label="Contiene las palabras"
                    value={searchFilters.contains}
                    onChange={(v) => setSearchFilters({ ...searchFilters, contains: v })}
                    placeholder="palabras en el cuerpo"
                  />
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <span className="text-xs text-foreground">Tiene adjunto</span>
                    <button
                      onClick={() =>
                        setSearchFilters({
                          ...searchFilters,
                          hasAttachment: !searchFilters.hasAttachment,
                        })
                      }
                      className={cn(
                        "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors",
                        searchFilters.hasAttachment ? "bg-primary" : "bg-muted-foreground/30",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 rounded-full bg-background shadow transition-transform mt-0.5",
                          searchFilters.hasAttachment ? "translate-x-4" : "translate-x-0.5",
                        )}
                      />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-foreground">Sólo no leídos</span>
                    <button
                      onClick={() =>
                        setSearchFilters({
                          ...searchFilters,
                          unreadOnly: !searchFilters.unreadOnly,
                        })
                      }
                      className={cn(
                        "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors",
                        searchFilters.unreadOnly ? "bg-primary" : "bg-muted-foreground/30",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 rounded-full bg-background shadow transition-transform mt-0.5",
                          searchFilters.unreadOnly ? "translate-x-4" : "translate-x-0.5",
                        )}
                      />
                    </button>
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchPopoverOpen(false)}
                    className="rounded-full"
                  >
                    Cerrar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setSearchPopoverOpen(false)}
                    className="rounded-full"
                  >
                    Aplicar
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <button
              title="Búsqueda inteligente"
              className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center shrink-0"
            >
              <Sparkles className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 ml-auto shrink-0">
          <AccountSwitcher
            accounts={accounts}
            activeId={isAll ? "all" : account!.id}
            onSwitch={onSwitchAccount}
            onManage={() => setManageOpen(true)}
            onAddAccount={onAddAccount}
          />
        </div>
      </header>

      <ManageAccountsDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        accounts={accounts}
        delegates={delegates}
        onUpdateAccounts={onUpdateAccounts}
        onUpdateDelegates={onUpdateDelegates}
        onOpenSignatures={() => setSignatureManagerOpen(true)}
        onAddAccount={onAddAccount}
      />

      <SignatureManagerDialog
        open={signatureManagerOpen}
        onOpenChange={setSignatureManagerOpen}
        onSignaturesChange={setSignatures}
      />

      {/* Body */}
      <div className="flex-1 flex min-h-0 gap-3 p-2 sm:p-3">
        {/* Desktop sidebar (folders + etiquetas). Siempre visible —
         * el ancho extra del detalle se gana porque el AppSidebar
         * de Byvaro se colapsa a iconos en /emails. */}
        <aside className="hidden md:flex w-64 shrink-0 px-2 py-3 overflow-y-auto bg-card rounded-2xl border border-border flex-col">
          {SidebarContent}
        </aside>

        {/* Mail list / detail */}
        <main className="flex-1 bg-card rounded-2xl border border-border min-w-0 flex flex-col overflow-hidden">
          {!openEmail ? (
            <>
              {/* Toolbar desktop — cambia según haya selección activa */}
              <div className="hidden sm:flex h-12 items-center gap-1 px-4 shrink-0 border-b border-border">
                <button
                  onClick={selectAll}
                  title={
                    selectedIds.size === filtered.length && filtered.length > 0
                      ? "Deseleccionar todo"
                      : "Seleccionar todo"
                  }
                  className="h-10 w-10 rounded-full hover:bg-muted flex items-center justify-center"
                >
                  <span
                    className={cn(
                      "h-4 w-4 rounded border flex items-center justify-center transition-colors",
                      selectedIds.size === filtered.length && filtered.length > 0
                        ? "bg-primary border-primary"
                        : selectedIds.size > 0
                          ? "bg-primary/30 border-primary"
                          : "border-muted-foreground/40",
                    )}
                  >
                    {selectedIds.size === filtered.length && filtered.length > 0 && (
                      <Check className="h-3 w-3 text-primary-foreground" />
                    )}
                    {selectedIds.size > 0 && selectedIds.size < filtered.length && (
                      <Minus className="h-3 w-3 text-primary-foreground" />
                    )}
                  </span>
                </button>

                {!hasSelection ? (
                  <>
                    <button
                      onClick={() => toast.success("Bandeja actualizada")}
                      title="Actualizar"
                      className="h-10 w-10 rounded-full hover:bg-muted flex items-center justify-center"
                    >
                      <RefreshCw className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                      <span>
                        {filtered.length === 0 ? "0" : `1–${filtered.length}`} de {filtered.length}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-px h-6 bg-border mx-1" />
                    <button
                      onClick={archiveSelected}
                      title="Archivar"
                      className="h-10 w-10 rounded-full hover:bg-muted flex items-center justify-center"
                    >
                      <Archive className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={deleteSelected}
                      title={selectedFolder === "trash" ? "Eliminar permanentemente" : "Eliminar"}
                      className="h-10 w-10 rounded-full hover:bg-muted flex items-center justify-center"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={markReadSelected}
                      title="Marcar como leído"
                      className="h-10 w-10 rounded-full hover:bg-muted flex items-center justify-center"
                    >
                      <MailOpen className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          title="Etiquetar selección"
                          className="h-10 w-10 rounded-full hover:bg-muted flex items-center justify-center"
                        >
                          <TagIcon className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        className="w-60 p-1 rounded-2xl border-border shadow-soft-lg"
                      >
                        <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          Etiquetar {selectedIds.size} mensaje{selectedIds.size > 1 ? "s" : ""}
                        </div>
                        {labels.length === 0 && (
                          <p className="px-3 py-2 text-xs text-muted-foreground">
                            Aún no hay etiquetas. Crea una desde el sidebar.
                          </p>
                        )}
                        {labels.map((l) => {
                          const selected = emails.filter((e) => selectedIds.has(e.id));
                          const allHave =
                            selected.length > 0 && selected.every((e) => e.labels?.includes(l.name));
                          const someHave = selected.some((e) => e.labels?.includes(l.name));
                          return (
                            <button
                              key={l.name}
                              onClick={() => assignLabelToSelection(l.name)}
                              className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted flex items-center gap-2"
                            >
                              <span className={cn("h-2 w-2 rounded-full shrink-0", l.color)} />
                              <span className="flex-1 truncate">{l.name}</span>
                              {allHave ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              ) : someHave ? (
                                <span className="h-3.5 w-3.5 shrink-0 flex items-center justify-center">
                                  <span className="h-0.5 w-2 bg-muted-foreground rounded-full" />
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </PopoverContent>
                    </Popover>
                    <div className="ml-auto flex items-center gap-2 text-xs">
                      <span className="text-foreground font-medium">
                        {selectedIds.size} seleccionado{selectedIds.size !== 1 ? "s" : ""}
                      </span>
                      <button
                        onClick={clearSelection}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        Cancelar
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Banner "todos seleccionados" estilo Gmail */}
              {hasSelection && selectedIds.size === filtered.length && filtered.length > 1 && (
                <div className="hidden sm:flex items-center justify-center gap-2 px-4 py-2 shrink-0 bg-primary/5 text-xs">
                  <span className="text-foreground">
                    Se han seleccionado las <strong>{selectedIds.size}</strong> conversaciones de esta vista.
                  </span>
                </div>
              )}

              {/* Header móvil / toolbar selección */}
              {hasSelection ? (
                <div className="sm:hidden flex items-center gap-1 px-2 h-12 shrink-0 border-b border-border bg-primary/5">
                  <button
                    onClick={clearSelection}
                    className="h-9 w-9 rounded-full hover:bg-muted flex items-center justify-center text-primary"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <span className="text-base font-medium text-primary mr-auto">{selectedIds.size}</span>
                  <button
                    onClick={archiveSelected}
                    title="Archivar"
                    className="h-9 w-9 rounded-full hover:bg-muted flex items-center justify-center text-primary"
                  >
                    <Archive className="h-[18px] w-[18px]" />
                  </button>
                  <button
                    onClick={deleteSelected}
                    title="Eliminar"
                    className="h-9 w-9 rounded-full hover:bg-muted flex items-center justify-center text-primary"
                  >
                    <Trash2 className="h-[18px] w-[18px]" />
                  </button>
                  <button
                    onClick={markReadSelected}
                    title="Marcar como leído"
                    className="h-9 w-9 rounded-full hover:bg-muted flex items-center justify-center text-primary"
                  >
                    <MailOpen className="h-[18px] w-[18px]" />
                  </button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        title="Asignar etiqueta"
                        className="h-9 w-9 rounded-full hover:bg-muted flex items-center justify-center text-primary"
                      >
                        <TagIcon className="h-[18px] w-[18px]" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      align="end"
                      className="w-60 p-1 rounded-2xl border-border shadow-soft-lg"
                    >
                      <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Asignar etiqueta
                      </div>
                      {labels.length === 0 && (
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                          Aún no hay etiquetas.
                        </p>
                      )}
                      {labels.map((l) => (
                        <button
                          key={l.name}
                          onClick={() => assignLabelToSelection(l.name)}
                          className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted flex items-center gap-2"
                        >
                          <span className={cn("h-2 w-2 rounded-full", l.color)} />
                          <span className="flex-1 truncate">{l.name}</span>
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
                </div>
              ) : (
                <div className="sm:hidden px-4 pt-4 pb-2 shrink-0">
                  <p className="text-xs text-muted-foreground">
                    {isAll ? `Todas las cuentas · ${accounts.length} bandejas` : account?.email}
                  </p>
                </div>
              )}

              {/* Select-all mobile */}
              {hasSelection && (
                <button
                  onClick={selectAll}
                  className="sm:hidden flex items-center gap-4 px-4 h-11 shrink-0 border-b border-border hover:bg-muted/40"
                >
                  <span
                    className={cn(
                      "h-5 w-5 rounded border-2 flex items-center justify-center shrink-0",
                      selectedIds.size === filtered.length
                        ? "bg-primary border-primary"
                        : "border-muted-foreground/40",
                    )}
                  >
                    {selectedIds.size === filtered.length && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                  </span>
                  <span className="text-sm text-primary font-medium">Seleccionar todo</span>
                </button>
              )}

              {/* Lista */}
              <div className="flex-1 overflow-y-auto">
                {filtered.map((email) => {
                  const isSelected = selectedIds.has(email.id);
                  return (
                    <div
                      key={email.id}
                      onClick={() => {
                        if (hasSelection) {
                          toggleSelect(email.id, { stopPropagation: () => {} } as React.MouseEvent);
                          return;
                        }
                        /* Click en un draft → reabre el Compose para continuar. */
                        if (email.id === "__draft__" && persistedDraft) {
                          setComposeDraft({
                            to: persistedDraft.to,
                            subject: persistedDraft.subject,
                            body: persistedDraft.body,
                          });
                          setComposeMode("new");
                          setComposeOpen(true);
                          return;
                        }
                        closeInline();
                        setOpenEmail(email);
                        setEmails((prev) =>
                          prev.map((e) => (e.id === email.id ? { ...e, unread: false } : e)),
                        );
                      }}
                      className={cn(
                        "group cursor-pointer transition-colors border-b border-border",
                        isSelected
                          ? "bg-primary/10 hover:bg-primary/15"
                          : email.unread
                            ? "bg-card hover:bg-muted/40"
                            : "bg-muted/20 hover:bg-muted/40",
                        "flex items-start gap-3 px-4 py-3",
                        "sm:items-center sm:gap-3 sm:px-4 sm:py-0 sm:h-11",
                      )}
                    >
                      {/* Desktop checkboxes/flags */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        onClick={(e) => toggleSelect(email.id, e)}
                        className="hidden sm:block h-4 w-4 accent-primary shrink-0"
                      />
                      <button onClick={(e) => toggleStar(email.id, e)} className="hidden sm:block shrink-0">
                        <Star
                          className={cn(
                            "h-[18px] w-[18px]",
                            email.starred ? "fill-amber-400 text-amber-400" : "text-muted-foreground",
                          )}
                        />
                      </button>
                      <button className="hidden md:block shrink-0">
                        <svg
                          viewBox="0 0 20 20"
                          className={cn(
                            "h-[18px] w-[18px]",
                            email.important ? "fill-amber-400 text-amber-400" : "text-muted-foreground fill-none",
                          )}
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          <path d="M3 3 L17 3 L13 10 L17 17 L3 17 Z" />
                        </svg>
                      </button>

                      {/* Avatar móvil (toggle selección) */}
                      <button
                        onClick={(e) => toggleSelect(email.id, e)}
                        className={cn(
                          "sm:hidden h-11 w-11 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0 transition-colors",
                          isSelected ? "bg-primary" : colorFor(email.from),
                        )}
                      >
                        {isSelected ? <Check className="h-5 w-5" /> : initials(email.from)}
                      </button>

                      {/* Layout móvil stacked */}
                      <div className="flex-1 min-w-0 sm:hidden">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {isAll && (
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full shrink-0",
                                  dotColorFor(email.accountId, accounts),
                                )}
                                title={accountById(email.accountId)?.email}
                              />
                            )}
                            <span
                              className={cn(
                                "text-[15px] truncate",
                                email.unread ? "font-semibold text-foreground" : "text-foreground/90",
                              )}
                            >
                              {email.from}
                            </span>
                          </div>
                          <span
                            className={cn(
                              "text-xs shrink-0",
                              email.unread ? "font-semibold text-foreground" : "text-muted-foreground",
                            )}
                          >
                            {email.date}
                          </span>
                        </div>
                        <div
                          className={cn(
                            "text-sm truncate mt-0.5 flex items-center gap-1.5",
                            email.unread ? "font-semibold text-foreground" : "text-foreground/80",
                          )}
                        >
                          <span className="truncate min-w-0 flex-1">{email.subject}</span>
                          {email.labels && email.labels.length > 0 && (
                            <span className="flex items-center gap-1 shrink-0">
                              {email.labels.slice(0, 1).map((labelName) => {
                                const meta = labels.find((l) => l.name === labelName);
                                return (
                                  <span
                                    key={labelName}
                                    className={cn(
                                      "h-1.5 w-1.5 rounded-full",
                                      meta?.color ?? "bg-muted-foreground",
                                    )}
                                    title={labelName}
                                  />
                                );
                              })}
                              {email.labels.length > 1 && (
                                <span className="text-[10px] text-muted-foreground font-normal">
                                  +{email.labels.length - 1}
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground truncate flex-1">
                            {isAll && (
                              <span className="text-muted-foreground/80">{accountById(email.accountId)?.email} · </span>
                            )}{" "}
                            {email.snippet}
                          </span>
                          <button
                            onClick={(e) => toggleStar(email.id, e)}
                            className="shrink-0 -mr-1 p-1"
                          >
                            <Star
                              className={cn(
                                "h-[18px] w-[18px]",
                                email.starred ? "fill-amber-400 text-amber-400" : "text-muted-foreground/60",
                              )}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Layout desktop inline */}
                      <div
                        className={cn(
                          "hidden sm:flex items-center gap-2 w-[140px] lg:w-[200px] shrink-0 truncate text-sm",
                          email.unread ? "font-semibold text-foreground" : "text-foreground",
                        )}
                      >
                        {isAll && (
                          <span
                            className={cn("h-2 w-2 rounded-full shrink-0", dotColorFor(email.accountId, accounts))}
                            title={accountById(email.accountId)?.email}
                          />
                        )}
                        <span className="truncate">{email.from}</span>
                      </div>
                      <div className="hidden sm:flex flex-1 min-w-0 items-center gap-2 text-sm">
                        <div className="min-w-0 truncate">
                          <span className={cn(email.unread && "font-semibold", "text-foreground")}>
                            {email.subject}
                          </span>
                          <span className="text-muted-foreground font-normal"> – {email.snippet}</span>
                        </div>
                        {email.labels && email.labels.length > 0 && (
                          <div className="hidden sm:flex items-center gap-1 shrink-0">
                            {email.labels.slice(0, 2).map((labelName) => {
                              const meta = labels.find((l) => l.name === labelName);
                              return (
                                <span
                                  key={labelName}
                                  className="inline-flex items-center gap-1 h-5 px-1.5 rounded-full bg-muted text-[10px] font-medium text-foreground border border-border"
                                >
                                  {meta && <span className={cn("h-1.5 w-1.5 rounded-full", meta.color)} />}
                                  <span className="truncate max-w-[80px] lg:max-w-[100px]">{labelName}</span>
                                </span>
                              );
                            })}
                            {email.labels.length > 2 && (
                              <span className="text-[10px] text-muted-foreground">
                                +{email.labels.length - 2}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      {email.tracking && (
                        <div className="hidden sm:block shrink-0">
                          <TrackingBadges tracking={email.tracking} />
                        </div>
                      )}
                      {email.attachments && (
                        <Paperclip className="hidden sm:block h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="hidden sm:block text-xs text-foreground shrink-0 w-16 text-right">
                        {email.date}
                      </div>
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                    <Inbox className="h-12 w-12 mb-3 opacity-30" />
                    {hasActiveSearch ? (
                      <>
                        <p className="text-sm">No hay resultados con estos filtros</p>
                        <button
                          onClick={() => {
                            setSearchQuery("");
                            resetSearchFilters();
                          }}
                          className="mt-2 text-xs text-primary hover:underline"
                        >
                          Limpiar búsqueda
                        </button>
                      </>
                    ) : (
                      <p className="text-sm">No hay mensajes en esta vista</p>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <EmailDetail
              email={openEmail}
              onBack={() => {
                closeInline();
                setOpenEmail(null);
              }}
              colorFor={colorFor}
              initials={initials}
              onReply={() => startCompose("reply", openEmail)}
              onReplyAll={() => startCompose("replyAll", openEmail)}
              onForward={() => startCompose("forward", openEmail)}
              onArchive={archiveOpen}
              onDelete={deleteOpen}
              onMarkUnread={markUnreadOpen}
              onToggleStar={toggleStarOpen}
              onToggleImportant={toggleImportantOpen}
              onPrint={printOpen}
              allLabels={labels}
              onToggleLabel={toggleLabelOnOpen}
              inlineReply={
                inlineMode ? (
                  <InlineReply
                    mode={inlineMode}
                    draft={inlineDraft}
                    onChange={setInlineDraft}
                    onClose={closeInline}
                    onSend={sendInline}
                    fromEmail={account?.email ?? accounts[0]?.email}
                    fromName={account?.name ?? accounts[0]?.name}
                    signatures={signatures}
                    activeSignatureId={inlineSignatureId}
                    onChangeSignature={setInlineSignatureId}
                    onOpenSignatureManager={() => setSignatureManagerOpen(true)}
                    onChangeMode={(nextMode) => {
                      /* Cambiar Reply↔ReplyAll↔Forward desde el dropdown
                       * del header: reconstruye el draft para no arrastrar
                       * destinatarios de un modo a otro. */
                      if (!openEmail) {
                        setInlineMode(nextMode);
                        return;
                      }
                      const cleanSubj = openEmail.subject.replace(/^(Re|Fwd):\s*/i, "");
                      const isReply = nextMode === "reply" || nextMode === "replyAll";
                      const replyTarget =
                        openEmail.folder === "sent"
                          ? openEmail.toEmail ?? ""
                          : openEmail.fromEmail;
                      setInlineDraft((prev) => ({
                        to: isReply ? replyTarget : "",
                        subject: isReply ? `Re: ${cleanSubj}` : `Fwd: ${cleanSubj}`,
                        bodyHtml: prev.bodyHtml,
                      }));
                      setInlineMode(nextMode);
                    }}
                  />
                ) : null
              }
            />
          )}
        </main>
      </div>

      {/* FAB Compose móvil (encima del MobileBottomNav) */}
      {!openEmail && !composeOpen && (
        <button
          onClick={() => startCompose("new")}
          className="lg:hidden fixed right-4 bottom-24 h-12 pl-3.5 pr-4 rounded-2xl bg-primary/15 hover:bg-primary/25 text-primary inline-flex items-center gap-2 text-sm font-medium shadow-soft-lg backdrop-blur-sm z-40 transition-colors"
        >
          <Pencil className="h-4 w-4" />
          Redactar
        </button>
      )}

      {/* Compose flotante */}
      {composeOpen && (
        <Compose
          mode={composeMode}
          draft={composeDraft}
          onChange={setComposeDraft}
          accounts={accounts}
          /* Si estamos en bandeja unificada, `account` es null → el
           * usuario tendrá que elegir una cuenta de envío. */
          defaultAccountId={account?.id ?? null}
          onClose={() => {
            /* Al cerrar sin enviar: si hay contenido real, guardamos
             * como borrador para recuperar en la próxima sesión. */
            if (!isDraftEmpty(composeDraft)) {
              saveComposeDraft(composeDraft);
              toast.success("Borrador guardado");
            } else {
              clearComposeDraft();
            }
            refreshPersistedDraft();
            setComposeOpen(false);
          }}
          onSend={(fromAccountId) => {
            if (!composeDraft.to.trim()) {
              toast.error("Añade al menos un destinatario");
              return;
            }
            if (!fromAccountId) {
              toast.error("Elige desde qué cuenta enviar");
              return;
            }
            commitSentEmail({
              to: composeDraft.to,
              subject: composeDraft.subject,
              bodyHtml: composeDraft.body,
              accountId: fromAccountId,
            });
            clearComposeDraft();
            refreshPersistedDraft();
            toast.success("Mensaje enviado");
            setComposeOpen(false);
          }}
          onDiscard={() => {
            /* Botón Trash del footer: descarta definitivamente. */
            clearComposeDraft();
            refreshPersistedDraft();
            setComposeOpen(false);
            toast.info("Borrador descartado");
          }}
          signatures={signatures}
          activeSignatureId={composeSignatureId}
          onChangeSignature={setComposeSignatureId}
          onOpenSignatureManager={() => setSignatureManagerOpen(true)}
        />
      )}
    </div>
  );
}

/* ══════ EmailDetail ══════ */

function EmailDetail({
  email,
  onBack,
  colorFor,
  initials,
  onReply,
  onReplyAll,
  onForward,
  onArchive,
  onDelete,
  onMarkUnread,
  onToggleStar,
  onToggleImportant,
  onPrint,
  allLabels,
  onToggleLabel,
  inlineReply,
}: {
  email: EmailItem;
  onBack: () => void;
  colorFor: (s: string) => string;
  initials: (s: string) => string;
  onReply: () => void;
  onReplyAll: () => void;
  onForward: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onMarkUnread: () => void;
  onToggleStar: () => void;
  onToggleImportant: () => void;
  onPrint: () => void;
  allLabels: Label[];
  onToggleLabel: (labelName: string) => void;
  inlineReply?: React.ReactNode;
}) {
  const inTrash = email.folder === "trash";

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="h-12 flex items-center gap-1 px-3 sm:px-4 shrink-0 border-b border-border">
        <button
          onClick={onBack}
          className="h-9 pl-2 pr-3 sm:pr-4 rounded-full hover:bg-muted flex items-center gap-1.5 text-sm text-foreground transition-colors"
          title="Volver a la bandeja"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Volver</span>
        </button>
        <div className="w-px h-6 bg-border mx-1" />
        {!inTrash && (
          <button
            onClick={onArchive}
            className="h-10 w-10 rounded-full hover:bg-muted flex items-center justify-center"
            title="Archivar"
          >
            <Archive className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
        <button
          onClick={onDelete}
          className="h-10 w-10 rounded-full hover:bg-muted flex items-center justify-center"
          title={inTrash ? "Eliminar permanentemente" : "Eliminar"}
        >
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="w-px h-6 bg-border mx-1" />
        <button
          onClick={onMarkUnread}
          className="h-10 w-10 rounded-full hover:bg-muted flex items-center justify-center"
          title="Marcar como no leído"
        >
          <MailOpen className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="ml-auto" />
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="h-10 w-10 rounded-full hover:bg-muted flex items-center justify-center"
              title="Más acciones"
            >
              <MoreVertical className="h-4 w-4 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-1 rounded-2xl border-border shadow-soft-lg">
            <button
              onClick={onReply}
              className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted flex items-center gap-2"
            >
              <Reply className="h-4 w-4 text-muted-foreground" />
              Responder
            </button>
            <button
              onClick={onForward}
              className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted flex items-center gap-2"
            >
              <Forward className="h-4 w-4 text-muted-foreground" />
              Reenviar
            </button>
            <div className="border-t border-border my-1" />
            {!inTrash && (
              <button
                onClick={onArchive}
                className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted flex items-center gap-2"
              >
                <Archive className="h-4 w-4 text-muted-foreground" />
                Archivar
              </button>
            )}
            <button
              onClick={onDelete}
              className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted flex items-center gap-2 text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              {inTrash ? "Eliminar permanentemente" : "Eliminar"}
            </button>
            <div className="border-t border-border my-1" />
            <button
              onClick={onToggleStar}
              className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted flex items-center gap-2"
            >
              <Star
                className={cn(
                  "h-4 w-4",
                  email.starred ? "fill-amber-400 text-amber-400" : "text-muted-foreground",
                )}
              />
              {email.starred ? "Quitar destacado" : "Destacar"}
            </button>
            <button
              onClick={onToggleImportant}
              className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted flex items-center gap-2"
            >
              <Flag
                className={cn(
                  "h-4 w-4",
                  email.important ? "fill-amber-400 text-amber-400" : "text-muted-foreground",
                )}
              />
              {email.important ? "Marcar no importante" : "Marcar importante"}
            </button>
            <div className="border-t border-border my-1" />
            <button
              onClick={onPrint}
              className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted flex items-center gap-2"
            >
              <Printer className="h-4 w-4 text-muted-foreground" />
              Imprimir
            </button>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-8 lg:px-12 py-4 sm:py-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-6 flex-wrap">
            <h1 className="text-base sm:text-xl text-foreground flex-1 min-w-0 font-semibold">
              {email.subject}
            </h1>
            {email.labels?.map((labelName) => {
              const meta = allLabels.find((l) => l.name === labelName);
              return (
                <span
                  key={labelName}
                  className="inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded-full bg-primary/10 text-primary text-xs border border-primary/20"
                >
                  {meta && <span className={cn("h-1.5 w-1.5 rounded-full", meta.color)} />}
                  <span>{labelName}</span>
                  <button
                    onClick={() => onToggleLabel(labelName)}
                    title={`Quitar etiqueta "${labelName}"`}
                    className="h-4 w-4 rounded-full hover:bg-primary/20 flex items-center justify-center"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
            {/* Añadir etiqueta desde el detalle */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  title="Etiquetar este email"
                  className="h-6 w-6 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <TagIcon className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-60 p-1 rounded-2xl border-border shadow-soft-lg">
                <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Etiquetas
                </div>
                {allLabels.length === 0 && (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    Crea etiquetas desde el sidebar.
                  </p>
                )}
                {allLabels.map((l) => {
                  const active = email.labels?.includes(l.name);
                  return (
                    <button
                      key={l.name}
                      onClick={() => onToggleLabel(l.name)}
                      className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted flex items-center gap-2"
                    >
                      <span className={cn("h-2 w-2 rounded-full shrink-0", l.color)} />
                      <span className="flex-1 truncate">{l.name}</span>
                      {active && <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
                    </button>
                  );
                })}
              </PopoverContent>
            </Popover>
          </div>

          <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div
              className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0",
                colorFor(email.from),
              )}
            >
              {initials(email.from)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
                <span className="text-sm font-semibold text-foreground truncate">{email.from}</span>
                <span className="text-xs text-muted-foreground truncate">&lt;{email.fromEmail}&gt;</span>
              </div>
              <div className="text-xs text-muted-foreground">para mí · {email.date}</div>
            </div>
            <div className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
              <button
                onClick={onToggleStar}
                title={email.starred ? "Quitar destacado" : "Destacar"}
                className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center"
              >
                <Star
                  className={cn(
                    "h-4 w-4",
                    email.starred ? "fill-amber-400 text-amber-400" : "text-muted-foreground",
                  )}
                />
              </button>
              <button
                onClick={onReply}
                title="Responder"
                className="hidden sm:flex h-8 w-8 rounded-full hover:bg-muted items-center justify-center"
              >
                <Reply className="h-4 w-4 text-muted-foreground" />
              </button>
              <button
                onClick={onForward}
                title="Reenviar"
                className="hidden sm:flex h-8 w-8 rounded-full hover:bg-muted items-center justify-center"
              >
                <Forward className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed sm:pl-14">
            {email.body}
          </div>

          {email.tracking && <TrackingCard tracking={email.tracking} toEmail={email.toEmail} />}

          {email.attachments && (
            <div className="sm:pl-14 mt-6">
              <p className="text-xs text-muted-foreground mb-2">
                {email.attachments.length} adjunto{email.attachments.length > 1 ? "s" : ""}
              </p>
              <div className="flex flex-wrap gap-3">
                {email.attachments.map((a) => (
                  <div
                    key={a.name}
                    className="flex items-center gap-3 border border-border rounded-lg px-3 py-2 hover:bg-muted/40 cursor-pointer"
                  >
                    <div className="h-9 w-9 rounded bg-destructive/10 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-foreground">{a.name}</p>
                      <p className="text-[10px] text-muted-foreground">{a.size}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {inlineReply ? (
            inlineReply
          ) : (
            <div className="sm:pl-14 mt-8 flex flex-wrap gap-2">
              <Button onClick={onReply} variant="outline" size="sm" className="rounded-full">
                <Reply className="h-4 w-4" /> Responder
              </Button>
              <Button onClick={onReplyAll} variant="outline" size="sm" className="rounded-full">
                <Reply className="h-4 w-4" /> Responder a todos
              </Button>
              <Button onClick={onForward} variant="outline" size="sm" className="rounded-full">
                <Forward className="h-4 w-4" /> Reenviar
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════ Compose flotante ══════ */

type WindowSize = "normal" | "maximized" | "minimized";

function Compose({
  mode,
  draft,
  onChange,
  onClose,
  onSend,
  onDiscard,
  accounts,
  defaultAccountId,
  signatures,
  activeSignatureId,
  onChangeSignature,
  onOpenSignatureManager,
}: {
  mode: ComposeMode;
  draft: ComposeDraft;
  onChange: (next: ComposeDraft) => void;
  /** Cierra y guarda el borrador si tiene contenido. */
  onClose: () => void;
  onSend: (fromAccountId: string | null) => void;
  /** Cierra descartando el borrador (botón trash). */
  onDiscard: () => void;
  /** Lista completa de cuentas para el selector "De". */
  accounts: EmailAccount[];
  /** Cuenta activa en el cliente. Si null (bandeja unificada), el
   * usuario debe elegir antes de poder enviar. */
  defaultAccountId: string | null;
  signatures: EmailSignature[];
  activeSignatureId: string | null;
  onChangeSignature: (id: string | null) => void;
  onOpenSignatureManager: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const bodyInitialized = useRef(false);
  const [files, setFiles] = useState<File[]>([]);
  const [recipientDraft, setRecipientDraft] = useState("");
  const [confidentialDismissed, setConfidentialDismissed] = useState(false);
  const [windowSize, setWindowSize] = useState<WindowSize>("normal");
  /* Cuenta de envío. Si defaultAccountId es null (isAll), arrancamos
   * null → el usuario debe elegir para poder enviar. */
  const [fromAccountId, setFromAccountId] = useState<string | null>(defaultAccountId);

  const fromAccount = accounts.find((a) => a.id === fromAccountId) ?? null;
  const mustPickAccount = !fromAccount;

  /* Chips destinatarios — mismas reglas que InlineReply */
  const recipientList = draft.to
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const myDomain = (fromAccount?.email.split("@")[1] ?? "").toLowerCase();
  const isExternal = (email: string) => {
    const d = email.split("@")[1]?.toLowerCase() ?? "";
    return d && d !== myDomain;
  };

  const removeRecipient = (email: string) => {
    const next = recipientList.filter((r) => r !== email).join(", ");
    onChange({ ...draft, to: next });
  };

  const addRecipient = () => {
    const clean = recipientDraft.trim().replace(/,$/, "");
    if (!clean) return;
    if (recipientList.includes(clean)) {
      setRecipientDraft("");
      return;
    }
    const next = [...recipientList, clean].join(", ");
    onChange({ ...draft, to: next });
    setRecipientDraft("");
  };

  const externalRecipients = recipientList.filter(isExternal);
  const showConfidentialWarning = !confidentialDismissed && externalRecipients.length > 0;

  /* Ejecuta un comando del rich-text editor y sincroniza el body al padre. */
  const exec = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    syncBody();
    bodyRef.current?.focus();
  };

  const insertLink = () => {
    const url = window.prompt("Introduce la URL");
    if (url) exec("createLink", url);
  };

  // Inyectamos el HTML inicial (con la firma) una sola vez al montar.
  // A partir de ahí, el contentEditable gestiona su propio DOM y
  // sincroniza cambios al padre vía onInput.
  useEffect(() => {
    if (!bodyRef.current || bodyInitialized.current) return;
    bodyRef.current.innerHTML = draft.body || "";
    bodyInitialized.current = true;
    /* Forzar el caret al inicio del editor — si no, cae dentro del
     * bloque de firma (bug típico al inyectar HTML con firmas). */
    bodyRef.current.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    range.setStart(bodyRef.current, 0);
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncBody = () => {
    if (bodyRef.current) onChange({ ...draft, body: bodyRef.current.innerHTML });
  };

  /** Reemplaza la firma actual (entre marcadores) sin tocar el resto del body. */
  const swapSignature = (id: string | null) => {
    onChangeSignature(id);
    if (!bodyRef.current) return;
    const current = bodyRef.current.innerHTML;
    const sig = id ? signatures.find((s) => s.id === id)?.html ?? null : null;
    const next = applySignature(current, sig);
    bodyRef.current.innerHTML = next;
    onChange({ ...draft, body: next });
  };

  const title =
    mode === "reply" ? "Responder" :
    mode === "replyAll" ? "Responder a todos" :
    mode === "forward" ? "Reenviar" : "Nuevo mensaje";

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    const oversize = incoming.find((f) => f.size > 25 * 1024 * 1024);
    if (oversize) {
      toast.error(`${oversize.name} supera el límite de 25 MB`);
      return;
    }
    setFiles((prev) => [...prev, ...incoming]);
    toast.success(`${incoming.length} archivo${incoming.length > 1 ? "s" : ""} adjuntado${incoming.length > 1 ? "s" : ""}`);
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div
      className={cn(
        "fixed bg-card flex flex-col z-50 overflow-hidden border border-border shadow-soft-lg",
        /* Mobile (<sm): siempre full-screen para escribir cómodamente. */
        windowSize === "minimized"
          ? "sm:inset-auto sm:right-8 sm:w-[360px] sm:h-12 sm:rounded-t-2xl sm:bottom-20 lg:bottom-0 inset-x-2 bottom-2 h-12 rounded-2xl"
          : windowSize === "maximized"
            ? "inset-0 sm:inset-4 lg:inset-8 sm:rounded-2xl"
            : cn(
                "inset-0",
                "sm:inset-auto sm:right-8 sm:w-[640px] sm:max-w-[calc(100vw-2rem)]",
                "sm:h-[640px] sm:max-h-[calc(100vh-6rem)] sm:rounded-t-2xl",
                "sm:bottom-20 lg:bottom-0",
              ),
      )}
    >
      <div
        className="h-12 bg-muted/40 border-b border-border flex items-center justify-between px-3 text-foreground text-sm shrink-0 cursor-pointer select-none"
        onClick={() => {
          /* Click en el header cuando está minimizado lo restaura. */
          if (windowSize === "minimized") setWindowSize("normal");
        }}
      >
        <span className="font-medium truncate">
          {title}
          {windowSize === "minimized" && draft.subject && (
            <span className="text-muted-foreground font-normal"> · {draft.subject}</span>
          )}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setWindowSize((s) => (s === "minimized" ? "normal" : "minimized"));
            }}
            title={windowSize === "minimized" ? "Restaurar" : "Minimizar"}
            className="h-8 w-8 rounded-full"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setWindowSize((s) => (s === "maximized" ? "normal" : "maximized"));
            }}
            title={windowSize === "maximized" ? "Restaurar" : "Maximizar"}
            className="h-8 w-8 rounded-full"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="h-8 w-8 rounded-full"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Body oculto cuando está minimizado */}
      {windowSize !== "minimized" && (
        <>
        {/* Selector "De" */}
        <div className="px-4 py-2 border-b border-border flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium shrink-0 w-10">De</span>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "h-7 inline-flex items-center gap-2 px-2 rounded-md hover:bg-muted text-sm min-w-0 transition-colors",
                    mustPickAccount && "text-destructive border border-destructive/40",
                  )}
                >
                  {fromAccount ? (
                    <>
                      <span className="truncate">{fromAccount.email}</span>
                      <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                        {fromAccount.name}
                      </span>
                    </>
                  ) : (
                    <span className="text-destructive">Elige cuenta de envío</span>
                  )}
                  <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[320px] p-1 rounded-2xl border-border shadow-soft-lg">
                <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Enviar desde
                </div>
                {accounts
                  .filter((a) => !a.delegated)
                  .map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setFromAccountId(a.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted flex items-center gap-2",
                        fromAccountId === a.id && "bg-muted",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-foreground">{a.email}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{a.name}</p>
                      </div>
                      {a.isDefault && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                          Default
                        </span>
                      )}
                      {fromAccountId === a.id && <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
                    </button>
                  ))}
              </PopoverContent>
            </Popover>
          </div>

      {/* Chips destinatarios (estilo Gmail) */}
      <div className="px-4 py-2 border-b border-border flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground font-medium shrink-0">Para</span>
        {recipientList.map((email) => {
          const external = isExternal(email);
          return (
            <span
              key={email}
              className={cn(
                "inline-flex items-center gap-1 h-6 pl-2 pr-1 rounded-full text-xs max-w-full",
                external
                  ? "bg-amber-100 text-amber-900 border border-amber-200"
                  : "bg-muted text-foreground border border-border",
              )}
              title={external ? "Destinatario externo a tu organización" : undefined}
            >
              <span className={cn("truncate", external && "underline decoration-dotted")}>
                {email}
              </span>
              <button
                onClick={() => removeRecipient(email)}
                title="Quitar destinatario"
                className="h-4 w-4 rounded-full hover:bg-background/60 flex items-center justify-center shrink-0"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
        <input
          value={recipientDraft}
          onChange={(e) => setRecipientDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
              e.preventDefault();
              addRecipient();
            }
            if (e.key === "Backspace" && !recipientDraft && recipientList.length > 0) {
              removeRecipient(recipientList[recipientList.length - 1]);
            }
          }}
          onBlur={() => recipientDraft && addRecipient()}
          placeholder={recipientList.length === 0 ? "Añadir destinatarios" : ""}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-xs h-6 placeholder:text-muted-foreground"
        />
      </div>

      {/* Asunto */}
      <div className="px-4 py-2 border-b border-border">
        <input
          placeholder="Asunto"
          value={draft.subject}
          onChange={(e) => onChange({ ...draft, subject: e.target.value })}
          className="w-full text-sm outline-none py-1.5 placeholder:text-muted-foreground bg-transparent"
        />
      </div>

      {/* Body */}
      <div
        ref={bodyRef}
        contentEditable
        suppressContentEditableWarning
        onInput={syncBody}
        className="flex-1 overflow-y-auto px-4 py-3 text-sm outline-none prose prose-sm max-w-none [&_*]:max-w-full"
      />

      {/* Aviso confidencial */}
      {showConfidentialWarning && (
        <div className="mx-4 mb-2 flex items-center gap-2 px-3 py-2 bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-xs">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <p className="flex-1 leading-snug">
            <strong>Ten cuidado si vas a compartir información confidencial.</strong>{" "}
            {externalRecipients.join(", ")} no pertenece a tu organización.
          </p>
          <button
            onClick={() => setConfidentialDismissed(true)}
            title="Ocultar aviso"
            className="h-6 w-6 rounded-full hover:bg-amber-200 flex items-center justify-center shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Toolbar formato — pill, scroll lateral en ventanas estrechas */}
      <div className="px-4 pb-2 overflow-x-auto no-scrollbar">
        <div className="inline-flex items-center gap-0.5 px-1.5 h-9 rounded-full bg-muted/60 w-max">
          <button
            onClick={() => exec("bold")}
            title="Negrita"
            className="h-7 w-7 rounded-md hover:bg-background flex items-center justify-center text-muted-foreground"
          >
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => exec("italic")}
            title="Cursiva"
            className="h-7 w-7 rounded-md hover:bg-background flex items-center justify-center text-muted-foreground"
          >
            <Italic className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => exec("underline")}
            title="Subrayado"
            className="h-7 w-7 rounded-md hover:bg-background flex items-center justify-center text-muted-foreground"
          >
            <Underline className="h-3.5 w-3.5" />
          </button>
          <span className="w-px h-4 bg-border mx-0.5" aria-hidden />
          <button
            onClick={insertLink}
            title="Insertar enlace"
            className="h-7 w-7 rounded-md hover:bg-background flex items-center justify-center text-muted-foreground"
          >
            <Link2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => exec("insertUnorderedList")}
            title="Lista"
            className="h-7 w-7 rounded-md hover:bg-background flex items-center justify-center text-muted-foreground"
          >
            <List className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => exec("insertOrderedList")}
            title="Lista numerada"
            className="h-7 w-7 rounded-md hover:bg-background flex items-center justify-center text-muted-foreground"
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => exec("removeFormat")}
            title="Limpiar formato"
            className="h-7 w-7 rounded-md hover:bg-background flex items-center justify-center text-muted-foreground"
          >
            <RemoveFormatting className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {files.length > 0 && (
        <div className="px-4 py-2 border-t border-border flex flex-wrap gap-2 max-h-28 overflow-y-auto">
          {files.map((f, i) => (
            <div
              key={i}
              className="flex items-center gap-2 bg-muted rounded-full pl-3 pr-1 py-1 text-xs"
            >
              <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="truncate max-w-[180px]">{f.name}</span>
              <span className="text-muted-foreground">{formatSize(f.size)}</span>
              <button
                onClick={() => removeFile(i)}
                className="h-5 w-5 rounded-full hover:bg-background flex items-center justify-center"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div className="h-14 px-3 flex items-center gap-1 border-t border-border">
        {/* Split-button Enviar (Enviar · Enviar y archivar · Programar) */}
        <div className="inline-flex items-stretch rounded-full overflow-hidden shadow-soft">
          <button
            onClick={() => onSend(fromAccountId)}
            disabled={mustPickAccount}
            className="h-8 px-4 bg-foreground text-background text-sm font-medium hover:bg-foreground/90 inline-flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Enviar
          </button>
          <Popover>
            <PopoverTrigger asChild>
              <button
                title="Opciones de envío"
                disabled={mustPickAccount}
                className="h-8 w-7 bg-foreground text-background hover:bg-foreground/90 inline-flex items-center justify-center border-l border-background/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-1 rounded-2xl border-border shadow-soft-lg">
              <button
                onClick={() => onSend(fromAccountId)}
                className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted flex items-center gap-2"
              >
                <Send className="h-4 w-4 text-muted-foreground" />
                Enviar
              </button>
              <button
                onClick={() => {
                  onSend(fromAccountId);
                  toast.success("Mensaje enviado y archivado");
                }}
                className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted flex items-center gap-2"
              >
                <Archive className="h-4 w-4 text-muted-foreground" />
                Enviar y archivar
              </button>
              <div className="border-t border-border my-1" />
              <button
                onClick={() => toast.info("Programar envío — próximamente")}
                className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted flex items-center gap-2"
              >
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                Programar envío
              </button>
            </PopoverContent>
          </Popover>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          title="Adjuntar archivo"
          className="h-9 w-9 rounded-full"
        >
          <Paperclip className="h-[18px] w-[18px] text-muted-foreground" />
        </Button>
        <Button variant="ghost" size="icon" title="Insertar enlace" onClick={insertLink} className="h-9 w-9 rounded-full">
          <Link2 className="h-[18px] w-[18px] text-muted-foreground" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => toast.info("Selector de emoji — próximamente")}
          title="Emoji"
          className="h-9 w-9 rounded-full"
        >
          <Smile className="h-[18px] w-[18px] text-muted-foreground" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => imageInputRef.current?.click()}
          title="Insertar imagen"
          className="h-9 w-9 rounded-full"
        >
          <ImageIcon className="h-[18px] w-[18px] text-muted-foreground" />
        </Button>

        {/* Signature picker */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              title="Firma"
              className="h-9 w-9 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
            >
              <span className="text-base leading-none">✍️</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 p-1 rounded-2xl border-border shadow-soft-lg">
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Insertar firma
            </div>
            {signatures.length === 0 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">Aún no hay firmas.</p>
            )}
            {signatures.map((s) => (
              <button
                key={s.id}
                onClick={() => swapSignature(s.id)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted flex items-center gap-2",
                  activeSignatureId === s.id && "bg-muted",
                )}
              >
                <span className="flex-1 truncate">{s.name}</span>
                {activeSignatureId === s.id && (
                  <span className="text-[10px] text-emerald-600 font-semibold">ACTIVA</span>
                )}
              </button>
            ))}
            <button
              onClick={() => swapSignature(null)}
              className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted text-muted-foreground"
            >
              Sin firma
            </button>
            <div className="border-t border-border my-1" />
            <button
              onClick={onOpenSignatureManager}
              className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted text-foreground"
            >
              Gestionar firmas…
            </button>
          </PopoverContent>
        </Popover>

        <div className="flex-1" />
        <Button
          variant="ghost"
          size="icon"
          onClick={onDiscard}
          title="Descartar borrador"
          className="h-9 w-9 rounded-full"
        >
          <Trash2 className="h-[18px] w-[18px] text-muted-foreground" />
        </Button>
      </div>
        </>
      )}
    </div>
  );
}
