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

const ESPECIALIDAD_LABEL: Record<NonNullable<Agency["especialidad"]>, string> = {
  luxury: "Lujo",
  residential: "Residencial",
  commercial: "Comercial",
  tourist: "Turístico",
  "second-home": "Segunda residencia",
};

export function agencyToEmpresa(a: Agency): Empresa {
  const primary = a.offices?.[0];
  return {
    ...defaultEmpresa,
    nombreComercial: a.name,
    razonSocial: a.name,
    cif: "",
    logoUrl: a.logo ?? "",
    logoShape: "circle",
    coverUrl: a.cover ?? "",
    colorCorporativo: defaultEmpresa.colorCorporativo,
    fundadaEn: "",
    subtitle: `${a.location}${a.type ? ` · ${a.type}` : ""}${a.collaboratingSince ? ` · Colabora desde ${a.collaboratingSince}` : ""}`,
    tagline: a.description ?? "",
    overview: a.description ?? "",
    aboutOverview: a.description ?? "",
    quote: "",
    quoteDescription: "",
    email: a.contactoPrincipal?.email ?? "",
    telefono: a.contactoPrincipal?.telefono ?? "",
    horario: "",
    sitioWeb: "",
    linkedin: "", instagram: "", facebook: "", youtube: "", tiktok: "",
    aniosOperando: "",
    oficinasCount: String(a.offices?.length ?? 0),
    agentesCount: String(a.teamSize ?? 0),
    promocionesCount: "0",
    unidadesVendidas: String(a.ventasCerradas ?? 0),
    agenciasColaboradoras: "",
    ventasAnuales: "",
    ingresosAnuales: "",
    portfolio: "",
    zonasOperacion: a.mercados ?? [],
    especialidades: a.especialidad ? [ESPECIALIDAD_LABEL[a.especialidad]] : [],
    idiomasAtencion: (a.mercados ?? []).map((c) => c.toLowerCase()).slice(0, 4),
    comisionNacionalDefault: a.comisionMedia ?? 0,
    comisionInternacionalDefault: a.comisionMedia ?? 0,
    plazoPagoComisionDias: 30,
    certificaciones: [],
    testimonios: [],
    direccionFiscal: {
      pais: "",
      provincia: "",
      ciudad: primary?.city ?? "",
      direccion: primary?.address ?? "",
      codigoPostal: "",
    },
    moneda: "EUR",
    idiomaDefault: "es",
    zonaHoraria: "Europe/Madrid",
    verificada: !!a.contractSignedAt,
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
