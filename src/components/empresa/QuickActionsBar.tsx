/**
 * QuickActionsBar · fila de acciones rápidas debajo de los stats.
 * Compartir perfil · Ver microsite público · Descargar media kit ·
 * Invitar agencia · QR code.
 *
 * Aparece solo en viewMode=edit (es para el promotor propietario).
 */

import { useState } from "react";
import {
  Share2, Globe, Download, Send, QrCode, Check, Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Empresa } from "@/lib/empresa";
import { toast } from "sonner";
import { InvitarAgenciaModal } from "./InvitarAgenciaModal";

function buildProfileUrl(empresa: Empresa): string {
  const slug = empresa.nombreComercial
    ? empresa.nombreComercial.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")
    : "empresa";
  return `${window.location.origin}/m/${slug}`;
}

export function QuickActionsBar({ empresa }: { empresa: Empresa }) {
  const [copied, setCopied] = useState(false);
  const [showInvitar, setShowInvitar] = useState(false);
  const url = buildProfileUrl(empresa);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Enlace copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const actions = [
    { icon: Send,    label: "Invitar agencia", onClick: () => setShowInvitar(true), primary: true },
    { icon: Share2,  label: "Compartir perfil", onClick: handleCopy },
    { icon: Globe,   label: "Ver microsite",    onClick: () => window.open(url, "_blank") },
    { icon: Download,label: "Media kit",        onClick: () => toast.info("Próximamente", { description: "Exportación PDF en v2" }) },
    { icon: QrCode,  label: "Código QR",        onClick: () => toast.info("Próximamente", { description: "Generación de QR en v2" }) },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden p-3 flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-muted/40 rounded-xl px-3 py-2 border border-border/60">
        <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-[12px] text-foreground/90 truncate font-mono tracking-tight">{url}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="ml-auto inline-flex items-center gap-1 rounded-full px-2 h-6 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-card transition-colors shrink-0"
        >
          {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.label}
              type="button"
              onClick={a.onClick}
              className={cn(
                "inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[12px] font-semibold transition-colors whitespace-nowrap",
                a.primary
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-soft"
                  : "border border-border text-foreground hover:bg-muted",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{a.label}</span>
            </button>
          );
        })}
      </div>

      {showInvitar && <InvitarAgenciaModal onClose={() => setShowInvitar(false)} />}
    </div>
  );
}
