/**
 * scripts/generate-supabase-seed.ts
 * ---------------------------------
 * Genera `supabase/migrations/20260429000003_seed.sql` a partir de los
 * seeds TS canónicos (`src/data/agencies.ts`, `src/data/promotores.ts`,
 * `src/data/promotions.ts`, `src/data/developerPromotions.ts`,
 * `src/lib/empresa.ts::LUXINMO_PROFILE`).
 *
 * Run · `npm run seed:gen` o `npx tsx scripts/generate-supabase-seed.ts`.
 *
 * Inserta solo data no-dependiente de usuarios:
 *   · organizations (developer-default + 10 agencies + 4 promotores)
 *   · organization_profiles (todos los anteriores)
 *   · offices (extraídas de cada agency.offices y prom.offices)
 *   · promotions (todas las de promotions.ts y developerPromotions.ts,
 *     todas con owner_organization_id = 'developer-default')
 *
 * NO inserta (lo gestiona `scripts/bootstrap-supabase.ts` post-migración):
 *   · auth.users · via Supabase Admin API.
 *   · organization_members · necesita auth user IDs reales.
 *   · collab_requests · created_by_user_id necesita auth user.
 *   · organization_collaborations / promotion_collaborations.
 *
 * No mantiene el orden ni reglas de negocio · solo translación 1:1 de
 * los seeds existentes.
 */

import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

import { agencies } from "../src/data/agencies";
import { promotores } from "../src/data/promotores";
import { promotions as luxinmoPromos } from "../src/data/promotions";
import { developerOnlyPromotions } from "../src/data/developerPromotions";
import { LUXINMO_PROFILE } from "../src/lib/empresa";
import type { Agency } from "../src/data/agencies";

/* ─── Helpers ─────────────────────────────────────────────────────── */

function sqlString(v: string | undefined | null): string {
  if (v == null) return "null";
  return `'${v.replace(/'/g, "''")}'`;
}

function sqlNumber(v: number | undefined | null): string {
  if (v == null || Number.isNaN(v)) return "null";
  return String(v);
}

function sqlBool(v: boolean | undefined | null): string {
  if (v == null) return "null";
  return v ? "true" : "false";
}

function sqlJson(v: unknown): string {
  if (v == null) return "null";
  return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
}

function sqlArrayText(v: string[] | undefined | null): string {
  if (!v || v.length === 0) return "null";
  const inner = v.map((s) => `"${String(s).replace(/"/g, '\\"')}"`).join(",");
  return `'{${inner}}'`;
}

function sqlTimestamp(v: string | number | undefined | null): string {
  if (v == null) return "null";
  if (typeof v === "number") return `to_timestamp(${v / 1000})`;
  return sqlString(v);
}

/* Mapea `Agency.status` y `Agency.estadoColaboracion` (mock) al pair
 * canónico (organizations.status + posterior org_collab.status). Solo
 * `organizations.status` se usa aquí · el collab status se infiere al
 * crear filas en `organization_collaborations` en el bootstrap script. */
function mapOrgStatus(a: Agency): "active" | "inactive" | "suspended" {
  if (a.status === "inactive") return "inactive";
  return "active";
}

function inferCountry(a: Agency): string {
  /* `direccionFiscal.pais` (string libre · "España") cuando lo hay,
   * sino derivar de `location` o `mercados[0]`. */
  const fiscalCountry = a.direccionFiscal?.pais;
  if (fiscalCountry) return countryNameToIso(fiscalCountry);
  const locParts = a.location?.split(",").map((s) => s.trim()) ?? [];
  const last = locParts[locParts.length - 1];
  if (last) return countryNameToIso(last);
  return a.mercados?.[0] ?? "ES";
}

function countryNameToIso(name: string): string {
  const map: Record<string, string> = {
    "España": "ES", "Spain": "ES",
    "Suecia": "SE", "Sweden": "SE",
    "Países Bajos": "NL", "Netherlands": "NL",
    "Reino Unido": "GB", "United Kingdom": "GB", "UK": "GB",
    "Portugal": "PT",
    "Finland": "FI", "Finlandia": "FI",
    "France": "FR", "Francia": "FR",
    "Russia": "RU", "Rusia": "RU",
    "Switzerland": "CH", "Suiza": "CH",
    "Belgium": "BE", "Bélgica": "BE",
    "Italy": "IT", "Italia": "IT",
    "Germany": "DE", "Alemania": "DE",
  };
  return map[name] ?? name.slice(0, 2).toUpperCase();
}

/* ─── Generación ──────────────────────────────────────────────────── */

const lines: string[] = [];
lines.push("-- ===================================================================");
lines.push("-- AUTO-GENERATED · do not edit manually.");
lines.push("-- Source: scripts/generate-supabase-seed.ts");
lines.push("-- Run `npm run seed:gen` to regenerate.");
lines.push("-- ===================================================================");
lines.push("");
lines.push("-- Limpiamos antes para que el seed sea idempotente al re-ejecutar.");
lines.push("delete from public.collaboration_documents;");
lines.push("delete from public.promotion_collaborations;");
lines.push("delete from public.organization_collaborations;");
lines.push("delete from public.collab_requests;");
lines.push("delete from public.audit_events;");
lines.push("delete from public.promotions;");
lines.push("delete from public.offices;");
lines.push("delete from public.organization_profiles;");
lines.push("delete from public.organization_members;");
lines.push("delete from public.organizations;");
lines.push("");

/* ─── 1. organizations · developer-default ────────────────────────── */
lines.push("-- ─── developer-default · Luxinmo ──────────────────────────────────");
lines.push(`insert into public.organizations (
  id, kind, legal_name, display_name, tax_id,
  email, phone, website, logo_url, cover_url,
  address_line, address_city, address_province, country,
  status, verified, verified_at
) values (
  'developer-default', 'developer',
  ${sqlString(LUXINMO_PROFILE.razonSocial)}, ${sqlString(LUXINMO_PROFILE.nombreComercial)}, ${sqlString(LUXINMO_PROFILE.cif)},
  ${sqlString(LUXINMO_PROFILE.email)}, ${sqlString(LUXINMO_PROFILE.telefono)}, ${sqlString(LUXINMO_PROFILE.sitioWeb)},
  ${sqlString(LUXINMO_PROFILE.logoUrl)}, ${sqlString(LUXINMO_PROFILE.coverUrl)},
  ${sqlString(LUXINMO_PROFILE.direccionFiscalCompleta)}, ${sqlString(LUXINMO_PROFILE.direccionFiscal.ciudad)},
  ${sqlString(LUXINMO_PROFILE.direccionFiscal.provincia)}, ${sqlString(countryNameToIso(LUXINMO_PROFILE.direccionFiscal.pais))},
  'active', ${sqlBool(LUXINMO_PROFILE.verificada)}, ${sqlTimestamp(LUXINMO_PROFILE.verificadaEl)}
);`);
lines.push("");

lines.push(`insert into public.organization_profiles (
  organization_id, description, public_description, tagline, quote, quote_description,
  founded_year, license_number, licenses,
  attention_languages, commission_national_default, commission_international_default,
  main_contact_name, main_contact_email, main_contact_phone, schedule,
  linkedin, instagram, facebook, youtube, tiktok,
  marketing_top_nationalities, marketing_product_types, marketing_client_sources, marketing_portals,
  google_place_id, google_rating, google_ratings_total, google_fetched_at, google_maps_url,
  visibility_status
) values (
  'developer-default',
  ${sqlString(LUXINMO_PROFILE.overview)},
  ${sqlString(LUXINMO_PROFILE.aboutOverview)},
  ${sqlString(LUXINMO_PROFILE.tagline)},
  ${sqlString(LUXINMO_PROFILE.quote)},
  ${sqlString(LUXINMO_PROFILE.quoteDescription)},
  ${sqlNumber(parseInt(LUXINMO_PROFILE.fundadaEn, 10) || null)},
  ${sqlString(LUXINMO_PROFILE.licencias?.[0]?.numero)},
  ${sqlJson(LUXINMO_PROFILE.licencias)},
  ${sqlArrayText(LUXINMO_PROFILE.idiomasAtencion)},
  ${sqlNumber(LUXINMO_PROFILE.comisionNacionalDefault)},
  ${sqlNumber(LUXINMO_PROFILE.comisionInternacionalDefault)},
  null, ${sqlString(LUXINMO_PROFILE.email)}, ${sqlString(LUXINMO_PROFILE.telefono)}, ${sqlString(LUXINMO_PROFILE.horario)},
  ${sqlString(LUXINMO_PROFILE.linkedin)}, ${sqlString(LUXINMO_PROFILE.instagram)},
  ${sqlString(LUXINMO_PROFILE.facebook)}, ${sqlString(LUXINMO_PROFILE.youtube)}, ${sqlString(LUXINMO_PROFILE.tiktok)},
  ${sqlJson(LUXINMO_PROFILE.marketingTopNacionalidades)},
  ${sqlJson(LUXINMO_PROFILE.marketingTiposProducto)},
  ${sqlJson(LUXINMO_PROFILE.marketingFuentesClientes)},
  ${sqlArrayText(LUXINMO_PROFILE.marketingPortales)},
  ${sqlString(LUXINMO_PROFILE.googlePlaceId)},
  ${sqlNumber(LUXINMO_PROFILE.googleRating)},
  ${sqlNumber(LUXINMO_PROFILE.googleRatingsTotal)},
  ${sqlTimestamp(LUXINMO_PROFILE.googleFetchedAt)},
  ${sqlString(LUXINMO_PROFILE.googleMapsUrl)},
  'visible'
);`);
lines.push("");

/* ─── 2. organizations · agencies + promotores ────────────────────── */
function emitOrg(a: Agency, kind: "agency" | "developer") {
  const country = inferCountry(a);
  const orgStatus = mapOrgStatus(a);
  const main = a.offices?.[0];
  lines.push(`-- ─── ${a.id} · ${a.name} ──`);
  lines.push(`insert into public.organizations (
  id, kind, legal_name, display_name, tax_id,
  email, phone, website, logo_url, cover_url,
  address_line, address_street, address_postal_code, address_city, address_province, country,
  status, verified, verified_at
) values (
  ${sqlString(a.id)}, ${sqlString(kind)},
  ${sqlString(a.razonSocial ?? a.name)}, ${sqlString(a.name)}, ${sqlString(a.cif)},
  ${sqlString(a.contactoPrincipal?.email)}, ${sqlString(a.contactoPrincipal?.telefono)},
  ${sqlString(a.sitioWeb)}, ${sqlString(a.logo)}, ${sqlString(a.cover)},
  ${sqlString(main?.address)}, ${sqlString(a.direccionFiscal?.direccion)},
  ${sqlString(a.direccionFiscal?.codigoPostal)}, ${sqlString(a.direccionFiscal?.ciudad ?? main?.city)},
  ${sqlString(a.direccionFiscal?.provincia)}, ${sqlString(country)},
  ${sqlString(orgStatus)},
  ${sqlBool(false)},
  null
);`);
  lines.push("");

  lines.push(`insert into public.organization_profiles (
  organization_id, description, public_description, tagline,
  founded_year, licenses,
  attention_languages, commission_national_default, commission_international_default,
  main_contact_name, main_contact_email, main_contact_phone, schedule,
  linkedin, instagram, facebook, youtube, tiktok,
  google_rating, google_ratings_total, google_fetched_at, google_maps_url, google_place_id,
  visibility_status
) values (
  ${sqlString(a.id)},
  ${sqlString(a.description)},
  ${sqlString(a.description)},
  null,
  ${sqlNumber(a.fundadaEn ? parseInt(a.fundadaEn, 10) : null)},
  ${sqlJson(a.licencias)},
  ${sqlArrayText(a.idiomasAtencion)},
  ${sqlNumber(a.comisionMedia)},
  ${sqlNumber(a.comisionMedia)},
  ${sqlString(a.contactoPrincipal?.nombre)},
  ${sqlString(a.contactoPrincipal?.email)},
  ${sqlString(a.contactoPrincipal?.telefono)},
  ${sqlString(a.horario)},
  ${sqlString(a.redes?.linkedin)}, ${sqlString(a.redes?.instagram)},
  ${sqlString(a.redes?.facebook)}, ${sqlString(a.redes?.youtube)}, ${sqlString(a.redes?.tiktok)},
  ${sqlNumber(a.googleRating)}, ${sqlNumber(a.googleRatingsTotal)},
  ${sqlTimestamp(a.googleFetchedAt)}, ${sqlString(a.googleMapsUrl)}, ${sqlString(a.googlePlaceId)},
  ${a.razonSocial && a.cif && a.direccionFiscal ? "'visible'" : "'incomplete'"}
);`);
  lines.push("");

  /* Offices · cada uno con id determinista. */
  if (a.offices && a.offices.length > 0) {
    a.offices.forEach((o, idx) => {
      lines.push(`insert into public.offices (id, organization_id, name, address, city, country, is_main, status)
values (${sqlString(`${a.id}-of-${idx + 1}`)}, ${sqlString(a.id)},
  ${sqlString(`Oficina ${o.city}`)}, ${sqlString(o.address)},
  ${sqlString(o.city)}, ${sqlString(country)},
  ${sqlBool(idx === 0)}, 'active');`);
    });
    lines.push("");
  }
}

lines.push("-- ─── Agencies (10 mock agencies) ──────────────────────────────────");
for (const a of agencies) emitOrg(a, "agency");

lines.push("-- ─── External promotores (4 mock developers) ─────────────────────");
for (const p of promotores) emitOrg(p, "developer");

/* ─── 3. Luxinmo offices ─────────────────────────────────────────── */
lines.push("-- ─── Luxinmo offices (developer-default) ──────────────────────────");
const luxinmoOffices = [
  { id: "of-1", name: "Oficina Central Marbella", address: "Av. del Mar 15", city: "Marbella", province: "Málaga", isMain: true },
  { id: "of-2", name: "Showroom Puerto Banús", address: "Puerto Banús, Local 8", city: "Marbella", province: "Málaga", isMain: false },
  { id: "of-3", name: "Sales Office Jávea", address: "Av. del Plá 12", city: "Jávea", province: "Alicante", isMain: false },
  { id: "of-4", name: "Madrid HQ", address: "Paseo de la Castellana 89", city: "Madrid", province: "Madrid", isMain: false },
  { id: "of-5", name: "Costa Blanca Office", address: "C/ del Sol 22", city: "Torrevieja", province: "Alicante", isMain: false },
  { id: "of-6", name: "Mijas Showroom", address: "Av. de Mijas 5", city: "Mijas", province: "Málaga", isMain: false },
];
for (const o of luxinmoOffices) {
  lines.push(`insert into public.offices (id, organization_id, name, address, city, province, country, is_main, status)
values (${sqlString(o.id)}, 'developer-default', ${sqlString(o.name)},
  ${sqlString(o.address)}, ${sqlString(o.city)}, ${sqlString(o.province)}, 'ES',
  ${sqlBool(o.isMain)}, 'active');`);
}
lines.push("");

/* ─── 4. promotions ───────────────────────────────────────────────── */
lines.push("-- ─── Luxinmo promotions (promotions.ts + developerOnlyPromotions.ts) ──");

type AnyPromo = (typeof luxinmoPromos)[number] | (typeof developerOnlyPromotions)[number];

function emitPromo(p: AnyPromo) {
  const ownerRole = (p as { ownerRole?: string }).ownerRole === "comercializador"
    ? "comercializador" : "promotor";
  const status = (p.status === "active" ? "active"
    : p.status === "incomplete" ? "incomplete"
    : p.status === "sold-out" ? "sold_out"
    : p.status === "inactive" ? "archived"
    : "active");
  lines.push(`insert into public.promotions (
  id, owner_organization_id, owner_role, name, description, address, city, country,
  status, total_units, available_units, price_from, price_to, delivery,
  image_url, can_share_with_agencies, marketing_prohibitions
) values (
  ${sqlString(p.id)}, 'developer-default', ${sqlString(ownerRole)},
  ${sqlString(p.name)},
  ${sqlString((p as { description?: string }).description)},
  ${sqlString(p.location)}, null, 'ES',
  ${sqlString(status)},
  ${sqlNumber(p.totalUnits)}, ${sqlNumber(p.availableUnits)},
  ${sqlNumber(p.priceMin)}, ${sqlNumber(p.priceMax)}, ${sqlString((p as { delivery?: string }).delivery)},
  ${sqlString(p.image)},
  ${sqlBool((p as { canShareWithAgencies?: boolean }).canShareWithAgencies !== false)},
  ${sqlArrayText((p as { marketingProhibitions?: string[] }).marketingProhibitions)}
);`);
}

for (const p of luxinmoPromos) emitPromo(p);
for (const p of developerOnlyPromotions) emitPromo(p);
lines.push("");

/* ─── Output ──────────────────────────────────────────────────────── */
const out = resolve(__dirname, "../supabase/migrations/20260429000003_seed.sql");
writeFileSync(out, lines.join("\n") + "\n");
console.log(`✓ Seed SQL generated · ${lines.length} lines · ${out}`);
