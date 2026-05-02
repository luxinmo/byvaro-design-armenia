/**
 * scripts/seed-units-meta.mjs · enriquece `public.promotion_units.metadata`
 * con block · door · type · usableArea (campos que `seedHydrator`
 * preserva del seed pero que ahora migramos a DB).
 *
 * Replica la lógica determinista de `generateUnits()` en
 * `src/data/units.ts` con los mismos parámetros que están en el
 * objeto `unitsByPromotion` exportado.
 *
 * Idempotente · merge de metadata.
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

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

/* Configuración por promoción · espejo de `unitsByPromotion` en
 *  src/data/units.ts. */
const SPEC = {
  "1":  { totalUnits: 48, availableUnits: 12, priceMin: 344000, priceMax: 1400000 },
  "2":  { totalUnits: 32, availableUnits: 3,  priceMin: 385000, priceMax: 920000 },
  "3":  { totalUnits: 24, availableUnits: 18, priceMin: 890000, priceMax: 2100000 },
  "4":  { totalUnits: 80, availableUnits: 34, priceMin: 265000, priceMax: 580000 },
  "5":  { totalUnits: 56, availableUnits: 1,  priceMin: 310000, priceMax: 490000 },
  "6":  { totalUnits: 16, availableUnits: 9,  priceMin: 720000, priceMax: 1800000 },
  "8":  { totalUnits: 40, availableUnits: 0,  priceMin: 550000, priceMax: 1200000 },
  "dev-1": { totalUnits: 1,  availableUnits: 1,  priceMin: 1250000, priceMax: 1250000 },
  "dev-2": { totalUnits: 12, availableUnits: 6,  priceMin: 680000,  priceMax: 1100000 },
  "dev-3": { totalUnits: 36, availableUnits: 24, priceMin: 290000,  priceMax: 520000 },
  "dev-4": { totalUnits: 28, availableUnits: 18, priceMin: 345000,  priceMax: 780000 },
  "dev-5": { totalUnits: 44, availableUnits: 30, priceMin: 215000,  priceMax: 410000 },
  "dev-2-aedas-copy": { totalUnits: 12, availableUnits: 6,  priceMin: 680000,  priceMax: 1100000 },
  "dev-aedas-1":      { totalUnits: 96, availableUnits: 38, priceMin: 580000,  priceMax: 1400000 },
  "dev-aedas-2":      { totalUnits: 142,availableUnits: 17, priceMin: 320000,  priceMax: 480000 },
  "dev-neinor-1":     { totalUnits: 56, availableUnits: 4,  priceMin: 420000,  priceMax: 950000 },
  "dev-neinor-2":     { totalUnits: 82, availableUnits: 22, priceMin: 290000,  priceMax: 410000 },
  "dev-habitat-1":    { totalUnits: 64, availableUnits: 11, priceMin: 510000,  priceMax: 1200000 },
  "dev-metrovacesa-1":{ totalUnits: 110,availableUnits: 41, priceMin: 380000,  priceMax: 720000 },
  "dev-metrovacesa-2":{ totalUnits: 88, availableUnits: 64, priceMin: 260000,  priceMax: 410000 },
};

function generateUnitsMeta(promotionId, totalUnits) {
  /* Réplica fiel de generateUnits para metadata · solo los campos que
   *  faltan en DB columnas (block, door, type, usableArea). */
  const blocks = totalUnits > 20 ? ["11A", "11B"] : ["11A"];
  const types = ["Apartamento", "Ático", "Dúplex", "Estudio"];
  const out = [];
  let unitIndex = 0;
  for (const block of blocks) {
    const unitsInBlock = Math.ceil(totalUnits / blocks.length);
    const floors = Math.ceil(unitsInBlock / 4);
    for (let floor = 0; floor < floors; floor++) {
      const doorsOnFloor = Math.min(4, unitsInBlock - floor * 4);
      const doorLabels = ["A", "B", "C", "D"];
      for (let d = 0; d < doorsOnFloor; d++) {
        if (unitIndex >= totalUnits) break;
        const typeIdx = (floor + d) % types.length;
        const isAtico = floor === floors - 1;
        const bedrooms = isAtico ? 3 + (d % 2) : 1 + (d % 3);
        const builtArea = 55 + bedrooms * 25 + (isAtico ? 30 : 0);
        const door = doorLabels[d];
        const unitId = `${promotionId}-${block}-${floor}${door}`;
        out.push({
          id: unitId,
          block,
          door,
          type: isAtico ? "Ático" : types[typeIdx],
          usableArea: Math.round(builtArea * 0.85),
        });
        unitIndex++;
      }
    }
  }
  return out;
}

let totalUpdated = 0;
let totalSkipped = 0;
for (const [promoId, spec] of Object.entries(SPEC)) {
  const units = generateUnitsMeta(promoId, spec.totalUnits);
  /* Update en chunks de 50 con Promise.all · cada unit lee+merge
   *  metadata existente. */
  for (let i = 0; i < units.length; i += 50) {
    const chunk = units.slice(i, i + 50);
    const results = await Promise.all(
      chunk.map(async (u) => {
        const { data: cur } = await supabase
          .from("promotion_units")
          .select("metadata")
          .eq("id", u.id)
          .maybeSingle();
        if (!cur) return { id: u.id, status: "skipped" };
        const newMeta = {
          ...(cur.metadata ?? {}),
          block: u.block,
          door: u.door,
          type: u.type,
          usableArea: u.usableArea,
        };
        const { error } = await supabase
          .from("promotion_units")
          .update({ metadata: newMeta })
          .eq("id", u.id);
        if (error) return { id: u.id, status: "error", message: error.message };
        return { id: u.id, status: "ok" };
      }),
    );
    for (const r of results) {
      if (r.status === "ok") totalUpdated++;
      else if (r.status === "skipped") totalSkipped++;
      else console.error(`✗ ${r.id}: ${r.message}`);
    }
  }
  console.log(`  ${promoId} · ${units.length} units`);
}

console.log(`\n✓ ${totalUpdated} units actualizadas (${totalSkipped} no encontradas en DB)`);
