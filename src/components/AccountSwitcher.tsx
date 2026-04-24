/**
 * AccountSwitcher — Pill + dropdown para cambiar entre vista de Promotor
 * y vista de Agencia colaboradora (mock).
 *
 * Vive en el AppHeader (desktop) como utilidad de testing. En producción
 * este componente desaparece; el `accountType` vendrá del JWT y cada cuenta
 * abrirá una sesión aislada.
 *
 * Responsabilidades:
 *   · Mostrar la vista actual (Promotor o nombre de la agencia activa).
 *   · Permitir cambiar a Promotor o elegir una agencia del seed.
 *   · Persistir la elección via `setAccountType` / `setAccountAgencyId`.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Check, ChevronDown, Handshake, LogOut } from "lucide-react";
import { agencies } from "@/data/agencies";
import { isAgencyVerified } from "@/lib/licenses";
import { getAgencyLicenses } from "@/lib/agencyLicenses";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { useEmpresa } from "@/lib/empresa";
import {
  useAccountType,
  setAccountType,
  setAccountAgencyId,
  logout,
} from "@/lib/accountType";
import { cn } from "@/lib/utils";

export function AccountSwitcher() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { type, agencyId } = useAccountType();
  const { empresa } = useEmpresa();

  const activeAgency = agencies.find((a) => a.id === agencyId);
  // Solo listamos agencias "reales" — las solicitudes pendientes aún no son
  // colaboradoras activas, así que no tiene sentido "verse como ellas".
  const selectable = agencies.filter(
    (a) => !a.solicitudPendiente && !a.isNewRequest,
  );

  const developerName = empresa.nombreComercial || "Luxinmo";
  const label =
    type === "developer"
      ? `Promotor · ${developerName}`
      : `Agencia · ${activeAgency?.name ?? "Sin agencia"}`;

  const Icon = type === "developer" ? Building2 : Handshake;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-2 h-7 px-2.5 rounded-full border text-xs transition-colors",
          type === "agency"
            ? "bg-primary/10 text-primary border-primary/30"
            : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/30",
        )}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        <span className="max-w-[200px] truncate font-medium">{label}</span>
        <ChevronDown className="h-3 w-3 opacity-60" strokeWidth={2} />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            role="menu"
            className="absolute right-0 top-full mt-1 z-50 bg-popover border border-border rounded-xl shadow-soft-lg min-w-[300px] py-1.5"
          >
            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Ver como
            </div>

            {/* Promotor */}
            <button
              type="button"
              onClick={() => {
                setAccountType("developer");
                setOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-muted transition-colors",
                type === "developer" && "bg-muted/60",
              )}
            >
              <Building2 className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.75} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-foreground truncate">Promotor</div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {developerName}
                </div>
              </div>
              {type === "developer" && (
                <Check className="h-3.5 w-3.5 text-primary shrink-0" strokeWidth={2.5} />
              )}
            </button>

            <div className="h-px bg-border/60 my-1" />

            <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Agencias colaboradoras
            </div>

            <div className="max-h-[260px] overflow-y-auto">
              {selectable.map((a) => {
                const selected = type === "agency" && agencyId === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setAccountAgencyId(a.id);
                      setAccountType("agency");
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-muted transition-colors",
                      selected && "bg-muted/60",
                    )}
                  >
                    <Handshake
                      className="h-4 w-4 text-muted-foreground shrink-0"
                      strokeWidth={1.75}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="font-medium text-foreground truncate">{a.name}</span>
                        {isAgencyVerified(getAgencyLicenses(a)) && <VerifiedBadge size="sm" />}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {a.location}
                      </div>
                    </div>
                    {selected && (
                      <Check
                        className="h-3.5 w-3.5 text-primary shrink-0"
                        strokeWidth={2.5}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="h-px bg-border/60 my-1" />
            <button
              type="button"
              onClick={() => {
                logout();
                setOpen(false);
                navigate("/login", { replace: true });
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              <span className="font-medium">Cerrar sesión</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
