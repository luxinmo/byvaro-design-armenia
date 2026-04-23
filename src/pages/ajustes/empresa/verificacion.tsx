/**
 * /ajustes/empresa/verificacion — Estado de verificación legal.
 * Mock: muestra estado pending/verified, lista documentos requeridos.
 */

import { useEffect, useState } from "react";
import { Check, Clock, Upload, FileText, ShieldCheck } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { Button } from "@/components/ui/button";
import { useDirty } from "@/components/settings/SettingsDirtyContext";
import { isAdmin, useCurrentUser } from "@/lib/currentUser";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const KEY = "byvaro.organization.verification.v1";

type DocStatus = "pending" | "uploaded" | "verified";
type State = {
  cif: DocStatus;
  realEstateLicense: DocStatus;
  insurance: DocStatus;
  bankAccount: DocStatus;
};

const DEFAULT: State = { cif: "verified", realEstateLicense: "uploaded", insurance: "pending", bankAccount: "verified" };

const STATUS_META: Record<DocStatus, { label: string; cls: string; icon: typeof Check }> = {
  pending: { label: "Pendiente", cls: "bg-muted text-muted-foreground", icon: Clock },
  uploaded: { label: "En revisión", cls: "bg-warning/15 text-warning", icon: Clock },
  verified: { label: "Verificado", cls: "bg-success/15 text-success", icon: Check },
};

const DOCS = [
  { key: "cif" as const, label: "CIF / NIF de la empresa", required: true },
  { key: "realEstateLicense" as const, label: "Licencia de actividad inmobiliaria", required: true },
  { key: "insurance" as const, label: "Seguro de responsabilidad civil", required: true },
  { key: "bankAccount" as const, label: "Certificado de titularidad bancaria", required: false },
];

function load(): State {
  if (typeof window === "undefined") return DEFAULT;
  try { return { ...DEFAULT, ...JSON.parse(window.localStorage.getItem(KEY) ?? "{}") }; }
  catch { return DEFAULT; }
}

export default function AjustesEmpresaVerificacion() {
  const user = useCurrentUser();
  const canEdit = isAdmin(user);
  const [state, setState] = useState<State>(() => load());
  const [initial, setInitial] = useState(state);
  const { setDirty } = useDirty();

  useEffect(() => { setDirty(JSON.stringify(state) !== JSON.stringify(initial)); }, [state, initial, setDirty]);

  const allVerified = Object.values(state).every((s) => s === "verified" || s === "uploaded");
  const verifiedCount = Object.values(state).filter((s) => s === "verified").length;

  const upload = (key: keyof State) => {
    setState((s) => ({ ...s, [key]: "uploaded" }));
    toast.success("Documento subido · te avisaremos cuando se verifique");
  };
  const save = () => {
    if (!canEdit) return;
    window.localStorage.setItem(KEY, JSON.stringify(state));
    setInitial(state);
    setDirty(false);
    toast.success("Cambios guardados");
  };

  return (
    <SettingsScreen
      title="Verificación de empresa"
      description="Subir estos documentos te da el badge 'Verificado' en el marketplace y desbloquea funciones avanzadas (firma electrónica, pasarela de pagos)."
      actions={<Button onClick={save} disabled={JSON.stringify(state) === JSON.stringify(initial) || !canEdit} className="rounded-full" size="sm">Guardar</Button>}
    >
      <SettingsCard>
        <div className="flex items-start gap-4">
          <div className={cn("h-12 w-12 rounded-2xl grid place-items-center shrink-0",
            allVerified ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              {allVerified ? "Empresa verificada" : `${verifiedCount} de ${DOCS.length} documentos verificados`}
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              {allVerified
                ? "Tienes acceso a todas las funciones avanzadas de Byvaro."
                : "Sube los documentos pendientes para completar la verificación. Tarda 1-2 días hábiles."}
            </p>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Documentos requeridos">
        <div className="divide-y divide-border/40 -my-3">
          {DOCS.map((doc) => {
            const status = state[doc.key];
            const meta = STATUS_META[status];
            const Icon = meta.icon;
            return (
              <div key={doc.key} className="py-3 flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-muted text-muted-foreground grid place-items-center shrink-0">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">
                    {doc.label}
                    {!doc.required && <span className="text-xs text-muted-foreground ml-1">(opcional)</span>}
                  </p>
                </div>
                <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full", meta.cls)}>
                  <Icon className="h-3 w-3" />
                  {meta.label}
                </span>
                {status !== "verified" && canEdit && (
                  <Button variant="ghost" size="sm" onClick={() => upload(doc.key)} className="rounded-full">
                    <Upload className="h-3.5 w-3.5" />
                    Subir
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </SettingsCard>
    </SettingsScreen>
  );
}
