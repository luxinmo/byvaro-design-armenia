import { FileText } from "lucide-react";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export default function Registros() {
  return (
    <PlaceholderPage
      icon={FileText}
      eyebrow="Comercial · Registros"
      title="Registros de clientes"
      description="Gestión de solicitudes de registro que envían tus colaboradores. Aprobación/rechazo, detección de duplicados, timeline de cada registro, programación de visita."
      sections={[
        "Master-detail: lista a la izquierda, detalle a la derecha",
        "Filtros por estado (pendientes, aprobados, rechazados, expirados)",
        "Detector de duplicados con % de coincidencia",
        "Timeline vertical del registro (submitted → auto-check → decisión)",
        "Modal de decisión con nota y confirmación",
        "Vista agencia readonly (para colaboradores)",
      ]}
    />
  );
}
