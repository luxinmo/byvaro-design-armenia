/**
 * /ajustes/facturacion/facturas — Histórico de facturas con descarga.
 */

import { Download, FileText, ExternalLink } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Invoice = {
  id: string;
  number: string;
  date: string;
  amount: number;
  status: "paid" | "pending" | "failed";
  period: string;
};

const MOCK: Invoice[] = [
  { id: "f12", number: "BYV-2026-04-001", date: "1 abr 2026", amount: 249, status: "paid", period: "Abril 2026" },
  { id: "f11", number: "BYV-2026-03-001", date: "1 mar 2026", amount: 249, status: "paid", period: "Marzo 2026" },
  { id: "f10", number: "BYV-2026-02-001", date: "1 feb 2026", amount: 249, status: "paid", period: "Febrero 2026" },
  { id: "f09", number: "BYV-2026-01-001", date: "1 ene 2026", amount: 249, status: "paid", period: "Enero 2026" },
  { id: "f08", number: "BYV-2025-12-001", date: "1 dic 2025", amount: 99, status: "paid", period: "Diciembre 2025" },
  { id: "f07", number: "BYV-2025-11-001", date: "1 nov 2025", amount: 99, status: "paid", period: "Noviembre 2025" },
];

const STATUS = {
  paid: { label: "Pagada", cls: "bg-emerald-100 text-emerald-700" },
  pending: { label: "Pendiente", cls: "bg-amber-100 text-amber-700" },
  failed: { label: "Fallida", cls: "bg-destructive/10 text-destructive" },
} as const;

function formatPrice(n: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(n);
}

export default function AjustesFacturacionFacturas() {
  const total = MOCK.reduce((s, i) => s + i.amount, 0);

  return (
    <SettingsScreen
      title="Facturas"
      description={`${MOCK.length} facturas · ${formatPrice(total)} pagado en total. Descárgalas en PDF para tu contabilidad.`}
    >
      <SettingsCard>
        <div className="overflow-x-auto -mx-5 sm:-mx-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/40">
                <th className="text-left py-3 px-5 sm:px-6 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Número</th>
                <th className="text-left py-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Periodo</th>
                <th className="text-left py-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Fecha</th>
                <th className="text-right py-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Importe</th>
                <th className="text-center py-3 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Estado</th>
                <th className="text-right py-3 px-5 sm:px-6 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {MOCK.map((inv) => (
                <tr key={inv.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                  <td className="py-3 px-5 sm:px-6 font-mono text-[12.5px] text-foreground">{inv.number}</td>
                  <td className="px-3 text-foreground">{inv.period}</td>
                  <td className="px-3 text-muted-foreground">{inv.date}</td>
                  <td className="px-3 text-right tnum text-foreground">{formatPrice(inv.amount)}</td>
                  <td className="px-3 text-center">
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold", STATUS[inv.status].cls)}>
                      {STATUS[inv.status].label}
                    </span>
                  </td>
                  <td className="px-5 sm:px-6 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        toast.success(`Descargando ${inv.number}.pdf …`);
                        const blob = new Blob([`Factura ${inv.number}\n\nFecha: ${inv.date}\nImporte: ${formatPrice(inv.amount)}\nEstado: ${STATUS[inv.status].label}\n\n(Mock PDF)`], { type: "text/plain" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url; a.download = `${inv.number}.txt`; a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="rounded-full"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">PDF</span>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SettingsCard>

      <SettingsCard>
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">¿Necesitas el portal completo?</p>
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => toast.info("Portal de facturación · próximamente")}>
            Abrir portal
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </SettingsCard>
    </SettingsScreen>
  );
}
