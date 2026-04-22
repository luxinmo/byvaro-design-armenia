import { SettingsTogglesPage } from "@/components/settings/SettingsTogglesPage";

export default function AjustesPrivacidadAnalitica() {
  return (
    <SettingsTogglesPage
      storageKey="privacy.analytics"
      title="Analítica de uso"
      description="Nos ayuda a mejorar Byvaro entendiendo qué features se usan más. Toda la información es anónima y nunca incluye datos de tus clientes."
      cardTitle="Telemetría"
      toggles={[
        { key: "shareUsage", label: "Compartir métricas anónimas de uso", description: "Eventos como 'creó promoción', 'aprobó registro', sin contenido personal.", defaultValue: true },
        { key: "crashReports", label: "Enviar reportes de crash", description: "Stack traces y entorno (versión navegador, SO).", defaultValue: true },
        { key: "session_replay", label: "Permitir grabaciones de sesión", description: "Solo el equipo de soporte puede acceder, durante 30 días, ofuscando datos sensibles.", defaultValue: false },
      ]}
    />
  );
}
