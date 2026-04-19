/**
 * Tipos auxiliares usados por developerPromotions.ts.
 * Extraídos de create-promotion/types.ts del proyecto original.
 * Solo los que realmente se consumen en el listado/ficha de promoción.
 */

export type FormaPagoComision = "proporcional" | "escritura" | "personalizado";

export type ClasificacionCliente = "residencia" | "fiscal" | "manual";

export type CondicionRegistro =
  | "nombre_completo"
  | "ultimas_4_cifras"
  | "nacionalidad"
  | "email_completo";

export interface HitoComision {
  pagoCliente: number;
  pagoColaborador: number;
}
