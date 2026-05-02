/**
 * scripts/seed-inmuebles.mjs · siembra los 16 inmuebles del seed en
 * `public.inmuebles`. Idempotente vía upsert por id.
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
const file = fs.readFileSync(
  path.join(__dirname, "..", "src", "data", "inmuebles.ts"),
  "utf8",
);

/* PH constant en seed · simulamos los placeholders. */
const PH = {
  pisoLujo: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80",
  pisoModerno: "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&q=80",
  pisoCentrico: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80",
  casaCampo: "https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=800&q=80",
  villaLujo: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80",
  atico: "https://images.unsplash.com/photo-1480074568708-e7b720bb3f09?w=800&q=80",
  duplex: "https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=800&q=80",
  estudio: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80",
  loft: "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80",
  casa: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=80",
  oficina: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80",
  local: "https://images.unsplash.com/photo-1604754742629-3e5728249d73?w=800&q=80",
  parking: "https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=800&q=80",
  trastero: "https://images.unsplash.com/photo-1604846887357-5a91e6a26e9b?w=800&q=80",
  nave: "https://images.unsplash.com/photo-1565793298595-6a879b1d9492?w=800&q=80",
  terreno: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80",
};

function extractRaw() {
  const start = file.indexOf("const DEVELOPER_SEED: Inmueble[] = [");
  const end = file.indexOf("\n];\n", start);
  if (start < 0 || end < 0) return [];
  const block = file.slice(start, end + 3);
  const out = [];
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
    try {
      // eslint-disable-next-line no-new-func
      const obj = new Function("PH", `return (${objStr})`)(PH);
      out.push(obj);
    } catch (e) {
      console.warn("skip:", e.message);
    }
    i = block.indexOf("{", j + 1);
  }
  return out;
}

const STATUS_MAP = { disponible: "available", reservado: "reserved", vendido: "sold", alquilado: "rented", retirado: "archived" };
/* DB enum `inmueble_operation` matches el seed · no remap. */
const OP_MAP = { venta: "venta", alquiler: "alquiler", "alquiler-vacacional": "alquiler-vacacional", traspaso: "traspaso" };

const raw = extractRaw();
console.log(`Extraídos ${raw.length} inmuebles`);

const rows = raw.map((i) => ({
  id: i.id,
  organization_id: i.organizationId,
  reference: i.reference,
  type: i.type,
  operation: OP_MAP[i.operation] ?? i.operation,
  status: STATUS_MAP[i.status] ?? i.status,
  price: i.price,
  address: i.address ?? null,
  city: i.city ?? null,
  province: i.province ?? null,
  country: "ES",
  bedrooms: i.bedrooms ?? null,
  bathrooms: i.bathrooms ?? null,
  useful_area_m2: i.usefulArea ?? null,
  built_area_m2: i.builtArea ?? null,
  branch_label: i.branchLabel ?? null,
  photos: i.photos ?? [],
  description: i.description ?? null,
  tags: i.tags ?? [],
  share_with_network: i.shareWithNetwork ?? false,
  is_favorite: i.isFavorite ?? false,
  metadata: {
    legacyOwnerMemberId: i.ownerMemberId,
    legacyCreatedAt: i.createdAt,
    legacyUpdatedAt: i.updatedAt,
  },
}));

console.log(`Filas: ${rows.length}`);
if (rows.length > 0) {
  const { error } = await supabase.from("inmuebles").upsert(rows, { onConflict: "id" });
  if (error) {
    console.error("✗", error.message);
    process.exit(1);
  }
  console.log(`✓ ${rows.length} inmuebles upserteados`);
}
