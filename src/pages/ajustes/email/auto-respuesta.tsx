/**
 * /ajustes/email/auto-respuesta · Out-of-office responder.
 */

import { Clock } from "lucide-react";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export default function AjustesEmailAutoRespuesta() {
  return (
    <PlaceholderPage
      icon={Clock}
      eyebrow="Ajustes · Email · Auto-respuesta"
      title="Respuesta automática"
      description="Activa una respuesta automática para los emails que recibas fuera de horario o en vacaciones. El mensaje se envía solo una vez por remitente y solo a contactos externos a tu organización."
      sections={[
        "Mensaje de respuesta con tokens dinámicos ({remitente.nombre})",
        "Ventana de fechas (inicio · fin) o activación manual",
        "Excluir respuesta a remitentes internos / mailing lists",
        "Aviso visible en tu firma activa: 'En vacaciones hasta el …'",
        "Programación recurrente (todos los viernes después de las 18:00, etc.)",
      ]}
      status="planning"
    />
  );
}
