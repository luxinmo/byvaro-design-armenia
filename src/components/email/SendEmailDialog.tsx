import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Mail, Users, User, ArrowLeft, Send, Languages, Pencil, Check,
  ChevronRight, Search, ChevronDown, X, Star, UserPlus, Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  EMAIL_TEMPLATES, getTemplate, getTemplatesByAudience,
  type Audience, type Language, type TemplateId, type TemplateBlocks,
  type AvailabilityUnit,
} from "./emailTemplates";
import { unitsByPromotion } from "@/data/units";
import { agencies } from "@/data/agencies";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";

type Step = "audience" | "collab-mode" | "collab-pick" | "collab-invite" | "template" | "compose";
type SendMode = "promotion" | "unit" | "free";

interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultAudience?: Audience;
  defaultTemplateId?: TemplateId;
  /** Optional promotionId — used to inject real availability data into the email */
  promotionId?: string;
  /** Context: 'promotion' (header) sends the whole promotion; 'unit' sends a single unit */
  mode?: SendMode;
  /** Specific unit id when mode='unit' */
  unitId?: string;
}

/** In-app fake clients (no concept of "favorite" for clients) */
const FAKE_CLIENTS = [
  { id: "c1", name: "Carlos Ruiz", email: "carlos.ruiz@email.com", favorite: true },
  { id: "c2", name: "Marta López", email: "marta.lopez@email.com", favorite: false },
  { id: "c3", name: "Daniel Pérez", email: "daniel.perez@email.com", favorite: true },
  { id: "c4", name: "Lucía García", email: "lucia.garcia@email.com", favorite: false },
];

/** Favorite collaborators (subset of agencies) */
const FAVORITE_AGENCY_IDS = new Set(["ag-1", "ag-2"]);

type RecipientKind = "agency" | "client" | "external";
interface Recipient {
  id: string;
  name: string;
  email: string;
  kind: RecipientKind;
  favorite?: boolean;
  /** Avatar/logo url */
  avatar?: string;
}

function formatPriceShort(n: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export function SendEmailDialog({
  open,
  onOpenChange,
  defaultAudience,
  defaultTemplateId,
  promotionId,
  mode = "free",
  unitId,
}: SendEmailDialogProps) {
  const { toast } = useToast();

  // ── Derive forced template based on mode ──
  // unit / promotion → "new-availability" by default (most common case).
  const forcedDefaultTemplateId: TemplateId | undefined = useMemo(() => {
    if (defaultTemplateId) return defaultTemplateId;
    if (mode === "unit") return "new-availability";
    if (mode === "promotion") return "new-availability";
    return undefined;
  }, [defaultTemplateId, mode]);

  // Always start at audience step so the user can pick recipients
  // (Clientes vs Colaboradores → sub-modal con 4 opciones).
  const [step, setStep] = useState<Step>(defaultAudience ? "template" : "audience");
  const [audience, setAudience] = useState<Audience>(defaultAudience ?? "client");
  const [templateId, setTemplateId] = useState<TemplateId>(
    forcedDefaultTemplateId ?? "new-availability",
  );
  const [language, setLanguage] = useState<Language>("es");
  const [recipientSearch, setRecipientSearch] = useState("");
  /** selected recipient emails */
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  /** ad-hoc external recipients added by typing an email */
  const [externalRecipients, setExternalRecipients] = useState<Recipient[]>([]);
  /** Which sub-tab inside the recipient picker is active */
  const [pickerTab, setPickerTab] = useState<"all" | "favorites">("all");
  const [subject, setSubject] = useState("");
  // Inline editing is always ON — there is no edit toggle anymore.
  const editMode = true;
  const [includeSignature, setIncludeSignature] = useState(true);
  const [includeAvailability, setIncludeAvailability] = useState(true);
  const [recipientsOpen, setRecipientsOpen] = useState(false);

  // blocks per language so switching language preserves edits
  const [blocksByLang, setBlocksByLang] = useState<Record<Language, TemplateBlocks>>({
    es: {},
    en: {},
  });

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Build availability units from promotion data (top 8 available)
  const availabilityUnits: AvailabilityUnit[] = useMemo(() => {
    if (!promotionId) return [];
    const all = unitsByPromotion[promotionId] || [];
    return all
      .filter(u => u.status === "available")
      .slice(0, 8)
      .map(u => ({
        id: u.publicId || `${u.floor}º${u.door}`,
        type: u.type,
        bedrooms: u.bedrooms,
        builtArea: u.builtArea,
        price: formatPriceShort(u.price),
      }));
  }, [promotionId]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep(defaultAudience ? "template" : "audience");
      setAudience(defaultAudience ?? "client");
      const tid: TemplateId = forcedDefaultTemplateId ?? "new-availability";
      setTemplateId(tid);
      const tpl = getTemplate(tid);
      setBlocksByLang({
        es: { ...tpl.defaultBlocks.es },
        en: { ...tpl.defaultBlocks.en },
      });
      setSubject(defaultLangSubject(tid, "es"));
      setLanguage("es");
      setSelectedRecipients([]);
      setExternalRecipients([]);
      setRecipientSearch("");
      setPickerTab("all");
      // editMode is always true now (inline editing always on)
      setIncludeSignature(true);
      setIncludeAvailability(true);
    }
  }, [open, defaultAudience, forcedDefaultTemplateId]);

  const selectTemplate = (id: TemplateId) => {
    const tpl = getTemplate(id);
    setTemplateId(id);
    setBlocksByLang({
      es: { ...tpl.defaultBlocks.es },
      en: { ...tpl.defaultBlocks.en },
    });
    setSubject(defaultLangSubject(id, language));
    setStep("compose");
  };

  const tpl = getTemplate(templateId);
  const blocks = blocksByLang[language] ?? {};
  const previewHtml = useMemo(
    () =>
      tpl.render(blocks, language, {
        includeSignature,
        includeAvailability,
        availabilityUnits,
      }),
    [tpl, blocks, language, includeSignature, includeAvailability, availabilityUnits],
  );

  // Inject preview HTML into iframe and wire up contenteditable behaviour
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(previewHtml);
    doc.close();

    // After load, set contenteditable on every [data-block]
    const apply = () => {
      const els = doc.querySelectorAll<HTMLElement>("[data-block]");
      els.forEach(el => {
        el.setAttribute("contenteditable", editMode ? "true" : "false");
        el.spellcheck = false;
        el.onblur = () => {
          const key = el.getAttribute("data-block");
          if (!key) return;
          const newVal = el.innerText;
          setBlocksByLang(prev => {
            const cur = prev[language] || {};
            if ((cur[key] ?? "") === newVal) return prev;
            return {
              ...prev,
              [language]: { ...cur, [key]: newVal },
            };
          });
        };
        // Prevent newline -> <div> for single-line fields by simply allowing native behaviour;
        // single line vs multi line distinction is visual only.
      });
    };
    // Wait one frame for the doc to be ready
    requestAnimationFrame(apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewHtml]);

  // Toggle contenteditable when editMode changes (without re-rendering full HTML)
  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    doc.querySelectorAll<HTMLElement>("[data-block]").forEach(el => {
      el.setAttribute("contenteditable", editMode ? "true" : "false");
    });
  }, [editMode]);

  const handleSend = () => {
    if (selectedRecipients.length === 0) {
      toast({
        title: language === "es" ? "Añade al menos un destinatario" : "Add at least one recipient",
        variant: "destructive",
      });
      return;
    }
    const externalCount = selectedRecipients.filter(email =>
      externalRecipients.some(e => e.email === email),
    ).length;
    toast({
      title: language === "es" ? "Email enviado (simulado)" : "Email sent (simulated)",
      description:
        language === "es"
          ? `Plantilla "${tpl.label.es}" enviada a ${selectedRecipients.length} destinatario(s)${externalCount > 0 ? ` · ${externalCount} invitación(es) pendiente(s) creada(s)` : ""}.`
          : `Template "${tpl.label.en}" sent to ${selectedRecipients.length} recipient(s)${externalCount > 0 ? ` · ${externalCount} pending invitation(s) created` : ""}.`,
    });
    onOpenChange(false);
  };

  // ── Build the recipient pool based on current audience ──
  const allRecipients: Recipient[] = useMemo(() => {
    if (audience === "collaborator") {
      return agencies.map(a => ({
        id: a.id,
        name: a.name,
        email: `contact@${a.name.toLowerCase().replace(/[^a-z0-9]+/g, "")}.com`,
        kind: "agency" as RecipientKind,
        favorite: FAVORITE_AGENCY_IDS.has(a.id),
        avatar: a.logo,
      }));
    }
    return FAKE_CLIENTS.map(c => ({
      id: c.id,
      name: c.name,
      email: c.email,
      kind: "client" as RecipientKind,
      favorite: c.favorite,
    }));
  }, [audience]);

  // External recipients merged so chips can resolve them
  const recipientPool: Recipient[] = useMemo(
    () => [...allRecipients, ...externalRecipients],
    [allRecipients, externalRecipients],
  );

  const filteredRecipients = useMemo(() => {
    const base = pickerTab === "favorites"
      ? allRecipients.filter(r => r.favorite)
      : allRecipients;
    if (!recipientSearch) return base;
    const q = recipientSearch.toLowerCase();
    return base.filter(r =>
      r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q),
    );
  }, [allRecipients, pickerTab, recipientSearch]);

  /** Search input is a valid email AND not already in pool → can be invited */
  const inviteCandidate = useMemo(() => {
    const q = recipientSearch.trim().toLowerCase();
    if (!isValidEmail(q)) return null;
    if (recipientPool.some(r => r.email.toLowerCase() === q)) return null;
    return q;
  }, [recipientSearch, recipientPool]);

  const selectAllVisible = () => {
    const emails = filteredRecipients.map(r => r.email);
    setSelectedRecipients(prev => Array.from(new Set([...prev, ...emails])));
  };

  const handleInviteAndAdd = () => {
    if (!inviteCandidate) return;
    const newRec: Recipient = {
      id: `ext-${inviteCandidate}`,
      name: inviteCandidate,
      email: inviteCandidate,
      kind: "external",
    };
    setExternalRecipients(prev => [...prev, newRec]);
    setSelectedRecipients(prev => Array.from(new Set([...prev, inviteCandidate])));
    setRecipientSearch("");
    toast({
      title: language === "es" ? "Invitación creada" : "Invitation created",
      description:
        language === "es"
          ? `Se enviará invitación pendiente a ${inviteCandidate} junto con el email.`
          : `Pending invitation will be sent to ${inviteCandidate} with this email.`,
    });
  };

  const recipientChips = selectedRecipients
    .map(email => recipientPool.find(r => r.email === email))
    .filter(Boolean) as Recipient[];

  const audienceTemplates = getTemplatesByAudience(audience);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 overflow-hidden bg-muted border-0",
          step === "compose"
            ? "max-w-[1000px] w-[95vw] h-[90vh] flex flex-col"
            : "max-w-[560px]",
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{language === "es" ? "Enviar email" : "Send email"}</DialogTitle>
          <DialogDescription>
            {language === "es" ? "Selecciona destinatario y plantilla" : "Pick recipient and template"}
          </DialogDescription>
        </DialogHeader>

        {/* ─────── STEP 1 · AUDIENCE ─────── */}
        {step === "audience" && (
          <div className="p-7">
            <div className="flex items-center gap-2 mb-1">
              <Mail className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              <h2 className="text-base font-semibold">¿A quién quieres enviar?</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-5">
              Elige el tipo de destinatario para mostrarte las plantillas adecuadas.
            </p>

            <div className="grid grid-cols-2 gap-3">
              {([
                { id: "client", icon: User, title: "A un cliente", desc: "Ficha de unidad o resumen de promoción", next: "template" as Step },
                { id: "collaborator", icon: Users, title: "A un colaborador", desc: "Briefing comercial completo con comisiones", next: "collab-mode" as Step },
              ] as const).map(opt => (
                <button
                  key={opt.id}
                  onClick={() => { setAudience(opt.id); setStep(opt.next); }}
                  className="bg-card border border-border/30 hover:border-foreground/30 rounded-2xl p-5 text-left transition-all group"
                >
                  <opt.icon className="h-5 w-5 text-foreground/70 mb-3" strokeWidth={1.5} />
                  <p className="text-sm font-semibold mb-1">{opt.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─────── STEP 1b · COLLAB MODE (4 opciones) ─────── */}
        {step === "collab-mode" && (
          <div className="p-7">
            <button
              onClick={() => setStep("audience")}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Volver
            </button>
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              <h2 className="text-base font-semibold">¿A qué colaboradores?</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-5">
              Elige cómo seleccionar a los colaboradores destinatarios.
            </p>

            <div className="grid grid-cols-2 gap-3">
              {([
                {
                  id: "all",
                  icon: Users,
                  title: "Todos los colaboradores",
                  desc: `Enviar a las ${agencies.length} agencias colaboradoras`,
                  action: () => {
                    setSelectedRecipients(agencies.map(a => `contact@${a.name.toLowerCase().replace(/[^a-z0-9]+/g, "")}.com`));
                    setStep("template");
                  },
                },
                {
                  id: "favorites",
                  icon: Star,
                  title: "Solo favoritos",
                  desc: `Enviar a tus ${FAVORITE_AGENCY_IDS.size} agencias favoritas`,
                  action: () => {
                    const favs = agencies.filter(a => FAVORITE_AGENCY_IDS.has(a.id));
                    setSelectedRecipients(favs.map(a => `contact@${a.name.toLowerCase().replace(/[^a-z0-9]+/g, "")}.com`));
                    setStep("template");
                  },
                },
                {
                  id: "pick",
                  icon: User,
                  title: "Elegir colaborador",
                  desc: "Seleccionar uno o varios manualmente",
                  action: () => setStep("collab-pick"),
                },
                {
                  id: "invite",
                  icon: UserPlus,
                  title: "Invitar nuevo",
                  desc: "Añadir un email externo con invitación pendiente",
                  action: () => setStep("collab-invite"),
                },
              ] as const).map(opt => (
                <button
                  key={opt.id}
                  onClick={opt.action}
                  className="bg-card border border-border/30 hover:border-foreground/30 rounded-2xl p-5 text-left transition-all group"
                >
                  <opt.icon className="h-5 w-5 text-foreground/70 mb-3" strokeWidth={1.5} />
                  <p className="text-sm font-semibold mb-1">{opt.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ─────── STEP 1c · COLLAB PICK (multi-select) ─────── */}
        {step === "collab-pick" && (
          <div className="p-7">
            <button
              onClick={() => setStep("collab-mode")}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Volver
            </button>
            <h2 className="text-base font-semibold mb-1">Elegir colaboradores</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Selecciona los colaboradores a los que quieres enviar el email.
            </p>

            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
              <Input
                value={recipientSearch}
                onChange={e => setRecipientSearch(e.target.value)}
                placeholder="Buscar por nombre o email..."
                className="h-9 rounded-full pl-9 text-xs bg-card"
              />
            </div>

            <div className="bg-card rounded-2xl border border-border/30 max-h-[340px] overflow-y-auto p-1">
              {agencies
                .filter(a => {
                  if (!recipientSearch) return true;
                  return a.name.toLowerCase().includes(recipientSearch.toLowerCase());
                })
                .map(a => {
                  const email = `contact@${a.name.toLowerCase().replace(/[^a-z0-9]+/g, "")}.com`;
                  const checked = selectedRecipients.includes(email);
                  return (
                    <label
                      key={a.id}
                      className={cn(
                        "flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors",
                        checked ? "bg-foreground/5" : "hover:bg-muted/40",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => {
                          setSelectedRecipients(prev =>
                            e.target.checked ? [...prev, email] : prev.filter(x => x !== email),
                          );
                        }}
                        className="h-3.5 w-3.5 rounded border-border accent-foreground"
                      />
                      {a.logo ? (
                        <img src={a.logo} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-muted inline-flex items-center justify-center shrink-0">
                          <Building2 className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate flex items-center gap-1.5">
                          {a.name}
                          {FAVORITE_AGENCY_IDS.has(a.id) && (
                            <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400 shrink-0" strokeWidth={1.5} />
                          )}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">{email}</p>
                      </div>
                    </label>
                  );
                })}
            </div>

            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-muted-foreground">
                {selectedRecipients.length} seleccionado{selectedRecipients.length === 1 ? "" : "s"}
              </span>
              <Button
                size="sm"
                disabled={selectedRecipients.length === 0}
                className="rounded-full h-9 px-5 text-xs"
                onClick={() => setStep("template")}
              >
                Continuar
              </Button>
            </div>
          </div>
        )}

        {/* ─────── STEP 1d · COLLAB INVITE (email externo) ─────── */}
        {step === "collab-invite" && (
          <div className="p-7">
            <button
              onClick={() => setStep("collab-mode")}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Volver
            </button>
            <div className="flex items-center gap-2 mb-1">
              <UserPlus className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              <h2 className="text-base font-semibold">Invitar nuevo colaborador</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-5">
              Introduce el email. Se enviará una invitación pendiente junto con la promoción.
            </p>

            <Input
              autoFocus
              value={recipientSearch}
              onChange={e => setRecipientSearch(e.target.value)}
              placeholder="email@agencia.com"
              className="h-10 rounded-full text-sm bg-card mb-4"
              onKeyDown={e => {
                if (e.key === "Enter" && inviteCandidate) {
                  handleInviteAndAdd();
                  setStep("template");
                }
              }}
            />

            {recipientSearch && !inviteCandidate && (
              <p className="text-[11px] text-amber-700 mb-3">
                {recipientPool.some(r => r.email.toLowerCase() === recipientSearch.trim().toLowerCase())
                  ? "Este colaborador ya está en tu lista."
                  : "Introduce un email válido."}
              </p>
            )}

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full h-9 px-4 text-xs"
                onClick={() => { setRecipientSearch(""); setStep("collab-mode"); }}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={!inviteCandidate}
                className="rounded-full h-9 px-5 text-xs gap-1.5"
                onClick={() => { handleInviteAndAdd(); setStep("template"); }}
              >
                <UserPlus className="h-3.5 w-3.5" strokeWidth={1.5} />
                Invitar y continuar
              </Button>
            </div>
          </div>
        )}

        {/* ─────── STEP 2 · TEMPLATE ─────── */}
        {step === "template" && (
          <div className="p-7">
            <button
              onClick={() => setStep("audience")}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Volver
            </button>
            <h2 className="text-base font-semibold mb-1">Elige una plantilla</h2>
            <p className="text-xs text-muted-foreground mb-5">
              {audience === "client"
                ? "Plantillas optimizadas para clientes finales."
                : "Plantillas con información comercial completa para agencias colaboradoras."}
            </p>

            <div className="space-y-2.5">
              {audienceTemplates.map(t => {
                const requiredCount = t.requiresAvailableCount;
                const availableCount = availabilityUnits.length;
                const isDisabled =
                  requiredCount !== undefined && availableCount !== requiredCount;
                return (
                  <button
                    key={t.id}
                    onClick={() => !isDisabled && selectTemplate(t.id)}
                    disabled={isDisabled}
                    className={cn(
                      "w-full bg-card border border-border/30 rounded-2xl p-4 flex items-center gap-4 text-left transition-all group",
                      isDisabled
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:border-foreground/30",
                    )}
                  >
                    <img
                      src={t.heroImage}
                      alt=""
                      className={cn(
                        "w-20 h-14 object-cover rounded-lg shrink-0",
                        isDisabled && "grayscale",
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold mb-0.5 flex items-center gap-2">
                        {t.label.es}
                        {isDisabled && (
                          <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            No disponible
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {isDisabled
                          ? `Esta plantilla solo se activa cuando queda exactamente ${requiredCount} unidad disponible (actualmente: ${availableCount}).`
                          : t.description.es}
                      </p>
                    </div>
                    {!isDisabled && (
                      <ChevronRight
                        className="h-4 w-4 text-muted-foreground/50 group-hover:text-foreground transition-colors shrink-0"
                        strokeWidth={1.5}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ─────── STEP 3 · COMPOSE ─────── */}
        {step === "compose" && (
          <>
            {/* Top bar — primary row */}
            <div className="flex items-center justify-between gap-3 pl-5 pr-16 py-3 border-b border-border/30 bg-card">
              <div className="flex items-center gap-2 min-w-0">
                {!defaultTemplateId && (
                  <button
                    onClick={() => setStep("template")}
                    className="text-muted-foreground hover:text-foreground p-1.5 -ml-1.5"
                    aria-label="Back"
                  >
                    <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                )}
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.5} />

                {/* Template selector */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="flex items-center gap-1.5 px-2 py-1 -ml-1 rounded-md hover:bg-muted/60 transition-colors min-w-0">
                      <h2 className="text-sm font-semibold truncate">
                        {language === "es" ? tpl.label.es : tpl.label.en}
                      </h2>
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[340px] p-1.5">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground px-2.5 py-1.5">
                      {language === "es" ? "Plantillas disponibles" : "Available templates"}
                    </p>
                    <div className="space-y-0.5">
                      {audienceTemplates.map(t => (
                        <button
                          key={t.id}
                          onClick={() => selectTemplate(t.id)}
                          className={cn(
                            "w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors",
                            t.id === templateId ? "bg-foreground/5" : "hover:bg-muted/60",
                          )}
                        >
                          <img src={t.heroImage} alt="" className="w-10 h-8 object-cover rounded shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate">{language === "es" ? t.label.es : t.label.en}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{language === "es" ? t.description.es : t.description.en}</p>
                          </div>
                          {t.id === templateId && <Check className="h-3.5 w-3.5 text-foreground shrink-0" strokeWidth={2} />}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Language selector — inline pills if ≤3 languages, dropdown otherwise */}
                {(() => {
                  const languages: { code: Language; label: string }[] = [
                    { code: "es", label: "ES" },
                    { code: "en", label: "EN" },
                  ];
                  const switchTo = (l: Language) => {
                    setLanguage(l);
                    setSubject(prev => {
                      const matchOther = languages.some(
                        x => x.code !== l && prev === defaultLangSubject(templateId, x.code),
                      );
                      return matchOther ? defaultLangSubject(templateId, l) : prev;
                    });
                  };
                  if (languages.length <= 3) {
                    return (
                      <div className="flex items-center bg-muted rounded-full p-0.5 border border-border/40">
                        <Languages className="h-3 w-3 text-muted-foreground ml-2 mr-1" strokeWidth={1.5} />
                        {languages.map(l => (
                          <button
                            key={l.code}
                            onClick={() => switchTo(l.code)}
                            className={cn(
                              "px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider transition-colors",
                              language === l.code
                                ? "bg-foreground text-background"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {l.label}
                          </button>
                        ))}
                      </div>
                    );
                  }
                  return (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-muted border border-border/40 hover:border-border/60 transition-colors">
                          <Languages className="h-3 w-3 text-muted-foreground" strokeWidth={1.5} />
                          <span className="text-[11px] font-semibold uppercase tracking-wider">
                            {languages.find(x => x.code === language)?.label}
                          </span>
                          <ChevronDown className="h-3 w-3 text-muted-foreground" strokeWidth={1.5} />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-40 p-1">
                        {languages.map(l => (
                          <button
                            key={l.code}
                            onClick={() => switchTo(l.code)}
                            className={cn(
                              "w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs hover:bg-muted/60 transition-colors",
                              language === l.code && "bg-foreground/5",
                            )}
                          >
                            <span className="font-medium">{l.label}</span>
                            {language === l.code && <Check className="h-3.5 w-3.5" strokeWidth={2} />}
                          </button>
                        ))}
                      </PopoverContent>
                    </Popover>
                  );
                })()}

                {/* Inline editing is always active — no Edit button */}

                <Button
                  size="sm"
                  className="rounded-full h-8 gap-1.5 px-4 text-xs"
                  onClick={handleSend}
                >
                  <Send className="h-3 w-3" strokeWidth={1.5} />
                  {language === "es" ? "Enviar" : "Send"}
                </Button>
              </div>
            </div>

            {/* Secondary bar — From + recipients + subject */}
            <div className="flex items-center gap-4 px-5 py-2.5 border-b border-border/30 bg-card flex-wrap">
              {/* From (sender) */}
              <div className="flex items-center gap-2 min-w-[220px]">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground shrink-0">
                  {language === "es" ? "De" : "From"}
                </span>
                <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-muted/40 border border-border/30 min-w-0">
                  <img
                    src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=64&h=64&fit=crop&crop=faces&q=80"
                    alt=""
                    className="h-5 w-5 rounded-full object-cover shrink-0"
                  />
                  <div className="flex items-center gap-1.5 min-w-0 text-[11px]">
                    <span className="font-medium truncate">Laura Martín</span>
                    <span className="text-muted-foreground truncate">&lt;laura@mycompany.com&gt;</span>
                  </div>
                </div>
              </div>

              {/* To */}
              <div className="flex items-center gap-2 flex-1 min-w-[260px]">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground shrink-0">
                  {language === "es" ? "Para" : "To"}
                </span>
                <Popover open={recipientsOpen} onOpenChange={setRecipientsOpen}>
                  <PopoverTrigger asChild>
                    <button className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap min-h-[28px] px-2.5 py-1 rounded-full bg-muted/40 border border-border/30 hover:border-border/60 transition-colors">
                      {recipientChips.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {language === "es" ? "Añadir destinatarios..." : "Add recipients..."}
                        </span>
                      ) : recipientChips.length > 3 ? (
                        // Bulk summary when sending to many recipients
                        <span className="inline-flex items-center gap-2 text-[11px] font-medium text-foreground">
                          <Users className="h-3 w-3 text-muted-foreground" strokeWidth={1.5} />
                          {language === "es"
                            ? `Vas a enviar a ${recipientChips.length} ${audience === "collaborator" ? "colaboradores" : "clientes"}`
                            : `Sending to ${recipientChips.length} ${audience === "collaborator" ? "collaborators" : "clients"}`}
                          <span className="text-muted-foreground font-normal">
                            ({language === "es" ? "click para revisar" : "click to review"})
                          </span>
                        </span>
                      ) : (
                        recipientChips.map(r => (
                          <span
                            key={r.email}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-background border border-border/40 text-[11px]"
                          >
                            {r.name}
                            <X
                              className="h-3 w-3 text-muted-foreground hover:text-foreground"
                              strokeWidth={2}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedRecipients(prev => prev.filter(x => x !== r.email));
                              }}
                            />
                          </span>
                        ))
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[380px] p-2">
                    {/* Audience switcher (Clients / Collaborators) */}
                    <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-full mb-2">
                      <button
                        onClick={() => { setAudience("client"); setPickerTab("all"); }}
                        className={cn(
                          "flex-1 inline-flex items-center justify-center gap-1.5 h-7 rounded-full text-[11px] font-medium transition-colors",
                          audience === "client"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <User className="h-3 w-3" strokeWidth={1.5} />
                        {language === "es" ? "Clientes" : "Clients"}
                      </button>
                      <button
                        onClick={() => { setAudience("collaborator"); setPickerTab("all"); }}
                        className={cn(
                          "flex-1 inline-flex items-center justify-center gap-1.5 h-7 rounded-full text-[11px] font-medium transition-colors",
                          audience === "collaborator"
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Users className="h-3 w-3" strokeWidth={1.5} />
                        {language === "es" ? "Colaboradores" : "Collaborators"}
                      </button>
                    </div>

                    {/* Filter tabs (All / Favorites) */}
                    <div className="flex items-center justify-between px-1 mb-2">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setPickerTab("all")}
                          className={cn(
                            "text-[11px] font-medium transition-colors",
                            pickerTab === "all" ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {language === "es" ? "Todos" : "All"}
                        </button>
                        <button
                          onClick={() => setPickerTab("favorites")}
                          className={cn(
                            "inline-flex items-center gap-1 text-[11px] font-medium transition-colors",
                            pickerTab === "favorites" ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          <Star className={cn("h-3 w-3", pickerTab === "favorites" && "fill-amber-400 text-amber-400")} strokeWidth={1.5} />
                          {language === "es" ? "Favoritos" : "Favorites"}
                        </button>
                      </div>
                      <button
                        onClick={selectAllVisible}
                        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {language === "es" ? "Seleccionar todos" : "Select all"}
                      </button>
                    </div>

                    {/* Search */}
                    <div className="relative mb-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                      <Input
                        autoFocus
                        value={recipientSearch}
                        onChange={e => setRecipientSearch(e.target.value)}
                        placeholder={language === "es" ? "Buscar o escribir email..." : "Search or type email..."}
                        className="h-9 rounded-full pl-9 text-xs"
                      />
                    </div>

                    {/* Invite candidate row (when search is a valid email not in pool) */}
                    {inviteCandidate && (
                      <button
                        onClick={handleInviteAndAdd}
                        className="w-full flex items-center gap-2.5 p-2 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors mb-1 text-left"
                      >
                        <div className="h-7 w-7 rounded-full bg-amber-200 inline-flex items-center justify-center shrink-0">
                          <UserPlus className="h-3.5 w-3.5 text-amber-700" strokeWidth={2} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-amber-900 truncate">
                            {language === "es" ? "Invitar y enviar a" : "Invite & send to"}
                          </p>
                          <p className="text-[10px] text-amber-700 truncate">{inviteCandidate}</p>
                        </div>
                        <span className="text-[10px] font-semibold text-amber-700 shrink-0">
                          {language === "es" ? "Invitación" : "Invite"}
                        </span>
                      </button>
                    )}

                    <div className="max-h-[260px] overflow-y-auto space-y-0.5">
                      {filteredRecipients.map(r => {
                        const checked = selectedRecipients.includes(r.email);
                        return (
                          <label
                            key={r.email}
                            className={cn(
                              "flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-colors",
                              checked ? "bg-foreground/5" : "hover:bg-muted/60",
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={e => {
                                setSelectedRecipients(prev =>
                                  e.target.checked
                                    ? [...prev, r.email]
                                    : prev.filter(x => x !== r.email),
                                );
                              }}
                              className="h-3.5 w-3.5 rounded border-border accent-foreground"
                            />
                            {r.avatar ? (
                              <img src={r.avatar} alt="" className="h-7 w-7 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="h-7 w-7 rounded-full bg-muted inline-flex items-center justify-center shrink-0">
                                {r.kind === "agency" ? (
                                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                                ) : (
                                  <User className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                                )}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium truncate flex items-center gap-1.5">
                                {r.name}
                                {r.favorite && <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400 shrink-0" strokeWidth={1.5} />}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate">{r.email}</p>
                            </div>
                          </label>
                        );
                      })}
                      {filteredRecipients.length === 0 && !inviteCandidate && (
                        <p className="text-xs text-muted-foreground p-2 text-center">
                          {language === "es"
                            ? "Sin resultados. Escribe un email para invitar."
                            : "No results. Type an email to invite."}
                        </p>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Subject */}
              <div className="flex items-center gap-2 flex-1 min-w-[260px]">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground shrink-0">
                  {language === "es" ? "Asunto" : "Subject"}
                </span>
                <Input
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="h-8 rounded-full text-xs bg-muted/40 border-border/30"
                />
              </div>
            </div>

            {/* Toggles bar */}
            <div className="flex items-center gap-5 px-5 py-2 border-b border-border/30 bg-card">
              {tpl.supportsSignature !== false && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch checked={includeSignature} onCheckedChange={setIncludeSignature} />
                  <span className="text-xs text-foreground">
                    {language === "es" ? "Incluir firma" : "Include signature"}
                  </span>
                </label>
              )}
              {tpl.supportsAvailability && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch
                    checked={includeAvailability}
                    onCheckedChange={setIncludeAvailability}
                    disabled={availabilityUnits.length === 0}
                  />
                  <span className={cn(
                    "text-xs",
                    availabilityUnits.length === 0 ? "text-muted-foreground" : "text-foreground",
                  )}>
                    {language === "es" ? "Incluir disponibilidad" : "Include availability"}
                    {availabilityUnits.length > 0 && (
                      <span className="text-muted-foreground"> · {availabilityUnits.length}</span>
                    )}
                  </span>
                </label>
              )}
              <span className="ml-auto text-[11px] text-muted-foreground inline-flex items-center gap-1.5">
                <Pencil className="h-3 w-3" strokeWidth={1.5} />
                {language === "es"
                  ? "Click en cualquier texto del email para editarlo"
                  : "Click any text in the email to edit it"}
              </span>
            </div>

            {/* Email body — full width inline editor */}
            <main className="flex-1 min-h-0 overflow-y-auto bg-muted">
              <iframe
                ref={iframeRef}
                title="email-preview"
                className="w-full h-full min-h-[400px] border-0 block"
              />
            </main>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function defaultLangSubject(id: TemplateId, lang: Language) {
  const subjects: Record<TemplateId, { es: string; en: string }> = {
    "last-unit": {
      es: "⚠ Última unidad disponible · Mar Azul Residences",
      en: "⚠ Last unit available · Mar Azul Residences",
    },
    "new-launch": {
      es: "Nuevo lanzamiento · Mar Azul Residences",
      en: "New launch · Mar Azul Residences",
    },
    "new-availability": {
      es: "Nueva disponibilidad · Mar Azul Residences",
      en: "New availability · Mar Azul Residences",
    },
    "blank": {
      es: "",
      en: "",
    },
  };
  return subjects[id][lang];
}
