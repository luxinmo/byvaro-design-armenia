/**
 * SharePromotionDialog · modal de compartir una promoción con una agencia.
 *
 * Flujo:
 *   Paso 1 · email
 *     - Valida formato. Rechaza dominios públicos (gmail, hotmail, …) en línea.
 *     - Al continuar: detecta agencia por dominio (existe / no existe).
 *   Paso 2 · condiciones de colaboración (mismo layout para ambos ramales)
 *     - Comisión de colaboración por venta (por defecto 5%).
 *     - Duración de la colaboración (1/2/3/6/12/Personalizado).
 *     - Forma de pago de comisiones (tabla informativa, 2 tramos).
 *     - Datos obligatorios para el registro (checklist).
 *     - Acción: "Enviar la invitación".
 *
 * Tokens Byvaro usados:
 *   - bg-card / bg-background / bg-muted    → superficies.
 *   - text-foreground / text-muted-foreground → texto.
 *   - bg-primary / text-primary-foreground    → CTA y acento azul.
 *   - border-border                           → divisores.
 *   - rounded-full (pills) · rounded-2xl (cards) · rounded-xl (warnings).
 *
 * TODO(backend):
 *   - POST /api/promociones/:id/share/check   { email } → { exists, agencyId? }
 *   - POST /api/promociones/:id/invitaciones  { email, agencyId?, comision, duracionMeses, ... }
 */
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, AlertTriangle, Mail, X as XIcon, Check, Plus, Trash2, Pencil, UserPlus, Users, Star, ArrowLeft, Search, Send, ChevronDown, ArrowUpDown, Calendar } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { agencies as allAgencies, type Agency } from "@/data/agencies";
import { developerOnlyPromotions } from "@/data/developerPromotions";
import { useInvitaciones } from "@/lib/invitaciones";
import { useFavoriteAgencies } from "@/lib/favoriteAgencies";
import { Flag } from "@/components/ui/Flag";
import { isAgencyVerified } from "@/lib/licenses";
import { getAgencyLicenses } from "@/lib/agencyLicenses";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promotionName: string;
  promotionId: string;
  /** Si se indica, el dialog arranca directamente en el paso
   *  "conditions" con la agencia preseleccionada — útil cuando se
   *  invoca desde la ficha de una agencia (p.ej. click en "Compartir
   *  con Nordic" sobre una promoción concreta). */
  defaultAgencyId?: string;
}

type Step = "choose" | "email" | "matched" | "pick" | "conditions" | "crosssell";
type PickSource = "collaborators" | "favorites";
type DurationKey = "1" | "2" | "3" | "6" | "12" | "custom";
type PickSort = "registros-desc" | "registros-asc" | "ventas-desc" | "ventas-asc" | "name-asc";

const PICK_SORT_LABEL: Record<PickSort, string> = {
  "registros-desc": "Más registros",
  "registros-asc":  "Menos registros",
  "ventas-desc":    "Más ventas",
  "ventas-asc":     "Menos ventas",
  "name-asc":       "Nombre (A-Z)",
};

const PICK_PAGE_SIZE = 12;   // grid inicial · 4 filas × 3 cols
const PICK_PAGE_STEP = 6;    // cada "Ver más" añade 2 filas

const DEFAULT_COVER = "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=900&h=260&fit=crop&q=80";
const DEFAULT_LOGO = "https://api.dicebear.com/9.x/shapes/svg?seed=default-agency&backgroundColor=94a3b8&size=120";

/* Favoritos ahora vienen de `useFavoriteAgencies()` — store central con
 * persistencia en localStorage y sincronización cross-tab. */

/** Proveedores de email personales: no deben matchearse contra agencias. */
const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com",
  "hotmail.com", "hotmail.es", "hotmail.co.uk", "hotmail.fr", "hotmail.de", "hotmail.it",
  "outlook.com", "outlook.es", "outlook.fr", "outlook.de",
  "live.com", "live.es", "live.co.uk", "live.fr",
  "msn.com",
  "yahoo.com", "yahoo.es", "yahoo.co.uk", "yahoo.fr", "yahoo.de", "yahoo.it",
  "ymail.com", "rocketmail.com",
  "icloud.com", "me.com", "mac.com",
  "aol.com", "aim.com",
  "protonmail.com", "proton.me", "pm.me",
  "gmx.com", "gmx.net", "gmx.de", "gmx.es",
  "mail.com", "mail.ru",
  "yandex.com", "yandex.ru",
  "zoho.com",
  "tutanota.com", "tuta.io",
  "orange.fr", "wanadoo.fr", "laposte.net", "sfr.fr", "free.fr",
  "t-online.de", "web.de",
  "libero.it", "virgilio.it", "tiscali.it",
  "terra.es", "telefonica.net",
  "qq.com", "163.com", "126.com", "sina.com", "sina.cn",
  "naver.com", "daum.net",
]);

const DURATION_OPTIONS: { key: DurationKey; label: string }[] = [
  { key: "1", label: "1 mes" },
  { key: "2", label: "2 meses" },
  { key: "3", label: "3 meses" },
  { key: "6", label: "6 meses" },
  { key: "12", label: "12 meses" },
  { key: "custom", label: "Personalizado" },
];

const REQUIRED_FIELDS = [
  "Nombre completo",
  "Las 4 últimas cifras del teléfono",
  "Nacionalidad",
];

const DEFAULT_PAYMENT_SPLITS = [
  { tramo: 1, completado: 25, colaborador: 75 },
  { tramo: 2, completado: 75, colaborador: 25 },
];

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Enmascara un email mostrando primera letra + asteriscos + última letra
 *  del local. `arman@luxinmo.com` → `a***n@luxinmo.com`. */
const maskEmail = (email: string): string => {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0] ?? ""}*@${domain}`;
  return `${local[0]}${"*".repeat(Math.max(3, local.length - 2))}${local[local.length - 1]}@${domain}`;
};

export function SharePromotionDialog({ open, onOpenChange, promotionName, promotionId, defaultAgencyId }: Props) {
  const { invitar } = useInvitaciones();
  const { ids: favoriteIds } = useFavoriteAgencies();
  const [step, setStep] = useState<Step>("choose");
  const [email, setEmail] = useState("");
  const [agencyNameInput, setAgencyNameInput] = useState("");
  const [matchedAgency, setMatchedAgency] = useState<Agency | null>(null);
  const [pickSource, setPickSource] = useState<PickSource>("collaborators");
  const [pickQuery, setPickQuery] = useState("");
  /* Multi-select del picker.
   *   - selectedAgencyIds: todos los ids actualmente seleccionados
   *     (al entrar al pick se preselecciona TODO lo disponible).
   *   - pickSort: orden del grid.
   *   - pickVisibleCount: cuántos cards se muestran (paginación +6 por click). */
  const [selectedAgencyIds, setSelectedAgencyIds] = useState<Set<string>>(new Set());
  const [pickSort, setPickSort] = useState<PickSort>("registros-desc");
  const [pickVisibleCount, setPickVisibleCount] = useState<number>(PICK_PAGE_SIZE);

  const [duration, setDuration] = useState<DurationKey>("12");
  const [customDuration, setCustomDuration] = useState<number>(18);
  const [commission, setCommission] = useState<number>(5);
  const [splits, setSplits] = useState(DEFAULT_PAYMENT_SPLITS);
  const [durationEditing, setDurationEditing] = useState(false);
  const [splitsEditing, setSplitsEditing] = useState(false);

  /* Cross-sell · selección de otras promociones a ofrecer a la misma agencia
     tras la primera invitación. */
  const [crossSelection, setCrossSelection] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      /* Si viene con agencia preseleccionada (flujo "compartir con
         esta agencia" desde la ficha), saltamos al paso de
         condiciones · la comisión por defecto ya sale aquí. */
      const preselectOne = !!defaultAgencyId;
      setStep(preselectOne ? "conditions" : "choose");
      setEmail("");
      setAgencyNameInput("");
      setMatchedAgency(null);
      setPickSource("collaborators");
      setPickQuery("");
      setSelectedAgencyIds(preselectOne ? new Set([defaultAgencyId!]) : new Set());
      setPickSort("registros-desc");
      setPickVisibleCount(PICK_PAGE_SIZE);
      setDuration("12");
      setCustomDuration(18);
      /* Pre-filla comisión desde la propia promoción si existe, para
         que el promotor no tenga que teclearla cada vez. */
      const promo = developerOnlyPromotions.find((p) => p.id === promotionId);
      setCommission(
        typeof promo?.commission === "number" && promo.commission > 0
          ? promo.commission
          : 5,
      );
      setSplits(DEFAULT_PAYMENT_SPLITS);
      setDurationEditing(false);
      setSplitsEditing(false);
      setCrossSelection(new Set());
    }
  }, [open, defaultAgencyId, promotionId]);

  const durationLabel = duration === "custom"
    ? `${customDuration} ${customDuration === 1 ? "mes" : "meses"}`
    : (DURATION_OPTIONS.find(o => o.key === duration)?.label ?? "");

  const totalColaborador = splits.reduce((s, r) => s + r.colaborador, 0);
  const splitsValid = totalColaborador === 100;

  const updateSplit = (idx: number, field: "completado" | "colaborador", value: number) => {
    setSplits(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const addSplitRow = () => {
    setSplits(prev => [...prev, { tramo: prev.length + 1, completado: 0, colaborador: 0 }]);
  };

  const removeSplitRow = (idx: number) => {
    setSplits(prev => prev.filter((_, i) => i !== idx).map((r, i) => ({ ...r, tramo: i + 1 })));
  };

  const trimmedEmail = email.trim().toLowerCase();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);
  const domain = emailOk ? trimmedEmail.split("@")[1] : "";
  const isPublicDomain = emailOk && PUBLIC_EMAIL_DOMAINS.has(domain);

  const candidateAgency = useMemo<Agency | null>(() => {
    if (!emailOk || isPublicDomain || !domain) return null;
    const domainKey = domain.split(".")[0];
    const domainNoTld = domain.replace(/\.[a-z]+$/i, "").replace(/[^a-z0-9]/g, "");
    return allAgencies.find(a => {
      const nameSlug = slugify(a.name);
      return (
        nameSlug.includes(domainKey) ||
        domainKey.includes(nameSlug) ||
        nameSlug.includes(domainNoTld) ||
        domainNoTld.includes(nameSlug)
      );
    }) ?? null;
  }, [emailOk, isPublicDomain, domain]);

  const canContinue = emailOk && !isPublicDomain;

  const handleContinue = () => {
    if (!canContinue) return;
    setMatchedAgency(candidateAgency);
    // Si el dominio hace match con una agencia ya en Byvaro, mostramos el
    // paso intermedio "matched" que confirma la empresa detectada.
    setStep(candidateAgency ? "matched" : "conditions");
  };

  /** Calcula nombre + email destino (matched → convenio; nueva → input). */
  const buildTarget = () => {
    const name = matchedAgency
      ? matchedAgency.name
      : (agencyNameInput.trim() || (domain.split(".")[0].charAt(0).toUpperCase() + domain.split(".")[0].slice(1)));
    const email = matchedAgency
      ? `contacto@${slugify(matchedAgency.name).slice(0, 32) || "agencia"}.com` // TODO(backend)
      : trimmedEmail;
    return { name, email };
  };

  /* Modo multi-agencia: el usuario seleccionó N agencias en el picker. */
  const multiMode = selectedAgencyIds.size > 0;
  const selectedAgenciesList = useMemo(
    () => allAgencies.filter(a => selectedAgencyIds.has(a.id)),
    [selectedAgencyIds],
  );

  const handleSendInvitation = () => {
    if (!splitsValid) return;
    const durationMeses = duration === "custom" ? customDuration : parseInt(duration, 10);

    if (multiMode) {
      /* Creamos N invitaciones, una por agencia, con las mismas condiciones.
         Guardamos `agencyId` para poder cruzar la invitación con la agencia
         en sus vistas (Resumen, /promociones de la agencia, etc). */
      selectedAgenciesList.forEach(ag => {
        invitar({
          emailAgencia: ag.contactoPrincipal?.email ?? `contacto@${slugify(ag.name).slice(0, 32) || "agencia"}.com`,
          nombreAgencia: ag.name,
          agencyId: ag.id,
          mensajePersonalizado: "",
          comisionOfrecida: commission,
          idiomaEmail: "es",
          promocionId,
          promocionNombre: promotionName,
          duracionMeses,
          formaPago: splits,
          datosRequeridos: REQUIRED_FIELDS,
        });
      });
      toast.success(
        `${selectedAgenciesList.length} ${selectedAgenciesList.length === 1 ? "invitación enviada" : "invitaciones enviadas"}`,
        { description: `${promotionName} · ${commission}% · ${durationMeses} ${durationMeses === 1 ? "mes" : "meses"}.` },
      );
      onOpenChange(false);   // sin cross-sell en modo multi
      return;
    }

    /* Modo single-agencia (flujo email o legacy). */
    const { name: targetName, email: targetEmail } = buildTarget();

    invitar({
      emailAgencia: targetEmail,
      nombreAgencia: targetName,
      agencyId: matchedAgency?.id,
      mensajePersonalizado: "",
      comisionOfrecida: commission,
      idiomaEmail: "es",
      promocionId,
      promocionNombre: promotionName,
      duracionMeses,
      formaPago: splits,
      datosRequeridos: REQUIRED_FIELDS,
    });

    toast.success("Invitación enviada", {
      description: `${targetName} recibirá la invitación para colaborar en ${promotionName} · ${commission}% · ${durationMeses} ${durationMeses === 1 ? "mes" : "meses"}.`,
    });

    setStep("crosssell");
  };

  /** Promociones que la agencia AÚN NO colabora. Excluimos la actual y las
   *  que ya tenga en `promotionsCollaborating`. */
  const otherPromotions = useMemo(() => {
    const alreadyCollaborating = new Set<string>(
      matchedAgency?.promotionsCollaborating ?? [],
    );
    alreadyCollaborating.add(promotionId);
    return developerOnlyPromotions.filter(
      p => p.status === "active" && !alreadyCollaborating.has(p.id),
    );
  }, [matchedAgency, promotionId]);

  const toggleCross = (id: string) => {
    setCrossSelection(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCrossInvite = () => {
    const ids = Array.from(crossSelection);
    if (ids.length === 0) { onOpenChange(false); return; }

    const durationMeses = duration === "custom" ? customDuration : parseInt(duration, 10);
    const { name: targetName, email: targetEmail } = buildTarget();

    ids.forEach(pid => {
      const promo = developerOnlyPromotions.find(p => p.id === pid);
      if (!promo) return;
      invitar({
        emailAgencia: targetEmail,
        nombreAgencia: targetName,
        agencyId: matchedAgency?.id,
        mensajePersonalizado: "",
        comisionOfrecida: commission,
        idiomaEmail: "es",
        promocionId: promo.id,
        promocionNombre: promo.name,
        duracionMeses,
        formaPago: splits,
        datosRequeridos: REQUIRED_FIELDS,
      });
    });

    toast.success(
      `Invitaciones enviadas a ${ids.length} ${ids.length === 1 ? "promoción" : "promociones"} más`,
      { description: `${targetName} recibirá una invitación por cada una con las mismas condiciones.` },
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 overflow-hidden bg-card border-0",
          step === "pick" ? "max-w-[1040px]" :
          step === "conditions" || step === "crosssell" ? "max-w-[560px]" :
          "max-w-[480px]",
        )}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>
            {step === "choose" && "Compartir promoción"}
            {step === "email" && "Invitar nueva agencia"}
            {step === "matched" && "Empresa detectada"}
            {step === "pick" && (pickSource === "collaborators" ? "Mis colaboradores" : "Mis favoritos")}
            {step === "conditions" && "Condiciones de colaboración"}
            {step === "crosssell" && "Compartir más promociones"}
          </DialogTitle>
          <DialogDescription>{promotionName}</DialogDescription>
        </DialogHeader>

        {/* ══════════════ STEP 0 · ELEGIR DESTINO ══════════════ */}
        {step === "choose" && (() => {
          /* Contamos para cada fuente cuántas agencias están disponibles
           *  (NO tienen aún esta promoción) y cuántas ya colaboran. Así
           *  el usuario ve de un vistazo qué puede hacer con qué opción. */
          const hasPromo = (a: Agency) => (a.promotionsCollaborating ?? []).includes(promotionId);
          const activeCollabs = allAgencies.filter(a => a.status === "active");
          const favs = allAgencies.filter(a => favoriteIds.has(a.id));
          const collabAvailable = activeCollabs.filter(a => !hasPromo(a));
          const favAvailable = favs.filter(a => !hasPromo(a));
          const collabAvail = collabAvailable.length;
          const collabAlready = activeCollabs.length - collabAvail;
          const favAvail = favAvailable.length;
          const favAlready = favs.length - favAvail;

          const openPicker = (src: PickSource, ids: string[]) => {
            setPickSource(src);
            setSelectedAgencyIds(new Set(ids));
            setPickSort("registros-desc");
            setPickVisibleCount(PICK_PAGE_SIZE);
            setStep("pick");
          };

          const options = [
            {
              id: "new" as const,
              icon: UserPlus,
              title: "Nueva invitación",
              desc: "Invitar a una agencia que no está en Byvaro (email corporativo).",
              available: true,
              disabled: false,
              onClick: () => setStep("email"),
            },
            {
              id: "collaborators" as const,
              icon: Users,
              title: "Mis colaboradores",
              desc: collabAvail > 0
                ? `${collabAvail} ${collabAvail === 1 ? "agencia colaboradora" : "agencias colaboradoras"} que aún no ${collabAvail === 1 ? "tiene" : "tienen"} esta promoción${collabAlready > 0 ? ` · ${collabAlready} ya ${collabAlready === 1 ? "colabora" : "colaboran"}` : ""}.`
                : activeCollabs.length === 0
                  ? "No tienes colaboradores activos todavía."
                  : "Todos tus colaboradores ya colaboran en esta promoción.",
              available: collabAvail > 0,
              disabled: collabAvail === 0,
              onClick: () => openPicker("collaborators", collabAvailable.map(a => a.id)),
            },
            {
              id: "favorites" as const,
              icon: Star,
              title: "Mis favoritos",
              desc: favAvail > 0
                ? `${favAvail} ${favAvail === 1 ? "favorita" : "favoritas"} que aún no ${favAvail === 1 ? "colabora" : "colaboran"} en esta promoción${favAlready > 0 ? ` · ${favAlready} ya ${favAlready === 1 ? "está dentro" : "están dentro"}` : ""}.`
                : favs.length === 0
                  ? "Aún no has marcado agencias como favoritas."
                  : "Todas tus favoritas ya colaboran en esta promoción.",
              available: favAvail > 0,
              disabled: favAvail === 0,
              onClick: () => openPicker("favorites", favAvailable.map(a => a.id)),
            },
          ];

          return (
            <div className="p-6 sm:p-7">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                <h2 className="text-base font-semibold text-foreground">Compartir promoción</h2>
              </div>
              <p className="text-xs text-muted-foreground mb-5">
                ¿Con quién quieres compartir <span className="text-foreground/80">{promotionName}</span>?
                Solo se muestran agencias que <span className="text-foreground/80">aún no colaboran</span> en esta promo.
              </p>

              <div className="space-y-2">
                {options.map(opt => (
                  <button
                    key={opt.id}
                    onClick={opt.disabled ? undefined : opt.onClick}
                    disabled={opt.disabled}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-2xl border p-4 text-left transition-all",
                      opt.disabled
                        ? "border-border bg-muted/40 cursor-not-allowed opacity-70"
                        : "border-border bg-card hover:border-foreground/30 hover:bg-muted",
                    )}
                  >
                    <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      <opt.icon className="h-4 w-4 text-foreground" strokeWidth={1.75} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                        {opt.title}
                        {opt.id !== "new" && opt.available && (
                          <span className="inline-flex items-center h-4 px-1.5 rounded-full bg-foreground text-background text-[9.5px] font-bold tabular-nums">
                            {opt.id === "collaborators" ? collabAvail : favAvail}
                          </span>
                        )}
                        {opt.id !== "new" && opt.disabled && (
                          <span className="inline-flex items-center h-4 px-1.5 rounded-full bg-muted text-muted-foreground text-[9.5px] font-medium">
                            sin disponibles
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ══════════════ STEP · PICK (grid multi-select) ══════════════ */}
        {step === "pick" && (() => {
          /* Fuente bruta según la fuente elegida */
          const rawSource = pickSource === "favorites"
            ? allAgencies.filter(a => favoriteIds.has(a.id))
            : allAgencies.filter(a => a.status === "active");
          /* Excluimos las que YA colaboran en esta promoción */
          const alreadyCollaborating = rawSource.filter(a => (a.promotionsCollaborating ?? []).includes(promotionId));
          const source = rawSource.filter(a => !(a.promotionsCollaborating ?? []).includes(promotionId));

          /* Orden */
          const sorted = [...source].sort((a, b) => {
            switch (pickSort) {
              case "registros-desc": return (b.registrosAportados ?? b.registrations) - (a.registrosAportados ?? a.registrations);
              case "registros-asc":  return (a.registrosAportados ?? a.registrations) - (b.registrosAportados ?? b.registrations);
              case "ventas-desc":    return (b.ventasCerradas ?? 0) - (a.ventasCerradas ?? 0);
              case "ventas-asc":     return (a.ventasCerradas ?? 0) - (b.ventasCerradas ?? 0);
              case "name-asc":       return a.name.localeCompare(b.name);
              default: return 0;
            }
          });

          const visible = sorted.slice(0, pickVisibleCount);
          const hasMore = sorted.length > pickVisibleCount;
          const remaining = sorted.length - pickVisibleCount;

          const title = pickSource === "favorites" ? "Mis favoritos" : "Mis colaboradores";
          const selCount = selectedAgencyIds.size;
          const allSelected = selCount === source.length && source.length > 0;

          const toggleId = (id: string) => {
            setSelectedAgencyIds(prev => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            });
          };
          const selectAll = () => setSelectedAgencyIds(new Set(source.map(a => a.id)));
          const selectNone = () => setSelectedAgencyIds(new Set());
          const loadMore = () => setPickVisibleCount(c => c + PICK_PAGE_STEP);

          return (
            <div className="flex flex-col max-h-[min(88vh,860px)]">
              {/* Header sticky */}
              <header className="shrink-0 px-6 sm:px-7 pt-6 pb-4 border-b border-border">
                <button
                  onClick={() => setStep("choose")}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Volver
                </button>

                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {pickSource === "favorites"
                        ? <Star className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                        : <Users className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />}
                      <h2 className="text-base font-semibold text-foreground">{title}</h2>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Vas a compartir <span className="text-foreground/80">{promotionName}</span> con las seleccionadas.
                      {alreadyCollaborating.length > 0 && (
                        <span className="text-muted-foreground/70">
                          {" · "}{alreadyCollaborating.length} ya {alreadyCollaborating.length === 1 ? "colabora" : "colaboran"}
                          {" · ocultas."}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <PickSortDropdown value={pickSort} onChange={setPickSort} />
                    <button
                      onClick={allSelected ? selectNone : selectAll}
                      className="h-8 px-3 rounded-full border border-border bg-background text-[11.5px] font-medium text-foreground hover:bg-muted transition-colors"
                    >
                      {allSelected ? "Desmarcar todas" : "Seleccionar todas"}
                    </button>
                  </div>
                </div>
              </header>

              {/* Grid scrolleable */}
              <div className="flex-1 overflow-y-auto px-6 sm:px-7 py-5 bg-muted/20">
                {source.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-card p-8 text-center">
                    <p className="text-sm font-medium text-foreground mb-1">Sin agencias disponibles</p>
                    <p className="text-xs text-muted-foreground">
                      {pickSource === "favorites"
                        ? "Todas tus favoritas ya colaboran en esta promoción."
                        : "Todos tus colaboradores ya están en esta promoción."}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {visible.map(a => (
                        <SelectableAgencyCard
                          key={a.id}
                          agency={a}
                          selected={selectedAgencyIds.has(a.id)}
                          onToggle={() => toggleId(a.id)}
                        />
                      ))}
                    </div>
                    {hasMore && (
                      <div className="mt-4 flex justify-center">
                        <button
                          onClick={loadMore}
                          className="h-9 px-4 rounded-full border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted shadow-soft transition-colors"
                        >
                          {remaining <= PICK_PAGE_STEP
                            ? `Ver ${remaining === 1 ? "la" : "las"} ${remaining} restante${remaining === 1 ? "" : "s"}`
                            : <>Ver {PICK_PAGE_STEP} más<span className="text-muted-foreground font-normal ml-1.5">· {remaining} restantes</span></>}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer sticky · contador + CTA */}
              <footer className="shrink-0 px-6 sm:px-7 py-4 border-t border-border bg-card flex items-center justify-between gap-3 flex-wrap">
                <p className="text-xs text-muted-foreground">
                  <span className="text-foreground font-semibold tabular-nums">{selCount}</span>
                  {" de "}
                  <span className="tabular-nums">{source.length}</span>
                  {" "}{source.length === 1 ? "agencia" : "agencias"} seleccionada{selCount === 1 ? "" : "s"}
                </p>
                <button
                  onClick={() => setStep("conditions")}
                  disabled={selCount === 0}
                  className={cn(
                    "inline-flex items-center gap-1.5 h-10 px-5 rounded-full text-sm font-semibold transition-colors shadow-soft",
                    selCount > 0
                      ? "bg-foreground text-background hover:bg-foreground/90"
                      : "bg-muted text-muted-foreground cursor-not-allowed",
                  )}
                >
                  Continuar
                  {selCount > 0 && <span className="inline-flex items-center h-5 min-w-5 px-1.5 rounded-full bg-background text-foreground text-[10px] font-bold tabular-nums">{selCount}</span>}
                </button>
              </footer>
            </div>
          );
        })()}

        {/* ══════════════ STEP 1 · EMAIL ══════════════ */}
        {step === "email" && (
          <div className="p-8">
            <button
              onClick={() => setStep("choose")}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Volver
            </button>
            {/* Clúster de 3 burbujas (tokens Byvaro) */}
            <div className="flex justify-center mb-6">
              <div className="relative h-16 w-24">
                <div className="absolute left-0 top-0 h-16 w-16 rounded-full bg-foreground flex items-center justify-center shadow-soft ring-2 ring-card">
                  <Building2 className="h-6 w-6 text-background/80" strokeWidth={1.5} />
                </div>
                <div className="absolute left-4 top-0 h-16 w-16 rounded-full bg-primary flex items-center justify-center shadow-soft ring-2 ring-card">
                  <Building2 className="h-6 w-6 text-primary-foreground" strokeWidth={1.5} />
                </div>
                <div className="absolute left-8 top-0 h-16 w-16 rounded-full bg-muted-foreground flex items-center justify-center shadow-soft ring-2 ring-card">
                  <Building2 className="h-6 w-6 text-background/80" strokeWidth={1.5} />
                </div>
              </div>
            </div>

            <h2 className="text-[22px] sm:text-[28px] font-semibold text-center text-foreground mb-2">
              Invitar nueva agencia
            </h2>
            <p className="text-sm text-muted-foreground text-center mb-7">
              Invita a tu red con solo un email corporativo
            </p>

            <div className="space-y-2 mb-3">
              <Label className="text-xs text-foreground">
                <span className="text-destructive">*</span> Email
              </Label>
              <Input
                type="email"
                placeholder="Introduce el email de la agencia"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={cn(
                  "h-10 rounded-full text-sm bg-background",
                  isPublicDomain && "border-destructive/40 focus-visible:ring-destructive/30",
                )}
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter" && canContinue) handleContinue(); }}
              />
            </div>

            {/* Nombre de agencia (opcional) — si no rellena, el email quedará sin nombre en la bandeja del destinatario */}
            <div className="space-y-2 mb-3">
              <Label className="text-xs text-muted-foreground">
                Nombre de la agencia <span className="text-muted-foreground/70">(opcional)</span>
              </Label>
              <Input
                type="text"
                placeholder="Ej. Prime Properties Costa del Sol"
                value={agencyNameInput}
                onChange={(e) => setAgencyNameInput(e.target.value)}
                className="h-10 rounded-full text-sm bg-background"
                onKeyDown={(e) => { if (e.key === "Enter" && canContinue) handleContinue(); }}
              />
              <p className="text-[10px] text-muted-foreground pl-1 leading-snug">
                Si lo dejas vacío, el email irá dirigido solo a la dirección. Recomendado para que se identifique tu invitación.
              </p>
            </div>

            {isPublicDomain && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 mb-4 flex items-start gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" strokeWidth={2} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-destructive mb-0.5">Email personal no permitido</p>
                  <p className="text-[11px] text-destructive/80">
                    Usa el email corporativo de la agencia (no {domain}).
                  </p>
                </div>
              </div>
            )}

            <Button
              className="w-full rounded-full h-10 text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 mt-2 shadow-soft"
              disabled={!canContinue}
              onClick={handleContinue}
            >
              Continuar
            </Button>
          </div>
        )}

        {/* ══════════════ STEP · MATCHED (empresa detectada en Byvaro) ══════════════ */}
        {step === "matched" && matchedAgency && (
          <div className="p-6 sm:p-7">
            <button
              onClick={() => setStep("email")}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-5 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Volver
            </button>

            <h2 className="text-[20px] sm:text-[22px] font-semibold text-center text-foreground mb-5 leading-snug">
              Hemos encontrado esta empresa
            </h2>

            {/* Card Byvaro con logo + nombre */}
            <div className="rounded-2xl bg-muted p-6 sm:p-7 mb-5 flex flex-col items-center gap-4">
              {matchedAgency.logo ? (
                <img
                  src={matchedAgency.logo}
                  alt={matchedAgency.name}
                  className="h-20 w-20 rounded-full object-cover ring-2 ring-card shadow-soft"
                />
              ) : (
                <div className="h-20 w-20 rounded-full bg-foreground flex items-center justify-center ring-2 ring-card shadow-soft">
                  <span className="text-2xl font-bold text-background">
                    {matchedAgency.name[0]?.toUpperCase() ?? "A"}
                  </span>
                </div>
              )}
              <div className="text-center">
                <p className="text-base sm:text-[17px] font-semibold text-foreground leading-snug">
                  {matchedAgency.name}
                </p>
                <p className="text-xs text-muted-foreground mt-1 tabular-nums">
                  {maskEmail(trimmedEmail)}
                </p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground text-center leading-relaxed mb-2">
              Esta empresa ya está en Byvaro. Al continuar definirás las condiciones
              de colaboración para esta promoción.
            </p>
            <p className="text-[11px] text-muted-foreground/80 text-center leading-relaxed mb-6">
              La notificación llegará a <span className="text-foreground font-medium">{trimmedEmail}</span>
              {" "}y al contacto principal de la agencia.
            </p>

            <Button
              className="w-full rounded-full h-10 text-sm bg-primary text-primary-foreground hover:bg-primary/90 shadow-soft"
              onClick={() => setStep("conditions")}
            >
              Continuar
            </Button>
          </div>
        )}

        {/* ══════════════ STEP 2 · CONDICIONES (compacto · editable) ══════════════ */}
        {step === "conditions" && (
          <div className="max-h-[85vh] overflow-y-auto">
            {/* Header sticky */}
            <div className="sticky top-0 z-10 bg-card border-b border-border px-5 py-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={() => setStep(multiMode ? "pick" : email ? "email" : "choose")}
                  className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                  aria-label="Volver"
                >
                  <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Mail className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-foreground truncate leading-tight">
                    {multiMode
                      ? `Condiciones para ${selectedAgenciesList.length} ${selectedAgenciesList.length === 1 ? "agencia" : "agencias"}`
                      : "Condiciones de colaboración"}
                  </h2>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {multiMode
                      ? `${promotionName} · mismas condiciones para todas`
                      : `${matchedAgency?.name || agencyNameInput.trim() || domain} · ${promotionName}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                aria-label="Cerrar"
              >
                <XIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* ── Comisión (hover para editar) ── */}
              <section>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Comisión por venta
                </p>
                <div className="rounded-2xl bg-muted p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-foreground font-medium">Aplicada sobre el importe de la venta</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">IVA incluido</p>
                  </div>
                  <InlineEditNumber
                    value={commission}
                    onChange={setCommission}
                    suffix="%"
                    min={0}
                    max={100}
                    step={0.5}
                  />
                </div>
              </section>

              {/* ── Duración (reposo · hover lápiz · click expande chips) ── */}
              <section>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Duración de la colaboración
                </p>
                {!durationEditing ? (
                  <button
                    type="button"
                    onClick={() => setDurationEditing(true)}
                    className="group flex items-center gap-2 rounded-full border border-transparent bg-muted px-3 py-1.5 transition-colors hover:border-border hover:bg-card"
                  >
                    <span className="text-xs font-semibold text-foreground">{durationLabel}</span>
                    <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={1.75} />
                  </button>
                ) : (
                  <div className="rounded-xl border border-border bg-card p-3">
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {DURATION_OPTIONS.map(opt => {
                        const selected = duration === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => {
                              setDuration(opt.key);
                              if (opt.key !== "custom") setDurationEditing(false);
                            }}
                            className={cn(
                              "h-7 px-3 rounded-full text-[11px] font-medium transition-colors border",
                              selected
                                ? "bg-foreground text-background border-foreground"
                                : "bg-card text-foreground border-border hover:bg-muted",
                            )}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    {duration === "custom" && (
                      <div className="flex items-center gap-2 pt-1">
                        <InlineEditNumber
                          value={customDuration}
                          onChange={setCustomDuration}
                          suffix={customDuration === 1 ? "mes" : "meses"}
                          min={1}
                          max={60}
                        />
                        <button
                          type="button"
                          onClick={() => setDurationEditing(false)}
                          className="text-[10px] font-medium text-muted-foreground hover:text-foreground ml-auto"
                        >
                          Listo
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* ── Forma de pago (reposo · hover pencil en cada celda · toggle edición) ── */}
              <section>
                <div className="flex items-baseline justify-between mb-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Forma de pago al colaborador
                  </p>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-[10px] font-medium tabular-nums",
                        splitsValid ? "text-muted-foreground" : "text-destructive",
                      )}
                    >
                      Total: {totalColaborador}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setSplitsEditing(v => !v)}
                      className="text-[10px] font-medium text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1"
                    >
                      <Pencil className="h-2.5 w-2.5" strokeWidth={2} />
                      {splitsEditing ? "Listo" : "Editar"}
                    </button>
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card overflow-hidden">
                  <div className="grid grid-cols-[40px_1fr_1fr_28px] gap-2 px-3 py-2 bg-muted/60 border-b border-border">
                    <p className="text-[10px] text-muted-foreground">Tramo</p>
                    <p className="text-[10px] text-muted-foreground">Pago completado</p>
                    <p className="text-[10px] text-muted-foreground">A colaborador</p>
                    <span className="sr-only">Acciones</span>
                  </div>
                  {splits.map((row, i) => (
                    <div
                      key={i}
                      className={cn(
                        "grid grid-cols-[40px_1fr_1fr_28px] gap-2 items-center px-3 py-2",
                        i < splits.length - 1 && "border-b border-border",
                      )}
                    >
                      <p className="text-xs text-muted-foreground tabular-nums">{row.tramo}</p>
                      <div>
                        <InlineEditNumber
                          value={row.completado}
                          onChange={(v) => updateSplit(i, "completado", v)}
                          suffix="%"
                          size="sm"
                        />
                      </div>
                      <div>
                        <InlineEditNumber
                          value={row.colaborador}
                          onChange={(v) => updateSplit(i, "colaborador", v)}
                          suffix="%"
                          size="sm"
                        />
                      </div>
                      {splitsEditing ? (
                        <button
                          type="button"
                          onClick={() => removeSplitRow(i)}
                          disabled={splits.length <= 1}
                          className="h-6 w-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                          aria-label="Eliminar tramo"
                        >
                          <Trash2 className="h-3 w-3" strokeWidth={1.75} />
                        </button>
                      ) : (
                        <span />
                      )}
                    </div>
                  ))}
                  {splitsEditing && (
                    <button
                      type="button"
                      onClick={addSplitRow}
                      className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border-t border-border"
                    >
                      <Plus className="h-3 w-3" strokeWidth={2} />
                      Añadir tramo
                    </button>
                  )}
                </div>
                {!splitsValid && (
                  <p className="text-[10px] text-destructive mt-1.5 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" strokeWidth={2} />
                    La suma de % al colaborador debe ser 100%
                  </p>
                )}
              </section>

              {/* ── Datos obligatorios ── */}
              <section>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Datos obligatorios para el registro
                </p>
                <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
                  {REQUIRED_FIELDS.map(field => (
                    <div key={field} className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-foreground shrink-0" strokeWidth={2} />
                      <span className="text-xs text-foreground">{field}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Footer sticky */}
            <div className="sticky bottom-0 bg-card border-t border-border px-5 py-3">
              {multiMode && selectedAgenciesList.length > 0 && (
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {selectedAgenciesList.slice(0, 6).map(a => (
                      <img
                        key={a.id}
                        src={a.logo || DEFAULT_LOGO}
                        alt={a.name}
                        title={a.name}
                        className="h-7 w-7 rounded-full object-cover ring-2 ring-card bg-muted"
                      />
                    ))}
                    {selectedAgenciesList.length > 6 && (
                      <span className="h-7 w-7 rounded-full bg-muted ring-2 ring-card flex items-center justify-center text-[10px] font-bold text-foreground">
                        +{selectedAgenciesList.length - 6}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {selectedAgenciesList.length === 1
                      ? selectedAgenciesList[0].name
                      : `${selectedAgenciesList.length} agencias seleccionadas`}
                  </p>
                </div>
              )}
              <Button
                className="w-full rounded-full h-10 text-sm bg-primary text-primary-foreground hover:bg-primary/90 shadow-soft disabled:opacity-50"
                onClick={handleSendInvitation}
                disabled={!splitsValid || (multiMode && selectedAgenciesList.length === 0)}
              >
                {multiMode
                  ? `Enviar ${selectedAgenciesList.length} ${selectedAgenciesList.length === 1 ? "invitación" : "invitaciones"}`
                  : "Enviar la invitación"}
              </Button>
            </div>
          </div>
        )}

        {/* ══════════════ STEP · CROSS-SELL (tras enviar) ══════════════ */}
        {step === "crosssell" && (() => {
          const { name: targetName } = buildTarget();
          const durationMeses = duration === "custom" ? customDuration : parseInt(duration, 10);
          const selectedCount = crossSelection.size;
          return (
            <div className="max-h-[85vh] overflow-y-auto">
              {/* Header sticky */}
              <div className="sticky top-0 z-10 bg-card border-b border-border px-5 py-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Send className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-foreground truncate leading-tight">
                      Invitación enviada
                    </h2>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {targetName} · {promotionName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onOpenChange(false)}
                  className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                  aria-label="Cerrar"
                >
                  <XIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>

              <div className="p-5 sm:p-6">
                {/* Banner éxito */}
                <div className="flex items-start gap-3 rounded-2xl bg-muted p-4 mb-5">
                  <div className="h-8 w-8 rounded-full bg-success/15 flex items-center justify-center shrink-0">
                    <Check className="h-4 w-4 text-success" strokeWidth={2.5} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground leading-snug">
                      Listo. {targetName} recibirá la invitación.
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      Comisión {commission}% · {durationMeses} {durationMeses === 1 ? "mes" : "meses"}. Veremos su respuesta en Colaboradores.
                    </p>
                  </div>
                </div>

                {otherPromotions.length > 0 ? (
                  <>
                    <div className="mb-3">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                        ¿Compartir más promociones con {targetName}?
                      </p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Hay {otherPromotions.length} {otherPromotions.length === 1 ? "promoción tuya" : "promociones tuyas"} donde todavía no colabora. Selecciona las que quieras invitarle — se enviarán con las mismas condiciones.
                      </p>
                    </div>

                    <ul className="space-y-2 mb-4">
                      {otherPromotions.map(p => {
                        const selected = crossSelection.has(p.id);
                        return (
                          <li key={p.id}>
                            <button
                              type="button"
                              onClick={() => toggleCross(p.id)}
                              className={cn(
                                "w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                                selected
                                  ? "border-foreground bg-muted"
                                  : "border-border bg-card hover:bg-muted",
                              )}
                            >
                              {/* Checkbox */}
                              <span
                                className={cn(
                                  "h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-colors",
                                  selected
                                    ? "border-foreground bg-foreground"
                                    : "border-border bg-background",
                                )}
                              >
                                {selected && <Check className="h-3 w-3 text-background" strokeWidth={3} />}
                              </span>
                              {/* Thumb */}
                              {p.image ? (
                                <img src={p.image} alt="" className="h-12 w-14 rounded-lg object-cover shrink-0" />
                              ) : (
                                <div className="h-12 w-14 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                  <Building2 className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                                </div>
                              )}
                              {/* Meta */}
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {p.location}
                                  {p.delivery ? ` · Entrega ${p.delivery}` : ""}
                                  {p.availableUnits != null ? ` · ${p.availableUnits}/${p.totalUnits} disponibles` : ""}
                                </p>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>

                    {otherPromotions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const all = new Set(otherPromotions.map(p => p.id));
                          if (crossSelection.size === otherPromotions.length) setCrossSelection(new Set());
                          else setCrossSelection(all);
                        }}
                        className="text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
                      >
                        {crossSelection.size === otherPromotions.length ? "Quitar selección" : "Seleccionar todas"}
                      </button>
                    )}
                  </>
                ) : (
                  <div className="rounded-2xl border border-border bg-muted/40 p-6 text-center">
                    <p className="text-sm font-medium text-foreground mb-1">No hay más promociones que compartir</p>
                    <p className="text-xs text-muted-foreground">
                      {targetName} ya colabora (o tiene invitación pendiente) en el resto de tu cartera.
                    </p>
                  </div>
                )}
              </div>

              {/* Footer sticky */}
              <div className="sticky bottom-0 bg-card border-t border-border px-5 py-3 flex items-center gap-2">
                <Button
                  variant="ghost"
                  className="flex-1 rounded-full h-10 text-sm text-muted-foreground hover:text-foreground hover:bg-muted"
                  onClick={() => onOpenChange(false)}
                >
                  {otherPromotions.length === 0 ? "Cerrar" : "Saltar"}
                </Button>
                {otherPromotions.length > 0 && (
                  <Button
                    className="flex-1 rounded-full h-10 text-sm bg-primary text-primary-foreground hover:bg-primary/90 shadow-soft disabled:opacity-50"
                    onClick={handleCrossInvite}
                    disabled={selectedCount === 0}
                  >
                    {selectedCount === 0
                      ? "Invitar"
                      : `Invitar a ${selectedCount} ${selectedCount === 1 ? "promoción" : "promociones"}`}
                  </Button>
                )}
              </div>
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>
  );
}

/* ────────────────────────────────────────────────────────────
   InlineEditNumber · valor numérico con modo lectura + edición.
   Reposo: muestra el número en pill discreto; al hover aparece
   un icono de lápiz. Click → input foco automático. Enter/Blur
   commits; Escape descarta.
   ──────────────────────────────────────────────────────────── */
function InlineEditNumber({
  value, onChange, suffix, min = 0, max = 100, step = 1, size = "md",
}: {
  value: number;
  onChange: (v: number) => void;
  suffix: string;
  min?: number;
  max?: number;
  step?: number;
  size?: "sm" | "md";
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState<string>(String(value));

  const start = () => { setLocal(String(value)); setEditing(true); };
  const commit = () => {
    const n = parseFloat(local);
    if (!isNaN(n)) onChange(Math.max(min, Math.min(max, n)));
    setEditing(false);
  };
  const cancel = () => { setEditing(false); };

  const paddingX = size === "sm" ? "px-2" : "px-2.5";
  const inputW = size === "sm" ? "w-10" : "w-12";
  const textSize = size === "sm" ? "text-xs" : "text-sm";
  const numH = size === "sm" ? "h-5" : "h-6";

  if (editing) {
    return (
      <span className={cn("inline-flex items-center gap-0.5 rounded-full bg-card border border-primary/60 py-0.5", paddingX)}>
        <Input
          type="number"
          min={min}
          max={max}
          step={step}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commit(); }
            else if (e.key === "Escape") { e.preventDefault(); cancel(); }
          }}
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          className={cn(
            "border-0 bg-transparent px-0 text-right font-semibold text-foreground focus-visible:ring-0 tabular-nums",
            numH, inputW, textSize,
          )}
        />
        <span className={cn("font-medium text-muted-foreground", textSize)}>{suffix}</span>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      className={cn(
        "group inline-flex items-center gap-1 rounded-full border border-transparent py-0.5 transition-colors hover:bg-muted hover:border-border",
        paddingX,
      )}
    >
      <span className={cn("font-semibold text-foreground tabular-nums", textSize)}>{value}</span>
      <span className={cn("font-medium text-muted-foreground", textSize)}>{suffix}</span>
      <Pencil className={cn("text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-0.5", size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3")} strokeWidth={1.75} />
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   SelectableAgencyCard · card compacta para el grid multi-select.
   Reproduce el lenguaje visual de FeatureCardV3 pero sin kebab ni
   acciones navegables — la card entera es el toggle de selección.
   ══════════════════════════════════════════════════════════════════════ */

function SelectableAgencyCard({
  agency: a, selected, onToggle,
}: { agency: Agency; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border bg-card shadow-soft text-left transition-all focus:outline-none",
        "hover:shadow-soft-lg hover:-translate-y-0.5",
        !selected && "opacity-55 hover:opacity-100",
      )}
    >
      {/* Cover */}
      <div
        className="h-20 bg-muted relative"
        style={{
          backgroundImage: `url(${a.cover || DEFAULT_COVER})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
        <div
          className={cn(
            "absolute top-2 right-2 h-6 w-6 rounded-full backdrop-blur flex items-center justify-center transition-colors",
            selected
              ? "bg-foreground text-background"
              : "bg-background/90 text-muted-foreground border border-border",
          )}
        >
          {selected && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
        </div>
      </div>

      {/* Body */}
      <div className="p-3 -mt-8 relative">
        <img
          src={a.logo || DEFAULT_LOGO}
          alt=""
          className="h-11 w-11 rounded-full object-cover border-2 border-card shadow-soft bg-background"
        />
        <div className="mt-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="text-[13.5px] font-bold text-foreground truncate leading-tight">{a.name}</h3>
            {isAgencyVerified(getAgencyLicenses(a)) && <VerifiedBadge size="sm" />}
          </div>
          <p className="text-[10.5px] text-muted-foreground truncate mt-0.5">{a.location}</p>
        </div>

        {/* Mercados · banderas */}
        {a.mercados && a.mercados.length > 0 && (
          <div className="mt-2 flex items-center gap-1 flex-wrap">
            {a.mercados.slice(0, 5).map(m => (
              <Flag key={m} iso={m} size={14} shape="rect" title={m} />
            ))}
            {a.mercados.length > 5 && (
              <span className="text-[9.5px] text-muted-foreground ml-0.5">+{a.mercados.length - 5}</span>
            )}
          </div>
        )}

        {/* Stats · visitas · registros · ventas */}
        <div className="grid grid-cols-3 gap-2 mt-3 rounded-xl bg-muted/60 p-2">
          <div className="text-center min-w-0">
            <p className="text-[12px] font-bold text-foreground tabular-nums leading-none">{a.visitsCount ?? 0}</p>
            <p className="text-[8.5px] text-muted-foreground uppercase tracking-wider mt-1">Visitas</p>
          </div>
          <div className="text-center min-w-0">
            <p className="text-[12px] font-bold text-foreground tabular-nums leading-none">{a.registrosAportados ?? a.registrations}</p>
            <p className="text-[8.5px] text-muted-foreground uppercase tracking-wider mt-1">Registros</p>
          </div>
          <div className="text-center min-w-0">
            <p className="text-[12px] font-bold text-foreground tabular-nums leading-none">{a.ventasCerradas ?? 0}</p>
            <p className="text-[8.5px] text-muted-foreground uppercase tracking-wider mt-1">Ventas</p>
          </div>
        </div>

        {/* Meta · antigüedad + tamaño equipo */}
        <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
          {a.collaboratingSince && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-2.5 w-2.5" strokeWidth={1.75} />
              Desde {a.collaboratingSince}
            </span>
          )}
          {a.teamSize != null && (
            <span className="inline-flex items-center gap-1">
              <Users className="h-2.5 w-2.5" strokeWidth={1.75} />
              {a.teamSize} agentes
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   PickSortDropdown · selector de orden del grid
   ══════════════════════════════════════════════════════════════════════ */

function PickSortDropdown({
  value, onChange,
}: { value: PickSort; onChange: (v: PickSort) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-border bg-background text-[11.5px] font-medium text-foreground hover:bg-muted transition-colors"
        >
          <ArrowUpDown className="h-3 w-3 text-muted-foreground" strokeWidth={1.75} />
          <span className="text-muted-foreground">Ordenar:</span>
          <span className="font-semibold">{PICK_SORT_LABEL[value]}</span>
          <ChevronDown className={cn("h-3 w-3 opacity-60 transition-transform", open && "rotate-180")} strokeWidth={2} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-1">
        {(Object.keys(PICK_SORT_LABEL) as PickSort[]).map(k => {
          const isSel = value === k;
          return (
            <button
              key={k}
              onClick={() => { onChange(k); setOpen(false); }}
              className={cn(
                "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12.5px] text-left hover:bg-muted transition-colors",
                isSel && "bg-muted",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  isSel ? "bg-foreground" : "bg-transparent",
                )}
              />
              <span className="text-foreground">{PICK_SORT_LABEL[k]}</span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
