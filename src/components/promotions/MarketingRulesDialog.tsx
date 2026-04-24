/**
 * MarketingRulesDialog · editar las reglas de marketing de una
 * promoción. Solo accesible al PROMOTOR (la agencia la ve en
 * `MarketingRulesCard` en modo read-only).
 *
 * UI · lista de canales del catálogo (`marketingChannels.ts`) agrupada
 * por categoría (portales · redes sociales · publicidad). Cada fila
 * tiene un Switch: ON = prohibido, OFF = permitido. Cuando prohibido
 * se pinta con tinte rojo + icono Ban para comunicar la prohibición
 * de forma inequívoca.
 *
 * Persistencia · optimista vía `saveMarketingProhibitions` al pulsar
 * "Guardar cambios" (no auto-save para dar chance al promotor a
 * cancelar un click accidental).
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
import { Ban, Megaphone, ShieldAlert, Info } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  MARKETING_CHANNELS,
  CATEGORY_LABEL,
  groupMarketingChannels,
  type MarketingChannelCategory,
} from "@/lib/marketingChannels";
import {
  getMarketingProhibitions,
  saveMarketingProhibitions,
} from "@/lib/marketingRulesStorage";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  promotionId: string;
  promotionName: string;
}

const CATEGORY_ORDER: MarketingChannelCategory[] = ["portales", "redes", "publicidad"];

export function MarketingRulesDialog({ open, onOpenChange, promotionId, promotionName }: Props) {
  const [prohibited, setProhibited] = useState<Set<string>>(new Set());
  const initial = useMemo(() => new Set(getMarketingProhibitions(promotionId)), [promotionId, open]);

  // Al abrir · sincroniza con storage real (por si otro usuario editó).
  useEffect(() => {
    if (open) setProhibited(new Set(initial));
  }, [open, initial]);

  const grouped = useMemo(() => groupMarketingChannels(), []);
  const total = MARKETING_CHANNELS.length;
  const prohibCount = prohibited.size;

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
    onOpenChange(false);
    toast.success(prohibCount === 0
      ? "Publicación permitida en todos los canales"
      : `${prohibCount} canal${prohibCount === 1 ? "" : "es"} prohibido${prohibCount === 1 ? "" : "s"}`);
  };

  const handleProhibitAll = () => setProhibited(new Set(MARKETING_CHANNELS.map((c) => c.id)));
  const handleAllowAll = () => setProhibited(new Set());

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

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Toolbar · contador + atajos */}
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">{prohibCount}</span>
              {" / "}
              <span className="tabular-nums">{total}</span> canales prohibidos
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
                className="text-[11.5px] font-medium text-destructive hover:text-destructive/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Prohibir todo
              </button>
            </div>
          </div>

          {/* Grupos */}
          {CATEGORY_ORDER.map((cat) => {
            const channels = grouped[cat];
            if (channels.length === 0) return null;
            return (
              <section key={cat}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2">
                  {CATEGORY_LABEL[cat]}
                </p>
                <ul className="flex flex-col gap-1.5">
                  {channels.map((c) => {
                    const isProhibited = prohibited.has(c.id);
                    const Icon = c.icon;
                    return (
                      <li
                        key={c.id}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors cursor-pointer",
                          isProhibited
                            ? "border-destructive/40 bg-destructive/[0.04]"
                            : "border-border bg-card hover:bg-muted/40",
                        )}
                        onClick={() => toggle(c.id)}
                        role="button"
                        aria-pressed={isProhibited}
                      >
                        <div className={cn(
                          "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                          isProhibited ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
                        )}>
                          {isProhibited ? <Ban className="h-4 w-4" strokeWidth={2} /> : <Icon className="h-4 w-4" strokeWidth={1.75} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={cn(
                            "text-[13px] font-semibold leading-tight",
                            isProhibited ? "text-destructive" : "text-foreground",
                          )}>
                            {c.label}
                          </p>
                          {c.domain && (
                            <p className="text-[10.5px] text-muted-foreground mt-0.5 truncate">{c.domain}</p>
                          )}
                        </div>
                        <Switch
                          checked={isProhibited}
                          onCheckedChange={() => toggle(c.id)}
                          ariaLabel={`${isProhibited ? "Permitir" : "Prohibir"} ${c.label}`}
                        />
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}

          {/* Aviso legal interno */}
          <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 flex items-start gap-2.5">
            <ShieldAlert className="h-4 w-4 text-warning mt-0.5 shrink-0" strokeWidth={1.75} />
            <div className="text-[11.5px] leading-relaxed text-foreground">
              Esta restricción se incluirá en la cláusula de marketing del
              contrato de colaboración. La agencia que infrinja la regla
              puede ser sancionada o ver rescindido su contrato.
            </div>
          </div>

          {/* Nota sobre integración futura */}
          <div className="rounded-xl border border-border bg-muted/30 p-3 flex items-start gap-2.5">
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
