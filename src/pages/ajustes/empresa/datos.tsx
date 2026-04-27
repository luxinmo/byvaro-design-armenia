/**
 * /ajustes/empresa/datos — Datos fiscales y de contacto de la empresa.
 *
 * Cabecera con identidad compacta: nombre comercial + tik azul de
 * verificación (estilo Instagram/X) · CIF pequeño debajo. El tik solo
 * aparece si `empresa.verificada === true` (validado por Byvaro ·
 * ver `/ajustes/empresa/verificacion`).
 *
 * IMPORTANTE · fuente única de verdad:
 *   Esta pantalla escribe SIEMPRE en el store canónico `useEmpresa()`
 *   (key `byvaro-empresa`). Antes existía un `OrgProfile` paralelo con
 *   key propia · al ser un store separado, los cambios no se veían en
 *   la vista pública del promotor desde la cuenta de la agencia (ni en
 *   `getPromoterDisplayName()`). Si añades un campo nuevo, conéctalo al
 *   shape `Empresa` y al hook · NO crees stores paralelos.
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

type FormState = {
  razonSocial: string;
  nombreComercial: string;
  cif: string;
  email: string;
  telefono: string;
  sitioWeb: string;
  direccion: string;
  ciudad: string;
  codigoPostal: string;
  pais: string;
};

function fromEmpresa(e: ReturnType<typeof useEmpresa>["empresa"]): FormState {
  return {
    razonSocial: e.razonSocial,
    nombreComercial: e.nombreComercial,
    cif: e.cif,
    email: e.email,
    telefono: e.telefono,
    sitioWeb: e.sitioWeb,
    direccion: e.direccionFiscal.direccion,
    ciudad: e.direccionFiscal.ciudad,
    codigoPostal: e.direccionFiscal.codigoPostal,
    pais: e.direccionFiscal.pais,
  };
}

export default function AjustesEmpresaDatos() {
  const user = useCurrentUser();
  const canEdit = isAdmin(user);
  const { empresa, patch } = useEmpresa();
  const [data, setData] = useState<FormState>(() => fromEmpresa(empresa));
  const [initial, setInitial] = useState<FormState>(data);
  const { setDirty } = useDirty();

  // Si la empresa cambia desde otra fuente (otro tab, otra pantalla),
  // resincroniza el formulario sólo si el usuario no tiene cambios sin
  // guardar · evita pisarle el trabajo en curso.
  useEffect(() => {
    if (JSON.stringify(data) === JSON.stringify(initial)) {
      const next = fromEmpresa(empresa);
      setData(next);
      setInitial(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa]);

  useEffect(() => { setDirty(JSON.stringify(data) !== JSON.stringify(initial)); }, [data, initial, setDirty]);
  const isDirty = JSON.stringify(data) !== JSON.stringify(initial);

  const save = () => {
    if (!canEdit) { toast.error("Solo los administradores pueden editar"); return; }
    patch({
      razonSocial: data.razonSocial,
      nombreComercial: data.nombreComercial,
      cif: data.cif,
      email: data.email,
      telefono: data.telefono,
      sitioWeb: data.sitioWeb,
      direccionFiscal: {
        ...empresa.direccionFiscal,
        direccion: data.direccion,
        ciudad: data.ciudad,
        codigoPostal: data.codigoPostal,
        pais: data.pais,
      },
    });
    setInitial(data);
    setDirty(false);
    toast.success("Datos de la empresa guardados");
  };

  const set = (p: Partial<FormState>) => setData((d) => ({ ...d, ...p }));

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
                {data.nombreComercial || data.razonSocial || "Tu empresa"}
              </h2>
              {empresa.verificada && <VerifiedBadge size="md" />}
            </div>
            <p className="text-[11.5px] text-muted-foreground mt-0.5 tabular-nums">
              {data.cif ? `Nº de registro · ${data.cif}` : "Sin CIF / NIF configurado"}
            </p>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Identidad fiscal">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SettingsField label="Razón social"><Input value={data.razonSocial} onChange={(e) => set({ razonSocial: e.target.value })} disabled={!canEdit} /></SettingsField>
          <SettingsField label="Nombre comercial"><Input value={data.nombreComercial} onChange={(e) => set({ nombreComercial: e.target.value })} disabled={!canEdit} /></SettingsField>
          <SettingsField label="CIF / NIF"><Input value={data.cif} onChange={(e) => set({ cif: e.target.value })} disabled={!canEdit} /></SettingsField>
        </div>
      </SettingsCard>

      <SettingsCard title="Contacto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SettingsField label="Email corporativo"><Input type="email" value={data.email} onChange={(e) => set({ email: e.target.value })} disabled={!canEdit} /></SettingsField>
          <SettingsField label="Teléfono"><Input value={data.telefono} onChange={(e) => set({ telefono: e.target.value })} disabled={!canEdit} /></SettingsField>
          <SettingsField label="Web" htmlFor="web">
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input id="web" value={data.sitioWeb} onChange={(e) => set({ sitioWeb: e.target.value })} className="pl-9" disabled={!canEdit} />
            </div>
          </SettingsField>
        </div>
      </SettingsCard>

      <SettingsCard title="Dirección fiscal">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SettingsField label="Dirección" htmlFor="addr">
            <Input id="addr" value={data.direccion} onChange={(e) => set({ direccion: e.target.value })} disabled={!canEdit} />
          </SettingsField>
          <SettingsField label="Ciudad"><Input value={data.ciudad} onChange={(e) => set({ ciudad: e.target.value })} disabled={!canEdit} /></SettingsField>
          <SettingsField label="Código postal"><Input value={data.codigoPostal} onChange={(e) => set({ codigoPostal: e.target.value })} disabled={!canEdit} /></SettingsField>
          <SettingsField label="País"><Input value={data.pais} onChange={(e) => set({ pais: e.target.value })} disabled={!canEdit} /></SettingsField>
        </div>
      </SettingsCard>
    </SettingsScreen>
  );
}
