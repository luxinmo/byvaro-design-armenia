/**
 * ColaboradoresAgencyView · vista del listado /colaboradores cuando
 * el usuario logueado es una AGENCIA.
 *
 * Mirror del listado del promotor · en lugar de "lista de agencias
 * con las que colaboro" muestra "lista de promotores con los que
 * colaboro". En el mock single-tenant solo hay un promotor (Luxinmo
 * · sentinel `developer-default`); cuando el backend levante
 * multi-tenant, este componente itera sobre `GET /api/agency/promoters`.
 *
 * Cada card muestra:
 *   · Logo + nombre del promotor + tick verificada si aplica.
 *   · Badge de estado de la colaboración (activa · contrato pendiente
 *     · pausada).
 *   · Counter de promociones donde colabora la agencia con ese
 *     promotor.
 *   · CTA principal "Ver panel" → /promotor/:id/panel (mirror del
 *     panel operativo del promotor).
 *   · Link secundario "Ver ficha pública" → /promotor/:id.
 *
 * TODO(backend): GET /api/agency/promoters → array tipado
 * { id, name, logoUrl, verificada, estado, promotionsCollaboratingCount }.
 * Solo devuelve los promotores con vínculo activo o invitación
 * pendiente · NO el catálogo entero (a diferencia del marketplace).
 */

import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Building2, ArrowUpRight, ExternalLink } from "lucide-react";
import { useCurrentUser } from "@/lib/currentUser";
import { useEmpresa } from "@/lib/empresa";
import { AgencyGridCard } from "@/components/agencies/AgencyGridCard";
import { useFavoriteAgencies } from "@/lib/favoriteAgencies";
import {
  DEFAULT_DEVELOPER_ID,
  hasActiveDeveloperCollab,
} from "@/lib/developerNavigation";
import { agencies } from "@/data/agencies";
import { resolveDeveloperLogo, getDeveloperAvatar } from "@/lib/developerDirectory";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";

interface PromotorRow {
  id: string;
  name: string;
  logoUrl: string;
  verificada: boolean;
  estado: "activa" | "contrato-pendiente" | "pausada" | "sin-vinculo";
  promosCount: number;
}

const ESTADO_LABEL: Record<PromotorRow["estado"], { label: string; cls: string }> = {
  "activa":             { label: "Colaboración activa",  cls: "bg-success/10 text-success" },
  "contrato-pendiente": { label: "Contrato pendiente",   cls: "bg-warning/15 text-warning" },
  "pausada":            { label: "Pausada",              cls: "bg-muted text-muted-foreground" },
  "sin-vinculo":        { label: "Sin colaboración",     cls: "bg-muted text-muted-foreground" },
};

export function ColaboradoresAgencyView() {
  const user = useCurrentUser();
  /* En mock single-tenant solo existe Luxinmo · `useEmpresa` con el
   * sentinel devuelve los datos del workspace developer (logo, nombre,
   * verificada). En backend se itera sobre el array de promotores. */
  const { empresa: developerEmpresa } = useEmpresa(DEFAULT_DEVELOPER_ID);

  const myAgency = useMemo(
    () => (user.agencyId ? agencies.find(a => a.id === user.agencyId) : null),
    [user.agencyId],
  );

  const rows = useMemo<PromotorRow[]>(() => {
    /* Estado del vínculo · usamos `hasActiveDeveloperCollab` que ya
     * cubre activa / contrato-pendiente / pausada. Para refinar el
     * label, leemos el estado concreto del agency seed. */
    let estado: PromotorRow["estado"] = "sin-vinculo";
    if (myAgency) {
      if (myAgency.estadoColaboracion === "activa" || myAgency.status === "active") estado = "activa";
      else if (myAgency.estadoColaboracion === "pausada") estado = "pausada";
      else if (myAgency.estadoColaboracion === "contrato-pendiente") estado = "contrato-pendiente";
    }
    /* Sin vínculo · no mostramos el promotor (la lista está vacía). */
    if (estado === "sin-vinculo" && !hasActiveDeveloperCollab(user)) return [];

    const name = developerEmpresa.nombreComercial?.trim() || "Luxinmo";
    const logoUrl = developerEmpresa.logoUrl
      || resolveDeveloperLogo({ id: DEFAULT_DEVELOPER_ID, name });
    return [{
      id: DEFAULT_DEVELOPER_ID,
      name,
      logoUrl,
      verificada: !!developerEmpresa.verificada,
      estado,
      promosCount: myAgency?.promotionsCollaborating?.length ?? 0,
    }];
  }, [user, myAgency, developerEmpresa]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-10 max-w-reading mx-auto w-full">
      {/* Header */}
      <header className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Red
        </p>
        <h1 className="text-[19px] sm:text-[22px] font-bold tracking-tight leading-tight mt-1">
          Inmobiliarias
        </h1>
        <p className="text-[12.5px] text-muted-foreground mt-1.5 max-w-[640px] leading-relaxed">
          Promotores con los que tu agencia colabora. Click en "Ver panel" para
          acceder al panel operativo (registros, visitas, ventas, comisiones,
          contrato).
        </p>
      </header>

      {/* Listado de promotores con los que colabora */}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-[13px] font-semibold text-foreground">Sin colaboraciones todavía</p>
          <p className="text-[12px] text-muted-foreground mt-1 max-w-md mx-auto leading-relaxed">
            Cuando un promotor te invite a colaborar, aparecerá aquí. También
            puedes solicitar colaboración desde el catálogo de promociones.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((p) => (
            <PromotorCard key={p.id} row={p} />
          ))}
        </div>
      )}

      {/* Otras inmobiliarias en la red · agencias distintas a la
          propia. Útil para descubrir partners potenciales y ver con
          qué red está trabajando un mismo promotor. */}
      <OtrasInmobiliariasSection ownAgencyId={user.agencyId ?? null} />
    </div>
  );
}

function OtrasInmobiliariasSection({ ownAgencyId }: { ownAgencyId: string | null }) {
  const navigate = useNavigate();
  const { isFavorite, toggleFavorite } = useFavoriteAgencies();
  const otras = useMemo(
    () => agencies.filter((a) =>
      a.id !== ownAgencyId
      && !a.solicitudPendiente
      && !a.isNewRequest
      && a.status === "active",
    ),
    [ownAgencyId],
  );
  if (otras.length === 0) return null;
  return (
    <section className="mt-10">
      <header className="mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Red
        </p>
        <h2 className="text-base font-semibold text-foreground leading-tight mt-0.5">
          Otras inmobiliarias
        </h2>
        <p className="text-[12px] text-muted-foreground mt-1 max-w-[640px] leading-relaxed">
          Inmobiliarias que también operan en Byvaro · útil para
          ver tu red extendida.
        </p>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {otras.map((a) => (
          <AgencyGridCard
            key={a.id}
            agency={a}
            onClick={() => navigate(`/colaboradores/${a.id}`)}
            isFavorite={isFavorite(a.id)}
            onToggleFavorite={() => toggleFavorite(a.id)}
          />
        ))}
      </div>
    </section>
  );
}

function PromotorCard({ row }: { row: PromotorRow }) {
  const meta = ESTADO_LABEL[row.estado];
  return (
    <article className="rounded-2xl border border-border bg-card shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col">
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-start gap-3">
          <img
            src={row.logoUrl}
            alt=""
            className="h-12 w-12 rounded-xl bg-white object-contain p-1 border border-border shrink-0"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = getDeveloperAvatar(row.name); }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="text-[14px] font-semibold text-foreground truncate">{row.name}</h3>
              {row.verificada && <VerifiedBadge size="sm" />}
            </div>
            {/* Categoría · derivada del workspace developer · siempre
                "Promotor" en mock single-tenant. Cuando aterrice
                multi-tenant, vendrá del endpoint /categorias. */}
            <p className="text-[11.5px] font-medium text-success leading-snug mt-0.5 truncate">
              Promotor
            </p>
            <span className={`inline-flex items-center mt-1 px-1.5 h-5 rounded-full text-[10.5px] font-semibold ${meta.cls}`}>
              {meta.label}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
          <Building2 className="h-3 w-3" strokeWidth={1.75} />
          <span>
            {row.promosCount === 0
              ? "Sin promociones"
              : `${row.promosCount} promoción${row.promosCount === 1 ? "" : "es"} compartida${row.promosCount === 1 ? "" : "s"}`}
          </span>
        </div>
      </div>

      <div className="border-t border-border px-5 py-3 flex items-center gap-2">
        <Link
          to={`/promotor/${row.id}/panel`}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-foreground text-background text-[12px] font-semibold hover:bg-foreground/90 transition-colors"
        >
          Ver panel
          <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
        </Link>
        <Link
          to={`/promotor/${row.id}`}
          className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground hover:text-foreground transition-colors ml-auto"
        >
          Ficha pública
          <ExternalLink className="h-3 w-3" strokeWidth={1.75} />
        </Link>
      </div>
    </article>
  );
}
