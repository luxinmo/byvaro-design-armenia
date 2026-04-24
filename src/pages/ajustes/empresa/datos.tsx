/**
 * /ajustes/empresa/datos — Datos fiscales y de contacto de la empresa.
 *
 * Cabecera con identidad compacta: nombre comercial + tik azul de
 * verificación (estilo Instagram/X) · CIF pequeño debajo. El tik solo
 * aparece si `empresa.verificada === true` (validado por Byvaro ·
 * ver `/ajustes/empresa/verificacion`).
 */

import { useEffect, useState } from "react";
import { Globe } from "lucide-react";
import { SettingsScreen, SettingsCard } from "@/components/settings/SettingsScreen";
import { SettingsField } from "@/components/settings/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDirty } from "@/components/settings/SettingsDirtyContext";
import { isAdmin, useCurrentUser } from "@/lib/currentUser";
import { useEmpresa } from "@/lib/empresa";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { toast } from "sonner";

const KEY = "byvaro.organization.profile.v1";

type OrgProfile = {
  legalName: string;
  commercialName: string;
  taxId: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
};

const DEFAULT: OrgProfile = {
  legalName: "Luxinmo Real Estate S.L.",
  commercialName: "Luxinmo",
  taxId: "B12345678",
  email: "info@luxinmo.com",
  phone: "+34 952 000 000",
  website: "https://luxinmo.com",
  address: "Calle Real 25",
  city: "Marbella",
  postalCode: "29602",
  country: "España",
};

function load(): OrgProfile {
  if (typeof window === "undefined") return DEFAULT;
  try { return { ...DEFAULT, ...JSON.parse(window.localStorage.getItem(KEY) ?? "{}") }; }
  catch { return DEFAULT; }
}

export default function AjustesEmpresaDatos() {
  const user = useCurrentUser();
  const canEdit = isAdmin(user);
  const [data, setData] = useState<OrgProfile>(() => load());
  const [initial, setInitial] = useState(data);
  const { setDirty } = useDirty();
  const { empresa } = useEmpresa();

  useEffect(() => { setDirty(JSON.stringify(data) !== JSON.stringify(initial)); }, [data, initial, setDirty]);
  const isDirty = JSON.stringify(data) !== JSON.stringify(initial);

  const save = () => {
    if (!canEdit) { toast.error("Solo los administradores pueden editar"); return; }
    window.localStorage.setItem(KEY, JSON.stringify(data));
    setInitial(data);
    setDirty(false);
    toast.success("Datos de la empresa guardados");
  };

  const set = (patch: Partial<OrgProfile>) => setData((d) => ({ ...d, ...patch }));

  return (
    <SettingsScreen
      title="Datos de la empresa"
      description={canEdit ? "Información fiscal y de contacto de tu organización." : "Solo los administradores pueden editar estos datos."}
      actions={
        <Button onClick={save} disabled={!isDirty || !canEdit} className="rounded-full" size="sm">
          Guardar cambios
        </Button>
      }
    >
      {/* Identidad compacta · nombre comercial + tik azul si verificada
          + número de registro pequeño. Estilo Instagram/X. */}
      <SettingsCard>
        <div className="flex items-center gap-2.5 -my-1">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="text-[17px] sm:text-[19px] font-bold text-foreground tracking-tight truncate">
                {data.commercialName || data.legalName || "Tu empresa"}
              </h2>
              {empresa.verificada && <VerifiedBadge size="md" />}
            </div>
            <p className="text-[11.5px] text-muted-foreground mt-0.5 tabular-nums">
              {data.taxId ? `Nº de registro · ${data.taxId}` : "Sin CIF / NIF configurado"}
            </p>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Identidad fiscal">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SettingsField label="Razón social"><Input value={data.legalName} onChange={(e) => set({ legalName: e.target.value })} disabled={!canEdit} /></SettingsField>
          <SettingsField label="Nombre comercial"><Input value={data.commercialName} onChange={(e) => set({ commercialName: e.target.value })} disabled={!canEdit} /></SettingsField>
          <SettingsField label="CIF / NIF"><Input value={data.taxId} onChange={(e) => set({ taxId: e.target.value })} disabled={!canEdit} /></SettingsField>
        </div>
      </SettingsCard>

      <SettingsCard title="Contacto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SettingsField label="Email corporativo"><Input type="email" value={data.email} onChange={(e) => set({ email: e.target.value })} disabled={!canEdit} /></SettingsField>
          <SettingsField label="Teléfono"><Input value={data.phone} onChange={(e) => set({ phone: e.target.value })} disabled={!canEdit} /></SettingsField>
          <SettingsField label="Web" htmlFor="web">
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input id="web" value={data.website} onChange={(e) => set({ website: e.target.value })} className="pl-9" disabled={!canEdit} />
            </div>
          </SettingsField>
        </div>
      </SettingsCard>

      <SettingsCard title="Dirección fiscal">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SettingsField label="Dirección" htmlFor="addr">
            <Input id="addr" value={data.address} onChange={(e) => set({ address: e.target.value })} disabled={!canEdit} />
          </SettingsField>
          <SettingsField label="Ciudad"><Input value={data.city} onChange={(e) => set({ city: e.target.value })} disabled={!canEdit} /></SettingsField>
          <SettingsField label="Código postal"><Input value={data.postalCode} onChange={(e) => set({ postalCode: e.target.value })} disabled={!canEdit} /></SettingsField>
          <SettingsField label="País"><Input value={data.country} onChange={(e) => set({ country: e.target.value })} disabled={!canEdit} /></SettingsField>
        </div>
      </SettingsCard>
    </SettingsScreen>
  );
}
