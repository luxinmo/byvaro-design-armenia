/**
 * /ajustes/email/plantillas · Plantillas reutilizables para emails.
 */

import { FileText } from "lucide-react";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export default function AjustesEmailPlantillas() {
  return (
    <PlaceholderPage
      icon={FileText}
      eyebrow="Ajustes · Email · Plantillas"
      title="Plantillas de email"
      description="Crea plantillas reutilizables para los emails que envías más a menudo: briefing comercial, dossier de promoción, recordatorio de visita, propuesta de financiación, etc."
      sections={[
        "Editor HTML con variables dinámicas: {{cliente.nombre}}, {{promocion.titulo}}, {{visita.fecha}}",
        "Categorías por tipo (registro, visita, oferta, marketing) y por idioma (ES, EN, RU, DE)",
        "Sustitución automática al insertar la plantilla en el Compose",
        "Soporte para adjuntos por defecto (dossier PDF, pricing actualizado)",
        "Versión por agencia y por país",
      ]}
      status="planning"
    />
  );
}
