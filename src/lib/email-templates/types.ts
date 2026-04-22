/**
 * Tipos compartidos para las plantillas de email transaccional de Byvaro.
 *
 * Cada plantilla exporta una función que recibe sus parámetros tipados
 * y devuelve un `RenderedEmail` con asunto + cuerpo HTML + cuerpo texto
 * plano. El backend (cuando exista) las pasará al proveedor SMTP /
 * transactional (Resend, Postmark, SES…). Mientras tanto, se usan
 * para preview en `EmailPreviewDialog`.
 */

export type RenderedEmail = {
  /** Asunto del mensaje. */
  subject: string;
  /** HTML completo, listo para enviar. */
  html: string;
  /** Versión texto plano para clientes que no renderizan HTML. */
  text: string;
};
