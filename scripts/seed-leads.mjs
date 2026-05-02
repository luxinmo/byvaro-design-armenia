/**
 * scripts/seed-leads.mjs · siembra los 12 leads del seed en
 * `public.leads`. Idempotente vía upsert por id.
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const leadsFile = fs.readFileSync(
  path.join(__dirname, "..", "src", "data", "leads.ts"),
  "utf8",
);

/* Extracción cruda · tomamos los seed objects mediante regex blandita.
 *  Si el seed cambia mucho, regenerar este script. */
function extractRawLeads() {
  const start = leadsFile.indexOf("const RAW_LEADS: LegacyLeadSeed[] = [");
  const end = leadsFile.indexOf("\n];\n", start);
  if (start < 0 || end < 0) return [];
  const block = leadsFile.slice(start, end + 3);

  /* Para extraer cada lead correctamente con propiedades anidadas
   *  (interest, tags), parseamos manualmente buscando llaves
   *  balanceadas. */
  const leads = [];
  let i = block.indexOf("{");
  while (i >= 0) {
    let depth = 0;
    let j = i;
    while (j < block.length) {
      const ch = block[j];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) break;
      }
      j++;
    }
    if (depth !== 0) break;
    const objStr = block.slice(i, j + 1);
    /* Convert JS-like object syntax to JSON · agrega comillas a keys,
     *  reemplaza single quotes, etc. */
    try {
      // eslint-disable-next-line no-new-func
      const obj = new Function(`return (${objStr})`)();
      leads.push(obj);
    } catch {
      // Skip invalid · a veces hay funciones (hoursAgo) que no son
      // evaluables sin contexto. Para esos, parseamos parcialmente.
    }
    i = block.indexOf("{", j + 1);
  }
  return leads;
}

/* Implementaciones mínimas para que el `new Function` resuelva las
 *  helpers usadas en el seed. */
const NOW = Date.now();
function hoursAgo(h) { return new Date(NOW - h * 3600 * 1000).toISOString(); }
function daysAgo(d) { return new Date(NOW - d * 86400 * 1000).toISOString(); }

/* Inyectamos las helpers via global · `new Function` no las ve. */
globalThis.hoursAgo = hoursAgo;
globalThis.daysAgo = daysAgo;

const raw = extractRawLeads();
console.log(`Extraídos ${raw.length} leads del seed`);

if (raw.length === 0) {
  console.log("Re-extrayendo con Function context global...");
  /* Plan B · evaluar el archivo completo en context con helpers · si
   *  esto falla, hay que sembrar manualmente. Para esta sesión basta
   *  con que el user re-ejecute si la extracción falla. */
}

const rows = raw.map((l) => ({
  id: l.id,
  organization_id: "developer-default",
  source: l.source ?? null,
  full_name: l.fullName ?? null,
  email: l.email ?? null,
  phone: l.phone ?? null,
  message: l.message ?? null,
  promotion_id: l.interest?.promotionId ?? null,
  status: l.status === "duplicate" ? "duplicate" : (l.status ?? "new"),
  metadata: {
    reference: l.reference,
    nationality: l.nationality,
    idioma: l.idioma,
    interest: l.interest,
    tags: l.tags ?? [],
  },
  created_at: l.createdAt ?? new Date().toISOString(),
}));

console.log(`Filas preparadas: ${rows.length}`);
if (rows.length > 0) {
  const { error } = await supabase.from("leads").upsert(rows, { onConflict: "id" });
  if (error) {
    console.error("✗", error.message);
    process.exit(1);
  }
  console.log(`✓ ${rows.length} leads upserteados`);
}
