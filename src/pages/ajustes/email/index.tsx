/**
 * /ajustes/email · Hub de configuración del módulo Emails.
 *
 * Lista las 4 sub-rutas que el spec del módulo (`docs/screens/emails.md`)
 * promete implementar: firma legacy, plantillas, auto-respuesta, SMTP.
 * Cada una hoy es un placeholder hasta que se conecte el backend.
 */

import { Link } from "react-router-dom";
import { Mail, ChevronRight, PenLine, FileText, Clock, Server } from "lucide-react";

const SECTIONS = [
  {
    id: "firma",
    icon: PenLine,
    title: "Firma legacy",
    description:
      "Editor antiguo basado en tokens ({name}, {role}, {phone}…). Las firmas operativas (las que se inyectan al redactar) viven dentro del cliente de correo.",
    href: "/ajustes/email/firma",
  },
  {
    id: "plantillas",
    icon: FileText,
    title: "Plantillas",
    description: "Plantillas reutilizables para emails comunes (briefing, dossier, recordatorio de visita).",
    href: "/ajustes/email/plantillas",
  },
  {
    id: "auto-respuesta",
    icon: Clock,
    title: "Auto-respuesta",
    description: "Respuesta automática fuera de horario o en vacaciones. Mensaje + ventana de fechas.",
    href: "/ajustes/email/auto-respuesta",
  },
  {
    id: "smtp",
    icon: Server,
    title: "Dominio SMTP",
    description: "Configurar dominio de envío (SPF / DKIM / DMARC) e identidad del remitente.",
    href: "/ajustes/email/smtp",
  },
];

export default function AjustesEmailIndex() {
  return (
    <div className="flex-1 min-h-full bg-background">
      <div className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-24 lg:pb-12 max-w-[1100px] mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 grid place-items-center">
            <Mail className="h-4 w-4 text-primary" strokeWidth={1.75} />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
              Ajustes · Email
            </p>
            <h1 className="text-[19px] sm:text-[22px] font-bold tracking-tight">Configuración del correo</h1>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
          Configura los aspectos del módulo Emails que no viven dentro del cliente
          de correo. Para gestionar cuentas conectadas o firmas operativas, abre
          el cliente y usa "Gestionar cuentas".
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SECTIONS.map((s) => (
            <Link
              key={s.id}
              to={s.href}
              className="group flex items-start gap-3 bg-card border border-border rounded-2xl p-4 shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <s.icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{s.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{s.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0 mt-1 group-hover:text-foreground transition-colors" />
            </Link>
          ))}
        </div>

        <div className="mt-8 text-xs text-muted-foreground">
          <Link to="/emails" className="hover:text-foreground transition-colors inline-flex items-center gap-1">
            ← Volver al cliente de correo
          </Link>
        </div>
      </div>
    </div>
  );
}
