/**
 * DetallesStep · Paso "Detalles finales" del wizard Crear Promoción.
 *
 * Fidelidad al original + integración con el módulo Empresa:
 *   - Piso piloto (solo si !isSingleHome): master switch
 *   - Oficinas de venta propias: master switch → si ON, aparece lista
 *     de oficinas reales de la empresa (useOficinas). Multi-select
 *     con checkboxes. Botón "Crear nueva oficina" → modal inline con
 *     formulario completo (nombre, dirección, teléfono, email,
 *     WhatsApp, horario). Al crear, queda disponible globalmente en
 *     /empresa/oficinas.
 *   - Tipo de entrega (solo si estado != "terminado"):
 *       · Fecha definida    → selector trimestre (grid 4 cols)
 *       · Tras contrato C/V → input número de meses
 *       · Tras licencia     → solo si estado=proyecto && !tieneLicencia
 */

import { useState } from "react";
import {
  Home as HomeIcon, Store as StoreIcon, Calendar, FileCheck2, Clock,
  Plus, Check, X, Building2, MapPin, Phone, Mail, MessageCircle,
  Star,
} from "lucide-react";
import type { WizardState, TipoEntrega, OficinaVenta } from "./types";
import { Switch } from "@/components/ui/Switch";
import { useOficinas, type Oficina } from "@/lib/empresa";
import { cn } from "@/lib/utils";

/* ─── Helpers UI ──────────────────────────────────────────────────── */
const inputClass = "h-10 w-full px-3 text-[13.5px] bg-card border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/60";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2">
      {children}
    </p>
  );
}

function ToggleCard({
  icon: Icon, title, desc, checked, onChange, children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string; desc: string; checked: boolean; onChange: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div
        role="button"
        tabIndex={0}
        aria-pressed={checked}
        onClick={() => onChange(!checked)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onChange(!checked);
          }
        }}
        className="w-full flex items-center justify-between gap-3 p-4 text-left cursor-pointer hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl shrink-0 transition-colors",
            checked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[13.5px] font-semibold text-foreground leading-tight">{title}</p>
            <p className="text-[11.5px] text-muted-foreground mt-0.5">{desc}</p>
          </div>
        </div>
        <Switch checked={checked} onCheckedChange={onChange} ariaLabel={title} />
      </div>
      {checked && children && (
        <div className="border-t border-border bg-muted/20 p-4">{children}</div>
      )}
    </div>
  );
}

/* ─── Mini-formulario para crear oficina en línea ────────────────── */
function InlineOficinaForm({
  onCreate, onCancel,
}: {
  onCreate: (data: {
    nombre: string; direccion: string; telefono: string;
    email: string; whatsapp: string; horario: string;
  }) => void;
  onCancel: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [horario, setHorario] = useState("L-V 9:00-18:00");

  const valid = nombre.trim().length > 0;

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/[0.03] p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Building2 className="h-3.5 w-3.5" />
        </div>
        <p className="text-[13px] font-bold tracking-tight">Nueva oficina</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <input autoFocus type="text" value={nombre} onChange={(e) => setNombre(e.target.value)}
               placeholder="Nombre · Ej. Oficina Marbella" className={inputClass} />
        <input type="text" value={direccion} onChange={(e) => setDireccion(e.target.value)}
               placeholder="Dirección completa" className={inputClass} />
        <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)}
               placeholder="Teléfono" className={inputClass} />
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
               placeholder="Email" className={inputClass} />
        <input type="tel" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)}
               placeholder="WhatsApp" className={inputClass} />
        <input type="text" value={horario} onChange={(e) => setHorario(e.target.value)}
               placeholder="Horario" className={inputClass} />
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-border text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <X className="h-3 w-3" /> Cancelar
        </button>
        <button type="button" onClick={() => valid && onCreate({ nombre, direccion, telefono, email, whatsapp, horario })}
          disabled={!valid}
          className="inline-flex items-center gap-1.5 h-8 px-4 rounded-full bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40">
          <Check className="h-3 w-3" /> Crear oficina
        </button>
      </div>
      <p className="text-[10.5px] text-muted-foreground -mt-1">
        Esta oficina quedará disponible también en <span className="font-medium">Empresa → Oficinas</span>.
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   DetallesStep
   ═══════════════════════════════════════════════════════════════════ */
export function DetallesStep({
  state,
  update,
  trimestreOptions,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  trimestreOptions: string[];
}) {
  const { oficinas, addOficina } = useOficinas();
  const [showCreate, setShowCreate] = useState(false);

  const isSingleHome = state.tipo === "unifamiliar" && state.subUni === "una_sola";

  // tipoEntrega solo se muestra si la promoción NO está terminada (no
  // tiene sentido "fecha estimada" cuando ya acabó).
  const canShowTipoEntrega = state.estado !== "terminado";
  // La opción "Tras licencia" solo aparece si está en proyecto sin licencia.
  const canShowTrasLicencia = state.estado === "proyecto" && state.tieneLicencia === false;

  const toggleOficina = (o: Oficina) => {
    const exists = state.oficinasVentaSeleccionadas.find(x => x.id === o.id);
    if (exists) {
      update("oficinasVentaSeleccionadas", state.oficinasVentaSeleccionadas.filter(x => x.id !== o.id));
    } else {
      const ov: OficinaVenta = {
        id: o.id,
        nombre: o.nombre,
        direccion: o.direccion,
        telefono: o.telefono,
        email: o.email,
        whatsapp: o.whatsapp,
        esNueva: false,
      };
      update("oficinasVentaSeleccionadas", [...state.oficinasVentaSeleccionadas, ov]);
    }
  };

  const handleCreateOficina = (data: {
    nombre: string; direccion: string; telefono: string;
    email: string; whatsapp: string; horario: string;
  }) => {
    const nueva = addOficina({ ...data, activa: true });
    // Auto-seleccionar la recién creada
    const ov: OficinaVenta = {
      id: nueva.id,
      nombre: nueva.nombre,
      direccion: nueva.direccion,
      telefono: nueva.telefono,
      email: nueva.email,
      whatsapp: nueva.whatsapp,
      esNueva: true,
    };
    update("oficinasVentaSeleccionadas", [...state.oficinasVentaSeleccionadas, ov]);
    setShowCreate(false);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ═════ Piso piloto (solo si !isSingleHome) ═════
          Toggle + selector de unidad · si activado, lista las
          unidades creadas para que el promotor elija cuál actúa
          como piloto. Sin esto el promotor activaba el switch pero
          no podía indicar qué unidad era · información incompleta
          que llegaba a la ficha. */}
      {!isSingleHome && (
        <ToggleCard
          icon={HomeIcon}
          title="Piso piloto"
          desc="¿Hay piso piloto disponible para visitas?"
          checked={state.pisoPiloto}
          onChange={(v) => {
            update("pisoPiloto", v);
            /* Off · limpia la unidad seleccionada para no dejar
             *  un puntero huérfano. */
            if (!v && state.pisoPilotoUnidadId) {
              update("pisoPilotoUnidadId", null);
            }
          }}
        >
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Elige la unidad piloto
            </p>
            {state.unidades.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-background px-4 py-6 text-center">
                <p className="text-xs text-muted-foreground">
                  Aún no has creado unidades · primero genera el inventario
                  desde el paso "Unidades".
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-[280px] overflow-y-auto pr-1 -mr-1">
                {state.unidades.map((u) => {
                  const selected = state.pisoPilotoUnidadId === u.id;
                  const label = u.nombre || u.ref || u.id;
                  const meta: string[] = [];
                  if (u.dormitorios) meta.push(`${u.dormitorios} hab`);
                  if (u.banos) meta.push(`${u.banos} baños`);
                  if (u.superficieConstruida) meta.push(`${u.superficieConstruida} m²`);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => update("pisoPilotoUnidadId", u.id)}
                      className={`flex items-center justify-between p-3 rounded-xl border transition-all text-left ${
                        selected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-foreground/30 hover:bg-muted/20"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-semibold text-muted-foreground">{u.planta ?? "—"}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{label}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {meta.length > 0 ? meta.join(" · ") : "Sin datos"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {u.precio > 0 && (
                          <p className="text-sm font-bold text-foreground tabular-nums">
                            {new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(u.precio)}
                          </p>
                        )}
                        {selected && (
                          <span className="text-[10px] font-semibold text-primary uppercase">Seleccionada</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </ToggleCard>
      )}

      {/* ═════ Oficina de ventas ═════ */}
      <ToggleCard
        icon={StoreIcon}
        title="Oficinas de venta propias"
        desc="¿Tienes una oficina donde recibes a los clientes?"
        checked={state.oficinaVentas}
        onChange={(v) => {
          update("oficinaVentas", v);
          if (!v) update("oficinasVentaSeleccionadas", []);
        }}
      >
        <div className="flex flex-col gap-3">
          {oficinas.length === 0 && !showCreate && (
            <div className="rounded-xl border border-dashed border-border bg-background p-4 text-center flex flex-col items-center gap-2">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <p className="text-[12.5px] text-muted-foreground">
                Todavía no tienes oficinas registradas. Crea la primera ahora y se añadirá también a tu empresa.
              </p>
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="mt-1 inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-3 w-3" /> Crear primera oficina
              </button>
            </div>
          )}

          {oficinas.length > 0 && (
            <>
              <div className="flex items-center justify-between gap-3">
                <SectionLabel>Selecciona qué oficinas comercializarán esta promoción</SectionLabel>
                {state.oficinasVentaSeleccionadas.length > 0 && (
                  <button
                    type="button"
                    onClick={() => update("oficinasVentaSeleccionadas", [])}
                    className="text-[11px] font-medium text-muted-foreground hover:text-destructive transition-colors inline-flex items-center gap-1"
                  >
                    <X className="h-3 w-3" /> Deseleccionar todas
                  </button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground -mt-1 mb-1">
                Puedes seleccionar varias. Haz clic de nuevo sobre una tarjeta (o en la ✕) para quitarla.
              </p>
              <div className="flex flex-col gap-2">
                {[...oficinas]
                  .sort((a, b) => (a.esPrincipal === b.esPrincipal ? 0 : a.esPrincipal ? -1 : 1))
                  .map((o) => {
                    const selected = !!state.oficinasVentaSeleccionadas.find(x => x.id === o.id);
                    return (
                      <div
                        key={o.id}
                        className={cn(
                          "relative flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                          selected
                            ? "border-primary bg-primary/5"
                            : "border-border bg-card hover:border-primary/30",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => toggleOficina(o)}
                          className="flex items-start gap-3 text-left flex-1 min-w-0"
                          aria-pressed={selected}
                        >
                          <div className={cn(
                            "mt-0.5 flex h-4 w-4 items-center justify-center rounded border shrink-0 transition-colors",
                            selected ? "bg-primary border-primary text-primary-foreground" : "bg-card border-border",
                          )}>
                            {selected && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-[13px] font-semibold text-foreground truncate">{o.nombre}</p>
                              {o.esPrincipal && (
                                <span className="inline-flex items-center gap-0.5 text-[9.5px] font-bold rounded-full bg-primary/10 text-primary px-1.5 py-0.5">
                                  <Star className="h-2 w-2" strokeWidth={3} /> Principal
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-x-3 gap-y-0.5 flex-wrap text-[11px] text-muted-foreground mt-0.5">
                              {o.direccion && <span className="flex items-center gap-1 truncate"><MapPin className="h-2.5 w-2.5 shrink-0" />{o.direccion}</span>}
                              {o.telefono && <span className="flex items-center gap-1"><Phone className="h-2.5 w-2.5" />{o.telefono}</span>}
                              {o.email && <span className="flex items-center gap-1"><Mail className="h-2.5 w-2.5" />{o.email}</span>}
                              {o.whatsapp && <span className="flex items-center gap-1"><MessageCircle className="h-2.5 w-2.5" />{o.whatsapp}</span>}
                            </div>
                          </div>
                        </button>
                        {/* Botón explícito para quitar · siempre visible si está seleccionada (también en touch) */}
                        {selected && (
                          <button
                            type="button"
                            onClick={() => toggleOficina(o)}
                            aria-label={`Quitar ${o.nombre}`}
                            className="absolute top-2 right-2 h-6 w-6 rounded-full inline-flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
            </>
          )}

          {/* Form inline */}
          {showCreate && (
            <InlineOficinaForm
              onCreate={handleCreateOficina}
              onCancel={() => setShowCreate(false)}
            />
          )}

          {/* Botón añadir */}
          {oficinas.length > 0 && !showCreate && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center justify-center gap-1.5 h-9 rounded-xl border border-dashed border-border bg-background text-[12.5px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Crear nueva oficina
            </button>
          )}
        </div>
      </ToggleCard>

      {/* ═════ Tipo de entrega ═════ */}
      {canShowTipoEntrega && (
        <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Calendar className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[13.5px] font-semibold text-foreground">¿Cuándo se entrega al comprador?</p>
              <p className="text-[11.5px] text-muted-foreground">Elige el modelo de fecha de entrega.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <TipoEntregaPill
              active={state.tipoEntrega === "fecha_definida"}
              icon={Calendar}
              title="Fecha definida"
              desc="Trimestre concreto de entrega"
              onClick={() => update("tipoEntrega", "fecha_definida")}
            />
            <TipoEntregaPill
              active={state.tipoEntrega === "tras_contrato_cv"}
              icon={Clock}
              title="Tras contrato C/V"
              desc="X meses después de firmar"
              onClick={() => update("tipoEntrega", "tras_contrato_cv")}
            />
            {canShowTrasLicencia && (
              <TipoEntregaPill
                active={state.tipoEntrega === "tras_licencia"}
                icon={FileCheck2}
                title="Tras licencia"
                desc="Cuando obtengas la licencia"
                onClick={() => update("tipoEntrega", "tras_licencia")}
              />
            )}
          </div>

          {/* Trimestre si fecha_definida */}
          {state.tipoEntrega === "fecha_definida" && (
            <div className="pt-3 border-t border-border">
              <SectionLabel>Selecciona el trimestre estimado</SectionLabel>
              <div className="grid grid-cols-4 gap-2">
                {trimestreOptions.map((t) => {
                  const on = state.trimestreEntrega === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => update("trimestreEntrega", t)}
                      className={cn(
                        "rounded-lg border px-2 py-2 text-[11.5px] font-semibold transition-colors tnum",
                        on
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-foreground/20 hover:text-foreground",
                      )}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Meses si tras_contrato_cv */}
          {state.tipoEntrega === "tras_contrato_cv" && (
            <div className="pt-3 border-t border-border">
              <SectionLabel>¿Cuántos meses después del contrato?</SectionLabel>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={state.mesesTrasContrato}
                  onChange={(e) => update("mesesTrasContrato", Math.max(1, parseInt(e.target.value || "0", 10)))}
                  className={cn(inputClass, "w-24 tnum")}
                />
                <span className="text-[12.5px] text-muted-foreground">meses tras la firma del contrato</span>
              </div>
            </div>
          )}

          {/* Aviso si tras_licencia */}
          {state.tipoEntrega === "tras_licencia" && (
            <div className="rounded-xl bg-warning/5 border border-warning/30 p-3 text-[11.5px] text-foreground leading-relaxed">
              La entrega se estimará automáticamente desde la fecha en que consigas la licencia. Puedes actualizarla cuando la tengas.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Pill card para tipo de entrega ──────────────────────────────── */
function TipoEntregaPill({
  active, icon: Icon, title, desc, onClick,
}: {
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  title: string; desc: string; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors",
        active
          ? "border-primary bg-primary/5"
          : "border-border bg-card hover:border-primary/30",
      )}
    >
      <div className="flex items-center gap-2">
        <div className={cn(
          "flex h-7 w-7 items-center justify-center rounded-lg shrink-0",
          active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <p className="text-[12.5px] font-semibold text-foreground">{title}</p>
      </div>
      <p className="text-[11px] text-muted-foreground pl-9">{desc}</p>
    </button>
  );
}
