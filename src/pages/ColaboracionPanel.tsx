/**
 * Pantalla · Panel de colaboración
 * (`/colaboradores/:id/panel?from=<promoId>&tab=<key>`)
 *
 * Cuando el promotor entra a una agencia DESDE una promoción, cae
 * aquí en vez de la ficha pública · es una portada operativa con
 * todo lo que le importa realmente de la relación.
 *
 * Estructura:
 *   · Cabecera operativa · logo + nombre + chips de estado + acciones
 *     (Ver ficha pública · Email · Compartir promoción).
 *   · Tabs (URL-synced vía `useTabParam`):
 *       - Resumen       → KPIs + avisos + visitas + actividad + agentes.
 *       - Documentación → contratos de colaboración + documentos
 *                         solicitados (factura, IBAN, certificados).
 *       - Pagos         → calendario de pagos, KPIs financieros,
 *                         facturas de la agencia.
 *
 * Permiso de entrada: `collaboration.panel.view` · los sub-tabs
 * tienen sus propias keys específicas (contracts, documents, payments).
 */

import { useMemo, useState } from "react";
import {
  useNavigate, useParams, useSearchParams, Link,
} from "react-router-dom";
import {
  ArrowLeft, ArrowUpRight, Eye, Mail, Share2, Shield,
  LayoutGrid, FileSignature, CreditCard, History, Building2, Receipt,
  CalendarCheck, TrendingUp, FileText,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/currentUser";
import { useHasPermission } from "@/lib/permissions";
import { useTabParam } from "@/lib/useTabParam";
import {
  agencies, getContractStatus as getAgreementStatus,
} from "@/data/agencies";
import { promotions } from "@/data/promotions";
import { developerOnlyPromotions } from "@/data/developerPromotions";
import { ResumenTab } from "@/components/collaborators/panel/ResumenTab";
import { DatosTab } from "@/components/collaborators/panel/DatosTab";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { isAgencyVerified } from "@/lib/licenses";
import { getAgencyLicenses } from "@/lib/agencyLicenses";
import { VisitasTab } from "@/components/collaborators/panel/VisitasTab";
import { RegistrosTab } from "@/components/collaborators/panel/RegistrosTab";
import { VentasTab } from "@/components/collaborators/panel/VentasTab";
import { DocumentacionTab } from "@/components/collaborators/panel/DocumentacionTab";
import { PagosTab } from "@/components/collaborators/panel/PagosTab";
import { FacturasTab } from "@/components/collaborators/panel/FacturasTab";
import { HistorialTab } from "@/components/collaborators/panel/HistorialTab";
import { ShareMultiPromosDialog } from "@/components/collaborators/ShareMultiPromosDialog";

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
}

const PANEL_TABS = [
  "resumen", "datos", "visitas", "registros", "ventas",
  "documentacion", "pagos", "facturas", "historial",
] as const;
type PanelTab = typeof PANEL_TABS[number];

export default function ColaboracionPanel() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useCurrentUser();

  const fromPromoId = searchParams.get("from") ?? undefined;
  const agency = useMemo(() => agencies.find((a) => a.id === id), [id]);
  const promo = useMemo(() => {
    if (!fromPromoId) return null;
    return [...developerOnlyPromotions, ...promotions].find((p) => p.id === fromPromoId) ?? null;
  }, [fromPromoId]);

  const canView = useHasPermission("collaboration.panel.view");
  const [tab, setTab] = useTabParam<PanelTab>(PANEL_TABS, "resumen");
  const [shareMultiOpen, setShareMultiOpen] = useState(false);

  /* ── Guards ── */
  if (!id || !agency) {
    return (
      <div className="flex flex-col min-h-full bg-background items-center justify-center px-4 py-10 text-center">
        <h1 className="text-xl font-bold text-foreground mb-1">Agencia no encontrada</h1>
        <button
          onClick={() => navigate("/colaboradores")}
          className="mt-4 inline-flex items-center gap-2 h-10 px-5 rounded-full bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors"
        >
          ← Volver a colaboradores
        </button>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="flex-1 flex flex-col min-h-full bg-background items-center justify-center px-4 py-12 text-center">
        <Shield className="h-10 w-10 text-muted-foreground/40 mb-3" strokeWidth={1.5} />
        <h1 className="text-base font-semibold text-foreground mb-1">Sin acceso</h1>
        <p className="text-sm text-muted-foreground max-w-md">
          Este panel contiene información sensible entre empresas (contratos, pagos,
          incidencias). Solo administradores y miembros con el permiso{" "}
          <code className="text-[11px] bg-muted px-1.5 rounded">collaboration.panel.view</code> pueden verlo.
        </p>
      </div>
    );
  }

  const a = agency;
  const agreement = getAgreementStatus(a);

  const tabDefs: Array<{ id: PanelTab; label: string; icon: typeof LayoutGrid }> = [
    { id: "resumen",       label: "Resumen",       icon: LayoutGrid },
    { id: "datos",         label: "Datos",         icon: Building2 },
    { id: "visitas",       label: "Visitas",       icon: CalendarCheck },
    { id: "registros",     label: "Registros",     icon: FileText },
    { id: "ventas",        label: "Ventas",        icon: TrendingUp },
    { id: "documentacion", label: "Documentación", icon: FileSignature },
    { id: "pagos",         label: "Pagos",         icon: CreditCard },
    { id: "facturas",      label: "Facturas",      icon: Receipt },
    { id: "historial",     label: "Historial",     icon: History },
  ];

  return (
    <div className="h-full overflow-auto bg-background" data-scroll-container>
      <div className="px-4 sm:px-6 lg:px-10 pt-6 pb-16 max-w-[1570px] mx-auto w-full">

        {/* ══════ Back + eyebrow ══════ */}
        <div className="mb-4">
          <button
            onClick={() => {
              if (fromPromoId) navigate(`/promociones/${fromPromoId}?tab=Agencies`);
              else navigate("/colaboradores");
            }}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
            {promo ? promo.name : "Colaboradores"}
          </button>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Panel de colaboración
            {promo && <> · <span className="text-foreground">{promo.name}</span></>}
          </p>
        </div>

        {/* ══════ Cabecera operativa ══════ */}
        <header className="flex items-start justify-between gap-4 flex-wrap mb-5">
          <div className="flex items-start gap-4 min-w-0">
            <AgencyLogoBig name={a.name} logo={a.logo} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-[19px] sm:text-[22px] font-bold tracking-tight text-foreground leading-tight">
                  {a.name}
                </h1>
                {isAgencyVerified(getAgencyLicenses(a)) && <VerifiedBadge size="sm" />}
              </div>
              <p className="text-[12.5px] text-muted-foreground mt-0.5">
                {a.location}
                {a.contactoPrincipal?.nombre
                  ? ` · ${a.contactoPrincipal.nombre} (${a.contactoPrincipal.rol ?? "contacto"})`
                  : ""}
              </p>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <AgreementChip state={agreement.state} daysLeft={agreement.daysLeft} />
                {typeof a.comisionMedia === "number" && a.comisionMedia > 0 && (
                  <span className="inline-flex items-center h-5 px-2 rounded-full border border-border bg-muted/40 text-[10.5px] font-medium text-foreground">
                    Com. {a.comisionMedia}%
                  </span>
                )}
                {a.collaboratingSince && (
                  <span className="inline-flex items-center h-5 px-2 rounded-full border border-border bg-muted/40 text-[10.5px] font-medium text-muted-foreground">
                    Desde {a.collaboratingSince}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Acciones primarias */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={`/colaboradores/${a.id}/ficha`}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
              Ver ficha pública
              <ArrowUpRight className="h-3 w-3 opacity-60" />
            </Link>
            {a.contactoPrincipal?.email && (
              <button
                type="button"
                onClick={() => {
                  const params = new URLSearchParams({ compose: "1" });
                  if (a.contactoPrincipal?.email) params.set("to", a.contactoPrincipal.email);
                  navigate(`/emails?${params.toString()}`);
                }}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors"
              >
                <Mail className="h-3.5 w-3.5" strokeWidth={1.75} />
                Email
              </button>
            )}
            <button
              onClick={() => setShareMultiOpen(true)}
              className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-foreground text-background text-xs font-semibold hover:bg-foreground/90 transition-colors"
            >
              <Share2 className="h-3.5 w-3.5" strokeWidth={2} />
              Compartir promoción
            </button>
          </div>
        </header>

        {/* ══════ Tab bar ══════ */}
        <nav className="border-b border-border mb-6 overflow-x-auto">
          <div className="flex items-center gap-1">
            {tabDefs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
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
                </button>
              );
            })}
          </div>
        </nav>

        {/* ══════ Contenido del tab ══════ */}
        {tab === "resumen" && (
          <ResumenTab
            agency={a}
            fromPromoId={fromPromoId}
            onGoTo={(t) => setTab(t)}
          />
        )}
        {tab === "datos" && <DatosTab agency={a} />}
        {tab === "visitas" && <VisitasTab agency={a} />}
        {tab === "registros" && <RegistrosTab agency={a} />}
        {tab === "ventas" && <VentasTab agency={a} />}
        {tab === "documentacion" && <DocumentacionTab agency={a} />}
        {tab === "pagos" && <PagosTab agency={a} />}
        {tab === "facturas" && <FacturasTab agency={a} />}
        {tab === "historial" && <HistorialTab agency={a} />}
      </div>

      {/* Compartir una o varias promociones con esta agencia · popup
          con elección "todas publicadas" vs "seleccionar una a una". */}
      <ShareMultiPromosDialog
        open={shareMultiOpen}
        onOpenChange={setShareMultiOpen}
        agency={a}
      />
    </div>
  );
}

/* ═════════════ Sub-componentes del header ═════════════ */

function AgencyLogoBig({ name, logo }: { name: string; logo?: string }) {
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

function AgreementChip({
  state, daysLeft,
}: {
  state: "vigente" | "por-expirar" | "expirado" | "sin-contrato";
  daysLeft?: number;
}) {
  if (state === "vigente") return (
    <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full border border-success/25 bg-success/10 text-[10.5px] font-medium text-success">
      <span className="h-1.5 w-1.5 rounded-full bg-success" /> Contrato vigente
    </span>
  );
  if (state === "por-expirar") return (
    <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full border border-warning/30 bg-warning/10 text-[10.5px] font-medium text-warning">
      <span className="h-1.5 w-1.5 rounded-full bg-warning" /> Expira en {daysLeft}d
    </span>
  );
  if (state === "expirado") return (
    <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full border border-destructive/25 bg-destructive/10 text-[10.5px] font-medium text-destructive">
      <span className="h-1.5 w-1.5 rounded-full bg-destructive" /> Contrato expirado
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full border border-border bg-muted/40 text-[10.5px] font-medium text-muted-foreground">
      Sin contrato
    </span>
  );
}
