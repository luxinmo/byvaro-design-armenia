/**
 * Quick debug · ¿dónde se ve / no se ve el logo nuevo de ag-1?
 */
import { chromium } from "playwright";
const BASE = process.argv[2] ?? "http://localhost:8080";
const PASSWORD = "Luxinmo2026Byvaro";

const browser = await chromium.launch({ headless: true });

async function asUser(email) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });
  await page.waitForTimeout(3000); // hidratación
  return { ctx, page };
}

async function inspectLogos(page, label) {
  // Get all <img> elements and their src
  const imgs = await page.$$eval("img", (els) =>
    els
      .map((e) => ({
        alt: e.alt,
        srcStart: e.currentSrc?.slice(0, 80) ?? "",
        isData: e.currentSrc?.startsWith("data:") ?? false,
      }))
      .filter((i) => /prime/i.test(i.alt) || /Prime/i.test(i.alt) || i.alt === "")
  );
  console.log(`  ${label} · ${imgs.length} imgs analizadas`);
  imgs.slice(0, 8).forEach((i) =>
    console.log(`    ${i.isData ? "📎" : "🌐"} alt="${i.alt}" · ${i.srcStart}`)
  );
}

console.log("══ Como Laura (ag-1) en /empresa ══");
{
  const { ctx, page } = await asUser("laura@primeproperties.com");
  await page.goto(`${BASE}/empresa`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await inspectLogos(page, "/empresa hero");
  // localStorage scoped key
  const ls = await page.evaluate(() => {
    const v = localStorage.getItem("byvaro-empresa:ag-1");
    if (!v) return null;
    const p = JSON.parse(v);
    return { logoIsData: p.logoUrl?.startsWith("data:"), logoLen: p.logoUrl?.length };
  });
  console.log(`  localStorage byvaro-empresa:ag-1 → ${JSON.stringify(ls)}`);
  await ctx.close();
}

console.log("\n══ Como Arman (developer) en /colaboradores ══");
{
  const { ctx, page } = await asUser("arman@byvaro.com");
  await page.goto(`${BASE}/colaboradores`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await inspectLogos(page, "/colaboradores listing");
  await ctx.close();
}

console.log("\n══ Como Arman (developer) en /colaboradores/ag-1 ══");
{
  const { ctx, page } = await asUser("arman@byvaro.com");
  await page.goto(`${BASE}/colaboradores/ag-1`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await inspectLogos(page, "/colaboradores/ag-1 hero");
  await ctx.close();
}

await browser.close();
