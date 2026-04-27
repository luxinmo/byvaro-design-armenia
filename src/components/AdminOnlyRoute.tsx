/**
 * AdminOnlyRoute · gate de ruta · solo admin del workspace puede entrar.
 *
 * Se aplica encima de las rutas `/ajustes/*` para que un member que
 * intente acceder por URL directa sea redirigido a /inicio.
 *
 * Justificación · Ajustes contiene datos fiscales, gestión del equipo,
 * billing, integraciones, plan · todo eso es responsabilidad del admin
 * (Responsable). El member opera el día a día y no debería ver ni la
 * URL ni los enlaces (ya ocultados en sidebar / avatar dropdown).
 *
 * Aplica tanto a developer como a agency · `currentUser.role !== "admin"`
 * basta.
 *
 * TODO(backend): el server debe rechazar con 403 los `PATCH /api/empresa/*`
 * y similares cuando el JWT diga `role !== "admin"` · este guard solo
 * cubre la UI · la lógica server-side es la fuente de verdad.
 */

import { Navigate, useLocation } from "react-router-dom";
import { useCurrentUser } from "@/lib/currentUser";

export function AdminOnlyRoute({ children }: { children: JSX.Element }) {
  const user = useCurrentUser();
  const location = useLocation();

  /* Solo admin del workspace puede entrar · el member va a /inicio.
   * El setup del Responsable pendiente NO se gatea aquí · de eso se
   * encarga el `<CriticalActionGuard>` interno · así el admin recién
   * dado de alta llega a la ruta y el modal se hace cargo de obligar
   * a definir Responsable. */
  if (user.role !== "admin") {
    return <Navigate to="/inicio" replace state={{ from: location.pathname }} />;
  }

  return children;
}
