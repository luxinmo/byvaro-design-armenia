import { chromium } from "playwright";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const tests = {};

// Login Anna
await page.goto("http://localhost:8080/login", { waitUntil: "networkidle" });
await page.locator('input[type="email"]').fill("anna@nordichomefinders.com");
await page.locator('input[type="password"]').fill("Luxinmo2026Byvaro");
await page.locator('button[type="submit"]').click();
await page.waitForTimeout(1500);

// /inicio KPI
const annaKpi = await page.evaluate(() => {
  const t = document.body.textContent || "";
  const reg = t.match(/Tus registros\s*(\d+)/);
  const ven = t.match(/(\d+)\s*ventas este mes/);
  return { tusRegistros: reg?.[1], ventasMes: ven?.[1] };
});
console.log("→ Anna /inicio KPIs:", JSON.stringify(annaKpi));

// /registros · cuántos ítems
await page.goto("http://localhost:8080/registros", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const annaRegistros = await page.locator('aside ~ * h2, aside ~ * h3').filter({ hasText: /[A-Z]/ }).count();
console.log("→ Anna /registros · h2/h3 count (rough):", annaRegistros);

// Comparar con Erik (admin de la misma agencia)
await page.evaluate(() => sessionStorage.clear());
await page.goto("http://localhost:8080/login", { waitUntil: "networkidle" });
await page.locator('input[type="email"]').fill("erik@nordichomefinders.com");
await page.locator('input[type="password"]').fill("Luxinmo2026Byvaro");
await page.locator('button[type="submit"]').click();
await page.waitForTimeout(1500);

const erikKpi = await page.evaluate(() => {
  const t = document.body.textContent || "";
  const reg = t.match(/Tus registros\s*(\d+)/);
  return { tusRegistros: reg?.[1] };
});
console.log("→ Erik /inicio · Tus registros (admin = todos de Nordic):", JSON.stringify(erikKpi));

await browser.close();
