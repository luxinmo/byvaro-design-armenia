/**
 * ExtrasOpcionalesCard · bloque de la ficha que lista los anejos
 * activos de la promoción (piscina privada · parking · trastero ·
 * sótano · solárium) como GRID HORIZONTAL de tiles con icono grande
 * + label + chip de precio.
 *
 * Cada tile es clickable · abre un mini-modal específico de SU
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
      <header className="flex items-baseline justify-between mb-4">
        <h2 className="text-base font-semibold text-foreground">Extras y opcionales</h2>
        {!hideEdit && (
          <p className="text-[11px] text-muted-foreground">Click para editar</p>
        )}
      </header>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {activeKeys.map((k) => (
          <ExtraTile
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

function ExtraTile({
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
        "flex flex-col items-center justify-start gap-2 rounded-xl border p-3 text-center transition-all",
        priceMode === "optional"
          ? "border-primary/40 bg-primary/[0.03]"
          : priceMode === "included"
          ? "border-success/30 bg-success/[0.03]"
          : "border-border bg-background",
        disabled
          ? "cursor-default"
          : "hover:border-foreground/40 hover:bg-muted/30 hover:-translate-y-0.5",
      )}
    >
      <div className={cn(
        "flex h-10 w-10 items-center justify-center rounded-xl shrink-0",
        priceMode === "optional"
          ? "bg-primary/15 text-primary"
          : priceMode === "included"
          ? "bg-success/15 text-success"
          : "bg-muted text-muted-foreground",
      )}>
        <Icon className="h-5 w-5" strokeWidth={1.6} />
      </div>
      <p className="text-[12.5px] font-semibold text-foreground leading-tight">{label}</p>
      <PriceTag mode={priceMode} price={price} />
    </button>
  );
}

function PriceTag({ mode, price }: { mode: PriceMode; price: number | null }) {
  if (mode === "included") {
    return <p className="text-[10.5px] font-medium text-success">Incluido</p>;
  }
  if (mode === "not_included") {
    return <p className="text-[10.5px] text-muted-foreground">No incluido</p>;
  }
  if (mode === "optional") {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Opcional</p>
        {price && price > 0 ? (
          <p className="text-[12px] font-bold tnum text-foreground">{price.toLocaleString("es-ES")} €</p>
        ) : (
          <p className="text-[10.5px] italic text-muted-foreground">Sin precio</p>
        )}
      </div>
    );
  }
  return <p className="text-[10.5px] italic text-muted-foreground">Sin definir</p>;
}
