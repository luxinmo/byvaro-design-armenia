/**
 * /ajustes/privacidad/exportar — Exportar mis datos (GDPR Art. 20).
 * Genera JSON con todo lo que tenemos del usuario y permite descargarlo.
 */

import { useState } from "react";
import { Download, Database, Check } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { SettingsRowGroup, SettingsToggle } from "@/components/settings/fields";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/currentUser";
import { toast } from "sonner";

const ENTITIES = [
  { key: "profile", label: "Perfil personal y configuración", default: true },
  { key: "contacts", label: "Mis contactos", default: true },
  { key: "promotions", label: "Mis promociones y unidades", default: true },
  { key: "records", label: "Mis registros y visitas", default: true },
  { key: "emails", label: "Emails enviados (sin adjuntos pesados)", default: true },
  { key: "documents", label: "Documentos del sistema (PDFs)", default: false },
  { key: "activityLogs", label: "Logs de actividad", default: false },
];

export default function AjustesPrivacidadExportar() {
  const user = useCurrentUser();
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ENTITIES.map((e) => [e.key, e.default])),
  );
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);

  const generate = () => {
    setGenerating(true);
    setDone(false);
    /* Mock: en producción esto sería un job en backend que envía el ZIP
     * por email cuando esté listo. Aquí lo hacemos al instante en el
     * cliente con los datos disponibles. */
    setTimeout(() => {
      const payload = {
        exportedAt: new Date().toISOString(),
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        organization: { id: user.organizationId },
        included: Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
        data: {
          /* Mock vacío — el backend rellenará con queries reales */
          profile: selected.profile ? { name: user.name, email: user.email } : undefined,
        },
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `byvaro-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setGenerating(false);
      setDone(true);
      toast.success("Exportación generada y descargada");
    }, 1200);
  };

  const totalSelected = Object.values(selected).filter(Boolean).length;

  return (
    <SettingsScreen
      title="Exportar mis datos"
      description="Descarga toda la información asociada a tu cuenta y organización en formato JSON portable. Útil para auditorías, cambio de proveedor o cumplir Art. 20 del RGPD."
    >
      <SettingsCard title="¿Qué quieres incluir?" description="Solo se incluirán las entidades marcadas.">
        <SettingsRowGroup>
          {ENTITIES.map((e) => (
            <SettingsToggle
              key={e.key}
              label={e.label}
              checked={selected[e.key] ?? false}
              onCheckedChange={(b) => setSelected((p) => ({ ...p, [e.key]: b }))}
            />
          ))}
        </SettingsRowGroup>
      </SettingsCard>

      <SettingsCard>
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 grid place-items-center text-primary shrink-0">
            <Database className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {totalSelected} {totalSelected === 1 ? "categoría seleccionada" : "categorías seleccionadas"}
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Para exportaciones grandes (&gt; 100 MB), te enviaremos un email con el enlace de descarga
              cuando esté listo. Para esta exportación pequeña, la descarga es inmediata.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <Button onClick={generate} disabled={generating || totalSelected === 0} className="rounded-full">
                {done ? <Check className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                {generating ? "Generando…" : done ? "Descargado" : "Generar y descargar"}
              </Button>
              {done && <p className="text-xs text-muted-foreground">Si necesitas otra copia, vuelve a generar.</p>}
            </div>
          </div>
        </div>
      </SettingsCard>
    </SettingsScreen>
  );
}
