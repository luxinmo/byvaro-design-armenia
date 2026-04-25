/**
 * RegistrosEmbedded · vista embebida de la bandeja de registros para
 * usar dentro de la ficha de contacto y la ficha de promoción.
 *
 * Reusa la MISMA fuente de datos que la pantalla `/registros` (canónica
 * en `src/data/records.ts` + `useCreatedRegistros()`) y la misma
 * estética de fila (MatchRing · estado pill · agencia · tiempo) — solo
 * cambia el filtrado por contexto:
 *
 *   · Ficha de PROMOCIÓN → filterPromotionId.
 *   · Ficha de CONTACTO  → filterContact (matching por nombre + tel).
 *
 * Click en una fila · navega a `/registros?id=<X>` · el promotor abre
 * el detalle completo (DuplicateResult, ActivityTimeline, etc) en su
 * pantalla nativa, sin que tengamos que duplicar el detalle aquí.
 *
 * TODO(backend): cuando exista `Registro.contactId`, sustituir el
 * matching nominal de `filterContact` por igualdad de id. Hoy en mock
 * no hay relación firm contact↔registro · matcheamos por nombre +
 * últimos 4 dígitos del teléfono como heurística estable.
 */

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, FileText, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tag } from "@/components/ui/Tag";
import { MatchRing } from "@/components/registros/MatchRing";
import {
  registros as registrosMock,
  estadoLabel,
  type Registro,
  type RegistroEstado,
} from "@/data/records";
import { promotions } from "@/data/promotions";
import { agencies } from "@/data/agencies";
import { useCreatedRegistros } from "@/lib/registrosStorage";
import { formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  /** Filtrar por promoción · uso en ficha de promoción. */
  filterPromotionId?: string;
  /** Filtrar por contacto · matching heurístico por nombre + tel. */
  filterContact?: { fullName?: string; telefono?: string };
  /** Texto del empty state cuando no hay matches. Cada caller lo
   *  redacta en su contexto (no genérico). */
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}

const ESTADO_VARIANT: Record<RegistroEstado, "warning" | "success" | "danger" | "muted"> = {
  pendiente: "warning",
  aprobado: "success",
  rechazado: "danger",
  caducado: "muted",
};

function relativeDate(iso: string): string {
  try { return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: es }); }
  catch { return iso; }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0] + parts[parts.length - 1]![0]).toUpperCase();
}

/** Última secuencia de 4 dígitos del teléfono · normaliza prefijos /
 *  espacios para comparar. */
function last4(tel?: string): string {
  if (!tel) return "";
  const digits = tel.replace(/\D/g, "");
  return digits.slice(-4);
}

export function RegistrosEmbedded({
  filterPromotionId, filterContact,
  emptyTitle = "Sin registros",
  emptyDescription = "Cuando entre un registro relacionado lo verás aquí.",
  className,
}: Props) {
  const createdRegistros = useCreatedRegistros();

  const filtered = useMemo(() => {
    const all: Registro[] = [...createdRegistros, ...registrosMock];

    return all.filter((r) => {
      if (filterPromotionId && r.promotionId !== filterPromotionId) return false;
      if (filterContact) {
        const fullName = (filterContact.fullName ?? "").trim().toLowerCase();
        const tel4 = last4(filterContact.telefono);
        const rName = r.cliente.nombre.trim().toLowerCase();
        const rTel4 = last4(r.cliente.telefono);
        const nameMatch = fullName.length > 0 && rName === fullName;
        const phoneMatch = tel4.length === 4 && rTel4 === tel4;
        if (!nameMatch && !phoneMatch) return false;
      }
      return true;
    }).sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [createdRegistros, filterPromotionId, filterContact]);

  const counts = useMemo(() => {
    const c: Record<RegistroEstado | "total", number> = {
      total: filtered.length, pendiente: 0, aprobado: 0, rechazado: 0, caducado: 0,
    };
    for (const r of filtered) c[r.estado] += 1;
    return c;
  }, [filtered]);

  const promotionById = useMemo(() => new Map(promotions.map((p) => [p.id, p])), []);
  const agencyById = useMemo(() => new Map(agencies.map((a) => [a.id, a])), []);

  if (filtered.length === 0) {
    return (
      <div className={cn(
        "bg-card rounded-2xl border border-dashed border-border/60 p-12 text-center",
        className,
      )}>
        <div className="h-12 w-12 mx-auto rounded-2xl bg-muted grid place-items-center text-muted-foreground mb-3">
          <Inbox className="h-5 w-5" />
        </div>
        <p className="text-sm font-semibold text-foreground">{emptyTitle}</p>
        <p className="text-xs text-muted-foreground mt-1.5 max-w-md mx-auto leading-relaxed">
          {emptyDescription}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* KPIs · misma estética que /registros */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Kpi label="Total"      value={counts.total}      tone="default" />
        <Kpi label="Pendientes" value={counts.pendiente}  tone="amber" />
        <Kpi label="Aprobados"  value={counts.aprobado}   tone="emerald" />
        <Kpi label="Rechazados" value={counts.rechazado}  tone="danger" />
      </div>

      {/* Lista · diseño 1:1 con la lista master de /registros */}
      <ul className="flex flex-col gap-3">
        {filtered.map((r) => {
          const promo = promotionById.get(r.promotionId);
          const ag = r.agencyId ? agencyById.get(r.agencyId) : undefined;
          const isDirect = r.origen === "direct";

          return (
            <li key={r.id}>
              <Link
                to={`/registros?id=${encodeURIComponent(r.id)}`}
                className="group relative flex items-start gap-3 p-4 bg-card border border-border rounded-2xl shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 transition-all duration-200"
              >
                {/* MatchRing si hay porcentaje · iniciales si no */}
                {r.matchPercentage > 0 ? (
                  <MatchRing pct={r.matchPercentage} size={12} />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-muted text-foreground grid place-items-center shrink-0 text-xs font-bold tracking-tight">
                    {initials(r.cliente.nombre)}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate inline-flex items-center gap-1.5">
                    {r.cliente.flag && <span>{r.cliente.flag}</span>}
                    <span className="truncate">{r.cliente.nombre}</span>
                    {r.tipo === "registration_visit" && (
                      <span className="text-primary text-[10px] font-semibold uppercase tracking-wide shrink-0">
                        · visita
                      </span>
                    )}
                  </p>

                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {promo?.name ?? "Promoción"}
                    {!isDirect && ag && (
                      <>
                        <span className="text-border mx-1.5">·</span>
                        {ag.name}
                      </>
                    )}
                    {isDirect && (
                      <>
                        <span className="text-border mx-1.5">·</span>
                        Registro directo
                      </>
                    )}
                  </p>

                  <div className="flex items-center justify-between gap-2 mt-2">
                    <span className="text-[11px] text-muted-foreground/80 tabular-nums">
                      {relativeDate(r.fecha)}
                    </span>
                    <Tag variant={ESTADO_VARIANT[r.estado]} size="sm" shape="pill">
                      {estadoLabel[r.estado]}
                    </Tag>
                  </div>
                </div>

                {/* Indicador de "abrir en /registros" */}
                <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 mt-1" strokeWidth={1.75} />
              </Link>
            </li>
          );
        })}
      </ul>

      {/* CTA al pie · ir a la bandeja completa */}
      <div className="flex items-center justify-end">
        <Link
          to={filterPromotionId
            ? `/registros?promotion=${encodeURIComponent(filterPromotionId)}`
            : "/registros"}
          className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <FileText className="h-3 w-3" strokeWidth={1.75} />
          Ver toda la bandeja
          <ArrowRight className="h-3 w-3" strokeWidth={1.75} />
        </Link>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone: "default" | "amber" | "emerald" | "danger" }) {
  const valueCls =
    tone === "amber"   ? "text-warning" :
    tone === "emerald" ? "text-success" :
    tone === "danger"  ? "text-destructive" :
    "text-foreground";
  return (
    <div className="bg-card border border-border rounded-2xl p-3 shadow-soft">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{label}</p>
      <p className={cn("text-xl font-bold tracking-tight tabular-nums mt-0.5", valueCls)}>
        {value}
      </p>
    </div>
  );
}
