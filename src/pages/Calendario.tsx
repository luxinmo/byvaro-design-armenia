import { CalendarDays } from "lucide-react";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export default function Calendario() {
  return (
    <PlaceholderPage
      icon={CalendarDays}
      eyebrow="Comercial · Calendario"
      title="Agenda de visitas"
      description="Visitas programadas, llamadas comerciales y reuniones de equipo en un calendario unificado. Integración con Google Calendar y Outlook."
      sections={[
        "Vista mes / semana / día / lista",
        "Filtrar por tipo (visita, llamada, reunión, firma)",
        "Filtrar por promoción y por agencia",
        "Crear evento rápido con nombre cliente + unidad + hora",
        "Sincronización con calendarios externos",
        "Recordatorios automáticos (email + SMS al cliente)",
      ]}
    />
  );
}
