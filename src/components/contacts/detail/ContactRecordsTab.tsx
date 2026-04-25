/**
 * Tab "Registros" de la ficha de contacto.
 *
 * Muestra la MISMA vista que `/registros` (canónica) filtrada por
 * este contacto · matching heurístico por nombre + últimos 4 dígitos
 * del teléfono hasta que exista `Registro.contactId` en backend.
 *
 * Una sola fuente de verdad de cómo se renderiza un registro · ver
 * `src/components/registros/RegistrosEmbedded.tsx`.
 */

import { RegistrosEmbedded } from "@/components/registros/RegistrosEmbedded";
import type { ContactDetail } from "@/components/contacts/types";

export function ContactRecordsTab({ detail }: { detail: ContactDetail }) {
  return (
    <RegistrosEmbedded
      filterContact={{ fullName: detail.name, telefono: detail.phone }}
      emptyTitle="Sin registros para este contacto"
      emptyDescription="Cuando una agencia o portal envíe una solicitud para este contacto, aparecerá aquí. Click en cualquier registro para abrirlo en la bandeja completa."
    />
  );
}
