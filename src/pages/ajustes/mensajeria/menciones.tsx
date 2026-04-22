import { SettingsTogglesPage } from "@/components/settings/SettingsTogglesPage";

export default function AjustesMensajeriaMenciones() {
  return (
    <SettingsTogglesPage
      storageKey="messaging.mentions"
      title="Menciones"
      description="Cómo te avisamos cuando alguien te menciona con @ en un comentario interno."
      cardTitle="Recibir avisos"
      toggles={[
        { key: "email", label: "Notificar por email cuando me mencionan", defaultValue: true },
        { key: "push", label: "Notificación push instantánea", defaultValue: true },
        { key: "highlight", label: "Resaltar la mención en el feed con borde primary", defaultValue: true },
        { key: "digestOnly", label: "Solo en el resumen semanal (silenciar individuales)", defaultValue: false },
      ]}
    />
  );
}
