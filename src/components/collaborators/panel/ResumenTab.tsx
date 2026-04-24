/**
 * Tab "Resumen" del panel de colaboración.
 *
 * Vista hero operativa en dos bloques:
 *
 *   1. Hero · frase grande con el estado de la colaboración.
 *   2. Bloque "En colaboración" · promociones que YA comparte + estado
 *      de lo que falta (contratos sin firmar, documentos pendientes).
 *   3. Bloque "Aún sin compartir" · promociones activas del promotor
 *      donde la agencia aún no está · oportunidad para ampliar.
 *   4. Próximas visitas (si hay).
 *
 * No hay KPIs — todo son señales accionables.
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronRight, FileSignature, Home, Plus, Share2,
  Upload, ArrowRight, Check, MoreHorizontal, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Agency } from "@/data/agencies";
import { developerOnlyPromotions } from "@/data/developerPromotions";
import { promotions } from "@/data/promotions";
import { useContractsForAgency } from "@/lib/collaborationContracts";
import { useAgencyDocRequests } from "@/lib/agencyDocRequests";
import { useCurrentUser } from "@/lib/currentUser";
import { ContractScopePickerDialog } from "@/components/collaborators/ContractScopePickerDialog";
import { ContractNewChoiceDialog } from "@/components/collaborators/ContractNewChoiceDialog";
import { ContractUploadDialog } from "@/components/collaborators/ContractUploadDialog";
import { ContractSignedUploadDialog } from "@/components/collaborators/ContractSignedUploadDialog";
import { SharePromotionDialog } from "@/components/promotions/SharePromotionDialog";

/* ─── Helpers ─────────────────────────────────────────────────────── */

function formatWhen(ms: number) {
  const d = new Date(ms);
  return {
    day: d.getDate(),
    month: d.toLocaleDateString("es-ES", { month: "short" }).replace(".", ""),
    time: d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
  };
}

type PromoStatus = "active" | "incomplete" | "inactive" | "sold-out";
type PromoEntry = {
  id: string;
  name: string;
  active: boolean;
  status: PromoStatus;
  location?: string;
  commission?: number;
};

function usePromoCatalog() {
  return useMemo(() => {
    const m = new Map<string, PromoEntry>();
    for (const p of developerOnlyPromotions) {
      m.set(p.id, {
        id: p.id,
        name: p.name,
        active: p.status === "active",
        status: p.status as PromoStatus,
        location: p.location,
        commission: typeof p.commission === "number" && p.commission > 0 ? p.commission : undefined,
      });
    }
    for (const p of promotions) {
      if (m.has(p.id)) continue;
      m.set(p.id, {
        id: p.id, name: p.name, active: true, status: "active",
        location: p.location,
        commission: typeof p.commission === "number" && p.commission > 0 ? p.commission : undefined,
      });
    }
    return m;
  }, []);
}

const STATUS_LABEL: Record<PromoStatus, string> = {
  active:     "Activa",
  incomplete: "Incompleta",
  inactive:   "Inactiva",
  "sold-out": "Agotada",
};

interface Props {
  agency: Agency;
  fromPromoId?: string;
  onGoTo: (tab: "documentacion" | "pagos" | "historial") => void;
}

export function ResumenTab({ agency: a, onGoTo }: Props) {
  const user = useCurrentUser();
  const actor = { name: user.name, email: user.email };
  const contracts = useContractsForAgency(a.id);
  const docRequests = useAgencyDocRequests(a.id);
  const promoCatalog = usePromoCatalog();

  /* ─── Flujo de subida de contrato ·
     Picker de scope → choice (firmar vs archivar) → upload dialog ─── */
  const [scopePickerOpen, setScopePickerOpen] = useState(false);
  const [scopePreselect, setScopePreselect] = useState<string[] | undefined>(undefined);
  const [resolvedScope, setResolvedScope] = useState<string[] | undefined>(undefined);
  const [newChoiceOpen, setNewChoiceOpen] = useState(false);
  const [uploadContractOpen, setUploadContractOpen] = useState(false);
  const [signedUploadOpen, setSignedUploadOpen] = useState(false);

  /* Dialog para compartir una promoción concreta con esta agencia.
     Arranca en el paso de condiciones con la comisión prefill. */
  const [sharePromo, setSharePromo] = useState<{ id: string; name: string } | null>(null);

  const openScopePicker = (preselect?: string[]) => {
    setScopePreselect(preselect);
    setScopePickerOpen(true);
  };

  const activePromos = useMemo(
    () => developerOnlyPromotions.filter((p) => p.status === "active"),
    [],
  );
  const sharedPromos = useMemo(() => {
    return (a.promotionsCollaborating ?? [])
      .map((id) => promoCatalog.get(id))
      .filter(Boolean) as PromoEntry[];
  }, [a.promotionsCollaborating, promoCatalog]);
  /* Solo contamos las compartidas que además siguen activas · así el
     hero "N de M activas" no queda descuadrado si hay colaboraciones
     heredadas de promociones cerradas. */
  const sharedActiveCount = useMemo(
    () => sharedPromos.filter((p) => p.active).length,
    [sharedPromos],
  );
  const notSharedPromos = useMemo(
    () => activePromos.filter((pr) => !(a.promotionsCollaborating ?? []).includes(pr.id)),
    [activePromos, a.promotionsCollaborating],
  );

  const pendingContracts = useMemo(
    () => contracts.filter((c) => !c.archived && (c.status === "draft" || c.status === "sent" || c.status === "viewed")),
    [contracts],
  );
  const pendingDocs = useMemo(
    () => docRequests.filter((d) => d.status === "pending" || d.status === "uploaded"),
    [docRequests],
  );

  /* Cobertura contractual · una promoción está "cubierta" si existe un
     contrato firmado, no archivado y no expirado/revocado, cuyo `scopePromotionIds`
     la incluye (o es vacío = cubre todo). El resto son promociones SIN CONTRATO ·
     trabajar sin marco legal es la incidencia real. */
  const { uncoveredPromos, hasBlanketSigned } = useMemo(() => {
    const signed = contracts.filter((c) => !c.archived && c.status === "signed");
    const blanket = signed.some((c) => !c.scopePromotionIds || c.scopePromotionIds.length === 0);
    const coveredIds = new Set<string>();
    if (!blanket) {
      for (const c of signed) for (const id of c.scopePromotionIds ?? []) coveredIds.add(id);
    }
    const uncovered = blanket
      ? []
      : sharedPromos.filter((p) => p.active && !coveredIds.has(p.id));
    return { uncoveredPromos: uncovered, hasBlanketSigned: blanket };
  }, [contracts, sharedPromos]);

  const upcomingVisits = useMemo(() => {
    const base: Record<string, Array<{ when: number; client: string; promo: string; unit: string; status: "confirmada" | "pendiente" }>> = {
      "ag-1": [
        { when: Date.now() + 2 * 86400e3, client: "María García",  promo: "Villa Serena",     unit: "Villa 12-B", status: "confirmada" },
        { when: Date.now() + 5 * 86400e3, client: "Pedro Sánchez", promo: "Villas del Pinar", unit: "Apt. 04-2",  status: "pendiente" },
        { when: Date.now() + 8 * 86400e3, client: "Isabel Ruiz",   promo: "Villa Serena",     unit: "Villa 08-C", status: "confirmada" },
      ],
      "ag-2": [
        { when: Date.now() + 3 * 86400e3, client: "Erik Lindqvist", promo: "Villa Serena", unit: "Villa 14-A", status: "confirmada" },
      ],
    };
    return (base[a.id] ?? []).slice(0, 3);
  }, [a.id]);

  /* "En curso" = trámites normales (contratos + docs a entregar). No
     son incidencias · son trabajo-en-vuelo que avanza solo. */
  const inFlightCount = pendingContracts.length + pendingDocs.length;
  /* Total accionable que se muestra en el hero · incluye incidencias
     reales (promos sin contrato), trámites en curso y oportunidades
     de compartir. */
  const pendingCount = inFlightCount + notSharedPromos.length + uncoveredPromos.length;

  /* ════════════════════════════════════════════════════════════════ */

  const headerTone: "warning" | "primary" | "success" =
    uncoveredPromos.length > 0 ? "warning" : inFlightCount > 0 ? "primary" : "success";
  const headerDotCls = {
    warning: "bg-warning",
    primary: "bg-primary",
    success: "bg-success",
  }[headerTone];

  return (
    <div className="space-y-8">

      {/* ═══════════════ Cabecera unificada · estado + bloque 1 ═══════════════ */}
      <section>
        <div className="flex items-center gap-2 mb-2">
          <span className={cn("h-2 w-2 rounded-full shrink-0", headerDotCls)} />
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Estado de la colaboración
          </p>
        </div>
        <h2 className="text-[17px] sm:text-[19px] font-bold tracking-tight text-foreground leading-snug">
          Compartes{" "}
          <span className="tabular-nums">{sharedActiveCount}</span>
          <span className="text-muted-foreground"> de </span>
          <span className="tabular-nums">{activePromos.length}</span>
          <span className="text-muted-foreground">
            {activePromos.length === 1 ? " promoción" : " promociones"}
          </span>
          {uncoveredPromos.length > 0 ? (
            <>
              <span className="text-muted-foreground"> · </span>
              <span className="tabular-nums text-warning">{uncoveredPromos.length}</span>{" "}
              <span className="text-warning">
                {uncoveredPromos.length === 1 ? "sin contrato" : "sin contrato"}
              </span>
            </>
          ) : inFlightCount > 0 ? (
            <>
              <span className="text-muted-foreground"> · </span>
              <span className="tabular-nums text-foreground">{inFlightCount}</span>{" "}
              <span className="text-foreground">
                {inFlightCount === 1 ? "trámite en curso" : "trámites en curso"}
              </span>
            </>
          ) : sharedActiveCount > 0 ? (
            <>
              <span className="text-muted-foreground"> · </span>
              <span className="text-success">todo cubierto y al día</span>
            </>
          ) : null}
        </h2>
        <div className="mt-5">

        {sharedPromos.length === 0 ? (
          <EmptyCard
            icon={Share2}
            title="No colabora en ninguna promoción todavía"
            body="Cuando compartas una promoción con esta agencia aparecerá aquí."
          />
        ) : (
          <>
            {/* ⚠ Incidencia real · promociones sin contrato que cubra */}
            {uncoveredPromos.length > 0 && (
              <button
                type="button"
                onClick={() => openScopePicker(uncoveredPromos.map((u) => u.id))}
                className="w-full text-left rounded-2xl border border-warning/30 bg-warning/5 hover:bg-warning/10 p-4 mb-3 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className="h-9 w-9 rounded-xl bg-warning/15 text-warning grid place-items-center shrink-0">
                    <AlertTriangle className="h-4.5 w-4.5" strokeWidth={2} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {uncoveredPromos.length} promoción{uncoveredPromos.length === 1 ? "" : "es"} sin contrato firmado
                    </p>
                    <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">
                      {uncoveredPromos.slice(0, 3).map((p) => p.name).join(" · ")}
                      {uncoveredPromos.length > 3 ? ` · y ${uncoveredPromos.length - 3} más` : ""}.
                      Está trabajando sin marco legal que os cubra — sube un contrato y envíalo a firmar.
                    </p>
                    <span className="mt-2 inline-flex items-center gap-1 h-7 px-3 rounded-full bg-foreground text-background text-[11.5px] font-semibold">
                      <Upload className="h-3 w-3" strokeWidth={2.25} />
                      Subir contrato ahora
                    </span>
                  </div>
                </div>
              </button>
            )}

            {/* Activas · una card por cada una con estado de cobertura.
                Las `incomplete`/`inactive`/`sold-out` se ocultan del
                panel · no aportan información operativa. */}
            {(() => {
              const activeShared = sharedPromos.filter((p) => p.active);
              if (activeShared.length === 0) return null;
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {activeShared.map((p) => {
                    const isUncovered = !hasBlanketSigned && uncoveredPromos.some((u) => u.id === p.id);
                    return (
                      <div
                        key={p.id}
                        className={cn(
                          "rounded-2xl border bg-card shadow-soft p-4 transition-all",
                          isUncovered ? "border-warning/30" : "border-border",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className={cn(
                            "h-8 w-8 rounded-lg grid place-items-center shrink-0",
                            isUncovered ? "bg-warning/10 text-warning" : "bg-success/10 text-success",
                          )}>
                            {isUncovered
                              ? <AlertTriangle className="h-4 w-4" strokeWidth={2} />
                              : <Check className="h-4 w-4" strokeWidth={2.25} />}
                          </span>
                          <span className={cn(
                            "inline-flex items-center h-5 px-2 rounded-full border text-[10px] font-medium shrink-0",
                            isUncovered
                              ? "border-warning/30 bg-warning/10 text-warning"
                              : "border-success/25 bg-success/10 text-success",
                          )}>
                            {isUncovered ? "Sin contrato" : "Cubierta"}
                          </span>
                        </div>
                        <Link
                          to={`/promociones/${p.id}?tab=Agencies`}
                          className="block mt-3 group"
                        >
                          <p className="text-sm font-semibold text-foreground truncate group-hover:underline">
                            {p.name}
                          </p>
                        </Link>
                        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                          {typeof p.commission === "number" && (
                            <span className="inline-flex items-center h-5 px-2 rounded-full bg-muted/60 text-[10.5px] font-medium text-foreground tabular-nums">
                              Comisión {p.commission}%
                            </span>
                          )}
                          {p.location && (
                            <span className="text-[10.5px] text-muted-foreground truncate">
                              {p.location}
                            </span>
                          )}
                        </div>
                        <div className="mt-3 flex items-center justify-end">
                          <Link
                            to={`/promociones/${p.id}?tab=Agencies`}
                            className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                          >
                            Ver en promoción
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Trámites realmente en curso · solo se muestran tiles
                cuando hay algo que mover · los "✓ al día" sobraban y
                contradecían al banner de "sin contrato" de arriba. */}
            {(pendingContracts.length > 0 || pendingDocs.length > 0) && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {pendingContracts.length > 0 && (
                  <StatusTile
                    icon={FileSignature}
                    value={pendingContracts.length}
                    label={pendingContracts.length === 1 ? "contrato en proceso de firma" : "contratos en proceso de firma"}
                    doneLabel=""
                    tone="in-progress"
                    onClick={() => onGoTo("documentacion")}
                  />
                )}
                {pendingDocs.length > 0 && (
                  <StatusTile
                    icon={Upload}
                    value={pendingDocs.length}
                    label={pendingDocs.length === 1 ? "documento por entregar" : "documentos por entregar"}
                    doneLabel=""
                    tone="in-progress"
                    onClick={() => onGoTo("documentacion")}
                  />
                )}
              </div>
            )}
          </>
        )}
        </div>
      </section>

      {/* ═══════════════════ BLOQUE 2 · Aún sin compartir ═══════════════════ */}
      {notSharedPromos.length > 0 && (
        <section>
          <BlockHeader
            title="Aún sin compartir"
            subtitle={`${notSharedPromos.length} promoción${notSharedPromos.length === 1 ? "" : "es"} activa${notSharedPromos.length === 1 ? "" : "s"} donde podrías invitar a ${a.name}`}
            tone="primary"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {notSharedPromos.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => setSharePromo({ id: p.id, name: p.name })}
                className="group text-left rounded-2xl border border-dashed border-border bg-card/50 p-4 hover:bg-card hover:border-foreground/40 hover:shadow-soft transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="h-8 w-8 rounded-lg bg-muted text-muted-foreground grid place-items-center shrink-0">
                    <Home className="h-4 w-4" strokeWidth={1.75} />
                  </span>
                  <span className="inline-flex items-center h-5 px-2 rounded-full border border-border bg-muted/40 text-[10px] font-medium text-muted-foreground shrink-0">
                    Sin compartir
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground mt-3 truncate">{p.name}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{p.location ?? "—"}</p>
                <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-foreground font-medium group-hover:gap-1.5 transition-all">
                  <Plus className="h-3 w-3" strokeWidth={2.25} />
                  Compartir con {a.name.split(" ")[0]}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ═══════════════════ Próximas visitas ═══════════════════ */}
      {upcomingVisits.length > 0 && (
        <section>
          <BlockHeader
            title="Próximas visitas"
            subtitle={`${upcomingVisits.length} visita${upcomingVisits.length === 1 ? "" : "s"} programada${upcomingVisits.length === 1 ? "" : "s"}`}
            right={
              <Link
                to="/calendario"
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-0.5"
              >
                Ver calendario
                <ChevronRight className="h-3 w-3" />
              </Link>
            }
          />
          <ul className="rounded-2xl border border-border bg-card shadow-soft divide-y divide-border/50 overflow-hidden">
            {upcomingVisits.map((v, i) => {
              const w = formatWhen(v.when);
              return (
                <li key={i} className="px-4 py-3 flex items-center gap-3">
                  <div className="shrink-0 h-10 w-10 rounded-lg bg-muted/60 grid place-items-center">
                    <div className="text-center">
                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground leading-none">{w.month}</p>
                      <p className="text-sm font-bold text-foreground leading-none tabular-nums mt-0.5">{w.day}</p>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{v.client}</p>
                    <p className="text-[11.5px] text-muted-foreground truncate">
                      {v.promo} · {v.unit} · {w.time}
                    </p>
                  </div>
                  <span className={cn(
                    "inline-flex items-center h-5 px-2 rounded-full border text-[10px] font-medium shrink-0",
                    v.status === "confirmada"
                      ? "border-success/25 bg-success/10 text-success"
                      : "border-warning/30 bg-warning/10 text-warning",
                  )}>
                    {v.status}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ═══ Ver actividad ═══ */}
      <div className="flex flex-wrap gap-2 pt-2">
        <button
          type="button"
          onClick={() => onGoTo("historial")}
          className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors"
        >
          <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
          Ver toda la actividad
        </button>
      </div>

      {/* ══════ Flujo Subir contrato · picker → choice → upload ══════ */}
      <ContractScopePickerDialog
        open={scopePickerOpen}
        onOpenChange={setScopePickerOpen}
        agencyName={a.name}
        promos={sharedPromos
          .filter((p) => p.active)
          .map((p) => ({ id: p.id, name: p.name, location: p.location, comision: p.commission }))}
        defaultSelectedIds={scopePreselect}
        onContinue={(ids) => {
          setResolvedScope(ids);
          setScopePickerOpen(false);
          setNewChoiceOpen(true);
        }}
      />
      <ContractNewChoiceDialog
        open={newChoiceOpen}
        onOpenChange={setNewChoiceOpen}
        onPickSend={() => setUploadContractOpen(true)}
        onPickSigned={() => setSignedUploadOpen(true)}
      />
      <ContractUploadDialog
        open={uploadContractOpen}
        onOpenChange={setUploadContractOpen}
        agency={a}
        actor={actor}
        defaultScopePromotionIds={resolvedScope}
      />
      <ContractSignedUploadDialog
        open={signedUploadOpen}
        onOpenChange={setSignedUploadOpen}
        agency={a}
        actor={actor}
        defaultScopePromotionIds={resolvedScope}
      />

      {/* Dialog · compartir promoción con ESTA agencia · entra
          directamente al paso de condiciones (comisión + duración). */}
      {sharePromo && (
        <SharePromotionDialog
          open={!!sharePromo}
          onOpenChange={(v) => { if (!v) setSharePromo(null); }}
          promotionId={sharePromo.id}
          promotionName={sharePromo.name}
          defaultAgencyId={a.id}
        />
      )}
    </div>
  );
}

/* ═══════════════ Sub-componentes ═══════════════ */

/** Agrupa las promociones compartidas que NO están publicables
 *  (`incomplete`, `inactive`, `sold-out`) en una sola línea compacta.
 *  Evita inflar el grid con cards sin valor operativo y muestra el
 *  motivo real por el que no están activas (no se llaman "cerradas"
 *  de forma genérica · cada una tiene su razón concreta). */
function ClosedPromosRow({
  promos, className,
}: {
  promos: Array<{ id: string; name: string; active: boolean; status: PromoStatus }>;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  /* Etiqueta del bloque · si todas comparten estado, la usamos.
     Si hay mezcla, decimos simplemente "no activas". */
  const uniqueStatuses = new Set(promos.map((p) => p.status));
  const groupLabel =
    uniqueStatuses.size === 1
      ? STATUS_LABEL[[...uniqueStatuses][0]].toLowerCase()
      : "no activas";
  return (
    <div className={cn(
      "rounded-2xl border border-border/60 bg-muted/20 overflow-hidden",
      className,
    )}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className={cn(
          "w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-muted/40 transition-colors",
          expanded && "border-b border-border/50",
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-6 w-6 rounded-lg bg-muted grid place-items-center shrink-0">
            <Home className="h-3 w-3 text-muted-foreground" strokeWidth={1.75} />
          </span>
          <p className="text-[12px] font-medium text-foreground">
            {promos.length} promoción{promos.length === 1 ? "" : "es"} {groupLabel}
          </p>
          {!expanded && (
            <p className="text-[11px] text-muted-foreground truncate">
              · {promos.slice(0, 2).map((p) => p.name).join(", ")}
              {promos.length > 2 ? `, +${promos.length - 2}` : ""}
            </p>
          )}
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
          {expanded ? "Ocultar" : "Ver"}
          <ChevronRight
            className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-90")}
            strokeWidth={1.75}
          />
        </span>
      </button>
      {expanded && (
        <ul className="divide-y divide-border/40">
          {promos.map((p) => (
            <li key={p.id} className="px-4 py-2">
              <Link
                to={`/promociones/${p.id}`}
                className="flex items-center justify-between gap-2 group"
              >
                <span className="text-[12.5px] text-foreground truncate group-hover:underline">{p.name}</span>
                <span className="text-[10.5px] text-muted-foreground shrink-0">{STATUS_LABEL[p.status]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BlockHeader({
  eyebrow, title, subtitle, right, tone,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  tone?: "success" | "warning" | "primary";
}) {
  const dotCls = {
    success: "bg-success",
    warning: "bg-warning",
    primary: "bg-primary",
  }[tone ?? "success"];
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="min-w-0 flex items-start gap-3">
        {tone && <span className={cn("mt-[7px] h-2 w-2 rounded-full shrink-0", dotCls)} />}
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
              {eyebrow}
            </p>
          )}
          <h3 className="text-[15px] font-bold text-foreground tracking-tight">{title}</h3>
          {subtitle && <p className="text-[11.5px] text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

function StatusTile({
  icon: Icon, value, label, doneLabel, tone, onClick,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  value: number;
  label: string;
  doneLabel: string;
  tone: "in-progress" | "done";
  onClick?: () => void;
}) {
  const cls = {
    "in-progress": "border-primary/20 bg-primary/[0.04] hover:bg-primary/[0.08]",
    "done":        "border-border/60 bg-muted/20",
  }[tone];
  const iconCls = {
    "in-progress": "bg-primary/10 text-primary",
    "done":        "bg-success/10 text-success",
  }[tone];
  const valueCls = {
    "in-progress": "text-primary",
    "done":        "text-success",
  }[tone];
  const isDone = tone === "done";
  const Wrapper: any = onClick ? "button" : "div";
  const wrapperProps = onClick ? { type: "button", onClick } : {};
  return (
    <Wrapper
      {...wrapperProps}
      className={cn(
        "rounded-2xl border p-4 text-left transition-all shadow-soft flex items-center gap-3",
        cls,
        onClick && "hover:-translate-y-0.5 hover:shadow-soft-lg cursor-pointer",
      )}
    >
      <span className={cn("h-10 w-10 rounded-xl grid place-items-center shrink-0", iconCls)}>
        {isDone ? <Check className="h-5 w-5" strokeWidth={2.25} /> : <Icon className="h-5 w-5" strokeWidth={1.75} />}
      </span>
      <div className="flex-1 min-w-0">
        <p className={cn("text-[22px] font-bold tabular-nums leading-none", valueCls)}>
          {isDone ? "✓" : value}
        </p>
        <p className={cn(
          "text-xs mt-1.5",
          isDone ? "text-muted-foreground" : "text-foreground font-medium",
        )}>
          {isDone ? doneLabel : label}
        </p>
      </div>
      {onClick && !isDone && (
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.75} />
      )}
    </Wrapper>
  );
}

function EmptyCard({
  icon: Icon, title, body,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center">
      <Icon className="h-5 w-5 text-muted-foreground/50 mx-auto mb-1.5" strokeWidth={1.5} />
      <p className="text-xs font-medium text-foreground">{title}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[320px] mx-auto">{body}</p>
    </div>
  );
}
