import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on("pageerror", (err) => errors.push(`[pageerror] ${err.message}`));

console.log("→ STEP A · Auto signup (Agente Demo)");
await page.goto("http://localhost:8080/invite/demo-caso1-nuevo?auto=1", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const ajustesAfterSignup = await page.locator('aside a[href="/ajustes"]').count();
console.log("→ Ajustes en sidebar tras signup (modal abierto · setup pending):", ajustesAfterSignup);

console.log("→ STEP B · Click X (defer 'Lo haré más tarde')");
await page.locator('[role="dialog"]').locator('button:has(span:text("Close"))').click({ timeout: 5000 }).catch(() => page.keyboard.press("Escape"));
await page.waitForTimeout(800);

const ajustesDeferred = await page.locator('aside a[href="/ajustes"]').count();
console.log("→ Ajustes en sidebar tras X (deferred):", ajustesDeferred);

const url1 = page.url();
console.log("→ URL actual:", url1);

console.log("→ STEP C · Intentar URL directa /ajustes");
await page.goto("http://localhost:8080/ajustes", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
console.log("→ URL tras intentar /ajustes:", page.url());

console.log("→ STEP D · Volver, abrir banner, elegir 'Soy el Responsable' + T&C");
await page.goto("http://localhost:8080/inicio", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.locator('text=Continuar configuración').click();
await page.waitForTimeout(500);
await page.locator('text=Soy el Responsable').click();
await page.waitForTimeout(200);
await page.locator('button:has-text("Continuar")').click();
await page.waitForTimeout(400);
await page.locator('input[type="checkbox"]').check();
await page.waitForTimeout(200);
await page.locator('button:has-text("Activar mi rol de Responsable")').click();
await page.waitForTimeout(800);

const ajustesAfterSelf = await page.locator('aside a[href="/ajustes"]').count();
console.log("→ Ajustes en sidebar tras 'Soy el Responsable' + T&C:", ajustesAfterSelf);

if (errors.length) {
  console.log("\n❌ ERRORES:");
  for (const e of errors) console.log("  ", e);
} else {
  console.log("\n✅ Sin errores");
}

await browser.close();
