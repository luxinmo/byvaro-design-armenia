import { chromium } from "playwright";
const BASE = "https://byvaro-design-armenia.vercel.app";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

page.on("response", async (res) => {
  const url = res.url();
  if (url.includes("supabase.co/rest/v1/organizations") && !url.includes("organization_")) {
    const body = await res.body().catch(() => null);
    const text = body?.toString("utf-8").slice(0, 400) ?? "(no body)";
    console.log(`\n[${res.status()}] ${url}`);
    console.log(`  Body (first 400 chars): ${text}`);
  }
});

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[type="email"]', "arman@byvaro.com");
await page.fill('input[type="password"]', "Luxinmo2026Byvaro");
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 12000 });
await page.waitForTimeout(5500);
await browser.close();
