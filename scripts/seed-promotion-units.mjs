/**
 * scripts/seed-promotion-units.mjs
 *
 * Inserta TODAS las unidades del seed `src/data/units.ts` en
 * `public.promotion_units` de Supabase. Idempotente · usa upsert por
 * `id`. Una vez seedeado, el frontend lee de DB y `unitsByPromotion`
 * desaparece como source of truth.
 *
 * Uso:
 *   node scripts/seed-promotion-units.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local" });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing env: VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/* ── Replica fiel de generateUnits() del seed (units.ts) ── */
function generateUnits(promotionId, totalUnits, availableUnits, priceMin, priceMax) {
  const blocks = totalUnits > 20 ? ["11A", "11B"] : ["11A"];
  const types = ["Apartamento", "Ático", "Dúplex", "Estudio"];
  const orientations = ["Norte", "Sur", "Este", "Oeste", "Sureste", "Suroeste"];

  const units = [];
  let unitIndex = 0;
  const soldCount = totalUnits - availableUnits;
  const reservedCount = Math.min(Math.floor(soldCount * 0.3), availableUnits > 2 ? 3 : 1);
  const withdrawnCount = Math.min(2, Math.floor(totalUnits * 0.05));
  const actuallySold = soldCount - reservedCount - withdrawnCount;

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
        const bathrooms = Math.max(1, bedrooms - (d % 2));
        const builtArea = 55 + bedrooms * 25 + (isAtico ? 30 : 0);
        const terrace = isAtico ? 40 + d * 5 : 8 + d * 3;
        const priceFactor = (builtArea - 55) / 200;
        const price = Math.round(priceMin + (priceMax - priceMin) * priceFactor);

        let status = "available";
        if (unitIndex < actuallySold) status = "sold";
        else if (unitIndex < actuallySold + reservedCount) status = "reserved";
        else if (unitIndex < actuallySold + reservedCount + withdrawnCount) status = "withdrawn";

        const unitId = `${promotionId}-${block}-${floor}${doorLabels[d]}`;
        const label = `${floor}º${doorLabels[d]}`;

        units.push({
          id: unitId,
          promotion_id: promotionId,
          label,
          rooms: bedrooms,
          bathrooms,
          surface_m2: builtArea,
          terrace_m2: terrace,
          price,
          status,
          floor: String(floor),
          orientation: orientations[(floor + d) % orientations.length],
          metadata: {
            block,
            door: doorLabels[d],
            type: isAtico ? "Ático" : types[typeIdx],
            usableArea: Math.round(builtArea * 0.85),
            isAtico,
          },
        });
        unitIndex++;
      }
    }
  }
  return units;
}

const SPEC = [
  ["1", 48, 12, 344000, 1400000],
  ["2", 32, 3, 385000, 920000],
  ["3", 24, 18, 890000, 2100000],
  ["4", 80, 34, 265000, 580000],
  ["5", 56, 1, 310000, 490000],
  ["6", 16, 9, 720000, 1800000],
  ["8", 40, 0, 550000, 1200000],
  ["dev-1", 1, 1, 1250000, 1250000],
  ["dev-2", 12, 6, 680000, 1100000],
  ["dev-3", 36, 24, 290000, 520000],
  ["dev-4", 28, 18, 345000, 780000],
  ["dev-5", 44, 30, 215000, 410000],
  ["dev-2-aedas-copy", 12, 6, 680000, 1100000],
  ["dev-aedas-1", 96, 38, 580000, 1400000],
  ["dev-aedas-2", 142, 17, 320000, 480000],
  ["dev-neinor-1", 56, 4, 420000, 950000],
  ["dev-neinor-2", 82, 22, 290000, 410000],
  ["dev-habitat-1", 64, 11, 510000, 1200000],
  ["dev-metrovacesa-1", 110, 41, 380000, 720000],
  ["dev-metrovacesa-2", 88, 64, 260000, 410000],
];

async function main() {
  let total = 0;
  for (const [promoId, totalU, available, pmin, pmax] of SPEC) {
    const units = generateUnits(promoId, totalU, available, pmin, pmax);
    /* Upsert por chunks de 100 · evita timeout */
    for (let i = 0; i < units.length; i += 100) {
      const chunk = units.slice(i, i + 100);
      const { error } = await supabase
        .from("promotion_units")
        .upsert(chunk, { onConflict: "id" });
      if (error) {
        console.error(`✗ ${promoId} chunk ${i}: ${error.message}`);
        process.exit(1);
      }
    }
    total += units.length;
    console.log(`✓ ${promoId} · ${units.length} units`);
  }
  console.log(`\n✓ TOTAL: ${total} units sembradas en promotion_units`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
