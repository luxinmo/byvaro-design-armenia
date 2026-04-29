/**
 * EmpresaCategoryBadges · pinta las categorías canónicas de una
 * empresa (Inmobiliaria · Promotor · Comercializador) como pills
 * compactas. Reutilizable en card de listado, hero de ficha pública,
 * panel operativo y AccountSwitcher.
 *
 * Tokens del design system · sin hex hardcoded:
 *   inmobiliaria    → primary  (azul corporativo · es el rol "core" agencia)
 *   promotor        → success  (verde · construye, lleva el producto)
 *   comercializador → warning  (ámbar · vende, intermedia · más operativo)
 *
 * Tres tamaños: "xs" (cards densas), "sm" (default · hero/panel),
 * "md" (header grande de ficha pública).
 */

import { cn } from "@/lib/utils";
import {
  type EmpresaCategory,
  EMPRESA_CATEGORY_LABELS,
} from "@/lib/empresaCategories";

const TONE_BY_CATEGORY: Record<EmpresaCategory, string> = {
  inmobiliaria:    "border-primary/25 bg-primary/10 text-primary",
  promotor:        "border-success/25 bg-success/10 text-success",
  comercializador: "border-warning/25 bg-warning/10 text-warning",
};

const SIZE_CLS = {
  xs: "h-4 px-1.5 text-[9.5px] tracking-wider",
  sm: "h-5 px-2 text-[10.5px] tracking-wider",
  md: "h-6 px-2.5 text-[11px] tracking-wider",
} as const;

interface Props {
  categories: EmpresaCategory[];
  size?: keyof typeof SIZE_CLS;
  className?: string;
}

export function EmpresaCategoryBadges({
  categories, size = "sm", className,
}: Props) {
  if (!categories.length) return null;
  return (
    <div className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {categories.map((c) => (
        <span
          key={c}
          className={cn(
            "inline-flex items-center rounded-full border font-semibold uppercase",
            SIZE_CLS[size],
            TONE_BY_CATEGORY[c],
          )}
          title={EMPRESA_CATEGORY_LABELS[c]}
        >
          {EMPRESA_CATEGORY_LABELS[c]}
        </span>
      ))}
    </div>
  );
}
