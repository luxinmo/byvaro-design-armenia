/**
 * MemberFormDialog · edición del perfil de un miembro del equipo.
 *
 * Usado desde `/equipo` y `/ajustes/usuarios/miembros` al clicar en una
 * card o fila. Permite al admin rellenar / editar todos los campos del
 * `TeamMember` (avatar, identidad, contacto, idiomas, rol, permisos) y
 * ejecutar acciones destructivas (desactivar / eliminar).
 *
 * El admin no edita el perfil desde la pantalla de cada usuario — eso
 * lo hace el propio usuario en `/ajustes/perfil/personal`. Pero el admin
 * puede rellenarlo al dar de alta un miembro o completar datos que
 * faltan para que el microsite público y la asignación por idioma
 * funcionen correctamente.
 *
 * NOTE: los cambios se propagan al padre vía `onSave(patch)`. El padre
 * decide si persiste inmediatamente o muestra un toast.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Camera, Check, Plus, X, Phone, Mail, Shield, ShieldCheck,
  UserCheck, UserX, Trash2, PenLine, Eye, EyeOff, KeyRound,
  MessageCircle, Lock, Activity, Clock, CircleCheck, CircleAlert,
  TrendingUp, Euro, CalendarDays, ArrowRight, FileText, Target,
} from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { PhotoCropModal } from "@/components/settings/PhotoCropModal";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { LANGUAGES, findLanguageByCode } from "@/lib/languages";
import { Flag } from "@/components/ui/Flag";
import type { TeamMember, TeamMemberStatus } from "@/lib/team";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { JobTitlePicker } from "@/components/team/JobTitlePicker";
import { parseJobTitle, encodeJobTitle, derivedDepartment } from "@/data/jobTitles";
import {
  getMemberStats, formatEur, formatPct, formatMinutes,
} from "@/data/memberStats";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Miembro en edición. `null` abre el dialog en modo "crear". */
  member: TeamMember | null;
  onSave: (patch: Partial<TeamMember>) => void;
  onDeactivate?: () => void;
  onReactivate?: () => void;
  onRemove?: () => void;
};

/* Sugerencias de departamentos y cargos · consistentes con /ajustes/perfil. */
const DEPARTMENT_SUGGESTIONS = [
  "Comercial", "Marketing", "Operaciones", "Administración",
  "Dirección", "Atención al cliente", "Legal",
];

export function MemberFormDialog({
  open, onClose, member, onSave, onDeactivate, onReactivate, onRemove,
}: Props) {
  const confirm = useConfirm();

  /* ─── Form state ─── */
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  /* jobTitle se guarda como string "A & B" pero editamos un array de
   * claves `jobTitleKeys` para el picker multi-select. */
  const [jobTitleKeys, setJobTitleKeys] = useState<string[]>([]);
  const [department, setDepartment] = useState("");
  /* Cuando el admin haya tocado el departamento manualmente, dejamos de
   * autoderivarlo desde los cargos. */
  const [departmentTouched, setDepartmentTouched] = useState(false);
  const [languages, setLanguages] = useState<string[]>([]);
  const [role, setRole] = useState<"admin" | "member">("member");
  const [avatar, setAvatar] = useState<string | undefined>(undefined);
  const [visibleOnProfile, setVisibleOnProfile] = useState(false);
  const [canSign, setCanSign] = useState(false);
  const [canAcceptRegistrations, setCanAcceptRegistrations] = useState(false);
  /* Plan de comisiones · opcional. `""` en el input = no asignar. */
  const [commissionCapture, setCommissionCapture] = useState<string>("");
  const [commissionSale, setCommissionSale] = useState<string>("");

  /* UI state */
  const [photoOpen, setPhotoOpen] = useState(false);
  const [langPickerOpen, setLangPickerOpen] = useState(false);
  const [deptPickerOpen, setDeptPickerOpen] = useState(false);

  /* Rellena el form cada vez que se abre con un miembro distinto. */
  useEffect(() => {
    if (!open) return;
    setName(member?.name ?? "");
    setEmail(member?.email ?? "");
    setPhone(member?.phone ?? "");
    setJobTitleKeys(parseJobTitle(member?.jobTitle));
    setDepartment(member?.department ?? "");
    setDepartmentTouched(false);
    setLanguages(member?.languages ?? []);
    setRole(member?.role ?? "member");
    setAvatar(member?.avatarUrl);
    setVisibleOnProfile(!!member?.visibleOnProfile);
    setCanSign(!!member?.canSign);
    setCanAcceptRegistrations(!!member?.canAcceptRegistrations);
    setCommissionCapture(
      member?.commissionCapturePct !== undefined ? String(member.commissionCapturePct) : "",
    );
    setCommissionSale(
      member?.commissionSalePct !== undefined ? String(member.commissionSalePct) : "",
    );
  }, [open, member]);

  const status: TeamMemberStatus = member?.status ?? "active";
  const isDeactive = status === "deactive";
  const isPending = status === "pending";
  const isInvited = status === "invited";

  const initials = useMemo(() => {
    return name
      .split(" ")
      .filter((p) => p && p !== "—")
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "?";
  }, [name]);

  const toggleLanguage = (code: string) =>
    setLanguages((prev) =>
      prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code],
    );

  /** Cambia los cargos + autoasigna depto si el admin no lo ha tocado. */
  const onJobTitleChange = (next: string[]) => {
    setJobTitleKeys(next);
    if (!departmentTouched) {
      setDepartment(derivedDepartment(next) ?? "");
    }
  };

  /** Parseo seguro de % · devuelve undefined si vacío o fuera de rango. */
  const parsePct = (s: string): number | undefined => {
    const t = s.trim();
    if (!t) return undefined;
    const n = Number(t.replace(",", "."));
    if (!Number.isFinite(n)) return undefined;
    return Math.max(0, Math.min(100, n));
  };

  const handleSave = () => {
    const encoded = encodeJobTitle(jobTitleKeys);
    onSave({
      name: name.trim() || member?.name || "—",
      email: email.trim(),
      phone: phone.trim() || undefined,
      jobTitle: encoded || undefined,
      department: department.trim() || undefined,
      languages: languages.length ? languages : undefined,
      role,
      commissionCapturePct: parsePct(commissionCapture),
      commissionSalePct: parsePct(commissionSale),
      avatarUrl: avatar,
      visibleOnProfile,
      canSign,
      canAcceptRegistrations,
    });
    toast.success("Miembro actualizado");
    onClose();
  };

  const handleRemove = async () => {
    if (!onRemove) return;
    const ok = await confirm({
      title: `¿Eliminar a ${member?.name ?? "este miembro"}?`,
      description: "Perderá acceso inmediatamente al workspace. Sus datos creados se conservan.",
      confirmLabel: "Eliminar miembro",
      variant: "destructive",
    });
    if (!ok) return;
    onRemove();
    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="max-w-[760px] p-0 gap-0 rounded-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="px-6 pt-5 pb-3 border-b border-border">
            <DialogTitle className="text-sm font-bold">
              {member ? "Editar miembro" : "Añadir miembro"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Rellena los datos del perfil. Los idiomas y la visibilidad afectan a la asignación de leads y al microsite.
            </DialogDescription>
          </DialogHeader>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

            {/* Estado de cuenta · solo para miembros existentes activos/inactivos */}
            {member && !isPending && !isInvited && (
              <AccountHealth member={member} />
            )}

            {/* Rendimiento comercial · stats de últimos 30 días */}
            {member && !isPending && !isInvited && (
              <PerformanceSummary memberId={member.id} />
            )}

            {/* Avatar */}
            <section className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setPhotoOpen(true)}
                className={cn(
                  "group relative h-20 w-20 rounded-full shrink-0 overflow-hidden transition-transform hover:-translate-y-0.5",
                  avatar ? "shadow-soft" : "bg-primary/15 text-primary grid place-items-center font-semibold text-xl shadow-soft",
                )}
                aria-label="Cambiar foto"
              >
                {avatar ? (
                  <img src={avatar} alt="" className={cn("h-full w-full object-cover", isDeactive && "grayscale")} />
                ) : (
                  <span>{initials}</span>
                )}
                <span className="absolute inset-0 bg-foreground/50 text-background grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="h-5 w-5" />
                </span>
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Foto de perfil</p>
                <p className="text-xs text-muted-foreground mt-0.5">JPG/PNG cuadrada, recortada a círculo.</p>
                <div className="mt-2 flex gap-2">
                  <Button variant="outline" size="sm" className="rounded-full" onClick={() => setPhotoOpen(true)}>
                    <Camera className="h-3.5 w-3.5" />
                    {avatar ? "Cambiar" : "Subir"}
                  </Button>
                  {avatar && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setAvatar(undefined)}
                    >
                      Eliminar
                    </Button>
                  )}
                </div>
              </div>
              <StatusPill status={status} />
            </section>

            {/* Identidad */}
            <section className="space-y-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Identidad
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Nombre completo" className="sm:col-span-2">
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. María González Pérez" />
                </Field>
                <Field label="Email">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nombre@empresa.com"
                      className="pl-9"
                    />
                  </div>
                </Field>
                <Field label="Teléfono">
                  <PhoneInput value={phone} onChange={setPhone} placeholder="600 000 000" />
                </Field>
                <Field label="Cargo · máx 2" className="sm:col-span-2">
                  <JobTitlePicker
                    value={jobTitleKeys}
                    onChange={onJobTitleChange}
                    max={2}
                    placeholder="Selecciona un cargo"
                  />
                </Field>
                <Field label="Departamento" className="sm:col-span-2">
                  <Popover open={deptPickerOpen} onOpenChange={setDeptPickerOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="w-full flex items-center justify-between h-10 px-3 rounded-xl border border-border bg-card text-sm text-foreground hover:border-foreground/30 transition-colors gap-2"
                      >
                        <span className={cn("truncate", !department && "text-muted-foreground")}>
                          {department || "Selecciona"}
                        </span>
                        {!departmentTouched && jobTitleKeys.length > 0 && department && (
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            auto
                          </span>
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[280px] p-1.5" align="start">
                      <div className="px-2 pt-1 pb-2">
                        <Input
                          autoFocus
                          value={department}
                          onChange={(e) => { setDepartment(e.target.value); setDepartmentTouched(true); }}
                          placeholder="Escribe un departamento…"
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {DEPARTMENT_SUGGESTIONS.map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => { setDepartment(d); setDepartmentTouched(true); setDeptPickerOpen(false); }}
                            className="w-full text-left px-2.5 py-1.5 text-sm rounded-lg hover:bg-muted flex items-center justify-between"
                          >
                            <span>{d}</span>
                            {department === d && <Check className="h-3.5 w-3.5 text-foreground" />}
                          </button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </Field>
              </div>
            </section>

            {/* Idiomas */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Idiomas que habla
                </h3>
                <p className="text-[10px] text-muted-foreground">Asignación de leads por idioma</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {languages.map((code) => {
                  const lang = findLanguageByCode(code);
                  return (
                    <span
                      key={code}
                      className="inline-flex items-center gap-1.5 h-8 pl-2 pr-1.5 rounded-full bg-muted text-foreground text-xs font-medium"
                    >
                      <Flag iso={lang?.countryIso} size={14} />
                      {code}
                      <button
                        type="button"
                        onClick={() => toggleLanguage(code)}
                        className="h-5 w-5 rounded-full hover:bg-background/70 grid place-items-center"
                        aria-label={`Quitar ${code}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
                <Popover open={langPickerOpen} onOpenChange={setLangPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="rounded-full h-8 px-3 text-xs">
                      <Plus className="h-3 w-3" /> Añadir
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-60 p-1.5" align="start">
                    <div className="max-h-64 overflow-y-auto">
                      {LANGUAGES.map((l) => {
                        const active = languages.includes(l.code);
                        return (
                          <button
                            key={l.code}
                            type="button"
                            onClick={() => toggleLanguage(l.code)}
                            className="w-full text-left px-2.5 py-1.5 text-sm rounded-lg hover:bg-muted flex items-center justify-between"
                          >
                            <span className="inline-flex items-center gap-2">
                              <Flag iso={l.countryIso} size={14} />
                              <span>{l.name}</span>
                              <span className="text-[10px] text-muted-foreground/60 tracking-wider">{l.code}</span>
                            </span>
                            {active && <Check className="h-3.5 w-3.5 text-foreground" />}
                          </button>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </section>

            {/* Rol + permisos */}
            <section className="space-y-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Rol y permisos
              </h3>
              <Field label="Rol del workspace">
                <div className="inline-flex items-center bg-muted/40 border border-border rounded-full p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setRole("member")}
                    className={cn(
                      "inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full transition-all text-[12.5px] font-medium",
                      role === "member"
                        ? "bg-background text-foreground shadow-soft"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Shield className="h-3.5 w-3.5" /> Miembro
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("admin")}
                    className={cn(
                      "inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full transition-all text-[12.5px] font-medium",
                      role === "admin"
                        ? "bg-background text-foreground shadow-soft"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" /> Admin
                  </button>
                </div>
              </Field>

              <div className="space-y-1.5">
                <PermissionRow
                  icon={KeyRound}
                  label="Puede aprobar registros"
                  description="Decidir sobre leads entrantes de agencias colaboradoras."
                  checked={canAcceptRegistrations}
                  onChange={setCanAcceptRegistrations}
                />
                <PermissionRow
                  icon={PenLine}
                  label="Puede firmar contratos"
                  description="Representar legalmente a la empresa en acuerdos."
                  checked={canSign}
                  onChange={setCanSign}
                />
                <PermissionRow
                  icon={visibleOnProfile ? Eye : EyeOff}
                  label="Visible en el perfil público"
                  description="Aparece en el microsite y la ficha de empresa."
                  checked={visibleOnProfile}
                  onChange={setVisibleOnProfile}
                />
              </div>
            </section>

            {/* Plan de comisiones · opcional */}
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Plan de comisiones
                </h3>
                <span className="text-[10px] text-muted-foreground">Opcional</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Porcentajes que este miembro recibe por captación y por venta.
                Si quedan vacíos, hereda el plan por defecto del workspace.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <CommissionField
                  label="% por captación"
                  description="Al traer un lead al sistema."
                  value={commissionCapture}
                  onChange={setCommissionCapture}
                />
                <CommissionField
                  label="% por venta"
                  description="Al cerrar la venta del registro."
                  value={commissionSale}
                  onChange={setCommissionSale}
                />
              </div>
            </section>

            {/* Acciones destructivas · solo miembros existentes */}
            {member && !isPending && !isInvited && (
              <section className="pt-4 border-t border-border/60 flex flex-wrap gap-2 justify-end">
                {isDeactive ? (
                  onReactivate && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => { onReactivate(); onClose(); }}
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      Reactivar
                    </Button>
                  )
                ) : (
                  onDeactivate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-full text-muted-foreground hover:text-foreground"
                      onClick={() => { onDeactivate(); onClose(); }}
                    >
                      <UserX className="h-3.5 w-3.5" />
                      Desactivar
                    </Button>
                  )
                )}
                {onRemove && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={handleRemove}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Eliminar
                  </Button>
                )}
              </section>
            )}
          </div>

          <DialogFooter className="px-6 py-3 border-t border-border flex-row justify-end gap-2 sm:gap-2">
            <Button variant="outline" size="sm" className="rounded-full" onClick={onClose}>
              Cancelar
            </Button>
            <Button size="sm" className="rounded-full" onClick={handleSave}>
              <Check className="h-3.5 w-3.5" />
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de recorte de foto (montado fuera del Dialog para evitar conflicto de z-index) */}
      <PhotoCropModal
        open={photoOpen}
        onClose={() => setPhotoOpen(false)}
        onSave={(url) => setAvatar(url || undefined)}
        currentImage={avatar}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Subcomponentes visuales
   ═══════════════════════════════════════════════════════════════════ */

function Field({
  label, children, className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

/** Input de porcentaje · acepta "25", "25.5", "25,5" · admite vacío. */
function CommissionField({
  label, description, value, onChange,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </span>
      <div className="mt-1 relative">
        <Input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => {
            /* Permitir solo números, coma y punto. */
            const cleaned = e.target.value.replace(/[^\d.,]/g, "");
            onChange(cleaned);
          }}
          placeholder="—"
          className="pr-8 tnum"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
          %
        </span>
      </div>
      <p className="text-[10.5px] text-muted-foreground mt-1 leading-snug">{description}</p>
    </label>
  );
}

function StatusPill({ status }: { status: TeamMemberStatus }) {
  const meta =
    status === "invited"  ? { label: "Invitado",  cls: "bg-primary/10 text-primary" } :
    status === "pending"  ? { label: "Pendiente", cls: "bg-warning/15 text-warning" } :
    status === "deactive" ? { label: "Inactivo",  cls: "bg-muted text-muted-foreground" } :
                            { label: "Activo",    cls: "bg-success/10 text-success" };
  return (
    <span className={cn("text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0", meta.cls)}>
      {meta.label}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PerformanceSummary · 6 KPIs comerciales del miembro (últ 30d)
   ═══════════════════════════════════════════════════════════════════ */
function PerformanceSummary({ memberId }: { memberId: string }) {
  const stats = getMemberStats(memberId, "30d");
  if (!stats) return null;

  const approvalRate = stats.recordsTotal > 0
    ? stats.recordsApproved / stats.recordsTotal
    : 0;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Rendimiento · últimos 30 días
        </h3>
        <Link
          to={`/equipo/${memberId}/estadisticas`}
          className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-1"
        >
          Ver estadísticas completas
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <KpiTile
          icon={Euro}
          label="Ventas cerradas"
          value={formatEur(stats.salesValue)}
          sub={`${stats.salesCount} ${stats.salesCount === 1 ? "operación" : "operaciones"}`}
          tone="emerald"
        />
        <KpiTile
          icon={FileText}
          label="Registros aprobados"
          value={`${stats.recordsApproved}`}
          sub={`de ${stats.recordsTotal} (${formatPct(approvalRate)})`}
        />
        <KpiTile
          icon={CalendarDays}
          label="Visitas realizadas"
          value={`${stats.visitsDone}`}
          sub={stats.visitsUpcoming > 0 ? `${stats.visitsUpcoming} próx. 7d` : "Sin agenda"}
        />
        <KpiTile
          icon={Target}
          label="Conversión"
          value={formatPct(stats.conversionRate)}
          sub="visita → venta"
        />
        <KpiTile
          icon={Clock}
          label="Tiempo en CRM"
          value={formatMinutes(stats.avgDailyActiveMin)}
          sub={`~${stats.avgSessionMin} min/sesión`}
        />
        <KpiTile
          icon={TrendingUp}
          label="Racha activa"
          value={`${stats.activeStreakDays} d`}
          sub={stats.daysWithoutLogin > 0 ? `${stats.daysWithoutLogin}d sin entrar` : "Constante"}
          tone={stats.activeStreakDays >= 10 ? "emerald" : stats.daysWithoutLogin > 2 ? "amber" : "default"}
        />
      </div>
    </section>
  );
}

function KpiTile({
  icon: Icon, label, value, sub, tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "emerald" | "amber" | "destructive";
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={cn(
          "h-3 w-3",
          tone === "emerald" && "text-success",
          tone === "amber" && "text-warning",
          tone === "destructive" && "text-destructive",
          tone === "default" && "text-muted-foreground",
        )} />
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground leading-none">
          {label}
        </span>
      </div>
      <p className={cn(
        "text-sm font-bold tnum leading-tight",
        tone === "emerald" && "text-success",
        tone === "amber" && "text-warning",
        tone === "destructive" && "text-destructive",
        tone === "default" && "text-foreground",
      )}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   AccountHealth · panel de estado del miembro (visión admin)
   ═══════════════════════════════════════════════════════════════════ */
function AccountHealth({ member }: { member: TeamMember }) {
  const emailOk = (member.emailAccountsCount ?? 0) > 0;
  const wa = !!member.whatsappLinked;
  const tfa = !!member.twoFactorEnabled;

  /* Salud general: traffic light. */
  const issues: string[] = [];
  if (!emailOk) issues.push("email");
  if (!wa) issues.push("whatsapp");
  if (!tfa) issues.push("2FA");
  const health =
    issues.length === 0 ? { label: "Todo en orden",  cls: "bg-success/10 text-success",  icon: CircleCheck } :
    issues.length <= 1  ? { label: "Atención",       cls: "bg-warning/15 text-warning",  icon: CircleAlert } :
                          { label: "Requiere setup", cls: "bg-destructive/10 text-destructive", icon: CircleAlert };
  const HealthIcon = health.icon;

  const lastActive = member.lastActiveAt
    ? formatDistanceToNow(parseISO(member.lastActiveAt), { addSuffix: true, locale: es })
    : "Nunca";

  return (
    <section className="rounded-2xl border border-border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Estado de cuenta
        </h3>
        <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full", health.cls)}>
          <HealthIcon className="h-3 w-3" />
          {health.label}
        </span>
      </div>

      {/* Grid de señales */}
      <div className="grid grid-cols-2 gap-2">
        <HealthChip
          icon={Mail}
          ok={emailOk}
          label="Email"
          detail={emailOk
            ? `${member.emailAccountsCount} ${member.emailAccountsCount === 1 ? "cuenta" : "cuentas"}`
            : "Sin configurar"}
        />
        <HealthChip
          icon={MessageCircle}
          ok={wa}
          label="WhatsApp"
          detail={wa ? "Vinculado" : "No vinculado"}
        />
        <HealthChip
          icon={Lock}
          ok={tfa}
          label="2FA"
          detail={tfa ? "Activa" : "Desactivada"}
        />
        <HealthChip
          icon={Clock}
          ok={!!member.lastActiveAt}
          label="Última conexión"
          detail={lastActive}
          neutral
        />
      </div>

      {/* Métricas últimas 30 días */}
      {(member.emailsSentLast30d !== undefined || member.recordsDecidedLast30d !== undefined) && (
        <div className="flex items-center gap-4 pt-2 border-t border-border/60 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Activity className="h-3 w-3" />
            Últimos 30 días:
          </span>
          {member.emailsSentLast30d !== undefined && (
            <span>
              <b className="text-foreground tnum">{member.emailsSentLast30d}</b> emails
            </span>
          )}
          {member.recordsDecidedLast30d !== undefined && (
            <span>
              <b className="text-foreground tnum">{member.recordsDecidedLast30d}</b> registros decididos
            </span>
          )}
        </div>
      )}
    </section>
  );
}

function HealthChip({
  icon: Icon, ok, label, detail, neutral,
}: {
  icon: React.ComponentType<{ className?: string }>;
  ok: boolean;
  label: string;
  detail: string;
  neutral?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 p-2.5 rounded-xl border bg-card",
        neutral
          ? "border-border/60"
          : ok
            ? "border-success/30"
            : "border-destructive/20",
      )}
    >
      <div
        className={cn(
          "h-8 w-8 rounded-lg grid place-items-center shrink-0",
          neutral
            ? "bg-muted text-muted-foreground"
            : ok
              ? "bg-success/10 text-success"
              : "bg-destructive/10 text-destructive",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-none">
          {label}
        </p>
        <p className="text-xs font-semibold text-foreground mt-0.5 truncate">{detail}</p>
      </div>
    </div>
  );
}

function PermissionRow({
  icon: Icon, label, description, checked, onChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-muted/40 cursor-pointer transition-colors">
      <div className="h-8 w-8 rounded-lg bg-muted text-muted-foreground grid place-items-center shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground leading-tight">{label}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={cn(
          "relative appearance-none h-5 w-9 rounded-full transition-colors cursor-pointer shrink-0 mt-0.5",
          "bg-muted checked:bg-foreground",
          "before:content-[''] before:absolute before:top-0.5 before:left-0.5 before:h-4 before:w-4 before:rounded-full before:bg-white before:shadow-soft before:transition-transform",
          "checked:before:translate-x-4",
        )}
      />
    </label>
  );
}
