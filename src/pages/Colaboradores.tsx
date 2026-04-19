import { Handshake } from "lucide-react";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export default function Colaboradores() {
  return (
    <PlaceholderPage
      icon={Handshake}
      eyebrow="Red · Colaboradores"
      title="Agencias y brokers"
      status="next"
      description="Red comercial completa: agencias colaboradoras activas, pendientes y expiradas. Incluye un sub-tab 'Analítica' con el dashboard Agencia × Nacionalidad (Registros · Ventas · Eficiencia) por mercado."
      sections={[
        "Tab 'Red': listado de agencias con KPIs y estado",
        "Tab 'Analítica': 3 sub-tabs (Registros, Ventas, Eficiencia) con heatmap Agencia×Nacionalidad",
        "Banner de solicitudes nuevas de colaboración",
        "Top performers (podio con medallas)",
        "Filtros por estado, tipo, mercado dominante",
        "Insights automáticos generados por IA",
      ]}
    />
  );
}
