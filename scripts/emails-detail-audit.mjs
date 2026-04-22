import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASE_URL = "http://localhost:8080";
const OUT_DIR = "/Users/armanyeghiazaryan/byvaro-design-armenia/screenshots/emails-detail-audit";
await mkdir(OUT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: "375", width: 375, height: 812 },
  { name: "414", width: 414, height: 896 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 800 },
  { name: "1440", width: 1440, height: 900 },
];

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

const allErrors = [];
page.on("pageerror", (err) => allErrors.push({ type: "pageerror", text: String(err) }));
page.on("console", (msg) => {
  if (msg.type() === "error") allErrors.push({ type: "console", text: msg.text() });
});

// Evalúa el sidebar de folders de Gmail (no el AppSidebar global)
const INSPECT = () => {
  const docEl = document.documentElement;
  // El sidebar del cliente de correo tiene 'bg-card' y 'rounded-2xl' y contiene "Bandeja de entrada"
  const folderAside = Array.from(document.querySelectorAll("aside")).find(a =>
    a.className.includes("rounded-2xl") && a.className.includes("bg-card")
  );
  const fRect = folderAside?.getBoundingClientRect();
  const fVisible = folderAside && getComputedStyle(folderAside).display !== "none" && (fRect?.width || 0) > 5;

  const main = document.querySelector("main");
  const mainRect = main ? main.getBoundingClientRect() : null;

  const backBtn = document.querySelector('button[title="Volver a la bandeja"]');
  let backInfo = null;
  if (backBtn) {
    const r = backBtn.getBoundingClientRect();
    const span = backBtn.querySelector("span");
    const spanVisible = span ? getComputedStyle(span).display !== "none" : false;
    const hasChevron = !!backBtn.querySelector("svg.lucide-chevron-left");
    backInfo = {
      present: true,
      text: backBtn.textContent?.trim() || "",
      spanText: span?.textContent?.trim() || null,
      spanVisible,
      hasChevron,
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    };
  }

  return {
    sw: docEl.scrollWidth,
    cw: docEl.clientWidth,
    hasOverflow: docEl.scrollWidth > docEl.clientWidth + 1,
    folderSidebarVisible: !!fVisible,
    folderSidebarWidth: fRect ? Math.round(fRect.width) : 0,
    mainWidth: mainRect ? Math.round(mainRect.width) : 0,
    mainLeft: mainRect ? Math.round(mainRect.left) : 0,
    mainRight: mainRect ? Math.round(mainRect.right) : 0,
    backInfo,
    inDetail: !!document.querySelector('button[title="Volver a la bandeja"]'),
  };
};

const results = [];

for (const vp of VIEWPORTS) {
  const errBefore = allErrors.length;
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.goto(BASE_URL + "/emails", { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(700);

  /* ── ESTADO 1: Lista ── */
  await page.screenshot({ path: join(OUT_DIR, `emails-${vp.name}-1-list.png`), fullPage: false });
  const listMetrics = await page.evaluate(INSPECT);

  /* ── Click fila del primer email ── */
  const opened = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("*"));
    const target = all.find(el => el.textContent && el.textContent.includes("Confirmación visita Promoción Sotogrande") && el.children.length === 0);
    if (!target) return false;
    let row = target;
    while (row && !row.className?.includes?.("cursor-pointer")) row = row.parentElement;
    if (!row) return false;
    row.click();
    return true;
  });
  if (!opened) {
    results.push({ viewport: vp.name, error: "could not click email" });
    continue;
  }
  await page.waitForTimeout(700);

  /* ── ESTADO 2: Detail ── */
  await page.screenshot({ path: join(OUT_DIR, `emails-${vp.name}-2-detail.png`), fullPage: false });
  const detailMetrics = await page.evaluate(INSPECT);

  /* ── Click Volver ── */
  let backedMetrics = null;
  const backBtnLoc = page.locator('button[title="Volver a la bandeja"]').first();
  if (await backBtnLoc.count()) {
    await backBtnLoc.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(OUT_DIR, `emails-${vp.name}-3-back.png`), fullPage: false });
    backedMetrics = await page.evaluate(INSPECT);
  }

  results.push({
    viewport: vp.name,
    width: vp.width,
    list: listMetrics,
    detail: detailMetrics,
    backed: backedMetrics,
    errors: allErrors.slice(errBefore),
  });
  console.log(`[${vp.name}] list.folderSB=${listMetrics.folderSidebarVisible}(${listMetrics.folderSidebarWidth}) detail.folderSB=${detailMetrics.folderSidebarVisible}(${detailMetrics.folderSidebarWidth}) back=${JSON.stringify(detailMetrics.backInfo)} ovDet=${detailMetrics.hasOverflow} main.w=${detailMetrics.mainWidth} backed.folderSB=${backedMetrics?.folderSidebarVisible}(${backedMetrics?.folderSidebarWidth})`);
}

await browser.close();
await writeFile(join(OUT_DIR, "report.json"), JSON.stringify({ results, allErrors }, null, 2));
console.log("\nErrors total:", allErrors.length);
console.log("Done. Report at", join(OUT_DIR, "report.json"));
