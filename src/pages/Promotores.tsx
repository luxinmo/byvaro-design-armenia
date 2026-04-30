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
  hasActiveDeveloperCollab,
} from "@/lib/developerNavigation";
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
  const promotoresList = useMemo<Agency[]>(() => {
    if (!myAgency || !hasActiveDeveloperCollab(user)) return [];
    /* Nombre · logo · ubicación derivados de la empresa del promotor.
     * Fallback al fixture si por algún motivo developerEmpresa viene
     * sin identidad (no debería pasar tras el fix de `useEmpresa`). */
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
    /* Idiomas de la empresa están en lowercase en `Empresa` ·
     * `AgencyGridCard` espera ISO uppercase para los chips. */
    const idiomasUpper = (developerEmpresa.idiomasAtencion ?? []).map((s) => s.toUpperCase());
    const synthetic: Agency = {
      id: DEFAULT_DEVELOPER_ID,
      name,
      logo,
      location,
      type: "Network",
      description: developerEmpresa.overview?.trim() || listingSeed.description || "",
      visitsCount: myAgency.visitsCount ?? 0,
      registrations: myAgency.registrations ?? 0,
      salesVolume: myAgency.salesVolume ?? 0,
      collaboratingSince: myAgency.collaboratingSince,
      status: "active",
      offices: [],
      promotionsCollaborating: myAgency.promotionsCollaborating ?? [],
      totalPromotionsAvailable: myAgency.promotionsCollaborating?.length ?? 0,
      origen: "invited",
      estadoColaboracion: "activa",
      registrosAportados: myAgency.registrosAportados ?? 0,
      ventasCerradas: myAgency.ventasCerradas ?? 0,
      comisionMedia: myAgency.comisionMedia,
      /* Mercados · campo de listing-only (no existe en `Empresa`).
       * Se mantiene del seed hasta que aterrice backend con
       * `marketingTopNacionalidades` derivado. */
      mercados: listingSeed.mercados ?? ["ES"],
      idiomasAtencion: idiomasUpper.length > 0 ? idiomasUpper : (listingSeed.idiomasAtencion ?? []),
      teamSize: undefined,
      ratingPromotor: 0,
      googleRating: developerEmpresa.googleRating || listingSeed.googleRating,
      googleRatingsTotal: developerEmpresa.googleRatingsTotal || listingSeed.googleRatingsTotal,
      lastActivityAt: myAgency.lastActivityAt,
      verificada: !!developerEmpresa.verificada,
    } as Agency;
    /* Listado para la agencia · empieza con el promotor "principal"
     *  (Luxinmo · workspace developer del mock) con datos en vivo, y
     *  añade los promotores externos de `promotores` seed (AEDAS,
     *  Neinor, Habitat, Metrovacesa). Una agencia debe poder
     *  descubrir/explorar TODOS los promotores de la red, no sólo
     *  con los que ya colabora. Cuando aterrice backend, el endpoint
     *  GET /api/agency/promoters devolverá la lista completa. */
    return [synthetic, ...resolvedPromotores];
  }, [myAgency, user, developerEmpresa, listingSeed, resolvedPromotores]);

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
              Promotores con los que tu agencia colabora · sus promociones aparecen
              en tu cartera y puedes registrar clientes sobre ellas.
            </p>
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
              {filtered.map((p) => (
                <AgencyGridCard
                  key={p.id}
                  agency={p}
                  onClick={() => navigate(`/promotor/${p.publicRef || getPublicRef(p.id) || p.id}/panel`)}
                  /* Lado agencia mirando al promotor · categorías
                   *  derivadas del developer real (Promotor /
                   *  Comercializador según promociones activas). */
                  categories={getEmpresaCategories({ accountType: "developer" })}
                  /* Sin chip de contrato ni incidencias en el shape
                   *  sintético del developer · esos datos no llegan
                   *  cross-tenant en el mock. */
                  hideContractStatus
                  hideIncidentsStatus
                  /* Selección + favoritos · paridad con
                   *  `/colaboradores` lado promotor. */
                  selected={selectedIds.includes(p.id)}
                  onToggleSelect={() => toggleSelectId(p.id)}
                  isFavorite={isFavorite(p.id)}
                  onToggleFavorite={() => toggleFavorite(p.id)}
                  /* Regla Byvaro · sólo colaboradores activos. */
                  canInteract={p.status === "active" && p.estadoColaboracion === "activa"}
                />
              ))}
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
