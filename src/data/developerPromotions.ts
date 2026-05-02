import { type Promotion } from "./promotions";
import type { FormaPagoComision, ClasificacionCliente, CondicionRegistro, HitoComision } from "@/types/promotion-config";
import type { ModoValidacionRegistro } from "@/components/crear-promocion/types";

export type CollaborationConfig = {
  comisionInternacional: number;
  comisionNacional: number;
  diferenciarNacionalInternacional: boolean;
  diferenciarComisiones: boolean;
  agenciasRefusarNacional: boolean;
  clasificacionCliente: ClasificacionCliente;
  formaPagoComision: FormaPagoComision | null;
  hitosComision: HitoComision[];
  ivaIncluido: boolean;
  condicionesRegistro: CondicionRegistro[];
  validezRegistroDias: number; // 0 = no expira
  /** Modo de validación · "directo" o "por_visita". Opcional en seed
   *  para retro-compatibilidad: cuando falta, asumir "por_visita" (el
   *  default histórico de la copy del wizard).
   *  TODO(logic): la lógica que actúa sobre este flag aún no existe ·
   *  ver `docs/registration-system.md §2`. */
  modoValidacionRegistro?: ModoValidacionRegistro;
};

export type PuntoDeVenta = {
  id: string;
  nombre: string;
  direccion: string;
  telefono: string;
  email: string;
  whatsapp: string;
  coverUrl?: string;
};

export type ComercialPermissions = {
  canRegister: boolean;
  canShareWithAgencies: boolean;
  canEdit: boolean;
};

export type Comercial = {
  id: string;
  nombre: string;
  email: string;
  avatar?: string;
  permissions: ComercialPermissions;
};

export type DevPromotion = Promotion & {
  missingSteps?: string[];
  canShareWithAgencies?: boolean;
  collaboration?: CollaborationConfig;
  /** IDs de oficinas del workspace (`byvaro-oficinas`) que actúan
   *  como puntos de venta para esta promoción. La fuente de verdad de
   *  los datos de oficina es `useOficinas()` — aquí solo guardamos
   *  referencias. NUNCA inline data: una oficina referenciada SIEMPRE
   *  debe existir en el listado del workspace. */
  puntosDeVentaIds?: string[];
  comerciales?: Comercial[];
};

/* RAW seeds · el campo `code` legacy queda como breadcrumb · el real
 * lo derivamos abajo con `seedRef("promotion", id)` siguiendo el
 * scheme canónico (PR + 5 dígitos · CLAUDE.md). */
const RAW_DEV_PROMOTIONS: DevPromotion[] = [];

import { seedRef } from "@/lib/publicRef";

/** Export final · `code` se sobrescribe con el formato canónico
 *  `PR + 5 dígitos` derivado del id via hash determinista. */
export const developerOnlyPromotions: DevPromotion[] = RAW_DEV_PROMOTIONS.map((p) => ({
  ...p,
  code: seedRef("promotion", p.id),
}));
