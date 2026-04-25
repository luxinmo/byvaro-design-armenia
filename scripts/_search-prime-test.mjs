import { chromium } from "playwright";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto("http://localhost:8080/login", { waitUntil: "networkidle" });
await page.fill('input[type="email"]', "arman@byvaro.com");
await page.fill('input[type="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForTimeout(1500);
await page.goto("http://localhost:8080/registros", { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.locator('button:has-text("Filtros")').first().click();
await page.waitForTimeout(500);
// Type "prime" in the agency search input (placeholder "Buscar por nombre o ubicación…")
const agencyInput = page.locator('input[placeholder*="nombre o ubicaci" i]').first();
await agencyInput.fill("prime");
await page.waitForTimeout(400);
await page.screenshot({ path: "/Users/armanyeghiazaryan/byvaro-design-armenia/screenshots/filter-drawer/06-registros-search-prime-real.png" });
const visibleAgencies = await page.evaluate(() => {
  const drawer = document.querySelector('[role="dialog"]') || document.querySelector('aside.fixed');
  if (!drawer) return null;
  const txt = drawer.textContent || "";
  return {
    hasPrime: txt.includes("Prime Properties"),
    hasNordic: txt.includes("Nordic"),
    hasDutch: txt.includes("Dutch"),
    hasMeridian: txt.includes("Meridian"),
  };
});
console.log("Search 'prime' result:", JSON.stringify(visibleAgencies));
await ctx.close();
await browser.close();
