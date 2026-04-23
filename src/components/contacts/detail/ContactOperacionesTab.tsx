/**
 * Tab "Operaciones" de la ficha de contacto.
 *
 * Estructura (réplica de Lovable adaptada a tokens Byvaro):
 *
 *   1. Botón "+ Añadir oportunidad" arriba a la derecha (CTA primario).
 *   2. Banner verde "Compra en curso" cuando existe una operación
 *      activa (compra firmada / contrato en marcha). Muestra
 *      Precio · Señal · Fecha de inicio.
 *   3. Card "Leads (N)" — entradas crudas de portales/agencias con
 *      thumbnail del inmueble, ref, landing, fecha y estado pill
 *      (Convertido / Abierto).
 *   4. Card "Oportunidades (N)" — oportunidades vivas o cerradas con
 *      agencia · agente, intereses del cliente (tipo, zona,
 *      presupuesto, dormitorios) y tags ("Vistas al mar"…).
 *
 * Datos: `detail.records` (leads) + `detail.opportunities` +
 * `detail.activeOperation` — todo se genera en
 * `contactDetailMock.ts`. En producción será GET
 * `/api/contacts/:id/operations` con las 3 colecciones.
 *
 * El detalle dentro de cada oportunidad/lead se montará en una
 * segunda fase (al hacer click).
 *
 * TODO(backend): GET /api/contacts/:id/operations
 *   → { activeOperation, leads: ContactRecordEntry[],
 *       opportunities: ContactOpportunityEntry[] }
 * TODO(ui): dialog "+ Añadir oportunidad" cuando se cablee el flujo.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Briefcase, Plus, Building2, Home, MapPin, Tag, Eye, ImageOff,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/utils";
import { findTeamMember } from "@/lib/team";
import type {
  ContactDetail, ContactRecordEntry, ContactOpportunityEntry,
  ContactActiveOperation,
} from "@/components/contacts/types";

export function ContactOperacionesTab({ detail }: { detail: ContactDetail }) {
  const leads = [...detail.records].sort(
    (a, b) => b.timestamp.localeCompare(a.timestamp),
  );
  const opportunities = detail.opportunities ?? [];
  const activeOp = detail.activeOperation;

  return (
    <div className="space-y-5">

      {/* ── Botón CTA ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => {/* TODO(ui): abrir dialog AddOpportunityDialog */}}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-foreground text-background text-xs font-medium hover:bg-foreground/90 transition-colors shadow-soft"
        >
          <Plus className="h-3.5 w-3.5" />
          Añadir oportunidad
        </button>
      </div>

      {/* ── Banner: operación en curso ───────────────────────────── */}
      {activeOp && <ActiveOperationBanner op={activeOp} />}

      {/* ── Card: Oportunidades ──────────────────────────────────── */}
      <SectionCard title={`Oportunidades (${opportunities.length})`}>
        {opportunities.length === 0 ? (
          <Empty text="Sin oportunidades activas." />
        ) : (
          <ul className="space-y-3">
            {opportunities.map((o) => <OpportunityRow key={o.id} opportunity={o} />)}
          </ul>
        )}
      </SectionCard>

      {/* ── Card: Leads (última, son la entrada cruda) ───────────── */}
      <SectionCard title={`Leads (${leads.length})`}>
        {leads.length === 0 ? (
          <Empty text="Sin leads para este contacto." />
        ) : (
          <ul className="space-y-2.5">
            {leads.map((l) => <LeadRow key={l.id} lead={l} />)}
          </ul>
        )}
      </SectionCard>

    </div>
  );
}

/* ══════ Banner: operación en curso ══════ */

function ActiveOperationBanner({ op }: { op: ContactActiveOperation }) {
  return (
    <div className="rounded-2xl border border-success/30 bg-success/5 p-4 sm:p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-success/15 grid place-items-center text-success dark:text-success shrink-0">
          <Briefcase className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">{op.title}</p>
          <p className="text-[12px] text-success dark:text-success font-medium mt-0.5">
            {op.unit ? `${op.unit} · ` : ""}{op.promotionName}
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-wider font-semibold text-success dark:text-success bg-success/15 rounded-full px-2.5 py-0.5 shrink-0">
          En curso
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <KpiBlock label="Precio"          value={formatPrice(op.price)} />
        <KpiBlock label="Señal"           value={formatPrice(op.deposit)} />
        <KpiBlock label="Fecha de inicio" value={formatDateShort(op.startDate)} />
      </div>
      {/* CTA — ir al detalle de la venta (pantalla por crear). */}
      <div className="mt-4 pt-3 border-t border-success/20 flex justify-end">
        <Link
          to={`/ventas/${op.id}`}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-success dark:text-success hover:underline"
        >
          Ver venta <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

function KpiBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground/70 mb-0.5">{label}</p>
      <p className="text-xs sm:text-sm font-bold text-foreground tnum">{value}</p>
    </div>
  );
}

/* ══════ Lead row (entrada cruda) ══════ */

function LeadRow({ lead }: { lead: ContactRecordEntry }) {
  const statusMeta = leadStatusMeta(lead.status);
  return (
    <li className="rounded-xl border border-border/40 p-3 sm:p-4 hover:bg-muted/20 transition-colors">
      <div className="flex gap-3">
        <Thumbnail src={lead.propertyImage} alt={lead.promotionName} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <Link
              to={`/promociones/${lead.promotionId}`}
              className="text-xs sm:text-sm font-semibold text-foreground leading-snug hover:underline truncate"
            >
              {lead.unit ? `${lead.unit} · ` : ""}{lead.promotionName}
            </Link>
            <span className={cn(
              "text-[9px] font-semibold rounded-full px-2 py-0.5 border shrink-0 uppercase tracking-wider",
              statusMeta.cls,
            )}>
              {statusMeta.label}
            </span>
          </div>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground">
            Desde <span className="font-medium text-foreground">{lead.source}</span>
            {" · "}{formatDateShort(lead.timestamp)}
          </p>
          <div className="flex items-center gap-2 sm:gap-3 mt-1.5 flex-wrap">
            {lead.propertyRef && (
              <span className="text-[9px] sm:text-[10px] text-muted-foreground/70">
                Ref: <span className="font-medium text-foreground">{lead.propertyRef}</span>
              </span>
            )}
            {lead.landingUrl && (
              <span className="text-[9px] sm:text-[10px] text-muted-foreground/70 hidden sm:inline">
                Landing: <span className="font-medium text-foreground">{lead.landingUrl}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function leadStatusMeta(s: ContactRecordEntry["status"]): { label: string; cls: string } {
  switch (s) {
    case "converted": return { label: "Convertido", cls: "text-success bg-success/10 border-success/30" };
    case "approved":  return { label: "Abierto",    cls: "text-warning bg-warning/10 border-warning/30" };
    case "pending":   return { label: "Pendiente",  cls: "text-blue-700 bg-blue-500/10 border-blue-500/30" };
    case "cancelled": return { label: "Cancelado",  cls: "text-muted-foreground bg-muted border-border" };
  }
}

/* ══════ Opportunity row (oportunidad con intereses) ══════ */

function OpportunityRow({ opportunity }: { opportunity: ContactOpportunityEntry }) {
  const meta = opportunityStatusMeta(opportunity.status);
  return (
    <li className="rounded-xl border border-border/40 p-3 sm:p-4">
      <div className="flex gap-3">
        <Thumbnail src={opportunity.propertyImage} alt={opportunity.promotionName} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <Link
              to={`/promociones/${opportunity.promotionId}`}
              className="text-xs sm:text-sm font-semibold text-foreground leading-snug hover:underline truncate"
            >
              {opportunity.unit ? `${opportunity.unit} · ` : ""}{opportunity.promotionName}
            </Link>
            <span className={cn(
              "text-[10px] font-semibold rounded-full px-2.5 py-0.5 shrink-0 uppercase tracking-wider",
              meta.cls,
            )}>
              {meta.label}
            </span>
          </div>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground">
            {opportunity.agencyName ?? "Venta directa"}
            {" · "}
            <span className="text-foreground font-medium">
              {/* Resolver el nombre desde userId · si el miembro fue
                * eliminado, caemos al snapshot legacy `agentName`. */}
              {opportunity.agentUserId
                ? (findTeamMember(opportunity.agentUserId)?.name ?? opportunity.agentName)
                : opportunity.agentName}
            </span>
          </p>

          {opportunity.clientInterests && (
            <div className="mt-3 pt-3 border-t border-border/30">
              <p className="text-[9px] uppercase tracking-wider font-medium text-muted-foreground/70 mb-2">
                Intereses del cliente
              </p>
              <ClientInterestsGrid interests={opportunity.clientInterests} />
              {opportunity.tags && opportunity.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {opportunity.tags.map((t) => (
                    <span
                      key={t}
                      className="text-[9px] font-medium bg-muted/60 text-muted-foreground border border-border/30 rounded-full px-2 py-0.5"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CTA — abrir el detalle de la oportunidad (pantalla por crear). */}
          <div className="mt-3 pt-3 border-t border-border/30 flex justify-end">
            <Link
              to={`/oportunidades/${opportunity.id}`}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-foreground hover:underline"
            >
              Ver oportunidad <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>
    </li>
  );
}

function opportunityStatusMeta(s: ContactOpportunityEntry["status"]): { label: string; cls: string } {
  switch (s) {
    case "active":   return { label: "Activa",    cls: "text-blue-700 bg-blue-500/10" };
    case "won":      return { label: "Ganada",    cls: "text-success bg-success/15" };
    case "archived": return { label: "Archivada", cls: "text-muted-foreground bg-muted" };
  }
}

function ClientInterestsGrid({
  interests,
}: {
  interests: NonNullable<ContactOpportunityEntry["clientInterests"]>;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
      {interests.propertyType && (
        <InterestRow icon={Home}    label="Tipo"        value={interests.propertyType} />
      )}
      {interests.area && (
        <InterestRow icon={MapPin}  label="Zona"        value={interests.area} />
      )}
      {(interests.budgetMin !== undefined || interests.budgetMax !== undefined) && (
        <InterestRow
          icon={Tag}
          label="Presupuesto"
          value={`${formatPriceShort(interests.budgetMin)}–${formatPriceShort(interests.budgetMax)}`}
        />
      )}
      {interests.bedrooms && (
        <InterestRow icon={Eye}     label="Dormitorios" value={interests.bedrooms} />
      )}
    </div>
  );
}

function InterestRow({
  icon: Icon, label, value,
}: {
  icon: typeof Home;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3 w-3 text-muted-foreground/60 shrink-0" />
      <span className="text-[10px] sm:text-xs text-muted-foreground">
        {label}: <span className="font-medium text-foreground">{value}</span>
      </span>
    </div>
  );
}

/* ══════ Helpers visuales ══════ */

function SectionCard({
  title, children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-card border border-border/40 rounded-2xl p-4 sm:p-5 shadow-soft">
      <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="text-[11.5px] text-muted-foreground italic text-center py-4">{text}</p>
  );
}

function Thumbnail({ src, alt }: { src?: string; alt: string }) {
  const [errored, setErrored] = useState(false);
  if (!src || errored) {
    return (
      <div className="w-16 h-12 sm:w-20 sm:h-14 rounded-lg bg-muted grid place-items-center text-muted-foreground shrink-0">
        <ImageOff className="h-3.5 w-3.5" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setErrored(true)}
      className="w-16 h-12 sm:w-20 sm:h-14 rounded-lg object-cover shrink-0"
    />
  );
}

function formatDateShort(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-ES", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch { return iso; }
}

function formatPriceShort(n?: number): string {
  if (n === undefined) return "—";
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

/* `Building2` import kept para consistencia con otros tabs aunque no
 * se use directamente — mantiene tree-shake limpio sin warnings. */
void Building2;
