/**
 * Navegación unificada hacia una agencia desde cualquier sitio del
 * producto.
 *
 * REGLA DE ORO (revisada 2026-04-30) · cualquier click desde
 * `/colaboradores`, `/promotores` u otra surface interna a una
 * empresa va SIEMPRE al PANEL operativo
 * `/colaboradores/:id/panel` (Resumen, Datos, Visitas, Ventas,
 * Registros, Documentación, Pagos, Facturas, Historial). Aunque NO
 * exista colaboración formal todavía, el usuario quiere la vista
 * avanzada · no el brochure público.
 *
 * La ficha pública `/colaboradores/:id` (Empresa.tsx visitor) sigue
 * existiendo como ruta válida para enlaces externos / no
 * autenticados, pero la app NUNCA navega allí desde dentro.
 */

import type { Agency } from "@/data/agencies";
import { getPublicRef } from "./tenantRefResolver";

export function isActiveCollaborator(a: Agency): boolean {
  return a.status === "active" || a.estadoColaboracion === "activa";
}

/** Construye la URL pública hacia una agencia · siempre al panel
 *  avanzado. Prefiere el `IDXXXXXX` (Agency.publicRef) sobre el id
 *  interno · fallback al id solo si la cache + seeds aún no tienen
 *  la ref hidratada. */
export function agencyHref(a: Agency, opts?: { fromPromoId?: string }): string {
  const ref = a.publicRef || getPublicRef(a.id) || a.id;
  const base = `/colaboradores/${ref}/panel`;
  return opts?.fromPromoId ? `${base}?from=${opts.fromPromoId}` : base;
}
