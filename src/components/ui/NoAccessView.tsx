/**
 * NoAccessView · placeholder canónico cuando el usuario actual NO
 * tiene `viewOwn` ni `viewAll` para una feature.
 *
 * QUÉ
 * ----
 * Empty state amigable que comunica claramente:
 *  · que NO es un bug (la feature existe)
 *  · que el usuario NO tiene permiso (no es problema técnico)
 *  · qué hacer · pedir al admin que edite la matriz de roles
 *
 * Patrón replicado del que ya vivía inline en `ContactWhatsAppTab`
 * (REGLA DE ORO · "Datos sensibles requieren permiso" en CLAUDE.md).
 *
 * USO
 * ---
 *  if (!useHasPermission("contacts.viewOwn")) return <NoAccessView feature="Contactos" />;
 */

import { Lock } from "lucide-react";

interface Props {
  /** Nombre legible de la feature · ej. "Contactos", "Ventas". */
  feature: string;
  /** Override de la copy si la default no encaja. Default:
   *  "Tu rol no tiene permiso para ver {feature}". */
  message?: string;
}

export function NoAccessView({ feature, message }: Props) {
  const copy = message
    ?? `Tu rol no tiene permiso para ver ${feature}. Pide a un administrador que te lo conceda.`;
  return (
    <div className="bg-card rounded-2xl border border-border/40 shadow-soft p-10 text-center max-w-md mx-auto">
      <div className="h-12 w-12 mx-auto rounded-2xl bg-muted grid place-items-center text-muted-foreground mb-4">
        <Lock className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold text-foreground">Sin acceso a {feature}</p>
      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
        {copy} La matriz vive en{" "}
        <span className="text-foreground font-medium">Ajustes · Usuarios y roles · Roles y permisos</span>.
      </p>
    </div>
  );
}
