/**
 * /ajustes/contactos/importar — Importador de contactos CSV / Excel.
 *
 * Wizard de 4 pasos: subir archivo → mapear columnas → revisar → listo.
 *
 * Portado de figgy-friend-forge · ImportContactsDialog.tsx pero
 * adaptado a página completa dentro del SettingsShell:
 *  - Soporta .csv, .xlsx, .xls, .ods (xlsx lib)
 *  - Auto-match de columnas con aliases en español + inglés
 *  - Validación de campos requeridos (fullName/email) y duplicados
 *  - Preview de las primeras 5 filas
 *  - Persistencia: guarda el resultado en
 *    `byvaro.contacts.imported.v1` (ver importedStorage.ts).
 *  - TODO(backend): POST /api/contacts/bulk en lugar de localStorage.
 */

import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  Upload, FileSpreadsheet, Check, X, ChevronRight, ChevronLeft,
  Sparkles, AlertCircle, CheckCircle2, Download, Trash2,
} from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  appendImported, clearImportedContacts, loadImportedContacts,
  type ImportedRow,
} from "@/components/contacts/importedStorage";
import { useConfirm } from "@/components/ui/ConfirmDialog";

/* ══════ Campos de Byvaro a los que se puede mapear ══════ */
type SystemField = {
  id: string;
  label: string;
  required?: boolean;
  aliases: string[];
};

const SYSTEM_FIELDS: SystemField[] = [
  /* Internamente el sistema solo guarda "Nombre completo" (ver
   * memoria "feedback_full_name"). Pero como los CSV reales suelen
   * traer Nombre y Apellido en columnas separadas, el importer expone
   * 3 opciones: Nombre, Apellido, Nombre completo.
   *
   * Reglas en `buildRow`:
   *  - Si hay "Nombre completo" mapeado → se usa tal cual.
   *  - Si no, pero hay "Nombre" y/o "Apellido" → se concatenan en
   *    orden estándar `Nombre + " " + Apellido`.
   *
   * Validación: al menos UNA de las 3 columnas (más email) debe estar
   * mapeada para poder importar. */
  { id: "firstName", label: "Nombre", aliases: [
    "first name", "firstname", "nombre", "name", "given name",
  ] },
  { id: "lastName", label: "Apellido", aliases: [
    "last name", "lastname", "surname", "apellido", "apellidos", "family name",
  ] },
  { id: "fullName", label: "Nombre completo", aliases: [
    "full name", "fullname", "nombre completo", "nombre y apellidos",
  ] },
  { id: "email", label: "Email", required: true, aliases: ["email", "e-mail", "mail", "correo"] },
  { id: "reference", label: "Referencia interna", aliases: [
    "reference", "referencia", "referencia interna", "ref", "code", "codigo",
    "código", "id externo", "external id", "customer id",
  ] },
  { id: "phone", label: "Teléfono", aliases: ["phone", "telefono", "teléfono", "mobile", "móvil", "movil", "tel", "celular"] },
  { id: "nationality", label: "Nacionalidad / País", aliases: ["nationality", "nacionalidad", "country", "país", "pais"] },
  { id: "birthDate", label: "Fecha de nacimiento", aliases: ["birth", "birthday", "birthdate", "fecha de nacimiento", "nacimiento", "dob"] },
  { id: "language", label: "Idioma", aliases: ["language", "idioma", "lang"] },
  { id: "address", label: "Dirección", aliases: ["address", "direccion", "dirección", "street"] },
  { id: "city", label: "Ciudad", aliases: ["city", "ciudad", "town"] },
  { id: "postalCode", label: "Código postal", aliases: ["postal", "zip", "cp", "código postal", "codigo postal"] },
  { id: "company", label: "Empresa", aliases: ["company", "empresa", "organization", "organización"] },
  { id: "budget", label: "Presupuesto", aliases: ["budget", "presupuesto", "price"] },
  { id: "interest", label: "Promoción de interés", aliases: ["interest", "interés", "interes", "promotion", "promoción", "project"] },
  { id: "source", label: "Origen", aliases: ["source", "origen", "fuente", "channel"] },
  { id: "tags", label: "Etiquetas", aliases: ["tags", "etiquetas", "labels"] },
  { id: "notes", label: "Notas", aliases: ["notes", "notas", "comments", "comentarios"] },
];

const IGNORE = "__ignore__";

type Step = "upload" | "mapping" | "review" | "done";
type ParsedFile = { headers: string[]; rows: string[][]; fileName: string };

/* ══════ CSV parser que respeta comillas y delimitador ; vs , ══════ */
function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  const delimiter = firstLine.split(";").length > firstLine.split(",").length ? ";" : ",";
  const lines: string[][] = [];
  let current: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cell += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === delimiter) { current.push(cell); cell = ""; }
      else if (c === "\n") { current.push(cell); lines.push(current); current = []; cell = ""; }
      else if (c === "\r") { /* skip */ }
      else cell += c;
    }
  }
  if (cell.length > 0 || current.length > 0) { current.push(cell); lines.push(current); }
  const cleaned = lines.filter((l) => l.some((x) => x.trim().length > 0));
  const headers = (cleaned.shift() ?? []).map((h) => h.trim());
  return { headers, rows: cleaned };
}

function autoMatch(header: string): string | null {
  const norm = header.toLowerCase().trim();
  for (const f of SYSTEM_FIELDS) {
    if (f.aliases.some((a) => norm === a || norm.includes(a))) return f.id;
  }
  return null;
}

/* ══════ Componente página ══════ */
export default function AjustesContactosImportar() {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [historyVersion, setHistoryVersion] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();

  const previousImports = useMemo(() => loadImportedContacts(), [historyVersion]);

  const reset = () => {
    setStep("upload");
    setFile(null);
    setMapping({});
    setError(null);
    setImportedCount(0);
  };

  const handleFile = async (f: File) => {
    setError(null);
    const isExcel = /\.(xlsx|xls|xlsm|ods)$/i.test(f.name);
    const isCsv = /\.(csv|txt|tsv)$/i.test(f.name);
    if (!isExcel && !isCsv) {
      setError("Sube un archivo .csv, .xlsx o .xls.");
      return;
    }
    let headers: string[] = [];
    let rows: string[][] = [];
    try {
      if (isExcel) {
        const buf = await f.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheetName = wb.SheetNames[0];
        const sheet = wb.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "", raw: false });
        const cleaned = data.filter((r) => Array.isArray(r) && r.some((c) => String(c ?? "").trim().length > 0));
        headers = (cleaned.shift() ?? []).map((h) => String(h ?? "").trim());
        rows = cleaned.map((r) => r.map((c) => String(c ?? "")));
      } else {
        const text = await f.text();
        const parsed = parseCSV(text);
        headers = parsed.headers;
        rows = parsed.rows;
      }
    } catch {
      setError("No se ha podido leer el archivo. Revisa el formato.");
      return;
    }
    if (headers.length === 0 || rows.length === 0) {
      setError("El archivo parece estar vacío.");
      return;
    }
    const initial: Record<string, string> = {};
    headers.forEach((h) => { initial[h] = autoMatch(h) ?? IGNORE; });
    setFile({ headers, rows, fileName: f.name });
    setMapping(initial);
    setStep("mapping");
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const downloadTemplate = () => {
    const headers = SYSTEM_FIELDS.map((f) => f.label).join(",");
    const sample = "John Doe,john@example.com,+34 600 000 000,España,1985-03-12,ES,Calle Mayor 1,Madrid,28001,Acme Inc,500000,Sea Breeze,Web,VIP;Inversor,Busca primera línea de playa";
    const blob = new Blob([headers + "\n" + sample], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "byvaro-contactos-plantilla.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  /* ══════ Validación ══════ */
  const mappedFieldIds = useMemo(
    () => new Set(Object.values(mapping).filter((v) => v !== IGNORE)),
    [mapping],
  );
  const requiredMissing = useMemo(
    () => SYSTEM_FIELDS.filter((f) => f.required && !mappedFieldIds.has(f.id)),
    [mappedFieldIds],
  );
  /** Necesitamos al menos UNA columna de nombre (firstName, lastName
   *  o fullName) para poder identificar al contacto. */
  const hasAnyName = mappedFieldIds.has("firstName") ||
    mappedFieldIds.has("lastName") ||
    mappedFieldIds.has("fullName");

  /** Cada SystemField solo se mapea una vez. */
  const duplicates = useMemo(() => {
    const counts = new Map<string, number>();
    Object.values(mapping).forEach((v) => {
      if (v !== IGNORE) counts.set(v, (counts.get(v) ?? 0) + 1);
    });
    return [...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id);
  }, [mapping]);

  const canContinue = file && requiredMissing.length === 0 && duplicates.length === 0 && hasAnyName;

  /* Construye una fila preparada para importar a partir de las columnas
   * mapeadas. Internamente todo se reduce a `fullName` (regla de
   * sistema). Lógica:
   *  - Si "Nombre completo" está mapeado → se usa tal cual.
   *  - Si no, se concatenan firstName + lastName en orden estándar. */
  const buildRow = (row: string[]): Record<string, string> => {
    if (!file) return {};
    const obj: Record<string, string> = {};
    let firstName = "";
    let lastName = "";
    let fullName = "";
    file.headers.forEach((h, i) => {
      const target = mapping[h];
      if (!target || target === IGNORE) return;
      const value = row[i] ?? "";
      if (target === "firstName") firstName = value.trim();
      else if (target === "lastName") lastName = value.trim();
      else if (target === "fullName") fullName = value.trim();
      else obj[target] = value;
    });
    /* Resolución del nombre: fullName tiene precedencia (si el usuario
     * lo mapeó explícitamente, es su elección). Si no, concatenamos. */
    const resolved = fullName || [firstName, lastName].filter(Boolean).join(" ");
    if (resolved) obj.fullName = resolved;
    return obj;
  };

  const previewRows = useMemo(() => {
    if (!file) return [];
    return file.rows.slice(0, 5).map(buildRow);
  }, [file, mapping]);

  const matchedCount = Object.values(mapping).filter((v) => v !== IGNORE).length;

  const doImport = () => {
    if (!file) return;
    const rows: ImportedRow[] = file.rows.map(buildRow);
    const { added, total } = appendImported(rows);
    setImportedCount(added);
    setHistoryVersion((v) => v + 1);
    toast.success(
      added === rows.length
        ? `${added} contactos importados`
        : `${added} contactos nuevos · ${rows.length - added} duplicados omitidos`,
      { description: `Total importados acumulados: ${total}` },
    );
    setStep("done");
  };

  const clearAll = async () => {
    const ok = await confirm({
      title: "¿Borrar todos los contactos importados?",
      description: `Eliminarás ${previousImports.length} contactos importados via CSV/Excel. Los contactos creados manualmente o los del seed se mantienen.`,
      confirmLabel: "Borrar todos",
      variant: "destructive",
    });
    if (!ok) return;
    clearImportedContacts();
    setHistoryVersion((v) => v + 1);
    toast.success("Importados eliminados");
  };

  return (
    <SettingsScreen
      title="Importar contactos"
      description="Sube un CSV o Excel y mapea las columnas a los campos de Byvaro. Los contactos importados aparecen automáticamente en /contactos."
    >
      {/* ══════ Wizard ══════ */}
      <SettingsCard>
        {/* Stepper */}
        <div className="flex items-center gap-2 mb-5">
          {(["upload", "mapping", "review", "done"] as Step[]).map((s, i, arr) => {
            const active = step === s;
            const passed = arr.indexOf(step) > i;
            return (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={cn(
                  "h-7 w-7 rounded-full grid place-items-center text-xs font-semibold shrink-0 transition-colors",
                  passed ? "bg-emerald-500/15 text-emerald-700" :
                  active ? "bg-foreground text-background" :
                  "bg-muted text-muted-foreground",
                )}>
                  {passed ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </div>
                <span className={cn("text-xs font-medium hidden sm:inline",
                  active ? "text-foreground" : "text-muted-foreground")}>
                  {s === "upload" && "Subir"}
                  {s === "mapping" && "Mapear"}
                  {s === "review" && "Revisar"}
                  {s === "done" && "Listo"}
                </span>
                {i < arr.length - 1 && <div className={cn("flex-1 h-px", passed ? "bg-emerald-500/40" : "bg-border")} />}
              </div>
            );
          })}
        </div>

        {/* ══════ STEP 1 — Upload ══════ */}
        {step === "upload" && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors bg-card",
                dragOver ? "border-foreground bg-foreground/5" : "border-border/40 hover:border-foreground/40",
              )}
            >
              <div className="h-14 w-14 mx-auto rounded-2xl bg-muted grid place-items-center mb-3">
                <FileSpreadsheet className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                Arrastra tu archivo aquí, o haz click para buscarlo
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                CSV o Excel (.xlsx, .xls) — exports de Excel, Google Sheets, Mailchimp, HubSpot…
              </p>
              <input
                ref={inputRef} type="file" hidden
                accept=".csv,.tsv,.txt,.xlsx,.xls,.xlsm,.ods,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-xl px-3 py-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex items-center justify-between bg-card border border-border/40 rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-muted grid place-items-center">
                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">¿Necesitas un punto de partida?</p>
                  <p className="text-[10px] text-muted-foreground">Descarga la plantilla CSV con todos los campos soportados</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={downloadTemplate} className="text-xs h-8 rounded-full">
                Descargar plantilla
              </Button>
            </div>
          </div>
        )}

        {/* ══════ STEP 2 — Mapping ══════ */}
        {step === "mapping" && file && (
          <div className="space-y-4">
            {/* Resumen del archivo */}
            <div className="flex items-center justify-between bg-card border border-border/40 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileSpreadsheet className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{file.fileName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {file.rows.length} filas · {file.headers.length} columnas · {matchedCount}/{file.headers.length} mapeadas
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] gap-1 rounded-full border-border/60 bg-muted/50 shrink-0">
                <Sparkles className="h-3 w-3" />
                Auto-detectado
              </Badge>
            </div>

            {/* Encabezados de la tabla de mapeo */}
            <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-3 px-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <span>Columna del archivo</span>
              <span />
              <span>Mapea a</span>
              <span />
            </div>

            <div className="space-y-1.5">
              {file.headers.map((h) => {
                const value = mapping[h] ?? IGNORE;
                const sample = file.rows[0]?.[file.headers.indexOf(h)] ?? "";
                const matched = value !== IGNORE;
                const isDup = matched && duplicates.includes(value);
                return (
                  <div key={h} className={cn(
                    "grid grid-cols-[1fr_auto_1fr_auto] gap-3 items-center bg-card border rounded-xl px-3 py-2.5",
                    isDup ? "border-destructive/40" :
                    matched ? "border-border/40" :
                    "border-dashed border-border/40",
                  )}>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{h}</p>
                      {sample && (
                        <p className="text-[10px] text-muted-foreground truncate">ej. {sample}</p>
                      )}
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                    <Select value={value} onValueChange={(v) => setMapping((m) => ({ ...m, [h]: v }))}>
                      <SelectTrigger className="h-9 rounded-full border-border/60 text-xs bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={IGNORE}>
                          <span className="text-muted-foreground">— No importar —</span>
                        </SelectItem>
                        {SYSTEM_FIELDS.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.label}{f.required && <span className="text-destructive ml-1">*</span>}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="w-5 flex justify-center">
                      {isDup ? <AlertCircle className="h-3.5 w-3.5 text-destructive" /> :
                       matched ? <Check className="h-3.5 w-3.5 text-emerald-600" /> :
                       <X className="h-3.5 w-3.5 text-muted-foreground/40" />}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Vista previa del nombre resultante cuando el usuario
             *  mapea Nombre y/o Apellido por separado. Muestra cómo
             *  quedará en el sistema (siempre como "Nombre completo"). */}
            {file && (mappedFieldIds.has("firstName") || mappedFieldIds.has("lastName") || mappedFieldIds.has("fullName")) && (
              <div className="bg-foreground/5 border border-border/40 rounded-xl px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
                  Vista previa del nombre completo
                </p>
                <p className="text-sm font-semibold text-foreground truncate">
                  {(() => {
                    const sample = buildRow(file.rows[0]);
                    return sample.fullName || <span className="text-muted-foreground italic font-normal">— vacío —</span>;
                  })()}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {mappedFieldIds.has("fullName")
                    ? "Se importará tal cual está en la columna mapeada como 'Nombre completo'."
                    : "Se concatenan automáticamente: Nombre + Apellido."}
                </p>
              </div>
            )}

            {/* Aviso si no hay ninguna columna de nombre mapeada */}
            {file && !hasAnyName && (
              <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-xl px-3 py-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Falta el nombre del contacto</p>
                  <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                    Mapea al menos una columna a <strong>Nombre</strong>, <strong>Apellido</strong> o <strong>Nombre completo</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* Avisos de validación */}
            {requiredMissing.length > 0 && (
              <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-xl px-3 py-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Campos obligatorios sin mapear</p>
                  <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-0.5">
                    Mapea una columna a: {requiredMissing.map((f) => f.label).join(", ")}.
                  </p>
                </div>
              </div>
            )}
            {duplicates.length > 0 && (
              <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-xl px-3 py-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Mapeos duplicados</p>
                  <p className="text-[11px] opacity-80 mt-0.5">Cada campo de Byvaro solo puede mapearse una vez.</p>
                </div>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="ghost" size="sm" onClick={() => setStep("upload")} className="text-xs h-9 rounded-full gap-1">
                <ChevronLeft className="h-3.5 w-3.5" /> Atrás
              </Button>
              <Button size="sm" disabled={!canContinue} onClick={() => setStep("review")} className="text-xs h-9 rounded-full gap-1">
                Continuar <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* ══════ STEP 3 — Review ══════ */}
        {step === "review" && file && (
          <div className="space-y-4">
            <div className="bg-card border border-border/40 rounded-xl p-4">
              <p className="text-xs font-semibold text-foreground mb-3">
                Vista previa · primeras {previewRows.length} de {file.rows.length} filas
              </p>
              <div className="overflow-x-auto -mx-4 px-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/40">
                      {[...mappedFieldIds].map((f) => {
                        const field = SYSTEM_FIELDS.find((x) => x.id === f);
                        return (
                          <th key={f} className="text-left font-semibold text-muted-foreground py-2 pr-4 whitespace-nowrap text-[10px] uppercase tracking-wider">
                            {field?.label ?? f}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className="border-b border-border/20 last:border-0">
                        {[...mappedFieldIds].map((f) => (
                          <td key={f} className="py-2 pr-4 text-foreground whitespace-nowrap max-w-[180px] truncate">
                            {row[f] || <span className="text-muted-foreground/40">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-card border border-border/40 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-foreground">{file.rows.length}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Contactos</p>
              </div>
              <div className="bg-card border border-border/40 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-foreground">{matchedCount}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Campos mapeados</p>
              </div>
              <div className="bg-card border border-border/40 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-foreground">{file.headers.length - matchedCount}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Omitidos</p>
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" size="sm" onClick={() => setStep("mapping")} className="text-xs h-9 rounded-full gap-1">
                <ChevronLeft className="h-3.5 w-3.5" /> Volver al mapeo
              </Button>
              <Button size="sm" onClick={doImport} className="text-xs h-9 rounded-full">
                Importar {file.rows.length} contactos
              </Button>
            </div>
          </div>
        )}

        {/* ══════ STEP 4 — Done ══════ */}
        {step === "done" && (
          <div className="text-center py-8">
            <div className="h-14 w-14 mx-auto rounded-2xl bg-emerald-500/15 grid place-items-center mb-4">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
            <p className="text-base font-semibold text-foreground">{importedCount} contactos importados</p>
            <p className="text-xs text-muted-foreground mt-1">
              Ya están disponibles en <a href="/contactos" className="text-foreground underline underline-offset-2">/contactos</a>.
            </p>
            <Button onClick={reset} variant="outline" size="sm" className="rounded-full mt-5">
              <Upload className="h-3.5 w-3.5" /> Importar otro archivo
            </Button>
          </div>
        )}
      </SettingsCard>

      {/* ══════ Importaciones previas ══════ */}
      {previousImports.length > 0 && (
        <SettingsCard
          title="Importaciones previas"
          description={`${previousImports.length} contactos provienen de imports CSV/Excel.`}
          actions={
            <Button onClick={clearAll} variant="outline" size="sm" className="rounded-full text-destructive hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" /> Borrar todos
            </Button>
          }
        >
          <div className="text-xs text-muted-foreground space-y-1">
            <p>Estos contactos aparecen marcados con origen <strong>import</strong> en el listado y se mezclan con los del seed mientras no haya backend.</p>
            <p>Si necesitas re-importar el mismo archivo, primero bórralos para evitar duplicados.</p>
          </div>
        </SettingsCard>
      )}
    </SettingsScreen>
  );
}
