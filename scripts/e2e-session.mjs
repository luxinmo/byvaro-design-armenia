import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

await page.goto("https://byvaro-design-armenia.vercel.app/login", { waitUntil: "networkidle" });
await page.fill('input[type="email"]', "arman@byvaro.com");
await page.fill('input[type="password"]', "Luxinmo2026Byvaro");
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 12000 });
await page.waitForTimeout(3000);

const session = await page.evaluate(() => {
  const v = localStorage.getItem("byvaro.supabase.auth.v1");
  if (!v) return null;
  const parsed = JSON.parse(v);
  return {
    keys: Object.keys(parsed),
    accessToken: parsed.access_token?.slice(0, 60),
    user: parsed.user?.email,
    expiresAt: parsed.expires_at,
    nowIso: new Date().toISOString(),
  };
});
console.log(JSON.stringify(session, null, 2));
await browser.close();
