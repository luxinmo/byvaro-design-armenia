/**
 * AgenciaEntry · Entrada al SaaS en modo Agencia.
 *
 * Rutas:
 *   - `/agencia`         → picker con las agencias disponibles.
 *   - `/agencia/:id`     → configura sessionStorage y renderiza el Inicio
 *                          en esa misma URL (no redirige).
 *
 * Responsabilidad:
 *   · Setear `accountType=agency` + `agencyId=<id>` en sessionStorage antes
 *     del primer render para que las páginas leídas por `useCurrentUser()`
 *     vean ya el contexto correcto.
 *   · En la ruta con `:id`, renderizar el AppLayout + Inicio sin redirigir:
 *     así el usuario puede marcar `/agencia/ag-1` como bookmark y siempre
 *     entrará a ese SaaS en particular.
 *
 * Rationale del uso de sessionStorage (no localStorage): cada pestaña lleva
 * su propio contexto, así el usuario puede tener una pestaña como Promotor y
 * otra como Agencia a la vez — útil durante diseño/QA.
 */

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Handshake, ArrowRight, Building2, ArrowLeft } from "lucide-react";
import { agencies, getAgencyShareStats } from "@/data/agencies";
import {
  setAccountType,
  setAccountAgencyId,
  readAccountType,
} from "@/lib/accountType";
import { AppLayout } from "@/components/AppLayout";
import Inicio from "@/pages/Inicio";
import { cn } from "@/lib/utils";

export default function AgenciaEntry() {
  const { id } = useParams<{ id?: string }>();

  /* Si viene con :id válido, configuramos sessionStorage *antes* del primer
   * render para que los componentes hijos (AppLayout, Sidebar, Inicio) lean
   * el contexto correcto desde el inicio. */
  const validId = id && agencies.some((a) => a.id === id) ? id : null;
  if (validId) {
    const current = readAccountType();
    if (current.type !== "agency" || current.agencyId !== validId) {
      setAccountAgencyId(validId);
      setAccountType("agency");
    }
  }

  // Forzamos un tick tras montar para asegurar que `useCurrentUser` capte el
  // cambio si el hook ya estaba montado en otra parte del árbol.
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (validId) forceTick((n) => n + 1);
  }, [validId]);

  if (validId) {
    // Modo "agency dashboard" — misma URL (/agencia/:id), layout completo.
    return (
      <AppLayout>
        <Inicio />
      </AppLayout>
    );
  }

  // Sin :id → mostramos el picker.
  return <AgencyPicker />;
}

/* ═══════════════════════════════════════════════════════════════════
   Picker
   ═══════════════════════════════════════════════════════════════════ */

function AgencyPicker() {
  const navigate = useNavigate();

  const selectable = agencies.filter(
    (a) => !a.solicitudPendiente && !a.isNewRequest,
  );

  const pickAgency = (agencyId: string) => {
    setAccountAgencyId(agencyId);
    setAccountType("agency");
    navigate(`/agencia/${agencyId}`, { replace: true });
  };

  const backToPromotor = () => {
    setAccountType("developer");
    navigate("/inicio", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[960px] mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <header className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold uppercase tracking-[0.14em] mb-4">
            <Handshake className="h-3.5 w-3.5" strokeWidth={1.75} />
            Modo agencia
          </div>
          <h1 className="text-[28px] sm:text-[34px] font-bold tracking-tight text-foreground leading-tight">
            Entra como agencia colaboradora
          </h1>
          <p className="text-sm text-muted-foreground mt-3 max-w-[520px] mx-auto leading-relaxed">
            Elige una agencia para entrar a su SaaS: verás sólo las promociones
            donde colabora, sus registros, y podrás registrar nuevos clientes.
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {selectable.map((a) => (
            <button
              key={a.id}
              onClick={() => pickAgency(a.id)}
              className={cn(
                "group flex items-center gap-4 rounded-2xl bg-card border border-border p-4 text-left",
                "hover:border-foreground/30 hover:shadow-soft-lg hover:-translate-y-0.5 transition-all duration-200",
                "shadow-soft",
              )}
            >
              <img
                src={a.logo}
                alt=""
                className="h-14 w-14 rounded-full object-cover border-2 border-card shadow-soft bg-background shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-foreground truncate">
                  {a.name}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {a.location}
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                  {(() => {
                    const s = getAgencyShareStats(a);
                    return (
                      <span>
                        {s.sharedActive} de {s.activeTotal}{" "}
                        {s.activeTotal === 1 ? "promoción" : "promociones"}
                      </span>
                    );
                  })()}
                  {a.teamSize != null && (
                    <>
                      <span className="opacity-40">·</span>
                      <span>{a.teamSize} agentes</span>
                    </>
                  )}
                </div>
              </div>
              <ArrowRight
                className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0"
                strokeWidth={1.75}
              />
            </button>
          ))}
        </div>

        <div className="mt-10 flex items-center justify-center">
          <button
            onClick={backToPromotor}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-border bg-card text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
            <Building2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            Volver a vista promotor
          </button>
        </div>

        <p className="text-center text-[11px] text-muted-foreground mt-8">
          También puedes compartir un link directo tipo{" "}
          <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">
            /agencia/{selectable[0]?.id ?? "ag-1"}
          </code>{" "}
          para saltar el picker.
        </p>
      </div>
    </div>
  );
}
