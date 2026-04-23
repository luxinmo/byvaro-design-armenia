/**
 * /ajustes/whatsapp/numero — Configuración del canal de WhatsApp del
 * workspace.
 *
 * El canal se comparte: una sola configuración para todo el equipo.
 * Los agentes interactúan con clientes a través de él, firmando con
 * su propia identidad. Solo usuarios con permiso `whatsapp.manageChannel`
 * (admins por defecto) pueden conectar/desconectar.
 *
 * TODO(backend) — endpoints reales:
 *   POST /api/workspace/whatsapp/setup    { method, ... }   → crea
 *   GET  /api/workspace/whatsapp                            → estado
 *   POST /api/workspace/whatsapp/disconnect                 → reset
 *   POST /api/workspace/whatsapp/test     { to }            → ping
 */

import { useState } from "react";
import {
  MessageCircle, Building2, Smartphone, AlertCircle, CheckCircle2,
  ArrowLeft, Sparkles, Lock,
} from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  loadWhatsAppSetup, saveWhatsAppSetup, clearWhatsAppSetup,
  type WhatsAppMethod, type WhatsAppSetup,
} from "@/lib/whatsappStorage";
import { useHasPermission } from "@/lib/permissions";

export default function AjustesWhatsAppNumero() {
  const canManage = useHasPermission("whatsapp.manageChannel");
  const [setup, setSetup] = useState<WhatsAppSetup | null>(() => loadWhatsAppSetup());
  const [method, setMethod] = useState<WhatsAppMethod | null>(null);
  const confirm = useConfirm();

  const onConnected = (s: WhatsAppSetup) => {
    saveWhatsAppSetup(s);
    setSetup(s);
    setMethod(null);
    toast.success(`WhatsApp conectado vía ${s.method === "businessApi" ? "Business API" : "WhatsApp Web"}`);
  };

  const disconnect = async () => {
    const ok = await confirm({
      title: "¿Desconectar WhatsApp del workspace?",
      description: "Todo el equipo dejará de poder enviar y recibir mensajes desde Byvaro hasta que vuelvas a conectar el canal. Las conversaciones guardadas se mantienen.",
      confirmLabel: "Desconectar",
      variant: "destructive",
    });
    if (!ok) return;
    clearWhatsAppSetup();
    setSetup(null);
    toast.info("WhatsApp desconectado");
  };

  return (
    <SettingsScreen
      title="Número vinculado"
      description="Conecta el canal de WhatsApp del workspace. Una sola configuración compartida por todo el equipo: cada agente escribe firmando con su nombre."
    >
      {!canManage && (
        <SettingsCard>
          <div className="flex items-start gap-3">
            <Lock className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-[12.5px] text-muted-foreground leading-relaxed">
              <p className="text-foreground font-semibold mb-0.5">Modo lectura</p>
              Tu rol no puede modificar la configuración del canal. Pide a un administrador que lo gestione.
            </div>
          </div>
        </SettingsCard>
      )}

      {/* ══════ Estado actual ══════ */}
      {setup && (
        <SettingsCard
          title="Canal conectado"
          description={`Conectado el ${new Date(setup.connectedAt).toLocaleString("es-ES")}.`}
          footer={canManage ? (
            <div className="flex justify-end">
              <Button
                onClick={disconnect}
                variant="outline"
                size="sm"
                className="rounded-full text-destructive hover:text-destructive hover:bg-destructive/5 border-destructive/30"
              >
                Desconectar WhatsApp
              </Button>
            </div>
          ) : undefined}
        >
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-success/15 text-success dark:text-success grid place-items-center shrink-0">
              {setup.method === "businessApi" ? <Building2 className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground inline-flex items-center gap-2 flex-wrap">
                {setup.method === "businessApi" ? "WhatsApp Business API" : "WhatsApp Web"}
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold bg-success/15 text-success dark:text-success rounded-full px-2 py-0.5">
                  <CheckCircle2 className="h-2.5 w-2.5" /> Conectado
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {setup.method === "businessApi"
                  ? <>Número: <strong className="text-foreground tnum">{setup.businessNumber}</strong></>
                  : <>Dispositivo: <strong className="text-foreground">{setup.displayName}</strong></>}
              </p>
              <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                Todos los miembros del equipo con permiso pueden enviar y recibir mensajes desde la ficha de cualquier contacto. La identidad del agente queda registrada en cada mensaje.
              </p>
            </div>
          </div>
        </SettingsCard>
      )}

      {/* ══════ Selector de método ══════ */}
      {!setup && canManage && !method && (
        <SettingsCard
          title="Elige cómo conectar"
          description="Recomendamos Business API para equipos: número dedicado, sin teléfono físico y multi-usuario desde el primer día."
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <MethodCard
              icon={Building2}
              title="WhatsApp Business API"
              recommended
              description="API oficial de Meta. Número dedicado de empresa."
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
              description="Vincula un teléfono escaneando un QR."
              bullets={[
                "Setup en 30 segundos",
                "Limitado a 1 dispositivo",
                "Sin métricas oficiales",
              ]}
              onClick={() => setMethod("web")}
            />
          </div>
        </SettingsCard>
      )}

      {/* ══════ Wizard ══════ */}
      {!setup && method === "businessApi" && (
        <BusinessApiWizard onCancel={() => setMethod(null)} onConnected={onConnected} />
      )}
      {!setup && method === "web" && (
        <WebQrWizard onCancel={() => setMethod(null)} onConnected={onConnected} />
      )}

      {/* ══════ Aviso si no hay setup y no es admin ══════ */}
      {!setup && !canManage && (
        <SettingsCard>
          <div className="text-center py-6">
            <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm font-semibold text-foreground">WhatsApp aún no está configurado</p>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-md mx-auto leading-relaxed">
              Pídele a un administrador que conecte el canal de WhatsApp del workspace.
            </p>
          </div>
        </SettingsCard>
      )}
    </SettingsScreen>
  );
}

/* ══════ Sub-componentes ══════ */

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
      className="text-left bg-card border border-border rounded-2xl p-5 hover:border-foreground/40 hover:shadow-soft-lg hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="h-11 w-11 rounded-xl bg-foreground/5 grid place-items-center text-foreground shrink-0">
          <Icon className="h-5 w-5" />
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

function BusinessApiWizard({
  onCancel, onConnected,
}: { onCancel: () => void; onConnected: (s: WhatsAppSetup) => void }) {
  const [businessNumber, setBusinessNumber] = useState("");
  return (
    <SettingsCard
      title="WhatsApp Business API"
      description="Necesitas un número dedicado (no usado en WhatsApp normal) y una cuenta de Meta Business Manager."
    >
      <div className="space-y-4">
        {/* TODO(backend): activación real con OAuth Meta + verify SMS. */}
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
          <Button variant="ghost" size="sm" className="rounded-full" onClick={onCancel}>
            <ArrowLeft className="h-3 w-3" /> Atrás
          </Button>
          <Button
            size="sm"
            className="rounded-full"
            disabled={!businessNumber.trim()}
            onClick={() => onConnected({
              method: "businessApi",
              connectedAt: new Date().toISOString(),
              businessNumber: businessNumber.trim(),
              displayName: "WhatsApp Business",
            })}
          >
            Conectar
          </Button>
        </div>
      </div>
    </SettingsCard>
  );
}

function WebQrWizard({
  onCancel, onConnected,
}: { onCancel: () => void; onConnected: (s: WhatsAppSetup) => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [deviceName, setDeviceName] = useState("");
  return (
    <SettingsCard
      title="WhatsApp Web"
      description="Abre WhatsApp en tu móvil → Configuración → Dispositivos vinculados → Vincular un dispositivo, y escanea este código."
    >
      {/* TODO(backend): generación real del QR contra Baileys / wppconnect. */}
      {step === 1 ? (
        <>
          <div className="bg-white p-3 rounded-2xl border border-border/40 mx-auto w-fit">
            <div className="h-[200px] w-[200px] grid grid-cols-12 gap-px bg-white">
              {Array.from({ length: 144 }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-full w-full",
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
            <Button variant="ghost" size="sm" className="rounded-full" onClick={onCancel}>
              <ArrowLeft className="h-3 w-3" /> Atrás
            </Button>
            <Button size="sm" className="rounded-full" onClick={() => setStep(2)}>Ya he escaneado</Button>
          </div>
        </>
      ) : (
        <div className="text-center py-2">
          <div className="h-12 w-12 mx-auto rounded-2xl bg-success/15 grid place-items-center mb-3">
            <Sparkles className="h-5 w-5 text-success" />
          </div>
          <p className="text-sm font-semibold text-foreground">¿Cómo quieres llamar a este dispositivo?</p>
          <input
            autoFocus
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            placeholder="Ej. iPhone de Arman"
            className="mt-3 w-64 h-9 px-3 text-sm rounded-xl border border-border bg-card outline-none focus:border-primary mx-auto block"
          />
          <div className="flex justify-center gap-2 pt-4">
            <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setStep(1)}>Atrás</Button>
            <Button
              size="sm"
              className="rounded-full"
              disabled={!deviceName.trim()}
              onClick={() => onConnected({
                method: "web",
                connectedAt: new Date().toISOString(),
                displayName: deviceName.trim(),
              })}
            >
              Conectar
            </Button>
          </div>
        </div>
      )}
    </SettingsCard>
  );
}
