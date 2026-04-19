/**
 * EmpresaAboutTab · réplica del CompanyAboutTab con mis componentes.
 * Secciones: Historia (overview largo), Detalles (legal name, trade
 * name, CIF, founded, phone, email, schedule), Webs, Verificación.
 */

import { CheckCircle2, Globe, Phone, Mail, Clock } from "lucide-react";
import type { Empresa } from "@/lib/empresa";
import { EditableSection } from "./EditableSection";
import { cn } from "@/lib/utils";

const inputClass = "h-9 w-full px-3 text-[13px] bg-card border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/60";
const textareaClass = cn(inputClass, "h-auto py-2.5 resize-y min-h-[120px]");

export function EmpresaAboutTab({
  viewMode,
  empresa,
  update,
}: {
  viewMode: "edit" | "preview";
  empresa: Empresa;
  update: <K extends keyof Empresa>(key: K, value: Empresa[K]) => void;
}) {
  const verifiedDate = empresa.verificada && empresa.verificadaEl
    ? new Date(empresa.verificadaEl).toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" })
    : "Pendiente";

  return (
    <div className="flex flex-col gap-5">
      {/* ═════ Historia ═════ */}
      <EditableSection
        title="Historia"
        viewMode={viewMode}
        editContent={
          <textarea
            value={empresa.aboutOverview}
            onChange={(e) => update("aboutOverview", e.target.value)}
            placeholder="Cuenta la historia de tu empresa: origen, hitos, cómo habéis llegado aquí…"
            className={textareaClass}
          />
        }
      >
        <p className="text-[12.5px] text-muted-foreground leading-relaxed">
          {empresa.aboutOverview || "Cuenta la historia de tu empresa. Origen, hitos, equipo…"}
        </p>
      </EditableSection>

      {/* ═════ Detalles ═════ */}
      <EditableSection
        title="Detalles"
        viewMode={viewMode}
        editContent={
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted-foreground">Razón social</label>
                <input value={empresa.razonSocial} onChange={(e) => update("razonSocial", e.target.value)} className={inputClass} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted-foreground">Nombre comercial</label>
                <input value={empresa.nombreComercial} onChange={(e) => update("nombreComercial", e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted-foreground">CIF/NIF/VAT</label>
                <input value={empresa.cif} onChange={(e) => update("cif", e.target.value.toUpperCase())} className={cn(inputClass, "font-mono tracking-wider")} placeholder="B12345674" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted-foreground">Fundada en</label>
                <input value={empresa.fundadaEn} onChange={(e) => update("fundadaEn", e.target.value)} className={inputClass} placeholder="2012" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted-foreground">Teléfono</label>
                <input value={empresa.telefono} onChange={(e) => update("telefono", e.target.value)} className={inputClass} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted-foreground">Email</label>
                <input value={empresa.email} onChange={(e) => update("email", e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground">Horario</label>
              <input value={empresa.horario} onChange={(e) => update("horario", e.target.value)} className={inputClass} placeholder="L-S 9:30-14:00 / 16:30-19:00" />
            </div>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <div className="flex flex-col gap-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Razón social</p>
            <p className="text-[12.5px] text-foreground font-medium">{empresa.razonSocial || "—"}</p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Nombre comercial</p>
            <p className="text-[12.5px] text-foreground font-medium">{empresa.nombreComercial || "—"}</p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">CIF/NIF/VAT</p>
            <p className="text-[12.5px] text-foreground font-medium font-mono tracking-wider">{empresa.cif || "—"}</p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Fundada en</p>
            <p className="text-[12.5px] text-foreground font-medium tnum">{empresa.fundadaEn || "—"}</p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Teléfono</p>
            <p className="text-[12px] text-muted-foreground flex items-center gap-1.5">
              <Phone className="h-3 w-3" /> {empresa.telefono || "—"}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Email</p>
            <p className="text-[12px] text-muted-foreground flex items-center gap-1.5">
              <Mail className="h-3 w-3" /> {empresa.email || "—"}
            </p>
          </div>
          <div className="col-span-2 flex flex-col gap-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Horario</p>
            <p className="text-[12px] text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3 w-3" /> {empresa.horario || "—"}
            </p>
          </div>
        </div>
      </EditableSection>

      {/* ═════ Webs ═════ */}
      <EditableSection
        title="Webs"
        viewMode={viewMode}
        editContent={
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground">Sitio web oficial</label>
              <input value={empresa.sitioWeb} onChange={(e) => update("sitioWeb", e.target.value)} className={inputClass} placeholder="www.empresa.com" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground">LinkedIn</label>
              <input value={empresa.linkedin} onChange={(e) => update("linkedin", e.target.value)} className={inputClass} placeholder="https://linkedin.com/company/…" />
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Globe className="h-3.5 w-3.5 text-muted-foreground/60" />
            <a href={empresa.sitioWeb ? (empresa.sitioWeb.startsWith("http") ? empresa.sitioWeb : `https://${empresa.sitioWeb}`) : "#"} target="_blank" rel="noreferrer" className="text-[12.5px] text-primary hover:underline">
              {empresa.sitioWeb || "Añade tu sitio web"}
            </a>
          </div>
          {empresa.nombreComercial && (
            <div className="flex items-center gap-3">
              <Globe className="h-3.5 w-3.5 text-muted-foreground/60" />
              <a href="#" className="text-[12.5px] text-primary hover:underline">
                {empresa.nombreComercial.toLowerCase().replace(/\s+/g, "")}.byvaro.com
              </a>
            </div>
          )}
          {empresa.linkedin && (
            <div className="flex items-center gap-3">
              <Globe className="h-3.5 w-3.5 text-muted-foreground/60" />
              <a href={empresa.linkedin} target="_blank" rel="noreferrer" className="text-[12.5px] text-primary hover:underline truncate">
                {empresa.linkedin}
              </a>
            </div>
          )}
        </div>
      </EditableSection>

      {/* ═════ Verificación ═════ */}
      <EditableSection title="Verificación" viewMode={viewMode}>
        <div className="flex items-center gap-3">
          {empresa.verificada ? (
            <CheckCircle2 className="h-5 w-5 text-primary" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-muted-foreground/30" />
          )}
          <div>
            <p className="text-[12.5px] text-foreground font-medium">
              {empresa.verificada ? "Página verificada" : "Página sin verificar"}
            </p>
            <p className="text-[10.5px] text-muted-foreground">
              {empresa.verificada ? verifiedDate : "Completa tu empresa y solicita la verificación"}
            </p>
          </div>
        </div>
      </EditableSection>
    </div>
  );
}
