import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASE_URL = "http://localhost:8080";
const OUT_DIR = "screenshots/emails-audit";

const VIEWPORTS = [
  { name: "mobile-375", width: 375, height: 812 },
  { name: "mobile-414", width: 414, height: 896 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 800 },
  { name: "wide-1440", width: 1440, height: 900 },
];

await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

const allErrors = [];
page.on("pageerror", (err) => allErrors.push({ type: "pageerror", text: String(err) }));
page.on("console", (msg) => {
  if (msg.type() === "error") allErrors.push({ type: "console", text: msg.text() });
});

const results = [];
for (const vp of VIEWPORTS) {
  const errorsBefore = allErrors.length;
  await page.setViewportSize({ width: vp.width, height: vp.height });
  const t0 = Date.now();
  try {
    await page.goto(BASE_URL + "/emails", { waitUntil: "networkidle", timeout: 15000 });
  } catch (e) {
    results.push({ viewport: vp.name, error: e.message });
    continue;
  }
  await page.waitForTimeout(600);

  const metrics = await page.evaluate(() => {
    const docEl = document.documentElement;
    // Inspect potential offenders
    const offenders = [];
    const vw = window.innerWidth;
    document.querySelectorAll("*").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 && r.width > 10 && r.height > 5) {
        const tag = el.tagName.toLowerCase();
        const cls = (el.className && typeof el.className === "string") ? el.className.slice(0,120) : "";
        offenders.push({ tag, cls, right: Math.round(r.right), width: Math.round(r.width) });
      }
    });
    return {
      scrollWidth: docEl.scrollWidth,
      clientWidth: docEl.clientWidth,
      scrollHeight: docEl.scrollHeight,
      clientHeight: docEl.clientHeight,
      offenders: offenders.slice(0, 10),
    };
  });

  const shotInitial = join(OUT_DIR, `emails-${vp.width}-initial.png`);
  await page.screenshot({ path: shotInitial, fullPage: false });

  // Try to check if we're in EmailSetup or GmailInterface
  const state = await page.evaluate(() => {
    const setup = document.body.innerText.includes("Conecta") || document.body.innerText.includes("Configura");
    const gmail = !!document.querySelector('[data-gmail-interface]') || document.body.innerText.includes("Bandeja");
    return { setup, gmail, bodyText: document.body.innerText.slice(0, 200) };
  });

  results.push({
    viewport: vp.name,
    width: vp.width,
    ...metrics,
    hasHOverflow: metrics.scrollWidth > metrics.clientWidth + 1,
    state,
    screenshot: shotInitial,
    errors: allErrors.slice(errorsBefore),
    elapsedMs: Date.now() - t0,
  });
  console.log(`${vp.name} (${vp.width}px) overflow=${metrics.scrollWidth > metrics.clientWidth + 1} sw=${metrics.scrollWidth} cw=${metrics.clientWidth}`);
}

await browser.close();
await writeFile(join(OUT_DIR, "report.json"), JSON.stringify({ results, allErrors }, null, 2));
console.log("Done. Report at", join(OUT_DIR, "report.json"));
