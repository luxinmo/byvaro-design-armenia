/**
 * scripts/seed-sales.mjs · siembra los seeds de sales.ts en
 * `public.sales` (idempotente vía upsert por id).
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
  path.join(__dirname, "..", "src", "data", "sales.ts"),
  "utf8",
);

function extractRaw() {
  const start = file.indexOf("const RAW_SALES: Venta[] = [");
  /* End of array · primer "\n];\n" después del start. */
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
      const obj = new Function(`return (${objStr})`)();
      out.push(obj);
    } catch (e) {
      console.warn("Failed to parse one entry · skipped");
    }
    i = block.indexOf("{", j + 1);
  }
  return out;
}

const raw = extractRaw();
console.log(`Extraídos ${raw.length} sales seeds`);

/* Mapping seed → schema row.
 *  Schema columns: id, organization_id, agency_organization_id, promotion_id,
 *  registro_id, contact_id, unit_id, unit_label, cliente_nombre, cliente_email,
 *  cliente_telefono, cliente_nacionalidad, agent_name, estado, fecha_reserva,
 *  fecha_contrato, fecha_escritura, fecha_caida, precio_reserva, precio_final,
 *  precio_listado, descuento_aplicado, ... metadata */

const ESTADO_MAP = { reservada: "reservada", contratada: "contratada", escriturada: "escriturada", caida: "caida" };

const rows = raw.map((s) => ({
  id: s.id,
  organization_id: "developer-default",
  agency_organization_id: s.agencyId ?? null,
  promotion_id: s.promotionId,
  /* registro_id · seed apunta a r-XXXX inexistentes en DB ·
   *  guardamos referencia en metadata para no romper FK. */
  registro_id: null,
  unit_id: s.unitId ?? null,
  unit_label: s.unitLabel ?? null,
  cliente_nombre: s.clienteNombre,
  cliente_email: s.clienteEmail ?? null,
  cliente_telefono: s.clienteTelefono ?? null,
  cliente_nacionalidad: s.clienteNacionalidad ?? null,
  agent_name: s.agentName ?? null,
  estado: ESTADO_MAP[s.estado] ?? s.estado,
  fecha_reserva: s.fechaReserva ?? null,
  fecha_contrato: s.fechaContrato ?? null,
  fecha_escritura: s.fechaEscritura ?? null,
  fecha_caida: s.fechaCaida ?? null,
  precio_reserva: s.precioReserva ?? null,
  precio_final: s.precioFinal ?? null,
  precio_listado: s.precioListado ?? null,
  descuento_aplicado: s.descuentoAplicado ?? null,
  metadata: {
    legacyRegistroId: s.registroId, // mapping ref pendiente cuando se renumeren registros
    comisionPct: s.comisionPct,
    comisionPagada: s.comisionPagada,
    metodoPago: s.metodoPago,
    siguientePaso: s.siguientePaso,
    siguientePasoFecha: s.siguientePasoFecha,
    nota: s.nota,
    pagos: s.pagos ?? [],
    motivoCaida: s.motivoCaida,
    fechaCaidaReal: s.fechaCaidaReal,
  },
}));

console.log(`Filas preparadas: ${rows.length}`);
if (rows.length > 0) {
  /* Chunks de 50. */
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const { error } = await supabase.from("sales").upsert(chunk, { onConflict: "id" });
    if (error) {
      console.error(`✗ chunk ${i}: ${error.message}`);
      process.exit(1);
    }
  }
  console.log(`✓ ${rows.length} sales upserteadas`);
}
