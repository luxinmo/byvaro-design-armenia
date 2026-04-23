/**
 * PromotionAvailabilitySummary · tarjeta resumen de inventario en la vista
 * principal de la ficha de promoción.
 *
 * Responsabilidades:
 *   1. Mostrar un vistazo rápido del inventario de la promoción: totales por
 *      estado (disponibles, reservadas, vendidas, retiradas).
 *   2. Calcular y mostrar el precio medio de las unidades disponibles.
 *   3. Calcular el porcentaje de ocupación (unidades NO disponibles / total).
 *   4. Ofrecer un atajo "Ver todo" que dispara `onViewAll()` — típicamente
 *      navega a la pestaña completa de disponibilidad.
 *
 * Props:
 *   - promotionId: string          → ID de la promoción (key de `unitsByPromotion`).
 *   - onViewAll: () => void        → callback para el CTA "Ver todo".
 *
 * Dependencias:
 *   - `@/data/units`             → fuente mock de unidades (unitsByPromotion).
 *   - `@/components/ui/button`   → primitiva Button Byvaro (no usada directamente,
 *                                  pero se mantiene el import por consistencia con
 *                                  otros componentes del mismo slot).
 *   - `lucide-react`             → icono ArrowRight para el CTA.
 *
 * Tokens Byvaro usados (todos HSL, definidos en src/index.css):
 *   - bg-card · border-border · text-foreground · text-muted-foreground
 *   - bg-primary (dot "Disponibles")
 *   - bg-destructive (dot "Retiradas")
 *   - Excepción amber-500: dot "Reservadas" — warning estándar Byvaro.
 *   - Radios: `rounded-2xl` (panel principal) · `rounded-full` (dots).
 *
 * TODOs:
 *   - TODO(backend): endpoint GET /api/promociones/:id/availability-summary con
 *     { available, reserved, sold, withdrawn, avgPrice, occupancy } agregados
 *     server-side (ahora lo hacemos client-side sobre todas las unidades).
 *   - TODO(ui): añadir sparkline o barra apilada de ocupación para reforzar
 *     visualmente el mix de estados.
 *   - TODO(feature): permitir al promotor configurar qué KPIs adicionales
 *     aparecen aquí (ej. precio medio por m², tiempo medio en mercado).
 */

import { useState } from "react";
import { unitsByPromotion } from "@/data/units"; // Mock inventory (reemplazar por API)
import { ArrowRight, Plus } from "lucide-react";
// Button: primitiva Byvaro. Mantener el import aunque no se use directamente — se
// conserva por paridad con el archivo original y para futuros CTAs en este panel.
import { Button } from "@/components/ui/button";
import { AddAnejosBatchDialog } from "./AddAnejosBatchDialog";
import { useAnejosForPromotion, addAnejo } from "@/lib/anejosStorage";
import type { AnejoTipo } from "@/data/anejos";
import { useToast } from "@/hooks/use-toast";

function formatPrice(n: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export function PromotionAvailabilitySummary({
  promotionId,
  onViewAll,
  isCollaboratorView = false,
}: {
  promotionId: string;
  onViewAll: () => void;
  /** En vista agencia escondemos el contador "Retiradas" — la agencia no
   *  gestiona retiradas, son una decisión interna del promotor. */
  isCollaboratorView?: boolean;
}) {
  const { toast } = useToast();
  const units = unitsByPromotion[promotionId] || [];

  /* Alta de anejo · solo promotor. El CTA vive aquí (en el bloque
   * "Unidades y disponibilidad" de la ficha) para que el promotor
   * tenga un único punto de acceso, sin pasar por el detalle de
   * Disponibilidad. Usamos el mismo modal que el wizard: batch con
   * stepper para parking/trastero. */
  const [anejoDialogOpen, setAnejoDialogOpen] = useState(false);
  const anejos = useAnejosForPromotion(promotionId);
  const anejosVisibleCount = anejos.filter((a) => !isCollaboratorView || (a.visibleToAgencies !== false && a.status === "available")).length;
  const handleBatchConfirm = (payload: {
    parking:  { count: number; price: number };
    trastero: { count: number; price: number };
  }) => {
    const makeBatch = (tipo: AnejoTipo, count: number, price: number) => {
      if (count <= 0) return 0;
      const sameType = anejos.filter((a) => a.tipo === tipo);
      const prefix = tipo === "parking" ? "P" : "T";
      const maxNum = sameType.reduce((m, a) => {
        const n = parseInt(a.publicId.replace(/[^\d]/g, ""), 10);
        return Number.isFinite(n) && n > m ? n : m;
      }, 0);
      for (let i = 1; i <= count; i++) {
        addAnejo(promotionId, {
          tipo,
          publicId: `${prefix}${maxNum + i}`,
          precio: price,
          visibleToAgencies: true,
        });
      }
      return count;
    };
    const addedP = makeBatch("parking",  payload.parking.count,  payload.parking.price);
    const addedT = makeBatch("trastero", payload.trastero.count, payload.trastero.price);
    const total = addedP + addedT;
    if (total === 0) return;
    const parts: string[] = [];
    if (addedP > 0) parts.push(`${addedP} parking${addedP === 1 ? "" : "s"}`);
    if (addedT > 0) parts.push(`${addedT} trastero${addedT === 1 ? "" : "s"}`);
    toast({ title: `Se añadieron ${total} anejo${total === 1 ? "" : "s"}`, description: parts.join(" · ") });
  };

  if (units.length === 0) return null;

  const available = units.filter(u => u.status === "available");
  const reserved = units.filter(u => u.status === "reserved");
  const sold = units.filter(u => u.status === "sold");
  const withdrawn = units.filter(u => u.status === "withdrawn");

  // Dots de estado unificados con paleta de tokens Byvaro.
  // Amber conservado para "Reservadas" (warning estándar).
  const stats = [
    { label: "Disponibles", count: available.length, dot: "bg-primary" },
    { label: "Reservadas", count: reserved.length, dot: "bg-warning" },
    { label: "Vendidas", count: sold.length, dot: "bg-primary" },
    ...(isCollaboratorView
      ? []
      : [{ label: "Retiradas", count: withdrawn.length, dot: "bg-destructive" }]),
  ];

  const avgPrice = available.length > 0
    ? Math.round(available.reduce((s, u) => s + u.price, 0) / available.length)
    : 0;
  const occupancy = Math.round(((units.length - available.length) / units.length) * 100);

  return (
    <div className="rounded-2xl border border-border/40 bg-card p-5 2xl:p-6 shadow-soft">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-5">
        <h2 className="text-base font-semibold text-foreground">
          Inventario <span className="text-muted-foreground font-normal">· {units.length} unidades</span>
        </h2>
        <button
          onClick={onViewAll}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
        >
          Ver todo <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {stats.map(s => (
          <div key={s.label}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</span>
            </div>
            <p className="text-lg font-semibold text-foreground tabular-nums">{s.count}</p>
          </div>
        ))}
      </div>

      {/* Meta */}
      <div className="flex items-center justify-between pt-4 border-t border-border/40 text-xs">
        <span className="text-muted-foreground">Precio medio</span>
        <span className="text-foreground font-medium tabular-nums">{formatPrice(avgPrice)}</span>
      </div>
      <div className="flex items-center justify-between mt-2 text-xs">
        <span className="text-muted-foreground">Ocupación</span>
        <span className="text-foreground font-medium tabular-nums">{occupancy}%</span>
      </div>

      {/* Anejos sueltos · contador + CTA de alta (solo promotor).
          Evitamos duplicar el alta en la tabla de anejos: este es el
          único punto de entrada. */}
      {!isCollaboratorView && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/40">
          <div className="text-xs">
            <span className="text-muted-foreground">Anejos sueltos</span>
            <span className="ml-2 text-foreground font-medium tabular-nums">
              {anejos.length === 0 ? "Ninguno" : `${anejos.length} (${anejosVisibleCount} activos)`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setAnejoDialogOpen(true)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-border bg-card text-foreground text-[11.5px] font-medium hover:bg-muted/50 transition-colors"
          >
            <Plus className="h-3 w-3" strokeWidth={2} />
            Añadir anejo
          </button>
        </div>
      )}

      {!isCollaboratorView && (
        <AddAnejosBatchDialog
          open={anejoDialogOpen}
          onOpenChange={setAnejoDialogOpen}
          existing={anejos}
          defaultTipo="parking"
          onConfirm={handleBatchConfirm}
        />
      )}
    </div>
  );
}
