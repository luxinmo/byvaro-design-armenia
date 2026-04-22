/**
 * ActivateSharingDialog · activar "compartir con agencias" en una promoción.
 *
 * Se abre desde la tab Comisiones cuando `canShareWithAgencies === false`.
 * Permite activar la opción y fijar las condiciones base (% comisión +
 * duración) que el sistema usará como defaults para cada invitación futura.
 *
 * TODO(backend):
 *   POST /api/promociones/:id/compartir/activar
 *     body: { comision, duracionMeses }
 *     → { canShareWithAgencies: true }
 */
import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Handshake, X as XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  promotionName: string;
  initialCommission?: number;
  initialDuration?: number;
  onActivate: (config: { comision: number; duracionMeses: number }) => void;
}

const DURATION_OPTIONS: { key: string; value: number; label: string }[] = [
  { key: "1", value: 1, label: "1 mes" },
  { key: "3", value: 3, label: "3 meses" },
  { key: "6", value: 6, label: "6 meses" },
  { key: "12", value: 12, label: "12 meses" },
];

export function ActivateSharingDialog({
  open, onOpenChange, promotionName,
  initialCommission = 5, initialDuration = 12,
  onActivate,
}: Props) {
  const [comision, setComision] = useState<number>(initialCommission);
  const [duracion, setDuracion] = useState<number>(initialDuration);

  useEffect(() => {
    if (open) {
      setComision(initialCommission);
      setDuracion(initialDuration);
    }
  }, [open, initialCommission, initialDuration]);

  const valid = comision > 0 && comision <= 100 && duracion > 0;

  const handleActivate = () => {
    if (!valid) return;
    onActivate({ comision, duracionMeses: duracion });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 overflow-hidden bg-card border-0 max-w-[480px]">
        <DialogHeader className="sr-only">
          <DialogTitle>Activar compartir con agencias</DialogTitle>
          <DialogDescription>{promotionName}</DialogDescription>
        </DialogHeader>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Handshake className="h-3.5 w-3.5 text-primary" strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground truncate leading-tight">
                Activar compartir con agencias
              </h2>
              <p className="text-[10px] text-muted-foreground truncate">{promotionName}</p>
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            aria-label="Cerrar"
          >
            <XIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Al activar, las agencias podrán recibir invitaciones para colaborar en
            esta promoción. Las siguientes condiciones se usarán como valores por
            defecto del sistema; podrás editarlas en cada invitación.
          </p>

          {/* Comisión */}
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Comisión por venta
            </Label>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-full bg-card border border-border px-3 py-1">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={comision}
                  onChange={(e) => setComision(Math.max(0, Math.min(100, parseFloat(e.target.value || "0"))))}
                  className="h-7 w-14 border-0 bg-transparent px-0 text-right text-sm font-bold text-foreground focus-visible:ring-0 tabular-nums"
                />
                <span className="text-sm font-semibold text-foreground">%</span>
              </div>
              <span className="text-[11px] text-muted-foreground">IVA incluido · sobre el importe de la venta</span>
            </div>
          </div>

          {/* Duración */}
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Duración por defecto de la colaboración
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {DURATION_OPTIONS.map(opt => {
                const selected = duracion === opt.value;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setDuracion(opt.value)}
                    className={cn(
                      "h-8 px-3 rounded-full text-xs font-medium transition-colors border",
                      selected
                        ? "bg-foreground text-background border-foreground"
                        : "bg-card text-foreground border-border hover:bg-muted",
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-3 flex items-center gap-2">
          <Button
            variant="ghost"
            className="flex-1 rounded-full h-10 text-sm text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1 rounded-full h-10 text-sm bg-primary text-primary-foreground hover:bg-primary/90 shadow-soft disabled:opacity-50"
            onClick={handleActivate}
            disabled={!valid}
          >
            Activar compartir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
