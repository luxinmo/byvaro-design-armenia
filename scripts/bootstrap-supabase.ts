/**
 * scripts/bootstrap-supabase.ts
 * -----------------------------
 * Crea los usuarios demo en Supabase Auth y los conecta a las
 * organizations vía `organization_members`. Idempotente · re-correrlo
 * actualiza memberships sin duplicar.
 *
 * Run · `npm run seed:bootstrap`
 *
 * Requisitos:
 *   - `.env.local` con SUPABASE_SERVICE_ROLE_KEY y VITE_SUPABASE_URL.
 *   - Migrations aplicadas (`npm run db:push`) · si las orgs no
 *     existen, los inserts a `organization_members` fallan por FK.
 *
 * Nota · este script usa el `service_role` key que BYPASSEA RLS · solo
 * para administración. NUNCA exportar la `service_role` al frontend.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import { mockUsers, DEMO_PASSWORD } from "../src/data/mockUsers";

const __dirname = dirname(fileURLToPath(import.meta.url));

/* ─── Cargar .env.local manualmente (sin dotenv para no añadir dep) ─ */
function loadEnvLocal(): Record<string, string> {
  const path = resolve(__dirname, "../.env.local");
  let raw = "";
  try { raw = readFileSync(path, "utf8"); } catch { /* ignore */ }
  const out: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    out[key] = value;
  }
  return out;
}

const env = { ...loadEnvLocal(), ...process.env };
const url = env.VITE_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("✗ Falta VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/* ─── Helpers ────────────────────────────────────────────────────── */

async function findOrCreateUser(email: string, password: string, name: string): Promise<string> {
  /* Buscar primero · si existe, devolver su id (los Admin APIs no
   * tienen un "lookup by email" directo · paginamos hasta encontrar). */
  let page = 1;
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    if (!data.users.length || data.users.length < 200) break;
    page++;
  }
  /* Crear · email_confirmed=true para que pueda hacer login sin
   *  verificar el email. */
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error) throw error;
  return data.user!.id;
}

async function ensureMembership(orgId: string, userId: string, role: "admin" | "member") {
  /* Upsert · si ya hay membership la actualizamos al role correcto. */
  const { error } = await admin
    .from("organization_members")
    .upsert(
      { organization_id: orgId, user_id: userId, role, status: "active" },
      { onConflict: "organization_id,user_id" }
    );
  if (error) throw error;
}

/* ─── Run ─────────────────────────────────────────────────────────── */

async function main() {
  console.log(`▸ Bootstrapping Supabase auth + memberships at ${url}`);
  console.log(`▸ ${mockUsers.length} demo users · password: "${DEMO_PASSWORD}"\n`);

  for (const u of mockUsers) {
    /* `agencyId` actúa como `organizationId` · presente para agencies
     * (`ag-X`) y para developers que no son Luxinmo (`prom-X`). Si el
     * developer no lo lleva, asume Luxinmo (`developer-default`). */
    const orgId = u.agencyId ?? (u.accountType === "developer" ? "developer-default" : "");
    if (!orgId) {
      console.error(`  ✗ ${u.email}: sin agencyId resoluble`);
      continue;
    }
    const role = u.role ?? "admin";
    try {
      const userId = await findOrCreateUser(u.email, u.password, u.name);
      await ensureMembership(orgId, userId, role);
      console.log(`  ✓ ${u.email.padEnd(38)} → ${orgId.padEnd(20)} (${role})`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`  ✗ ${u.email}: ${msg}`);
    }
  }

  console.log(`\n✓ Bootstrap done. Login con cualquier email + password "${DEMO_PASSWORD}".`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
