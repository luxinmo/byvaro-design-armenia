import { chromium } from "playwright";
const BASE = "http://localhost:8080";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const p = await ctx.newPage();
p.on("console", (m) => { if (m.type() === "error") console.log("[err]", m.text()); });
p.on("pageerror", (e) => console.log("[pageerror]", e.message));

await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await p.waitForTimeout(300);
await p.fill("input#login-email", "laura@byvaro.com");
await p.fill("input#login-password", "demo1234");
await p.locator("button", { hasText: "Iniciar sesión" }).click();
await p.waitForURL(/\/inicio/, { timeout: 7000 });
await p.waitForTimeout(1200);

const session = await p.evaluate(() => {
  const keys = Object.keys(sessionStorage);
  const obj = {};
  keys.forEach(k => obj[k] = sessionStorage.getItem(k));
  return obj;
});
console.log("sessionStorage:", JSON.stringify(session, null, 2));

const local = await p.evaluate(() => {
  const keys = Object.keys(localStorage).filter(k => /user|auth|account|byvaro/i.test(k));
  const obj = {};
  keys.forEach(k => obj[k] = localStorage.getItem(k));
  return obj;
});
console.log("localStorage (user/auth/account/byvaro):", JSON.stringify(local, null, 2));

// Check the header pill
const header = await p.locator("header").first().innerText().catch(() => "");
console.log("header:", header);

await browser.close();
