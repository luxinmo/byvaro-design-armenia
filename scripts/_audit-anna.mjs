import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on("pageerror", (err) => errors.push(`[pageerror] ${err.message}`));

console.log("→ Login Anna (Nordic Home Finders · member)");
await page.goto("http://localhost:8080/login", { waitUntil: "networkidle" });
await page.locator('input[type="email"]').fill("anna@nordichomefinders.com");
await page.locator('input[type="password"]').fill("Luxinmo2026Byvaro");
await page.locator('button[type="submit"]').click();
await page.waitForTimeout(1500);

console.log("→ URL tras login:", page.url());

// Currentuser snapshot
const userInfo = await page.evaluate(() => {
  const accountType = sessionStorage.getItem("byvaro.accountType.v1");
  const agencyId = sessionStorage.getItem("byvaro.accountType.agencyId.v1");
  const agencyEmail = sessionStorage.getItem("byvaro.accountType.agencyEmail.v1");
  return { accountType, agencyId, agencyEmail };
});
console.log("→ Sesión:", JSON.stringify(userInfo));

// Sidebar: lo que ve
const sidebarLinks = await page.evaluate(() => {
  const links = document.querySelectorAll('aside a[href]');
  return [...links].map((l) => ({ href: l.getAttribute("href"), text: l.textContent?.trim().slice(0, 30) })).filter(l => l.href);
});
console.log("→ Links en sidebar:");
for (const l of sidebarLinks) console.log("  ", l.href, "·", l.text);

// Header avatar / nombre que sale
const avatarText = await page.locator('aside').last().textContent().catch(() => null);
const userName = await page.evaluate(() => {
  const all = document.querySelectorAll('aside *');
  for (const el of all) {
    const t = el.textContent?.trim();
    if (t && t.length < 50 && (t.includes("Anna") || t.includes("anna"))) return t;
  }
  return null;
});
console.log("→ Nombre/email visible en sidebar:", userName);

// Probar /registros
await page.goto("http://localhost:8080/registros", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const registroCount = await page.locator('main button[class*="rounded"]').count();
console.log("→ Items en /registros:", registroCount);

// Probar /ventas
await page.goto("http://localhost:8080/ventas", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const ventasUrl = page.url();
console.log("→ /ventas URL final:", ventasUrl);

// Probar /contactos
await page.goto("http://localhost:8080/contactos", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
console.log("→ /contactos URL:", page.url());

// Probar /emails
await page.goto("http://localhost:8080/emails", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
console.log("→ /emails URL:", page.url());
const emailVisible = await page.locator('text=anna@mail.byvaro.com').count();
console.log("→ Cuenta anna@mail.byvaro.com visible:", emailVisible > 0);

if (errors.length) {
  console.log("\n❌ ERRORES:"); for (const e of errors) console.log("  ", e);
} else {
  console.log("\n✅ Sin errores");
}
await browser.close();
