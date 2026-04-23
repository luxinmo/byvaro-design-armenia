/**
 * PromotionAgenciesV2.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Diseño alternativo (V2) del tab "Agencias" de la ficha de promoción.
 *
 * QUÉ HACE
 *   Prioriza la RED sobre la tabla. En lugar de una tabla con filtros, muestra:
 *     1. Hero analítico con 3 KPIs grandes (agencias activas · países · % conv.).
 *     2. Mapa conceptual de nacionalidades (chips con bandera + contador).
 *     3. Grid responsive de cards por agencia con micro-stats y CTA "Ver perfil".
 *     4. Empty state con CTA "Invitar la primera agencia".
 *     5. Botón flotante superior derecho "Invitar agencia".
 *
 * CÓMO SE USA
 *   <PromotionAgenciesV2 promotionId={p.id} onInviteAgency={() => openDialog()} />
 *
 * NOTAS
 *   - Solo diseño (sin lógica real). Datos mock internos al archivo.
 *   - Usa SOLO tokens Byvaro (bg-card, text-muted-foreground…) — nada de hex
 *     ni clases Tailwind crudas tipo bg-red-500.
 *   - Mobile-first: 1 col → sm: 2 cols → lg: 3 cols en el grid de cards.
 */

import { useMemo, useState } from "react";
import {
  Building2,
  Globe2,
  TrendingUp,
  UserPlus,
  MapPin,
  Mail,
  Sparkles,
  ArrowUpRight,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useInvitaciones } from "@/lib/invitaciones";
import { useFavoriteAgencies } from "@/lib/favoriteAgencies";
import { toast } from "sonner";
import { Star } from "lucide-react";

/* ══════ TIPOS Y MOCKS ══════ */

type AgencyStatus = "active" | "pending" | "inactive";

type AgencyV2 = {
  id: string;
  name: string;
  logo: string;
  country: string;
  countryIso: string;    // ISO 3166-1 alpha-2 (ES, GB, FR…) · render con <Flag>
  city: string;
  status: AgencyStatus;
  registrations: number;
  visits: number;
  sales: number;
  collaboratingSince: string;
};

const mockAgencies: AgencyV2[] = [
  {
    id: "ag-1",
    name: "Prime Properties Costa del Sol",
    logo: "https://ui-avatars.com/api/?name=PP&background=3b82f6&color=fff&size=120&font-size=0.4&bold=true",
    country: "España",
    countryIso: "ES",
    city: "Marbella",
    status: "active",
    registrations: 14,
    visits: 42,
    sales: 6,
    collaboratingSince: "Mar 2025",
  },
  {
    id: "ag-2",
    name: "Nordic Home Finders",
    logo: "https://ui-avatars.com/api/?name=NH&background=10b981&color=fff&size=120&font-size=0.4&bold=true",
    country: "Suecia",
    countryIso: "SE",
    city: "Estocolmo",
    status: "active",
    registrations: 22,
    visits: 78,
    sales: 9,
    collaboratingSince: "Ene 2025",
  },
  {
    id: "ag-3",
    name: "Dutch & Belgian Realty",
    logo: "https://ui-avatars.com/api/?name=DB&background=f59e0b&color=fff&size=120&font-size=0.4&bold=true",
    country: "Países Bajos",
    countryIso: "NL",
    city: "Amsterdam",
    status: "active",
    registrations: 8,
    visits: 31,
    sales: 2,
    collaboratingSince: "Feb 2026",
  },
  {
    id: "ag-4",
    name: "Berlin Living GmbH",
    logo: "https://ui-avatars.com/api/?name=BL&background=6366f1&color=fff&size=120&font-size=0.4&bold=true",
    country: "Alemania",
    countryIso: "DE",
    city: "Berlín",
    status: "pending",
    registrations: 0,
    visits: 0,
    sales: 0,
    collaboratingSince: "Abr 2026",
  },
  {
    id: "ag-5",
    name: "Iberia Luxury Homes",
    logo: "https://ui-avatars.com/api/?name=IL&background=8b5cf6&color=fff&size=120&font-size=0.4&bold=true",
    country: "España",
    countryIso: "ES",
    city: "Valencia",
    status: "active",
    registrations: 11,
    visits: 27,
    sales: 4,
    collaboratingSince: "Feb 2025",
  },
  {
    id: "ag-6",
    name: "Meridian Real Estate Group",
    logo: "https://ui-avatars.com/api/?name=MR&background=ef4444&color=fff&size=120&font-size=0.4&bold=true",
    country: "Reino Unido",
    countryIso: "GB",
    city: "Londres",
    status: "inactive",
    registrations: 5,
    visits: 15,
    sales: 1,
    collaboratingSince: "Jun 2024",
  },
];

const statusConfig: Record<AgencyStatus, { label: string; dot: string; text: string; bg: string }> = {
  active:   { label: "Activa",     dot: "bg-success", text: "text-success", bg: "bg-success/10" },
  pending:  { label: "Pendiente",  dot: "bg-warning",   text: "text-warning",   bg: "bg-warning/10"   },
  inactive: { label: "Inactiva",   dot: "bg-muted-foreground/60", text: "text-muted-foreground", bg: "bg-muted/50" },
};

/* ══════ COMPONENTE PRINCIPAL ══════ */

export function PromotionAgenciesV2({
  promotionId,
  onInviteAgency,
}: {
  promotionId: string;
  onInviteAgency?: () => void;
}) {
  // Invitaciones salientes pendientes asociadas a esta promoción.
  const { pendientes } = useInvitaciones();
  const invitacionesPendientesPromo = useMemo(
    () => pendientes.filter((i) => i.promocionId === promotionId),
    [pendientes, promotionId],
  );

  const [query, setQuery] = useState("");
  const [activeCountry, setActiveCountry] = useState<string | null>(null);

  /* Derivados para KPIs y chips de nacionalidad */
  const kpis = useMemo(() => {
    const active = mockAgencies.filter((a) => a.status === "active").length;
    const countries = new Set(mockAgencies.map((a) => a.country)).size;
    const totalRegs = mockAgencies.reduce((s, a) => s + a.registrations, 0);
    const totalSales = mockAgencies.reduce((s, a) => s + a.sales, 0);
    const conversion = totalRegs > 0 ? Math.round((totalSales / totalRegs) * 100) : 0;
    return { active, countries, conversion };
  }, []);

  const countryChips = useMemo(() => {
    const map = new Map<string, { country: string; flag: string; count: number }>();
    for (const a of mockAgencies) {
      const current = map.get(a.country);
      if (current) current.count += 1;
      else map.set(a.country, { country: a.country, flag: a.countryFlag, count: 1 });
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, []);

  const filteredAgencies = useMemo(() => {
    return mockAgencies.filter((a) => {
      if (activeCountry && a.country !== activeCountry) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!a.name.toLowerCase().includes(q) && !a.city.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [query, activeCountry]);

  const isEmpty = mockAgencies.length === 0;

  return (
    <div className="relative w-full space-y-6">
      {/* ─── Botón flotante "Invitar agencia" (arriba a la derecha) ─── */}
      <div className="absolute right-0 -top-2 z-10 hidden sm:block">
        <button
          type="button"
          onClick={onInviteAgency}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-foreground text-background text-xs font-medium shadow-soft hover:shadow-soft-lg transition-all"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Invitar agencia
        </button>
      </div>

      {/* ─── Invitaciones salientes pendientes de esta promoción ─── */}
      {invitacionesPendientesPromo.length > 0 && (
        <section className="rounded-2xl border border-border bg-card shadow-soft p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              <p className="text-sm font-semibold text-foreground">
                Invitaciones pendientes
              </p>
              <span className="text-xs text-muted-foreground tabular-nums">
                ({invitacionesPendientesPromo.length})
              </span>
            </div>
          </div>
          <ul className="space-y-2">
            {invitacionesPendientesPromo.map((inv) => {
              const dias = Math.max(
                0,
                Math.round((Date.now() - inv.createdAt) / (24 * 60 * 60 * 1000)),
              );
              return (
                <li
                  key={inv.id}
                  className="flex items-center gap-3 rounded-xl border border-border/60 bg-background p-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="h-8 w-8 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    <Building2 className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {inv.nombreAgencia || inv.emailAgencia}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {inv.emailAgencia} · {inv.comisionOfrecida}% ·{" "}
                      {inv.duracionMeses
                        ? `${inv.duracionMeses} ${inv.duracionMeses === 1 ? "mes" : "meses"}`
                        : "Indefinida"}{" "}
                      · enviada hace {dias} {dias === 1 ? "día" : "días"}
                    </p>
                  </div>
                  <span className="text-[10px] font-medium text-warning bg-warning/10 border border-warning/25 px-2 py-0.5 rounded-full shrink-0">
                    Pendiente
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {isEmpty ? (
        <EmptyState onInviteAgency={onInviteAgency} />
      ) : (
        <>
          {/* ═══ 1. HERO ANALÍTICO ═══ */}
          <section className="rounded-2xl border border-border bg-card shadow-soft p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1">
                  Red de colaboración
                </p>
                <h2 className="text-sm font-semibold text-foreground">
                  Tu red internacional en esta promoción
                </h2>
              </div>
              {/* CTA móvil (el desktop va en el FAB) */}
              <button
                type="button"
                onClick={onInviteAgency}
                className="sm:hidden inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-foreground text-background text-xs font-medium shadow-soft"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Invitar
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <HeroKpi
                icon={Building2}
                label="Agencias activas"
                value={String(kpis.active)}
                helper={`${mockAgencies.length} colaboradoras totales`}
                accent="bg-success/10 text-success"
              />
              <HeroKpi
                icon={Globe2}
                label="Países diferentes"
                value={String(kpis.countries)}
                helper="Red multinacional"
                accent="bg-blue-50 text-blue-600"
              />
              <HeroKpi
                icon={TrendingUp}
                label="Conversión registros"
                value={`${kpis.conversion}%`}
                helper="Registros que acabaron en venta"
                accent="bg-violet-50 text-violet-600"
              />
            </div>
          </section>

          {/* ═══ 2. MAPA POR NACIONALIDADES ═══ */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1">
                  Mapa por nacionalidades
                </p>
                <h3 className="text-sm font-semibold text-foreground">
                  Origen de las agencias
                </h3>
              </div>
              {activeCountry && (
                <button
                  type="button"
                  onClick={() => setActiveCountry(null)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Limpiar filtro
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {countryChips.map((c) => {
                const isActive = activeCountry === c.country;
                return (
                  <button
                    key={c.country}
                    type="button"
                    onClick={() => setActiveCountry(isActive ? null : c.country)}
                    className={cn(
                      "inline-flex items-center gap-2 h-9 pl-2 pr-4 rounded-full border transition-all",
                      "text-xs font-medium",
                      isActive
                        ? "bg-foreground text-background border-foreground shadow-soft"
                        : "bg-card text-foreground border-border hover:border-foreground/30 hover:shadow-soft"
                    )}
                  >
                    <span
                      className={cn(
                        "h-6 w-6 rounded-full flex items-center justify-center text-base leading-none",
                        isActive ? "bg-background/10" : "bg-muted"
                      )}
                      aria-hidden
                    >
                      {c.flag}
                    </span>
                    <span>{c.country}</span>
                    <span
                      className={cn(
                        "inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-semibold",
                        isActive
                          ? "bg-background/15 text-background"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {c.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ═══ 3. GRID DE CARDS ═══ */}
          <section>
            <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-1">
                  Agencias colaboradoras
                </p>
                <h3 className="text-sm font-semibold text-foreground">
                  {filteredAgencies.length}{" "}
                  {filteredAgencies.length === 1 ? "resultado" : "resultados"}
                  {activeCountry ? ` · ${activeCountry}` : ""}
                </h3>
              </div>

              {/* Buscador inline */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar agencia o ciudad…"
                  className="w-full pl-9 pr-3 h-9 rounded-full border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-foreground/40 transition-colors"
                />
              </div>
            </div>

            {filteredAgencies.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 py-14 px-6 text-center">
                <Search className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-foreground font-medium mb-1">
                  Ninguna agencia coincide
                </p>
                <p className="text-xs text-muted-foreground">
                  Prueba a cambiar el filtro o la búsqueda.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAgencies.map((ag) => (
                  <AgencyCardV2 key={ag.id} agency={ag} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

/* ══════ HERO KPI ══════ */

function HeroKpi({
  icon: Icon,
  label,
  value,
  helper,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  helper: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4 sm:p-5 shadow-soft">
      <div className="flex items-start justify-between mb-3">
        <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", accent)}>
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="text-[28px] font-semibold text-foreground leading-none tracking-tight">
        {value}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}

/* ══════ AGENCY CARD ══════ */

function AgencyCardV2({ agency }: { agency: AgencyV2 }) {
  const s = statusConfig[agency.status];
  const { isFavorite, toggleFavorite } = useFavoriteAgencies();
  const fav = isFavorite(agency.id);

  return (
    <article
      className={cn(
        "group relative rounded-xl border border-border bg-card p-5",
        "shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 transition-all duration-200"
      )}
    >
      {/* Cabecera: avatar + nombre + estrella favorito */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-11 w-11 rounded-full overflow-hidden bg-muted shrink-0 ring-1 ring-border">
            <img
              src={agency.logo}
              alt={agency.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-foreground truncate leading-tight">
              {agency.name}
            </h4>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {agency.countryFlag} {agency.city}, {agency.country}
              </span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            toggleFavorite(agency.id);
            toast.success(fav ? "Quitado de favoritos" : "Añadido a favoritos");
          }}
          className={cn(
            "p-1.5 rounded-full transition-colors shrink-0",
            fav
              ? "text-foreground hover:bg-muted"
              : "text-muted-foreground hover:text-foreground hover:bg-muted",
          )}
          aria-label={fav ? "Quitar de favoritos" : "Añadir a favoritos"}
          aria-pressed={fav}
        >
          <Star
            className={cn("h-4 w-4", fav && "fill-foreground text-foreground")}
            strokeWidth={1.5}
          />
        </button>
      </div>

      {/* Pill de estado */}
      <div className="flex items-center gap-2 mb-4">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium",
            s.bg,
            s.text
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
          {s.label}
        </span>
        <span className="text-[10px] text-muted-foreground">
          Desde {agency.collaboratingSince}
        </span>
      </div>

      {/* Micro-stats */}
      <div className="grid grid-cols-3 gap-2 mb-4 rounded-xl bg-muted/40 p-3">
        <MicroStat label="Registros" value={agency.registrations} />
        <MicroStat label="Visitas" value={agency.visits} />
        <MicroStat label="Ventas" value={agency.sales} />
      </div>

      {/* CTA pill */}
      <button
        type="button"
        className="w-full inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-full border border-border bg-card hover:bg-muted/50 text-xs font-medium text-foreground transition-colors"
      >
        Ver perfil
        <ArrowUpRight className="h-3.5 w-3.5" />
      </button>
    </article>
  );
}

function MicroStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-sm font-semibold text-foreground tabular-nums leading-none">
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground mt-1">
        {label}
      </p>
    </div>
  );
}

/* ══════ EMPTY STATE ══════ */

function EmptyState({ onInviteAgency }: { onInviteAgency?: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 py-16 px-6">
      <div className="max-w-md mx-auto text-center">
        <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
          <Sparkles className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground mb-2">
          Aún sin red
        </p>
        <h3 className="text-base font-semibold text-foreground mb-2">
          Todavía no colabora ninguna agencia
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          Invita a tus agencias de confianza para que puedan registrar clientes,
          visitar las unidades y cerrar ventas en esta promoción.
        </p>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onInviteAgency}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-foreground text-background text-xs font-medium shadow-soft hover:shadow-soft-lg transition-all"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Invitar la primera agencia
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-border bg-card text-xs font-medium text-foreground hover:bg-muted/50 transition-colors"
          >
            <Mail className="h-3.5 w-3.5" />
            Copiar enlace público
          </button>
        </div>
      </div>
    </div>
  );
}
