/**
 * DeveloperDatosTab · "Datos" del panel de promotor visto por la
 * agencia. Mirror de `DatosTab.tsx` (que muestra los datos de la
 * agencia desde el lado promotor) pero al revés · ahora la agencia
 * lee los datos del PROMOTOR.
 *
 * Reutiliza los primitives `Section`, `DataGrid`, `DataField`
 * exportados desde `DatosTab.tsx` para mantener idéntico look.
 */

import { useMemo } from "react";
import { Building2, Phone, MapPin, Globe } from "lucide-react";
import type { Empresa } from "@/lib/empresa";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { Section, DataGrid, DataField } from "./DatosTab";

export function DeveloperDatosTab({ empresa }: { empresa: Empresa }) {
  const fullAddress = useMemo(() => {
    const d = empresa.direccionFiscal;
    if (!d) return "";
    if (d.direccion?.trim()) return [d.direccion, d.codigoPostal, d.ciudad, d.provincia, d.pais].filter(Boolean).join(", ");
    return [d.codigoPostal, d.ciudad, d.provincia, d.pais].filter(Boolean).join(", ");
  }, [empresa.direccionFiscal]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="min-w-0 flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Ficha del promotor
          </p>
          <h3 className="text-[15px] font-bold tracking-tight text-foreground mt-0.5">
            Datos del promotor
          </h3>
          <p className="text-[11.5px] text-muted-foreground mt-0.5">
            Los mantiene el propio promotor desde su panel · usados en contratos y comunicaciones.
          </p>
        </div>
        {empresa.verificada && <VerifiedBadge size="md" />}
      </div>

      <Section icon={Building2} title="Identidad de empresa">
        <DataGrid>
          <DataField label="Nombre comercial" value={empresa.nombreComercial} />
          <DataField label="Razón social" value={empresa.razonSocial} />
          <DataField label="CIF" value={empresa.cif} mono />
          <DataField label="Fundada en" value={empresa.fundadaEn} />
          <DataField
            label="Dirección fiscal"
            value={fullAddress || undefined}
            icon={MapPin}
            wide
            link={fullAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}` : undefined}
            linkLabel="Abrir en Google Maps"
          />
        </DataGrid>
      </Section>

      <Section icon={Phone} title="Contacto">
        <DataGrid>
          <DataField label="Email corporativo" value={empresa.email} />
          <DataField label="Teléfono" value={empresa.telefono} />
          <DataField
            label="Sitio web"
            value={empresa.sitioWeb}
            icon={Globe}
            link={empresa.sitioWeb ? (empresa.sitioWeb.startsWith("http") ? empresa.sitioWeb : `https://${empresa.sitioWeb}`) : undefined}
            linkLabel="Abrir sitio web"
          />
        </DataGrid>
      </Section>
    </div>
  );
}
