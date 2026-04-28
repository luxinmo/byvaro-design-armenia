/**
 * /promotor/:id/panel · Panel operativo del promotor desde la cuenta
 * de agencia. **Mirror visual 1:1** de `ColaboracionPanel`
 * (`/colaboradores/:id/panel`) — mismo header, mismas 9 tabs, mismos
 * componentes — para que el lado agencia y el lado promotor sean
 * indistinguibles excepto por:
 *
 *   1. La cabecera muestra los datos del PROMOTOR (logo, nombre,
 *      verificado, ubicación) en lugar de los de la agencia.
 *   2. La acción "Compartir promoción" no aparece (la agencia no
 *      comparte; eso es un flujo de promotor).
 *   3. La tab "Documentación" se renderiza con `readOnly` ·  la
 *      agencia NO puede subir contratos.
 *
 * El resto de tabs (Resumen, Datos, Visitas, Registros, Ventas, Pagos,
 * Facturas, Historial) reutilizan los componentes existentes pasando
 * la agencia logueada (`currentUser.agencyId`). Como la maqueta es
 * single-tenant (un solo promotor), los datos coinciden con "la
 * relación agencia ↔ promotor" sin necesidad de filtros adicionales.
 */

import { useMemo } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, ArrowUpRight, Eye, Mail, Lock,
  LayoutGrid, FileSignature, CreditCard, History, Building2, Receipt,
  CalendarCheck, TrendingUp, FileText, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/currentUser";
import { useTabParam } from "@/lib/useTabParam";
import { useEmpresa } from "@/lib/empresa";
import { agencies } from "@/data/agencies";
import { promotions } from "@/data/promotions";
import { developerOnlyPromotions } from "@/data/developerPromotions";
import { sales } from "@/data/sales";
import { registros as seedRegistros } from "@/data/records";
import { ResumenTab } from "@/components/collaborators/panel/ResumenTab";
import { VisitasTab } from "@/components/collaborators/panel/VisitasTab";
import { RegistrosTab } from "@/components/collaborators/panel/RegistrosTab";
import { VentasTab } from "@/components/collaborators/panel/VentasTab";
import { DocumentacionTab } from "@/components/collaborators/panel/DocumentacionTab";
import { PagosTab } from "@/components/collaborators/panel/PagosTab";
import { FacturasTab } from "@/components/collaborators/panel/FacturasTab";
import { HistorialTab } from "@/components/collaborators/panel/HistorialTab";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { DEFAULT_DEVELOPER_ID } from "@/lib/developerNavigation";
import { DeveloperDatosTab } from "@/components/collaborators/panel/DeveloperDatosTab";

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

const PANEL_TABS = [
  "resumen", "estadisticas", "datos", "visitas", "registros", "ventas",
  "documentacion", "pagos", "facturas", "historial",
] as const;
type PanelTab = typeof PANEL_TABS[number];

/* Tabs admin-only: visibles para todos en la tab bar (con candado al
 * lado del label) pero al clicar el member ve un empty state
 * "Sin acceso · pregunta a tu admin" con la descripción de lo que
 * el admin sí ve · así sabe qué pedirle. */
const ADMIN_ONLY_TABS: ReadonlySet<PanelTab> = new Set<PanelTab>([
  "datos", "documentacion", "pagos", "facturas", "historial",
]);

/** Copy del empty state "Sin acceso" por tab · explica qué hay del
 *  otro lado para que el member sepa qué consultarle al admin. */
const NO_ACCESS_COPY: Partial<Record<PanelTab, { title: string; description: string }>> = {
  datos: {
    title: "Datos fiscales del promotor",
    description:
      "Razón social, CIF, dirección fiscal, web y datos de contacto del promotor. Solo el admin de tu agencia los ve · pídeselos si los necesitas para una gestión legal o de facturación.",
  },
  documentacion: {
    title: "Documentación · contratos y solicitudes",
    description:
      "Contratos de colaboración firmados con el promotor + documentos solicitados (factura, IBAN, certificados). Los gestiona el admin · si te falta firmar un contrato te llegará por email vía Firmafy.",
  },
  pagos: {
    title: "Pagos del promotor a la agencia",
    description:
      "Calendario de pagos pendientes, cobrados y bloqueados. Información financiera que solo ve el admin de tu agencia · pregúntale si necesitas saber cuándo se cobra una venta concreta.",
  },
  facturas: {
    title: "Facturas emitidas a este promotor",
    description:
      "Facturas que tu agencia ha emitido al promotor por las ventas cerradas. Las lleva administración · pregunta a tu admin si tienes una duda contable.",
  },
  historial: {
    title: "Historial cross-empresa",
    description:
      "Timeline de todas las interacciones entre tu agencia y este promotor (invitaciones, registros, visitas, contratos, ventas, incidencias). Es información sensible que solo ve el admin.",
  },
};

export default function PromotorPanel() {
  const { id } = useParams<{ id: string }>();
  const tenantId = id ?? DEFAULT_DEVELOPER_ID;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const { empresa } = useEmpresa(tenantId);

  const fromPromoId = searchParams.get("from") ?? undefined;
  const fromPromo = useMemo(() => {
    if (!fromPromoId) return null;
    return [...developerOnlyPromotions, ...promotions].find((p) => p.id === fromPromoId) ?? null;
  }, [fromPromoId]);

  const [tab, setTab] = useTabParam<PanelTab>(PANEL_TABS, "resumen");

  /* La cuenta logueada es una agencia · resolvemos su entidad para
   * pasarla a los tabs reutilizados (Resumen, Visitas, Registros, etc).
   * En la maqueta single-tenant los datos de "esta agencia" = los
   * datos de su relación con el único promotor. */
  const agencyId = user.accountType === "agency" ? user.agencyId : undefined;
  const agency = useMemo(() => agencies.find((a) => a.id === agencyId), [agencyId]);

  /* Rol del usuario en la agencia · admin ve todo, member ve los
   * mismos tabs pero los admin-only le aparecen con empty state
   * "Sin acceso" para que sepa que existen y pueda pedirle al admin
   * la información concreta. */
  const isAgencyAdmin = user.role === "admin";
  /* Para los tabs visibles a member con datos, restringimos al
   * propio user.id · backend traducirá a `agent_id`. */
  const restrictToUserId = isAgencyAdmin ? undefined : user.id;

  /* Guards · sin promotor o sin permiso */
  const promoterHasIdentity = !!(empresa.nombreComercial?.trim() || empresa.razonSocial?.trim());
  if (!promoterHasIdentity) {
    return (
      <div className="flex flex-col min-h-full bg-background items-center justify-center px-4 py-10 text-center">
        <h1 className="text-xl font-bold text-foreground mb-1">Promotor no encontrado</h1>
        <button
          onClick={() => navigate("/inicio")}
          className="mt-4 inline-flex items-center gap-2 h-10 px-5 rounded-full bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors"
        >
          ← Volver al inicio
        </button>
      </div>
    );
  }
  const promoterName = empresa.nombreComercial?.trim() || empresa.razonSocial?.trim() || "Promotor";
  const promoterEmail = empresa.email;
  const promoterLocation = [empresa.direccionFiscal?.ciudad, empresa.direccionFiscal?.provincia]
    .filter(Boolean).join(", ");

  const allTabDefs: Array<{ id: PanelTab; label: string; icon: typeof LayoutGrid }> = [
    { id: "resumen",       label: "Resumen",       icon: LayoutGrid },
    { id: "estadisticas",  label: "Estadísticas",  icon: BarChart3 },
    { id: "datos",         label: "Datos",         icon: Building2 },
    { id: "visitas",       label: "Visitas",       icon: CalendarCheck },
    { id: "registros",     label: "Registros",     icon: FileText },
    { id: "ventas",        label: "Ventas",        icon: TrendingUp },
    { id: "documentacion", label: "Documentación", icon: FileSignature },
    { id: "pagos",         label: "Pagos",         icon: CreditCard },
    { id: "facturas",      label: "Facturas",      icon: Receipt },
    { id: "historial",     label: "Historial",     icon: History },
  ];
  /* Tab bar · admin y member ven los 10 tabs. La diferencia es el
     CONTENIDO del tab: member ve "Sin acceso · pídele al admin"
     en los admin-only (ADMIN_ONLY_TABS) y datos filtrados al
     propio user.id en el resto. */
  const tabDefs = allTabDefs;

  return (
    <div className="h-full overflow-auto bg-background" data-scroll-container>
      <div className="px-4 sm:px-6 lg:px-10 pt-6 pb-16 max-w-content mx-auto w-full">

        {/* ══════ Back + eyebrow ══════ */}
        <div className="mb-4">
          <button
            onClick={() => {
              if (fromPromoId) navigate(`/promociones/${fromPromoId}`);
              else navigate("/promociones");
            }}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
            {fromPromo ? fromPromo.name : "Promociones"}
          </button>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Panel del promotor
            {fromPromo && <> · <span className="text-foreground">{fromPromo.name}</span></>}
          </p>
        </div>

        {/* ══════ Cabecera operativa · mirror exacto de ColaboracionPanel ══════ */}
        <header className="flex items-start justify-between gap-4 flex-wrap mb-5">
          <div className="flex items-start gap-4 min-w-0">
            <DeveloperLogoBig name={promoterName} logo={empresa.logoUrl} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-[19px] sm:text-[22px] font-bold tracking-tight text-foreground leading-tight">
                  {promoterName}
                </h1>
                {empresa.verificada && <VerifiedBadge size="sm" />}
              </div>
              <p className="text-[12.5px] text-muted-foreground mt-0.5">
                {promoterLocation || "Promotor inmobiliario"}
              </p>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full border border-success/25 bg-success/10 text-[10.5px] font-medium text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" /> Colaboración activa
                </span>
                {agency?.collaboratingSince && (
                  <span className="inline-flex items-center h-5 px-2 rounded-full border border-border bg-muted/40 text-[10.5px] font-medium text-muted-foreground">
                    Desde {agency.collaboratingSince}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Acciones · mismo set que ColaboracionPanel salvo "Compartir
              promoción" que NO aplica desde el lado agencia. */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={`/promotor/${tenantId}`}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
              Ver ficha pública
              <ArrowUpRight className="h-3 w-3 opacity-60" />
            </Link>
            {promoterEmail && (
              <button
                type="button"
                onClick={() => {
                  const params = new URLSearchParams({ compose: "1", to: promoterEmail });
                  navigate(`/emails?${params.toString()}`);
                }}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors"
              >
                <Mail className="h-3.5 w-3.5" strokeWidth={1.75} />
                Email
              </button>
            )}
          </div>
        </header>

        {/* ══════ Tab bar · mismo layout que ColaboracionPanel ══════ */}
        <nav className="border-b border-border mb-6 overflow-x-auto">
          <div className="flex items-center gap-1">
            {tabDefs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              const locked = !isAgencyAdmin && ADMIN_ONLY_TABS.has(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "relative inline-flex items-center gap-1.5 h-10 px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors",
                    active
                      ? "text-foreground after:absolute after:bottom-0 after:left-2 after:right-2 after:h-[2px] after:bg-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {t.label}
                  {locked && <Lock className="h-3 w-3 opacity-60" strokeWidth={1.75} />}
                </button>
              );
            })}
          </div>
        </nav>

        {/* ══════ Contenido del tab ══════
            Reutilizamos los componentes del lado promotor (`Resumen…
            HistorialTab`) pasando la agencia logueada · en
            single-tenant, los datos de la agencia EQUIVALEN a los datos
            de su relación con el promotor. Documentación va con
            `readOnly` para impedir subida de contratos.

            ROL DEL USUARIO EN AGENCIA · admin ve todo · member solo
            ve Resumen / Estadísticas / Visitas / Registros / Ventas
            con datos restringidos a `user.id` (filtro `restrictToUserId`).
            Datos / Documentación / Pagos / Facturas / Historial son
            admin-only · si llega un member por link directo, redirige
            a Resumen (guard arriba). */}
        {agency && (
          <>
            {tab === "resumen"       && <ResumenTab agency={agency} fromPromoId={fromPromoId} onGoTo={(t) => setTab(t as PanelTab)} readOnly />}
            {tab === "estadisticas"  && (
              <EstadisticasTab
                agency={agency}
                restrictToUserId={restrictToUserId}
              />
            )}
            {tab === "datos" && (
              isAgencyAdmin ? <DeveloperDatosTab empresa={empresa} /> : <NoAccessTab tab="datos" />
            )}
            {tab === "visitas"       && (
              <>
                {!isAgencyAdmin && <OnlyOwnNote what="visitas" />}
                <VisitasTab agency={agency} restrictToUserId={restrictToUserId} />
              </>
            )}
            {tab === "registros"     && (
              <>
                {!isAgencyAdmin && <OnlyOwnNote what="registros" />}
                <RegistrosTab agency={agency} restrictToUserId={restrictToUserId} />
              </>
            )}
            {tab === "ventas"        && (
              <>
                {!isAgencyAdmin && <OnlyOwnNote what="ventas" />}
                <VentasTab agency={agency} restrictToUserId={restrictToUserId} />
              </>
            )}
            {tab === "documentacion" && (
              isAgencyAdmin ? <DocumentacionTab agency={agency} readOnly /> : <NoAccessTab tab="documentacion" />
            )}
            {tab === "pagos" && (
              isAgencyAdmin ? <PagosTab agency={agency} /> : <NoAccessTab tab="pagos" />
            )}
            {tab === "facturas" && (
              isAgencyAdmin ? <FacturasTab agency={agency} /> : <NoAccessTab tab="facturas" />
            )}
            {tab === "historial" && (
              isAgencyAdmin ? <HistorialTab agency={agency} /> : <NoAccessTab tab="historial" />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ═════════════ Sub-componentes ═════════════ */

/** Empty state "Sin acceso" cuando un member abre un tab admin-only
 *  (Datos / Documentación / Pagos / Facturas / Historial). Le decimos
 *  qué hay del otro lado para que sepa qué pedirle al admin.
 *  Copy por tab definida en `NO_ACCESS_COPY`. */
function NoAccessTab({ tab }: { tab: PanelTab }) {
  const copy = NO_ACCESS_COPY[tab];
  if (!copy) return null;
  return (
    <div className="rounded-2xl border border-border bg-card shadow-soft p-8 text-center max-w-2xl mx-auto">
      <div className="h-10 w-10 rounded-2xl bg-muted text-muted-foreground grid place-items-center mx-auto mb-3">
        <Lock className="h-4 w-4" strokeWidth={1.75} />
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Sin acceso
      </p>
      <h3 className="text-base font-semibold text-foreground mt-1.5 mb-2">
        {copy.title}
      </h3>
      <p className="text-[12.5px] text-muted-foreground leading-relaxed max-w-md mx-auto">
        {copy.description}
      </p>
      <p className="text-[11px] text-muted-foreground/70 mt-4">
        Si necesitas algo concreto, pídeselo al admin de tu agencia.
      </p>
    </div>
  );
}

/** Aviso pasivo cuando un member ve un tab restringido a sus datos.
 *  Mostramos icono lock + copy explicando que solo verá los suyos.
 *  Mismo patrón visual que el aviso de read-only en Documentación. */
function OnlyOwnNote({ what }: { what: "visitas" | "registros" | "ventas" }) {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-muted/40 border border-border px-3 py-2 mb-3">
      <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.75} />
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Solo puedes ver tus {what}. Las del resto del equipo las gestiona el admin de la
        agencia desde su propio panel.
      </p>
    </div>
  );
}

/** Tab Estadísticas · KPIs operativos del agente / agencia con el
 *  promotor. Member ve solo los suyos · admin ve todo el equipo.
 *  TODO(backend): cuando llegue API real, sustituir el cómputo
 *  inline por `GET /api/promotor/:id/stats?agentId=...`. */
function EstadisticasTab({
  agency, restrictToUserId,
}: { agency: { id: string }; restrictToUserId?: string }) {
  const currentUser = useCurrentUser();
  const { registrosOwn, ventasOwn, ventasContratadas, comisionDevengada } = useMemo(() => {
    /* Filtramos los registros y ventas a (a) la agencia logueada y
     *  (b) si hay restrictToUserId, al actor matcheado por id (en
     *  registros via audit.actor.id) o por nombre (en sales via
     *  agentName). Mock match dual · backend usará agent_id. */
    const myRegistros = seedRegistros.filter((r) => {
      if (r.agencyId !== agency.id) return false;
      if (!restrictToUserId) return true;
      return r.audit?.actor?.id === restrictToUserId;
    });
    const mySales = sales.filter((s) => {
      if (s.agencyId !== agency.id) return false;
      if (!restrictToUserId) return true;
      return s.agentName === currentUser.name;
    });
    const closed = mySales.filter((s) => s.estado === "contratada" || s.estado === "escriturada");
    const comision = closed.reduce(
      (acc, s) => acc + (s.precioFinal ?? 0) * ((s.comisionPct ?? 0) / 100),
      0,
    );
    return {
      registrosOwn: myRegistros.length,
      ventasOwn: mySales.length,
      ventasContratadas: closed.length,
      comisionDevengada: comision,
    };
  }, [agency.id, restrictToUserId, currentUser.name]);

  return (
    <div className="space-y-3">
      {restrictToUserId && <OnlyOwnNoteEstadisticas />}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPIStat icon={FileText}      label="Registros"        value={String(registrosOwn)} />
        <KPIStat icon={CalendarCheck} label="Ventas iniciadas" value={String(ventasOwn)} />
        <KPIStat icon={TrendingUp}    label="Ventas cerradas"  value={String(ventasContratadas)} />
        <KPIStat icon={Receipt}       label="Comisión devengada" value={fmtPriceShort(comisionDevengada)} />
      </div>
    </div>
  );
}

function OnlyOwnNoteEstadisticas() {
  return (
    <div className="flex items-start gap-2 rounded-xl bg-muted/40 border border-border px-3 py-2">
      <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.75} />
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Solo ves tus estadísticas. Las del resto del equipo y los KPIs agregados de la
        agencia los ve el admin desde su propio panel.
      </p>
    </div>
  );
}

function KPIStat({
  icon: Icon, label, value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-soft p-4 flex flex-col gap-2">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div>
        <p className="text-[18px] font-semibold leading-none tracking-tight text-foreground tabular-nums">{value}</p>
        <p className="text-[10.5px] text-muted-foreground uppercase tracking-wider mt-1.5">{label}</p>
      </div>
    </div>
  );
}

function fmtPriceShort(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "€0";
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `€${m >= 10 ? Math.round(m) : m.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (value >= 1_000) return `€${Math.round(value / 1_000)}k`;
  return `€${Math.round(value)}`;
}

function DeveloperLogoBig({ name, logo }: { name: string; logo?: string }) {
  return (
    <div className="shrink-0 h-14 w-14 rounded-2xl border border-border bg-muted/40 overflow-hidden grid place-items-center font-semibold text-muted-foreground text-sm tracking-wider">
      {logo ? (
        <img src={logo} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span>{initials(name) || "—"}</span>
      )}
    </div>
  );
}
