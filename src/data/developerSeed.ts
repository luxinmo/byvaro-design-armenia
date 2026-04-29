/**
 * Seed para el listado de promotores (Luxinmo en mock single-tenant).
 *
 * Shape ligero · solo los campos que necesita la card de listado
 * `AgencyGridCard` y similares. La fuente de verdad rica del
 * promotor (Empresa completo · razón social, CIF, marketing,
 * licencias, dirección fiscal, etc.) vive en `LUXINMO_PROFILE`
 * dentro de `src/lib/empresa.ts` · este seed la deriva para que
 * nunca puedan diverger.
 *
 * Por qué existen los DOS · la agencia logueada NO tiene
 * `byvaro-empresa` con los datos del promotor (es local al navegador
 * y contiene los datos de la propia agencia). El profile rico se
 * usa en `/promotor/:id` y `/promotor/:id/panel`; este seed plano
 * se usa en `/promotores` y `/colaboradores` (lado agencia).
 *
 * TODO(backend): cuando aterrice multi-tenant, ambos archivos
 * desaparecen · `GET /api/agency/promoters` devuelve la lista
 * pública y `GET /api/promotor/:id/profile` el perfil completo.
 */

import { DEFAULT_DEVELOPER_ID } from "@/lib/developerNavigation";
import { LUXINMO_PROFILE } from "@/lib/empresa";

export interface DeveloperSeed {
  id: string;
  nombreComercial: string;
  /** Logo principal · URL pública. Si falla en cargar, el componente
   *  `<Mark>` cae a iniciales (red de seguridad). */
  logoUrl: string;
  location: string;
  description?: string;
  verificada: boolean;
  googleRating?: number;
  googleRatingsTotal?: number;
  /** Idiomas en los que atiende el promotor (uppercase ISO-2 para
   *  renderizar como chips en el listado). */
  idiomasAtencion?: string[];
  /** Códigos ISO-2 de los mercados / nacionalidades que cubre. */
  mercados?: string[];
}

/** Listing-shape derivado del fixture rico `LUXINMO_PROFILE` para que
 *  el card del listado y la ficha pública nunca diverjan en logo /
 *  nombre / verificada / Google rating. */
export const LUXINMO_SEED: DeveloperSeed = {
  id: DEFAULT_DEVELOPER_ID,
  nombreComercial: LUXINMO_PROFILE.nombreComercial,
  logoUrl: LUXINMO_PROFILE.logoUrl,
  location: `${LUXINMO_PROFILE.direccionFiscal.ciudad}, ${LUXINMO_PROFILE.direccionFiscal.pais}`,
  description: LUXINMO_PROFILE.overview,
  verificada: LUXINMO_PROFILE.verificada,
  googleRating: LUXINMO_PROFILE.googleRating,
  googleRatingsTotal: LUXINMO_PROFILE.googleRatingsTotal,
  idiomasAtencion: LUXINMO_PROFILE.idiomasAtencion.map((s) => s.toUpperCase()),
  /* Mercados · campo de listing (no existe en Empresa · backend lo
   *  devolverá derivado de `marketingTopNacionalidades`). */
  mercados: ["ES", "GB", "FR", "DE", "BE", "NL", "RU"],
};

export function getDeveloperSeed(id: string): DeveloperSeed | undefined {
  if (id === DEFAULT_DEVELOPER_ID) return LUXINMO_SEED;
  return undefined;
}
