import { chromium } from "playwright";
import { join } from "node:path";

const OUT = "/private/tmp/byvaro-edit-contact-audit/shots";
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

await page.setViewportSize({ width: 375, height: 812 });
await page.goto("http://localhost:8080/contactos/ahmed-al-rashid", { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.locator('button:has(svg.lucide-pencil)').first().click();
await page.waitForTimeout(600);

/* Scroll a la sección Teléfonos */
const dialog = page.locator('[role="dialog"]').first();
const region = page.locator('div.flex-1.overflow-y-auto').first();
/* Scroll a posición media (alrededor de 500px). */
await region.evaluate((el) => { el.scrollTop = 470; });
await page.waitForTimeout(300);
await page.screenshot({ path: join(OUT, '06-mobile-phones-mid.png'), fullPage: false });

/* Añadir un segundo teléfono para ver la fila completa con trash. */
const addPhone = dialog.getByRole('button', { name: /A.adir tel.fono/i });
await addPhone.click();
await page.waitForTimeout(250);
await region.evaluate((el) => { el.scrollTop = 520; });
await page.waitForTimeout(200);
await page.screenshot({ path: join(OUT, '07-mobile-phones-2-rows.png'), fullPage: false });

/* Captura midsection con ambas filas. */
await region.evaluate((el) => { el.scrollTop = 600; });
await page.waitForTimeout(200);
await page.screenshot({ path: join(OUT, '08-mobile-phones-fully-expanded.png'), fullPage: false });

/* Tablet phone wrap check */
await page.setViewportSize({ width: 768, height: 1024 });
await page.waitForTimeout(300);
const dialog2 = page.locator('[role="dialog"]').first();
if (await dialog2.isVisible().catch(() => false)) {
  /* dialog ya abierto */
} else {
  await page.locator('button:has(svg.lucide-pencil)').first().click();
  await page.waitForTimeout(500);
}
const region2 = page.locator('div.flex-1.overflow-y-auto').first();
await region2.evaluate((el) => { el.scrollTop = 350; });
await page.waitForTimeout(200);
await page.screenshot({ path: join(OUT, '09-tablet-phones-section.png'), fullPage: false });

/* Desktop nationality + flag close-up */
await page.setViewportSize({ width: 1440, height: 900 });
await page.waitForTimeout(300);
const region3 = page.locator('div.flex-1.overflow-y-auto').first();
await region3.evaluate((el) => { el.scrollTop = 220; });
await page.waitForTimeout(200);
await page.screenshot({ path: join(OUT, '10-desktop-nationality.png'), fullPage: false });

await browser.close();
console.log('DONE');
