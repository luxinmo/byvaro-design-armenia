import { Mail } from "lucide-react";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export default function Emails() {
  return (
    <PlaceholderPage
      icon={Mail}
      eyebrow="Contenido · Emails"
      title="Plantillas y campañas"
      description="Gestor de emails transaccionales (confirmaciones, registro aprobado, visita confirmada) y campañas comerciales dirigidas a tu base de contactos."
      sections={[
        "Plantillas predefinidas por tipo (registro, visita, reserva, boletín)",
        "Editor WYSIWYG con marca Byvaro y multi-idioma (ES, EN, RU, DE)",
        "Variables dinámicas ({{cliente.nombre}}, {{promocion.nombre}})",
        "Envío masivo con segmentación (por nacionalidad, por promoción)",
        "A/B testing de asuntos",
        "Métricas: entregados, aperturas, clicks, rebotes",
      ]}
    />
  );
}
