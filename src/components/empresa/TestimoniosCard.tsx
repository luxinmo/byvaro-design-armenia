/**
 * TestimoniosCard · reviews de agencias con las que el promotor ha
 * colaborado. Prueba social pura. Es una de las secciones más
 * valoradas por agencias nuevas que están decidiendo si colaborar.
 */

import { useState } from "react";
import { Star, Quote, Plus, Trash2 } from "lucide-react";
import type { Empresa } from "@/lib/empresa";
import { EditableSection } from "./EditableSection";
import { cn } from "@/lib/utils";

type Testimonio = Empresa["testimonios"][number];

const inputClass = "h-9 w-full px-3 text-[13px] bg-card border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/60";
const textareaClass = cn(inputClass, "h-auto py-2 resize-y min-h-[80px]");

function StarRating({ value, onChange, readonly = false }: { value: number; onChange?: (v: number) => void; readonly?: boolean }) {
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(n)}
          className={cn(
            "transition-colors",
            readonly ? "cursor-default" : "cursor-pointer hover:scale-110",
          )}
          aria-label={`${n} estrella${n > 1 ? "s" : ""}`}
        >
          <Star
            className={cn("h-3.5 w-3.5", n <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")}
            strokeWidth={2}
          />
        </button>
      ))}
    </div>
  );
}

function TestimonioCard({ t }: { t: Testimonio }) {
  const initial = t.autor?.[0]?.toUpperCase() ?? "?";
  return (
    <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-3 h-full">
      <div className="flex items-start justify-between gap-3">
        <Quote className="h-5 w-5 text-primary/40 shrink-0" />
        <StarRating value={t.rating} readonly />
      </div>
      <p className="text-[13px] text-foreground leading-relaxed flex-1 italic">
        "{t.texto}"
      </p>
      <div className="flex items-center gap-2.5 pt-2 border-t border-border">
        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary grid place-items-center font-bold text-[13px] shrink-0">
          {initial}
        </div>
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold text-foreground truncate">{t.autor || "—"}</p>
          <p className="text-[11px] text-muted-foreground truncate">{t.empresa || "—"}</p>
        </div>
      </div>
    </div>
  );
}

function TestimonioEditRow({
  t, onChange, onDelete,
}: {
  t: Testimonio; onChange: (t: Testimonio) => void; onDelete: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/10 p-3 flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <StarRating value={t.rating} onChange={(v) => onChange({ ...t, rating: v })} />
        <button type="button" onClick={onDelete} className="text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <textarea
        value={t.texto}
        onChange={(e) => onChange({ ...t, texto: e.target.value })}
        placeholder="Texto del testimonio…"
        className={textareaClass}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          value={t.autor}
          onChange={(e) => onChange({ ...t, autor: e.target.value })}
          placeholder="Nombre del autor"
          className={inputClass}
        />
        <input
          value={t.empresa}
          onChange={(e) => onChange({ ...t, empresa: e.target.value })}
          placeholder="Nombre de la agencia / empresa"
          className={inputClass}
        />
      </div>
    </div>
  );
}

export function TestimoniosCard({
  viewMode, empresa, update,
}: {
  viewMode: "edit" | "preview";
  empresa: Empresa;
  update: <K extends keyof Empresa>(key: K, value: Empresa[K]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Testimonio[]>(empresa.testimonios);

  const start = () => { setDraft(empresa.testimonios.map(t => ({ ...t }))); setEditing(true); };
  const save = () => { update("testimonios", draft); setEditing(false); };
  const cancel = () => { setEditing(false); };
  const add = () => setDraft(prev => [...prev, { autor: "", empresa: "", texto: "", rating: 5 }]);
  const updateItem = (i: number, t: Testimonio) => setDraft(prev => prev.map((x, idx) => idx === i ? t : x));
  const removeItem = (i: number) => setDraft(prev => prev.filter((_, idx) => idx !== i));

  return (
    <EditableSection
      title="Lo que dicen de nosotros"
      viewMode={viewMode}
      editContent={
        <div className="flex flex-col gap-3">
          {draft.map((t, i) => (
            <TestimonioEditRow key={i} t={t} onChange={(next) => updateItem(i, next)} onDelete={() => removeItem(i)} />
          ))}
          <button
            type="button"
            onClick={add}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border text-[12px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Añadir testimonio
          </button>
        </div>
      }
      onSave={save}
      onCancel={cancel}
      rightSlot={viewMode === "edit" && !editing ? (
        <button type="button" onClick={start} className="text-[11px] text-primary hover:underline font-medium">
          Gestionar
        </button>
      ) : undefined}
    >
      {empresa.testimonios.length === 0 ? (
        <div className="py-6 text-center flex flex-col items-center gap-2">
          <Quote className="h-6 w-6 text-muted-foreground/30" />
          <p className="text-[12px] text-muted-foreground max-w-sm">
            Todavía no hay testimonios. Cuando hayas cerrado operaciones con agencias, pídeles un testimonio y añádelo aquí.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {empresa.testimonios.slice(0, 6).map((t, i) => (
            <TestimonioCard key={i} t={t} />
          ))}
        </div>
      )}
    </EditableSection>
  );
}
