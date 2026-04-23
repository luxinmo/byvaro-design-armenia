/**
 * AnejoFormDialog · modal para crear/editar un anejo suelto
 * (parking o trastero) desde la ficha de promoción.
 *
 * Campos:
 *  - tipo (parking · trastero) — prefijado según segmento activo.
 *  - ID visible (p.ej. P4, T3).
 *  - Precio en EUR.
 *  - Visible para agencias (toggle) — si está OFF, el anejo existe
 *    para el promotor pero se oculta por completo a la vista de
 *    agencia colaboradora.
 *
 * En edición, `initial` viene relleno y solo se pueden mutar precio,
 * tipo, publicId y visibilidad (status/cliente se gestionan desde el
 * kebab).
 */

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Car, Archive, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Anejo, AnejoTipo } from "@/data/anejos";

export type AnejoFormValues = {
  tipo: AnejoTipo;
  publicId: string;
  precio: number;
  visibleToAgencies: boolean;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultTipo: AnejoTipo;
  initial?: Anejo;
  onSubmit: (values: AnejoFormValues) => void;
}

export function AnejoFormDialog({ open, onOpenChange, defaultTipo, initial, onSubmit }: Props) {
  const [tipo, setTipo] = useState<AnejoTipo>(defaultTipo);
  const [publicId, setPublicId] = useState("");
  const [precio, setPrecio] = useState<string>("");
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTipo(initial.tipo);
      setPublicId(initial.publicId);
      setPrecio(String(initial.precio));
      setVisible(initial.visibleToAgencies !== false);
    } else {
      setTipo(defaultTipo);
      setPublicId("");
      setPrecio("");
      setVisible(true);
    }
  }, [open, initial, defaultTipo]);

  const precioNum = Number(precio.replace(/[^\d.]/g, ""));
  const canSubmit = publicId.trim().length > 0 && Number.isFinite(precioNum) && precioNum > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({
      tipo,
      publicId: publicId.trim(),
      precio: precioNum,
      visibleToAgencies: visible,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar anejo" : "Añadir anejo"}</DialogTitle>
          <DialogDescription>
            {initial ? "Actualiza los datos del anejo." : "Parking o trastero que se vende por separado."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tipo */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tipo</label>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              {(["parking", "trastero"] as AnejoTipo[]).map((t) => {
                const Icon = t === "parking" ? Car : Archive;
                const selected = tipo === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTipo(t)}
                    className={cn(
                      "inline-flex items-center justify-center gap-2 h-10 rounded-xl border text-xs font-medium transition-colors",
                      selected
                        ? "bg-foreground text-background border-foreground"
                        : "bg-card text-foreground border-border hover:bg-muted/40",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                    {t === "parking" ? "Parking" : "Trastero"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ID + Precio */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">ID</label>
              <input
                value={publicId}
                onChange={(e) => setPublicId(e.target.value)}
                placeholder={tipo === "parking" ? "P4" : "T3"}
                className="mt-1.5 w-full h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Precio (€)</label>
              <input
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                inputMode="numeric"
                placeholder="18000"
                className="mt-1.5 w-full h-10 px-3 rounded-xl border border-border bg-background text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Visibilidad */}
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className={cn(
              "w-full flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors",
              visible ? "border-success/30 bg-success/5" : "border-border bg-muted/30",
            )}
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "inline-flex items-center justify-center h-8 w-8 rounded-full",
                  visible ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
                )}
              >
                {visible ? <Eye className="h-4 w-4" strokeWidth={1.5} /> : <EyeOff className="h-4 w-4" strokeWidth={1.5} />}
              </span>
              <div>
                <p className="text-xs font-semibold text-foreground">Visible para agencias</p>
                <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                  {visible
                    ? "Las agencias colaboradoras ven este anejo en la tabla."
                    : "Solo tú lo ves · la agencia no sabrá que existe."}
                </p>
              </div>
            </div>
            <span
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors",
                visible ? "bg-success" : "bg-muted-foreground/30",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-4 w-4 rounded-full bg-background shadow transition-transform",
                  visible ? "translate-x-4" : "translate-x-0.5",
                )}
              />
            </span>
          </button>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} className="rounded-full">
            {initial ? "Guardar cambios" : "Añadir anejo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
