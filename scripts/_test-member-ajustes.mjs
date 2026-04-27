import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on("pageerror", (err) => errors.push(`[pageerror] ${err.message}`));

// 1. Login como agency MEMBER (tom@primeproperties.com)
console.log("→ STEP 1 · Login como agency member");
await page.goto("http://localhost:8080/login", { waitUntil: "networkidle" });
await page.locator('input[type="email"]').fill("tom@primeproperties.com");
await page.locator('input[type="password"]').fill("Luxinmo2026Byvaro");
await page.locator('button[type="submit"]').click();
await page.waitForTimeout(1500);

console.log("→ URL tras login:", page.url());

// 2. Comprobar que NO se ve "Ajustes" en sidebar
const ajustesInSidebar = await page.locator('aside a[href="/ajustes"]').count();
console.log("→ Links a /ajustes en sidebar:", ajustesInSidebar);

// 3. Forzar URL /ajustes · debe redirigir a /inicio
console.log("→ STEP 3 · URL directa /ajustes");
await page.goto("http://localhost:8080/ajustes", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
console.log("→ URL tras intentar /ajustes:", page.url());

// 4. Lo mismo pero como admin (laura@primeproperties.com)
console.log("→ STEP 4 · Logout + login como admin");
await page.evaluate(() => sessionStorage.clear());
await page.goto("http://localhost:8080/login", { waitUntil: "networkidle" });
await page.locator('input[type="email"]').fill("laura@primeproperties.com");
await page.locator('input[type="password"]').fill("Luxinmo2026Byvaro");
await page.locator('button[type="submit"]').click();
await page.waitForTimeout(1500);

const ajustesAdmin = await page.locator('aside a[href="/ajustes"]').count();
console.log("→ Admin agency · Links a /ajustes:", ajustesAdmin);

if (errors.length) {
  console.log("\n❌ ERRORES:");
  for (const e of errors) console.log("  ", e);
} else {
  console.log("\n✅ Sin errores");
}

await browser.close();
