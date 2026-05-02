/**
 * scripts/seed-public-refs.mjs · genera y persiste las public-refs
 * canónicas (PR, UN) para todas las promociones y unidades en DB.
 *
 * Per CLAUDE.md REGLA DE ORO:
 *   · Promoción · "PR" + 5 dígitos
 *   · Unidad    · "UN" + 8 dígitos
 *
 * Determinístico via FNV-1a · re-ejecutable (idempotente · misma id
 * siempre genera la misma ref).
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

/* Replica fiel de `seedRef` de src/lib/publicRef.ts (FNV-1a). */
const SCHEME = {
  promotion: { prefix: "PR", digits: 5 },
  unit: { prefix: "UN", digits: 8 },
};

function seedRef(entity, seedId) {
  const { prefix, digits } = SCHEME[entity];
  let h = 0x811c9dc5;
  for (let i = 0; i < seedId.length; i++) {
    h ^= seedId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const max = 10 ** digits;
  const num = (h >>> 0) % max;
  return prefix + String(num).padStart(digits, "0");
}

async function main() {
  /* ── Promociones ── */
  const { data: promos, error: promosErr } = await supabase
    .from("promotions")
    .select("id, reference");
  if (promosErr) {
    console.error("✗ fetch promos:", promosErr.message);
    process.exit(1);
  }
  console.log(`Promociones: ${promos.length}`);

  /* Detectar colisiones · 2 ids distintos generando misma ref. */
  const seen = new Set();
  const collisions = [];
  for (const p of promos) {
    const ref = seedRef("promotion", p.id);
    if (seen.has(ref)) collisions.push({ id: p.id, ref });
    else seen.add(ref);
  }
  if (collisions.length > 0) {
    console.warn(`⚠ ${collisions.length} colisiones · resolveremos con sufijo numérico`);
  }

  let updated = 0;
  const usedRefs = new Set();
  for (const p of promos) {
    let ref = seedRef("promotion", p.id);
    /* Si la ref colisiona, incrementamos hasta encontrar libre. */
    let suffix = 0;
    while (usedRefs.has(ref)) {
      suffix++;
      ref = "PR" + String((parseInt(ref.slice(2)) + suffix) % 100000).padStart(5, "0");
    }
    usedRefs.add(ref);

    const { error } = await supabase
      .from("promotions")
      .update({ reference: ref })
      .eq("id", p.id);
    if (error) {
      console.error(`✗ ${p.id}: ${error.message}`);
      continue;
    }
    updated++;
  }
  console.log(`✓ ${updated}/${promos.length} promotions con reference`);

  /* ── Unidades ── (paginar · default 1000 · necesitamos ~1067) */
  const units = [];
  let from = 0;
  const PAGE = 1000;
  while (true) {
    const { data: page, error: e } = await supabase
      .from("promotion_units")
      .select("id")
      .range(from, from + PAGE - 1);
    if (e) {
      console.error("✗ fetch units:", e.message);
      process.exit(1);
    }
    if (!page || page.length === 0) break;
    units.push(...page);
    if (page.length < PAGE) break;
    from += PAGE;
  }
  console.log(`\nUnidades: ${units.length}`);

  /* Bulk update via upsert · más rápido que 1067 calls. */
  const seenU = new Set();
  const unitRows = units.map((u) => {
    let ref = seedRef("unit", u.id);
    let suffix = 0;
    while (seenU.has(ref)) {
      suffix++;
      ref = "UN" + String((parseInt(ref.slice(2)) + suffix) % 100000000).padStart(8, "0");
    }
    seenU.add(ref);
    return { id: u.id, reference: ref };
  });

  /* Chunks de 200 para UPDATE · usamos upsert por id · update solo
   *  modifica `reference` porque las demás columnas ya existen. */
  for (let i = 0; i < unitRows.length; i += 200) {
    const chunk = unitRows.slice(i, i + 200);
    /* upsert necesita más columnas pero podemos usar update via
     *  promesa concurrente. */
    await Promise.all(chunk.map(({ id, reference }) =>
      supabase.from("promotion_units").update({ reference }).eq("id", id)
    ));
  }
  console.log(`✓ ${unitRows.length} units con reference`);

  /* Verificación final. */
  const { data: sample } = await supabase
    .from("promotions")
    .select("id, name, reference")
    .limit(5);
  console.log("\nMuestra de promotions:");
  sample?.forEach((p) => console.log(`  ${p.id} · ${p.reference} · ${p.name}`));

  const { data: sampleU } = await supabase
    .from("promotion_units")
    .select("id, reference")
    .limit(5);
  console.log("\nMuestra de units:");
  sampleU?.forEach((u) => console.log(`  ${u.id} · ${u.reference}`));
}

main().catch((e) => { console.error(e); process.exit(1); });
