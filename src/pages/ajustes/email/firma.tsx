/**
 * /ajustes/email/firma · Editor legacy de firma basado en tokens.
 *
 * Las firmas operativas (las que se inyectan en Compose / InlineReply)
 * se gestionan en SignatureManagerDialog desde el cliente de correo.
 * Esta página existe para mantener compatibilidad con la doc del ref
 * y pre-cablear el editor antiguo.
 */

import { Mail } from "lucide-react";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export default function AjustesEmailFirma() {
  return (
    <PlaceholderPage
      icon={Mail}
      eyebrow="Ajustes · Email · Firma"
      title="Firma legacy con tokens"
      description="Editor antiguo basado en marcadores como {name}, {role}, {phone} y {company}. Para firmas HTML enriquecidas usa el SignatureManager dentro del cliente de correo."
      sections={[
        "Editor con tokens dinámicos: {name}, {email}, {phone}, {company}, {website}",
        "Vista previa en tiempo real con datos de la cuenta activa",
        "Asignación por cuenta de email (cada cuenta puede tener su firma)",
        "Migración hacia el SignatureManager moderno (un click para portar)",
      ]}
      status="planning"
    />
  );
}
