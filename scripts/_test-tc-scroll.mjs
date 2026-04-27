import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

console.log("→ Reset + signup");
await page.goto("http://localhost:8080/", { waitUntil: "networkidle" });
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.goto("http://localhost:8080/invite/demo-caso1-nuevo?auto=1", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

console.log("→ 'Soy el Responsable' + Continuar");
await page.locator('text=Soy el Responsable').click();
await page.waitForTimeout(200);
await page.locator('button:has-text("Continuar")').last().click();
await page.waitForTimeout(500);

await page.screenshot({ path: "/tmp/tc-step-initial.png", fullPage: false });
console.log("→ Screenshot inicial: /tmp/tc-step-initial.png");

// Estado inicial · checkbox debe estar disabled
const cbBefore = await page.locator('input[type="checkbox"]').isDisabled();
console.log("→ Checkbox disabled antes de scroll:", cbBefore);

const btnBefore = await page.locator('button:has-text("Activar mi rol")').isDisabled();
console.log("→ Botón disabled antes de scroll:", btnBefore);

// Scroll dentro del body del modal hasta el final
console.log("→ Scrolling al final del documento legal");
await page.evaluate(() => {
  const scrollable = document.querySelector('[role="dialog"] [class*="overflow-y-auto"]');
  if (scrollable) {
    scrollable.scrollTop = scrollable.scrollHeight;
  }
});
await page.waitForTimeout(400);

await page.screenshot({ path: "/tmp/tc-step-scrolled.png", fullPage: false });
console.log("→ Screenshot tras scroll: /tmp/tc-step-scrolled.png");

const cbAfter = await page.locator('input[type="checkbox"]').isDisabled();
console.log("→ Checkbox disabled tras scroll:", cbAfter);

// Marcarlo
await page.locator('input[type="checkbox"]').check();
await page.waitForTimeout(200);

const btnAfter = await page.locator('button:has-text("Activar mi rol")').isDisabled();
console.log("→ Botón disabled tras check:", btnAfter);

await page.screenshot({ path: "/tmp/tc-step-checked.png", fullPage: false });

// Activar
await page.locator('button:has-text("Activar mi rol")').click();
await page.waitForTimeout(800);

console.log("\n═══ Validation ═══");
console.log(cbBefore ? "✅" : "❌", "Checkbox bloqueado antes de scroll");
console.log(!cbAfter ? "✅" : "❌", "Checkbox habilitado tras llegar al final");
console.log(btnBefore ? "✅" : "❌", "Botón bloqueado sin checkbox");
console.log(!btnAfter ? "✅" : "❌", "Botón habilitado con checkbox marcado");

await browser.close();
