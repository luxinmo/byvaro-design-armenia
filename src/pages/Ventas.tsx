import { CircleDollarSign } from "lucide-react";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export default function Ventas() {
  return (
    <PlaceholderPage
      icon={CircleDollarSign}
      eyebrow="Comercial · Ventas"
      title="Pipeline de ventas"
      description="Oportunidades, reservas, operaciones cerradas y comisiones pendientes en una sola vista tipo pipeline kanban. El análisis profundo Agencia×Nacionalidad vive en Colaboradores → Analítica."
      sections={[
        "Kanban con columnas: Lead → Visita → Reserva → Señal → Escritura",
        "Cada tarjeta muestra cliente, unidad, agencia y valor",
        "KPIs de cabecera: volumen, ticket medio, velocidad media",
        "Comisiones pendientes de pago por agencia",
        "Vista lista + vista kanban + vista tabla",
        "Exportar a Excel o PDF",
      ]}
    />
  );
}
