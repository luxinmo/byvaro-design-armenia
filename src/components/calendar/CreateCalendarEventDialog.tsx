/**
 * CreateCalendarEventDialog · crear / editar un evento del calendario.
 *
 * Detección de conflicto DURA (ADR-056):
 * si el agente ya tiene un evento solapando, NO se permite guardar ·
 * banner rojo + CTA "Cambiar el existente primero" que navega al
 * evento que choca.
 *
 * Componentes canónicos:
 *   - `<UserSelect onlyActive>` para el responsable (único).
 *   - `<Select>` de Radix para el tipo y para los presets de duración.
 *   - Inputs nativos `date` / `time` (consistente con el resto de
 *     formularios de la app).
 *
 * Uso:
 *   <CreateCalendarEventDialog
 *     open onOpenChange={setOpen}
 *     preset={{ date, hour, assigneeUserId, type, leadId, ... }}
 *   />
 * O para editar:
 *   <CreateCalendarEventDialog open onOpenChange=...
 *     event={existingEvent} />
 *
 * TODO(backend): POST /api/calendar/events (o PATCH si editando).
 *   El conflict check debería replicarse server-side para consistencia.
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { UserSelect } from "@/components/ui/UserSelect";
import {
  AlertTriangle, ArrowRight, MapPin, Home, Phone, Users, Ban, Bell,
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
import { cn } from "@/lib/utils";

type Preset = {
  /** Fecha default para el input `date`. */
  date?: Date;
  /** Hora default (0-23) para el input `time`. Minutos = 0. */
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
  /** Si se pasa, el dialog edita este evento en lugar de crear uno nuevo. */
  event?: CalendarEvent;
  /** Valores iniciales al crear (se ignoran si `event` se pasa). */
  preset?: Preset;
  /** Callback tras crear/editar · recibe el evento resultante. */
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
  const [contactName, setContactName] = useState<string>(
    event?.contactName ?? preset?.contactName ?? "",
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

  // Refresco del preset si cambia (ej. cliquea otro slot vacío).
  useEffect(() => {
    if (!open) return;
    if (isEdit) return; // si edita no sobreescribe
    if (preset?.type) setType(preset.type);
    if (preset?.title) setTitle(preset.title);
    if (preset?.date) setDate(toDateInputValue(preset.date));
    if (preset?.hour != null) setTime(`${String(preset.hour).padStart(2, "0")}:00`);
    if (preset?.assigneeUserId) setAssigneeUserId(preset.assigneeUserId);
    if (preset?.contactName) setContactName(preset.contactName);
    if (preset?.status) setStatus(preset.status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* ─── Start/End calculados ─── */
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

  /* ─── Submit ─── */
  const canSave = !!assigneeUserId && !!title.trim() && !conflict;
  const onSave = () => {
    if (!canSave || !assigneeUserId) return;
    const assigneeMember = findTeamMember(assigneeUserId);
    if (isEdit && event) {
      updateCalendarEvent(event.id, {
        type, title: title.trim(),
        start: startISO, end: endISO,
        assigneeUserId,
        assigneeName: assigneeMember?.name ?? event.assigneeName,
        contactName: contactName.trim() || undefined,
        location: locationLabel.trim()
          ? { label: locationLabel.trim() }
          : undefined,
        notes: notes.trim() || undefined,
        reminder: reminder === "none" ? undefined : reminder,
        status,
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
      status,
      source: preset?.leadId ? "oportunidad" : "manual",
      contactId: preset?.contactId,
      contactName: contactName.trim() || undefined,
      leadId: preset?.leadId,
      promotionId: preset?.promotionId,
      promotionName: preset?.promotionName,
      unitLabel: preset?.unitLabel,
      location: locationLabel.trim() ? { label: locationLabel.trim() } : undefined,
      notes: notes.trim() || undefined,
      reminder: reminder === "none" ? undefined : reminder,
      createdByUserId: currentUser.id,
    } as Parameters<typeof createCalendarEvent>[0]);
    toast.success("Evento creado", { description: formatTimeRange(startISO, endISO) });
    onSaved?.(created);
    onOpenChange(false);
  };

  const TypeIcon = TYPE_ICONS[type];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar evento" : "Nuevo evento"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modifica los detalles del evento. Si cambias fecha/hora se vuelve a comprobar el conflicto."
              : "Añade una visita, llamada, reunión o bloqueo a la agenda del agente."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-1">
          {/* Tipo · segmented */}
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">
              Tipo de evento
            </label>
            <div className="grid grid-cols-5 gap-1.5">
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
                      "flex flex-col items-center gap-1 h-14 rounded-xl border text-[10.5px] font-medium transition-colors",
                      active
                        ? `${cfg.bgClass} ${cfg.textClass} ${cfg.borderClass} ring-2 ring-offset-1 ring-offset-background`
                        : "bg-card border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                    {cfg.label}
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

          {/* Fecha + hora + duración */}
          <div className="grid grid-cols-3 gap-2">
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

          {/* Conflicto · banner rojo bloqueante */}
          {conflict && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" strokeWidth={2} />
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-semibold text-destructive">
                    Conflicto de agenda
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
                      if (conflict.leadId) navigate(`/oportunidades/${conflict.leadId}`);
                      else navigate("/calendario");
                      toast.info("Abre el evento en conflicto para modificarlo");
                    }}
                    className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-destructive hover:underline"
                  >
                    Ir al evento en conflicto <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Contacto + Ubicación */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label="Cliente / contacto">
              <Input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Nombre del cliente"
              />
            </Field>
            <Field label={type === "call" ? "Número" : "Ubicación"}>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                <Input
                  value={locationLabel}
                  onChange={(e) => setLocationLabel(e.target.value)}
                  placeholder={
                    type === "call" ? "+34 600 000 000" :
                    type === "meeting" ? "Oficina HQ / Zoom" :
                    "Villa Serena · Marbella"
                  }
                  className="pl-8"
                />
              </div>
            </Field>
          </div>

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
              <Select value={status} onValueChange={(v) => setStatus(v as CalendarEventStatus)}>
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

          {/* Preview del tipo · feedback visual */}
          <div className="rounded-lg bg-muted/30 px-3 py-2 flex items-center gap-2">
            <TypeIcon className={cn("h-4 w-4 shrink-0", eventTypeConfig[type].textClass)} strokeWidth={1.75} />
            <p className="text-[11.5px] text-muted-foreground">
              {eventTypeConfig[type].label} · {durationMin} min
              {" · "}
              <span className="tabular-nums">{formatTimeRange(startISO, endISO)}</span>
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-full">
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={!canSave} className="rounded-full">
            {isEdit ? "Guardar cambios" : "Crear evento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Sub-componente de label + children, consistente con MemberFormDialog. ─── */
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
