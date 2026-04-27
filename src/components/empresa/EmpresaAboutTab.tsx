/**
 * EmpresaAboutTab · réplica del CompanyAboutTab con mis componentes.
 * Secciones: Historia (overview largo), Detalles (legal name, trade
 * name, CIF, founded, phone, email, schedule), Webs, Verificación.
 */

import { useMemo, useRef, useState } from "react";
import {
  Globe, Phone, Mail, Clock, Linkedin, Instagram, Facebook,
  Youtube, Music2, ShieldCheck, Upload, Trash2, ChevronDown, CheckCircle2,
  Search, Plus, FileText, Image as ImageIcon, X,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspaceMembers } from "@/lib/useWorkspaceMembers";
import { memberInitials, type TeamMember } from "@/lib/team";
import type { Empresa } from "@/lib/empresa";
import { EditableSection } from "./EditableSection";
import { GoogleRatingCard } from "./GoogleRatingCard";
import { cn } from "@/lib/utils";

const inputClass = "h-9 w-full px-3 text-[13px] bg-card border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/60";
const textareaClass = cn(inputClass, "h-auto py-2.5 resize-y min-h-[120px]");

export function EmpresaAboutTab({
  viewMode,
  empresa,
  update,
  isVisitor = false,
  isAdmin = true,
}: {
  viewMode: "edit" | "preview";
  empresa: Empresa;
  update: <K extends keyof Empresa>(key: K, value: Empresa[K]) => void;
  /** Visitor (agencia mirando promotor o promotor mirando agencia)
   *  → no ve placeholders del tipo "Añade tu X" ni datos fiscales
   *  sensibles (CIF). */
  isVisitor?: boolean;
  /** Rol del usuario en el workspace · admin ve todo, member NO ve
   *  CIF (dato fiscal sensible). Cuando hay backend, esto se valida
   *  server-side: el endpoint `/api/empresa` strippea el CIF si el
   *  caller no tiene permiso. */
  isAdmin?: boolean;
}) {
  /** En modo "público" (visitor o el propio promotor en preview) no
   *  mostramos placeholders tipo "Añade tu sitio web" — el visitante
   *  externo nunca lee CTA del owner. Renderizamos `null` cuando el
   *  campo está vacío. */
  const isPublic = isVisitor || viewMode === "preview";
  /** El CIF se trata como dato fiscal sensible · solo el admin del
   *  workspace lo ve. Member lo NO ve aunque sea de su propia empresa. */
  const showCif = isAdmin && !isVisitor;

  return (
    <div className="flex flex-col gap-5">
      {/* ═════ Verificación de empresa ═════
          Primera sección del About · una vez verificada desaparece
          para siempre (el sello queda en el hero junto al nombre).
          Sin verificar, vale 30% de la "Fuerza del perfil". */}
      {!isVisitor && !empresa.verificada && (
        <VerificationSection empresa={empresa} update={update} />
      )}

      {/* ═════ Historia ═════ */}
      <EditableSection
        title="Historia"
        viewMode={viewMode}
        editContent={
          <textarea
            value={empresa.aboutOverview}
            onChange={(e) => update("aboutOverview", e.target.value)}
            placeholder="Cuenta la historia de tu empresa: origen, hitos, cómo habéis llegado aquí…"
            className={textareaClass}
          />
        }
      >
        <p className="text-[12.5px] text-muted-foreground leading-relaxed">
          {empresa.aboutOverview || "Cuenta la historia de tu empresa. Origen, hitos, equipo…"}
        </p>
      </EditableSection>

      {/* ═════ Detalles ═════ */}
      <EditableSection
        title="Detalles"
        viewMode={viewMode}
        editContent={
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted-foreground">Razón social</label>
                <input value={empresa.razonSocial} onChange={(e) => update("razonSocial", e.target.value)} className={inputClass} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted-foreground">Nombre comercial</label>
                <input value={empresa.nombreComercial} onChange={(e) => update("nombreComercial", e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {showCif && (
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-muted-foreground">CIF/NIF/VAT</label>
                  <input value={empresa.cif} onChange={(e) => update("cif", e.target.value.toUpperCase())} className={cn(inputClass, "font-mono tracking-wider")} placeholder="B12345674" />
                </div>
              )}
              <div className={cn("flex flex-col gap-1", !showCif && "col-span-2")}>
                <label className="text-[10px] text-muted-foreground">Fundada en</label>
                <input value={empresa.fundadaEn} onChange={(e) => update("fundadaEn", e.target.value)} className={inputClass} placeholder="2012" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted-foreground">Teléfono</label>
                <input value={empresa.telefono} onChange={(e) => update("telefono", e.target.value)} className={inputClass} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted-foreground">Email</label>
                <input value={empresa.email} onChange={(e) => update("email", e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground">Horario</label>
              <input value={empresa.horario} onChange={(e) => update("horario", e.target.value)} className={inputClass} placeholder="L-S 9:30-14:00 / 16:30-19:00" />
            </div>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <div className="flex flex-col gap-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Razón social</p>
            <p className="text-[12.5px] text-foreground font-medium">{empresa.razonSocial || "—"}</p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Nombre comercial</p>
            <p className="text-[12.5px] text-foreground font-medium">{empresa.nombreComercial || "—"}</p>
          </div>
          {showCif && (
            <div className="flex flex-col gap-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">CIF/NIF/VAT</p>
              <p className="text-[12.5px] text-foreground font-medium font-mono tracking-wider">{empresa.cif || "—"}</p>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Fundada en</p>
            <p className="text-[12.5px] text-foreground font-medium tnum">{empresa.fundadaEn || "—"}</p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Teléfono</p>
            <p className="text-[12px] text-muted-foreground flex items-center gap-1.5">
              <Phone className="h-3 w-3" /> {empresa.telefono || "—"}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Email</p>
            <p className="text-[12px] text-muted-foreground flex items-center gap-1.5">
              <Mail className="h-3 w-3" /> {empresa.email || "—"}
            </p>
          </div>
          <div className="col-span-2 flex flex-col gap-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Horario</p>
            <p className="text-[12px] text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3 w-3" /> {empresa.horario || "—"}
            </p>
          </div>
        </div>
      </EditableSection>

      {/* ═════ Webs ═════ */}
      {/* ═════ Reseñas de Google · admin only en edit mode ═════
          Reusa el componente original `<GoogleRatingCard>` (modal
          grande con URL + rating + atribución Google ToS). Antes
          vivía en el Home tab · movido aquí porque About es donde
          el admin configura datos públicos de la empresa. */}
      {!isVisitor && isAdmin && viewMode === "edit" && (
        <GoogleRatingCard empresa={empresa} viewMode={viewMode} update={update} />
      )}

      {/* ═════ Redes sociales y web ═════ */}
      <EditableSection
        title="Redes sociales y web"
        viewMode={viewMode}
        editContent={
          <div className="flex flex-col gap-3">
            <p className="text-[11.5px] text-muted-foreground leading-relaxed">
              Estos enlaces aparecen en el header de tu ficha pública (iconos
              discretos · click → abre el perfil correspondiente). Pega la URL
              completa o el handle (`@empresa`) — soportamos ambos.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                  <Globe className="h-3 w-3" /> Sitio web
                </label>
                <input value={empresa.sitioWeb} onChange={(e) => update("sitioWeb", e.target.value)} className={inputClass} placeholder="www.empresa.com" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                  <Linkedin className="h-3 w-3" /> LinkedIn
                </label>
                <input value={empresa.linkedin} onChange={(e) => update("linkedin", e.target.value)} className={inputClass} placeholder="linkedin.com/company/…" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                  <Instagram className="h-3 w-3" /> Instagram
                </label>
                <input value={empresa.instagram} onChange={(e) => update("instagram", e.target.value)} className={inputClass} placeholder="@tu_instagram" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                  <Facebook className="h-3 w-3" /> Facebook
                </label>
                <input value={empresa.facebook} onChange={(e) => update("facebook", e.target.value)} className={inputClass} placeholder="facebook.com/tuempresa" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                  <Youtube className="h-3 w-3" /> YouTube
                </label>
                <input value={empresa.youtube} onChange={(e) => update("youtube", e.target.value)} className={inputClass} placeholder="youtube.com/@tuempresa" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                  <Music2 className="h-3 w-3" /> TikTok
                </label>
                <input value={empresa.tiktok} onChange={(e) => update("tiktok", e.target.value)} className={inputClass} placeholder="@tu_tiktok" />
              </div>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-2">
          {(empresa.sitioWeb || !isPublic) && (
            <div className="flex items-center gap-3">
              <Globe className="h-3.5 w-3.5 text-muted-foreground/60" />
              <a href={empresa.sitioWeb ? (empresa.sitioWeb.startsWith("http") ? empresa.sitioWeb : `https://${empresa.sitioWeb}`) : "#"} target="_blank" rel="noreferrer" className="text-[12.5px] text-primary hover:underline">
                {empresa.sitioWeb || "Añade tu sitio web"}
              </a>
            </div>
          )}
          {empresa.linkedin && (
            <div className="flex items-center gap-3">
              <Linkedin className="h-3.5 w-3.5 text-muted-foreground/60" />
              <a href={empresa.linkedin.startsWith("http") ? empresa.linkedin : `https://${empresa.linkedin}`} target="_blank" rel="noreferrer" className="text-[12.5px] text-primary hover:underline truncate">
                {empresa.linkedin}
              </a>
            </div>
          )}
          {empresa.instagram && (
            <div className="flex items-center gap-3">
              <Instagram className="h-3.5 w-3.5 text-muted-foreground/60" />
              <span className="text-[12.5px] text-foreground truncate">{empresa.instagram}</span>
            </div>
          )}
          {empresa.facebook && (
            <div className="flex items-center gap-3">
              <Facebook className="h-3.5 w-3.5 text-muted-foreground/60" />
              <span className="text-[12.5px] text-foreground truncate">{empresa.facebook}</span>
            </div>
          )}
          {empresa.youtube && (
            <div className="flex items-center gap-3">
              <Youtube className="h-3.5 w-3.5 text-muted-foreground/60" />
              <span className="text-[12.5px] text-foreground truncate">{empresa.youtube}</span>
            </div>
          )}
          {empresa.tiktok && (
            <div className="flex items-center gap-3">
              <Music2 className="h-3.5 w-3.5 text-muted-foreground/60" />
              <span className="text-[12.5px] text-foreground truncate">{empresa.tiktok}</span>
            </div>
          )}
          {empresa.nombreComercial && (
            <div className="flex items-center gap-3">
              <Globe className="h-3.5 w-3.5 text-muted-foreground/60" />
              <a href="#" className="text-[12.5px] text-primary hover:underline">
                {empresa.nombreComercial.toLowerCase().replace(/\s+/g, "")}.byvaro.com
              </a>
            </div>
          )}
        </div>
      </EditableSection>

      {/* La sección de Verificación que vivía aquí abajo se ha
          movido al TOP del tab y desaparece para siempre una vez
          verificada · el sello queda solo junto al nombre en el hero
          (`<VerifiedBadge>`). */}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   VerificationSection
   ───────────────────────────────────────────────────────────────────
   Flujo simple en una tarjeta plegable:
     1. Colapsada (default): título + 1 línea de descripción + botón
        "Iniciar verificación".
     2. Expandida: form con 2 uploads (CIF empresa, DNI/NIE del
        representante) + 3 inputs (nombre completo, email, teléfono).
     3. Tras "Solicitar verificación" se muestra estado
        "firmafy-pendiente" con instrucciones · enviamos un documento
        de declaración responsable a Firmafy y, al firmar el
        representante, el equipo Byvaro valida y aprueba.

   TODO(backend):
     · POST /api/empresa/verification  body: { representante, docs:
       [{ kind: "cif"|"identidad", fileId }] } → 202 { requestId }.
     · Webhook firmafy → marca `firmafy-pendiente` → "revision-byvaro".
     · Superadmin Byvaro aprueba/rechaza · al aprobar setea
       `verificada=true`, `verificadaEl=ISO`. Ver
       `docs/screens/admin-verificaciones.md` (a crear).
   ═══════════════════════════════════════════════════════════════════ */
function VerificationSection({
  empresa, update,
}: {
  empresa: Empresa;
  update: <K extends keyof Empresa>(key: K, value: Empresa[K]) => void;
}) {
  const estado = empresa.verificacionEstado ?? "no-iniciada";
  /* Colapsada por defecto. Si el usuario ya empezó (datos guardados
   * pero no enviados), abrimos directo para que termine sin clicar. */
  const [open, setOpen] = useState(estado === "datos-pendientes");

  const rep = empresa.verificacionRepresentante ?? { nombreCompleto: "", email: "", telefono: "", phonePrefix: "+34" };
  const docs = empresa.verificacionDocs ?? {};
  /* Miembros del workspace · usados por el picker de representante.
   * Si el usuario elige uno existente, "arrastramos" sus datos
   * (nombre, email, teléfono). Si no existe en el equipo, puede
   * crear uno nuevo desde el picker que se añade al workspace
   * automáticamente con rol "admin" (queda como propietario legal). */
  const { members: workspaceMembers, setMembers: setWorkspaceMembers } = useWorkspaceMembers();
  /* Por defecto asumimos que el representante firma solo. Si la
   * empresa tiene apoderados solidarios o varios administradores,
   * el promotor cambia a "Hay personas autorizadas" y los añade. */
  const firmaUnica = empresa.verificacionFirmaUnica !== false;
  const autorizados = empresa.verificacionAutorizados ?? [];
  const cifFileRef = useRef<HTMLInputElement>(null);
  const idFileRef = useRef<HTMLInputElement>(null);

  /* Multi-archivo · acepta PDF + imágenes (PNG/JPG/HEIC/WebP).
   * Cada doc se guarda como array · útil para DNI (frontal+dorso) o
   * cuando el promotor sube CIF en PDF + foto adicional. Tope 5MB
   * por archivo · backend valida igual con multipart upload. */
  const ACCEPTED_TYPES = "application/pdf,image/png,image/jpeg,image/heic,image/webp";

  const addFiles = (kind: "cifEmpresa" | "identidadRepresentante", files: FileList | File[]) => {
    const arr = Array.from(files);
    arr.forEach((f) => {
      if (!/^application\/pdf$|^image\//.test(f.type)) {
        toast.error(`${f.name}: solo PDF o imagen`);
        return;
      }
      if (f.size > 5 * 1024 * 1024) {
        toast.error(`${f.name}: máximo 5MB`);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const current = docs[kind] ?? [];
        update("verificacionDocs", {
          ...docs,
          [kind]: [...current, {
            name: f.name,
            dataUrl: reader.result as string,
            uploadedAt: new Date().toISOString(),
            mime: f.type,
          }],
        });
        if (estado === "no-iniciada") update("verificacionEstado", "datos-pendientes");
      };
      reader.readAsDataURL(f);
    });
  };

  const handleFile = (kind: "cifEmpresa" | "identidadRepresentante") => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(kind, e.target.files);
    e.target.value = ""; // reset para permitir re-subir el mismo nombre
  };

  const removeDocFile = (kind: "cifEmpresa" | "identidadRepresentante", idx: number) => {
    const list = docs[kind] ?? [];
    const next = list.filter((_, i) => i !== idx);
    update("verificacionDocs", { ...docs, [kind]: next.length === 0 ? undefined : next });
  };

  /* Selecciona un miembro existente como representante · arrastra
   * sus datos al rep y guarda el `memberId` para auditoría. */
  const selectMember = (m: TeamMember) => {
    /* Parse del teléfono: si empieza por "+", extraemos prefijo. */
    let prefix = rep.phonePrefix || "+34";
    let local = m.phone || "";
    if (local.startsWith("+")) {
      const space = local.indexOf(" ");
      if (space > 0) {
        prefix = local.slice(0, space);
        local = local.slice(space + 1).replace(/\s+/g, " ");
      }
    }
    update("verificacionRepresentante", {
      memberId: m.id,
      nombreCompleto: m.name,
      email: m.email,
      telefono: local,
      phonePrefix: prefix,
    });
    if (estado === "no-iniciada") update("verificacionEstado", "datos-pendientes");
  };

  /* Crea un nuevo miembro del workspace y lo selecciona como
   * representante · queda como `admin` (propietario legal de la
   * empresa) y visible en el perfil público.
   * TODO(backend): POST /api/workspace/members + body { name, email,
   *   phone, role: "admin", source: "verificacion-representante" }.
   *   El backend además dispara la invitación por email para que el
   *   usuario active su cuenta. */
  const createMemberAsRep = (data: { nombreCompleto: string; email: string; telefono: string; phonePrefix: string }) => {
    const id = `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newMember: TeamMember = {
      id,
      name: data.nombreCompleto.trim(),
      email: data.email.trim(),
      role: "admin",
      phone: `${data.phonePrefix} ${data.telefono.trim()}`.trim(),
      status: "active",
      visibleOnProfile: true,
      canSign: true,
      joinedAt: new Date().toISOString(),
    };
    setWorkspaceMembers([...workspaceMembers, newMember]);
    update("verificacionRepresentante", {
      memberId: id,
      nombreCompleto: newMember.name,
      email: newMember.email,
      telefono: data.telefono.trim(),
      phonePrefix: data.phonePrefix,
    });
    if (estado === "no-iniciada") update("verificacionEstado", "datos-pendientes");
    toast.success(`${newMember.name} añadido al equipo como propietario legal`);
  };

  const clearRep = () => {
    update("verificacionRepresentante", { memberId: undefined, nombreCompleto: "", email: "", telefono: "", phonePrefix: "+34" });
  };

  const setFirmaUnica = (v: boolean) => {
    update("verificacionFirmaUnica", v);
    if (v) update("verificacionAutorizados", []);
    if (estado === "no-iniciada") update("verificacionEstado", "datos-pendientes");
  };
  const addAutorizado = () => {
    update("verificacionAutorizados", [
      ...autorizados,
      { nombreCompleto: "", email: "", telefono: "", phonePrefix: "+34" },
    ]);
    if (estado === "no-iniciada") update("verificacionEstado", "datos-pendientes");
  };
  const updateAutorizado = (idx: number, patch: Partial<typeof autorizados[number]>) => {
    update("verificacionAutorizados", autorizados.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  };
  const removeAutorizado = (idx: number) => {
    update("verificacionAutorizados", autorizados.filter((_, i) => i !== idx));
  };

  const autorizadosOk = firmaUnica
    || (autorizados.length > 0 && autorizados.every(a => a.nombreCompleto.trim() && a.email.trim() && a.telefono.trim()));
  const canSubmit = (docs.cifEmpresa?.length ?? 0) > 0
    && (docs.identidadRepresentante?.length ?? 0) > 0
    && !!rep.nombreCompleto.trim() && !!rep.email.trim() && !!rep.telefono.trim()
    && autorizadosOk;

  const handleSubmit = () => {
    /* MOCK · marca el estado como "firmafy-pendiente" para enseñar
     * la transición. En producción aquí va el POST a backend, que
     * dispara el envío a Firmafy con el documento de declaración
     * responsable pre-rellenado con los datos del representante. */
    update("verificacionEstado", "firmafy-pendiente");
    update("verificacionSolicitadaEl", new Date().toISOString());
    toast.success("Solicitud enviada · te llegará un email de Firmafy en minutos");
  };

  /* Estado pendiente · permanece VISIBLE hasta que el superadmin
   * Byvaro apruebe manualmente. Antes desaparecía al firmar; eso era
   * incorrecto · la aprobación es siempre humana, no automática.
   *
   *   · firmafy-pendiente → esperando que el representante firme
   *     en Firmafy. El usuario ve "Esperando firma".
   *   · revision-byvaro   → firmado. Esperando validación manual del
   *     equipo Byvaro. El usuario ve "En revisión".
   *
   * Solo cuando `estado === "verificada"` (lo que coincide con
   * `empresa.verificada === true`) el render padre oculta la
   * sección · ver guard al inicio del componente. */
  if (estado === "firmafy-pendiente" || estado === "revision-byvaro" || estado === "rechazada") {
    const isFirmafy = estado === "firmafy-pendiente";
    const isRevision = estado === "revision-byvaro";
    const isRejected = estado === "rechazada";
    return (
      <section className={cn(
        "rounded-2xl border shadow-soft overflow-hidden",
        isRejected ? "border-destructive/30 bg-destructive/[0.04]" : "border-primary/30 bg-primary/[0.04]",
      )}>
        <div className="px-5 sm:px-6 py-4 flex items-start gap-3">
          <div className={cn(
            "h-9 w-9 rounded-2xl grid place-items-center shrink-0",
            isRejected ? "bg-destructive/10" : "bg-primary/10",
          )}>
            <ShieldCheck className={cn(
              "h-4.5 w-4.5",
              isRejected ? "text-destructive" : "text-primary",
            )} strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className={cn(
              "text-[10px] font-semibold uppercase tracking-[0.14em]",
              isRejected ? "text-destructive" : "text-primary",
            )}>
              {isFirmafy && "Esperando firma"}
              {isRevision && "En revisión por Byvaro"}
              {isRejected && "Verificación rechazada"}
            </p>
            <h3 className="text-[14px] font-bold tracking-tight text-foreground mt-0.5">
              {isFirmafy && "Pendiente de firma del representante"}
              {isRevision && "Validación manual del equipo Byvaro"}
              {isRejected && "Hay que reintentar la verificación"}
            </h3>
            <p className="text-[12px] text-muted-foreground leading-relaxed mt-1">
              {isFirmafy && (
                <>Hemos enviado un documento de declaración responsable a{" "}
                <b className="text-foreground">{rep.email}</b> mediante Firmafy.
                Una vez firmado por todos los firmantes, el equipo Byvaro
                validará los datos manualmente.</>
              )}
              {isRevision && (
                <>Documento firmado. Estamos validando los datos contra el
                Registro Mercantil y la AEAT. Te avisaremos por email cuando
                tu empresa quede verificada (24-48h hábiles).</>
              )}
              {isRejected && (
                <>El equipo Byvaro ha rechazado la verificación. Revisa los
                datos del representante y los documentos subidos antes de
                volver a intentarlo.</>
              )}
            </p>

            {/* Resumen compacto de lo enviado */}
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11.5px]">
              <div className="rounded-lg border border-border bg-background px-2.5 py-1.5">
                <p className="text-muted-foreground">Representante</p>
                <p className="text-foreground font-medium truncate">{rep.nombreCompleto || "—"}</p>
              </div>
              <div className="rounded-lg border border-border bg-background px-2.5 py-1.5">
                <p className="text-muted-foreground">Firmantes</p>
                <p className="text-foreground font-medium">
                  {firmaUnica ? "Solo el representante" : `${1 + autorizados.length} firmantes`}
                </p>
              </div>
            </div>

            {isRejected && (
              <button
                type="button"
                onClick={() => {
                  update("verificacionEstado", "datos-pendientes");
                  toast.message("Revisa los datos y vuelve a enviar la solicitud");
                }}
                className="mt-3 inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-primary text-primary-foreground text-[12.5px] font-semibold hover:bg-primary/90 transition-colors"
              >
                Volver a intentar
              </button>
            )}

            {/* MOCK controls · solo en prototipo · en producción los
                cambios de estado vienen del webhook Firmafy + acción
                del superadmin Byvaro. Ver
                `docs/screens/admin-verificaciones.md`. */}
            {(isFirmafy || isRevision) && (
              <details className="mt-3 group">
                <summary className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer list-none inline-flex items-center gap-1">
                  <span className="group-open:hidden">Controles mock (sólo prototipo)</span>
                  <span className="hidden group-open:inline">Ocultar controles mock</span>
                </summary>
                <div className="mt-2 flex items-center gap-3 flex-wrap">
                  {isFirmafy && (
                    <button
                      type="button"
                      onClick={() => {
                        update("verificacionEstado", "revision-byvaro");
                        toast.success("Firma simulada · pasa a revisión Byvaro");
                      }}
                      className="text-[11px] font-semibold text-primary hover:underline"
                    >
                      Simular firma del representante
                    </button>
                  )}
                  {isRevision && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          update("verificada", true);
                          update("verificadaEl", new Date().toISOString());
                          update("verificacionEstado", "verificada");
                          toast.success("Empresa verificada por superadmin");
                        }}
                        className="text-[11px] font-semibold text-primary hover:underline"
                      >
                        Aprobar como superadmin
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          update("verificacionEstado", "rechazada");
                          toast.message("Solicitud rechazada (mock)");
                        }}
                        className="text-[11px] font-semibold text-destructive hover:underline"
                      >
                        Rechazar como superadmin
                      </button>
                    </>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      </section>
    );
  }

  /* Estado colapsado · ocupa poco · CTA para abrir el form */
  if (!open) {
    return (
      <section className="rounded-2xl border border-primary/30 bg-primary/[0.04] shadow-soft overflow-hidden">
        <div className="px-5 sm:px-6 py-4 flex items-center gap-3 flex-wrap">
          <div className="h-9 w-9 rounded-2xl bg-primary/10 grid place-items-center shrink-0">
            <ShieldCheck className="h-4.5 w-4.5 text-primary" strokeWidth={2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
              Pendiente · suma 30% al perfil
            </p>
            <h3 className="text-[13.5px] font-bold tracking-tight text-foreground mt-0.5">
              Verifica legalmente tu empresa
            </h3>
            <p className="text-[11.5px] text-muted-foreground leading-relaxed mt-0.5">
              Las agencias confían en promotores verificados. Validamos tu CIF
              y la identidad del representante con una declaración firmada.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-primary text-primary-foreground text-[12.5px] font-semibold hover:bg-primary/90 transition-colors shrink-0"
          >
            Iniciar verificación
          </button>
        </div>
      </section>
    );
  }

  /* Estado expandido · form */
  return (
    <section className="rounded-2xl border border-primary/30 bg-primary/[0.04] shadow-soft overflow-hidden">
      <header className="px-5 sm:px-6 pt-4 pb-2 flex items-center gap-3">
        <div className="h-9 w-9 rounded-2xl bg-primary/10 grid place-items-center shrink-0">
          <ShieldCheck className="h-4.5 w-4.5 text-primary" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
            Verificación de empresa
          </p>
          <h3 className="text-[13.5px] font-bold tracking-tight text-foreground mt-0.5">
            Sube los documentos y datos del representante
          </h3>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Plegar"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </header>

      <div className="px-5 sm:px-6 pb-5 flex flex-col gap-4 mt-2">
        {/* ─── Documentos ─── (multi-archivo · PDF + imagen) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DocUploader
            label="CIF de la empresa"
            hint="PDF o foto del modelo 036/037 vigente"
            files={docs.cifEmpresa}
            onPick={() => cifFileRef.current?.click()}
            onRemoveAt={(i) => removeDocFile("cifEmpresa", i)}
            onDropFiles={(fs) => addFiles("cifEmpresa", fs)}
          />
          <input ref={cifFileRef} type="file" multiple accept={ACCEPTED_TYPES} className="hidden" onChange={handleFile("cifEmpresa")} />
          <DocUploader
            label="DNI o NIE del representante"
            hint="PDF o foto · sube ambas caras"
            files={docs.identidadRepresentante}
            onPick={() => idFileRef.current?.click()}
            onRemoveAt={(i) => removeDocFile("identidadRepresentante", i)}
            onDropFiles={(fs) => addFiles("identidadRepresentante", fs)}
          />
          <input ref={idFileRef} type="file" multiple accept={ACCEPTED_TYPES} className="hidden" onChange={handleFile("identidadRepresentante")} />
        </div>

        {/* ─── Representante · picker de workspace member o creación ─── */}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5 block">
            Representante legal de la empresa
          </label>
          <RepresentativePicker
            members={workspaceMembers}
            selected={rep}
            onSelectMember={selectMember}
            onCreateMember={createMemberAsRep}
            onClear={clearRep}
            onChangePhone={(prefix, tel) => update("verificacionRepresentante", { ...rep, phonePrefix: prefix, telefono: tel })}
          />
        </div>

        {/* ─── Firmantes en nombre de la empresa ─── */}
        <div className="rounded-xl bg-background border border-border p-3 flex flex-col gap-3">
          <div>
            <p className="text-[11.5px] font-semibold text-foreground mb-2">
              ¿Es {rep.nombreCompleto || "el representante"} el único firmante en nombre de la empresa?
            </p>
            <div className="inline-flex items-center bg-muted rounded-full p-1 gap-0.5">
              <button
                type="button"
                onClick={() => setFirmaUnica(true)}
                className={cn(
                  "h-7 px-3 rounded-full text-[11.5px] font-semibold transition-colors",
                  firmaUnica ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
                )}
              >
                Sí, solo él / ella
              </button>
              <button
                type="button"
                onClick={() => setFirmaUnica(false)}
                className={cn(
                  "h-7 px-3 rounded-full text-[11.5px] font-semibold transition-colors",
                  !firmaUnica ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground",
                )}
              >
                Hay personas autorizadas
              </button>
            </div>
          </div>

          {!firmaUnica && (
            <div className="flex flex-col gap-2.5 pt-1">
              {autorizados.length === 0 && (
                <p className="text-[11px] text-muted-foreground italic">
                  Añade los apoderados o administradores autorizados a firmar
                  documentos en nombre de la empresa. Más adelante decidirás
                  qué documentos firma cada uno.
                </p>
              )}
              {autorizados.map((a, idx) => (
                <div key={idx} className="rounded-lg border border-border bg-muted/30 p-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="sm:col-span-2 flex items-center justify-between">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Autorizado #{idx + 1}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeAutorizado(idx)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Quitar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={a.nombreCompleto}
                    onChange={(e) => updateAutorizado(idx, { nombreCompleto: e.target.value })}
                    placeholder="Nombre completo"
                    className="sm:col-span-2 h-8 px-3 text-[12.5px] bg-card border border-border rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                  <input
                    type="email"
                    value={a.email}
                    onChange={(e) => updateAutorizado(idx, { email: e.target.value })}
                    placeholder="Email"
                    className="h-8 px-3 text-[12.5px] bg-card border border-border rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                  />
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={a.phonePrefix ?? "+34"}
                      onChange={(e) => updateAutorizado(idx, { phonePrefix: e.target.value })}
                      className="h-8 w-12 px-2 text-[12.5px] text-center tabular-nums bg-card border border-border rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                      maxLength={4}
                    />
                    <input
                      type="tel"
                      value={a.telefono}
                      onChange={(e) => updateAutorizado(idx, { telefono: e.target.value })}
                      placeholder="Teléfono"
                      className="flex-1 h-8 px-3 text-[12.5px] tabular-nums bg-card border border-border rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                    />
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addAutorizado}
                className="self-start text-[11.5px] font-semibold text-primary hover:underline"
              >
                + Añadir persona autorizada
              </button>
            </div>
          )}
        </div>

        <div className="rounded-xl bg-background border border-border px-3 py-2.5 text-[11px] text-muted-foreground leading-relaxed">
          Tras enviar la solicitud te llegará a <b className="text-foreground">{rep.email || "tu email"}</b> un
          documento de declaración responsable mediante <b className="text-foreground">Firmafy</b>. Al firmarlo,
          nuestro equipo valida los datos y tu empresa queda verificada.
        </div>

        <div className="flex items-center gap-3 flex-wrap pt-1">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="inline-flex items-center gap-1.5 h-10 px-5 rounded-full bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Solicitar verificación
          </button>
          {!canSubmit && (
            <span className="text-[11px] text-muted-foreground">Completa los 2 documentos y los 3 datos del representante</span>
          )}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   RepresentativePicker
   ───────────────────────────────────────────────────────────────────
   Buscador de miembros del workspace + creación de nuevo usuario.
   - Buscar: filtra por nombre / email / cargo. Al elegir uno, el
     padre arrastra sus datos (nombre, email, teléfono) al rep.
   - Crear: si no aparece nadie con ese nombre, ofrece crear un nuevo
     miembro · queda como `admin` (propietario legal) y entra al
     workspace.
   - Seleccionado: card con avatar + datos. El teléfono es editable
     desde aquí (puede que el legal difiera del operativo).
   ═══════════════════════════════════════════════════════════════════ */
function RepresentativePicker({
  members, selected, onSelectMember, onCreateMember, onClear, onChangePhone,
}: {
  members: TeamMember[];
  selected: { memberId?: string; nombreCompleto: string; email: string; telefono: string; phonePrefix?: string };
  onSelectMember: (m: TeamMember) => void;
  onCreateMember: (data: { nombreCompleto: string; email: string; telefono: string; phonePrefix: string }) => void;
  onClear: () => void;
  onChangePhone: (prefix: string, tel: string) => void;
}) {
  const [mode, setMode] = useState<"browse" | "creating">("browse");
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState({ nombreCompleto: "", email: "", telefono: "", phonePrefix: "+34" });

  const trimmed = q.trim();
  const filtered = useMemo(() => {
    if (!trimmed) return [] as TeamMember[];
    const qq = trimmed.toLowerCase();
    return members
      .filter((m) => !m.status || m.status === "active")
      .filter((m) =>
        m.name.toLowerCase().includes(qq)
        || m.email.toLowerCase().includes(qq)
        || (m.jobTitle?.toLowerCase().includes(qq) ?? false),
      )
      .slice(0, 8);
  }, [trimmed, members]);

  const isSelected = !!selected.nombreCompleto.trim();

  /* Estado seleccionado · card con datos del rep */
  if (isSelected && mode === "browse") {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/[0.04] p-3 flex items-start gap-3">
        <div className="h-9 w-9 rounded-full bg-primary/15 text-primary grid place-items-center text-[12px] font-semibold shrink-0">
          {memberInitials({ name: selected.nombreCompleto })}
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div>
            <p className="text-[13px] font-semibold text-foreground truncate">{selected.nombreCompleto}</p>
            <p className="text-[11.5px] text-muted-foreground truncate">{selected.email}</p>
          </div>
          {/* Teléfono editable · permite ajustar el contacto legal
              sin tocar el del miembro en /equipo. */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">Teléfono para Firmafy</p>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={selected.phonePrefix ?? "+34"}
                onChange={(e) => onChangePhone(e.target.value, selected.telefono)}
                className="h-8 w-12 px-2 text-[12.5px] text-center tabular-nums bg-card border border-border rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                maxLength={4}
              />
              <input
                type="tel"
                value={selected.telefono}
                onChange={(e) => onChangePhone(selected.phonePrefix ?? "+34", e.target.value)}
                placeholder="600 000 000"
                className="flex-1 h-8 px-2.5 text-[12.5px] tabular-nums bg-card border border-border rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
              />
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { onClear(); setQ(""); setMode("browse"); }}
          className="text-[11px] text-muted-foreground hover:text-destructive transition-colors shrink-0"
        >
          Cambiar
        </button>
      </div>
    );
  }

  /* Estado creating · form para crear nuevo usuario */
  if (mode === "creating") {
    const ok = draft.nombreCompleto.trim() && draft.email.trim() && draft.telefono.trim();
    return (
      <div className="rounded-xl border border-border bg-background p-3 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <p className="text-[11.5px] font-semibold text-foreground">Crear nuevo usuario</p>
          <button
            type="button"
            onClick={() => { setMode("browse"); setDraft({ nombreCompleto: "", email: "", telefono: "", phonePrefix: "+34" }); }}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Cancelar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <input
          type="text"
          value={draft.nombreCompleto}
          onChange={(e) => setDraft({ ...draft, nombreCompleto: e.target.value })}
          placeholder="Nombre completo"
          className="h-8 px-3 text-[12.5px] bg-card border border-border rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
        />
        <input
          type="email"
          value={draft.email}
          onChange={(e) => setDraft({ ...draft, email: e.target.value })}
          placeholder="Email"
          className="h-8 px-3 text-[12.5px] bg-card border border-border rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
        />
        <div className="flex gap-1.5">
          <input
            type="text"
            value={draft.phonePrefix}
            onChange={(e) => setDraft({ ...draft, phonePrefix: e.target.value })}
            className="h-8 w-12 px-2 text-[12.5px] text-center tabular-nums bg-card border border-border rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
            maxLength={4}
          />
          <input
            type="tel"
            value={draft.telefono}
            onChange={(e) => setDraft({ ...draft, telefono: e.target.value })}
            placeholder="Teléfono"
            className="flex-1 h-8 px-3 text-[12.5px] tabular-nums bg-card border border-border rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
          />
        </div>
        <p className="text-[10.5px] text-muted-foreground leading-relaxed">
          Se añadirá al equipo como administrador. Recibirá una invitación por
          email para activar su cuenta. Al firmar la declaración responsable,
          quedará registrado como propietario legal de la empresa.
        </p>
        <button
          type="button"
          disabled={!ok}
          onClick={() => {
            onCreateMember(draft);
            setMode("browse");
            setQ("");
            setDraft({ nombreCompleto: "", email: "", telefono: "", phonePrefix: "+34" });
          }}
          className="h-9 px-4 rounded-full bg-primary text-primary-foreground text-[12.5px] font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed self-start"
        >
          Crear y usar como representante
        </button>
      </div>
    );
  }

  /* Estado browse · search + lista + CTA crear */
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar miembro del equipo por nombre o email…"
          className="w-full h-9 pl-8 pr-3 text-[12.5px] bg-card border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-colors"
        />
      </div>
      {trimmed && (
        <div className="rounded-xl border border-border bg-card p-1 flex flex-col gap-0.5">
          {filtered.length === 0 ? (
            <p className="text-[11.5px] text-muted-foreground italic px-2 py-2">
              Sin coincidencias en el equipo
            </p>
          ) : (
            filtered.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => { onSelectMember(m); setQ(""); }}
                className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/40 transition-colors text-left"
              >
                <div className="h-7 w-7 rounded-full bg-muted text-foreground grid place-items-center text-[11px] font-semibold shrink-0">
                  {memberInitials(m)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-foreground truncate">{m.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {m.email}{m.jobTitle ? ` · ${m.jobTitle}` : ""}
                  </p>
                </div>
              </button>
            ))
          )}
          <button
            type="button"
            onClick={() => { setDraft({ nombreCompleto: trimmed, email: "", telefono: "", phonePrefix: "+34" }); setMode("creating"); }}
            className="w-full flex items-center gap-2.5 p-2 rounded-lg border-t border-border hover:bg-primary/5 transition-colors text-left mt-0.5"
          >
            <div className="h-7 w-7 rounded-full bg-primary/10 text-primary grid place-items-center shrink-0">
              <Plus className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-semibold text-primary truncate">Crear nuevo: "{trimmed}"</p>
              <p className="text-[11px] text-muted-foreground">Se añadirá al equipo como administrador</p>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

/* DocUploader · multi-archivo (PDF + imagen) con drag & drop +
 * lista de ficheros subidos + botón "+ Añadir más". */
function DocUploader({
  label, hint, files, onPick, onRemoveAt, onDropFiles,
}: {
  label: string;
  hint: string;
  files: Array<{ name: string; uploadedAt: string; mime?: string }> | undefined;
  onPick: () => void;
  onRemoveAt: (idx: number) => void;
  onDropFiles: (files: File[]) => void;
}) {
  const [over, setOver] = useState(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (e.dataTransfer.files?.length) onDropFiles(Array.from(e.dataTransfer.files));
  };
  const list = files ?? [];

  return (
    <div className="flex flex-col gap-2">
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={handleDrop}
        className={cn(
          "rounded-xl border-2 border-dashed bg-background transition-colors",
          over ? "border-primary bg-primary/[0.04]" : "border-border hover:border-primary/40",
        )}
      >
        <button
          type="button"
          onClick={onPick}
          className="w-full p-3 flex items-start gap-2.5 text-left"
        >
          <div className="h-8 w-8 rounded-lg bg-muted grid place-items-center shrink-0">
            <Upload className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11.5px] font-semibold text-foreground">{label}</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {hint} · arrastra aquí o haz click
            </p>
          </div>
        </button>
      </div>

      {/* Lista de ficheros subidos */}
      {list.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {list.map((f, i) => {
            const isPdf = f.mime?.includes("pdf") || f.name.toLowerCase().endsWith(".pdf");
            return (
              <div key={i} className="rounded-lg border border-success/30 bg-success/[0.06] p-2 flex items-center gap-2">
                <div className="h-6 w-6 rounded grid place-items-center bg-card shrink-0">
                  {isPdf ? (
                    <FileText className="h-3.5 w-3.5 text-foreground" />
                  ) : (
                    <ImageIcon className="h-3.5 w-3.5 text-foreground" />
                  )}
                </div>
                <p className="text-[11.5px] text-foreground truncate flex-1">{f.name}</p>
                <button
                  type="button"
                  onClick={() => onRemoveAt(i)}
                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  aria-label="Quitar"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
