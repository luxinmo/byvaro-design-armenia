/**
 * lib/unsavedGuard · guard sencillo para cambios sin guardar.
 *
 * Cualquier componente puede registrar una función que devuelva `true`
 * si tiene cambios pendientes. Un listener global de `click` (instalado
 * en `AppLayout`) intercepta navegaciones dentro de la app (sidebar
 * links, NavLinks, cualquier `<a>` con `href` interno) y muestra una
 * confirmación nativa. Si el usuario cancela, se bloquea la navegación.
 *
 * No usa React Context para minimizar acoplamiento y funcionar fuera
 * de proveedores.
 */

type Guard = () => boolean;

let guards: Guard[] = [];

/** Registra un guard. Devuelve un deregistrador para usar en useEffect. */
export function registerUnsavedGuard(fn: Guard): () => void {
  guards.push(fn);
  return () => {
    guards = guards.filter((g) => g !== fn);
  };
}

/** ¿Hay algún guard activo que reporte cambios sin guardar? */
export function hasUnsavedChanges(): boolean {
  return guards.some((g) => {
    try {
      return !!g();
    } catch {
      return false;
    }
  });
}
