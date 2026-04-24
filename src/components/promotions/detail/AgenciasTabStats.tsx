/**
 * AgenciasTabStats · contenido de la tab "Agencias" dentro de una
 * promoción. Layout profesional tipo CRM con dos vistas:
 *
 *   1. Cabecera (eyebrow + H2 + "Estadísticas detalladas" + "Invitar").
 *   2. KPI strip tipográfica.
 *   3. Tiles de acción rápida (solicitudes + invitaciones) si hay.
 *   4. Toolbar con search + MinimalSort + ViewToggle (Lista / Cuadrícula).
 *   5. Vista Lista · tabla tipo CRM con checkbox por fila y select-all.
 *      Vista Cuadrícula · grid de cards (mismo lenguaje que
 *      `/colaboradores`, un poco más compacto) con checkbox en la
 *      esquina de cada card.
 *   6. Barra flotante al seleccionar N agencias con CTA "Enviar email
 *      a N". Click → abre `SendEmailDialog` con agencias preseleccionadas.
 *
 * TODO(backend): ver `docs/backend-integration.md` §4 y §5.
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3, Plus, ChevronRight, ChevronLeft, Star, Inbox, MailPlus,
  Users2, Building, Search, List, LayoutGrid, Mail, X, Check,
  Calendar, Trophy, Lock, Share2, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { agencies, getContractStatus, getAgencyShareStats, type Agency } from "@/data/agencies";
import { promotions } from "@/data/promotions";
import { Flag } from "@/components/ui/Flag";
import { MinimalSort } from "@/components/ui/MinimalSort";
import { ViewToggle } from "@/components/ui/ViewToggle";
import { SendEmailDialog } from "@/components/email/SendEmailDialog";
import { useFavoriteAgencies } from "@/lib/favoriteAgencies";
import { AgenciasPendientesDialog, usePromotionPendientes } from "./AgenciasPendientesDialog";
import type { Promotion } from "@/data/promotions";

/* ═════ Helpers ═════ */

function formatEur(n: number) {
  if (!Number.isFinite(n) || n === 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M€`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} K€`;
  return `${n} €`;
}

function formatRelative(ms: number) {
  const diff = Date.now() - ms;
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days <= 0) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return hours <= 0 ? "hace minutos" : `hace ${hours} h`;
  }
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  const weeks = Math.floor(days / 7);
  return weeks === 1 ? "hace 1 semana" : `hace ${weeks} semanas`;
}

function formatRelativeISO(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (!Number.isFinite(d)) return null;
  return formatRelative(d);
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

type SortKey = "ventas" | "registros" | "visitas" | "conversion" | "rating" | "since" | "name";

const SORT_OPTIONS = [
  { value: "ventas",     label: "Ventas" },
  { value: "visitas",    label: "Visitas" },
  { value: "registros",  label: "Registros" },
  { value: "conversion", label: "Conversión" },
  { value: "rating",     label: "Rating Google" },
  { value: "since",      label: "Activa desde" },
  { value: "name",       label: "Nombre (A–Z)" },
];

function getSortValue(a: Agency, key: SortKey): number | string {
  switch (key) {
    case "ventas":     return a.ventasCerradas ?? 0;
    case "visitas":    return a.visitsCount ?? 0;
    case "registros":  return a.registrations ?? a.registrosAportados ?? 0;
    case "conversion": {
      const reg = a.registrations ?? a.registrosAportados ?? 0;
      const ven = a.ventasCerradas ?? 0;
      return reg > 0 ? ven / reg : 0;
    }
    case "rating":     return a.googleRating ?? 0;
    case "since":      return a.contractSignedAt ? new Date(a.contractSignedAt).getTime() : 0;
    case "name":       return a.name.toLowerCase();
  }
}

/* ══════ AgencyMark · monograma + logo opcional ══════ */
function AgencyMark({ name, logo, size = "md" }: { name: string; logo?: string; size?: "sm" | "md" }) {
  const cls = size === "sm"
    ? "h-8 w-8 rounded-md text-[10px]"
    : "h-10 w-10 rounded-md text-[11px]";
  return (
    <div className={cn(
      "shrink-0 border border-border/60 bg-muted/40 overflow-hidden grid place-items-center",
      "font-semibold text-muted-foreground tracking-wider",
      cls,
    )}>
      {logo ? (
        <img src={logo} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span>{initials(name) || "—"}</span>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════ */

interface Props {
  promotion: Promotion;
  /** Solo true cuando la promoción está activa, completa y con
   *  compartir activado (`sharingEnabled`). Si es false, la pantalla
   *  muestra el estado adecuado según el motivo. */
  canShare: boolean;
  /** El promotor tiene activado compartir con agencias para esta
   *  promoción (`canShareWithAgencies !== false`). Cuando es false,
   *  mostramos estado "Solo uso interno" con CTA para activarlo. */
  sharingEnabled: boolean;
  /** La promoción aún no tiene todos los campos obligatorios. */
  isIncomplete: boolean;
  /** La promoción todavía es un borrador sin publicar. */
  isDraft: boolean;
  onInvitar: () => void;
  onOpenStats: () => void;
  onActivateSharing: () => void;
  onOpenPendientes: () => void;
}

export function AgenciasTabStats({
  promotion: p, canShare, sharingEnabled, isIncomplete, isDraft,
  onInvitar, onOpenStats, onActivateSharing,
}: Props) {
  const navigate = useNavigate();
  const { invitacionesCount } = usePromotionPendientes(p.id);

  const [pendientesMode, setPendientesMode] = useState<"solicitudes" | "invitaciones" | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("ventas");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [emailOpen, setEmailOpen] = useState(false);
  /* Paginación · 12 cabe bien en grid 3 cols y es razonable en lista. */
  const PAGE_SIZE = 12;
  const [page, setPage] = useState(1);
  const { isFavorite, toggleFavorite } = useFavoriteAgencies();
  const handleToggleFavorite = (id: string, name: string) => {
    const wasFav = isFavorite(id);
    toggleFavorite(id);
    toast.success(wasFav ? "Quitada de favoritos" : "Añadida a favoritos", { description: name });
  };

  const agenciasEnPromo = useMemo(
    () => agencies.filter((a) => a.promotionsCollaborating?.includes(p.id) && !a.solicitudPendiente),
    [p.id],
  );

  /* Solicitudes entrantes limitadas a ESTA promoción. Si la agencia
   * solicitó colaborar de forma global (sin `requestedPromotionIds`),
   * no aparece aquí · se gestiona desde `/colaboradores`. Ver
   * `requestedPromotionIds` en `src/data/agencies.ts`. */
  const solicitudesPromo = useMemo(
    () => agencies.filter(
      (a) => (a.solicitudPendiente || a.isNewRequest)
        && a.requestedPromotionIds?.includes(p.id),
    ),
    [p.id],
  );

  const filteredSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let filtered = q
      ? agenciasEnPromo.filter((a) =>
          [a.name, a.location, a.contactoPrincipal?.nombre].some(
            (field) => field?.toLowerCase().includes(q),
          ),
        )
      : agenciasEnPromo;
    if (onlyFavorites) filtered = filtered.filter((a) => isFavorite(a.id));
    return [...filtered].sort((a, b) => {
      const va = getSortValue(a, sort);
      const vb = getSortValue(b, sort);
      if (typeof va === "string" && typeof vb === "string") return va.localeCompare(vb);
      return (vb as number) - (va as number);
    });
  }, [agenciasEnPromo, search, sort, onlyFavorites, isFavorite]);

  const favoritesCount = useMemo(
    () => agenciasEnPromo.filter((a) => isFavorite(a.id)).length,
    [agenciasEnPromo, isFavorite],
  );

  /* Paginación sobre el resultado filtrado/ordenado. */
  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageItems = filteredSorted.slice(pageStart, pageStart + PAGE_SIZE);
  const pageIds = pageItems.map((a) => a.id);
  const allFilteredIds = filteredSorted.map((a) => a.id);

  /* Al cambiar el criterio de filtrado o búsqueda, volvemos a página 1
     para que el usuario no quede "huérfano" en una página vacía. */
  useEffect(() => { setPage(1); }, [search, sort, onlyFavorites, viewMode]);

  const pageAllSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const allFilteredSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.includes(id));
  const hasSelectionInPage = pageIds.some((id) => selectedIds.includes(id));

  const toggleId = (id: string) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };
  /** Select-all del header · alterna la selección de la página actual. */
  const togglePage = () => {
    if (pageAllSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };
  /** Selecciona TODAS las agencias filtradas (a través de páginas). */
  const selectAllFiltered = () => {
    setSelectedIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])));
  };
  const clearSelection = () => setSelectedIds([]);

  const kpis = useMemo(() => {
    const totales = agenciasEnPromo.reduce(
      (acc, a) => {
        acc.visitas    += a.visitsCount ?? 0;
        acc.registros  += a.registrations ?? a.registrosAportados ?? 0;
        acc.ventas     += a.ventasCerradas ?? 0;
        acc.volumen    += a.salesVolume ?? 0;
        return acc;
      },
      { visitas: 0, registros: 0, ventas: 0, volumen: 0 },
    );
    const conversion = totales.registros > 0
      ? Math.round((totales.ventas / totales.registros) * 100)
      : 0;
    return { ...totales, conversion };
  }, [agenciasEnPromo]);

  /** Líder por cada métrica de interés. Devuelve la agencia con el
   *  mayor valor y el propio valor para pintarlo como "medalla" bajo
   *  el KPI correspondiente. Si hay empate, gana el primero. Si
   *  ningún valor es > 0, no hay líder. */
  const leaders = useMemo(() => {
    const pick = (getVal: (a: Agency) => number) => {
      let best: { agency: Agency; value: number } | null = null;
      for (const a of agenciasEnPromo) {
        const v = getVal(a);
        if (v > 0 && (!best || v > best.value)) best = { agency: a, value: v };
      }
      return best;
    };
    return {
      visitas:   pick((a) => a.visitsCount ?? 0),
      registros: pick((a) => a.registrations ?? a.registrosAportados ?? 0),
      ventas:    pick((a) => a.ventasCerradas ?? 0),
    };
  }, [agenciasEnPromo]);

  /** Para cada agencia · lista de métricas en las que es top (ventas,
   *  visitas, registros). Se usa para pintar un trofeo muy suave junto
   *  al nombre en cada fila/card. */
  const topBadgesByAgency = useMemo(() => {
    const map: Record<string, Array<"ventas" | "visitas" | "registros">> = {};
    if (leaders.ventas)    (map[leaders.ventas.agency.id]    ||= []).push("ventas");
    if (leaders.visitas)   (map[leaders.visitas.agency.id]   ||= []).push("visitas");
    if (leaders.registros) (map[leaders.registros.agency.id] ||= []).push("registros");
    return map;
  }, [leaders]);

  /* ═════ Estados especiales ═════
     Antes de pintar KPIs y listas (que serían todos 0), respondemos
     a "¿por qué esta promoción no tiene agencias?". Tres casos
     posibles, cada uno con su propio CTA:
       · Borrador sin publicar → termina y publica primero.
       · Publicable pero con campos incompletos → completa para compartir.
       · Activa pero compartir desactivado → activa compartir ahora.
     Cuando está todo OK pero aún no hay agencias, caemos al flujo
     normal (toolbar + empty state con "Invitar agencia"). */
  if (isDraft) {
    return (
      <EmptyStatePanel
        icon={FileText}
        eyebrow="Borrador sin publicar"
        title="Publica la promoción para empezar a colaborar"
        description="Las agencias solo pueden colaborar en promociones activas. Completa el borrador y publícalo desde la Vista general."
        primaryCta={null}
      />
    );
  }

  if (isIncomplete) {
    return (
      <EmptyStatePanel
        icon={FileText}
        eyebrow="Promoción incompleta"
        title="Completa los campos obligatorios para compartirla"
        description="Mientras la promoción esté marcada como incompleta, no puede invitar ni recibir solicitudes de agencias. Ve a la Vista general para revisar qué falta."
        primaryCta={null}
      />
    );
  }

  if (!sharingEnabled) {
    return (
      <EmptyStatePanel
        icon={Lock}
        eyebrow="Solo uso interno"
        title="Esta promoción no está compartida con agencias"
        description="La has marcado como de uso interno. Tu equipo puede trabajarla, pero ninguna agencia colaboradora la ve ni puede registrar clientes. Actívalo cuando quieras abrirla a tu red."
        primaryCta={{
          label: "Activar compartir",
          icon: Share2,
          onClick: onActivateSharing,
        }}
      />
    );
  }

  /* Compartir activado pero todavía sin ninguna colaboración ni
     pendiente · mostramos empty state limpio en vez de KPIs a 0.
     Una vez haya al menos una invitación enviada, solicitud recibida
     o agencia colaborando, pasamos al flujo normal con KPIs + tabla. */
  const hasAnyContent =
    agenciasEnPromo.length > 0 ||
    solicitudesPromo.length > 0 ||
    invitacionesCount > 0;
  if (!hasAnyContent) {
    return (
      <EmptyStatePanel
        icon={Share2}
        eyebrow="Lista para compartir"
        title="Invita a tu primera agencia colaboradora"
        description="Esta promoción está publicada y compartida. Invita agencias para que empiecen a registrar clientes y programar visitas. Verás aquí métricas, solicitudes e invitaciones en cuanto haya actividad."
        primaryCta={canShare ? {
          label: "Invitar agencia",
          icon: Plus,
          onClick: onInvitar,
        } : null}
      />
    );
  }

  return (
    <div className="space-y-5 pb-24">
      {/* ═════ Cabecera ═════ */}
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Agencias · red comercial
          </p>
          <h2 className="text-base font-semibold text-foreground leading-tight mt-0.5">
            Rendimiento en esta promoción
          </h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenStats}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors"
          >
            <BarChart3 className="h-3.5 w-3.5" strokeWidth={1.75} />
            Estadísticas detalladas
          </button>
          {canShare && (
            <button
              onClick={onInvitar}
              className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              Invitar agencia
            </button>
          )}
        </div>
      </header>

      {/* ═════ KPI strip ═════
          Cada KPI con líder ("top") incluye una medalla al pie con el
          nombre de la agencia top y su valor, clicable para abrir
          directamente su ficha. */}
      <div className="rounded-2xl border border-border bg-card shadow-soft">
        <dl className="grid grid-cols-2 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-border/60">
          <KpiStat
            label="Agencias"
            value={agenciasEnPromo.length}
          />
          <KpiStat
            label="Visitas"
            value={kpis.visitas}
            top={leaders.visitas && {
              agency: leaders.visitas.agency,
              value: leaders.visitas.value,
              onClick: () => navigate(`/colaboradores/${leaders.visitas!.agency.id}/panel?from=${p.id}`),
            }}
          />
          <KpiStat
            label="Registros"
            value={kpis.registros}
            top={leaders.registros && {
              agency: leaders.registros.agency,
              value: leaders.registros.value,
              onClick: () => navigate(`/colaboradores/${leaders.registros!.agency.id}/panel?from=${p.id}`),
            }}
          />
          <KpiStat
            label="Ventas"
            value={kpis.ventas}
            sub={formatEur(kpis.volumen)}
            top={leaders.ventas && {
              agency: leaders.ventas.agency,
              value: leaders.ventas.value,
              onClick: () => navigate(`/colaboradores/${leaders.ventas!.agency.id}/panel?from=${p.id}`),
            }}
          />
          <KpiStat
            label="Conversión"
            value={`${kpis.conversion}%`}
            accent={kpis.conversion > 0 ? "success" : undefined}
          />
        </dl>
      </div>

      {/* ═════ Tiles de acción rápida ═════ */}
      {(solicitudesPromo.length > 0 || invitacionesCount > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {solicitudesPromo.length > 0 && (
            <QuickActionTile
              index={0}
              icon={Inbox}
              count={solicitudesPromo.length}
              label="Solicitudes recibidas"
              hint={`${solicitudesPromo.length} agencia${solicitudesPromo.length === 1 ? " quiere" : "s quieren"} colaborar contigo`}
              onClick={() => setPendientesMode("solicitudes")}
            />
          )}
          {invitacionesCount > 0 && (
            <QuickActionTile
              index={1}
              icon={MailPlus}
              count={invitacionesCount}
              label="Invitaciones pendientes"
              hint={`${invitacionesCount} invitación${invitacionesCount === 1 ? "" : "es"} sin aceptar`}
              onClick={() => setPendientesMode("invitaciones")}
            />
          )}
        </div>
      )}

      {/* ═════ Toolbar (search · sort · view) ═════ */}
      {agenciasEnPromo.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" strokeWidth={1.75} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar agencia, ciudad, contacto…"
              className="w-full h-9 pl-8 pr-3 rounded-full border border-border bg-card text-[12.5px] text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-foreground/20 transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted grid place-items-center"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-3 w-3" strokeWidth={2} />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setOnlyFavorites((v) => !v)}
            disabled={favoritesCount === 0 && !onlyFavorites}
            className={cn(
              "inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-[12.5px] font-medium transition-colors",
              onlyFavorites
                ? "bg-foreground text-background border-foreground"
                : "bg-card text-foreground border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed",
            )}
            aria-pressed={onlyFavorites}
          >
            <Star className={cn("h-3.5 w-3.5", onlyFavorites ? "fill-background" : "")} strokeWidth={1.75} />
            <span className="hidden sm:inline">Favoritas</span>
            {favoritesCount > 0 && (
              <span className={cn(
                "tabular-nums",
                onlyFavorites ? "text-background/70" : "text-muted-foreground",
              )}>
                {favoritesCount}
              </span>
            )}
          </button>

          <div className="ml-auto flex items-center gap-3 sm:gap-4">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              <span className="font-semibold text-foreground tabular-nums">{filteredSorted.length}</span> resultados
            </span>
            <MinimalSort
              value={sort}
              options={SORT_OPTIONS}
              onChange={(v) => setSort(v as SortKey)}
              label="Ordenar por"
            />
            <ViewToggle
              value={viewMode}
              onChange={setViewMode}
              iconOnly
              options={[
                { value: "list", icon: List,       label: "Lista" },
                { value: "grid", icon: LayoutGrid, label: "Cuadrícula" },
              ]}
            />
          </div>
        </div>
      )}

      {/* ═════ Contenido · vista Lista o Cuadrícula ═════ */}
      {agenciasEnPromo.length === 0 ? (
        solicitudesPromo.length === 0 && invitacionesCount === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <p className="text-sm font-medium text-foreground mb-1">Aún no colabora ninguna agencia</p>
            <p className="text-xs text-muted-foreground mb-4 max-w-sm mx-auto">
              Cuando invites a una agencia y acepte, verás aquí sus métricas agregadas.
            </p>
            {canShare && (
              <button
                onClick={onInvitar}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                Invitar agencia
              </button>
            )}
          </div>
        )
      ) : filteredSorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm font-medium text-foreground">Sin resultados</p>
          <p className="text-xs text-muted-foreground mt-1">Prueba con otra búsqueda.</p>
        </div>
      ) : (
        <>
          {viewMode === "list" ? (
            <ListView
              agencies={pageItems}
              selectedIds={selectedIds}
              onToggleId={toggleId}
              pageAllSelected={pageAllSelected}
              onTogglePage={togglePage}
              onOpenAgency={(id) => navigate(`/colaboradores/${id}/panel?from=${p.id}`)}
              onSeeAll={() => navigate("/colaboradores")}
              isFavorite={isFavorite}
              onToggleFavorite={handleToggleFavorite}
              topBadgesByAgency={topBadgesByAgency}
              selectAllBanner={
                <SelectAllBanner
                  pageAllSelected={pageAllSelected}
                  allFilteredSelected={allFilteredSelected}
                  pageCount={pageItems.length}
                  totalCount={filteredSorted.length}
                  onSelectAllFiltered={selectAllFiltered}
                  onClearSelection={clearSelection}
                />
              }
            />
          ) : (
            <>
              <SelectAllBanner
                pageAllSelected={pageAllSelected}
                allFilteredSelected={allFilteredSelected}
                pageCount={pageItems.length}
                totalCount={filteredSorted.length}
                onSelectAllFiltered={selectAllFiltered}
                onClearSelection={clearSelection}
              />
              <GridView
                agencies={pageItems}
                selectedIds={selectedIds}
                onToggleId={toggleId}
                onOpenAgency={(id) => navigate(`/colaboradores/${id}/panel?from=${p.id}`)}
                isFavorite={isFavorite}
                onToggleFavorite={handleToggleFavorite}
                topBadgesByAgency={topBadgesByAgency}
              />
            </>
          )}
          {/* Paginación · compartida por ambas vistas */}
          {totalPages > 1 && (
            <Pagination
              page={safePage}
              totalPages={totalPages}
              pageStart={pageStart}
              pageEnd={pageStart + pageItems.length}
              totalCount={filteredSorted.length}
              onChange={setPage}
            />
          )}
        </>
      )}

      {/* Dialog de pendientes */}
      {pendientesMode && (
        <AgenciasPendientesDialog
          open
          onOpenChange={(v) => { if (!v) setPendientesMode(null); }}
          mode={pendientesMode}
          promotionId={p.id}
          promotionName={p.name}
        />
      )}

      {/* Barra flotante de selección · sticky bottom. Expone
          directamente "Seleccionar todo" y "Limpiar" sin obligar al
          usuario a marcar toda la página primero. */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 rounded-full bg-foreground text-background shadow-soft-lg border border-foreground/20 px-2 py-1.5 flex items-center gap-1.5 max-w-[calc(100vw-32px)]">
          <span className="h-7 px-3 inline-flex items-center rounded-full bg-background/15 text-[11.5px] font-semibold tabular-nums">
            {selectedIds.length} seleccionada{selectedIds.length !== 1 ? "s" : ""}
          </span>
          {!allFilteredSelected && filteredSorted.length > selectedIds.length && (
            <button
              onClick={selectAllFiltered}
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-background/85 hover:text-background hover:bg-background/10 text-[11.5px] font-medium transition-colors"
              title={`Seleccionar las ${filteredSorted.length} agencias de la búsqueda`}
            >
              <Check className="h-3.5 w-3.5" strokeWidth={2.25} />
              Seleccionar todo ({filteredSorted.length})
            </button>
          )}
          <button
            onClick={clearSelection}
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-background/85 hover:text-background hover:bg-background/10 text-[11.5px] font-medium transition-colors"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
            Limpiar
          </button>
          <span className="w-px h-5 bg-background/20 mx-1" aria-hidden />
          <button
            onClick={() => setEmailOpen(true)}
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-background text-foreground text-[11.5px] font-semibold hover:bg-background/90 transition-colors"
          >
            <Mail className="h-3.5 w-3.5" strokeWidth={1.75} />
            Enviar email
          </button>
        </div>
      )}

      {/* Dialog de envío de emails · pre-selecciona las agencias marcadas */}
      <SendEmailDialog
        open={emailOpen}
        onOpenChange={(v) => {
          setEmailOpen(v);
          if (!v) clearSelection();
        }}
        defaultAudience="collaborator"
        promotionId={p.id}
        mode="promotion"
        preselectedAgencyIds={selectedIds}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Vista LISTA (tabla tipo CRM)
 * ════════════════════════════════════════════════════════════════ */
function ListView({
  agencies: list, selectedIds, onToggleId, pageAllSelected, onTogglePage, onOpenAgency, onSeeAll,
  isFavorite, onToggleFavorite, topBadgesByAgency, selectAllBanner,
}: {
  agencies: Agency[];
  selectedIds: string[];
  onToggleId: (id: string) => void;
  pageAllSelected: boolean;
  onTogglePage: () => void;
  onOpenAgency: (id: string) => void;
  onSeeAll: () => void;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (id: string, name: string) => void;
  topBadgesByAgency: Record<string, Array<"ventas" | "visitas" | "registros">>;
  selectAllBanner?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
      {/* Toolbar secundaria dentro del panel */}
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <div className="flex items-baseline gap-2 min-w-0">
          <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Agencias colaborando
          </h3>
          <span className="text-[11px] tabular-nums text-muted-foreground/70">
            {list.length}
          </span>
        </div>
        <button
          onClick={onSeeAll}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-0.5"
        >
          Ver todas
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      {/* Header de columnas */}
      <div className="hidden lg:grid grid-cols-[24px_minmax(0,1fr)_64px_64px_64px_64px_60px] gap-5 px-5 pb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 border-b border-border/40">
        <SelectAllCheckbox checked={pageAllSelected} onChange={onTogglePage} />
        <span>Agencia</span>
        <span className="text-right">Visitas</span>
        <span className="text-right">Reg.</span>
        <span className="text-right">Ventas</span>
        <span className="text-right">Conv.</span>
        <span />
      </div>

      {selectAllBanner}

      <ul className="divide-y divide-border/50">
        {list.map((a) => {
          const visitas = a.visitsCount ?? 0;
          const ventas = a.ventasCerradas ?? 0;
          const registros = a.registrations ?? a.registrosAportados ?? 0;
          const conversion = registros > 0 ? Math.round((ventas / registros) * 100) : 0;
          const lastActivity = formatRelativeISO(a.lastActivityAt);
          const officesCount = a.offices?.length ?? 0;
          const selected = selectedIds.includes(a.id);
          const metaLine2 = [
            a.location,
            a.collaboratingSince ? `Desde ${a.collaboratingSince}` : null,
          ].filter(Boolean).join(" · ");

          return (
            <li
              key={a.id}
              className={cn(
                "px-5 py-3.5 transition-colors",
                selected ? "bg-muted/40" : "hover:bg-muted/20",
              )}
            >
              {/* ≥lg · grid tabular con checkbox */}
              <div className="hidden lg:grid grid-cols-[24px_minmax(0,1fr)_64px_64px_64px_64px_60px] gap-5 items-start">
                <RowCheckbox
                  checked={selected}
                  onChange={() => onToggleId(a.id)}
                  label={`Seleccionar ${a.name}`}
                />

                <div
                  className="flex items-start gap-3 min-w-0 cursor-pointer"
                  onClick={() => onOpenAgency(a.id)}
                >
                  <AgencyMark name={a.name} logo={a.logo} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{a.name}</p>
                      <TopBadge categories={topBadgesByAgency[a.id] ?? []} />
                      {typeof a.googleRating === "number" && (
                        <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground tabular-nums shrink-0">
                          <Star className="h-2.5 w-2.5 fill-foreground text-foreground" strokeWidth={0} />
                          <span className="text-foreground font-medium">{a.googleRating.toFixed(1)}</span>
                          {a.googleRatingsTotal ? (
                            <span className="text-muted-foreground/70">({a.googleRatingsTotal})</span>
                          ) : null}
                        </span>
                      )}
                    </div>
                    <p className="text-[11.5px] text-muted-foreground truncate mt-0.5">
                      {metaLine2}
                      {lastActivity && <span className="text-muted-foreground/70"> · activa {lastActivity}</span>}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {a.mercados && a.mercados.length > 0 && <MarketFlags isoList={a.mercados} max={5} />}
                      {(typeof a.teamSize === "number" || officesCount > 0) && (
                        <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground tabular-nums">
                          {typeof a.teamSize === "number" && a.teamSize > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <Users2 className="h-2.5 w-2.5" strokeWidth={1.75} />
                              <span className="text-foreground font-medium">{a.teamSize}</span>
                              <span className="text-muted-foreground/70">agente{a.teamSize === 1 ? "" : "s"}</span>
                            </span>
                          )}
                          {officesCount > 0 && (
                            <span className="inline-flex items-center gap-1">
                              <Building className="h-2.5 w-2.5" strokeWidth={1.75} />
                              <span className="text-foreground font-medium">{officesCount}</span>
                              <span className="text-muted-foreground/70">oficina{officesCount === 1 ? "" : "s"}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="mt-2"><StatusChips agency={a} /></div>
                  </div>
                </div>

                <Metric value={visitas} onClick={() => onOpenAgency(a.id)} />
                <Metric value={registros} onClick={() => onOpenAgency(a.id)} />
                <Metric value={ventas} highlight={ventas > 0} onClick={() => onOpenAgency(a.id)} />
                <Metric
                  value={`${conversion}%`}
                  highlight={conversion > 0}
                  accent={conversion >= 15 ? "success" : undefined}
                  onClick={() => onOpenAgency(a.id)}
                />
                <div className="flex items-center gap-0.5 justify-end -mr-1">
                  <FavoriteStar
                    active={isFavorite(a.id)}
                    onToggle={() => onToggleFavorite(a.id, a.name)}
                    size="sm"
                  />
                  <button
                    onClick={() => onOpenAgency(a.id)}
                    className="h-7 w-6 grid place-items-center text-muted-foreground/40 hover:text-foreground transition-colors"
                    aria-label="Abrir ficha"
                  >
                    <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </div>
              </div>

              {/* <lg · layout apilado */}
              <div className="lg:hidden flex items-start gap-3">
                <RowCheckbox
                  checked={selected}
                  onChange={() => onToggleId(a.id)}
                  label={`Seleccionar ${a.name}`}
                />
                <div
                  className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer"
                  onClick={() => onOpenAgency(a.id)}
                >
                  <AgencyMark name={a.name} logo={a.logo} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground truncate">{a.name}</p>
                      <TopBadge categories={topBadgesByAgency[a.id] ?? []} />
                      {typeof a.googleRating === "number" && (
                        <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground tabular-nums shrink-0">
                          <Star className="h-2.5 w-2.5 fill-foreground text-foreground" strokeWidth={0} />
                          {a.googleRating.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <p className="text-[11.5px] text-muted-foreground truncate mt-0.5">{metaLine2}</p>
                    {a.mercados && a.mercados.length > 0 && (
                      <div className="mt-1.5"><MarketFlags isoList={a.mercados} max={5} /></div>
                    )}
                    <div className="mt-1.5"><StatusChips agency={a} /></div>
                    <div className="flex items-center gap-3 mt-2 text-[11.5px] text-muted-foreground tabular-nums">
                      <span><span className="text-foreground font-medium">{visitas}</span> vis.</span>
                      <span><span className="text-foreground font-medium">{registros}</span> reg.</span>
                      <span><span className="text-foreground font-medium">{ventas}</span> ventas</span>
                      <span className={cn(
                        "font-semibold",
                        conversion >= 15 ? "text-success" : conversion > 0 ? "text-foreground" : "",
                      )}>
                        {conversion}%
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 mt-1.5" strokeWidth={1.5} />
                </div>
                <FavoriteStar
                  active={isFavorite(a.id)}
                  onToggle={() => onToggleFavorite(a.id, a.name)}
                  size="sm"
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Vista CUADRÍCULA (cards estilo /colaboradores)
 * ════════════════════════════════════════════════════════════════ */
function GridView({
  agencies: list, selectedIds, onToggleId, onOpenAgency,
  isFavorite, onToggleFavorite, topBadgesByAgency,
}: {
  agencies: Agency[];
  selectedIds: string[];
  onToggleId: (id: string) => void;
  onOpenAgency: (id: string) => void;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (id: string, name: string) => void;
  topBadgesByAgency: Record<string, Array<"ventas" | "visitas" | "registros">>;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {list.map((a) => {
        const visitas = a.visitsCount ?? 0;
        const ventas = a.ventasCerradas ?? 0;
        const registros = a.registrations ?? a.registrosAportados ?? 0;
        const conversion = registros > 0 ? Math.round((ventas / registros) * 100) : 0;
        const officesCount = a.offices?.length ?? 0;
        const selected = selectedIds.includes(a.id);
        return (
          <article
            key={a.id}
            className={cn(
              "relative rounded-2xl border bg-card shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 transition-all duration-200",
              selected ? "border-foreground/30 ring-1 ring-foreground/10" : "border-border",
            )}
          >
            {/* Checkbox absolute corner */}
            <div className="absolute top-3 left-3 z-10">
              <RowCheckbox
                checked={selected}
                onChange={() => onToggleId(a.id)}
                label={`Seleccionar ${a.name}`}
                variant="card"
              />
            </div>

            {/* Estrella de favorito · esquina superior-derecha */}
            <div className="absolute top-2.5 right-2.5 z-10">
              <FavoriteStar
                active={isFavorite(a.id)}
                onToggle={() => onToggleFavorite(a.id, a.name)}
              />
            </div>

            <button
              type="button"
              onClick={() => onOpenAgency(a.id)}
              className="w-full text-left p-4 pt-12"
            >
              {/* Header: logo + nombre + rating */}
              <div className="flex items-start gap-3">
                <AgencyMark name={a.name} logo={a.logo} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{a.name}</p>
                    <TopBadge categories={topBadgesByAgency[a.id] ?? []} />
                    {typeof a.googleRating === "number" && (
                      <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground tabular-nums shrink-0">
                        <Star className="h-2.5 w-2.5 fill-foreground text-foreground" strokeWidth={0} />
                        <span className="text-foreground font-medium">{a.googleRating.toFixed(1)}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-[11.5px] text-muted-foreground truncate mt-0.5">
                    {a.location}
                  </p>
                </div>
              </div>

              {/* Mercados */}
              {a.mercados && a.mercados.length > 0 && (
                <div className="mt-3">
                  <MarketFlags isoList={a.mercados} max={6} />
                </div>
              )}

              {/* Metadata (equipo + oficinas + desde) */}
              <div className="mt-2.5 flex items-center gap-2.5 text-[11px] text-muted-foreground flex-wrap">
                {typeof a.teamSize === "number" && a.teamSize > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Users2 className="h-2.5 w-2.5" strokeWidth={1.75} />
                    <span className="text-foreground font-medium">{a.teamSize}</span> agentes
                  </span>
                )}
                {officesCount > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Building className="h-2.5 w-2.5" strokeWidth={1.75} />
                    <span className="text-foreground font-medium">{officesCount}</span> oficina{officesCount === 1 ? "" : "s"}
                  </span>
                )}
                {a.collaboratingSince && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-2.5 w-2.5" strokeWidth={1.75} />
                    {a.collaboratingSince}
                  </span>
                )}
              </div>

              {/* Indicadores de estado · contrato · cobertura · incidencias */}
              <div className="mt-3"><StatusChips agency={a} /></div>

              {/* Stats · 4 columnas compactas */}
              <div className="grid grid-cols-4 gap-2 mt-4 rounded-xl bg-muted/40 p-3">
                <MetricBlock label="Visitas" value={visitas} />
                <MetricBlock label="Reg." value={registros} />
                <MetricBlock label="Ventas" value={ventas} />
                <MetricBlock
                  label="Conv."
                  value={`${conversion}%`}
                  accent={conversion >= 15 ? "success" : undefined}
                />
              </div>
            </button>
          </article>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
 * Sub-componentes reutilizables
 * ════════════════════════════════════════════════════════════════ */

function RowCheckbox({
  checked, onChange, label, variant = "row",
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  variant?: "row" | "card";
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      className={cn(
        "h-5 w-5 rounded-[6px] border grid place-items-center transition-colors shrink-0",
        variant === "card" && "bg-card shadow-soft",
        checked
          ? "bg-foreground border-foreground text-background"
          : "border-border hover:border-foreground/40 bg-background",
      )}
    >
      {checked && <Check className="h-3 w-3" strokeWidth={3} />}
    </button>
  );
}

function SelectAllCheckbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={checked ? "Deseleccionar todo" : "Seleccionar todo"}
      onClick={onChange}
      className={cn(
        "h-4 w-4 rounded-[4px] border grid place-items-center transition-colors",
        checked ? "bg-foreground border-foreground text-background" : "border-border hover:border-foreground/40 bg-background",
      )}
    >
      {checked && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
    </button>
  );
}

function Metric({
  value, highlight = false, accent, onClick,
}: {
  value: number | string;
  highlight?: boolean;
  accent?: "success";
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-sm tabular-nums text-right self-start pt-0.5 w-full",
        accent === "success" ? "text-success font-semibold"
          : highlight ? "text-foreground font-semibold"
          : "text-muted-foreground font-medium",
      )}
    >
      {value === 0 || value === "0%" ? <span className="text-muted-foreground/50">—</span> : value}
    </button>
  );
}

function MetricBlock({
  label, value, accent,
}: {
  label: string;
  value: number | string;
  accent?: "success";
}) {
  return (
    <div className="text-center min-w-0">
      <p className={cn(
        "text-[13px] font-bold tabular-nums leading-none truncate",
        accent === "success" ? "text-success" : "text-foreground",
      )}>
        {value === 0 ? <span className="text-muted-foreground/50 font-medium">—</span> : value}
      </p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1 truncate">{label}</p>
    </div>
  );
}

function QuickActionTile({
  icon: Icon, count, label, hint, onClick, index = 0,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  count: number;
  label: string;
  hint: string;
  onClick: () => void;
  /** Orden de entrada · se usa como delay de la animación. */
  index?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ animationDelay: `${index * 90}ms` }}
      className={cn(
        "group relative flex items-center gap-3 rounded-2xl border px-4 py-3 text-left shadow-soft transition-all",
        "border-foreground/15 bg-card hover:border-foreground/30 hover:shadow-soft-lg",
        "animate-quick-tile-in",
      )}
    >
      {/* Halo pulsante · llama la atención al entrar */}
      <span aria-hidden className="absolute inset-0 rounded-2xl ring-0 ring-foreground/20 animate-attention-pulse pointer-events-none" />

      <span className="relative h-10 w-10 rounded-lg bg-foreground/5 group-hover:bg-foreground/10 flex items-center justify-center shrink-0 transition-colors">
        <Icon className="h-4 w-4 text-foreground" strokeWidth={1.75} />
        {/* Dot indicador · pulsante para marcar que hay contenido pendiente */}
        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-warning ring-2 ring-card animate-ping-slow" />
        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-warning ring-2 ring-card" />
      </span>

      <span className="relative flex-1 min-w-0">
        <span className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-foreground truncate">{label}</span>
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-warning text-background text-[10.5px] font-bold tabular-nums">
            {count}
          </span>
        </span>
        <span className="block text-[11.5px] text-muted-foreground truncate mt-0.5">{hint}</span>
      </span>
      <ChevronRight className="relative h-4 w-4 text-muted-foreground/50 group-hover:text-foreground transition-colors shrink-0" strokeWidth={1.5} />
    </button>
  );
}

function MarketFlags({ isoList, max = 5 }: { isoList: string[]; max?: number }) {
  const visible = isoList.slice(0, max);
  const rest = isoList.length - visible.length;
  return (
    <div className="flex items-center gap-1.5" title={`Mercados: ${isoList.join(", ")}`}>
      {visible.map((iso) => (
        <Flag key={iso} iso={iso} size={14} shape="rect" />
      ))}
      {rest > 0 && (
        <span className="ml-0.5 text-[10.5px] text-muted-foreground tabular-nums font-medium">+{rest}</span>
      )}
    </div>
  );
}

/* ══════ EmptyStatePanel · estado vacío grande para los casos en
 *         que la promoción no está aún compartida, incompleta, en
 *         borrador, o sin agencias. Reemplaza al KPI strip + tabla
 *         para que el usuario entienda de un vistazo el porqué. */
function EmptyStatePanel({
  icon: Icon, eyebrow, title, description, primaryCta,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  eyebrow: string;
  title: string;
  description: string;
  primaryCta: {
    label: string;
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    onClick: () => void;
  } | null;
}) {
  const CtaIcon = primaryCta?.icon;
  return (
    <div className="rounded-2xl border border-border bg-card shadow-soft p-8 sm:p-12 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/50 mb-4">
        <Icon className="h-5 w-5 text-foreground" strokeWidth={1.5} />
      </span>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {eyebrow}
      </p>
      <h2 className="text-[18px] sm:text-[20px] font-bold tracking-tight text-foreground leading-tight mt-1.5 max-w-md mx-auto">
        {title}
      </h2>
      <p className="text-[13px] text-muted-foreground leading-relaxed mt-2 max-w-lg mx-auto">
        {description}
      </p>
      {primaryCta && CtaIcon && (
        <button
          type="button"
          onClick={primaryCta.onClick}
          className="mt-5 inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors"
        >
          <CtaIcon className="h-3.5 w-3.5" strokeWidth={2} />
          {primaryCta.label}
        </button>
      )}
    </div>
  );
}

/* ══════ StatusChips · contrato + cobertura ══════
 * Fila compacta de indicadores con tokens semánticos. Responde a:
 *   - ¿El contrato sigue vigente?
 *   - ¿La agencia colabora en todas mis promociones o solo en algunas?
 */
function StatusChips({ agency: a }: { agency: Agency }) {
  const contract = getContractStatus(a);
  const stats = getAgencyShareStats(a);
  const shared = stats.sharedActive;
  const total = stats.activeTotal;
  const inAll = total > 0 && shared === total;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Contrato */}
      {contract.state === "vigente" && (
        <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full border border-success/25 bg-success/10 text-[10.5px] font-medium text-success">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Contrato vigente
        </span>
      )}
      {contract.state === "por-expirar" && (
        <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full border border-warning/30 bg-warning/10 text-[10.5px] font-medium text-warning">
          <span className="h-1.5 w-1.5 rounded-full bg-warning" />
          Expira en {contract.daysLeft}d
        </span>
      )}
      {contract.state === "expirado" && (
        <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full border border-destructive/30 bg-destructive/10 text-[10.5px] font-medium text-destructive">
          <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
          Contrato expirado
        </span>
      )}
      {contract.state === "sin-contrato" && (
        <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full border border-border bg-muted/40 text-[10.5px] font-medium text-muted-foreground">
          Sin contrato
        </span>
      )}

      {/* Cobertura de promociones */}
      {total > 0 && (
        <span className={cn(
          "inline-flex items-center gap-1 h-5 px-2 rounded-full border text-[10.5px] font-medium",
          inAll
            ? "border-foreground/15 bg-foreground/5 text-foreground"
            : "border-border bg-muted/40 text-muted-foreground",
        )}>
          <span className="tabular-nums">{shared}/{total}</span>
          {inAll
            ? "promociones · todas"
            : shared === 1 ? "promoción" : "promociones"}
        </span>
      )}
    </div>
  );
}

/* ══════ TopBadge · trofeo suave junto al nombre cuando la agencia
 *         lidera alguna métrica (ventas, visitas o registros). */
const TOP_LABELS = {
  ventas:    "Top ventas",
  visitas:   "Top visitas",
  registros: "Top registros",
} as const;

function TopBadge({ categories }: { categories: Array<"ventas" | "visitas" | "registros"> }) {
  if (!categories.length) return null;
  const title = categories.map((c) => TOP_LABELS[c]).join(" · ");
  return (
    <span
      title={title}
      className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-warning/10 text-warning shrink-0"
    >
      <Trophy className="h-2.5 w-2.5" strokeWidth={2.25} />
    </span>
  );
}

/* ══════ FavoriteStar · botón estrella con toggle ══════ */
function FavoriteStar({
  active, onToggle, size = "md",
}: {
  active: boolean;
  onToggle: () => void;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-6 w-6" : "h-7 w-7";
  const icon = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      aria-pressed={active}
      aria-label={active ? "Quitar de favoritos" : "Añadir a favoritos"}
      title={active ? "Favorita" : "Marcar como favorita"}
      className={cn(
        "inline-flex items-center justify-center rounded-full transition-colors shrink-0",
        dim,
        active
          ? "text-warning hover:bg-warning/10"
          : "text-muted-foreground/60 hover:text-foreground hover:bg-muted",
      )}
    >
      <Star className={cn(icon, active && "fill-warning text-warning")} strokeWidth={1.75} />
    </button>
  );
}

/* ══════ SelectAllBanner · patrón Gmail/HubSpot ══════
 * Se muestra solo cuando la página actual está completamente
 * seleccionada y hay más resultados en otras páginas · ofrece un
 * atajo para seleccionar los N totales filtrados. Si ya están todos,
 * permite deshacer.
 */
function SelectAllBanner({
  pageAllSelected, allFilteredSelected, pageCount, totalCount,
  onSelectAllFiltered, onClearSelection,
}: {
  pageAllSelected: boolean;
  allFilteredSelected: boolean;
  pageCount: number;
  totalCount: number;
  onSelectAllFiltered: () => void;
  onClearSelection: () => void;
}) {
  if (!pageAllSelected || totalCount <= pageCount) return null;
  return (
    <div className="px-5 py-2 bg-muted/40 border-y border-border/40 flex items-center justify-center gap-2 text-[11.5px] flex-wrap">
      {allFilteredSelected ? (
        <>
          <span className="text-foreground font-medium">
            Seleccionadas las {totalCount} agencias de esta búsqueda.
          </span>
          <button
            type="button"
            onClick={onClearSelection}
            className="text-foreground font-semibold hover:underline"
          >
            Limpiar selección
          </button>
        </>
      ) : (
        <>
          <span className="text-muted-foreground">
            Seleccionadas las {pageCount} de esta página.
          </span>
          <button
            type="button"
            onClick={onSelectAllFiltered}
            className="text-foreground font-semibold hover:underline"
          >
            Seleccionar las {totalCount} de la búsqueda
          </button>
        </>
      )}
    </div>
  );
}

/* ══════ Pagination · controles compactos ══════ */
function Pagination({
  page, totalPages, pageStart, pageEnd, totalCount, onChange,
}: {
  page: number;
  totalPages: number;
  pageStart: number;
  pageEnd: number;
  totalCount: number;
  onChange: (p: number) => void;
}) {
  const visible = useMemo<Array<number | "…">>(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const out: Array<number | "…"> = [1];
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    if (start > 2) out.push("…");
    for (let i = start; i <= end; i++) out.push(i);
    if (end < totalPages - 1) out.push("…");
    out.push(totalPages);
    return out;
  }, [page, totalPages]);

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <p className="text-[11.5px] text-muted-foreground tabular-nums">
        Mostrando <span className="text-foreground font-medium">{pageStart + 1}–{pageEnd}</span> de{" "}
        <span className="text-foreground font-medium">{totalCount}</span>
      </p>
      <nav className="flex items-center gap-1" aria-label="Paginación">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="h-8 w-8 grid place-items-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
        </button>
        {visible.map((v, i) =>
          v === "…" ? (
            <span key={`gap-${i}`} className="h-8 w-8 grid place-items-center text-[11px] text-muted-foreground/60">
              …
            </span>
          ) : (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              aria-current={v === page ? "page" : undefined}
              className={cn(
                "h-8 min-w-8 px-2 grid place-items-center rounded-full text-[12px] font-medium tabular-nums transition-colors",
                v === page
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              {v}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="h-8 w-8 grid place-items-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Página siguiente"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </nav>
    </div>
  );
}

function KpiStat({
  label, value, sub, accent, top,
}: {
  label: string;
  value: number | string;
  sub?: string;
  accent?: "success";
  /** Líder para esa métrica · se pinta como medalla abajo con el
   *  nombre de la agencia y el valor. Clic → abre la ficha. */
  top?: { agency: Agency; value: number; onClick: () => void } | null | undefined;
}) {
  return (
    <div className="px-5 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      {/* Valor + sub en la misma línea · mantiene la altura del bloque
          constante entre KPIs con y sin sub, y deja la medalla top
          alineada horizontalmente entre columnas. */}
      <div className="flex items-baseline gap-2 mt-1.5 min-w-0">
        <p className={cn(
          "text-[22px] font-bold tabular-nums leading-none shrink-0",
          accent === "success" ? "text-success" : "text-foreground",
        )}>
          {value}
        </p>
        {sub && (
          <p className="text-[11px] text-muted-foreground tabular-nums truncate">{sub}</p>
        )}
      </div>
      {top && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); top.onClick(); }}
          className="mt-2.5 flex w-full items-center gap-1.5 text-left group min-w-0"
          title={`Top ${label.toLowerCase()}: ${top.agency.name} · ${top.value}`}
        >
          <span className="inline-flex items-center gap-1 h-5 px-1.5 rounded-full bg-warning/10 text-warning text-[10px] font-semibold uppercase tracking-wider shrink-0">
            <Trophy className="h-2.5 w-2.5" strokeWidth={2} />
            Top
          </span>
          <span className="min-w-0 flex-1 text-[11px] text-foreground font-medium truncate group-hover:underline">
            {top.agency.name}
          </span>
          <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
            {top.value}
          </span>
        </button>
      )}
    </div>
  );
}
