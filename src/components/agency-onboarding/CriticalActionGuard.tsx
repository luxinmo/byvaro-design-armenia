/**
 * CriticalActionGuard · envuelve cualquier pantalla cuya entrada se
 * considere "acción crítica" para una agencia con setup de Responsable
 * pendiente. Si el usuario es agency Y el setup no está completo,
 * sustituye el contenido por el `<ResponsibleSetupDialog forceOpen>`.
 *
 * Aplica la regla de oro de CLAUDE.md "Setup de Responsable bloquea
 * acciones críticas" sin tener que reescribir cada pantalla envuelta.
 *
 * Pantallas que lo usan hoy:
 *   · /ajustes/empresa/*   (datos fiscales, oficinas, suscripción)
 *   · /ajustes/usuarios/*  (miembros del equipo, departamentos)
 *
 * Cuando el setup queda completo (o aplazado), `onClose` desmonta el
 * dialog y el contenido envuelto vuelve a renderizar normalmente.
 *
 * Para promotor / developer · pasa-through · solo afecta a agency.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCurrentUser } from "@/lib/currentUser";
import { needsResponsibleSetup, onAgencyOnboardingChanged } from "@/lib/agencyOnboarding";
import { ResponsibleSetupDialog } from "./ResponsibleSetupDialog";
import { useEffect } from "react";

export function CriticalActionGuard({ children }: { children: React.ReactNode }) {
  const user = useCurrentUser();
  const navigate = useNavigate();
  /* Re-render reactivo al cambiar el onboarding (p.ej. el user
   * completa "Soy el Responsable" en este mismo modal · el blocked
   * se recalcula y deja pasar). */
  const [, tick] = useState(0);
  useEffect(() => onAgencyOnboardingChanged(() => tick((n) => n + 1)), []);

  const isAgencyUser = user.accountType === "agency";
  const agencyId = isAgencyUser ? user.agencyId : undefined;
  const blocked = !!agencyId && needsResponsibleSetup(agencyId);

  if (blocked) {
    /* En contexto de acción crítica, cerrar el modal (X / "Lo haré
     * más tarde") NO debe permitir entrar a la ruta · el usuario
     * vuelve a /inicio · debe completar el setup del Responsable
     * para acceder a Empresa/Equipo/Ajustes. Si elige "Soy el
     * Responsable" + T&C o "Invitar Responsable", el blocked se
     * recalcula a false y el children vuelve a renderizar. */
    return (
      <ResponsibleSetupDialog
        forceOpen
        onClose={() => navigate("/inicio", { replace: true })}
      />
    );
  }
  return <>{children}</>;
}
