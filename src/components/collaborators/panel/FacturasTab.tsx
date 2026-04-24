/**
 * Tab "Facturas" del panel de colaboración.
 *
 * Dos sub-secciones:
 *   · Emitidas · las que el promotor emite a la agencia
 *     (cargos de plataforma, servicios). Puede subir PDF o generar
 *     factura desde formulario interno.
 *   · Recibidas · las que la agencia envía al promotor
 *     (comisiones, gastos). Normalmente upload, pero también se
 *     puede generar una propuesta internamente.
 *
 * Mock localStorage. En backend:
 *   GET /api/agencias/:id/invoices
 *   POST /api/agencias/:id/invoices (upload multipart)
 *   POST /api/agencias/:id/invoices/generate (form → PDF server-side)
 */

import { useMemo, useRef, useState } from "react";
import {
  FileText, Upload, Plus, Download, MoreVertical, Trash2, CheckCircle2,
  CircleDashed, XCircle, CalendarClock,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Agency } from "@/data/agencies";
import { useCurrentUser } from "@/lib/currentUser";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import {
  useAgencyInvoices, createInvoice, markInvoicePaid, cancelInvoice, deleteInvoice,
  formatEur, type Invoice, type InvoiceDirection, type InvoiceStatus,
} from "@/lib/agencyInvoices";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface Props {
  agency: Agency;
}

export function FacturasTab({ agency: a }: Props) {
  const user = useCurrentUser();
  const actor = { name: user.name, email: user.email };
  const invoices = useAgencyInvoices(a.id);

  const [direction, setDirection] = useState<InvoiceDirection>("recibida");
  const [generateOpen, setGenerateOpen] = useState<{ open: boolean; direction: InvoiceDirection }>({ open: false, direction: "emitida" });
  const uploadRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => invoices.filter((i) => i.direction === direction), [invoices, direction]);

  const totals = useMemo(() => {
    const emitidas = invoices.filter((i) => i.direction === "emitida" && i.status !== "cancelled");
    const recibidas = invoices.filter((i) => i.direction === "recibida" && i.status !== "cancelled");
    return {
      emitidasTotal: emitidas.reduce((s, i) => s + i.total, 0),
      recibidasTotal: recibidas.reduce((s, i) => s + i.total, 0),
      emitidasCount: emitidas.length,
      recibidasCount: recibidas.length,
    };
  }, [invoices]);

  const onPickFile = () => uploadRef.current?.click();

  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    createInvoice({
      agencyId: a.id,
      direction,
      origin: "upload",
      fecha: new Date().toISOString().slice(0, 10),
      concepto: file.name.replace(/\.[^.]+$/, ""),
      baseImponible: 0,
      iva: 0,
      status: "issued",
      pdfFilename: file.name,
      pdfSize: file.size,
      createdBy: actor,
    });
    toast.success("Factura subida", { description: "Edita el importe y concepto desde el detalle." });
  };

  return (
    <div className="space-y-5">
      {/* ══ Header + KPIs ══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TotalCard
          label="Emitidas a la agencia"
          count={totals.emitidasCount}
          amount={totals.emitidasTotal}
          active={direction === "emitida"}
          onClick={() => setDirection("emitida")}
        />
        <TotalCard
          label="Recibidas de la agencia"
          count={totals.recibidasCount}
          amount={totals.recibidasTotal}
          active={direction === "recibida"}
          onClick={() => setDirection("recibida")}
        />
      </div>

      {/* ══ Acciones ══ */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 rounded-full bg-muted/50 border border-border/50 p-0.5">
          <TogglePill
            active={direction === "recibida"}
            onClick={() => setDirection("recibida")}
          >
            Recibidas ({totals.recibidasCount})
          </TogglePill>
          <TogglePill
            active={direction === "emitida"}
            onClick={() => setDirection("emitida")}
          >
            Emitidas ({totals.emitidasCount})
          </TogglePill>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={uploadRef}
            type="file"
            accept="application/pdf,image/*"
            onChange={onFileChosen}
            className="hidden"
          />
          <button
            type="button"
            onClick={onPickFile}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border border-border bg-card text-[12.5px] font-medium text-foreground hover:bg-muted transition-colors"
          >
            <Upload className="h-3.5 w-3.5" strokeWidth={1.75} />
            Subir PDF
          </button>
          <button
            type="button"
            onClick={() => setGenerateOpen({ open: true, direction })}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-foreground text-background text-[12.5px] font-semibold hover:bg-foreground/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
            Generar factura
          </button>
        </div>
      </div>

      {/* ══ Listado ══ */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <FileText className="h-5 w-5 text-muted-foreground/50 mx-auto mb-1.5" strokeWidth={1.5} />
          <p className="text-xs font-medium text-foreground">
            Sin facturas {direction === "recibida" ? "recibidas" : "emitidas"} todavía
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[320px] mx-auto">
            Sube un PDF o genera una factura desde formulario · quedarán listadas aquí.
          </p>
        </div>
      ) : (
        <ul className="rounded-2xl border border-border bg-card shadow-soft divide-y divide-border/50 overflow-hidden">
          {filtered.map((inv) => (
            <InvoiceRow key={inv.id} invoice={inv} agencyName={a.name} />
          ))}
        </ul>
      )}

      {/* Dialog de generación */}
      <GenerateInvoiceDialog
        open={generateOpen.open}
        onOpenChange={(v) => setGenerateOpen((prev) => ({ ...prev, open: v }))}
        direction={generateOpen.direction}
        agencyId={a.id}
        agencyName={a.name}
        actor={actor}
      />
    </div>
  );
}

/* ══════════════ Sub-componentes ══════════════ */

function TotalCard({
  label, count, amount, active, onClick,
}: {
  label: string;
  count: number;
  amount: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-left rounded-2xl border p-4 shadow-soft transition-all",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card hover:bg-muted/30",
      )}
    >
      <p className={cn(
        "text-[10px] font-semibold uppercase tracking-[0.14em]",
        active ? "text-background/80" : "text-muted-foreground",
      )}>
        {label}
      </p>
      <p className="text-[22px] font-bold tabular-nums leading-none mt-2">
        {formatEur(amount)}
      </p>
      <p className={cn(
        "text-[11px] mt-1",
        active ? "text-background/80" : "text-muted-foreground",
      )}>
        {count} {count === 1 ? "factura" : "facturas"}
      </p>
    </button>
  );
}

function TogglePill({
  active, onClick, children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 px-3.5 rounded-full text-[12px] font-semibold transition-colors whitespace-nowrap",
        active
          ? "bg-background text-foreground shadow-soft"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function InvoiceRow({ invoice: i, agencyName }: { invoice: Invoice; agencyName: string }) {
  const confirm = useConfirm();
  const statusMeta = STATUS_META[i.status];
  const StatusIcon = statusMeta.icon;

  const onDelete = async () => {
    const ok = await confirm({
      title: "¿Borrar factura?",
      description: "Esta acción elimina la factura permanentemente.",
      confirmLabel: "Borrar",
      destructive: true,
    });
    if (!ok) return;
    deleteInvoice(i.id);
    toast.success("Factura borrada");
  };

  return (
    <li className="px-4 sm:px-5 py-3 flex items-start gap-3">
      <span className="h-10 w-10 rounded-lg bg-muted/60 grid place-items-center shrink-0">
        <FileText className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-foreground truncate">{i.numero}</p>
          <span className={cn(
            "inline-flex items-center gap-1 h-5 px-2 rounded-full border text-[10px] font-medium",
            statusMeta.cls,
          )}>
            <StatusIcon className="h-2.5 w-2.5" strokeWidth={2} />
            {statusMeta.label}
          </span>
          {i.origin === "generate" && (
            <span className="inline-flex items-center h-5 px-2 rounded-full bg-muted/60 text-[10px] font-medium text-muted-foreground">
              Generada
            </span>
          )}
          {i.origin === "upload" && i.pdfFilename && (
            <span className="inline-flex items-center h-5 px-2 rounded-full bg-muted/60 text-[10px] font-medium text-muted-foreground">
              Subida
            </span>
          )}
        </div>
        <p className="text-[11.5px] text-muted-foreground mt-0.5 truncate">
          {i.concepto}
        </p>
        <p className="text-[10.5px] text-muted-foreground/80 mt-0.5 tabular-nums">
          {formatDate(i.fecha)} · base {formatEur(i.baseImponible)} · IVA {i.iva}%
          {i.pdfFilename ? ` · ${i.pdfFilename}` : ""}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-semibold text-foreground tabular-nums">
          {formatEur(i.total)}
        </p>
        {i.paidAt && (
          <p className="text-[10px] text-success mt-0.5">
            Pagada {new Date(i.paidAt).toLocaleDateString("es-ES")}
          </p>
        )}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="h-8 w-8 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            aria-label="Más acciones"
          >
            <MoreVertical className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[180px] rounded-xl border border-border bg-card shadow-soft-lg py-1">
          <DropdownMenuItem
            onSelect={() => toast.info("Descarga · disponible al conectar backend")}
            className="gap-2.5 px-3 py-1.5 text-[12.5px] rounded-md"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={1.75} /> Descargar
          </DropdownMenuItem>
          {i.status !== "paid" && i.status !== "cancelled" && (
            <DropdownMenuItem
              onSelect={() => { markInvoicePaid(i.id); toast.success("Marcada como pagada"); }}
              className="gap-2.5 px-3 py-1.5 text-[12.5px] rounded-md"
            >
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} /> Marcar como pagada
            </DropdownMenuItem>
          )}
          {i.status !== "cancelled" && (
            <DropdownMenuItem
              onSelect={() => { cancelInvoice(i.id); toast.success("Factura cancelada"); }}
              className="gap-2.5 px-3 py-1.5 text-[12.5px] rounded-md"
            >
              <XCircle className="h-3.5 w-3.5" strokeWidth={1.75} /> Cancelar
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={onDelete}
            className="gap-2.5 px-3 py-1.5 text-[12.5px] rounded-md text-destructive focus:text-destructive focus:bg-destructive/5"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} /> Borrar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

const STATUS_META: Record<InvoiceStatus, {
  label: string;
  icon: typeof CheckCircle2;
  cls: string;
}> = {
  draft:     { label: "Borrador",  icon: CircleDashed, cls: "border-border bg-muted/40 text-muted-foreground" },
  issued:    { label: "Emitida",   icon: CalendarClock, cls: "border-primary/25 bg-primary/10 text-primary" },
  paid:      { label: "Pagada",    icon: CheckCircle2,  cls: "border-success/25 bg-success/10 text-success" },
  cancelled: { label: "Cancelada", icon: XCircle,       cls: "border-destructive/25 bg-destructive/10 text-destructive" },
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
  } catch { return iso; }
}

/* ═══════════ Dialog · Generar factura ═══════════ */

function GenerateInvoiceDialog({
  open, onOpenChange, direction, agencyId, agencyName, actor,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  direction: InvoiceDirection;
  agencyId: string;
  agencyName: string;
  actor: { name: string; email?: string };
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [fecha, setFecha] = useState(today);
  const [concepto, setConcepto] = useState("");
  const [base, setBase] = useState("");
  const [iva, setIva] = useState("21");
  const [notes, setNotes] = useState("");

  const baseNum = parseFloat(base.replace(",", ".")) || 0;
  const ivaNum = parseFloat(iva.replace(",", ".")) || 0;
  const total = Math.round((baseNum * (1 + ivaNum / 100)) * 100) / 100;
  const valid = concepto.trim() !== "" && baseNum > 0;

  const reset = () => {
    setFecha(today);
    setConcepto("");
    setBase("");
    setIva("21");
    setNotes("");
  };

  const onGenerate = () => {
    if (!valid) return;
    createInvoice({
      agencyId,
      direction,
      origin: "generate",
      fecha,
      concepto,
      baseImponible: baseNum,
      iva: ivaNum,
      status: "issued",
      notes,
      createdBy: actor,
    });
    toast.success(
      direction === "emitida"
        ? `Factura emitida a ${agencyName}`
        : `Factura registrada para ${agencyName}`,
    );
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg p-0 gap-0 sm:rounded-3xl">
        <DialogHeader className="px-5 sm:px-6 pt-5 pb-3 pr-12 sm:pr-14 border-b border-border/60">
          <DialogTitle className="text-base sm:text-lg font-semibold">
            {direction === "emitida" ? `Generar factura a ${agencyName}` : `Registrar factura de ${agencyName}`}
          </DialogTitle>
          <p className="text-[11.5px] text-muted-foreground mt-0.5">
            Se guardará numerada consecutivamente · base {formatEur(baseNum)} · IVA {ivaNum}% · total{" "}
            <span className="font-semibold text-foreground tabular-nums">{formatEur(total)}</span>.
          </p>
        </DialogHeader>

        <div className="px-5 sm:px-6 py-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Fecha">
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-border bg-card text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </Field>
            <Field label="IVA (%)">
              <input
                type="number"
                step="0.01"
                value={iva}
                onChange={(e) => setIva(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-border bg-card text-[13px] text-foreground font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </Field>
          </div>
          <Field label="Concepto">
            <input
              type="text"
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder="Ej. Comisión venta Villa 12-B"
              className="w-full h-9 px-3 rounded-lg border border-border bg-card text-[13px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </Field>
          <Field label="Base imponible (€)">
            <input
              type="text"
              inputMode="decimal"
              value={base}
              onChange={(e) => setBase(e.target.value)}
              placeholder="0,00"
              className="w-full h-9 px-3 rounded-lg border border-border bg-card text-[13px] text-foreground font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </Field>
          <Field label="Notas internas">
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-[12.5px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </Field>
        </div>

        <footer className="px-5 sm:px-6 py-3 border-t border-border/60 flex items-center justify-end gap-2 bg-muted/10">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-9 px-4 rounded-full border border-border bg-card text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onGenerate}
            disabled={!valid}
            className={cn(
              "inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-sm font-semibold transition-colors",
              valid
                ? "bg-foreground text-background hover:bg-foreground/90"
                : "bg-muted text-muted-foreground cursor-not-allowed",
            )}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
            Generar
          </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
