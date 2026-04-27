import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto("http://localhost:8080/invite/demo-caso1-nuevo?auto=1", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

// Click en "Quiero invitar al Responsable"
await page.locator('text=Quiero invitar al Responsable').click();
await page.waitForTimeout(300);
// Continuar
await page.locator('text=Continuar').click();
await page.waitForTimeout(800);

// ¿Hay PhoneInput?
const phoneInputCount = await page.locator('input[placeholder*="600"]').count();
const flagButtonCount = await page.locator('[role="dialog"] button').filter({ hasText: /^$/ }).count();
console.log("→ Phone input visible:", phoneInputCount > 0);

// Click en la bandera para abrir el popover
const phoneRow = page.locator('[role="dialog"]').locator("text=Teléfono").first();
console.log("→ Field 'Teléfono' visible:", await phoneRow.isVisible().catch(() => false));

await page.screenshot({ path: "/tmp/responsible-form.png", fullPage: false });
console.log("→ Screenshot guardado: /tmp/responsible-form.png");

await browser.close();
