/**
 * /ajustes — Home del módulo Ajustes (estilo Lovable).
 *
 * Renderiza el `AjustesHome` (directorio de cards) dentro del
 * SettingsShell. El shell auto-oculta el sidebar lateral cuando
 * pathname === "/ajustes" para que la home tenga ancho completo.
 *
 * Las sub-páginas (/ajustes/.../...) se montan en App.tsx
 * envueltas en SettingsShell y SÍ muestran el sidebar.
 */

import { SettingsShell } from "@/components/settings/SettingsShell";
import AjustesHome from "@/pages/AjustesHome";

export default function Ajustes() {
  return (
    <SettingsShell>
      <AjustesHome />
    </SettingsShell>
  );
}
