/**
 * EmpresaAboutTab · réplica del CompanyAboutTab con mis componentes.
 * Secciones: Historia (overview largo), Detalles (legal name, trade
 * name, CIF, founded, phone, email, schedule), Webs, Verificación.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Globe, Phone, Mail, Clock, Linkedin, Instagram, Facebook,
  Youtube, Music2, ShieldCheck, Upload, Trash2, ChevronDown, CheckCircle2,
  Search, Plus, FileText, Image as ImageIcon, X,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspaceMembers } from "@/lib/useWorkspaceMembers";
import { memberInitials, type TeamMember } from "@/lib/team";
import type { Empresa } from "@/lib/empresa";
import {
  type LicenciaInmobiliaria, type LicenciaTipo, LICENCIA_META,
} from "@/lib/licenses";
import {
  MARKETING_PRODUCT_TYPES, productTypeLabel,
  FUENTES_CLIENTES, type FuenteCliente, fuenteClienteLabel,
  PCT_OTROS, sumPct,
} from "@/lib/marketingCatalog";
import { PHONE_COUNTRIES } from "@/lib/phoneCountries";
import {
  MARKETING_CHANNELS, CATEGORY_LABEL, channelFaviconUrl,
  groupMarketingChannels, type MarketingChannelCategory,
} from "@/lib/marketingChannels";
import { Flag } from "@/components/ui/Flag";
import { EditableSection } from "./EditableSection";
import { GoogleRatingCard } from "./GoogleRatingCard";
import { OfficesSection } from "./OfficesSection";
import { cn } from "@/lib/utils";

const inputClass = "h-9 w-full px-3 text-[13px] bg-card border border-border rounded-xl focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:text-muted-foreground/60";

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
  /** El CIF se trata como dato fiscal sensible · solo el admin del
   *  workspace lo ve. Member lo NO ve aunque sea de su propia empresa. */
  const showCif = isAdmin && !isVisitor;

  return (
    <div className="flex flex-col gap-5">
      {/* ═════ Verificación de empresa ═════
          Primera sección del About · una vez verificada desaparece
          para siempre (el sello queda en el hero junto al nombre).
          Sin verificar, vale 30% de la "Fuerza del perfil". */}
      {/* `viewMode === "preview"` (toggle "Previsualizar como
          usuario") cuenta como visitor · ver REGLA DE ORO "Preview =
          Visitor" en CLAUDE.md. */}
      {!isVisitor && viewMode !== "preview" && !empresa.verificada && (
        <VerificationSection empresa={empresa} update={update} />
      )}

      {/* ═════ Licencias inmobiliarias por región (primero) ═════
          Catálogo canónico en `src/lib/licenses.ts`. La primera
          licencia con número se renderiza también debajo del nombre
          en el hero (sustituye al antiguo eslogan/tagline). */}
      <LicenciasSection empresa={empresa} update={update} viewMode={viewMode} isVisitor={isVisitor} />

      {/* La sección "Historia" se eliminó del producto · `aboutOverview`
          permanece en el modelo Empresa por retro-compat pero ya no
          se renderiza · simplifica la ficha pública. */}

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
              <label className="text-[10px] text-muted-foreground">
                Dirección fiscal
                <span className="ml-1 text-muted-foreground/60 normal-case">· una línea · autocompletado vía Google Maps próximamente</span>
              </label>
              {/* TODO(ui): conectar Google Places Autocomplete aquí ·
                  el `formatted_address` rellena este campo y los
                  componentes estructurados (calle, CP, ciudad,
                  país) van a `direccionFiscal` para uso interno. Sin
                  mapa · solo input. */}
              <input
                value={empresa.direccionFiscalCompleta ?? ""}
                onChange={(e) => update("direccionFiscalCompleta", e.target.value)}
                className={inputClass}
                placeholder="Av. del Mar 15, 29602 Marbella, Málaga, España"
              />
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
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Dirección fiscal</p>
            <p className="text-[12px] text-muted-foreground">
              {empresa.direccionFiscalCompleta?.trim() || "—"}
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

      {/* ═════ Redes sociales y web · SOLO owner ═════
          Usa el patrón canónico `<EditableSection>` (botón Editar →
          form en edit mode, readout compacto en preview/idle).
          NO se muestra a visitors (los iconos ya viven en el hero
          via `<HeroSocialIcons>`). */}
      {!isVisitor && viewMode !== "preview" && (
        <EditableSection
          title="Redes sociales y web"
          viewMode={viewMode}
          editContent={
            <div className="flex flex-col gap-3">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Los enlaces aparecen como iconos discretos en el header de tu
                ficha pública. No se muestran como listado a los colaboradores.
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
          {/* Readout compacto · solo iconos con el handle/URL al lado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {empresa.sitioWeb && (
              <SocialReadout icon={Globe} value={empresa.sitioWeb} href={empresa.sitioWeb.startsWith("http") ? empresa.sitioWeb : `https://${empresa.sitioWeb}`} />
            )}
            {empresa.linkedin && <SocialReadout icon={Linkedin} value={empresa.linkedin} href={empresa.linkedin.startsWith("http") ? empresa.linkedin : `https://${empresa.linkedin}`} />}
            {empresa.instagram && <SocialReadout icon={Instagram} value={empresa.instagram} />}
            {empresa.facebook && <SocialReadout icon={Facebook} value={empresa.facebook} />}
            {empresa.youtube && <SocialReadout icon={Youtube} value={empresa.youtube} />}
            {empresa.tiktok && <SocialReadout icon={Music2} value={empresa.tiktok} />}
            {!empresa.sitioWeb && !empresa.linkedin && !empresa.instagram && !empresa.facebook && !empresa.youtube && !empresa.tiktok && (
              <p className="text-[12px] text-muted-foreground italic col-span-2">
                Aún no has añadido enlaces. Pulsa <b>Editar</b> para añadirlos.
              </p>
            )}
          </div>
        </EditableSection>
      )}

      {/* ═════ Marketing y mercado ═════
          Top nacionalidades (% sum=100), Tipo de producto, Fuentes de
          clientes (% sum=100). En modo display los bloques se
          renderizan compactos · sólo el block que el usuario edita
          se expande temporalmente. */}
      <MarketingSection empresa={empresa} update={update} viewMode={viewMode} isVisitor={isVisitor} />

      {/* ═════ Oficinas · al final ═════
          La lista de oficinas cierra el tab Sobre nosotros · es la
          última pieza institucional (junto al resto de Detalles).
          Sigue usando `byvaro-oficinas` como única fuente de verdad
          (ver REGLA DE ORO en CLAUDE.md). */}
      <OfficesSection viewMode={viewMode} />

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
/* SocialReadout · una línea con icono + handle/URL · clickable. */
function SocialReadout({
  icon: Icon, value, href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  href?: string;
}) {
  const content = (
    <span className="inline-flex items-center gap-2 min-w-0">
      <Icon className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
      <span className="text-[12.5px] truncate">{value}</span>
    </span>
  );
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate">
        {content}
      </a>
    );
  }
  return <span className="text-foreground">{content}</span>;
}

/* ═══════════════════════════════════════════════════════════════════
   LicenciasSection · catálogo de licencias inmobiliarias.
   ───────────────────────────────────────────────────────────────────
   Cada licencia tiene:
     - tipo (dropdown · catálogo `LicenciaTipo` de licenses.ts).
     - número (input libre · formato lo emite la autoridad).
     - desde (opcional · fecha alta).
   Render: lista de chips compactas en modo público. En edit, una
   fila por licencia con los inputs. Botón "+ Añadir licencia".

   La primera licencia aparece en el subtitle del hero ("AICAT 12345 ·
   Marbella · Fundada en 2012") · ver Empresa.tsx::subtitleDisplay.
   ═══════════════════════════════════════════════════════════════════ */
function LicenciasSection({
  empresa, update, viewMode, isVisitor,
}: {
  empresa: Empresa;
  update: <K extends keyof Empresa>(key: K, value: Empresa[K]) => void;
  viewMode: "edit" | "preview";
  isVisitor?: boolean;
}) {
  const licencias = empresa.licencias ?? [];

  /* Draft local · permite editar sin que cada keystroke commitee al
   * storage. Se sincroniza al storage cuando el usuario pulsa
   * Guardar; al pulsar Cancelar se descartan los cambios. */
  const [draft, setDraft] = useState<LicenciaInmobiliaria[]>(() => licencias.map(l => ({ ...l })));
  /* Re-sincroniza el draft cuando cambia la fuente (otro tab guardó,
   * o se acaba de salvar). useEffect (no useMemo) para no llamar a
   * setState durante el render · usamos JSON.stringify como hash. */
  const licenciasJson = JSON.stringify(licencias);
  useEffect(() => {
    setDraft(licencias.map(l => ({ ...l })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [licenciasJson]);
  const commit = () => { update("licencias", draft); toast.success("Licencias guardadas"); };
  const cancel = () => { setDraft(licencias.map((l) => ({ ...l }))); };

  const tiposOpciones: LicenciaTipo[] = [
    "AICAT", "RAICV", "EKAIA", "RAIA", "COAPI", "API", "GIPE", "RICS", "FIABCI", "FMI", "custom",
  ];

  /* ─── Vista pública (no admin / no edit) ─── */
  if (isVisitor || viewMode !== "edit") {
    /* Si no hay licencias declaradas, NO mostramos la sección al
     * visitor · evita ruido de un card "Sin licencias declaradas"
     * que no aporta nada. El owner sí ve la sección vacía con el
     * CTA "Editar" (en modo edit · más abajo). */
    if (licencias.length === 0) return null;
    return (
      <EditableSection title="Licencias inmobiliarias" viewMode={viewMode}>
        <div className="flex flex-col gap-2">
          {licencias.map((l, i) => (
            <LicenciaRow
              key={i}
              licencia={l}
              isEditable={false}
              tiposOpciones={tiposOpciones}
              onChange={() => {}}
              onRemove={() => {}}
            />
          ))}
        </div>
      </EditableSection>
    );
  }

  /* ─── Modo edición · usa EditableSection con editContent + draft ─── */
  const editContent = (
    <div className="flex flex-col gap-2">
      {draft.length === 0 && (
        <p className="text-[11.5px] text-muted-foreground italic">
          Aún no has añadido ninguna licencia. Pulsa el botón de abajo.
        </p>
      )}
      {draft.map((l, i) => (
        <LicenciaRow
          key={i}
          licencia={l}
          isEditable
          tiposOpciones={tiposOpciones}
          onChange={(patch) => setDraft(draft.map((x, j) => (j === i ? { ...x, ...patch } : x)))}
          onRemove={() => setDraft(draft.filter((_, j) => j !== i))}
        />
      ))}
      <button
        type="button"
        onClick={() => setDraft([...draft, { tipo: "AICAT", numero: "" } as LicenciaInmobiliaria])}
        className="self-start inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-dashed border-border text-[11.5px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors mt-1"
      >
        <Plus className="h-3 w-3" /> Añadir licencia
      </button>
      <p className="text-[10.5px] text-muted-foreground/80 leading-relaxed mt-1">
        Las licencias se guardan al pulsar <b>Guardar</b> · puedes
        cancelar para descartar los cambios.
      </p>
    </div>
  );

  return (
    <EditableSection
      title="Licencias inmobiliarias"
      viewMode={viewMode}
      editContent={editContent}
      onSave={commit}
      onCancel={cancel}
    >
      {licencias.length === 0 ? (
        <p className="text-[12.5px] text-muted-foreground italic">
          Sin licencias declaradas. Pulsa <b>Editar</b> para añadir tu primera.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {licencias.map((l, i) => (
            <LicenciaRow
              key={i}
              licencia={l}
              isEditable={false}
              tiposOpciones={tiposOpciones}
              onChange={() => {}}
              onRemove={() => {}}
            />
          ))}
        </div>
      )}
    </EditableSection>
  );
}

function LicenciaRow({
  licencia, isEditable, tiposOpciones, onChange, onRemove,
}: {
  licencia: LicenciaInmobiliaria;
  isEditable: boolean;
  tiposOpciones: LicenciaTipo[];
  onChange: (patch: Partial<LicenciaInmobiliaria>) => void;
  onRemove: () => void;
}) {
  const meta = licencia.tipo === "custom" ? null : LICENCIA_META[licencia.tipo];
  /* Logo del registro · usamos un avatar dicebear determinista por
   * label · simple y libre de derechos. En producción se sustituye
   * por el logo oficial del organismo (`autoridadUrl/logo.svg`). */
  const label = meta?.label ?? licencia.etiqueta ?? "Licencia";
  const logoUrl = `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(label)}&backgroundColor=1D74E7&textColor=ffffff&fontWeight=700`;

  if (!isEditable) {
    return (
      <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-2.5">
        <img src={logoUrl} alt="" className="h-8 w-8 rounded-md bg-white shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold text-foreground">{label}</p>
          <p className="text-[11px] text-muted-foreground truncate">
            {licencia.numero || "—"}
            {meta && <> · {meta.ambito}</>}
            {meta?.obligatorio && <> · obligatoria</>}
          </p>
        </div>
        {licencia.verificada && (
          <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-background p-3 flex items-start gap-2.5">
      <img src={logoUrl} alt="" className="h-9 w-9 rounded-md bg-white shrink-0" />
      <div className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
        {/* Tipo · select nativo (popover sería overkill aquí) */}
        <div className="sm:col-span-1">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5 block">Registro</label>
          <select
            value={licencia.tipo}
            onChange={(e) => onChange({ tipo: e.target.value as LicenciaTipo })}
            className="h-8 w-full px-2 text-[12px] bg-card border border-border rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
          >
            {tiposOpciones.map((t) => {
              const m = t === "custom" ? null : LICENCIA_META[t];
              return (
                <option key={t} value={t}>
                  {m ? `${m.label} · ${m.ambito}` : "Otra (personalizada)"}
                </option>
              );
            })}
          </select>
        </div>
        {licencia.tipo === "custom" && (
          <div className="sm:col-span-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5 block">Etiqueta</label>
            <input
              type="text"
              value={licencia.etiqueta ?? ""}
              onChange={(e) => onChange({ etiqueta: e.target.value })}
              placeholder="Nombre del registro"
              className="h-8 w-full px-2 text-[12px] bg-card border border-border rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            />
          </div>
        )}
        <div className={cn(licencia.tipo === "custom" ? "sm:col-span-1" : "sm:col-span-2")}>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5 block">Número</label>
          <input
            type="text"
            value={licencia.numero}
            onChange={(e) => onChange({ numero: e.target.value })}
            placeholder={licencia.tipo === "AICAT" ? "Ej. AICAT-123456" : "Número de registro"}
            className="h-8 w-full px-2 text-[12px] tabular-nums bg-card border border-border rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
          />
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive transition-colors shrink-0 mt-5"
        aria-label="Quitar licencia"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MarketingSection · 3 bloques editables.
   ───────────────────────────────────────────────────────────────────
   1. Top nacionalidades · % por país · suma 100. Última fila "Otros"
      auto-completa el restante.
   2. Tipo de producto · chips de slugs + precio "desde" por tipo.
   3. Fuentes de clientes · % por canal · suma 100.

   Cada bloque tiene su propio toggle Editar/Guardar. El draft es
   local hasta pulsar "Guardar", igual que LicenciasSection.

   TODO(backend): GET/PATCH /api/empresa/marketing → shape
   `{ topNacionalidades, tiposProducto, fuentesClientes }`. Se valida
   suma=100 server-side antes de aceptar.
   ═══════════════════════════════════════════════════════════════════ */
function MarketingSection({
  empresa, update, viewMode, isVisitor,
}: {
  empresa: Empresa;
  update: <K extends keyof Empresa>(key: K, value: Empresa[K]) => void;
  viewMode: "edit" | "preview";
  isVisitor?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card shadow-soft">
      <header className="px-5 sm:px-6 pt-4 pb-3">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h2 className="text-[13.5px] font-semibold text-foreground">Marketing y mercado</h2>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            Opcional · recomendado
          </span>
        </div>
        <p className="text-[12px] text-muted-foreground leading-relaxed mt-1.5 max-w-[680px]">
          Esta sección es <b className="text-foreground">la presentación comercial de tu
          empresa</b> ante quienes la miran desde fuera. Cuanto más completa esté,
          más fácil les será a otras agencias y promotores decidir si encajáis.
          Saber con qué <b className="text-foreground">nacionalidades</b> trabajas, qué{" "}
          <b className="text-foreground">tipo de inmuebles</b> comercializas, en qué{" "}
          <b className="text-foreground">portales</b> publicas y de dónde te llegan los{" "}
          <b className="text-foreground">leads</b> es lo que diferencia una ficha
          confiable de una vacía. Es <b className="text-foreground">opcional</b> ·
          puedes rellenar lo que quieras y dejar el resto en blanco.
        </p>
      </header>
      <div className="px-5 sm:px-6 pb-5 pt-2 flex flex-col gap-4">
        <NacionalidadesBlock empresa={empresa} update={update} viewMode={viewMode} isVisitor={isVisitor} />
        <ProductoBlock      empresa={empresa} update={update} viewMode={viewMode} isVisitor={isVisitor} />
        <PortalesBlock      empresa={empresa} update={update} viewMode={viewMode} isVisitor={isVisitor} />
        <FuentesBlock       empresa={empresa} update={update} viewMode={viewMode} isVisitor={isVisitor} />
      </div>
    </section>
  );
}

/* ─── Block 1 · Top nacionalidades ────────────────────────────── */
function NacionalidadesBlock({
  empresa, update, viewMode, isVisitor,
}: {
  empresa: Empresa;
  update: <K extends keyof Empresa>(key: K, value: Empresa[K]) => void;
  viewMode: "edit" | "preview";
  isVisitor?: boolean;
}) {
  const stored = empresa.marketingTopNacionalidades ?? [];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(stored.filter(x => x.countryIso !== PCT_OTROS).map(x => ({ ...x })));
  const isEditable = !isVisitor && viewMode === "edit";
  /* `total` incluye el "Otros" auto-calculado · siempre suma 100
   * cuando la suma de los reales no excede 100. saveDisabled solo
   * se activa cuando la suma manual supera 100. */
  const sumReales = sumPct(draft.filter(r => r.countryIso !== PCT_OTROS));
  const otrosPct = Math.max(0, 100 - sumReales);
  const total = sumReales <= 100 ? 100 : sumReales;

  const start = () => { setDraft(stored.filter(x => x.countryIso !== PCT_OTROS).map(x => ({ ...x }))); setEditing(true); };
  const save = () => {
    if (sumReales > 100) { toast.error("La suma supera 100% · ajusta los porcentajes"); return; }
    const cleaned = draft.filter(x => x.countryIso && x.countryIso !== PCT_OTROS && Number.isFinite(x.pct) && x.pct > 0);
    /* Inyectamos "Otros" sólo si queda residual · si todo suma 100
     * exacto entre los reales, no se persiste el sentinel. */
    const persisted = otrosPct > 0
      ? [...cleaned, { countryIso: PCT_OTROS, pct: otrosPct }]
      : cleaned;
    update("marketingTopNacionalidades", persisted);
    toast.success("Nacionalidades guardadas");
    setEditing(false);
  };
  const cancel = () => { setEditing(false); };

  return (
    <BlockShell
      title="Top nacionalidades de tus clientes"
      hint="% de clientes por país · la suma debe ser 100"
      editing={editing}
      isEditable={isEditable}
      onEdit={start}
      onSave={save}
      onCancel={cancel}
      saveDisabled={sumReales > 100}
      sumIndicator={editing ? <SumBadge total={total} /> : null}
    >
      {!editing ? (
        stored.length === 0 ? (
          <EmptyHint isEditable={isEditable} text="Aún no has declarado tus principales nacionalidades de clientes." />
        ) : (
          <NacionalidadesReadout items={stored} />
        )
      ) : (
        <div className="flex flex-col gap-2">
          {draft.map((row, i) => (
            <NacionalidadRow
              key={i}
              row={row}
              usedIsos={draft.map(x => x.countryIso).filter((_, j) => j !== i)}
              maxPct={Math.max(0, 100 - sumPct(draft.filter((_, j) => j !== i)))}
              onChange={(patch) => setDraft(draft.map((x, j) => j === i ? { ...x, ...patch } : x))}
              onRemove={() => setDraft(draft.filter((_, j) => j !== i))}
            />
          ))}
          {/* Fila "Otros" siempre al final · % auto-calculado. */}
          <OtrosRow pct={otrosPct} />
          {draft.length < 8 && (
            <button
              type="button"
              onClick={() => setDraft([...draft, { countryIso: "", pct: 0 }])}
              className="self-start inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-dashed border-border text-[11.5px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
            >
              <Plus className="h-3 w-3" /> Añadir nacionalidad
            </button>
          )}
          <p className="text-[10.5px] text-muted-foreground/80">
            "Otros" se completa automáticamente · ajusta los porcentajes
            de los países hasta que sumen 100 o menos.
          </p>
        </div>
      )}
    </BlockShell>
  );
}

/* Fila "Otros" · % auto-calculado (read-only) · no se quita. */
function OtrosRow({ pct }: { pct: number }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-2 flex items-center gap-2">
      <span className="flex items-center gap-2 h-8 px-2.5 flex-1 text-[12.5px] text-muted-foreground">
        <span className="h-3.5 w-3.5 rounded-full bg-muted-foreground/30 shrink-0" />
        Otros
        <span className="ml-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">auto</span>
      </span>
      <div className="flex items-center gap-1 shrink-0">
        <span className="h-8 w-16 px-2 text-[12.5px] text-right tabular-nums bg-muted/40 border border-border rounded-lg flex items-center justify-end text-foreground font-semibold">
          {pct}
        </span>
        <span className="text-[12px] text-muted-foreground">%</span>
      </div>
      <span className="w-3.5 shrink-0" />
    </div>
  );
}

function NacionalidadRow({
  row, usedIsos, maxPct, onChange, onRemove,
}: {
  row: { countryIso: string; pct: number };
  usedIsos: string[];
  /** Tope dinámico para el input · evita que el usuario teclee un %
   *  que haga que la suma supere 100. Si tienes 80+7 y vienes a esta
   *  fila vacía, maxPct será 13 · escribe 20 y se clampea a 13. */
  maxPct: number;
  onChange: (patch: Partial<{ countryIso: string; pct: number }>) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const selected = PHONE_COUNTRIES.find(c => c.iso === row.countryIso);
  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return PHONE_COUNTRIES
      .filter(c => !usedIsos.includes(c.iso))
      .filter(c => !qq || c.name.toLowerCase().includes(qq) || c.nameEn.toLowerCase().includes(qq) || c.iso.toLowerCase() === qq);
  }, [q, usedIsos]);

  return (
    <div className="rounded-lg border border-border bg-background p-2 flex items-center gap-2 relative">
      {/* Country selector */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 h-8 px-2.5 rounded-lg bg-card border border-border hover:border-primary/40 text-[12.5px] min-w-[160px] flex-1"
      >
        {selected ? <Flag iso={selected.iso} size={14} /> : <span className="h-3.5 w-3.5 rounded-full bg-muted shrink-0" />}
        <span className="flex-1 text-left truncate text-foreground">
          {selected?.name ?? "Seleccionar país"}
        </span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>
      {/* % input · auto-clamp al `maxPct` para no superar 100 */}
      <div className="flex items-center gap-1 shrink-0">
        <input
          type="number"
          min={0}
          max={maxPct}
          value={Number.isFinite(row.pct) ? row.pct : 0}
          onChange={(e) => {
            const raw = Math.max(0, Math.round(Number(e.target.value) || 0));
            onChange({ pct: Math.min(raw, maxPct) });
          }}
          className="h-8 w-16 px-2 text-[12.5px] text-right tabular-nums bg-card border border-border rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
        />
        <span className="text-[12px] text-muted-foreground">%</span>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
        aria-label="Quitar"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      {/* Country picker dropdown · z-30 para flotar sobre otros bloques
          de la sección · sin overflow-hidden en los wrappers padres
          para que se vea fuera del card. */}
      {open && (
        <div className="absolute top-full left-2 right-2 z-30 mt-1 rounded-xl border border-border bg-card shadow-lg p-2">
          <div className="relative mb-1.5">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/60" />
            <input
              type="text"
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar país…"
              className="w-full h-7 pl-7 pr-2 text-[11.5px] bg-background border border-border rounded-lg outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-col gap-0.5 max-h-[180px] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-[10.5px] text-muted-foreground italic px-2 py-1">Sin coincidencias</p>
            ) : (
              filtered.map(c => (
                <button
                  key={c.iso}
                  type="button"
                  onClick={() => { onChange({ countryIso: c.iso }); setOpen(false); setQ(""); }}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/40 text-left"
                >
                  <Flag iso={c.iso} size={14} />
                  <span className="text-[11.5px] text-foreground flex-1">{c.name}</span>
                  <span className="text-[10px] text-muted-foreground">{c.iso}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NacionalidadesReadout({ items }: { items: Array<{ countryIso: string; pct: number }> }) {
  /* Inline chips compactas tipo: 🇪🇸 ES 30% · 🇬🇧 GB 25% · 🇩🇪 DE 20% · Otros 25% */
  const reales = items.filter(x => x.countryIso !== PCT_OTROS);
  const stored = items.find(x => x.countryIso === PCT_OTROS)?.pct ?? Math.max(0, 100 - sumPct(reales));
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      {reales.map((x, i) => {
        const c = PHONE_COUNTRIES.find(p => p.iso === x.countryIso);
        return (
          <span key={i} className="inline-flex items-center gap-1 text-[11.5px]">
            <Flag iso={x.countryIso || "ES"} size={12} />
            <span className="text-foreground">{c?.name ?? x.countryIso}</span>
            <span className="text-muted-foreground tabular-nums">{x.pct}%</span>
          </span>
        );
      })}
      {stored > 0 && (
        <span className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
          Otros <span className="tabular-nums">{stored}%</span>
        </span>
      )}
    </div>
  );
}

/* ─── Block 2 · Tipo de producto ──────────────────────────────── */
function ProductoBlock({
  empresa, update, viewMode, isVisitor,
}: {
  empresa: Empresa;
  update: <K extends keyof Empresa>(key: K, value: Empresa[K]) => void;
  viewMode: "edit" | "preview";
  isVisitor?: boolean;
}) {
  const stored = empresa.marketingTiposProducto ?? [];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(stored.map(x => ({ ...x })));
  const isEditable = !isVisitor && viewMode === "edit";

  const start = () => { setDraft(stored.map(x => ({ ...x }))); setEditing(true); };
  const save = () => {
    update("marketingTiposProducto", draft.filter(x => x.tipo.trim()));
    toast.success("Tipos de producto guardados");
    setEditing(false);
  };
  const cancel = () => setEditing(false);

  const toggleType = (slug: string) => {
    if (draft.some(x => x.tipo === slug)) {
      setDraft(draft.filter(x => x.tipo !== slug));
    } else {
      setDraft([...draft, { tipo: slug }]);
    }
  };

  return (
    <BlockShell
      title="Tipo de producto que comercializas"
      hint="Selecciona los tipos de inmueble principales y opcionalmente el precio mínimo"
      editing={editing}
      isEditable={isEditable}
      onEdit={start}
      onSave={save}
      onCancel={cancel}
    >
      {!editing ? (
        stored.length === 0 ? (
          <EmptyHint isEditable={isEditable} text="Aún no has declarado los tipos de producto que comercializas." />
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {stored.map((p, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full border border-border bg-muted/40 text-[11.5px] text-foreground"
              >
                {productTypeLabel(p.tipo)}
                {typeof p.precioDesde === "number" && p.precioDesde > 0 && (
                  <span className="text-muted-foreground tabular-nums">desde {p.precioDesde.toLocaleString("es-ES")} €</span>
                )}
              </span>
            ))}
          </div>
        )
      ) : (
        <div className="flex flex-col gap-3">
          {/* Catálogo de chips · click para activar/desactivar */}
          <div className="flex flex-wrap gap-1.5">
            {MARKETING_PRODUCT_TYPES.map((t) => {
              const active = draft.some(x => x.tipo === t.slug);
              return (
                <button
                  key={t.slug}
                  type="button"
                  onClick={() => toggleType(t.slug)}
                  className={cn(
                    "inline-flex items-center px-2.5 h-7 rounded-full border text-[11.5px] transition-colors",
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/40 text-muted-foreground hover:text-foreground border-border",
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          {/* Precios desde por tipo activado */}
          {draft.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Precio desde (opcional)</p>
              {draft.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[12px] text-foreground flex-1 truncate">{productTypeLabel(p.tipo)}</span>
                  <input
                    type="number"
                    min={0}
                    value={p.precioDesde ?? ""}
                    onChange={(e) => {
                      const v = e.target.value === "" ? undefined : Math.max(0, Math.round(Number(e.target.value) || 0));
                      setDraft(draft.map((x, j) => j === i ? { ...x, precioDesde: v } : x));
                    }}
                    placeholder="—"
                    className="h-8 w-32 px-2 text-[12px] text-right tabular-nums bg-card border border-border rounded-lg outline-none focus:border-primary"
                  />
                  <span className="text-[12px] text-muted-foreground">€</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </BlockShell>
  );
}

/* ─── Block · Portales donde publica ──────────────────────────
   Reutiliza el catálogo canónico `MARKETING_CHANNELS` (mismo que
   las promociones usan para `marketingProhibitions`). Cada portal
   tiene logo (Google Favicon) + label + categoría. Multi-select
   con chips toggle agrupados por categoría. */
function PortalesBlock({
  empresa, update, viewMode, isVisitor,
}: {
  empresa: Empresa;
  update: <K extends keyof Empresa>(key: K, value: Empresa[K]) => void;
  viewMode: "edit" | "preview";
  isVisitor?: boolean;
}) {
  const stored = empresa.marketingPortales ?? [];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(stored);
  const isEditable = !isVisitor && viewMode === "edit";
  const grouped = useMemo(() => groupMarketingChannels(), []);

  const start = () => { setDraft([...stored]); setEditing(true); };
  const save = () => {
    update("marketingPortales", draft);
    toast.success("Portales guardados");
    setEditing(false);
  };
  const cancel = () => setEditing(false);

  const toggle = (id: string) => {
    setDraft(draft.includes(id) ? draft.filter(x => x !== id) : [...draft, id]);
  };

  return (
    <BlockShell
      title="Portales en los que publicas"
      hint="Selecciona los portales y canales donde la empresa publica sus inmuebles"
      editing={editing}
      isEditable={isEditable}
      onEdit={start}
      onSave={save}
      onCancel={cancel}
    >
      {!editing ? (
        stored.length === 0 ? (
          <EmptyHint isEditable={isEditable} text="Aún no has declarado los portales donde publicas." />
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            {stored.map((id) => {
              const ch = MARKETING_CHANNELS.find(c => c.id === id);
              if (!ch) return null;
              const favicon = channelFaviconUrl(ch, 32);
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 px-2 h-6 rounded-full bg-muted/50 border border-border text-[11px] text-foreground"
                  title={ch.hint ?? ch.domain ?? ch.label}
                >
                  {favicon ? (
                    <img src={favicon} alt="" className="h-3.5 w-3.5 rounded-sm" />
                  ) : (
                    <ch.icon className="h-3 w-3 text-muted-foreground" />
                  )}
                  {ch.label}
                </span>
              );
            })}
          </div>
        )
      ) : (
        <div className="flex flex-col gap-3">
          {(Object.keys(grouped) as MarketingChannelCategory[]).map((cat) => (
            <div key={cat}>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">
                {CATEGORY_LABEL[cat]}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {grouped[cat].map((ch) => {
                  const active = draft.includes(ch.id);
                  const favicon = channelFaviconUrl(ch, 32);
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => toggle(ch.id)}
                      title={ch.hint ?? ch.domain ?? ch.label}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 h-7 rounded-full border text-[11.5px] transition-colors",
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/40 text-muted-foreground hover:text-foreground border-border",
                      )}
                    >
                      {favicon ? (
                        <img
                          src={favicon}
                          alt=""
                          className={cn(
                            "h-3.5 w-3.5 rounded-sm",
                            active ? "" : "opacity-80",
                          )}
                        />
                      ) : (
                        <ch.icon className="h-3 w-3" />
                      )}
                      {ch.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <p className="text-[10.5px] text-muted-foreground/80">
            {draft.length} canal{draft.length === 1 ? "" : "es"} seleccionado{draft.length === 1 ? "" : "s"}.
          </p>
        </div>
      )}
    </BlockShell>
  );
}

/* ─── Block 3 · Fuentes de clientes ───────────────────────────── */
function FuentesBlock({
  empresa, update, viewMode, isVisitor,
}: {
  empresa: Empresa;
  update: <K extends keyof Empresa>(key: K, value: Empresa[K]) => void;
  viewMode: "edit" | "preview";
  isVisitor?: boolean;
}) {
  const stored = empresa.marketingFuentesClientes ?? [];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => buildFuentesDraft(stored));
  const isEditable = !isVisitor && viewMode === "edit";
  /* "Otros" auto-calculado · sumReales son las 6 fuentes editables. */
  const sumReales = sumPct(draft);
  const otrosPct = Math.max(0, 100 - sumReales);
  const total = sumReales <= 100 ? 100 : sumReales;

  const start = () => { setDraft(buildFuentesDraft(stored)); setEditing(true); };
  const save = () => {
    if (sumReales > 100) { toast.error("La suma supera 100% · ajusta los porcentajes"); return; }
    const cleaned = draft.filter(x => x.pct > 0);
    update("marketingFuentesClientes", cleaned);
    toast.success("Fuentes de clientes guardadas");
    setEditing(false);
  };
  const cancel = () => setEditing(false);

  return (
    <BlockShell
      title="Fuente de clientes"
      hint="% de leads por canal · la suma debe ser 100"
      editing={editing}
      isEditable={isEditable}
      onEdit={start}
      onSave={save}
      onCancel={cancel}
      saveDisabled={sumReales > 100}
      sumIndicator={editing ? <SumBadge total={total} /> : null}
    >
      {!editing ? (
        stored.length === 0 ? (
          <EmptyHint isEditable={isEditable} text="Aún no has declarado tus fuentes de clientes." />
        ) : (
          <FuentesReadout items={stored} />
        )
      ) : (
        <div className="flex flex-col gap-1.5">
          {draft.map((row, i) => {
            const maxThis = Math.max(0, 100 - sumPct(draft.filter((_, j) => j !== i)));
            return (
              <div key={row.fuente} className="flex items-center gap-2">
                <span className="text-[12.5px] text-foreground flex-1 truncate">{fuenteClienteLabel(row.fuente)}</span>
                <input
                  type="number"
                  min={0}
                  max={maxThis}
                  value={Number.isFinite(row.pct) ? row.pct : 0}
                  onChange={(e) => {
                    const raw = Math.max(0, Math.round(Number(e.target.value) || 0));
                    const v = Math.min(raw, maxThis);
                    setDraft(draft.map((x, j) => j === i ? { ...x, pct: v } : x));
                  }}
                  className="h-8 w-16 px-2 text-[12.5px] text-right tabular-nums bg-card border border-border rounded-lg outline-none focus:border-primary"
                />
                <span className="text-[12px] text-muted-foreground w-3">%</span>
              </div>
            );
          })}
          {/* Otros auto-calculado · siempre al final · read-only */}
          <OtrosRow pct={otrosPct} />
          <p className="text-[10.5px] text-muted-foreground/80 mt-1">
            "Otros" se completa automáticamente · ajusta los porcentajes
            de los canales hasta que sumen 100 o menos.
          </p>
        </div>
      )}
    </BlockShell>
  );
}

function buildFuentesDraft(stored: Array<{ fuente: FuenteCliente; pct: number }>): Array<{ fuente: FuenteCliente; pct: number }> {
  const map = new Map(stored.map(x => [x.fuente, x.pct]));
  return FUENTES_CLIENTES.map(f => ({ fuente: f.value, pct: map.get(f.value) ?? 0 }));
}

function FuentesReadout({ items }: { items: Array<{ fuente: FuenteCliente; pct: number }> }) {
  const total = sumPct(items);
  const otros = Math.max(0, 100 - total);
  return (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      {items.filter(x => x.pct > 0).map((x, i) => (
        <span key={i} className="inline-flex items-center gap-1 text-[11.5px]">
          <span className="text-foreground">{fuenteClienteLabel(x.fuente)}</span>
          <span className="text-muted-foreground tabular-nums">{x.pct}%</span>
        </span>
      ))}
      {otros > 0 && (
        <span className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
          Otros <span className="tabular-nums">{otros}%</span>
        </span>
      )}
    </div>
  );
}

/* ─── Helpers compartidos ─────────────────────────────────────── */
function BlockShell({
  title, hint, editing, isEditable, onEdit, onSave, onCancel,
  saveDisabled = false, sumIndicator, children,
}: {
  title: string;
  hint?: string;
  editing: boolean;
  isEditable: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  /** Si true, deshabilita el botón Guardar · típicamente cuando una
   *  validación inline (suma=100, etc.) no pasa. */
  saveDisabled?: boolean;
  sumIndicator?: React.ReactNode;
  children: React.ReactNode;
}) {
  /* Compactamos verticalmente cuando NO estamos editando · solo dejamos
   * el padding necesario para el header + el contenido leído. Antes
   * cada bloque ocupaba mucha altura aún sin contenido. */
  return (
    <div className={cn(
      "rounded-xl border border-border bg-background",
      editing ? "py-1" : "py-0.5",
    )}>
      <div className={cn(
        "px-4 flex items-center justify-between gap-2",
        editing ? "pt-3 pb-1" : "py-2",
      )}>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold text-foreground">{title}</p>
          {editing && hint && <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{hint}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {sumIndicator}
          {!editing && isEditable && (
            <button
              type="button"
              onClick={onEdit}
              className="text-[11.5px] font-semibold text-primary hover:underline"
            >
              Editar
            </button>
          )}
          {editing && (
            <>
              <button
                type="button"
                onClick={onCancel}
                className="text-[11.5px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={saveDisabled}
                className="inline-flex items-center gap-1 h-7 px-3 rounded-full bg-primary text-primary-foreground text-[11.5px] font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="h-3 w-3" /> Guardar
              </button>
            </>
          )}
        </div>
      </div>
      <div className={cn("px-4", editing ? "pb-4 pt-2" : "pb-3")}>{children}</div>
    </div>
  );
}

function SumBadge({ total }: { total: number }) {
  const ok = total === 100;
  const over = total > 100;
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 h-6 rounded-full text-[10.5px] font-semibold tabular-nums",
        ok    ? "bg-success/10 text-success"
              : over ? "bg-destructive/10 text-destructive"
              : "bg-warning/15 text-warning",
      )}
    >
      {total}% / 100%
    </span>
  );
}

function PctBar({ pct, muted }: { pct: number; muted?: boolean }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div className="hidden sm:block flex-1 max-w-[120px] h-1.5 rounded-full bg-muted overflow-hidden">
      <div className={cn("h-full rounded-full", muted ? "bg-muted-foreground/30" : "bg-primary")} style={{ width: `${w}%` }} />
    </div>
  );
}

function EmptyHint({ isEditable, text }: { isEditable: boolean; text: string }) {
  return (
    <p className="text-[12px] text-muted-foreground italic">
      {text}
      {isEditable && <> Pulsa <b>Editar</b> para empezar.</>}
    </p>
  );
}

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
    /* Mensaje único para los dos estados de "en curso" · el promotor
     * solo necesita saber que la solicitud está enviada y que Byvaro
     * la revisa en 24-48h · la firma del representante es un detalle
     * técnico interno del flujo Firmafy/superadmin, no aporta aquí. */
    const label = isRejected
      ? "Verificación rechazada"
      : "Solicitud de verificación enviada";
    const sublabel = isRejected
      ? null
      : "En 24-48h Byvaro la revisa y aprueba";
    return (
      <section className={cn(
        "rounded-2xl border shadow-soft",
        isRejected ? "border-destructive/30 bg-destructive/[0.04]" : "border-primary/30 bg-primary/[0.04]",
      )}>
        <div className="px-5 py-2.5 flex items-center gap-3">
          <ShieldCheck className={cn(
            "h-4 w-4 shrink-0",
            isRejected ? "text-destructive" : "text-primary",
          )} strokeWidth={2} />
          <p className="text-[12.5px] text-foreground min-w-0 flex-1 truncate">
            <b className="font-semibold">{label}</b>
            {sublabel && (
              <span className="ml-1.5 text-muted-foreground hidden sm:inline">· {sublabel}</span>
            )}
          </p>
          {isRejected && (
            <button
              type="button"
              onClick={() => {
                update("verificacionEstado", "datos-pendientes");
                toast.message("Revisa los datos y vuelve a enviar la solicitud");
              }}
              className="inline-flex items-center gap-1 h-7 px-3 rounded-full bg-primary text-primary-foreground text-[11.5px] font-semibold hover:bg-primary/90 transition-colors shrink-0"
            >
              Reintentar
            </button>
          )}
          {/* MOCK controls · solo prototipo · acciones del superadmin
              Byvaro · en producción no existen aquí · la decisión
              llega por webhook tras revisión humana. */}
          {(isFirmafy || isRevision) && (
            <details className="relative shrink-0">
              <summary className="list-none cursor-pointer text-muted-foreground hover:text-foreground transition-colors h-6 w-6 grid place-items-center">
                <span className="text-[14px] leading-none">···</span>
              </summary>
              <div className="absolute right-0 top-7 z-10 rounded-xl border border-border bg-card shadow-lg p-1.5 w-[230px] flex flex-col gap-0.5">
                <p className="text-[9.5px] uppercase tracking-wider text-muted-foreground/70 font-medium px-2 pt-1">Mock · sólo prototipo</p>
                <button
                  type="button"
                  onClick={() => {
                    update("verificada", true);
                    update("verificadaEl", new Date().toISOString());
                    update("verificacionEstado", "verificada");
                    toast.success("Empresa verificada por superadmin");
                  }}
                  className="text-left text-[11.5px] hover:bg-muted rounded-lg px-2 py-1.5 text-primary"
                >
                  Aprobar como superadmin
                </button>
                <button
                  type="button"
                  onClick={() => {
                    update("verificacionEstado", "rechazada");
                    toast.message("Solicitud rechazada (mock)");
                  }}
                  className="text-left text-[11.5px] hover:bg-muted rounded-lg px-2 py-1.5 text-destructive"
                >
                  Rechazar como superadmin
                </button>
              </div>
            </details>
          )}
        </div>
      </section>
    );
  }

  /* Estado colapsado · UNA sola línea · icon + texto + badge + CTA */
  if (!open) {
    return (
      <section className="rounded-2xl border border-primary/30 bg-primary/[0.04] shadow-soft">
        <div className="px-5 py-2.5 flex items-center gap-3">
          <ShieldCheck className="h-4 w-4 text-primary shrink-0" strokeWidth={2} />
          <p className="text-[12.5px] text-foreground min-w-0 flex-1 truncate">
            <b className="font-semibold">Verifica legalmente tu empresa</b>
            <span className="ml-1.5 text-muted-foreground hidden sm:inline">· suma 30% al perfil</span>
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1 h-7 px-3 rounded-full bg-primary text-primary-foreground text-[11.5px] font-semibold hover:bg-primary/90 transition-colors shrink-0"
          >
            Iniciar
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
