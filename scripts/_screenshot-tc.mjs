import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

console.log("→ Reset + signup");
await page.goto("http://localhost:8080/", { waitUntil: "networkidle" });
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.goto("http://localhost:8080/invite/demo-caso1-nuevo?auto=1", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

console.log("→ Click 'Soy el Responsable'");
await page.locator('text=Soy el Responsable').click();
await page.waitForTimeout(200);
await page.locator('button[role="button"]:has-text("Continuar"), button:has-text("Continuar")').filter({ hasText: /^Continuar$/ }).first().click();
await page.waitForTimeout(500);

await page.screenshot({ path: "/tmp/tc-collapsed.png", fullPage: false });
console.log("→ Screenshot collapsed: /tmp/tc-collapsed.png");

console.log("→ Expand 'Ver términos completos'");
await page.locator('text=Términos del Responsable · v').click();
await page.waitForTimeout(400);
await page.screenshot({ path: "/tmp/tc-expanded.png", fullPage: false });
console.log("→ Screenshot expanded: /tmp/tc-expanded.png");

await browser.close();
