import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formatea un precio en euros con el locale español.
 * Helper centralizado — antes había copias en varios ficheros.
 */
export function formatPrice(n: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * Regla de negocio Byvaro: sólo mostramos el precio a las unidades
 * DISPONIBLES. Para reservadas, vendidas o retiradas devolvemos "—".
 *
 * Uso:
 *   <td>{priceForDisplay(unit)}</td>
 */
export function priceForDisplay(u: { price: number; status: string }): string {
  if (u.status !== "available") return "—";
  return formatPrice(u.price);
}
