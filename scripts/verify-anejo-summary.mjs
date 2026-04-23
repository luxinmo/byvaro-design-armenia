import { chromium } from "playwright";
import { mkdir } from "fs/promises";
const BASE = "http://localhost:8080";
const OUT = "/tmp/byvaro-anejo-summary";
await mkdir(OUT, { recursive: true });

async function main() {
  const browser = await chromium.launch({ headless: true });
  for (const [role, name] of [["promotor", "Arman Rahmanov"], ["agencia", "Laura Sánchez"]]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => console.log(`[${role}-pageerror]`, e.message));

    await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await p.locator("button", { hasText: name }).first().click();
    await p.waitForURL(/\/inicio/, { timeout: 8000 });
    await p.goto(`${BASE}/promociones`, { waitUntil: "networkidle" });
    await p.waitForTimeout(500);
    await p.locator("main article.cursor-pointer").first().click();
    await p.waitForLoadState("networkidle");
    await p.waitForTimeout(700);
    await p.screenshot({ path: `${OUT}/${role}-vista-general.png`, fullPage: true });

    if (role === "promotor") {
      // Abrir modal
      const addBtn = p.locator("button", { hasText: /Añadir anejo/ }).first();
      if (await addBtn.count()) {
        await addBtn.click();
        await p.waitForTimeout(400);
        await p.screenshot({ path: `${OUT}/${role}-modal-anejo.png`, fullPage: false });
      }
    }
    await ctx.close();
  }
  await browser.close();
  console.log(`📸 ${OUT}`);
}
main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
