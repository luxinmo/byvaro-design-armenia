import { chromium } from "playwright";
const BASE = process.argv[2] ?? "https://byvaro-design-armenia.vercel.app";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

const requests = [];
page.on("request", (req) => {
  const url = req.url();
  if (url.includes("supabase.co")) requests.push({ method: req.method(), url });
});
page.on("response", (res) => {
  const url = res.url();
  if (url.includes("supabase.co/rest/v1/organizations")) {
    console.log(`[${res.status()}] ${url}`);
  }
});
page.on("console", (m) => {
  if (m.type() === "warning" || m.type() === "error") {
    console.log(`[console.${m.type()}] ${m.text().slice(0, 200)}`);
  }
});

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[type="email"]', "arman@byvaro.com");
await page.fill('input[type="password"]', "Luxinmo2026Byvaro");
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 12000 });
await page.waitForTimeout(5500);

console.log(`\n══ Supabase requests (${requests.length}) ══`);
const grouped = {};
for (const r of requests) {
  const path = new URL(r.url).pathname.replace(/\?.*/, "").split("?")[0];
  grouped[`${r.method} ${path}`] = (grouped[`${r.method} ${path}`] ?? 0) + 1;
}
for (const [k, v] of Object.entries(grouped)) console.log(`  ${v}× ${k}`);

await browser.close();
