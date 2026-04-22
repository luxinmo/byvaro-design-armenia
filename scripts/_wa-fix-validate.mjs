import { chromium } from "playwright";

const BASE = "http://localhost:8080";
const ROUTE = "/contactos/ahmed-al-rashid";
const OUT = "/Users/armanyeghiazaryan/byvaro-design-armenia/screenshots/whatsapp-modal-fix";

const viewports = [
  { w: 1280, h: 800, label: "desktop" },
  { w: 375, h: 812, label: "mobile" },
];

async function run() {
  const browser = await chromium.launch();
  const allFindings = [];

  for (const vp of viewports) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();

    // Capture console errors
    const consoleErrors = [];
    page.on("pageerror", (err) => consoleErrors.push(String(err)));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    // Force connected setup BEFORE app loads
    await page.addInitScript(() => {
      localStorage.setItem(
        "byvaro.workspace.whatsapp.v1",
        JSON.stringify({
          method: "web",
          connectedAt: new Date().toISOString(),
          displayName: "WhatsApp Web",
        })
      );
    });

    await page.goto(BASE + ROUTE, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);

    // Click WhatsApp tab
    let waBtn;
    if (vp.w < 640) {
      // mobile: scroll tab strip first
      const tabs = page.locator('[role="tablist"], div[class*="overflow-x-auto"]').first();
      try { await tabs.evaluate((el) => el.scrollBy({ left: 1000, behavior: "instant" })); } catch {}
      await page.waitForTimeout(200);
      waBtn = page.locator('button:has-text("WhatsApp")').last();
    } else {
      waBtn = page.locator('button:has-text("WhatsApp")').first();
    }
    await waBtn.click();
    await page.waitForTimeout(800);

    const dialogOpen = await page.locator('[role="dialog"][data-state="open"]').count();
    if (!dialogOpen) {
      allFindings.push({ vp: vp.label, error: "Modal no abrió" });
      await page.screenshot({ path: `${OUT}/${vp.label}-modal-failed.png`, fullPage: false });
      await ctx.close();
      continue;
    }

    // Force chat view if setup view appears (extra safety)
    const setupVisible = await page.locator('text=/Vincular|Conectar|WhatsApp Web/i').count();

    // Take screenshot
    await page.screenshot({ path: `${OUT}/${vp.label}-chat.png`, fullPage: false });

    // Analyze layout
    const data = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"][data-state="open"]');
      if (!dialog) return { found: false };
      const dr = dialog.getBoundingClientRect();

      const aside = dialog.querySelector("aside");
      const asideVisible = aside ? getComputedStyle(aside).display !== "none" : false;
      const ar = aside?.getBoundingClientRect();

      const section = dialog.querySelector("section");
      const sr = section?.getBoundingClientRect();

      const footer = dialog.querySelector("footer");
      const fr = footer?.getBoundingClientRect();

      const chatHeader = dialog.querySelector("header");
      const chr = chatHeader?.getBoundingClientRect();

      // bubbles
      const bubbles = Array.from(dialog.querySelectorAll('div[class*="rounded-2xl"][class*="max-w"]'))
        .slice(0, 5)
        .map((b) => {
          const r = b.getBoundingClientRect();
          return { w: Math.round(r.width), h: Math.round(r.height), text: (b.innerText || "").slice(0, 50) };
        });

      // close button
      const closeBtn = dialog.querySelector('[aria-label*="errar" i], [aria-label*="lose" i]');
      const clr = closeBtn?.getBoundingClientRect();

      // settings (gear) inside chat header
      const settingsBtn = dialog.querySelector('button[aria-label*="onfigur" i], button[aria-label*="esconect" i]');
      const sbr = settingsBtn?.getBoundingClientRect();

      let overlap = false;
      if (sbr && clr) {
        overlap = !(
          sbr.x + sbr.width <= clr.x ||
          clr.x + clr.width <= sbr.x ||
          sbr.y + sbr.height <= clr.y ||
          clr.y + clr.height <= sbr.y
        );
      }

      // horizontal scroll
      const docScroll = document.documentElement.scrollWidth > window.innerWidth + 1;
      const dialogScroll = dialog.scrollWidth > dialog.clientWidth + 1;

      return {
        found: true,
        vw: window.innerWidth,
        vh: window.innerHeight,
        modal: { x: Math.round(dr.x), y: Math.round(dr.y), w: Math.round(dr.width), h: Math.round(dr.height), bottom: Math.round(dr.bottom) },
        aside: asideVisible
          ? { visible: true, w: Math.round(ar.width) }
          : { visible: false },
        section: sr ? { w: Math.round(sr.width), h: Math.round(sr.height), bottom: Math.round(sr.bottom) } : null,
        composer: fr
          ? {
              w: Math.round(fr.width),
              y: Math.round(fr.y),
              bottom: Math.round(fr.bottom),
              gapToModalBottom: Math.round(dr.bottom - fr.bottom),
              gapToViewportBottom: Math.round(window.innerHeight - fr.bottom),
            }
          : null,
        chatHeader: chr ? { w: Math.round(chr.width), y: Math.round(chr.y), h: Math.round(chr.height) } : null,
        closeBtn: clr ? { x: Math.round(clr.x), y: Math.round(clr.y), w: Math.round(clr.width), h: Math.round(clr.height) } : null,
        settingsBtn: sbr ? { x: Math.round(sbr.x), y: Math.round(sbr.y), w: Math.round(sbr.width), h: Math.round(sbr.height) } : null,
        overlapCloseSettings: overlap,
        bubbles,
        scroll: { docHorizontal: docScroll, dialogHorizontal: dialogScroll },
      };
    });

    allFindings.push({ vp: vp.label, viewportSize: `${vp.w}x${vp.h}`, consoleErrors, ...data });

    await ctx.close();
  }

  await browser.close();
  console.log(JSON.stringify(allFindings, null, 2));
}

run().catch((e) => { console.error(e); process.exit(1); });
