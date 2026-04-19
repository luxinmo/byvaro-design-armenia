import { Contact } from "lucide-react";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export default function Contactos() {
  return (
    <PlaceholderPage
      icon={Contact}
      eyebrow="Red · Contactos"
      title="Base de contactos"
      description="Tu CRM: todos los clientes, leads y visitantes. Fusión de las dos variantes anteriores (Contactos + Contactos app) en una sola pantalla con toggle lista/tarjetas."
      sections={[
        "Toggle vista lista (densa) vs tarjetas (visual)",
        "Filtros por nacionalidad, promoción, agente, tipo de cliente",
        "Scoring de cliente (caliente, templado, frío)",
        "Ficha de contacto con timeline de interacciones",
        "Historial de visitas, comunicaciones y documentos",
        "Importar desde Excel + sincronización con email",
      ]}
    />
  );
}
