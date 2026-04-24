/**
 * Navegación unificada hacia una agencia desde cualquier sitio del
 * producto. Aplica la REGLA DE ORO de ficha vs panel:
 *
 *   · Agencia YA colaboradora (status === "active") → PANEL operativo
 *     `/colaboradores/:id/panel` con todo lo que hemos construido
 *     (Resumen, Datos, Visitas, Ventas, Registros, Documentación,
 *     Pagos, Facturas, Historial).
 *   · Agencia NO colaboradora todavía (pending / inactive / expired /
 *     marketplace / resultado de búsqueda) → FICHA PÚBLICA
 *     `/colaboradores/:id` que renderiza el perfil público
 *     (`Empresa.tsx` en modo visitor).
 *
 * Razonamiento · antes de colaborar, el promotor necesita ver el
 * marketing (descripción, mercados, equipo, testimonios). Una vez
 * colaboran, no quiere ese "brochure" sino la operativa del día a día.
 */

import type { Agency } from "@/data/agencies";

export function isActiveCollaborator(a: Agency): boolean {
  return a.status === "active" || a.estadoColaboracion === "activa";
}

export function agencyHref(a: Agency, opts?: { fromPromoId?: string }): string {
  if (isActiveCollaborator(a)) {
    const base = `/colaboradores/${a.id}/panel`;
    return opts?.fromPromoId ? `${base}?from=${opts.fromPromoId}` : base;
  }
  return `/colaboradores/${a.id}`;
}
