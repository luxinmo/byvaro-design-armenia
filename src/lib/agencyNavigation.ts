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
import { getPublicRef } from "./tenantRefResolver";

export function isActiveCollaborator(a: Agency): boolean {
  return a.status === "active" || a.estadoColaboracion === "activa";
}

/** Construye la URL pública hacia una agencia. Prefiere el
 *  `IDXXXXXX` (Agency.publicRef) sobre el id interno · fallback al
 *  id solo si la cache + seeds aún no tienen la ref hidratada. */
export function agencyHref(a: Agency, opts?: { fromPromoId?: string }): string {
  const ref = a.publicRef || getPublicRef(a.id) || a.id;
  if (isActiveCollaborator(a)) {
    const base = `/colaboradores/${ref}/panel`;
    return opts?.fromPromoId ? `${base}?from=${opts.fromPromoId}` : base;
  }
  return `/colaboradores/${ref}`;
}
