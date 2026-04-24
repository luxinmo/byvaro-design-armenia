import { chromium } from "playwright";
const BASE = "http://localhost:8080";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await p.fill("input#login-email", "laura@byvaro.com");
await p.fill("input#login-password", "demo1234");
await p.locator("button", { hasText: "Iniciar sesión" }).click();
await p.waitForURL(/\/inicio/, { timeout: 7000 });
await p.waitForTimeout(1000);

const sidebar = await p.locator("aside").first().innerText().catch(() => "");
console.log("=== sidebar text ===");
console.log(sidebar);
console.log("=== end ===");

// Look for footer area
const footerBtn = await p.locator("aside button[aria-haspopup='menu']").last();
const has = await footerBtn.count();
console.log("footer menu button count:", has);
if (has) {
  const footerInner = await footerBtn.innerHTML();
  console.log("footer HTML snippet:");
  console.log(footerInner.slice(0, 500));
}

await browser.close();
