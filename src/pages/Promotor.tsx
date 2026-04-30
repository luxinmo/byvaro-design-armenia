/**
 * /promotor/:id · Ficha pública del promotor desde la cuenta de agencia.
 *
 * Mirror de `/colaboradores/:id` (ficha pública de agencia) pero al
 * revés · es la pantalla a la que cae la agencia cuando NO tiene
 * colaboración activa con este promotor (marketplace, exploración).
 *
 * Reutiliza `Empresa.tsx` en modo visitor.
 *
 * URLs · `:id` SIEMPRE es `IDXXXXXX` (`Empresa.publicRef`). Las URLs
 * legacy con id interno YA NO funcionan · si la ref no resuelve a un
 * tenant conocido, mostramos 404.
 */

import { useNavigate, useParams } from "react-router-dom";
import Empresa from "./Empresa";
import { resolveTenantId } from "@/lib/tenantRefResolver";

export default function Promotor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const tenantId = id ? resolveTenantId(id) : undefined;

  if (!id || !tenantId) {
    return (
      <div className="flex flex-col min-h-full bg-background items-center justify-center px-4 py-10 text-center">
        <h1 className="text-xl font-bold text-foreground mb-1">Promotor no encontrado</h1>
        <p className="text-sm text-muted-foreground mb-6 max-w-md">
          La referencia <span className="font-mono">{id}</span> no corresponde a ningún
          promotor de Byvaro. Las URLs llevan formato <span className="font-mono">IDXXXXXX</span>.
        </p>
        <button
          onClick={() => navigate("/inicio")}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-foreground text-background text-sm font-semibold hover:bg-foreground/90 transition-colors"
        >
          ← Volver al inicio
        </button>
      </div>
    );
  }

  return <Empresa tenantId={tenantId} />;
}
