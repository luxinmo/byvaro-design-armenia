/**
 * TerminosColaboracionCard · resumen de los términos de colaboración
 * por defecto del promotor. Es la información que una agencia quiere
 * ver *antes* de aceptar una colaboración:
 *   · Comisión nacional / internacional por defecto
 *   · Plazo de pago de comisiones
 *   · Idiomas de atención
 *   · Link al contrato marco (placeholder v1)
 */

import { Percent, Clock, FileText, Globe, HandCoins } from "lucide-react";
import type { Empresa } from "@/lib/empresa";
import { EditableSection } from "./EditableSection";
import { cn } from "@/lib/utils";

const inputClass = "h-9 w-full px-3 text-[13px] bg-card border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/60 tnum";

export function TerminosColaboracionCard({
  viewMode, empresa, update,
}: {
  viewMode: "edit" | "preview";
  empresa: Empresa;
  update: <K extends keyof Empresa>(key: K, value: Empresa[K]) => void;
}) {
  return (
    <EditableSection
      title="Términos de colaboración"
      viewMode={viewMode}
      editContent={
        <div className="flex flex-col gap-4">
          <p className="text-[11.5px] text-muted-foreground leading-relaxed">
            Valores por defecto que se proponen al crear una nueva promoción. Pueden ajustarse por promoción en el asistente.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Comisión nacional (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={empresa.comisionNacionalDefault}
                onChange={(e) => update("comisionNacionalDefault", Math.max(0, Number(e.target.value)))}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Comisión internacional (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={empresa.comisionInternacionalDefault}
                onChange={(e) => update("comisionInternacionalDefault", Math.max(0, Number(e.target.value)))}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Plazo de pago (días)</label>
              <input
                type="number"
                min={0}
                max={365}
                value={empresa.plazoPagoComisionDias}
                onChange={(e) => update("plazoPagoComisionDias", Math.max(0, Number(e.target.value)))}
                className={inputClass}
              />
            </div>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <TermTile
          icon={Percent}
          label="Nacional"
          value={`${empresa.comisionNacionalDefault}%`}
          sub="sobre el precio final"
        />
        <TermTile
          icon={Globe}
          label="Internacional"
          value={`${empresa.comisionInternacionalDefault}%`}
          sub="cliente extranjero"
          accent
        />
        <TermTile
          icon={Clock}
          label="Plazo de pago"
          value={`${empresa.plazoPagoComisionDias} días`}
          sub="desde escritura"
        />
        <TermTile
          icon={HandCoins}
          label="Modalidad"
          value="Personalizable"
          sub="por promoción"
        />
      </div>

      <div className="mt-4 rounded-xl bg-muted/40 border border-border px-4 py-3 flex items-start gap-3">
        <FileText className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 mt-0.5" />
        <p className="text-[11.5px] text-muted-foreground leading-relaxed">
          Estos son los términos por defecto. Cada promoción puede ajustar comisiones, fechas y método de pago específicos.
          Los términos definitivos se reflejan en el contrato marco de colaboración antes de la primera operación.
        </p>
      </div>
    </EditableSection>
  );
}

function TermTile({
  icon: Icon, label, value, sub, accent = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; sub: string; accent?: boolean;
}) {
  return (
    <div className={cn(
      "flex flex-col gap-1 rounded-xl border p-3.5",
      accent
        ? "bg-primary/[0.04] border-primary/20"
        : "bg-card border-border",
    )}>
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className={cn("text-[20px] font-bold tnum leading-tight", accent ? "text-primary" : "text-foreground")}>
        {value}
      </p>
      <p className="text-[10.5px] text-muted-foreground leading-tight">{sub}</p>
    </div>
  );
}
