import { Settings } from "lucide-react";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export default function Ajustes() {
  return (
    <PlaceholderPage
      icon={Settings}
      eyebrow="Administración"
      title="Ajustes de la cuenta"
      description="Perfil personal, empresa, equipo, integraciones y preferencias. Todo lo administrativo vive aquí, separado del flujo comercial diario."
      sections={[
        "Perfil: datos personales, contraseña, 2FA",
        "Empresa: logo, datos fiscales, comerciales",
        "Equipo: miembros, roles, permisos",
        "Integraciones: Twilio, Stripe, Google, Meta",
        "Notificaciones: email + push",
        "Facturación y plan",
      ]}
    />
  );
}
