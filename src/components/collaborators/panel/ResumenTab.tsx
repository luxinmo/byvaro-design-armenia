/**
 * Tab "Resumen" del panel de colaboración.
 *
 * Vista hero operativa en dos bloques:
 *
 *   1. Hero · frase grande con el estado de la colaboración.
 *   2. Bloque "En colaboración" · promociones que YA comparte + estado
 *      de lo que falta (contratos sin firmar, documentos pendientes).
 *   3. Bloque "Aún sin compartir" · promociones activas del promotor
 *      donde la agencia aún no está · oportunidad para ampliar.
 *   4. Próximas visitas (si hay).
 *
 * No hay KPIs — todo son señales accionables.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronRight, FileSignature, Home, Plus, Share2,
  Upload, ArrowRight, Check, MoreHorizontal, AlertTriangle, Send, Clock,
  MoreVertical, RefreshCcw, PauseCircle, PlayCircle, Ban,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Agency } from "@/data/agencies";
import { developerOnlyPromotions } from "@/data/developerPromotions";
import { promotions } from "@/data/promotions";
import {
  CONTRACT_NEAR_EXPIRY_DAYS,
  daysUntilContractExpiry,
  useContractsForAgency,
} from "@/lib/collaborationContracts";
import { useAgencyDocRequests } from "@/lib/agencyDocRequests";
import { useCurrentUser } from "@/lib/currentUser";
import { useInvitacionesForAgency } from "@/lib/invitaciones";
import { ContractScopePickerDialog } from "@/components/collaborators/ContractScopePickerDialog";
import { ContractNewChoiceDialog } from "@/components/collaborators/ContractNewChoiceDialog";
import { ContractUploadDialog } from "@/components/collaborators/ContractUploadDialog";
import { ContractSignedUploadDialog } from "@/components/collaborators/ContractSignedUploadDialog";
import { AgencySignContractDialog } from "@/components/collaborators/AgencySignContractDialog";
import { SharePromotionDialog } from "@/components/promotions/SharePromotionDialog";
import { RequestCollaborationDialog } from "@/components/collaborators/RequestCollaborationDialog";
import { useAllSolicitudes, findSolicitudVivaParaAgencia, backfillRequestedBy } from "@/lib/solicitudesColaboracion";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import {
  setPromoCollabStatus, usePromoCollabStatusMap, getPromoCollabStatusFromMap,
} from "@/lib/promoCollabStatus";
import {
  recordCollaborationPaused, recordCollaborationResumed, recordCompanyAny,
} from "@/lib/companyEvents";

/* ─── Helpers ─────────────────────────────────────────────────────── */

/** Etiqueta corta para la fecha de invitación en el chip del card. */
function formatInvitedAt(ms: number): string {
  if (!ms) return "hoy";
  const diff = Date.now() - ms;
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  return new Date(ms).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}


type PromoStatus = "active" | "incomplete" | "inactive" | "sold-out";
type PromoEntry = {
  id: string;
  name: string;
  active: boolean;
  status: PromoStatus;
  location?: string;
  commission?: number;
  image?: string;
  /* Rol del owner de la promo · "promotor" | "comercializador" ·
   *  marcado al crearla. Lo usamos en la copy del lado agencia
   *  ("solo el promotor puede subir el contrato" vs "solo el
   *  comercializador..."). Ver REGLA DE ORO en CLAUDE.md. */
  ownerRole?: "promotor" | "comercializador";
  /* Datos comerciales — los muestra el card cuando lo ve la agencia
   *  (read-only). El promotor sigue viendo Visitas/Ventas/Conversión. */
  availableUnits?: number;
  totalUnits?: number;
  priceMin?: number;
  priceMax?: number;
  delivery?: string;
  constructionProgress?: number;
};

function usePromoCatalog() {
  return useMemo(() => {
    const m = new Map<string, PromoEntry>();
    for (const p of developerOnlyPromotions) {
      m.set(p.id, {
        id: p.id,
        name: p.name,
        active: p.status === "active",
        status: p.status as PromoStatus,
        location: p.location,
        commission: typeof p.commission === "number" && p.commission > 0 ? p.commission : undefined,
        image: p.image,
        ownerRole: p.ownerRole,
        availableUnits: p.availableUnits,
        totalUnits: p.totalUnits,
        priceMin: p.priceMin,
        priceMax: p.priceMax,
        delivery: p.delivery,
        constructionProgress: p.constructionProgress,
      });
    }
    for (const p of promotions) {
      if (m.has(p.id)) continue;
      m.set(p.id, {
        id: p.id, name: p.name, active: true, status: "active",
        location: p.location,
        commission: typeof p.commission === "number" && p.commission > 0 ? p.commission : undefined,
        image: p.image,
        ownerRole: p.ownerRole,
        availableUnits: p.availableUnits,
        totalUnits: p.totalUnits,
        priceMin: p.priceMin,
        priceMax: p.priceMax,
        delivery: p.delivery,
        constructionProgress: p.constructionProgress,
      });
    }
    return m;
  }, []);
}

/** "€344k", "€1.4M" — compacto para chips dentro de cards. */
function fmtPriceCompact(value?: number): string {
  if (!value || !Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `€${m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (value >= 1_000) return `€${Math.round(value / 1_000)}k`;
  return `€${Math.round(value)}`;
}

function fmtPriceRange(min?: number, max?: number): string {
  const a = fmtPriceCompact(min);
  const b = fmtPriceCompact(max);
  if (a === "—" && b === "—") return "—";
  if (a === b) return a;
  return `${a} – ${b}`;
}

/** "27 abr 2026, 20:48" — usado en el chip "Colaboración solicitada". */
function fmtRequestedAt(ms: number): string {
  return new Date(ms).toLocaleString("es-ES", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

/** Iniciales del nombre · "Laura Sánchez" → "LS". */
function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

/** Avatar circular del usuario que envió la solicitud · 16px, fallback
 *  a iniciales con bg muted. Inline en el chip "Colaboración solicitada". */
function RequestedByAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="h-4 w-4 rounded-full object-cover border border-border shrink-0"
      />
    );
  }
  return (
    <span className="h-4 w-4 rounded-full bg-muted text-[8.5px] font-semibold text-muted-foreground grid place-items-center shrink-0">
      {initials(name) || "?"}
    </span>
  );
}

const STATUS_LABEL: Record<PromoStatus, string> = {
  active:     "Activa",
  incomplete: "Incompleta",
  inactive:   "Inactiva",
  "sold-out": "Agotada",
};

interface Props {
  agency: Agency;
  fromPromoId?: string;
  onGoTo: (tab: "documentacion" | "pagos" | "historial") => void;
  /** Cuando se monta este tab desde el lado AGENCIA (panel del
   *  promotor en `/promotor/:id/panel`), forzamos read-only · la
   *  agencia no puede subir contratos · esos flujos los inicia el
   *  promotor o comercializador y la agencia firma desde el email
   *  de Firmafy. */
  readOnly?: boolean;
}

export function ResumenTab({ agency: a, onGoTo, readOnly = false }: Props) {
  const user = useCurrentUser();
  const actor = { name: user.name, email: user.email };
  const contracts = useContractsForAgency(a.id);
  const docRequests = useAgencyDocRequests(a.id);
  const promoCatalog = usePromoCatalog();

  /* ─── Flujo de subida de contrato ·
     Picker de scope → choice (firmar vs archivar) → upload dialog ─── */
  const [scopePickerOpen, setScopePickerOpen] = useState(false);
  const [scopePreselect, setScopePreselect] = useState<string[] | undefined>(undefined);
  const [resolvedScope, setResolvedScope] = useState<string[] | undefined>(undefined);
  const [newChoiceOpen, setNewChoiceOpen] = useState(false);
  const [uploadContractOpen, setUploadContractOpen] = useState(false);
  const [signedUploadOpen, setSignedUploadOpen] = useState(false);

  /* ─── Renovación · IDs de contratos a sustituir cuando el usuario
     elige "Renovar contrato" desde el menú · se propaga a los upload
     dialogs como `defaultReplacesContractIds`. Al subir el nuevo, los
     antiguos se archivan auto con cross-ref vía `uploadContract`. ─── */
  const [renewalReplaceIds, setRenewalReplaceIds] = useState<string[] | undefined>(undefined);

  /* Estado de colaboración por (agency, promo). `pausada` o
     `anulada` se persiste en localStorage; `activa` es el default. */
  const collabStatusMap = usePromoCollabStatusMap(a.id);
  const confirm = useConfirm();

  /* Dialog para compartir una promoción concreta con esta agencia.
     Arranca en el paso de condiciones con la comisión prefill. */
  const [sharePromo, setSharePromo] = useState<{ id: string; name: string } | null>(null);

  /* Dialog para SOLICITAR colaboración (lado agencia · readOnly). El
     promo completo se pasa al modal para mostrar el resumen visual. */
  const [requestPromo, setRequestPromo] = useState<PromoEntry | null>(null);

  /* Solicitudes "vivas" (pendiente O rechazada) de esta agencia. La
     agencia NO ve la diferencia entre "pendiente" y "rechazada" — el
     descarte del promotor es silencioso. Solo desaparece el chip si:
       a) La solicitud se aceptó (la promo pasa a Bloque 1).
       b) El promotor envía una invitación a esa agencia/promo
          (`acceptInvitationOverride` flipa el status a aceptada). */
  const pendientes = useAllSolicitudes().filter(
    (s) => s.agencyId === a.id && (s.status === "pendiente" || s.status === "rechazada"),
  );

  /* Backfill defensivo · solicitudes creadas antes de que existiera
     el campo `requestedBy` se quedaron sin actor. Si el usuario
     actual es de esta agencia (readOnly), rellenamos esas filas
     antiguas con sus datos · es la única inferencia razonable. */
  useEffect(() => {
    if (!readOnly) return;
    if (user.accountType !== "agency" || user.agencyId !== a.id) return;
    backfillRequestedBy(a.id, { name: user.name, email: user.email, avatarUrl: user.avatar });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, a.id, user.accountType, user.agencyId]);

  const openScopePicker = (preselect?: string[]) => {
    setScopePreselect(preselect);
    setScopePickerOpen(true);
  };

  /* ─── Acciones del menú "3 puntos" por promo (solo lado quien
       comparte: promotor / comercializador / agencia que comparte). ─── */
  const findCoveringContractIds = useCallback((promoId: string): string[] => {
    return contracts
      .filter((c) => !c.archived && c.status === "signed")
      .filter((c) =>
        !c.scopePromotionIds
        || c.scopePromotionIds.length === 0
        || c.scopePromotionIds.includes(promoId),
      )
      .map((c) => c.id);
  }, [contracts]);

  const handleRenovar = (p: PromoEntry) => {
    const ids = findCoveringContractIds(p.id);
    setRenewalReplaceIds(ids.length > 0 ? ids : undefined);
    setScopePreselect([p.id]);
    setScopePickerOpen(true);
  };

  const handlePausar = async (p: PromoEntry) => {
    const ok = await confirm({
      title: `¿Pausar colaboración en "${p.name}"?`,
      description:
        `Mientras esté pausada, ${a.name} no podrá registrar nuevos clientes ni compartir esta promoción. ` +
        `Las ventas, registros, visitas y comisiones existentes se MANTIENEN intactas. ` +
        `Puedes reanudarla cuando quieras.`,
      confirmLabel: "Pausar colaboración",
    });
    if (!ok) return;
    setPromoCollabStatus(a.id, p.id, "pausada", actor);
    recordCollaborationPaused(a.id, actor, `Promoción "${p.name}"`);
    toast.success(`Colaboración pausada en "${p.name}"`);
  };

  const handleReanudar = (p: PromoEntry) => {
    setPromoCollabStatus(a.id, p.id, "activa", actor);
    recordCollaborationResumed(a.id, actor);
    toast.success(`Colaboración reanudada en "${p.name}"`);
  };

  const handleAnular = async (p: PromoEntry) => {
    const ok = await confirm({
      title: `¿Anular colaboración en "${p.name}"?`,
      description:
        `${a.name} dejará de ver esta promoción y no podrá registrar nuevos clientes ni ` +
        `programar visitas a través de Byvaro. Las ventas cerradas, registros aprobados, ` +
        `visitas realizadas y comisiones devengadas hasta ahora se MANTIENEN intactas y ` +
        `siguen contando en estadísticas e historial. Solo se cierra la puerta a actividad nueva.`,
      confirmLabel: "Anular colaboración",
      variant: "destructive",
    });
    if (!ok) return;
    setPromoCollabStatus(a.id, p.id, "anulada", actor);
    recordCompanyAny(
      a.id,
      "collaboration_ended",
      `Colaboración anulada en "${p.name}"`,
      "Datos históricos preservados (ventas / registros / visitas / comisiones).",
      actor,
    );
    toast.success(`Colaboración anulada en "${p.name}"`);
  };

  /* Solo contamos como "compartibles" las promos publicadas Y donde
     el promotor no desactivó la compartición. Alineado con
     `ShareMultiPromosDialog` y la regla "no invitar a algo que no
     está listo". */
  const activePromos = useMemo(
    () => developerOnlyPromotions.filter(
      (p) => p.status === "active" && p.canShareWithAgencies !== false,
    ),
    [],
  );
  const sharedPromos = useMemo(() => {
    return (a.promotionsCollaborating ?? [])
      .map((id) => promoCatalog.get(id))
      .filter(Boolean) as PromoEntry[];
  }, [a.promotionsCollaborating, promoCatalog]);
  /* Solo contamos las compartidas que además siguen activas · así el
     hero "N de M activas" no queda descuadrado si hay colaboraciones
     heredadas de promociones cerradas. */
  const sharedActiveCount = useMemo(
    () => sharedPromos.filter((p) => p.active).length,
    [sharedPromos],
  );
  /* Invitaciones · cruzamos por agencyId o email · solo pendientes
     (no aceptadas y no rechazadas/caducadas). Mapeamos a una lookup
     `promoId → Invitacion` para anotar las cards de promociones. */
  const allInvitations = useInvitacionesForAgency(a.id, a.contactoPrincipal?.email);
  const invitationByPromoId = useMemo(() => {
    const m = new Map<string, { createdAt: number; estado: "pendiente" | "aceptada" | "rechazada" | "caducada" }>();
    for (const i of allInvitations) {
      if (!i.promocionId) continue;
      /* Si hay varias, quedate con la más reciente. */
      const prev = m.get(i.promocionId);
      if (!prev || i.createdAt > prev.createdAt) {
        m.set(i.promocionId, { createdAt: i.createdAt, estado: i.estado });
      }
    }
    return m;
  }, [allInvitations]);

  /* Una promo está "invitada" si hay una invitación PENDIENTE para ella
     y la agencia aún no la tiene en `promotionsCollaborating`. */
  const invitedPromoIds = useMemo(() => {
    const shared = new Set(a.promotionsCollaborating ?? []);
    const ids = new Set<string>();
    for (const [promoId, inv] of invitationByPromoId) {
      if (inv.estado === "pendiente" && !shared.has(promoId)) ids.add(promoId);
    }
    return ids;
  }, [invitationByPromoId, a.promotionsCollaborating]);

  /* Bloque 2 lista las activas SIN compartir y SIN invitación
     pendiente · las invitadas suben al Bloque 1. Las que tienen
     solicitud pendiente (lado agencia) SE MANTIENEN aquí · solo
     cambia el CTA por un chip "Colaboración solicitada · fecha · usuario". */
  const notSharedPromos = useMemo(
    () => activePromos.filter((pr) =>
      !(a.promotionsCollaborating ?? []).includes(pr.id)
      && !invitedPromoIds.has(pr.id),
    ),
    [activePromos, a.promotionsCollaborating, invitedPromoIds],
  );

  /* Promos invitadas · activas, con invitación pendiente, no compartidas.
     Se renderizan en Bloque 1 con chip "Invitado · fecha". */
  const invitedPromos = useMemo(() => {
    return activePromos
      .filter((pr) => invitedPromoIds.has(pr.id))
      .map((pr) => ({ ...pr, invitedAt: invitationByPromoId.get(pr.id)?.createdAt ?? 0 }));
  }, [activePromos, invitedPromoIds, invitationByPromoId]);

  const pendingContracts = useMemo(
    () => contracts.filter((c) => !c.archived && (c.status === "draft" || c.status === "sent" || c.status === "viewed")),
    [contracts],
  );

  /* Contratos enviados a firmar (sent/viewed) · vivos para la AGENCIA
     porque en algún momento debe firmarlos. Cuando readOnly mostramos
     banner de "te toca firmar" + chip por promoción. */
  const sentContracts = useMemo(
    () => contracts.filter((c) => !c.archived && (c.status === "sent" || c.status === "viewed")),
    [contracts],
  );
  /* Map promoId → contrato sent/viewed que la cubre · usado para
     pintar chip "Pendiente de firma" en la card del lado agencia. */
  const pendingSignByPromoId = useMemo(() => {
    const m = new Map<string, typeof sentContracts[number]>();
    for (const c of sentContracts) {
      const ids = c.scopePromotionIds && c.scopePromotionIds.length > 0
        ? c.scopePromotionIds
        : sharedPromos.map((p) => p.id); // blanket
      for (const pid of ids) {
        const prev = m.get(pid);
        /* Si hay varios pendientes que cubren la misma promo, quedate
           con el más reciente · es el que el promotor habrá enviado. */
        if (!prev || c.createdAt > prev.createdAt) m.set(pid, c);
      }
    }
    return m;
  }, [sentContracts, sharedPromos]);

  /* Dialog de firma · para la agencia. */
  const [signContract, setSignContract] = useState<typeof sentContracts[number] | null>(null);
  const pendingDocs = useMemo(
    () => docRequests.filter((d) => d.status === "pending" || d.status === "uploaded"),
    [docRequests],
  );

  /* Cobertura contractual · una promoción está "cubierta" si existe un
     contrato firmado, no archivado y no expirado/revocado, cuyo `scopePromotionIds`
     la incluye (o es vacío = cubre todo). El resto son promociones SIN CONTRATO ·
     trabajar sin marco legal es la incidencia real.
     Además computamos qué promos están "por expirar" (el contrato más
     lejano que las cubre vence en ≤ CONTRACT_NEAR_EXPIRY_DAYS=60 días).
     Fuente única de verdad del umbral: `collaborationContracts.ts`. */
  const { uncoveredPromos, hasBlanketSigned, expiringByPromoId } = useMemo(() => {
    const signed = contracts.filter((c) => !c.archived && c.status === "signed");
    const blanket = signed.some((c) => !c.scopePromotionIds || c.scopePromotionIds.length === 0);
    const coveredIds = new Set<string>();
    if (!blanket) {
      for (const c of signed) for (const id of c.scopePromotionIds ?? []) coveredIds.add(id);
    }
    const uncovered = blanket
      ? []
      : sharedPromos.filter((p) => p.active && !coveredIds.has(p.id));

    /* Para cada promo cubierta, calculamos el `daysLeft` MÁXIMO entre
       todos los contratos firmados que la cubren · si alguno es
       indefinido (sin expiresAt) la promo NUNCA está por vencer.
       Una promo está "por expirar" si daysLeft ∈ [0, 60]. */
    const expiring = new Map<string, number>();
    const allCovered = blanket
      ? sharedPromos.filter((p) => p.active)
      : sharedPromos.filter((p) => p.active && coveredIds.has(p.id));
    for (const p of allCovered) {
      const covers = blanket
        ? signed
        : signed.filter((c) => !c.scopePromotionIds || c.scopePromotionIds.length === 0 || c.scopePromotionIds.includes(p.id));
      const someInfinite = covers.some((c) => !c.expiresAt);
      if (someInfinite) continue;
      const days = covers
        .map((c) => daysUntilContractExpiry(c))
        .filter((d): d is number => d !== null);
      if (days.length === 0) continue;
      const maxDays = Math.max(...days);
      if (maxDays >= 0 && maxDays <= CONTRACT_NEAR_EXPIRY_DAYS) {
        expiring.set(p.id, maxDays);
      }
    }

    return { uncoveredPromos: uncovered, hasBlanketSigned: blanket, expiringByPromoId: expiring };
  }, [contracts, sharedPromos]);

  /* Mock determinista · visits + registros + ventas por (agencyId,
     promoId). Evita números uniformes en todas las cards y mantiene
     consistencia entre renders. Backend real:
       GET /api/agencias/:id/stats-by-promotion */
  const metricsFor = useCallback((promoId: string, hasShared: boolean):
    { visits: number; registros: number; ventas: number } => {
    if (!hasShared) return { visits: 0, registros: 0, ventas: 0 };
    const key = `${a.id}-${promoId}`;
    let seed = 0;
    for (let i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) >>> 0;
    const visits    = (seed % 18) + 2;
    const registros = Math.min(visits, ((seed >> 3) % 13) + 1);
    const ventas    = Math.min(registros, ((seed >> 6) % 5));
    return { visits, registros, ventas };
  }, [a.id]);

  /* "En curso" = trámites normales (contratos + docs a entregar). No
     son incidencias · son trabajo-en-vuelo que avanza solo. */
  const inFlightCount = pendingContracts.length + pendingDocs.length;
  /* Total accionable que se muestra en el hero · incluye incidencias
     reales (promos sin contrato), trámites en curso y oportunidades
     de compartir. */
  const pendingCount = inFlightCount + notSharedPromos.length + uncoveredPromos.length;

  /* ════════════════════════════════════════════════════════════════ */

  /* Tono del estado · `warning` si hay algo que arreglar (sin
     contrato), `primary` si todo lo compartido está cubierto pero
     hay trámites en curso O quedan promociones por compartir,
     `success` solo cuando TODO cuadra. */
  const headerTone: "warning" | "primary" | "success" =
    uncoveredPromos.length > 0
      ? "warning"
      : (inFlightCount > 0 || notSharedPromos.length > 0)
        ? "primary"
        : "success";
  const headerDotCls = {
    warning: "bg-warning",
    primary: "bg-primary",
    success: "bg-success",
  }[headerTone];

  /* Texto de la línea secundaria del hero · una sola intención
     visible (lo más urgente). Manteniendo la lógica de prioridad
     existente · no cambia funcionalidad. */
  const heroNote =
    uncoveredPromos.length > 0
      ? `${uncoveredPromos.length} sin contrato`
      : inFlightCount > 0
        ? `${inFlightCount} ${inFlightCount === 1 ? "trámite en curso" : "trámites en curso"}`
        : notSharedPromos.length > 0
          ? `${notSharedPromos.length} sin compartir aún`
          : sharedActiveCount > 0
            ? "todo al día"
            : null;
  const heroNoteCls = {
    warning: "text-warning",
    primary: "text-muted-foreground",
    success: "text-success",
  }[headerTone];

  return (
    <div className="space-y-10">

      {/* ═══════════════ Cabecera unificada · estado + bloque 1 ═══════════════ */}
      <section>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80 mb-2">
          Estado de la colaboración
        </p>
        <div className="flex items-baseline gap-2 flex-wrap">
          <h2 className="text-[20px] sm:text-[24px] font-semibold tracking-tight text-foreground leading-none tabular-nums">
            {sharedActiveCount}
            <span className="text-muted-foreground/50"> / </span>
            {activePromos.length}
          </h2>
          <p className="text-[13px] text-muted-foreground">
            {activePromos.length === 1 ? "promoción compartida" : "promociones compartidas"}
          </p>
          {heroNote && (
            <p className={cn("text-[13px] ml-auto inline-flex items-center gap-1.5", heroNoteCls)}>
              <span className={cn("h-1.5 w-1.5 rounded-full", headerDotCls)} />
              {heroNote}
            </p>
          )}
        </div>
        <div className="mt-6">

        {sharedPromos.length === 0 && invitedPromos.length === 0 ? (
          <EmptyCard
            icon={Share2}
            title="No colabora en ninguna promoción todavía"
            body="Cuando compartas una promoción con esta agencia aparecerá aquí."
          />
        ) : (
          <>
            {/* Grid de promociones INVITADAS (pendientes de aceptar) ·
                suben arriba porque son lo más accionable en ese momento. */}
            {invitedPromos.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                {invitedPromos.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-border bg-card overflow-hidden transition-all"
                  >
                    {/* Cover */}
                    <div className="relative aspect-[16/8] bg-muted overflow-hidden">
                      {p.image ? (
                        <img src={p.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 grid place-items-center bg-muted/60">
                          <Home className="h-6 w-6 text-muted-foreground/50" strokeWidth={1.25} />
                        </div>
                      )}
                      <span className="absolute top-2 left-2 inline-flex items-center gap-1 h-5 px-2 rounded-full bg-background/85 text-primary text-[10px] font-medium backdrop-blur-md">
                        <Send className="h-2.5 w-2.5" strokeWidth={2.25} />
                        Invitado · {formatInvitedAt(p.invitedAt)}
                      </span>
                    </div>
                    <div className="p-4">
                      <Link to={`/promociones/${p.code || p.id}`} className="block group">
                        <p className="text-sm font-semibold text-foreground truncate group-hover:underline">
                          {p.name}
                        </p>
                      </Link>
                      <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center h-5 px-2 rounded-full bg-muted/60 text-[10.5px] font-medium text-foreground tabular-nums">
                          Comisión {typeof p.commission === "number" && p.commission > 0 ? p.commission : 5}%
                        </span>
                        {p.location && (
                          <span className="text-[10.5px] text-muted-foreground truncate">
                            {p.location}
                          </span>
                        )}
                      </div>
                      <p className="text-[10.5px] text-muted-foreground mt-2 italic">
                        Esperando a que {a.name.split(" ")[0]} acepte la invitación.
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ✍️ Lado AGENCIA · contratos enviados a firmar pendientes.
                Es lo MÁS accionable que tiene · va arriba del banner
                amarillo de "sin contrato". El email/SMS de Firmafy es
                el canal principal · este banner es un recordatorio en
                Byvaro para no perderlo. */}
            {readOnly && sentContracts.length > 0 && (
              <button
                type="button"
                onClick={() => setSignContract(sentContracts[0])}
                className="w-full flex items-start gap-2.5 rounded-xl border border-primary/25 bg-primary/[0.05] hover:bg-primary/[0.08] px-3.5 py-2.5 mb-3 transition-colors text-left"
              >
                <FileSignature className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" strokeWidth={2} />
                <p className="text-[12px] text-foreground flex-1 min-w-0 leading-relaxed">
                  <span className="font-medium">
                    {sentContracts.length === 1
                      ? "Tienes 1 contrato pendiente de firmar"
                      : `Tienes ${sentContracts.length} contratos pendientes de firmar`}
                  </span>
                  <span className="text-muted-foreground">
                    {" · "}revisa tu email y SMS de Firmafy o ábrelo desde aquí.
                  </span>
                </p>
                <span className="text-[11.5px] font-medium text-primary inline-flex items-center gap-1 shrink-0 mt-0.5">
                  Ver y firmar
                  <ArrowRight className="h-3 w-3" strokeWidth={2} />
                </span>
              </button>
            )}

            {/* ⚠ Incidencia real · promociones sin contrato que cubra.
                Cuando se monta read-only desde el lado AGENCIA mostramos
                una nota pasiva (no botón) explicando que el contrato lo
                tiene que iniciar el promotor o comercializador.
                IMPORTANTE: las promos con contrato pendiente de firma
                NO entran aquí · ya tienen el banner "Tienes contrato
                pendiente de firmar" arriba y chip propio en la card. */}
            {(() => {
              const trulyUncovered = readOnly
                ? uncoveredPromos.filter((p) => !pendingSignByPromoId.has(p.id))
                : uncoveredPromos;
              if (trulyUncovered.length === 0) return null;
              return (
              readOnly ? (
                (() => {
                  /* Resolución dinámica del rol del owner · puede haber
                     mezcla (algunas promos las lleva el promotor, otras
                     el comercializador). Ver REGLA DE ORO "Promotor vs
                     Comercializador · label dinámico". */
                  const roles = new Set(trulyUncovered.map((p) => p.ownerRole ?? "promotor"));
                  const ownerText = roles.size > 1
                    ? "el promotor o comercializador"
                    : roles.has("comercializador")
                      ? "el comercializador"
                      : "el promotor";
                  return (
                    <div className="w-full flex items-start gap-2.5 rounded-xl border border-warning/25 bg-warning/[0.04] px-3.5 py-2.5 mb-3">
                      <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" strokeWidth={2} />
                      <p className="text-[12px] text-foreground flex-1 min-w-0 leading-relaxed">
                        <span className="font-medium">
                          {trulyUncovered.length} sin contrato firmado
                        </span>
                        <span className="text-muted-foreground">
                          {" · "}{ownerText} de la promoción es quien lo
                          inicia · te llegará a firmar cuando esté listo.
                        </span>
                      </p>
                    </div>
                  );
                })()
              ) : (
                <button
                  type="button"
                  onClick={() => openScopePicker(uncoveredPromos.map((u) => u.id))}
                  className="w-full flex items-center gap-2.5 rounded-xl border border-warning/25 bg-warning/[0.04] hover:bg-warning/[0.08] px-3.5 py-2.5 mb-3 transition-colors text-left"
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" strokeWidth={2} />
                  <p className="text-[12px] text-foreground flex-1 min-w-0 truncate">
                    <span className="font-medium">
                      {uncoveredPromos.length} sin contrato firmado
                    </span>
                    <span className="text-muted-foreground"> · trabajáis sin marco legal</span>
                  </p>
                  <span className="text-[11.5px] font-medium text-foreground inline-flex items-center gap-1 shrink-0">
                    Subir contrato
                    <ArrowRight className="h-3 w-3" strokeWidth={2} />
                  </span>
                </button>
              )
              );
            })()}

            {/* Activas · una card por cada una con estado de cobertura.
                Las `incomplete`/`inactive`/`sold-out` se ocultan del
                panel · no aportan información operativa. */}
            {(() => {
              /* Excluimos las anuladas · siguen vivas en la BD pero
                 ya no operan, así que no las pintamos en el panel. */
              const activeShared = sharedPromos.filter(
                (p) => p.active
                  && getPromoCollabStatusFromMap(collabStatusMap, a.id, p.id) !== "anulada",
              );
              if (activeShared.length === 0) return null;
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {activeShared.map((p) => {
                    const isUncovered = !hasBlanketSigned && uncoveredPromos.some((u) => u.id === p.id);
                    const expiringDays = expiringByPromoId.get(p.id);
                    const isExpiringSoon = !isUncovered && typeof expiringDays === "number";
                    const promoStatus = getPromoCollabStatusFromMap(collabStatusMap, a.id, p.id);
                    const isPaused = promoStatus === "pausada";
                    const hasCoveringContract = !isUncovered;
                    /* Lado AGENCIA · si la promo está cubierta por un
                       contrato sent/viewed (no firmado todavía), el chip
                       cambia a "Pendiente de firma" · click → abre el
                       dialog para firmar en Firmafy. Tiene prioridad
                       sobre "Sin contrato" porque ya hay algo en marcha. */
                    const pendingSign = readOnly ? pendingSignByPromoId.get(p.id) : undefined;
                    return (
                      <div
                        key={p.id}
                        className="rounded-2xl border border-border bg-card overflow-hidden transition-all"
                      >
                        {/* Cover con imagen + menú de acciones (3 puntos)
                            arriba a la derecha · solo lo ve quien
                            comparte (`!readOnly`). */}
                        <div className="relative aspect-[16/8] bg-muted overflow-hidden">
                          {p.image ? (
                            <img src={p.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
                          ) : (
                            <div className="absolute inset-0 grid place-items-center bg-muted/60">
                              <Home className="h-6 w-6 text-muted-foreground/50" strokeWidth={1.25} />
                            </div>
                          )}
                          {!readOnly && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  aria-label="Acciones de la colaboración"
                                  className="absolute top-2 right-2 inline-flex items-center justify-center h-7 w-7 rounded-full bg-background/90 backdrop-blur-md text-foreground hover:bg-background transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreVertical className="h-3.5 w-3.5" strokeWidth={2} />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" sideOffset={6} className="w-56">
                                {hasCoveringContract ? (
                                  <DropdownMenuItem onSelect={() => handleRenovar(p)}>
                                    <RefreshCcw className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
                                    Renovar contrato
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onSelect={() => {
                                    setRenewalReplaceIds(undefined);
                                    setScopePreselect([p.id]);
                                    setScopePickerOpen(true);
                                  }}>
                                    <Upload className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
                                    Subir contrato
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                {isPaused ? (
                                  <DropdownMenuItem onSelect={() => handleReanudar(p)}>
                                    <PlayCircle className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
                                    Reanudar colaboración
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem onSelect={() => handlePausar(p)}>
                                    <PauseCircle className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
                                    Pausar colaboración
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onSelect={() => handleAnular(p)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Ban className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
                                  Anular colaboración
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>

                        <div className="p-4">
                          <Link
                            to={`/promociones/${p.code || p.id}?tab=Agencies`}
                            className="block group"
                          >
                            <p className="text-sm font-semibold text-foreground truncate group-hover:underline">
                              {p.name}
                            </p>
                          </Link>
                          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                            {typeof p.commission === "number" && (
                              <span className="inline-flex items-center h-5 px-2 rounded-full bg-muted/60 text-[10.5px] font-medium text-foreground tabular-nums">
                                Comisión {p.commission}%
                              </span>
                            )}
                            {p.location && (
                              <span className="text-[10.5px] text-muted-foreground truncate">
                                {p.location}
                              </span>
                            )}
                            {isPaused ? (
                              <span className="ml-auto inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-medium shrink-0 bg-muted text-muted-foreground">
                                <PauseCircle className="h-2.5 w-2.5" strokeWidth={2.25} />
                                Pausada
                              </span>
                            ) : pendingSign ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setSignContract(pendingSign);
                                }}
                                className="ml-auto inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-medium shrink-0 bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
                              >
                                <FileSignature className="h-2.5 w-2.5" strokeWidth={2.25} />
                                Pendiente de firma
                              </button>
                            ) : (
                              <span className={cn(
                                "ml-auto inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10px] font-medium shrink-0",
                                isUncovered || isExpiringSoon
                                  ? "bg-warning/10 text-warning"
                                  : "bg-success/10 text-success",
                              )}>
                                {isUncovered ? (
                                  <><AlertTriangle className="h-2.5 w-2.5" strokeWidth={2.25} />Sin contrato</>
                                ) : isExpiringSoon ? (
                                  <><Clock className="h-2.5 w-2.5" strokeWidth={2.25} />Vence en {expiringDays}d</>
                                ) : (
                                  <><Check className="h-2.5 w-2.5" strokeWidth={2.25} />Contrato vigente</>
                                )}
                              </span>
                            )}
                          </div>
                          {readOnly ? (
                            /* Vista AGENCIA · datos comerciales para
                             *  decidir qué empujar al cliente: cuánto
                             *  queda, rango de precio, cuándo se
                             *  entrega y % de obra. NO mostramos el
                             *  rendimiento histórico (visitas/ventas)
                             *  que es métrica del promotor. */
                            <div className="mt-3 grid grid-cols-2 gap-y-2 border-t border-border/60 pt-3">
                              <MetricStat
                                label="Disponibles"
                                value={
                                  typeof p.availableUnits === "number" && typeof p.totalUnits === "number"
                                    ? `${p.availableUnits}/${p.totalUnits}`
                                    : "—"
                                }
                              />
                              <MetricStat label="Precio" value={fmtPriceRange(p.priceMin, p.priceMax)} />
                              <MetricStat label="Entrega" value={p.delivery || "—"} />
                              <MetricStat
                                label="Obra"
                                value={typeof p.constructionProgress === "number" ? `${p.constructionProgress}%` : "—"}
                              />
                            </div>
                          ) : (
                            (() => {
                              const m = metricsFor(p.id, true);
                              const conversion = m.visits > 0
                                ? Math.round((m.ventas / m.visits) * 100)
                                : 0;
                              return (
                                <div className="mt-3 grid grid-cols-4 gap-x-2 border-t border-border/60 pt-3">
                                  <MetricStat label="Visitas"    value={m.visits} />
                                  <MetricStat label="Registros"  value={m.registros} />
                                  <MetricStat label="Ventas"     value={m.ventas} />
                                  <MetricStat label="Conversión" value={`${conversion}%`} />
                                </div>
                              );
                            })()
                          )}
                          <div className="mt-3 flex items-center justify-end">
                            <Link
                              to={`/promociones/${p.code || p.id}?tab=Agencies`}
                              className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                            >
                              Ver en promoción
                              <ArrowRight className="h-3 w-3" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Trámites realmente en curso · solo se muestran tiles
                cuando hay algo que mover · los "✓ al día" sobraban y
                contradecían al banner de "sin contrato" de arriba. */}
            {(pendingContracts.length > 0 || pendingDocs.length > 0) && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {pendingContracts.length > 0 && (
                  <StatusTile
                    icon={FileSignature}
                    value={pendingContracts.length}
                    label={pendingContracts.length === 1 ? "contrato en proceso de firma" : "contratos en proceso de firma"}
                    doneLabel=""
                    tone="in-progress"
                    onClick={() => onGoTo("documentacion")}
                  />
                )}
                {pendingDocs.length > 0 && (
                  <StatusTile
                    icon={Upload}
                    value={pendingDocs.length}
                    label={pendingDocs.length === 1 ? "documento por entregar" : "documentos por entregar"}
                    doneLabel=""
                    tone="in-progress"
                    onClick={() => onGoTo("documentacion")}
                  />
                )}
              </div>
            )}
          </>
        )}
        </div>
      </section>

      {/* ═══════════════════ BLOQUE 2 · Promociones disponibles ═══════════════════
          Promotor ve "Aún sin compartir" + acción "Compartir con X".
          Agencia ve "Promociones publicadas" + acción "Solicitar colaboración". */}
      {notSharedPromos.length > 0 && (
        <section>
          <BlockHeader
            title={readOnly ? "Promociones que aún no colaboras" : "Aún sin compartir"}
            subtitle={
              readOnly
                ? `${notSharedPromos.length} ${notSharedPromos.length === 1 ? "promoción activa" : "promociones activas"} del promotor`
                : `${notSharedPromos.length} ${notSharedPromos.length === 1 ? "promoción activa" : "promociones activas"} donde podrías invitar a ${a.name}`
            }
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {notSharedPromos.map((p) => {
              /* En modo agencia · si ya envió solicitud para esta promo,
                 cambiamos el CTA por un chip pasivo con fecha + usuario.
                 Sin solicitud todavía → CTA activo "Solicitar colaboración". */
              const solicitud = readOnly ? findSolicitudVivaParaAgencia(a.id, p.id, pendientes) : undefined;
              const requested = !!solicitud;
              const cardCommon = "group text-left rounded-2xl border bg-card/40 overflow-hidden transition-all";
              const cardClass = requested
                ? `${cardCommon} border-border cursor-default`
                : `${cardCommon} border-border/60 hover:bg-card hover:border-border`;
              return (
              <button
                type="button"
                key={p.id}
                onClick={() => {
                  if (requested) return; // chip estático · no reenviar
                  if (readOnly) setRequestPromo(p);
                  else setSharePromo({ id: p.id, name: p.name });
                }}
                className={cardClass}
              >
                {/* Cover con imagen de la promoción · color completo */}
                <div className="relative aspect-[16/8] bg-muted overflow-hidden">
                  {p.image ? (
                    <img
                      src={p.image}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center bg-muted/60">
                      <Home className="h-6 w-6 text-muted-foreground/50" strokeWidth={1.25} />
                    </div>
                  )}
                  {requested && (
                    <span className="absolute top-2 left-2 inline-flex items-center h-5 px-2 rounded-full bg-background/85 backdrop-blur-md text-[10px] font-medium text-primary">
                      Solicitada
                    </span>
                  )}
                </div>

                <div className="p-4">
                  <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{p.location ?? "—"}</p>
                  {readOnly ? (
                    <div className="mt-3 grid grid-cols-2 gap-y-2 border-t border-border/60 pt-3">
                      <MetricStat
                        label="Disponibles"
                        value={
                          typeof p.availableUnits === "number" && typeof p.totalUnits === "number"
                            ? `${p.availableUnits}/${p.totalUnits}`
                            : "—"
                        }
                      />
                      <MetricStat label="Precio" value={fmtPriceRange(p.priceMin, p.priceMax)} />
                      <MetricStat label="Entrega" value={p.delivery || "—"} />
                      <MetricStat
                        label="Obra"
                        value={typeof p.constructionProgress === "number" ? `${p.constructionProgress}%` : "—"}
                      />
                    </div>
                  ) : null}
                  {/* Footer · CTA activo o chip pasivo "Colaboración solicitada". */}
                  {requested ? (
                    <div className="mt-3 border-t border-border/60 pt-2.5">
                      <p className="text-[11px] font-medium text-primary inline-flex items-center gap-1">
                        <Send className="h-3 w-3" strokeWidth={2.25} /> Colaboración solicitada
                      </p>
                      <div className="mt-1 flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                        <span className="tabular-nums">{fmtRequestedAt(solicitud!.createdAt)}</span>
                        {solicitud!.requestedBy?.name && (
                          <>
                            <span aria-hidden>·</span>
                            <RequestedByAvatar
                              name={solicitud!.requestedBy.name}
                              avatarUrl={solicitud!.requestedBy.avatarUrl}
                            />
                            <span className="text-foreground/80 truncate">{solicitud!.requestedBy.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 inline-flex items-center gap-1 text-[11px] text-foreground font-medium group-hover:gap-1.5 transition-all">
                      {readOnly ? (
                        <><Send className="h-3 w-3" strokeWidth={2.25} /> Solicitar colaboración</>
                      ) : (
                        <><Plus className="h-3 w-3" strokeWidth={2.25} /> Compartir con {a.name.split(" ")[0]}</>
                      )}
                    </div>
                  )}
                </div>
              </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Estadísticas movidas a su propia tab "Estadísticas" en ambos
          paneles (promotor y agencia). No duplicar aquí. */}

      {/* ═══ Ver actividad ═══
          Atajo a la tab Historial (timeline cross-empresa). Solo en
          modo PROMOTOR · en agencia el Historial es admin-only y se
          accede directamente desde la tab bar (no necesita atajo). */}
      {!readOnly && (
        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={() => onGoTo("historial")}
            className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
            Ver toda la actividad
          </button>
        </div>
      )}

      {/* ══════ Flujo Subir contrato · picker → choice → upload ══════ */}
      <ContractScopePickerDialog
        open={scopePickerOpen}
        onOpenChange={setScopePickerOpen}
        agencyName={a.name}
        promos={sharedPromos
          .filter((p) => p.active)
          .map((p) => ({ id: p.id, name: p.name, location: p.location, comision: p.commission }))}
        defaultSelectedIds={scopePreselect}
        onContinue={(ids) => {
          setResolvedScope(ids);
          setScopePickerOpen(false);
          setNewChoiceOpen(true);
        }}
      />
      <ContractNewChoiceDialog
        open={newChoiceOpen}
        onOpenChange={setNewChoiceOpen}
        onPickSend={() => setUploadContractOpen(true)}
        onPickSigned={() => setSignedUploadOpen(true)}
      />
      <ContractUploadDialog
        open={uploadContractOpen}
        onOpenChange={(v) => {
          setUploadContractOpen(v);
          if (!v) setRenewalReplaceIds(undefined);
        }}
        agency={a}
        actor={actor}
        defaultScopePromotionIds={resolvedScope}
        defaultReplacesContractIds={renewalReplaceIds}
      />
      <ContractSignedUploadDialog
        open={signedUploadOpen}
        onOpenChange={(v) => {
          setSignedUploadOpen(v);
          if (!v) setRenewalReplaceIds(undefined);
        }}
        agency={a}
        actor={actor}
        defaultScopePromotionIds={resolvedScope}
        defaultReplacesContractIds={renewalReplaceIds}
      />

      {/* Dialog · compartir promoción con ESTA agencia · entra
          directamente al paso de condiciones (comisión + duración). */}
      {sharePromo && (
        <SharePromotionDialog
          open={!!sharePromo}
          onOpenChange={(v) => { if (!v) setSharePromo(null); }}
          promotionId={sharePromo.id}
          promotionName={sharePromo.name}
          defaultAgencyId={a.id}
        />
      )}

      {/* Modal · solicitar colaboración (lado AGENCIA, readOnly).
          Ver `RequestCollaborationDialog` · persiste en
          `byvaro.agency.collab-requests.v1` localStorage hasta backend. */}
      <RequestCollaborationDialog
        open={!!requestPromo}
        onOpenChange={(v) => { if (!v) setRequestPromo(null); }}
        agencyId={a.id}
        promo={requestPromo}
      />

      {/* Modal · firma del contrato (lado AGENCIA, readOnly). Abre
          `signUrl` de Firmafy en pestaña nueva. */}
      <AgencySignContractDialog
        open={!!signContract}
        onOpenChange={(v) => { if (!v) setSignContract(null); }}
        contract={signContract}
        currentUserEmail={user.email}
      />
    </div>
  );
}

/* ═══════════════ Sub-componentes ═══════════════ */

/** Estadísticas útiles de la agencia para el promotor · leídas del
 *  agregado `Agency` (backend: `GET /api/agencias/:id/summary`). */
function AgencyStats({ agency: a }: { agency: Agency }) {
  const visits   = a.visitsCount ?? 0;
  const ventas   = a.ventasCerradas ?? 0;
  const regs     = a.registrosAportados ?? a.registrations ?? 0;
  const volumen  = a.salesVolume ?? 0;
  const ticket   = a.ticketMedio ?? (ventas > 0 ? Math.round(volumen / ventas) : 0);
  const conv     = typeof a.conversionRate === "number"
    ? a.conversionRate
    : (regs > 0 ? Math.round((ventas / regs) * 100) : 0);
  const rating   = a.ratingPromotor ?? 0;

  const last = a.lastActivityAt ? relativeFromIso(a.lastActivityAt) : "—";

  const fmtEur = (n: number) => {
    if (!Number.isFinite(n) || n === 0) return "—";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")} M€`;
    if (n >= 1_000)     return `${Math.round(n / 1_000)} K€`;
    return `${n} €`;
  };

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Estadísticas
        </p>
        <p className="text-[11.5px] text-muted-foreground">
          · histórico acumulado con esta agencia
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Conversión registros → ventas" value={`${conv}%`}
          tone={conv >= 15 ? "success" : conv >= 8 ? "primary" : "muted"}
          hint={`${regs} registros · ${ventas} ventas`} />
        <StatCard label="Ticket medio" value={fmtEur(ticket)} tone="muted"
          hint={ventas > 0 ? `${ventas} ventas cerradas` : "aún sin ventas"} />
        <StatCard label="Volumen cerrado" value={fmtEur(volumen)}
          tone={volumen > 0 ? "success" : "muted"}
          hint={ventas > 0 ? `${ventas} operaciones` : "—"} />
        <StatCard label="Actividad" value={last}
          tone={isRecent(a.lastActivityAt) ? "success" : "muted"}
          hint={rating > 0 ? `Rating ${rating}/5 · ${visits} visitas` : `${visits} visitas totales`} />
      </div>
    </section>
  );
}

function StatCard({
  label, value, hint, tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: "success" | "primary" | "muted";
}) {
  const valueCls = {
    success: "text-success",
    primary: "text-primary",
    muted:   "text-foreground",
  }[tone];
  return (
    <div className="rounded-2xl border border-border bg-card shadow-soft p-3.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground truncate">
        {label}
      </p>
      <p className={cn("text-[20px] font-bold tabular-nums leading-none mt-2", valueCls)}>
        {value}
      </p>
      {hint && <p className="text-[10.5px] text-muted-foreground/80 mt-1.5 truncate">{hint}</p>}
    </div>
  );
}

function relativeFromIso(iso: string): string {
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    if (days <= 0) return "hoy";
    if (days === 1) return "ayer";
    if (days < 7)   return `hace ${days} días`;
    if (days < 30)  return `hace ${Math.floor(days / 7)} sem.`;
    if (days < 365) return `hace ${Math.floor(days / 30)} meses`;
    return `hace ${Math.floor(days / 365)} años`;
  } catch { return iso; }
}

function isRecent(iso?: string): boolean {
  if (!iso) return false;
  const diff = Date.now() - new Date(iso).getTime();
  return diff < 30 * 24 * 60 * 60 * 1000;
}

function MetricStat({
  label, value, muted,
}: {
  label: string;
  value: number | string;
  muted?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0">
      <span className="text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground/80">
        {label}
      </span>
      <span className={cn(
        "text-sm font-bold tabular-nums leading-none mt-0.5",
        muted ? "text-muted-foreground/70" : "text-foreground",
      )}>
        {value}
      </span>
    </div>
  );
}


/** Agrupa las promociones compartidas que NO están publicables
 *  (`incomplete`, `inactive`, `sold-out`) en una sola línea compacta.
 *  Evita inflar el grid con cards sin valor operativo y muestra el
 *  motivo real por el que no están activas (no se llaman "cerradas"
 *  de forma genérica · cada una tiene su razón concreta). */
function ClosedPromosRow({
  promos, className,
}: {
  promos: Array<{ id: string; name: string; active: boolean; status: PromoStatus }>;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  /* Etiqueta del bloque · si todas comparten estado, la usamos.
     Si hay mezcla, decimos simplemente "no activas". */
  const uniqueStatuses = new Set(promos.map((p) => p.status));
  const groupLabel =
    uniqueStatuses.size === 1
      ? STATUS_LABEL[[...uniqueStatuses][0]].toLowerCase()
      : "no activas";
  return (
    <div className={cn(
      "rounded-2xl border border-border/60 bg-muted/20 overflow-hidden",
      className,
    )}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className={cn(
          "w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-muted/40 transition-colors",
          expanded && "border-b border-border/50",
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-6 w-6 rounded-lg bg-muted grid place-items-center shrink-0">
            <Home className="h-3 w-3 text-muted-foreground" strokeWidth={1.75} />
          </span>
          <p className="text-[12px] font-medium text-foreground">
            {promos.length} promoción{promos.length === 1 ? "" : "es"} {groupLabel}
          </p>
          {!expanded && (
            <p className="text-[11px] text-muted-foreground truncate">
              · {promos.slice(0, 2).map((p) => p.name).join(", ")}
              {promos.length > 2 ? `, +${promos.length - 2}` : ""}
            </p>
          )}
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
          {expanded ? "Ocultar" : "Ver"}
          <ChevronRight
            className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-90")}
            strokeWidth={1.75}
          />
        </span>
      </button>
      {expanded && (
        <ul className="divide-y divide-border/40">
          {promos.map((p) => (
            <li key={p.id} className="px-4 py-2">
              <Link
                to={`/promociones/${p.code || p.id}`}
                className="flex items-center justify-between gap-2 group"
              >
                <span className="text-[12.5px] text-foreground truncate group-hover:underline">{p.name}</span>
                <span className="text-[10.5px] text-muted-foreground shrink-0">{STATUS_LABEL[p.status]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BlockHeader({
  eyebrow, title, subtitle, right, tone,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  tone?: "success" | "warning" | "primary";
}) {
  const dotCls = {
    success: "bg-success",
    warning: "bg-warning",
    primary: "bg-primary",
  }[tone ?? "success"];
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="min-w-0 flex items-start gap-3">
        {tone && <span className={cn("mt-[7px] h-2 w-2 rounded-full shrink-0", dotCls)} />}
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
              {eyebrow}
            </p>
          )}
          <h3 className="text-[15px] font-bold text-foreground tracking-tight">{title}</h3>
          {subtitle && <p className="text-[11.5px] text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

function StatusTile({
  icon: Icon, value, label, doneLabel, tone, onClick,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  value: number;
  label: string;
  doneLabel: string;
  tone: "in-progress" | "done";
  onClick?: () => void;
}) {
  const cls = {
    "in-progress": "border-primary/20 bg-primary/[0.04] hover:bg-primary/[0.08]",
    "done":        "border-border/60 bg-muted/20",
  }[tone];
  const iconCls = {
    "in-progress": "bg-primary/10 text-primary",
    "done":        "bg-success/10 text-success",
  }[tone];
  const valueCls = {
    "in-progress": "text-primary",
    "done":        "text-success",
  }[tone];
  const isDone = tone === "done";
  const Wrapper: any = onClick ? "button" : "div";
  const wrapperProps = onClick ? { type: "button", onClick } : {};
  return (
    <Wrapper
      {...wrapperProps}
      className={cn(
        "rounded-2xl border p-4 text-left transition-all shadow-soft flex items-center gap-3",
        cls,
        onClick && "hover:-translate-y-0.5 hover:shadow-soft-lg cursor-pointer",
      )}
    >
      <span className={cn("h-10 w-10 rounded-xl grid place-items-center shrink-0", iconCls)}>
        {isDone ? <Check className="h-5 w-5" strokeWidth={2.25} /> : <Icon className="h-5 w-5" strokeWidth={1.75} />}
      </span>
      <div className="flex-1 min-w-0">
        <p className={cn("text-[22px] font-bold tabular-nums leading-none", valueCls)}>
          {isDone ? "✓" : value}
        </p>
        <p className={cn(
          "text-xs mt-1.5",
          isDone ? "text-muted-foreground" : "text-foreground font-medium",
        )}>
          {isDone ? doneLabel : label}
        </p>
      </div>
      {onClick && !isDone && (
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.75} />
      )}
    </Wrapper>
  );
}

function EmptyCard({
  icon: Icon, title, body,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
      <Icon className="h-5 w-5 text-muted-foreground/50 mx-auto mb-1.5" strokeWidth={1.5} />
      <p className="text-xs font-medium text-foreground">{title}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[320px] mx-auto">{body}</p>
    </div>
  );
}
