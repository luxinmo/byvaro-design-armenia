/**
 * Promociones · listado (Vista Promotor)
 *
 * Port 1:1 del DeveloperPromotions.tsx del repo original.
 * Funcionalidad idéntica, datos idénticos; solo cambia el vestido visual
 * al lenguaje Byvaro v2 (tokens HSL, rounded-2xl, shadow-soft, pill buttons).
 */

import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, NavLink, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Building2, Plus, MapPin, Users, Flame, SlidersHorizontal,
  X, AlertTriangle, Ban, Share2, TrendingUp, Check, ChevronDown,
  List, Map as MapIcon, LayoutGrid, Mail, ArrowRight, type LucideIcon,
} from "lucide-react";
import { promotions, getBuildingTypeLabel, type Promotion } from "@/data/promotions";
import { developerOnlyPromotions, type DevPromotion } from "@/data/developerPromotions";
import { unitsByPromotion } from "@/data/units";
import { agencies, countAgenciesForPromotion, type Agency } from "@/data/agencies";
import { Tag } from "@/components/ui/Tag";
import { PromocionesMap } from "@/components/promociones/PromocionesMap";
import { cn } from "@/lib/utils";
import { MinimalSort } from "@/components/ui/MinimalSort";
import { ViewToggle } from "@/components/ui/ViewToggle";
import { listDrafts, deleteDraft, draftToPromotionData, DRAFT_ID_PREFIX, type PromotionDraft } from "@/lib/promotionDrafts";
import { Trash2 } from "lucide-react";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { SharePromotionDialog } from "@/components/promotions/SharePromotionDialog";
import { useCurrentUser } from "@/lib/currentUser";
import { useEmpresa } from "@/lib/empresa";
import { resolveDeveloperLogo, getDeveloperAvatar } from "@/lib/developerDirectory";
import { getPromoterDisplayName } from "@/lib/promotionRole";
import { useInvitacionesForAgency } from "@/lib/invitaciones";
import { canPublishPromotion } from "@/lib/publicationRequirements";

/* ═══════════════════════════════════════════════════════════════════
   Opciones estáticas (las dinámicas se derivan de los datos en el componente)
   ═══════════════════════════════════════════════════════════════════ */

/** Aliases: normalizan variantes del dato a un único value canónico.
 *  Evita duplicados tipo "Villa" vs "Villas" en el filtro. */
const propertyTypeAliases: Record<string, string> = {
  "Villa": "Villas",
  "Villas": "Villas",
  "Apartment": "Apartments",
  "Apartments": "Apartments",
  "Townhouse": "Townhouses",
  "Townhouses": "Townhouses",
  "Penthouse": "Penthouses",
  "Penthouses": "Penthouses",
};

/** Traducción de propertyType canónico → label español */
const propertyTypeLabels: Record<string, string> = {
  "Apartments": "Apartamentos",
  "Villas": "Villas",
  "Townhouses": "Adosados",
  "Penthouses": "Áticos",
  "Duplex": "Dúplex",
  "Commercial": "Locales",
};

/** Normaliza un propertyType crudo al canónico (Villa → Villas) */
function normalizePropertyType(v: string): string {
  return propertyTypeAliases[v] ?? v;
}

const buildingTypeOptions = [
  { value: "Unifamiliar", label: "Unifamiliar" },
  { value: "Plurifamiliar", label: "Plurifamiliar" },
  { value: "Mixto", label: "Mixto" },
];

/** Precio: rangos abiertos desde X. Valor es número (umbral min). */
const priceFilterOptions = [
  { value: "200000", label: "Desde 200K€" },
  { value: "500000", label: "Desde 500K€" },
  { value: "1000000", label: "Desde 1M€" },
  { value: "2000000", label: "Desde 2M€" },
];

const sortOptions = [
  { value: "recent", label: "Recientes" },
  { value: "trending", label: "Más activas" },
  { value: "priceAsc", label: "Precio ↑" },
  { value: "priceDesc", label: "Precio ↓" },
  { value: "deliveryAsc", label: "Entrega más cercana" },
  { value: "availability", label: "Más disponibilidad" },
];

const commissionOptions = [
  { label: "3%+", value: 3 },
  { label: "4%+", value: 4 },
  { label: "5%+", value: 5 },
];
const bedroomOptions = ["1", "2", "3", "4+"];

/* ─── helpers de filtrado/ordenación ─────────────────────────────── */

/** Normalizador de zonas: mapea variantes a un catálogo oficial español
 *  para evitar duplicados tipo "Alicante" vs "Costa Blanca" o nombres raros
 *  como "Playa de San Juan". */
const zoneNormalizer: Record<string, string> = {
  "Alicante": "Costa Blanca",
  "Playa de San Juan": "Costa Blanca",
  "Málaga": "Costa del Sol",
  "Costa del Sol": "Costa del Sol",
  "Las Rozas": "Madrid",
  "Madrid": "Madrid",
  "Barcelona Coast": "Costa Catalana",
  "Barcelona": "Costa Catalana",
  "Ciudad de las Artes": "Valencia",
  "Playa Malvarrosa": "Valencia",
  "Valencia": "Valencia",
  "Girona": "Costa Brava",
  "Costa Brava": "Costa Brava",
  "Baleares": "Baleares",
  "Mallorca": "Baleares",
  "Ibiza": "Baleares",
  "Canarias": "Canarias",
};

/** Extrae la "zona" de la ubicación: "Marbella, Costa del Sol" → "Costa del Sol".
 *  Si el resultado está en el normalizador, se mapea a su versión canónica. */
function getZone(location: string): string {
  const parts = location.split(",").map(p => p.trim()).filter(Boolean);
  const raw = parts[parts.length - 1] || parts[0] || "";
  return zoneNormalizer[raw] ?? raw;
}

/** Extrae el año de la fecha de entrega: "Q3 2026" → 2026 */
function getDeliveryYear(delivery?: string): number {
  if (!delivery) return 9999;
  const match = delivery.match(/\d{4}/);
  return match ? parseInt(match[0], 10) : 9999;
}

/** Traduce un value de propertyType a su label en español */
function getPropertyTypeLabel(v: string): string {
  return propertyTypeLabels[v] || v;
}

/** Traduce el buildingType interno a su filtro */
function matchesBuildingType(promoType: string | undefined, filterValue: string): boolean {
  if (!promoType) return false;
  if (filterValue === "Unifamiliar") return promoType === "unifamiliar-single" || promoType === "unifamiliar-multiple";
  if (filterValue === "Plurifamiliar") return promoType === "plurifamiliar";
  if (filterValue === "Mixto") return promoType === "mixto";
  return false;
}

/* ═══════════════════════════════════════════════════════════════════
   Filtros avanzados (panel: comisión + dormitorios)
   ═══════════════════════════════════════════════════════════════════ */
function FiltersPanel({ minCommission, setMinCommission, bedrooms, setBedrooms }: {
  minCommission: number | null; setMinCommission: (v: number | null) => void;
  bedrooms: string | null; setBedrooms: (v: string | null) => void;
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

  const activeCount = [minCommission, bedrooms].filter(Boolean).length;

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative inline-flex items-center justify-center h-9 w-9 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        {activeCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-foreground text-background text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-semibold">
            {activeCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 bg-popover border border-border rounded-xl shadow-soft-lg z-50 w-[260px] p-4 space-y-4">
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
              Comisión mín.
            </label>
            <div className="flex gap-1">
              {commissionOptions.map(c => (
                <button
                  key={c.value}
                  onClick={() => setMinCommission(minCommission === c.value ? null : c.value)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex-1",
                    minCommission === c.value
                      ? "bg-foreground text-background"
                      : "bg-muted/40 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="h-px bg-border/60" />
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
              Dormitorios
            </label>
            <div className="flex gap-1">
              {bedroomOptions.map(b => (
                <button
                  key={b}
                  onClick={() => setBedrooms(bedrooms === b ? null : b)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-medium transition-colors flex-1",
                    bedrooms === b
                      ? "bg-foreground text-background"
                      : "bg-muted/40 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Utilidades (idénticas al original)
   ═══════════════════════════════════════════════════════════════════ */
function formatPrice(n: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

/**
 * Estado visible del tag en la card. Se deriva del estado REAL
 * (validador + canShareWithAgencies), no del campo `status` crudo
 * del mock, que puede contradecir los requisitos: el mock podía
 * tener status="active" aunque le faltaran comisiones, estructura,
 * etc. — ya no permitimos esa contradicción.
 */
function statusTag(
  p: { status: string; canShareWithAgencies?: boolean } & Promotion,
): { label: string; variant: "success" | "warning" | "muted" | "danger" } {
  if (p.status === "sold-out") return { label: "Vendida", variant: "danger" };
  if (p.status === "inactive") return { label: "Inactiva", variant: "muted" };
  if (!canPublishPromotion(p)) return { label: "Sin publicar", variant: "warning" };
  if (p.canShareWithAgencies === false) return { label: "Solo uso interno", variant: "muted" };
  return { label: "Publicada", variant: "success" };
}

type LastUnitDetail = {
  id: string;
  label: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  builtArea: number;
  terrace: number;
  floor: number;
  orientation: string;
};

function getAvailableData(promotionId: string) {
  const units = unitsByPromotion[promotionId];
  if (!units) return { typologies: [], units: [], lastUnit: null as LastUnitDetail | null };

  const available = units.filter((u) => u.status === "available");

  if (available.length === 1) {
    const u = available[0];
    const lastUnit: LastUnitDetail = {
      id: `${u.block}-${u.floor}${u.door}`,
      label: u.type === "Ático" ? "Ático" : `${u.bedrooms} Hab`,
      price: u.price,
      bedrooms: u.bedrooms,
      bathrooms: u.bathrooms,
      builtArea: u.builtArea,
      terrace: u.terrace,
      floor: u.floor,
      orientation: u.orientation,
    };
    return { typologies: [], units: [], lastUnit };
  }

  const byType = new Map<string, { price: number; unit: typeof available[0] }[]>();
  for (const u of available) {
    const label = u.type === "Ático" ? "Ático" : `${u.bedrooms} Hab`;
    if (!byType.has(label)) byType.set(label, []);
    byType.get(label)!.push({ price: u.price, unit: u });
  }

  for (const [, group] of byType) group.sort((a, b) => a.price - b.price);

  const typologies = Array.from(byType.entries())
    .map(([label, group]) => ({ label, price: group[0].price }))
    .sort((a, b) => a.price - b.price)
    .slice(0, 3);

  const shownUnits: typeof available[0][] = [];
  const usedIds = new Set<string>();

  for (const [, group] of byType) {
    const cheapest = group[0].unit;
    if (!usedIds.has(cheapest.id)) {
      shownUnits.push(cheapest);
      usedIds.add(cheapest.id);
    }
  }

  for (const u of available.sort((a, b) => a.price - b.price)) {
    if (shownUnits.length >= 3) break;
    if (!usedIds.has(u.id)) {
      shownUnits.push(u);
      usedIds.add(u.id);
    }
  }

  const unitsList = shownUnits
    .sort((a, b) => a.price - b.price)
    .slice(0, 3)
    .map((u) => ({
      id: `${u.block}-${u.floor}${u.door}`,
      label: u.type === "Ático" ? "Ático" : `${u.bedrooms} Hab`,
      price: u.price,
    }));

  return { typologies, units: unitsList, lastUnit: null as LastUnitDetail | null };
}

const TRENDING_THRESHOLD = 50;

/* ═══════════════════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
   ═══════════════════════════════════════════════════════════════════ */
export default function Promociones() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");

  // Filtros de gestión (específicos del promotor)
  const [activityFilter, setActivityFilter] = useState<string[]>([]);
  const [collabFilter, setCollabFilter] = useState<string[]>([]);

  // Filtros de búsqueda avanzada (catálogo)
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [buildingTypeFilter, setBuildingTypeFilter] = useState<string>("All");
  const [priceMin, setPriceMin] = useState<number | null>(null);
  const [priceMax, setPriceMax] = useState<number | null>(null);
  const [minBedrooms, setMinBedrooms] = useState<number | null>(null);
  const [selectedDelivery, setSelectedDelivery] = useState<string[]>([]);
  const [selectedCommissions, setSelectedCommissions] = useState<string[]>([]);

  // Agencia específica (solo si collabFilter incluye "with-agencies")
  const [agencyFilter, setAgencyFilter] = useState<string | null>(null);

  /* Filtro por promotor · permite que páginas externas (p.ej.
   * `Empresa.tsx` · "Ver todas" del Portfolio destacado) aterricen ya
   * filtradas por un promotor concreto. Acepta:
   *   · "developer-default" → workspace propio (developerOnlyPromotions).
   *   · cualquier nombre exacto → match con `p.developer` de marketplace.
   * Se inicializa de la URL (`?developer=…`) y se puede tocar desde el
   * drawer. */
  const initialDeveloper = searchParams.get("developer");
  const [developerFilter, setDeveloperFilter] = useState<string | null>(
    initialDeveloper && initialDeveloper.length > 0 ? initialDeveloper : null,
  );

  // Estado, orden, vista
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sort, setSort] = useState<string>("recent");
  const [viewMode, setViewMode] = useState<"list" | "grid" | "map">("list");
  // En móvil (<sm) siempre mostramos la lista, sin importar el
  // viewMode que hubiera elegido el usuario en desktop.
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerWidth < 640 : false
  );
  useEffect(() => {
    const onR = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);
  const effectiveViewMode = isMobile ? "list" : viewMode;

  // Drawer de filtros
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sharingPromotion, setSharingPromotion] = useState<{ id: string; name: string } | null>(null);

  // Contador de filtros activos (para badge)
  const activeFilterCount =
    activityFilter.length + collabFilter.length +
    selectedLocations.length + selectedTypes.length +
    selectedDelivery.length + selectedCommissions.length +
    (buildingTypeFilter !== "All" ? 1 : 0) +
    (priceMin !== null || priceMax !== null ? 1 : 0) +
    (minBedrooms !== null ? 1 : 0) +
    (agencyFilter !== null ? 1 : 0) +
    (developerFilter !== null ? 1 : 0);

  /* ─── Borradores (aparecen en el listado con status="incomplete") ── */
  const [drafts, setDrafts] = useState<PromotionDraft[]>(() => listDrafts());
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "byvaro-promotion-drafts") setDrafts(listDrafts());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /* ─── Dataset combinado (developer-only + legacy + borradores) ─── */
  const draftPromotions: DevPromotion[] = useMemo(
    () => drafts.map((d) => draftToPromotionData(d) as DevPromotion),
    [drafts],
  );

  /* En modo agencia, el listado sólo contiene las promociones donde la
   * agencia activa aparece en `promotionsCollaborating`. Los borradores y
   * las `developerOnly` no existen desde la óptica de la agencia. */
  const currentUser = useCurrentUser();
  const isAgencyUser = currentUser.accountType === "agency";
  const activeAgency = useMemo(
    () => (isAgencyUser ? agencies.find((a) => a.id === currentUser.agencyId) ?? null : null),
    [isAgencyUser, currentUser.agencyId],
  );

  /* Invitaciones pendientes del agente activo · se fusionan con la
     cartera oficial para que aparezcan en el mismo listado/grilla que
     el resto, con un chip "Invitación" superpuesto. */
  const agentInvitations = useInvitacionesForAgency(
    activeAgency?.id ?? "",
    activeAgency?.contactoPrincipal?.email,
  );
  const pendingInvitationPromoIds = useMemo(() => {
    const s = new Set<string>();
    for (const i of agentInvitations) {
      if (i.estado === "pendiente" && i.promocionId) s.add(i.promocionId);
    }
    return s;
  }, [agentInvitations]);


  const allPromotions: DevPromotion[] = useMemo(() => {
    if (isAgencyUser) {
      /* Agencia: une promociones públicas + developerOnly (hay agencias
       * invitadas a colaborar en ambas) y filtra por los IDs que figuran
       * en `promotionsCollaborating` de la agencia activa O en
       * invitaciones pendientes (para que aparezcan junto al resto
       * con el chip "Invitación"). */
      const collaboratingIds = new Set(activeAgency?.promotionsCollaborating ?? []);
      for (const id of pendingInvitationPromoIds) collaboratingIds.add(id);
      const pool: DevPromotion[] = [
        ...developerOnlyPromotions,
        ...promotions.map((p) => ({ ...p } as DevPromotion)),
      ];
      return pool
        .filter((p) => {
          if (!collaboratingIds.has(p.id)) return false;
          if (p.status !== "active") return false;
          /* `canPublishPromotion` valida si EL DUEÑO de la promo
             (promotor / comercializador) puede publicarla · no aplica
             al lado agencia · las que llegan a `promotionsCollaborating`
             ya pasaron ese gate del owner. Si re-validáramos aquí,
             leeríamos `byvaro-empresa` del localStorage de la agencia
             (que NO es el workspace del owner) y filtraríamos en falso.
             Bug encontrado · ver REGLA DE ORO en CLAUDE.md. */
          if ((p as DevPromotion).canShareWithAgencies === false) return false;
          return true;
        })
        /* Las invitaciones arriba del todo · llaman más a la acción. */
        .sort((a, b) => {
          const aPending = pendingInvitationPromoIds.has(a.id) ? 0 : 1;
          const bPending = pendingInvitationPromoIds.has(b.id) ? 0 : 1;
          return aPending - bPending;
        });
    }
    return [...draftPromotions, ...developerOnlyPromotions, ...promotions.map((p) => ({ ...p } as DevPromotion))];
  }, [draftPromotions, isAgencyUser, activeAgency, pendingInvitationPromoIds]);

  /* ─── Opciones de filtros de GESTIÓN (fijas) ─── */
  const activityOptions = [
    { value: "new", label: "Nueva" },
    { value: "last-units", label: "Últimas unidades" },
    { value: "high-demand", label: "Demanda alta" },
    { value: "inactive", label: "Sin actividad" },
  ];
  const collabOptions = [
    { value: "with-agencies", label: "Con agencias" },
    { value: "without", label: "Sin agencias" },
  ];

  /* ─── Opciones estáticas de BÚSQUEDA AVANZADA ─── */
  const buildingTypeOptions = [
    { value: "Unifamiliar", label: "Unifamiliar" },
    { value: "Plurifamiliar", label: "Plurifamiliar" },
    { value: "Mixto", label: "Mixto" },
  ];
  const bedroomOptions = [
    { value: "1", label: "1+ hab" },
    { value: "2", label: "2+ hab" },
    { value: "3", label: "3+ hab" },
    { value: "4", label: "4+ hab" },
  ];
  const commissionFilterOptions = [
    { value: "3", label: "3%+" },
    { value: "4", label: "4%+" },
    { value: "5", label: "5%+" },
  ];

  /* Logo del workspace propio · si el promotor ha subido logo en
   * /empresa, ese es el avatar; si no, fallback al directorio
   * canónico (Luxinmo) y por último al dicebear determinista. */
  const { empresa: ownEmpresa } = useEmpresa();
  const ownLogo = ownEmpresa.logoUrl
    || resolveDeveloperLogo({ id: "developer-default", name: ownEmpresa.nombreComercial || "Luxinmo" });
  const ownLabel = ownEmpresa.nombreComercial || "Luxinmo";

  /* Promotores presentes en los datos · "developer-default" para el
   * workspace propio + nombres únicos de marketplace promotions. Cada
   * opción incluye logo (real cuando se conoce, dicebear de fallback)
   * + count de promociones para el buscador con avatares del drawer. */
  const developerOptions = useMemo(() => {
    type Opt = { value: string; label: string; logoUrl: string; promosCount: number; subtitle?: string };
    const map = new Map<string, Opt>();
    if (developerOnlyPromotions.length > 0) {
      map.set("developer-default", {
        value: "developer-default",
        label: ownLabel,
        logoUrl: ownLogo,
        promosCount: 0,
        subtitle: "Workspace",
      });
    }
    for (const p of allPromotions) {
      if ((p as DevPromotion).id && (p as DevPromotion).developer === "" && developerOnlyPromotions.some((x) => x.id === p.id)) {
        const o = map.get("developer-default");
        if (o) o.promosCount += 1;
        continue;
      }
      const name = p.developer;
      if (!name) continue;
      const existing = map.get(name);
      if (existing) {
        existing.promosCount += 1;
      } else {
        map.set(name, {
          value: name,
          label: name,
          logoUrl: resolveDeveloperLogo({ name }),
          promosCount: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [allPromotions, ownLabel, ownLogo]);

  /* ─── Opciones DINÁMICAS derivadas de los datos reales ─── */
  const locationOptions = useMemo(() => {
    const zones = new Set<string>();
    allPromotions.forEach(p => {
      const z = getZone(p.location);
      if (z) zones.add(z);
    });
    return Array.from(zones).sort().map(z => ({ value: z, label: z }));
  }, [allPromotions]);

  const propertyTypeOptions = useMemo(() => {
    const types = new Set<string>();
    allPromotions.forEach(p => p.propertyTypes.forEach(t => types.add(normalizePropertyType(t))));
    return Array.from(types).sort().map(t => ({ value: t, label: getPropertyTypeLabel(t) }));
  }, [allPromotions]);

  const deliveryOptions = useMemo(() => {
    const years = new Set<string>();
    allPromotions.forEach(p => {
      const y = getDeliveryYear(p.delivery);
      if (y !== 9999) years.add(String(y));
    });
    return [
      { value: "ready", label: "Inmediata" },
      ...Array.from(years).sort().map(y => ({ value: y, label: y })),
    ];
  }, [allPromotions]);

  /* ─── "Limpiar todo" ─── */
  const hasFilters = activeFilterCount > 0;

  const clearAllFilters = () => {
    setSearch("");
    setActivityFilter([]); setCollabFilter([]); setAgencyFilter(null);
    setDeveloperFilter(null);
    setSelectedLocations([]); setSelectedTypes([]); setBuildingTypeFilter("All");
    setPriceMin(null); setPriceMax(null); setMinBedrooms(null);
    setSelectedDelivery([]); setSelectedCommissions([]);
    setStatusFilter("all");
  };

  // En móvil: sólo Activas / Incompletas / Vendidas (el "Todas" es
  // implícito al no tener ninguno seleccionado). Mantenemos "Todas"
  // como opción visible desde sm+ para consistencia.
  const statusFilterOptions = [
    { key: "all", label: "Todas", mobile: false },
    { key: "active", label: "Activas", mobile: true },
    { key: "published", label: "Publicadas", mobile: true },
    { key: "incomplete", label: "Incompletas", mobile: true },
    { key: "sold-out", label: "Vendidas", mobile: true },
  ] as const;

  /* Set de IDs del workspace propio · usado para el sentinel
   * `developer-default` del filtro. */
  const workspaceDeveloperIds = useMemo(
    () => new Set(developerOnlyPromotions.map((p) => p.id)),
    [],
  );

  /* ─── Filtrado (gestión + búsqueda avanzada combinadas) ─── */
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allPromotions.filter(p => {
      // Estado (tabs) · "published" es derivado (status=active + requisitos
      // de publicación OK + canShareWithAgencies !== false). Solo aplica
      // al lado promotor · agencia no debe re-validar `canPublishPromotion`
      // (lee `byvaro-empresa` del workspace propio, que NO es el del owner).
      if (statusFilter === "published") {
        if (p.status !== "active") return false;
        if (!isAgencyUser && !canPublishPromotion(p as unknown as Promotion)) return false;
        if ((p as DevPromotion).canShareWithAgencies === false) return false;
      } else if (statusFilter !== "all" && p.status !== statusFilter) {
        return false;
      }

      // Búsqueda textual (nombre, ubicación, código, developer)
      if (q) {
        const hay = p.name.toLowerCase().includes(q)
          || p.location.toLowerCase().includes(q)
          || p.code.toLowerCase().includes(q)
          || (p.developer?.toLowerCase().includes(q) ?? false);
        if (!hay) return false;
      }

      // ──────── Gestión ────────
      if (activityFilter.length > 0) {
        const ok = activityFilter.some(f => {
          if (f === "new") return p.badge === "new";
          if (f === "last-units") return p.badge === "last-units";
          if (f === "high-demand") return (p.activity?.inquiries ?? 0) >= 20;
          if (f === "inactive") return (p.activity?.inquiries ?? 0) === 0 && (p.activity?.visits ?? 0) === 0;
          return false;
        });
        if (!ok) return false;
      }
      if (collabFilter.length > 0) {
        const n = countAgenciesForPromotion(p.id);
        const ok = collabFilter.some(f => {
          if (f === "with-agencies") return n >= 1;
          if (f === "without") return n === 0;
          return false;
        });
        if (!ok) return false;
      }

      // Agencia específica (solo aplica si se eligió)
      if (agencyFilter !== null) {
        const ag = agencies.find(a => a.id === agencyFilter);
        if (!ag || !ag.promotionsCollaborating.includes(p.id)) return false;
      }

      /* Promotor (developer) · "developer-default" mapea al
       * workspace propio (developerOnlyPromotions); cualquier otro
       * valor compara contra `p.developer` (nombre del promotor en
       * marketplace). */
      if (developerFilter !== null) {
        if (developerFilter === "developer-default") {
          if (!workspaceDeveloperIds.has(p.id)) return false;
        } else {
          if (p.developer !== developerFilter) return false;
        }
      }

      // ──────── Búsqueda avanzada ────────
      if (selectedLocations.length > 0 && !selectedLocations.includes(getZone(p.location))) return false;
      if (buildingTypeFilter !== "All" && !matchesBuildingType(p.buildingType, buildingTypeFilter)) return false;
      if (selectedTypes.length > 0) {
        const normalized = p.propertyTypes.map(normalizePropertyType);
        if (!selectedTypes.some(t => normalized.includes(t))) return false;
      }

      // Precio min/max (inputs numéricos)
      if (priceMin !== null && p.priceMax < priceMin) return false;
      if (priceMax !== null && p.priceMin > priceMax) return false;

      if (selectedDelivery.length > 0) {
        const promoYear = getDeliveryYear(p.delivery);
        const ok = selectedDelivery.some(d => {
          if (d === "ready") return promoYear <= new Date().getFullYear();
          return String(promoYear) === d;
        });
        if (!ok) return false;
      }

      if (selectedCommissions.length > 0) {
        const minCom = Math.min(...selectedCommissions.map(v => parseInt(v, 10)));
        if (p.commission < minCom) return false;
      }

      // Dormitorios: umbral mínimo, la promo tiene al menos 1 unidad con >= minBedrooms habs
      if (minBedrooms !== null) {
        const units = unitsByPromotion[p.id] ?? [];
        if (!units.some(u => u.bedrooms >= minBedrooms)) return false;
      }

      return true;
    });
  }, [
    allPromotions, search, statusFilter,
    activityFilter, collabFilter, agencyFilter, developerFilter, workspaceDeveloperIds,
    selectedLocations, buildingTypeFilter, selectedTypes,
    priceMin, priceMax, minBedrooms,
    selectedDelivery, selectedCommissions,
  ]);

  /* ─── Ordenación ─── */
  const sortedAndFiltered = useMemo(() => {
    const arr = [...filtered];
    switch (sort) {
      case "trending":
        return arr.sort((a, b) => (b.activity?.trend ?? 0) - (a.activity?.trend ?? 0));
      case "priceAsc":
        return arr.sort((a, b) => a.priceMin - b.priceMin);
      case "priceDesc":
        return arr.sort((a, b) => b.priceMax - a.priceMax);
      case "deliveryAsc":
        return arr.sort((a, b) => getDeliveryYear(a.delivery) - getDeliveryYear(b.delivery));
      case "availability":
        return arr.sort((a, b) => b.availableUnits - a.availableUnits);
      case "recent":
      default:
        // 'recent' aproximado: las que tienen badge "new" primero, luego por actividad
        return arr.sort((a, b) => {
          const aNew = a.badge === "new" ? 1 : 0;
          const bNew = b.badge === "new" ? 1 : 0;
          if (aNew !== bNew) return bNew - aNew;
          return (b.activity?.inquiries ?? 0) - (a.activity?.inquiries ?? 0);
        });
    }
  }, [filtered, sort]);

  const isTrending = (p: DevPromotion) => (p.activity?.trend ?? 0) >= TRENDING_THRESHOLD;

  return (
    <div className="flex flex-col min-h-full bg-background">
      {/* ═══════════ HEADER ═══════════ */}
      <div className="px-3 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-3">
        <div className="max-w-content mx-auto flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
          {/* Title · visible en todos los breakpoints, tamaño igual a Inicio */}
          <div className="shrink-0 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground leading-none">Comercial</p>
            <h1 className="text-[19px] sm:text-[22px] font-bold tracking-tight leading-tight mt-1">Promociones</h1>
          </div>

          {/* Controles: búsqueda + FILTROS (al lado) + CTA */}
          <div className="flex items-center gap-2 sm:ml-auto flex-1 sm:flex-initial sm:max-w-[640px]">
            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 z-10" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar promoción, promotor, ubicación..."
                className="w-full h-9 pl-9 pr-9 text-sm bg-card border border-border rounded-full focus:border-primary outline-none transition-colors"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filtros (al lado del buscador) */}
            <button
              onClick={() => setFiltersOpen(true)}
              className={cn(
                "inline-flex items-center gap-1.5 h-9 px-3 sm:px-4 rounded-full border text-sm font-medium transition-colors shrink-0",
                activeFilterCount > 0
                  ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                  : "bg-card border-border text-foreground hover:border-foreground/30"
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Filtros</span>
              {activeFilterCount > 0 && (
                <span className="ml-0.5 bg-primary-foreground/20 rounded-full h-5 min-w-[20px] px-1 text-[11px] font-bold grid place-items-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {!isAgencyUser && (
              <button
                onClick={() => navigate("/crear-promocion")}
                className="inline-flex items-center gap-1.5 h-9 px-3 sm:px-4 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors shadow-soft shrink-0"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                <span className="hidden md:inline">Nueva promoción</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="h-px bg-border/60" />

      {/* ═══════════ Toolbar ═══════════ */}
      <div className="px-3 sm:px-6 lg:px-8 py-2.5">
        <div className="max-w-content mx-auto flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Izquierda: status tabs · "Todas" oculto en móvil. */}
          <div className="flex items-center gap-0.5">
            {statusFilterOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setStatusFilter(opt.key)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-[12.5px] font-medium transition-colors whitespace-nowrap",
                  !opt.mobile && "hidden sm:inline-flex",
                  statusFilter === opt.key
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Derecha: en móvil sólo la ordenación en la misma línea que
              los tabs. En sm+ contador + sort + 3 vistas. */}
          <div className="ml-auto flex items-center gap-3 sm:gap-4">
            <span className="text-xs text-muted-foreground hidden sm:inline">
              <span className="font-semibold text-foreground tnum">{sortedAndFiltered.length}</span> resultados
            </span>

            <MinimalSort value={sort} options={sortOptions} onChange={setSort} label="Ordenar por" />

            {/* Toggle Lista / Cuadrícula / Mapa — sólo desde sm+. En
                móvil mostramos una sola vista (lista) para simplificar. */}
            <ViewToggle
              value={viewMode}
              onChange={setViewMode}
              iconOnly
              hiddenOnMobile
              options={[
                { value: "list", icon: List,       label: "Lista" },
                { value: "grid", icon: LayoutGrid, label: "Cuadrícula" },
                { value: "map",  icon: MapIcon,    label: "Mapa" },
              ]}
            />
          </div>
        </div>
      </div>

      {/* ═══════════ Vista MAPA ═══════════ */}
      {effectiveViewMode === "map" && (
        <div className="flex-1 px-3 sm:px-6 lg:px-8 pb-8">
          <div className="max-w-content mx-auto">
            <PromocionesMap promotions={sortedAndFiltered} />
          </div>
        </div>
      )}

      {/* ═══════════ Vista CUADRÍCULA ═══════════ */}
      {effectiveViewMode === "grid" && (
        <div className="flex-1 px-3 sm:px-6 lg:px-8 pb-8">
          <div className="max-w-content mx-auto">
            {sortedAndFiltered.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {sortedAndFiltered.map(p => {
                  const isInvitation = isAgencyUser && pendingInvitationPromoIds.has(p.id);
                  return (
                    <div key={p.id} className="relative">
                      <PromoCardCompact promo={p} isTrending={isTrending(p)} />
                      {isInvitation && (
                        <span className="absolute top-3 right-3 inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-destructive text-destructive-foreground text-[10.5px] font-semibold shadow-soft pointer-events-none">
                          <Mail className="h-3 w-3" strokeWidth={2.25} />
                          Invitación
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════ Vista LISTA (horizontal cards) ═══════════ */}
      {effectiveViewMode === "list" && (
      <div className="flex-1 px-3 sm:px-6 lg:px-8 pb-8">
        <div className="max-w-content mx-auto flex flex-col gap-3 lg:gap-4">
          {sortedAndFiltered.length === 0 ? (
            <EmptyState />
          ) : (
            sortedAndFiltered.map((p) => {
              const badgeLabel = p.badge === "new" ? "Nueva" : p.badge === "last-units" ? "Últimas unidades" : null;
              const status = statusTag(p);
              const { typologies, units: availableUnits, lastUnit } = getAvailableData(p.id);
              const trending = isTrending(p);
              const hasMissing = p.missingSteps && p.missingSteps.length > 0;

              const isDraft = p.id.startsWith(DRAFT_ID_PREFIX);
              // Tanto incompletas (draft) como publicadas abren la ficha de
              // promoción. En incompletas los bloques se pintan con borde
              // rojo (status="incomplete" + missingSteps) · el usuario
              // puede completar cada campo desde ahí.
              const navigateTarget = () => navigate(`/promociones/${encodeURIComponent(p.code || p.id)}`);

              return (
                <article
                  key={p.id}
                  onClick={navigateTarget}
                  className={cn(
                    "group flex flex-col xl:flex-row bg-card border rounded-2xl overflow-hidden shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer",
                    isDraft
                      ? "border-dashed border-primary/40"
                      : hasMissing
                      ? "border-border"
                      : trending
                      ? "border-border ring-1 ring-warning/40"
                      : "border-border"
                  )}
                >
                  {/* Image */}
                  <div className="relative w-full xl:w-[580px] aspect-[4/3] xl:aspect-auto xl:h-[384px] shrink-0 overflow-hidden bg-muted">
                    {p.image ? (
                      <>
                        <img
                          src={p.image}
                          alt={p.name}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                          loading="lazy"
                        />
                        {badgeLabel && (
                          <Tag variant="overlay" size="sm" shape="pill" className="absolute top-3 left-3 shadow-soft">
                            {badgeLabel}
                          </Tag>
                        )}
                        {trending && (
                          <Tag variant="trending" size="sm" shape="pill" icon={<Flame className="h-3 w-3" />} className="absolute top-3 right-3">
                            Trending
                          </Tag>
                        )}
                        {isAgencyUser && pendingInvitationPromoIds.has(p.id) && (
                          <span className="absolute top-3 right-3 inline-flex items-center gap-1 h-6 px-2.5 rounded-full bg-destructive text-destructive-foreground text-[10.5px] font-semibold shadow-soft">
                            <Mail className="h-3 w-3" strokeWidth={2.25} />
                            Invitación
                          </span>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Building2 className="h-10 w-10 text-muted-foreground/15" />
                      </div>
                    )}
                    {isDraft && (
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const ok = await confirm({
                            title: "¿Descartar borrador?",
                            description: `"${p.name}" se eliminará permanentemente.`,
                            confirmLabel: "Descartar",
                            variant: "destructive",
                          });
                          if (!ok) return;
                          const rawId = p.id.slice(DRAFT_ID_PREFIX.length);
                          deleteDraft(rawId);
                          setDrafts(listDrafts());
                        }}
                        className="absolute top-3 right-3 h-8 w-8 inline-flex items-center justify-center rounded-full bg-background/85 backdrop-blur-sm text-muted-foreground hover:text-destructive hover:bg-background opacity-0 group-hover:opacity-100 transition-all shadow-soft"
                        aria-label="Descartar borrador"
                        title="Descartar borrador"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-4 sm:p-5 flex flex-col min-w-0">
                    {/* Top row: location + building type + status */}
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase truncate">
                          {p.location || "Sin ubicación"}
                        </p>
                        {getBuildingTypeLabel(p.buildingType) && (
                          <Tag variant="default" size="sm" className="shrink-0 hidden sm:inline-flex">
                            {getBuildingTypeLabel(p.buildingType)}
                          </Tag>
                        )}
                      </div>
                      <Tag variant={status.variant} size="sm" className="shrink-0">
                        {status.label}
                      </Tag>
                    </div>

                    {/* Name + developer + delivery */}
                    <h3 className="text-lg lg:text-base font-bold text-foreground leading-snug mb-1">
                      {p.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-2 text-sm xl:text-xs text-muted-foreground mb-2 lg:mb-3">
                      {(() => { const n = getPromoterDisplayName(p); return n ? <span>{n}</span> : null; })()}
                      {p.delivery && (
                        <>
                          <span className="text-border">·</span>
                          <span>Entrega {p.delivery}</span>
                        </>
                      )}
                    </div>

                    {/* Missing steps · aviso neutral (gris). En el listado es
                        información, no un error — una promoción recién creada
                        naturalmente tiene pasos pendientes. El tono rojo se
                        reserva para dentro de la ficha cuando el promotor la
                        abre para publicar. */}
                    {hasMissing && (
                      <div className="flex items-start gap-2.5 mb-3 px-3 py-2.5 rounded-xl bg-muted/40 border border-border">
                        <AlertTriangle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.5} />
                        <div>
                          <p className="text-sm xl:text-xs font-semibold text-foreground mb-0.5">Pasos pendientes para publicar</p>
                          <p className="text-sm xl:text-xs text-muted-foreground">{p.missingSteps!.join(" · ")}</p>
                        </div>
                      </div>
                    )}

                    {/* Cannot share warning */}
                    {p.canShareWithAgencies === false && !hasMissing && (
                      <div className="flex items-start gap-2.5 mb-3 px-3 py-2.5 rounded-xl bg-warning/10 border border-warning/20">
                        <Ban className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm xl:text-xs font-semibold text-warning mb-0.5">No se puede compartir con agencias</p>
                          <p className="text-sm xl:text-xs text-muted-foreground">Configura comisiones en Colaboradores para habilitar el share</p>
                        </div>
                      </div>
                    )}

                    {/* Metrics row */}
                    <div className="flex items-center gap-5 xl:gap-6 mb-2 xl:mb-3">
                      <Metric label="Disponibles" value={`${p.availableUnits} / ${p.totalUnits}`} />
                      <Metric label="Comisión" value={`${p.commission}%`} />
                      {p.constructionProgress !== undefined && (
                        <Metric label="Obra" value={`${p.constructionProgress}%`} />
                      )}
                    </div>

                    {/* Trending activity box */}
                    {p.activity && trending && (
                      <div className="hidden sm:flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 px-3 py-2 rounded-xl bg-warning/10 border border-warning/20">
                        <div className="flex items-center gap-1 text-warning">
                          <TrendingUp className="h-3.5 w-3.5" />
                          <span className="text-xs font-semibold">+{p.activity.trend}%</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{p.activity.inquiries} consultas</span>
                        <span className="text-xs text-muted-foreground">{p.activity.reservations} reservas</span>
                        <span className="text-xs text-muted-foreground">{p.activity.visits} visitas</span>
                        <span className="text-[10px] text-muted-foreground/60 sm:ml-auto">Últimas 2 semanas</span>
                      </div>
                    )}

                    {/* Price */}
                    <p className="text-lg font-bold text-foreground tracking-tight mb-1 xl:mb-3">
                      {lastUnit ? formatPrice(lastUnit.price) : (
                        <>
                          {formatPrice(p.priceMin)}
                          {p.priceMax > p.priceMin && <span className="text-muted-foreground font-normal"> — </span>}
                          {p.priceMax > p.priceMin && formatPrice(p.priceMax)}
                        </>
                      )}
                    </p>

                    {/* Last unit detail */}
                    {lastUnit && (
                      <div className="hidden sm:block rounded-xl border border-border bg-muted/20 p-4 mb-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-xs font-medium text-foreground">Última unidad disponible</p>
                            <p className="text-xs text-muted-foreground">{lastUnit.label} · Unidad {lastUnit.id}</p>
                          </div>
                          <p className="text-sm font-semibold text-foreground">{formatPrice(lastUnit.price)}</p>
                        </div>
                        <div className="h-px bg-border/40 mb-3" />
                        <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                          <span className="text-xs text-muted-foreground">{lastUnit.bedrooms} hab · {lastUnit.bathrooms} baños</span>
                          <span className="text-xs text-muted-foreground">{lastUnit.builtArea} m² const.</span>
                          {lastUnit.terrace > 0 && <span className="text-xs text-muted-foreground">{lastUnit.terrace} m² terraza</span>}
                          <span className="text-xs text-muted-foreground">Planta {lastUnit.floor} · {lastUnit.orientation}</span>
                        </div>
                      </div>
                    )}

                    {/* Typologies + available units */}
                    {!lastUnit && (typologies.length > 0 || availableUnits.length > 0) && (
                      <div className="hidden sm:grid grid-cols-2 gap-3 mb-4">
                        {typologies.length > 0 && (
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Tipologías</p>
                            <div className="space-y-0.5">
                              {typologies.map((t) => (
                                <p key={t.label} className="text-xs text-foreground">
                                  {t.label} <span className="text-muted-foreground">desde</span> {formatPrice(t.price)}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                        {availableUnits.length > 0 && (
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Unidades disponibles</p>
                            <div className="space-y-0.5">
                              {availableUnits.map((u) => (
                                <p key={u.id} className="text-xs text-foreground">
                                  {u.id} <span className="text-muted-foreground">·</span> {u.label} <span className="text-muted-foreground">·</span> {formatPrice(u.price)}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="mt-auto pt-2 xl:pt-3 border-t border-border/30 flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground/60 min-w-0">
                        {(() => {
                          const realAgencies = countAgenciesForPromotion(p.id);
                          /* Se muestra siempre · 0 también es información
                             (significa que la promoción aún no tiene
                             colaboradores). Si es 0 se tiñe en gris
                             para que no compita visualmente con
                             promociones con tracción. */
                          return (
                            <span className={cn(
                              "flex items-center gap-1",
                              realAgencies > 0 ? "text-foreground/70" : "text-muted-foreground/60",
                            )}>
                              <Users className="h-3.5 w-3.5 xl:h-3 xl:w-3" />
                              {realAgencies} {realAgencies === 1 ? "agencia" : "agencias"}
                            </span>
                          );
                        })()}
                        {p.constructionProgress !== undefined && p.constructionProgress < 100 && (
                          <span>{p.constructionProgress}% obra</span>
                        )}
                        {p.hasShowFlat && <span className="hidden sm:inline">Piso piloto</span>}
                      </div>
                      {/* "Compartir con agencias" es una acción del
                          promotor. Una cuenta de agencia no comparte
                          promociones ajenas · se oculta sin dejar hueco. */}
                      {!isAgencyUser && (() => {
                        const sharingEnabled = p.canShareWithAgencies !== false;
                        const shareEnabled = p.status === "active" && !hasMissing && sharingEnabled;
                        return (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!shareEnabled) return;
                              setSharingPromotion({ id: p.id, name: p.name });
                            }}
                            disabled={!shareEnabled}
                            title={
                              !shareEnabled
                                ? (p.status !== "active"
                                    ? "Publica la promoción para compartirla"
                                    : !sharingEnabled
                                      ? "Activa compartir en Comisiones"
                                      : "Completa los pasos pendientes")
                                : undefined
                            }
                            className={cn(
                              "text-sm xl:text-xs font-medium transition-colors inline-flex items-center gap-1 shrink-0",
                              shareEnabled
                                ? "text-primary hover:text-primary/80"
                                : "text-muted-foreground/50 cursor-not-allowed",
                            )}
                          >
                            <Share2 className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Compartir con agencias</span>
                            <span className="sm:hidden">Compartir</span>
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>
      )}

      {/* ═══════════ DRAWER DE FILTROS ═══════════ */}
      <AnimatePresence>
        {filtersOpen && (
          <>
            {/* Backdrop borroso */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/25 backdrop-blur-sm"
              onClick={() => setFiltersOpen(false)}
            />
            {/* Panel lateral derecho */}
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[440px] bg-card border-l border-border shadow-soft-lg flex flex-col"
            >
              {/* Header */}
              <header className="h-14 shrink-0 flex items-center justify-between px-5 border-b border-border">
                <div>
                  <h2 className="text-[15px] font-semibold tracking-tight">Filtros</h2>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5">
                    {activeFilterCount === 0
                      ? "Ningún filtro aplicado"
                      : `${activeFilterCount} filtro${activeFilterCount > 1 ? "s" : ""} activo${activeFilterCount > 1 ? "s" : ""}`}
                  </p>
                </div>
                <button
                  onClick={() => setFiltersOpen(false)}
                  className="p-2 -mr-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Cerrar filtros"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>

              {/* Body · secciones scrollable */}
              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-7">
                <div className="space-y-5">
                  <SectionTitle>Gestión</SectionTitle>
                  <FilterGroup title="Actividad" options={activityOptions} values={activityFilter} onChange={setActivityFilter} />
                  <FilterGroup title="Colaboración" options={collabOptions} values={collabFilter} onChange={setCollabFilter} />

                  {/* Buscador de agencia específica (solo si 'Con agencias' está activo) */}
                  {collabFilter.includes("with-agencies") && (
                    <AgencySearcher
                      agencies={agencies}
                      value={agencyFilter}
                      onChange={setAgencyFilter}
                    />
                  )}
                </div>

                <div className="h-px bg-border" />

                <div className="space-y-5">
                  <SectionTitle>Búsqueda avanzada</SectionTitle>

                  {/* Filtro por promotor · buscador con avatares
                      (mismo patrón que AgencySearcher) · permite a la
                      agencia ver con qué promotores está colaborando
                      y al developer ver el catálogo agregado de
                      marketplace por promotor. */}
                  {developerOptions.length > 0 && (
                    <DeveloperSearcher
                      options={developerOptions}
                      value={developerFilter}
                      onChange={setDeveloperFilter}
                    />
                  )}

                  <SearchableFilterGroup
                    title="Ubicación"
                    options={locationOptions}
                    values={selectedLocations}
                    onChange={setSelectedLocations}
                    placeholder="Buscar zona (Marbella, Alicante...)"
                  />

                  <FilterGroup title="Tipología" options={propertyTypeOptions} values={selectedTypes} onChange={setSelectedTypes} />

                  <FilterGroup
                    title="Edificio"
                    options={buildingTypeOptions}
                    values={buildingTypeFilter === "All" ? [] : [buildingTypeFilter]}
                    onChange={(v) => setBuildingTypeFilter(v.length === 0 ? "All" : v[v.length - 1])}
                    multi={false}
                  />

                  <PriceRangeFilter
                    min={priceMin}
                    max={priceMax}
                    onMinChange={setPriceMin}
                    onMaxChange={setPriceMax}
                  />

                  <BedroomsThresholdFilter value={minBedrooms} onChange={setMinBedrooms} />

                  <FilterGroup title="Entrega" options={deliveryOptions} values={selectedDelivery} onChange={setSelectedDelivery} />
                  <FilterGroup title="Comisión" options={commissionFilterOptions} values={selectedCommissions} onChange={setSelectedCommissions} />
                </div>
              </div>

              {/* Footer sticky */}
              <footer className="h-[72px] shrink-0 border-t border-border flex items-center justify-between gap-3 px-5">
                <button
                  onClick={clearAllFilters}
                  disabled={activeFilterCount === 0}
                  className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Limpiar todo
                </button>
                <button
                  onClick={() => setFiltersOpen(false)}
                  className="inline-flex items-center h-10 px-5 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors shadow-soft"
                >
                  Ver {sortedAndFiltered.length} resultado{sortedAndFiltered.length !== 1 ? "s" : ""}
                </button>
              </footer>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Compartir promoción con agencia */}
      {sharingPromotion && (
        <SharePromotionDialog
          open={!!sharingPromotion}
          onOpenChange={(v) => { if (!v) setSharingPromotion(null); }}
          promotionId={sharingPromotion.id}
          promotionName={sharingPromotion.name}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Sub-componentes del drawer de filtros
   ═══════════════════════════════════════════════════════════════════ */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </p>
  );
}

function FilterGroup({
  title, options, values, onChange, multi = true,
}: {
  title: string;
  options: { value: string; label: string }[];
  values: string[];
  onChange: (v: string[]) => void;
  multi?: boolean;
}) {
  const toggle = (v: string) => {
    if (multi) {
      onChange(values.includes(v) ? values.filter(x => x !== v) : [...values, v]);
    } else {
      onChange(values.includes(v) ? [] : [v]);
    }
  };
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
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
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

/* ═══════════════════════════════════════════════════════════════════
   Sub-componentes
   ═══════════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════════
   SearchableFilterGroup · chips con buscador arriba (para listas largas)
   Se usa para Ubicación (muchas zonas posibles).
   ═══════════════════════════════════════════════════════════════════ */
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
    return options.filter(o => o.label.toLowerCase().includes(qq));
  }, [q, options]);
  const toggle = (v: string) =>
    onChange(values.includes(v) ? values.filter(x => x !== v) : [...values, v]);
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
      <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-[11.5px] text-muted-foreground italic px-1">Sin coincidencias</p>
        ) : (
          filtered.map(opt => {
            const selected = values.includes(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggle(opt.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[12.5px] font-medium transition-colors",
                  selected
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
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
   PriceRangeFilter · inputs numéricos min/max con formato español 500.000
   ═══════════════════════════════════════════════════════════════════ */
function PriceRangeFilter({
  min, max, onMinChange, onMaxChange,
}: {
  min: number | null;
  max: number | null;
  onMinChange: (v: number | null) => void;
  onMaxChange: (v: number | null) => void;
}) {
  const fmt = (v: number | null) => v === null ? "" : v.toLocaleString("es-ES");
  const parse = (s: string): number | null => {
    const digits = s.replace(/\D/g, "");
    if (!digits) return null;
    return parseInt(digits, 10);
  };
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="text-[13px] font-semibold text-foreground">Precio</h4>
        {(min !== null || max !== null) && (
          <button
            onClick={() => { onMinChange(null); onMaxChange(null); }}
            className="text-[11px] text-muted-foreground hover:text-destructive"
          >
            Limpiar
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="relative">
          <input
            type="text"
            inputMode="numeric"
            value={fmt(min)}
            onChange={(e) => onMinChange(parse(e.target.value))}
            placeholder="Mín."
            className="w-full h-9 pl-3 pr-8 text-sm bg-card border border-border rounded-xl focus:border-primary outline-none transition-colors tnum"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
        </div>
        <div className="relative">
          <input
            type="text"
            inputMode="numeric"
            value={fmt(max)}
            onChange={(e) => onMaxChange(parse(e.target.value))}
            placeholder="Máx."
            className="w-full h-9 pl-3 pr-8 text-sm bg-card border border-border rounded-xl focus:border-primary outline-none transition-colors tnum"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground mt-1.5">
        Formato: <span className="tnum">500.000</span> (separador de miles automático)
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   BedroomsThresholdFilter · radio-style con umbrales 1+ / 2+ / 3+ / 4+
   Seleccionar "2+" significa "al menos 2 dormitorios" → incluye 3+, 4+
   ═══════════════════════════════════════════════════════════════════ */
function BedroomsThresholdFilter({
  value, onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const thresholds = [1, 2, 3, 4];
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="text-[13px] font-semibold text-foreground">Dormitorios mínimos</h4>
        {value !== null && (
          <button onClick={() => onChange(null)} className="text-[11px] text-muted-foreground hover:text-destructive">
            Limpiar
          </button>
        )}
      </div>
      <div className="flex gap-1.5">
        {thresholds.map(n => {
          const selected = value === n;
          return (
            <button
              key={n}
              onClick={() => onChange(selected ? null : n)}
              className={cn(
                "flex-1 inline-flex items-center justify-center h-9 rounded-xl border text-sm font-medium transition-colors",
                selected
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
              )}
            >
              {n}+ hab
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   DeveloperSearcher · buscador + lista de promotores con avatares.
   Mismo patrón que AgencySearcher · selección única (o null).
   ═══════════════════════════════════════════════════════════════════ */
type DevOption = { value: string; label: string; logoUrl: string; promosCount: number; subtitle?: string };

function DeveloperSearcher({
  options, value, onChange,
}: {
  options: DevOption[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [q, setQ] = useState("");
  /* Solo buscamos cuando el usuario teclea ≥1 char · NO renderizamos
   * el catálogo entero por defecto (en backend pueden ser miles de
   * promotores · mostrar todos rompería rendimiento y UX). */
  const trimmed = q.trim();
  const isSearching = trimmed.length > 0;
  const MAX_RESULTS = 20;
  const filtered = useMemo(() => {
    if (!isSearching) return [];
    const qq = trimmed.toLowerCase();
    return options
      .filter((o) => o.label.toLowerCase().includes(qq))
      .slice(0, MAX_RESULTS);
  }, [trimmed, isSearching, options]);
  const selected = value ? options.find((o) => o.value === value) : null;

  return (
    <div className="pt-1">
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="text-[13px] font-semibold text-foreground">Promotor</h4>
        {value && (
          <button onClick={() => onChange(null)} className="text-[11px] text-muted-foreground hover:text-destructive">
            Quitar filtro
          </button>
        )}
      </div>
      {selected ? (
        <div className="flex items-center gap-2.5 p-2.5 rounded-xl border border-primary/30 bg-primary/5">
          <img
            src={selected.logoUrl}
            alt=""
            className="h-8 w-8 rounded-full bg-white object-contain p-0.5 shrink-0"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = getDeveloperAvatar(selected.label); }}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-foreground truncate">{selected.label}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {selected.subtitle ?? `${selected.promosCount} promo${selected.promosCount === 1 ? "" : "s"}`}
            </p>
          </div>
          <button onClick={() => onChange(null)} className="p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <>
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar promotor por nombre..."
              className="w-full h-8 pl-8 pr-8 text-[12.5px] bg-muted/30 border border-border rounded-full focus:bg-background focus:border-primary outline-none transition-colors"
            />
            {q && (
              <button onClick={() => setQ("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          {/* Listado · solo aparece cuando hay texto en el input.
              Sin texto = pista discreta · evitamos volcar miles de
              opciones al abrir el drawer. */}
          {!isSearching ? (
            <p className="text-[11.5px] text-muted-foreground italic px-1 py-2">
              Empieza a escribir para buscar un promotor
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-[11.5px] text-muted-foreground italic px-1 py-2">Sin coincidencias</p>
          ) : (
            <div className="space-y-1 max-h-[220px] overflow-y-auto">
              {filtered.map((o) => (
                <button
                  key={o.value}
                  onClick={() => onChange(o.value)}
                  className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/40 transition-colors text-left"
                >
                  <img
                    src={o.logoUrl}
                    alt=""
                    className="h-7 w-7 rounded-full bg-white object-contain p-0.5 shrink-0"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).src = getDeveloperAvatar(o.label); }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-medium text-foreground truncate">{o.label}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {o.subtitle ?? `${o.promosCount} promo${o.promosCount === 1 ? "" : "s"}`}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   AgencySearcher · buscador + lista de agencias colaboradoras
   Solo se renderiza cuando collabFilter incluye "with-agencies".
   Selecciona una única agencia (o null) para filtrar promos donde
   esa agencia concreta colabora.
   ═══════════════════════════════════════════════════════════════════ */
function AgencySearcher({
  agencies: items, value, onChange,
}: {
  agencies: Agency[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const qq = q.toLowerCase().trim();
    if (!qq) return items;
    return items.filter(a => a.name.toLowerCase().includes(qq) || a.location.toLowerCase().includes(qq));
  }, [q, items]);
  const selected = value ? items.find(a => a.id === value) : null;

  return (
    <div className="pt-1">
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="text-[13px] font-semibold text-foreground">Agencia específica</h4>
        {value && (
          <button onClick={() => onChange(null)} className="text-[11px] text-muted-foreground hover:text-destructive">
            Quitar filtro
          </button>
        )}
      </div>
      {selected ? (
        <div className="flex items-center gap-2.5 p-2.5 rounded-xl border border-primary/30 bg-primary/5">
          <img src={selected.logo} alt="" className="h-8 w-8 rounded-full bg-white shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-foreground truncate">{selected.name}</p>
            <p className="text-[11px] text-muted-foreground truncate">{selected.location}</p>
          </div>
          <button onClick={() => onChange(null)} className="p-1 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <>
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar agencia por nombre o ubicación..."
              className="w-full h-8 pl-8 pr-8 text-[12.5px] bg-muted/30 border border-border rounded-full focus:bg-background focus:border-primary outline-none transition-colors"
            />
            {q && (
              <button onClick={() => setQ("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="space-y-1 max-h-[160px] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-[11.5px] text-muted-foreground italic px-1 py-2">Sin coincidencias</p>
            ) : (
              filtered.map(ag => (
                <button
                  key={ag.id}
                  onClick={() => onChange(ag.id)}
                  className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/40 transition-colors text-left"
                >
                  <img src={ag.logo} alt="" className="h-7 w-7 rounded-full bg-white shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-medium text-foreground truncate">{ag.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{ag.location}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PromoCardCompact · tarjeta vertical para vista Cuadrícula
   ═══════════════════════════════════════════════════════════════════ */
function PromoCardCompact({ promo: p, isTrending }: { promo: DevPromotion; isTrending: boolean }) {
  const fmt = (n: number) =>
    new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
  return (
    <article className={cn(
      "group bg-card border rounded-2xl overflow-hidden shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer",
      isTrending ? "border-border ring-1 ring-warning/40" : "border-border"
    )}>
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {p.image && <img src={p.image} alt={p.name} className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform duration-500" loading="lazy" />}
        {isTrending && (
          <Tag variant="trending" size="sm" shape="pill" icon={<Flame className="h-3 w-3" />} className="absolute top-3 right-3">
            Trending
          </Tag>
        )}
        {p.badge && (
          <Tag variant="overlay" size="sm" shape="pill" className="absolute top-3 left-3 shadow-soft">
            {p.badge === "new" ? "Nueva" : "Últimas unidades"}
          </Tag>
        )}
      </div>
      <div className="p-4">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground truncate">{p.location}</p>
        <h3 className="text-[15px] font-bold text-foreground mt-0.5 truncate">{p.name}</h3>
        <p className="text-[11.5px] text-muted-foreground mt-0.5 truncate">
          {getPromoterDisplayName(p)} · {p.delivery}
        </p>
        <p className="text-lg font-bold text-foreground mt-2 tnum">
          {fmt(p.priceMin)}
          {p.priceMax > p.priceMin && <span className="text-muted-foreground font-normal"> — {fmt(p.priceMax)}</span>}
        </p>
        <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between text-[11.5px]">
          <span className="text-muted-foreground"><span className="font-semibold text-foreground tnum">{p.availableUnits}/{p.totalUnits}</span> disp.</span>
          <span className="text-muted-foreground"><span className="font-semibold text-foreground tnum">{p.commission}%</span> com.</span>
          {(() => {
            const realAgencies = countAgenciesForPromotion(p.id);
            return (
              <span
                className={cn(
                  "inline-flex items-center gap-1",
                  realAgencies > 0 ? "text-muted-foreground" : "text-muted-foreground/60",
                )}
                title={`${realAgencies} ${realAgencies === 1 ? "agencia colaborando" : "agencias colaborando"}`}
              >
                <Users className="h-3 w-3" /> <span className="tnum">{realAgencies}</span>
              </span>
            );
          })()}
        </div>
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs lg:text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-20 text-center">
      <div className="h-12 w-12 rounded-2xl bg-muted grid place-items-center mx-auto mb-4">
        <Search className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold">Sin resultados</h3>
      <p className="text-[12.5px] text-muted-foreground mt-1">Prueba a cambiar los filtros o la búsqueda.</p>
    </div>
  );
}

/* El import de Promotion se queda por si más adelante necesitamos tipar a fondo */
export type { Promotion };
