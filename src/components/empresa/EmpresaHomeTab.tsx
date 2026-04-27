/**
 * EmpresaHomeTab · réplica del CompanyHomeTab del Lovable con mis
 * componentes. Incluye Overview, Company data (KPIs), Collaborating
 * promoters, Agents preview, Quote y Offices.
 */

import { useMemo, useState } from "react";
import {
  Building2, Users, ChevronRight, Plus, Lock, ArrowUpRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { Empresa } from "@/lib/empresa";
import type { EmpresaStats } from "@/lib/empresaStats";
import { agencies } from "@/data/agencies";
import { useWorkspaceMembers, tenantToWorkspaceKey } from "@/lib/useWorkspaceMembers";
import { EditableSection, InfoItem } from "./EditableSection";
import { OfficesSection } from "./OfficesSection";
import { HeroStatsStrip } from "./HeroStatsStrip";
import { ZonasEspecialidadesCard } from "./ZonasEspecialidadesCard";
import { TestimoniosCard } from "./TestimoniosCard";
import { PortfolioShowcase } from "./PortfolioShowcase";
import { cn } from "@/lib/utils";
import { Flag } from "@/components/ui/Flag";
import { languageCountryIso, languageName } from "@/lib/languages";

/* ─── Helpers ──────────────────────────────────────────────────────── */
const inputClass = "h-9 w-full px-3 text-[13px] bg-card border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/60";
const textareaClass = cn(inputClass, "h-auto py-2.5 resize-y min-h-[100px]");

function Avatar({ src, alt, size = 40, className }: { src?: string; alt: string; size?: number; className?: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={cn("rounded-full object-cover shrink-0", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  const initial = alt?.[0]?.toUpperCase() ?? "?";
  return (
    <div
      className={cn("rounded-full bg-muted text-muted-foreground font-semibold grid place-items-center shrink-0", className)}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initial}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   EmpresaHomeTab
   ═══════════════════════════════════════════════════════════════════ */
export function EmpresaHomeTab({
  viewMode,
  empresa,
  update,
  stats,
  isVisitor = false,
  entityType = "developer",
  panelHref,
  hasActiveCollab = false,
  tenantId,
}: {
  viewMode: "edit" | "preview";
  empresa: Empresa;
  update: <K extends keyof Empresa>(key: K, value: Empresa[K]) => void;
  stats: EmpresaStats;
  /** true si la página se está viendo como visitor (ficha pública de
   *  otro tenant). Determina visibilidad de secciones internas. */
  isVisitor?: boolean;
  /** Tipo de entidad mostrada · ortogonal a `isVisitor`. Decide los
   *  KPIs del HeroStatsStrip (developer = portfolio · agency =
   *  oficinas/equipo). */
  entityType?: "developer" | "agency";
  /** URL del panel operativo de esta empresa · `/promotor/:id/panel`
   *  o `/colaboradores/:id/panel`. Solo se usa para el teaser de
   *  Estadísticas que sustituye al Lema en modo visitor. */
  panelHref?: string;
  /** Si el usuario logueado tiene colaboración activa con la empresa
   *  mostrada · si no, el teaser sale en estado "locked" sin link. */
  hasActiveCollab?: boolean;
  /** Tenant cuya ficha estamos viendo · usado para resolver el
   *  workspace del que leer el equipo. */
  tenantId?: string;
}) {
  const collaboratingAgencies = useMemo(
    () => agencies.filter((a) => a.status === "active" && a.estadoColaboracion === "activa").slice(0, 4),
    [],
  );
  /* Equipo del TENANT MOSTRADO · developer en su ficha → su equipo,
   * agency en su ficha → su equipo, agency mirando /promotor/:id →
   * equipo del promotor. Antes era siempre el del usuario logueado
   * y la agencia veía el equipo de la agencia visitante en la ficha
   * del promotor visitado · fuga inversa. */
  const tenantWsKey = tenantToWorkspaceKey(tenantId) ?? undefined;
  const { members: workspaceMembers } = useWorkspaceMembers(tenantWsKey);
  /* Equipo público · solo los que tienen `visibleOnProfile`. El
   * contador y los avatares deben coincidir SIEMPRE: nunca decir
   * "5 agentes" y pintar 4 avatares. Si hay más de TEAM_PREVIEW se
   * muestra una píldora "+N" al final · al click se cambia al
   * sub-tab "Equipo". */
  const TEAM_PREVIEW = 5;
  const visibleTeam = useMemo(
    () => workspaceMembers.filter((m) => m.status === "active" && m.visibleOnProfile),
    [workspaceMembers],
  );
  const teamPreview = visibleTeam.slice(0, TEAM_PREVIEW);
  const teamHidden = Math.max(0, visibleTeam.length - TEAM_PREVIEW);

  /* Idiomas · mostrar 5 + toggle "+N / ver menos" si hay más. */
  const LANG_PREVIEW = 5;
  const [langExpanded, setLangExpanded] = useState(false);
  const visibleIdiomas = langExpanded ? stats.idiomas : stats.idiomas.slice(0, LANG_PREVIEW);
  const hiddenIdiomasCount = stats.idiomas.length - LANG_PREVIEW;

  return (
    <div className="flex flex-col gap-5">
      {/* ═════ Stats de credibilidad ═════ */}
      {/* hideColaboradores · solo se muestra cuando el promotor está
          en su propia ficha en modo edición. Se oculta en preview
          (vista usuario) y desde la agencia visitando /promotor/:id ·
          es métrica de gestión interna, no parte de la ficha pública. */}
      <HeroStatsStrip
        stats={stats}
        entityType={entityType}
        hideColaboradores={isVisitor || viewMode === "preview"}
      />

      {/* Rating Google · pill compacta vive INLINE en el hero
          (`<HeroGoogleRating>`). La card de configuración grande
          vive en el tab "Sobre nosotros" (admin en edit mode). */}

      {/* ═════ Overview ═════ */}
      <EditableSection
        title="Resumen"
        viewMode={viewMode}
        editContent={
          <textarea
            value={empresa.overview}
            onChange={(e) => update("overview", e.target.value)}
            placeholder="Describe tu empresa en 2-3 frases: servicios, misión, qué os hace diferentes."
            className={textareaClass}
          />
        }
      >
        <p className="text-[12.5px] text-muted-foreground leading-relaxed">
          {empresa.overview || "Describe tu empresa: servicios, misión, qué os hace diferentes en el mercado."}
        </p>
      </EditableSection>

      {/* ═════ Datos de la empresa (derivados del sistema · NO editables) ═════ */}
      <EditableSection title="Datos de la empresa" viewMode={viewMode}>
        <div className="grid grid-cols-3 gap-4">
          <InfoItem icon={Building2} label="Oficinas" value={String(stats.oficinas)} />
          <InfoItem icon={Users} label="Equipo" value={String(stats.agentes)} />
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
              Idiomas <span className="tnum">({stats.idiomas.length})</span>
            </p>
            {stats.idiomas.length === 0 ? (
              <p className="text-[11.5px] text-muted-foreground/70 italic">
                Sin agentes activos con idiomas
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-1">
                {visibleIdiomas.map((code) => {
                  const iso = languageCountryIso(code) ?? code;
                  return (
                    <span key={code} title={languageName(code)}>
                      <Flag iso={iso} size={14} />
                    </span>
                  );
                })}
                {hiddenIdiomasCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setLangExpanded((v) => !v)}
                    className="text-[10.5px] font-medium text-muted-foreground hover:text-foreground transition-colors px-1"
                  >
                    {langExpanded ? "ver menos" : `+${hiddenIdiomasCount}`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </EditableSection>

      {/* ═════ Agencias colaboradoras ═════
          Solo visible al admin del workspace en modo edición · es una
          métrica interna de gestión, NO algo que exponemos al visitante
          externo (modo usuario / visitor en /colaboradores/:id).
          El CTA "Ver todos los colaboradores" es la única entrada
          oficial al módulo `/colaboradores` desde esta pantalla. */}
      {!isVisitor && viewMode === "edit" && (
        <EditableSection title="Agencias colaboradoras" viewMode={viewMode}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {collaboratingAgencies.map((a) => (
                <Avatar key={a.id} src={a.logo} alt={a.name} size={40} className="border-2 border-primary/20" />
              ))}
              {stats.agencias === 0 && (
                <div className="h-10 w-10 rounded-full border-2 border-dashed border-border/60 flex items-center justify-center">
                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
            </div>
            <div>
              <p className="text-[13px] font-semibold text-foreground">
                {stats.agencias === 0
                  ? "Sin colaboraciones activas"
                  : `${stats.agencias} colaboración${stats.agencias === 1 ? "" : "es"} activa${stats.agencias === 1 ? "" : "s"}`}
              </p>
              <p className="text-[11.5px] text-muted-foreground">
                {stats.agencias === 0
                  ? "Invita agencias desde Colaboradores para empezar a hacer crecer tu red."
                  : "Agencias que distribuyen tus promociones activamente."}
              </p>
            </div>
          </div>
          {/* Aterriza en el segmented "Colaboradores" (quickFilter
              `colaboran` + estado activa) para que /colaboradores
              muestre exactamente las N que cuenta este card · evita
              "3 colaboraciones activas" → click → ver 10 agencias. */}
          <Link
            to="/colaboradores?tab=colaboran"
            className="text-[11.5px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mt-3 self-start"
          >
            Ver todos los colaboradores <ChevronRight className="h-3 w-3" />
          </Link>
        </EditableSection>
      )}

      {/* ═════ Equipo del workspace ═════ */}
      <EditableSection title="Equipo" viewMode={viewMode}>
        <div className="flex items-center gap-4">
          <div className="flex -space-x-2">
            {teamPreview.map((m) => (
              <Avatar key={m.id} src={m.avatarUrl} alt={m.name} size={40} className="border-2 border-card" />
            ))}
            {teamHidden > 0 && (
              /* Indicador "+N" coherente con el patrón de idiomas ·
                 evita el desfase entre contador y avatares. */
              <div className="h-10 w-10 rounded-full border-2 border-card bg-muted text-foreground text-[11.5px] font-semibold flex items-center justify-center">
                +{teamHidden}
              </div>
            )}
          </div>
          <div>
            <p className="text-[13px] font-semibold text-foreground">
              {visibleTeam.length === 0
                ? "Sin agentes"
                : `${visibleTeam.length} agente${visibleTeam.length === 1 ? "" : "s"} en el equipo`}
            </p>
            <p className="text-[11.5px] text-muted-foreground">
              {stats.agentes === 0
                ? "Añade miembros desde /equipo para mostrar tu equipo en la ficha pública."
                : "Equipo que verá el visitante en tu ficha pública."}
            </p>
          </div>
        </div>
        {/* Cambia al sub-tab "Equipo" dentro de /empresa · NO navega
            a la ruta `/equipo` (que es admin-only y, hasta el refactor
            multi-tenant, fuga el equipo del promotor a las agencias). */}
        <Link
          to="?tab=agents"
          replace
          className="text-[11.5px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mt-3 self-start"
        >
          Ver todos los miembros <ChevronRight className="h-3 w-3" />
        </Link>
      </EditableSection>

      {/* ═════ Modo VISITOR · Teaser estadísticas operativas ═════
          Toda empresa tiene 2 fichas:
            · ficha pública (esta) → visible para cualquiera, marketing.
            · ficha avanzada / panel operativo → solo agencias / promotores
              con vínculo activo (al menos invitación o aceptación).
          El teaser invita al visitor a entrar al panel · en estado
          locked si todavía no hay colaboración. En modo owner NO se
          muestra nada (el promotor ya tiene su panel desde otro sitio
          y la sección "lema de la empresa" se descartó por producto). */}
      {isVisitor && (
        <StatsTeaserCard
          empresaName={empresa.nombreComercial?.trim() || "esta empresa"}
          entityType={entityType}
          panelHref={panelHref}
          hasActiveCollab={hasActiveCollab}
        />
      )}

      {/* ═════ Portfolio destacado ═════ */}
      <PortfolioShowcase viewMode={viewMode} tenantId={tenantId} />

      {/* ═════ Zonas y especialidades ═════ */}
      <ZonasEspecialidadesCard
        viewMode={viewMode}
        empresa={empresa}
        update={update}
        idiomas={stats.idiomas}
        idiomasReadOnly
      />

      {/* ═════ Offices ═════ */}
      <OfficesSection viewMode={viewMode} />

      {/* ═════ Testimonios ═════ */}
      <TestimoniosCard viewMode={viewMode} empresa={empresa} update={update} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   StatsTeaserCard · sustituye al Lema en modo visitor.
   Modelo del producto: cada empresa tiene 2 fichas:
     1. Ficha pública (esta) · marketing · cualquiera la ve.
     2. Ficha avanzada / panel operativo (/promotor/:id/panel o
        /colaboradores/:id/panel) · solo agencias / promotores que ya
        colaboran activamente.
   Este card es el puente · invita al visitor a entrar al panel
   avanzado (CTA) si tiene colaboración activa, o avisa que solo
   colaboradores activos lo ven (locked) si no.
   ═══════════════════════════════════════════════════════════════════ */
function StatsTeaserCard({
  empresaName, entityType, panelHref, hasActiveCollab,
}: {
  empresaName: string;
  entityType: "developer" | "agency";
  panelHref?: string;
  hasActiveCollab: boolean;
}) {
  const targetLabel = entityType === "developer" ? "este promotor" : "esta agencia";
  /* Tono de las gráficas decorativas · suave para no competir con el
   * resto de la ficha pública pero suficientemente visible para que
   * comunique "esto son datos". Cuando hay colaboración activa usamos
   * primary; si no, foreground muteado. Las gráficas son siempre
   * decorativas (no datos reales) · los datos reales viven en el panel. */
  const stroke = hasActiveCollab ? "hsl(var(--primary))" : "hsl(var(--foreground) / 0.55)";
  const fill = hasActiveCollab ? "hsl(var(--primary) / 0.15)" : "hsl(var(--foreground) / 0.08)";

  return (
    <section className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
      <div className="px-5 sm:px-7 py-6 flex flex-col items-center text-center">
        {/* Mini-gráficas decorativas · 3 tiles representan los KPI clave
            del panel (visitas, registros, conversión). Subtle pero
            visibles · SVG con tokens HSL, no hex hardcoded. */}
        <div className="flex items-end gap-2 mb-4">
          <ChartTile label="Visitas" stroke={stroke} fill={fill}>
            <MiniBars stroke={stroke} fill={fill} />
          </ChartTile>
          <ChartTile label="Registros" stroke={stroke} fill={fill}>
            <MiniArea stroke={stroke} fill={fill} />
          </ChartTile>
          <ChartTile label="Conversión" stroke={stroke} fill={fill}>
            <MiniDonut stroke={stroke} fill={fill} />
          </ChartTile>
        </div>

        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Ficha avanzada de empresa
        </p>
        <h3 className="text-[15px] sm:text-[17px] font-bold tracking-tight text-foreground mt-1.5 mb-2">
          Estadísticas operativas con {empresaName}
        </h3>
        <p className="text-[12.5px] text-muted-foreground leading-relaxed max-w-md">
          Visitas, registros, ventas, comisiones devengadas, pagos pendientes
          e historial de colaboración · todo lo que necesitas para gestionar
          tu día a día con {targetLabel}.
        </p>

        {/* Aviso legal · solo accesible si hay colaboración activa.
            Cualquier visitante de la ficha pública lee este disclaimer
            para entender la barrera (no es bug · es producto). */}
        <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
          <Lock className="h-3 w-3" strokeWidth={1.75} />
          Solo visible si ya colaboras con {targetLabel}.
        </p>

        {/* CTA · enabled solo si hay colaboración activa · lleva al
            panel operativo. Si no hay collab, mostramos un chip
            disabled · el usuario sabe que existe pero todavía no
            puede entrar. */}
        {hasActiveCollab && panelHref ? (
          <Link
            to={panelHref}
            className="mt-5 inline-flex items-center gap-1.5 h-10 px-5 rounded-full bg-foreground text-background text-[13px] font-semibold hover:bg-foreground/90 transition-colors"
          >
            Ver panel operativo
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
          </Link>
        ) : (
          <span className="mt-5 inline-flex items-center gap-1.5 h-10 px-5 rounded-full border border-border bg-muted text-[13px] font-semibold text-muted-foreground/70 cursor-not-allowed">
            <Lock className="h-3.5 w-3.5" strokeWidth={1.75} />
            Disponible cuando colaboréis
          </span>
        )}
      </div>
    </section>
  );
}

/* ─── Mini-gráficas decorativas para el StatsTeaserCard ─────────────
   Las 3 gráficas son ilustración pura · NO datos reales. Sirven solo
   para comunicar visualmente "aquí hay estadísticas". Los datos
   reales viven en el panel operativo. Cada SVG usa los tokens HSL del
   sistema (fill / stroke se pasan desde el padre). */

function ChartTile({
  label, stroke, fill, children,
}: {
  label: string;
  stroke: string;
  fill: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className="h-12 w-[68px] rounded-xl border border-border bg-background flex items-end justify-center pb-1 pt-1.5 px-1.5 overflow-hidden"
        style={{ borderColor: "hsl(var(--border))" }}
      >
        {children}
      </div>
      <span className="text-[9.5px] font-medium uppercase tracking-wider text-muted-foreground/80">
        {label}
      </span>
      {/* stroke/fill en vars unused-warn-friendly · usadas vía children */}
      <span className="hidden" data-c={stroke + fill} />
    </div>
  );
}

function MiniBars({ stroke, fill }: { stroke: string; fill: string }) {
  /* 5 barras subiendo suavemente · última destaca con fill primary */
  const bars = [10, 14, 11, 18, 24];
  return (
    <svg viewBox="0 0 56 32" className="h-full w-full" preserveAspectRatio="none">
      {bars.map((h, i) => (
        <rect
          key={i}
          x={i * 11 + 1}
          y={32 - h}
          width={8}
          height={h}
          rx={1.5}
          fill={i === bars.length - 1 ? stroke : fill}
        />
      ))}
    </svg>
  );
}

function MiniArea({ stroke, fill }: { stroke: string; fill: string }) {
  /* Área con curva suave · trend ascendente */
  const path = "M0,26 C8,22 14,20 22,16 C30,12 38,12 46,7 L56,4";
  const area = `${path} L56,32 L0,32 Z`;
  return (
    <svg viewBox="0 0 56 32" className="h-full w-full" preserveAspectRatio="none">
      <path d={area} fill={fill} />
      <path d={path} stroke={stroke} strokeWidth={1.6} fill="none" strokeLinecap="round" />
    </svg>
  );
}

function MiniDonut({ stroke, fill }: { stroke: string; fill: string }) {
  /* Donut de 2 segmentos · ~70% completado */
  const r = 11;
  const cx = 18;
  const cy = 16;
  const circ = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 56 32" className="h-full w-full" preserveAspectRatio="none">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={fill} strokeWidth={4} />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth={4}
        strokeDasharray={`${circ * 0.7} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text
        x={36}
        y={20}
        fontSize={10}
        fontWeight={600}
        fill={stroke}
        fontFamily="Inter, sans-serif"
      >
        70%
      </text>
    </svg>
  );
}
