import { SettingsTogglesPage } from "@/components/settings/SettingsTogglesPage";

export default function AjustesNotificacionesPush() {
  return (
    <SettingsTogglesPage
      storageKey="notifications.push"
      title="Notificaciones push"
      description="Aparecen como pop-ups del navegador / sistema operativo. Necesitas conceder permiso al navegador la primera vez."
      cardTitle="Push del navegador"
      toggles={[
        { key: "enabled", label: "Activar push", description: "Pediremos permiso al navegador.", defaultValue: false },
        { key: "newMessage", label: "Mensaje nuevo en email", description: "Cliente respondió a tu correo.", defaultValue: true },
        { key: "newRecord", label: "Nuevo registro", defaultValue: true },
        { key: "visitReminder", label: "Recordatorio de visita", description: "30 minutos antes.", defaultValue: true },
        { key: "mention", label: "Te mencionan en un comentario interno", defaultValue: true },
        { key: "doNotDisturb", label: "No molestar (22:00 – 8:00)", description: "Las push se silencian fuera de horario.", defaultValue: false },
      ]}
    />
  );
}
