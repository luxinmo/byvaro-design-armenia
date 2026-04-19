/**
 * /empresa/oficinas · gestión de oficinas de la empresa.
 *
 * Reglas de negocio:
 *   - Siempre exactamente UNA oficina principal.
 *   - Si la lista está vacía, la primera creada pasa a principal.
 *   - Marcar una nueva como principal desmarca la anterior.
 *   - Al borrar la principal, la primera restante pasa a principal.
 *
 * UX:
 *   - Lista con tarjetas. Cada tarjeta muestra nombre + chip "Principal" + datos clave.
 *   - Botón "Añadir oficina" abre un modal/card en línea con 6 campos.
 *   - Edición inline con el mismo formulario.
 *   - Confirm antes de borrar.
 *   - Empty state entrenando al usuario (por qué importa, qué datos necesita).
 */

import { useState } from "react";
import {
  MapPin, Plus, Star, StarOff, Pencil, Trash2, Phone, Mail,
  MessageCircle, Clock, Check, X, Building2,
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { useOficinas, type Oficina } from "@/lib/empresa";
import { cn } from "@/lib/utils";

/* ─── Helpers UI ──────────────────────────────────────────────────── */
const inputClass = "h-10 w-full px-3 text-[13.5px] bg-card border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/60";

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11.5px] font-medium text-foreground flex items-center gap-1">
        {label}
        {required && <span className="text-primary">*</span>}
      </span>
      {children}
    </label>
  );
}

/* ─── Formulario inline (crear / editar) ──────────────────────────── */
interface OfficinaFormData {
  nombre: string;
  direccion: string;
  telefono: string;
  email: string;
  whatsapp: string;
  horario: string;
  esPrincipal: boolean;
  activa: boolean;
}

const emptyForm: OfficinaFormData = {
  nombre: "",
  direccion: "",
  telefono: "",
  email: "",
  whatsapp: "",
  horario: "L-V 9:00-18:00",
  esPrincipal: false,
  activa: true,
};

function OficinaForm({
  initial, onSubmit, onCancel, isFirst, isEditingPrincipal,
}: {
  initial?: Partial<OfficinaFormData>;
  onSubmit: (data: OfficinaFormData) => void;
  onCancel: () => void;
  isFirst?: boolean;
  isEditingPrincipal?: boolean;
}) {
  const [form, setForm] = useState<OfficinaFormData>({ ...emptyForm, ...initial });
  const valid = form.nombre.trim().length > 0;

  const submit = () => {
    if (!valid) {
      toast.error("El nombre de la oficina es obligatorio");
      return;
    }
    onSubmit(form);
  };

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/[0.03] p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Building2 className="h-4 w-4" />
        </div>
        <h3 className="text-[14px] font-bold tracking-tight">
          {initial ? "Editar oficina" : "Nueva oficina"}
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nombre" required>
          <input
            autoFocus
            type="text"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            placeholder="Ej. Oficina Marbella"
            className={inputClass}
          />
        </Field>
        <Field label="Dirección">
          <input
            type="text"
            value={form.direccion}
            onChange={(e) => setForm({ ...form, direccion: e.target.value })}
            placeholder="Av. Ricardo Soriano, 45, Marbella"
            className={inputClass}
          />
        </Field>
        <Field label="Teléfono">
          <input
            type="tel"
            value={form.telefono}
            onChange={(e) => setForm({ ...form, telefono: e.target.value })}
            placeholder="+34 600 000 000"
            className={inputClass}
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="marbella@tuempresa.com"
            className={inputClass}
          />
        </Field>
        <Field label="WhatsApp">
          <input
            type="tel"
            value={form.whatsapp}
            onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
            placeholder="+34 600 000 000"
            className={inputClass}
          />
        </Field>
        <Field label="Horario de atención">
          <input
            type="text"
            value={form.horario}
            onChange={(e) => setForm({ ...form, horario: e.target.value })}
            placeholder="L-V 9:00-18:00"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1">
        {/* Si es la primera oficina, se marca principal automáticamente y no se puede cambiar */}
        <label className={cn(
          "flex items-center gap-2 cursor-pointer",
          (isFirst || isEditingPrincipal) && "cursor-not-allowed opacity-70"
        )}>
          <input
            type="checkbox"
            checked={form.esPrincipal || isFirst}
            disabled={isFirst || isEditingPrincipal}
            onChange={(e) => setForm({ ...form, esPrincipal: e.target.checked })}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          <span className="text-[12.5px] text-foreground">
            Oficina principal
            {isFirst && <span className="text-muted-foreground ml-1">(obligatoria para la primera oficina)</span>}
            {isEditingPrincipal && <span className="text-muted-foreground ml-1">(marca otra como principal para cambiar)</span>}
          </span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.activa}
            onChange={(e) => setForm({ ...form, activa: e.target.checked })}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          <span className="text-[12.5px] text-foreground">Activa</span>
        </label>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-primary/15">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-border text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="h-3.5 w-3.5" /> Cancelar
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!valid}
          className="inline-flex items-center gap-1.5 h-9 px-5 rounded-full bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary/90 transition-colors shadow-soft disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Check className="h-3.5 w-3.5" /> {initial ? "Guardar cambios" : "Crear oficina"}
        </button>
      </div>
    </div>
  );
}

/* ─── Card de oficina ─────────────────────────────────────────────── */
function OficinaCard({
  oficina, onEdit, onDelete, onSetPrincipal,
}: {
  oficina: Oficina;
  onEdit: () => void;
  onDelete: () => void;
  onSetPrincipal: () => void;
}) {
  return (
    <div className={cn(
      "rounded-2xl border bg-card p-5 flex flex-col gap-3 transition-shadow hover:shadow-soft-lg",
      oficina.esPrincipal ? "border-primary/40 shadow-soft" : "border-border",
      !oficina.activa && "opacity-70",
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          "flex h-10 w-10 items-center justify-center rounded-xl shrink-0",
          oficina.esPrincipal ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}>
          <Building2 className="h-4.5 w-4.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-[14.5px] font-bold tracking-tight truncate">{oficina.nombre}</h3>
            {oficina.esPrincipal && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold rounded-full bg-primary/10 text-primary px-2 py-0.5">
                <Star className="h-2.5 w-2.5" strokeWidth={3} /> Principal
              </span>
            )}
            {!oficina.activa && (
              <span className="text-[10px] font-semibold rounded-full bg-muted text-muted-foreground px-2 py-0.5">Inactiva</span>
            )}
          </div>
          {oficina.direccion && (
            <p className="text-[12px] text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{oficina.direccion}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!oficina.esPrincipal && (
            <button
              type="button"
              onClick={onSetPrincipal}
              className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
              aria-label="Marcar como principal"
              title="Marcar como principal"
            >
              <Star className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Editar"
            title="Editar"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-2 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            aria-label="Eliminar"
            title="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-4 text-[12px] text-muted-foreground pt-2 border-t border-border">
        {oficina.telefono && (
          <div className="flex items-center gap-1.5 min-w-0">
            <Phone className="h-3 w-3 shrink-0" />
            <span className="truncate">{oficina.telefono}</span>
          </div>
        )}
        {oficina.email && (
          <div className="flex items-center gap-1.5 min-w-0">
            <Mail className="h-3 w-3 shrink-0" />
            <span className="truncate">{oficina.email}</span>
          </div>
        )}
        {oficina.whatsapp && (
          <div className="flex items-center gap-1.5 min-w-0">
            <MessageCircle className="h-3 w-3 shrink-0" />
            <span className="truncate">{oficina.whatsapp}</span>
          </div>
        )}
        {oficina.horario && (
          <div className="flex items-center gap-1.5 min-w-0">
            <Clock className="h-3 w-3 shrink-0" />
            <span className="truncate">{oficina.horario}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Página
   ═══════════════════════════════════════════════════════════════════ */
export default function EmpresaOficinas() {
  const { oficinas, addOficina, updateOficina, deleteOficina, setPrincipal } = useOficinas();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const editingOficina = oficinas.find(o => o.id === editingId);

  const handleAdd = (data: OfficinaFormData) => {
    const nueva = addOficina(data);
    setIsAdding(false);
    toast.success("Oficina creada", { description: `"${nueva.nombre}" añadida a tu empresa.` });
  };

  const handleUpdate = (data: OfficinaFormData) => {
    if (!editingId) return;
    updateOficina(editingId, data);
    setEditingId(null);
    toast.success("Oficina actualizada");
  };

  const handleDelete = (id: string) => {
    const ofi = oficinas.find(o => o.id === id);
    deleteOficina(id);
    setConfirmDelete(null);
    toast.success(`"${ofi?.nombre ?? "Oficina"}" eliminada`);
  };

  const handleSetPrincipal = (id: string) => {
    setPrincipal(id);
    toast.success("Nueva oficina principal establecida");
  };

  return (
    <div className="flex flex-col gap-5">
      <Toaster position="top-center" richColors />

      {/* ═════ Subcabecera ═════ */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-[17px] font-bold tracking-tight">Oficinas</h2>
          <p className="text-[12px] text-muted-foreground mt-0.5 max-w-xl">
            Los puntos de venta físicos de tu empresa. Se usan en tus microsites, en el footer de emails y al crear una promoción.
          </p>
        </div>
        {!isAdding && !editingId && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary/90 transition-colors shadow-soft shrink-0"
          >
            <Plus className="h-4 w-4" />
            Añadir oficina
          </button>
        )}
      </div>

      {/* ═════ Formulario crear ═════ */}
      {isAdding && (
        <OficinaForm
          onSubmit={handleAdd}
          onCancel={() => setIsAdding(false)}
          isFirst={oficinas.length === 0}
        />
      )}

      {/* ═════ Empty state ═════ */}
      {oficinas.length === 0 && !isAdding && (
        <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <MapPin className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-[16px] font-bold tracking-tight">Todavía no hay oficinas</h2>
            <p className="text-[13px] text-muted-foreground mt-1 max-w-md mx-auto leading-relaxed">
              Añade tu primera oficina. La primera será marcada como principal y aparecerá por defecto en los contratos y microsites.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="mt-1 inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary/90 transition-colors shadow-soft"
          >
            <Plus className="h-4 w-4" />
            Añadir la primera oficina
          </button>
        </div>
      )}

      {/* ═════ Lista ═════ */}
      {oficinas.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Oficinas ordenadas: principal primero, luego por createdAt */}
          {[...oficinas]
            .sort((a, b) => {
              if (a.esPrincipal !== b.esPrincipal) return a.esPrincipal ? -1 : 1;
              return a.createdAt - b.createdAt;
            })
            .map((o) => (
              editingId === o.id ? (
                <div key={o.id} className="lg:col-span-2">
                  <OficinaForm
                    initial={o}
                    onSubmit={handleUpdate}
                    onCancel={() => setEditingId(null)}
                    isEditingPrincipal={o.esPrincipal}
                  />
                </div>
              ) : (
                <OficinaCard
                  key={o.id}
                  oficina={o}
                  onEdit={() => setEditingId(o.id)}
                  onDelete={() => setConfirmDelete(o.id)}
                  onSetPrincipal={() => handleSetPrincipal(o.id)}
                />
              )
            ))}
        </div>
      )}

      {/* ═════ Confirmación de borrado ═════ */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setConfirmDelete(null)}>
          <div
            className="bg-card rounded-2xl border border-border p-6 shadow-lg max-w-md w-full flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <Trash2 className="h-4.5 w-4.5" />
              </div>
              <div>
                <h3 className="text-[15px] font-bold tracking-tight">¿Eliminar esta oficina?</h3>
                <p className="text-[12.5px] text-muted-foreground mt-0.5">
                  Se eliminará de todos los sitios donde aparece. Las promociones que la tuvieran seleccionada se quedarán sin punto de venta.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="h-9 px-4 rounded-full border border-border text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmDelete)}
                className="h-9 px-5 rounded-full bg-destructive text-destructive-foreground text-[13px] font-semibold hover:bg-destructive/90 transition-colors shadow-soft"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
