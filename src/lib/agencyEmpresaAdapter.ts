/**
 * agencyEmpresaAdapter.ts · mapea una `Agency` (vista del promotor sobre
 * un tenant agencia) a la shape `Empresa` completa.
 *
 * Propósito: que `Empresa.tsx` pueda renderizar **el perfil público** de
 * cualquier agencia con el mismo componente que usa el promotor para ver
 * su propia empresa. Unificamos UI: una sola ficha de empresa, dos
 * modos (owner / visitor).
 *
 * Cuando exista backend, este adapter desaparece: el endpoint
 * `GET /api/empresas/:id/public` devolverá directamente la shape
 * `Empresa`.
 */

import type { Agency } from "@/data/agencies";
import { defaultEmpresa, type Empresa } from "./empresa";
import { isAgencyVerified } from "./licenses";
import { getAgencyLicenses } from "./agencyLicenses";

const ESPECIALIDAD_LABEL: Record<NonNullable<Agency["especialidad"]>, string> = {
  luxury: "Lujo",
  residential: "Residencial",
  commercial: "Comercial",
  tourist: "Turístico",
  "second-home": "Segunda residencia",
};

export function agencyToEmpresa(a: Agency): Empresa {
  const primary = a.offices?.[0];
  const fiscal = a.direccionFiscal;
  /* Si la agencia rellenó su ficha Empresa, usamos sus idiomas; si no,
     caemos a los códigos ISO de sus mercados comerciales como proxy. */
  const idiomas = a.idiomasAtencion && a.idiomasAtencion.length > 0
    ? a.idiomasAtencion
    : (a.mercados ?? []).map((c) => c.toLowerCase()).slice(0, 4);
  return {
    ...defaultEmpresa,
    nombreComercial: a.name,
    razonSocial: a.razonSocial ?? a.name,
    cif: a.cif ?? "",
    logoUrl: a.logo ?? "",
    logoShape: "circle",
    coverUrl: a.cover ?? "",
    colorCorporativo: defaultEmpresa.colorCorporativo,
    fundadaEn: a.fundadaEn ?? "",
    subtitle: `${a.location}${a.type ? ` · ${a.type}` : ""}${a.collaboratingSince ? ` · Colabora desde ${a.collaboratingSince}` : ""}`,
    tagline: a.description ?? "",
    overview: a.description ?? "",
    aboutOverview: a.description ?? "",
    quote: "",
    quoteDescription: "",
    email: a.contactoPrincipal?.email ?? "",
    telefono: a.contactoPrincipal?.telefono ?? "",
    horario: a.horario ?? "",
    sitioWeb: a.sitioWeb ?? "",
    linkedin:  a.redes?.linkedin  ?? "",
    instagram: a.redes?.instagram ?? "",
    facebook:  a.redes?.facebook  ?? "",
    youtube:   a.redes?.youtube   ?? "",
    tiktok:    a.redes?.tiktok    ?? "",
    zonasOperacion: a.mercados ?? [],
    especialidades: a.especialidad ? [ESPECIALIDAD_LABEL[a.especialidad]] : [],
    idiomasAtencion: idiomas,
    comisionNacionalDefault: a.comisionMedia ?? 0,
    comisionInternacionalDefault: a.comisionMedia ?? 0,
    plazoPagoComisionDias: 30,
    certificaciones: [],
    testimonios: [],
    direccionFiscal: {
      pais:         fiscal?.pais         ?? "",
      provincia:    fiscal?.provincia    ?? "",
      ciudad:       fiscal?.ciudad       ?? primary?.city ?? "",
      direccion:    fiscal?.direccion    ?? primary?.address ?? "",
      codigoPostal: fiscal?.codigoPostal ?? "",
    },
    moneda: "EUR",
    idiomaDefault: "es",
    zonaHoraria: "Europe/Madrid",
    verificada: isAgencyVerified(getAgencyLicenses(a)),
    verificadaEl: a.contractSignedAt ?? "",
    googlePlaceId: a.googlePlaceId ?? "",
    googleRating: a.googleRating ?? 0,
    googleRatingsTotal: a.googleRatingsTotal ?? 0,
    googleFetchedAt: a.googleFetchedAt ?? "",
    googleMapsUrl: a.googleMapsUrl ?? "",
    onboardingCompleto: true,
    updatedAt: 0,
  };
}
