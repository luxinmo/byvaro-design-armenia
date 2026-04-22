import { SettingsTogglesPage } from "@/components/settings/SettingsTogglesPage";

export default function AjustesPrivacidadVisibilidad() {
  return (
    <SettingsTogglesPage
      storageKey="privacy.visibility"
      title="Visibilidad pública"
      description="Qué información tuya es visible fuera de tu organización (en el marketplace de agencias, microsites públicos, etc.)."
      cardTitle="Aparecer en"
      toggles={[
        { key: "marketplace", label: "Marketplace de agencias", description: "Las agencias verán tu empresa al buscar promotores.", defaultValue: true },
        { key: "publicProfile", label: "Perfil público de empresa", description: "URL byvaro.com/p/luxinmo accesible sin login.", defaultValue: true },
        { key: "showLogo", label: "Mostrar logo en microsites", description: "Tu logo aparece en el footer de los microsites de tus promociones.", defaultValue: true },
        { key: "showTeam", label: "Mostrar equipo público", description: "Lista de comerciales con foto en el perfil público.", defaultValue: false },
        { key: "indexableSEO", label: "Indexable por buscadores (SEO)", description: "Google y Bing pueden indexar tu perfil público.", defaultValue: true },
      ]}
    />
  );
}
