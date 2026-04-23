import { chromium } from "playwright";
import { mkdir } from "fs/promises";
const BASE = "http://localhost:8080";
const OUT = "/tmp/byvaro-promo-filter";
await mkdir(OUT, { recursive: true });

async function main() {
  const browser = await chromium.launch({ headless: true });
  for (const [role, name] of [["promotor", "Arman Rahmanov"], ["agencia", "Laura Sánchez"]]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await p.locator("button", { hasText: name }).first().click();
    await p.waitForURL(/\/inicio/, { timeout: 8000 });
    await p.goto(`${BASE}/promociones`, { waitUntil: "networkidle" });
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${OUT}/${role}-promociones.png`, fullPage: true });
    await ctx.close();
  }
  await browser.close();
  console.log(`📸 ${OUT}`);
}
main().catch(e => { console.error(e); process.exit(1); });
