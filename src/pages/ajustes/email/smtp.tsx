/**
 * /ajustes/email/smtp · Configuración del dominio de envío.
 */

import { Server } from "lucide-react";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export default function AjustesEmailSmtp() {
  return (
    <PlaceholderPage
      icon={Server}
      eyebrow="Ajustes · Email · SMTP"
      title="Dominio de envío SMTP"
      description="Configura el dominio que aparecerá como remitente en los emails enviados desde Byvaro. Verifica los registros SPF, DKIM y DMARC para mejorar la entregabilidad y evitar la carpeta de spam."
      sections={[
        "Dominio de envío personalizado (mail.tudominio.com)",
        "Registros DNS guiados: SPF, DKIM (selectores), DMARC",
        "Verificación automática del estado de cada registro",
        "Identidad del remitente: nombre comercial + logo en el sello DKIM",
        "Test de entregabilidad contra Gmail / Outlook / Yahoo",
        "Métricas de entrega del dominio (entregado / rebotado / spam)",
      ]}
      status="planning"
    />
  );
}
