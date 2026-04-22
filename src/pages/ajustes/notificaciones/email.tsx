import { SettingsTogglesPage } from "@/components/settings/SettingsTogglesPage";

export default function AjustesNotificacionesEmail() {
  return (
    <SettingsTogglesPage
      storageKey="notifications.email"
      title="Notificaciones por email"
      description="Recibe un email cuando ocurra una de estas acciones. Puedes silenciar las que no te interesen."
      cardTitle="Eventos del producto"
      cardDescription="Activadas por defecto las más comunes; ajusta a tu gusto."
      toggles={[
        { key: "newRecord", label: "Nuevo registro", description: "Cuando un colaborador da de alta un cliente.", defaultValue: true },
        { key: "duplicateAlert", label: "Posible duplicado detectado", description: "Cuando la IA detecta un registro que ya existía.", defaultValue: true },
        { key: "visitConfirmed", label: "Visita confirmada", description: "Cliente o colaborador confirma una visita.", defaultValue: true },
        { key: "visitCancelled", label: "Visita cancelada", description: "Notificación inmediata para reorganizar agenda.", defaultValue: true },
        { key: "newOffer", label: "Nueva oferta sobre una unidad", description: "Cliente envía una oferta económica.", defaultValue: true },
        { key: "saleClosed", label: "Venta cerrada", description: "Una unidad pasa a estado vendida.", defaultValue: true },
        { key: "newCollab", label: "Solicitud de colaboración", description: "Una agencia pide colaborar en una promoción.", defaultValue: true },
        { key: "weeklyReport", label: "Informe semanal", description: "Resumen lunes 9:00.", defaultValue: false },
        { key: "marketing", label: "Novedades del producto Byvaro", description: "Roadmap, nuevas features, eventos.", defaultValue: false },
      ]}
    />
  );
}
