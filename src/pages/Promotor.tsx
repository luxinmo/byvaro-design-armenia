/**
 * /promotor/:id · Ficha pública del promotor desde la cuenta de agencia.
 *
 * Mirror de `/colaboradores/:id` (ficha pública de agencia) pero al
 * revés · es la pantalla a la que cae la agencia cuando NO tiene
 * colaboración activa con este promotor (marketplace, exploración).
 *
 * Reutiliza `Empresa.tsx` en modo visitor pasando un `tenantId` con
 * prefijo `developer-` que `useEmpresa` resuelve contra los datos
 * reales del workspace (`byvaro-empresa`) en vez de la lista de
 * agencias.
 *
 * REGLA DE ORO: si la agencia ya colabora, el helper
 * `developerHref()` (`src/lib/developerNavigation.ts`) la lleva
 * directamente al panel operativo en `/promotor/:id/panel`. Esta
 * pantalla es solo para no-colaboradoras.
 */

import { useParams } from "react-router-dom";
import Empresa from "./Empresa";
import { DEFAULT_DEVELOPER_ID } from "@/lib/developerNavigation";
import { resolveTenantId } from "@/lib/tenantRefResolver";

export default function Promotor() {
  const { id } = useParams<{ id: string }>();
  /* Acepta tanto IDXXXXXX (canónico) como id interno legacy. */
  const tenantId = resolveTenantId(id ?? DEFAULT_DEVELOPER_ID);
  return <Empresa tenantId={tenantId} />;
}
