/**
 * scripts/e2e-verify.mjs
 * ----------------------
 * Smoke test E2E · Playwright. Login con 3 cuentas demo, verifica que
 * la app conecte con Supabase y muestre datos reales (no el banner de
 * "Tu empresa no es visible" ni los seeds de fallback estático).
 *
 * Run · node scripts/e2e-verify.mjs
 */

import { chromium } from "playwright";

const BASE = "http://localhost:8080";
const PASSWORD = "Luxinmo2026Byvaro";

const ACCOUNTS = [
  { email: "arman@byvaro.com",                expectedOrg: "Luxinmo",                  type: "developer" },
  { email: "laura@primeproperties.com",       expectedOrg: "Prime Properties",          type: "agency" },
  { email: "joao@iberialuxuryhomes.pt",       expectedOrg: "Iberia Luxury Homes",       type: "agency" },
];

async function testAccount(browser, account) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  const consoleErrors = [];
  const networkErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(`PageError: ${err.message}`));
  page.on("response", (res) => {
    const url = res.url();
    const status = res.status();
    if (status >= 400 && (url.includes("supabase") || url.includes(BASE))) {
      networkErrors.push(`${status} ${url}`);
    }
  });

  console.log(`\n▸ ${account.email}`);

  // Login
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', account.email);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  /* Esperamos navegación o error · damos 8s. */
  try {
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 8000 });
  } catch {
    const errorMsg = await page.locator('[role="alert"], .text-destructive').first().textContent().catch(() => null);
    console.log(`  ✗ Login failed · stuck on /login · error: ${errorMsg ?? "(none shown)"}`);
    await ctx.close();
    return { ok: false, account, reason: "login-stuck" };
  }

  console.log(`  ✓ Login OK · current URL: ${new URL(page.url()).pathname}`);

  /* Esperamos hidratación. */
  await page.waitForTimeout(2000);

  // Visita /empresa
  await page.goto(`${BASE}/empresa`);
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

  /* Comprobaciones · banner "Tu empresa no es visible" NO debe salir,
   * y el nombre comercial debería aparecer en el hero. */
  const banner = await page.locator("text=Tu empresa no es visible").count();
  const orgNameVisible = await page.locator(`text=${account.expectedOrg}`).count();

  if (banner > 0) {
    console.log(`  ✗ Banner "Tu empresa no es visible" presente (datos no llegaron)`);
  } else {
    console.log(`  ✓ Sin banner "no visible" · datos hidratados`);
  }

  if (orgNameVisible > 0) {
    console.log(`  ✓ Nombre "${account.expectedOrg}" visible en /empresa`);
  } else {
    console.log(`  ✗ Nombre "${account.expectedOrg}" NO encontrado en /empresa`);
  }

  /* localStorage scoped · debería tener byvaro-empresa:<orgId>. */
  const lsKeys = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.startsWith("byvaro-empresa:") || k.startsWith("byvaro-oficinas:"))
  );
  console.log(`  ▸ Scoped localStorage keys: ${lsKeys.length} (${lsKeys.slice(0, 3).join(", ")}${lsKeys.length > 3 ? "..." : ""})`);

  /* Probar /colaboradores · debe listar empresas, no estar vacío. */
  await page.goto(`${BASE}/colaboradores`);
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  const cardCount = await page.locator("article").count();
  console.log(`  ▸ /colaboradores muestra ${cardCount} cards`);

  if (consoleErrors.length > 0) {
    console.log(`  ✗ Console errors (${consoleErrors.length}):`);
    consoleErrors.slice(0, 5).forEach((e) => console.log(`    · ${e.slice(0, 200)}`));
  }
  if (networkErrors.length > 0) {
    console.log(`  ✗ Network errors (${networkErrors.length}):`);
    networkErrors.slice(0, 5).forEach((e) => console.log(`    · ${e}`));
  }

  await ctx.close();
  return {
    ok: banner === 0 && orgNameVisible > 0 && consoleErrors.length === 0,
    account,
    consoleErrors,
    networkErrors,
    banner,
    orgNameVisible,
    cardCount,
    lsKeys: lsKeys.length,
  };
}

const browser = await chromium.launch({ headless: true });
const results = [];
for (const a of ACCOUNTS) {
  results.push(await testAccount(browser, a));
}
await browser.close();

console.log("\n══ Summary ══");
for (const r of results) {
  console.log(`${r.ok ? "✓" : "✗"} ${r.account.email}`);
}
const allOk = results.every((r) => r.ok);
process.exit(allOk ? 0 : 1);
