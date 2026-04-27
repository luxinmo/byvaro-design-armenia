import { chromium } from "playwright";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1680, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", (err) => console.log("[pageerror]", err.message));

console.log("→ Reset · login arman");
await page.goto("http://localhost:8080/", { waitUntil: "networkidle" });
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.goto("http://localhost:8080/login", { waitUntil: "networkidle" });
await page.locator('input[type="email"]').fill("arman@byvaro.com");
await page.locator('input[type="password"]').fill("Luxinmo2026Byvaro");
await page.locator('button[type="submit"]').click();
await page.waitForTimeout(1500);

console.log("→ Estado inicial empresa");
let empresa = await page.evaluate(() => JSON.parse(localStorage.getItem("byvaro-empresa") || "{}"));
console.log("→ byvaro-empresa inicial:", JSON.stringify(empresa).slice(0, 100));

console.log("→ Ir a /ajustes/empresa/datos");
await page.goto("http://localhost:8080/ajustes/empresa/datos", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);

const titleField = await page.locator('input[type="text"]').first();
const isVisible = await titleField.isVisible().catch(() => false);
console.log("→ Primer input visible:", isVisible);
if (isVisible) {
  const currentValue = await titleField.inputValue();
  console.log("→ Valor actual primer campo:", currentValue);
}

await browser.close();
