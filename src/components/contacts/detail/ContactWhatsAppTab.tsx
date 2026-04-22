/**
 * Tab "WhatsApp" de la ficha de contacto (dentro de "Comunicaciones").
 *
 * Dos modos:
 *  1. SETUP — si el workspace no tiene WhatsApp conectado, pide elegir
 *     entre WhatsApp Business API o WhatsApp Web. Cada opción abre un
 *     wizard simulado (lo real va en backend, ver TODOs).
 *  2. CHAT — conversación con el cliente. Muestra todos los mensajes
 *     (históricos del seed + los que el usuario actual va enviando),
 *     ordenados cronológicamente. Cada mensaje saliente lleva el
 *     avatar y nombre del agente que lo escribió.
 *
 * Reglas de seguridad / permisos (UI):
 *  - Cualquier miembro puede VER la conversación completa, incluyendo
 *    los mensajes que enviaron otros miembros (visibilidad de equipo).
 *  - Cada miembro SOLO puede escribir como sí mismo (no impersonar).
 *    El input siempre firma con `useCurrentUser()`.
 *  - El admin tiene un filtro extra "Ver mensajes de" para aislar la
 *    conversación de un agente concreto. Los miembros no-admin lo ven
 *    también pero como filtro de lectura puro.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  MessageCircle, Smartphone, Building2, Send, ArrowLeft,
  CheckCheck, Settings, Sparkles, Mic, Plus, Smile,
  Image as ImageIcon, FileText, MapPin, User as UserIcon, X,
  Square, FileType2,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCurrentUser } from "@/lib/currentUser";
import { useHasPermission } from "@/lib/permissions";
import {
  loadWhatsAppSetup, saveWhatsAppSetup, clearWhatsAppSetup,
  type WhatsAppMethod, type WhatsAppSetup,
} from "@/lib/whatsappStorage";
import {
  loadConversation, appendOutgoingMessage,
  type WhatsAppMessage, type WhatsAppMessageKind,
} from "@/components/contacts/whatsappMessagesMock";
import { recordWhatsAppSent } from "@/components/contacts/contactEventsStorage";
import type { ContactDetail } from "@/components/contacts/types";

type Mode = "page" | "modal";
type Props = { detail: ContactDetail; mode?: Mode };

export function ContactWhatsAppTab({ detail, mode = "page" }: Props) {
  const [setup, setSetup] = useState<WhatsAppSetup | null>(() => loadWhatsAppSetup());

  /* Gating de permisos.
   *  - viewOwn: permiso base para ver/usar WhatsApp en la ficha.
   *  - viewAll: permite filtrar por agente y leer conversaciones ajenas.
   *  - manageChannel: necesario para conectar/desconectar (admin). */
  const canViewOwn = useHasPermission("whatsapp.viewOwn");
  const canViewAll = useHasPermission("whatsapp.viewAll");
  const canManageChannel = useHasPermission("whatsapp.manageChannel");

  if (!canViewOwn) return <NoAccessView />;

  if (!setup) {
    return canManageChannel
      ? <SetupView mode={mode} onConnected={(s) => { saveWhatsAppSetup(s); setSetup(s); }} />
      : <NotConfiguredView />;
  }

  return (
    <ChatView
      detail={detail}
      setup={setup}
      onDisconnect={() => { clearWhatsAppSetup(); setSetup(null); }}
      canViewAll={canViewAll}
      canManageChannel={canManageChannel}
      mode={mode}
    />
  );
}

/** Pantalla cuando el usuario NO tiene permiso para entrar al tab. */
function NoAccessView() {
  return (
    <div className="bg-card rounded-2xl border border-border/40 shadow-soft p-10 text-center">
      <div className="h-12 w-12 mx-auto rounded-2xl bg-muted grid place-items-center text-muted-foreground mb-4">
        <MessageCircle className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold text-foreground">Sin acceso a WhatsApp</p>
      <p className="text-xs text-muted-foreground mt-1.5 max-w-md mx-auto leading-relaxed">
        Tu rol no tiene permiso para ver las conversaciones de WhatsApp. Pide a un administrador que te lo conceda en{" "}
        <span className="text-foreground font-medium">Ajustes · Usuarios y roles · Roles y permisos</span>.
      </p>
    </div>
  );
}

/** Pantalla cuando NO hay canal conectado y el usuario NO puede conectarlo. */
function NotConfiguredView() {
  return (
    <div className="bg-card rounded-2xl border border-border/40 shadow-soft p-10 text-center">
      <div className="h-12 w-12 mx-auto rounded-2xl bg-muted grid place-items-center text-muted-foreground mb-4">
        <MessageCircle className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold text-foreground">WhatsApp aún no está configurado</p>
      <p className="text-xs text-muted-foreground mt-1.5 max-w-md mx-auto leading-relaxed">
        El workspace todavía no ha conectado su canal de WhatsApp. Pídele a un administrador que lo configure en{" "}
        <span className="text-foreground font-medium">Ajustes · WhatsApp · Número vinculado</span>.
      </p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SETUP — elegir método y simular conexión
   ══════════════════════════════════════════════════════════════════ */

function SetupView({ onConnected, mode }: { onConnected: (s: WhatsAppSetup) => void; mode: Mode }) {
  const [method, setMethod] = useState<WhatsAppMethod | null>(null);

  return (
    <div className="bg-card rounded-2xl border border-border/40 shadow-soft p-6 sm:p-10">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="h-14 w-14 mx-auto rounded-2xl bg-emerald-500/10 grid place-items-center text-emerald-700 dark:text-emerald-400 mb-4">
            <MessageCircle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Conecta WhatsApp</h2>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto leading-relaxed">
            Para enviar y recibir mensajes desde la ficha del contacto, elige cómo quieres conectar el WhatsApp del workspace.
          </p>
        </div>

        {/* Opciones · en modal apilamos siempre (no hay sitio para 2 cols). */}
        {!method && (
          <div className={cn(
            "grid gap-3",
            mode === "modal" ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2",
          )}>
            <MethodCard
              icon={Building2}
              title="WhatsApp Business API"
              recommended
              description="API oficial de Meta. Número dedicado de empresa, sin teléfono físico, multi-usuario y con métricas."
              bullets={[
                "Hasta 1000 mensajes / día gratis",
                "Multi-agente desde el primer día",
                "Plantillas aprobadas por Meta",
              ]}
              onClick={() => setMethod("businessApi")}
            />
            <MethodCard
              icon={Smartphone}
              title="WhatsApp Web"
              description="Vincula un teléfono móvil escaneando un código QR. Más rápido para empezar pero limitado."
              bullets={[
                "Setup en 30 segundos",
                "Limitado a 1 dispositivo conectado",
                "Sin métricas oficiales",
              ]}
              onClick={() => setMethod("web")}
            />
          </div>
        )}

        {method && <SetupWizard method={method} onCancel={() => setMethod(null)} onConnected={onConnected} />}
      </div>
    </div>
  );
}

function MethodCard({
  icon: Icon, title, description, bullets, onClick, recommended,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  bullets: string[];
  onClick: () => void;
  recommended?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-card border border-border rounded-2xl p-5 hover:border-foreground/40 hover:shadow-soft-lg hover:-translate-y-0.5 transition-all duration-200 group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="h-11 w-11 rounded-xl bg-foreground/5 grid place-items-center text-foreground shrink-0">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
        {recommended && (
          <span className="text-[10px] uppercase tracking-wider font-semibold bg-foreground text-background rounded-full px-2 py-0.5">
            Recomendado
          </span>
        )}
      </div>
      <p className="text-sm font-bold text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
      <ul className="mt-3 space-y-1">
        {bullets.map((b) => (
          <li key={b} className="text-[11.5px] text-muted-foreground flex items-start gap-1.5">
            <span className="text-foreground mt-0.5">·</span> {b}
          </li>
        ))}
      </ul>
    </button>
  );
}

function SetupWizard({
  method, onCancel, onConnected,
}: {
  method: WhatsAppMethod;
  onCancel: () => void;
  onConnected: (s: WhatsAppSetup) => void;
}) {
  const [businessNumber, setBusinessNumber] = useState("");
  const [step, setStep] = useState<1 | 2>(1);

  if (method === "businessApi") {
    return (
      <div className="bg-muted/30 rounded-2xl border border-border/40 p-6 max-w-lg mx-auto">
        <button onClick={onCancel} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-3 w-3" /> Volver
        </button>
        <h3 className="text-base font-bold text-foreground">WhatsApp Business API</h3>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          Necesitas un número de teléfono dedicado (no uno que ya esté en WhatsApp normal) y una cuenta de Meta Business Manager.
        </p>

        {/* TODO(backend): este formulario es decorativo. La activación
         *  real implica:
         *    1. OAuth con Meta Business Manager.
         *    2. Aprobar el "WhatsApp Business Account".
         *    3. Solicitar número, verificarlo por SMS/voz.
         *    4. Suscribirse al webhook para recibir mensajes.
         *    5. Pagar la conversación según las nuevas tarifas. */}
        <div className="mt-5 space-y-4">
          <div>
            <label className="text-[11px] font-semibold text-foreground block mb-1.5">
              Número de empresa
            </label>
            <input
              value={businessNumber}
              onChange={(e) => setBusinessNumber(e.target.value)}
              placeholder="+34 600 000 000"
              className="w-full h-9 px-3 text-sm rounded-xl border border-border bg-card outline-none focus:border-primary"
            />
            <p className="text-[10.5px] text-muted-foreground mt-1">
              No debe estar en uso en otra cuenta de WhatsApp.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" className="rounded-full" onClick={onCancel}>Cancelar</Button>
            <Button
              size="sm"
              className="rounded-full"
              disabled={!businessNumber.trim()}
              onClick={() => {
                onConnected({
                  method: "businessApi",
                  connectedAt: new Date().toISOString(),
                  businessNumber: businessNumber.trim(),
                  displayName: "WhatsApp Business",
                });
                toast.success("WhatsApp Business API conectado");
              }}
            >
              Conectar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* method === "web" — wizard de QR simulado */
  return (
    <div className="bg-muted/30 rounded-2xl border border-border/40 p-6 max-w-lg mx-auto">
      <button onClick={onCancel} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-3 w-3" /> Volver
      </button>
      <h3 className="text-base font-bold text-foreground">WhatsApp Web</h3>
      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
        Abre WhatsApp en tu móvil → Configuración → Dispositivos vinculados → Vincular un dispositivo, y escanea este código.
      </p>

      {/* TODO(backend): la generación del QR real va contra un servicio
       *  tipo Baileys / wppconnect / venom. El QR se renueva cada ~30s
       *  hasta que el dispositivo lo escanea. Aquí pintamos un mock. */}
      <div className="mt-5">
        {step === 1 ? (
          <>
            <div className="bg-white p-3 rounded-2xl border border-border/40 mx-auto w-fit">
              <div className="h-[200px] w-[200px] grid grid-cols-12 gap-px bg-white">
                {Array.from({ length: 144 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-full w-full",
                      // Pseudo-aleatorio determinista por índice (no Math.random en render).
                      [3, 5, 7, 11, 13, 17, 19, 23, 29, 31].some((p) => i % p === 0)
                        ? "bg-foreground" : "bg-white",
                    )}
                  />
                ))}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground text-center mt-3">
              El código se renueva cada 30 segundos.
            </p>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="ghost" size="sm" className="rounded-full" onClick={onCancel}>Cancelar</Button>
              <Button size="sm" className="rounded-full" onClick={() => setStep(2)}>Ya he escaneado</Button>
            </div>
          </>
        ) : (
          <div className="text-center py-6">
            <div className="h-12 w-12 mx-auto rounded-2xl bg-emerald-500/15 grid place-items-center mb-3">
              <Sparkles className="h-5 w-5 text-emerald-600" />
            </div>
            <p className="text-sm font-semibold text-foreground">¿Cómo quieres llamar a este dispositivo?</p>
            <input
              autoFocus
              value={businessNumber}
              onChange={(e) => setBusinessNumber(e.target.value)}
              placeholder="Ej. iPhone de Arman"
              className="mt-3 w-64 h-9 px-3 text-sm rounded-xl border border-border bg-card outline-none focus:border-primary mx-auto block"
            />
            <div className="flex justify-center gap-2 pt-4">
              <Button variant="ghost" size="sm" className="rounded-full" onClick={onCancel}>Cancelar</Button>
              <Button
                size="sm"
                className="rounded-full"
                disabled={!businessNumber.trim()}
                onClick={() => {
                  onConnected({
                    method: "web",
                    connectedAt: new Date().toISOString(),
                    displayName: businessNumber.trim(),
                  });
                  toast.success("WhatsApp Web vinculado");
                }}
              >
                Conectar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   CHAT — conversación con el contacto
   ══════════════════════════════════════════════════════════════════ */

function ChatView({
  detail, setup, onDisconnect, canViewAll, canManageChannel, mode,
}: {
  detail: ContactDetail;
  setup: WhatsAppSetup;
  onDisconnect: () => void;
  canViewAll: boolean;
  canManageChannel: boolean;
  mode: Mode;
}) {
  const user = useCurrentUser();
  const confirm = useConfirm();

  /* Conversación = históricos + locales. version-tick para forzar
   * reload tras enviar un mensaje. */
  const [version, setVersion] = useState(0);
  const messages = useMemo<WhatsAppMessage[]>(
    () => loadConversation(detail),
    [detail, version],
  );

  /* Stats por agente: total de mensajes intercambiados (entrantes del
   * cliente + salientes de ESE agente) + cuántos mensajes nuevos del
   * cliente hay desde su último mensaje saliente. */
  const agentStats = useMemo(() => {
    const map = new Map<string, {
      id: string; name: string;
      messagesCount: number;  // total intercambiados (in + out de ESE agente)
      lastAt: string;         // último mensaje (cualquier dirección)
      lastOutAt: string;      // último mensaje saliente de ESE agente
      newMessages: number;    // entrantes desde su lastOutAt
    }>();

    /* 1ª pasada: registrar agentes a partir de sus salientes. */
    for (const m of messages) {
      if (m.direction !== "outgoing" || !m.authorId || !m.authorName) continue;
      if (!map.has(m.authorId)) {
        map.set(m.authorId, {
          id: m.authorId, name: m.authorName,
          messagesCount: 0, lastAt: "", lastOutAt: "", newMessages: 0,
        });
      }
      const cur = map.get(m.authorId)!;
      cur.messagesCount += 1;
      if (m.timestamp > cur.lastAt) cur.lastAt = m.timestamp;
      if (m.timestamp > cur.lastOutAt) cur.lastOutAt = m.timestamp;
    }

    /* 2ª pasada: cada entrante cuenta para TODOS los agentes y, si
     * llega después del último saliente del agente, es "nuevo" para él. */
    for (const m of messages) {
      if (m.direction !== "incoming") continue;
      for (const stats of map.values()) {
        stats.messagesCount += 1;
        if (m.timestamp > stats.lastAt) stats.lastAt = m.timestamp;
        if (!stats.lastOutAt || m.timestamp > stats.lastOutAt) {
          stats.newMessages += 1;
        }
      }
    }

    return [...map.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  }, [messages]);

  /* Filtro siempre activo en un agente concreto (no hay "todos"). Por
   * defecto el usuario actual; si admin y aún no ha escrito, el primer
   * agente con conversación. */
  const initialFilter = useMemo(() => {
    if (agentStats.some((a) => a.id === user.id)) return user.id;
    if (canViewAll && agentStats.length > 0) return agentStats[0].id;
    return user.id;
  }, [agentStats, user.id, canViewAll]);

  const [authorFilter, setAuthorFilter] = useState<string>(initialFilter);
  useEffect(() => {
    if (!canViewAll && authorFilter !== user.id) setAuthorFilter(user.id);
  }, [canViewAll, user.id, authorFilter]);

  const filteredMessages = useMemo(() => {
    return messages.filter((m) => m.direction === "incoming" || m.authorId === authorFilter);
  }, [messages, authorFilter]);

  /* Mensajes nuevos pendientes de respuesta para el agente activo. */
  const newMessagesInActiveChat = agentStats.find((a) => a.id === authorFilter)?.newMessages ?? 0;

  /* Auto-scroll al final cuando hay mensajes nuevos. */
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredMessages.length]);

  /* ── Composer state ── */
  const [draft, setDraft] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);

  /* Tic-tac del grabador. */
  useEffect(() => {
    if (!isRecording) return;
    const id = setInterval(() => setRecordSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isRecording]);

  const sendWith = (
    payload: { kind?: WhatsAppMessageKind; text?: string; meta?: Record<string, string | number> },
  ) => {
    appendOutgoingMessage(detail.id, {
      authorId: user.id,
      authorName: user.name,
      ...payload,
    });
    /* Audit log: 1 evento por mensaje saliente. */
    const summary = payload.kind === "text" || !payload.kind
      ? (payload.text ?? "").slice(0, 80)
      : payload.kind === "voice" ? `Mensaje de voz · ${payload.meta?.durationSec ?? 0}s`
      : payload.kind === "image" ? `Imagen: ${payload.meta?.fileName ?? "imagen"}`
      : payload.kind === "document" ? `Documento: ${payload.meta?.fileName ?? "archivo"}`
      : payload.kind === "location" ? `Ubicación · ${payload.meta?.label ?? ""}`
      : payload.kind === "contact" ? `Tarjeta de contacto · ${payload.meta?.contactName ?? ""}`
      : payload.kind === "template" ? `Plantilla: ${payload.meta?.templateName ?? ""}`
      : "Mensaje enviado";
    recordWhatsAppSent(detail.id, { name: user.name, email: user.email }, summary);
    setVersion((v) => v + 1);
  };

  const sendText = () => {
    const text = draft.trim();
    if (!text) return;
    sendWith({ kind: "text", text });
    setDraft("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendText();
    }
  };

  const startRecording = () => { setIsRecording(true); setRecordSec(0); };
  const stopRecording = (cancel = false) => {
    setIsRecording(false);
    if (cancel || recordSec === 0) { setRecordSec(0); return; }
    sendWith({ kind: "voice", meta: { durationSec: recordSec } });
    setRecordSec(0);
    toast.success("Mensaje de voz enviado");
  };

  /* File picker real para imágenes — guarda dataURL en meta para que
   * el bubble pueda renderizar la imagen tal cual subida. */
  const imageInputRef = useRef<HTMLInputElement>(null);
  const triggerImagePicker = () => imageInputRef.current?.click();
  const onImagePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    /* localStorage tiene ~5MB total; capamos a 1.5MB por imagen para no romper. */
    if (file.size > 1.5 * 1024 * 1024) {
      toast.error("La imagen supera 1.5 MB. Comprime antes de enviar.");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const caption = draft.trim() || undefined;
      sendWith({
        kind: "image",
        text: caption,
        meta: {
          fileName: file.name,
          sizeKb: Math.round(file.size / 1024),
          dataUrl: String(reader.result),
        },
      });
      setDraft("");
      toast.success("Imagen enviada");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };
  const sendDocument = () => {
    sendWith({ kind: "document", meta: { fileName: "Ficha técnica · Marina Bay.pdf", sizeKb: 1240 } });
    toast.success("Documento enviado");
  };
  const sendLocation = () => {
    sendWith({ kind: "location", meta: { lat: 36.5078, lng: -4.8825, label: "Marina Bay · Marbella" } });
    toast.success("Ubicación enviada");
  };
  const sendContactCard = () => {
    sendWith({ kind: "contact", meta: { contactName: user.name, phone: setup.businessNumber ?? "+34 600 000 000" } });
    toast.success("Tarjeta de contacto enviada");
  };

  const insertEmoji = (emoji: string) => {
    setDraft((d) => d + emoji);
  };

  const useTemplate = (templateName: string, body: string) => {
    sendWith({ kind: "template", text: body, meta: { templateName } });
    toast.success(`Plantilla "${templateName}" enviada`);
  };

  const disconnect = async () => {
    const ok = await confirm({
      title: "¿Desconectar WhatsApp?",
      description: "Dejarás de poder enviar y recibir mensajes desde Byvaro hasta volver a conectarlo. Los mensajes guardados se mantienen.",
      confirmLabel: "Desconectar",
      variant: "destructive",
    });
    if (!ok) return;
    onDisconnect();
    toast.info("WhatsApp desconectado del workspace");
  };

  return (
    <section className={cn(
      "bg-card overflow-hidden grid",
      mode === "modal"
        /* Dentro del modal: chat + sidebar de agentes (300px) en md+,
         *  apilado en mobile. Alto = 100% del Dialog. Sin chrome
         *  extra (border/radius lo provee el Dialog). */
        ? "grid-cols-1 md:grid-cols-[1fr_300px] h-full"
        /* En página: dos columnas en lg, alto calculado restando el
         *  header + tabs de la ficha. */
        : "rounded-2xl border border-border/40 shadow-soft grid-cols-1 lg:grid-cols-[1fr_280px] h-[calc(100vh-260px)] min-h-[560px]",
    )}>

      {/* ══════ COLUMNA CHAT ══════ */}
      <div className="flex flex-col min-w-0 min-h-0 h-full border-r border-border/40 overflow-hidden">

        {/* Header del chat — avatar del cliente (foto real cuando exista,
         *  iniciales mientras tanto) + nombre + estado conexión. */}
        <header className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-border/40">
          <div className="flex items-center gap-3 min-w-0">
            <ContactAvatar name={detail.name} flag={detail.flag} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{detail.name}</p>
              <p className="text-[11px] text-muted-foreground truncate inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {detail.phones.find((p) => p.hasWhatsapp)?.number ?? detail.phone ?? "Sin número"}
                <span aria-hidden>·</span>
                <span className="text-emerald-600">Conectado vía {setup.method === "businessApi" ? "Business API" : "WhatsApp Web"}</span>
              </p>
            </div>
          </div>
          {canManageChannel && (
            <button
              onClick={disconnect}
              className="h-8 w-8 rounded-full grid place-items-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Configurar / desconectar"
              aria-label="Configurar / desconectar"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          )}
        </header>

        {/* Banner de mensajes nuevos pendientes (entrantes del cliente
         *  desde el último saliente del agente activo). */}
        {newMessagesInActiveChat > 0 && (
          <div className="px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/30 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-[11.5px] text-emerald-700 dark:text-emerald-400 font-medium">
              {newMessagesInActiveChat} {newMessagesInActiveChat === 1 ? "mensaje nuevo del cliente" : "mensajes nuevos del cliente"}
            </p>
          </div>
        )}

        {/* Lista de mensajes — min-h-0 imprescindible para que el
         *  overflow-y-auto funcione dentro de un flex column. */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3 bg-[#f5f3ee] dark:bg-muted/20">
          {filteredMessages.length === 0 ? (
            <div className="h-full grid place-items-center text-center">
              <div>
                <MessageCircle className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Sin mensajes con este filtro</p>
              </div>
            </div>
          ) : (
            filteredMessages.map((m, i) => {
              const prev = filteredMessages[i - 1];
              const showDateSep = !prev || !sameDay(prev.timestamp, m.timestamp);
              return (
                <div key={m.id}>
                  {showDateSep && (
                    <div className="flex items-center justify-center my-3">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground bg-card border border-border/40 rounded-full px-2.5 py-0.5">
                        {formatDateSep(m.timestamp)}
                      </span>
                    </div>
                  )}
                  <Bubble msg={m} isMine={m.authorId === user.id} />
                </div>
              );
            })
          )}
        </div>

        {/* ══════ Composer ══════ shrink-0 para que NUNCA lo coma el flex.
         *  Si el usuario tiene el filtro puesto en OTRO agente, no puede
         *  escribir (no se puede impersonar). Mostramos un banner CTA. */}
        <footer className="shrink-0 border-t border-border/40 bg-card">
          {authorFilter !== user.id ? (
            <ReadOnlyComposerBar
              agentName={agentStats.find((a) => a.id === authorFilter)?.name ?? "este agente"}
              onClearFilter={() => setAuthorFilter(user.id)}
            />
          ) : isRecording ? (
            <RecordingBar
              seconds={recordSec}
              onCancel={() => stopRecording(true)}
              onSend={() => stopRecording(false)}
            />
          ) : (
            <ComposerBar
              draft={draft}
              setDraft={setDraft}
              onKeyDown={onKeyDown}
              onSend={sendText}
              onStartRecording={startRecording}
              onInsertEmoji={insertEmoji}
              onSendImage={triggerImagePicker}
              onSendDocument={sendDocument}
              onSendLocation={sendLocation}
              onSendContact={sendContactCard}
              onUseTemplate={useTemplate}
              user={user}
              isBusinessApi={setup.method === "businessApi"}
            />
          )}
          {/* Input file invisible — disparado desde el botón "+" → Foto */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={onImagePicked}
          />
        </footer>
      </div>

      {/* ══════ SIDEBAR DE AGENTES (estilo "Asignados" del Resumen) ══════
       *  Visible en página (lg+) y en modal (md+ = cuando el modal
       *  alcanza los 760px de ancho). En mobile siempre oculto. */}
      <AgentsPanel
        setup={setup}
        agents={agentStats}
        authorFilter={authorFilter}
        onSelect={setAuthorFilter}
        currentUserId={user.id}
        canViewAll={canViewAll}
        mode={mode}
      />
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SIDEBAR DE AGENTES
   ══════════════════════════════════════════════════════════════════ */

function AgentsPanel({
  setup, agents, authorFilter, onSelect, currentUserId, canViewAll, mode,
}: {
  setup: WhatsAppSetup;
  agents: {
    id: string; name: string; messagesCount: number;
    lastAt: string; lastOutAt: string; newMessages: number;
  }[];
  authorFilter: string;
  onSelect: (id: string) => void;
  currentUserId: string;
  canViewAll: boolean;
  mode: Mode;
}) {
  return (
    <aside className={cn(
      "flex-col h-full min-h-0 bg-muted/20 min-w-0 overflow-hidden border-l border-border/40",
      /* En modal aparece a partir de md (≥768px, cuando el modal mide
       *  760px). En página requiere lg (>=1024px). */
      mode === "modal" ? "hidden md:flex" : "hidden lg:flex",
    )}>
      {/* Cabecera con info del workspace WhatsApp */}
      <div className="shrink-0 px-4 py-3 border-b border-border/40 bg-card">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70">
          Canal del workspace
        </p>
        <p className="text-sm font-semibold text-foreground mt-0.5 truncate inline-flex items-center gap-2">
          {setup.method === "businessApi" ? <Building2 className="h-3.5 w-3.5" /> : <Smartphone className="h-3.5 w-3.5" />}
          {setup.method === "businessApi" ? "Business API" : "WhatsApp Web"}
        </p>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
          {setup.businessNumber ?? setup.displayName ?? "—"}
        </p>
      </div>

      {/* Lista de chats — uno por agente, con su contador y badge de
       *  mensajes nuevos del cliente desde su última respuesta. */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1.5">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70 px-2 mb-1">
          Chats con este cliente
        </p>

        {agents.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic px-2 py-3 text-center">
            Aún no ha escrito ningún agente.
          </p>
        ) : agents.map((a) => {
          const isMe = a.id === currentUserId;
          const active = authorFilter === a.id;
          /* Si no tiene viewAll, solo puede seleccionarse a sí mismo;
           * los demás aparecen deshabilitados (transparencia). */
          const disabled = !canViewAll && !isMe;
          const initials = a.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
          const hasNew = a.newMessages > 0;
          return (
            <button
              key={a.id}
              onClick={() => !disabled && onSelect(a.id)}
              disabled={disabled}
              title={disabled ? "Tu rol no permite ver conversaciones de otros agentes" : undefined}
              className={cn(
                "w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left transition-colors",
                active ? "bg-card border border-border/60 shadow-soft" :
                disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-card/50",
              )}
            >
              <div className="h-9 w-9 rounded-full bg-foreground/10 grid place-items-center text-foreground font-semibold text-xs shrink-0 relative">
                {initials}
                {hasNew && (
                  <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-muted/20" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate inline-flex items-center gap-1.5 max-w-full">
                  <span className="truncate">{a.name}</span>
                  {isMe && <span className="text-muted-foreground font-normal text-[11px]">· tú</span>}
                </p>
                <p className="text-[11px] text-muted-foreground tnum">
                  {a.messagesCount} {a.messagesCount === 1 ? "mensaje" : "mensajes"}
                </p>
              </div>
              {hasNew && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-emerald-500 text-white text-[10px] font-bold tnum px-1 shrink-0">
                  {a.newMessages}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer info */}
      <div className="shrink-0 border-t border-border/40 p-3 bg-card">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Solo puedes <strong className="text-foreground">escribir como tú</strong>.
          {canViewAll
            ? " Selecciona el chat de otro agente para leerlo (en modo lectura)."
            : " Tu rol solo te permite ver tus propias conversaciones."}
        </p>
      </div>
    </aside>
  );
}

/* ══════════════════════════════════════════════════════════════════
   COMPOSER ENRIQUECIDO + GRABADORA
   ══════════════════════════════════════════════════════════════════ */

const COMMON_EMOJIS = [
  "👍","🙏","🙌","🎉","❤️","🔥","✨","✅",
  "👋","😊","😂","😍","🤔","🙂","😉","😎",
  "💪","💯","📍","📅","📞","💬","📎","📷",
];

const TEMPLATES = [
  { name: "Confirmación de visita", body: "¡Hola! Te confirmo tu visita programada. Cualquier cambio, avísanos por aquí." },
  { name: "Recordatorio 24h",       body: "Te recuerdo nuestra visita prevista para mañana. ¿Sigue todo confirmado?" },
  { name: "Bienvenida",             body: "¡Bienvenido a Byvaro! Estamos aquí para ayudarte con cualquier duda sobre la promoción." },
  { name: "Solicitar documentación", body: "Para avanzar con tu reserva, ¿podrías enviarnos copia del DNI y un justificante de ingresos?" },
  { name: "Cierre de operación",    body: "¡Felicidades! Tu reserva ha quedado registrada. En breve recibirás los siguientes pasos por email." },
];

type ComposerProps = {
  draft: string;
  setDraft: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onStartRecording: () => void;
  onInsertEmoji: (e: string) => void;
  onSendImage: () => void;
  onSendDocument: () => void;
  onSendLocation: () => void;
  onSendContact: () => void;
  onUseTemplate: (name: string, body: string) => void;
  user: { id: string; name: string };
  isBusinessApi: boolean;
};

function ComposerBar(p: ComposerProps) {
  const hasDraft = p.draft.trim().length > 0;

  return (
    <div className="px-3 py-2.5">
      {/* Una sola fila: + · pill (texto + emoji) · mic / send */}
      <div className="flex items-center gap-2">

        {/* Botón "+" a la izquierda — abre menú de adjuntos + plantillas */}
        <PlusMenu
          onImage={p.onSendImage}
          onDocument={p.onSendDocument}
          onLocation={p.onSendLocation}
          onContact={p.onSendContact}
          onUseTemplate={p.isBusinessApi ? p.onUseTemplate : undefined}
        />

        {/* Pill grande con textarea + emoji dentro */}
        <div className="flex-1 min-w-0 relative">
          <textarea
            value={p.draft}
            onChange={(e) => p.setDraft(e.target.value)}
            onKeyDown={p.onKeyDown}
            placeholder={`Mensaje · firmas como ${p.user.name.split(" ")[0]}`}
            rows={1}
            className="w-full resize-none pl-4 pr-10 py-2.5 text-sm rounded-full border border-border bg-card outline-none focus:border-primary max-h-32 leading-snug"
          />
          {/* Emoji dentro de la pill, alineado a la derecha */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <EmojiMenu onPick={p.onInsertEmoji} />
          </div>
        </div>

        {/* Mic si no hay draft, Send si hay draft */}
        {hasDraft ? (
          <Button onClick={p.onSend} size="icon" className="h-10 w-10 rounded-full shrink-0" title="Enviar" aria-label="Enviar">
            <Send className="h-4 w-4" />
          </Button>
        ) : (
          <button
            onClick={p.onStartRecording}
            className="h-10 w-10 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
            title="Grabar mensaje de voz"
            aria-label="Grabar mensaje de voz"
          >
            <Mic className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/** Menú agrupado tras el botón "+": adjuntos + tarjeta + plantillas. */
function PlusMenu({
  onImage, onDocument, onLocation, onContact, onUseTemplate,
}: {
  onImage: () => void; onDocument: () => void; onLocation: () => void; onContact: () => void;
  /** Solo aparece si el workspace está en Business API. */
  onUseTemplate?: (name: string, body: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="h-10 w-10 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          title="Adjuntar y más"
          aria-label="Adjuntar y más"
        >
          <Plus className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-[220px] p-1.5 rounded-xl border-border shadow-soft-lg">
        <AttachItem icon={ImageIcon} label="Foto o vídeo" onClick={() => { onImage(); close(); }} />
        <AttachItem icon={FileText} label="Documento" onClick={() => { onDocument(); close(); }} />
        <AttachItem icon={MapPin} label="Ubicación" onClick={() => { onLocation(); close(); }} />
        <AttachItem icon={UserIcon} label="Tarjeta de contacto" onClick={() => { onContact(); close(); }} />
        {onUseTemplate && (
          <>
            <div className="h-px bg-border/60 my-1" />
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70 px-3 py-1.5">
              Plantillas aprobadas
            </p>
            <div className="max-h-[180px] overflow-y-auto">
              {TEMPLATES.map((t) => (
                <button
                  key={t.name}
                  onClick={() => { onUseTemplate(t.name, t.body); close(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs text-foreground hover:bg-muted/40 transition-colors text-left"
                >
                  <FileType2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{t.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

function AttachItem({
  icon: Icon, label, onClick,
}: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-md text-xs text-foreground hover:bg-muted/40 transition-colors"
    >
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      {label}
    </button>
  );
}

function EmojiMenu({ onPick }: { onPick: (e: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="h-7 w-7 rounded-full grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Emoji"
          aria-label="Emoji"
        >
          <Smile className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-[260px] p-2 rounded-xl border-border shadow-soft-lg">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2 px-1">
          Emojis frecuentes
        </p>
        <div className="grid grid-cols-8 gap-0.5">
          {COMMON_EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => onPick(e)}
              className="h-7 w-7 grid place-items-center rounded-md hover:bg-muted text-base transition-colors"
            >
              {e}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Composer bloqueado — aparece cuando el usuario está viendo la
 *  conversación de OTRO agente. No se puede escribir como otro. */
function ReadOnlyComposerBar({
  agentName, onClearFilter,
}: { agentName: string; onClearFilter: () => void }) {
  return (
    <div className="px-4 py-3 flex items-center gap-3 bg-muted/40">
      <div className="h-9 w-9 rounded-full bg-muted text-muted-foreground grid place-items-center shrink-0">
        <UserIcon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground truncate">
          Modo lectura · viendo conversación de {agentName}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Solo puedes escribir como tú. Cambia a "Toda la conversación" para enviar mensajes.
        </p>
      </div>
      <Button onClick={onClearFilter} variant="outline" size="sm" className="rounded-full shrink-0">
        Volver a mi chat
      </Button>
    </div>
  );
}

function RecordingBar({
  seconds, onCancel, onSend,
}: { seconds: number; onCancel: () => void; onSend: () => void }) {
  return (
    <div className="p-3 flex items-center gap-3">
      <button
        onClick={onCancel}
        className="h-9 w-9 rounded-full grid place-items-center bg-muted text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
        title="Cancelar grabación"
        aria-label="Cancelar grabación"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex-1 min-w-0 flex items-center gap-3 px-3 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30">
        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
        <p className="text-xs font-medium text-foreground tnum shrink-0">
          {formatDuration(seconds)}
        </p>
        {/* Waveform mock — barras animadas */}
        <div className="flex-1 flex items-center gap-0.5 h-5">
          {Array.from({ length: 32 }).map((_, i) => (
            <span
              key={i}
              className="flex-1 bg-emerald-500/60 rounded-full"
              style={{
                height: `${20 + Math.abs(Math.sin((i + seconds) * 0.5)) * 80}%`,
                opacity: i > (seconds % 32) ? 0.3 : 1,
              }}
            />
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline">Grabando…</p>
      </div>

      <button
        onClick={onSend}
        className="h-9 w-9 rounded-full grid place-items-center bg-foreground text-background hover:bg-foreground/90 transition-colors shrink-0"
        title="Enviar mensaje de voz"
        aria-label="Enviar mensaje de voz"
      >
        <Square className="h-3 w-3 fill-current" />
      </button>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ══════ Bubble + helpers ══════ */

/** Avatar del cliente (foto real cuando exista, fallback iniciales + bandera). */
function ContactAvatar({ name, flag, size = 40 }: { name: string; flag?: string; size?: number }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";
  return (
    <div
      className="rounded-full bg-foreground/10 grid place-items-center text-foreground font-semibold shrink-0 relative overflow-hidden"
      style={{ width: size, height: size, fontSize: size / 2.8 }}
    >
      {/* TODO(backend): cuando el modelo tenga `avatarUrl`, reemplazar
       *  iniciales por <img src={avatarUrl} className="w-full h-full object-cover" /> */}
      <span>{initials}</span>
      {flag && (
        <span
          className="absolute -bottom-0.5 -right-0.5 rounded-full bg-card border border-border/60 grid place-items-center"
          style={{ width: size * 0.45, height: size * 0.45, fontSize: size * 0.32 }}
        >
          {flag}
        </span>
      )}
    </div>
  );
}

function Bubble({ msg, isMine }: { msg: WhatsAppMessage; isMine: boolean }) {
  const time = new Date(msg.timestamp).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const incoming = msg.direction === "incoming";

  return (
    <div className={cn("flex", incoming ? "justify-start" : "justify-end")}>
      <div className={cn(
        "max-w-[78%] sm:max-w-[60%] rounded-2xl px-3 py-2 shadow-soft",
        incoming
          ? "bg-card border border-border/40 rounded-tl-sm"
          : isMine
            ? "bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/60 rounded-tr-sm"
            : "bg-foreground/5 border border-border/40 rounded-tr-sm",
      )}>
        {/* Firma del agente (solo outgoing) */}
        {!incoming && msg.authorName && (
          <p className={cn(
            "text-[10px] font-semibold mb-0.5",
            isMine ? "text-emerald-700 dark:text-emerald-400" : "text-foreground/70",
          )}>
            {msg.authorName}{isMine && " · tú"}
          </p>
        )}

        {/* Cuerpo según tipo */}
        <BubbleContent msg={msg} />

        <div className="flex items-center justify-end gap-1 mt-0.5">
          <p className="text-[10px] text-muted-foreground/70 tnum">{time}</p>
          {!incoming && msg.read && <CheckCheck className="h-3 w-3 text-emerald-600" />}
        </div>
      </div>
    </div>
  );
}

function BubbleContent({ msg }: { msg: WhatsAppMessage }) {
  const kind = msg.kind ?? "text";

  if (kind === "voice") {
    const dur = Number(msg.meta?.durationSec ?? 0);
    return (
      <div className="flex items-center gap-2 min-w-[180px] py-1">
        <button className="h-8 w-8 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 grid place-items-center shrink-0">
          <Mic className="h-3.5 w-3.5" />
        </button>
        <div className="flex-1 flex items-center gap-0.5 h-5">
          {Array.from({ length: 24 }).map((_, i) => (
            <span
              key={i}
              className="flex-1 bg-emerald-500/40 rounded-full"
              style={{ height: `${30 + Math.abs(Math.sin((i + 1) * 0.7)) * 70}%` }}
            />
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground tnum shrink-0">
          {Math.floor(dur / 60)}:{String(dur % 60).padStart(2, "0")}
        </p>
      </div>
    );
  }

  if (kind === "image") {
    const dataUrl = msg.meta?.dataUrl as string | undefined;
    return (
      <div>
        {dataUrl ? (
          <a href={dataUrl} target="_blank" rel="noreferrer" className="block">
            <img
              src={dataUrl}
              alt={String(msg.meta?.fileName ?? "imagen")}
              className="rounded-xl max-w-[260px] max-h-[260px] object-cover hover:opacity-90 transition-opacity cursor-zoom-in"
            />
          </a>
        ) : (
          <div className="h-32 w-48 rounded-xl bg-gradient-to-br from-foreground/10 via-foreground/5 to-foreground/15 grid place-items-center text-muted-foreground">
            <ImageIcon className="h-6 w-6" />
          </div>
        )}
        <p className="text-[10px] text-muted-foreground tnum mt-1.5">
          {msg.meta?.fileName ?? "imagen.jpg"}
          {msg.meta?.sizeKb && ` · ${msg.meta.sizeKb} KB`}
        </p>
        {msg.text && <p className="text-sm text-foreground whitespace-pre-wrap break-words mt-1">{msg.text}</p>}
      </div>
    );
  }

  if (kind === "document") {
    return (
      <a className="flex items-center gap-2 min-w-[200px] py-1 cursor-pointer hover:opacity-80">
        <span className="h-9 w-9 rounded-xl bg-foreground/10 grid place-items-center text-foreground shrink-0">
          <FileText className="h-4 w-4" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">{msg.meta?.fileName ?? "documento.pdf"}</p>
          <p className="text-[10px] text-muted-foreground tnum">{msg.meta?.sizeKb ?? 0} KB · PDF</p>
        </div>
      </a>
    );
  }

  if (kind === "location") {
    return (
      <div>
        <div className="h-24 w-48 rounded-xl bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-emerald-500/30 grid place-items-center text-emerald-700 dark:text-emerald-400 mb-1">
          <MapPin className="h-5 w-5" />
        </div>
        <p className="text-xs font-semibold text-foreground">{msg.meta?.label ?? "Ubicación"}</p>
        <p className="text-[10px] text-muted-foreground tnum">
          {msg.meta?.lat}, {msg.meta?.lng}
        </p>
      </div>
    );
  }

  if (kind === "contact") {
    return (
      <div className="flex items-center gap-2 min-w-[200px]">
        <span className="h-9 w-9 rounded-full bg-foreground/10 grid place-items-center text-foreground shrink-0">
          <UserIcon className="h-4 w-4" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">{msg.meta?.contactName}</p>
          <p className="text-[10px] text-muted-foreground tnum truncate">{msg.meta?.phone}</p>
        </div>
      </div>
    );
  }

  if (kind === "template") {
    return (
      <div>
        <p className="text-[9px] uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-400 mb-0.5 inline-flex items-center gap-1">
          <Sparkles className="h-2.5 w-2.5" /> Plantilla · {msg.meta?.templateName}
        </p>
        <p className="text-sm text-foreground whitespace-pre-wrap break-words">{msg.text}</p>
      </div>
    );
  }

  /* default: text */
  return <p className="text-sm text-foreground whitespace-pre-wrap break-words">{msg.text}</p>;
}

function sameDay(a: string, b: string): boolean {
  const da = new Date(a); const db = new Date(b);
  return da.getFullYear() === db.getFullYear() &&
         da.getMonth() === db.getMonth() &&
         da.getDate() === db.getDate();
}

function formatDateSep(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (sameDay(iso, today.toISOString())) return "Hoy";
  if (sameDay(iso, yesterday.toISOString())) return "Ayer";
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}
