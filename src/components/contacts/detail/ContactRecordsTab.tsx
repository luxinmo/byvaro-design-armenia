/**
 * Tab "Registros" (Leads) de la ficha de contacto.
 *
 * Bandeja de entrada cronológica de TODAS las solicitudes/leads que
 * han llegado para este contacto: cuándo entraron, de dónde, para
 * qué inmueble, a quién se asignaron y en qué estado están.
 *
 * Es una vista distinta a "Operaciones" — aquí vemos el log crudo
 * de entradas (incluso las pendientes de aprobación o duplicadas).
 *
 * Datos: `detail.records`. En producción será un GET
 * `/api/contacts/:id/records`.
 *
 * TODO(backend): GET /api/contacts/:id/records
 */

import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Building2, Inbox, Clock, CheckCircle2, XCircle,
  Sparkles, ArrowRight, User as UserIcon, Globe, Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ContactDetail, ContactRecordEntry } from "@/components/contacts/types";

const STATUS_META: Record<ContactRecordEntry["status"], {
  label: string;
  pill: string;
  icon: typeof Clock;
}> = {
  pending:   { label: "Pendiente",  pill: "bg-warning/15 text-warning dark:text-warning",     icon: Clock },
  approved:  { label: "Aprobado",   pill: "bg-blue-500/15 text-blue-700 dark:text-blue-400",        icon: CheckCircle2 },
  converted: { label: "Convertido", pill: "bg-success/15 text-success dark:text-success", icon: Sparkles },
  cancelled: { label: "Cancelado",  pill: "bg-muted text-muted-foreground",                          icon: XCircle },
};

export function ContactRecordsTab({ detail }: { detail: ContactDetail }) {
  const records = useMemo(
    () => [...detail.records].sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [detail.records],
  );

  const counts = useMemo(() => {
    const c = { total: records.length, pending: 0, approved: 0, converted: 0, cancelled: 0 };
    for (const r of records) c[r.status] += 1;
    return c;
  }, [records]);

  if (records.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-dashed border-border/60 p-12 text-center">
        <div className="h-12 w-12 mx-auto rounded-2xl bg-muted grid place-items-center text-muted-foreground mb-3">
          <Inbox className="h-5 w-5" />
        </div>
        <p className="text-sm font-semibold text-foreground">Sin registros todavía</p>
        <p className="text-xs text-muted-foreground mt-1.5 max-w-md mx-auto leading-relaxed">
          Cuando una agencia o portal envíe una solicitud para este contacto,
          aparecerá aquí.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Kpi label="Total"       value={counts.total}     tone="default" />
        <Kpi label="Pendientes"  value={counts.pending}   tone="amber" />
        <Kpi label="Convertidos" value={counts.converted} tone="emerald" />
        <Kpi label="Cancelados"  value={counts.cancelled} tone="muted" />
      </div>

      <ul className="space-y-3">
        {records.map((r) => <RecordCard key={r.id} record={r} />)}
      </ul>
    </div>
  );
}

/* ══════ Sub-componentes ══════ */

function RecordCard({ record }: { record: ContactRecordEntry }) {
  const meta = STATUS_META[record.status];
  const StatusIcon = meta.icon;

  return (
    <li className="bg-card border border-border/40 rounded-2xl p-4 sm:p-5 shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className={cn(
          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-semibold",
          meta.pill,
        )}>
          <StatusIcon className="h-3 w-3" strokeWidth={2.5} />
          {meta.label}
        </span>
        <p className="text-[11px] text-muted-foreground tnum shrink-0" title={absoluteDate(record.timestamp)}>
          {relativeDate(record.timestamp)}
        </p>
      </div>

      <Link
        to={`/promociones/${record.promotionId}`}
        className="inline-flex items-center gap-2 text-sm font-semibold text-foreground hover:underline"
      >
        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
        {record.promotionName}
        {record.unit && (
          <span className="text-muted-foreground font-normal">· {record.unit}</span>
        )}
      </Link>

      <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
        <MetaLine icon={Globe}    label="De"         value={record.source} />
        <MetaLine icon={UserIcon} label="Asignado a" value={record.agent} />
      </dl>

      {(record.status === "cancelled" || record.status === "converted") && (
        <div className={cn(
          "mt-3 rounded-xl px-3 py-2 text-[12px] flex items-start gap-2 border",
          record.status === "converted"
            ? "bg-success/5 border-success/20 text-success dark:text-success"
            : "bg-muted/50 border-border/40 text-muted-foreground",
        )}>
          {record.status === "converted" ? (
            <>
              <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <p>
                <span className="font-semibold">Convertido en operación.</span>
                {record.convertedSaleId && (
                  <Link
                    to={`/ventas?id=${record.convertedSaleId}`}
                    className="ml-1.5 underline hover:no-underline inline-flex items-center gap-0.5"
                  >
                    Ver operación <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </p>
            </>
          ) : (
            <>
              <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <p>
                <span className="font-semibold">Cancelado.</span>
                {record.cancelReason && (
                  <span className="ml-1">{record.cancelReason}.</span>
                )}
              </p>
            </>
          )}
        </div>
      )}

      {record.agentNote && (
        <p className="mt-3 text-[12px] text-foreground/80 leading-relaxed bg-muted/30 border border-border/40 rounded-xl px-3 py-2 italic">
          “{record.agentNote}”
        </p>
      )}

      <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between gap-3 flex-wrap">
        {record.blockchainHash && (
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-mono text-muted-foreground">
            <Hash className="h-3 w-3" />
            <span className="tnum">{record.blockchainHash}</span>
          </span>
        )}
        <Link
          to={`/registros?id=${record.id}`}
          className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-foreground hover:underline"
        >
          Ver registro completo <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </li>
  );
}

function MetaLine({
  icon: Icon, label, value,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className="text-foreground font-medium truncate">{value}</span>
    </div>
  );
}

function Kpi({
  label, value, tone,
}: {
  label: string;
  value: number;
  tone: "default" | "amber" | "emerald" | "muted";
}) {
  const toneClass =
    tone === "amber"   ? "text-warning dark:text-warning" :
    tone === "emerald" ? "text-success dark:text-success" :
    tone === "muted"   ? "text-muted-foreground" :
                         "text-foreground";
  return (
    <div className="bg-card border border-border/40 rounded-2xl px-4 py-3">
      <p className={cn("text-2xl font-semibold tnum", toneClass)}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function relativeDate(iso: string): string {
  try {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (days === 0) return "Hoy";
    if (days === 1) return "Ayer";
    if (days < 7)   return `hace ${days} días`;
    if (days < 30)  return `hace ${Math.floor(days / 7)} sem`;
    if (days < 365) return `hace ${Math.floor(days / 30)} meses`;
    return `hace ${Math.floor(days / 365)} años`;
  } catch { return iso; }
}

function absoluteDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-ES", {
      day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}
