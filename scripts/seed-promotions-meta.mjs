/**
 * scripts/seed-promotions-meta.mjs · enriquece `public.promotions.metadata`
 * con todos los campos del seed que no estaban migrados:
 *
 *   commission · constructionProgress · hasShowFlat · propertyTypes
 *   buildingType · reservationCost · agencies · puntosDeVentaIds
 *   comerciales · collaboration · missingSteps · badge · updatedAt
 *
 * Idempotente · upsert en metadata jsonb (merge con lo que ya hay).
 *
 * Estrategia de extracción · parseo del seed TS via `new Function`
 * sobre cada literal de objeto entre llaves balanceadas (mismo patrón
 * que `seed-sales.mjs`).
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

function extractArray(filePath, varName) {
  const file = fs.readFileSync(filePath, "utf8");
  const decl = `${varName} = [`;
  const start = file.indexOf(decl);
  if (start < 0) return [];
  /* arrayStart = posición del '[' del valor (justo antes del fin de
   *  la declaración). */
  const arrayStart = start + decl.length - 1;
  /* Find matching closing bracket. */
  let depth = 0;
  let end = -1;
  for (let i = arrayStart; i < file.length; i++) {
    if (file[i] === "[") depth++;
    else if (file[i] === "]") {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  if (end < 0) return [];
  const block = file.slice(arrayStart, end + 1);
  const out = [];
  let i = block.indexOf("{");
  while (i >= 0) {
    let d = 0;
    let j = i;
    while (j < block.length) {
      const ch = block[j];
      if (ch === "{") d++;
      else if (ch === "}") {
        d--;
        if (d === 0) break;
      }
      j++;
    }
    if (d !== 0) break;
    const objStr = block.slice(i, j + 1);
    try {
      // eslint-disable-next-line no-new-func
      const obj = new Function(`return (${objStr})`)();
      out.push(obj);
    } catch (e) {
      console.warn(`skip object @ ${i}: ${e.message}`);
    }
    i = block.indexOf("{", j + 1);
  }
  return out;
}

const devPromos = extractArray(
  path.join(__dirname, "..", "src", "data", "developerPromotions.ts"),
  "const RAW_DEV_PROMOTIONS: DevPromotion[]",
);
const legacyPromos = extractArray(
  path.join(__dirname, "..", "src", "data", "promotions.ts"),
  "const RAW_PROMOTIONS: Promotion[]",
);

const all = [...devPromos, ...legacyPromos];
console.log(`Extraídas ${all.length} promociones (${devPromos.length} dev + ${legacyPromos.length} legacy)`);

let updated = 0;
let skipped = 0;
for (const p of all) {
  /* Lee metadata actual para hacer merge no destructivo. */
  const { data: cur } = await supabase
    .from("promotions")
    .select("metadata")
    .eq("id", p.id)
    .maybeSingle();
  if (!cur) {
    skipped++;
    continue;
  }
  const newMeta = {
    ...(cur.metadata ?? {}),
    commission: p.commission,
    constructionProgress: p.constructionProgress,
    hasShowFlat: p.hasShowFlat,
    propertyTypes: p.propertyTypes,
    buildingType: p.buildingType,
    reservationCost: p.reservationCost,
    agencies: p.agencies,
    agencyAvatars: p.agencyAvatars,
    puntosDeVentaIds: p.puntosDeVentaIds,
    comerciales: p.comerciales,
    collaboration: p.collaboration,
    missingSteps: p.missingSteps,
    badge: p.badge,
    updatedAt: p.updatedAt,
    collaborating: p.collaborating,
    developer: p.developer,
  };
  /* Quitar undefined explícitos para no ensuciar JSON. */
  for (const k of Object.keys(newMeta)) {
    if (newMeta[k] === undefined) delete newMeta[k];
  }
  const { error } = await supabase
    .from("promotions")
    .update({ metadata: newMeta })
    .eq("id", p.id);
  if (error) {
    console.error(`✗ ${p.id}: ${error.message}`);
    continue;
  }
  updated++;
}

console.log(`✓ ${updated}/${all.length} promociones actualizadas (${skipped} no encontradas en DB)`);
