import { SettingsTogglesPage } from "@/components/settings/SettingsTogglesPage";

export default function AjustesMensajeriaComentarios() {
  return (
    <SettingsTogglesPage
      storageKey="messaging.comments"
      title="Comentarios internos"
      description="Configura los comentarios internos en registros, contactos y promociones."
      cardTitle="Comportamiento"
      toggles={[
        { key: "allowInternal", label: "Permitir comentarios internos", description: "Solo visibles para el equipo, nunca para el cliente.", defaultValue: true },
        { key: "allowAttachments", label: "Permitir adjuntos en comentarios", defaultValue: true },
        { key: "notifyTeam", label: "Notificar al equipo de cada nuevo comentario", defaultValue: false },
        { key: "showMine", label: "Mostrar también mis propios comentarios en el feed", defaultValue: false },
      ]}
    />
  );
}
