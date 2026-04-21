/**
 * SignatureManagerDialog · CRUD de firmas de email.
 *
 * Estructura del diálogo:
 *   - Sidebar (220px): lista de firmas + botón "Nueva firma".
 *     La firma por defecto aparece con badge "Default".
 *   - Panel derecho: editor visual (contentEditable con toolbar) o HTML.
 *
 * Las firmas se persisten en localStorage y se notifica al padre
 * (GmailInterface) vía `onSignaturesChange` para que actualice su
 * lista activa. Al cambiar el defecto, también se persiste el
 * `defaultId` global.
 */

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Check, Bold, Italic, Underline, Link2, Code, Eraser } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  EmailSignature,
  loadSignatures,
  saveSignatures,
  getDefaultSignatureId,
  setDefaultSignatureId,
} from "./signatures";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignaturesChange?: (sigs: EmailSignature[]) => void;
}

export default function SignatureManagerDialog({ open, onOpenChange, onSignaturesChange }: Props) {
  const [signatures, setSignatures] = useState<EmailSignature[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [html, setHtml] = useState("");
  const [showHtml, setShowHtml] = useState(false);
  const [defaultId, setDefId] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const list = loadSignatures();
    setSignatures(list);
    const def = getDefaultSignatureId() ?? list.find((s) => s.isDefault)?.id ?? list[0]?.id ?? null;
    setDefId(def);
    const first = list[0] ?? null;
    if (first) selectSig(first);
    else clearForm();
  }, [open]);

  const selectSig = (s: EmailSignature) => {
    setActiveId(s.id);
    setName(s.name);
    setHtml(s.html);
    if (editorRef.current) editorRef.current.innerHTML = s.html;
  };

  const clearForm = () => {
    setActiveId(null);
    setName("");
    setHtml("");
    if (editorRef.current) editorRef.current.innerHTML = "";
  };

  const persist = (next: EmailSignature[]) => {
    setSignatures(next);
    saveSignatures(next);
    onSignaturesChange?.(next);
  };

  const handleNew = () => {
    const id = `sig-${Date.now()}`;
    const fresh: EmailSignature = { id, name: "Nueva firma", html: "<p>Escribe tu firma aquí…</p>" };
    const next = [...signatures, fresh];
    persist(next);
    selectSig(fresh);
  };

  const handleSave = () => {
    if (!activeId) {
      handleNew();
      return;
    }
    const next = signatures.map((s) =>
      s.id === activeId ? { ...s, name: name.trim() || "Sin nombre", html } : s,
    );
    persist(next);
    toast.success("Firma guardada");
  };

  const handleDelete = (id: string) => {
    const next = signatures.filter((s) => s.id !== id);
    persist(next);
    if (defaultId === id) {
      setDefId(null);
      setDefaultSignatureId(null);
    }
    if (activeId === id) {
      const fallback = next[0] ?? null;
      if (fallback) selectSig(fallback);
      else clearForm();
    }
    toast.success("Firma eliminada");
  };

  const handleSetDefault = (id: string) => {
    setDefId(id);
    setDefaultSignatureId(id);
    const next = signatures.map((s) => ({ ...s, isDefault: s.id === id }));
    persist(next);
    toast.success("Firma por defecto actualizada");
  };

  const exec = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    if (editorRef.current) setHtml(editorRef.current.innerHTML);
    editorRef.current?.focus();
  };

  const onEditorInput = () => {
    if (editorRef.current) setHtml(editorRef.current.innerHTML);
  };

  const insertLink = () => {
    const url = window.prompt("Introduce la URL");
    if (url) exec("createLink", url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-muted p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-border bg-card">
          <DialogTitle className="text-base font-semibold">Firmas de email</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Crea firmas HTML y marca una como predeterminada. Se añadirán automáticamente al redactar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr] min-h-[460px]">
          {/* List */}
          <aside className="border-r border-border bg-card/60 p-3 flex flex-col gap-2 overflow-y-auto">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full justify-start"
              onClick={handleNew}
            >
              <Plus className="h-4 w-4" /> Nueva firma
            </Button>
            <div className="flex flex-col gap-1 mt-1">
              {signatures.map((s) => (
                <button
                  key={s.id}
                  onClick={() => selectSig(s)}
                  className={cn(
                    "flex items-center gap-2 px-3 h-9 rounded-xl text-left text-sm transition-colors",
                    activeId === s.id ? "bg-primary/10 text-foreground" : "hover:bg-muted/60 text-foreground/80",
                  )}
                >
                  <span className="flex-1 truncate">{s.name}</span>
                  {defaultId === s.id && (
                    <span className="text-[10px] uppercase tracking-wide text-emerald-600 font-semibold">Default</span>
                  )}
                </button>
              ))}
              {signatures.length === 0 && (
                <p className="text-xs text-muted-foreground px-3 py-2">Aún no hay firmas</p>
              )}
            </div>
          </aside>

          {/* Editor */}
          <section className="p-5 bg-card flex flex-col gap-4">
            {activeId ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="sig-name" className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Nombre
                  </Label>
                  <Input
                    id="sig-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-9 rounded-full"
                    placeholder="Ej. Comercial · Español"
                  />
                </div>

                <div className="space-y-1.5 flex-1 flex flex-col">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Firma
                    </Label>
                    <button
                      type="button"
                      onClick={() => setShowHtml((v) => !v)}
                      className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                    >
                      <Code className="h-3.5 w-3.5" />
                      {showHtml ? "Visual" : "HTML"}
                    </button>
                  </div>

                  {!showHtml && (
                    <div className="flex items-center gap-1 px-2 h-9 rounded-t-xl border border-border border-b-0 bg-muted/30">
                      <button type="button" onClick={() => exec("bold")} className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center" title="Negrita">
                        <Bold className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => exec("italic")} className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center" title="Cursiva">
                        <Italic className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => exec("underline")} className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center" title="Subrayado">
                        <Underline className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={insertLink} className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center" title="Insertar enlace">
                        <Link2 className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => exec("removeFormat")} className="h-7 w-7 rounded-md hover:bg-muted flex items-center justify-center" title="Limpiar formato">
                        <Eraser className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}

                  {showHtml ? (
                    <textarea
                      value={html}
                      onChange={(e) => setHtml(e.target.value)}
                      onBlur={() => editorRef.current && (editorRef.current.innerHTML = html)}
                      className="flex-1 min-h-[200px] rounded-xl border border-border bg-card p-3 text-xs font-mono outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  ) : (
                    <div
                      ref={editorRef}
                      contentEditable
                      suppressContentEditableWarning
                      onInput={onEditorInput}
                      className="flex-1 min-h-[200px] rounded-b-xl border border-border bg-card p-4 text-sm outline-none focus:ring-2 focus:ring-primary/30 prose prose-sm max-w-none"
                    />
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => activeId && handleSetDefault(activeId)}
                      className="rounded-full text-xs"
                      disabled={defaultId === activeId}
                    >
                      <Check className="h-4 w-4" />
                      {defaultId === activeId ? "Por defecto" : "Marcar por defecto"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => activeId && handleDelete(activeId)}
                      className="rounded-full text-xs text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="rounded-full">
                      Cerrar
                    </Button>
                    <Button type="button" size="sm" onClick={handleSave} className="rounded-full">
                      Guardar
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
                <p className="text-sm text-muted-foreground">Ninguna firma seleccionada</p>
                <Button onClick={handleNew} size="sm" className="rounded-full">
                  <Plus className="h-4 w-4" /> Crear firma
                </Button>
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
