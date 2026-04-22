/**
 * SettingsPlaceholder · página por defecto para rutas /ajustes/*
 * que aún no tienen implementación real.
 *
 * Lee el `findContext(pathname)` del registry para mostrar el título
 * del link y un breadcrumb sección > grupo > link. Indica claramente
 * que es un placeholder ("En diseño") para que el usuario y futuros
 * Claude Code sepan lo que falta.
 */

import { useLocation } from "react-router-dom";
import { Sparkles, Construction } from "lucide-react";
import { SettingsScreen, SettingsCard } from "./SettingsScreen";
import { findContext } from "./registry";

export function SettingsPlaceholder() {
  const { pathname } = useLocation();
  const ctx = findContext(pathname);

  if (!ctx) {
    return (
      <SettingsScreen
        title="Página no encontrada"
        description="La ruta solicitada no existe en el registro de Ajustes."
      >
        <SettingsCard>
          <p className="text-sm text-muted-foreground">
            Comprueba el menú lateral para ver las opciones disponibles.
          </p>
        </SettingsCard>
      </SettingsScreen>
    );
  }

  return (
    <SettingsScreen
      title={ctx.link.label}
      description={`${ctx.section.title} · ${ctx.group.title}`}
    >
      <SettingsCard>
        <div className="flex items-start gap-4 py-2">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 grid place-items-center shrink-0">
            <Construction className="h-5 w-5 text-primary" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold mb-2">
              <Sparkles className="h-3 w-3" />
              En diseño
            </div>
            <h3 className="text-base font-semibold text-foreground">
              {ctx.link.label}
            </h3>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              Esta sección está pendiente de implementar. Forma parte de{" "}
              <strong className="text-foreground">{ctx.group.title}</strong> dentro
              de <strong className="text-foreground">{ctx.section.title}</strong>.
            </p>
            <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
              Mientras tanto, puedes navegar por el menú lateral. Las páginas con
              contenido real ya implementadas son:
            </p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              <li>· Idioma y región (idioma · zona horaria · formato fecha · moneda)</li>
              <li>· Contactos (etiquetas · orígenes)</li>
              <li>· Email (firma · plantillas · auto-respuesta · SMTP — placeholders)</li>
            </ul>
          </div>
        </div>
      </SettingsCard>
    </SettingsScreen>
  );
}
