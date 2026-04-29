import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

page.on("request", (req) => {
  const url = req.url();
  if (url.includes("supabase.co/rest/v1/organizations") && !url.includes("organization_")) {
    const headers = req.headers();
    console.log(`\n${req.method()} ${url}`);
    console.log(`  apikey: ${headers["apikey"]?.slice(0, 30) ?? "(none)"}`);
    console.log(`  authorization: ${headers["authorization"]?.slice(0, 30) ?? "(none)"}`);
  }
});

await page.goto("https://byvaro-design-armenia.vercel.app/login", { waitUntil: "networkidle" });
await page.fill('input[type="email"]', "arman@byvaro.com");
await page.fill('input[type="password"]', "Luxinmo2026Byvaro");
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 12000 });
await page.waitForTimeout(5000);
await browser.close();
