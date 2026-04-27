/**
 * RequireAuth — gate de autenticación a nivel de ruta.
 *
 * Si el usuario no tiene sesión activa, redirige a `/login` preservando
 * la URL original como `?next=` para volver tras autenticarse. La app
 * NO debe ser accesible sin login en producción · este componente
 * envuelve TODAS las rutas internas.
 *
 * Mock · `isAuthenticated()` solo mira sessionStorage. En producción
 * debe sustituirse por verificación contra `GET /api/auth/me` con
 * cookie httpOnly o Bearer token.
 *
 * TODO(backend): cuando exista API real, sustituir el guard sync por
 * un AuthContext que haga `useEffect` de fetch al montar y muestre
 * loading state mientras valida.
 */

import { Navigate, useLocation } from "react-router-dom";
import { isAuthenticated } from "@/lib/accountType";

export function RequireAuth({ children }: { children: JSX.Element }) {
  const location = useLocation();
  if (!isAuthenticated()) {
    /* Preserva la URL original para que el Login pueda redirigir
       de vuelta tras login exitoso. */
    const next = location.pathname + location.search;
    const search = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
    return <Navigate to={`/login${search}`} replace />;
  }
  return children;
}
