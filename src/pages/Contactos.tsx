/**
 * /contactos · Contact directory.
 *
 * Single role view: contacts belong to the organization. Same filter
 * pattern as Promociones for consistency: search bar + "Filters"
 * button (badge with count) + right-side drawer with grouped sections.
 * Toolbar with status tabs + count + sort.
 *
 * UI in English (per product request: contacts is org-scoped, no
 * Promotor / Agencia split).
 */

import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Plus, X, Sparkles, CalendarCheck, SlidersHorizontal, Upload,
  Filter, Check, Settings2, Pencil, Trash2, Building2, Lock,
  User as UserIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MinimalSort } from "@/components/ui/MinimalSort";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FilterModeChip, type ChipMode } from "@/components/ui/FilterModeChip";
import { MultiSelectFilter } from "@/components/ui/MultiSelectFilter";
import { Highlight } from "@/components/ui/Highlight";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { MOCK_CONTACTS } from "@/components/contacts/data";
import { loadImportedContacts } from "@/components/contacts/importedStorage";
import { loadCreatedContacts } from "@/components/contacts/createdContactsStorage";
import { loadDeletedContactIds } from "@/components/contacts/contactRelationsStorage";
import { EditContactDialog } from "@/components/contacts/detail/EditContactDialog";
import { loadSources } from "@/components/contacts/sourcesStorage";
import {
  loadOrgTags, saveOrgTags, loadPersonalTags, savePersonalTags,
  TAG_COLOR_PALETTE, nextTagId,
} from "@/components/contacts/tagsStorage";
import type { Contact, ContactTag, TagScope } from "@/components/contacts/types";
import { PublicRefBadge } from "@/components/ui/PublicRefBadge";
import { OriginsPill } from "@/components/contacts/OriginsPill";
import { ActivityFreshness } from "@/components/contacts/ActivityFreshness";
import { useCurrentUser, isAdmin } from "@/lib/currentUser";
import { Flag } from "@/components/ui/Flag";

/* ══════ Helpers ══════ */

/** Flag emoji por nombre de país — derivado de los mocks. */
function nationalityFlag(name: string): string | undefined {
  const c = MOCK_CONTACTS.find((c) => c.nationality === name);
  return c?.flag;
}

/** Iniciales de un nombre como string (ej. "Arman Rahmanov" → "AR"). */
function initialsBadge(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/* ══════ Static options ══════ */

const sortOptions = [
  { value: "recent", label: "Más recientes" },
  { value: "opportunities", label: "Más oportunidades" },
  { value: "alphabetical", label: "Alfabético" },
  { value: "oldest", label: "Más antiguos" },
];

const visitOptions = [
  { value: "upcoming", label: "Próxima visita" },
  { value: "done", label: "Visita realizada" },
  { value: "none", label: "Sin visita" },
];

const opportunityOptions = [
  { value: "with", label: "Con oportunidad" },
  { value: "without", label: "Sin oportunidad" },
];

/* ══════ Page ══════ */

export default function Contactos() {
  const navigate = useNavigate();
  /* Deep-link ?q=... · usado desde `/registros` (DuplicateResult)
     para abrir la lista con un filtro precargado (ej. email del
     contacto duplicado). */
  const [searchParams] = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";
  const [search, setSearch] = useState(initialQ);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [sort, setSort] = useState("recent");

  /* Filtros del drawer */
  const [sourceFilter, setSourceFilter] = useState<string[]>([]);
  /* Tags: cada id puede estar en modo "and" | "or" | "exclude".
   * Si no aparece en el record, está "off" (no filtra). */
  const [tagModes, setTagModes] = useState<Record<string, ChipMode>>({});
  const [visitFilter, setVisitFilter] = useState<string[]>([]);
  const [opportunityFilter, setOpportunityFilter] = useState<string[]>([]);
  const [assignedFilter, setAssignedFilter] = useState<string[]>([]);
  const [nationalityFilter, setNationalityFilter] = useState<string[]>([]);

  /* Refresh-tick que se incrementa al crear un contacto nuevo para
   * que el listado lo recoja sin tener que recargar la página. */
  const [createVersion, setCreateVersion] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);

  /* Tags por scope:
   *   - orgTags: las define el admin de la organización; visibles a todos
   *   - personalTags: las del usuario actual; solo él las ve
   * En filtros y chips de la lista las mezclamos: el usuario no necesita
   * pensar de qué scope viene cada tag, solo si la quiere o no.
   */
  const currentUser = useCurrentUser();
  const userIsAdmin = isAdmin(currentUser);
  const viewerIsAgency = currentUser.accountType === "agency";

  /* Universo de contactos = creados (más recientes arriba) + importados
   * por CSV/Excel + mocks del seed, FILTRANDO los marcados como
   * eliminados localmente (mientras no haya backend que lo borre).
   *
   * Scope por rol:
   *   - Promotor: ve los que son del promotor (sin `ownerAgencyId`).
   *   - Agencia:  ve únicamente los que creó ella (`ownerAgencyId`
   *               === agencia actual). NO ve los del promotor ni los de
   *               otras agencias.
   *   Sin backend, nos basta un filtrado sobre el universo agregado. */
  const allContacts = useMemo<Contact[]>(() => {
    const deleted = loadDeletedContactIds();
    return [...loadCreatedContacts(), ...loadImportedContacts(), ...MOCK_CONTACTS]
      .filter((c) => !deleted.has(c.id))
      .filter((c) => {
        if (viewerIsAgency) return c.ownerAgencyId === currentUser.agencyId;
        return !c.ownerAgencyId;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createVersion, viewerIsAgency, currentUser.agencyId]);

  const [orgTags, setOrgTagsState] = useState<ContactTag[]>(() => loadOrgTags());
  const setOrgTags = (next: ContactTag[] | ((prev: ContactTag[]) => ContactTag[])) => {
    setOrgTagsState((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      saveOrgTags(resolved);
      return resolved;
    });
  };

  const [personalTags, setPersonalTagsState] = useState<ContactTag[]>(() =>
    loadPersonalTags(currentUser.id),
  );
  const setPersonalTags = (next: ContactTag[] | ((prev: ContactTag[]) => ContactTag[])) => {
    setPersonalTagsState((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      savePersonalTags(currentUser.id, resolved);
      return resolved;
    });
  };

  /** Tags efectivas para el usuario (org + personal). El orden importa
   * para los chips: org primero, personal después. */
  const tags = useMemo(() => [...orgTags, ...personalTags], [orgTags, personalTags]);
  const tagById = (id: string) => tags.find((t) => t.id === id);

  /* Lista de sources oficial (gestionada por admin desde Ajustes).
   * Se mezcla con cualquier source que aparezca en mocks pero que aún
   * no esté en la lista oficial (para no perder filtros válidos). */
  const allSources = useMemo(() => {
    const orgSources = loadSources().map((s) => s.label);
    const inUse = new Set(allContacts.map((c) => c.source));
    const merged = new Set<string>(orgSources);
    inUse.forEach((s) => merged.add(s));
    return [...merged].sort();
  }, [allContacts]);
  const allAssigned = useMemo(
    () => [...new Set(allContacts.flatMap((c) => c.assignedTo))].sort(),
    [allContacts],
  );
  const allNationalities = useMemo(
    () => [...new Set(allContacts.map((c) => c.nationality).filter(Boolean) as string[])].sort(),
    [allContacts],
  );

  /* Particiones de tag por modo (memoizadas para evitar recompute en
   * cada render — el filtro las usa). */
  const tagsAnd = useMemo(
    () => Object.entries(tagModes).filter(([, m]) => m === "and").map(([id]) => id),
    [tagModes],
  );
  const tagsOr = useMemo(
    () => Object.entries(tagModes).filter(([, m]) => m === "or").map(([id]) => id),
    [tagModes],
  );
  const tagsExclude = useMemo(
    () => Object.entries(tagModes).filter(([, m]) => m === "exclude").map(([id]) => id),
    [tagModes],
  );
  const tagsActive = tagsAnd.length + tagsOr.length + tagsExclude.length;

  /* Conteo activo */
  const activeFilterCount =
    sourceFilter.length +
    tagsActive +
    visitFilter.length +
    opportunityFilter.length +
    assignedFilter.length +
    nationalityFilter.length;

  const clearAllFilters = () => {
    setSourceFilter([]);
    setTagModes({});
    setVisitFilter([]);
    setOpportunityFilter([]);
    setAssignedFilter([]);
    setNationalityFilter([]);
  };

  const setTagMode = (tagId: string, mode: ChipMode) => {
    setTagModes((prev) => {
      const next = { ...prev };
      if (mode === "off") {
        delete next[tagId];
      } else {
        next[tagId] = mode;
      }
      return next;
    });
  };

  const filtered = useMemo(() => {
    return allContacts.filter((c) => {
      if (sourceFilter.length > 0 && !sourceFilter.includes(c.source)) return false;
      // AND: contact must have ALL of these tags
      if (tagsAnd.length > 0 && !tagsAnd.every((t) => c.tags.includes(t))) return false;
      // OR: contact must have AT LEAST ONE of these tags
      if (tagsOr.length > 0 && !tagsOr.some((t) => c.tags.includes(t))) return false;
      // EXCLUDE: contact must NOT have ANY of these tags
      if (tagsExclude.length > 0 && tagsExclude.some((t) => c.tags.includes(t))) return false;
      if (visitFilter.length > 0) {
        if (visitFilter.includes("upcoming") && !c.hasUpcomingVisit) return false;
        if (visitFilter.includes("done") && !c.hasVisitDone) return false;
        if (visitFilter.includes("none") && (c.hasUpcomingVisit || c.hasVisitDone)) return false;
      }
      if (opportunityFilter.length > 0) {
        if (opportunityFilter.includes("with") && c.activeOpportunities === 0) return false;
        if (opportunityFilter.includes("without") && c.activeOpportunities > 0) return false;
      }
      if (assignedFilter.length > 0 && !c.assignedTo.some((a) => assignedFilter.includes(a))) {
        return false;
      }
      if (nationalityFilter.length > 0 && !nationalityFilter.includes(c.nationality ?? "")) {
        return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const haystack =
          `${c.name} ${c.reference ?? ""} ${c.email ?? ""} ${c.nationality ?? ""} ${c.source} ${c.phone ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [
    allContacts, sourceFilter, tagsAnd, tagsOr, tagsExclude, visitFilter,
    opportunityFilter, assignedFilter, nationalityFilter, search,
  ]);

  /* Sort */
  const sortedAndFiltered = useMemo(() => {
    const arr = [...filtered];
    switch (sort) {
      case "opportunities":
        return arr.sort((a, b) => b.activeOpportunities - a.activeOpportunities);
      case "alphabetical":
        return arr.sort((a, b) => a.name.localeCompare(b.name));
      case "oldest":
        return arr.sort((a, b) => a.firstSeen.localeCompare(b.firstSeen));
      case "recent":
      default:
        // Más recientes primero — heurística: si tiene actividad hoy/ayer, sube
        return arr.sort((a, b) => {
          const score = (c: Contact) => {
            if (c.lastActivity.toLowerCase().includes("hour")) return 5;
            if (c.lastActivity.toLowerCase().includes("today")) return 4;
            if (c.lastActivity.toLowerCase().includes("yesterday")) return 3;
            if (c.lastActivity.toLowerCase().includes("day")) return 2;
            if (c.lastActivity.toLowerCase().includes("week")) return 1;
            return 0;
          };
          return score(b) - score(a);
        });
    }
  }, [filtered, sort]);

  return (
    <div className="flex flex-col min-h-full bg-background">
      {/* ═══════════ HEADER (mismo patrón que Promociones) ═══════════ */}
      <div className="px-3 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-3">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
          <div className="shrink-0 min-w-0">
            <h1 className="text-[19px] sm:text-[22px] font-bold tracking-tight leading-tight">
              Contactos
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:ml-auto flex-1 sm:flex-initial sm:max-w-[640px]">
            {/* Search */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 z-10" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, email, país…"
                className="w-full h-9 pl-9 pr-9 text-sm bg-card border border-border rounded-full focus:border-primary outline-none transition-colors"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filters trigger */}
            <button
              onClick={() => setFiltersOpen(true)}
              className={cn(
                "inline-flex items-center gap-1.5 h-9 px-3 sm:px-4 rounded-full border text-sm font-medium transition-colors shrink-0",
                activeFilterCount > 0
                  ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                  : "bg-card border-border text-foreground hover:border-foreground/30",
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Filtros</span>
              {activeFilterCount > 0 && (
                <span className="ml-0.5 bg-primary-foreground/20 rounded-full h-5 min-w-[20px] px-1 text-[11px] font-bold grid place-items-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <button
              onClick={() => navigate("/ajustes/contactos/importar")}
              className="inline-flex items-center justify-center h-9 w-9 sm:w-auto sm:px-4 sm:gap-1.5 rounded-full border border-border bg-card text-foreground text-sm font-medium hover:bg-muted transition-colors shrink-0"
              title="Importar contactos desde CSV / Excel"
            >
              <Upload className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Importar</span>
            </button>

            <button
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3 sm:px-4 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors shadow-soft shrink-0"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              <span className="hidden md:inline">Nuevo contacto</span>
            </button>
          </div>
        </div>
      </div>

      <div className="h-px bg-border/60" />

      {/* ═══════════ Toolbar (count + sort) ═══════════ */}
      <div className="px-3 sm:px-6 lg:px-8 py-2.5">
        <div className="max-w-[1400px] mx-auto flex items-center justify-end gap-3 sm:gap-4">
          <span className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground tnum">{sortedAndFiltered.length}</span>{" "}
            {sortedAndFiltered.length === 1 ? "contacto" : "contactos"}
          </span>
          <MinimalSort value={sort} options={sortOptions} onChange={setSort} label="Ordenar por" />
        </div>
      </div>

      {/* ═══════════ List ═══════════ */}
      <div className="flex-1 px-3 sm:px-6 lg:px-8 pb-8">
        <div className="max-w-[1400px] mx-auto flex flex-col gap-2">
          {sortedAndFiltered.length === 0 ? (
            <EmptyState onClear={() => { setSearch(""); clearAllFilters(); }} />
          ) : (
            sortedAndFiltered.map((c) => (
              <ContactRow
                key={c.id}
                contact={c}
                query={search}
                tags={tags}
                onClick={() => navigate(`/contactos/${c.id}`)}
              />
            ))
          )}
        </div>
      </div>

      {/* ═══════════ FILTERS DRAWER (estilo Promociones) ═══════════ */}
      <AnimatePresence>
        {filtersOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/25 backdrop-blur-sm"
              onClick={() => setFiltersOpen(false)}
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[440px] bg-card border-l border-border shadow-soft-lg flex flex-col"
            >
              {/* Header */}
              <header className="h-14 shrink-0 flex items-center justify-between px-5 border-b border-border">
                <div>
                  <h2 className="text-[15px] font-semibold tracking-tight">Filtros</h2>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5">
                    {activeFilterCount === 0
                      ? "Sin filtros aplicados"
                      : `${activeFilterCount} ${activeFilterCount === 1 ? "filtro activo" : "filtros activos"}`}
                  </p>
                </div>
                <button
                  onClick={() => setFiltersOpen(false)}
                  className="p-2 -mr-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Cerrar filtros"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-7">
                <div className="space-y-5">
                  <SectionTitle>Origen y perfil</SectionTitle>

                  <div>
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <h4 className="text-[13px] font-semibold text-foreground">Origen</h4>
                      {sourceFilter.length > 0 && (
                        <button
                          onClick={() => setSourceFilter([])}
                          className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                        >
                          Limpiar
                        </button>
                      )}
                    </div>
                    <MultiSelectFilter
                      placeholder="Selecciona orígenes…"
                      options={allSources.map((s) => ({ value: s, label: s }))}
                      selected={sourceFilter}
                      onChange={setSourceFilter}
                      searchable={allSources.length > 8}
                      searchPlaceholder="Buscar origen…"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <h4 className="text-[13px] font-semibold text-foreground">Nacionalidad</h4>
                      {nationalityFilter.length > 0 && (
                        <button
                          onClick={() => setNationalityFilter([])}
                          className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                        >
                          Limpiar
                        </button>
                      )}
                    </div>
                    <MultiSelectFilter
                      placeholder="Selecciona países…"
                      options={allNationalities.map((n) => ({
                        value: n,
                        label: n,
                        prefix: nationalityFlag(n),
                      }))}
                      selected={nationalityFilter}
                      onChange={setNationalityFilter}
                      searchable
                      searchPlaceholder="Buscar país…"
                    />
                  </div>

                  <TagsFilterSection
                    orgTags={orgTags}
                    personalTags={personalTags}
                    canEditOrg={userIsAdmin}
                    tagModes={tagModes}
                    onChangeMode={setTagMode}
                    onClearAll={() => setTagModes({})}
                    onCreateTag={(name, scope) => {
                      const allTags = [...orgTags, ...personalTags];
                      const id = nextTagId(allTags);
                      const color = TAG_COLOR_PALETTE[allTags.length % TAG_COLOR_PALETTE.length];
                      const newTag: ContactTag = {
                        id,
                        label: name,
                        color,
                        scope,
                        createdBy: currentUser.id,
                      };
                      if (scope === "organization") {
                        setOrgTags([...orgTags, newTag]);
                      } else {
                        setPersonalTags([...personalTags, newTag]);
                      }
                      toast.success(
                        `Etiqueta ${scope === "organization" ? "de organización" : "personal"} "${name}" creada`,
                      );
                    }}
                    onRenameTag={(id, name) => {
                      const tag = tagById(id);
                      if (!tag) return;
                      if (tag.scope === "organization") {
                        setOrgTags(orgTags.map((t) => (t.id === id ? { ...t, label: name } : t)));
                      } else {
                        setPersonalTags(
                          personalTags.map((t) => (t.id === id ? { ...t, label: name } : t)),
                        );
                      }
                      toast.success(`Etiqueta renombrada a "${name}"`);
                    }}
                    onDeleteTag={(id) => {
                      const tag = tagById(id);
                      if (!tag) return;
                      if (tag.scope === "organization") {
                        setOrgTags(orgTags.filter((t) => t.id !== id));
                      } else {
                        setPersonalTags(personalTags.filter((t) => t.id !== id));
                      }
                      setTagModes((prev) => {
                        const next = { ...prev };
                        delete next[id];
                        return next;
                      });
                      toast.success(`Etiqueta "${tag.label}" eliminada`);
                    }}
                    onChangeColor={(id, color) => {
                      const tag = tagById(id);
                      if (!tag) return;
                      if (tag.scope === "organization") {
                        setOrgTags(orgTags.map((t) => (t.id === id ? { ...t, color } : t)));
                      } else {
                        setPersonalTags(
                          personalTags.map((t) => (t.id === id ? { ...t, color } : t)),
                        );
                      }
                    }}
                  />
                </div>

                <div className="h-px bg-border" />

                <div className="space-y-5">
                  <SectionTitle>Actividad</SectionTitle>

                  <div>
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <h4 className="text-[13px] font-semibold text-foreground">Visita</h4>
                      {visitFilter.length > 0 && (
                        <button
                          onClick={() => setVisitFilter([])}
                          className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                        >
                          Limpiar
                        </button>
                      )}
                    </div>
                    <MultiSelectFilter
                      placeholder="Cualquier estado…"
                      options={visitOptions}
                      selected={visitFilter}
                      onChange={setVisitFilter}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <h4 className="text-[13px] font-semibold text-foreground">Oportunidad</h4>
                      {opportunityFilter.length > 0 && (
                        <button
                          onClick={() => setOpportunityFilter([])}
                          className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                        >
                          Limpiar
                        </button>
                      )}
                    </div>
                    <MultiSelectFilter
                      placeholder="Cualquier oportunidad…"
                      options={opportunityOptions}
                      selected={opportunityFilter}
                      onChange={setOpportunityFilter}
                    />
                  </div>
                </div>

                <div className="h-px bg-border" />

                <div className="space-y-5">
                  <SectionTitle>Asignación</SectionTitle>
                  <div>
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <h4 className="text-[13px] font-semibold text-foreground">Asignado a</h4>
                      {assignedFilter.length > 0 && (
                        <button
                          onClick={() => setAssignedFilter([])}
                          className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                        >
                          Limpiar
                        </button>
                      )}
                    </div>
                    <MultiSelectFilter
                      placeholder="Selecciona usuarios…"
                      options={allAssigned.map((a) => ({
                        value: a,
                        label: a,
                        prefix: initialsBadge(a),
                      }))}
                      selected={assignedFilter}
                      onChange={setAssignedFilter}
                      searchable={allAssigned.length > 8}
                      searchPlaceholder="Buscar usuario…"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <footer className="h-[72px] shrink-0 border-t border-border flex items-center justify-between gap-3 px-5">
                <button
                  onClick={clearAllFilters}
                  disabled={activeFilterCount === 0}
                  className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Limpiar todo
                </button>
                <button
                  onClick={() => setFiltersOpen(false)}
                  className="inline-flex items-center h-10 px-5 rounded-full bg-foreground text-background text-sm font-medium hover:bg-foreground/90 transition-colors shadow-soft"
                >
                  Ver {sortedAndFiltered.length} {sortedAndFiltered.length === 1 ? "contacto" : "contactos"}
                </button>
              </footer>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Dialog "Nuevo contacto" — reusa EditContactDialog en modo crear. */}
      <EditContactDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        detail={null}
        onSaved={() => setCreateVersion((v) => v + 1)}
        onCreated={(contact) => {
          setCreateVersion((v) => v + 1);
          /* Lleva al usuario directo a la ficha del contacto creado. */
          navigate(`/contactos/${contact.id}`);
        }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════════ */

function ContactRow({
  contact,
  query,
  tags: allTags,
  onClick,
}: {
  contact: Contact;
  query: string;
  tags: ContactTag[];
  onClick: () => void;
}) {
  const initials = contact.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const tags = contact.tags
    .map((id) => allTags.find((t) => t.id === id))
    .filter(Boolean) as ContactTag[];

  return (
    <button
      onClick={onClick}
      className="group w-full text-left rounded-2xl px-4 sm:px-5 py-3.5 transition-all border border-border bg-card shadow-soft hover:shadow-soft-lg hover:-translate-y-0.5 duration-200 flex items-center gap-4"
    >
      <Avatar className="h-11 w-11 shrink-0">
        <AvatarFallback className="bg-muted text-muted-foreground text-xs font-bold">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        {/* Row 1: name + flag + reference + status */}
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-foreground leading-snug truncate">
            <Highlight text={contact.name} query={query} />
          </span>
          {contact.nationalityIso && (
            <Flag iso={contact.nationalityIso} size={12} className="shrink-0" title={contact.nationality} />
          )}
          {contact.publicRef && (
            <PublicRefBadge value={contact.publicRef} size="sm" copyable={false} className="hidden sm:inline-flex" />
          )}
          {contact.status === "converted" && (
            <span className="text-[10px] font-semibold text-success shrink-0">
              · Cliente
            </span>
          )}
          {contact.status === "cold" && (
            <span className="text-[10px] text-muted-foreground/70 shrink-0">· Frío</span>
          )}
        </div>

        {/* Row 2: contact info + indicators */}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {contact.email && (
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
              <Highlight text={contact.email} query={query} />
            </span>
          )}
          {contact.phone && (
            <span className="text-xs text-muted-foreground/60 hidden sm:inline">
              <Highlight text={contact.phone} query={query} />
            </span>
          )}

          {contact.origins && contact.origins.length > 0 && (
            <>
              <span className="h-3 w-px bg-border mx-0.5 hidden sm:block" />
              <OriginsPill contact={contact} className="hidden sm:inline-flex" />
            </>
          )}

          {(contact.activeOpportunities > 0 || contact.hasUpcomingVisit || tags.length > 0) && (
            <span className="h-3 w-px bg-border mx-0.5 hidden sm:block" />
          )}

          {tags.slice(0, 2).map((tag) =>
            tag ? (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-foreground border border-border"
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", tag.color)} />
                {tag.label}
              </span>
            ) : null,
          )}
          {tags.length > 2 && (
            <span className="text-[10px] text-muted-foreground">+{tags.length - 2}</span>
          )}

          {contact.activeOpportunities > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary">
              <Sparkles className="h-2.5 w-2.5" />
              {contact.activeOpportunities}
            </span>
          )}

          {contact.hasUpcomingVisit && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-success">
              <CalendarCheck className="h-2.5 w-2.5" />
              <span className="hidden sm:inline">Visit</span>
            </span>
          )}
        </div>
      </div>

      {/* Right side · freshness pill colored según días sin actividad */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <ActivityFreshness lastActivityAt={contact.lastActivityAt} />
        {contact.activeOpportunities > 0 && (
          <span className="h-2 w-2 rounded-full bg-primary" />
        )}
      </div>
    </button>
  );
}

/* ── Filter drawer pieces (mismo patrón que Promociones) ── */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </p>
  );
}

/* (FilterGroup y SearchableFilterGroup eliminados — todo el drawer
 * usa MultiSelectFilter o TagsFilterSection ahora.) */

/**
 * TagsFilterSection · sección de tags del drawer.
 *
 * Modelo de permisos:
 *   - **Organization tags**: visibles a todos. Solo el admin
 *     (`canEditOrg`) puede crear/renombrar/borrar/cambiar color.
 *     Los miembros no-admin las ven en el manage popover sin
 *     botones de acción y con un candado.
 *   - **Personal tags**: cualquier usuario CRUD las suyas.
 *
 * En los chips del filtro y en las cards de la lista no se distingue
 * de qué scope viene cada tag — el usuario solo necesita saber si la
 * quiere o no.
 */
function TagsFilterSection({
  orgTags,
  personalTags,
  canEditOrg,
  tagModes,
  onChangeMode,
  onClearAll,
  onCreateTag,
  onRenameTag,
  onDeleteTag,
  onChangeColor,
}: {
  orgTags: ContactTag[];
  personalTags: ContactTag[];
  /** true si el usuario actual es admin de la organización. */
  canEditOrg: boolean;
  tagModes: Record<string, ChipMode>;
  onChangeMode: (tagId: string, mode: ChipMode) => void;
  onClearAll: () => void;
  onCreateTag: (name: string, scope: TagScope) => void;
  onRenameTag: (id: string, name: string) => void;
  onDeleteTag: (id: string) => void;
  onChangeColor: (id: string, color: string) => void;
}) {
  const allTags = [...orgTags, ...personalTags];
  const activeCount = Object.keys(tagModes).length;
  const [creating, setCreating] = useState<TagScope | null>(null);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const submitCreate = () => {
    if (!creating) return;
    const clean = newName.trim();
    if (!clean) {
      setCreating(null);
      setNewName("");
      return;
    }
    /* Anti-duplicado solo dentro del mismo scope (un usuario puede
     * tener su tag personal "VIP" aunque exista una org "VIP"). */
    const sameScope = creating === "organization" ? orgTags : personalTags;
    if (sameScope.some((t) => t.label.toLowerCase() === clean.toLowerCase())) {
      toast.error("Ya existe una etiqueta con ese nombre en este ámbito");
      return;
    }
    onCreateTag(clean, creating);
    setNewName("");
    setCreating(null);
  };

  const submitRename = (id: string) => {
    const clean = editName.trim();
    if (!clean) {
      setEditingId(null);
      return;
    }
    onRenameTag(id, clean);
    setEditingId(null);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2 gap-2">
        <h4 className="text-[13px] font-semibold text-foreground">Etiquetas</h4>
        <div className="flex items-center gap-1">
          {activeCount > 0 && (
            <button
              onClick={onClearAll}
              className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
            >
              Limpiar
            </button>
          )}
          {/* Settings popover: manage tags por scope */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                title="Gestionar etiquetas"
                className="h-6 w-6 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <Settings2 className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[320px] p-0 rounded-2xl border-border shadow-soft-lg overflow-hidden"
            >
              {/* ── Organization section ── */}
              <div className="px-3 pt-3 pb-2 bg-muted/30 border-b border-border">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-3 w-3 text-muted-foreground" />
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Organización
                    </p>
                    {!canEditOrg && <Lock className="h-2.5 w-2.5 text-muted-foreground/60" />}
                  </div>
                  {canEditOrg && (
                    <button
                      onClick={() => {
                        setCreating("organization");
                        setNewName("");
                      }}
                      className="inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10.5px] font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors"
                    >
                      <Plus className="h-3 w-3" /> Nueva
                    </button>
                  )}
                </div>
                {!canEditOrg && (
                  <p className="text-[10px] text-muted-foreground/70 leading-snug">
                    Solo los administradores pueden editar etiquetas de organización
                  </p>
                )}
              </div>

              <div className="max-h-[180px] overflow-y-auto px-2 py-1.5">
                {creating === "organization" && <CreateInput value={newName} onChange={setNewName} onSubmit={submitCreate} onCancel={() => { setCreating(null); setNewName(""); }} />}
                {orgTags.length === 0 && creating !== "organization" && (
                  <p className="px-3 py-2 text-[11px] text-muted-foreground text-center italic">
                    Sin etiquetas de organización
                  </p>
                )}
                {orgTags.map((t) => (
                  <TagRow
                    key={t.id}
                    tag={t}
                    canEdit={canEditOrg}
                    isEditing={editingId === t.id}
                    editName={editName}
                    onStartRename={() => { setEditingId(t.id); setEditName(t.label); }}
                    onChangeRename={setEditName}
                    onSubmitRename={() => submitRename(t.id)}
                    onCancelRename={() => setEditingId(null)}
                    onDelete={() => onDeleteTag(t.id)}
                    onChangeColor={(c) => onChangeColor(t.id, c)}
                  />
                ))}
              </div>

              {/* ── Personal section ── */}
              <div className="px-3 pt-3 pb-2 bg-card border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <UserIcon className="h-3 w-3 text-muted-foreground" />
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Mis etiquetas
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setCreating("personal");
                      setNewName("");
                    }}
                    className="inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10.5px] font-medium bg-foreground text-background hover:bg-foreground/90 transition-colors"
                  >
                    <Plus className="h-3 w-3" /> Nueva
                  </button>
                </div>
              </div>

              <div className="max-h-[180px] overflow-y-auto px-2 py-1.5">
                {creating === "personal" && <CreateInput value={newName} onChange={setNewName} onSubmit={submitCreate} onCancel={() => { setCreating(null); setNewName(""); }} />}
                {personalTags.length === 0 && creating !== "personal" && (
                  <p className="px-3 py-2 text-[11px] text-muted-foreground text-center italic">
                    Sin etiquetas personales — solo tú las verás
                  </p>
                )}
                {personalTags.map((t) => (
                  <TagRow
                    key={t.id}
                    tag={t}
                    canEdit
                    isEditing={editingId === t.id}
                    editName={editName}
                    onStartRename={() => { setEditingId(t.id); setEditName(t.label); }}
                    onChangeRename={setEditName}
                    onSubmitRename={() => submitRename(t.id)}
                    onCancelRename={() => setEditingId(null)}
                    onDelete={() => onDeleteTag(t.id)}
                    onChangeColor={(c) => onChangeColor(t.id, c)}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Hint cuando hay alguno seleccionado */}
      {activeCount > 0 && (
        <p className="text-[10.5px] text-muted-foreground mb-2 leading-relaxed">
          Pasa el ratón por una etiqueta para alternar entre <strong>y / o / excluir</strong>
        </p>
      )}

      {/* Tag chips · org y personal mezclados (org primero por orden) */}
      <div className="flex flex-wrap gap-1.5">
        {allTags.length === 0 ? (
          <p className="text-[11.5px] text-muted-foreground italic px-1">
            Sin etiquetas — crea una con el icono ⚙
          </p>
        ) : (
          allTags.map((t) => (
            <FilterModeChip
              key={t.id}
              label={t.label}
              color={t.color}
              mode={tagModes[t.id] ?? "off"}
              onModeChange={(mode) => onChangeMode(t.id, mode)}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* ══════ Sub-componentes del manage popover de tags ══════ */

function CreateInput({
  value, onChange, onSubmit, onCancel,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 mb-1 bg-muted/40 rounded-md">
      <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit();
          if (e.key === "Escape") onCancel();
        }}
        onBlur={onSubmit}
        placeholder="Nombre de la etiqueta…"
        className="flex-1 bg-transparent outline-none text-xs"
      />
    </div>
  );
}

function TagRow({
  tag,
  canEdit,
  isEditing,
  editName,
  onStartRename,
  onChangeRename,
  onSubmitRename,
  onCancelRename,
  onDelete,
  onChangeColor,
}: {
  tag: ContactTag;
  canEdit: boolean;
  isEditing: boolean;
  editName: string;
  onStartRename: () => void;
  onChangeRename: (v: string) => void;
  onSubmitRename: () => void;
  onCancelRename: () => void;
  onDelete: () => void;
  onChangeColor: (color: string) => void;
}) {
  return (
    <div className="group flex items-center gap-2 px-2 py-1 rounded-md hover:bg-muted/40 transition-colors">
      {/* Color picker */}
      {canEdit ? (
        <Popover>
          <PopoverTrigger asChild>
            <button
              title="Cambiar color"
              className={cn("h-4 w-4 rounded-full shrink-0 transition-transform hover:scale-110", tag.color)}
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
                  onClick={() => onChangeColor(c)}
                  className={cn(
                    "h-5 w-5 rounded-full transition-transform hover:scale-110",
                    c,
                    tag.color === c && "ring-2 ring-foreground ring-offset-1",
                  )}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        <span className={cn("h-4 w-4 rounded-full shrink-0", tag.color)} />
      )}

      {/* Name (editable si canEdit) */}
      {isEditing && canEdit ? (
        <input
          autoFocus
          value={editName}
          onChange={(e) => onChangeRename(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmitRename();
            if (e.key === "Escape") onCancelRename();
          }}
          onBlur={onSubmitRename}
          className="flex-1 bg-transparent outline-none text-xs border-b border-border focus:border-primary py-0.5"
        />
      ) : (
        <span className="flex-1 text-xs text-foreground truncate">{tag.label}</span>
      )}

      {/* Actions — sólo si canEdit */}
      {canEdit && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onStartRename}
            title="Renombrar"
            className="h-6 w-6 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={onDelete}
            title="Eliminar etiqueta"
            className="h-6 w-6 rounded-full hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Filter className="h-8 w-8 text-muted-foreground/30 mb-2" />
      <p className="text-sm text-muted-foreground">Ningún contacto coincide con tus filtros</p>
      <button
        onClick={onClear}
        className="text-xs text-primary hover:underline mt-2"
      >
        Limpiar todos los filtros
      </button>
    </div>
  );
}
