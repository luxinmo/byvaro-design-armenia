/**
 * Registros · bandeja de entrada de leads (Vista Promotor)
 *
 * QUÉ
 * ----
 * Pantalla master-detail para gestionar los registros (leads) que las
 * agencias colaboradoras envían al promotor. Es el CORE diferencial del
 * producto (ver `docs/product.md` · IA de duplicados).
 *
 * El promotor debe poder:
 *   · Ver la lista filtrable por promoción, agencia, estado, duplicados.
 *   · Abrir un registro y comparar lado-a-lado con el contacto/registro
 *     con el que podría colisionar.
 *   · Aprobar, rechazar o revisar en bloque (selección múltiple).
 *
 * CÓMO
 * ----
 * - Datos: `src/data/records.ts` (mock).
 * - Sin backend: las acciones disparan `toast()` y mutan estado local.
 * - Responsive desde 375px. En móvil la lista y el detalle son pantallas
 *   separadas (se navega clicando). En desktop (>= lg) van lado a lado.
 * - Barra flotante de selección múltiple sube a bottom-[72px] en móvil
 *   para no chocar con `MobileBottomNav` (ver patrón en CLAUDE.md §3).
 *
 * TODO(backend): GET /api/records?status=&promotion=&agency= → Registro[]
 * TODO(backend): POST /api/records/:id/approve, /reject
 * TODO(backend): POST /api/records/bulk-approve { ids:[] }, /bulk-reject
 * TODO(logic): el matchPercentage vendrá del servicio de IA (Claude Haiku
 *   o GPT-4o-mini, decisión pendiente — ver docs/open-questions.md#Q1).
 */

import { useState, useMemo, useRef, useEffect } from "react";
import {
  Search, X, Check, ChevronDown, Filter, AlertTriangle, Shield,
  Phone, Flag as FlagIcon, Building2, Users, Info,
  ArrowLeft, Clock, CheckCircle2, XCircle, FileText, ArrowUpDown,
  ExternalLink, Sparkles, Eye, Handshake, UserCheck,
} from "lucide-react";
import { Flag } from "@/components/ui/Flag";
import { getOwnerRoleLabel, getOwnerRoleArticleLower, getPromoterDisplayName } from "@/lib/promotionRole";
import { formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
  registros as registrosMock,
  type Registro,
  type RegistroEstado,
  type RegistroOrigen,
  getMatchLevel,
  estadoLabel,
} from "@/data/records";
import { promotions } from "@/data/promotions";
import { developerOnlyPromotions } from "@/data/developerPromotions";
import { agencies } from "@/data/agencies";
import { Switch } from "@/components/ui/Switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { motion, AnimatePresence } from "framer-motion";
import { agencies as ALL_AGENCIES } from "@/data/agencies";
import { useCurrentUser } from "@/lib/currentUser";
import { currentOrgIdentity } from "@/lib/orgCollabRequests";
import { getAgenciesForDeveloper } from "@/lib/developerNavigation";
import { useCreatedRegistros } from "@/lib/registrosStorage";
import { useUsageGuard } from "@/lib/usageGuard";
import { recordNotification } from "@/lib/notifications";
import { PublicRefBadge } from "@/components/ui/PublicRefBadge";
import { resolveNationality } from "@/data/nationalities";
import {
  RescheduleVisitDialog,
  CancelVisitAgencyDialog,
  CancelVisitPromoterDialog,
} from "@/components/registros/VisitActionDialogs";
import { TermsConfirmDialog } from "@/components/registros/TermsConfirmDialog";
import { OverrideConfirmDialog } from "@/components/registros/OverrideConfirmDialog";
import { DuplicateContext } from "@/components/registros/DuplicateContext";
import type { VisitOutcome } from "@/data/records";
import { getExpiryStatus } from "@/lib/registroExpiry";
import { Tag } from "@/components/ui/Tag";
import { cn } from "@/lib/utils";
import { MatchRing } from "@/components/registros/MatchRing";
import { DuplicateResult } from "@/components/registros/DuplicateResult";
import { ActivityTimeline } from "@/components/registros/ActivityTimeline";
import { GracePeriodBanner } from "@/components/registros/GracePeriodBanner";
import { CrossPromotionWarning } from "@/components/registros/CrossPromotionWarning";
import { getAgencyTrackRecord, type AgencyTrackRecord } from "@/lib/agencyTrackRecord";
import {
  MatchConfirmDialog, RelationConfirmDialog, VisitConfirmDialog, RejectDialog,
  type VisitConfirmResult,
} from "@/components/registros/ApprovalDialogs";
import { useHasPermission } from "@/lib/permissions";
import { onRegistroApproved, onRegistroRejected, createVisitFromRegistro } from "@/lib/registroVisitaLink";
import { upsertContactFromRegistro } from "@/lib/registroContactLink";

/* ═══════════════════════════════════════════════════════════════════
   Helpers visuales
   ═══════════════════════════════════════════════════════════════════ */

/** Iniciales a partir de un nombre completo. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0] + parts[parts.length - 1]![0]).toUpperCase();
}

/** Fecha relativa en español: "hace 2 h", "hace 3 días". */
function relativeDate(iso: string): string {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: es });
  } catch {
    return iso;
  }
}

/** Si el registro viene de agencia colaboradora, enmascara el teléfono
 *  dejando solo el prefijo + los últimos 4 dígitos. Regla de negocio:
 *  la agencia "posee" el contacto hasta que el promotor aprueba; no
 *  tiene sentido mostrar el número entero en la cola de revisión. En
 *  registros directos (los mete el promotor) el número se muestra
 *  entero porque ya es suyo. */
function maskPhoneIfCollab(telefono: string, origen: RegistroOrigen): string {
  if (origen === "direct") return telefono;
  const digits = telefono.replace(/\D/g, "");
  if (digits.length <= 4) return telefono; // ya es corto, nada que ocultar
  const last4 = digits.slice(-4);
  const prefix = telefono.match(/^\+\d+/)?.[0];
  return prefix ? `${prefix} ··· ··· ${last4}` : `··· ··· ${last4}`;
}


/** Color semántico para el % de match (reglas en CLAUDE.md + design-system.md). */
function matchBadgeClasses(pct: number): string {
  const level = getMatchLevel(pct);
  if (level === "high") return "bg-destructive/10 text-destructive border-destructive/20";
  if (level === "medium") return "bg-warning/10 text-warning border-warning/30";
  if (level === "low") return "bg-success/10 text-success border-success/30";
  return "bg-muted/50 text-muted-foreground border-border";
}

/** Tag variant del estado para `<Tag>`. */
function estadoTagVariant(e: RegistroEstado): "warning" | "success" | "danger" | "muted" {
  if (e === "pendiente") return "warning";
  if (e === "preregistro_activo") return "warning";
  if (e === "aprobado") return "success";
  if (e === "rechazado" || e === "duplicado") return "danger";
  /* caducado · cliente liberado · sin atribución activa */
  return "muted";
}

/* ═══════════════════════════════════════════════════════════════════
   PÁGINA
   ═══════════════════════════════════════════════════════════════════ */
export default function Registros() {
  /* Cuando el usuario global es una agencia, el listado sólo contiene sus
   * propios registros — la agencia no puede ver ni moderar los de otras. */
  const currentUser = useCurrentUser();
  const isAgencyUser = currentUser.accountType === "agency";

  /* Registros creados en vivo desde "Registrar cliente" (localStorage mock).
   * Se combinan con los del seed para que los tests end-to-end sean visibles. */
  const createdRegistros = useCreatedRegistros();

  /* Paywall guard · Fase 1 · 40 registros en trial. Solo aplica al
     promotor (currentUser.accountType === "developer"); para agencia
     siempre devuelve `blocked: false`. */
  const acceptGuard = useUsageGuard("acceptRegistro");

  /* Agencias disponibles en el filtro · solo las que colaboran con
   *  el workspace logueado. Evita exponer roster cross-developer. */
  const agenciesForFilter = useMemo(() => {
    const myOrgId = currentOrgIdentity(currentUser).orgId;
    if (currentUser.accountType === "agency") {
      const own = ALL_AGENCIES.find((a) => a.id === currentUser.agencyId);
      return own ? [own] : [];
    }
    return getAgenciesForDeveloper(myOrgId, ALL_AGENCIES);
  }, [currentUser.accountType, currentUser.agencyId, currentUser]);

  /* Set de promo IDs del workspace logueado · scope para el lado
   *  developer · evita que un developer no-Luxinmo vea registros de
   *  promociones de otro workspace. */
  const myOrgIdReg = currentOrgIdentity(currentUser).orgId;
  const myPromoIdsReg = useMemo(() => {
    const all = [...promotions, ...developerOnlyPromotions];
    return new Set(
      all
        .filter((p) => (p.ownerOrganizationId ?? "developer-default") === myOrgIdReg)
        .map((p) => p.id),
    );
  }, [myOrgIdReg]);

  const scopedList = useMemo(() => {
    const combined = [...createdRegistros, ...registrosMock];
    if (!isAgencyUser) {
      /* Lado DEVELOPER · solo registros de promociones de mi workspace. */
      return combined.filter((r) => !r.promotionId || myPromoIdsReg.has(r.promotionId));
    }
    /* Filtro tenant · solo registros de la agencia del usuario. */
    const byAgency = combined.filter((r) => r.agencyId === currentUser.agencyId);
    /* CLAUDE.md `permissions.md` · viewOwn vs viewAll.
     *   · admin → viewAll (todos los de la agencia).
     *   · member → viewOwn (solo los que él envió, según
     *     `audit.actor.email`).
     * Si el seed no trae `audit.actor` (fallback), el registro NO
     * se muestra al member · evita fuga.
     * TODO(backend): mover el filter a SQL `WHERE author_user_id = $1`. */
    if (currentUser.role === "member") {
      const myEmail = currentUser.email.toLowerCase();
      return byAgency.filter((r) =>
        r.audit?.actor.email?.toLowerCase() === myEmail,
      );
    }
    return byAgency;
  }, [createdRegistros, isAgencyUser, currentUser.agencyId, currentUser.role, currentUser.email, myPromoIdsReg]);

  // Estado de datos (mutable para aprobar/rechazar en memoria).
  const [records, setRecords] = useState<Registro[]>(scopedList);
  /* Si cambian los datos subyacentes (switch de cuenta, creación de nuevo
   * registro, etc.) re-scopeamos sin perder acciones locales ya aplicadas. */
  useEffect(() => {
    setRecords(scopedList);
  }, [scopedList]);

  // Filtros.
  const [search, setSearch] = useState("");
  const [promotionFilter, setPromotionFilter] = useState<string[]>([]);
  const [agencyFilter, setAgencyFilter] = useState<string[]>([]);
  const [nacionalidadFilter, setNacionalidadFilter] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<"all" | "today" | "7d" | "30d">("all");
  /* Drawer de filtros · open/close · CLAUDE.md §"Responsive móvil
     sin popovers" · full-screen móvil + lateral 440px desktop. */
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Default "pendiente" · la prioridad del promotor al entrar es
  // decidir lo que está en cola. Si no hay pendientes, los otros tabs
  // siguen accesibles.
  const [estadoFilter, setEstadoFilter] = useState<RegistroEstado | "todos">("pendiente");
  /* Ordenación · "recent" (default · más nuevo primero) · "urgency"
     (pendientes >48h primero) · "match" (% coincidencia alto primero). */
  const [sortBy, setSortBy] = useState<"recent" | "urgency" | "match">("recent");
  const [origenFilter, setOrigenFilter] = useState<RegistroOrigen[]>([]);
  const [onlyDuplicates, setOnlyDuplicates] = useState(false);

  // Selección múltiple.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Registro activo (detalle).
  const [activeId, setActiveId] = useState<string | null>(null);

  /* ─── Opciones de filtros ─── */
  const promotionOptions = useMemo(
    () => promotions.map((p) => ({ value: p.id, label: p.name })),
    [],
  );
  const agencyOptions = useMemo(
    () => agencies.map((a) => ({ value: a.id, label: a.name })),
    [],
  );

  /* ─── Mapas de lookup (para pintar nombres rápido) ───
     Une `promotions` (catálogo público con tarjetas) + `developerOnlyPromotions`
     (catálogo más rico que usa el wizard moderno · cuando una agencia
     registra desde una de estas, el id no está en `promotions` · si no
     unimos aquí, la cabecera del registro muestra "—" en vez del nombre
     de la promoción). En caso de id duplicado entre ambos catálogos,
     prevalece la última inserción · `developerOnlyPromotions` se considera
     más fresca porque incluye campos del wizard. */
  const promotionById = useMemo(() => {
    const m = new Map<string, (typeof promotions)[number]>();
    promotions.forEach((p) => m.set(p.id, p));
    developerOnlyPromotions.forEach((p) => m.set(p.id, p));
    return m;
  }, []);
  const agencyById = useMemo(() => {
    const m = new Map<string, (typeof agencies)[number]>();
    agencies.forEach((a) => m.set(a.id, a));
    return m;
  }, []);

  /* ─── Filtrado ─── */
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return records.filter((r) => {
      if (estadoFilter !== "todos" && r.estado !== estadoFilter) return false;
      if (promotionFilter.length > 0 && !promotionFilter.includes(r.promotionId)) return false;
      /* Agencia solo aplica a registros `collaborator`: un directo no
       * encaja nunca con un filtro por agencia concreta. */
      if (agencyFilter.length > 0 && (!r.agencyId || !agencyFilter.includes(r.agencyId))) return false;
      if (origenFilter.length > 0 && !origenFilter.includes(r.origen)) return false;
      if (nacionalidadFilter.length > 0 && !nacionalidadFilter.includes(r.cliente.nacionalidad)) return false;
      if (onlyDuplicates && r.matchPercentage < 30) return false;

      /* Rango de fecha · sobre `r.fecha` (envío). "all" no filtra. */
      if (dateRange !== "all") {
        const now = Date.now();
        const ageMs = now - new Date(r.fecha).getTime();
        const day = 24 * 60 * 60 * 1000;
        if (dateRange === "today" && ageMs > day) return false;
        if (dateRange === "7d" && ageMs > 7 * day) return false;
        if (dateRange === "30d" && ageMs > 30 * day) return false;
      }

      if (q) {
        const promo = promotionById.get(r.promotionId);
        const ag = r.agencyId ? agencyById.get(r.agencyId) : undefined;
        const hay =
          r.cliente.nombre.toLowerCase().includes(q) ||
          (r.cliente.email ?? "").toLowerCase().includes(q) ||
          r.cliente.telefono.toLowerCase().includes(q) ||
          (r.cliente.dni ?? "").toLowerCase().includes(q) ||
          r.cliente.nacionalidad.toLowerCase().includes(q) ||
          (promo?.name.toLowerCase().includes(q) ?? false) ||
          (ag?.name.toLowerCase().includes(q) ?? false);
        if (!hay) return false;
      }
      return true;
    });
  }, [records, search, estadoFilter, promotionFilter, agencyFilter, origenFilter, nacionalidadFilter, dateRange, onlyDuplicates, promotionById, agencyById]);

  /* Aplicar ordenación sobre `filtered` · no se mezcla con el useMemo
     anterior para evitar recalcular el filtrado al cambiar el sort. */
  const sortedFiltered = useMemo(() => {
    const copy = [...filtered];
    if (sortBy === "recent") {
      copy.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    } else if (sortBy === "match") {
      // Mayor % primero · empates por fecha más reciente.
      copy.sort((a, b) => {
        if (b.matchPercentage !== a.matchPercentage) return b.matchPercentage - a.matchPercentage;
        return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
      });
    } else {
      // urgency · pendientes >48h primero · luego pendientes <48h · luego resto.
      const now = Date.now();
      const score = (r: Registro) => {
        if (r.estado !== "pendiente") return 2;
        const ageH = (now - new Date(r.fecha).getTime()) / (1000 * 60 * 60);
        return ageH > 48 ? 0 : 1;
      };
      copy.sort((a, b) => {
        const sa = score(a), sb = score(b);
        if (sa !== sb) return sa - sb;
        return new Date(a.fecha).getTime() - new Date(b.fecha).getTime();
      });
    }
    return copy;
  }, [filtered, sortBy]);

  /* ─── Mantener activeId válido ante cambios de filtro ───
   *  Solo limpiamos si el registro ya no existe en `records` (borrado).
   *  Si solo cae fuera de `filtered` (p. ej. acabas de aprobar y el
   *  tab está en "Pendientes"), mantenemos el detalle abierto para que
   *  el promotor vea la transición · botones → countdown → pill final
   *  sin que la pantalla salte al siguiente registro. */
  useEffect(() => {
    if (activeId && !records.some((r) => r.id === activeId)) {
      setActiveId(null);
    }
    if (!activeId && filtered.length > 0 && typeof window !== "undefined" && window.innerWidth >= 1024) {
      setActiveId(filtered[0]!.id);
    }
  }, [records, filtered, activeId]);

  /* ─── Derivados de contadores ─── */
  const pendientesCount = records.filter((r) => r.estado === "pendiente").length;
  const activeRecord = activeId ? records.find((r) => r.id === activeId) ?? null : null;

  /* ─── Flujo de aprobación · state machine ─────────────────────────
     Al pulsar "Aprobar" en un registro se inicia una secuencia:
       1. Si matchPercentage >= 65 → MatchConfirmDialog.
       2. Si possibleRelation presente → RelationConfirmDialog.
       3. Si tipo requiere visita (registration_visit | visit_only) →
          VisitConfirmDialog con agente obligatorio.
       4. Finalmente `approve(id)`.
     visit_only SALTA los pasos 1 y 2 (el cliente ya fue aprobado). */
  type ApprovalStage = "match" | "override" | "relation" | "visit" | "terms" | null;
  const [approvalFlow, setApprovalFlow] = useState<{ record: Registro; stage: ApprovalStage } | null>(null);

  const canSeeMatchDetails = useHasPermission("records.matchDetails.view");

  /** Determina la siguiente etapa del flujo para un registro dado.
   *  El orden canónico es: match → override (si ≥70%) → relation →
   *  visit → terms → approve.
   *  · `override` (Bloque H) se inserta cuando matchPercentage ≥70 ·
   *    obliga al promotor a justificar la decisión por escrito.
   *  · `terms` (Bloque D) se inserta SIEMPRE como último step ·
   *    auditoría legal. */
  const nextStageFor = (r: Registro, fromStage: ApprovalStage | "start"): ApprovalStage => {
    // visit_only · salta match/relation · solo visita + terms.
    if (r.tipo === "visit_only") {
      if (fromStage === "start") return "visit";
      if (fromStage === "visit") return "terms";
      return null;
    }
    if (fromStage === "start" && r.matchPercentage >= 65) return "match";
    /* Tras `match`, si el score es ≥70 (posible duplicado), pasar
       obligatoriamente por override antes de continuar. */
    if (fromStage === "match" && r.matchPercentage >= 70) return "override";
    if ((fromStage === "start" || fromStage === "match" || fromStage === "override") && r.possibleRelation) return "relation";
    if ((fromStage === "start" || fromStage === "match" || fromStage === "override" || fromStage === "relation")
        && (r.tipo === "registration_visit" || r.tipo === "visit_only")) {
      return "visit";
    }
    /* Antes del approve final · siempre pasamos por T&C. */
    if (fromStage !== "terms") return "terms";
    return null;
  };

  const startApprove = (record: Registro) => {
    const stage = nextStageFor(record, "start");
    if (stage === null) {
      approve(record.id);
      return;
    }
    setApprovalFlow({ record, stage });
  };

  /* Bloque H · al confirmar override (match ≥70%), capturamos la nota
     obligatoria + timestamp + userId · queda en historial cross-empresa
     para auditar disputas futuras. Después seguimos al siguiente step. */
  const confirmOverrideAndAdvance = (payload: { overrideNote: string }) => {
    if (!approvalFlow) return;
    const { record } = approvalFlow;
    const now = new Date().toISOString();
    setRecords((prev) => prev.map((r) => r.id === record.id ? {
      ...r,
      overrideNote: payload.overrideNote,
      overrideAt: now,
      overrideByUserId: currentUser.id,
    } : r));
    /* Avanzar al siguiente step desde override · normalmente terms o
       relation/visit si aplican. */
    const next = nextStageFor(record, "override");
    if (next) {
      setApprovalFlow({ record, stage: next });
    } else {
      setApprovalFlow(null);
      approve(record.id);
    }
  };

  /* Bloque D · al confirmar el T&C, capturamos versión + timestamp +
     userId para auditoría legal · se persiste en el Registro. */
  const confirmTermsAndApprove = (payload: { termsVersion: string; termsAcceptedAt: string }) => {
    if (!approvalFlow) return;
    const { record } = approvalFlow;
    /* Precarga audit en el registro ANTES de approve · approve()
       no toca estos campos para mantener la huella exacta del momento
       de aceptación. */
    setRecords((prev) => prev.map((r) => r.id === record.id ? {
      ...r,
      approvedTermsVersion: payload.termsVersion,
      approvedTermsAt: payload.termsAcceptedAt,
      approvedTermsByUserId: currentUser.id,
    } : r));
    setApprovalFlow(null);
    approve(record.id);
  };

  const advanceApproval = () => {
    if (!approvalFlow) return;
    const { record, stage } = approvalFlow;
    const next = nextStageFor(record, stage);
    if (next) {
      setApprovalFlow({ record, stage: next });
    } else {
      setApprovalFlow(null);
      approve(record.id);
    }
  };

  const cancelApproval = () => setApprovalFlow(null);

  /* ─── Acciones ─── */
  const setEstado = (id: string, estado: RegistroEstado) => {
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, estado } : r)));
  };

  /** Aprobar/Rechazar marca `decidedAt` para activar el GracePeriodBanner
   *  + guarda el `decidedByUserId` del usuario actual (fuente única de la
   *  autoría · el nombre se resuelve en render vía TEAM_MEMBERS).
   *  TODO(backend): POST /api/records/:id/approve|reject programa la
   *  notificación con delay 5min y la cancela si llega /revert antes.
   *  TODO(backend): el endpoint devolverá 402 con `{trigger,used,limit}`
   *  cuando el workspace en plan trial llegue a 40 registros · la UI
   *  ya tiene el guard local que abre el UpgradeModal antes de llamar. */
  const approve = (id: string) => {
    /* Paywall · si el plan trial ya cubrió el cupo de registros, el
     *  promotor NO puede aprobar · el registro permanece "pendiente"
     *  hasta que actualice el plan. Sin pérdida de datos. */
    if (acceptGuard.blocked) {
      acceptGuard.openUpgrade();
      return;
    }
    const now = new Date().toISOString();
    const record = records.find((r) => r.id === id);
    /* Modo de validación de la promoción · `directo` o `por_visita`.
     * En modo `por_visita`, el registro entra como `preregistro_activo`
     * y se confirmará a `aprobado` cuando la visita asociada se marque
     * como realizada (`onVisitCompleted` en registroVisitaLink.ts).
     * Default `por_visita` si la promo no lo declara explícitamente. */
    const promo = record ? promotionById.get(record.promotionId) : undefined;
    const modo = promo?.modoValidacionRegistro ?? "por_visita";
    /* `visit_only` es un caso especial: el cliente ya estaba aprobado
     * antes · solo se programa visita nueva · siempre va directo a
     * `aprobado` independientemente del modo de la promo. */
    const targetEstado: RegistroEstado =
      modo === "por_visita" && record?.tipo !== "visit_only"
        ? "preregistro_activo"
        : "aprobado";
    setRecords((prev) => prev.map((r) => r.id === id ? {
      ...r, estado: targetEstado, decidedAt: now,
      decidedByUserId: currentUser.id,
      /* Snapshot legacy para fallback si el miembro es eliminado más adelante. */
      decidedBy: currentUser.name,
      decidedByRole: currentUser.jobTitle,
    } : r));
    /* Si el registro era de tipo "registration_visit" y tiene una
       visita pendiente linkada en el calendario, la confirmamos. */
    const { visitUpdated } = onRegistroApproved(id);
    /* Crea/actualiza Contact en el CRM con los datos del cliente
       aprobado. Si ya existía (email/tel match) solo añade evento al
       timeline. Skeleton mínimo si es nuevo · se enriquece luego con
       visitas/oportunidades. Ver `src/lib/registroContactLink.ts`. */
    let contactInfo: { contactId: string; created: boolean; contactName: string } | null = null;
    if (record) {
      try {
        contactInfo = upsertContactFromRegistro(
          { ...record, estado: targetEstado, decidedAt: now,
            decidedByUserId: currentUser.id, decidedBy: currentUser.name },
          { name: currentUser.name, email: currentUser.email },
        );
      } catch {
        /* Defensa · si el upsert falla por algún motivo no bloqueamos
           la aprobación del registro · solo dejamos traza en consola. */
        // eslint-disable-next-line no-console
        console.error("upsertContactFromRegistro failed for", id);
      }
    }
    const description = [
      targetEstado === "preregistro_activo"
        ? "Preregistro activo · se confirmará tras la primera visita realizada."
        : null,
      visitUpdated ? "Visita asociada confirmada en el calendario." : null,
      contactInfo?.created
        ? `Contacto creado: ${contactInfo.contactName}.`
        : contactInfo
          ? `Añadido al contacto existente: ${contactInfo.contactName}.`
          : null,
      "5 min para revertir antes de notificar a la agencia.",
    ].filter(Boolean).join(" ");
    toast.success(
      targetEstado === "preregistro_activo" ? "Preregistro activado" : "Registro aprobado",
      { description },
    );

    /* Notificación in-app a la agencia que envió el registro · solo
       collaborator (direct = registro propio del promotor). Tras los
       5min de gracia el backend real enviará el email; en el mock,
       aparece inmediato en la campanita de la agencia (al cambiar de
       cuenta verá la notif). */
    if (record && record.origen === "collaborator" && record.agencyId) {
      recordNotification({
        recipientUserId: `u-agency-${record.agencyId}`,
        event: targetEstado === "preregistro_activo" ? "preregistration.approved" : "registration.approved",
        title: targetEstado === "preregistro_activo"
          ? `Preregistro aprobado · ${record.cliente.nombre}`
          : `Registro aprobado · ${record.cliente.nombre}`,
        body: targetEstado === "preregistro_activo"
          ? "Cliente queda reservado a tu nombre · se confirmará tras la primera visita."
          : "Cliente formalmente registrado a tu agencia.",
        severity: "success",
        href: `/registros?active=${record.id}`,
        meta: { registroId: record.id, publicRef: record.publicRef ?? "" },
      });
    }
  };
  const reject = (id: string, decisionNote: string) => {
    const now = new Date().toISOString();
    const record = records.find((r) => r.id === id);
    setRecords((prev) => prev.map((r) => r.id === id ? {
      ...r, estado: "rechazado", decidedAt: now,
      decidedByUserId: currentUser.id,
      decidedBy: currentUser.name,
      decidedByRole: currentUser.jobTitle,
      decisionNote,
    } : r));
    /* Si el registro tenía visita pendiente, se cancela con el
       motivo (se añade a las notas del evento del calendario). */
    const { visitUpdated } = onRegistroRejected(id, decisionNote);
    toast.error("Registro rechazado", {
      description: visitUpdated
        ? "Visita asociada cancelada en el calendario. 5 min para revertir."
        : "Tienes 5 min para revertir antes de notificar a la agencia.",
    });
    /* Notif in-app a la agencia. */
    if (record && record.origen === "collaborator" && record.agencyId) {
      recordNotification({
        recipientUserId: `u-agency-${record.agencyId}`,
        event: "registration.rejected",
        title: `Registro rechazado · ${record.cliente.nombre}`,
        body: decisionNote ? `Motivo: ${decisionNote}` : undefined,
        severity: "danger",
        href: `/registros?active=${record.id}`,
        meta: { registroId: record.id, publicRef: record.publicRef ?? "" },
      });
    }
  };

  /* Estado del dialog de rechazo · record siendo rechazado. null = cerrado. */
  const [rejectingRecord, setRejectingRecord] = useState<Registro | null>(null);

  /** Feedback loop IA · el promotor descarta el match detectado
   *  (conoce que son personas distintas) · resetea matchPercentage
   *  y deja traza en recommendation para auditoría.
   *  TODO(backend): POST /api/records/:id/dismiss-match envía la
   *  señal al modelo de IA para que ajuste el ranker. */
  const dismissMatch = (id: string) => {
    setRecords((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      const promo = promotionById.get(r.promotionId);
      return {
        ...r,
        matchPercentage: 0,
        matchWith: undefined,
        matchCliente: undefined,
        recommendation: `Match descartado por ${getOwnerRoleArticleLower(promo)} · no es la misma persona.`,
      };
    }));
    toast.success("Match descartado", {
      description: "Byvaro aprenderá de esta decisión. El registro ya se puede aprobar sin advertencia.",
    });
  };

  /** Revierte una decisión dentro del grace period (devuelve a pending). */
  const revert = (id: string) => {
    setRecords((prev) => prev.map((r) => r.id === id ? {
      ...r, estado: "pendiente", decidedAt: undefined,
    } : r));
    toast.info("Decisión revertida", { description: "El registro vuelve a pendiente." });
  };

  /* ── Acciones sobre la visita asociada al preregistro_activo ──
     Bloque A · ver `docs/registration-system.md §2.3` y los TODO(backend)
     que describen los endpoints REST equivalentes. */

  /** Reprograma la visita asociada · cap a 2 reprogramaciones.
   *  TODO(backend): POST /api/registrations/:id/visit/reschedule
   *    body: { newDate, newTime, note? }
   *    → 200 { reprogramacionesCount, visitDate, visitTime }
   *    → 422 si reprogramacionesCount >= 2
   *    Permission: solo `submittingParty` (agencia) o `owningParty`
   *    (promotor) del registro. */
  const rescheduleVisit = (id: string, payload: { newDate: string; newTime: string; note?: string }) => {
    const record = records.find((r) => r.id === id);
    setRecords((prev) => prev.map((r) => r.id === id ? {
      ...r,
      visitDate: payload.newDate,
      visitTime: payload.newTime,
      reprogramacionesCount: (r.reprogramacionesCount ?? 0) + 1,
      visitOutcome: "reprogramada",
      visitOutcomeAt: new Date().toISOString(),
      visitNote: payload.note,
    } : r));
    toast.success("Visita reprogramada", {
      description: `Nueva fecha: ${new Date(payload.newDate).toLocaleDateString("es-ES", { day: "numeric", month: "long" })}${payload.newTime ? ` · ${payload.newTime}h` : ""}.`,
    });
    /* Notif cross-empresa · al lado opuesto al que reprograma. */
    if (record) {
      const agencyReschedules = isAgencyUser;
      if (agencyReschedules) {
        /* Agencia reprograma → promotor recibe notif. Phase 1 mock
           usamos u1 (promoter admin) como recipient genérico. */
        recordNotification({
          recipientUserId: "u1",
          event: "visit.rescheduled_by_agency",
          title: `Visita reprogramada · ${record.cliente.nombre}`,
          body: `Nueva fecha: ${new Date(payload.newDate).toLocaleDateString("es-ES", { day: "numeric", month: "long" })}${payload.newTime ? ` · ${payload.newTime}h` : ""}.${payload.note ? ` Motivo: ${payload.note}` : ""}`,
          severity: "info",
          href: `/registros?active=${record.id}`,
        });
      } else if (record.agencyId) {
        recordNotification({
          recipientUserId: `u-agency-${record.agencyId}`,
          event: "visit.rescheduled_by_developer",
          title: `Visita reprogramada por el promotor · ${record.cliente.nombre}`,
          body: `Nueva fecha: ${new Date(payload.newDate).toLocaleDateString("es-ES", { day: "numeric", month: "long" })}${payload.newTime ? ` · ${payload.newTime}h` : ""}.${payload.note ? ` Motivo: ${payload.note}` : ""}`,
          severity: "warning",
          href: `/registros?active=${record.id}`,
        });
      }
    }
  };

  /** Cancela la visita · transita a `caducado` (cliente liberado).
   *  TODO(backend): POST /api/registrations/:id/visit/cancel
   *    body: { outcome: "no_show_cliente"|"cancelada_agencia"|"cancelada_promotor", note? }
   *    → 200 { estado: "caducado", visitOutcome, visitOutcomeAt }
   *    Permission: outcome restringido por rol del caller (la agencia
   *    solo puede `no_show_cliente`/`cancelada_agencia`; el promotor
   *    solo `cancelada_promotor`). */
  const cancelVisit = (id: string, payload: { outcome: VisitOutcome; note?: string }) => {
    const now = new Date().toISOString();
    const record = records.find((r) => r.id === id);
    setRecords((prev) => prev.map((r) => r.id === id ? {
      ...r,
      estado: "caducado",
      visitOutcome: payload.outcome,
      visitOutcomeAt: now,
      visitNote: payload.note,
    } : r));
    /* Cancela también la visita en calendario si está enlazada. */
    onRegistroRejected(id, payload.note);
    /* Toast con tono según outcome · cancelación promotor es informativa,
       cancelación agencia es destructiva, no_show es neutra. */
    if (payload.outcome === "cancelada_promotor") {
      toast.info("Visita cancelada", {
        description: "La agencia ha sido notificada · NO afecta a su track record.",
      });
    } else if (payload.outcome === "cancelada_agencia") {
      toast.error("Visita cancelada", {
        description: "Cliente liberado · la cancelación queda registrada en tu track record.",
      });
    } else {
      toast.info("Visita cancelada", {
        description: "Cliente liberado · puede ser registrado de nuevo por cualquier agencia.",
      });
    }
    /* Notif cross-empresa · según quién cancele. */
    if (record) {
      if (payload.outcome === "cancelada_promotor" && record.agencyId) {
        /* Promotor cancela → agencia recibe notif con motivo. */
        recordNotification({
          recipientUserId: `u-agency-${record.agencyId}`,
          event: "visit.cancelled_by_developer",
          title: `Visita cancelada por el promotor · ${record.cliente.nombre}`,
          body: `Motivo: ${payload.note ?? "(sin motivo)"}. Puedes contactar al promotor o crear un nuevo registro.`,
          severity: "warning",
          href: `/registros?active=${record.id}`,
        });
      } else if (
        payload.outcome === "cancelada_agencia" || payload.outcome === "no_show_cliente"
      ) {
        /* Agencia cancela → promotor recibe notif. */
        recordNotification({
          recipientUserId: "u1",
          event: "visit.cancelled_by_agency",
          title: `Visita cancelada · ${record.cliente.nombre}`,
          body: payload.outcome === "no_show_cliente"
            ? "El cliente desistió · liberado para otras agencias."
            : `Cancelación de la agencia · cliente liberado.${payload.note ? ` Nota: ${payload.note}` : ""}`,
          severity: payload.outcome === "cancelada_agencia" ? "warning" : "info",
          href: `/registros?active=${record.id}`,
        });
      }
    }
  };

  const bulkApprove = () => {
    const n = selectedIds.length;
    setRecords((prev) =>
      prev.map((r) => (selectedIds.includes(r.id) ? { ...r, estado: "aprobado" } : r)),
    );
    setSelectedIds([]);
    toast.success(`${n} registros aprobados`, { description: "Notificaciones enviadas." });
  };
  const bulkReject = () => {
    const n = selectedIds.length;
    setRecords((prev) =>
      prev.map((r) => (selectedIds.includes(r.id) ? { ...r, estado: "rechazado" } : r)),
    );
    setSelectedIds([]);
    toast.error(`${n} registros rechazados`);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const clearFilters = () => {
    setSearch("");
    setPromotionFilter([]);
    setAgencyFilter([]);
    setEstadoFilter("todos");
    setOrigenFilter([]);
    setNacionalidadFilter([]);
    setDateRange("all");
    setOnlyDuplicates(false);
  };
  const hasFilters =
    search.trim().length > 0 ||
    promotionFilter.length > 0 ||
    agencyFilter.length > 0 ||
    estadoFilter !== "todos" ||
    origenFilter.length > 0 ||
    nacionalidadFilter.length > 0 ||
    dateRange !== "all" ||
    onlyDuplicates;
  /* Contador de filtros activos · sin contar el search ni los tabs
     de estado · solo lo del drawer · driver del badge en el botón. */
  const filterCount =
    promotionFilter.length +
    agencyFilter.length +
    origenFilter.length +
    nacionalidadFilter.length +
    (dateRange !== "all" ? 1 : 0) +
    (onlyDuplicates ? 1 : 0);

  const origenOptions: Array<{ value: RegistroOrigen; label: string }> = [
    { value: "direct", label: "Directo" },
    { value: "collaborator", label: "Colaborador" },
  ];

  /** Nacionalidades disponibles · derivadas de los registros actuales,
   *  con su ISO 3166-1 derivado · alimenta `<Flag iso=... />` en
   *  el dropdown. Ordenadas por frecuencia · top 10. */
  const nacionalidadOptions = useMemo(() => {
    const stats = new Map<string, { count: number; iso?: string }>();
    for (const r of records) {
      const nat = r.cliente.nacionalidad;
      if (!nat) continue;
      const prev = stats.get(nat);
      stats.set(nat, {
        count: (prev?.count ?? 0) + 1,
        iso: prev?.iso ?? r.cliente.nationalityIso ?? resolveNationality(nat).iso,
      });
    }
    return Array.from(stats.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([nat, s]) => ({
        value: nat,
        label: nat,
        iso: s.iso,
      }));
  }, [records]);

  const dateRangeOptions: Array<{ value: "all" | "today" | "7d" | "30d"; label: string }> = [
    { value: "all",   label: "Todos" },
    { value: "today", label: "Hoy" },
    { value: "7d",    label: "Últimos 7 días" },
    { value: "30d",   label: "Últimos 30 días" },
  ];

  const estadoTabs: Array<{ value: RegistroEstado | "todos"; label: string }> = [
    { value: "todos", label: "Todos" },
    { value: "pendiente", label: "Pendientes" },
    { value: "preregistro_activo", label: "Preregistros" },
    { value: "aprobado", label: "Aprobados" },
    { value: "rechazado", label: "Rechazados" },
    { value: "duplicado", label: "Duplicados" },
    { value: "caducado", label: "Caducados" },
  ];

  return (
    <div className="flex flex-col min-h-full bg-background">

      {/* ═══════════ HEADER ═══════════ */}
      <div className="px-3 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-3">
        <div className="max-w-content mx-auto flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
          <div className="shrink-0 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground leading-none">
              Comercial
            </p>
            <h1 className="text-[19px] sm:text-[22px] font-bold tracking-tight leading-tight mt-1">Registros</h1>
          </div>

          {/* Buscador */}
          <div className="flex items-center gap-2 sm:ml-auto flex-1 sm:flex-initial sm:max-w-[520px]">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 z-10" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente, email, DNI, promoción…"
                className="w-full h-9 pl-9 pr-9 text-sm bg-card border border-border rounded-full focus:border-primary outline-none transition-colors"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

      </div>

      <div className="h-px bg-border/60" />

      {/* ═══════════ Toolbar · tabs estado + botón Filtros ═══════════ */}
      <div className="px-3 sm:px-6 lg:px-8 py-2.5">
        <div className="max-w-content mx-auto flex items-center gap-3">
          {/* Tabs de estado · scroll horizontal en mobile con fade
              degradado a la derecha que indica "hay más". */}
          <div className="relative flex-1 min-w-0">
            <div className="flex items-center gap-0.5 overflow-x-auto no-scrollbar -mx-1 px-1">
              {estadoTabs.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setEstadoFilter(opt.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-[12.5px] font-medium transition-colors whitespace-nowrap",
                    estadoFilter === opt.value
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {/* Fade · solo en mobile · señala que hay más al hacer swipe. */}
            <div
              className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-background to-transparent lg:hidden"
              aria-hidden
            />
          </div>

          {/* Selector de orden · compacto */}
          <SortDropdown value={sortBy} onChange={setSortBy} />

          {/* Botón Filtros · abre drawer (mobile = full-screen). */}
          <FiltersTriggerButton
            count={filterCount}
            onClick={() => setFiltersOpen(true)}
          />
        </div>
      </div>

      {/* ═══════════ Contenido master-detail ═══════════ */}
      <div className="flex-1 px-3 sm:px-6 lg:px-8 pb-24 lg:pb-8">
        <div className="max-w-content mx-auto">
          {filtered.length === 0 ? (
            <EmptyState hasFilters={hasFilters} onReset={clearFilters} />
          ) : (
            <div className="flex gap-4 lg:gap-5">
              {/* ─── LISTA MAESTRA ─── */}
              <aside
                className={cn(
                  "w-full lg:w-[420px] shrink-0 flex flex-col gap-2.5 pb-24 lg:pb-0",
                  // En móvil: si hay activeRecord ocultamos la lista (vista detalle).
                  //  pb-24 evita que la última card quede tapada por
                  //  el MobileBottomNav.
                  activeRecord && "hidden lg:flex",
                )}
              >
                {sortedFiltered.map((r) => {
                  const promo = promotionById.get(r.promotionId);
                  const ag = r.agencyId ? agencyById.get(r.agencyId) : undefined;
                  const selected = selectedIds.includes(r.id);
                  const isActive = activeId === r.id;
                  const isDirect = r.origen === "direct";

                  return (
                    <article
                      key={r.id}
                      onClick={() => setActiveId(r.id)}
                      className={cn(
                        "group relative flex items-start gap-3 p-4 bg-card border rounded-2xl shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer",
                        isActive ? "border-foreground/30 ring-1 ring-foreground/10" : "border-border",
                        selected && "ring-2 ring-primary/40 border-primary/40",
                      )}
                    >
                      {/* Checkbox selección múltiple */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(r.id);
                        }}
                        aria-label={selected ? "Deseleccionar registro" : "Seleccionar registro"}
                        className={cn(
                          "h-5 w-5 rounded-md border shrink-0 grid place-items-center transition-colors mt-0.5",
                          selected
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-border bg-card hover:border-foreground/40",
                        )}
                      >
                        {selected && <Check className="h-3 w-3" strokeWidth={3} />}
                      </button>

                      {/* MatchRing si hay porcentaje · iniciales si no */}
                      {r.matchPercentage > 0 ? (
                        <MatchRing pct={r.matchPercentage} size={12} />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-muted text-foreground grid place-items-center shrink-0 text-xs font-bold tracking-tight">
                          {initials(r.cliente.nombre)}
                        </div>
                      )}

                      {/* Contenido minimalista · nombre + contexto + fecha/estado */}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate inline-flex items-center gap-1.5">
                          <Flag iso={r.cliente.nationalityIso ?? resolveNationality(r.cliente.nacionalidad).iso} size={14} />
                          <span className="truncate">{r.cliente.nombre}</span>
                          {r.tipo === "registration_visit" && (
                            <span className="text-primary text-[10px] font-semibold uppercase tracking-wide shrink-0">
                              · visita
                            </span>
                          )}
                        </p>

                        <p className="text-xs text-muted-foreground truncate mt-0.5 inline-flex items-center gap-1.5 w-full">
                          <span className="truncate">
                            {promo?.name ?? "Promoción"}
                            {!isDirect && ag && (
                              <>
                                <span className="text-border mx-1.5">·</span>
                                {ag.name}
                              </>
                            )}
                          </span>
                          {/* Track record de la agencia · SOLO promotor.
                              La agencia no debe ver cómo el sistema la
                              califica internamente (privacy + UX). */}
                          {!isAgencyUser && !isDirect && r.agencyId && (
                            <AgencyTrackPill trackRecord={getAgencyTrackRecord(r.agencyId, createdRegistros)} />
                          )}
                        </p>

                        <div className="flex items-center justify-between gap-2 mt-2">
                          <span className="text-[11px] text-muted-foreground/80 tabular-nums">
                            {relativeDate(r.fecha)}
                          </span>
                          <Tag variant={estadoTagVariant(r.estado)} size="sm" shape="pill">
                            {estadoLabel[r.estado]}
                          </Tag>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </aside>

              {/* ─── DETALLE ─── */}
              <section
                className={cn(
                  "flex-1 min-w-0",
                  // En desktop: parte del flex master-detail.
                  // En mobile: si no hay registro activo, oculto.
                  !activeRecord && "hidden lg:block",
                  // En mobile, cuando hay registro activo · pantalla
                  // completa (fixed inset-0 z-40) que cubre header,
                  // toolbar, lista y MobileBottomNav. Foco total en
                  // el detail · cerrar con el botón ← del header.
                  // `flex flex-col` para que la card interior pueda
                  // pinear su footer al fondo (body con flex-1
                  // overflow-y-auto). CLAUDE.md §"Responsive móvil
                  // sin popovers".
                  activeRecord && "fixed inset-0 z-40 bg-background flex flex-col lg:static lg:inset-auto lg:z-auto lg:bg-transparent lg:block",
                )}
              >
                {activeRecord ? (
                  <RegistroDetail
                    record={activeRecord}
                    promotionName={promotionById.get(activeRecord.promotionId)?.name ?? "—"}
                    promotionLocation={promotionById.get(activeRecord.promotionId)?.location ?? ""}
                    agency={activeRecord.agencyId ? agencyById.get(activeRecord.agencyId) : undefined}
                    onApprove={() => startApprove(activeRecord)}
                    onReject={() => setRejectingRecord(activeRecord)}
                    onRevert={() => revert(activeRecord.id)}
                    onDismissMatch={() => dismissMatch(activeRecord.id)}
                    onReschedule={(payload) => rescheduleVisit(activeRecord.id, payload)}
                    onCancelVisit={(payload) => cancelVisit(activeRecord.id, payload)}
                    viewerIsAgency={isAgencyUser}
                    onBack={() => setActiveId(null)}
                  />
                ) : (
                  <div className="hidden lg:flex items-center justify-center h-full min-h-[400px] bg-card border border-dashed border-border rounded-2xl">
                    <div className="text-center px-6">
                      <div className="h-12 w-12 rounded-2xl bg-muted grid place-items-center mx-auto mb-4">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-semibold text-foreground">Selecciona un registro</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Elige una entrada de la lista para ver todos los datos.
                      </p>
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════ Barra flotante de selección múltiple · solo promotor ═══════════ */}
      {!isAgencyUser && selectedIds.length > 0 && (
        <div
          className={cn(
            "fixed left-1/2 -translate-x-1/2 z-40",
            // Mobile: sube para no chocar con MobileBottomNav (60px h)
            "bottom-[72px] lg:bottom-6",
          )}
          role="region"
          aria-label="Acciones de selección múltiple"
        >
          <div className="flex items-center gap-2 px-3 py-2 bg-foreground text-background rounded-full shadow-soft-lg">
            <span className="text-xs font-semibold px-2 tnum">
              {selectedIds.length} seleccionado{selectedIds.length !== 1 ? "s" : ""}
            </span>
            <div className="h-5 w-px bg-background/20" />
            <button
              onClick={bulkApprove}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-background/10 hover:bg-background/20 text-xs font-medium transition-colors"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Aprobar todos
            </button>
            <button
              onClick={bulkReject}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-background/10 hover:bg-background/20 text-xs font-medium transition-colors"
            >
              <XCircle className="h-3.5 w-3.5" />
              Rechazar todos
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="inline-flex items-center justify-center h-8 w-8 rounded-full hover:bg-background/10 transition-colors"
              aria-label="Cancelar selección"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ═══════════ Flujo de aprobación · 3 dialogs encadenados ═══════════ */}
      {approvalFlow && (
        <>
          <MatchConfirmDialog
            open={approvalFlow.stage === "match"}
            record={approvalFlow.record}
            canSeeDetails={canSeeMatchDetails}
            onContinue={advanceApproval}
            onCancel={cancelApproval}
          />
          <RelationConfirmDialog
            open={approvalFlow.stage === "relation"}
            record={approvalFlow.record}
            canSeeDetails={canSeeMatchDetails}
            onConfirm={(linkContact) => {
              // Sin toast intermedio · approve() emite el único toast
              // final con el resumen (evita duplicados).
              if (linkContact && approvalFlow.record.possibleRelation) {
                /* TODO(backend): POST /api/contacts/:id/relations con
                   {otherContactId, relation, confidence, source: "ia"}
                   · bidireccional (ambos contactos). */
              }
              advanceApproval();
            }}
            onCancel={cancelApproval}
          />
          <VisitConfirmDialog
            open={approvalFlow.stage === "visit"}
            record={approvalFlow.record}
            onConfirm={(result: VisitConfirmResult) => {
              // Crear el CalendarEvent de la visita · hoy los seeds
              // NO traen visita pre-creada, así que hace falta crear
              // una para que después `onRegistroApproved` la pase a
              // confirmed. Si ya existía, se confirma en approve().
              const r = approvalFlow.record;
              const hasVisit = r.tipo === "registration_visit" || r.tipo === "visit_only";
              if (hasVisit) {
                const date = result.mode === "propose" ? result.proposedDate! : r.visitDate!;
                const time = result.mode === "propose" ? result.proposedTime! : (r.visitTime ?? "10:00");
                const start = `${date}T${time}:00`;
                const endHour = String((parseInt(time.slice(0, 2), 10) + 1) % 24).padStart(2, "0");
                const end = `${date}T${endHour}:${time.slice(3)}:00`;
                const promo = promotionById.get(r.promotionId);
                try {
                  createVisitFromRegistro({
                    registroId: r.id,
                    assigneeUserId: result.hostUserId,
                    start,
                    end,
                    clientName: r.cliente.nombre,
                    promotionId: r.promotionId,
                    promotionName: promo?.name ?? "Promoción",
                    locationLabel: promo?.location,
                    notes: result.mode === "propose"
                      ? "Contrapropuesta de horario enviada a la agencia"
                      : undefined,
                  });
                } catch {
                  // Si ya existía una visita con ese registroId, silenciar
                  // · onRegistroApproved la confirmará.
                }
              }
              // TODO(backend):
              //   POST /api/records/:id/visit-confirm
              //   { hostUserId, mode, proposedDate?, proposedTime? }
              advanceApproval();
            }}
            onCancel={cancelApproval}
          />
          {/* Bloque H · si match ≥70%, pedir justificación obligatoria
              ANTES de continuar el flujo. Queda en historial cross-empresa. */}
          <OverrideConfirmDialog
            open={approvalFlow.stage === "override"}
            record={approvalFlow.record}
            onClose={cancelApproval}
            onConfirm={confirmOverrideAndAdvance}
          />
          {/* Bloque D · último step · T&C antes del approve final. */}
          <TermsConfirmDialog
            open={approvalFlow.stage === "terms"}
            modo={
              promotionById.get(approvalFlow.record.promotionId)?.modoValidacionRegistro
              ?? "por_visita"
            }
            vars={{
              agencia: approvalFlow.record.agencyId
                ? agencyById.get(approvalFlow.record.agencyId)?.name ?? "la agencia colaboradora"
                : `${getOwnerRoleArticleLower(promotionById.get(approvalFlow.record.promotionId))} (registro directo)`,
              cliente: approvalFlow.record.cliente.nombre,
              promocion: promotionById.get(approvalFlow.record.promotionId)?.name ?? "la promoción",
            }}
            onClose={cancelApproval}
            onConfirm={confirmTermsAndApprove}
          />
        </>
      )}

      {/* ═══════════ Dialog de rechazo · motivos canónicos ═══════════ */}
      {rejectingRecord && (
        <RejectDialog
          open={true}
          record={rejectingRecord}
          onConfirm={(decisionNote) => {
            reject(rejectingRecord.id, decisionNote);
            setRejectingRecord(null);
          }}
          onCancel={() => setRejectingRecord(null)}
        />
      )}

      {/* ═══════════ Drawer de filtros · responsive ═══════════ */}
      <RegistrosFilterDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filterCount={filterCount}
        resultCount={sortedFiltered.length}
        promotionOptions={promotionOptions}
        promotionFilter={promotionFilter}
        setPromotionFilter={setPromotionFilter}
        agencyFilter={agencyFilter}
        setAgencyFilter={setAgencyFilter}
        agenciesForFilter={agenciesForFilter}
        origenOptions={origenOptions}
        origenFilter={origenFilter}
        setOrigenFilter={(vs) => setOrigenFilter(vs as RegistroOrigen[])}
        nacionalidadOptions={nacionalidadOptions}
        nacionalidadFilter={nacionalidadFilter}
        setNacionalidadFilter={setNacionalidadFilter}
        dateRangeOptions={dateRangeOptions}
        dateRange={dateRange}
        setDateRange={setDateRange}
        onlyDuplicates={onlyDuplicates}
        setOnlyDuplicates={setOnlyDuplicates}
        onClear={clearFilters}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Detalle de registro (columna derecha en desktop, pantalla completa en móvil)
   ═══════════════════════════════════════════════════════════════════ */
function RegistroDetail({
  record,
  promotionName,
  promotionLocation,
  agency,
  onApprove,
  onReject,
  onRevert,
  onDismissMatch,
  onReschedule,
  onCancelVisit,
  onBack,
  viewerIsAgency = false,
}: {
  record: Registro;
  promotionName: string;
  promotionLocation: string;
  agency?: import("@/data/agencies").Agency;
  onApprove: () => void;
  onReject: () => void;
  onRevert: () => void;
  /** Callback cuando el promotor pulsa "No es duplicado" · solo
   *  disponible para el promotor (no para agencia). */
  onDismissMatch?: () => void;
  /** Callbacks de gestión de visita (preregistro_activo). */
  onReschedule?: (payload: { newDate: string; newTime: string; note?: string }) => void;
  onCancelVisit?: (payload: { outcome: VisitOutcome; note?: string }) => void;
  onBack: () => void;
  /** La agencia ve sus registros pero NO decide sobre ellos — eso
   *  es competencia del promotor. Oculta el pie de Aprobar/Rechazar. */
  viewerIsAgency?: boolean;
}) {
  const level = getMatchLevel(record.matchPercentage);
  const canDecide = !viewerIsAgency && record.estado === "pendiente";

  /* State local de los diálogos de visita (Bloque A). */
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [cancelVisitOpen, setCancelVisitOpen] = useState(false);

  /* Resolución de la promoción asociada · cruza ambos seeds (shareables
   * + developer-only). Se usa para resolver el rol owner (promotor vs
   * comercializador) en copy de los diálogos · CLAUDE.md regla de oro. */
  const promo = useMemo(() =>
    promotions.find((p) => p.id === record.promotionId)
    ?? developerOnlyPromotions.find((p) => p.id === record.promotionId),
  [record.promotionId]);

  /* Bloque B · caducidad client-side · resuelve si el preregistro
     está dentro/fuera de plazo. UI hint hasta que el cron backend
     exista (default 30d si la promo no declara `validezRegistroDias`).
     TODO(backend): sustituir el `undefined` por
     `promotion.validezRegistroDias` cuando se cablee al modelo real. */
  const expiryStatus = getExpiryStatus(record, undefined);

  // Agente que envió el registro · preferir audit.actor (huella real),
  // fallback al contacto principal de la agencia.
  const agent = record.audit?.actor
    ? {
        name: record.audit.actor.name,
        email: record.audit.actor.email,
        role: undefined as string | undefined,
      }
    : agency?.contactoPrincipal
      ? {
          name: agency.contactoPrincipal.nombre,
          email: agency.contactoPrincipal.email,
          role: agency.contactoPrincipal.rol,
        }
      : null;
  const agentAvatar = agent
    ? `https://i.pravatar.cc/150?u=${encodeURIComponent(agent.email)}`
    : null;

  return (
    <div className="bg-card overflow-hidden flex flex-col h-full lg:h-auto lg:border lg:border-border lg:rounded-2xl lg:shadow-soft">
      {/* Header del detalle · nombre + pulso pendiente + subtítulo con
          la promoción (antes estaba en el grid "Contexto"). */}
      <div className="px-4 sm:px-6 py-4 border-b border-border flex items-center gap-3">
        <button
          onClick={onBack}
          className="lg:hidden p-2 -ml-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Volver a la lista"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="h-11 w-11 rounded-full bg-muted text-foreground grid place-items-center shrink-0 text-sm font-bold">
          {initials(record.cliente.nombre)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-bold text-foreground leading-tight truncate">
              {/* Bandera SVG · si el registro no trae `nationalityIso`
                 explícito (creados desde dialog), lo derivamos del nombre
                 de la nacionalidad · siempre se muestra bandera. */}
              <Flag
                iso={record.cliente.nationalityIso ?? resolveNationality(record.cliente.nacionalidad).iso}
                size={16}
                className="mr-1.5 align-middle"
              />
              {record.cliente.nombre}
            </h2>
            {/* publicRef del registro · ref humana copiable. */}
            {record.publicRef && (
              <PublicRefBadge value={record.publicRef} size="sm" />
            )}
            {/* Pulso "esperando" · pendiente (decisión) o preregistro_activo (visita). */}
            {(record.estado === "pendiente" || record.estado === "preregistro_activo") && (
              <span
                className="relative flex h-2 w-2 shrink-0"
                aria-label={record.estado === "pendiente" ? "Esperando decisión" : "Preregistro · esperando visita"}
              >
                <span className="absolute inline-flex h-full w-full rounded-full bg-warning opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-warning" />
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {promotionName}
            {promotionLocation && <span className="text-muted-foreground/60"> · {promotionLocation}</span>}
          </p>
          <p className="text-[11px] text-muted-foreground/70 mt-0.5 flex items-center gap-1 tabular-nums">
            <Clock className="h-2.5 w-2.5" />
            Enviado {relativeDate(record.fecha)}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Pill RGPD · solo si NO hay consentimiento (alerta discreta). */}
          {!record.consent && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-[10px] font-semibold uppercase tracking-wider"
              title="Sin consentimiento RGPD"
            >
              <XCircle className="h-2.5 w-2.5" /> RGPD
            </span>
          )}
          {/* Tag del estado solo si NO es pendiente (el pulso ya lo indica). */}
          {record.estado !== "pendiente" && (
            <Tag variant={estadoTagVariant(record.estado)} size="sm" shape="pill">
              {estadoLabel[record.estado]}
            </Tag>
          )}
        </div>
      </div>

      {/* Body scrollable · todo entre el header y el footer queda
          dentro de un <main> con `overflow-y-auto` para que el footer
          de acciones quede pegado al fondo en mobile (fullscreen) sin
          quedarse fuera de viewport en historiales largos. */}
      <main className="flex-1 overflow-y-auto">
      {/* Cross-promoción · aviso si el cliente ya está aprobado en
          otra promoción del workspace (email o teléfono coincide).
          Solo promotor (viewerIsAgency oculta). */}
      {!viewerIsAgency && (
        <div className="px-4 sm:px-6 mt-4">
          <CrossPromotionWarning record={record} />
        </div>
      )}

      {/* DuplicateResult — comparador side-by-side · SOLO promotor.
       *
       *  CRÍTICO · Privacy cross-tenant: la tabla expone email/teléfono/
       *  nombre del cliente ganador (otra agencia o CRM directo del
       *  promotor). La agencia entrante NO debe verlos · son datos de
       *  otro tenant. Para la agencia mostramos un aviso mínimo abajo. */}
      {!viewerIsAgency && record.matchPercentage > 0 && (
        <div className="px-4 sm:px-6 mt-4 space-y-3">
          <DuplicateResult
            record={record}
            onDismissMatch={canDecide ? onDismissMatch : undefined}
          />
          {/* Bloque H · contexto enriquecido · histórico de orígenes
              del Contact existente + estado de actividad de la
              atribución previa. Solo si el cliente está en CRM. */}
          <DuplicateContext record={record} />
        </div>
      )}

      {/* Bloque H · si el override ya se ha aplicado en este registro,
          mostrar la nota visible al promotor (queda en histórico). */}
      {!viewerIsAgency && record.overrideNote && (
        <div className="mx-4 sm:mx-6 mt-3 rounded-xl border border-warning/30 bg-warning/10 px-3.5 py-3 flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-warning leading-tight">
              Override aplicado
            </p>
            <p className="text-[12px] text-foreground mt-1 leading-relaxed">
              {record.overrideNote}
            </p>
            <p className="text-[10.5px] text-muted-foreground mt-1">
              Aprobado a pesar de match {record.matchPercentage}% · queda en historial cross-empresa.
            </p>
          </div>
        </div>
      )}

      {/* Aviso minimal a la agencia cuando su registro entró como
       *  `duplicado` por la regla first-come silent. Le indicamos que
       *  no se aprobará SIN exponer los datos del ganador. */}
      {viewerIsAgency && record.estado === "duplicado" && (
        <div className="px-4 sm:px-6 mt-4">
          <div className="rounded-xl border border-warning/30 bg-warning/10 px-3.5 py-3 flex items-start gap-2.5">
            <div className="h-7 w-7 rounded-full bg-warning/15 grid place-items-center shrink-0 mt-0.5">
              <Info className="h-3.5 w-3.5 text-warning" strokeWidth={2.25} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-semibold text-warning leading-snug">
                Registro marcado como duplicado
              </p>
              <p className="text-[11px] text-warning/85 leading-relaxed mt-0.5">
                Otro registro del mismo cliente entró antes en esta promoción.
                Tu registro no avanzará · contacta al promotor si crees que es un error.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Reassurance banner · sin coincidencias detectadas. SOLO promotor.
       *
       *  CRÍTICO · Privacy cross-tenant: el resultado del análisis IA
       *  cruza el cliente con TODO el universo del promotor (contactos
       *  CRM + registros de TODAS las agencias). Mostrarlo a la agencia
       *  filtra info estratégica que no debería conocer:
       *   · si el cliente está en otras agencias colaboradoras
       *   · si está en el CRM directo del promotor
       *  La agencia solo debe ver el estado de SU registro, no el
       *  resultado del análisis interno. */}
      {!viewerIsAgency && record.matchPercentage === 0 && record.estado === "pendiente" && (
        <div className="px-4 sm:px-6 mt-4">
          <div className="rounded-xl border border-success/30 bg-success/10 dark:bg-success/5 px-3.5 py-3 flex items-start gap-2.5">
            <div className="h-7 w-7 rounded-full bg-success/15 grid place-items-center shrink-0 mt-0.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" strokeWidth={2.25} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-semibold text-success leading-snug">
                Sin coincidencias · seguro aprobar
              </p>
              <p className="text-[11px] text-success/85 leading-relaxed mt-0.5">
                La IA ha cruzado el cliente con tus contactos y registros
                previos · no detecta duplicados.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Banner PREREGISTRO · estado preregistro_activo.
          Es la pieza visual más importante para que el promotor o la
          agencia entiendan que este NO es un registro definitivo · es
          un preregistro pendiente de visita realizada. */}
      {record.estado === "preregistro_activo" && (
        <div className="mx-4 sm:mx-6 mt-4 rounded-xl border-2 border-warning/40 bg-warning/15 dark:bg-warning/10 p-4 flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-warning/25 grid place-items-center text-warning shrink-0">
              <Eye className="h-5 w-5" strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[11px] uppercase tracking-[0.14em] font-bold text-warning">
                  Preregistro · pendiente de visita
                </p>
              </div>
              <p className="text-[13px] font-semibold text-foreground mt-1 leading-snug">
                Este NO es un registro definitivo todavía
              </p>
              <p className="text-[11.5px] text-foreground/80 mt-1 leading-relaxed">
                {viewerIsAgency
                  ? "Tu cliente queda reservado a tu nombre. Se confirmará como registro definitivo cuando se marque la visita como realizada · si el plazo expira sin visita, el cliente queda libre."
                  : "El cliente queda reservado a la agencia colaboradora. Se confirmará automáticamente cuando se marque la visita como realizada · si el plazo expira sin visita, el cliente queda libre."}
              </p>
              {record.visitDate && (
                <p className="text-[11.5px] text-warning font-semibold mt-2 inline-flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  Visita programada el{" "}
                  {new Date(record.visitDate).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
                  {record.visitTime && ` · ${record.visitTime}h`}
                </p>
              )}
              {/* Bloque B · alerta near-expiry · 48h antes de caducar. */}
              {(expiryStatus.nearExpiry || expiryStatus.expired) && (
                <p className={cn(
                  "text-[11.5px] font-semibold mt-2 inline-flex items-center gap-1.5",
                  expiryStatus.expired ? "text-destructive" : "text-warning",
                )}>
                  <AlertTriangle className="h-3 w-3" />
                  {expiryStatus.expired
                    ? `${expiryStatus.reason} · será marcado como caducado`
                    : expiryStatus.reason}
                </p>
              )}
            </div>
          </div>

          {/* Acciones de visita · Bloque A. Disponibles para agencia
              owner del registro y para promotor de la promoción. */}
          {(onReschedule || onCancelVisit) && (
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-warning/25">
              {onReschedule && (
                <button
                  type="button"
                  onClick={() => setRescheduleOpen(true)}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-card border border-border text-[12px] font-medium hover:bg-muted transition-colors"
                >
                  <Clock className="h-3.5 w-3.5" />
                  Cambiar fecha
                </button>
              )}
              {onCancelVisit && (
                <button
                  type="button"
                  onClick={() => setCancelVisitOpen(true)}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-card border border-border text-[12px] font-medium hover:bg-destructive/5 hover:text-destructive hover:border-destructive/30 transition-colors"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Cancelar visita
                </button>
              )}
              <span className="ml-auto text-[10.5px] text-warning/80 tabular-nums">
                Reprogramaciones: {record.reprogramacionesCount ?? 0}/2
              </span>
            </div>
          )}
        </div>
      )}

      {/* Diálogos de gestión de visita (Bloque A). */}
      {onReschedule && (
        <RescheduleVisitDialog
          open={rescheduleOpen}
          onClose={() => setRescheduleOpen(false)}
          currentDate={record.visitDate}
          currentTime={record.visitTime}
          reprogramacionesCount={record.reprogramacionesCount ?? 0}
          onConfirm={onReschedule}
        />
      )}
      {onCancelVisit && !viewerIsAgency && (
        <CancelVisitPromoterDialog
          open={cancelVisitOpen}
          onClose={() => setCancelVisitOpen(false)}
          onConfirm={onCancelVisit}
          ownerLabel={getOwnerRoleLabel(promo)}
        />
      )}
      {onCancelVisit && viewerIsAgency && (
        <CancelVisitAgencyDialog
          open={cancelVisitOpen}
          onClose={() => setCancelVisitOpen(false)}
          onConfirm={onCancelVisit}
          ownerArticle={getOwnerRoleArticleLower(promo)}
        />
      )}

      {/* Visita propuesta — solo si tipo === registration_visit */}
      {record.tipo === "registration_visit" && record.visitDate && (
        <div className="mx-4 sm:mx-6 mt-3 rounded-xl border border-primary/25 bg-primary/[0.03] p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center text-primary shrink-0">
            <Eye className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-primary">Visita solicitada</p>
            <p className="text-sm font-bold text-foreground mt-0.5">
              {new Date(record.visitDate).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
              {record.visitTime && ` · ${record.visitTime}h`}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary shrink-0">
            <Clock className="h-3 w-3" /> Pendiente
          </span>
        </div>
      )}

      {/* Body · cliente (si no hay match) + origen enriquecido.
          · Sin match  → 2 columnas (Cliente + Origen)
          · Con match  → solo Origen (los datos del cliente ya están
            en la tabla Coincidencia parcial arriba) */}
      <div className={cn(
        "px-4 sm:px-6 py-5 grid grid-cols-1 gap-5",
        record.matchPercentage === 0 && "md:grid-cols-2",
      )}>
        {record.matchPercentage === 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">
              Cliente
            </p>
            <dl className="space-y-2.5">
              <DetailRow
                icon={Phone}
                label="Teléfono"
                value={maskPhoneIfCollab(record.cliente.telefono, record.origen)}
                mono
              />
              <DetailRow
                icon={FlagIcon}
                label="Nacionalidad"
                /* Si el cliente no trae `nationalityIso` explícito,
                   lo derivamos del nombre de la nacionalidad para que
                   SIEMPRE se muestre bandera SVG (resolveNationality
                   cubre tanto inglés como español). */
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <Flag
                      iso={record.cliente.nationalityIso ?? resolveNationality(record.cliente.nacionalidad).iso}
                      size={14}
                    />
                    {record.cliente.nacionalidad}
                  </span>
                }
              />
            </dl>
          </div>
        )}

        {/* Origen / Destinatario · bidireccional según el viewer.
            · Vista promotor: "Enviado por" + agencia colaboradora (o
              "Captado por" + agente del propio promotor si es directo).
            · Vista agencia: "Enviado a" + nombre del promotor de la
              promoción · perspectiva inversa. */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">
            {viewerIsAgency
              ? "Enviado a"
              : record.origen === "direct" ? "Captado por" : "Enviado por"}
          </p>
          {viewerIsAgency ? (
            /* Vista AGENCIA · destinatario = promotor o comercializador
               de la promoción · resuelto dinámicamente vía
               `Promotion.ownerRole` (CLAUDE.md regla de oro · helper
               `getOwnerRoleLabel()`). Reusa el `promo` resuelto al
               principio del componente. */
            (() => {
              return (
                <div className="flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                    <Building2 className="h-4 w-4" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {getPromoterDisplayName(promo) || "Tu empresa"}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">{getOwnerRoleLabel(promo)}</p>
                  </div>
                </div>
              );
            })()
          ) : record.origen === "direct" ? (
            /* Directo · solo el agente del promotor. */
            agent ? (
              <div className="flex items-center gap-2.5">
                <img
                  src={agentAvatar!}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover shrink-0 bg-muted"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{agent.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {agent.role ?? "Promotor · equipo interno"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="h-10 w-10 rounded-full bg-success/10 text-success grid place-items-center shrink-0">
                  <UserCheck className="h-4 w-4" strokeWidth={1.75} />
                </div>
                <p className="text-sm font-medium text-foreground">Directo · captado por el promotor</p>
              </div>
            )
          ) : (
            /* Colaborador (vista promotor) · logo agencia + agente enviador. */
            <div className="space-y-2.5">
              {agency && (
                <div className="flex items-center gap-2.5">
                  {agency.logo ? (
                    <img
                      src={agency.logo}
                      alt=""
                      className="h-10 w-10 rounded-lg object-cover shrink-0 bg-muted border border-border"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-muted grid place-items-center shrink-0">
                      <Handshake className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{agency.name}</p>
                    {agency.location && (
                      <p className="text-[11px] text-muted-foreground truncate">{agency.location}</p>
                    )}
                  </div>
                </div>
              )}
              {agent && (
                <div className="flex items-center gap-2.5 pt-2 border-t border-border/50">
                  <img
                    src={agentAvatar!}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover shrink-0 bg-muted"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{agent.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {agent.role ?? "Agente colaborador"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Notas */}
      {record.notas && (
        <div className="px-4 sm:px-6 pb-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2">
            Notas del agente
          </p>
          <div className="p-3 rounded-xl border border-border bg-muted/20 text-sm text-foreground">
            {record.notas}
          </div>
        </div>
      )}

      {/* ActivityTimeline · abierto por defecto · si no cabe, scrollea
          el body (el footer queda fijo abajo gracias al flex column).
          `viewerIsAgency` filtra eventos internos del workspace
          promotor (privacy cross-tenant). */}
      <TimelineCollapsed record={record} viewerIsAgency={viewerIsAgency} />
      </main>

      {/* Footer de acciones · siempre visible para el promotor, con
          contenido distinto según estado (state machine):
          · pendiente              → botones Aprobar / Rechazar
          · decidido + en gracia   → countdown 5min + Revertir
          · decidido + post-gracia → estado final (decisión inmutable)
          La agencia no decide · footer oculto. */}
      {!viewerIsAgency && (
        <DecisionFooter
          record={record}
          onApprove={onApprove}
          onReject={onReject}
          onRevert={onRevert}
          canDecide={canDecide}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   DecisionFooter · pie de la card de detalle, contenido swap.
   ─────────────────────────────────────────────────────
   Pendiente · botones Aprobar/Rechazar.
   Recién decidido · GracePeriodBanner (countdown 5min + Revertir).
   Tras la gracia · pill de estado final (sin acción · ya notificada).
   ═══════════════════════════════════════════════════════════════════ */
function DecisionFooter({
  record, onApprove, onReject, onRevert, canDecide,
}: {
  record: Registro;
  onApprove: () => void;
  onReject: () => void;
  onRevert: () => void;
  canDecide: boolean;
}) {
  /* Re-render cada segundo · solo si está dentro de la gracia, para
   *  que el countdown del banner se actualice y la transición a
   *  "post-gracia" sea automática sin recargar. */
  const decided = record.estado === "aprobado" || record.estado === "rechazado";
  const decidedAtMs = record.decidedAt ? new Date(record.decidedAt).getTime() : 0;
  const inGrace = decided && decidedAtMs > 0 && Date.now() - decidedAtMs < 5 * 60 * 1000;
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!inGrace) return;
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, [inGrace]);

  return (
    <div className="border-t border-border bg-card px-4 sm:px-6 py-4">
      {canDecide ? (
        <div className="flex flex-wrap items-center gap-2">
          {record.matchPercentage > 0 && (
            <button
              onClick={() => toast.info("Abriendo ficha del cliente existente…")}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Ver cliente existente
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={onReject}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-border bg-card text-sm font-medium text-foreground hover:bg-destructive/5 hover:text-destructive hover:border-destructive/30 transition-colors"
            >
              <XCircle className="h-3.5 w-3.5" />
              Rechazar
            </button>
            <button
              onClick={onApprove}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors shadow-soft"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Aprobar
            </button>
          </div>
        </div>
      ) : inGrace ? (
        <GracePeriodBanner record={record} onRevert={onRevert} />
      ) : (
        <DecidedStatus record={record} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   DecidedStatus · pill final cuando ya pasó la ventana de gracia.
   El registro es inmutable: la agencia ya recibió la notificación.
   ═══════════════════════════════════════════════════════════════════ */
function DecidedStatus({ record }: { record: Registro }) {
  const isAprobado = record.estado === "aprobado";
  const isPreregistro = record.estado === "preregistro_activo";
  const isCaducado = record.estado === "caducado";
  const ago = record.decidedAt ? relativeDate(record.decidedAt) : "";

  /* Cuatro estilos según estado final · aprobado / preregistro / caducado / rechazado. */
  const styles = isAprobado
    ? { container: "bg-success/10 border border-success/25", iconWrap: "bg-success/15 text-success", text: "text-success" }
    : isPreregistro
    ? { container: "bg-warning/15 border border-warning/30", iconWrap: "bg-warning/20 text-warning", text: "text-warning" }
    : isCaducado
    ? { container: "bg-muted border border-border", iconWrap: "bg-muted-foreground/15 text-muted-foreground", text: "text-muted-foreground" }
    : { container: "bg-muted border border-border", iconWrap: "bg-muted-foreground/15 text-muted-foreground", text: "text-foreground" };

  const Icon = isAprobado ? CheckCircle2 : isPreregistro ? Eye : XCircle;
  const outcomeLabel = record.visitOutcome
    ? ({
        realizada:           "visita realizada",
        no_show_cliente:     "el cliente desistió",
        cancelada_agencia:   "cancelada por la agencia",
        cancelada_promotor:  "cancelada por el promotor",
        reprogramada:        "reprogramada",
      } as const)[record.visitOutcome]
    : null;
  const titleText = isAprobado
    ? "Aprobado · agencia notificada"
    : isPreregistro
    ? "Preregistro activo · esperando visita"
    : isCaducado
    ? `Caducado · cliente liberado${outcomeLabel ? ` (${outcomeLabel})` : ""}`
    : "Rechazado · agencia notificada";
  const subText = isPreregistro
    ? "Se confirmará como registro al marcar la visita como realizada · 5 min para revertir."
    : isCaducado
    ? `${record.visitNote ? `Motivo: ${record.visitNote} · ` : ""}cualquier agencia puede registrar al cliente.`
    : ago
      ? `Decisión ${ago} · ya no se puede revertir`
      : "";

  return (
    <div className={cn("rounded-xl px-3.5 py-3 flex items-center gap-3", styles.container)}>
      <div className={cn("h-8 w-8 rounded-full grid place-items-center shrink-0", styles.iconWrap)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-[13px] font-semibold leading-tight", styles.text)}>
          {titleText}
        </p>
        {subText && (
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {subText}
          </p>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   DetailRow · fila label/valor con icono y resaltado opcional
   ═══════════════════════════════════════════════════════════════════ */
function DetailRow({
  icon: Icon, label, value, mono, highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="h-7 w-7 rounded-lg bg-muted text-muted-foreground grid place-items-center shrink-0">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </p>
        <p
          className={cn(
            "text-sm text-foreground break-words leading-snug mt-0.5",
            mono && "tnum",
            highlight && "bg-warning/60 px-1.5 -mx-1.5 rounded font-semibold",
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   AgencyTrackPill · señal solo cuando hay alarma.
   Principio: "no news = good news". Mostrar % aprobación en TODAS las
   tarjetas era ruido (todas las agencias en el seed dan 100%).
   Aparece solo si la agencia tiene historial mixto (mucho rechazo o
   muchos duplicados) · pill ámbar discreto.
   ═══════════════════════════════════════════════════════════════════ */
function AgencyTrackPill({ trackRecord }: { trackRecord: AgencyTrackRecord }) {
  if (trackRecord.tier !== "mixed") return null;
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[9.5px] font-bold border bg-warning/10 text-warning border-warning/30 shrink-0 tabular-nums"
      title={`Historial mixto · ${trackRecord.approved} aprobados / ${trackRecord.rejected} rechazados · ${trackRecord.duplicateRate}% duplicados · revisar con atención`}
    >
      ⚠ Atención
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   TimelineCollapsed · ActivityTimeline plegado con toggle
   Mantiene el footer de acciones (Aprobar/Rechazar) siempre a la vista.
   ═══════════════════════════════════════════════════════════════════ */
function TimelineCollapsed({
  record,
  viewerIsAgency = false,
}: {
  record: Registro;
  viewerIsAgency?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const count = record.timeline?.length ?? 0;
  return (
    <div className="border-t border-border/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 sm:px-6 py-3 text-left hover:bg-muted/30 transition-colors"
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          Historial
          {count > 0 && (
            <span className="text-muted-foreground/70 normal-case tracking-normal font-normal">
              · {count} evento{count === 1 ? "" : "s"}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="px-4 sm:px-6 pb-5">
          <ActivityTimeline record={record} viewerIsAgency={viewerIsAgency} />
        </div>
      )}
    </div>
  );
}

function MultiSelectPill({
  label, options, values, onChange, icon,
}: {
  label: string;
  options: { value: string; label: string }[];
  values: string[];
  onChange: (v: string[]) => void;
  icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const active = values.length > 0;
  const display = active
    ? values.length === 1
      ? options.find((o) => o.value === values[0])?.label ?? label
      : `${label} · ${values.length}`
    : label;

  const toggle = (v: string) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-[12.5px] font-medium transition-colors max-w-[200px]",
          active
            ? "bg-foreground text-background border-foreground"
            : "bg-card border-border text-foreground hover:border-foreground/30",
        )}
      >
        {icon}
        <span className="truncate">{display}</span>
        <ChevronDown className={cn("h-3 w-3 opacity-70 transition-transform shrink-0", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 bg-popover border border-border rounded-xl shadow-soft-lg z-30 min-w-[240px] max-h-[320px] overflow-y-auto py-1.5">
          {values.length > 0 && (
            <button
              onClick={() => onChange([])}
              className="w-full text-left px-3 py-1.5 text-[11.5px] text-muted-foreground hover:text-destructive transition-colors"
            >
              Limpiar selección
            </button>
          )}
          {options.map((opt) => {
            const selected = values.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggle(opt.value)}
                className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-sm hover:bg-muted/40 transition-colors text-left"
              >
                <span className={cn("truncate", selected ? "text-foreground font-medium" : "text-muted-foreground")}>
                  {opt.label}
                </span>
                {selected && <Check className="h-3.5 w-3.5 text-primary shrink-0" strokeWidth={2.5} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SortDropdown · selector de orden de la lista.
   ═══════════════════════════════════════════════════════════════════ */
type SortKey = "recent" | "urgency" | "match";
const SORT_OPTIONS: { value: SortKey; label: string; hint: string }[] = [
  { value: "recent",  label: "Más recientes",     hint: "Fecha de envío · nuevo primero" },
  { value: "urgency", label: "Urgencia",          hint: "Pendientes >48h primero" },
  { value: "match",   label: "Coincidencia alta", hint: "% match mayor primero" },
];
function SortDropdown({
  value, onChange,
}: { value: SortKey; onChange: (v: SortKey) => void }) {
  const active = SORT_OPTIONS.find((o) => o.value === value)!;
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  /* Lista común de opciones · misma UI en mobile (sheet bottom) y
     desktop (popover). */
  const optionsList = (
    <div className="flex flex-col gap-0.5">
      {SORT_OPTIONS.map((o) => {
        const isActive = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => {
              onChange(o.value);
              setOpen(false);
            }}
            className={cn(
              "w-full text-left px-3 py-3 lg:py-2 rounded-xl lg:rounded-lg text-[13.5px] lg:text-[12.5px] transition-colors",
              isActive ? "bg-muted text-foreground font-medium" : "text-foreground hover:bg-muted/40",
            )}
          >
            <p className="font-medium">{o.label}</p>
            <p className="text-[11.5px] lg:text-[10.5px] text-muted-foreground mt-0.5">{o.hint}</p>
          </button>
        );
      })}
    </div>
  );

  const triggerBtn = (
    <button
      type="button"
      onClick={() => isMobile && setOpen(true)}
      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full border border-border bg-card text-[12.5px] font-medium text-foreground hover:border-foreground/30 transition-colors shrink-0"
      title={active.hint}
    >
      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
      <span className="hidden sm:inline">{active.label}</span>
    </button>
  );

  /* Mobile · Sheet desde abajo (estilo app nativa). CLAUDE.md
     §"Responsive móvil sin popovers". */
  if (isMobile) {
    return (
      <>
        {triggerBtn}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            className="rounded-t-2xl p-4 pt-3 max-h-[80vh] overflow-y-auto"
          >
            <div className="mx-auto h-1 w-10 rounded-full bg-border mb-3" aria-hidden />
            <SheetTitle className="text-sm font-semibold text-foreground mb-3">
              Ordenar por
            </SheetTitle>
            {optionsList}
          </SheetContent>
        </Sheet>
      </>
    );
  }

  /* Desktop · Popover anclado al trigger. */
  return (
    <Popover>
      <PopoverTrigger asChild>{triggerBtn}</PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1.5">
        {optionsList}
      </PopoverContent>
    </Popover>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   FiltrosPopover · todos los filtros en un único botón
   ─────────────────────────────────────────────────────
   Enfoque minimalista: la toolbar queda con tabs + 1 botón. Al clicar,
   se despliega un popover con las 3 listas de filtros + switch de
   duplicados + botón de limpiar. Muestra un badge con el nº total de
   filtros activos.
   ═══════════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════════
   FiltersTriggerButton · botón pill que abre el drawer.
   ═══════════════════════════════════════════════════════════════════ */
function FiltersTriggerButton({
  count, onClick,
}: { count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-[12.5px] font-medium transition-colors shrink-0",
        count > 0
          ? "bg-foreground text-background border-foreground"
          : "bg-card border-border text-foreground hover:border-foreground/30",
      )}
    >
      <Filter className="h-3.5 w-3.5" />
      Filtros
      {count > 0 && (
        <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-background text-foreground text-[10px] font-bold tabular-nums">
          {count}
        </span>
      )}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   RegistrosFilterDrawer · réplica del patrón de Promociones.
   ─────────────────────────────────────────────────────
   Desktop ≥lg · panel lateral 440px slide-in derecha.
   Móvil <lg · full-screen (CLAUDE.md §"Responsive móvil sin popovers").
   Header con título + cerrar · body scrollable con secciones · footer
   sticky con "Limpiar todo" + "Ver N resultados".
   ═══════════════════════════════════════════════════════════════════ */
function RegistrosFilterDrawer({
  open, onClose, filterCount, resultCount,
  promotionOptions, promotionFilter, setPromotionFilter,
  agencyFilter, setAgencyFilter, agenciesForFilter,
  origenOptions, origenFilter, setOrigenFilter,
  nacionalidadOptions, nacionalidadFilter, setNacionalidadFilter,
  dateRangeOptions, dateRange, setDateRange,
  onlyDuplicates, setOnlyDuplicates,
  onClear,
}: {
  open: boolean;
  onClose: () => void;
  filterCount: number;
  resultCount: number;
  promotionOptions: { value: string; label: string }[];
  promotionFilter: string[];
  setPromotionFilter: (v: string[]) => void;
  agencyFilter: string[];
  setAgencyFilter: (v: string[]) => void;
  agenciesForFilter: typeof ALL_AGENCIES;
  origenOptions: { value: string; label: string }[];
  origenFilter: string[];
  setOrigenFilter: (v: string[]) => void;
  nacionalidadOptions: { value: string; label: string; iso?: string }[];
  nacionalidadFilter: string[];
  setNacionalidadFilter: (v: string[]) => void;
  dateRangeOptions: { value: "all" | "today" | "7d" | "30d"; label: string }[];
  dateRange: "all" | "today" | "7d" | "30d";
  setDateRange: (v: "all" | "today" | "7d" | "30d") => void;
  onlyDuplicates: boolean;
  setOnlyDuplicates: (v: boolean) => void;
  onClear: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/25 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
            className={cn(
              "fixed top-0 bottom-0 right-0 z-50 bg-card border-l border-border shadow-soft-lg flex flex-col",
              // Mobile · full-screen · Desktop · panel lateral 440px.
              "w-full lg:w-[440px]",
            )}
            role="dialog"
            aria-label="Filtros de registros"
          >
            {/* Header */}
            <header className="h-14 shrink-0 flex items-center justify-between px-5 border-b border-border">
              <div>
                <h2 className="text-[15px] font-semibold tracking-tight">Filtros</h2>
                <p className="text-[11.5px] text-muted-foreground mt-0.5">
                  {filterCount === 0
                    ? "Ningún filtro aplicado"
                    : `${filterCount} filtro${filterCount > 1 ? "s" : ""} activo${filterCount > 1 ? "s" : ""}`}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 -mr-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Cerrar filtros"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            {/* Body · secciones */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 space-y-7">
              <div className="space-y-5">
                <SectionTitle>Origen y agencia</SectionTitle>
                <FilterGroup
                  title="Origen"
                  options={origenOptions}
                  values={origenFilter}
                  onChange={setOrigenFilter}
                />
                <AgencyPickerMulti
                  agencies={agenciesForFilter}
                  values={agencyFilter}
                  onChange={setAgencyFilter}
                />
              </div>

              <div className="h-px bg-border" />

              <div className="space-y-5">
                <SectionTitle>Promoción y mercado</SectionTitle>
                <SearchableFilterGroup
                  title="Promoción"
                  options={promotionOptions}
                  values={promotionFilter}
                  onChange={setPromotionFilter}
                  placeholder="Buscar promoción…"
                />
                {nacionalidadOptions.length > 0 && (
                  <SearchableFilterGroup
                    title="Nacionalidad"
                    options={nacionalidadOptions}
                    values={nacionalidadFilter}
                    onChange={setNacionalidadFilter}
                    placeholder="Buscar nacionalidad…"
                  />
                )}
              </div>

              <div className="h-px bg-border" />

              <div className="space-y-5">
                <SectionTitle>Fecha y duplicados</SectionTitle>
                {/* Rango de fecha · radio (1 opción). */}
                <div>
                  <h4 className="text-[13px] font-semibold text-foreground mb-2">Fecha de envío</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {dateRangeOptions.map((opt) => {
                      const active = dateRange === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => setDateRange(opt.value)}
                          className={cn(
                            "inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[12.5px] font-medium transition-colors",
                            active
                              ? "bg-primary/10 border-primary/30 text-primary"
                              : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                          )}
                        >
                          {active && <Check className="h-3 w-3" strokeWidth={3} />}
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[13px] font-semibold text-foreground">Solo duplicados</span>
                  </label>
                  <Switch
                    checked={onlyDuplicates}
                    onCheckedChange={setOnlyDuplicates}
                    ariaLabel="Solo duplicados posibles"
                  />
                </div>
              </div>
            </div>

            {/* Footer sticky */}
            <footer className="h-[72px] shrink-0 border-t border-border flex items-center justify-between gap-3 px-5">
              <button
                onClick={onClear}
                disabled={filterCount === 0}
                className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Limpiar todo
              </button>
              <button
                onClick={onClose}
                className="inline-flex items-center h-10 px-5 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors shadow-soft"
              >
                Ver {resultCount} resultado{resultCount !== 1 ? "s" : ""}
              </button>
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/* ─────── Primitives del drawer (réplica de Promociones) ─────── */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </p>
  );
}

function FilterGroup({
  title, options, values, onChange,
}: {
  title: string;
  options: { value: string; label: string }[];
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (v: string) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="text-[13px] font-semibold text-foreground">{title}</h4>
        {values.length > 0 && (
          <button
            onClick={() => onChange([])}
            className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
          >
            Limpiar
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const selected = values.includes(opt.value);
          return (
            <button
              key={opt.value}
              onClick={() => toggle(opt.value)}
              className={cn(
                "inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[12.5px] font-medium transition-colors",
                selected
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
              )}
            >
              {selected && <Check className="h-3 w-3" strokeWidth={3} />}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SearchableFilterGroup({
  title, options, values, onChange, placeholder = "Buscar…",
}: {
  title: string;
  options: { value: string; label: string }[];
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const qq = q.toLowerCase().trim();
    if (!qq) return options;
    return options.filter((o) => o.label.toLowerCase().includes(qq));
  }, [q, options]);
  const toggle = (v: string) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="text-[13px] font-semibold text-foreground">{title}</h4>
        {values.length > 0 && (
          <button onClick={() => onChange([])} className="text-[11px] text-muted-foreground hover:text-destructive">
            Limpiar
          </button>
        )}
      </div>
      <div className="relative mb-2">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="w-full h-8 pl-8 pr-8 text-[12.5px] bg-muted/30 border border-border rounded-full focus:bg-background focus:border-primary outline-none transition-colors"
        />
        {q && (
          <button onClick={() => setQ("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 max-h-[160px] overflow-y-auto overscroll-contain">
        {filtered.length === 0 ? (
          <p className="text-[11.5px] text-muted-foreground italic px-1">Sin coincidencias</p>
        ) : (
          filtered.map((opt) => {
            const selected = values.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggle(opt.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[12.5px] font-medium transition-colors",
                  selected
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                )}
              >
                {selected && <Check className="h-3 w-3" strokeWidth={3} />}
                {opt.label}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   AgencyPickerMulti · selector multi-agencia con logo + ubicación.
   Estilo cards stacked, cada una con check al seleccionarse. Búsqueda
   por nombre / ubicación. Réplica del AgencySearcher de Promociones
   pero multi-select.
   ═══════════════════════════════════════════════════════════════════ */
function AgencyPickerMulti({
  agencies, values, onChange,
}: {
  agencies: import("@/data/agencies").Agency[];
  values: string[];
  onChange: (ids: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const qq = q.toLowerCase().trim();
    if (!qq) return agencies;
    return agencies.filter(
      (a) => a.name.toLowerCase().includes(qq) || a.location.toLowerCase().includes(qq),
    );
  }, [q, agencies]);
  const toggle = (id: string) =>
    onChange(values.includes(id) ? values.filter((x) => x !== id) : [...values, id]);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="text-[13px] font-semibold text-foreground">Agencias</h4>
        {values.length > 0 && (
          <button onClick={() => onChange([])} className="text-[11px] text-muted-foreground hover:text-destructive">
            Quitar {values.length === 1 ? "agencia" : `${values.length} agencias`}
          </button>
        )}
      </div>
      <div className="relative mb-2">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o ubicación…"
          className="w-full h-8 pl-8 pr-8 text-[12.5px] bg-muted/30 border border-border rounded-full focus:bg-background focus:border-primary outline-none transition-colors"
        />
        {q && (
          <button
            onClick={() => setQ("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="space-y-1 max-h-[220px] overflow-y-auto overscroll-contain">
        {filtered.length === 0 ? (
          <p className="text-[11.5px] text-muted-foreground italic px-1 py-2">Sin coincidencias</p>
        ) : (
          filtered.map((ag) => {
            const selected = values.includes(ag.id);
            return (
              <button
                key={ag.id}
                onClick={() => toggle(ag.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 p-2 rounded-xl border text-left transition-colors",
                  selected
                    ? "border-primary/30 bg-primary/5"
                    : "border-transparent hover:bg-muted/40",
                )}
              >
                {ag.logo ? (
                  <img
                    src={ag.logo}
                    alt=""
                    className="h-8 w-8 rounded-full bg-white object-cover shrink-0 border border-border/60"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-muted grid place-items-center text-[10px] font-bold shrink-0">
                    {ag.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-foreground truncate">{ag.name}</p>
                  <p className="text-[10.5px] text-muted-foreground truncate">{ag.location}</p>
                </div>
                {selected && <Check className="h-4 w-4 text-primary shrink-0" strokeWidth={2.5} />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   EmptyState
   ═══════════════════════════════════════════════════════════════════ */
function EmptyState({ hasFilters, onReset }: { hasFilters: boolean; onReset: () => void }) {
  return (
    <div className="py-20 text-center">
      <div className="h-12 w-12 rounded-2xl bg-muted grid place-items-center mx-auto mb-4">
        <Filter className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">Sin registros</h3>
      <p className="text-[12.5px] text-muted-foreground mt-1">
        {hasFilters
          ? "Prueba a ajustar los filtros o a limpiar la búsqueda."
          : "Cuando las agencias envíen registros aparecerán aquí."}
      </p>
      {hasFilters && (
        <button
          onClick={onReset}
          className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
        >
          Limpiar filtros
        </button>
      )}
    </div>
  );
}

