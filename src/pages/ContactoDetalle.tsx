/**
 * /contactos/:id · Ficha de contacto.
 *
 * Página fullscreen dentro del AppLayout (no drawer) con header
 * + 9 tabs (Resumen, Historial, Registros, Operaciones, Documentos,
 * Visitas, Emails, WhatsApp, Comentarios). Patrón portado de
 * figgy-friend-forge / ContactDetail.tsx, adaptado a tokens Byvaro.
 *
 * Datos: combina el listado real (MOCK_CONTACTS + importados) +
 * `buildContactDetail` que rellena el resto de campos de forma
 * determinista por id mientras no haya backend.
 *
 * Tabs como search params (`?tab=historial`) para deep-link y back.
 */

import { useMemo } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Pencil,
  Flame, Sparkles, Calendar as CalendarIcon, FileText,
  ClipboardList, Bot, History, Receipt, Hash, Copy, Check, Mail,
  MoreHorizontal, Trash2,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MOCK_CONTACTS } from "@/components/contacts/data";
import { loadImportedContacts } from "@/components/contacts/importedStorage";
import { loadCreatedContacts } from "@/components/contacts/createdContactsStorage";
import { loadDeletedContactIds, markContactDeleted } from "@/components/contacts/contactRelationsStorage";
import { removeCreatedContact } from "@/components/contacts/createdContactsStorage";
import { recordTypeAny } from "@/components/contacts/contactEventsStorage";
import { useCurrentUser } from "@/lib/currentUser";
import { buildContactDetail } from "@/components/contacts/contactDetailMock";
import { applyContactEdits } from "@/components/contacts/contactEditsStorage";
import { ContactSummaryTab } from "@/components/contacts/detail/ContactSummaryTab";
import { ContactWhatsAppDialog } from "@/components/contacts/detail/ContactWhatsAppDialog";
import { ContactVisitsTab } from "@/components/contacts/detail/ContactVisitsTab";
import { ContactDocumentsTab } from "@/components/contacts/detail/ContactDocumentsTab";
import { ContactHistoryTab } from "@/components/contacts/detail/ContactHistoryTab";
import { ContactRecordsTab } from "@/components/contacts/detail/ContactRecordsTab";
import { ContactOperacionesTab } from "@/components/contacts/detail/ContactOperacionesTab";
import { ContactEmailsTab } from "@/components/contacts/detail/ContactEmailsTab";
import { EditContactDialog } from "@/components/contacts/detail/EditContactDialog";

const TABS = [
  { id: "resumen",      label: "Resumen",     icon: Sparkles },
  { id: "historial",    label: "Historial",   icon: History },
  { id: "registros",    label: "Registros",   icon: ClipboardList },
  { id: "operaciones",  label: "Operaciones", icon: Receipt },
  { id: "visitas",      label: "Visitas",     icon: CalendarIcon },
  { id: "documentos",   label: "Documentos",  icon: FileText },
  { id: "emails",       label: "Emails",      icon: Mail },
  { id: "whatsapp",     label: "WhatsApp",    icon: WhatsAppIcon },
] as const;

type TabId = typeof TABS[number]["id"];

export default function ContactoDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: TabId = (searchParams.get("tab") as TabId) ?? "resumen";

  /* Universo: importados primero (más recientes) + mocks. */
  const allContacts = useMemo(() => {
    const deleted = loadDeletedContactIds();
    return [...loadCreatedContacts(), ...loadImportedContacts(), ...MOCK_CONTACTS]
      .filter((c) => !deleted.has(c.id));
  }, []);

  const baseContact = useMemo(
    () => allContacts.find((c) => c.id === id),
    [allContacts, id],
  );

  /* Sin contacto válido → redirige al listado. */
  if (!id || !baseContact) {
    return <Navigate to="/contactos" replace />;
  }

  /* Version-tick para refrescar tras editar. Lo bumpeamos desde el
   * dialog cuando guarda. */
  const confirm = useConfirm();
  const user = useCurrentUser();
  const [editVersion, setEditVersion] = useState(0);

  const detail = useMemo(
    () => applyContactEdits(buildContactDetail(baseContact, allContacts)),
    [baseContact, allContacts, editVersion],
  );

  const [editOpen, setEditOpen] = useState(false);
  /* WhatsApp ahora se abre como modal lateral en vez de tab. */
  const [whatsappOpen, setWhatsappOpen] = useState(false);

  const initials = detail.name
    .split(" ").filter(Boolean).slice(0, 2)
    .map((w) => w[0]).join("").toUpperCase() || "?";

  const isHot = (detail.leadScore ?? 0) >= 75;

  const setTab = (t: TabId) => {
    /* WhatsApp es un modal — interceptamos antes de cambiar de tab. */
    if (t === "whatsapp") {
      setWhatsappOpen(true);
      return;
    }
    const params = new URLSearchParams(searchParams);
    if (t === "resumen") params.delete("tab");
    else params.set("tab", t);
    setSearchParams(params);
  };

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-12">

      {/* ══════ Back ══════ */}
      <div className="mb-4">
        <button
          onClick={() => navigate("/contactos")}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Contactos
        </button>
      </div>

      {/* ══════ Header ══════ Compacto: una sola fila avatar + nombre +
       *  meta inline + acciones. Sin card envolvente — la jerarquía
       *  visual la da el contenido, no más cromo. */}
      <header className="flex items-center gap-3 mb-4">
        <div className="h-11 w-11 rounded-xl bg-foreground/5 grid place-items-center text-foreground font-semibold text-base shrink-0 relative">
          {detail.flag ? (
            <span className="text-xl">{detail.flag}</span>
          ) : (
            <span>{initials}</span>
          )}
          {isHot && (
            <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-warning text-white grid place-items-center shadow-soft ring-2 ring-background" title={`Lead caliente · ${detail.leadScore}/100`}>
              <Flame className="h-2.5 w-2.5" strokeWidth={2.5} />
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Línea 1: nombre + estado */}
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-semibold tracking-tight text-foreground truncate">
              {detail.name}
            </h1>
            {!isHot && (
              <span className={cn(
                "inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded-full shrink-0",
                detail.status === "active"    ? "bg-success/15 text-success dark:text-success" :
                detail.status === "pending"   ? "bg-warning/15 text-warning dark:text-warning" :
                detail.status === "converted" ? "bg-violet-500/15 text-violet-700 dark:text-violet-400" :
                                                "bg-muted text-muted-foreground",
              )}>
                {detail.status === "active" ? "Activo" :
                 detail.status === "pending" ? "Pendiente" :
                 detail.status === "converted" ? "Cliente" : "Frío"}
              </span>
            )}
          </div>

          {/* Línea 2: meta sutil — con respiración respecto al nombre */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            {detail.reference && (
              <>
                <ReferenceChip reference={detail.reference} />
                <span aria-hidden>·</span>
              </>
            )}
            {typeof detail.leadScore === "number" && (
              <>
                <span className={cn("tnum font-semibold", isHot ? "text-warning" : "text-foreground")}>
                  Score {detail.leadScore}
                </span>
                <span aria-hidden>·</span>
              </>
            )}
            {detail.emailAddresses[0]?.address && (
              <Link
                to={`/emails?compose=1&to=${encodeURIComponent(detail.emailAddresses[0].address)}`}
                className="truncate max-w-[220px] hover:text-foreground hover:underline transition-colors"
                title="Abrir cliente de email con este destinatario"
              >
                {detail.emailAddresses[0].address}
              </Link>
            )}
            {detail.lastActivity && (
              <>
                  <span aria-hidden>·</span>
                <span>{detail.lastActivity}</span>
              </>
            )}
          </div>
        </div>

        {/* Acciones del header — Editar (solo en Resumen) + menú ⋯ con
         *  Eliminar siempre disponible. */}
        <div className="flex items-center gap-1 shrink-0">
          {activeTab === "resumen" && (
            <button
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Editar contacto"
            >
              <Pencil className="h-3 w-3" /> <span className="hidden sm:inline">Editar</span>
            </button>
          )}
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="h-8 w-8 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Más acciones"
                aria-label="Más acciones"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              side="bottom"
              sideOffset={6}
              className="w-[200px] p-1 rounded-xl border-border shadow-soft-lg"
            >
              <button
                onClick={async () => {
                  const ok = await confirm({
                    title: "¿Eliminar contacto?",
                    description: `Se eliminará "${detail.name}" del workspace. Esta acción no se puede deshacer (mientras no haya backend).`,
                    confirmLabel: "Eliminar contacto",
                    variant: "destructive",
                  });
                  if (!ok) return;
                  recordTypeAny(detail.id, "contact_deleted",
                    `Contacto eliminado · ${detail.name}`,
                    undefined,
                    { name: user.name, email: user.email },
                  );
                  removeCreatedContact(detail.id);
                  markContactDeleted(detail.id);
                  toast.success(`${detail.name} eliminado`);
                  navigate("/contactos");
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" /> Eliminar contacto
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </header>

      {/* ══════ Tabs ══════ */}
      <div className="border-b border-border/60 mb-5 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-2.5 -mb-px border-b-2 text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ══════ Contenido del tab ══════ */}
      {activeTab === "resumen" && (
        <ContactSummaryTab
          detail={detail}
          onRefresh={() => setEditVersion((v) => v + 1)}
          onOpenWhatsApp={() => setWhatsappOpen(true)}
        />
      )}
      {activeTab === "historial" && <ContactHistoryTab detail={detail} />}
      {activeTab === "registros" && <ContactRecordsTab detail={detail} />}
      {activeTab === "operaciones" && <ContactOperacionesTab detail={detail} />}
      {activeTab === "visitas" && <ContactVisitsTab detail={detail} />}
      {activeTab === "documentos" && (
        <ContactDocumentsTab
          detail={detail}
          onOpenWhatsApp={() => setWhatsappOpen(true)}
        />
      )}
      {activeTab === "emails" && <ContactEmailsTab detail={detail} />}

      {activeTab !== "resumen" &&
       activeTab !== "historial" &&
       activeTab !== "registros" &&
       activeTab !== "operaciones" &&
       activeTab !== "visitas" &&
       activeTab !== "documentos" &&
       activeTab !== "emails" && (
        <PlaceholderTab
          title={TABS.find((t) => t.id === activeTab)?.label ?? ""}
          description="Esta sección de la ficha está en diseño. Iremos montándola en próximos pasos."
        />
      )}

      {/* ══════ Modal de WhatsApp ══════ */}
      <ContactWhatsAppDialog
        open={whatsappOpen}
        onOpenChange={setWhatsappOpen}
        detail={detail}
      />


      {/* ══════ Dialog de edición ══════ */}
      <EditContactDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        detail={detail}
        onSaved={() => setEditVersion((v) => v + 1)}
      />
    </div>
  );
}

/** Chip con la referencia interna del contacto + botón copiar al portapapeles. */
function ReferenceChip({ reference }: { reference: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(reference);
    setCopied(true);
    toast.success(`Referencia ${reference} copiada`);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted border border-border/40 rounded-full px-2 py-0.5 transition-colors"
      title="Copiar referencia interna"
    >
      <Hash className="h-3 w-3" />
      <span className="tnum">{reference}</span>
      {copied
        ? <Check className="h-3 w-3 text-success" />
        : <Copy className="h-3 w-3 opacity-50" />}
    </button>
  );
}

function PlaceholderTab({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-card rounded-2xl border border-dashed border-border/60 p-12 text-center">
      <div className="h-12 w-12 mx-auto rounded-2xl bg-muted grid place-items-center text-muted-foreground mb-4">
        <Bot className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">{description}</p>
    </div>
  );
}
