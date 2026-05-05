/**
 * ExtrasOpcionalesCard · bloque de la ficha que lista los anejos
 * activos de la promoción (piscina privada · parking · trastero ·
 * sótano · solárium) con su modo de precio y precio opcional.
 *
 * Cada fila es clickable · abre un mini-modal específico de SU
 * categoría (EditStepModal con `step="extras"` + `extrasOnlyCategory`).
 *
 * Solo se renderizan las categorías marcadas como `enabled` en el
 * wizardSnapshot. Si no hay ninguna activa, el bloque entero no se
 * muestra (cero ruido en la ficha).
 *
 * TODO(backend): cuando el endpoint real devuelva
 * `promotion.metadata.wizardSnapshot.promotionDefaults` con sus
 * priceMode/optionalPrice, este componente queda como está · solo
 * cambia el origen del dato.
 */

import { ChevronRight } from "lucide-react";
import { feature } from "@/lib/featureIcons";
import { cn } from "@/lib/utils";
import type { Promotion } from "@/data/promotions";

type ExtraKey = "privatePool" | "parking" | "storageRoom" | "basement" | "solarium";

type PriceMode = "included" | "optional" | "not_included" | null | undefined;

interface ExtraSlot {
  enabled?: boolean;
  priceMode?: PriceMode;
  optionalPrice?: number | null;
}

const ORDER: ExtraKey[] = ["privatePool", "parking", "storageRoom", "basement", "solarium"];

export function ExtrasOpcionalesCard({
  promotion,
  hideEdit,
  onEdit,
}: {
  promotion: Promotion;
  hideEdit: boolean;
  onEdit: (cat: ExtraKey) => void;
}) {
  const snap = (promotion as unknown as {
    metadata?: { wizardSnapshot?: { promotionDefaults?: Record<ExtraKey, ExtraSlot> } };
  }).metadata?.wizardSnapshot?.promotionDefaults;

  if (!snap) return null;

  const activeKeys = ORDER.filter((k) => snap[k]?.enabled);
  if (activeKeys.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-card shadow-soft p-4 sm:p-5">
      <header className="flex items-baseline justify-between mb-3">
        <h2 className="text-base font-semibold text-foreground">Extras y opcionales</h2>
        <p className="text-[11px] text-muted-foreground">Click para editar</p>
      </header>
      <div className="flex flex-col divide-y divide-border/50">
        {activeKeys.map((k) => (
          <ExtraRow
            key={k}
            featureKey={k}
            slot={snap[k]}
            disabled={hideEdit}
            onClick={() => onEdit(k)}
          />
        ))}
      </div>
    </section>
  );
}

function ExtraRow({
  featureKey,
  slot,
  disabled,
  onClick,
}: {
  featureKey: ExtraKey;
  slot: ExtraSlot | undefined;
  disabled: boolean;
  onClick: () => void;
}) {
  const { icon: Icon, label } = feature(featureKey);
  const priceMode: PriceMode = slot?.priceMode ?? null;
  const price = slot?.optionalPrice ?? null;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 py-3 text-left transition-colors",
        disabled ? "cursor-default" : "hover:bg-muted/30 -mx-2 px-2 rounded-lg",
      )}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
        <Icon className="h-4 w-4" strokeWidth={1.6} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] font-medium text-foreground">{label}</p>
        <PriceTag mode={priceMode} price={price} />
      </div>
      {!disabled && (
        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.8} />
      )}
    </button>
  );
}

function PriceTag({ mode, price }: { mode: PriceMode; price: number | null }) {
  if (mode === "included") {
    return <p className="text-[11.5px] mt-0.5 inline-flex items-center gap-1 text-success">Incluido en el precio</p>;
  }
  if (mode === "not_included") {
    return <p className="text-[11.5px] mt-0.5 inline-flex items-center gap-1 text-muted-foreground">No incluido</p>;
  }
  if (mode === "optional") {
    return (
      <p className="text-[11.5px] mt-0.5 inline-flex items-center gap-1 text-foreground">
        <span className="text-muted-foreground">Opcional</span>
        {price && price > 0 ? (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="font-semibold tnum">{price.toLocaleString("es-ES")} €</span>
          </>
        ) : (
          <>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground italic">precio sin definir</span>
          </>
        )}
      </p>
    );
  }
  return <p className="text-[11.5px] mt-0.5 text-muted-foreground italic">Sin definir si incluye</p>;
}
