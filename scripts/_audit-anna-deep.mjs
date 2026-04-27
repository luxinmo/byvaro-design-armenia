import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto("http://localhost:8080/login", { waitUntil: "networkidle" });
await page.locator('input[type="email"]').fill("anna@nordichomefinders.com");
await page.locator('input[type="password"]').fill("Luxinmo2026Byvaro");
await page.locator('button[type="submit"]').click();
await page.waitForTimeout(1500);

// Inicio - KPIs
console.log("→ /inicio");
const kpis = await page.evaluate(() => {
  const cards = document.querySelectorAll('[class*="grid-cols-2"]:not([class*="lg:grid-cols-3"]) > div, [class*="grid-cols-4"] > div');
  return [...cards].slice(0, 8).map(c => c.textContent?.trim().replace(/\s+/g, " "));
});
console.log("→ KPIs:", JSON.stringify(kpis.slice(0, 4)));

// Registros - real data
await page.goto("http://localhost:8080/registros", { waitUntil: "networkidle" });
await page.waitForTimeout(800);

const registroData = await page.evaluate(() => {
  // Encontrar todos los items reales del listado
  const buttons = document.querySelectorAll('aside ~ * button');
  const records = [];
  for (const b of buttons) {
    const text = b.textContent?.trim();
    if (text && (text.includes("@") || text.length > 30 && text.length < 200)) {
      records.push(text.replace(/\s+/g, " ").slice(0, 80));
    }
  }
  return { count: records.length, samples: records.slice(0, 5) };
});
console.log("→ /registros · candidates:", registroData.count, "samples:", registroData.samples);

// /ventas
await page.goto("http://localhost:8080/ventas", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const ventasInfo = await page.evaluate(() => {
  const t = document.body.textContent || "";
  const numberMatch = t.match(/(\d+)\s*ventas/i);
  return numberMatch ? numberMatch[0] : "no match";
});
console.log("→ /ventas info:", ventasInfo);

// /contactos
await page.goto("http://localhost:8080/contactos", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const contactosCount = await page.locator('a[href^="/contactos/"]').count();
console.log("→ /contactos · enlaces individuales:", contactosCount);

// /promociones · cartera
await page.goto("http://localhost:8080/promociones", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const promocionesInfo = await page.evaluate(() => {
  const t = document.body.textContent || "";
  return t.slice(0, 300);
});
console.log("→ /promociones (sample):", promocionesInfo.slice(0, 200));

await browser.close();
