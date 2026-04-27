import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

console.log("→ Reset + Auto signup (Agente Demo · admin con setup pendiente)");
await page.goto("http://localhost:8080/", { waitUntil: "networkidle" });
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.goto("http://localhost:8080/invite/demo-caso1-nuevo?auto=1", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

console.log("→ STEP 1 · Cerrar modal con X (defer)");
await page.locator('[role="dialog"]').locator('button:has(span:text("Close"))').click({ timeout: 5000 }).catch(() => page.keyboard.press("Escape"));
await page.waitForTimeout(800);

console.log("→ STEP 2 · Verificar que Empresa, Equipo y Ajustes SÍ aparecen en sidebar (admin · setup pending)");
const empresaLink = await page.locator('aside a[href="/empresa"]').count();
const equipoLink = await page.locator('aside a[href="/equipo"]').count();
const ajustesLink = await page.locator('aside a[href="/ajustes"]').count();
console.log("→ Empresa link:", empresaLink, "· Equipo link:", equipoLink, "· Ajustes link:", ajustesLink);

console.log("→ STEP 3 · Click en Empresa · debe abrir modal de Responsable");
await page.locator('aside a[href="/empresa"]').click();
await page.waitForTimeout(800);
console.log("→ URL:", page.url());
const modalVisible = await page.locator('[role="dialog"]').first().isVisible();
console.log("→ Modal visible al entrar en /empresa:", modalVisible);

console.log("→ STEP 4 · Cerrar modal · debe volver a /inicio");
await page.locator('[role="dialog"]').locator('button:has(span:text("Close"))').click({ timeout: 5000 }).catch(() => page.keyboard.press("Escape"));
await page.waitForTimeout(800);
console.log("→ URL tras cerrar:", page.url());

console.log("→ STEP 5 · Misma prueba con /equipo");
await page.locator('aside a[href="/equipo"]').click();
await page.waitForTimeout(800);
const equipoModal = await page.locator('[role="dialog"]').first().isVisible();
console.log("→ Modal visible al entrar /equipo:", equipoModal);
await page.locator('[role="dialog"]').locator('button:has(span:text("Close"))').click({ timeout: 5000 }).catch(() => page.keyboard.press("Escape"));
await page.waitForTimeout(800);
console.log("→ URL tras cerrar /equipo:", page.url());

await browser.close();
