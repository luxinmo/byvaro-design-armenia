/**
 * CreateCalendarEventDialog · crear / editar un evento del calendario.
 *
 * Diseño responsive (mobile-friendly):
 *   - DialogContent max-h-[90vh] con scroll interno.
 *   - Tipos 3 cols en mobile, 5 en desktop.
 *   - Fecha/Hora/Duración en 1 col mobile, 3 desktop.
 *
 * Detección de solapamiento DURA (ADR-056): si el agente ya tiene un
 * evento solapando, NO se permite guardar. Banner rojo + CTA.
 *
 * Flujo de visita (type=visit):
 *   1. Selecciona cliente (contacto existente o nuevo).
 *   2. Selecciona promoción. Las promociones donde el cliente tiene
 *      registro APROBADO aparecen primero con chip "Registrado".
 *   3. Si la promoción elegida NO tiene registro aprobado, el dialog
 *      muestra un banner amarillo "Se enviará también el registro" y
 *      el botón cambia a "Enviar registro + programar visita".
 *      La visita se crea con status="pending-confirmation" hasta que
 *      el promotor aprueba el registro.
 *
 * TODO(backend):
 *   - POST /api/calendar/events (o PATCH si editando).
 *   - POST /api/registrations (cuando se crea registro + visita juntos).
 *   - Conflict check replicado server-side.
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { leadHrefById } from "@/lib/urls";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { UserSelect } from "@/components/ui/UserSelect";
import { Flag } from "@/components/ui/Flag";
import {
  AlertTriangle, ArrowRight, MapPin, Home, Phone, Users, Ban, Bell,
  ChevronDown, Check, Search, UserPlus, Building2, FileCheck2,
  AlertCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import {
  DURATION_PRESETS, DEFAULT_DURATION_MINUTES, eventTypeConfig,
  type CalendarEvent, type CalendarEventType, type CalendarEventStatus,
} from "@/data/calendarEvents";
import {
  createCalendarEvent, updateCalendarEvent, findConflict,
} from "@/lib/calendarStorage";
import {
  combineDateAndTime, formatTimeRange, toDateInputValue, toTimeInputValue,
  durationMinutes,
} from "@/lib/calendarHelpers";
import { findTeamMember } from "@/lib/team";
import { useCurrentUser } from "@/lib/currentUser";
import {
  groupPromotionsByRegistration,
  type PromotionWithRegistrationStatus,
} from "@/lib/registrationMatcher";
import { developerOnlyPromotions } from "@/data/developerPromotions";
import { promotions } from "@/data/promotions";
import { getOwnerRoleArticleLower } from "@/lib/promotionRole";
import { MOCK_CONTACTS } from "@/components/contacts/data";
import { cn } from "@/lib/utils";

type Preset = {
  date?: Date;
  hour?: number;
  assigneeUserId?: string;
  type?: CalendarEventType;
  title?: string;
  contactId?: string;
  contactName?: string;
  leadId?: string;
  promotionId?: string;
  promotionName?: string;
  unitLabel?: string;
  status?: CalendarEventStatus;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: CalendarEvent;
  preset?: Preset;
  onSaved?: (ev: CalendarEvent) => void;
};

const TYPE_ICONS: Record<CalendarEventType, LucideIcon> = {
  visit:    Home,
  call:     Phone,
  meeting:  Users,
  block:    Ban,
  reminder: Bell,
};

export function CreateCalendarEventDialog({
  open, onOpenChange, event, preset, onSaved,
}: Props) {
  const navigate = useNavigate();
  const currentUser = useCurrentUser();
  const isEdit = !!event;

  /* ─── Form state ─── */
  const [type, setType] = useState<CalendarEventType>(
    event?.type ?? preset?.type ?? "visit",
  );
  const [title, setTitle] = useState<string>(event?.title ?? preset?.title ?? "");
  const [date, setDate] = useState<string>(() => {
    if (event) return toDateInputValue(event.start);
    if (preset?.date) return toDateInputValue(preset.date);
    return toDateInputValue(new Date());
  });
  const [time, setTime] = useState<string>(() => {
    if (event) return toTimeInputValue(event.start);
    if (preset?.hour != null) return `${String(preset.hour).padStart(2, "0")}:00`;
    return "10:00";
  });
  const [durationMin, setDurationMin] = useState<number>(() => {
    if (event) return durationMinutes(event);
    return DEFAULT_DURATION_MINUTES;
  });
  const [assigneeUserId, setAssigneeUserId] = useState<string | null>(
    event?.assigneeUserId ?? preset?.assigneeUserId ?? currentUser.id ?? null,
  );
  /* ─── Cliente: id opcional (si viene de contactos) + nombre/email. ─── */
  const [contactId, setContactId] = useState<string | undefined>(
    event?.contactId ?? preset?.contactId,
  );
  const [contactName, setContactName] = useState<string>(
    event?.contactName ?? preset?.contactName ?? "",
  );
  const [contactEmail, setContactEmail] = useState<string>("");
  /* ─── Promoción (solo visita) ─── */
  const [promotionId, setPromotionId] = useState<string | undefined>(
    (event as any)?.promotionId ?? preset?.promotionId,
  );
  const [promotionName, setPromotionName] = useState<string>(
    (event as any)?.promotionName ?? preset?.promotionName ?? "",
  );
  const [locationLabel, setLocationLabel] = useState<string>(
    event?.location?.label ?? "",
  );
  const [notes, setNotes] = useState<string>(event?.notes ?? "");
  const [reminder, setReminder] = useState<"none" | "15m" | "1h" | "1d">(
    event?.reminder ?? "none",
  );
  const [status, setStatus] = useState<CalendarEventStatus>(
    event?.status ?? preset?.status ?? "confirmed",
  );

  // Reset si abres con un preset distinto.
  useEffect(() => {
    if (!open) return;
    if (isEdit) return;
    if (preset?.type) setType(preset.type);
    if (preset?.title) setTitle(preset.title);
    if (preset?.date) setDate(toDateInputValue(preset.date));
    if (preset?.hour != null) setTime(`${String(preset.hour).padStart(2, "0")}:00`);
    if (preset?.assigneeUserId) setAssigneeUserId(preset.assigneeUserId);
    if (preset?.contactId) setContactId(preset.contactId);
    if (preset?.contactName) setContactName(preset.contactName);
    if (preset?.status) setStatus(preset.status);
    if (preset?.promotionId) setPromotionId(preset.promotionId);
    if (preset?.promotionName) setPromotionName(preset.promotionName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* ─── Derivados: fecha de inicio/fin ─── */
  const startISO = useMemo(() => combineDateAndTime(date, time), [date, time]);
  const endISO = useMemo(() => {
    const s = new Date(startISO);
    s.setMinutes(s.getMinutes() + durationMin);
    return s.toISOString();
  }, [startISO, durationMin]);

  /* ─── Conflict check ─── */
  const conflict = useMemo(() => {
    if (!assigneeUserId) return null;
    return findConflict(assigneeUserId, startISO, endISO, event?.id);
  }, [assigneeUserId, startISO, endISO, event?.id]);

  /* ─── Matching · promociones registradas por este cliente.
         Solo aplica a type === "visit". ─── */
  const promotionGroups = useMemo(() => {
    if (type !== "visit") return null;
    if (!contactName && !contactEmail) return null;
    return groupPromotionsByRegistration({
      id: contactId,
      name: contactName,
      email: contactEmail,
    });
  }, [type, contactId, contactName, contactEmail]);

  /* ¿La promoción elegida NO tiene registro aprobado? → hay que crearlo. */
  const requiresRegistration = useMemo(() => {
    if (type !== "visit") return false;
    if (!promotionId) return false;
    if (!promotionGroups) return true; // no hay cliente definido o no match
    const allAccepted = promotionGroups.accepted.map((p) => p.promotion.id);
    return !allAccepted.includes(promotionId);
  }, [type, promotionId, promotionGroups]);

  /* ─── Submit ─── */
  const canSave =
    !!assigneeUserId &&
    !!title.trim() &&
    !conflict &&
    (type !== "visit" || !!promotionId) &&
    (type !== "visit" || !!contactName.trim());

  const onSave = () => {
    if (!canSave || !assigneeUserId) return;
    const assigneeMember = findTeamMember(assigneeUserId);
    /* Si es una visita y la promoción no tiene registro aprobado,
       forzamos status a "pending-confirmation" y mostramos toast
       mencionando que se envía registro también (mock: no creamos
       realmente el registro aún · ver TODO backend). */
    const effectiveStatus: CalendarEventStatus =
      type === "visit" && requiresRegistration ? "pending-confirmation" : status;

    if (isEdit && event) {
      updateCalendarEvent(event.id, {
        type, title: title.trim(),
        start: startISO, end: endISO,
        assigneeUserId,
        assigneeName: assigneeMember?.name ?? event.assigneeName,
        contactId,
        contactName: contactName.trim() || undefined,
        ...(type === "visit" && {
          promotionId, promotionName: promotionName || undefined,
        }),
        location: locationLabel.trim() ? { label: locationLabel.trim() } : undefined,
        notes: notes.trim() || undefined,
        reminder: reminder === "none" ? undefined : reminder,
        status: effectiveStatus,
      } as Partial<CalendarEvent>);
      toast.success("Evento actualizado");
      onOpenChange(false);
      return;
    }

    const created = createCalendarEvent({
      type,
      title: title.trim(),
      start: startISO,
      end: endISO,
      assigneeUserId,
      assigneeName: assigneeMember?.name,
      status: effectiveStatus,
      source: preset?.leadId ? "oportunidad" : "manual",
      contactId,
      contactName: contactName.trim() || undefined,
      leadId: preset?.leadId,
      promotionId: type === "visit" ? promotionId : undefined,
      promotionName: type === "visit" ? promotionName : undefined,
      unitLabel: preset?.unitLabel,
      location: locationLabel.trim() ? { label: locationLabel.trim() } : undefined,
      notes: notes.trim() || undefined,
      reminder: reminder === "none" ? undefined : reminder,
      createdByUserId: currentUser.id,
    } as Parameters<typeof createCalendarEvent>[0]);

    if (type === "visit" && requiresRegistration) {
      const promo = promotionId
        ? developerOnlyPromotions.find((p) => p.id === promotionId)
          ?? promotions.find((p) => p.id === promotionId)
        : undefined;
      toast.success("Registro enviado + visita programada", {
        description: `La visita queda pendiente hasta que ${getOwnerRoleArticleLower(promo)} apruebe el registro.`,
      });
      /* TODO(backend): POST /api/registrations aquí con:
         { promotionId, cliente: { nombre, email, ... }, estado: "pendiente",
           origen: "direct", visitaAsociadaId: created.id } */
    } else {
      toast.success("Evento creado", { description: formatTimeRange(startISO, endISO) });
    }
    onSaved?.(created);
    onOpenChange(false);
  };

  const TypeIcon = TYPE_ICONS[type];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar evento" : "Nuevo evento"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modifica los detalles del evento. Si cambias fecha/hora se vuelve a comprobar el solapamiento."
              : "Añade una visita, llamada, reunión o bloqueo a la agenda del agente."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-1">
          {/* Tipo · segmented · 3 cols en mobile, 5 en desktop */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
              Tipo de evento
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              {(Object.keys(eventTypeConfig) as CalendarEventType[]).map((t) => {
                const cfg = eventTypeConfig[t];
                const Icon = TYPE_ICONS[t];
                const active = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1.5 py-2.5 px-1 rounded-xl border text-[11px] font-medium leading-none transition-colors min-h-[60px]",
                      active
                        ? `${cfg.bgClass} ${cfg.textClass} ${cfg.borderClass} ring-2 ring-offset-1 ring-offset-background`
                        : "bg-card border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                    <span className="truncate max-w-full leading-none">{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Título */}
          <Field label="Título">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                type === "visit" ? "Visita · Villa Serena" :
                type === "call" ? "Llamada de seguimiento" :
                type === "meeting" ? "Reunión semanal" :
                type === "block" ? "Almuerzo" :
                "Recordatorio"
              }
            />
          </Field>

          {/* Fecha + hora + duración · 1 col mobile, 3 desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Field label="Fecha">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Hora">
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
            <Field label="Duración">
              <Select value={String(durationMin)} onValueChange={(v) => setDurationMin(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DURATION_PRESETS.map((p) => (
                    <SelectItem key={p.minutes} value={String(p.minutes)}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {/* Responsable · único · UserSelect canónico */}
          <Field label="Responsable">
            <UserSelect
              value={assigneeUserId}
              onChange={setAssigneeUserId}
              placeholder="Selecciona miembro"
              onlyActive
            />
          </Field>

          {/* Solapamiento · banner rojo bloqueante */}
          {conflict && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" strokeWidth={2} />
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-semibold text-destructive">
                    Solapamiento de agenda
                  </p>
                  <p className="text-[11.5px] text-foreground mt-0.5 leading-relaxed">
                    El agente ya tiene <strong>{conflict.title}</strong>
                    {" · "}
                    <span className="tabular-nums">{formatTimeRange(conflict.start, conflict.end)}</span>.
                    Cambia ese evento primero y vuelve a programar.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange(false);
                      if (conflict.leadId) navigate(leadHrefById(conflict.leadId));
                      else navigate("/calendario");
                      toast.info("Abre el evento solapado para modificarlo");
                    }}
                    className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-destructive hover:underline"
                  >
                    Ir al evento solapado <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Cliente / contacto · Popover con buscador (solo visit/call/meeting) */}
          {type !== "block" && type !== "reminder" && (
            <Field label="Cliente / contacto">
              <ContactPicker
                selectedId={contactId}
                selectedName={contactName}
                onChange={(c) => {
                  setContactId(c.id);
                  setContactName(c.name);
                  setContactEmail(c.email ?? "");
                  // Limpia la promoción cuando cambia el cliente · fuerza re-elegir
                  // para ver si tiene registro aprobado.
                  if (type === "visit") {
                    setPromotionId(undefined);
                    setPromotionName("");
                  }
                }}
              />
            </Field>
          )}

          {/* Promoción · solo visita · agrupada por registro aceptado primero */}
          {type === "visit" && (
            <Field label="Promoción a visitar">
              <PromotionPicker
                selectedId={promotionId}
                selectedName={promotionName}
                onChange={(p) => {
                  setPromotionId(p.id);
                  setPromotionName(p.name);
                  // Pre-rellena ubicación si no se ha tocado.
                  if (!locationLabel && p.location) setLocationLabel(p.location);
                }}
                groups={promotionGroups}
                clientReady={!!contactName.trim()}
              />
            </Field>
          )}

          {/* Banner · se enviará también el registro */}
          {type === "visit" && promotionId && requiresRegistration && contactName.trim() && (
            <div className="rounded-xl border border-warning/40 bg-warning/10 p-3">
              <div className="flex items-start gap-2.5">
                <FileCheck2 className="h-4 w-4 text-warning shrink-0 mt-0.5" strokeWidth={2} />
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-semibold text-warning">
                    El cliente aún no está registrado en esta promoción
                  </p>
                  <p className="text-[11.5px] text-foreground mt-0.5 leading-relaxed">
                    Al crear la visita se enviará también el <strong>registro</strong> al promotor.
                    La visita quedará <strong>pendiente de confirmación</strong> hasta que el registro
                    sea aprobado.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Ubicación (label libre) */}
          {type !== "reminder" && (
            <Field label={type === "call" ? "Número" : "Ubicación"}>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                <Input
                  value={locationLabel}
                  onChange={(e) => setLocationLabel(e.target.value)}
                  placeholder={
                    type === "call" ? "+34 600 000 000" :
                    type === "meeting" ? "Oficina HQ / Zoom" :
                    type === "block" ? "(opcional)" :
                    "Villa Serena · Marbella"
                  }
                  className="pl-8"
                />
              </div>
            </Field>
          )}

          {/* Notas */}
          <Field label="Notas (opcional)">
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Información adicional para el agente…"
            />
          </Field>

          {/* Recordatorio + Estado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label="Recordatorio">
              <Select value={reminder} onValueChange={(v) => setReminder(v as typeof reminder)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin recordatorio</SelectItem>
                  <SelectItem value="15m">15 minutos antes</SelectItem>
                  <SelectItem value="1h">1 hora antes</SelectItem>
                  <SelectItem value="1d">1 día antes</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Estado">
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as CalendarEventStatus)}
                disabled={type === "visit" && requiresRegistration}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">Confirmado</SelectItem>
                  <SelectItem value="pending-confirmation">Pendiente de confirmación</SelectItem>
                  <SelectItem value="done">Realizado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                  <SelectItem value="noshow">No asistió</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>

          {/* Preview · feedback visual */}
          <div className="rounded-lg bg-muted/30 px-3 py-2 flex items-center gap-2">
            <TypeIcon className={cn("h-4 w-4 shrink-0", eventTypeConfig[type].textClass)} strokeWidth={1.75} />
            <p className="text-[11.5px] text-muted-foreground">
              {eventTypeConfig[type].label} · {durationMin} min
              {" · "}
              <span className="tabular-nums">{formatTimeRange(startISO, endISO)}</span>
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full w-full sm:w-auto">
            Cancelar
          </Button>
          <Button
            onClick={onSave}
            disabled={!canSave}
            className={cn(
              "rounded-full w-full sm:w-auto",
              type === "visit" && requiresRegistration && "sm:w-auto",
            )}
          >
            {isEdit
              ? "Guardar cambios"
              : (type === "visit" && requiresRegistration
                  ? "Enviar registro + programar visita"
                  : "Crear evento")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Field helper ─── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
        {label}
      </label>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CONTACT PICKER · Popover con buscador sobre MOCK_CONTACTS.
   Si el valor escrito no existe en la lista, se permite crear como
   "cliente nuevo" (id = undefined · solo nombre/email libres).
   ═══════════════════════════════════════════════════════════════════ */

function ContactPicker({
  selectedId, selectedName, onChange,
}: {
  selectedId?: string;
  selectedName: string;
  onChange: (c: { id?: string; name: string; email?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MOCK_CONTACTS.slice(0, 30);
    return MOCK_CONTACTS.filter(
      (c) => c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q),
    ).slice(0, 30);
  }, [query]);

  const showNewOption = query.trim().length > 0 && !filtered.some(
    (c) => c.name.toLowerCase() === query.trim().toLowerCase(),
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between h-10 px-3 rounded-xl border border-border bg-card text-sm hover:border-foreground/30 transition-colors gap-2"
        >
          <span className={cn("truncate", !selectedName && "text-muted-foreground")}>
            {selectedName || "Selecciona cliente o escribe uno nuevo"}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-1.5"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="px-2 pt-1 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/60" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar o escribir nombre nuevo…"
              className="w-full h-8 pl-7 pr-2 text-xs bg-muted/40 border border-transparent rounded-full focus:bg-background focus:border-border outline-none"
            />
          </div>
        </div>
        <div className="max-h-60 overflow-y-auto overscroll-contain">
          {filtered.length === 0 && !showNewOption && (
            <p className="px-3 py-4 text-[11.5px] text-muted-foreground italic text-center">
              Sin resultados · escribe un nombre para crear cliente nuevo.
            </p>
          )}
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                onChange({ id: c.id, name: c.name, email: c.email ?? undefined });
                setOpen(false);
                setQuery("");
              }}
              className="w-full text-left px-2.5 py-1.5 text-sm rounded-lg hover:bg-muted flex items-center gap-2.5"
            >
              <div className="h-7 w-7 rounded-full bg-muted grid place-items-center text-[10px] font-bold text-foreground shrink-0">
                {c.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-medium text-foreground truncate inline-flex items-center gap-1.5">
                  <Flag iso={c.nationalityIso} size={12} />
                  <span className="truncate">{c.name}</span>
                </p>
                {c.email && (
                  <p className="text-[10.5px] text-muted-foreground truncate">{c.email}</p>
                )}
              </div>
              {selectedId === c.id && <Check className="h-3.5 w-3.5 text-foreground" />}
            </button>
          ))}
          {showNewOption && (
            <button
              type="button"
              onClick={() => {
                onChange({ id: undefined, name: query.trim() });
                setOpen(false);
                setQuery("");
              }}
              className="w-full text-left px-2.5 py-1.5 text-sm rounded-lg hover:bg-primary/5 border border-dashed border-border mt-1 flex items-center gap-2.5"
            >
              <div className="h-7 w-7 rounded-full bg-primary/10 grid place-items-center shrink-0">
                <UserPlus className="h-3 w-3 text-primary" strokeWidth={2} />
              </div>
              <p className="text-[12.5px] font-medium text-primary truncate">
                Crear cliente nuevo: <strong>{query.trim()}</strong>
              </p>
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PROMOTION PICKER · Popover con 2 secciones.
   1. Con registro aceptado (si hay)
   2. Otras promociones
   Si el cliente no está definido, muestra todo como "otras".
   ═══════════════════════════════════════════════════════════════════ */

function PromotionPicker({
  selectedId, selectedName, onChange, groups, clientReady,
}: {
  selectedId?: string;
  selectedName: string;
  onChange: (p: { id: string; name: string; location?: string }) => void;
  groups: ReturnType<typeof groupPromotionsByRegistration> | null;
  clientReady: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filter = (list: PromotionWithRegistrationStatus[]) => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (x) => x.promotion.name.toLowerCase().includes(q) ||
             x.promotion.location?.toLowerCase().includes(q),
    );
  };

  const acceptedList = groups ? filter(groups.accepted) : [];
  const othersList   = groups ? filter(groups.others)   : filter(
    // Si no hay cliente, mostramos todo como "others" (sin distinción).
    [], // se rellena abajo
  );

  // Si no hay cliente, pintamos todo el catálogo en "others".
  const fallbackAll: PromotionWithRegistrationStatus[] = !groups
    ? developerOnlyPromotions.map((p) => ({
        promotion: p,
        acceptedRegistration: undefined,
        pendingRegistration: undefined,
        rejectedRegistration: undefined,
      }))
    : [];
  const othersDisplay = groups ? othersList : filter(fallbackAll);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full flex items-center justify-between h-10 px-3 rounded-xl border border-border bg-card text-sm hover:border-foreground/30 transition-colors gap-2"
        >
          <span className={cn("truncate", !selectedName && "text-muted-foreground")}>
            {selectedName || (clientReady ? "Selecciona promoción" : "Primero selecciona cliente")}
          </span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[320px] p-1.5"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="px-2 pt-1 pb-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/60" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar promoción…"
              className="w-full h-8 pl-7 pr-2 text-xs bg-muted/40 border border-transparent rounded-full focus:bg-background focus:border-border outline-none"
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto overscroll-contain">
          {/* Sección 1 · Con registro aceptado */}
          {acceptedList.length > 0 && (
            <>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-success px-2.5 py-1.5 sticky top-0 bg-popover flex items-center gap-1">
                <FileCheck2 className="h-3 w-3" strokeWidth={2} />
                Con registro aceptado · {acceptedList.length}
              </p>
              {acceptedList.map((x) => (
                <PromotionItem
                  key={x.promotion.id} item={x} selected={selectedId === x.promotion.id}
                  accepted
                  onPick={() => {
                    onChange({ id: x.promotion.id, name: x.promotion.name, location: x.promotion.location });
                    setOpen(false); setQuery("");
                  }}
                />
              ))}
            </>
          )}

          {/* Sección 2 · Resto */}
          {othersDisplay.length > 0 && (
            <>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground px-2.5 py-1.5 mt-1 sticky top-0 bg-popover">
                {acceptedList.length > 0 ? "Otras promociones" : "Promociones"}
              </p>
              {othersDisplay.map((x) => (
                <PromotionItem
                  key={x.promotion.id} item={x} selected={selectedId === x.promotion.id}
                  onPick={() => {
                    onChange({ id: x.promotion.id, name: x.promotion.name, location: x.promotion.location });
                    setOpen(false); setQuery("");
                  }}
                />
              ))}
            </>
          )}

          {acceptedList.length === 0 && othersDisplay.length === 0 && (
            <p className="px-3 py-4 text-[11.5px] text-muted-foreground italic text-center">
              Sin resultados.
            </p>
          )}

          {!groups && (
            <p className="px-3 py-2 text-[10.5px] text-muted-foreground italic border-t border-border/50 mt-1 flex items-start gap-1.5">
              <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" strokeWidth={1.75} />
              Selecciona primero un cliente para ver si tiene registros aceptados.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PromotionItem({
  item, selected, onPick, accepted,
}: {
  item: PromotionWithRegistrationStatus;
  selected: boolean;
  onPick: () => void;
  accepted?: boolean;
}) {
  const { promotion, pendingRegistration } = item;
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        "w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-muted flex items-center gap-2.5",
        selected && "bg-primary/5",
      )}
    >
      <div className="h-9 w-12 rounded-md bg-muted overflow-hidden grid place-items-center shrink-0">
        {promotion.image ? (
          <img src={promotion.image} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <Building2 className="h-3.5 w-3.5 text-muted-foreground/60" strokeWidth={1.5} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-medium text-foreground truncate">
          {promotion.name}
        </p>
        <p className="text-[10.5px] text-muted-foreground truncate">
          {promotion.location ?? ""}
          {accepted && (
            <span className="ml-1 inline-flex items-center gap-0.5 text-success font-semibold">
              · <FileCheck2 className="h-2.5 w-2.5" strokeWidth={2} /> Registrado
            </span>
          )}
          {!accepted && pendingRegistration && (
            <span className="ml-1 inline-flex items-center gap-0.5 text-warning font-semibold">
              · Registro pendiente
            </span>
          )}
        </p>
      </div>
      {selected && <Check className="h-3.5 w-3.5 text-foreground shrink-0" />}
    </button>
  );
}
