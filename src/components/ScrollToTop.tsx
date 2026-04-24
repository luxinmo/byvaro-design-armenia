/**
 * ScrollToTop · devuelve el scroll al principio en cada cambio de ruta.
 *
 * REGLA DE ORO — ver CLAUDE.md §"Scroll al entrar en una página":
 * Al navegar entre pantallas, el usuario debe aterrizar SIEMPRE
 * arriba, no donde había dejado la pantalla anterior. Este componente
 * se monta una sola vez en `App.tsx` dentro del `BrowserRouter` y
 * resetea todos los scrollers conocidos cuando cambia `pathname`.
 *
 * Cubrimos tres scrollers posibles:
 *   1. `window` · páginas que confían en el scroll del documento
 *      (móvil, páginas full-screen como `/login` o `/ajustes`).
 *   2. El `<main>` del `AppLayout` · es el contenedor con
 *      `overflow-auto` que engloba las páginas internas.
 *   3. Cualquier elemento con `[data-scroll-container]` · escape
 *      hatch para pantallas que tienen scroller interno propio (ej.
 *      `PromocionDetalle` con `h-full overflow-auto`).
 *
 * Se ignoran cambios que solo afecten a `search` o `hash` — cambiar
 * de tab vía `?tab=` NO debe provocar scroll al top (molesto).
 */

import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

export function ScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    // 1 · Window / documento.
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });

    // 2 · Contenedor principal del AppLayout.
    const main = document.querySelector("main");
    if (main) main.scrollTo({ top: 0, left: 0 });

    // 3 · Scrollers marcados explícitamente por pantallas.
    document.querySelectorAll<HTMLElement>("[data-scroll-container]").forEach((el) => {
      el.scrollTo({ top: 0, left: 0 });
    });
  }, [pathname]);

  return null;
}
