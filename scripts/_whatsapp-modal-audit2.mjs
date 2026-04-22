// Segunda pasada: pre-conecta WhatsApp en localStorage para ver el ChatView,
// que es donde puede haber header duplicado / overflow / composer fuera de pantalla.

import { chromium } from "playwright";

const BASE = "http://localhost:8080";
const ROUTE = "/contactos/ahmed-al-rashid";
const OUT = "/Users/armanyeghiazaryan/byvaro-design-armenia/screenshots/whatsapp-modal";

async function setup(page) {
  await page.addInitScript(() => {
    localStorage.setItem("byvaro.workspace.whatsapp.v1", JSON.stringify({
      method: "businessApi",
      connectedAt: new Date().toISOString(),
      businessNumber: "+34 600 123 456",
      displayName: "WhatsApp Business",
    }));
  });
}

async function inspectChat(page) {
  return page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"][data-state="open"]');
    if (!dialog) return { found: false };

    // Modal panel
    const dr = dialog.getBoundingClientRect();
    // Botón cerrar del modal
    const close = dialog.querySelector('[aria-label="Cerrar WhatsApp"]');
    const cr = close?.getBoundingClientRect();
    // Headers <header> dentro del modal
    const headers = Array.from(dialog.querySelectorAll('header')).map(h => ({
      text: (h.innerText || '').slice(0, 80),
      x: h.getBoundingClientRect().x,
      y: h.getBoundingClientRect().y,
      w: h.getBoundingClientRect().width,
      h: h.getBoundingClientRect().height,
    }));
    // ChatView <section>
    const section = dialog.querySelector('section');
    const sr = section?.getBoundingClientRect();
    const sStyle = section ? getComputedStyle(section) : null;
    // Composer <footer>
    const footer = dialog.querySelector('footer');
    const fr = footer?.getBoundingClientRect();
    // Wrapper interno con padding
    const wrapper = dialog.querySelector('div.overflow-y-auto');
    const wr = wrapper?.getBoundingClientRect();
    const wStyle = wrapper ? getComputedStyle(wrapper) : null;
    // Sidebar de agentes
    const aside = dialog.querySelector('aside');
    const ar = aside?.getBoundingClientRect();
    const asideVisible = aside ? getComputedStyle(aside).display !== 'none' : false;

    return {
      found: true,
      vw: window.innerWidth,
      vh: window.innerHeight,
      dialog: { x: dr.x, y: dr.y, w: dr.width, h: dr.height },
      close: cr ? { x: cr.x, y: cr.y, top: cr.top, right: window.innerWidth - cr.right } : null,
      headers,
      section: sr ? {
        x: sr.x, y: sr.y, w: sr.width, h: sr.height,
        bottom: sr.bottom, overflowsModal: sr.bottom > dr.bottom,
        cssHeight: sStyle?.height, cssMinHeight: sStyle?.minHeight,
      } : null,
      footer: fr ? {
        x: fr.x, y: fr.y, w: fr.width, h: fr.height,
        bottom: fr.bottom, overflowsModal: fr.bottom > dr.bottom,
        offscreen: fr.bottom > window.innerHeight,
      } : null,
      wrapper: wr ? {
        w: wr.width, h: wr.height, scrollH: wrapper.scrollHeight,
        padding: wStyle?.padding, paddingTop: wStyle?.paddingTop,
      } : null,
      aside: ar && asideVisible ? { w: ar.width, visible: true } : { visible: false },
      // ¿Hay un header del chat (el que dice "Ahmed Al-Rashid · WhatsApp Web") y luego
      // el botón cerrar también es visible? → potencial confusión visual
      contactHeaderText: headers[0]?.text ?? null,
    };
  });
}

async function run() {
  const browser = await chromium.launch();

  for (const vp of [{ w: 1280, h: 800, label: "desktop" }, { w: 375, h: 812, label: "mobile" }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    await setup(page);
    const errors = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
    });

    await page.goto(BASE + ROUTE, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);

    // Click WhatsApp tab
    await page.locator('button:has-text("WhatsApp")').first().click();
    await page.waitForTimeout(600);

    const data = await inspectChat(page);
    console.log(`\n──── ${vp.label} ${vp.w}x${vp.h} ────`);
    console.log(JSON.stringify(data, null, 2));
    console.log(`Errors: ${errors.length}`);
    if (errors.length) console.log(errors.slice(0, 5));

    await page.screenshot({ path: `${OUT}/07-${vp.label}-chat-modal.png`, fullPage: false });

    // Ahora abrimos el menú "+" para ver si el popover queda dentro del modal
    const plus = page.locator('button[aria-label="Adjuntar y más"]').first();
    if (await plus.count()) {
      await plus.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${OUT}/08-${vp.label}-chat-plusmenu.png`, fullPage: false });
      // Verificar que el popover esté visible y dentro del modal
      const popover = await page.evaluate(() => {
        const p = document.querySelector('[role="dialog"][data-state="open"] [role="menu"], [data-radix-popper-content-wrapper]');
        if (!p) return null;
        const r = p.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height, vw: window.innerWidth };
      });
      console.log("Popover +:", popover);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);
    }

    // Comprobar el "settings" del header del chat para ver si es alcanzable
    const settingsBtn = page.locator('button[aria-label="Configurar / desconectar"]').first();
    if (await settingsBtn.count()) {
      const visible = await settingsBtn.isVisible();
      const box = await settingsBtn.boundingBox();
      console.log("Settings btn (header del chat):", { visible, box });
      // ¿Se solapa con el botón cerrar del modal?
      const closeBox = await page.locator('[aria-label="Cerrar WhatsApp"]').first().boundingBox();
      console.log("Close btn (modal):", closeBox);
      if (box && closeBox) {
        const overlap = !(box.x + box.width < closeBox.x || closeBox.x + closeBox.width < box.x ||
                          box.y + box.height < closeBox.y || closeBox.y + closeBox.height < box.y);
        console.log(`Overlap settings vs close: ${overlap}`);
      }
    }

    await ctx.close();
  }

  await browser.close();
}

run().catch((e) => { console.error(e); process.exit(1); });
