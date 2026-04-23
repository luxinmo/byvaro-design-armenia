import { useMemo } from "react";
import {
  FileText, CircleDollarSign, CalendarCheck, Handshake, Sparkles, ArrowUpRight,
  TrendingUp, Check, AlertTriangle, Calendar, Plus, UserPlus, CalendarPlus, Mail,
  MapPin, SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════
   SPARKLINE — minimal trend visualization
   ═══════════════════════════════════════════════════════════════════ */
function Sparkline({ data, className }: { data: number[]; className?: string }) {
  const { poly, area, last } = useMemo(() => {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const w = 64;
    const h = 22;
    const step = w / (data.length - 1);
    const pts = data.map((v, i) => `${i * step},${h - ((v - min) / range) * h}`);
    return {
      poly: pts.join(" "),
      area: `0,${h} ${pts.join(" ")} ${w},${h}`,
      last: { x: w, y: h - ((data[data.length - 1] - min) / range) * h },
    };
  }, [data]);
  return (
    <svg width="64" height="22" viewBox="0 0 64 22" className={cn("overflow-visible", className)}>
      <polygon points={area} fill="currentColor" opacity="0.12" />
      <polyline points={poly} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r="2" fill="currentColor" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   KPI CARD
   ═══════════════════════════════════════════════════════════════════ */
type KpiProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  delta?: string;
  deltaTone?: "positive" | "neutral" | "primary";
  sub?: string;
  iconTone: string;         // bg class for icon background
  iconColor: string;        // text class for icon
  sparkColor: string;       // text-* class for sparkline color
  trend: number[];
};

function Kpi({ icon: Icon, label, value, delta, deltaTone = "positive", sub, iconTone, iconColor, sparkColor, trend }: KpiProps) {
  return (
    <div className="group relative bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_24px_-8px_rgba(0,0,0,0.1)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer">
      <div className="flex items-start justify-between mb-3.5">
        <div className={cn("h-9 w-9 rounded-xl grid place-items-center shrink-0", iconTone)}>
          <Icon className={cn("h-4 w-4", iconColor)} />
        </div>
        <Sparkline data={trend} className={cn("opacity-70 group-hover:opacity-100 transition-opacity", sparkColor)} />
      </div>
      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</p>
      <div className="flex items-baseline gap-2 mt-1.5">
        <p className="text-[26px] sm:text-[28px] font-bold leading-none tabular-nums tracking-tight">{value}</p>
        {delta && (
          <span className={cn(
            "text-[11px] font-semibold tabular-nums inline-flex items-center gap-0.5",
            deltaTone === "positive" && "text-success",
            deltaTone === "neutral" && "text-muted-foreground",
            deltaTone === "primary" && "text-primary"
          )}>
            {deltaTone === "positive" && <TrendingUp className="h-3 w-3" />}
            {delta}
          </span>
        )}
      </div>
      {sub && <p className="text-[11px] text-muted-foreground mt-2">{sub}</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════════ */
export default function Inicio() {
  return (
    <div className="flex-1 flex flex-col min-h-full bg-background">
      {/* ══════════════ PAGE HEADER ══════════════ */}
      <div className="px-3 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Domingo 19 abril · Semana 16</p>
            <h1 className="text-[22px] sm:text-[28px] font-bold tracking-tight mt-1 leading-tight">
              Hola, Arman <span className="text-muted-foreground font-medium">· resumen de tu semana</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1 bg-muted/40 border border-border rounded-full p-0.5 text-xs">
              <button className="px-3 py-1 rounded-full bg-background text-foreground font-medium shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)]">Esta semana</button>
              <button className="px-3 py-1 rounded-full text-muted-foreground hover:text-foreground transition-colors">Mes</button>
              <button className="px-3 py-1 rounded-full text-muted-foreground hover:text-foreground transition-colors">Trimestre</button>
            </div>
            <button className="hidden sm:inline-flex items-center justify-center h-8 w-8 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════ CONTENT ══════════════ */}
      <div className="px-3 sm:px-6 lg:px-8 mt-6 space-y-5 pb-8">
        <div className="max-w-[1400px] mx-auto space-y-5">

          {/* ─── KPIs ─── */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Kpi
              icon={FileText}
              label="Registros"
              value="142"
              delta="+18%"
              sub="8 pendientes de decisión"
              iconTone="bg-primary/10"
              iconColor="text-primary"
              sparkColor="text-primary"
              trend={[22, 26, 24, 30, 28, 36, 42]}
            />
            <Kpi
              icon={CircleDollarSign}
              label="Ventas · volumen"
              value="€3,2M"
              delta="+24%"
              sub="9 operaciones · ticket medio €355K"
              iconTone="bg-success/10"
              iconColor="text-success"
              sparkColor="text-success"
              trend={[1, 1.4, 1.8, 2.2, 2.5, 2.8, 3.2]}
            />
            <Kpi
              icon={CalendarCheck}
              label="Visitas programadas"
              value="38"
              delta="esta semana"
              deltaTone="neutral"
              sub="12 hoy · 3 sin confirmar"
              iconTone="bg-violet-500/10"
              iconColor="text-violet-600"
              sparkColor="text-violet-500"
              trend={[8, 12, 18, 22, 28, 32, 38]}
            />
            <Kpi
              icon={Handshake}
              label="Colaboradores activos"
              value="17"
              delta="+2 nuevos"
              deltaTone="primary"
              sub="2 solicitudes pendientes"
              iconTone="bg-warning/10"
              iconColor="text-warning"
              sparkColor="text-warning"
              trend={[10, 11, 13, 13, 14, 15, 17]}
            />
          </section>

          {/* ─── AI INSIGHTS BANNER ─── */}
          <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.06] via-primary/[0.02] to-transparent p-4 sm:p-5">
            <div className="absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
            <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="h-10 w-10 rounded-2xl bg-primary/10 border border-primary/20 grid place-items-center shrink-0">
                  <Sparkles className="h-[18px] w-[18px] text-primary" strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold">Byvaro ha detectado 3 oportunidades esta semana</h3>
                    <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-wider">IA</span>
                  </div>
                  <p className="text-[12.5px] text-muted-foreground mt-0.5 leading-relaxed">
                    Engel & Völkers está dominando el mercado ruso en Los Arqueros — cuota 61% · conversión 9,1%.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-3 h-8 rounded-full">
                  Descartar
                </button>
                <button className="inline-flex items-center gap-1.5 h-8 px-4 rounded-full bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
                  Ver todas <ArrowUpRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </section>

          {/* ─── MAIN GRID ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">

            {/* Left column ─── 2/3 */}
            <div className="lg:col-span-2 space-y-4 sm:space-y-5">

              {/* Actividad reciente */}
              <section className="bg-card border border-border rounded-2xl shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)] overflow-hidden">
                <header className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-border">
                  <div>
                    <h3 className="text-sm font-semibold">Actividad reciente</h3>
                    <p className="text-[11.5px] text-muted-foreground mt-0.5">Lo último de tu red</p>
                  </div>
                  <button className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1">
                    Ver todo <ArrowUpRight className="h-3 w-3" />
                  </button>
                </header>
                <ul className="divide-y divide-border">
                  <ActivityItem
                    icon={<Check className="h-4 w-4" />}
                    iconTone="bg-success/10 text-success"
                    title={<><span className="font-semibold">Venta cerrada</span> — <span className="text-muted-foreground">Dmitri Volkov</span> 🇷🇺 ha comprado el ático 4º-B en <span className="font-medium">Los Arqueros</span></>}
                    meta={<><span className="inline-flex items-center gap-1"><span className="w-4 h-4 rounded-full bg-primary/15" />Engel & Völkers</span><span>·</span><span>€ 512.000</span><span>·</span><span>hace 2 h</span></>}
                  />
                  <ActivityItem
                    icon={<FileText className="h-4 w-4" />}
                    iconTone="bg-primary/10 text-primary"
                    title={<><span className="font-semibold">Registro pendiente</span> — Ahmed Al-Rashid 🇸🇦 en <span className="font-medium">Residencial Costa Brava</span></>}
                    meta={<><span className="inline-flex items-center gap-1 text-warning"><AlertTriangle className="h-3 w-3" /> Coincidencia 85% con registro previo</span><span>·</span><span>hace 3 h</span></>}
                    action="Revisar"
                  />
                  <ActivityItem
                    icon={<Calendar className="h-4 w-4" />}
                    iconTone="bg-violet-500/10 text-violet-600"
                    title={<><span className="font-semibold">Visita confirmada</span> — María García 🇪🇸 · mañana 11:00 en <span className="font-medium">Torres del Puerto</span></>}
                    meta={<><span>Iberia Homes</span><span>·</span><span>Pedro Navarro</span><span>·</span><span>hace 5 h</span></>}
                  />
                  <ActivityItem
                    icon={<Handshake className="h-4 w-4" />}
                    iconTone="bg-warning/10 text-warning"
                    title={<><span className="font-semibold">Nueva solicitud</span> — Iberia Luxury Homes 🇵🇹 quiere colaborar en <span className="font-medium">2 promociones</span></>}
                    meta={<><span>Lisboa, Porto</span><span>·</span><span>hace 1 día</span></>}
                    primaryAction="Aprobar"
                    secondaryAction="Rechazar"
                  />
                </ul>
              </section>

              {/* Promociones activas */}
              <section className="bg-card border border-border rounded-2xl shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)] overflow-hidden">
                <header className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-border">
                  <div>
                    <h3 className="text-sm font-semibold">Promociones activas</h3>
                    <p className="text-[11.5px] text-muted-foreground mt-0.5">Rendimiento de las 4 más activas</p>
                  </div>
                  <button className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1">
                    Ver todas <ArrowUpRight className="h-3 w-3" />
                  </button>
                </header>
                <div className="divide-y divide-border">
                  <PromoRow
                    cover="https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=200&h=200&fit=crop"
                    name="Los Arqueros"
                    location="Marbella, Costa del Sol"
                    status="Activa"
                    statusTone="bg-success/10 text-success"
                    reservas="28/36"
                    registros="480"
                    conversion="8,3%"
                    conversionTone="text-success"
                    volumen="€24,1M"
                    progress={78}
                  />
                  <PromoRow
                    cover="https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=200&h=200&fit=crop"
                    name="Villas del Pinar"
                    location="Jávea, Alicante"
                    status="Activa"
                    statusTone="bg-success/10 text-success"
                    reservas="14/24"
                    registros="328"
                    conversion="4,3%"
                    conversionTone="text-warning"
                    volumen="€12,8M"
                    progress={58}
                  />
                  <PromoRow
                    cover="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=200&h=200&fit=crop"
                    name="Residencial Aurora"
                    location="Finestrat, Alicante"
                    status="Pre-venta"
                    statusTone="bg-warning/10 text-warning"
                    reservas="9/48"
                    registros="272"
                    conversion="3,3%"
                    conversionTone="text-primary"
                    volumen="€4,9M"
                    progress={19}
                  />
                  <PromoRow
                    cover="https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=200&h=200&fit=crop"
                    name="Terrazas del Golf"
                    location="Mijas, Málaga"
                    status="Activa"
                    statusTone="bg-success/10 text-success"
                    reservas="17/22"
                    registros="238"
                    conversion="7,1%"
                    conversionTone="text-success"
                    volumen="€16,2M"
                    progress={77}
                  />
                </div>
              </section>
            </div>

            {/* Right column ─── 1/3 */}
            <div className="space-y-4 sm:space-y-5">

              {/* Hoy */}
              <section className="bg-card border border-border rounded-2xl shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)] overflow-hidden">
                <header className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-border">
                  <div>
                    <h3 className="text-sm font-semibold">Hoy</h3>
                    <p className="text-[11.5px] text-muted-foreground mt-0.5">19 abril · 4 eventos</p>
                  </div>
                  <button className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1">
                    Agenda <ArrowUpRight className="h-3 w-3" />
                  </button>
                </header>
                <ul className="p-2">
                  <AgendaItem time="AHORA" hour="11:00" title="Visita · María García 🇪🇸" detail="Torres del Puerto · ático 7º" active />
                  <AgendaItem time="12:30" title="Llamada · Dmitri Volkov 🇷🇺" detail="Firma de reserva" />
                  <AgendaItem time="16:00" title="Visita · Hans Müller 🇩🇪" detail="Los Arqueros · villa 12" />
                  <AgendaItem time="18:30" title="Reunión · Equipo comercial" detail="Cierre semanal" />
                </ul>
              </section>

              {/* Top colaboradores */}
              <section className="bg-card border border-border rounded-2xl shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)] overflow-hidden">
                <header className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-border">
                  <div>
                    <h3 className="text-sm font-semibold">Top colaboradores</h3>
                    <p className="text-[11.5px] text-muted-foreground mt-0.5">Esta semana · por ventas</p>
                  </div>
                </header>
                <ul className="p-2 space-y-0.5">
                  <CollabRow rank={1} initials="EV" iconBg="bg-primary/15" iconText="text-primary" name="Engel & Völkers" meta="3 ventas · 61% cuota 🇷🇺" amount="€1,2M" />
                  <CollabRow rank={2} initials="NH" iconBg="bg-success/15" iconText="text-success" name="Nordic Home Finders" meta="2 ventas · 74% cuota 🇸🇪🇳🇴" amount="€0,9M" />
                  <CollabRow rank={3} initials="DB" iconBg="bg-warning/15" iconText="text-warning" name="Dutch & Belgian Realty" meta="2 ventas · 68% cuota 🇧🇪🇳🇱" amount="€0,7M" />
                </ul>
              </section>

              {/* Quick actions */}
              <section className="bg-card border border-border rounded-2xl shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)] p-4 sm:p-5">
                <h3 className="text-sm font-semibold mb-3">Acciones rápidas</h3>
                <div className="grid grid-cols-2 gap-2">
                  <QuickAction icon={<Plus className="h-4 w-4" />} iconBg="bg-primary/10" iconText="text-primary" label="Nueva" sub="promoción" />
                  <QuickAction icon={<UserPlus className="h-4 w-4" />} iconBg="bg-success/10" iconText="text-success" label="Registrar" sub="cliente" />
                  <QuickAction icon={<CalendarPlus className="h-4 w-4" />} iconBg="bg-violet-500/10" iconText="text-violet-600" label="Programar" sub="visita" />
                  <QuickAction icon={<Mail className="h-4 w-4" />} iconBg="bg-warning/10" iconText="text-warning" label="Enviar" sub="campaña" />
                </div>
              </section>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SMALL COMPONENTS
   ═══════════════════════════════════════════════════════════════════ */

function ActivityItem({
  icon, iconTone, title, meta, action, primaryAction, secondaryAction,
}: {
  icon: React.ReactNode; iconTone: string; title: React.ReactNode; meta: React.ReactNode;
  action?: string; primaryAction?: string; secondaryAction?: string;
}) {
  return (
    <li className="px-4 sm:px-5 py-3.5 flex items-start gap-3 hover:bg-muted/20 transition-colors cursor-pointer">
      <div className={cn("h-9 w-9 rounded-full grid place-items-center shrink-0", iconTone)}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">{title}</p>
        <div className="flex items-center gap-2 mt-1 text-[11.5px] text-muted-foreground flex-wrap">{meta}</div>
      </div>
      {action && (
        <button className="h-8 px-3 rounded-full border border-border bg-background text-xs font-medium hover:bg-muted transition-colors shrink-0 hidden sm:inline-flex items-center">
          {action}
        </button>
      )}
      {primaryAction && secondaryAction && (
        <div className="hidden sm:flex gap-1.5 shrink-0">
          <button className="h-8 px-3 rounded-full bg-foreground text-background text-xs font-medium hover:bg-foreground/90 transition-colors inline-flex items-center gap-1">
            <Check className="h-3 w-3" />{primaryAction}
          </button>
          <button className="h-8 px-3 rounded-full border border-border text-xs font-medium hover:bg-muted transition-colors">
            {secondaryAction}
          </button>
        </div>
      )}
    </li>
  );
}

function PromoRow({
  cover, name, location, status, statusTone,
  reservas, registros, conversion, conversionTone, volumen, progress,
}: {
  cover: string; name: string; location: string; status: string; statusTone: string;
  reservas: string; registros: string; conversion: string; conversionTone: string;
  volumen: string; progress: number;
}) {
  return (
    <article className="p-4 sm:p-5 hover:bg-muted/20 transition-colors cursor-pointer">
      <div className="flex items-start gap-3 sm:gap-4">
        <div
          className="h-12 w-12 rounded-xl bg-cover bg-center shrink-0 ring-1 ring-border/60"
          style={{ backgroundImage: `url(${cover})` }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <h4 className="text-sm font-semibold truncate">{name}</h4>
              <p className="text-[11.5px] text-muted-foreground mt-0.5 flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {location}
              </p>
            </div>
            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0", statusTone)}>{status}</span>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2 sm:gap-3">
            <Stat label="Reservadas" value={reservas} />
            <Stat label="Registros" value={registros} />
            <Stat label="Conversión" value={conversion} tone={conversionTone} />
            <Stat label="Volumen" value={volumen} />
          </div>
          <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    </article>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-[9.5px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <p className={cn("text-sm font-bold tabular-nums mt-0.5", tone)}>{value}</p>
    </div>
  );
}

function AgendaItem({ time, hour, title, detail, active }: { time: string; hour?: string; title: string; detail: string; active?: boolean }) {
  return (
    <li className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-muted/30 transition-colors cursor-pointer relative">
      <div className="w-12 shrink-0 text-center">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{time}</div>
        {hour && <div className="text-sm font-bold mt-0.5 tabular-nums">{hour}</div>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold truncate">{title}</p>
        <p className="text-[11.5px] text-muted-foreground mt-0.5 truncate">{detail}</p>
      </div>
      {active && <div className="w-1 self-stretch rounded-full bg-primary shrink-0" />}
    </li>
  );
}

function CollabRow({ rank, initials, iconBg, iconText, name, meta, amount }: {
  rank: 1 | 2 | 3; initials: string; iconBg: string; iconText: string; name: string; meta: string; amount: string;
}) {
  const medal =
    rank === 1 ? "bg-gradient-to-br from-warning/80 to-warning" :
    rank === 2 ? "bg-gradient-to-br from-zinc-300 to-zinc-400" :
                 "bg-gradient-to-br from-orange-400 to-orange-600";
  return (
    <li className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/30 transition-colors cursor-pointer">
      <div className={cn("h-7 w-7 rounded-full text-white grid place-items-center text-[11px] font-bold shrink-0 shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)]", medal)}>{rank}</div>
      <div className={cn("h-9 w-9 rounded-full grid place-items-center font-semibold text-[11px] shrink-0", iconBg, iconText)}>{initials}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold truncate">{name}</p>
        <p className="text-[11.5px] text-muted-foreground mt-0.5">{meta}</p>
      </div>
      <p className="text-sm font-bold tabular-nums shrink-0">{amount}</p>
    </li>
  );
}

function QuickAction({ icon, iconBg, iconText, label, sub }: {
  icon: React.ReactNode; iconBg: string; iconText: string; label: string; sub: string;
}) {
  return (
    <button className="flex items-center gap-2 p-2.5 rounded-xl border border-border hover:bg-muted/30 hover:border-primary/40 transition-colors text-left">
      <div className={cn("h-8 w-8 rounded-lg grid place-items-center shrink-0", iconBg, iconText)}>{icon}</div>
      <span className="text-[12.5px] font-medium leading-tight">{label}<br />{sub}</span>
    </button>
  );
}
