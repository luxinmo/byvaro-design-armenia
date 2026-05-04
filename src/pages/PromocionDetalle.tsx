import { useMemo, useRef, useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useTabParam } from "@/lib/useTabParam";
import { getDraft, saveDraft as persistDraft, deleteDraft, draftToPromotionData, DRAFT_ID_PREFIX, type PromotionDraft } from "@/lib/promotionDrafts";
import { deleteCreatedPromotion } from "@/lib/promotionsStorage";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import type { WizardState, FotoItem, FotoCategoria } from "@/components/crear-promocion/types";
import { faseConstruccionOptions, constructionPhaseLabelFromProgress } from "@/components/crear-promocion/options";
import { unitDataToUnit, mergeUnitIntoUnitData } from "@/lib/unitDataAdapter";
import type { Unit } from "@/data/units";
import { promotions, getBuildingTypeLabel } from "@/data/promotions";
import { developerOnlyPromotions, type DevPromotion, type Comercial, type ComercialPermissions } from "@/data/developerPromotions";
import { findPromotionByParam, promotionHref, contactHref, registroHref, leadHref } from "@/lib/urls";
import { agencies, countAgenciesForPromotion, getAgencyShareStats, type Agency } from "@/data/agencies";
import { AgenciasTabStats } from "@/components/promotions/detail/AgenciasTabStats";
import { FeatureCardV3 } from "@/pages/Colaboradores";
import ColaboradoresEstadisticas from "@/pages/ColaboradoresEstadisticas";
import {
  ArrowLeft, Pencil, Share2, Users, AlertTriangle, CheckCircle2,
  MapPin, Calendar, Euro, Home, Banknote, TrendingUp, Camera,
  FileText, Layers, Handshake, CreditCard, ChevronRight,
  Settings, Eye, EyeOff, Building2, HardHat, Car, Archive,
  Globe, Shield, ClipboardList, Image, Video, Play,
  Plus, Phone, Mail, MailPlus, MessageCircle, Store, UserPlus,
  Check, X, ExternalLink, Zap, Star, Search, ChevronDown, Info,
  Lock, Unlock, FolderOpen, Folder, Download, BookOpen, Upload, MoreHorizontal, FilePlus, ArrowRight,
  Trophy, Sparkles, ArrowUpRight, FileCheck2, Rocket, BarChart3,
  Megaphone,
} from "lucide-react";
import { getMissingForPromotion } from "@/lib/publicationRequirements"; // fuente única de verdad de requisitos para publicar
import { useOverride } from "@/lib/promotionWizardOverrides";
import { wizardStateToPromotion } from "@/lib/wizardStateToPromotion";
import { Button } from "@/components/ui/button";
import { cn, priceForDisplay } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Tag } from "@/components/ui/Tag";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { PromotionAvailabilitySummary } from "@/components/promotions/detail/PromotionAvailabilitySummary";
import { PromotionAvailabilityFull } from "@/components/promotions/detail/PromotionAvailabilityFull";
import { unitsByPromotion } from "@/data/units";
import { ClientRegistrationDialog } from "@/components/promotions/detail/ClientRegistrationDialog";
import { RegistrosEmbedded } from "@/components/registros/RegistrosEmbedded";
import { SharePromotionDialog } from "@/components/promotions/SharePromotionDialog";
import { AgencyNoCollabInPromoBanner } from "@/components/promotions/AgencyNoCollabInPromoBanner";
import { MarketingRulesDialog } from "@/components/promotions/MarketingRulesDialog";
import { MarketingRulesCard } from "@/components/promotions/MarketingRulesCard";
import { MarketingRulesSidebarCard } from "@/components/promotions/MarketingRulesSidebarCard";
import { ImageLightbox } from "@/components/promotions/detail/ImageLightbox";
import { ActivateSharingDialog } from "@/components/promotions/ActivateSharingDialog";
import {
  EditMultimediaDialog, EditBasicInfoDialog, EditStructureDialog,
  EditDescriptionDialog, EditLocationDialog, EditPaymentPlanDialog,
  EditShowHouseDialog, EditDocumentDialog, EditContactsDialog, EditInventoryDialog,
  EditSalesOfficesDialog, type SalesOffice,
  PickTeamMembersDialog, PickSalesOfficesDialog,
} from "@/components/promotions/detail/EditSectionDialogs";
import { activeTeamMembers } from "@/data/teamMembers";
import { useOficinas } from "@/lib/empresa";
import { SendEmailDialog } from "@/components/email/SendEmailDialog";
import { PriceListDialog } from "@/components/promotions/detail/PriceListDialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner"; // feedback tras publicar · Toaster global en App.tsx
import { useCurrentUser } from "@/lib/currentUser";
import { developerHref, getAgenciesForDeveloper } from "@/lib/developerNavigation";
import { useInvitaciones } from "@/lib/invitaciones";
import { ensureAgencyContactForPromoter } from "@/lib/invitationContacts";
import {
  isInvitacionDescartada, descartarInvitacion,
  onInvitacionesDescartadasChanged,
} from "@/lib/invitacionesDescartadas";
import { useEmpresa } from "@/lib/empresa";
import { addPromotionToCartera, useAgencyCartera } from "@/lib/agencyCartera";
import { Flag } from "@/components/ui/Flag";
import { findLanguageByCode } from "@/lib/languages";
import { TEAM_MEMBERS, type TeamMember } from "@/lib/team";
import { useWorkspaceMembers } from "@/lib/useWorkspaceMembers";
import { getPromoterDisplayName } from "@/lib/promotionRole";

function formatPrice(n: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

const stepConfig: Record<string, { icon: typeof Camera; label: string; description: string; wizardStep: string }> = {
  "Basic info": { icon: Settings, label: "Información básica", description: "Nombre, dirección y amenities", wizardStep: "info_basica" },
  "Multimedia": { icon: Camera, label: "Multimedia", description: "Fotos y vídeos", wizardStep: "multimedia" },
  "Description": { icon: FileText, label: "Descripción", description: "Descripción del proyecto", wizardStep: "descripcion" },
  "Units": { icon: Layers, label: "Unidades", description: "Configurar unidades disponibles", wizardStep: "crear_unidades" },
  "Collaborators": { icon: Handshake, label: "Colaboradores", description: "Comisiones y agencias", wizardStep: "colaboradores" },
  "Payment plan": { icon: CreditCard, label: "Plan de pagos", description: "Estructura de pagos del comprador", wizardStep: "plan_pagos" },
};

/** Construye la URL al wizard. Acepta tanto stepName ("Basic info")
 *  como wizardStep id directo ("info_basica"). Para borradores añade
 *  ?draft=<id> para que el wizard cargue ese borrador concreto. */
function getWizardUrl(step?: string, returnTo?: string, draftId?: string | null, promotionId?: string | null) {
  const ws = step
    ? (stepConfig[step]?.wizardStep ?? step) // acepta ambos
    : undefined;
  const params = new URLSearchParams();
  if (ws) params.set("step", ws);
  if (draftId) params.set("draft", draftId);
  /* `promotionId` · cuando se navega desde una promoción ya creada
   *  (no draft), el wizard hidrata su estado con los datos del Promotion
   *  · evita que pasos completados aparezcan como pendientes. */
  if (promotionId) params.set("promotionId", promotionId);
  if (returnTo) params.set("returnTo", returnTo);
  const qs = params.toString();
  return qs ? `/crear-promocion?${qs}` : "/crear-promocion";
}

function statusConfig(status: string) {
  const map: Record<string, { label: string; variant: "success" | "warning" | "muted" | "danger" }> = {
    active: { label: "Activa", variant: "success" },
    incomplete: { label: "Incompleta", variant: "warning" },
    inactive: { label: "Inactiva", variant: "muted" },
    "sold-out": { label: "Agotada", variant: "danger" },
  };
  return map[status] || map.inactive;
}

const tabKeys = ["Overview", "Availability", "Agencies", "Comisiones", "Records", "Documents"];
const collabTabKeys = ["Overview", "Availability", "Comisiones", "Documents"];
const allSteps = ["Basic info", "Multimedia", "Description", "Units", "Collaborators", "Payment plan"];

const tabLabels: Record<string, string> = {
  Overview: "Vista general",
  Availability: "Disponibilidad",
  Agencies: "Agencias",
  Comisiones: "Comisiones",
  Records: "Registros",
  Documents: "Documentos",
};

const conditionLabels: Record<string, string> = {
  nombre_completo: "Nombre completo",
  ultimas_4_cifras: "Últimas 4 cifras del teléfono",
  nacionalidad: "Nacionalidad",
  email_completo: "Email completo",
};

/**
 * Los contactos comerciales del footer ahora se derivan de TEAM_MEMBERS
 * (ver ADR-050) · se filtran los miembros activos con
 * `visibleOnProfile === true` (la misma regla que /empresa). Reactivo
 * al localStorage `byvaro.organization.members.v4`.
 *
 * La función `buildContactsFromTeam` vive fuera del componente para
 * que sea pura y fácil de testear.
 */
function buildContactsFromTeam(members: TeamMember[]): ContactPerson[] {
  return members
    .filter((m) => (!m.status || m.status === "active") && m.visibleOnProfile)
    .map((m) => ({
      name: m.name,
      role: m.jobTitle ?? m.department ?? "",
      avatar: m.avatarUrl ?? "",
      phone: m.phone ?? "",
      email: m.email,
      languages: m.languages ?? [],
    }));
}

/** Hook reactivo · delega en `useWorkspaceMembers` (canonical source
 *  of truth · `organization_members` table). Mantiene el shape para
 *  no romper callers existentes. */
function useTeamMembersReactive(): TeamMember[] {
  const { members } = useWorkspaceMembers();
  return members.length > 0 ? members : TEAM_MEMBERS;
}

export default function DeveloperPromotionDetail({ agentMode = false }: { agentMode?: boolean } = {}) {
  const { id } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  /* Tab activa sincronizada con ?tab=<key> vía `useTabParam`. Al
     navegar a una sub-pantalla (ficha de agencia, etc.) y volver
     atrás, el historial del navegador restaura la tab. Internamente
     seguimos trabajando con índices para no tocar todo el JSX. */
  const [activeTabKeyFromUrl, setActiveTabKeyFromUrl] = useTabParam(
    tabKeys as readonly string[],
    tabKeys[0],
  );
  const activeTab = Math.max(0, tabKeys.indexOf(activeTabKeyFromUrl));
  const setActiveTab = (next: number | ((cur: number) => number)) => {
    const resolved = typeof next === "function" ? next(activeTab) : next;
    const key = tabKeys[resolved] ?? tabKeys[0];
    setActiveTabKeyFromUrl(key);
  };
  /* Contactos comerciales del footer · derivados de TEAM_MEMBERS reactivo.
   * Filtro idéntico al que usa /empresa (visibleOnProfile + active). */
  const teamMembers = useTeamMembersReactive();
  const contacts = useMemo(() => buildContactsFromTeam(teamMembers), [teamMembers]);
  const [_availabilityVersion, _setAvailabilityVersion] = useState<"v1" | "v2">("v2");
  /* `viewAsCollaborator` tiene dos entradas:
   *   · el usuario global es agencia → siempre vista colaborador.
   *   · el promotor activa el preview con el toggle local (sólo disponible
   *     cuando la cuenta es `developer`).
   * Al cambiar la cuenta desde el AccountSwitcher, se re-renderiza y el
   * valor derivado se recalcula sin necesidad de sincronización manual. */
  const currentUser = useCurrentUser();
  const isAgencyUser = currentUser.accountType === "agency";
  const [previewAsCollaborator, setPreviewAsCollaborator] = useState(agentMode);
  const viewAsCollaborator = isAgencyUser || previewAsCollaborator;
  const setViewAsCollaborator = setPreviewAsCollaborator;

  /* Cartera de la agencia activa · usada para bloquear "Registrar
     cliente" mientras la promoción no esté aceptada. Para promotor
     no aplica (cartera mock vacía · el promotor no tiene gate). */
  const activeAgencyForCartera = isAgencyUser && currentUser.agencyId
    ? agencies.find((ag) => ag.id === currentUser.agencyId) ?? null
    : null;
  const carteraSet = useAgencyCartera(activeAgencyForCartera ?? ({ id: "", promotionsCollaborating: [] } as unknown as Agency));
  /* `inCartera` cruza la cartera con la promoción actual. Usamos `id`
     de URL params (línea 185) en lugar de `p.id` porque `p` se declara
     más abajo (línea ~392) · referenciarlo aquí es TDZ. `id` es el
     mismo valor — `p` se busca por `promo.id === id`. */
  const inCartera = !isAgencyUser || (!!activeAgencyForCartera && !!id && carteraSet.has(id));
  // FAB móvil — abre un menú con las acciones principales de la ficha.
  const [mobileFabOpen, setMobileFabOpen] = useState(false);
  // Swipe horizontal entre tabs · sólo activa en móvil (<640px).
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.innerWidth >= 640) return;
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // Umbral 60px, dominancia horizontal, ignora tap y scrolls verticales.
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return;
    const dir = dx < 0 ? 1 : -1;
    // Usamos setActiveTab con función para leer el valor más reciente sin
    // depender del valor capturado en el closure (importante en React 18
    // con strict mode y actualizaciones asíncronas).
    setActiveTab((cur) => {
      const max = visibleTabs.length - 1;
      const next = Math.max(0, Math.min(max, cur + dir));
      return next;
    });
  };
  const [addComercialOpen, setAddComercialOpen] = useState(false);
  const [pickOfficesOpen, setPickOfficesOpen] = useState(false);
  
  const [comercialesList, setComercialesList] = useState<Comercial[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [showFlatUnitId, setShowFlatUnitId] = useState<string | null>(null);
  const [showFlatPickerOpen, setShowFlatPickerOpen] = useState(false);
  const [openDocFolder, setOpenDocFolder] = useState<string | null>(null);
  const [blockedAgencies, setBlockedAgencies] = useState<Record<string, Set<string>>>({ planos: new Set(), brochure: new Set() });
  const [folderLocked, setFolderLocked] = useState<Record<string, boolean>>({ planos: false, brochure: false });
  const [registerClientOpen, setRegisterClientOpen] = useState(false);
  const [sendEmailOpen, setSendEmailOpen] = useState(false);
  const [priceListOpen, setPriceListOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [activateSharingOpen, setActivateSharingOpen] = useState(false);
  /** Modal "Configura X antes de compartir" · se abre cuando el user
   *  intenta invitar agencias pero faltan campos obligatorios. */
  const [shareGuardOpen, setShareGuardOpen] = useState(false);
  const [marketingRulesOpen, setMarketingRulesOpen] = useState(false);
  /** El brochure puede eliminarse desde su card. Al eliminarlo, la sección
   *  se oculta y la acción rápida "Brochure" queda deshabilitada. */
  const [brochureRemoved, setBrochureRemoved] = useState(false);

  /** Dispara la descarga del brochure (mock · usa el PDF de ejemplo en
   *  /public). El `id` fijo del toast evita el doble "Descarga iniciada"
   *  cuando el mismo click pasa por dos elementos (rail + dropdown). */
  const downloadBrochure = () => {
    if (brochureRemoved) return;
    // TODO(backend): sustituir URL por la firmada del storage real.
    const url = "/REF-3348-ficha.pdf";
    const filename = `${(p?.name ?? "brochure").replace(/\s+/g, "-").toLowerCase()}-brochure.pdf`;
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Descarga iniciada", { id: "brochure-download" });
    } catch {
      toast.error("No se pudo iniciar la descarga", { id: "brochure-download" });
    }
  };
  /** Overlay fullscreen con las estadísticas de agencias de esta promoción
   *  (ColaboradoresEstadisticas con `lockedPromotionId`). Se abre desde
   *  el tab Agencias y se cierra con X. */
  const [statsOverlayOpen, setStatsOverlayOpen] = useState(false);
  /** Override local de canShareWithAgencies cuando el promotor activa
   *  compartir desde la tab Comisiones. null = usar el valor del dataset. */
  const [canShareOverride, setCanShareOverride] = useState<boolean | null>(null);
  // Edit dialogs
  const [editOpen, setEditOpen] = useState<null | "multimedia" | "basicInfo" | "structure" | "description" | "location" | "paymentPlan" | "showHouse" | "memoria" | "planos" | "brochure" | "contacts" | "inventory" | "salesOffices">(null);
  /** IDs de las oficinas del workspace que actúan como puntos de venta
   *  para esta promoción. Se inicializan desde `p.puntosDeVentaIds` y
   *  los datos completos se resuelven vía `useOficinas()` — esa es la
   *  ÚNICA fuente de verdad. Nunca guardamos copias inline. */
  const [salesOfficeIds, setSalesOfficeIds] = useState<string[]>([]);
  const { oficinas: workspaceOficinas } = useOficinas();
  const salesOffices: SalesOffice[] = workspaceOficinas
    .filter((o) => salesOfficeIds.includes(o.id))
    .map((o) => ({
      id: o.id,
      nombre: o.nombre,
      direccion: [o.direccion, o.ciudad].filter(Boolean).join(", "),
      telefono: o.telefono,
      email: o.email,
      whatsapp: o.whatsapp,
      coverUrl: o.coverUrl || undefined,
    }));
  const setSalesOffices = (next: SalesOffice[]) => setSalesOfficeIds(next.map((o) => o.id));

  // Si el id pertenece a un borrador (localStorage), lo gestionamos en
  // modo reactivo: mantenemos el WizardState en estado local y cada
  // vez que cambia persistimos + recomputamos el shape DevPromotion.
  const isDraft = !!id && id.startsWith(DRAFT_ID_PREFIX);
  const rawDraftId = isDraft && id ? id.slice(DRAFT_ID_PREFIX.length) : null;
  /* `promoIdForWizard` · id que se pasa al wizard cuando se abre desde
   *  una promoción YA creada (no draft) · activa la hidratación desde
   *  Promotion en `CrearPromocion.tsx`. Para drafts es null (el wizard
   *  carga el draft desde su propia store). */
  const promoIdForWizard = !isDraft && id ? id : null;

  const [draftState, setDraftState] = useState<WizardState | null>(() => {
    if (!rawDraftId) return null;
    return getDraft(rawDraftId)?.state ?? null;
  });

  // Timestamp de la última edición local · permite ignorar eventos
  // `storage` antiguos (si otra pestaña tiene una versión anterior).
  const lastLocalEditRef = useRef<number>(0);

  // Sync entre pestañas · si otra ventana edita el mismo borrador o lo
  // borra, recargamos — excepto si nuestra versión local es más nueva
  // (race: otra pestaña guardó antes que nosotros pero con cambios más
  // viejos). En ese caso re-persistimos para imponer el estado local.
  useEffect(() => {
    if (!rawDraftId) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "byvaro-promotion-drafts") return;
      const latest = getDraft(rawDraftId);
      if (!latest) {
        setDraftState(null);
        return;
      }
      // Si nuestra última edición local es posterior al updatedAt del
      // storage, volvemos a guardar para no perder cambios.
      if (lastLocalEditRef.current > latest.updatedAt) {
        if (draftState) persistDraft(draftState, rawDraftId);
        return;
      }
      setDraftState(latest.state);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [rawDraftId, draftState]);

  // Autosave al localStorage · debounced a 400ms para no escribir en cada
  // tecleo de textareas/inputs.
  const saveTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!rawDraftId || !draftState) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      persistDraft(draftState, rawDraftId);
    }, 400);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [draftState, rawDraftId]);

  const draftData = useMemo((): DevPromotion | null => {
    if (!rawDraftId || !draftState) return null;
    const d: PromotionDraft = {
      id: rawDraftId,
      name: draftState.nombrePromocion?.trim() || "Promoción sin nombre",
      updatedAt: Date.now(),
      progress: 0,
      state: draftState,
    };
    return draftToPromotionData(d) as DevPromotion;
  }, [rawDraftId, draftState]);

  /** Aplica un patch al WizardState del borrador. Todos los Edit*Dialog
   *  lo usan para persistir cambios desde la ficha. */
  const patchDraft = (patch: Partial<WizardState>) => {
    lastLocalEditRef.current = Date.now();
    setDraftState((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  /* Units para la Disponibilidad en modo controlado · memoizado para
     no recalcular el array completo en cada render de la ficha. */
  const draftUnitsForView = useMemo<Unit[] | null>(() => {
    if (!isDraft || !draftState) return null;
    return draftState.unidades.map((u) => unitDataToUnit(u, id ?? ""));
  }, [isDraft, draftState, id]);

  const allPromotions: DevPromotion[] = [
    ...(draftData ? [draftData] : []),
    ...developerOnlyPromotions,
    ...promotions.map(p => ({ ...p } as DevPromotion)),
  ];
  /* Resuelve el param a la promoción · acepta `code` canónico (PR + 5
   *  dígitos) o `id` interno legacy. */
  const pBase = findPromotionByParam(id, allPromotions);

  /* Override del wizard · cuando el promotor edita la promo en
   *  `/crear-promocion?promotionId=X` los cambios persisten en el
   *  override store antes de "Publicar". El detail page debe mergear
   *  para que validadores, banners y secciones reflejen el estado
   *  EFECTIVO · si no, el usuario llena el wizard pero la ficha
   *  sigue diciendo "falta 1 campo". Ver `wizardStateToPromotion.ts`. */
  const wizardOverride = useOverride(pBase?.id ?? null);
  const p = useMemo(() => {
    if (!pBase) return null;
    if (!wizardOverride) return pBase;
    return wizardStateToPromotion(wizardOverride, pBase);
  }, [pBase, wizardOverride]);

  if (p && !initialized) {
    setComercialesList(p.comerciales || []);
    setSalesOfficeIds((p as DevPromotion).puntosDeVentaIds ?? []);
    setInitialized(true);
  }

  if (!p) {
    // Mensaje contextual: si el id era un borrador, probablemente se
    // descartó desde otra pestaña o se publicó mientras tanto.
    const wasDraft = isDraft;
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3 max-w-md px-4">
          <p className="text-lg font-semibold text-foreground">
            {wasDraft ? "Borrador no encontrado" : "Promoción no encontrada"}
          </p>
          {wasDraft && (
            <p className="text-sm text-muted-foreground">
              Este borrador ya no existe. Puede que se haya descartado, publicado o eliminado desde otra pestaña.
            </p>
          )}
          <Button variant="outline" onClick={() => navigate("/promociones")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a promociones
          </Button>
        </div>
      </div>
    );
  }

  // Requisitos mínimos para publicar (fotos, unidades, plan pagos, ubicación,
  // entrega, estado construcción, comisiones si colabora). Fuente única de
  // verdad en src/lib/publicationRequirements.ts.
  /* El validador (src/lib/publicationRequirements.ts) ya incluye los
   * missingSteps declarativos del mock + filtra los que no aplican en
   * modo uso interno (Collaborators cuando canShareWithAgencies=false).
   * No duplicamos la lógica aquí. */
  const publishMissing = useMemo(() => getMissingForPromotion(p), [p]);
  const isIncomplete = publishMissing.length > 0 || p.status === "incomplete";

  /* Al entrar a una promoción · el usuario aterriza SIEMPRE en
   *  Vista general · sin auto-cambios de tab ni auto-scroll. El
   *  banner rojo arriba ("No puedes publicar todavía · Faltan X
   *  campos") ya lista los pendientes con chips clickables · es el
   *  user quien decide a dónde ir. */
  /** Si la promo tiene explícitamente canShareWithAgencies=false, está
   *  desactivada. undefined cuenta como activada (legacy). El override local
   *  gana cuando el promotor la activa desde el popup. */
  const sharingEnabledForPromo = canShareOverride ?? (p.canShareWithAgencies !== false);

  /** ¿La estructura de comisiones está configurada y publicable?
   *  Sin esto la agencia no puede calcular su liquidación · es el
   *  mínimo que falta antes de poder invitar. */
  const collaborationConfigured = useMemo(() => {
    const collab = (p as DevPromotion).collaboration;
    return !!collab
      && !!collab.formaPagoComision
      && !!collab.comisionInternacional
      && collab.comisionInternacional > 0;
  }, [p]);

  /** Intent de invitar agencias · gate antes de abrir el dialog.
   *  Si faltan comisiones (único campo obligatorio para compartir),
   *  abrimos el modal "Configura comisiones primero". Cualquier otro
   *  missing → mismo modal pero con CTA al wizard completo. */
  const tryInvite = () => {
    if (!collaborationConfigured) {
      setShareGuardOpen(true);
      return;
    }
    setShareOpen(true);
  };
  /** Condición global para permitir compartir: publicada + activada. */
  const canShare = !isIncomplete && p.status === "active" && sharingEnabledForPromo;
  const canPublish = !isIncomplete && p.status !== "active";

  /**
   * Dock de "Acciones rápidas" · compartido entre la tab Vista general
   * y la tab Disponibilidad. Mismos items, misma estética (compact md/lg
   * con tooltips + labeled card en 2xl). Los items reflejan el estado
   * actual (promoción publicada, brochure eliminado, permisos de share).
   */
  const renderQuickActionsRail = (extras?: React.ReactNode) => {
    const isPublished = p.status === "active" && !isIncomplete;
    const items: { icon: typeof Users; label: string; hint?: string; onClick?: () => void; danger?: boolean; info?: boolean; disabled?: boolean; compactOnly?: boolean }[] = [
      ...(!viewAsCollaborator && isPublished ? [
        {
          icon: Users,
          label: "Invitar agencias",
          hint: canShare ? "Invitar colaboradores" : "Activa compartir en la tab Comisiones",
          onClick: canShare ? () => tryInvite() : undefined,
          disabled: !canShare,
        },
        // Visible solo en el dock compacto (md/lg) · en 2xl+ la
        // MarketingRulesSidebarCard hace el mismo trabajo debajo.
        ...(sharingEnabledForPromo ? [{
          icon: Megaphone,
          label: "Reglas de marketing",
          hint: "Dónde puede (o no) promocionarse esta promoción",
          onClick: () => setMarketingRulesOpen(true),
          compactOnly: true,
        }] : []),
      ] : []),
      ...(isPublished ? [
        {
          icon: FileText,
          label: "Brochure",
          hint: brochureRemoved ? "No hay brochure subido" : "Descargar brochure",
          onClick: brochureRemoved ? undefined : downloadBrochure,
          disabled: brochureRemoved,
        },
        { icon: Download, label: "Listado de precios", hint: "Descargar en PDF", onClick: () => setPriceListOpen(true) },
      ] : []),
      { icon: Info, label: "Datos en vivo", hint: "Precios y disponibilidad se actualizan en tiempo real. Confirma antes de cerrar.", info: true },
    ];
    return (
      <TooltipProvider delayDuration={150}>
        <aside className="hidden lg:block w-full lg:w-12 2xl:w-[260px] lg:shrink-0 order-1 lg:order-2 lg:self-start lg:sticky lg:top-4">
          <div className="lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto no-scrollbar space-y-3">
            {/* Compact dock — visible md/lg, hidden on 2xl */}
            <div className="2xl:hidden flex lg:flex-col gap-1.5 rounded-2xl bg-card border border-border shadow-soft p-1.5">
              {items.map((item, i) => (
                <Tooltip key={i}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={item.onClick}
                      disabled={item.disabled}
                      className={`h-9 w-9 rounded-xl flex items-center justify-center transition-colors ${item.disabled ? "text-muted-foreground/40 cursor-not-allowed" : item.danger ? "text-destructive hover:bg-destructive/10" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"}`}
                    >
                      <item.icon className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-[260px] text-xs">
                    {item.hint || item.label}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>

            {/* Labeled side card — visible only on 2xl (≥1536px) */}
            <div className="hidden 2xl:flex flex-col rounded-2xl bg-card border border-border shadow-soft overflow-hidden">
              <div className="px-4 pt-4 pb-2">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Acciones rápidas</p>
              </div>
              <div className="px-2 pb-2 flex flex-col gap-0.5">
                {items.filter(i => !i.info && !i.danger && !i.compactOnly).map((item, i) => (
                  <button
                    key={i}
                    onClick={item.onClick}
                    disabled={item.disabled}
                    className={`group flex items-center gap-3 px-2.5 py-2 rounded-xl text-left transition-colors ${item.disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-muted/50"}`}
                  >
                    <span className="h-8 w-8 rounded-lg bg-muted/40 group-hover:bg-muted/70 flex items-center justify-center shrink-0 transition-colors">
                      <item.icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium text-foreground truncate">{item.label}</span>
                      {item.hint && <span className="block text-[10px] text-muted-foreground truncate">{item.hint}</span>}
                    </span>
                  </button>
                ))}
              </div>

              {items.some(i => i.danger) && (
                <>
                  <div className="h-px bg-border/40 mx-4" />
                  <div className="px-2 py-2">
                    {items.filter(i => i.danger).map((item, i) => (
                      <button
                        key={i}
                        onClick={item.onClick}
                        className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left transition-colors hover:bg-destructive/5"
                      >
                        <span className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                          <item.icon className="h-3.5 w-3.5 text-destructive" strokeWidth={1.75} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-medium text-destructive truncate">{item.label}</span>
                          {item.hint && <span className="block text-[10px] text-destructive/70 truncate">{item.hint}</span>}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {items.some(i => i.info) && (
                <>
                  <div className="h-px bg-border/40 mx-4" />
                  <div className="px-4 py-3 flex items-start gap-2">
                    <Info className="h-3 w-3 text-muted-foreground/60 mt-0.5 shrink-0" strokeWidth={1.75} />
                    <p className="text-[10px] leading-relaxed text-muted-foreground">
                      {items.find(i => i.info)?.hint}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Extras opcionales debajo del dock · p. ej. MarketingRulesSidebarCard
                · visible solo en 2xl (igual que el labeled dock) para que en
                md/lg no ensucien las filas de iconos compactos. */}
            {extras && <div className="hidden 2xl:block">{extras}</div>}
          </div>
        </aside>
      </TooltipProvider>
    );
  };
  // Set de secciones de la ficha que deben renderizarse con tratamiento
  // rojizo (SectionCard con border-dashed destructive). Se usa en cada
  // SectionCard prop `missing` via OR con el legacy missingSet.
  const realMissing = new Set(
    publishMissing.map((m) => m.ficha).filter(Boolean) as string[],
  );

  const hasMissing = p.missingSteps && p.missingSteps.length > 0;
  const missingSet = new Set(p.missingSteps || []);
  const completedSteps = allSteps.filter(s => !missingSet.has(s));
  const completionPct = Math.round((completedSteps.length / allSteps.length) * 100);
  const occupancy = p.totalUnits > 0 ? Math.round(((p.totalUnits - p.availableUnits) / p.totalUnits) * 100) : 0;
  const typeLabel = getBuildingTypeLabel(p.buildingType);
  const returnPath = `/developer-promotions/${p.id}`;
  const website = `${p.name.toLowerCase().replace(/\s+/g, "-")}.byvaro.com`;

  /* Label canónico de la fase de obra · derivado del % real de la promo
   *  vía buckets definidos en `options.ts::constructionPhaseFromProgress`.
   *  Lleva incrustado el rango (ej. "Acabados · 75–90%") para que sea
   *  coherente con el wizard donde el usuario seleccionó la fase. */
  const constructionPhaseLabel = constructionPhaseLabelFromProgress(p.constructionProgress)
    ?? "Fase de proyecto";

  /* Galería · construida SOLO con fotos reales:
   *  - Draft → todas las fotos del wizard (state.fotos) con orden.
   *  - Promo · solo el hero `p.image` (galería completa de
   *    promotion_gallery aún no cableada en este componente).
   *  Antes había 8 URLs hardcoded de Unsplash que aparecían en TODAS
   *  las promociones (incluso borradores recién creados sin fotos) ·
   *  generaba la falsa impresión de que la promo tenía un portfolio
   *  completo. */
  const galleryImages: string[] = (() => {
    if (isDraft && draftState) {
      const fotos = (draftState.fotos ?? [])
        .slice()
        .sort((a, b) => a.orden - b.orden)
        .map((f) => f.url)
        .filter((u): u is string => !!u && u.trim().length > 0);
      if (fotos.length > 0) return fotos;
      return p.image ? [p.image] : [];
    }
    return p.image ? [p.image] : [];
  })();

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);
  const openLightbox = (i: number) => { setLightboxIdx(i); setLightboxOpen(true); };


  // KPI data with optional click handler to switch tabs.
  // Para borradores (priceMin=0) y otros estados incompletos, mostramos
  // "Sin configurar" en lugar de valores engañosos.
  const priceRangeValue = p.priceMin > 0
    ? `${formatPrice(p.priceMin)}${p.priceMax > p.priceMin ? ` – ${formatPrice(p.priceMax)}` : ""}`
    : "Sin configurar";
  const priceRangeDetail = p.reservationCost > 0
    ? `${formatPrice(p.reservationCost)} de reserva`
    : "Añade precios en las unidades";
  const availabilityValue = p.totalUnits > 0 ? `${p.availableUnits} / ${p.totalUnits}` : "Sin configurar";
  const availabilityDetail = p.totalUnits > 0 ? `${occupancy}% vendido` : "Añade unidades";

  const allKpis = [
    { icon: Euro, label: "Rango de precios", value: priceRangeValue, detail: priceRangeDetail, color: "text-primary bg-primary/10", empty: p.priceMin === 0 },
    { icon: Home, label: "Disponibilidad", value: availabilityValue, detail: availabilityDetail, color: "text-primary bg-primary/10", progress: p.totalUnits > 0 ? occupancy : 0, empty: p.totalUnits === 0 },
    { icon: TrendingUp, label: "Comisión", value: p.commission > 0 ? `${p.commission}%` : "—", detail: p.commission > 0 ? (p.priceMin > 0 ? `~${formatPrice(p.priceMin * p.commission / 100)}` : "—") : "Sin configurar", color: "text-warning bg-warning/10", onClick: () => setActiveTab(visibleTabs.indexOf("Comisiones")), empty: p.commission === 0 },
    { icon: Calendar, label: "Entrega", value: p.delivery || "Por definir", detail: p.delivery ? "Estimada" : "Añádela en Información básica", color: "text-accent-foreground bg-accent/10", empty: !p.delivery },
    { icon: HardHat, label: "Construcción", value: p.constructionProgress !== undefined ? `${p.constructionProgress}%` : "—", detail: constructionPhaseLabel || "Sin configurar", color: "text-destructive bg-destructive/10", empty: p.constructionProgress === undefined },
    ...(!viewAsCollaborator ? (() => {
      const realAgencies = countAgenciesForPromotion(p.id);
      return [{
        icon: Users,
        label: "Agencias",
        value: `${realAgencies}`,
        detail: realAgencies > 0 ? "Colaborando" : "Ninguna aún",
        color: "text-primary bg-primary/10",
        onClick: () => tryInvite(),
        empty: realAgencies === 0,
      }];
    })() : []),
  ];
  const kpis = viewAsCollaborator ? allKpis.filter(k => !k.empty) : allKpis;

  const visibleTabs = viewAsCollaborator ? collabTabKeys : tabKeys;

  // Map activeTab to the correct tab key
  const activeTabKey = visibleTabs[activeTab] || visibleTabs[0];

  const handleToggleCollabView = () => {
    setViewAsCollaborator(v => !v);
    setActiveTab(0);
  };

  return (
    <div className="h-full overflow-auto bg-background" data-scroll-container>
      {/* ── Banner de invitación pendiente · solo si el usuario es una
           agencia y tiene una invitación sin aceptar para esta promo. */}
      {isAgencyUser && currentUser.agencyId && (
        <AgencyInvitationBanner agencyId={currentUser.agencyId} promotionId={p.id} />
      )}

      {/* ── Banner "no colaboras en esta promo" · solo cuando la agencia
           ya colabora con el promotor pero esta promo concreta NO está en
           su cartera (`!inCartera`). Muestra "Solicitar colaboración" o
           "Solicitud enviada" según el estado. Hidden cuando no hay
           agencyId, hay invitación pendiente (gestiona el banner de
           arriba), o la promo ya está en cartera. */}
      {isAgencyUser && currentUser.agencyId && !inCartera && (
        <AgencyNoCollabInPromoBanner
          agencyId={currentUser.agencyId}
          promotionId={p.id}
          promotionName={p.name}
        />
      )}

      {/* ── Collaborator preview banner — solo cuando es el PROMOTOR quien
           está previsualizando la vista colaborador. Si el usuario ya es una
           agencia (via AccountSwitcher) o es ruta de agente, no hay banner. */}
      {viewAsCollaborator && !agentMode && !isAgencyUser && (
        <div className="sticky top-0 z-50 bg-foreground text-background px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Eye className="h-4 w-4 opacity-70" />
            <span className="text-sm font-medium">Estás viendo esta promoción como un <strong>colaborador</strong></span>
          </div>
          <button
            onClick={handleToggleCollabView}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background/15 hover:bg-background/25 text-xs font-medium transition-colors"
          >
            <X className="h-3 w-3" /> Salir de la vista previa
          </button>
        </div>
      )}

      {/* ═════ Header · adaptado a sistema Byvaro ═════
          - Breadcrumb tipo eyebrow con código de promoción a la derecha.
          - H1 en escala Byvaro (text-[22px] sm:text-[28px] font-bold).
          - Línea de metadata bajo el título: ubicación · promotor · entrega.
          - Barra de acciones usando <Button> (ya pill por defecto, ver
            src/components/ui/button.tsx).
          - Tabs con subrayado (mismo patrón que /empresa) en vez de pills
            con fondo. El <Separator> desaparece porque el borde inferior
            del <nav> hace de separador visual. */}
      <header className="max-w-content mx-auto px-3 sm:px-8 lg:px-10 pt-4 sm:pt-6 pb-0">
        {/* Back link · visible en todos los tamaños. En móvil el
            MobileHeader también pone una flecha, pero aquí damos
            un camino de vuelta explícito dentro del contenido. */}
        <button
          onClick={() => navigate("/promociones")}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
          Promociones
          <span className="text-muted-foreground/50 mx-1">·</span>
          <span className="text-foreground/60 tnum">{p.code}</span>
        </button>

        {/* Título + acciones · relative para posicionar el ojo en móvil. */}
        <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-4 sm:mb-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-[19px] sm:text-[22px] font-bold tracking-tight text-foreground leading-tight">
                {p.name}
              </h1>
              {/* Badge de estado de publicación · visible para promotor.
                  Ayuda a responder de un vistazo la pregunta "¿esto
                  está publicada o no?". */}
              {!viewAsCollaborator && (() => {
                if (isDraft) {
                  return (
                    <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border border-dashed border-primary/50 bg-primary/5 text-primary text-[11px] font-semibold">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      Borrador
                    </span>
                  );
                }
                if (p.status === "sold-out") {
                  return (
                    <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border border-border bg-muted text-foreground text-[11px] font-semibold">
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                      Agotada
                    </span>
                  );
                }
                if (isIncomplete) {
                  return (
                    <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border border-warning/30 bg-warning/10 text-warning text-[11px] font-semibold">
                      <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                      Sin activar · {publishMissing.length} campo{publishMissing.length === 1 ? "" : "s"} obligatorio{publishMissing.length === 1 ? "" : "s"} por rellenar
                    </span>
                  );
                }
                if (p.status === "active") {
                  /* Modelo simplificado · todo active es "Activa".
                   *  El atributo "se está compartiendo o no" es info
                   *  separada · ya no es un estado distinto. */
                  return (
                    <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border border-success/30 bg-success/10 text-success text-[11px] font-semibold">
                      <span className="h-1.5 w-1.5 rounded-full bg-success" />
                      Activa
                    </span>
                  );
                }
                return (
                  <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border border-border bg-muted/40 text-muted-foreground text-[11px] font-semibold">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                    Sin activar
                  </span>
                );
              })()}
            </div>
            <div className="flex items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1.5 flex-wrap">
              {/* Ubicación · oculta en móvil (menos ruido). */}
              <span className="hidden sm:inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {p.location || "Sin ubicación"}
              </span>
              {(() => {
                const promoterName = getPromoterDisplayName(p);
                if (!promoterName) return null;
                // Si quien mira es una agencia, el nombre del promotor
                // es clicable · destino lo decide `developerHref`
                // (panel operativo si ya colabora, ficha pública si no).
                return (
                  <>
                    <span className="hidden sm:inline text-border">·</span>
                    {viewAsCollaborator ? (
                      <Link
                        to={developerHref(currentUser, { fromPromoId: p.id })}
                        className="inline-flex items-center gap-1 hover:text-foreground transition-colors group"
                      >
                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                        <span className="underline-offset-2 group-hover:underline">{promoterName}</span>
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                        {promoterName}
                      </span>
                    )}
                  </>
                );
              })()}
              {p.delivery && (
                <>
                  <span className="hidden sm:inline text-border">·</span>
                  <span className="hidden sm:inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    Entrega {p.delivery}
                  </span>
                </>
              )}
              {/* Chip · "Visible para colaboradores" / "No visible".
                * Visible en móvil y desktop · en móvil usamos label
                * corto para no romper el layout. Click cambia el
                * estado · al pasar visible → no visible pedimos
                * confirmación porque afecta a agencias que ya operan
                * con la promoción (mantienen acceso pero no pueden
                * crear nuevos registros). */}
              {!viewAsCollaborator && p.status !== "incomplete" && (
                <>
                  <span className="text-border">·</span>
                  <button
                    type="button"
                    onClick={async () => {
                      if (sharingEnabledForPromo) {
                        const ok = await confirm({
                          title: "¿Marcar como No visible para colaboradores?",
                          description:
                            "Las agencias dejarán de ver esta promoción y no podrán crear nuevos registros, visitas ni reservas. " +
                            "Los colaboradores que ya tengan registros, ventas o visitas en curso seguirán viendo la promoción pero NO podrán hacer registros nuevos hasta que la vuelvas a marcar como visible. " +
                            "Puedes revertirlo en cualquier momento.",
                          confirmLabel: "Marcar No visible",
                          cancelLabel: "Cancelar",
                          variant: "destructive",
                        });
                        if (!ok) return;
                        setCanShareOverride(false);
                        toast.success("Promoción marcada como No visible", {
                          description: `${p.name} ya no es visible para nuevos colaboradores.`,
                        });
                        return;
                      }
                      setCanShareOverride(true);
                      toast.success("Promoción marcada como Visible", {
                        description: `${p.name} ya es visible para colaboradores.`,
                      });
                    }}
                    className="inline-flex items-center gap-1 hover:text-foreground transition-colors shrink-0"
                    title={sharingEnabledForPromo
                      ? "Click para marcar como No visible (las agencias dejarán de verla)"
                      : "Click para marcar como Visible (las agencias podrán verla)"}
                  >
                    {sharingEnabledForPromo ? (
                      <Eye className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                    )}
                    <span className="hidden md:inline">
                      {sharingEnabledForPromo ? "Visible para colaboradores" : "No visible para colaboradores"}
                    </span>
                    <span className="md:hidden">
                      {sharingEnabledForPromo ? "Visible" : "No visible"}
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>

          {!agentMode && !viewAsCollaborator && activeTabKey !== "Agencies" && (
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {/* Descartar borrador · solo visible si es draft.
                   En mobile solo el icono para ahorrar ancho. */}
              {isDraft && rawDraftId && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    const ok = await confirm({
                      title: "¿Descartar borrador?",
                      description: `"${p.name}" se eliminará permanentemente. No podrás recuperarlo.`,
                      confirmLabel: "Descartar",
                      variant: "destructive",
                    });
                    if (!ok) return;
                    deleteDraft(rawDraftId);
                    toast.success("Borrador descartado");
                    navigate("/promociones");
                  }}
                  className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/5 px-2 sm:px-3"
                  aria-label="Descartar borrador"
                  title="Descartar borrador"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                  <span className="hidden sm:inline">Descartar borrador</span>
                </Button>
              )}
              {/* Vista colaborador (desktop) · en móvil va en la esquina
                  superior derecha del header, no aquí. */}
              <Button
                size="sm"
                variant="ghost"
                onClick={handleToggleCollabView}
                className="gap-1.5 hidden sm:inline-flex"
              >
                <Eye className="h-3.5 w-3.5" strokeWidth={1.5} /> Vista colaborador
              </Button>
              {/* Eliminar promoción · disponible solo en promociones
                  creadas localmente (las de seed `prom-1`...`prom-3`
                  no se borran · son demo). Útil para limpiar promos
                  rotas o de prueba. */}
              {p.id.startsWith("prom-c-") && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    const ok = await confirm({
                      title: `¿Eliminar "${p.name}"?`,
                      description: "Se borrará la promoción del catálogo y de la base de datos. Esta acción no se puede deshacer.",
                      confirmLabel: "Eliminar",
                      variant: "destructive",
                    });
                    if (!ok) return;
                    const res = await deleteCreatedPromotion(p.id);
                    if (!res.ok) {
                      toast.error("Error al eliminar", { description: res.error });
                      return;
                    }
                    toast.success("Promoción eliminada");
                    navigate("/promociones");
                  }}
                  className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/5 hidden sm:inline-flex"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} /> Eliminar
                </Button>
              )}
              {/* Enviar · sólo si la promoción está publicada (active +
                  sin requisitos pendientes). No tiene sentido enviar a
                  un cliente un borrador sin datos. */}
              {p.status === "active" && !isIncomplete && (
                <Button size="sm" variant="outline" onClick={() => setSendEmailOpen(true)} className="gap-1.5 hidden sm:inline-flex">
                  <Mail className="h-3.5 w-3.5" strokeWidth={1.5} /> Enviar
                </Button>
              )}

              {/* Botón Activar · solo aparece si la promoción puede
                  activarse YA (sin campos pendientes). Si hay campos
                  obligatorios pendientes, el banner del cuerpo
                  ("Debes rellenar X campos obligatorios") guía al
                  user · el botón aquí sería redundante.
                  TODO(backend): POST /api/promociones/:id/publish */}
              {canPublish && (
                <Button
                  size="sm"
                  onClick={() => {
                    if (isDraft && rawDraftId) {
                      deleteDraft(rawDraftId);
                      toast.success("Promoción activada", {
                        description: `${p.name} ya es visible en el catálogo.`,
                      });
                      navigate("/promociones");
                      return;
                    }
                    toast.success("Promoción activada", {
                      description: `${p.name} ya es visible en el catálogo.`,
                    });
                    // TODO(backend): actualizar p.status = "active" tras confirmación del backend.
                  }}
                  className="gap-1.5"
                >
                  <Rocket className="h-3.5 w-3.5" strokeWidth={1.5} /> Activar
                </Button>
              )}

              {/* Pill "Solo uso interno" · cuando la promoción está activa
                  pero el promotor marcó No compartir. Click navega al
                  wizard al paso de Colaboradores · activación tiene varias
                  opciones (estructura, forma de pago, validez…) · no es
                  un toggle modal. */}
              {p.status === "active" && !isIncomplete && !sharingEnabledForPromo && (
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="gap-1.5 hidden sm:inline-flex"
                  title="Configurar comisiones para colaborar con agencias"
                >
                  <Link to={getWizardUrl("Collaborators", returnPath, rawDraftId, promoIdForWizard)}>
                    <Handshake className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Solo uso interno
                  </Link>
                </Button>
              )}

              {/* Registrar cliente · también requiere promoción publicada. */}
              {p.status === "active" && !isIncomplete && (
                <Button size="sm" onClick={() => setRegisterClientOpen(true)} className="gap-1.5 hidden sm:inline-flex">
                  <Users className="h-3.5 w-3.5" strokeWidth={1.5} /> Registrar cliente
                </Button>
              )}
            </div>
          )}
          {viewAsCollaborator && p.status === "active" && !isIncomplete && (
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={() => setSendEmailOpen(true)} className="gap-1.5 hidden sm:inline-flex">
                <Mail className="h-3.5 w-3.5" /> Enviar
              </Button>
              <Button
                size="sm"
                onClick={() => setRegisterClientOpen(true)}
                disabled={!inCartera}
                title={!inCartera ? "Añade la promoción a tu cartera primero · acepta la invitación" : undefined}
                className="gap-1.5 hidden sm:inline-flex disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Users className="h-3.5 w-3.5" /> Registrar cliente
              </Button>
            </div>
          )}
        </div>

        {/* Tabs · subrayado Byvaro (patrón de /empresa) */}
        <nav className="flex items-center gap-1 border-b border-border overflow-x-auto no-scrollbar -mx-3 sm:-mx-8 lg:-mx-10 px-3 sm:px-8 lg:px-10">
          {(() => {
            /* Set de tabs que tienen al menos 1 campo pendiente · se
             *  pinta un punto rojo junto al label · solo lado promotor.
             *  Mapeo `ficha` (de getMissingForPromotion) → tab key. */
            const fichaToTabKey: Record<string, string> = {
              multimedia:   "Overview",
              basicInfo:    "Overview",
              location:     "Overview",
              description:  "Overview",
              delivery:     "Overview",
              estado:       "Overview",
              paymentPlan:  "Overview",
              units:        "Availability",
              collaborators: "Comisiones",
            };
            const tabsWithMissing = new Set<string>();
            if (!isAgencyUser) {
              for (const m of publishMissing) {
                const tabKey = m.ficha && fichaToTabKey[m.ficha];
                if (tabKey) tabsWithMissing.add(tabKey);
              }
            }
            return visibleTabs.map((tab, i) => {
              const requestCount = !viewAsCollaborator && tab === "Agencies"
                ? agencies.filter(a => a.isNewRequest && a.requestedPromotionIds?.includes(p.id)).length
                : 0;
              /* En BORRADOR no pintamos los dots rojos por tab · es WIP
               * por definición · gritar "esta tab tiene campos
               * pendientes" en cada pestaña es ruido. La indicación de
               * progreso vive en el banner de "Borrador en curso". */
              const hasMissingInTab = !isDraft && tabsWithMissing.has(tab);
              const active = activeTab === i;
              return (
                <button
                  key={tab}
                  data-nav-guard
                  onClick={() => setActiveTab(i)}
                  className={cn(
                    "relative px-4 sm:px-5 py-3 text-[13px] font-medium whitespace-nowrap transition-colors inline-flex items-center gap-1.5",
                    active
                      ? "text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  title={hasMissingInTab ? "Esta sección tiene campos pendientes" : undefined}
                >
                  {tabLabels[tab] || tab}
                  {/* Punto rojo · campos pendientes en esa tab */}
                  {hasMissingInTab && (
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-destructive"
                      aria-label="Campos pendientes"
                    />
                  )}
                  {requestCount > 0 && (
                    <span className="h-4 min-w-[16px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold inline-flex items-center justify-center tnum">
                      {requestCount}
                    </span>
                  )}
                </button>
              );
            });
          })()}
        </nav>
      </header>

      <div
        className="max-w-content mx-auto p-3 sm:p-[25px] w-full min-w-0"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >

        {activeTabKey === "Overview" && (
          <>
            {/* Banner de pendientes · SOLO los requisitos que faltan.
                Cada chip lleva al paso exacto del wizard. Botón único
                "Completar todo" recorre pasos faltantes en onlyMissing
                y al terminar vuelve a la ficha. La checklist completa
                (hechos + pendientes) vive en el paso Revisión del
                wizard, no aquí. */}
            {/* Banner agresivo "Debes rellenar X campos" · SOLO se
                muestra para promociones YA activas con campos faltantes
                (caso edge raro). Para BORRADORES (status=incomplete +
                isDraft) NO lo mostramos · sería un grito al user que
                acaba de empezar · el wizard / borrador es un proceso
                guiado · si quiere ver qué falta, abre el paso "Revisión".
                Reemplazado por un banner neutro de 'continuar editando'
                más abajo. */}
            {!viewAsCollaborator && isIncomplete && !isDraft && (() => {
              const fichaToWizardStep: Record<string, string> = {
                multimedia: "multimedia",
                units: "crear_unidades",
                paymentPlan: "plan_pagos",
                location: "info_basica",
                delivery: "detalles",
                estado: "estado",
                collaborators: "colaboradores",
              };
              return (
                <div className="mb-5 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" strokeWidth={1.5} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">
                          Debes rellenar los campos obligatorios para activar
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {publishMissing.length} campo{publishMissing.length === 1 ? "" : "s"} obligatorio{publishMissing.length === 1 ? "" : "s"} pendiente{publishMissing.length === 1 ? "" : "s"} · toca cada uno para completarlo:
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {publishMissing.map((m) => {
                            const wizardStep = m.ficha && fichaToWizardStep[m.ficha];
                            return (
                              <button
                                key={m.key}
                                type="button"
                                onClick={() => {
                                  if (wizardStep) navigate(getWizardUrl(wizardStep, returnPath, rawDraftId, promoIdForWizard));
                                }}
                                disabled={!wizardStep}
                                className="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 hover:bg-destructive/15 hover:border-destructive/60 px-2.5 py-0.5 text-[11px] font-semibold text-destructive transition-colors disabled:cursor-default group"
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                                {m.label}
                                {wizardStep && <ArrowRight className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" strokeWidth={2} />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => navigate(getWizardUrl(undefined, returnPath, rawDraftId, promoIdForWizard) + "&onlyMissing=1")}
                      className="rounded-full text-xs h-9 px-4 shrink-0 w-full sm:w-auto"
                    >
                      Completar todo
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </div>
              );
            })()}

            {/* Banner para BORRADORES · neutro, no asustante.
                Reemplaza al banner agresivo de campos pendientes para
                drafts. Invita al user a continuar editando · sin tono
                destructivo · sin enumerar todo lo que falta. */}
            {!viewAsCollaborator && isDraft && (
              <div className="mb-5 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" strokeWidth={1.75} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        Borrador en curso
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        Continúa rellenando cuando quieras · todo lo que
                        guardes se conserva. Cuando termines podrás
                        activar la promoción y compartirla con tus
                        colaboradores.
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => navigate(getWizardUrl(undefined, returnPath, rawDraftId, promoIdForWizard))}
                    className="rounded-full text-xs h-9 px-4 shrink-0 w-full sm:w-auto"
                  >
                    Continuar editando
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* Aviso "Solo uso interno" · la promoción está completa
                y activa, pero el promotor marcó "No compartir" → no
                aparece para agencias. La activación tiene varias
                opciones (estructura de comisiones, forma de pago,
                condiciones de registro, validez…) · NO es un toggle
                · es una pantalla de configuración entera.
                Ofrecemos un text-link al paso del wizard, no un
                botón modal. */}
            {!viewAsCollaborator && p.status === "active" && !isIncomplete && !sharingEnabledForPromo && (
              <div className="mb-5 rounded-2xl border border-border bg-muted/30 p-5">
                <div className="flex items-start gap-3">
                  <Handshake className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.5} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      Solo uso interno
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      Esta promoción está activa para tu equipo pero no se comparte con agencias
                      colaboradoras.{" "}
                      <Link
                        to={getWizardUrl("Collaborators", returnPath, rawDraftId, promoIdForWizard)}
                        className="font-semibold text-primary underline-offset-2 hover:underline"
                      >
                        Configurar comisiones para colaborar →
                      </Link>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Aviso "Activa sin agencias" · la promoción está completa,
                activa y configurada para compartir · pero ninguna agencia
                la tiene en su cartera todavía. CTA · invitar agencias.
                Per REGLA DE ORO en CLAUDE.md · "Publicada" requiere ≥1
                agencia · mientras tanto sigue siendo "Activa". */}
            {!viewAsCollaborator
              && p.status === "active"
              && !isIncomplete
              && sharingEnabledForPromo
              && countAgenciesForPromotion(p.id) === 0 && (
              <div className="mb-5 rounded-2xl border border-warning/30 bg-warning/5 p-5">
                <div className="flex items-start gap-3">
                  <Users className="h-5 w-5 text-warning shrink-0 mt-0.5" strokeWidth={1.5} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      Esta promoción aún no se está compartiendo
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      Está activa y lista para colaborar · pero ninguna agencia la tiene
                      en su cartera todavía.{" "}
                      <button
                        type="button"
                        onClick={() => tryInvite()}
                        className="inline-flex items-center gap-1 font-semibold text-foreground hover:underline underline-offset-2"
                      >
                        Invitar agencias
                        <ArrowRight className="h-3 w-3" strokeWidth={2} />
                      </button>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Two-column layout: main content left, narrow icon rail right.
             *  Mismo shape en vista promotor y agencia — el rail aquí no cambia
             *  de densidad, solo cambian los items que se enseñan dentro. Antes
             *  se forzaba flex-col en modo agencia sin motivo claro; quedaba
             *  incoherente con la tab Disponibilidad que ya usa `lg:flex-row`
             *  en ambos roles. */}
            <div className="flex gap-4 lg:flex-row flex-col w-full max-w-content mx-auto min-w-0">
              {/* ── LEFT: Main content ── */}
              <div className="flex-1 min-w-0 space-y-5 order-2 lg:order-1">

            {/* ── 1. GALLERY ── */}
            <SectionCard title="Multimedia" stepName="Multimedia" missing={missingSet.has("Multimedia") || realMissing.has("multimedia")} softMissing={isDraft} onEdit={() => setEditOpen("multimedia")} hideEdit={viewAsCollaborator} flush>
              {/* Empty state cuando no hay fotos · típico en borradores
                 *  recién creados. Antes pintábamos 8 fotos hardcoded de
                 *  Unsplash · daba la falsa impresión de que la promo
                 *  tenía portfolio. Ahora muestra un placeholder neutro
                 *  con CTA para subir. */}
              {galleryImages.length === 0 ? (
                <button
                  type="button"
                  onClick={() => setEditOpen("multimedia")}
                  disabled={viewAsCollaborator}
                  className="w-full h-[280px] sm:h-[320px] rounded-lg border-2 border-dashed border-border bg-muted/30 hover:border-primary/30 hover:bg-muted/50 transition-colors flex flex-col items-center justify-center gap-2 text-center px-6 disabled:cursor-default"
                >
                  <Image className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.25} />
                  <p className="text-sm font-medium text-muted-foreground">
                    {viewAsCollaborator ? "Aún no hay fotografías" : "Sube las fotografías de la promoción"}
                  </p>
                  {!viewAsCollaborator && (
                    <p className="text-xs text-muted-foreground/70">
                      JPG, PNG o WEBP · arrastra o haz clic
                    </p>
                  )}
                </button>
              ) : (
                <>
              {/* Móvil: sólo la foto principal. Tablet/desktop: mosaico
                  4×2 con foto hero + 3 thumbs + celda de vídeos.
                  Todas las imágenes abren `ImageLightbox` al índice clicado. */}
              <div className="sm:hidden relative h-[280px] rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => openLightbox(0)}
                  className="w-full h-full relative group"
                >
                  <img src={galleryImages[0]} alt={p.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-active:bg-black/10 transition-colors" />
                </button>
                <Tag variant="overlay" size="sm" className="absolute bottom-3 left-3 pointer-events-none"><Image className="h-3 w-3" /> {galleryImages.length} fotos</Tag>
              </div>
              <div className="hidden sm:grid grid-cols-4 grid-rows-2 gap-1.5 h-[320px] relative">
                <button
                  type="button"
                  onClick={() => openLightbox(0)}
                  className="col-span-2 row-span-2 relative group cursor-pointer overflow-hidden"
                >
                  <img src={galleryImages[0]} alt={p.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                </button>
                {galleryImages.slice(1, 4).map((src, i) => (
                  <button
                    type="button"
                    key={i}
                    onClick={() => openLightbox(i + 1)}
                    className="overflow-hidden cursor-pointer group"
                  >
                    <img src={src} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </button>
                ))}
                {galleryImages[4] ? (
                  <button
                    type="button"
                    onClick={() => openLightbox(4)}
                    className="relative overflow-hidden cursor-pointer group"
                  >
                    <img src={galleryImages[4]} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    {galleryImages.length > 5 && (
                      <div className="absolute inset-0 bg-foreground/55 flex items-center justify-center">
                        <span className="text-background text-xs font-semibold">+{galleryImages.length - 5} fotos</span>
                      </div>
                    )}
                  </button>
                ) : (
                  <div className="relative overflow-hidden cursor-pointer group bg-muted/30 flex items-center justify-center">
                    <div className="text-center">
                      <Video className="h-5 w-5 text-muted-foreground/40 mx-auto mb-1" />
                      <span className="text-xs text-muted-foreground">2 vídeos</span>
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => openLightbox(0)}
                  className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-background/95 backdrop-blur border border-border text-xs font-semibold text-foreground hover:bg-background shadow-soft-lg transition-colors"
                >
                  <Image className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Ver todas las fotos ({galleryImages.length})
                </button>
              </div>
                </>
              )}
            </SectionCard>

            {/* ── 2. KEY DATA ── */}
            <div className={`grid gap-3 2xl:gap-4 grid-cols-2 ${kpis.length <= 3 ? "md:grid-cols-3" : kpis.length <= 4 ? "md:grid-cols-4" : kpis.length <= 5 ? "md:grid-cols-3 lg:grid-cols-5" : "md:grid-cols-3 lg:grid-cols-6"}`}>
              {kpis.map((kpi) => {
                const isAgencies = kpi.label === "Agencias";
                /* En BORRADOR el flag `empty` no debe pintarse en rojo
                 * ni añadir el chip "Falta" · es un draft, lo normal es
                 * que esté vacío. Lo mostramos neutro (border y texto
                 * muted) y reemplazamos el badge "Falta" por el detail
                 * habitual ("Sin configurar"). En promo activa con
                 * faltantes sí seguimos pintando rojo · ahí sí es señal. */
                const showRedEmpty = !!kpi.empty && !isDraft;
                return (
                  <div key={kpi.label}
                    onClick={kpi.onClick}
                    className={`group relative rounded-2xl border bg-card p-3.5 2xl:p-5 shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden ${kpi.onClick ? "cursor-pointer" : ""} ${showRedEmpty ? "border-destructive/30" : "border-border"}`}>
                    <div className={`h-7 w-7 2xl:h-9 2xl:w-9 rounded-lg flex items-center justify-center ${kpi.color} mb-2`}>
                      <kpi.icon className="h-3.5 w-3.5 2xl:h-4 2xl:w-4" />
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{kpi.label}</p>
                    <p
                      className={`text-sm 2xl:text-base font-semibold leading-tight tabular-nums truncate ${showRedEmpty ? "text-destructive" : kpi.empty ? "text-muted-foreground" : "text-foreground"}`}
                      title={kpi.value}
                    >
                      {kpi.value}
                    </p>
                    {kpi.progress !== undefined && <Progress value={kpi.progress} className="h-1 mt-1.5" />}
                    {showRedEmpty ? (
                      <p className="text-[10px] mt-1 flex items-center gap-1 text-destructive font-medium">
                        <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                        Falta
                      </p>
                    ) : (
                      <p className="text-[10px] text-muted-foreground mt-1">{kpi.detail}</p>
                    )}
                    {isAgencies && (
                      <div className="absolute inset-0 bg-card/95 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                          <Plus className="h-3.5 w-3.5" strokeWidth={2} /> Invitar agencias
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── ORDEN DE SECCIONES DE OVERVIEW ──
                 1. Estructura y construcción
                 2. Unidades y disponibilidad · Plan de pagos
                 3. Descripción
                 4. Memoria / Planos / Brochure
                 5. Ubicación
                 6. Información básica (+amenities)
                 7. Piso piloto
                 8. ContactFooter (contactos, al final)
            */}

            {/* ── 1. ESTRUCTURA Y CONSTRUCCIÓN ── */}
            <SectionCard title="Estructura y construcción" stepName="Basic info" missing={realMissing.has("estado")} softMissing={isDraft} onEdit={() => setEditOpen("structure")} hideEdit={viewAsCollaborator}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InfoItem icon={Building2} label="Tipo" value={typeLabel || "Sin definir"} />
                <InfoItem icon={Layers} label="Estructura" value={p.totalUnits > 10 ? "Multibloque" : "Bloque único"} />
                <InfoItem icon={HardHat} label="Construcción" value={constructionPhaseLabel} sub={p.constructionProgress !== undefined ? `${p.constructionProgress}% completado` : undefined} />
                <InfoItem icon={Calendar} label="Entrega" value={p.delivery || "Por definir"} />
              </div>
              <div className="h-px bg-border/40 my-4" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <InfoItem icon={Home} label="Unidades totales" value={`${p.totalUnits}`} />
                <InfoItem icon={Car} label="Parking" value={p.totalUnits > 0 ? `${p.totalUnits} plazas` : "—"} sub="Incluido en el precio" />
                <InfoItem icon={Archive} label="Trastero" value={p.totalUnits > 0 ? `${Math.floor(p.totalUnits * 0.8)} unidades` : "—"} sub="Incluido en el precio" />
                <InfoItem icon={Shield} label="Licencia" value="Concedida" />
              </div>
              {p.constructionProgress !== undefined && (
                <>
                  <div className="h-px bg-border/40 my-4" />
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-muted-foreground">Progreso de construcción</span>
                      <span className="text-xs font-semibold text-foreground">{p.constructionProgress}%</span>
                    </div>
                    <Progress value={p.constructionProgress} className="h-2" />
                  </div>
                </>
              )}
            </SectionCard>

            {/* ── 2. PAGO Y DISPONIBILIDAD (Unidades + Plan de pagos) ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SectionCard title="Unidades y disponibilidad" stepName="Units" missing={missingSet.has("Units") || realMissing.has("units")} softMissing={isDraft} onEdit={() => setEditOpen("inventory")} hideEdit={viewAsCollaborator}>
                <PromotionAvailabilitySummary promotionId={p.id} onViewAll={() => setActiveTab(visibleTabs.indexOf("Availability"))} isCollaboratorView={viewAsCollaborator} />
              </SectionCard>

              <SectionCard title="Plan de pagos" stepName="Payment plan" missing={missingSet.has("Payment plan") || realMissing.has("paymentPlan")} softMissing={isDraft} onEdit={() => setEditOpen("paymentPlan")} hideEdit={viewAsCollaborator}>
                {p.reservationCost > 0 ? (
                  <div className="space-y-4">
                    {/* Summary row */}
                    <div className="grid grid-cols-3 gap-3 pb-3 border-b border-border">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Reserva</p>
                        <p className="text-sm font-semibold text-foreground tabular-nums">{formatPrice(p.reservationCost)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Validez</p>
                        <p className="text-sm font-semibold text-foreground">60 días</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Método</p>
                        <p className="text-sm font-semibold text-foreground">Hitos</p>
                      </div>
                    </div>

                    {/* Milestones — minimal list */}
                    <div className="space-y-2">
                      {[
                        { pct: "10%", label: "Firma de reserva" },
                        { pct: "20%", label: "Finalización de estructura" },
                        { pct: "30%", label: "Instalaciones" },
                        { pct: "40%", label: "Notaría (llaves)" },
                      ].map((m, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                            <span className="text-foreground">{m.label}</span>
                          </div>
                          <span className="font-medium text-foreground tabular-nums">{m.pct}</span>
                        </div>
                      ))}
                    </div>

                    {/* Aval bancario · estado resumido */}
                    {(() => {
                      // TODO(backend): leer p.avalBancario cuando exista.
                      const hasAval = true;
                      const entidad = ""; // p.avalEntidad
                      return (
                        <div className="w-full flex items-center justify-between pt-3 border-t border-border">
                          <div className="flex items-center gap-2">
                            <span className={`h-1.5 w-1.5 rounded-full ${hasAval ? "bg-primary" : "bg-muted-foreground/40"}`} />
                            <span className="text-xs text-muted-foreground">
                              {hasAval ? "Con aval bancario" : "Sin aval bancario"}
                            </span>
                          </div>
                          {hasAval && entidad && (
                            <span className="text-xs font-medium text-foreground tabular-nums">
                              {entidad}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <EmptyState icon={CreditCard} message="Sin plan de pagos definido" sub="Define cómo pagarán los compradores" />
                )}
              </SectionCard>
            </div>

            {/* ── 3. DESCRIPCIÓN ── */}
            <SectionCard title="Descripción" stepName="Description" missing={missingSet.has("Description")} softMissing={isDraft} onEdit={() => setEditOpen("description")} hideEdit={viewAsCollaborator}>
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Tag variant="default" size="sm"><Globe className="h-3 w-3" /> ES</Tag>
                  <Tag variant="default" size="sm"><Globe className="h-3 w-3" /> EN</Tag>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {p.name} es una promoción {typeLabel?.toLowerCase() || "residencial"} situada en {p.location || "España"}.
                  {/* El nombre del promotor se oculta en vista colaborador (la agencia no expone al promotor). */}
                  {!viewAsCollaborator && (() => {
                    const promoterName = getPromoterDisplayName(p);
                    return promoterName ? ` Desarrollada por ${promoterName}.` : "";
                  })()}
                  {p.totalUnits > 0 && ` El proyecto consta de ${p.totalUnits} unidades con entrega estimada para ${p.delivery || "por definir"}.`}
                  {p.propertyTypes.length > 0 && ` Las tipologías incluyen ${p.propertyTypes.join(", ").toLowerCase()}.`}
                </p>
              </div>
            </SectionCard>

            {/* ── 4. DOCUMENTACIÓN: Memoria + Planos + Brochure ── */}
            <div className={`grid grid-cols-1 ${p.totalUnits > 1 ? "lg:grid-cols-3" : "lg:grid-cols-2"} gap-4`}>
              {/* Memoria de calidades */}
              <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden group/section relative">
                <div className="px-5 pt-4 pb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <h2 className="text-base font-semibold text-foreground">Memoria de calidades</h2>
                  </div>
                  {!viewAsCollaborator && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          aria-label="Acciones memoria"
                          className="h-7 w-7 rounded-full inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover/section:opacity-100 focus-visible:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => setEditOpen("memoria")}>
                          <RefreshCw className="h-3.5 w-3.5 mr-2" /> Reemplazar archivo
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={downloadBrochure}>
                          <Download className="h-3.5 w-3.5 mr-2" /> Descargar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => toast.success("Memoria eliminada")}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <div className="px-5 pb-5">
                  <div className="flex items-center gap-4 p-4 rounded-xl border border-border bg-background/50 hover:border-border/50 hover:shadow-soft transition-all cursor-pointer" onClick={() => { setActiveTab(visibleTabs.indexOf("Documents")); setOpenDocFolder("calidades"); }}>
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">Memoria_Calidades.pdf</p>
                      <p className="text-xs text-muted-foreground mt-0.5">PDF · 4.2 MB</p>
                    </div>
                    <Download className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  </div>
                </div>
              </div>

              {/* Planos generales — only multi-unit */}
              {p.totalUnits > 1 && (
                <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden group/section relative">
                  <div className="px-5 pt-4 pb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                      <h2 className="text-base font-semibold text-foreground">Planos generales</h2>
                      {!viewAsCollaborator && <Share2 className="h-3 w-3 text-primary/60" />}
                    </div>
                    {!viewAsCollaborator && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            aria-label="Acciones planos"
                            className="h-7 w-7 rounded-full inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover/section:opacity-100 focus-visible:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => setEditOpen("planos")}>
                            <Upload className="h-3.5 w-3.5 mr-2" /> Añadir archivos
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setActiveTab(visibleTabs.indexOf("Documents")); setOpenDocFolder("planos"); }}>
                            <FolderOpen className="h-3.5 w-3.5 mr-2" /> Gestionar archivos
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => toast.success("Carpeta de planos vaciada")}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Vaciar carpeta
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  <div className="px-5 pb-5">
                    <div className="rounded-xl overflow-hidden border border-border bg-background/50 cursor-pointer group hover:shadow-soft transition-all" onClick={() => { setActiveTab(visibleTabs.indexOf("Documents")); setOpenDocFolder("planos"); }}>
                      <img src="https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=600&h=200&fit=crop" alt="Planos" className="w-full h-[120px] object-cover group-hover:scale-[1.02] transition-transform duration-300" />
                      <div className="p-3 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-foreground">3 archivos</p>
                          <p className="text-[10px] text-muted-foreground">Planos de planta y distribución</p>
                        </div>
                        <FolderOpen className="h-3.5 w-3.5 text-muted-foreground/40" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Brochure · oculto si se eliminó */}
              {!brochureRemoved && (
              <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden group/section relative">
                <div className="px-5 pt-4 pb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                      <h2 className="text-base font-semibold text-foreground">Brochure</h2>
                      {!viewAsCollaborator && <Share2 className="h-3 w-3 text-primary/60" />}
                    </div>
                  {!viewAsCollaborator && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          aria-label="Acciones brochure"
                          className="h-7 w-7 rounded-full inline-flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover/section:opacity-100 focus-visible:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => setEditOpen("brochure")}>
                          <RefreshCw className="h-3.5 w-3.5 mr-2" /> Reemplazar archivo
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={downloadBrochure}>
                          <Download className="h-3.5 w-3.5 mr-2" /> Descargar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => { setBrochureRemoved(true); toast.success("Brochure eliminado"); }}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" /> Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <div className="px-5 pb-5">
                  <div className="rounded-xl overflow-hidden border border-border bg-background/50 cursor-pointer group hover:shadow-soft transition-all" onClick={() => { setActiveTab(visibleTabs.indexOf("Documents")); setOpenDocFolder("brochure"); }}>
                    <img src="https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&h=200&fit=crop" alt="Brochure" className="w-full h-[120px] object-cover group-hover:scale-[1.02] transition-transform duration-300" />
                    <div className="p-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-foreground">Brochure comercial</p>
                        <p className="text-[10px] text-muted-foreground">PDF · 8.5 MB</p>
                      </div>
                      <Download className="h-3.5 w-3.5 text-muted-foreground/40" />
                    </div>
                  </div>
                </div>
              </div>
              )}
            </div>



            {/* ── 5. UBICACIÓN ── */}
            <SectionCard title="Ubicación" stepName="Basic info" missing={realMissing.has("location")} softMissing={isDraft} onEdit={() => setEditOpen("location")} hideEdit={viewAsCollaborator}>
              <div className="rounded-xl overflow-hidden h-[200px] bg-muted/30 flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">{p.location || "Sin ubicación"}, España</p>
                </div>
              </div>
              {/* Puntos de interés cercanos · mismo bloque que usa la ficha de
                  unidad (ver UnitDetailDialog.tsx §Ubicación). Distancias hoy
                  son placeholder — las pintará Google Places en backend. */}
              <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-4 mt-3">
                <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground mb-2">
                  Puntos de interés cercanos
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[
                    { label: "Playa" },
                    { label: "Centro" },
                    { label: "Aeropuerto" },
                    { label: "Golf" },
                    { label: "Montaña" },
                    { label: "Supermercado" },
                  ].map((poi) => (
                    <div key={poi.label} className="flex flex-col items-center gap-1 rounded-lg bg-card border border-border/40 px-2 py-2">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{poi.label}</span>
                      <span className="text-xs font-medium text-muted-foreground/60">—</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground/70 mt-2 italic">
                  Próximamente · distancias calculadas automáticamente con Google Maps
                </p>
              </div>
            </SectionCard>

            {/* ── 6. INFORMACIÓN BÁSICA (tipologías + amenities) ── */}
            <SectionCard title="Información básica" stepName="Basic info" missing={missingSet.has("Basic info")} softMissing={isDraft} onEdit={() => setEditOpen("basicInfo")} hideEdit={viewAsCollaborator}>
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">Tipologías</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(p.propertyTypes.length > 0 ? p.propertyTypes : ["Sin definir"]).map(t => (
                      <Tag key={t} variant="default" size="sm">{t}</Tag>
                    ))}
                  </div>
                </div>
                <div className="h-px bg-border/40" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">Amenities</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["Piscina", "Gimnasio", "Jardín", "Seguridad", "Parking"].map(a => (
                      <Tag key={a} variant="default" size="sm">{a}</Tag>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">Características del hogar</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["Cocina equipada", "Aire acondicionado", "Terraza", "Smart home"].map(f => (
                      <Tag key={f} variant="default" size="sm">{f}</Tag>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* ── 7. PISO PILOTO ── */}
            {(() => {
              const promoUnits = unitsByPromotion[p.id] || [];
              const showFlatUnit = showFlatUnitId ? promoUnits.find(u => u.id === showFlatUnitId) : null;

              if (viewAsCollaborator && !showFlatUnit) return null;

              return (
                <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
                  <div className="px-5 pt-4 pb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Eye className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-base font-semibold text-foreground">Piso piloto</h2>
                        <p className="text-[10px] text-muted-foreground">Unidad modelo disponible para visitas</p>
                      </div>
                    </div>
                    {!viewAsCollaborator && showFlatUnit && (
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7 rounded-full" onClick={() => setShowFlatPickerOpen(true)}>
                        <Pencil className="h-3 w-3" /> Cambiar unidad
                      </Button>
                    )}
                  </div>
                  <div className="px-5 pb-5">
                    {showFlatUnit ? (
                      <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-xl border border-primary/20 bg-primary/5">
                        {/* Imagen: full-width en móvil; 180px fijo en sm+. */}
                        <div className="w-full sm:w-[180px] h-[160px] sm:h-[130px] rounded-xl overflow-hidden shrink-0 relative group cursor-pointer">
                          <img src="https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=400&h=300&fit=crop" alt="Piso piloto" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          <div className="absolute top-2 left-2">
                            <Tag variant="overlay" size="sm"><Star className="h-2.5 w-2.5" /> Piso piloto</Tag>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <h3 className="text-sm font-bold text-foreground whitespace-nowrap">{showFlatUnit.block} - P{showFlatUnit.floor} {showFlatUnit.door}</h3>
                            <Tag variant="success" size="sm">Piso piloto</Tag>
                          </div>
                          <p className="text-lg font-bold text-foreground mb-3">{formatPrice(showFlatUnit.price)}</p>
                          <div className="grid grid-cols-3 gap-2 sm:gap-3">
                            <div className="min-w-0">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">Dorm.</p>
                              <p className="text-sm font-semibold text-foreground">{showFlatUnit.bedrooms}</p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">Superficie</p>
                              <p className="text-sm font-semibold text-foreground whitespace-nowrap">{showFlatUnit.builtArea} m²</p>
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">Planta</p>
                              <p className="text-sm font-semibold text-foreground">{showFlatUnit.floor}ª</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1 whitespace-nowrap"><Calendar className="h-3 w-3 shrink-0" /> L–V, 10:00–18:00</span>
                            <span className="flex items-center gap-1 whitespace-nowrap"><Phone className="h-3 w-3 shrink-0" /> Con cita previa</span>
                          </div>
                        </div>
                      </div>
                    ) : !viewAsCollaborator ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center rounded-xl border border-dashed border-border bg-muted/10">
                        <Eye className="h-8 w-8 text-muted-foreground/20 mb-2" />
                        <p className="text-sm font-medium text-muted-foreground">Sin piso piloto seleccionado</p>
                        <p className="text-xs text-muted-foreground/60 mt-0.5 mb-3">Elige una unidad del listado de disponibilidad</p>
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 rounded-full" onClick={() => setShowFlatPickerOpen(true)}>
                          <Plus className="h-3 w-3" /> Seleccionar unidad
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })()}

            {/* ── 7.5 REGLAS DE MARKETING ──
                 Solo aparecen cuando la promoción ESTÁ PUBLICADA
                 (status=active + completa). Antes de publicar no
                 tiene sentido · la promo aún no se comparte con
                 ninguna agencia. Y si es de uso interno
                 (`canShareWithAgencies === false`) tampoco.
                 Tanto promotor como agencia ven la tarjeta; solo el
                 promotor puede editarla (botón oculto en modo collab). */}
            {p.status === "active" && !isIncomplete && sharingEnabledForPromo && (
              <MarketingRulesCard
                promotionId={p.id}
                readOnly={viewAsCollaborator}
                onEdit={viewAsCollaborator ? undefined : () => setMarketingRulesOpen(true)}
              />
            )}

            {/* ── 8. CONTACTOS (al final) ── */}
            <ContactFooter
              contacts={contacts}
              website={website}
              puntosDeVenta={salesOffices}
              comerciales={viewAsCollaborator ? [] : comercialesList}
              onAddMember={viewAsCollaborator ? undefined : () => setAddComercialOpen(true)}
              onAddOffice={viewAsCollaborator ? undefined : () => setPickOfficesOpen(true)}
              onEditOffices={viewAsCollaborator ? undefined : () => setEditOpen("salesOffices")}
              hideManagement={viewAsCollaborator}
            />
              </div>
              {/* ── END LEFT COLUMN ── */}

              {/* ── RIGHT RAIL: dock de acciones rápidas (compartido con
                   la tab Disponibilidad para UX consistente) + tarjeta
                   de reglas de marketing debajo (2xl+ · animada la
                   primera vez, se apaga al configurar).
                   · Solo aparece cuando la promoción está PUBLICADA
                     (status=active + completa). Antes de publicar no
                     se comparte con nadie, la regla no aplica. */}
              {renderQuickActionsRail(
                p.status === "active" && !isIncomplete && sharingEnabledForPromo && !viewAsCollaborator ? (
                  <MarketingRulesSidebarCard
                    promotionId={p.id}
                    onEdit={() => setMarketingRulesOpen(true)}
                  />
                ) : undefined
              )}
            </div>

          </>
        )}

        {/* ═══ TAB: AVAILABILITY ═══ */}
        {activeTabKey === "Availability" && (
          <div className="flex gap-4 lg:flex-row flex-col w-full max-w-content mx-auto min-w-0">
            {/* Main content */}
            <div className="flex-1 min-w-0 order-2 lg:order-1">
              <PromotionAvailabilityFull
                promotionId={p.id}
                isCollaboratorView={viewAsCollaborator}
                {...(isDraft && draftState && draftUnitsForView
                  ? {
                      units: draftUnitsForView,
                      onUnitsChange: (nextUnits: Unit[]) => {
                        const byId = new Map(nextUnits.map((u) => [u.id, u]));
                        const nextData = draftState.unidades
                          .filter((u) => byId.has(u.id))
                          .map((u) => mergeUnitIntoUnitData(u, byId.get(u.id)!));
                        patchDraft({ unidades: nextData });
                      },
                      hideExternalActions: true,
                    }
                  : {})}
                promotionCtx={{
                  nombrePromocion: p.name,
                  ciudad: p.location?.split(",")[0]?.trim(),
                  provincia: p.location?.split(",")[1]?.trim(),
                  ...(isDraft && draftState
                    ? {
                        deliveryYear: draftState.fechaEntrega ?? draftState.trimestreEntrega ?? undefined,
                        energyCert: draftState.certificadoEnergetico,
                        descripcion: draftState.descripcion,
                        caracteristicas: draftState.caracteristicasVivienda,
                        hitosPago: draftState.hitosPago,
                        importeReserva: draftState.importeReserva,
                        amenities: {
                          piscinaComunitaria: draftState.piscinaComunitaria,
                          piscinaInterna: draftState.piscinaInterna,
                          zonaSpa: draftState.zonaSpa,
                          zonaInfantil: draftState.zonaInfantil,
                          urbanizacionCerrada: draftState.urbanizacionCerrada,
                        },
                      }
                    : {}),
                }}
              />
            </div>

            {/* Right rail · mismo dock + SidebarCard que en Vista general
                (solo si está publicada · ver gate en Vista general). */}
            {renderQuickActionsRail(
              p.status === "active" && !isIncomplete && sharingEnabledForPromo && !viewAsCollaborator ? (
                <MarketingRulesSidebarCard
                  promotionId={p.id}
                  onEdit={() => setMarketingRulesOpen(true)}
                />
              ) : undefined
            )}
          </div>
        )}

        {activeTabKey === "Agencies" && !viewAsCollaborator && (
          <AgenciasTabStats
            promotion={p}
            canShare={canShare}
            sharingEnabled={sharingEnabledForPromo}
            isIncomplete={isIncomplete}
            isDraft={isDraft}
            onInvitar={() => tryInvite()}
            onOpenStats={() => setStatsOverlayOpen(true)}
            onActivateSharing={() => setActivateSharingOpen(true)}
            activateSharingHref={getWizardUrl("Collaborators", returnPath, rawDraftId, promoIdForWizard)}
            onOpenPendientes={() => { /* solicitudes e invitaciones ya se
              muestran inline en la tab Agencias; el dialog queda deprecado */ }}
          />
        )}

        {/* ═══ TAB: COMISIONES ═══ */}
        {activeTabKey === "Comisiones" && (
          <div className="space-y-5">
            {/* Aviso · compartir desactivado · text-link al wizard
              * (la activación tiene múltiples opciones · va al paso
              * de Colaboradores donde se configura todo). */}
            {!viewAsCollaborator && !sharingEnabledForPromo && (
              <div className="rounded-2xl border border-warning/25 bg-warning/10 p-4 flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" strokeWidth={1.5} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-warning mb-0.5">
                    Compartir con agencias está desactivado
                  </p>
                  <p className="text-xs text-warning/80 leading-relaxed">
                    Mientras esté desactivado, no puedes invitar ni compartir esta
                    promoción con colaboradores.{" "}
                    <Link
                      to={getWizardUrl("Collaborators", returnPath, rawDraftId, promoIdForWizard)}
                      className="font-semibold text-warning underline-offset-2 hover:underline"
                    >
                      Configurar comisiones para colaborar →
                    </Link>
                  </p>
                </div>
              </div>
            )}

            {/* Commission structure card · si no hay `collaboration`
             *  object marcamos visualmente con borde rojo + chip
             *  "Pendiente" para que sea evidente que falta. */}
            <div
              data-section-missing={!p.collaboration ? "true" : undefined}
              className={cn(
                "rounded-2xl bg-card shadow-soft overflow-hidden scroll-mt-20",
                p.collaboration ? "border border-border" : "border-2 border-destructive/40",
              )}
            >
              <div className="px-5 pt-4 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className={cn(
                    "text-sm font-semibold",
                    p.collaboration ? "text-foreground" : "text-destructive",
                  )}>
                    Estructura de comisiones
                  </h2>
                  {!p.collaboration && (
                    <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-destructive/10 text-destructive text-[10.5px] font-semibold">
                      Pendiente
                    </span>
                  )}
                </div>
                {!viewAsCollaborator && (
                  <button onClick={() => navigate(getWizardUrl("Collaborators", returnPath, rawDraftId, promoIdForWizard))}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-background/90 border border-border/60 text-xs text-muted-foreground hover:text-foreground shadow-soft transition-colors">
                    <Pencil className="h-3 w-3" /> Editar
                  </button>
                )}
              </div>
              <div className="px-5 pb-5">
                {p.collaboration ? (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      {p.collaboration.diferenciarNacionalInternacional && p.collaboration.diferenciarComisiones ? (
                        <>
                          <div className="flex items-center justify-between p-2.5 rounded-lg border border-primary/30 bg-primary/5">
                            <div className="flex items-center gap-2.5">
                              <Globe className="h-3.5 w-3.5 text-primary" />
                              <span className="text-xs text-foreground">Clientes internacionales</span>
                            </div>
                            <span className="text-sm font-bold text-foreground">{p.collaboration.comisionInternacional}%</span>
                          </div>
                          <div className="flex items-center justify-between p-2.5 rounded-lg border border-border">
                            <div className="flex items-center gap-2.5">
                              <Home className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs text-foreground">Clientes nacionales</span>
                            </div>
                            <span className="text-sm font-bold text-foreground">{p.collaboration.comisionNacional}%</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-between p-3 rounded-lg border border-primary/30 bg-primary/5">
                          <div className="flex items-center gap-2.5">
                            <Handshake className="h-3.5 w-3.5 text-primary" />
                            <span className="text-xs text-foreground">Porcentaje de comisión</span>
                          </div>
                          <span className="text-sm font-bold text-foreground">{p.collaboration.comisionInternacional}%</span>
                        </div>
                      )}
                    </div>

                    <div className="h-px bg-border/40" />

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <InfoItem icon={Banknote} label="Forma de pago"
                        value={p.collaboration.formaPagoComision === "escritura" ? "En firma de escritura"
                          : p.collaboration.formaPagoComision === "proporcional" ? "Proporcional"
                          : p.collaboration.formaPagoComision === "personalizado" ? "Hitos personalizados" : "Sin definir"} />
                      <InfoItem icon={Globe} label="Clasificación de clientes"
                        value={p.collaboration.diferenciarNacionalInternacional ? "Nacional e internacional" : "Unificada"}
                        sub={p.collaboration.agenciasRefusarNacional ? "Las agencias pueden rechazar nacionales" : undefined} />
                      <InfoItem icon={Shield} label="IVA" value={p.collaboration.ivaIncluido ? "Incluido en la comisión" : "No incluido"} />
                    </div>

                    {p.collaboration.formaPagoComision === "personalizado" && p.collaboration.hitosComision.length > 0 && (
                      <>
                        <div className="h-px bg-border/40" />
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">Hitos de comisión</p>
                          <div className="space-y-1.5">
                            {p.collaboration.hitosComision.map((h, i) => (
                              <div key={i} className="flex items-center justify-between p-2.5 rounded-lg border border-border">
                                <span className="text-xs text-foreground">El cliente paga {h.pagoCliente}%</span>
                                <span className="text-xs font-bold text-foreground">{h.pagoColaborador}% de comisión</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    <div className="p-2.5 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Estimado por venta:</span>{" "}
                        {formatPrice(p.priceMin * p.collaboration.comisionInternacional / 100)} – {formatPrice(p.priceMax * p.collaboration.comisionInternacional / 100)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <EmptyState icon={Handshake} message="Sin estructura de comisiones definida" sub="Configura las comisiones para empezar a colaborar" />
                )}
              </div>
            </div>

            {/* Registration conditions card */}
            <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
              <div className="px-5 pt-4 pb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Condiciones de registro de clientes</h2>
                {!viewAsCollaborator && (
                  <button onClick={() => navigate(getWizardUrl("Collaborators", returnPath, rawDraftId, promoIdForWizard))}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-background/90 border border-border/60 text-xs text-muted-foreground hover:text-foreground shadow-soft transition-colors">
                    <Pencil className="h-3 w-3" /> Editar
                  </button>
                )}
              </div>
              <div className="px-5 pb-5">
                {p.collaboration && p.collaboration.condicionesRegistro.length > 0 ? (
                  <div className="space-y-4">
                    <p className="text-xs text-muted-foreground">Las agencias deben proporcionar los siguientes datos al registrar un cliente para esta promoción:</p>
                    <div className="space-y-1.5">
                      {p.collaboration.condicionesRegistro.map(c => (
                        <div key={c} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border">
                          <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <ClipboardList className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <span className="text-xs font-medium text-foreground">{conditionLabels[c] || c}</span>
                          {["nombre_completo", "ultimas_4_cifras", "nacionalidad"].includes(c) && (
                            <Tag variant="warning" size="sm" className="ml-auto">Obligatorio</Tag>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/50">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-foreground">
                        <span className="font-medium">Validez del registro:</span>{" "}
                        {p.collaboration.validezRegistroDias === 0 || !p.collaboration.validezRegistroDias
                          ? "No expira"
                          : `${p.collaboration.validezRegistroDias} días`}
                      </span>
                    </div>
                  </div>
                ) : (
                  <EmptyState icon={ClipboardList} message="Sin condiciones de registro definidas" sub="Define qué datos deben proporcionar las agencias" />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ TAB: RECORDS ═══
             Misma vista que /registros · filtrada por esta promoción.
             Reusa RegistrosEmbedded · single source of truth. */}
        {activeTabKey === "Records" && !viewAsCollaborator && (
          <RegistrosEmbedded
            filterPromotionId={p.id}
            emptyTitle="Sin registros para esta promoción"
            emptyDescription={`Cuando una agencia registre un cliente para ${p.name}, aparecerá aquí. Click en cualquier registro para abrirlo en la bandeja completa.`}
          />
        )}

        {/* ═══ TAB: DOCUMENTS ═══ */}
        {activeTabKey === "Documents" && (
          <DocumentsTab
            openFolder={openDocFolder}
            onOpenFolder={setOpenDocFolder}
            blockedAgencies={blockedAgencies}
            onToggleBlockAgency={(folder, agencyId) => {
              setBlockedAgencies(prev => {
                const s = new Set(prev[folder] || []);
                if (s.has(agencyId)) s.delete(agencyId); else s.add(agencyId);
                return { ...prev, [folder]: s };
              });
            }}
            folderLocked={folderLocked}
            onToggleFolderLock={(folder) => {
              setFolderLocked(prev => ({ ...prev, [folder]: !prev[folder] }));
            }}
            promotionName={p.name}
            totalUnits={p.totalUnits}
            readOnly={viewAsCollaborator}
          />
        )}
      </div>

      {/* Client Registration dialog — en vista agencia arrancamos en flujo
          directo (no hay modo colaborador cuando tú misma eres la agencia).
          `registrationRequirements` puede definirlas el promotor en el
          wizard (hoy no se persiste por promoción, se usa default). */}
      <ClientRegistrationDialog
        open={registerClientOpen}
        onOpenChange={setRegisterClientOpen}
        promotionName={p.name}
        promotionId={p.id}
        validezDias={p.collaboration?.validezRegistroDias}
        isCollaboratorView={viewAsCollaborator}
        registrationRequirements={p.collaboration?.registrationRequirements}
      />

      {/* Visor fullscreen de la galería multimedia */}
      <ImageLightbox
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        photos={galleryImages}
        initialIndex={lightboxIdx}
        title={p.name}
        subtitle={p.location}
      />

      {/* Overlay fullscreen · Estadísticas de agencias de esta promoción.
          Monta `ColaboradoresEstadisticas` en modo embedded + lockedPromotionId.
          Se cierra con la X del top bar (o tecla Escape vía overlay). */}
      {statsOverlayOpen && (
        <div
          className="fixed inset-0 z-50 bg-background overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Estadísticas de esta promoción"
        >
          <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
            <div className="max-w-content mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Estadísticas · {p.name}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  Limitado a las agencias colaborando en esta promoción
                </p>
              </div>
              <button
                onClick={() => setStatsOverlayOpen(false)}
                className="h-10 w-10 rounded-full border border-border bg-card hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shadow-soft"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
          </header>
          <ColaboradoresEstadisticas
            lockedPromotionId={p.id}
            lockedPromotionName={p.name}
            embedded
          />
        </div>
      )}

      {/* Compartir promoción con agencias */}
      <SharePromotionDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        promotionId={p.id}
        promotionName={p.name}
      />

      {/* Guard · al intentar invitar agencias sin comisiones configuradas.
        * El CTA lleva al paso de Colaboradores del wizard con
        * `singleSave=1` · ahí el botón footer es "Guardar" en vez de
        * "Siguiente" porque solo hace falta este campo en este momento. */}
      <Dialog open={shareGuardOpen} onOpenChange={setShareGuardOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configura las comisiones primero</DialogTitle>
            <DialogDescription className="leading-relaxed pt-2">
              Para poder compartir esta promoción con agencias, necesitas
              configurar la <strong>estructura de comisiones</strong> ·
              cuánto cobrarán los colaboradores y cuándo se les paga.
              Sin eso las agencias no pueden calcular su liquidación.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShareGuardOpen(false)}
              className="rounded-full"
            >
              Más tarde
            </Button>
            <Button
              onClick={() => {
                setShareGuardOpen(false);
                navigate(getWizardUrl("Collaborators", returnPath, rawDraftId, promoIdForWizard) + "&singleSave=1");
              }}
              className="rounded-full"
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.75} />
              Configurar comisiones
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reglas de marketing · qué canales NO pueden usar las agencias */}
      <MarketingRulesDialog
        open={marketingRulesOpen}
        onOpenChange={setMarketingRulesOpen}
        promotionId={p.id}
        promotionName={p.name}
      />

      {/* Activar compartir · se abre desde la tab Comisiones */}
      <ActivateSharingDialog
        open={activateSharingOpen}
        onOpenChange={setActivateSharingOpen}
        promotionName={p.name}
        initialCommission={p.collaboration?.comisionInternacional ?? p.commission ?? 5}
        initialDuration={12}
        onActivate={({ comision, duracionMeses }) => {
          setCanShareOverride(true);
          toast.success("Compartir activado", {
            description: `Ya puedes invitar agencias a ${p.name} · ${comision}% · ${duracionMeses} ${duracionMeses === 1 ? "mes" : "meses"} por defecto.`,
          });
          // TODO(backend): POST /api/promociones/:id/compartir/activar { comision, duracionMeses }
        }}
      />

      {/* FAB móvil — acciones rápidas de la ficha. En desktop (sm+)
          estas acciones ya están como botones en la barra superior; en
          móvil las reunimos bajo un + flotante con dropup. */}
      {/* FAB móvil · posicionado con safe-area + 60px (altura del
          MobileBottomNav) + 16px de gap para no montarse a la barra.
          flex items-end fija el botón a la derecha aunque el menú
          expandido sea más ancho que el botón. */}
      <div
        className="sm:hidden fixed right-4 z-40 flex flex-col items-end"
        style={{ bottom: "calc(60px + env(safe-area-inset-bottom) + 16px)" }}
      >
        {mobileFabOpen && (
          <>
            <div className="fixed inset-0 bg-foreground/40 backdrop-blur-md -z-10" onClick={() => setMobileFabOpen(false)} />
            <div className="flex flex-col items-end gap-2 mb-3 animate-in fade-in slide-in-from-bottom-2 duration-150">
              {/* Sólo promotor · invitar agencia colaboradora. */}
              {!viewAsCollaborator && !agentMode && (
                <FabAction
                  icon={UserPlus}
                  label="Invitar a colaborar"
                  onClick={() => { setMobileFabOpen(false); setActiveTab(visibleTabs.indexOf("Agencies")); }}
                />
              )}
              {/* Registrar/Enviar sólo si la promoción está publicada.
                  Agencia · bloqueado hasta que añada la promo a su cartera. */}
              {p.status === "active" && !isIncomplete && (
                <>
                  {inCartera ? (
                    <FabAction
                      icon={Users}
                      label="Registrar cliente"
                      onClick={() => { setMobileFabOpen(false); setRegisterClientOpen(true); }}
                    />
                  ) : (
                    <FabAction
                      icon={Users}
                      label="Añade a tu cartera primero"
                      onClick={() => { setMobileFabOpen(false); }}
                    />
                  )}
                  <FabAction
                    icon={Mail}
                    label="Enviar email"
                    onClick={() => { setMobileFabOpen(false); setSendEmailOpen(true); }}
                  />
                </>
              )}
              <FabAction
                icon={Download}
                label="Listado de precios"
                onClick={() => { setMobileFabOpen(false); setPriceListOpen(true); }}
              />
            </div>
          </>
        )}
        <button
          type="button"
          onClick={() => setMobileFabOpen(v => !v)}
          aria-label={mobileFabOpen ? "Cerrar acciones" : "Abrir acciones"}
          className={cn(
            "h-14 w-14 rounded-full bg-foreground text-background shadow-soft-lg flex items-center justify-center transition-transform duration-200",
            mobileFabOpen && "rotate-45"
          )}
        >
          <Plus className="h-6 w-6" strokeWidth={2} />
        </button>
      </div>

      {/* Send email dialog (template picker + WYSIWYG) */}
      {/* En modo agencia, el envío salta directo a "Cliente" (no hay
          colaboradores que invitar — la agencia trabaja con sus propios
          clientes). Regla de producto: la agencia nunca envía a otras
          agencias desde la ficha. */}
      <SendEmailDialog
        open={sendEmailOpen}
        onOpenChange={setSendEmailOpen}
        mode="promotion"
        promotionId={id}
        defaultAudience={isAgencyUser ? "client" : undefined}
      />

      {/* Listado de precios descargable (PDF vía window.print). */}
      <PriceListDialog open={priceListOpen} onOpenChange={setPriceListOpen} promotion={p} agencyMode={viewAsCollaborator || agentMode} />

      {/* ═══ EDIT SECTION DIALOGS ═══
          En modo borrador cada onSave escribe sobre el WizardState del
          draft y autosave persiste al localStorage. En modo publicada
          los callbacks quedan no-op (pendiente backend). */}
      <EditMultimediaDialog
        open={editOpen === "multimedia"}
        onOpenChange={(v) => setEditOpen(v ? "multimedia" : null)}
        images={galleryImages}
        promotionId={p.id}
        onSave={(imgs) => {
          if (!isDraft || !draftState) return;
          const prev = draftState.fotos ?? [];
          const next: FotoItem[] = imgs.map((url, i) => ({
            id: prev[i]?.id ?? `foto-${Date.now()}-${i}`,
            url,
            nombre: prev[i]?.nombre ?? `Imagen ${i + 1}`,
            categoria: prev[i]?.categoria ?? ("otra" as FotoCategoria),
            esPrincipal: prev[i]?.esPrincipal ?? i === 0,
            bloqueada: prev[i]?.bloqueada ?? false,
            orden: i,
          }));
          patchDraft({ fotos: next });
          toast.success("Multimedia actualizada");
        }}
      />
      <EditBasicInfoDialog
        open={editOpen === "basicInfo"}
        onOpenChange={(v) => setEditOpen(v ? "basicInfo" : null)}
        propertyTypes={p.propertyTypes || []}
        onSave={(data) => {
          if (!isDraft) return;
          patchDraft({
            amenities: data.amenities,
            caracteristicasVivienda: data.features,
          });
          toast.success("Información básica actualizada");
        }}
      />
      <EditStructureDialog
        open={editOpen === "structure"}
        onOpenChange={(v) => setEditOpen(v ? "structure" : null)}
        type={typeLabel || ""}
        structure={p.totalUnits > 10 ? "Multibloque" : "Bloque único"}
        phase={constructionPhaseLabel}
        progress={p.constructionProgress || 0}
        onSave={(data) => {
          if (!isDraft) return;
          // Mapeo label → key de FaseConstruccion (case-insensitive + trim)
          // + persistimos el % ajustado manualmente.
          const normalize = (s: string) => s.trim().toLowerCase();
          const target = normalize(data.phase);
          const opt = faseConstruccionOptions.find((o) => normalize(o.label) === target)
                   ?? faseConstruccionOptions.find((o) => normalize(o.label).includes(target));
          patchDraft({
            ...(opt ? { faseConstruccion: opt.value } : {}),
            constructionProgressOverride: data.progress,
          });
          toast.success("Estructura actualizada");
        }}
        onOpenWizard={() => navigate(getWizardUrl("Basic info", returnPath, rawDraftId, promoIdForWizard))}
      />
      <EditDescriptionDialog
        open={editOpen === "description"}
        onOpenChange={(v) => setEditOpen(v ? "description" : null)}
        description={draftState?.descripcion ?? (p as any).description ?? ""}
        onSave={(data) => {
          if (!isDraft) return;
          patchDraft({
            descripcion: data.description,
            descripcionIdiomas: data.descriptions,
          });
          toast.success("Descripción guardada");
        }}
      />
      <EditLocationDialog
        open={editOpen === "location"}
        onOpenChange={(v) => setEditOpen(v ? "location" : null)}
        location={p.location || ""}
        onSave={(loc) => {
          if (!isDraft || !draftState) return;
          const parts = loc.split(",").map((s) => s.trim());
          patchDraft({
            direccionPromocion: {
              ...draftState.direccionPromocion,
              ciudad: parts[0] || "",
              provincia: parts[1] || draftState.direccionPromocion.provincia || "",
            },
          });
          toast.success("Ubicación actualizada");
        }}
      />
      <EditPaymentPlanDialog
        open={editOpen === "paymentPlan"}
        onOpenChange={(v) => setEditOpen(v ? "paymentPlan" : null)}
        onSave={() => {}}
      />
      <EditShowHouseDialog
        open={editOpen === "showHouse"}
        onOpenChange={(v) => setEditOpen(v ? "showHouse" : null)}
        onSave={() => {
          if (!isDraft) return;
          patchDraft({ pisoPiloto: true });
          toast.success("Piso piloto activado");
        }}
      />
      <EditDocumentDialog
        open={editOpen === "memoria"}
        onOpenChange={(v) => setEditOpen(v ? "memoria" : null)}
        title="Subir memoria de calidades"
        description="Sube el PDF de la memoria de calidades de esta promoción."
        icon={FileText}
        onSave={(files) => {
          if (!isDraft) return;
          patchDraft({ documentosMemoria: files.map((f) => f.name) });
          toast.success(`${files.length} documento${files.length === 1 ? "" : "s"} de memoria guardados`);
        }}
      />
      <EditDocumentDialog
        open={editOpen === "planos"}
        onOpenChange={(v) => setEditOpen(v ? "planos" : null)}
        title="Subir planos generales"
        description="Sube planos generales (PDF o imágenes)."
        icon={Layers}
        accept=".pdf,.jpg,.png"
        multiple
        onSave={(files) => {
          if (!isDraft) return;
          patchDraft({ documentosPlanos: files.map((f) => f.name) });
          toast.success(`${files.length} plano${files.length === 1 ? "" : "s"} guardados`);
        }}
      />
      <EditDocumentDialog
        open={editOpen === "brochure"}
        onOpenChange={(v) => setEditOpen(v ? "brochure" : null)}
        title="Subir brochure"
        description="Sube el PDF oficial del brochure para compradores y agencias."
        icon={BookOpen}
        onSave={(files) => {
          setBrochureRemoved(false);  // al subir uno nuevo, reactiva la acción rápida
          if (!isDraft) { toast.success("Brochure guardado"); return; }
          patchDraft({ documentosBrochure: files.map((f) => f.name) });
          toast.success("Brochure guardado");
        }}
      />
      <EditContactsDialog
        open={editOpen === "contacts"}
        onOpenChange={(v) => setEditOpen(v ? "contacts" : null)}
        website={draftState?.contactoWeb || website}
        onSave={(data) => {
          if (!isDraft) return;
          patchDraft({
            contactoWeb: data.website,
            contactoTelefono: data.phone,
            contactoEmail: data.email,
          });
          toast.success("Contactos públicos actualizados");
        }}
      />
      <EditInventoryDialog open={editOpen === "inventory"} onOpenChange={(v) => setEditOpen(v ? "inventory" : null)} onGoAvailability={() => setActiveTab(visibleTabs.indexOf("Availability"))} />
      <EditSalesOfficesDialog open={editOpen === "salesOffices"} onOpenChange={(v) => setEditOpen(v ? "salesOffices" : null)} offices={salesOffices} onSave={setSalesOffices} />


      {/* Pick team members (visual multi-select) */}
      <PickTeamMembersDialog
        open={addComercialOpen}
        onOpenChange={setAddComercialOpen}
        pool={activeTeamMembers.map(m => ({ id: m.id, name: m.name, role: m.role, email: m.email, avatar: m.avatar }))}
        alreadyAddedIds={comercialesList.map(c => c.id)}
        onConfirm={(members) => {
          const newOnes: Comercial[] = members.map(m => ({
            id: m.id,
            nombre: m.name,
            email: m.email,
            avatar: m.avatar,
            permissions: m.permissions,
          }));
          setComercialesList(prev => [...prev, ...newOnes]);
        }}
      />

      {/* Pick sales offices (visual multi-select) */}
      <PickSalesOfficesDialog
        open={pickOfficesOpen}
        onOpenChange={setPickOfficesOpen}
        pool={workspaceOficinas.map((o) => ({
          id: o.id,
          name: o.nombre,
          address: o.direccion,
          city: o.ciudad,
          phone: o.telefono,
          email: o.email,
          coverUrl: o.coverUrl || undefined,
        }))}
        alreadyAddedIds={salesOfficeIds}
        onConfirm={(picked) => {
          setSalesOfficeIds((prev) => [
            ...prev,
            ...picked.map((o) => o.id).filter((id) => !prev.includes(id)),
          ]);
        }}
      />


      {/* Show Flat Picker Dialog */}
      <Dialog open={showFlatPickerOpen} onOpenChange={setShowFlatPickerOpen}>
        <DialogContent className="sm:max-w-lg max-h-[70vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm">Seleccionar piso piloto</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-2">Elige una unidad del listado de disponibilidad</p>
          <div className="flex-1 overflow-auto space-y-1.5 py-2">
            {(unitsByPromotion[p.id] || []).map(unit => (
              <button
                key={unit.id}
                onClick={() => { setShowFlatUnitId(unit.id); setShowFlatPickerOpen(false); }}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                  showFlatUnitId === unit.id ? "border-primary bg-primary/5" : "border-border hover:border-border/60 hover:bg-muted/20"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
                    <Home className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{unit.block} - P{unit.floor} {unit.door}</p>
                    <p className="text-xs text-muted-foreground">{unit.bedrooms} hab · {unit.builtArea} m² · {unit.type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">{formatPrice(unit.price)}</p>
                  <Tag variant={unit.status === "available" ? "success" : unit.status === "reserved" ? "warning" : "muted"} size="sm">
                    {unit.status === "available" ? "Disponible" : unit.status === "reserved" ? "Reservado" : "Vendido"}
                  </Tag>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══ AGENCIES TAB ═══

function formatCompact(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
  return `${n}`;
}

const agencyStatusOptions = ["Active", "Pending", "Expired"];
const agencyTypeOptions = ["Agency", "Broker", "Network"];
const agencyStatusLabels: Record<string, string> = {
  Active: "Activa",
  Pending: "Pendiente",
  Expired: "Expirada",
};
const agencyTypeLabels: Record<string, string> = {
  Agency: "Agencia",
  Broker: "Broker",
  Network: "Red",
};

/* ─────────── Sparkline ─────────── */
function Sparkline({ data, color = "currentColor" }: { data: number[]; color?: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 64, h = 22;
  const step = w / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${h - ((v - min) / range) * h}`).join(" ");
  const areaPoints = `0,${h} ${points} ${w},${h}`;
  return (
    <svg width={w} height={h} className="overflow-visible" style={{ color }}>
      <polygon points={areaPoints} fill="currentColor" opacity="0.12" />
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={w} cy={h - ((data[data.length - 1] - min) / range) * h} r="2" fill="currentColor" />
    </svg>
  );
}

/* ─────────── KPI Card ─────────── */
function AgencyKPI({ icon: Icon, label, value, delta, accent, trend, trendColor }: { icon: any; label: string; value: string; delta?: string; accent?: string; trend?: number[]; trendColor?: string }) {
  const positive = delta?.startsWith("+");
  return (
    <div className="group relative flex-1 min-w-0 rounded-2xl bg-card border border-border p-4 sm:p-5 shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0", accent || "bg-muted/60")}>
          <Icon className="h-4 w-4 text-foreground/80" strokeWidth={1.75} />
        </div>
        {trend && (
          <div className={cn("opacity-70 group-hover:opacity-100 transition-opacity", trendColor || "text-primary")}>
            <Sparkline data={trend} />
          </div>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{label}</p>
      <div className="flex items-baseline gap-2 mt-1.5">
        <p className="text-2xl sm:text-[26px] font-bold text-foreground tabular-nums leading-none tracking-tight">{value}</p>
        {delta && (
          <span className={cn("text-[11px] font-semibold tabular-nums inline-flex items-center gap-0.5", positive ? "text-primary" : "text-destructive")}>
            <TrendingUp className={cn("h-3 w-3", !positive && "rotate-180")} strokeWidth={2.25} /> {delta}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─────────── Requests banner ─────────── */
function RequestsBanner({ requests }: { requests: Agency[] }) {
  if (requests.length === 0) return null;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] via-primary/[0.02] to-transparent p-4 sm:p-5">
      <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="relative flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3.5 flex-1 min-w-[240px]">
          <div className="relative h-11 w-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 text-primary" strokeWidth={1.75} />
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow-soft">{requests.length}</span>
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">{requests.length} nueva{requests.length > 1 ? "s" : ""} solicitud{requests.length > 1 ? "es" : ""} de colaboración</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Aprueba para reforzar la red comercial de esta promoción</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex -space-x-2">
            {requests.slice(0, 4).map((r) => (
              <div key={r.id} className="h-8 w-8 rounded-full border-2 border-background overflow-hidden bg-white shadow-soft" title={r.name}>
                <img src={r.logo || ""} alt={r.name} className="w-full h-full object-contain p-0.5" />
              </div>
            ))}
            {requests.length > 4 && (
              <div className="h-8 w-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground">+{requests.length - 4}</div>
            )}
          </div>
          <Button size="sm" className="rounded-full text-xs h-9 gap-1.5 px-4 shadow-soft">Revisar solicitudes <ArrowUpRight className="h-3.5 w-3.5" /></Button>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Top performers ─────────── */
function TopPerformers({ list }: { list: Agency[] }) {
  if (list.length === 0) return null;
  const top = list.slice(0, 3);
  const maxSales = Math.max(...top.map((a) => a.salesVolume), 1);
  const medals = [
    { ring: "ring-warning/40", bg: "bg-gradient-to-br from-warning/80 to-warning", text: "text-white" },
    { ring: "ring-zinc-300/60", bg: "bg-gradient-to-br from-zinc-300 to-zinc-400", text: "text-white" },
    { ring: "ring-orange-400/40", bg: "bg-gradient-to-br from-orange-400 to-orange-600", text: "text-white" },
  ];
  return (
    <div className="rounded-2xl bg-card border border-border shadow-soft p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-warning/10 flex items-center justify-center">
            <Trophy className="h-3.5 w-3.5 text-warning" strokeWidth={2} />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Mejores colaboradores</h3>
          <span className="text-[10px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full font-medium">En esta promoción</span>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {top.map((ag, idx) => {
          const m = medals[idx];
          const pct = (ag.salesVolume / maxSales) * 100;
          return (
            <div key={ag.id} className="group relative flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/10 hover:bg-muted/30 hover:border-border/60 transition-all cursor-pointer overflow-hidden">
              <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary/[0.04] to-transparent transition-all duration-500" style={{ width: `${pct}%` }} />
              <div className={cn("relative h-8 w-8 rounded-full ring-2 flex items-center justify-center text-xs font-bold shrink-0 shadow-soft", m.bg, m.ring, m.text)}>{idx + 1}</div>
              <div className="relative h-10 w-10 rounded-full overflow-hidden bg-white border border-border shrink-0 shadow-soft">
                <img src={ag.logo || ""} alt={ag.name} className="w-full h-full object-contain p-0.5" />
              </div>
              <div className="relative min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground truncate">{ag.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-sm font-bold text-foreground tabular-nums">{formatCompact(ag.salesVolume)}€</span>
                  <span className="text-[10px] text-muted-foreground">· {ag.registrations} regs</span>
                </div>
              </div>
              <ArrowUpRight className="relative h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-foreground transition-colors shrink-0" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────── ActionRail (vertical floating icon bar on hover) ─────────── */
function AgencyActionRail() {
  const items = [
    { icon: FileText, label: "Ver ficha" },
    { icon: Download, label: "Descargar informe" },
    { icon: Share2, label: "Compartir" },
    { icon: MessageCircle, label: "Comentar" },
    { icon: Info, label: "Más info" },
  ];
  return (
    <div className="absolute top-1/2 -translate-y-1/2 left-full ml-2 opacity-0 group-hover:opacity-100 group-hover:ml-3 transition-all duration-200 z-30 hidden xl:block pointer-events-none group-hover:pointer-events-auto">
      <div className="flex flex-col items-center gap-1 bg-card border border-border rounded-full py-2 px-1 shadow-soft-lg">
        {items.map(({ icon: Icon, label }, i) => (
          <button key={i} onClick={(e) => e.stopPropagation()} title={label} aria-label={label}
            className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </button>
        ))}
      </div>
    </div>
  );
}

function AgenciesTab({ promotionId, navigate, onInvite, canShare = true, onActivateSharing }: { promotionId: string; navigate: (path: string) => void; onInvite?: () => void; canShare?: boolean; onActivateSharing?: () => void }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  /* SCOPED · resolver el workspace dueño de esta promoción y filtrar
   *  todo lo que aparece aquí a agencias relacionadas con MI
   *  workspace · evita que el panel de agencias de una promo de AEDAS
   *  exponga el roster de Luxinmo. */
  const promoOwnerOrgId = useMemo(() => {
    const all = [...promotions, ...developerOnlyPromotions];
    const p = all.find((x) => x.id === promotionId);
    return p?.ownerOrganizationId ?? "developer-default";
  }, [promotionId]);
  const myCollabAgencies = useMemo(
    () => getAgenciesForDeveloper(promoOwnerOrgId, agencies),
    [promoOwnerOrgId],
  );
  const myCollabAgencyIds = useMemo(
    () => new Set(myCollabAgencies.map((a) => a.id)),
    [myCollabAgencies],
  );

  const newRequests = agencies.filter(a => a.isNewRequest && a.requestedPromotionIds?.includes(promotionId));
  const collaboratingHere = agencies.filter(a => !a.isNewRequest && a.promotionsCollaborating.includes(promotionId));
  /* Solo "otras agencias del mismo workspace" · no expone agencias
   *  de otros developers · clasifica las que YA colaboran con MI
   *  workspace pero no aún con esta promo concreta. */
  const otherPromoAgencies = agencies.filter(a =>
    !a.isNewRequest
    && a.promotionsCollaborating.length > 0
    && !a.promotionsCollaborating.includes(promotionId)
    && myCollabAgencyIds.has(a.id),
  );

  const allRelevant = [...newRequests, ...collaboratingHere];

  // KPIs scoped to this promotion (collaborating only — agencies actively working on it)
  const totals = {
    active: collaboratingHere.length,
    visits: collaboratingHere.reduce((s, a) => s + a.visitsCount, 0),
    registrations: collaboratingHere.reduce((s, a) => s + a.registrations, 0),
    sales: collaboratingHere.reduce((s, a) => s + a.salesVolume, 0),
  };

  const topPerformers = [...collaboratingHere].sort((a, b) => b.salesVolume - a.salesVolume);

  const filtered = allRelevant.filter(ag => {
    if (search) {
      const q = search.toLowerCase();
      if (!ag.name.toLowerCase().includes(q) && !ag.location.toLowerCase().includes(q)) return false;
    }
    if (statusFilter.length > 0 && !statusFilter.some(s => s.toLowerCase() === ag.status)) return false;
    if (typeFilter.length > 0 && !typeFilter.includes(ag.type)) return false;
    return true;
  });

  const sortedFiltered = [...filtered].sort((a, b) => {
    if (a.isNewRequest && !b.isNewRequest) return -1;
    if (!a.isNewRequest && b.isNewRequest) return 1;
    return b.salesVolume - a.salesVolume;
  });

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === sortedFiltered.length) setSelected(new Set());
    else setSelected(new Set(sortedFiltered.map(a => a.id)));
  };

  const hasSidebar = otherPromoAgencies.length > 0;

  return (
    <div className="space-y-5 w-full max-w-content mx-auto min-w-0">
      {/* KPI hero — scoped to this promotion */}
      {allRelevant.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <AgencyKPI icon={Building2} label="Agencias colaborando" value={`${totals.active}`} delta={totals.active > 0 ? "+1" : undefined} accent="bg-primary/10" trend={[1, 1, 2, 2, 2, 3, totals.active]} trendColor="text-primary" />
          <AgencyKPI icon={Eye} label="Visitas a esta promoción" value={`${totals.visits}`} delta="+18%" accent="bg-accent/10" trend={[20, 28, 35, 42, 50, 58, totals.visits]} trendColor="text-accent-foreground" />
          <AgencyKPI icon={FileCheck2} label="Registros" value={`${totals.registrations}`} delta="+9%" accent="bg-primary/10" trend={[5, 8, 10, 12, 15, 18, totals.registrations]} trendColor="text-primary" />
          <AgencyKPI icon={Euro} label="Volumen ventas" value={`${formatCompact(totals.sales)}€`} delta="+24%" accent="bg-warning/10" trend={[1, 2, 3, 4, 5, 6, 7]} trendColor="text-warning" />
        </div>
      )}

      {/* New requests banner */}
      <RequestsBanner requests={newRequests} />

      {/* Top performers — only if there are collaborating agencies */}
      <TopPerformers list={topPerformers} />

      {/* Header with search & filters — only if there are agencies */}
      {allRelevant.length > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
          <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
              <input
                placeholder="Buscar por nombre o ubicación..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 h-9 text-sm bg-muted/30 border-transparent focus:bg-background focus:border-border rounded-full border outline-none transition-colors"
              />
              {search && (
                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setSearch("")}>
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <AgencyFilterPill label="Estado" values={statusFilter} options={agencyStatusOptions} onChange={setStatusFilter} labels={agencyStatusLabels} />
            <AgencyFilterPill label="Tipo" values={typeFilter} options={agencyTypeOptions} onChange={setTypeFilter} labels={agencyTypeLabels} />
          </div>
          <div className="flex items-center gap-3">
            {selected.size > 0 && <span className="text-xs text-primary font-medium">{selected.size} seleccionadas</span>}
            <button onClick={selectAll} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              {selected.size === sortedFiltered.length && sortedFiltered.length > 0 ? "Deseleccionar" : "Seleccionar todo"}
            </button>
            <div className="hidden sm:block h-4 w-px bg-border/60" />
            <span className="hidden sm:inline text-xs text-muted-foreground"><span className="font-semibold text-foreground">{filtered.length}</span> agencias</span>
            <Button size="sm" onClick={onInvite} disabled={!canShare} className="rounded-full text-xs h-8 gap-1.5 px-3.5 disabled:opacity-50"><Plus className="h-3 w-3" /> Invitar agencia</Button>
          </div>
        </div>
      )}

      {/* Main layout: cards + sidebar right */}
      <div className={`flex gap-5 flex-col ${hasSidebar ? "lg:flex-row" : ""} w-full min-w-0`}>
        {/* Cards grid */}
        <div className="flex-1 min-w-0 space-y-5 order-2 lg:order-1">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
            {sortedFiltered.map((ag) => (
              <AgencyCard key={ag.id} agency={ag} promotionId={promotionId} selected={selected.has(ag.id)} onToggleSelect={() => toggleSelect(ag.id)} />
            ))}
          </div>

          {filtered.length === 0 && allRelevant.length > 0 && (
            <div className="py-16 text-center">
              <Building2 className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">Ninguna agencia coincide con tu búsqueda</p>
            </div>
          )}

          {allRelevant.length === 0 && (
            <div className="py-16 flex flex-col items-center text-center max-w-md mx-auto">
              <div className="h-16 w-16 rounded-2xl bg-muted/40 flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-muted-foreground/30" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1.5">No tienes agencias colaborando aún</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                Invita agencias para que puedan registrar clientes y vender las unidades de esta promoción.
              </p>
              <Button size="sm" onClick={onInvite} disabled={!canShare} className="gap-1.5 text-sm h-9 rounded-full disabled:opacity-50"><Plus className="h-3.5 w-3.5" /> Invitar agencia</Button>
            </div>
          )}
        </div>

        {/* Sidebar — only "no colaboran en esta promoción" (the request banner is on top) */}
        {hasSidebar && (
          <div className="w-full lg:w-[300px] lg:shrink-0 order-1 lg:order-2">
            <div className="lg:sticky lg:top-4 space-y-4">
              <div className="rounded-2xl border border-warning/30 bg-warning/10 dark:bg-warning/10 p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <Info className="h-3.5 w-3.5 text-warning shrink-0" />
                  <h3 className="text-xs font-semibold text-foreground leading-snug">No colaboran en esta promoción</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {otherPromoAgencies.length > 1 ? "Estas agencias ya colaboran" : "Esta agencia ya colabora"} contigo en otras promociones pero no en esta.
                </p>
                <div className="mt-3 space-y-1.5">
                  {otherPromoAgencies.map(a => (
                    <div key={a.id} className="flex items-center justify-between p-2 rounded-lg bg-background/60">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-7 w-7 rounded-full overflow-hidden bg-white shrink-0">
                          <img src={a.logo || ""} alt="" className="w-full h-full object-contain p-0.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{a.name}</p>
                          {(() => {
                            const s = getAgencyShareStats(a);
                            return (
                              <p className="text-[10px] text-muted-foreground">{s.sharedActive} de {s.activeTotal} promos</p>
                            );
                          })()}
                        </div>
                      </div>
                      <button
                        onClick={onInvite}
                        disabled={!canShare}
                        className="text-[10px] text-primary font-medium hover:underline shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
                      >
                        Invitar
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────── Commercial agency card (V2 style) ─────────── */
function AgencyCard({ agency: ag, promotionId, selected, onToggleSelect }: { agency: Agency; promotionId: string; selected: boolean; onToggleSelect: () => void }) {
  const logoUrl = ag.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(ag.name)}&background=e2e8f0&color=475569&size=120&font-size=0.33&bold=true`;
  const collabInThis = ag.promotionsCollaborating.includes(promotionId);
  const shareStats = getAgencyShareStats(ag);
  const collabCount = shareStats.sharedActive;
  const totalPromos = shareStats.activeTotal;
  const conversionRate = ag.visitsCount > 0 ? Math.round((ag.registrations / ag.visitsCount) * 100) : 0;

  return (
    <div className={cn(
      "group relative bg-card border rounded-2xl transition-all duration-300 hover:shadow-soft-lg hover:-translate-y-0.5",
      selected ? "border-primary ring-2 ring-primary/20" : ag.isNewRequest ? "border-primary/40" : "border-border"
    )}>
      <AgencyActionRail />

      {/* Selection */}
      <div className={`absolute top-3 left-3 z-20 transition-opacity ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
        <button onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
          className={cn("h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-colors shadow-soft",
            selected ? "bg-primary border-primary text-primary-foreground" : "bg-white/95 border-white/60 backdrop-blur-sm hover:border-primary")}>
          {selected && <Check className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Cover compact */}
      <div className="h-20 w-full relative overflow-hidden rounded-t-2xl">
        <img src={ag.cover || "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=200&fit=crop"} alt=""
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />
        <div className="absolute top-2.5 right-3 flex items-center gap-1.5">
          {ag.isNewRequest && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary text-primary-foreground flex items-center gap-1 shadow-soft">
              <Star className="h-2.5 w-2.5" /> Nueva solicitud
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 sm:px-5 pb-5 -mt-8 relative">
        <div className="flex items-end justify-between gap-3 mb-3">
          <div className="h-14 w-14 rounded-2xl border-4 border-card shadow-soft overflow-hidden bg-card shrink-0">
            <img src={logoUrl} alt={ag.name} className="w-full h-full object-contain bg-white p-1" />
          </div>
          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full",
            ag.status === "active" ? "bg-primary/10 text-primary dark:bg-primary/10" :
              ag.status === "pending" ? "bg-warning/10 text-warning dark:bg-warning/10" :
                ag.status === "expired" ? "bg-destructive/10 text-destructive dark:bg-destructive/10" :
                  "bg-muted text-muted-foreground"
          )}>
            {ag.status === "active" ? "Activa" : ag.status === "pending" ? "Pendiente" : ag.status === "expired" ? "Expirada" : "Inactiva"}
          </span>
        </div>

        <h3 className="text-sm font-bold text-foreground leading-snug truncate">{ag.name}</h3>
        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{ag.location}</span>
          <span className="text-muted-foreground/40">·</span>
          <span>{ag.type}</span>
        </div>

        {/* Collaboration status */}
        <div className="mt-3 flex items-center gap-2">
          {ag.isNewRequest ? (
            <span className="text-[11px] font-medium text-primary flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> Solicita colaborar en esta promoción
            </span>
          ) : collabInThis ? (
            <span className="text-[11px] font-medium text-primary flex items-center gap-1.5">
              <Check className="h-3 w-3" /> Colabora en esta promoción
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">{collabCount}/{totalPromos}</span> promociones · no en esta
            </span>
          )}
        </div>

        {/* Commercial metrics row */}
        <div className="grid grid-cols-4 gap-2 mt-4 pt-3.5 border-t border-border">
          <div className="text-center">
            <p className="text-sm font-bold text-foreground tabular-nums leading-none">{ag.visitsCount}</p>
            <p className="text-[9px] text-muted-foreground mt-1 uppercase tracking-wider">Visitas</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-foreground tabular-nums leading-none">{ag.registrations}</p>
            <p className="text-[9px] text-muted-foreground mt-1 uppercase tracking-wider">Regs</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-foreground tabular-nums leading-none">{conversionRate}%</p>
            <p className="text-[9px] text-muted-foreground mt-1 uppercase tracking-wider">Conv.</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-bold text-foreground tabular-nums leading-none">{formatCompact(ag.salesVolume)}€</p>
            <p className="text-[9px] text-muted-foreground mt-1 uppercase tracking-wider">Ventas</p>
          </div>
        </div>

        {/* CTA row */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
          {ag.isNewRequest ? (
            <>
              <Button size="sm" className="rounded-full text-xs h-8 flex-1 gap-1.5"><Check className="h-3 w-3" /> Aprobar</Button>
              <button className="px-3 h-8 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">Rechazar</button>
            </>
          ) : (
            <>
              <button className="flex-1 inline-flex items-center justify-center gap-1.5 h-8 rounded-full border border-border/60 text-xs font-medium text-foreground hover:bg-muted/30 transition-colors">
                <Eye className="h-3 w-3" /> Ver perfil
              </button>
              <button className="px-3 h-8 rounded-full bg-foreground text-background text-xs font-medium hover:bg-foreground/90 transition-colors inline-flex items-center gap-1.5">
                <MessageCircle className="h-3 w-3" /> Contactar
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AgencyFilterPill({ label, values, options, onChange, labels }: { label: string; values: string[]; options: string[]; onChange: (v: string[]) => void; labels?: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const toggle = (opt: string) => {
    onChange(values.includes(opt) ? values.filter(v => v !== opt) : [...values, opt]);
  };
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors whitespace-nowrap ${
          values.length > 0
            ? "bg-foreground text-background border-foreground"
            : "border-border/60 text-muted-foreground hover:text-foreground hover:border-foreground/40"
        }`}
      >
        {label}
        {values.length > 0 && <span className="ml-0.5 bg-background/20 text-background rounded-full px-1.5 text-xs">{values.length}</span>}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 bg-popover border border-border rounded-lg shadow-soft-lg z-50 min-w-[150px] py-1">
            {options.map((opt) => (
              <div
                key={opt}
                className="flex items-center gap-2.5 px-3 py-1.5 text-sm cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => toggle(opt)}
              >
                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${values.includes(opt) ? "bg-foreground border-foreground" : "border-muted-foreground/40"}`}>
                  {values.includes(opt) && <span className="text-background text-[9px] leading-none">✓</span>}
                </div>
                <span className={values.includes(opt) ? "text-foreground font-medium" : "text-muted-foreground"}>{labels?.[opt] || opt}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ═══ DOCUMENTS TAB ═══

/* Carpetas de documentos · estructura canónica de 3 carpetas
 * (planos generales, brochure comercial, memoria de calidades).
 * Antes traían 5 archivos PDF mock con thumbnails de Unsplash que se
 * pintaban en CUALQUIER promoción · daba la falsa impresión de que
 * todas tenían documentación cargada. Ahora `files: []` siempre · los
 * componentes muestran empty state real hasta que se cablee la subida
 * a Supabase Storage (bucket documents-private + tabla
 * promotion_documents · pendiente de implementar). */
const mockFolders: Record<string, { name: string; icon: typeof Layers; files: { name: string; size: string; type: string; thumbnail?: string }[] }> = {
  planos: { name: "Planos generales", icon: Layers, files: [] },
  brochure: { name: "Brochure", icon: BookOpen, files: [] },
  calidades: { name: "Memoria de calidades", icon: FileText, files: [] },
};

/* Antes había 14 agencias inventadas (Costa Realty, Mediterranean
 * Homes, etc.) que aparecían como "colaborando con esta promoción"
 * aunque nadie hubiera invitado a ninguna. Ahora vacío · cuando se
 * cableé el listado real desde el modelo de invitaciones aceptadas
 * (ya existe en agencies / invitaciones), se enchufa aquí. */
const mockAgenciesAccess: { id: string; name: string; logo: string }[] = [];

function DocumentsTab({ openFolder, onOpenFolder, blockedAgencies, onToggleBlockAgency, folderLocked, onToggleFolderLock, promotionName, totalUnits, readOnly }: {
  openFolder: string | null;
  onOpenFolder: (f: string | null) => void;
  blockedAgencies: Record<string, Set<string>>;
  onToggleBlockAgency: (folder: string, agencyId: string) => void;
  folderLocked: Record<string, boolean>;
  onToggleFolderLock: (folder: string) => void;
  promotionName: string;
  totalUnits: number;
  readOnly?: boolean;
}) {
  const [showAgenciesList, setShowAgenciesList] = useState(false);
  const [agencySearch, setAgencySearch] = useState("");
  const [confirmLockFolder, setConfirmLockFolder] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [folderMenuOpen, setFolderMenuOpen] = useState<string | null>(null);
  const folderKeys = ["calidades", ...(totalUnits > 1 ? ["planos"] : []), "brochure"];

  const totalCollaborators = mockAgenciesAccess.length;
  const filteredAgencies = mockAgenciesAccess.filter(a => a.name.toLowerCase().includes(agencySearch.toLowerCase()));

  const toggleFileSelect = (fileName: string) => {
    const next = new Set(selectedFiles);
    next.has(fileName) ? next.delete(fileName) : next.add(fileName);
    setSelectedFiles(next);
  };

  const toggleSelectAllFiles = (files: { name: string }[]) => {
    const allNames = files.map(f => f.name);
    const allSelected = allNames.every(n => selectedFiles.has(n));
    if (allSelected) setSelectedFiles(new Set());
    else setSelectedFiles(new Set(allNames));
  };

  if (openFolder && mockFolders[openFolder]) {
    const folder = mockFolders[openFolder];
    const isLocked = folderLocked[openFolder] || false;
    const blocked = blockedAgencies[openFolder] || new Set();
    const isShareable = openFolder === "planos" || openFolder === "brochure";
    const activeAgencies = mockAgenciesAccess.filter(a => !blocked.has(a.id)).length;
    const allFilesSelected = folder.files.length > 0 && folder.files.every(f => selectedFiles.has(f.name));

    return (
      <div className="space-y-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <button onClick={() => { onOpenFolder(null); setSelectedFiles(new Set()); }} className="hover:text-foreground transition-colors">Documentos</button>
          <span>/</span>
          <span className="text-foreground font-medium">{folder.name}</span>
        </div>

        {/* Sharing banner inside folder — only for developer, not agency */}
        {!readOnly && isShareable && !isLocked && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/10">
            <Share2 className="h-3.5 w-3.5 text-primary shrink-0" strokeWidth={1.5} />
            <p className="text-xs text-foreground flex-1">
              Compartido con <span className="font-semibold">{activeAgencies} agencias</span> colaboradoras
            </p>
            <button
              onClick={() => setShowAgenciesList(!showAgenciesList)}
              className="text-xs font-medium text-primary hover:underline"
            >
              {showAgenciesList ? "Ocultar" : "Ver listado"}
            </button>
          </div>
        )}
        {!readOnly && isShareable && isLocked && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/5 border border-destructive/10">
            <Lock className="h-3.5 w-3.5 text-destructive shrink-0" strokeWidth={1.5} />
            <p className="text-xs text-muted-foreground flex-1">Esta carpeta está bloqueada y no se comparte con ninguna agencia.</p>
            <button
              onClick={() => onToggleFolderLock(openFolder)}
              className="text-xs font-medium text-primary hover:underline"
            >
              Desbloquear
            </button>
          </div>
        )}

        {/* Agency list popover */}
        {!readOnly && showAgenciesList && isShareable && !isLocked && (
          <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
            <div className="px-4 pt-4 pb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-foreground">Agencias con acceso ({activeAgencies})</h3>
              <button
                onClick={() => setConfirmLockFolder(openFolder)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
              >
                <Lock className="h-3 w-3" strokeWidth={1.5} /> Bloquear todo
              </button>
            </div>
            <div className="px-4 pb-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" strokeWidth={1.5} />
                <input
                  type="text"
                  value={agencySearch}
                  onChange={e => setAgencySearch(e.target.value)}
                  placeholder="Buscar agencia..."
                  className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background/50 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/40"
                />
              </div>
            </div>
            <div className="px-4 pb-4 space-y-1 max-h-[240px] overflow-y-auto">
              {filteredAgencies.map(ag => {
                const isBlocked = blocked.has(ag.id);
                return (
                  <div key={ag.id} className={`flex items-center justify-between p-2.5 rounded-lg transition-colors ${isBlocked ? "opacity-50" : ""}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img src={ag.logo} alt="" className="h-6 w-6 rounded-full shrink-0" />
                      <p className={`text-xs font-medium truncate ${isBlocked ? "text-muted-foreground line-through" : "text-foreground"}`}>{ag.name}</p>
                    </div>
                    <button
                      onClick={() => onToggleBlockAgency(openFolder, ag.id)}
                      className={`p-1 rounded-lg transition-colors ${isBlocked ? "text-destructive hover:bg-destructive/10" : "text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"}`}
                      title={isBlocked ? "Desbloquear" : "Bloquear acceso"}
                    >
                      {isBlocked ? <Lock className="h-3 w-3" strokeWidth={1.5} /> : <Unlock className="h-3 w-3" strokeWidth={1.5} />}
                    </button>
                  </div>
                );
              })}
              {filteredAgencies.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">Sin resultados</p>
              )}
            </div>
          </div>
        )}

        {/* Selection bar */}
        {selectedFiles.size > 0 && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/10">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-foreground">{selectedFiles.size} archivo{selectedFiles.size > 1 ? "s" : ""} seleccionado{selectedFiles.size > 1 ? "s" : ""}</span>
              <button onClick={() => toggleSelectAllFiles(folder.files)} className="text-xs text-primary font-medium hover:underline">
                {allFilesSelected ? "Deseleccionar todo" : "Seleccionar todo"}
              </button>
              <button onClick={() => setSelectedFiles(new Set())} className="text-xs text-muted-foreground hover:text-foreground underline">
                Limpiar
              </button>
            </div>
            <Button size="sm" className="gap-1.5 text-xs h-8 rounded-full">
              <Download className="h-3.5 w-3.5" strokeWidth={1.5} /> Descargar ({selectedFiles.size})
            </Button>
          </div>
        )}

        {/* File thumbnails grid */}
        <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
          <div className="px-5 pt-5 pb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">{folder.files.length} archivo{folder.files.length !== 1 ? "s" : ""}</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleSelectAllFiles(folder.files)}
                className="text-xs font-medium text-primary hover:underline"
              >
                {allFilesSelected ? "Deseleccionar todo" : "Seleccionar todo"}
              </button>
              {!readOnly && (
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                  <Upload className="h-3 w-3" strokeWidth={1.5} /> Subir archivo
                </Button>
              )}
            </div>
          </div>
          <div className="px-5 pb-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {folder.files.map((file, i) => {
              const isSelected = selectedFiles.has(file.name);
              return (
                <div
                  key={i}
                  onClick={() => toggleFileSelect(file.name)}
                  className={cn(
                    "group rounded-xl border bg-background/50 hover:shadow-soft hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden",
                    isSelected ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-border/50"
                  )}
                >
                  {/* Thumbnail */}
                  <div className="aspect-[4/3] bg-muted/30 relative overflow-hidden">
                    {file.thumbnail ? (
                      <img src={file.thumbnail} alt={file.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileText className="h-8 w-8 text-muted-foreground/30" strokeWidth={1.5} />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <Download className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" strokeWidth={1.5} />
                    </div>
                    <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-black/50 text-white backdrop-blur-sm">
                      {file.type}
                    </span>
                    {/* Selection checkbox */}
                    <div className={cn(
                      "absolute top-2 left-2 h-5 w-5 rounded border-2 flex items-center justify-center transition-all",
                      isSelected ? "border-primary bg-primary" : "border-white/60 bg-black/20 opacity-0 group-hover:opacity-100"
                    )}>
                      {isSelected && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />}
                    </div>
                  </div>
                  {/* Info */}
                  <div className="p-3">
                    <p className="text-xs font-medium text-foreground truncate">{file.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{file.size}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      {/* Confirm lock dialog */}
      {confirmLockFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="rounded-2xl bg-card border border-border shadow-soft-lg p-6 max-w-sm w-full mx-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <Lock className="h-5 w-5 text-destructive" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">¿Bloquear carpeta?</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {mockAgenciesAccess.length} agencias perderán acceso a los archivos de esta carpeta de forma inmediata.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => setConfirmLockFolder(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" size="sm" className="text-xs h-8 gap-1.5" onClick={() => { onToggleFolderLock(confirmLockFolder); setConfirmLockFolder(null); setShowAgenciesList(false); }}>
                <Lock className="h-3 w-3" strokeWidth={1.5} /> Bloquear
              </Button>
            </div>
          </div>
        </div>
      )}
      </div>
    );
  }

  // Folder grid view

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Documentos</h2>
        {!readOnly && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9">
              <Upload className="h-3.5 w-3.5" strokeWidth={1.5} /> Subir documento
            </Button>
            <Button size="sm" className="gap-1.5 text-xs h-9">
              <FilePlus className="h-3.5 w-3.5" strokeWidth={1.5} /> Crear documento
            </Button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {folderKeys.map(key => {
          const folder = mockFolders[key];
          if (!folder) return null;
          const isShareable = key === "planos" || key === "brochure";
          const isLocked = folderLocked[key] || false;
          const isDeletable = key !== "calidades"; // System folders can't be deleted
          return (
            <div key={key} className="group relative text-left rounded-2xl border border-border bg-card p-5 hover:-translate-y-0.5 hover:border-border/60 hover:shadow-soft-lg transition-all duration-200">
              <button
                onClick={() => onOpenFolder(key)}
                className="w-full text-left"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Folder className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                  {!readOnly && isShareable && !isLocked && <Share2 className="h-3 w-3 text-muted-foreground/50" strokeWidth={1.5} />}
                  {!readOnly && isLocked && <Lock className="h-3 w-3 text-destructive/50" strokeWidth={1.5} />}
                </div>
                <p className="text-sm font-medium text-foreground">{folder.name}</p>
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-xs text-muted-foreground">{folder.files.length} archivo{folder.files.length !== 1 ? "s" : ""}</p>
                </div>
                {!readOnly && isShareable && !isLocked && (
                  <div className="mt-3 pt-3 border-t border-border/20 flex items-center gap-1.5">
                    <Share2 className="h-2.5 w-2.5 text-warning" strokeWidth={1.5} />
                    <p className="text-[10px] text-warning">Compartido con {totalCollaborators} agencias</p>
                  </div>
                )}
                {!readOnly && isLocked && (
                  <div className="mt-3 pt-3 border-t border-border/20 flex items-center gap-1.5">
                    <Lock className="h-2.5 w-2.5 text-destructive/50" strokeWidth={1.5} />
                    <p className="text-[10px] text-muted-foreground">No compartido</p>
                  </div>
                )}
              </button>
              {/* 3-dot menu */}
              {!readOnly && (
                <div className="absolute top-4 right-4">
                  <button
                    onClick={(e) => { e.stopPropagation(); setFolderMenuOpen(folderMenuOpen === key ? null : key); }}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                  {folderMenuOpen === key && (
                    <div className="absolute right-0 top-8 z-20 w-48 rounded-xl border border-border bg-card shadow-soft-lg py-1.5 animate-in fade-in-0 zoom-in-95">
                      {isShareable && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onOpenFolder(key); setFolderMenuOpen(null); }}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-foreground hover:bg-muted/40 transition-colors"
                        >
                          <Share2 className="h-3.5 w-3.5 text-muted-foreground/60" strokeWidth={1.5} /> Compartir con colaboradores
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); onToggleFolderLock(key); setFolderMenuOpen(null); }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-foreground hover:bg-muted/40 transition-colors"
                      >
                        {isLocked
                          ? <><Unlock className="h-3.5 w-3.5 text-muted-foreground/60" strokeWidth={1.5} /> Desbloquear carpeta</>
                          : <><Lock className="h-3.5 w-3.5 text-muted-foreground/60" strokeWidth={1.5} /> Bloquear carpeta</>
                        }
                      </button>
                      {isDeletable && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setFolderMenuOpen(null); }}
                          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-destructive hover:bg-destructive/5 transition-colors"
                        >
                          <X className="h-3.5 w-3.5" strokeWidth={1.5} /> Eliminar carpeta
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══ SHARED COMPONENTS ═══

// ═══ COLLABORATION STATUS BANNER ═══
function CollaborationStatusBanner({ isIncomplete, isShared, agencyCount, activity, onShare }: {
  isIncomplete: boolean;
  isShared: boolean;
  agencyCount: number;
  activity?: { inquiries: number; reservations: number; visits: number; trend: number };
  onShare: () => void;
}) {
  if (isIncomplete) {
    return (
      <div className="rounded-2xl border border-warning/20 bg-warning/10 overflow-hidden">
        <div className="p-4 2xl:p-5 flex items-start gap-3">
          <div className="h-7 w-7 2xl:h-9 2xl:w-9 rounded-lg bg-warning/15 flex items-center justify-center shrink-0 mt-0.5">
            <Lock className="h-3.5 w-3.5 2xl:h-4 2xl:w-4 text-warning" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight">Todavía no se puede compartir</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Completa todos los pasos para poder compartir con agencias.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isShared) {
    /* Stats reales de actividad · 0 si no hay tracking real todavía.
     * Antes los defaults eran 42 / 3 / 18 (visits / sales / regs) ·
     * aparecían en CADA promo aunque nadie hubiera visitado · número
     * inventado que el promotor leía como real. */
    const mockVisits = activity?.visits ?? 0;
    const mockSales = activity?.reservations ?? 0;
    const mockRegistrations = activity?.inquiries ?? 0;

    return (
      <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
        <div className="px-3.5 2xl:px-5 py-2.5 2xl:py-4 flex items-start gap-2.5 2xl:gap-3">
          <div className="h-7 w-7 2xl:h-9 2xl:w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Users className="h-3.5 w-3.5 2xl:h-4 2xl:w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground leading-tight">Compartida con <span className="tabular-nums">{agencyCount}</span> {agencyCount === 1 ? "agencia" : "agencias"}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">Tu promoción está siendo comercializada por colaboradores externos.</p>
          </div>
        </div>
        <div className="border-t border-border px-3.5 2xl:px-5 py-2.5 2xl:py-3.5 grid grid-cols-3 gap-2">
          <div className="text-center">
            <p className="text-sm 2xl:text-base font-semibold text-foreground tabular-nums leading-none">{mockVisits}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Visitas</p>
          </div>
          <div className="text-center">
            <p className="text-sm 2xl:text-base font-semibold text-foreground tabular-nums leading-none">{mockSales}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Ventas</p>
          </div>
          <div className="text-center">
            <p className="text-sm 2xl:text-base font-semibold text-foreground tabular-nums leading-none">{mockRegistrations}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Registros</p>
          </div>
        </div>
        <div className="border-t border-border px-3.5 2xl:px-5 py-2 2xl:py-2.5">
          <button
            onClick={onShare}
            className="w-full flex items-center justify-center gap-2 text-xs 2xl:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-0.5"
          >
            <Share2 className="h-3.5 w-3.5" strokeWidth={1.5} /> Compartir con más
          </button>
        </div>
      </div>
    );
  }

  // Complete but not yet shared
  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 overflow-hidden">
      <div className="p-4 2xl:p-5 flex items-start gap-3">
        <div className="h-7 w-7 2xl:h-9 2xl:w-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
          <CheckCircle2 className="h-3.5 w-3.5 2xl:h-4 2xl:w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight">¡Lista para compartir!</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Compártela con agencias para empezar a recibir clientes.</p>
        </div>
      </div>
      <div className="border-t border-primary/20 px-4 2xl:px-5 py-3">
        <button
          onClick={onShare}
          className="w-full flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          <Share2 className="h-3.5 w-3.5" strokeWidth={1.5} /> Compartir con colaboradores
        </button>
      </div>
    </div>
  );
}

function SectionCard({ title, stepName, missing, softMissing, onEdit, children, hideEdit, flush }: {
  title: string; stepName: string; missing: boolean; onEdit: () => void; children: React.ReactNode; hideEdit?: boolean; flush?: boolean;
  /* Modo "soft" · cuando es true, una sección con `missing=true` NO
   * pinta el wrapper rojo agresivo · renderiza children normalmente
   * (la mayoría caen a su propio empty state visual neutro). Usado
   * para borradores donde el user está rellenando · no queremos
   * gritarle "ESTO ESTÁ MAL" en cada bloque. Para promociones ya
   * activas que pierden datos, mantenemos el rojo (es señal real). */
  softMissing?: boolean;
}) {
  if (missing && hideEdit) return null;
  if (missing && !softMissing) {
    /* `data-section-missing="true"` · marca el primer faltante para
     *  el scroll. Visualmente se muestra con borde rojizo + chip
     *  "Pendiente" + título destructive · fondo levemente teñido en
     *  destructive/5 para que el promotor identifique de un vistazo
     *  qué sección requiere atención (los obligatorios sin rellenar). */
    return (
      <div
        data-section-missing="true"
        className="rounded-2xl border-2 border-destructive/50 bg-destructive/5 shadow-soft p-5 scroll-mt-20"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-destructive">{title}</h2>
            <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-destructive/15 border border-destructive/30 text-destructive text-[10.5px] font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
              Obligatorio
            </span>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onEdit}>
            <Pencil className="h-3 w-3" /> Rellenar
          </Button>
        </div>
        {(() => {
          const Icon = stepConfig[stepName]?.icon || Settings;
          return (
            <div className="flex items-center justify-center py-6 text-center">
              <div>
                <Icon className="h-6 w-6 text-destructive/40 mx-auto mb-2" />
                <p className="text-xs font-semibold text-destructive">{title} · campo obligatorio sin rellenar</p>
                <p className="text-xs text-destructive/70 mt-0.5">Pulsa "Rellenar" para completar {title.toLowerCase()}.</p>
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden group/section relative">
      {flush ? (
        <>
          {!hideEdit && (
            <button onClick={onEdit}
              className="absolute top-3 right-3 z-10 opacity-0 group-hover/section:opacity-100 transition-opacity inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-background/90 backdrop-blur-sm border border-border/60 text-xs text-muted-foreground hover:text-foreground shadow-soft">
              <Pencil className="h-3 w-3" /> Editar
            </button>
          )}
          {children}
        </>
      ) : (
        <>
          <div className="px-5 pt-4 pb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            {!hideEdit && (
              <button onClick={onEdit}
                className="opacity-0 group-hover/section:opacity-100 transition-opacity inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-background/90 border border-border/60 text-xs text-muted-foreground hover:text-foreground shadow-soft">
                <Pencil className="h-3 w-3" /> Editar
              </button>
            )}
          </div>
          <div className="px-5 pb-5">{children}</div>
        </>
      )}
    </div>
  );
}

/* FabAction · botón flotante secundario del FAB móvil con label
   pill a la izquierda y icono en círculo foreground. */
function FabAction({ icon: Icon, label, onClick }: { icon: typeof Home; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3"
    >
      <span className="h-9 px-3 rounded-full bg-foreground text-background text-xs font-medium shadow-soft inline-flex items-center">
        {label}
      </span>
      <span className="h-11 w-11 rounded-full bg-card border border-border shadow-soft inline-flex items-center justify-center">
        <Icon className="h-4 w-4 text-foreground" strokeWidth={1.5} />
      </span>
    </button>
  );
}

function InfoItem({ icon: Icon, label, value, sub }: { icon: typeof Home; label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="h-3 w-3 text-muted-foreground/60" />
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-sm font-medium text-foreground">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function EmptyState({ icon: Icon, message, sub }: { icon: typeof Home; message: string; sub: string }) {
  return (
    <div className="flex items-center justify-center py-6 text-center">
      <div>
        <Icon className="h-6 w-6 text-muted-foreground/20 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">{message}</p>
        <p className="text-xs text-muted-foreground/60 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

// ═══ CONTACT FOOTER — max 3 visible, rotating, with offices alongside if 1 contact ═══
type ContactPerson = { name: string; role: string; avatar: string; phone: string; email: string; languages: string[] };
type PuntoDeVentaType = { id: string; nombre: string; direccion: string; telefono: string; email: string; whatsapp?: string; coverUrl?: string };

function ContactFooter({ contacts, website, puntosDeVenta, comerciales, onAddMember, onAddOffice, onEditOffices, hideManagement }: {
  contacts: ContactPerson[]; website: string; puntosDeVenta?: PuntoDeVentaType[];
  comerciales?: Comercial[]; onAddMember?: () => void; onAddOffice?: () => void; onEditOffices?: () => void; hideManagement?: boolean;
}) {
  const [page, setPage] = useState(0);
  const visibleContacts = contacts.length > 3
    ? Array.from({ length: 3 }, (_, i) => contacts[((page * 3) + i) % contacts.length])
    : contacts;
  const totalPages = contacts.length > 3 ? Math.ceil(contacts.length / 3) : 0;

  const isSingle = visibleContacts.length === 1;
  const offices = puntosDeVenta || [];

  return (
    <div className="rounded-2xl bg-card border border-border shadow-soft overflow-hidden">
      {/* Header · en móvil stacked (título + subtítulo arriba, botones
          abajo como chips pill). En sm+ mismo row con los botones a la
          derecha. */}
      <div className="px-5 pt-5 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Equipo de contacto</h2>
          {!hideManagement && <p className="text-xs text-muted-foreground mt-0.5">Gestiona tu equipo comercial y puntos de venta</p>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {totalPages > 1 && (
            <div className="flex items-center gap-1 mr-2">
              {Array.from({ length: totalPages }, (_, i) => (
                <button key={i} onClick={() => setPage(i)} className={`h-1.5 rounded-full transition-all ${i === page ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/20"}`} />
              ))}
            </div>
          )}
          {onAddMember && !hideManagement && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7 rounded-full" onClick={onAddMember}>
              <UserPlus className="h-3 w-3" />
              <span className="hidden sm:inline">Añadir miembro</span>
              <span className="sm:hidden">Miembro</span>
            </Button>
          )}
          {onAddOffice && !hideManagement && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7 rounded-full" onClick={onAddOffice}>
              <Store className="h-3 w-3" />
              <span className="hidden sm:inline">Añadir oficina</span>
              <span className="sm:hidden">Oficina</span>
            </Button>
          )}
        </div>
      </div>

      {/* Contact cards */}
      <div className="px-5 pb-4">
        {isSingle ? (
          <div className="flex flex-col md:flex-row gap-3">
            <ContactCard contact={visibleContacts[0]} large />
            {offices.length > 0 && (
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Oficinas de venta · {offices.length}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {offices.map((o) => <OfficeMiniCard key={o.id} office={o} />)}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className={`grid grid-cols-1 ${visibleContacts.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"} gap-2.5`}>
            {visibleContacts.map((c) => (
              <ContactCard key={c.name} contact={c} />
            ))}
          </div>
        )}
      </div>

      {/* Comerciales (internal team with permissions) */}
      {comerciales && comerciales.length > 0 && (
        <>
          <div className="h-px bg-border/40 mx-5" />
          <div className="px-5 py-4">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2.5">Miembros del equipo</p>
            <div className="space-y-1.5">
              {comerciales.map(c => (
                <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-background/50">
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Users className="h-3 w-3 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">{c.nombre}</p>
                    <p className="text-[10px] text-muted-foreground">{c.email}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {c.permissions.canRegister && <Tag variant="default" size="sm">Registrar</Tag>}
                    {c.permissions.canShareWithAgencies && <Tag variant="default" size="sm">Compartir</Tag>}
                    {c.permissions.canEdit && <Tag variant="default" size="sm">Editar</Tag>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Footer: website + offices grid */}
      <div className="h-px bg-border/40 mx-5" />
      <div className="px-5 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <a href="#" className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors">
            <Globe className="h-3 w-3" strokeWidth={1.5} />
            {website}
            <ExternalLink className="h-2.5 w-2.5 opacity-50" strokeWidth={1.5} />
          </a>
          {!isSingle && offices.length > 0 && (
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Oficinas de venta · {offices.length}</p>
          )}
        </div>
        {!isSingle && offices.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {offices.map((o) => <OfficeMiniCard key={o.id} office={o} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function ContactCard({ contact: c, large }: { contact: ContactPerson; large?: boolean }) {
  return (
    <div className={`rounded-xl border border-border bg-background/50 p-4 hover:border-border/50 hover:shadow-soft transition-all duration-200 ${large ? "flex-1" : ""}`}>
      <div className="flex items-center gap-3 mb-3">
        <Avatar className={`${large ? "h-14 w-14" : "h-12 w-12"} ring-2 ring-background shadow-soft`}>
          <AvatarImage src={c.avatar} alt={c.name} className="object-cover" />
          <AvatarFallback className="bg-muted text-xs font-medium">{c.name.slice(0, 2)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className={`${large ? "text-sm" : "text-sm"} font-semibold text-foreground truncate`}>{c.name}</p>
          <p className={`${large ? "text-xs" : "text-[10px]"} text-muted-foreground`}>{c.role}</p>
          <div className="flex items-center gap-1.5 mt-1">
            {c.languages.map((code) => {
              const lang = findLanguageByCode(code);
              return (
                <Flag
                  key={code}
                  iso={lang?.countryIso ?? code}
                  size={12}
                  title={lang?.name ?? code}
                />
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <button className="flex-1 flex items-center justify-center gap-1 h-8 rounded-lg bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground text-xs font-medium transition-all duration-200">
          <Phone className="h-3.5 w-3.5" strokeWidth={1.5} /> Llamar
        </button>
        <button className="flex-1 flex items-center justify-center gap-1 h-8 rounded-lg bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground text-xs font-medium transition-all duration-200">
          <Mail className="h-3.5 w-3.5" strokeWidth={1.5} /> Email
        </button>
      </div>
    </div>
  );
}

function OfficeMiniCard({ office: o }: { office: PuntoDeVentaType }) {
  return (
    <div className="group relative rounded-2xl border border-border bg-card overflow-hidden hover:border-border/70 hover:shadow-soft-lg transition-all duration-300">
      {/* Cover with title overlay */}
      <div className="relative h-32 overflow-hidden bg-muted/20">
        {o.coverUrl ? (
          <img
            src={o.coverUrl}
            alt={o.nombre}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-muted/40 via-muted/25 to-muted/10 flex items-center justify-center">
            <Store className="h-7 w-7 text-muted-foreground/30" strokeWidth={1.5} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-3.5">
          <p className="text-sm font-semibold text-white truncate drop-shadow-sm">{o.nombre}</p>
        </div>
      </div>

      {/* Body — full contact info, always visible */}
      <div className="p-3.5 space-y-2">
        {o.direccion && (
          <div className="flex items-start gap-2">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0 mt-0.5" strokeWidth={1.75} />
            <p className="text-xs text-foreground/90 leading-relaxed">{o.direccion}</p>
          </div>
        )}
        {o.telefono && (
          <a
            href={`tel:${o.telefono}`}
            className="flex items-center gap-2 group/item hover:text-foreground transition-colors"
          >
            <Phone className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" strokeWidth={1.75} />
            <p className="text-xs text-muted-foreground group-hover/item:text-foreground truncate">{o.telefono}</p>
          </a>
        )}
        {o.email && (
          <a
            href={`mailto:${o.email}`}
            className="flex items-center gap-2 group/item hover:text-foreground transition-colors"
          >
            <Mail className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0" strokeWidth={1.75} />
            <p className="text-xs text-muted-foreground group-hover/item:text-foreground truncate">{o.email}</p>
          </a>
        )}
        {o.whatsapp && (
          <a
            href={`https://wa.me/${o.whatsapp.replace(/[^\d]/g, "")}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 group/item hover:text-primary transition-colors"
          >
            <MessageCircle className="h-3.5 w-3.5 text-muted-foreground/70 shrink-0 group-hover/item:text-primary" strokeWidth={1.75} />
            <p className="text-xs text-muted-foreground group-hover/item:text-primary truncate">WhatsApp · {o.whatsapp}</p>
          </a>
        )}
      </div>
    </div>
  );
}

/* ══════════════ AgencyInvitationBanner ══════════════
   Banner al tope de la ficha de una promoción · solo se pinta cuando
   el usuario es una agencia con una invitación `pendiente` a esta
   promoción concreta y NO la ha descartado localmente.

   Caso 2a (agencia ya colaboradora · CLAUDE.md regla "vista de
   agencia"): la agencia ya tiene workspace en Byvaro · al recibir la
   invitación a una promoción nueva, simplemente la añade a su cartera
   o la descarta. NO hay "Aceptar/Rechazar" porque NO es un contrato
   nuevo · es solo ampliar el scope del contrato marco existente.

   Acciones:
     · "Añadir a mi cartera" → muta estado a aceptada + persiste
       cartera + crea contacto bidireccional (lado agencia).
     · "Descartar" → SILENCIOSO · solo descarta localmente (la agencia
       deja de ver el banner). El promotor sigue viendo la invitación
       como pendiente y caducará por timeout. NO emite eventos
       cross-empresa · no fricciona la relación.
*/
function AgencyInvitationBanner({
  agencyId, promotionId,
}: { agencyId: string; promotionId: string }) {
  const { lista, aceptar } = useInvitaciones();
  const currentUser = useCurrentUser();
  const { empresa: promotorEmpresa } = useEmpresa();
  /* Re-render local cuando cambia el set de invitaciones descartadas. */
  const [, forceTick] = useState(0);
  useEffect(() => onInvitacionesDescartadasChanged(() => forceTick((n) => n + 1)), []);

  const email = useMemo(() => {
    const a = agencies.find((x) => x.id === agencyId);
    return a?.contactoPrincipal?.email?.toLowerCase() ?? null;
  }, [agencyId]);
  const invitation = useMemo(() => {
    return lista.find((i) =>
      i.promocionId === promotionId
      && i.estado === "pendiente"
      && (i.agencyId === agencyId || (email && i.emailAgencia.toLowerCase() === email))
      && !isInvitacionDescartada(i.id),
    );
  }, [lista, promotionId, agencyId, email]);

  if (!invitation) return null;

  const handleAdd = () => {
    aceptar(invitation.id);
    addPromotionToCartera(agencyId, promotionId);
    /* Lado agencia · al añadir a cartera, persistimos al PROMOTOR
     * como contacto (kind=company) en el CRM de la agencia. Idempotente.
     * Ver `docs/backend-integration.md §16`. */
    ensureAgencyContactForPromoter({
      agencyId,
      promotor: {
        nombreComercial: promotorEmpresa.nombreComercial,
        razonSocial: promotorEmpresa.razonSocial,
        cif: promotorEmpresa.cif,
        email: promotorEmpresa.email,
        telefono: promotorEmpresa.telefono,
        logoUrl: promotorEmpresa.logoUrl,
      },
      invitacionId: invitation.id,
    });
    toast.success("Añadida a tu cartera", {
      description: "Ya puedes registrar clientes para esta promoción.",
    });
    /* TODO(backend) · persistir también en agency.promotionsCollaborating
     *  + recordCompanyAny(agency.id, "promotion_added_to_cartera", ...) */
  };

  /* Descarte SILENCIOSO · solo desaparece de la vista de la agencia · NO
   * notifica al promotor/comercializador · él la sigue viendo como
   * pendiente y caducará por timeout estándar. */
  const handleDismiss = () => {
    descartarInvitacion(invitation.id);
    toast("Invitación descartada", {
      description: "Ya no la verás · el remitente no recibe notificación.",
    });
  };

  return (
    <div className="sticky top-0 z-40 bg-primary/5 border-b border-primary/20 px-4 sm:px-6 lg:px-8 py-3">
      <div className="max-w-content mx-auto flex items-start sm:items-center gap-3 flex-wrap">
        <span className="h-9 w-9 rounded-xl bg-primary text-primary-foreground grid place-items-center shrink-0">
          <MailPlus className="h-4 w-4" strokeWidth={2} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {currentUser.name} · {currentUser.email ? currentUser.email : ""}
          </p>
          <p className="text-[12px] text-muted-foreground">
            Te han invitado a esta promoción ·
            <span className="text-foreground font-medium"> {invitation.comisionOfrecida}%</span>
            {typeof invitation.duracionMeses === "number" && invitation.duracionMeses > 0
              ? ` · ${invitation.duracionMeses} meses`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDismiss}
            title="Descartar · no notifica al remitente"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border border-border bg-card text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
            Descartar
          </button>
          <button
            type="button"
            onClick={handleAdd}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-foreground text-background text-[13px] font-semibold hover:bg-foreground/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
            Añadir a mi cartera
          </button>
        </div>
      </div>
    </div>
  );
}

