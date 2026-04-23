/**
 * /ajustes/contactos/etiquetas — Gestión de etiquetas de la organización.
 *
 * Solo admins pueden crear/editar/borrar. Las etiquetas creadas aquí
 * aparecen automáticamente en el filtro de Contactos para todos los
 * miembros (vienen del mismo storage `byvaro.contactTags.organization.v1`).
 *
 * Las etiquetas personales del usuario se gestionan desde el drawer
 * de filtros de Contactos (no aquí — son del usuario, no de la org).
 */

import { useState } from "react";
import { Plus, Trash2, Pencil, Check, X, Lock } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { Button } from "@/components/ui/button";
import {
  loadOrgTags,
  saveOrgTags,
  TAG_COLOR_PALETTE,
  nextTagId,
} from "@/components/contacts/tagsStorage";
import type { ContactTag } from "@/components/contacts/types";
import { useCurrentUser, isAdmin } from "@/lib/currentUser";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { MOCK_CONTACTS } from "@/components/contacts/data";

export default function AjustesContactosEtiquetas() {
  const currentUser = useCurrentUser();
  const canEdit = isAdmin(currentUser);

  const [tags, setTagsState] = useState<ContactTag[]>(() => loadOrgTags());
  const setTags = (next: ContactTag[]) => {
    setTagsState(next);
    saveOrgTags(next);
  };

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  /** Cuántos contactos usan cada tag (cálculo derivado de los mocks
   * — en producción vendrá del backend con un join COUNT). */
  const usageCount = (tagId: string) =>
    MOCK_CONTACTS.filter((c) => c.tags.includes(tagId)).length;

  const submitCreate = () => {
    const clean = newName.trim();
    if (!clean) {
      setCreating(false);
      setNewName("");
      return;
    }
    if (tags.some((t) => t.label.toLowerCase() === clean.toLowerCase())) {
      toast.error("Ya existe una etiqueta con ese nombre");
      return;
    }
    const id = nextTagId(tags);
    const color = TAG_COLOR_PALETTE[tags.length % TAG_COLOR_PALETTE.length];
    setTags([
      ...tags,
      { id, label: clean, color, scope: "organization", createdBy: currentUser.id },
    ]);
    toast.success(`Etiqueta "${clean}" creada`);
    setNewName("");
    setCreating(false);
  };

  const submitRename = (id: string) => {
    const clean = editName.trim();
    if (!clean) {
      setEditingId(null);
      return;
    }
    setTags(tags.map((t) => (t.id === id ? { ...t, label: clean } : t)));
    toast.success("Etiqueta renombrada");
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    const tag = tags.find((t) => t.id === id);
    setTags(tags.filter((t) => t.id !== id));
    toast.success(`Etiqueta "${tag?.label ?? id}" eliminada`);
  };

  const changeColor = (id: string, color: string) => {
    setTags(tags.map((t) => (t.id === id ? { ...t, color } : t)));
  };

  return (
    <SettingsScreen
      title="Etiquetas"
      description="Etiquetas de la organización · visibles a todo el equipo en el filtro de contactos. Solo los administradores pueden crear, renombrar o eliminar etiquetas."
    >
      <SettingsCard
        title="Etiquetas activas"
        description={
          canEdit
            ? "Las etiquetas que añadas aquí aparecerán automáticamente en el filtro de contactos."
            : "Solo los administradores pueden gestionar etiquetas. Estás viendo la lista en modo lectura."
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
              Nueva etiqueta
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" />
              Solo lectura — pide a un administrador que añada etiquetas
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
                placeholder="Nombre de la etiqueta…"
                className="flex-1 bg-transparent outline-none text-sm"
              />
              <button
                onClick={submitCreate}
                className="h-7 w-7 rounded-full hover:bg-muted flex items-center justify-center text-success"
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

          {tags.length === 0 && !creating && (
            <p className="py-8 text-sm text-muted-foreground text-center italic">
              Aún no hay etiquetas
            </p>
          )}

          {tags.map((t) => (
            <div key={t.id} className="group py-3 flex items-center gap-3">
              {/* Color picker (solo si admin) */}
              {canEdit ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      title="Cambiar color"
                      className={cn(
                        "h-3 w-3 rounded-full shrink-0 transition-transform hover:scale-125",
                        t.color,
                      )}
                    />
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="w-auto p-2 rounded-xl border-border shadow-soft-lg"
                  >
                    <div className="grid grid-cols-5 gap-1.5">
                      {TAG_COLOR_PALETTE.map((c) => (
                        <button
                          key={c}
                          onClick={() => changeColor(t.id, c)}
                          className={cn(
                            "h-5 w-5 rounded-full transition-transform hover:scale-110",
                            c,
                            t.color === c && "ring-2 ring-foreground ring-offset-1",
                          )}
                        />
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              ) : (
                <span className={cn("h-3 w-3 rounded-full shrink-0", t.color)} />
              )}

              <div className="flex-1 min-w-0">
                {editingId === t.id && canEdit ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitRename(t.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onBlur={() => submitRename(t.id)}
                    className="w-full bg-transparent outline-none text-sm border-b border-border focus:border-primary py-0.5"
                  />
                ) : (
                  <p className="text-sm text-foreground truncate">{t.label}</p>
                )}
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {usageCount(t.id)}{" "}
                  {usageCount(t.id) === 1 ? "contacto" : "contactos"}
                </p>
              </div>

              {canEdit && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => {
                      setEditingId(t.id);
                      setEditName(t.label);
                    }}
                    title="Renombrar"
                    className="h-8 w-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
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
    </SettingsScreen>
  );
}
