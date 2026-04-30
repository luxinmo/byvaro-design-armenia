import { chromium } from "playwright";
import fs from "fs";
const OUT = "/tmp/inm-screens";
fs.mkdirSync(OUT, { recursive: true });
fs.readdirSync(OUT).forEach((f) => fs.unlinkSync(`${OUT}/${f}`));
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
  let ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await loginAs(ctx, "developer", "arman@byvaro.com");
  let page = await ctx.newPage();
  await page.goto(`${URL_BASE}/inmuebles`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${vp}-developer.png`, fullPage: true });
  console.log(`✓ ${vp}-developer.png`);
  await ctx.close();

  ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await loginAs(ctx, "agency", "laura@primeproperties.com", "ag-1");
  page = await ctx.newPage();
  await page.goto(`${URL_BASE}/inmuebles`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${vp}-agency.png`, fullPage: true });
  console.log(`✓ ${vp}-agency.png`);
  await ctx.close();
}

await browser.close();
