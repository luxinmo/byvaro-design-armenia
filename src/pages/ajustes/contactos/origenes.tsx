/**
 * /ajustes/contactos/origenes — Gestión de orígenes de contactos.
 *
 * Solo admins CRUD. Las sources que se añadan aquí aparecen
 * automáticamente en el filtro "Source" del listado de Contactos
 * para todos los miembros.
 */

import { useState } from "react";
import { Plus, Trash2, Pencil, Check, X, Lock, ArrowRight, AlertTriangle } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { loadSources, saveSources, nextSourceId } from "@/components/contacts/sourcesStorage";
import type { ContactSource } from "@/components/contacts/sources";
import type { ContactSourceType } from "@/components/contacts/types";
import { useCurrentUser, isAdmin } from "@/lib/currentUser";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { MOCK_CONTACTS } from "@/components/contacts/data";
import { cn } from "@/lib/utils";

const SOURCE_TYPE_LABELS: Record<ContactSourceType, string> = {
  registration: "Registro",
  portal: "Portal inmobiliario",
  direct: "Directo",
  import: "Importación",
};

export default function AjustesContactosOrigenes() {
  const currentUser = useCurrentUser();
  const canEdit = isAdmin(currentUser);

  const [sources, setSourcesState] = useState<ContactSource[]>(() => loadSources());
  const setSources = (next: ContactSource[]) => {
    setSourcesState(next);
    saveSources(next);
  };

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  /** Source que el usuario quiere eliminar (abre el diálogo si tiene
   * contactos asignados; si está vacío, borra directo). */
  const [deletingSource, setDeletingSource] = useState<ContactSource | null>(null);

  /** Cuántos contactos vienen de cada source (mock — backend hará COUNT). */
  const usageCount = (sourceLabel: string) =>
    MOCK_CONTACTS.filter((c) => c.source === sourceLabel).length;

  const submitCreate = () => {
    const clean = newName.trim();
    if (!clean) {
      setCreating(false);
      setNewName("");
      return;
    }
    if (sources.some((s) => s.label.toLowerCase() === clean.toLowerCase())) {
      toast.error("Ya existe un origen con ese nombre");
      return;
    }
    const id = nextSourceId(sources);
    setSources([...sources, { id, label: clean, type: "direct" }]);
    toast.success(`Origen "${clean}" creado`);
    setNewName("");
    setCreating(false);
  };

  const submitRename = (id: string) => {
    const clean = editName.trim();
    if (!clean) {
      setEditingId(null);
      return;
    }
    setSources(sources.map((s) => (s.id === id ? { ...s, label: clean } : s)));
    toast.success("Origen renombrado");
    setEditingId(null);
  };

  /** Click en eliminar: si la source no tiene contactos, borra
   * directamente. Si tiene → abre el diálogo de migración. */
  const handleDeleteRequest = (id: string) => {
    const src = sources.find((s) => s.id === id);
    if (!src) return;
    if (usageCount(src.label) === 0) {
      setSources(sources.filter((s) => s.id !== id));
      toast.success(`Origen "${src.label}" eliminado`);
    } else {
      setDeletingSource(src);
    }
  };

  /** Confirma la eliminación tras elegir destino para los contactos. */
  const confirmDelete = (action: { type: "migrate"; toId: string } | { type: "leave-undefined" }) => {
    if (!deletingSource) return;
    const count = usageCount(deletingSource.label);
    setSources(sources.filter((s) => s.id !== deletingSource.id));
    if (action.type === "migrate") {
      const target = sources.find((s) => s.id === action.toId);
      // TODO(backend): UPDATE contacts SET source = target.label WHERE source = deletingSource.label
      toast.success(
        `Origen "${deletingSource.label}" eliminado · ${count} ${count === 1 ? "contacto trasladado" : "contactos trasladados"} a "${target?.label ?? "—"}"`,
      );
    } else {
      // TODO(backend): UPDATE contacts SET source = NULL WHERE source = deletingSource.label
      toast.success(
        `Origen "${deletingSource.label}" eliminado · ${count} ${count === 1 ? "contacto" : "contactos"} sin definir`,
      );
    }
    setDeletingSource(null);
  };

  const changeType = (id: string, type: ContactSourceType) => {
    setSources(sources.map((s) => (s.id === id ? { ...s, type } : s)));
  };

  return (
    <SettingsScreen
      title="Orígenes"
      description="Define los canales por los que entran los contactos a tu CRM (portales, formulario web, referidos, agencias, etc.). Lo que añadas aquí aparece automáticamente en el filtro de Contactos."
    >
      <SettingsCard
        title="Orígenes activos"
        description={
          canEdit
            ? "Añade un origen y úsalo al crear o importar contactos."
            : "Solo los administradores pueden gestionar los orígenes."
        }
        footer={
          canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setCreating(true);
                setNewName("");
              }}
              className="rounded-full"
            >
              <Plus className="h-4 w-4" />
              Nuevo origen
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" />
              Solo lectura
            </span>
          )
        }
      >
        <div className="divide-y divide-border -my-3">
          {creating && canEdit && (
            <div className="py-3 flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-primary shrink-0" />
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitCreate();
                  if (e.key === "Escape") {
                    setCreating(false);
                    setNewName("");
                  }
                }}
                onBlur={submitCreate}
                placeholder="Nombre del origen…"
                className="flex-1 bg-transparent outline-none text-sm"
              />
              <button
                onClick={submitCreate}
                className="h-7 w-7 rounded-full hover:bg-muted flex items-center justify-center text-emerald-600"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setCreating(false);
                  setNewName("");
                }}
                className="h-7 w-7 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {sources.length === 0 && !creating && (
            <p className="py-8 text-sm text-muted-foreground text-center italic">
              Aún no hay orígenes
            </p>
          )}

          {sources.map((s) => (
            <div key={s.id} className="group py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                {editingId === s.id && canEdit ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitRename(s.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onBlur={() => submitRename(s.id)}
                    className="w-full bg-transparent outline-none text-sm border-b border-border focus:border-primary py-0.5"
                  />
                ) : (
                  <p className="text-sm text-foreground truncate">{s.label}</p>
                )}
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {usageCount(s.label)}{" "}
                  {usageCount(s.label) === 1 ? "contacto" : "contactos"}
                </p>
              </div>

              {/* Type selector */}
              {canEdit ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-muted text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">
                      {s.type ? SOURCE_TYPE_LABELS[s.type] : "Sin tipo"}
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    className="w-44 p-1 rounded-xl border-border shadow-soft-lg"
                  >
                    {(Object.keys(SOURCE_TYPE_LABELS) as ContactSourceType[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => changeType(s.id, t)}
                        className={cn(
                          "w-full text-left px-3 py-1.5 rounded-md text-sm hover:bg-muted",
                          s.type === t && "font-medium text-foreground",
                        )}
                      >
                        {SOURCE_TYPE_LABELS[t]}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              ) : (
                s.type && (
                  <span className="text-[11px] text-muted-foreground bg-muted rounded-full px-2.5 py-1">
                    {SOURCE_TYPE_LABELS[s.type]}
                  </span>
                )
              )}

              {canEdit && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => {
                      setEditingId(s.id);
                      setEditName(s.label);
                    }}
                    title="Renombrar"
                    className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteRequest(s.id)}
                    title="Eliminar"
                    className="h-8 w-8 rounded-full hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </SettingsCard>

      {deletingSource && (
        <DeleteSourceDialog
          source={deletingSource}
          otherSources={sources.filter((s) => s.id !== deletingSource.id)}
          contactCount={usageCount(deletingSource.label)}
          onCancel={() => setDeletingSource(null)}
          onConfirm={confirmDelete}
        />
      )}
    </SettingsScreen>
  );
}

/**
 * Diálogo de eliminación de origen con contactos asignados.
 * El admin elige entre trasladar los contactos a otro origen o
 * dejarlos como "Sin definir".
 */
function DeleteSourceDialog({
  source,
  otherSources,
  contactCount,
  onCancel,
  onConfirm,
}: {
  source: ContactSource;
  otherSources: ContactSource[];
  contactCount: number;
  onCancel: () => void;
  onConfirm: (
    action: { type: "migrate"; toId: string } | { type: "leave-undefined" },
  ) => void;
}) {
  const [action, setAction] = useState<"migrate" | "leave-undefined">(
    otherSources.length > 0 ? "migrate" : "leave-undefined",
  );
  const [migrateTo, setMigrateTo] = useState<string>(otherSources[0]?.id ?? "");

  const canConfirm =
    action === "leave-undefined" || (action === "migrate" && Boolean(migrateTo));

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="h-10 w-10 rounded-xl bg-amber-100 grid place-items-center mb-3">
            <AlertTriangle className="h-5 w-5 text-amber-700" strokeWidth={1.75} />
          </div>
          <DialogTitle>Eliminar origen "{source.label}"</DialogTitle>
          <DialogDescription className="leading-relaxed">
            Hay <strong>{contactCount}</strong>{" "}
            {contactCount === 1 ? "contacto asignado" : "contactos asignados"} a este
            origen. Elige qué hacer con{" "}
            {contactCount === 1 ? "él" : "ellos"} antes de eliminar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {/* Migrate option */}
          {otherSources.length > 0 && (
            <label
              className={cn(
                "block rounded-xl border p-3 cursor-pointer transition-colors",
                action === "migrate"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-foreground/20",
              )}
            >
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="delete-action"
                  checked={action === "migrate"}
                  onChange={() => setAction("migrate")}
                  className="mt-1 h-3.5 w-3.5 accent-primary"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    Trasladar a otro origen
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                    Los contactos cambiarán a la nueva fuente.
                  </p>
                  {action === "migrate" && (
                    <select
                      value={migrateTo}
                      onChange={(e) => setMigrateTo(e.target.value)}
                      className="w-full h-9 px-3 rounded-full border border-border bg-card text-sm text-foreground outline-none focus:border-primary"
                    >
                      {otherSources.map((s) => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </label>
          )}

          {/* Leave undefined option */}
          <label
            className={cn(
              "block rounded-xl border p-3 cursor-pointer transition-colors",
              action === "leave-undefined"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-foreground/20",
            )}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="delete-action"
                checked={action === "leave-undefined"}
                onChange={() => setAction("leave-undefined")}
                className="mt-1 h-3.5 w-3.5 accent-primary"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  Dejar sin definir
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Los contactos se quedarán sin origen asignado. Podrás
                  asignarles uno desde su ficha.
                </p>
              </div>
            </div>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onCancel} className="rounded-full">
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() =>
              onConfirm(
                action === "migrate"
                  ? { type: "migrate", toId: migrateTo }
                  : { type: "leave-undefined" },
              )
            }
            disabled={!canConfirm}
            className="rounded-full"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar origen
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

