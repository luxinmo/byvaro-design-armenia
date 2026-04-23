/**
 * EmpresaHomeTab · réplica del CompanyHomeTab del Lovable con mis
 * componentes. Incluye Overview, Company data (KPIs), Collaborating
 * promoters, Agents preview, Quote y Offices.
 */

import {
  Building2, Users, ChevronRight, Plus,
} from "lucide-react";
import type { Empresa } from "@/lib/empresa";
import { EditableSection, InfoItem } from "./EditableSection";
import { OfficesSection } from "./OfficesSection";
import { HeroStatsStrip } from "./HeroStatsStrip";
import { ZonasEspecialidadesCard } from "./ZonasEspecialidadesCard";
import { TestimoniosCard } from "./TestimoniosCard";
import { PortfolioShowcase } from "./PortfolioShowcase";
import { GoogleRatingCard } from "./GoogleRatingCard";
import { cn } from "@/lib/utils";
import { Flag } from "@/components/ui/Flag";

/* ─── Datos mock (agents + collab) ────────────────────────────────── */
const collaboratingPromoters = [
  { name: "Meridian", avatar: "https://logo.clearbit.com/meridian.com" },
];

const agentsList = [
  { name: "Aiko Nakamura", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop" },
  { name: "Carmen Rodríguez", avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop" },
  { name: "Isabel Fernández", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop" },
];

/* ─── Helpers ──────────────────────────────────────────────────────── */
const inputClass = "h-9 w-full px-3 text-[13px] bg-card border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/60";
const textareaClass = cn(inputClass, "h-auto py-2.5 resize-y min-h-[100px]");

function Avatar({ src, alt, size = 40, className }: { src?: string; alt: string; size?: number; className?: string }) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={cn("rounded-full object-cover shrink-0", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  const initial = alt?.[0]?.toUpperCase() ?? "?";
  return (
    <div
      className={cn("rounded-full bg-muted text-muted-foreground font-semibold grid place-items-center shrink-0", className)}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initial}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   EmpresaHomeTab
   ═══════════════════════════════════════════════════════════════════ */
export function EmpresaHomeTab({
  viewMode,
  empresa,
  update,
}: {
  viewMode: "edit" | "preview";
  empresa: Empresa;
  update: <K extends keyof Empresa>(key: K, value: Empresa[K]) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {/* ═════ Stats de credibilidad ═════ */}
      <HeroStatsStrip empresa={empresa} />

      {/* ═════ Rating Google Business ═════ */}
      <GoogleRatingCard empresa={empresa} viewMode={viewMode} update={update} />

      {/* ═════ Overview ═════ */}
      <EditableSection
        title="Resumen"
        viewMode={viewMode}
        editContent={
          <textarea
            value={empresa.overview}
            onChange={(e) => update("overview", e.target.value)}
            placeholder="Describe tu empresa en 2-3 frases: servicios, misión, qué os hace diferentes."
            className={textareaClass}
          />
        }
      >
        <p className="text-[12.5px] text-muted-foreground leading-relaxed">
          {empresa.overview || "Describe tu empresa: servicios, misión, qué os hace diferentes en el mercado."}
        </p>
      </EditableSection>

      {/* ═════ Datos de la empresa (solo info, sin rendimiento) ═════ */}
      <EditableSection
        title="Datos de la empresa"
        viewMode={viewMode}
        editContent={
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: "oficinasCount" as const, label: "Oficinas" },
              { key: "agentesCount" as const, label: "Agentes" },
            ].map((f) => (
              <div key={f.key}>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">{f.label}</label>
                <input
                  value={empresa[f.key]}
                  onChange={(e) => update(f.key, e.target.value)}
                  className={inputClass}
                />
              </div>
            ))}
          </div>
        }
      >
        <div className="grid grid-cols-3 gap-4">
          <InfoItem icon={Building2} label="Oficinas" value={empresa.oficinasCount || "0"} />
          <InfoItem icon={Users} label="Agentes" value={empresa.agentesCount || "0"} />
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Idiomas</p>
            <div className="flex gap-1">
              {["ES", "GB", "FR"].map((iso) => (
                <Flag key={iso} iso={iso} size={14} />
              ))}
            </div>
          </div>
        </div>
      </EditableSection>

      {/* ═════ Collaborating promoters ═════ */}
      <EditableSection title="Promotores colaboradores" viewMode={viewMode}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {collaboratingPromoters.map((p) => (
              <Avatar key={p.name} src={p.avatar} alt={p.name} size={40} className="border-2 border-primary/20" />
            ))}
            <div className="h-10 w-10 rounded-full border-2 border-dashed border-border/60 flex items-center justify-center">
              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>
          <div>
            <p className="text-[13px] font-semibold text-foreground">1 colaboración activa</p>
            <p className="text-[11.5px] text-muted-foreground">Completa la información de tu empresa para empezar a colaborar y hacer crecer tu red.</p>
          </div>
        </div>
      </EditableSection>

      {/* ═════ Agents preview ═════ */}
      <EditableSection title="Agentes" viewMode={viewMode}>
        <div className="flex items-center gap-4">
          <div className="flex -space-x-2">
            {agentsList.map((a) => (
              <Avatar key={a.name} src={a.avatar} alt={a.name} size={40} className="border-2 border-card" />
            ))}
          </div>
          <div>
            <p className="text-[13px] font-semibold text-foreground">Conoce a nuestro equipo</p>
            <p className="text-[11.5px] text-muted-foreground">Añade agentes para mostrar tu equipo y reforzar tu red.</p>
          </div>
        </div>
        <button type="button" className="text-[11.5px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 mt-3">
          Ver todos los miembros <ChevronRight className="h-3 w-3" />
        </button>
      </EditableSection>

      {/* ═════ Quote ═════ */}
      <EditableSection
        title="Lema de la empresa"
        viewMode={viewMode}
        editContent={
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">Lema</label>
              <input
                value={empresa.quote}
                onChange={(e) => update("quote", e.target.value)}
                className={inputClass}
                placeholder='"El verdadero éxito en la colaboración se mide por la confianza…"'
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">Descripción</label>
              <textarea
                value={empresa.quoteDescription}
                onChange={(e) => update("quoteDescription", e.target.value)}
                className={cn(textareaClass, "min-h-[80px]")}
                placeholder="Amplía el lema con 1-2 frases sobre tus valores."
              />
            </div>
          </div>
        }
      >
        <div className="text-center py-4 flex flex-col gap-3">
          <p className="text-[14px] font-semibold text-foreground italic leading-relaxed max-w-lg mx-auto">
            {empresa.quote || '"Añade el lema de tu empresa"'}
          </p>
          <p className="text-[12px] text-muted-foreground max-w-md mx-auto leading-relaxed">
            {empresa.quoteDescription || "Añade una descripción para tu lema."}
          </p>
        </div>
      </EditableSection>

      {/* ═════ Portfolio destacado ═════ */}
      <PortfolioShowcase viewMode={viewMode} />

      {/* ═════ Zonas y especialidades ═════ */}
      <ZonasEspecialidadesCard viewMode={viewMode} empresa={empresa} update={update} />

      {/* ═════ Offices ═════ */}
      <OfficesSection viewMode={viewMode} />

      {/* ═════ Testimonios ═════ */}
      <TestimoniosCard viewMode={viewMode} empresa={empresa} update={update} />
    </div>
  );
}
