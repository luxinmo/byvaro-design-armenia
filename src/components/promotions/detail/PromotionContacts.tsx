import { Phone, Mail, Globe, MapPin, ExternalLink } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const contacts = [
  {
    name: "Arman Yeghiazaryan",
    role: "Founder & Director Comercial",
    avatar: "https://i.pravatar.cc/80?img=33",
    phone: "+34 612 345 678",
    email: "arman@byvaro.com",
    languages: ["🇪🇸", "🇫🇷", "🇬🇧"],
  },
  {
    name: "María López",
    role: "Responsable de Ventas",
    avatar: "https://i.pravatar.cc/80?img=12",
    phone: "+34 678 901 234",
    email: "maria@byvaro.com",
    languages: ["🇪🇸", "🇬🇧"],
  },
  {
    name: "Thomas Müller",
    role: "International Sales",
    avatar: "https://i.pravatar.cc/80?img=23",
    phone: "+49 170 123 456",
    email: "thomas@byvaro.com",
    languages: ["🇩🇪", "🇬🇧", "🇪🇸"],
  },
];

const salesOffices = [
  { city: "Oficina Alicante", address: "Av. de la Costa, 15, 03001 Alicante" },
  { city: "Oficina Madrid", address: "Paseo de la Castellana, 89, 28046 Madrid" },
];

export function PromotionContacts({ website }: { website: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border/40 shadow-[0_2px_16px_-6px_rgba(0,0,0,0.06)] overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3">
        <h2 className="text-base font-semibold text-foreground">Equipo de contacto</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Contacta directamente con el equipo comercial</p>
      </div>

      {/* Contact cards */}
      <div className="px-5 pb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {contacts.map((c) => (
            <div
              key={c.name}
              className="rounded-xl border border-border/30 bg-background/50 p-3.5 hover:border-border/50 hover:shadow-sm transition-all duration-200 group"
            >
              <div className="flex items-center gap-2.5 mb-2.5">
                <Avatar className="h-9 w-9 ring-2 ring-background shadow-sm">
                  <AvatarImage src={c.avatar} alt={c.name} />
                  <AvatarFallback className="bg-muted text-[10px] font-medium">{c.name.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.role}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 mb-2.5">
                {c.languages.map((f, i) => (
                  <span key={i} className="text-xs">{f}</span>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <button className="flex-1 flex items-center justify-center gap-1 h-7 rounded-lg bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground text-xs font-medium transition-all duration-200">
                  <Phone className="h-3 w-3" strokeWidth={1.5} />
                  Llamar
                </button>
                <button className="flex-1 flex items-center justify-center gap-1 h-7 rounded-lg bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground text-xs font-medium transition-all duration-200">
                  <Mail className="h-3 w-3" strokeWidth={1.5} />
                  Email
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border/40 mx-5" />

      {/* Website + Offices */}
      <div className="px-5 py-4 flex flex-col md:flex-row md:items-start gap-4">
        <div className="flex-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Web del proyecto</p>
          <a
            href="#"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
          >
            <Globe className="h-3 w-3" strokeWidth={1.5} />
            {website}
            <ExternalLink className="h-2.5 w-2.5 opacity-50" strokeWidth={1.5} />
          </a>
        </div>

        <div className="flex-1">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-2">Puntos de venta</p>
          <div className="space-y-1.5">
            {salesOffices.map((o) => (
              <div key={o.city} className="flex items-start gap-2">
                <MapPin className="h-3 w-3 text-muted-foreground/50 mt-0.5 shrink-0" strokeWidth={1.5} />
                <div>
                  <p className="text-sm font-medium text-foreground">{o.city}</p>
                  <p className="text-xs text-muted-foreground">{o.address}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
