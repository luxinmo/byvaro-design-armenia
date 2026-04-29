/**
 * AgencyGridCard v2 · tarjeta canónica para listados de agencias /
 * promotores en formato grid.
 *
 * Reutilizada por:
 *   · `/colaboradores` (listado de agencias del promotor).
 *   · `/promotores` (listado de promotores con los que colabora la agencia).
 *
 * Lo que pinta:
 *   1. Header · avatar + nombre + tick verificada + rating Google.
 *   2. Chips de estado · colaboración + contrato + incidencias
 *      (solo se pintan los que merecen atención).
 *   3. Banderas de mercados.
 *   4. Meta row · colaborando desde · agentes · oficinas · idiomas
 *      (los idiomas se muestran UNA sola vez, integrados aquí).
 *   5. Grid de 5 métricas · Visitas · Registros · Ventas · Conv · Promos.
 *
 * Acciones opcionales en la esquina sup-der:
 *   · Favorito (heart) · si `onToggleFavorite` está definido.
 *   · Selección (checkbox) · si `onToggleSelect` está definido.
 *   · Ribbon "Top" si `topBadge` es true.
 *
 * Props minimas — sólo lo que la card pinta. Sin estado interno
 * compartido · selección/favorito viven en el parent.
 */

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Star, Users2, Building, Check,
  AlertTriangle, Clock, ShieldCheck, Flame, Mail, Handshake, Send, Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Agency } from "@/data/agencies";
import { isAgencyVerified } from "@/lib/licenses";
import { getAgencyLicenses } from "@/lib/agencyLicenses";
import { getContractStatus } from "@/data/agencies";
import { getOrganizationPortfolioMetrics } from "@/lib/agencyMetrics";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { Flag } from "@/components/ui/Flag";
import {
  type EmpresaCategory,
  EMPRESA_CATEGORY_LABELS,
  getEmpresaCategories,
} from "@/lib/empresaCategories";

/** Formato compacto € · 1.2M / 450k / 320 € · usado en métrica Volumen. */
function formatEuroCompact(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "€0";
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `€${m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (n >= 1_000) return `€${Math.round(n / 1_000)}k`;
  return `€${Math.round(n)}`;
}

/** Formato corto DD/MM/YYYY · canónico para el chip "Invitada …". */
function formatInvitedDate(value: number | string): string {
  const d = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

/** Mapping defensivo nombre-de-país (ES/EN comunes en los seeds) →
 *  ISO-2. Cuando exista backend, `Agency.countryIso` viene directo y
 *  esta heurística desaparece. */
const COUNTRY_TO_ISO: Record<string, string> = {
  "spain": "ES", "españa": "ES",
  "uk": "GB", "united kingdom": "GB", "reino unido": "GB", "england": "GB",
  "ireland": "IE", "irlanda": "IE",
  "netherlands": "NL", "holanda": "NL", "países bajos": "NL",
  "belgium": "BE", "bélgica": "BE",
  "germany": "DE", "alemania": "DE",
  "france": "FR", "francia": "FR",
  "italy": "IT", "italia": "IT",
  "portugal": "PT",
  "sweden": "SE", "suecia": "SE",
  "norway": "NO", "noruega": "NO",
  "denmark": "DK", "dinamarca": "DK",
  "finland": "FI", "finlandia": "FI",
  "iceland": "IS", "islandia": "IS",
  "switzerland": "CH", "suiza": "CH",
  "austria": "AT",
  "russia": "RU", "rusia": "RU",
  "uae": "AE", "united arab emirates": "AE", "emiratos árabes unidos": "AE",
  "usa": "US", "united states": "US", "estados unidos": "US",
  "canada": "CA", "canadá": "CA",
};

/** Deriva el ISO-2 del país de HQ desde `Agency.location`. Tomamos el
 *  último segmento separado por coma · "Marbella, Spain" → "Spain"
 *  → "ES". Devuelve null si no matchea ningún país conocido. */
function countryIsoFromLocation(location?: string): string | null {
  if (!location) return null;
  const parts = location.split(",").map((s) => s.trim());
  const last = parts[parts.length - 1]?.toLowerCase();
  if (!last) return null;
  return COUNTRY_TO_ISO[last] ?? null;
}

interface Props {
  agency: Agency;
  onClick: () => void;
  /** Slot inferior opcional (CTAs externos al click principal). */
  footerSlot?: React.ReactNode;
  /** Selección · si se pasan ambos, se pinta checkbox arriba a la dcha. */
  selected?: boolean;
  onToggleSelect?: () => void;
  /** Favorito · si se pasan ambos, se pinta corazón arriba a la dcha. */
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  /** Si true, pinta el ribbon "Top" en la esquina sup-izq · usado para
   *  agencias top-performer (volumen/ventas altos). */
  topBadge?: boolean;
  /** Oculta los chips de contrato e incidencias · útil para vistas
   *  donde no aplica (ej. lado agencia mirando al promotor, donde
   *  los datos del contrato no llegan en este shape sintético). */
  hideContractStatus?: boolean;
  hideIncidentsStatus?: boolean;
  /** Timestamp ms o ISO de cuándo se invitó a la agencia · si la
   *  invitación está pendiente (la agencia ha recibido pero no ha
   *  añadido la promo a su cartera todavía), se pinta el chip
   *  "Invitado DD/MM/YYYY" en lugar del chip de contrato. Regla
   *  Byvaro · ver `docs/backend-integration.md §4.2.2`. */
  invitedAt?: number | string | null;
  /** Categorías canónicas (Inmobiliaria · Promotor · Comercializador).
   *  Si no se pasan, se asume "inmobiliaria" (caller del lado promotor
   *  viendo agencias). Para `/promotores` lado agencia, el caller
   *  debe pasar `["promotor", ...]` derivado del developer real. */
  categories?: EmpresaCategory[];
  /** Si false, el checkbox y la estrella siguen visibles pero al
   *  click se muestra un toast explicativo y se aborta la acción.
   *  Regla de Byvaro · solo se puede seleccionar/favoritar a empresas
   *  con las que ya colaboras (invitación enviada y aceptada). */
  canInteract?: boolean;
  /** Timestamp de la solicitud enviada y todavía pendiente de
   *  respuesta. Cuando se pasa, el marker del meta row pasa de
   *  "Colaborador" a "Solicitado · DD/MM/YYYY". */
  requestedAt?: number | string | null;
  /** Timestamp de una solicitud RECIBIDA (la otra empresa pidió
   *  colaborar contigo) que aún no has respondido. Marker
   *  "Colaboración solicitada · DD/MM/YYYY". Mayor prioridad que
   *  `requestedAt` y `colabActive`. */
  inboundRequestAt?: number | string | null;
}

export function AgencyGridCard({
  agency: a, onClick, footerSlot,
  selected, onToggleSelect,
  isFavorite, onToggleFavorite,
  topBadge,
  hideContractStatus, hideIncidentsStatus,
  invitedAt,
  categories,
  canInteract = true,
  requestedAt,
  inboundRequestAt,
}: Props) {
  const empresaCategories: EmpresaCategory[] = categories
    ?? getEmpresaCategories({ accountType: "agency" });
  const isPromotor = empresaCategories.includes("promotor");
  /* Métricas patrimoniales · qué TIENE esta empresa.
   *  TODA la card depende del helper canónico
   *  `getOrganizationPortfolioMetrics(orgId)` · NO se accede a campos
   *  del seed (`promotionsCollaborating`, `totalPromotionsAvailable`)
   *  directamente.
   *  TODO(backend): reemplazar por
   *  `GET /organizations/:id/portfolio-metrics` ·
   *  doc canónico `docs/backend-dual-role-architecture.md §7.1`. */
  const metrics = useMemo(
    () => getOrganizationPortfolioMetrics(a.id),
    [a.id],
  );
  const officesCount = a.offices?.length ?? 0;
  const verified = isAgencyVerified(getAgencyLicenses(a));

  /* Estado de colaboración. La activa NO se muestra como chip · sólo
   *  se renderiza un dot verde discreto al lado del nombre (limpia
   *  cards de agencias que ya colaboran sin perder la señal). El resto
   *  de estados sí merecen chip explícito porque requieren atención. */
  const colabActive = a.status === "active" || a.estadoColaboracion === "activa";
  const colabChip = useMemo(() => {
    if (a.estadoColaboracion === "pausada") {
      return { label: "Pausada", tone: "muted" as const };
    }
    if (a.estadoColaboracion === "contrato-pendiente") {
      return { label: "Contrato pendiente", tone: "warning" as const };
    }
    if (a.status === "pending" || a.solicitudPendiente || a.isNewRequest) {
      return { label: "Pendiente", tone: "info" as const };
    }
    return null;
  }, [a]);

  const countryIso = countryIsoFromLocation(a.location);

  /* Estado del contrato → chip si hay vínculo · 60d threshold canónico.
   *  REGLA BYVARO · si la agencia tiene invitación pendiente
   *  (`invitedAt` set), prevalece el chip "Invitado DD/MM/YYYY" sobre
   *  cualquier otro estado de contrato · significa que ha recibido la
   *  invitación pero aún no ha añadido la promoción a su cartera. */
  const contract = useMemo(() => {
    if (hideContractStatus) return null;
    if (invitedAt) {
      return {
        label: `Invitada ${formatInvitedDate(invitedAt)}`,
        tone: "info" as const,
        icon: Mail,
      };
    }
    if (!colabActive) return null;
    const c = getContractStatus(a);
    if (c.state === "vigente") {
      return { label: "Contrato vigente", tone: "success" as const, icon: ShieldCheck };
    }
    if (c.state === "por-expirar") {
      const d = c.daysLeft ?? 0;
      return { label: `Vence en ${d}d`, tone: "warning" as const, icon: Clock };
    }
    if (c.state === "sin-contrato") {
      return { label: "Sin contrato", tone: "warning" as const, icon: AlertTriangle };
    }
    return null;
  }, [a, colabActive, hideContractStatus, invitedAt]);

  /* Incidencias · suma duplicados + cancelaciones + reclamaciones */
  const incidents = useMemo(() => {
    if (hideIncidentsStatus) return null;
    const i = a.incidencias;
    if (!i) return null;
    const total = (i.duplicados ?? 0) + (i.cancelaciones ?? 0) + (i.reclamaciones ?? 0);
    if (total === 0) return null;
    const label = total === 1 ? "1 incidencia" : `${total} incidencias`;
    return { label, tone: "destructive" as const };
  }, [a.incidencias, hideIncidentsStatus]);

  /* Resumen de avisos · consolidamos los chips de estado en una sola
   *  alerta para no ensuciar la card. El detalle (qué falta, cuándo
   *  expira, qué incidencia hay) vive dentro de la ficha. Si no hay
   *  nada que avisar → null y el icono no se renderiza. */
  const warningSummary = useMemo(() => {
    const items: string[] = [];
    if (colabChip && colabChip.tone !== "success") items.push(colabChip.label);
    if (contract && contract.tone === "warning") items.push(contract.label);
    if (incidents) items.push(incidents.label);
    return items.length > 0 ? items.join(" · ") : null;
  }, [colabChip, contract, incidents]);

  return (
    <article
      className={cn(
        "relative rounded-2xl border bg-card shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 transition-all duration-200",
        /* Estilo "seleccionada" canónico · misma intensidad que en
         *  AgenciasTabStats GridView para coherencia entre listados. */
        selected ? "border-foreground/30 ring-1 ring-foreground/10" : "border-border",
      )}
    >
      {/* Esquina sup-izq · Checkbox de selección (canónico ·
          `variant="card"` para fondo + sombra). El ribbon "Top" pasa a
          la cabecera junto al nombre cuando hay checkbox · si no hay
          selección se mantiene aquí. */}
      {onToggleSelect ? (
        <div className="absolute top-3 left-3 z-10">
          <RowCheckbox
            checked={!!selected}
            onChange={() => {
              if (!canInteract) {
                toast.info(
                  "Solo puedes seleccionar empresas con las que ya colaboras",
                  { description: "Envía una invitación y, cuando la acepten, podrás seleccionarlas y enviarles emails." },
                );
                return;
              }
              onToggleSelect();
            }}
            label={`Seleccionar ${a.name}`}
            disabled={!canInteract}
          />
        </div>
      ) : topBadge && (
        <span
          className="absolute top-3 left-3 z-10 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-bold uppercase tracking-wider text-white shadow-soft"
          style={{ background: "linear-gradient(135deg,#f97316,#ef4444)" }}
        >
          <Flame className="h-2.5 w-2.5" strokeWidth={2.5} /> Top
        </span>
      )}

      {/* Esquina sup-dcha · Estrella de favorito (patrón canónico
          `FavoriteStar`). */}
      {onToggleFavorite && (
        <div className="absolute top-2.5 right-2.5 z-10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!canInteract) {
                toast.info(
                  "Solo puedes marcar como favorito a empresas con las que ya colaboras",
                  { description: "Envía una invitación y, cuando la acepten, podrás guardarlas en favoritos." },
                );
                return;
              }
              onToggleFavorite();
            }}
            aria-pressed={!!isFavorite}
            aria-label={isFavorite ? "Quitar de favoritos" : "Marcar como favorito"}
            title={isFavorite ? "Favorita" : canInteract ? "Marcar como favorita" : "Solo colaboradores"}
            className={cn(
              "h-7 w-7 inline-flex items-center justify-center rounded-full transition-colors shrink-0",
              isFavorite
                ? "text-warning hover:bg-warning/10"
                : canInteract
                  ? "text-muted-foreground/60 hover:text-foreground hover:bg-muted"
                  : "text-muted-foreground/30 hover:text-muted-foreground/40 hover:bg-muted/50 cursor-not-allowed",
            )}
          >
            <Star
              className={cn("h-3.5 w-3.5", isFavorite && "fill-warning text-warning")}
              strokeWidth={1.75}
            />
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={onClick}
        className={cn(
          "w-full text-left p-4",
          /* Padding-top extra cuando hay acciones · evita que el
           *  contenido choque con checkbox/estrella/ribbon. */
          (onToggleFavorite || onToggleSelect || topBadge) && "pt-12",
        )}
      >
        {/* Header · avatar + nombre + bandera país + tick + warning */}
        <div className="flex items-start gap-3">
          <Mark name={a.name} logo={a.logo} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{a.name}</p>
              {verified && <VerifiedBadge size="sm" />}
              {typeof a.googleRating === "number" && a.googleRating > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground tabular-nums shrink-0">
                  <Star className="h-2.5 w-2.5 fill-foreground text-foreground" strokeWidth={0} />
                  <span className="text-foreground font-medium">{a.googleRating.toFixed(1)}</span>
                </span>
              )}
            </div>
            {empresaCategories.length > 0 && (
              <p className="text-[11.5px] font-medium text-muted-foreground leading-snug mt-0.5 truncate">
                {empresaCategories.map((c, i) => (
                  <span key={c}>
                    {i > 0 && <span className="mx-1">·</span>}
                    {EMPRESA_CATEGORY_LABELS[c]}
                  </span>
                ))}
              </p>
            )}
            <p className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground truncate mt-0.5">
              {countryIso && (
                <Flag iso={countryIso} size={12} title={`Sede en ${countryIso}`} />
              )}
              <span className="truncate">{a.location}</span>
            </p>
          </div>
        </div>

        {/* Chip de invitación pendiente · única excepción que se
            queda como tag inline porque es informativa y action-able
            ("envió la invitación el DD/MM"). El resto (sin contrato,
            por expirar, incidencias, pausada) se consolidan en el
            icono de aviso del header · el detalle vive dentro de la
            ficha. */}
        {invitedAt && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <StatusChip
              label={`Invitada ${formatInvitedDate(invitedAt)}`}
              tone="info"
              icon={Mail}
            />
          </div>
        )}

        {/* Metadata · colaborador · colaborando desde · agentes · oficinas */}
        <div className="mt-2.5 flex items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground flex-wrap">
          {/* Marker · prioridad:
              · "Colaboración solicitada DD/MM" si la otra empresa
                pidió colaborar contigo · pelota en TU tejado.
              · "Solicitado DD/MM" si tú enviaste solicitud y está
                pendiente · pelota en el otro tejado.
              · "Colaborador" si la colaboración ya está activa.
              · ninguno · empresa sin relación todavía. */}
          {inboundRequestAt ? (
            <span
              className="inline-flex items-center gap-1 text-warning font-medium"
              title={`Te ha pedido colaborar el ${formatInvitedDate(inboundRequestAt)} · revisa y responde`}
            >
              <Mail className="h-2.5 w-2.5" strokeWidth={1.75} />
              Colaboración solicitada {formatInvitedDate(inboundRequestAt)}
            </span>
          ) : requestedAt ? (
            <span
              className="inline-flex items-center gap-1 text-primary font-medium"
              title={`Solicitud enviada el ${formatInvitedDate(requestedAt)} · esperando respuesta`}
            >
              <Send className="h-2.5 w-2.5" strokeWidth={1.75} />
              Solicitado {formatInvitedDate(requestedAt)}
            </span>
          ) : colabActive && (
            <span
              className="inline-flex items-center gap-1 text-success font-medium"
              title={
                metrics.collaborationDenominator > 0
                  ? `Colaborando en ${metrics.collaborationsCount} de ${metrics.collaborationDenominator} promociones`
                  : "Colaboración activa"
              }
            >
              <Handshake className="h-2.5 w-2.5" strokeWidth={1.75} />
              Colaborador
              {metrics.collaborationDenominator > 0 && (
                <span className="tabular-nums">
                  {" "}{metrics.collaborationsCount}/{metrics.collaborationDenominator}
                </span>
              )}
            </span>
          )}
          {warningSummary ? (
            /* Cuando hay aviso · usamos el espacio de agentes/oficinas
               para detallar el problema (sin contrato, contrato por
               expirar, incidencia, pausada, etc). El detalle completo
               vive dentro de la ficha. */
            <span
              className="inline-flex items-center gap-1 text-warning font-medium"
              title={warningSummary}
            >
              <AlertTriangle className="h-2.5 w-2.5" strokeWidth={2} />
              <span className="truncate">{warningSummary}</span>
            </span>
          ) : (
            <>
              {typeof a.teamSize === "number" && a.teamSize > 0 && (
                <span className="inline-flex items-center gap-1" title="Agentes activos">
                  <Users2 className="h-2.5 w-2.5" strokeWidth={1.75} />
                  <span className="text-foreground font-medium">{a.teamSize}</span>
                  <span className="hidden sm:inline">agentes</span>
                </span>
              )}
              {officesCount > 0 && (
                <span className="inline-flex items-center gap-1" title="Oficinas">
                  <Building className="h-2.5 w-2.5" strokeWidth={1.75} />
                  <span className="text-foreground font-medium">{officesCount}</span>
                  <span className="hidden sm:inline">oficina{officesCount === 1 ? "" : "s"}</span>
                </span>
              )}
            </>
          )}
        </div>

        {/* Métricas patrimoniales · qué TIENE esta empresa.
            Si es Promotor (y tiene ≥1 promo activa real), "Promos" va
            primero (es lo más relevante de la entidad · el resto es
            contexto). El grid se ajusta a 3 ó 4 columnas según haya
            celda Promos o no · evita celdas vacías. */}
        <div
          className={cn(
            "grid gap-2 mt-4 rounded-xl bg-muted/40 p-3",
            isPromotor && metrics.promotionsCount > 0 ? "grid-cols-4" : "grid-cols-3",
          )}
        >
          {isPromotor && metrics.promotionsCount > 0 && (
            <Metric
              label="Promos"
              value={metrics.promotionsCount}
              title="Promociones propias activas"
            />
          )}
          <Metric
            label="Cartera"
            value={metrics.portfolioUnits}
            title="Unidades disponibles en sus colaboraciones"
          />
          <Metric
            label="Colab."
            value={metrics.collaborationsCount}
            title="Promociones activas donde colabora"
          />
          <Metric
            label="Volumen"
            value={formatEuroCompact(metrics.totalVolume)}
            title="Volumen total de la cartera (€ disponible × precio medio)"
          />
        </div>
      </button>
      {footerSlot && <div className="px-4 pb-4">{footerSlot}</div>}
    </article>
  );
}

/* ─── Sub-componentes ─── */

function Mark({ name, logo }: { name: string; logo?: string }) {
  const [failed, setFailed] = useState(false);
  /* Logo dimensionado para que el alto coincida con las tres líneas
   *  apiladas a su derecha (nombre + categoría + ubicación). */
  if (!logo || failed) {
    return (
      <div className="h-16 w-16 rounded-xl bg-muted text-foreground grid place-items-center text-base font-semibold border border-border shrink-0">
        {initials(name) || "—"}
      </div>
    );
  }
  return (
    <img
      src={logo}
      alt={name}
      className="h-16 w-16 rounded-xl object-cover bg-white border border-border shrink-0"
      onError={() => setFailed(true)}
    />
  );
}

/** Color de texto por categoría · usado en la card cuando la
 *  categoría se renderiza inline (sin pill). */
function categoryTextColor(c: EmpresaCategory): string {
  switch (c) {
    case "inmobiliaria":    return "text-primary";
    case "promotor":        return "text-success";
    case "comercializador": return "text-warning";
  }
}

function Metric({
  label, value, accent, title,
}: {
  label: string;
  value: number | string;
  accent?: "success";
  title?: string;
}) {
  return (
    <div className="flex flex-col" title={title}>
      <span className="text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground/80">
        {label}
      </span>
      <span className={cn(
        "text-sm font-bold tabular-nums leading-none mt-0.5",
        accent === "success" ? "text-success" : "text-foreground",
      )}>
        {value}
      </span>
    </div>
  );
}

/** Checkbox canónico para listados de cards · mismo shape que
 *  `RowCheckbox` de `AgenciasTabStats` (variant="card"). */
function RowCheckbox({
  checked, onChange, label, disabled,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-disabled={disabled}
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      className={cn(
        "h-5 w-5 rounded-[6px] border grid place-items-center transition-colors shrink-0 bg-card shadow-soft",
        disabled
          ? "border-border/60 text-muted-foreground/40 cursor-not-allowed"
          : checked
            ? "bg-foreground border-foreground text-background"
            : "border-border hover:border-foreground/40",
      )}
    >
      {checked && <Check className="h-3 w-3" strokeWidth={3} />}
    </button>
  );
}

type ChipTone = "success" | "warning" | "destructive" | "info" | "muted";

function StatusChip({
  label, tone, icon: Icon, dot,
}: {
  label: string;
  tone: ChipTone;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  dot?: boolean;
}) {
  const toneCls = {
    success:     "border-success/25 bg-success/10 text-success",
    warning:     "border-warning/25 bg-warning/10 text-warning",
    destructive: "border-destructive/25 bg-destructive/10 text-destructive",
    info:        "border-primary/25 bg-primary/10 text-primary",
    muted:       "border-border bg-muted/50 text-muted-foreground",
  }[tone];
  const dotCls = {
    success:     "bg-success",
    warning:     "bg-warning",
    destructive: "bg-destructive",
    info:        "bg-primary",
    muted:       "bg-muted-foreground/50",
  }[tone];
  return (
    <span className={cn(
      "inline-flex items-center gap-1 h-5 px-2 rounded-full border text-[10.5px] font-medium",
      toneCls,
    )}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dotCls)} />}
      {Icon && <Icon className="h-2.5 w-2.5" strokeWidth={2} />}
      {label}
    </span>
  );
}
