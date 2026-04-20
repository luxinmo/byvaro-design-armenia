import { chromium } from "playwright";
const b = await chromium.launch();
for (const w of [375, 768]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 812 } });
  const p = await ctx.newPage();
  await p.goto("http://localhost:8080/promociones/1", { waitUntil: "networkidle" });
  await p.waitForTimeout(400);
  const bp = await p.$('button[aria-label="Abrir acciones"]');
  if (bp) await bp.click();
  await p.waitForTimeout(300);
  await p.evaluate(() => Array.from(document.querySelectorAll("button")).find(b => /Listado de precios/.test(b.textContent||""))?.click());
  await p.waitForTimeout(600);
  await p.screenshot({ path: `/tmp/plist-${w}.png`, fullPage: false });
  await ctx.close();
}
console.log("OK");
await b.close();
