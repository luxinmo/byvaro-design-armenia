/**
 * AgencyHome · Dashboard para usuarios con accountType = "agency".
 *
 * Se renderiza desde `Inicio.tsx` cuando el `useCurrentUser()` detecta
 * que el visitante es una agencia colaboradora. No tiene nada que ver
 * con el dashboard del promotor: KPIs, listas y acciones son las que
 * la agencia necesita — sus promociones asignadas, sus registros
 * propios, sus comisiones estimadas.
 *
 * TODO(backend):
 *   - GET /api/agency/home  → { kpis, proximasVisitas, promocionesAsignadas, actividadReciente }
 *   - Cada KPI con su endpoint: `/api/agency/registros?mine=1`, etc.
 */

import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText, CircleDollarSign, CalendarCheck, Building2, ArrowUpRight,
  Check, UserPlus, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/currentUser";
import { promotions } from "@/data/promotions";
import { developerOnlyPromotions } from "@/data/developerPromotions";
import { registros as records } from "@/data/records";
import { sales as salesMock, getComisionImporte } from "@/data/sales";
import { agencies } from "@/data/agencies";
import { useCreatedRegistros } from "@/lib/registrosStorage";

function formatEuro(n: number) {
  if (!Number.isFinite(n) || n === 0) return "0 €";
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K€`;
  return `${n} €`;
}

export default function AgencyHome() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const agency = useMemo(() => agencies.find((a) => a.id === user.agencyId), [user.agencyId]);

  /* Promociones donde colabora la agencia. El modelo mock marca
   * `collaboratingAgencies` en `developerOnlyPromotions`. */
  const promocionesAsignadas = useMemo(() => {
    const mine = [...developerOnlyPromotions, ...promotions.map((p) => ({ ...p, collaboratingAgencies: [] as string[] }))]
      .filter((p) => Array.isArray((p as { collaboratingAgencies?: string[] }).collaboratingAgencies)
        && ((p as { collaboratingAgencies?: string[] }).collaboratingAgencies ?? []).includes(user.agencyId ?? ""));
    return mine;
  }, [user.agencyId]);

  /* Registros propios (seed + creados). */
  const created = useCreatedRegistros();
  const misRegistros = useMemo(() => {
    const all = [...created, ...records];
    return all.filter((r) => r.agencyId === user.agencyId);
  }, [created, user.agencyId]);

  /* Ventas propias + comisión estimada. */
  const misVentas = useMemo(
    () => salesMock.filter((v) => v.agencyId === user.agencyId),
    [user.agencyId],
  );
  const comisionEstimada = useMemo(
    () => misVentas.reduce((acc, v) => acc + getComisionImporte(v), 0),
    [misVentas],
  );
  const ventasEsteMes = useMemo(() => {
    const now = new Date();
    return misVentas.filter((v) => {
      const d = new Date(v.fechaReserva ?? v.fechaContrato ?? v.fechaEscritura ?? now);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
  }, [misVentas]);

  const proximasVisitas = useMemo(
    () => misRegistros
      .filter((r) => r.tipo === "registration_visit")
      .slice(0, 3),
    [misRegistros],
  );

  const firstName = user.name.split(" ")[0] ?? user.name;

  return (
    <div className="flex-1 flex flex-col min-h-full bg-background">
      {/* Header */}
      <div className="px-3 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground font-medium">
              {agency ? `${agency.name} · Agencia colaboradora` : "Agencia colaboradora"}
            </p>
            <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight mt-1 leading-tight">
              Hola, {firstName}
              <span className="text-muted-foreground font-medium"> · tu panel de colaboración</span>
            </h1>
          </div>
          <button
            onClick={() => navigate("/promociones")}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-foreground text-background text-sm font-medium shadow-soft hover:bg-foreground/90 transition-colors"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Registrar cliente
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="px-3 sm:px-6 lg:px-8 mt-6 pb-8">
        <div className="max-w-[1400px] mx-auto space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <AgencyKpi
              icon={Building2}
              label="Promociones asignadas"
              value={String(promocionesAsignadas.length)}
              sub="donde colaboras"
              tone="bg-primary/10"
              iconColor="text-primary"
            />
            <AgencyKpi
              icon={FileText}
              label="Tus registros"
              value={String(misRegistros.length)}
              sub={`${misRegistros.filter((r) => r.estado === "aprobado").length} aprobados`}
              tone="bg-success/10"
              iconColor="text-success"
            />
            <AgencyKpi
              icon={CircleDollarSign}
              label="Comisiones estimadas"
              value={formatEuro(comisionEstimada)}
              sub={`${ventasEsteMes} ventas este mes`}
              tone="bg-foreground/5"
              iconColor="text-foreground"
            />
            <AgencyKpi
              icon={CalendarCheck}
              label="Próximas visitas"
              value={String(proximasVisitas.length)}
              sub="en tus registros"
              tone="bg-warning/10"
              iconColor="text-warning"
            />
          </div>

          {/* Promociones asignadas */}
          <div className="bg-card rounded-2xl border border-border shadow-soft">
            <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-border/60">
              <div>
                <h2 className="text-base font-bold">Promociones donde colaboras</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Click en una promoción para registrar clientes o ver disponibilidad.
                </p>
              </div>
              <button
                onClick={() => navigate("/promociones")}
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Ver todas <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            {promocionesAsignadas.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Aún no colaboras en ninguna promoción.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {promocionesAsignadas.slice(0, 5).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/promociones/${p.id}`)}
                    className="w-full flex items-center gap-4 px-4 sm:px-5 py-3 hover:bg-muted/30 transition-colors text-left"
                  >
                    <div className="h-10 w-10 rounded-xl bg-muted grid place-items-center shrink-0">
                      <Building2 className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{p.location}</p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Actividad reciente de tus registros */}
          <div className="bg-card rounded-2xl border border-border shadow-soft">
            <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-border/60">
              <div>
                <h2 className="text-base font-bold">Tu actividad reciente</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Últimos registros y visitas que has creado.</p>
              </div>
              <button
                onClick={() => navigate("/registros")}
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Ver todos <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
            {misRegistros.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Aún no has creado registros. Abre una promoción y pulsa "Registrar cliente".
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {misRegistros.slice(0, 5).map((r) => (
                  <div key={r.id} className="flex items-center gap-3 px-4 sm:px-5 py-3">
                    <div className={cn(
                      "h-8 w-8 rounded-full grid place-items-center shrink-0",
                      r.estado === "aprobado" ? "bg-success/10 text-success" :
                      r.estado === "rechazado" ? "bg-destructive/10 text-destructive" :
                      "bg-warning/10 text-warning",
                    )}>
                      <Check className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{r.cliente.nombre}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {r.tipo === "registration_visit" ? "Visita" : "Registro"} · {r.estado}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AgencyKpi({
  icon: Icon, label, value, sub, tone, iconColor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  tone: string;
  iconColor: string;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 transition-all duration-200">
      <div className={cn("h-9 w-9 rounded-xl grid place-items-center", tone)}>
        <Icon className={cn("h-4 w-4", iconColor)} />
      </div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mt-3">{label}</p>
      <p className="text-[22px] font-bold tracking-tight mt-1 leading-none">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}
