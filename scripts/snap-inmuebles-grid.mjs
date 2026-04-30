import { chromium } from "playwright";
import fs from "fs";
const OUT = "/tmp/inm-screens";
fs.mkdirSync(OUT, { recursive: true });
const URL_BASE = "http://localhost:8080";
const browser = await chromium.launch({ headless: true });

async function loginAs(ctx, kind, email, agencyId) {
  await ctx.addInitScript(({ kind, email, agencyId }) => {
    sessionStorage.setItem("byvaro.accountType.v1", kind);
    if (kind === "developer") {
      sessionStorage.setItem("byvaro.accountType.developerEmail.v1", email);
    } else {
      sessionStorage.setItem("byvaro.accountType.agencyId.v1", agencyId);
      sessionStorage.setItem("byvaro.accountType.agencyEmail.v1", email);
    }
  }, { kind, email, agencyId });
}

const SCENARIOS = [
  { vp: "desktop", w: 1600, h: 900 },
  { vp: "mobile", w: 390, h: 844 },
];

for (const { vp, w, h } of SCENARIOS) {
  // Developer
  let ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await loginAs(ctx, "developer", "arman@byvaro.com");
  let page = await ctx.newPage();
  await page.goto(`${URL_BASE}/inmuebles`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  // click Cuadrícula
  await page.getByRole("radio", { name: /cuadr/i }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${vp}-grid-developer.png`, fullPage: true });
  console.log(`✓ ${vp}-grid-developer.png`);
  await ctx.close();

  // Agency
  ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await loginAs(ctx, "agency", "laura@primeproperties.com", "ag-1");
  page = await ctx.newPage();
  await page.goto(`${URL_BASE}/inmuebles`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.getByRole("radio", { name: /cuadr/i }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${vp}-grid-agency.png`, fullPage: true });
  console.log(`✓ ${vp}-grid-agency.png`);
  await ctx.close();
}

await browser.close();
