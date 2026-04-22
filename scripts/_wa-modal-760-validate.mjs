// Validación: modal 760px desktop con sidebar derecha + mobile fullscreen
import { chromium } from "playwright";

const BASE = "http://localhost:8080";
const ROUTE = "/contactos/ahmed-al-rashid";
const OUT = "/Users/armanyeghiazaryan/byvaro-design-armenia/screenshots/whatsapp-modal";

async function run() {
  const browser = await chromium.launch();

  for (const vp of [
    { w: 1280, h: 800, label: "desktop-760" },
    { w: 375, h: 812, label: "mobile-760" },
  ]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
    page.on("pageerror", (err) => consoleErrors.push("pageerror: " + err.message));

    // Inyectar AMBAS keys posibles para máxima compatibilidad
    await page.addInitScript(() => {
      try {
        const setup1 = JSON.stringify({
          method: "web",
          connectedAt: new Date().toISOString(),
          phoneNumber: "+34 600 123 456",
        });
        const setup2 = JSON.stringify({
          method: "businessApi",
          connectedAt: new Date().toISOString(),
          businessNumber: "+34 600 123 456",
          displayName: "WhatsApp Business",
        });
        localStorage.setItem("byvaro.whatsappSetup.v1", setup1);
        localStorage.setItem("byvaro.workspace.whatsapp.v1", setup2);
      } catch (e) {}
    });

    await page.goto(BASE + ROUTE, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    // Localizar el botón de WhatsApp en los tabs
    let waBtn;
    if (vp.w < 640) {
      const tabs = page.locator('[role="tablist"], div[class*="overflow-x-auto"]').first();
      try { await tabs.evaluate((el) => el.scrollBy({ left: 800, behavior: "instant" })); } catch {}
      await page.waitForTimeout(300);
      waBtn = page.locator('button:has-text("WhatsApp")').last();
    } else {
      waBtn = page.locator('button:has-text("WhatsApp")').first();
    }
    await waBtn.click();
    await page.waitForTimeout(900);

    const file = `${OUT}/10-${vp.label}.png`;
    await page.screenshot({ path: file, fullPage: false });

    const data = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"][data-state="open"]');
      if (!dialog) return { found: false };
      const dr = dialog.getBoundingClientRect();
      const aside = dialog.querySelector("aside");
      const ar = aside?.getBoundingClientRect();
      const asideStyle = aside ? getComputedStyle(aside) : null;
      const asideVisible = aside ? asideStyle.display !== "none" : false;
      const section = dialog.querySelector("section");
      const sr = section?.getBoundingClientRect();
      const grid = dialog.querySelector('[class*="grid-cols"], div.flex.flex-col');
      const gr = grid?.getBoundingClientRect();
      // Chat column = primera columna del grid (left)
      const cols = dialog.querySelectorAll('div[class*="col-"]');
      // Burbujas
      const bubbles = Array.from(dialog.querySelectorAll('div[class*="rounded-2xl"][class*="max-w"]')).slice(0, 3).map((b) => {
        const r = b.getBoundingClientRect();
        return { w: Math.round(r.width), x: Math.round(r.x), text: (b.innerText || "").slice(0, 40) };
      });
      const closeBtn = dialog.querySelector('[aria-label*="Cerrar" i]');
      const cbr = closeBtn?.getBoundingClientRect();
      // Detectar nombres en sidebar de agentes
      const sidebarText = aside ? (aside.innerText || "") : "";
      const hasLaura = sidebarText.includes("Laura");
      const hasArman = sidebarText.includes("Arman");
      const hasMarta = sidebarText.includes("Marta");
      const hasWorkspaceLabel = sidebarText.toUpperCase().includes("CANAL DEL WORKSPACE") || sidebarText.toUpperCase().includes("WORKSPACE");
      const hasChatsLabel = sidebarText.toUpperCase().includes("CHATS CON ESTE CLIENTE") || sidebarText.toUpperCase().includes("CHATS");
      const hOverflow = document.documentElement.scrollWidth - window.innerWidth;
      return {
        found: true,
        vw: window.innerWidth,
        modal: { w: Math.round(dr.width), h: Math.round(dr.height), x: Math.round(dr.x), y: Math.round(dr.y) },
        aside: asideVisible
          ? {
              w: Math.round(ar.width),
              x: Math.round(ar.x),
              display: asideStyle.display,
              hasLaura, hasArman, hasMarta, hasWorkspaceLabel, hasChatsLabel,
              text: sidebarText.slice(0, 240),
            }
          : { hidden: true, display: asideStyle?.display || "none" },
        section: sr ? { w: Math.round(sr.width), h: Math.round(sr.height) } : null,
        bubbles,
        closeBtn: cbr ? { x: Math.round(cbr.x), y: Math.round(cbr.y), w: Math.round(cbr.width), inTopRight: cbr.x > dr.x + dr.width / 2 && cbr.y < dr.y + 80 } : null,
        horizontalOverflowPx: hOverflow,
      };
    });
    console.log(`──── ${vp.label} ${vp.w}x${vp.h} ────`);
    console.log(JSON.stringify(data, null, 2));
    if (consoleErrors.length) {
      console.log("CONSOLE ERRORS:");
      consoleErrors.slice(0, 5).forEach((e) => console.log("  -", e.slice(0, 200)));
    } else {
      console.log("Console errors: 0");
    }
    await ctx.close();
  }

  await browser.close();
}

run().catch((e) => { console.error(e); process.exit(1); });
