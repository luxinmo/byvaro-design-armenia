/**
 * Pantalla · /promotores
 *
 * Lista de PROMOTORES & COMERCIALIZADORES con los que el workspace
 * actual colabora EN ROL DE COMERCIALIZADOR (vendiendo promociones de
 * otros). Inverso visual de `/colaboradores` (donde el workspace ES el
 * promotor y ve a sus agencias).
 *
 * Reusa el layout y la card del listado original de `/colaboradores`
 * (header + búsqueda básica + grid de cards `AgencyGridCard`).
 *
 * Mock dataset · `src/data/promotores.ts`. Cuando aterrice backend:
 *   GET /api/workspace/promotores
 *     → lista paginada de organizaciones tipo developer/comercializador
 *       con las que tenemos relación de comercialización viva.
 */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Users, SlidersHorizontal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { promotores } from "@/data/promotores";
import { AgencyGridCard } from "@/components/agencies/AgencyGridCard";
import { useCurrentUser } from "@/lib/currentUser";
import { agencies, type Agency } from "@/data/agencies";
import { useResolvedPromotores } from "@/lib/useResolvedAgencies";
import {
  DEFAULT_DEVELOPER_ID,
  getCollaboratingDeveloperIds,
} from "@/lib/developerNavigation";
import { promotions } from "@/data/promotions";
import { developerOnlyPromotions } from "@/data/developerPromotions";
import { useUsageGuard } from "@/lib/usageGuard";
import {
  crearOrgCollabRequest,
  currentOrgIdentity,
  getMyOwnEmpresa,
  hasMinimumIdentityData,
  useHasPendingRequestTo,
  useSentOrgCollabRequests,
} from "@/lib/orgCollabRequests";
import { toast } from "sonner";
import { Send, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPublicRef } from "@/lib/tenantRefResolver";
import { LUXINMO_SEED } from "@/data/developerSeed";
import { useEmpresa } from "@/lib/empresa";
import { getEmpresaCategories } from "@/lib/empresaCategories";
import { useFavoriteAgencies } from "@/lib/favoriteAgencies";
import {
  useInboundPendingByOrgId,
  useOutboundPendingByOrgId,
} from "@/lib/collabRequests";
import { MinimalSort } from "@/components/ui/MinimalSort";
import { cn } from "@/lib/utils";

type QuickFilter = "todos" | "colaboradores" | "no-colaboradores";
type SortKey = "ventas-desc" | "registros-desc" | "actividad-desc" | "name-asc";

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "ventas-desc",     label: "Volumen de ventas (mayor)" },
  { value: "registros-desc",  label: "Registros (mayor)" },
  { value: "actividad-desc",  label: "Última actividad" },
  { value: "name-asc",        label: "Nombre (A-Z)" },
];

export default function Promotores() {
  const user = useCurrentUser();
  /* Lado AGENCIA · /promotores muestra la lista de promotores cuya
   *  cartera tiene esta agencia · misma maquinaria de filtros + tarjeta
   *  `AgencyGridCard` que el lado developer · paridad visual. */
  if (user.accountType === "agency") {
    return <PromotoresAgencyView />;
  }
  return <PromotoresDeveloperView />;
}

/* ─────────────────────────────────────────────────────────────────
   Lado AGENCIA · sintetiza la lista de promotores con los que
   colabora la agencia. Mock single-tenant: solo Luxinmo
   (`developer-default`). Cuando aterrice multi-tenant, iterar sobre
   `GET /api/agency/promoters`.
   ───────────────────────────────────────────────────────────────── */
function PromotoresAgencyView() {
  const navigate = useNavigate();
  const user = useCurrentUser();
  /* Datos públicos del promotor · `useEmpresa("developer-…")` lee los
   *  datos vivos del workspace del promotor (lo que Arman tenga
   *  guardado en `byvaro-empresa`) y cae al fixture `LUXINMO_PROFILE`
   *  como fallback si está vacío. Mismo helper que `/promotor/:id` y
   *  `/colaboradores` (lado agencia) · garantiza coherencia 1:1 entre
   *  listado, ficha y panel sin que el listado quede desincronizado.
   *
   *  TODO(backend): sustituir por `GET /api/agency/promoters`. */
  const { empresa: developerEmpresa } = useEmpresa(DEFAULT_DEVELOPER_ID);
  /* `LUXINMO_SEED` se mantiene SOLO para los campos auxiliares de
   *  listing que no viven en `Empresa` (mercados, descripción corta) ·
   *  cuando aterrice backend, esos campos los traerá la API. */
  const listingSeed = LUXINMO_SEED;
  const [search, setSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("todos");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [marketsFilter, setMarketsFilter] = useState<string[]>([]);
  const [especialidadFilter, setEspecialidadFilter] = useState<string[]>([]);
  const activeFilterCount = marketsFilter.length + especialidadFilter.length;

  /* Solicitudes de colaboración · gate del plan agency_free (10 max).
   *  Cuando se acepta o rechaza, el slot se libera. */
  const collabGuard = useUsageGuard("collabRequest");
  const sentPending = useSentOrgCollabRequests(user, "pendiente");
  const pendingTargetIds = useMemo(
    () => new Set(sentPending.map((r) => r.toOrgId)),
    [sentPending],
  );

  /* Selección + favoritos · paridad con `/colaboradores`. Aunque
   *  hoy single-tenant solo hay 1 promotor en la lista, el patrón
   *  se mantiene para que cuando aterrice multi-tenant funcione. */
  const { isFavorite, toggleFavorite } = useFavoriteAgencies();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const toggleSelectId = (id: string) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const myAgency = useMemo(
    () => (user.agencyId ? agencies.find((a) => a.id === user.agencyId) : null),
    [user.agencyId],
  );

  /* Convierte el workspace developer a shape `Agency` para reusar
     `AgencyGridCard`. Identidad (nombre · logo · ubicación · idiomas
     · verificada · Google rating) viene de `developerEmpresa` (live ·
     refleja lo que el promotor edita en `/empresa`). Métricas
     operativas (visitas/registros/ventas) vienen de `myAgency` ·
     son los KPIs de la relación de ESTA agencia con el promotor. */
  /* Promotores externos resueltos · merge seed + cache hidratado. */
  const resolvedPromotores = useResolvedPromotores();

  /* Set de developers ELEGIBLES · tienen al menos una promo publicada
   *  (active + canShareWithAgencies) o una vendida (sold-out · tuvieron
   *  publicada antes). El marketplace muestra TODOS los elegibles · la
   *  agencia ve cuáles son sus colaboradores activos y cuáles puede
   *  descubrir / solicitar.
   *
   *  TODO(backend): este set se computa server-side via
   *  `GET /api/marketplace/promotores` con join contra `promotions`
   *  · respeta visibilidad pública (no expone promos de uso interno
   *  ni borradores). */
  const eligibleDeveloperIds = useMemo(() => {
    const out = new Set<string>();
    const allPromos = [...promotions, ...developerOnlyPromotions];
    for (const p of allPromos) {
      const ownerId = p.ownerOrganizationId;
      if (!ownerId) continue;
      const isPublished = p.status === "active" && p.canShareWithAgencies !== false;
      const isSoldOut = p.status === "sold-out";
      if (isPublished || isSoldOut) out.add(ownerId);
    }
    return out;
  }, []);

  const promotoresList = useMemo<Agency[]>(() => {
    if (!myAgency) return [];
    /* MARKETPLACE · listamos TODOS los developers elegibles (con
     *  promo publicada o vendida) · marcamos los que ya colaboran
     *  con `estadoColaboracion: "activa"`, los demás aparecen sin
     *  vínculo · la agencia puede enviar solicitud de colaboración. */
    const collabDevs = getCollaboratingDeveloperIds(myAgency);
    const cards: Agency[] = [];

    /* Synthetic Luxinmo · siempre que sea elegible. */
    if (eligibleDeveloperIds.has(DEFAULT_DEVELOPER_ID)) {
      const name = developerEmpresa.nombreComercial?.trim()
        || developerEmpresa.razonSocial?.trim()
        || listingSeed.nombreComercial;
      const logo = developerEmpresa.logoUrl?.trim() || listingSeed.logoUrl;
      const location = (() => {
        const ciudad = developerEmpresa.direccionFiscal?.ciudad?.trim();
        const pais = developerEmpresa.direccionFiscal?.pais?.trim();
        if (ciudad && pais) return `${ciudad}, ${pais}`;
        if (ciudad) return ciudad;
        return listingSeed.location;
      })();
      const idiomasUpper = (developerEmpresa.idiomasAtencion ?? []).map((s) => s.toUpperCase());
      const isCollab = collabDevs.has(DEFAULT_DEVELOPER_ID);
      cards.push({
        id: DEFAULT_DEVELOPER_ID,
        name, logo, location,
        type: "Network",
        description: developerEmpresa.overview?.trim() || listingSeed.description || "",
        /* KPIs comerciales · si la agencia ya colabora, vienen del
         *  histórico de la relación; si no, son 0 (marketplace · aún
         *  no ha hecho nada con este promotor). */
        visitsCount: isCollab ? (myAgency.visitsCount ?? 0) : 0,
        registrations: isCollab ? (myAgency.registrations ?? 0) : 0,
        salesVolume: isCollab ? (myAgency.salesVolume ?? 0) : 0,
        collaboratingSince: isCollab ? myAgency.collaboratingSince : undefined,
        status: isCollab ? "active" : "inactive",
        offices: [],
        promotionsCollaborating: isCollab ? (myAgency.promotionsCollaborating ?? []) : [],
        /* totalPromotionsAvailable · cuántas promos publicables tiene
         *  el promotor · útil aunque no colabores aún. */
        totalPromotionsAvailable: [...promotions, ...developerOnlyPromotions]
          .filter((p) => p.ownerOrganizationId === DEFAULT_DEVELOPER_ID
            && p.status === "active"
            && p.canShareWithAgencies !== false).length,
        origen: isCollab ? "invited" : "marketplace",
        estadoColaboracion: isCollab ? "activa" : undefined,
        registrosAportados: isCollab ? (myAgency.registrosAportados ?? 0) : 0,
        ventasCerradas: isCollab ? (myAgency.ventasCerradas ?? 0) : 0,
        comisionMedia: myAgency.comisionMedia,
        mercados: listingSeed.mercados ?? ["ES"],
        idiomasAtencion: idiomasUpper.length > 0 ? idiomasUpper : (listingSeed.idiomasAtencion ?? []),
        teamSize: undefined,
        ratingPromotor: 0,
        googleRating: developerEmpresa.googleRating || listingSeed.googleRating,
        googleRatingsTotal: developerEmpresa.googleRatingsTotal || listingSeed.googleRatingsTotal,
        lastActivityAt: isCollab ? myAgency.lastActivityAt : undefined,
        verificada: !!developerEmpresa.verificada,
      } as Agency);
    }
    /* Externos · TODOS los elegibles · marcamos colaboración real. */
    for (const promo of resolvedPromotores) {
      if (!eligibleDeveloperIds.has(promo.id)) continue;
      const isCollab = collabDevs.has(promo.id);
      cards.push(isCollab ? promo : {
        ...promo,
        /* Marketplace card · sin colaboración activa. KPIs a 0 · la
         *  agencia aún no ha operado con este promotor. */
        visitsCount: 0,
        registrations: 0,
        salesVolume: 0,
        collaboratingSince: undefined,
        status: "inactive",
        promotionsCollaborating: [],
        origen: "marketplace",
        estadoColaboracion: undefined,
        registrosAportados: 0,
        ventasCerradas: 0,
        contractSignedAt: undefined,
        contractExpiresAt: undefined,
        lastActivityAt: undefined,
      } as Agency);
    }
    return cards;
  }, [myAgency, developerEmpresa, listingSeed, resolvedPromotores, eligibleDeveloperIds]);

  /* Catálogos derivados de la lista actual de promotores */
  const allMarkets = useMemo(() => {
    const set = new Set<string>();
    for (const p of promotoresList) for (const m of p.mercados ?? []) set.add(m);
    return Array.from(set).sort();
  }, [promotoresList]);
  const allEspecialidades = useMemo(() => {
    const set = new Set<string>();
    for (const p of promotoresList) if (p.especialidad) set.add(p.especialidad);
    return Array.from(set).sort();
  }, [promotoresList]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = promotoresList;

    if (quickFilter === "colaboradores") {
      list = list.filter((p) =>
        p.estadoColaboracion === "activa" && p.status === "active",
      );
    } else if (quickFilter === "no-colaboradores") {
      list = list.filter((p) =>
        !(p.estadoColaboracion === "activa" && p.status === "active"),
      );
    }
    if (marketsFilter.length > 0) {
      list = list.filter((p) =>
        (p.mercados ?? []).some((m) => marketsFilter.includes(m)),
      );
    }
    if (especialidadFilter.length > 0) {
      list = list.filter((p) =>
        p.especialidad && especialidadFilter.includes(p.especialidad),
      );
    }
    if (q) {
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q) || p.location.toLowerCase().includes(q),
      );
    }
    return list;
  }, [search, quickFilter, marketsFilter, especialidadFilter, promotoresList]);

  const clearAllFilters = () => {
    setMarketsFilter([]);
    setEspecialidadFilter([]);
  };

  /** Envía solicitud de colaboración a un promotor. Comprobaciones:
   *  · La agencia tiene los datos mínimos de identidad (CIF + nombre).
   *  · No hay solicitud previa pendiente al mismo promotor.
   *  · El plan permite enviar más solicitudes (gate del usageGuard). */
  const sendCollabRequest = (target: Agency) => {
    if (collabGuard.blocked) {
      collabGuard.openUpgrade();
      return;
    }
    if (pendingTargetIds.has(target.id)) {
      toast.info(`Ya tienes una solicitud pendiente con ${target.name}`);
      return;
    }
    const myIdentity = currentOrgIdentity(user);
    const myEmpresa = getMyOwnEmpresa(user);
    const check = hasMinimumIdentityData(myEmpresa);
    if (!check.ok) {
      toast.error("Completa tus datos de empresa antes de enviar la solicitud", {
        description: `Faltan: ${check.missing.join(", ")}`,
      });
      navigate("/ajustes/empresa/datos");
      return;
    }
    crearOrgCollabRequest({
      fromOrgId: myIdentity.orgId,
      fromOrgName: myEmpresa.nombreComercial?.trim() || myEmpresa.razonSocial?.trim() || myIdentity.orgName,
      fromOrgKind: myIdentity.orgKind,
      toOrgId: target.id,
      toOrgName: target.name,
      toOrgKind: "developer",
      message: undefined,
      requestedBy: { name: user.name, email: user.email },
    });
    toast.success(`Solicitud enviada a ${target.name}`, {
      description: "Te avisaremos cuando responda.",
    });
  };

  return (
    <div className="flex flex-col min-h-full bg-background">
      <section className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-3">
        <div className="max-w-content mx-auto">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Tu red
            </p>
            <h1 className="text-[19px] sm:text-[22px] font-bold tracking-tight text-foreground leading-tight mt-1">
              Promotores & comercializadores
            </h1>
            <p className="text-[12.5px] text-muted-foreground mt-1 max-w-2xl">
              Marketplace de promotores con promociones publicadas o vendidas
              previamente · los que ya colaboras aparecen marcados como activos
              · puedes solicitar colaboración al resto.
            </p>

            {/* Banner cuota de solicitudes · solo si el plan tiene
             *  límite finito (agency_free → 10 · marketplace → ∞). */}
            {Number.isFinite(collabGuard.limit) && (
              <div className={cn(
                "mt-4 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3",
                collabGuard.blocked
                  ? "border-warning/40 bg-warning/10"
                  : (collabGuard.used ?? 0) >= collabGuard.limit * 0.8
                    ? "border-warning/30 bg-warning/5"
                    : "border-border bg-muted/30",
              )}>
                <div className="flex items-center gap-2 min-w-0">
                  <Send className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.75} />
                  <p className="text-xs text-foreground">
                    <span className="font-semibold">{collabGuard.used ?? 0}</span>
                    <span className="text-muted-foreground"> / {collabGuard.limit} solicitudes pendientes ·{" "}</span>
                    <span className="text-muted-foreground">
                      {collabGuard.blocked
                        ? "límite alcanzado · pasa a Marketplace para enviar sin tope"
                        : `${collabGuard.limit - (collabGuard.used ?? 0)} restantes este mes`}
                    </span>
                  </p>
                </div>
                {collabGuard.blocked && (
                  <Button
                    size="sm"
                    onClick={collabGuard.openUpgrade}
                    className="rounded-full text-xs h-8 shrink-0"
                  >
                    Upgrade
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mt-5">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
              <input
                type="text"
                placeholder="Buscar promotor o ciudad…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-9 rounded-full border border-border bg-card text-sm focus:border-foreground focus:outline-none transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="h-3 w-3" strokeWidth={2} />
                </button>
              )}
            </div>

            <div className="inline-flex items-center bg-muted rounded-full p-1 gap-0.5 shrink-0">
              {([
                { key: "todos", label: "Todos" },
                { key: "colaboradores", label: "Colaboradores" },
                { key: "no-colaboradores", label: "No colaboradores" },
              ] as const).map((opt) => {
                const selected = quickFilter === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setQuickFilter(opt.key)}
                    className={cn(
                      "h-8 px-3.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0",
                      selected
                        ? "bg-card text-foreground shadow-soft"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className={cn(
                "relative inline-flex items-center gap-1.5 h-10 px-4 rounded-full border text-sm font-medium transition-colors shrink-0",
                activeFilterCount > 0
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card text-foreground border-border hover:bg-muted",
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span className="hidden sm:inline">Filtros</span>
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-background text-foreground text-[10px] font-bold tabular-nums">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </section>

      <FiltersDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        markets={allMarkets}
        marketsValue={marketsFilter}
        onMarketsChange={setMarketsFilter}
        especialidades={allEspecialidades}
        especialidadValue={especialidadFilter}
        onEspecialidadChange={setEspecialidadFilter}
        onClearAll={clearAllFilters}
        resultCount={filtered.length}
      />

      <section className="px-4 sm:px-6 lg:px-8 pb-10">
        <div className="max-w-content mx-auto">
          <header className="mb-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Tu red
            </p>
            <h2 className="text-base font-semibold text-foreground leading-tight mt-0.5">
              {filtered.length} {filtered.length === 1 ? "empresa" : "empresas"}
            </h2>
          </header>

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
              <Users className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">Sin colaboraciones todavía</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Cuando un promotor te invite a colaborar, aparecerá aquí.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((p) => {
                const isCollab = p.estadoColaboracion === "activa" && p.status === "active";
                const isPending = pendingTargetIds.has(p.id);
                /* Card del promotor · si NO hay colaboración activa,
                 *  el footerSlot ofrece "Solicitar colaboración" (o
                 *  marca pending si ya se envió una). En cards con
                 *  colaboración activa, el footer queda vacío. */
                const footer = !isCollab ? (
                  <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-border/50">
                    {isPending ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
                        Solicitud enviada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <AlertCircle className="h-3 w-3" strokeWidth={1.75} />
                        Sin colaboración
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant={isPending ? "outline" : "default"}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isPending) return;
                        sendCollabRequest(p);
                      }}
                      disabled={isPending}
                      className="rounded-full text-xs h-7 px-3"
                    >
                      <Send className="h-3 w-3 mr-1" strokeWidth={1.75} />
                      {isPending ? "Pendiente" : "Solicitar"}
                    </Button>
                  </div>
                ) : null;
                return (
                  <AgencyGridCard
                    key={p.id}
                    agency={p}
                    onClick={() => navigate(`/promotor/${p.publicRef || getPublicRef(p.id) || p.id}/panel`)}
                    categories={getEmpresaCategories({ accountType: "developer" })}
                    hideContractStatus
                    hideIncidentsStatus
                    selected={selectedIds.includes(p.id)}
                    onToggleSelect={() => toggleSelectId(p.id)}
                    isFavorite={isFavorite(p.id)}
                    onToggleFavorite={() => toggleFavorite(p.id)}
                    canInteract={isCollab}
                    requestedAt={isPending ? sentPending.find((r) => r.toOrgId === p.id)?.createdAt : undefined}
                    footerSlot={footer}
                  />
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function PromotoresDeveloperView() {
  const navigate = useNavigate();
  const user = useCurrentUser();
  const [search, setSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("todos");
  const [sort, setSort] = useState<SortKey>("ventas-desc");

  /* Maps orgId → timestamp REAL de solicitud · cruza los TRES stores
   *  (invitaciones, solicitudes-promo, solicitudes-org) vía adapter
   *  unificado. Usado para los markers de la card SIN proxy de
   *  `lastActivityAt`. TODO(backend): se reemplaza por `GET
   *  /api/collab-requests?direction=inbound|outbound&status=pending`. */
  const inboundPendingByOrgId = useInboundPendingByOrgId(user);
  const outboundPendingByOrgId = useOutboundPendingByOrgId(user);

  /* Filtros avanzados (drawer) · mercados + especialidad. */
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [marketsFilter, setMarketsFilter] = useState<string[]>([]);
  const [especialidadFilter, setEspecialidadFilter] = useState<string[]>([]);
  const activeFilterCount = marketsFilter.length + especialidadFilter.length;

  /* Selección + favoritos · paridad con `/colaboradores` lado promotor.
   *  Cuando el developer mira a sus contrapartes (otros promotores
   *  con los que comercializa), debe poder marcar favoritos y
   *  seleccionar varios para acciones bulk (envío de email, etc.). */
  const { isFavorite: isFavoriteDev, toggleFavorite: toggleFavoriteDev } = useFavoriteAgencies();
  const [selectedDevIds, setSelectedDevIds] = useState<string[]>([]);
  const toggleSelectDevId = (id: string) =>
    setSelectedDevIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  /* Catálogos derivados · mercados y especialidades del dataset. */
  const allMarkets = useMemo(() => {
    const set = new Set<string>();
    for (const p of promotores) for (const m of p.mercados ?? []) set.add(m);
    return Array.from(set).sort();
  }, []);
  const allEspecialidades = useMemo(() => {
    const set = new Set<string>();
    for (const p of promotores) if (p.especialidad) set.add(p.especialidad);
    return Array.from(set).sort();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    let list = promotores;

    /* Tab segmentado · Colaboradores = colaboración activa.
       No colaboradores = todo lo demás (contrato pendiente, sin
       colaboración real). Cuando aterrice "Solicitudes enviadas",
       irá un cuarto tab. */
    if (quickFilter === "colaboradores") {
      list = list.filter((p) =>
        p.estadoColaboracion === "activa" && p.status === "active",
      );
    } else if (quickFilter === "no-colaboradores") {
      list = list.filter((p) =>
        !(p.estadoColaboracion === "activa" && p.status === "active"),
      );
    }

    /* Mercados · OR · si hay alguno seleccionado, el promotor debe
       cubrir AL MENOS uno. */
    if (marketsFilter.length > 0) {
      list = list.filter((p) =>
        (p.mercados ?? []).some((m) => marketsFilter.includes(m)),
      );
    }

    /* Especialidad · OR. */
    if (especialidadFilter.length > 0) {
      list = list.filter((p) =>
        p.especialidad && especialidadFilter.includes(p.especialidad),
      );
    }

    if (q) {
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q)
        || p.location.toLowerCase().includes(q)
        || (p.description ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [search, quickFilter, marketsFilter, especialidadFilter]);

  const clearAllFilters = () => {
    setMarketsFilter([]);
    setEspecialidadFilter([]);
  };

  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sort) {
      case "ventas-desc":
        arr.sort((a, b) => (b.salesVolume ?? 0) - (a.salesVolume ?? 0));
        break;
      case "registros-desc":
        arr.sort((a, b) => (b.registrations ?? 0) - (a.registrations ?? 0));
        break;
      case "actividad-desc":
        arr.sort((a, b) => (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? ""));
        break;
      case "name-asc":
        arr.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    return arr;
  }, [filtered, sort]);

  return (
    <div className="flex flex-col min-h-full bg-background">
      {/* Header */}
      <section className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-3">
        <div className="max-w-content mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Tu red · comercialización
              </p>
              <h1 className="text-[19px] sm:text-[22px] font-bold tracking-tight text-foreground leading-tight mt-1">
                Promotores & comercializadores
              </h1>
              <p className="text-[12.5px] text-muted-foreground mt-1 max-w-2xl">
                Empresas con las que colaboras como comercializador · sus
                promociones aparecen en tu cartera y puedes registrar clientes
                sobre ellas. Tú no eres el dueño · ellos sí.
              </p>
            </div>
          </div>

          {/* Toolbar · búsqueda + tab segmentado.
              Cuando aterrice el flujo de "solicitudes enviadas" desde
              la agencia hacia un promotor, irá un cuarto tab
              "Solicitudes enviadas" con su lista propia. */}
          <div className="flex items-center gap-2 mt-5">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
              <input
                type="text"
                placeholder="Buscar promotor o ciudad…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-9 rounded-full border border-border bg-card text-sm focus:border-foreground focus:outline-none transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="h-3 w-3" strokeWidth={2} />
                </button>
              )}
            </div>

            {/* Segmentado · Todos / Colaboradores / No colaboradores */}
            <div className="inline-flex items-center bg-muted rounded-full p-1 gap-0.5 shrink-0">
              {([
                { key: "todos", label: "Todos" },
                { key: "colaboradores", label: "Colaboradores" },
                { key: "no-colaboradores", label: "No colaboradores" },
              ] as const).map((opt) => {
                const selected = quickFilter === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setQuickFilter(opt.key)}
                    className={cn(
                      "h-8 px-3.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0",
                      selected
                        ? "bg-card text-foreground shadow-soft"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            {/* Filtros avanzados */}
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className={cn(
                "relative inline-flex items-center gap-1.5 h-10 px-4 rounded-full border text-sm font-medium transition-colors shrink-0",
                activeFilterCount > 0
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card text-foreground border-border hover:bg-muted",
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span className="hidden sm:inline">Filtros</span>
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-background text-foreground text-[10px] font-bold tabular-nums">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Drawer · filtros avanzados */}
      <FiltersDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        markets={allMarkets}
        marketsValue={marketsFilter}
        onMarketsChange={setMarketsFilter}
        especialidades={allEspecialidades}
        especialidadValue={especialidadFilter}
        onEspecialidadChange={setEspecialidadFilter}
        onClearAll={clearAllFilters}
        resultCount={filtered.length}
      />

      {/* Listado */}
      <section className="px-4 sm:px-6 lg:px-8 pb-10">
        <div className="max-w-content mx-auto">
          <header className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Tu red
              </p>
              <h2 className="text-base font-semibold text-foreground leading-tight mt-0.5">
                {sorted.length} {sorted.length === 1 ? "empresa" : "empresas"}
              </h2>
            </div>
            <MinimalSort
              value={sort}
              options={SORT_OPTIONS}
              onChange={(v) => setSort(v as SortKey)}
              label="Ordenar por"
            />
          </header>

          {sorted.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
              <Users className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">Sin resultados</p>
              <p className="text-xs text-muted-foreground">
                Prueba con otro término de búsqueda o cambia el filtro.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sorted.map((p) => (
                <AgencyGridCard
                  key={p.id}
                  agency={p}
                  onClick={() => navigate(`/promotor/${p.publicRef || getPublicRef(p.id) || p.id}`)}
                  /* Categorías del promotor mostrado · derivadas
                   *  como entidad developer. */
                  categories={getEmpresaCategories({ accountType: "developer" })}
                  hideContractStatus
                  hideIncidentsStatus
                  selected={selectedDevIds.includes(p.id)}
                  onToggleSelect={() => toggleSelectDevId(p.id)}
                  isFavorite={isFavoriteDev(p.id)}
                  onToggleFavorite={() => toggleFavoriteDev(p.id)}
                  /* Regla Byvaro · sólo colaboradores activos. */
                  canInteract={p.status === "active" && p.estadoColaboracion === "activa"}
                  /* Marker "Solicitado DD/MM" · usa `createdAt` REAL
                   *  del adapter unificado de collabRequests. Si no
                   *  hay row en el adapter pero la relación está en
                   *  "contrato-pendiente" (seed legacy), caemos a
                   *  `lastActivityAt` solo como fallback histórico ·
                   *  TODO(backend): borrar el fallback al migrar el
                   *  seed a `collab_requests` table. */
                  requestedAt={
                    outboundPendingByOrgId[p.id]
                      ?? (p.estadoColaboracion === "contrato-pendiente"
                        ? p.lastActivityAt
                        : undefined)
                  }
                  inboundRequestAt={inboundPendingByOrgId[p.id]}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Drawer de filtros · multiselect de mercados + especialidad.
   Estilo: lateral derecho 440px desktop · full-screen móvil
   (REGLA DE ORO "Responsive móvil sin popovers").
   ───────────────────────────────────────────────────────────────── */
function FiltersDrawer({
  open, onClose, markets, marketsValue, onMarketsChange,
  especialidades, especialidadValue, onEspecialidadChange,
  onClearAll, resultCount,
}: {
  open: boolean;
  onClose: () => void;
  markets: string[];
  marketsValue: string[];
  onMarketsChange: (next: string[]) => void;
  especialidades: string[];
  especialidadValue: string[];
  onEspecialidadChange: (next: string[]) => void;
  onClearAll: () => void;
  resultCount: number;
}) {
  const totalSelected = marketsValue.length + especialidadValue.length;
  const toggle = (arr: string[], v: string) =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-black/25 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.22, ease: "easeOut" }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full lg:w-[440px] bg-card border-l border-border flex flex-col"
          >
            <header className="shrink-0 px-5 py-4 border-b border-border flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Filtros
                </p>
                <h2 className="text-base font-semibold text-foreground mt-0.5">
                  {totalSelected > 0
                    ? `${totalSelected} aplicado${totalSelected === 1 ? "" : "s"}`
                    : "Sin filtros"}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="h-9 w-9 grid place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </header>

            <main className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-6">
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2">
                  Mercados
                </p>
                {markets.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground italic">Sin mercados disponibles.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {markets.map((iso) => {
                      const sel = marketsValue.includes(iso);
                      return (
                        <button
                          key={iso}
                          type="button"
                          onClick={() => onMarketsChange(toggle(marketsValue, iso))}
                          className={cn(
                            "h-8 px-3 rounded-full text-xs font-medium border transition-colors",
                            sel
                              ? "bg-foreground text-background border-foreground"
                              : "bg-card text-foreground border-border hover:bg-muted",
                          )}
                        >
                          {iso}
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              <section>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2">
                  Especialidad
                </p>
                {especialidades.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground italic">Sin especialidades disponibles.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {especialidades.map((e) => {
                      const sel = especialidadValue.includes(e);
                      return (
                        <button
                          key={e}
                          type="button"
                          onClick={() => onEspecialidadChange(toggle(especialidadValue, e))}
                          className={cn(
                            "h-8 px-3 rounded-full text-xs font-medium border transition-colors capitalize",
                            sel
                              ? "bg-foreground text-background border-foreground"
                              : "bg-card text-foreground border-border hover:bg-muted",
                          )}
                        >
                          {e.replace("-", " ")}
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            </main>

            <footer className="shrink-0 px-5 py-3 border-t border-border flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={onClearAll}
                disabled={totalSelected === 0}
                className="inline-flex items-center h-9 px-4 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Limpiar todo
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center h-9 px-4 rounded-full bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors"
              >
                Ver {resultCount} resultado{resultCount === 1 ? "" : "s"}
              </button>
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
