/**
 * MarketingRulesDialog · editar las reglas de marketing de una
 * promoción. Solo accesible al PROMOTOR (la agencia la ve en
 * `MarketingRulesCard` en modo read-only).
 *
 * UI · dos secciones:
 *   1. Permitidos (arriba)   · todos los canales sin prohibir
 *   2. No permitidos (abajo) · los prohibidos con icono Ban
 *
 * Estilo neutro · no tintamos filas con fondos rojos. Los iconos del
 * canal (favicon) y sus nombres se muestran en color normal
 * independientemente del estado · la única señal visual de prohibición
 * es el icono `Ban` en la columna del Switch.
 *
 * Persistencia · optimista vía `saveMarketingProhibitions` al pulsar
 * "Guardar cambios". Cualquier clic en "Permitir todos" / "Prohibir
 * todos" / "Guardar" marca también la promoción como configurada
 * (flag que apaga la animación de "llama-atención" en el sidebar).
 *
 * TODO(backend): ver `src/lib/marketingRulesStorage.ts` · enchufar
 *   PATCH /api/promociones/:id { marketingProhibitions }.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/Switch";
import { Megaphone, ShieldAlert, Info, Search, X, Ban, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ChannelAvatar } from "./ChannelAvatar";
import {
  MARKETING_CHANNELS,
  CATEGORY_LABEL,
  groupMarketingChannels,
  type MarketingChannel,
  type MarketingChannelCategory,
} from "@/lib/marketingChannels";
import {
  getMarketingProhibitions,
  saveMarketingProhibitions,
  setMarketingConfigured,
} from "@/lib/marketingRulesStorage";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  promotionId: string;
  promotionName: string;
}

const CATEGORY_ORDER: MarketingChannelCategory[] = ["portales", "internacionales", "redes", "publicidad"];

export function MarketingRulesDialog({ open, onOpenChange, promotionId, promotionName }: Props) {
  const [prohibited, setProhibited] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const initial = useMemo(() => new Set(getMarketingProhibitions(promotionId)), [promotionId, open]);

  // Al abrir · sincroniza con storage real (por si otro usuario editó) +
  // limpia la búsqueda para que no se quede colgada entre aperturas.
  useEffect(() => {
    if (open) {
      setProhibited(new Set(initial));
      setQuery("");
    }
  }, [open, initial]);

  const total = MARKETING_CHANNELS.length;
  const prohibCount = prohibited.size;

  /* Particiona el catálogo en permitidos / prohibidos y aplica la
   * query de búsqueda a ambos bloques de forma consistente. */
  const { allowed, deniedList, filteredTotal } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (c: MarketingChannel) =>
      !q ||
      c.label.toLowerCase().includes(q) ||
      (c.hint?.toLowerCase().includes(q) ?? false) ||
      (c.domain?.toLowerCase().includes(q) ?? false);

    const allowedL: MarketingChannel[] = [];
    const deniedL: MarketingChannel[] = [];
    for (const cat of CATEGORY_ORDER) {
      const bucket = groupMarketingChannels()[cat];
      for (const c of bucket) {
        if (!matches(c)) continue;
        if (prohibited.has(c.id)) deniedL.push(c);
        else allowedL.push(c);
      }
    }
    return {
      allowed: allowedL,
      deniedList: deniedL,
      filteredTotal: allowedL.length + deniedL.length,
    };
  }, [prohibited, query]);

  const dirty = useMemo(() => {
    if (prohibited.size !== initial.size) return true;
    for (const id of prohibited) if (!initial.has(id)) return true;
    return false;
  }, [prohibited, initial]);

  const toggle = (id: string) => {
    setProhibited((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = () => {
    saveMarketingProhibitions(promotionId, Array.from(prohibited));
    setMarketingConfigured(promotionId, true);
    onOpenChange(false);
    toast.success(prohibCount === 0
      ? "Publicación permitida en todos los canales"
      : prohibCount === total
      ? "Solo uso interno · publicación prohibida en todos los canales"
      : `${prohibCount} canal${prohibCount === 1 ? "" : "es"} prohibido${prohibCount === 1 ? "" : "s"}`);
  };

  const handleProhibitAll = () => {
    setProhibited(new Set(MARKETING_CHANNELS.map((c) => c.id)));
    setMarketingConfigured(promotionId, true);
  };
  const handleAllowAll = () => {
    setProhibited(new Set());
    setMarketingConfigured(promotionId, true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
              <Megaphone className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-[17px] font-semibold leading-tight">Reglas de marketing</DialogTitle>
              <DialogDescription className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed">
                Elige qué canales NO pueden usar las agencias colaboradoras para promocionar{" "}
                <span className="font-medium text-foreground">{promotionName}</span>. Por defecto todos están permitidos.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Buscador · filtra por label, domain o hint */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar portal, red social o dominio…"
              className="w-full h-9 pl-9 pr-9 rounded-xl border border-border bg-card text-[13px] text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-foreground/20 transition-colors"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted grid place-items-center"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-3 w-3" strokeWidth={2} />
              </button>
            )}
          </div>

          {/* Toolbar · atajos a la derecha · contador a la izquierda */}
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">{allowed.length}</span> permitidos ·{" "}
              <span className="font-semibold text-foreground tabular-nums">{prohibCount}</span> prohibidos
              {query && filteredTotal !== total && (
                <span className="ml-1.5">
                  · <span className="font-semibold text-foreground tabular-nums">{filteredTotal}</span> en resultado
                </span>
              )}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleAllowAll}
                disabled={prohibCount === 0}
                className="text-[11.5px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Permitir todo
              </button>
              <span className="text-muted-foreground/40">·</span>
              <button
                type="button"
                onClick={handleProhibitAll}
                disabled={prohibCount === total}
                className="text-[11.5px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Prohibir todo
              </button>
            </div>
          </div>

          {/* Empty state cuando la búsqueda no devuelve nada */}
          {filteredTotal === 0 && query && (
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 py-10 px-6 text-center">
              <Search className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-[13px] font-medium text-foreground">Sin resultados</p>
              <p className="text-[11.5px] text-muted-foreground mt-1">
                No hay canales que coincidan con "{query}".
              </p>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] font-medium text-primary hover:text-primary/80 transition-colors"
              >
                Limpiar búsqueda
              </button>
            </div>
          )}

          {/* ═════ Sección 1 · PERMITIDOS ═════ */}
          {allowed.length > 0 && (
            <Section
              title="Permitidos"
              description="Las agencias colaboradoras pueden publicar en estos canales."
              icon={CheckCircle2}
              iconTone="muted"
              count={allowed.length}
            >
              <ChannelList channels={allowed} prohibited={prohibited} toggle={toggle} />
            </Section>
          )}

          {/* ═════ Sección 2 · NO PERMITIDOS ═════ */}
          {deniedList.length > 0 && (
            <Section
              title="No permitidos"
              description="Las agencias no pueden publicar en estos canales."
              icon={Ban}
              iconTone="muted"
              count={deniedList.length}
            >
              <ChannelList channels={deniedList} prohibited={prohibited} toggle={toggle} />
            </Section>
          )}

          {/* Aviso legal interno · sobrio · sin fondo ámbar intenso */}
          <div className="rounded-xl border border-border bg-muted/20 p-3 flex items-start gap-2.5">
            <ShieldAlert className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" strokeWidth={1.75} />
            <div className="text-[11.5px] leading-relaxed text-muted-foreground">
              Esta restricción se incluirá en la cláusula de marketing del
              contrato de colaboración. La agencia que infrinja la regla
              puede ser sancionada o ver rescindido su contrato.
            </div>
          </div>

          {/* Nota sobre integración futura */}
          <div className="rounded-xl border border-border bg-muted/20 p-3 flex items-start gap-2.5">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" strokeWidth={1.75} />
            <div className="text-[11px] leading-relaxed text-muted-foreground">
              Cuando se conecten los portales en <span className="font-medium text-foreground">Ajustes → Integraciones</span>,
              los canales prohibidos quedarán bloqueados para la agencia antes de publicar.
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-border bg-muted/20">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="rounded-full">
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!dirty}
            className="rounded-full"
          >
            Guardar cambios
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Section · encabezado de bloque (Permitidos / No permitidos)
   ═══════════════════════════════════════════════════════════════════ */

function Section({
  title, description, icon: Icon, iconTone, count, children,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  iconTone: "muted" | "success" | "destructive";
  count: number;
  children: React.ReactNode;
}) {
  const iconCls =
    iconTone === "success" ? "text-success" :
    iconTone === "destructive" ? "text-destructive" :
    "text-muted-foreground";

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <Icon className={cn("h-3.5 w-3.5", iconCls)} strokeWidth={2} />
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground">
          {title}
        </p>
        <span className="text-[10px] font-semibold text-muted-foreground tabular-nums rounded-full bg-muted px-1.5 py-0.5">
          {count}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground/80 mb-2">
        {description}
      </p>
      {children}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ChannelList · filas neutrales · icono Ban solo cuando está prohibido
   ═══════════════════════════════════════════════════════════════════ */

function ChannelList({
  channels, prohibited, toggle,
}: {
  channels: MarketingChannel[];
  prohibited: Set<string>;
  toggle: (id: string) => void;
}) {
  return (
    <ul className="flex flex-col gap-1.5">
      {channels.map((c) => {
        const isProhibited = prohibited.has(c.id);
        const categoryLabel = CATEGORY_LABEL[c.category];
        return (
          <li
            key={c.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 transition-colors cursor-pointer hover:bg-muted/30"
            onClick={() => toggle(c.id)}
            role="button"
            aria-pressed={isProhibited}
          >
            <ChannelAvatar channel={c} prohibited={false} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-[13px] font-semibold leading-tight text-foreground">
                  {c.label}
                </p>
                {isProhibited && (
                  <Ban className="h-3 w-3 text-destructive shrink-0" strokeWidth={2.5} aria-label="Prohibido" />
                )}
                <span className="text-[10px] font-medium text-muted-foreground rounded-full bg-muted px-1.5 py-0.5">
                  {categoryLabel}
                </span>
              </div>
              <div className="flex items-center gap-x-2 gap-y-0.5 flex-wrap text-[10.5px] text-muted-foreground mt-0.5">
                {c.domain && <span className="truncate">{c.domain}</span>}
                {c.hint && (
                  <>
                    {c.domain && <span className="text-muted-foreground/40">·</span>}
                    <span className="truncate">{c.hint}</span>
                  </>
                )}
              </div>
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <Switch
                checked={isProhibited}
                onCheckedChange={() => toggle(c.id)}
                ariaLabel={`${isProhibited ? "Permitir" : "Prohibir"} ${c.label}`}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
