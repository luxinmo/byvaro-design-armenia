/**
 * PromotionAvailabilityFull · vista completa de disponibilidad de una promoción.
 *
 * Es el componente más pesado de la ficha de promoción: orquesta la visualización
 * y edición del inventario de unidades, con múltiples modos de vista, filtros,
 * búsqueda, ordenación, selección masiva, edición masiva y exportación.
 *
 * Responsabilidades principales:
 *   1. Listar todas las unidades de la promoción (o solo disponibles si el viewer
 *      es un colaborador).
 *   2. Tres modos de vista: `table` (lista compacta), `catalog` (catálogo con
 *      foto), `grid` (tarjetas — legado). El modo por defecto es `catalog`.
 *   3. Filtros por estado, bloque, tipología y búsqueda libre (ID/displayId/puerta).
 *   4. Ordenación por columna (block/floor/type/bedrooms/builtArea/price/status)
 *      con dirección ascendente/descendente.
 *   5. Agrupación por bloque con colapso/expansión individual. Renombrado inline
 *      del nombre del bloque.
 *   6. Selección múltiple + edición masiva: diálogo de selección de campos (precio,
 *      estado, habitaciones, etc.) → edición inline → guardado + diálogo de
 *      notificación a colaboradores/clientes.
 *   7. Personalización de columnas en el modo catálogo (vía `ColumnCustomizer`).
 *   8. Envío de fichas por email (`SendEmailDialog`) desde el menú por fila o en
 *      masa desde la barra de selección.
 *   9. Panel de detalle expandido por unidad (`UnitDetailPanel`) dentro de la
 *      tabla.
 *
 * Props:
 *   - promotionId: string                 → key de `unitsByPromotion`.
 *   - isCollaboratorView?: boolean        → modo colaborador (oculta edición,
 *                                           filtra a `available`, quita columna
 *                                           de cliente, etc.).
 *
 * Dependencias:
 *   - `@/data/units`                      → tipos Unit + UnitStatus + mock data.
 *   - `@/hooks/use-toast`                 → toasts Byvaro.
 *   - `@/components/ui/button`            → Button Byvaro (CTAs, toggles de vista).
 *   - `@/components/ui/badge`             → Badge (reservado para futuras chips).
 *   - `@/components/ui/checkbox`          → Checkbox (selección masiva).
 *   - `@/components/ui/column-customizer` → Dialog de configuración de columnas.
 *   - `@/components/ui/dropdown-menu`     → Menú por fila (Ver/Editar/Enviar/Comprar).
 *   - `@/components/ui/dialog`            → Dialogs de selección de campos y aviso.
 *   - `@/lib/utils` (cn)                  → classnames condicionales.
 *   - `./UnitDetailPanel`                 → panel expandido por unidad.
 *   - `@/components/email/SendEmailDialog` → envío de ficha por email.
 *   - `lucide-react`                      → iconografía.
 *
 * Tokens Byvaro usados (todos HSL, ver src/index.css):
 *   - bg-card · border-border · text-foreground · text-muted-foreground · bg-muted
 *   - bg-primary/5 · bg-primary/10 · text-primary (estado "Disponible", selección)
 *   - bg-destructive/10 · text-destructive (estado "Vendida", "Retirada")
 *   - Excepción amber-500: estado "Reservada" + barra de edición masiva
 *     (warning estándar Byvaro — también usado para celdas editables).
 *   - Radios: rounded-2xl (dialog principal) · rounded-xl (bloques, cards,
 *     barra de edición) · rounded-lg (inputs, selects, botones pequeños) ·
 *     rounded-full (badges de estado, chips, dots).
 *   - Sombras: shadow-soft · shadow-soft-lg en hover.
 *
 * TODOs:
 *   - TODO(backend): GET /api/promociones/:id/units — listar unidades (paginado).
 *   - TODO(backend): PATCH /api/units/bulk — edición masiva atómica.
 *   - TODO(backend): POST /api/promociones/:id/notify-collaborators — aviso con
 *     el diff de campos actualizados.
 *   - TODO(backend): POST /api/promociones/:id/share-clients — aviso a clientes
 *     (para isCollaboratorView=true).
 *   - TODO(backend): PATCH /api/promociones/:id/blocks/:block — renombrado de bloque.
 *   - TODO(backend): GET /api/promociones/:id/export — descarga de fichas en PDF.
 *   - TODO(ui): virtualizar la lista (react-window) si el inventario > 200 unidades.
 *   - TODO(feature): guardar la configuración de columnas del catálogo por usuario.
 *   - TODO(feature): mapa interactivo (plano de plantas) como modo de vista extra.
 */

import React, { useEffect, useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { unitsByPromotion, Unit, UnitStatus } from "@/data/units";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge"; // Reservado para futuras chips custom (no usado directamente ahora).
import { Checkbox } from "@/components/ui/Checkbox";
import {
  Download, Search, ChevronDown, ChevronUp, ChevronRight,
  Waves, Building2, LayoutGrid, List, ArrowUpDown,
  Pencil, X, Check, Camera, Bed, Compass, Send, SlidersHorizontal,
  MoreVertical, Eye, ShoppingCart,
} from "lucide-react";
// ColumnCustomizer: dialog Byvaro para elegir columnas visibles en el catálogo.
import { ColumnCustomizer, type ColumnDef } from "@/components/ui/column-customizer";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { UnitDetailPanel } from "./UnitDetailPanel";
import { SendEmailDialog } from "@/components/email/SendEmailDialog";
import { registerUnsavedGuard } from "@/lib/unsavedGuard";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

function formatPrice(n: number) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function getUnitDisplayId(unit: Pick<Unit, "publicId" | "floor" | "door">) {
  return unit.publicId?.trim() || `${unit.floor}º${unit.door}`;
}

// Status de unidades unificado con tokens Byvaro (HSL).
// Amber conservado únicamente para "reserved" — warning estándar del sistema.
const statusConfig: Record<UnitStatus, { label: string; class: string; dotClass: string }> = {
  available: { label: "Disponible", class: "bg-primary/10 text-primary border-primary/20", dotClass: "bg-primary" },
  reserved: { label: "Reservada", class: "bg-amber-500/10 text-amber-700 border-amber-500/20", dotClass: "bg-amber-500" },
  sold: { label: "Vendida", class: "bg-destructive/10 text-destructive border-destructive/20", dotClass: "bg-destructive" },
  withdrawn: { label: "Retirada", class: "bg-muted text-muted-foreground border-border", dotClass: "bg-muted-foreground" },
};

const statusOptions: UnitStatus[] = ["available", "reserved", "sold", "withdrawn"];
const typeOptions = ["Apartamento", "Ático", "Dúplex", "Estudio"];
const orientationOptions = ["Norte", "Sur", "Este", "Oeste", "NE", "NO", "SE", "SO"];

type SortField = "block" | "floor" | "type" | "bedrooms" | "builtArea" | "price" | "status";

type EditableFieldKey = "price" | "bedrooms" | "bathrooms" | "floor" | "door" | "type" | "builtArea" | "orientation" | "status" | "publicId" | "parcel";

const getEditableFieldOptions = (hasUnifamiliar: boolean): { key: EditableFieldKey; label: string }[] => [
  { key: "publicId", label: "ID visible" },
  { key: "price", label: "Precio" },
  { key: "status", label: "Estado" },
  { key: "bedrooms", label: "Habitaciones" },
  { key: "bathrooms", label: "Baños" },
  { key: "builtArea", label: "Superficie (m²)" },
  { key: "type", label: "Tipología" },
  { key: "orientation", label: "Orientación" },
  ...(hasUnifamiliar
    ? [{ key: "parcel" as EditableFieldKey, label: "Parcela (m²)" }]
    : [{ key: "floor" as EditableFieldKey, label: "Planta" }]),
  { key: "door", label: "Puerta" },
];

interface EditedFields {
  publicId?: string;
  price?: number;
  bedrooms?: number;
  bathrooms?: number;
  floor?: number;
  door?: string;
  type?: string;
  builtArea?: number;
  orientation?: string;
  status?: UnitStatus;
  parcel?: number;
}

interface Props {
  promotionId: string;
  isCollaboratorView?: boolean;
}

export function PromotionAvailabilityFull({ promotionId, isCollaboratorView = false }: Props) {
  const { toast } = useToast();
  const [allUnits, setAllUnits] = useState<Unit[]>(() => unitsByPromotion[promotionId] || []);

  const [filterStatus, setFilterStatus] = useState<UnitStatus | "all">("all");
  const [filterBlock, setFilterBlock] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("block");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [viewMode, setViewMode] = useState<"table" | "grid" | "catalog">("catalog");
  const [collapsedBlocks, setCollapsedBlocks] = useState<Set<string>>(new Set());
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);
  const [emailUnitId, setEmailUnitId] = useState<string | null>(null);
  const [blockNames, setBlockNames] = useState<Record<string, string>>({});
  const [editingBlock, setEditingBlock] = useState<string | null>(null);
  const [editingBlockValue, setEditingBlockValue] = useState("");

  const getBlockName = (block: string) => blockNames[block] ?? `Bloque ${block}`;

  const startEditBlock = (block: string) => {
    setEditingBlock(block);
    setEditingBlockValue(getBlockName(block));
  };

  const saveBlockName = () => {
    if (editingBlock === null) return;
    const trimmed = editingBlockValue.trim();
    setBlockNames(prev => {
      const next = { ...prev };
      if (!trimmed || trimmed === `Bloque ${editingBlock}`) {
        delete next[editingBlock];
      } else {
        next[editingBlock] = trimmed;
      }
      return next;
    });
    setEditingBlock(null);
    toast({ title: "Bloque renombrado", description: `Nuevo nombre: ${trimmed || `Bloque ${editingBlock}`}` });
  };

  const cancelEditBlock = () => {
    setEditingBlock(null);
    setEditingBlockValue("");
  };

  // Selection & bulk editing
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
  const [bulkEditing, setBulkEditing] = useState(false);
  const [editedData, setEditedData] = useState<Record<string, EditedFields>>({});

  // Field selector dialog
  const [fieldSelectorOpen, setFieldSelectorOpen] = useState(false);
  const [selectedFields, setSelectedFields] = useState<Set<EditableFieldKey>>(new Set());
  const [activeEditFields, setActiveEditFields] = useState<Set<EditableFieldKey>>(new Set());
  // Notify collaborators dialog + compose email dialog (2 pasos).
  const [notifyDialogOpen, setNotifyDialogOpen] = useState(false);
  const [notifyEmailOpen, setNotifyEmailOpen] = useState(false);
  const [editedFieldLabels, setEditedFieldLabels] = useState<string[]>([]);
  // Dialog de confirmación al cancelar / salir con cambios sin guardar.
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  // Catalog column visibility · reactivo al ancho de ventana.
  //   · ≥1536px (2xl, MacBook 16") → set completo
  //   · 768-1535 (md/lg/xl)        → set compacto
  //   · <768 (móvil)               → set mínimo: ref, tipo, precio, estado
  type CatalogCol = "photo" | "ref" | "type" | "dormBath" | "area" | "floorParcel" | "plans" | "status" | "price" | "orientation" | "client";
  const getDefaultCols = (w: number): Set<CatalogCol> => {
    if (w >= 1536) {
      return new Set<CatalogCol>(
        isCollaboratorView
          ? ["photo", "ref", "type", "dormBath", "area", "floorParcel", "orientation", "status", "price"]
          : ["photo", "ref", "type", "dormBath", "area", "floorParcel", "orientation", "client", "status", "price"]
      );
    }
    if (w >= 768) {
      return new Set<CatalogCol>(
        isCollaboratorView
          ? ["photo", "ref", "type", "dormBath", "area", "floorParcel", "status", "price"]
          : ["photo", "ref", "type", "dormBath", "area", "floorParcel", "price"]
      );
    }
    // Móvil — incluimos foto para mantener la identidad "catálogo" en
    // mobile. Resto mínimo: ref, tipo, estado y precio.
    return new Set<CatalogCol>(["photo", "ref", "type", "status", "price"]);
  };
  const [visibleCols, setVisibleCols] = useState<Set<CatalogCol>>(() => {
    return getDefaultCols(typeof window !== "undefined" ? window.innerWidth : 1024);
  });
  useEffect(() => {
    const onResize = () => setVisibleCols(getDefaultCols(window.innerWidth));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCollaboratorView]);
  const [colCustomizerOpen, setColCustomizerOpen] = useState(false);

  useEffect(() => {
    setAllUnits(unitsByPromotion[promotionId] || []);
    setSelectedUnits(new Set());
    setBulkEditing(false);
    setEditedData({});
    setActiveEditFields(new Set());
    setExpandedUnit(null);
  }, [promotionId]);

  const blocks = [...new Set(allUnits.map(u => u.block))];
  const types = [...new Set(allUnits.map(u => u.type))];
  const hasUnifamiliar = allUnits.some(u => ["Villa", "Chalet", "Unifamiliar", "Pareado", "Adosado"].includes(u.type));
  const editableFieldOptions = getEditableFieldOptions(hasUnifamiliar);
  const catalogColumns: { key: CatalogCol; label: string }[] = [
    { key: "photo", label: "Foto" },
    { key: "ref", label: "Referencia" },
    { key: "type", label: "Tipología" },
    { key: "dormBath", label: "Dorm / Baños" },
    { key: "area", label: "Superficie" },
    { key: "floorParcel", label: hasUnifamiliar ? "Parcela" : "Planta" },
    { key: "plans", label: "Planos" },
    { key: "orientation", label: "Orientación" },
    ...(!isCollaboratorView ? [{ key: "client" as CatalogCol, label: "Cliente / Operación" }] : []),
    { key: "status", label: "Estado" },
    { key: "price", label: "Precio" },
  ];

  const filtered = useMemo(() => {
    let result = [...allUnits];
    // In collaborator view, only show available units
    if (isCollaboratorView) result = result.filter(u => u.status === "available");
    // En edición masiva: sólo mostramos las disponibles (son las únicas
    // editables). Así el usuario no ve filas no editables en la tabla.
    if (bulkEditing) result = result.filter(u => u.status === "available");
    if (filterStatus !== "all") result = result.filter(u => u.status === filterStatus);
    if (filterBlock !== "all") result = result.filter(u => u.block === filterBlock);
    if (filterType !== "all") result = result.filter(u => u.type === filterType);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(u =>
        u.id.toLowerCase().includes(q) ||
        getUnitDisplayId(u).toLowerCase().includes(q) ||
        u.door.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "block": cmp = a.block.localeCompare(b.block) || a.floor - b.floor; break;
        case "floor": cmp = a.floor - b.floor; break;
        case "type": cmp = a.type.localeCompare(b.type); break;
        case "bedrooms": cmp = a.bedrooms - b.bedrooms; break;
        case "builtArea": cmp = a.builtArea - b.builtArea; break;
        case "price": cmp = a.price - b.price; break;
        case "status": cmp = a.status.localeCompare(b.status); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [allUnits, filterStatus, filterBlock, filterType, searchQuery, sortField, sortDir, isCollaboratorView, bulkEditing]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const toggleCollapse = (block: string) => {
    const next = new Set(collapsedBlocks);
    next.has(block) ? next.delete(block) : next.add(block);
    setCollapsedBlocks(next);
  };

  const toggleExpandUnit = (id: string) => {
    if (bulkEditing) return;
    setExpandedUnit(prev => prev === id ? null : id);
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedUnits);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedUnits(next);
  };

  const toggleSelectAll = () => {
    if (selectedUnits.size === filtered.length) setSelectedUnits(new Set());
    else setSelectedUnits(new Set(filtered.map(u => u.id)));
  };

  const toggleSelectBlock = (blockUnits: Unit[]) => {
    const ids = blockUnits.map(u => u.id);
    const allSelected = ids.every(id => selectedUnits.has(id));
    const next = new Set(selectedUnits);
    if (allSelected) ids.forEach(id => next.delete(id));
    else ids.forEach(id => next.add(id));
    setSelectedUnits(next);
  };

  const clearSelection = () => setSelectedUnits(new Set());

  // Open field selector dialog instead of directly starting edit
  const openFieldSelector = () => {
    setSelectedFields(new Set());
    setFieldSelectorOpen(true);
  };

  const toggleFieldSelection = (field: EditableFieldKey) => {
    const next = new Set(selectedFields);
    next.has(field) ? next.delete(field) : next.add(field);
    setSelectedFields(next);
  };

  const confirmFieldSelection = () => {
    if (selectedFields.size === 0) return;
    // Initialize edit data for ALL AVAILABLE units (Excel-like editing).
    // La edición masiva ya no requiere pre-seleccionar: se aplica sobre
    // todas las unidades disponibles a la vez.
    const initial: Record<string, EditedFields> = {};
    allUnits.filter(u => u.status === "available").forEach(u => {
      const fields: EditedFields = {};
      selectedFields.forEach(f => {
        (fields as any)[f] = (u as any)[f];
      });
      initial[u.id] = fields;
    });
    setEditedData(initial);
    setActiveEditFields(new Set(selectedFields));
    setBulkEditing(true);
    // Forzar la vista de tabla — el modo "catalog" (default) no renderiza
    // celdas editables, así que cambiamos automáticamente al activar la
    // edición masiva.
    setViewMode("table");
    setFieldSelectorOpen(false);
  };

  const cancelBulkEdit = () => {
    setBulkEditing(false);
    setEditedData({});
    setActiveEditFields(new Set());
  };

  const saveBulkEdit = () => {
    setAllUnits(prev => prev.map(u => (
      u.status === "available" && editedData[u.id]
        ? { ...u, ...editedData[u.id] }
        : u
    )));

    const labels = Array.from(activeEditFields).map(f => editableFieldOptions.find(o => o.key === f)?.label || f);
    setEditedFieldLabels(labels);
    // Sólo disparamos el modal "Avisar colaboradores" cuando la edición
    // afecta a campos relevantes comercialmente: precio o estado
    // (disponibilidad). Para otros campos (tipología, superficies, etc.)
    // guardamos en silencio con un toast.
    const fields = Array.from(activeEditFields);
    const notifyRelevant = fields.some(f => f === "price" || f === "status");
    setBulkEditing(false);
    setEditedData({});
    setActiveEditFields(new Set());
    clearSelection();
    if (notifyRelevant) {
      setNotifyDialogOpen(true);
    } else {
      toast({ title: "Cambios guardados", description: `Se han actualizado: ${labels.join(", ")}.` });
    }
  };

  const updateField = (unitId: string, field: keyof EditedFields, value: string | number) => {
    setEditedData(prev => ({
      ...prev,
      [unitId]: { ...prev[unitId], [field]: value },
    }));
  };

  const handleUnitUpdate = (unitId: string, updates: Partial<Unit>) => {
    setAllUnits(prev => prev.map(u => (u.id === unitId ? { ...u, ...updates } : u)));
  };

  const isAllSelected = filtered.length > 0 && selectedUnits.size === filtered.length;
  const hasSelection = selectedUnits.size > 0;

  const renderSortIcon = (field: SortField) => (
    <span className="inline-flex ml-1 opacity-50">
      {sortField === field ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3" />}
    </span>
  );

  // Stats
  const available = allUnits.filter(u => u.status === "available").length;
  const reserved = allUnits.filter(u => u.status === "reserved").length;
  const sold = allUnits.filter(u => u.status === "sold").length;
  const occupancy = Math.round(((allUnits.length - available) / allUnits.length) * 100);
  const avgPrice = Math.round(allUnits.filter(u => u.status === "available").reduce((s, u) => s + u.price, 0) / (available || 1));

  // Helper: get value (edited or original)
  const getVal = (u: Unit, field: keyof EditedFields) => {
    if (bulkEditing && editedData[u.id]) return editedData[u.id][field] ?? (u as any)[field];
    return (u as any)[field];
  };

  const isEditable = (id: string) => {
    if (!bulkEditing) return false;
    const u = allUnits.find(x => x.id === id);
    return u?.status === "available";
  };
  const isFieldEditable = (field: EditableFieldKey) => activeEditFields.has(field);

  const editableCellClass = "border-2 border-amber-500/40 bg-amber-500/10 rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all";

  const renderEditableCell = (u: Unit, field: EditableFieldKey, readOnlyContent: React.ReactNode, editContent: React.ReactNode) => {
    const editing = isEditable(u.id);
    if (editing && isFieldEditable(field)) return editContent;
    return readOnlyContent;
  };

  const total = allUnits.length || 1;
  const availPct = (available / total) * 100;
  const reservedPct = (reserved / total) * 100;
  const soldPct = (sold / total) * 100;

  // ¿Hay cambios sin guardar? Comparamos el valor editado con el original.
  const hasUnsavedEdits = bulkEditing && Object.entries(editedData).some(([uid, fields]) => {
    const orig = allUnits.find(u => u.id === uid);
    if (!orig) return false;
    return Object.entries(fields).some(([k, v]) => (orig as any)[k] !== v);
  });

  // Avisar al usuario si intenta cerrar la pestaña con cambios sin guardar.
  useEffect(() => {
    if (!hasUnsavedEdits) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedEdits]);

  // Registrar el guard para que las navegaciones internas (sidebar,
  // tabs de la ficha, cualquier <a href>) muestren la confirmación.
  useEffect(() => {
    return registerUnsavedGuard(() => hasUnsavedEdits);
  }, [hasUnsavedEdits]);

  // Wrapper de cancelBulkEdit que confirma si hay cambios.
  const requestCancelBulkEdit = () => {
    if (hasUnsavedEdits) {
      setConfirmLeaveOpen(true);
      return;
    }
    cancelBulkEdit();
  };

  return (
    <div className="space-y-5">

      {/* Bulk editing bar · sticky para que las acciones Guardar / Cancelar
          estén siempre visibles mientras el usuario edita en medio de una
          tabla larga. */}
      {bulkEditing && (
        <div className="sticky top-2 z-20 border border-amber-500/30 rounded-xl bg-amber-500/10 px-4 py-2.5 flex items-center justify-between shadow-soft-lg">
          <div className="flex items-center gap-3">
            <Pencil className="h-4 w-4 text-amber-600" strokeWidth={1.5} />
            <span className="text-xs font-semibold text-foreground">Edición masiva · {available} unidad{available !== 1 ? "es" : ""} disponible{available !== 1 ? "s" : ""}</span>
            <div className="flex items-center gap-1">
              {Array.from(activeEditFields).map(f => (
                <span key={f} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/20 text-amber-700">
                  {editableFieldOptions.find(o => o.key === f)?.label}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={requestCancelBulkEdit}>
              <X className="h-3 w-3 mr-1" /> Cancelar
            </Button>
            <Button size="sm" className="h-7 text-xs gap-1.5 rounded-full" onClick={saveBulkEdit}>
              <Check className="h-3 w-3" strokeWidth={1.5} /> Guardar cambios
            </Button>
          </div>
        </div>
      )}

      {/* Field selector dialog */}
      <Dialog open={fieldSelectorOpen} onOpenChange={setFieldSelectorOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Qué campos quieres editar?</DialogTitle>
            <DialogDescription>
              Selecciona los campos que quieres modificar. Se aplicarán a las {available} unidad{available !== 1 ? "es" : ""} disponible{available !== 1 ? "s" : ""} a la vez (estilo Excel).
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 py-4">
            {editableFieldOptions.map(opt => {
              const isChecked = selectedFields.has(opt.key);
              return (
                <button
                  key={opt.key}
                  onClick={() => toggleFieldSelection(opt.key)}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all text-sm",
                    isChecked
                      ? "border-primary bg-primary/5 text-foreground font-medium"
                      : "border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <div className={cn(
                    "h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                    isChecked ? "border-primary bg-primary" : "border-muted-foreground/30"
                  )}>
                    {isChecked && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={2.5} />}
                  </div>
                  {opt.label}
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFieldSelectorOpen(false)}>Cancelar</Button>
            <Button onClick={confirmFieldSelection} disabled={selectedFields.size === 0} className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" /> Editar {selectedFields.size} campo{selectedFields.size !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notify / Share dialog — texto adaptado al campo editado
          (precio vs disponibilidad vs ambos). Sólo se abre cuando la
          edición afectó a uno de estos dos campos. */}
      {(() => {
        const hasPrice = editedFieldLabels.some(l => /precio/i.test(l));
        const hasStatus = editedFieldLabels.some(l => /estado/i.test(l));
        const noun = hasPrice && hasStatus
          ? "precios y disponibilidad"
          : hasPrice ? "precios" : "disponibilidad";
        const verbShort = hasPrice && hasStatus
          ? "nuevos precios y nueva disponibilidad"
          : hasPrice ? "nuevos precios" : "nueva disponibilidad";
        return (
      <Dialog open={notifyDialogOpen} onOpenChange={setNotifyDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {hasPrice && hasStatus
                ? "Precios y disponibilidad actualizados"
                : hasPrice ? "Precios actualizados" : "Disponibilidad actualizada"}
            </DialogTitle>
            <DialogDescription>
              {isCollaboratorView
                ? `¿Quieres compartir ${verbShort} con tus clientes?`
                : `¿Quieres avisar a los colaboradores de ${verbShort}?`}
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
            <div className="h-8 w-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <Pencil className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {isCollaboratorView
                  ? `Avisar ${verbShort} a clientes`
                  : `Avisar ${verbShort} a colaboradores`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {isCollaboratorView
                  ? `Se enviará un resumen con ${noun} a los clientes interesados en estas unidades.`
                  : `Se enviará un aviso a las agencias colaboradoras con ${noun} actualizados.`}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => {
              setNotifyDialogOpen(false);
              toast({ title: "Cambios guardados", description: isCollaboratorView ? "No se ha compartido con clientes." : "No se ha notificado a los colaboradores." });
            }}>
              {isCollaboratorView ? "No compartir" : "No avisar"}
            </Button>
            <Button onClick={() => {
              // Paso 2 del flujo (como Lovable): abrir el compose email
              // con destinatarios + plantilla "new-availability" preseleccionados.
              setNotifyDialogOpen(false);
              setNotifyEmailOpen(true);
            }} className="gap-1.5 rounded-full">
              <Send className="h-3.5 w-3.5" /> {isCollaboratorView ? "Compartir con clientes" : "Avisar colaboradores"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        );
      })()}

      {/* Notify email compose — paso 2 del flujo "Avisar colaboradores".
          Abre SendEmailDialog preseleccionando la audiencia (colaboradores
          o clientes) y la plantilla "new-availability". */}
      <SendEmailDialog
        open={notifyEmailOpen}
        onOpenChange={setNotifyEmailOpen}
        defaultAudience={isCollaboratorView ? "client" : "collaborator"}
        defaultTemplateId="new-availability"
        mode="promotion"
        promotionId={promotionId}
      />

      {/* Confirmación al cancelar con cambios sin guardar. */}
      <Dialog open={confirmLeaveOpen} onOpenChange={setConfirmLeaveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Descartar cambios?</DialogTitle>
            <DialogDescription>
              Tienes cambios sin guardar en la edición masiva. Si cancelas
              ahora se perderán.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmLeaveOpen(false)}>
              Seguir editando
            </Button>
            <Button variant="destructive" onClick={() => {
              setConfirmLeaveOpen(false);
              cancelBulkEdit();
            }} className="gap-1.5">
              <X className="h-3.5 w-3.5" /> Descartar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Column customizer dialog */}
      <ColumnCustomizer
        open={colCustomizerOpen}
        onOpenChange={setColCustomizerOpen}
        columns={catalogColumns.map(c => ({ key: c.key, label: c.label, locked: c.key === "ref" }))}
        visibleColumns={visibleCols as Set<string>}
        onSave={(v) => setVisibleCols(v as Set<CatalogCol>)}
      />

      <div className="relative border border-border rounded-2xl bg-card p-4 shadow-soft">
        {/* Selection overlay */}
        {hasSelection && !bulkEditing && (
          <div className="absolute inset-0 z-10 rounded-2xl bg-card border border-border flex items-center justify-between px-5">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-foreground">{selectedUnits.size} unidad{selectedUnits.size > 1 ? "es" : ""} seleccionada{selectedUnits.size > 1 ? "s" : ""}</span>
              <button onClick={clearSelection} className="text-xs text-muted-foreground hover:text-foreground transition-colors underline">
                Deseleccionar
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={() => toast({ title: "Descargando fichas", description: `${selectedUnits.size} ficha(s) descargadas.` })}>
                <Download className="h-3 w-3" strokeWidth={1.5} /> Descargar ficha
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={() => toast({ title: "Enviar inmuebles", description: `${selectedUnits.size} inmueble(s) listos para enviar.` })}>
                <Send className="h-3 w-3" strokeWidth={1.5} /> Enviar a cliente
              </Button>
              {!isCollaboratorView && (
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 rounded-full" onClick={openFieldSelector}>
                  <Pencil className="h-3 w-3" strokeWidth={1.5} /> Edición masiva
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
          <div className="relative w-full sm:flex-1 sm:min-w-[200px] sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            <input
              type="text"
              placeholder="Buscar unidad..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* En móvil los 3 selects caben en una fila con grid-cols-3. */}
          <div className="grid grid-cols-3 sm:flex gap-2">
            <select value={filterBlock} onChange={e => setFilterBlock(e.target.value)}
              className="min-w-0 h-9 px-2.5 rounded-lg border border-border bg-background text-sm">
              <option value="all">Bloques</option>
              {blocks.map(b => <option key={b} value={b}>{getBlockName(b)}</option>)}
            </select>

            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="min-w-0 h-9 px-2.5 rounded-lg border border-border bg-background text-sm">
              <option value="all">Tipologías</option>
              {types.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as UnitStatus | "all")}
              className="min-w-0 h-9 px-2.5 rounded-lg border border-border bg-background text-sm">
              <option value="all">Estados</option>
              {statusOptions.map(s => <option key={s} value={s}>{statusConfig[s].label}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-1 sm:ml-auto">
            {/* Edición masiva directa — no requiere pre-selección, aplica a
                todas las unidades disponibles (Excel-like). Oculta en móvil:
                Excel-like no funciona bien con pantallas estrechas. */}
            {!isCollaboratorView && !bulkEditing && (
              <Button variant="outline" size="sm" className="hidden md:inline-flex h-9 text-xs gap-1.5 rounded-full mr-1" onClick={openFieldSelector}>
                <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} /> Edición masiva
              </Button>
            )}
            <Button variant={viewMode === "table" ? "secondary" : "ghost"} size="icon" className="h-9 w-9" onClick={() => setViewMode("table")}>
              <List className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === "catalog" ? "secondary" : "ghost"} size="icon" className="h-9 w-9" onClick={() => setViewMode("catalog")} title="Catálogo con fotos">
              <Camera className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Blocks */}
      {blocks.map(block => {
        const blockUnits = filtered.filter(u => u.block === block);
        const allBlockUnits = allUnits.filter(u => u.block === block);
        const blockAvail = allBlockUnits.filter(u => u.status === "available").length;
        const isCollapsed = collapsedBlocks.has(block);
        const allBlockSelected = blockUnits.length > 0 && blockUnits.every(u => selectedUnits.has(u.id));
        const someBlockSelected = blockUnits.some(u => selectedUnits.has(u.id));
        if (blockUnits.length === 0 && filterBlock !== "all") return null;

        return (
          <div key={block} className="border border-border rounded-xl bg-card overflow-hidden shadow-soft">
            {/* Block header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border transition-colors">
              <div className="flex items-center gap-3">
                {!isCollaboratorView && (
                  <Checkbox
                    checked={allBlockSelected}
                    // @ts-ignore
                    indeterminate={someBlockSelected && !allBlockSelected}
                    onCheckedChange={() => toggleSelectBlock(blockUnits)}
                    className="h-4 w-4"
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                <span
                  className="text-muted-foreground transition-transform duration-200 cursor-pointer"
                  style={{ transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)" }}
                  onClick={() => toggleCollapse(block)}
                >
                  <ChevronRight className="h-4 w-4" />
                </span>
                <Building2 className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                {editingBlock === block ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      autoFocus
                      value={editingBlockValue}
                      onChange={(e) => setEditingBlockValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveBlockName();
                        if (e.key === "Escape") cancelEditBlock();
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-7 px-2 text-sm font-semibold rounded-lg border border-primary/40 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[180px]"
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); saveBlockName(); }}
                      className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-primary/10 text-primary"
                      title="Guardar"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); cancelEditBlock(); }}
                      className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground"
                      title="Cancelar"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 group/block">
                    <h3 className="text-base font-semibold text-foreground cursor-pointer" onClick={() => toggleCollapse(block)}>{getBlockName(block)}</h3>
                    {!isCollaboratorView && (
                      <button
                        onClick={(e) => { e.stopPropagation(); startEditBlock(block); }}
                        className="h-6 w-6 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover/block:opacity-100 transition-opacity"
                        title="Renombrar bloque"
                      >
                        <Pencil className="h-3 w-3" strokeWidth={1.5} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Table view */}
            {!isCollapsed && viewMode === "table" && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/40 text-muted-foreground">
                      {!isCollaboratorView && (
                        <th className="px-3 py-2.5 text-left w-10">
                          <Checkbox
                            checked={isAllSelected}
                            onCheckedChange={toggleSelectAll}
                            className="h-3.5 w-3.5"
                          />
                        </th>
                      )}
                      <th className="px-3 py-2.5 text-left font-medium cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort("block")}>
                        ID {renderSortIcon("block")}
                      </th>
                      <th className="px-3 py-2.5 text-left font-medium cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort("floor")}>
                        {hasUnifamiliar ? "Parcela" : "Planta"} {renderSortIcon("floor")}
                      </th>
                      <th className="px-3 py-2.5 text-left font-medium cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort("type")}>
                        Tipo {renderSortIcon("type")}
                      </th>
                      <th className="px-3 py-2.5 text-center font-medium cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort("bedrooms")}>
                        Hab. {renderSortIcon("bedrooms")}
                      </th>
                      <th className="px-3 py-2.5 text-center font-medium whitespace-nowrap">Baños</th>
                      <th className="px-3 py-2.5 text-right font-medium cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort("builtArea")}>
                        m² {renderSortIcon("builtArea")}
                      </th>
                      <th className="px-3 py-2.5 text-left font-medium whitespace-nowrap">Orient.</th>
                      <th className="px-3 py-2.5 text-right font-medium cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort("price")}>
                        Precio {renderSortIcon("price")}
                      </th>
                      <th className="px-3 py-2.5 text-center font-medium cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort("status")}>
                        Estado {renderSortIcon("status")}
                      </th>
                      <th className="px-2 py-2.5 w-10 text-right">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setColCustomizerOpen(true); }}
                          className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                          title="Personalizar columnas"
                        >
                          <SlidersHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {blockUnits.map(u => {
                      const sc = statusConfig[u.status];
                      const isExpanded = expandedUnit === u.id;
                      const isSelected = selectedUnits.has(u.id);
                      const editing = isEditable(u.id);

                      return (
                        <React.Fragment key={u.id}>
                          <tr
                            className={cn(
                              "border-t border-border transition-colors",
                              !bulkEditing && "cursor-pointer hover:bg-muted/30",
                              isExpanded && "bg-muted/40",
                              isSelected && !bulkEditing && "bg-primary/5",
                              editing && "bg-amber-500/5"
                            )}
                            onClick={() => toggleExpandUnit(u.id)}
                          >
                            {/* Checkbox — hidden for collaborator */}
                            {!isCollaboratorView && (
                              <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleSelect(u.id)}
                                  className="h-3.5 w-3.5"
                                />
                              </td>
                            )}

                            {/* ID (publicId editable, door as fallback) */}
                            <td className="px-3 py-2" onClick={e => editing && (isFieldEditable("publicId") || isFieldEditable("door")) && e.stopPropagation()}>
                              {renderEditableCell(u, "publicId",
                                <span className="text-xs font-bold text-foreground">{getUnitDisplayId(u)}</span>,
                                <input
                                  type="text"
                                  value={getVal(u, "publicId") || ""}
                                  placeholder={`${u.floor}º${u.door}`}
                                  onChange={e => updateField(u.id, "publicId", e.target.value)}
                                  className={cn("w-20 h-7 px-2 text-xs font-bold", editableCellClass)}
                                />
                              )}</td>

                            {/* Planta / Parcela */}
                            <td className="px-3 py-2" onClick={e => editing && (isFieldEditable("floor") || isFieldEditable("parcel")) && e.stopPropagation()}>
                              {(() => {
                                const isUni = ["Villa", "Chalet", "Unifamiliar", "Pareado", "Adosado"].includes(u.type);
                                if (isUni) {
                                  return renderEditableCell(u, "parcel",
                                    <span className="text-xs text-muted-foreground">{u.parcel > 0 ? `${u.parcel}m²` : "—"}</span>,
                                    <input type="number" value={getVal(u, "parcel") || 0} onChange={e => updateField(u.id, "parcel", Number(e.target.value))} className={cn("w-20 h-7 px-2 text-xs", editableCellClass)} />
                                  );
                                }
                                return renderEditableCell(u, "floor",
                                  <span className="text-xs text-muted-foreground">{u.floor === 0 ? "PB" : `P${u.floor}`}</span>,
                                  <select value={getVal(u, "floor")} onChange={e => updateField(u.id, "floor", Number(e.target.value))} className={cn("w-20 h-7 px-1.5 text-xs", editableCellClass)}>
                                    {Array.from({ length: 15 }, (_, i) => <option key={i} value={i}>{i === 0 ? "PB" : `P${i}`}</option>)}
                                  </select>
                                );
                              })()}
                            </td>

                            {/* Tipo */}
                            <td className="px-3 py-2" onClick={e => editing && isFieldEditable("type") && e.stopPropagation()}>
                              {renderEditableCell(u, "type",
                                <span className="text-foreground">{u.type}</span>,
                                <select
                                  value={getVal(u, "type")}
                                  onChange={e => updateField(u.id, "type", e.target.value)}
                                  className={cn("w-24 h-7 px-1.5 text-xs", editableCellClass)}
                                >
                                  {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                              )}
                            </td>

                            {/* Hab */}
                            <td className="px-3 py-2 text-center" onClick={e => editing && isFieldEditable("bedrooms") && e.stopPropagation()}>
                              {renderEditableCell(u, "bedrooms",
                                <span className="text-foreground font-medium">{u.bedrooms}</span>,
                                <input
                                  type="number"
                                  min={0}
                                  max={10}
                                  value={getVal(u, "bedrooms")}
                                  onChange={e => updateField(u.id, "bedrooms", Number(e.target.value))}
                                  className={cn("w-14 h-7 px-2 text-xs text-center", editableCellClass)}
                                />
                              )}
                            </td>

                            {/* Baños */}
                            <td className="px-3 py-2 text-center" onClick={e => editing && isFieldEditable("bathrooms") && e.stopPropagation()}>
                              {renderEditableCell(u, "bathrooms",
                                <span className="text-foreground">{u.bathrooms}</span>,
                                <input
                                  type="number"
                                  min={0}
                                  max={10}
                                  value={getVal(u, "bathrooms")}
                                  onChange={e => updateField(u.id, "bathrooms", Number(e.target.value))}
                                  className={cn("w-14 h-7 px-2 text-xs text-center", editableCellClass)}
                                />
                              )}
                            </td>

                            {/* m² */}
                            <td className="px-3 py-2 text-right" onClick={e => editing && isFieldEditable("builtArea") && e.stopPropagation()}>
                              {renderEditableCell(u, "builtArea",
                                <span>{u.builtArea} m²</span>,
                                <input
                                  type="number"
                                  value={getVal(u, "builtArea")}
                                  onChange={e => updateField(u.id, "builtArea", Number(e.target.value))}
                                  className={cn("w-20 h-7 px-2 text-xs text-right", editableCellClass)}
                                />
                              )}
                            </td>

                            {/* Orientación */}
                            <td className="px-3 py-2" onClick={e => editing && isFieldEditable("orientation") && e.stopPropagation()}>
                              {renderEditableCell(u, "orientation",
                                <span className="text-[10px] text-muted-foreground">{u.orientation}</span>,
                                <select
                                  value={getVal(u, "orientation")}
                                  onChange={e => updateField(u.id, "orientation", e.target.value)}
                                  className={cn("w-16 h-7 px-1 text-xs", editableCellClass)}
                                >
                                  {orientationOptions.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                              )}
                            </td>

                            {/* Precio · input con miles "476.000" para
                                coincidir con el formato de lectura y evitar
                                confusiones entre 500000 y 500.000. */}
                            <td className="px-3 py-2 text-right" onClick={e => editing && isFieldEditable("price") && e.stopPropagation()}>
                              {renderEditableCell(u, "price",
                                <span className="text-sm font-semibold text-foreground tabular-nums">{formatPrice(u.price)}</span>,
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={Number(getVal(u, "price") || 0).toLocaleString("es-ES")}
                                  onChange={e => {
                                    const digits = e.target.value.replace(/[^0-9]/g, "");
                                    updateField(u.id, "price", digits === "" ? 0 : Number(digits));
                                  }}
                                  className={cn("w-28 h-7 px-2 text-xs text-right font-semibold tabular-nums", editableCellClass)}
                                />
                              )}
                            </td>

                            {/* Estado */}
                            <td className="px-3 py-2 text-center" onClick={e => editing && isFieldEditable("status") && e.stopPropagation()}>
                              {renderEditableCell(u, "status",
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${sc.class}`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${sc.dotClass}`} />
                                  {sc.label}
                                </span>,
                                <select
                                  value={getVal(u, "status")}
                                  onChange={e => updateField(u.id, "status", e.target.value)}
                                  className={cn("w-24 h-7 px-1 text-xs", editableCellClass)}
                                >
                                  {statusOptions.map(s => <option key={s} value={s}>{statusConfig[s].label}</option>)}
                                </select>
                              )}
                            </td>
                            <td className="px-2 py-2 text-right" onClick={e => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
                                    <MoreVertical className="h-3.5 w-3.5" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                  <DropdownMenuItem onClick={() => toggleExpandUnit(u.id)} className="gap-2 text-xs">
                                    <Eye className="h-3.5 w-3.5" /> Ver
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={u.status !== "available"}
                                    onClick={() => toast({ title: "Editar unidad", description: getUnitDisplayId(u) })}
                                    className="gap-2 text-xs"
                                  >
                                    <Pencil className="h-3.5 w-3.5" /> Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={u.status !== "available"}
                                    onClick={() => setEmailUnitId(u.id)}
                                    className="gap-2 text-xs"
                                  >
                                    <Send className="h-3.5 w-3.5" /> Enviar por email
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={u.status !== "available"}
                                    onClick={() => toast({ title: "Iniciar compra", description: `Operación para ${getUnitDisplayId(u)}` })}
                                    className="gap-2 text-xs"
                                  >
                                    <ShoppingCart className="h-3.5 w-3.5" /> Iniciar compra
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </td>
                          </tr>
                          {isExpanded && !bulkEditing && <UnitDetailPanel unit={u} onUpdateUnit={handleUnitUpdate} isCollaboratorView={isCollaboratorView} />}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Grid view */}
            {!isCollapsed && viewMode === "grid" && (
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                {blockUnits.map(u => {
                  const sc = statusConfig[u.status];
                  const isSelected = selectedUnits.has(u.id);
                  return (
                    <div
                      key={u.id}
                      className={`border rounded-xl p-3 transition-all shadow-soft hover:shadow-soft-lg cursor-pointer relative ${isSelected ? "border-primary bg-primary/5" : "border-border"}`}
                      onClick={() => toggleExpandUnit(u.id)}
                    >
                      {!isCollaboratorView && (
                        <div className="absolute top-2 left-2" onClick={e => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(u.id)}
                            className="h-3.5 w-3.5"
                          />
                        </div>
                      )}
                      <div className={cn("flex items-center justify-between mb-2", !isCollaboratorView && "pl-5")}>
                                <span className="text-xs font-bold text-foreground">{getUnitDisplayId(u)}</span>
                        <span className={`h-2 w-2 rounded-full ${sc.dotClass}`} title={sc.label} />
                      </div>
                      <p className="text-[10px] text-muted-foreground">{u.type} · {u.bedrooms}/{u.bathrooms} · {u.builtArea}m²</p>
                      <p className="text-sm font-bold text-foreground mt-1.5 tabular-nums">{formatPrice(u.price)}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Catalog view mobile · cards apiladas sin scroll horizontal.
                Solo se muestra en <sm. Desktop sigue con la tabla abajo. */}
            {!isCollapsed && viewMode === "catalog" && (
              <div className="sm:hidden divide-y divide-border/60">
                {blockUnits.map(u => {
                  const sc = statusConfig[u.status];
                  const isSelected = selectedUnits.has(u.id);
                  const sold = u.status === "reserved" || u.status === "sold";
                  return (
                    <div
                      key={u.id}
                      onClick={() => toggleExpandUnit(u.id)}
                      className={cn(
                        "relative flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors",
                        isSelected && "bg-primary/5"
                      )}
                    >
                      {!isCollaboratorView && (
                        <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(u.id)} className="h-3.5 w-3.5" />
                        </div>
                      )}
                      <div className="w-[64px] h-[48px] rounded-lg overflow-hidden bg-muted/30 shrink-0">
                        <img src={`https://picsum.photos/seed/${u.id}/160/108`} alt="" className="w-full h-full object-cover" loading="lazy" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-foreground truncate">{getUnitDisplayId(u)}</span>
                          <span className="text-[10px] text-muted-foreground truncate">· {u.type}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground tabular-nums">
                          <span className="whitespace-nowrap">{u.bedrooms}/{u.bathrooms}</span>
                          <span>·</span>
                          <span className="whitespace-nowrap">{u.builtArea} m²</span>
                        </div>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        <span className="text-sm font-bold text-foreground tabular-nums whitespace-nowrap">
                          {formatPrice(u.price)}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${sc.class}`}>
                          <span className={`h-1 w-1 rounded-full ${sc.dotClass}`} />
                          {sc.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Catalog view desktop/tablet (sm+) — tabla con thumbnails */}
            {!isCollapsed && viewMode === "catalog" && (
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="pl-3 pr-1 py-2 w-8">
                        <Checkbox checked={isAllSelected} onCheckedChange={toggleSelectAll} className="h-3.5 w-3.5" />
                      </th>
                      {visibleCols.has("photo") && <th className="px-2 py-2 w-[88px]"></th>}
                      {visibleCols.has("ref") && (
                        <th className="px-2 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider cursor-pointer select-none" onClick={() => handleSort("block")}>
                          Referencia {renderSortIcon("block")}
                        </th>
                      )}
                      {visibleCols.has("type") && (
                        <th className="px-2 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider cursor-pointer select-none" onClick={() => handleSort("type")}>
                          Tipología {renderSortIcon("type")}
                        </th>
                      )}
                      {visibleCols.has("dormBath") && (
                        <th className="px-2 py-2 text-center text-[10px] font-medium text-muted-foreground uppercase tracking-wider cursor-pointer select-none" onClick={() => handleSort("bedrooms")}>
                          Dorm / Baños {renderSortIcon("bedrooms")}
                        </th>
                      )}
                      {visibleCols.has("area") && (
                        <th className="px-2 py-2 text-center text-[10px] font-medium text-muted-foreground uppercase tracking-wider cursor-pointer select-none" onClick={() => handleSort("builtArea")}>
                          m² {renderSortIcon("builtArea")}
                        </th>
                      )}
                      {visibleCols.has("floorParcel") && (
                        <th className="px-2 py-2 text-center text-[10px] font-medium text-muted-foreground uppercase tracking-wider cursor-pointer select-none" onClick={() => handleSort("floor")}>
                          {hasUnifamiliar ? "Parcela" : "Planta"} {renderSortIcon("floor")}
                        </th>
                      )}
                      {visibleCols.has("plans") && (
                        <th className="px-2 py-2 text-center text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Planos</th>
                      )}
                      {visibleCols.has("orientation") && (
                        <th className="px-2 py-2 text-center text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Orient.</th>
                      )}
                      {visibleCols.has("client") && (
                        <th className="px-2 py-2 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider min-w-[160px]">
                          Cliente / Operación
                        </th>
                      )}
                      {visibleCols.has("status") && (
                        <th className="px-2 py-2 text-center text-[10px] font-medium text-muted-foreground uppercase tracking-wider cursor-pointer select-none" onClick={() => handleSort("status")}>
                          Estado {renderSortIcon("status")}
                        </th>
                      )}
                      {visibleCols.has("price") && (
                        <th className="px-3 py-2 text-right pr-5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider cursor-pointer select-none min-w-[120px]" onClick={() => handleSort("price")}>
                          Precio {renderSortIcon("price")}
                        </th>
                      )}
                      <th className="px-2 py-2 w-10 text-right">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setColCustomizerOpen(true); }}
                          className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                          title="Personalizar columnas"
                        >
                          <SlidersHorizontal className="h-3.5 w-3.5" />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {blockUnits.map((u) => {
                      const sc = statusConfig[u.status];
                      const isSelected = selectedUnits.has(u.id);
                      const isUni = ["Villa", "Chalet", "Unifamiliar", "Pareado", "Adosado"].includes(u.type);
                      return (
                        <tr key={u.id} className={cn("border-b border-border/20 hover:bg-muted/20 transition-colors", isSelected && "bg-primary/5")}>
                          <td className="pl-3 pr-1 py-1.5" onClick={e => e.stopPropagation()}>
                            <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(u.id)} className="h-3.5 w-3.5" />
                          </td>
                          {visibleCols.has("photo") && (
                            <td className="px-2 py-1.5">
                              <div className="w-[80px] h-[54px] rounded overflow-hidden bg-muted/30 shrink-0">
                                <img src={`https://picsum.photos/seed/${u.id}/160/108`} alt={`${u.type} ${getUnitDisplayId(u)}`} className="w-full h-full object-cover" loading="lazy" />
                              </div>
                            </td>
                          )}
                          {visibleCols.has("ref") && (
                            <td className="px-2 py-1.5"><span className="text-xs font-semibold text-foreground">{getUnitDisplayId(u)}</span></td>
                          )}
                          {visibleCols.has("type") && (
                            <td className="px-2 py-1.5"><span className="text-xs text-muted-foreground">{u.type}</span></td>
                          )}
                          {visibleCols.has("dormBath") && (
                            <td className="px-2 py-1.5 text-center"><span className="text-xs text-foreground">{u.bedrooms}/{u.bathrooms}</span></td>
                          )}
                          {visibleCols.has("area") && (
                            <td className="px-2 py-1.5 text-center"><span className="text-xs text-foreground">{u.builtArea}m²</span></td>
                          )}
                          {visibleCols.has("floorParcel") && (
                            <td className="px-2 py-1.5 text-center">
                              <span className="text-xs text-foreground">
                                {isUni ? (u.parcel > 0 ? `${u.parcel}m²` : "—") : (u.floor === 0 ? "PB" : `${u.floor}ª`)}
                              </span>
                            </td>
                          )}
                          {visibleCols.has("plans") && (
                            <td className="px-2 py-1.5 text-center"><span className="text-[10px] text-muted-foreground">—</span></td>
                          )}
                          {visibleCols.has("orientation") && (
                            <td className="px-2 py-1.5 text-center"><span className="text-xs text-muted-foreground">{u.orientation}</span></td>
                          )}
                          {visibleCols.has("client") && (
                            <td className="px-2 py-1.5 min-w-[160px]">
                              {u.status === "available" ? (
                                <span className="text-[10px] text-muted-foreground/60">—</span>
                              ) : (
                                <div className="flex flex-col leading-tight">
                                  <span className="text-xs font-medium text-foreground truncate">{u.clientName || "Sin asignar"}</span>
                                  <span className="text-[10px] text-muted-foreground tabular-nums">
                                    OP-{u.ref.split("-").pop()}
                                    {u.agencyName ? ` · ${u.agencyName}` : ""}
                                  </span>
                                </div>
                              )}
                            </td>
                          )}
                          {visibleCols.has("status") && (
                            <td className="px-2 py-1.5 text-center">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${sc.class}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${sc.dotClass}`} />
                                {sc.label}
                              </span>
                            </td>
                          )}
                          {visibleCols.has("price") && (
                            <td className="px-3 py-1.5 text-right pr-5 min-w-[140px]">
                              {!isCollaboratorView && (u.status === "reserved" || u.status === "sold") ? (
                                <div className="flex flex-col items-end leading-tight">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${sc.class}`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${sc.dotClass}`} />
                                    {sc.label}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[140px]">
                                    {u.clientName || "Sin asignar"} · OP-{u.ref.split("-").pop()}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-sm font-bold text-foreground tabular-nums">{formatPrice(u.price)}</span>
                              )}
                            </td>
                          )}
                          <td className="px-2 py-1.5 text-right" onClick={e => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors">
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onClick={() => toggleExpandUnit(u.id)} className="gap-2 text-xs">
                                  <Eye className="h-3.5 w-3.5" /> Ver
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={u.status !== "available"}
                                  onClick={() => toast({ title: "Editar unidad", description: getUnitDisplayId(u) })}
                                  className="gap-2 text-xs"
                                >
                                  <Pencil className="h-3.5 w-3.5" /> Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={u.status !== "available"}
                                  onClick={() => setEmailUnitId(u.id)}
                                  className="gap-2 text-xs"
                                >
                                  <Send className="h-3.5 w-3.5" /> Enviar por email
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  disabled={u.status !== "available"}
                                  onClick={() => toast({ title: "Iniciar compra", description: `Operación para ${getUnitDisplayId(u)}` })}
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
            )}

            {isCollapsed && (
              <div className="px-4 py-2 text-xs text-muted-foreground">
                {blockAvail} disponibles · {allBlockUnits.filter(u => u.status === "reserved").length} reservadas · {allBlockUnits.filter(u => u.status === "sold").length} vendidas
              </div>
            )}
          </div>
        );
      })}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-3">
        <span>Mostrando {filtered.length} de {allUnits.length} unidades</span>
      </div>

      {/* Send by email dialog (per-unit, opened from row dropdown) */}
      <SendEmailDialog
        open={emailUnitId !== null}
        onOpenChange={(v) => !v && setEmailUnitId(null)}
        defaultAudience="client"
        mode="unit"
        promotionId={promotionId}
        unitId={emailUnitId ?? undefined}
      />
    </div>
  );
}
