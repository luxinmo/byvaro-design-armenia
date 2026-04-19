import { Globe } from "lucide-react";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export default function Microsites() {
  return (
    <PlaceholderPage
      icon={Globe}
      eyebrow="Contenido · Microsites"
      title="Webs públicas por promoción"
      description="Genera un microsite público (landing page) por cada promoción con subdominio propio, SEO optimizado, formulario de captación conectado a Registros y analytics integradas."
      sections={[
        "Un microsite por promoción (activable en 1 clic)",
        "Editor visual con plantillas (galería, tour 3D, mapa, contacto)",
        "Subdominio auto-generado (villasdelpinar.byvaro.app)",
        "Formulario de captación → registro automático",
        "SEO: meta, schema.org, sitemap",
        "Integración Google Analytics / Meta Pixel",
      ]}
    />
  );
}
