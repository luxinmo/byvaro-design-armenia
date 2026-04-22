// Tercera pasada: persistencia con storageState para que mobile herede setup,
// y verificación visual del chat en ambos viewports.

import { chromium } from "playwright";

const BASE = "http://localhost:8080";
const ROUTE = "/contactos/ahmed-al-rashid";
const OUT = "/Users/armanyeghiazaryan/byvaro-design-armenia/screenshots/whatsapp-modal";

async function run() {
  const browser = await chromium.launch();

  for (const vp of [{ w: 1280, h: 800, label: "desktop" }, { w: 375, h: 812, label: "mobile" }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();

    // Init script: setup WhatsApp en localStorage CON la key correcta
    await page.addInitScript(() => {
      try {
        localStorage.setItem("byvaro.workspace.whatsapp.v1", JSON.stringify({
          method: "businessApi",
          connectedAt: new Date().toISOString(),
          businessNumber: "+34 600 123 456",
          displayName: "WhatsApp Business",
        }));
      } catch (e) {}
    });

    await page.goto(BASE + ROUTE, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    // Verificar que localStorage tiene la setup
    const ls = await page.evaluate(() => localStorage.getItem("byvaro.workspace.whatsapp.v1"));
    console.log(`[${vp.label}] localStorage setup:`, ls ? "OK" : "MISSING");

    // En mobile: el tab bar puede ser scrollable. Buscar el botón WhatsApp DENTRO de los tabs
    // (no el de bottom nav ni otros). Estrategia: el botón de tab está dentro del contenedor de tabs principal.
    let waBtn;
    if (vp.w < 640) {
      // En mobile, hacer scroll del tab bar a la derecha
      const tabs = page.locator('[role="tablist"], div[class*="overflow-x-auto"]').first();
      try { await tabs.evaluate(el => el.scrollBy({ left: 800, behavior: 'instant' })); } catch {}
      await page.waitForTimeout(300);
      waBtn = page.locator('button:has-text("WhatsApp")').last();
    } else {
      waBtn = page.locator('button:has-text("WhatsApp")').first();
    }

    await waBtn.click();
    await page.waitForTimeout(800);

    // ¿El modal abrió?
    const dialogOpen = await page.locator('[role="dialog"][data-state="open"]').count();
    console.log(`[${vp.label}] dialog count: ${dialogOpen}`);

    if (!dialogOpen) {
      console.log(`[${vp.label}] modal no abrió, probando otra estrategia`);
      // Quizá la hizo cambiar de tab. Inspect URL.
      console.log("URL ahora:", page.url());
    }

    await page.screenshot({ path: `${OUT}/09-${vp.label}-chat-final.png`, fullPage: false });

    // Análisis del chat
    const data = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"][data-state="open"]');
      if (!dialog) return { found: false };
      const dr = dialog.getBoundingClientRect();
      const section = dialog.querySelector('section');
      const sr = section?.getBoundingClientRect();
      const sStyle = section ? getComputedStyle(section) : null;
      const aside = dialog.querySelector('aside');
      const ar = aside?.getBoundingClientRect();
      const asideVisible = aside ? getComputedStyle(aside).display !== 'none' : false;
      // Columna izquierda del grid (el chat real)
      const chatCol = section?.querySelector('div.flex.flex-col');
      const ccr = chatCol?.getBoundingClientRect();
      // Footer (composer)
      const footer = dialog.querySelector('footer');
      const fr = footer?.getBoundingClientRect();
      // Bubbles del chat
      const bubbles = Array.from(dialog.querySelectorAll('div[class*="rounded-2xl"][class*="max-w"]')).slice(0, 3).map(b => {
        const r = b.getBoundingClientRect();
        return { w: r.width, x: r.x, text: (b.innerText || '').slice(0, 40) };
      });
      // Header del chat (con nombre del contacto)
      const chatHeader = dialog.querySelector('header');
      const chr = chatHeader?.getBoundingClientRect();
      // Botón "Settings" (config/desconectar) del chat header
      const settingsBtn = dialog.querySelector('button[aria-label="Configurar / desconectar"]');
      const sbr = settingsBtn?.getBoundingClientRect();
      // Botón cerrar modal
      const closeBtn = dialog.querySelector('[aria-label="Cerrar WhatsApp"]');
      const clr = closeBtn?.getBoundingClientRect();
      // ¿Settings se solapa con close?
      let overlap = false;
      if (sbr && clr) {
        overlap = !(sbr.x + sbr.width < clr.x || clr.x + clr.width < sbr.x ||
                    sbr.y + sbr.height < clr.y || clr.y + clr.height < sbr.y);
      }
      return {
        found: true,
        vw: window.innerWidth,
        modal: { w: dr.width, h: dr.height },
        section: sr ? { w: sr.width, h: sr.height, cssH: sStyle.height, cssMinH: sStyle.minHeight, bottom: sr.bottom } : null,
        aside: asideVisible ? { w: ar.width } : { hidden: true },
        chatColumn: ccr ? { w: ccr.width, h: ccr.height } : null,
        composer: fr ? { w: fr.width, y: fr.y, bottom: fr.bottom, offscreen: fr.bottom > window.innerHeight, overflowsModal: fr.bottom > dr.bottom } : null,
        chatHeader: chr ? { w: chr.width, y: chr.y } : null,
        bubblesPreview: bubbles,
        settingsBtn: sbr ? { x: sbr.x, y: sbr.y, w: sbr.width } : null,
        closeBtn: clr ? { x: clr.x, y: clr.y, w: clr.width } : null,
        overlapSettingsClose: overlap,
      };
    });
    console.log(`──── ${vp.label} ${vp.w}x${vp.h} ────`);
    console.log(JSON.stringify(data, null, 2));

    await ctx.close();
  }

  await browser.close();
}

run().catch((e) => { console.error(e); process.exit(1); });
