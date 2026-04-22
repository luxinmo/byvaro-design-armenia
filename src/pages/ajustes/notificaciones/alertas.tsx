import { SettingsTogglesPage } from "@/components/settings/SettingsTogglesPage";

export default function AjustesNotificacionesAlertas() {
  return (
    <SettingsTogglesPage
      storageKey="notifications.alerts"
      title="Tipos de alertas"
      description="Decide qué eventos te marcan como urgentes (badge rojo, sonido, push prioritaria) frente a los normales."
      cardTitle="Tratamiento por evento"
      cardDescription="Activado = urgente."
      toggles={[
        { key: "duplicateAlert", label: "Posibles duplicados", description: "Marcar como urgente al detectar match >70%.", defaultValue: true },
        { key: "saleAtRisk", label: "Venta en riesgo", description: "Cliente sin actividad >7 días tras visita.", defaultValue: true },
        { key: "missedVisit", label: "Visita no realizada", description: "Cliente no se presentó.", defaultValue: true },
        { key: "lowStock", label: "Pocas unidades disponibles", description: "Cuando una promoción baja del 20%.", defaultValue: false },
        { key: "expiringExclusive", label: "Exclusiva próxima a vencer", description: "30 días antes del vencimiento.", defaultValue: true },
        { key: "newCommission", label: "Nueva comisión disponible", description: "Comisión generada por colaboración.", defaultValue: false },
      ]}
    />
  );
}
