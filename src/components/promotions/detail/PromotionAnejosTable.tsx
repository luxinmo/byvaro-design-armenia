/**
 * PromotionAnejosTable · tabla de anejos sueltos (parkings/trasteros)
 * que se venden por separado de la vivienda.
 *
 * Se renderiza dentro de `PromotionAvailabilityFull` cuando el segmento
 * "Anejos" está activo. Refleja el mismo patrón que la tabla de
 * viviendas: filtros arriba, filas con kebab de acciones, estado
 * coloreado.
 *
 * TODO(backend): consume `GET /api/promociones/:id/anejos` (ver
 * `docs/backend-integration.md §3`). Hoy los datos vienen del mock
 * `anejosByPromotion`.
 */

import { useMemo, useState } from "react";
import {
  Search, MoreVertical, Eye, Pencil, Send, ShoppingCart, Car, Archive,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  type Anejo, type AnejoStatus, type AnejoTipo,
  anejoStatusConfig,
} from "@/data/anejos";
import { cn } from "@/lib/utils";

function formatPrice(n: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency", currency: "EUR", maximumFractionDigits: 0,
  }).format(n);
}

export function PromotionAnejosTable({
  anejos, tipo, isCollaboratorView = false,
}: {
  anejos: Anejo[];
  /** Tipo fijo · la tabla solo renderiza anejos de este tipo. */
  tipo: AnejoTipo;
  isCollaboratorView?: boolean;
}) {
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<AnejoStatus | "all">("all");
  const [search, setSearch] = useState("");

  const searchPlaceholder = tipo === "parking" ? "Buscar plaza o cliente..." : "Buscar trastero o cliente...";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return anejos.filter((a) => {
      if (filterStatus !== "all" && a.status !== filterStatus) return false;
      if (q) {
        const hay =
          a.publicId.toLowerCase().includes(q) ||
          (a.clientName ?? "").toLowerCase().includes(q);
        if (!hay) return false;
      }
      return true;
    });
  }, [anejos, filterStatus, search]);

  const totals = useMemo(() => {
    const byStatus = anejos.reduce((acc, a) => {
      acc[a.status] = (acc[a.status] ?? 0) + 1;
      return acc;
    }, {} as Record<AnejoStatus, number>);
    return {
      total: anejos.length,
      available: byStatus.available ?? 0,
      reserved:  byStatus.reserved ?? 0,
      sold:      byStatus.sold ?? 0,
      withdrawn: byStatus.withdrawn ?? 0,
    };
  }, [anejos]);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <KpiChip label="Total"      value={totals.total}     tone="neutral" />
        <KpiChip label="Disponibles" value={totals.available} tone="emerald" />
        <KpiChip label="Reservados"  value={totals.reserved}  tone="amber" />
        <KpiChip label="Vendidos"    value={totals.sold}      tone="muted" />
        <KpiChip label="Retirados"   value={totals.withdrawn} tone="destructive" />
      </div>

      {/* Toolbar */}
      <div className="hidden sm:block border border-border rounded-2xl bg-card p-4 shadow-soft">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
          <div className="relative w-full sm:flex-1 sm:min-w-[200px] sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as AnejoStatus | "all")}
            className="min-w-0 h-9 px-2.5 rounded-lg border border-border bg-background text-sm"
          >
            <option value="all">Estados</option>
            <option value="available">Disponible</option>
            <option value="reserved">Reservado</option>
            <option value="sold">Vendido</option>
            <option value="withdrawn">Retirado</option>
          </select>
        </div>
      </div>

      {/* Tabla */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 py-10 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            {tipo === "parking" ? "Sin plazas de parking" : "Sin trasteros"}
          </p>
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            {anejos.length === 0
              ? (tipo === "parking"
                  ? "Esta promoción no tiene plazas sueltas."
                  : "Esta promoción no tiene trasteros sueltos.")
              : "Ningún resultado coincide con los filtros."}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card shadow-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 text-left font-semibold">ID</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Precio</th>
                  <th className="px-3 py-2.5 text-left font-semibold">Cliente</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Estado</th>
                  <th className="px-2 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const sc = anejoStatusConfig[a.status];
                  const TipoIcon = a.tipo === "parking" ? Car : Archive;
                  return (
                    <tr key={a.id} className="border-t border-border/60 hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-2">
                          <TipoIcon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                          <span className="text-xs font-bold text-foreground">{a.publicId}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-sm font-semibold tabular-nums text-foreground">
                        {formatPrice(a.precio)}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        {a.clientName ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={cn("inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5", sc.badgeClass)}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", sc.dotClass)} />
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
                              <MoreVertical className="h-3.5 w-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem
                              onClick={() => toast({ title: "Ver anejo", description: a.publicId })}
                              className="gap-2 text-xs"
                            >
                              <Eye className="h-3.5 w-3.5" /> Ver
                            </DropdownMenuItem>
                            {!isCollaboratorView && (
                              <DropdownMenuItem
                                disabled={a.status !== "available"}
                                onClick={() => toast({ title: "Editar anejo", description: a.publicId })}
                                className="gap-2 text-xs"
                              >
                                <Pencil className="h-3.5 w-3.5" /> Editar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              disabled={a.status !== "available"}
                              onClick={() => toast({ title: "Enviar anejo", description: a.publicId })}
                              className="gap-2 text-xs"
                            >
                              <Send className="h-3.5 w-3.5" /> Enviar por email
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={a.status !== "available"}
                              onClick={() => toast({ title: "Iniciar compra", description: `Operación para ${a.publicId}` })}
                              className="gap-2 text-xs"
                            >
                              <ShoppingCart className="h-3.5 w-3.5" /> Iniciar compra
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiChip({
  label, value, tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "emerald" | "amber" | "muted" | "destructive";
}) {
  const toneClass = {
    neutral:    "bg-card border-border text-foreground",
    emerald:    "bg-emerald-50 border-emerald-200 text-emerald-800",
    amber:      "bg-amber-50 border-amber-200 text-amber-900",
    muted:      "bg-muted/50 border-border text-foreground",
    destructive:"bg-destructive/5 border-destructive/20 text-destructive",
  }[tone];
  return (
    <div className={cn("rounded-xl border px-3 py-2 shadow-soft", toneClass)}>
      <p className="text-[9.5px] font-semibold uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-lg font-bold tabular-nums leading-tight mt-0.5">{value}</p>
    </div>
  );
}
