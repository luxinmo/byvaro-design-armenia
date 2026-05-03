/**
 * UnitSimpleEditDialog · Modal de edición de unidad desde el wizard.
 *
 * Secciones:
 *   1. Carpeta Drive (placeholder).
 *   2. Fotos · UN solo bloque. Toggle "Incluir fotos de la promoción".
 *        - ON: grid de heredadas con checkbox por foto (las excluidas
 *          quedan en escala de grises) + MultimediaEditor para fotos
 *          propias (drag, principal, bloquear, categoría, eliminar).
 *        - OFF: solo MultimediaEditor (ignora heredadas).
 *   3. Plano de unidad (toggle + uploader).
 *   4. Descripción heredada con botón "Personalizar".
 *   5. Características heredadas editables.
 *   6. Plan de pagos, Año entrega, Certificación energética (read-only,
 *      se editan por unidad en la ficha de detalle).
 */

import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/Checkbox";
import { Switch } from "@/components/ui/Switch";
import { cn } from "@/lib/utils";
import {
  FileText, ImageIcon, Check, AlignLeft, CreditCard, Calendar, Leaf,
  Sparkles, Loader2, Upload, Plus, Trash2 as TrashIcon, HardHat,
} from "lucide-react";
import { MultimediaEditor } from "@/components/shared/MultimediaEditor";
import { caracteristicasViviendaOptions, subtipoUnidadOptions, faseConstruccionOptions } from "./options";
import type {
  UnitData, WizardState, FotoItem, VideoItem, FotoCategoria,
  SubtipoUnidad, UnitStatus, FaseConstruccion, HitoPago,
} from "./types";

const formatEur = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

export function UnitSimpleEditDialog({
  open, onOpenChange, unit, state, onUpdate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  unit: UnitData | null;
  state: WizardState;
  onUpdate: (patch: Partial<UnitData>) => void;
}) {
  const isUnifamiliar = state.tipo === "unifamiliar";
  const isEdificio = state.tipo === "plurifamiliar" || state.tipo === "mixto";

  /* Opciones de planta derivadas de la config del edificio (plurifamiliar).
     En unifamiliar no hay concepto de planta de edificio: ofrecemos un
     único "Planta 0 / única". */
  const plantaOptions = useMemo(() => {
    if (!isEdificio) return [{ value: 0, label: "Planta única" }];
    const opts: { value: number; label: string }[] = [];
    if (state.plantaBajaTipo === "viviendas") opts.push({ value: 0, label: "Planta Baja" });
    const endFloor = state.plantaBajaTipo === "viviendas" ? state.plantas - 1 : state.plantas;
    if (state.plantaBajaTipo !== "viviendas") {
      // Plantas intermedias 1..endFloor-1 + Ático en endFloor
      for (let i = 1; i < endFloor; i++) opts.push({ value: i, label: `Planta ${i}` });
      opts.push({ value: endFloor, label: `Ático (P${endFloor})` });
    } else {
      for (let i = 1; i < endFloor; i++) opts.push({ value: i, label: `Planta ${i}` });
      if (endFloor > 0) opts.push({ value: endFloor, label: `Ático (P${endFloor})` });
    }
    return opts;
  }, [state.plantas, state.plantaBajaTipo, isEdificio]);

  /* ── Hooks · DEBEN ir antes de cualquier early return (Rules of
   *  Hooks). Cuando `unit` es null el modal está cerrado y el componente
   *  retorna abajo. Si llamáramos a useState/useMemo después del return,
   *  el número de hooks variaría entre renders y React explotaría con
   *  pantalla en blanco. */
  const fotosUnidadArr = unit?.fotosUnidad || [];
  const ownFotos = useMemo(
    () => fotosUnidadArr.filter((f) => !f.id.startsWith("disabled-")),
    [fotosUnidadArr],
  );
  const [descGenerating, setDescGenerating] = useState(false);
  const [planosOpen, setPlanosOpen] = useState(false);

  if (!unit) return null;

  const includeHereditary = unit.usarFotosPromocion ?? true;
  const isDisabled = (promoFotoId: string) =>
    fotosUnidadArr.some((f) => f.id === `disabled-${promoFotoId}`);
  const excludedCount = fotosUnidadArr.filter((f) => f.id.startsWith("disabled-")).length;

  const toggleHeritedFoto = (promoFotoId: string) => {
    if (isDisabled(promoFotoId)) {
      onUpdate({ fotosUnidad: fotosUnidadArr.filter((f) => f.id !== `disabled-${promoFotoId}`) });
    } else {
      onUpdate({
        fotosUnidad: [
          ...fotosUnidadArr,
          { id: `disabled-${promoFotoId}`, url: "", nombre: "", categoria: "otra" as FotoCategoria, esPrincipal: false, bloqueada: false, orden: 0 },
        ],
      });
    }
  };

  const handleOwnFotosChange = (nextOwn: FotoItem[]) => {
    const disabledSentinels = fotosUnidadArr.filter((f) => f.id.startsWith("disabled-"));
    onUpdate({ fotosUnidad: [...nextOwn, ...disabledSentinels] });
  };

  const toggleCaracteristica = (v: string) => {
    const cur = unit.caracteristicas || [];
    onUpdate({ caracteristicas: cur.includes(v) ? cur.filter((c) => c !== v) : [...cur, v] });
  };
  const resetCaracteristicas = () => {
    onUpdate({ caracteristicas: [...(state.caracteristicasVivienda || [])] });
  };

  const inheritedCount = state.caracteristicasVivienda?.length ?? 0;
  const unitCount = unit.caracteristicas?.length ?? 0;
  const isCharsInherited = inheritedCount === unitCount &&
    (state.caracteristicasVivienda || []).every((c) => unit.caracteristicas?.includes(c));

  /* ── Descripción · heredada + override por unidad ── */
  const heritedDescription = state.descripcion || "";
  const hasDescOverride = unit.descripcionOverride !== undefined;
  const effectiveDescription = unit.descripcionOverride ?? heritedDescription;

  /* ── Plan de pagos · heredado + override ── */
  const heritedHitos = state.hitosPago ?? [];
  const hasHitosOverride = unit.hitosPagoOverride !== undefined;
  const effectiveHitos: HitoPago[] = unit.hitosPagoOverride ?? heritedHitos;
  const updateHito = (idx: number, patch: Partial<HitoPago>) => {
    const next = (unit.hitosPagoOverride ?? heritedHitos).map((h, i) => i === idx ? { ...h, ...patch } : h);
    onUpdate({ hitosPagoOverride: next });
  };
  const addHito = () => {
    const cur = unit.hitosPagoOverride ?? [];
    onUpdate({ hitosPagoOverride: [...cur, { porcentaje: 0, descripcion: "" }] });
  };
  const removeHito = (idx: number) => {
    const cur = unit.hitosPagoOverride ?? [];
    onUpdate({ hitosPagoOverride: cur.filter((_, i) => i !== idx) });
  };

  /* ── Descripción · generación IA mock ── */
  const handleDescGenerate = () => {
    setDescGenerating(true);
    setTimeout(() => {
      const mock = `${unit.nombre} · ${unit.dormitorios} dormitorios, ${unit.banos} baños y ${unit.superficieConstruida} m² construidos. Orientación ${unit.orientacion}. Una vivienda única dentro de ${state.nombrePromocion || "la promoción"}.`;
      onUpdate({ descripcionOverride: mock });
      setDescGenerating(false);
    }, 700);
  };

  /* ── Planos · modal multi-doc ── */
  const planoUrls = unit.planoUrls ?? [];
  const addPlanosMock = () => {
    const urls = [
      `https://picsum.photos/seed/${unit.id}-plano-${Date.now()}/800/600`,
    ];
    onUpdate({ planoUrls: [...planoUrls, ...urls] });
  };
  const removePlano = (idx: number) => {
    onUpdate({ planoUrls: planoUrls.filter((_, i) => i !== idx) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-3xl w-[calc(100vw-32px)] h-[calc(100vh-64px)] max-h-[760px] overflow-hidden rounded-2xl flex flex-col">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/40">
          <DialogTitle className="text-base font-semibold">
            Editar {unit.nombre}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Datos heredados de la promoción. Personaliza solo lo que sea específico de esta unidad.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-6">
          {/* ═════ Carpeta Drive · placeholder ═════
               TODO(backend): POST /api/promociones/:id/units/:ref/drive-folder
               al persistir; sync automático de fotos/planos subidos aquí. */}
          {unit.ref && (
            <div className="rounded-lg bg-muted/30 border border-dashed border-border px-3 py-2 flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
              <p className="text-[11px] text-muted-foreground">
                Carpeta Drive: <span className="font-semibold text-foreground">{state.nombrePromocion || "Promoción"} / {unit.ref}</span>
              </p>
            </div>
          )}

          {/* ═════ Datos básicos de la unidad ═════ */}
          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Datos básicos</h3>

            {/* ID visible (editable) + Referencia (read-only, interna) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <LabeledText label="ID visible"
                value={unit.nombre}
                onChange={(v) => onUpdate({ nombre: v })}
                placeholder="Villa 1 / 1ºA" />
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[10px] text-muted-foreground">
                  Referencia <span className="text-muted-foreground/60">· interna, no editable</span>
                </span>
                <div className="h-8 rounded-lg border border-border bg-muted/30 text-sm px-2 flex items-center font-mono text-muted-foreground tnum">
                  {unit.ref || "—"}
                </div>
              </div>
            </div>

            {/* Subtipo + Estado + Planta (desplegable) + Orientación */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <LabeledSelect label="Subtipo"
                value={unit.subtipo ?? "apartamento"}
                onChange={(v) => onUpdate({ subtipo: v as SubtipoUnidad })}
                options={subtipoUnidadOptions.map((o) => ({ value: o.value, label: o.label }))} />
              <LabeledSelect label="Estado"
                value={unit.status}
                onChange={(v) => onUpdate({ status: v as UnitStatus })}
                options={[
                  { value: "available",  label: "Disponible" },
                  { value: "reserved",   label: "Reservada" },
                  { value: "sold",       label: "Vendida" },
                  { value: "withdrawn",  label: "Retirada" },
                ]} />
              <LabeledSelect label="Planta"
                value={String(unit.planta)}
                onChange={(v) => onUpdate({ planta: Number(v) })}
                options={plantaOptions.map((o) => ({ value: String(o.value), label: o.label }))} />
              <LabeledSelect label="Orientación"
                value={unit.orientacion}
                onChange={(v) => onUpdate({ orientacion: v })}
                options={["Norte", "Sur", "Este", "Oeste", "NE", "NO", "SE", "SO"].map((o) => ({ value: o, label: o }))} />
            </div>

            {/* Dormitorios · baños · precio */}
            <div className="grid grid-cols-3 gap-2">
              <LabeledNumber label="Dormitorios"
                value={unit.dormitorios}
                onChange={(n) => onUpdate({ dormitorios: n })} min={0} />
              <LabeledNumber label="Baños"
                value={unit.banos}
                onChange={(n) => onUpdate({ banos: n })} min={0} />
              <LabeledNumber label="Precio (€)"
                value={unit.precio}
                onChange={(n) => onUpdate({ precio: n })} min={0} />
            </div>

            {/* Superficies */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <LabeledNumber label="Construida (m²)"
                value={unit.superficieConstruida}
                onChange={(n) => onUpdate({ superficieConstruida: n })} min={0} />
              <LabeledNumber label="Útil (m²)"
                value={unit.superficieUtil}
                onChange={(n) => onUpdate({ superficieUtil: n })} min={0} />
              <LabeledNumber label="Terraza (m²)"
                value={unit.superficieTerraza}
                onChange={(n) => onUpdate({ superficieTerraza: n })} min={0} />
              <LabeledNumber label="Parcela (m²)"
                value={unit.parcela}
                onChange={(n) => onUpdate({ parcela: n })} min={0} />
            </div>

            {/* Anejos · parking · trastero · piscina privada */}
            <div className="flex flex-wrap gap-2">
              {([
                { key: "parking" as const, label: "Parking" },
                { key: "trastero" as const, label: "Trastero" },
                { key: "piscinaPrivada" as const, label: "Piscina privada" },
              ]).map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => onUpdate({ [b.key]: !unit[b.key] } as Partial<UnitData>)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    unit[b.key]
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {b.label}: {unit[b.key] ? "Sí" : "No"}
                </button>
              ))}
            </div>
          </section>

          {/* ═════ Fotos · bloque único con toggle de heredadas ═════ */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Fotos</h3>
                <p className="text-[10px] text-muted-foreground/80">
                  Las de la promoción se heredan por defecto. Añade fotos propias para completar.
                </p>
              </div>
              {state.fotos.length > 0 && (
                <label className="inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <Switch
                    checked={includeHereditary}
                    onCheckedChange={(v) => onUpdate({ usarFotosPromocion: v })}
                  />
                  Incluir heredadas ({state.fotos.length})
                </label>
              )}
            </div>

            {/* Grid de heredadas · solo si toggle ON y hay fotos de promoción */}
            {includeHereditary && state.fotos.length > 0 && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
                    Heredadas de la promoción
                  </p>
                  <span className="text-[10px] text-muted-foreground tnum">
                    {state.fotos.length - excludedCount}/{state.fotos.length} activas · desmarca para excluir
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {state.fotos.map((foto) => {
                    const disabled = isDisabled(foto.id);
                    return (
                      <div
                        key={foto.id}
                        className={cn(
                          "relative rounded-xl overflow-hidden border bg-card transition-all",
                          disabled ? "border-border opacity-60" : "border-primary/30",
                        )}
                      >
                        <div className="aspect-square bg-muted relative">
                          {foto.url ? (
                            <img
                              src={foto.url}
                              alt={foto.nombre}
                              className={cn("w-full h-full object-cover transition-all", disabled && "grayscale")}
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="h-5 w-5 text-muted-foreground/30" strokeWidth={1.5} />
                            </div>
                          )}
                          <span className="absolute top-1.5 left-1.5 text-[9px] font-semibold bg-background/85 backdrop-blur-sm text-foreground px-1.5 py-0.5 rounded">
                            Heredada
                          </span>
                          <label className="absolute top-1.5 right-1.5 h-6 w-6 rounded-md bg-background/85 backdrop-blur-sm flex items-center justify-center cursor-pointer">
                            <Checkbox
                              checked={!disabled}
                              onCheckedChange={() => toggleHeritedFoto(foto.id)}
                            />
                          </label>
                          {disabled && (
                            <div className="absolute bottom-1.5 left-1.5 right-1.5 text-[9px] font-medium bg-background/85 backdrop-blur-sm text-muted-foreground px-1.5 py-0.5 rounded text-center">
                              Excluida
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Fotos propias con MultimediaEditor (mover, principal, bloquear, categoría, eliminar + vídeos) */}
            <div className="flex flex-col gap-2">
              <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
                Propias de esta unidad
              </p>
              <MultimediaEditor
                fotos={ownFotos}
                videos={unit.videosUnidad || []}
                onFotosChange={handleOwnFotosChange}
                onVideosChange={(next: VideoItem[]) => onUpdate({ videosUnidad: next })}
              />
            </div>
          </section>

          {/* ═════ Plano de unidad · lista + botón para abrir modal ═════ */}
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Planos de unidad{planoUrls.length > 0 ? ` · ${planoUrls.length}` : ""}
              </h3>
              <button
                type="button"
                onClick={() => setPlanosOpen(true)}
                className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full border border-border bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors"
              >
                <Upload className="h-3 w-3" strokeWidth={1.5} />
                Gestionar planos
              </button>
            </div>
            {planoUrls.length === 0 ? (
              <button
                type="button"
                onClick={() => setPlanosOpen(true)}
                className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 flex flex-col items-center gap-1 text-center hover:border-primary/40 hover:bg-muted/40 transition-colors"
              >
                <FileText className="h-5 w-5 text-muted-foreground/50" strokeWidth={1.5} />
                <p className="text-xs font-medium text-muted-foreground">Sin planos</p>
                <p className="text-[10px] text-muted-foreground/70">Sube uno o varios · PDF, JPG o PNG</p>
              </button>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {planoUrls.map((url, i) => (
                  <div key={`${url}-${i}`} className="group relative aspect-square rounded-xl border border-border bg-muted overflow-hidden">
                    <img src={url} alt={`Plano ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                    <button
                      type="button"
                      onClick={() => removePlano(i)}
                      aria-label="Eliminar plano"
                      className="absolute top-1.5 right-1.5 h-6 w-6 inline-flex items-center justify-center rounded-md bg-background/85 backdrop-blur-sm text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <TrashIcon className="h-3 w-3" strokeWidth={1.5} />
                    </button>
                    <span className="absolute bottom-1 left-1 text-[9px] font-semibold bg-background/85 backdrop-blur-sm text-foreground px-1.5 py-0.5 rounded">
                      {i + 1}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ═════ Descripción · heredada + personalizar ═════ */}
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2">
                <AlignLeft className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Descripción</h3>
                {!hasDescOverride && heritedDescription && (
                  <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded uppercase tracking-wider">Heredada</span>
                )}
                {hasDescOverride && (
                  <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase tracking-wider">Personalizada</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {hasDescOverride && (
                  <button
                    type="button"
                    onClick={handleDescGenerate}
                    disabled={descGenerating}
                    className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full border border-border bg-card text-[11px] font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-60"
                  >
                    {descGenerating ? (
                      <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} />
                    ) : (
                      <Sparkles className="h-3 w-3 text-primary" strokeWidth={1.5} />
                    )}
                    {descGenerating ? "Generando…" : "Generar con IA"}
                  </button>
                )}
                {hasDescOverride ? (
                  <button
                    type="button"
                    onClick={() => onUpdate({ descripcionOverride: undefined })}
                    className="text-[10px] text-primary font-medium hover:underline"
                  >
                    Restablecer a la de la promoción
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onUpdate({ descripcionOverride: "" })}
                    className="text-[10px] text-primary font-medium hover:underline"
                  >
                    Personalizar
                  </button>
                )}
              </div>
            </div>
            {hasDescOverride ? (
              <>
                <textarea
                  value={unit.descripcionOverride ?? ""}
                  onChange={(e) => onUpdate({ descripcionOverride: e.target.value })}
                  rows={5}
                  className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors resize-y"
                  placeholder="Escribe la descripción específica de esta unidad o genérala con IA…"
                />
                <p className="text-[10px] text-muted-foreground/80">
                  Las traducciones a otros idiomas siguen heredándose de la promoción mientras no personalices cada idioma.
                </p>
              </>
            ) : (
              <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground leading-relaxed">
                {heritedDescription ? (
                  <p className="whitespace-pre-line">{heritedDescription}</p>
                ) : (
                  <p className="italic">Sin descripción en la promoción · añádela en el paso "Descripción".</p>
                )}
              </div>
            )}
          </section>

          {/* ═════ Características · heredadas editables ═════ */}
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Características</h3>
              {!isCharsInherited && (
                <button
                  type="button"
                  onClick={resetCaracteristicas}
                  className="text-[10px] text-primary font-medium hover:underline"
                >
                  Restablecer a las de la promoción
                </button>
              )}
            </div>
            {isCharsInherited && inheritedCount > 0 && (
              <p className="text-[10px] text-muted-foreground">
                Heredadas de la promoción. Haz clic para añadir o quitar para esta unidad.
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {caracteristicasViviendaOptions.map((c) => {
                const Icon = c.icon;
                const active = (unit.caracteristicas || []).includes(c.value);
                const inheritedFromPromo = state.caracteristicasVivienda.includes(c.value);
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => toggleCaracteristica(c.value)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground",
                      inheritedFromPromo && !active && "border-dashed",
                    )}
                    title={inheritedFromPromo && !active ? "Disponible en la promoción — activa para añadir a esta unidad" : undefined}
                  >
                    <Icon className="h-3 w-3" strokeWidth={1.5} />
                    {c.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* ═════ Plan de pagos · heredado + override editable ═════ */}
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2">
                <CreditCard className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Plan de pagos</h3>
                {!hasHitosOverride ? (
                  <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded uppercase tracking-wider">Heredado</span>
                ) : (
                  <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase tracking-wider">Personalizado</span>
                )}
              </div>
              {hasHitosOverride ? (
                <button
                  type="button"
                  onClick={() => onUpdate({ hitosPagoOverride: undefined })}
                  className="text-[10px] text-primary font-medium hover:underline"
                >
                  Restablecer al de la promoción
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onUpdate({ hitosPagoOverride: [...(heritedHitos.length > 0 ? heritedHitos : [
                    { porcentaje: 10, descripcion: "Reserva" },
                    { porcentaje: 20, descripcion: "Contrato" },
                    { porcentaje: 40, descripcion: "Durante obra" },
                    { porcentaje: 30, descripcion: "Entrega de llaves" },
                  ])] })}
                  className="text-[10px] text-primary font-medium hover:underline"
                >
                  Personalizar
                </button>
              )}
            </div>
            {hasHitosOverride ? (
              <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 flex flex-col gap-2">
                {effectiveHitos.map((h, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="number"
                      value={h.porcentaje}
                      onChange={(e) => updateHito(i, { porcentaje: Math.max(0, Number(e.target.value) || 0) })}
                      className="h-8 w-16 rounded-lg border border-border bg-card text-sm tnum px-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                    <input
                      type="text"
                      value={h.descripcion}
                      onChange={(e) => updateHito(i, { descripcion: e.target.value })}
                      placeholder="Descripción del hito"
                      className="flex-1 h-8 rounded-lg border border-border bg-card text-sm px-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                    />
                    <button
                      type="button"
                      onClick={() => removeHito(i)}
                      aria-label="Eliminar hito"
                      className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                    >
                      <TrashIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addHito}
                  className="inline-flex items-center gap-1 h-7 px-3 rounded-full border border-dashed border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors self-start"
                >
                  <Plus className="h-3 w-3" strokeWidth={1.5} /> Añadir hito
                </button>
                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                  <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Total</span>
                  <span className="text-xs font-semibold text-foreground tnum">
                    {effectiveHitos.reduce((s, h) => s + h.porcentaje, 0)}%
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-xs text-foreground">
                {effectiveHitos.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {effectiveHitos.map((h, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span>{h.descripcion || `Hito ${i + 1}`}</span>
                        <span className="tnum font-semibold">{h.porcentaje}%</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground italic">Aún no hay plan definido · se definirá en el paso "Plan de pagos" de la promoción.</p>
                )}
              </div>
            )}
          </section>

          {/* ═════ Fase de obra · solo unifamiliar ═════ */}
          {isUnifamiliar && (
            <section className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2">
                  <HardHat className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                  <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Estado de obra</h3>
                  {unit.faseConstruccionOverride
                    ? <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase tracking-wider">Personalizado</span>
                    : <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded uppercase tracking-wider">Heredado</span>}
                </div>
                {unit.faseConstruccionOverride && (
                  <button
                    type="button"
                    onClick={() => onUpdate({ faseConstruccionOverride: undefined })}
                    className="text-[10px] text-primary font-medium hover:underline"
                  >
                    Restablecer al de la promoción
                  </button>
                )}
              </div>
              <LabeledSelect
                label="Fase actual de esta vivienda"
                value={unit.faseConstruccionOverride ?? (state.faseConstruccion ?? "")}
                onChange={(v) => onUpdate({ faseConstruccionOverride: v as FaseConstruccion })}
                options={faseConstruccionOptions.map((o) => ({ value: o.value, label: o.label }))}
              />
              <p className="text-[10px] text-muted-foreground/80">
                Solo unifamiliar: cada villa puede ir a su ritmo. En plurifamiliar el estado de obra es único para todo el bloque.
              </p>
            </section>
          )}

          {/* ═════ Otros datos heredados (resto) ═════ */}
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Otros datos heredados
            </h3>
            <div className="rounded-xl border border-border bg-muted/20 divide-y divide-border/60 text-xs">
              <InheritedRow
                icon={Calendar}
                label="Año de entrega"
                value={state.fechaEntrega || state.trimestreEntrega || "Sin definir"}
              />
              <InheritedRow
                icon={Leaf}
                label="Certificación energética"
                value={state.certificadoEnergetico || "Sin definir"}
              />
            </div>
          </section>
        </div>

        <div className="px-5 py-3 border-t border-border/40 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center h-9 px-4 rounded-full bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity"
          >
            Listo
          </button>
        </div>
      </DialogContent>

      {/* Sub-dialog · gestión de planos de unidad (múltiples docs) */}
      <Dialog open={planosOpen} onOpenChange={setPlanosOpen}>
        <DialogContent className="p-0 max-w-xl w-[calc(100vw-32px)] overflow-hidden rounded-2xl flex flex-col">
          <DialogHeader className="px-5 pt-5 pb-3 border-b border-border/40">
            <DialogTitle className="text-base font-semibold">Planos de {unit.nombre}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Sube uno o varios documentos (planta, alzado, secciones…). PDF, JPG o PNG.
            </DialogDescription>
          </DialogHeader>
          <div className="px-5 py-4 flex flex-col gap-3 max-h-[60vh] overflow-y-auto">
            <button
              type="button"
              onClick={addPlanosMock}
              className="rounded-xl border-2 border-dashed border-border bg-muted/20 px-6 py-8 flex flex-col items-center gap-1.5 text-center hover:border-primary/40 hover:bg-muted/40 transition-colors"
            >
              <Upload className="h-6 w-6 text-muted-foreground/60" strokeWidth={1.5} />
              <p className="text-sm font-medium text-foreground">Subir plano</p>
              <p className="text-[11px] text-muted-foreground/70">Arrastra o haz clic · puedes subir varios</p>
            </button>
            {planoUrls.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
                  Subidos · {planoUrls.length}
                </p>
                <div className="flex flex-col gap-2">
                  {planoUrls.map((url, i) => (
                    <div key={`${url}-${i}`} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
                      <div className="h-10 w-10 rounded-md overflow-hidden bg-muted shrink-0">
                        <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">Plano {i + 1}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{url.split("/").pop()}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removePlano(i)}
                        className="h-7 w-7 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                        aria-label="Eliminar"
                      >
                        <TrashIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="px-5 py-3 border-t border-border/40 flex items-center justify-end">
            <button
              type="button"
              onClick={() => setPlanosOpen(false)}
              className="inline-flex items-center h-9 px-4 rounded-full bg-foreground text-background text-xs font-medium hover:opacity-90 transition-opacity"
            >
              Listo
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

function InheritedRow({
  icon: Icon, label, value,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-2.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.5} />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">{label}</p>
        <p className="text-xs text-foreground mt-0.5 leading-relaxed">{value}</p>
      </div>
    </div>
  );
}

/* ═══════════ Inputs etiquetados compartidos ═══════════ */
const inputBase =
  "h-8 rounded-lg border border-border bg-card text-sm px-2 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-colors";

function LabeledText({
  label, value, onChange, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputBase}
      />
    </div>
  );
}

function LabeledNumber({
  label, value, onChange, min,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        onChange={(e) => onChange(Math.max(min ?? 0, Number(e.target.value) || 0))}
        className={cn(inputBase, "tnum")}
      />
    </div>
  );
}

function LabeledSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputBase}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
