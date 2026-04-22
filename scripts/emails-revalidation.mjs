/**
 * emails-final-validation · valida los 6 bloques pedidos en el reporte final
 * y audita overflow + errores de consola en 5 viewports para /emails y
 * /ajustes/email.
 */

import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASE_URL = "http://localhost:8080";
const OUT_DIR = "/Users/armanyeghiazaryan/byvaro-design-armenia/screenshots/emails-revalidation";
const VIEWPORTS = [
  { name: "375", w: 375, h: 812 },
  { name: "414", w: 414, h: 896 },
  { name: "768", w: 768, h: 1024 },
  { name: "1280", w: 1280, h: 800 },
  { name: "1440", w: 1440, h: 900 },
];

const report = {
  generatedAt: new Date().toISOString(),
  blocks: {},
  responsive: {},
  subRoutes: {},
  consoleErrors: [],
};

function attachConsole(page, tag) {
  page.on("pageerror", (err) => {
    const msg = `[${tag}] pageerror: ${String(err)}`;
    report.consoleErrors.push(msg);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      report.consoleErrors.push(`[${tag}] console.error: ${msg.text()}`);
    }
  });
}

async function shot(page, name) {
  const p = join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: p, fullPage: true });
  return p;
}

async function openEmails(page) {
  await page.goto(BASE_URL + "/emails", { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(800);
}

async function clickTextButton(page, text) {
  return page.evaluate((t) => {
    const btns = [...document.querySelectorAll("button")];
    const btn = btns.find((b) => (b.textContent || "").trim() === t);
    if (btn) { btn.click(); return true; }
    return false;
  }, text);
}

async function clickFolder(page, label) {
  return page.evaluate((lbl) => {
    const btns = [...document.querySelectorAll("button")];
    const btn = btns.find((b) => (b.textContent || "").trim().startsWith(lbl));
    if (btn) { btn.click(); return true; }
    return false;
  }, label);
}

async function openEmailBySubject(page, subjectRegex) {
  const clicked = await page.evaluate((patternSrc) => {
    const re = new RegExp(patternSrc, "i");
    const cands = [...document.querySelectorAll("div")];
    for (const el of cands) {
      if (!re.test(el.textContent || "")) continue;
      let p = el;
      for (let i = 0; i < 6 && p; i++) {
        const cls = (p.className || "").toString();
        if (cls.includes("cursor-pointer") || p.getAttribute("role") === "button") {
          p.click();
          return true;
        }
        p = p.parentElement;
      }
    }
    return false;
  }, subjectRegex.source);
  await page.waitForTimeout(600);
  return clicked;
}

async function getToastTexts(page) {
  return page.evaluate(() => {
    const host = document.querySelector("[data-sonner-toaster]");
    if (!host) return { mounted: false, toasts: [] };
    const items = [...host.querySelectorAll("[data-sonner-toast]")];
    return {
      mounted: true,
      toasts: items.map((el) => el.textContent?.trim() || ""),
    };
  });
}

/* ═══════════════════════════════════════════════════════════════════
 * BLOQUE 1 — Toaster GLOBAL + envío
 * ═══════════════════════════════════════════════════════════════════ */
async function block1Toaster(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  attachConsole(page, "b1");
  const r = { pass: true, steps: [], errors: [] };

  try {
    await openEmails(page);
    // Sonner monta el host [data-sonner-toaster] sólo cuando dispara el primer toast,
    // así que aquí solo dejamos traza — la verificación real es ver el toast tras Enviar.
    const mounted = await page.evaluate(() => !!document.querySelector("[data-sonner-toaster]"));
    r.steps.push(`Toaster host existe antes de enviar: ${mounted} (lazy-mount es normal)`);

    const opened = await openEmailBySubject(page, /Confirmación visita/);
    r.steps.push(`opened email: ${opened}`);
    const replyClicked = await clickTextButton(page, "Responder");
    r.steps.push(`Reply click: ${replyClicked}`);
    await page.waitForTimeout(500);

    const editor = page.locator("[contenteditable='true']").first();
    await editor.click();
    await page.keyboard.press("Home");
    await page.keyboard.type("OK, confirmado.");
    await page.waitForTimeout(200);

    await shot(page, "b1-01-before-send");

    await clickTextButton(page, "Enviar");
    await page.waitForTimeout(300);
    const t1 = await getToastTexts(page);
    r.steps.push(`toasts inmediatos tras Enviar: ${JSON.stringify(t1)}`);
    const hasSentToast = t1.toasts.some((t) => /mensaje enviado/i.test(t));
    if (!hasSentToast) {
      r.pass = false;
      r.errors.push(`No apareció toast "Mensaje enviado" — toasts=${JSON.stringify(t1.toasts)}`);
    }
    await shot(page, "b1-02-after-send-toast");

    await clickFolder(page, "Enviados");
    await page.waitForTimeout(400);
    await shot(page, "b1-03-sent-folder");

    // Badge en la lista (ventana de ~1s — aceptamos cualquier estado)
    const badgesNow = await page.evaluate(() => {
      return [...document.querySelectorAll("span, div")]
        .map((n) => (n.textContent || "").trim())
        .filter((t) => /^(Enviando…|Entregado|Entregando|Rebotado)$/i.test(t))
        .slice(0, 8);
    });
    r.steps.push(`badges en Enviados: ${JSON.stringify(badgesNow)}`);

    await page.waitForTimeout(1800);
    const badgesLater = await page.evaluate(() => {
      return [...document.querySelectorAll("span, div")]
        .map((n) => (n.textContent || "").trim())
        .filter((t) => /^(Enviando…|Entregado|Entregando|Rebotado)$/i.test(t))
        .slice(0, 8);
    });
    r.steps.push(`badges tras 1.8s: ${JSON.stringify(badgesLater)}`);
    const hasEntregado = badgesLater.some((b) => /entregado/i.test(b));
    if (!hasEntregado) {
      r.pass = false;
      r.errors.push(`Badge "Entregado" no aparece tras 1.8s — ${JSON.stringify(badgesLater)}`);
    }
  } catch (e) {
    r.pass = false;
    r.errors.push(`Exception: ${String(e.message || e)}`);
  } finally {
    await ctx.close();
  }
  report.blocks.block1 = r;
  console.log("BLOCK1", JSON.stringify(r, null, 2));
}

/* ═══════════════════════════════════════════════════════════════════
 * BLOQUE 2 — Labels persisten en localStorage
 * ═══════════════════════════════════════════════════════════════════ */
async function block2Labels(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  attachConsole(page, "b2");
  const r = { pass: true, steps: [], errors: [] };

  try {
    await openEmails(page);
    await page.evaluate(() => window.localStorage.removeItem("byvaro.emailLabels.v1"));
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(600);

    // Buscar el boton + al lado de Etiquetas
    const plusClicked = await page.evaluate(() => {
      // encontrar heading "Etiquetas" y mirar un boton con svg lucide-plus cerca
      const headings = [...document.querySelectorAll("*")].filter((n) => {
        const t = (n.textContent || "").trim();
        return t === "Etiquetas" || t === "ETIQUETAS" || /^etiquetas$/i.test(t);
      });
      for (const h of headings) {
        let p = h.parentElement;
        for (let i = 0; i < 4 && p; i++) {
          const plus = [...p.querySelectorAll("button")].find((b) => b.querySelector("svg.lucide-plus"));
          if (plus) { plus.click(); return true; }
          p = p.parentElement;
        }
      }
      return false;
    });
    r.steps.push(`click "+" Etiquetas: ${plusClicked}`);
    if (!plusClicked) { r.pass = false; r.errors.push("No encontré botón + de Etiquetas"); }
    await page.waitForTimeout(400);
    await shot(page, "b2-01-plus-clicked");

    // Esperamos un input. Escribimos nombre y Enter.
    const newInput = page.locator("input").filter({ hasNot: page.locator("[type='password']") });
    // Elegir el input visible nuevo (con foco)
    const focusedOk = await page.evaluate(() => {
      const el = document.activeElement;
      if (el && el.tagName === "INPUT") { el.value = ""; return true; }
      return false;
    });
    r.steps.push(`input focused: ${focusedOk}`);

    await page.keyboard.type("Test Label");
    await page.waitForTimeout(150);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
    await shot(page, "b2-02-label-created");

    const lsBefore = await page.evaluate(() => window.localStorage.getItem("byvaro.emailLabels.v1"));
    r.steps.push(`LS antes de reload: ${lsBefore}`);
    const hasTestLabel = (lsBefore || "").includes("Test Label");
    if (!hasTestLabel) {
      r.pass = false;
      r.errors.push(`localStorage no contiene "Test Label" — valor=${lsBefore}`);
    }

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    await shot(page, "b2-03-after-reload");

    const lsAfter = await page.evaluate(() => window.localStorage.getItem("byvaro.emailLabels.v1"));
    r.steps.push(`LS tras reload: ${lsAfter}`);

    const visibleInSidebar = await page.evaluate(() => {
      return [...document.querySelectorAll("button, span, div")].some(
        (n) => (n.textContent || "").trim() === "Test Label",
      );
    });
    r.steps.push(`"Test Label" visible tras reload: ${visibleInSidebar}`);
    if (!visibleInSidebar) {
      r.pass = false;
      r.errors.push("'Test Label' no aparece en sidebar tras reload");
    }
  } catch (e) {
    r.pass = false;
    r.errors.push(`Exception: ${String(e.message || e)}`);
  } finally {
    await ctx.close();
  }
  report.blocks.block2 = r;
  console.log("BLOCK2", JSON.stringify(r, null, 2));
}

/* ═══════════════════════════════════════════════════════════════════
 * BLOQUE 3 — Folder Borradores funcional
 * ═══════════════════════════════════════════════════════════════════ */
async function block3Drafts(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  attachConsole(page, "b3");
  const r = { pass: true, steps: [], errors: [] };

  try {
    await openEmails(page);
    await page.evaluate(() => window.localStorage.removeItem("byvaro.emailComposeDraft.v1"));
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(600);

    await clickTextButton(page, "Redactar");
    await page.waitForTimeout(700);
    await shot(page, "b3-01-compose-open");

    await page.locator('input[placeholder="Añadir destinatarios"]').first().fill("test@example.com");
    await page.keyboard.press("Enter"); // convertir a chip
    await page.waitForTimeout(150);
    await page.locator('input[placeholder="Asunto"]').first().fill("Borrador");
    const body = page.locator("[contenteditable='true']").first();
    await body.click();
    await page.keyboard.press("Home");
    await page.keyboard.type("texto");
    await page.waitForTimeout(200);
    await shot(page, "b3-02-compose-filled");

    // Cerrar con X del header. El header tiene 3 botones (minimize, expand, close)
    // y la X de cerrar es la última. Buscamos el compose por el contenteditable.
    const xClicked = await page.evaluate(() => {
      const compose = [...document.querySelectorAll("div.fixed")].find((d) =>
        d.querySelector("[contenteditable='true']"),
      );
      if (!compose) return { ok: false, reason: "no compose" };
      const header = compose.querySelector("div.h-12");
      const headerBtns = header ? [...header.querySelectorAll("button")] : [];
      const xBtn = headerBtns[headerBtns.length - 1];
      if (xBtn) { xBtn.click(); return { ok: true, btnCount: headerBtns.length }; }
      return { ok: false, reason: "no header btn" };
    });
    r.steps.push(`X click: ${JSON.stringify(xClicked)}`);
    await page.waitForTimeout(500);
    const toasts1 = await getToastTexts(page);
    r.steps.push(`toasts tras X: ${JSON.stringify(toasts1.toasts)}`);
    const hasSavedToast = toasts1.toasts.some((t) => /borrador guardado/i.test(t));
    if (!hasSavedToast) {
      r.pass = false;
      r.errors.push(`Toast "Borrador guardado" no apareció — ${JSON.stringify(toasts1.toasts)}`);
    }
    await shot(page, "b3-03-after-x");

    // Verificar sidebar count "Borradores · 1"
    const draftBadge = await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      const b = btns.find((bb) => /Borradores/.test(bb.textContent || ""));
      return b ? (b.textContent || "").trim() : null;
    });
    r.steps.push(`Borradores botón texto: ${draftBadge}`);
    if (!draftBadge || !/1/.test(draftBadge)) {
      r.pass = false;
      r.errors.push(`Count "1" no visible en Borradores — "${draftBadge}"`);
    }

    // Click en Borradores
    await clickFolder(page, "Borradores");
    await page.waitForTimeout(600);
    await shot(page, "b3-04-drafts-folder");

    // Click en la fila — buscamos el subject "Borrador" en un elemento clickable dentro de la lista
    const rowClicked = await page.evaluate(() => {
      // Evitamos el botón sidebar "Borradores" buscando filas con ambos: subject "Borrador" y el texto "test@"
      const cands = [...document.querySelectorAll("div, li, article")];
      const row = cands.find((el) => {
        const t = (el.textContent || "").trim();
        const cls = (el.className || "").toString();
        return cls.includes("cursor-pointer") && /Borrador/.test(t) && /test@example\.com/.test(t);
      });
      if (row) { row.click(); return true; }
      // Fallback: primera fila con "Borrador" cuyo parent NO sea el sidebar nav
      const rows = cands.filter((el) => {
        const cls = (el.className || "").toString();
        return cls.includes("cursor-pointer") && /Borrador/.test(el.textContent || "");
      });
      for (const rr of rows) {
        const isInNav = rr.closest("aside, nav");
        if (!isInNav) { rr.click(); return true; }
      }
      return false;
    });
    r.steps.push(`click fila borrador: ${rowClicked}`);
    await page.waitForTimeout(700);

    const toasts2 = await getToastTexts(page);
    r.steps.push(`toasts tras click borrador: ${JSON.stringify(toasts2.toasts)}`);
    const hasRecuperado = toasts2.toasts.some((t) => /borrador recuperado/i.test(t));
    if (!hasRecuperado) {
      r.steps.push("(info) Toast 'Borrador recuperado' no aparece (aceptable si se reabrió compose directo)");
    }

    const subVal = await page.locator('input[placeholder="Asunto"]').first().inputValue().catch(() => "");
    const bodyText = await page.locator("[contenteditable='true']").first().textContent().catch(() => "");
    r.steps.push(`restored: subject="${subVal}" body="${(bodyText || "").slice(0, 80)}"`);
    if (subVal !== "Borrador") {
      r.pass = false;
      r.errors.push(`Subject no restaurado: "${subVal}"`);
    }
    if (!(bodyText || "").includes("texto")) {
      r.pass = false;
      r.errors.push(`Body no restaurado: "${bodyText}"`);
    }
    await shot(page, "b3-05-compose-restored");
  } catch (e) {
    r.pass = false;
    r.errors.push(`Exception: ${String(e.message || e)}`);
  } finally {
    await ctx.close();
  }
  report.blocks.block3 = r;
  console.log("BLOCK3", JSON.stringify(r, null, 2));
}

/* ═══════════════════════════════════════════════════════════════════
 * BLOQUE 4 — Compose rediseñado
 * ═══════════════════════════════════════════════════════════════════ */
async function block4ComposeRedesign(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  attachConsole(page, "b4");
  const r = { pass: true, steps: [], errors: [] };

  try {
    await openEmails(page);
    await page.evaluate(() => window.localStorage.removeItem("byvaro.emailComposeDraft.v1"));
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    await clickTextButton(page, "Redactar");
    await page.waitForTimeout(700);
    await shot(page, "b4-01-compose-empty");

    // Chip para destinatarios
    await page.locator('input[placeholder="Añadir destinatarios"]').first().fill("test@gmail.com");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    await shot(page, "b4-02-external-chip");

    // chip amber underline dotted
    const chipAmber = await page.evaluate(() => {
      const chips = [...document.querySelectorAll("span")];
      const ext = chips.find((s) => /test@gmail\.com/.test(s.textContent || ""));
      if (!ext) return null;
      // Aceptamos que el chip esté algunos niveles más arriba
      let node = ext;
      for (let i = 0; i < 4 && node; i++) {
        const cls = (node.className || "").toString();
        if (/amber/i.test(cls) || /border-amber|bg-amber/.test(cls)) {
          return { found: true, cls };
        }
        node = node.parentElement;
      }
      return { found: false, outer: ext.outerHTML.slice(0, 200) };
    });
    r.steps.push(`chip amber externo: ${JSON.stringify(chipAmber)}`);
    if (!chipAmber || !chipAmber.found) {
      r.pass = false;
      r.errors.push("Chip externo no renderiza en amber (test@gmail.com)");
    }

    // Banner confidencial
    const banner = await page.evaluate(() => {
      return [...document.querySelectorAll("div")].some((n) =>
        /ten cuidado|confidencial|externo|compartir/i.test(n.textContent || "") &&
        /amber|yellow/.test((n.className || "").toString()),
      );
    });
    r.steps.push(`banner confidencial (amber) detectado: ${banner}`);
    if (!banner) {
      // Permisivo: buscar cualquier mención al aviso
      const anyWarn = await page.evaluate(() =>
        [...document.querySelectorAll("div")].some((n) =>
          /ten cuidado|destinatario externo/i.test(n.textContent || ""),
        ),
      );
      r.steps.push(`warning genérico: ${anyWarn}`);
      if (!anyWarn) {
        r.pass = false;
        r.errors.push("Banner confidencial no aparece al añadir destinatario externo");
      }
    }

    // Asunto debajo de chips
    const subjInput = page.locator('input[placeholder="Asunto"]').first();
    const subjVisible = await subjInput.isVisible();
    r.steps.push(`asunto input visible: ${subjVisible}`);
    if (!subjVisible) { r.pass = false; r.errors.push("Campo Asunto no visible en Compose"); }

    // ContentEditable con firma default
    const bodyHtml = await page.locator("[contenteditable='true']").first().innerHTML().catch(() => "");
    r.steps.push(`body length HTML: ${bodyHtml.length}; preview: ${bodyHtml.slice(0, 140)}`);
    // firma default: buscar token de firma (nombre, --, Saludos, etc)
    const hasSignature = bodyHtml.length > 0;
    if (!hasSignature) {
      r.pass = false;
      r.errors.push("Editor contenteditable vacío (sin firma default)");
    }

    // Toolbar pill de formato
    const toolbar = await page.evaluate(() => {
      const pills = [...document.querySelectorAll("div")].filter((p) => {
        const cls = (p.className || "").toString();
        return /rounded-full/.test(cls) && /bg-muted/.test(cls) && p.querySelectorAll("button").length >= 5;
      });
      return pills.map((p) => ({
        btnCount: p.querySelectorAll("button").length,
        titles: [...p.querySelectorAll("button")]
          .map((b) => b.getAttribute("title") || b.textContent?.trim() || "")
          .slice(0, 12),
      }));
    });
    r.steps.push(`toolbar pills: ${JSON.stringify(toolbar)}`);
    if (!toolbar.length) {
      r.pass = false;
      r.errors.push("Toolbar pill de formato no encontrada");
    }

    // Split-button Enviar (chevron)
    const sendBtn = await page.evaluate(() => {
      const compose = [...document.querySelectorAll("div.fixed")].find((d) =>
        d.querySelector("[contenteditable='true']"),
      );
      if (!compose) return null;
      const btns = [...compose.querySelectorAll("button")];
      const send = btns.find((b) => (b.textContent || "").trim() === "Enviar");
      if (!send) return { ok: false };
      // Hermano chevron
      const parent = send.parentElement;
      const chevron = parent ? [...parent.querySelectorAll("button")].find((b) =>
        b !== send && b.querySelector("svg")
      ) : null;
      return { ok: true, hasSend: !!send, hasChevron: !!chevron };
    });
    r.steps.push(`split-button Enviar: ${JSON.stringify(sendBtn)}`);
    if (!sendBtn?.hasChevron) {
      r.pass = false;
      r.errors.push("Split-button Enviar sin chevron");
    }

    // Abrir popover del chevron y verificar opciones
    if (sendBtn?.hasChevron) {
      await page.evaluate(() => {
        const compose = [...document.querySelectorAll("div.fixed")].find((d) =>
          d.querySelector("[contenteditable='true']"),
        );
        const btns = [...compose.querySelectorAll("button")];
        const send = btns.find((b) => (b.textContent || "").trim() === "Enviar");
        const parent = send.parentElement;
        const chevron = [...parent.querySelectorAll("button")].find((b) =>
          b !== send && b.querySelector("svg")
        );
        chevron?.click();
      });
      await page.waitForTimeout(400);
      await shot(page, "b4-03-send-popover");

      const popoverOptions = await page.evaluate(() => {
        const items = [...document.querySelectorAll("button, div")]
          .map((n) => (n.textContent || "").trim())
          .filter((t) => /^(Enviar|Enviar y archivar|Programar envío)$/i.test(t));
        return [...new Set(items)];
      });
      r.steps.push(`popover opciones: ${JSON.stringify(popoverOptions)}`);
      if (!popoverOptions.includes("Enviar y archivar")) {
        r.pass = false;
        r.errors.push('Popover no contiene "Enviar y archivar"');
      }
      if (!popoverOptions.includes("Programar envío")) {
        r.pass = false;
        r.errors.push('Popover no contiene "Programar envío"');
      }
    }

    // Signature picker
    const sigPicker = await page.evaluate(() => {
      const compose = [...document.querySelectorAll("div.fixed")].find((d) =>
        d.querySelector("[contenteditable='true']"),
      );
      if (!compose) return null;
      const btns = [...compose.querySelectorAll("button")];
      // aria-label o title o icono pen
      return btns.some((b) =>
        /firma|signature/i.test(b.getAttribute("title") || "") ||
        /firma|signature/i.test(b.getAttribute("aria-label") || "") ||
        b.querySelector("svg.lucide-pen-line, svg.lucide-signature"),
      );
    });
    r.steps.push(`signature picker presente: ${sigPicker}`);
    if (!sigPicker) {
      r.pass = false;
      r.errors.push("Signature picker no detectado en Compose");
    }
  } catch (e) {
    r.pass = false;
    r.errors.push(`Exception: ${String(e.message || e)}`);
  } finally {
    await ctx.close();
  }
  report.blocks.block4 = r;
  console.log("BLOCK4", JSON.stringify(r, null, 2));
}

/* ═══════════════════════════════════════════════════════════════════
 * BLOQUE 5 — Compose posición en múltiples viewports
 * ═══════════════════════════════════════════════════════════════════ */
async function block5ComposePosition(browser) {
  const result = {};
  for (const vp of [{ w: 768, h: 1024 }, { w: 1280, h: 800 }, { w: 1440, h: 900 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    attachConsole(page, `b5-${vp.w}`);
    const r = { pass: true, steps: [], errors: [] };
    try {
      await openEmails(page);
      await page.evaluate(() => window.localStorage.removeItem("byvaro.emailComposeDraft.v1"));
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(500);

      await clickTextButton(page, "Redactar");
      await page.waitForTimeout(600);
      await shot(page, `b5-${vp.w}-01-compose`);

      const composeBox = await page.evaluate(() => {
        const compose = [...document.querySelectorAll("div.fixed")].find((d) =>
          d.querySelector("[contenteditable='true']") && d.querySelector('input[placeholder="Añadir destinatarios"]'),
        );
        if (!compose) return null;
        const cs = getComputedStyle(compose);
        const b = compose.getBoundingClientRect();
        return {
          bottom: cs.bottom,
          right: cs.right,
          rectBottom: b.bottom,
          rectRight: b.right,
          rectTop: b.top,
          rectLeft: b.left,
          rectWidth: b.width,
          rectHeight: b.height,
          cls: compose.className.toString(),
        };
      });
      r.steps.push(`composeBox: ${JSON.stringify(composeBox)}`);

      const navBox = await page.evaluate(() => {
        // MobileBottomNav — buscar nav fixed con h-[60px] o similar
        const candidates = [...document.querySelectorAll("nav, div")].filter((n) => {
          const cs = getComputedStyle(n);
          const cls = (n.className || "").toString();
          return cs.position === "fixed" && cs.bottom === "0px" &&
            (/MobileBottomNav|bottom-0.*fixed|fixed.*bottom-0/i.test(cls) || n.querySelector("button + button + button"));
        });
        // Preferir uno con botones y altura cerca de 60
        const nav = candidates.find((n) => {
          const b = n.getBoundingClientRect();
          return b.height > 40 && b.height < 90;
        });
        if (!nav) return null;
        const b = nav.getBoundingClientRect();
        return { top: b.top, bottom: b.bottom, height: b.height, cls: nav.className.toString().slice(0, 100) };
      });
      r.steps.push(`navBox: ${JSON.stringify(navBox)}`);

      if (vp.w === 768) {
        // debería estar bottom ~80 para no solapar bottom nav
        if (composeBox && composeBox.rectBottom > vp.h - 40) {
          // rectBottom es el bottom del elemento desde viewport top
          // si rectBottom es ≥ vp.h entonces está pegado a 0
          const distToBottom = vp.h - composeBox.rectBottom;
          r.steps.push(`distToBottom=${distToBottom}`);
          if (distToBottom < 40) {
            r.pass = false;
            r.errors.push(`A 768px Compose toca el bottom (distToBottom=${distToBottom}px). Se esperaba sm:bottom-20 (~80px)`);
          }
        }
        if (navBox && composeBox) {
          const overlap = composeBox.rectBottom > navBox.top + 1;
          r.steps.push(`overlap con nav: ${overlap}`);
          if (overlap) {
            r.pass = false;
            r.errors.push(`Compose solapa con MobileBottomNav en 768px (composeBottom=${composeBox.rectBottom} navTop=${navBox.top})`);
          }
        }
      } else {
        // 1280/1440 → bottom debería ser 0
        if (composeBox && (vp.h - composeBox.rectBottom) > 30) {
          r.pass = false;
          r.errors.push(`A ${vp.w}px Compose no está pegado al bottom (dist=${vp.h - composeBox.rectBottom}px)`);
        }
      }
    } catch (e) {
      r.pass = false;
      r.errors.push(`Exception: ${String(e.message || e)}`);
    } finally {
      await ctx.close();
    }
    result[vp.w] = r;
    console.log(`BLOCK5-${vp.w}`, JSON.stringify(r, null, 2));
  }
  report.blocks.block5 = result;
}

/* ═══════════════════════════════════════════════════════════════════
 * BLOQUE 6 — Sub-rutas /ajustes/email/*
 * ═══════════════════════════════════════════════════════════════════ */
async function block6SubRoutes(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  attachConsole(page, "b6");
  const r = { pass: true, steps: [], errors: [] };
  const routes = [
    "/ajustes/email",
    "/ajustes/email/firma",
    "/ajustes/email/plantillas",
    "/ajustes/email/auto-respuesta",
    "/ajustes/email/smtp",
  ];
  try {
    for (const route of routes) {
      const resp = await page.goto(BASE_URL + route, { waitUntil: "networkidle", timeout: 15000 });
      await page.waitForTimeout(400);
      const status = resp?.status() ?? 0;
      const slug = route.replace(/\//g, "_").replace(/^_/, "");
      await shot(page, `b6-${slug}`);

      const metrics = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
        title: document.title,
        headings: [...document.querySelectorAll("h1, h2")].map((h) => h.textContent?.trim()).slice(0, 4),
        bodyTextLen: (document.body.innerText || "").length,
      }));
      r.steps.push(`${route}: status=${status} metrics=${JSON.stringify(metrics)}`);
      if (status !== 200) {
        r.pass = false;
        r.errors.push(`${route}: HTTP ${status}`);
      }
      if (metrics.sw > metrics.cw + 1) {
        r.pass = false;
        r.errors.push(`${route}: overflow horizontal sw=${metrics.sw} cw=${metrics.cw}`);
      }
    }

    // Index /ajustes/email: verificar 4 tarjetas
    await page.goto(BASE_URL + "/ajustes/email", { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const cards = await page.evaluate(() => {
      const links = [...document.querySelectorAll("a")].filter((a) =>
        /^\/ajustes\/email\//.test(a.getAttribute("href") || ""),
      );
      return links.map((a) => ({
        href: a.getAttribute("href"),
        text: (a.textContent || "").trim().slice(0, 80),
        hasChevron: !!a.querySelector("svg.lucide-chevron-right"),
        hasIcon: !!a.querySelector("svg"),
      }));
    });
    r.steps.push(`tarjetas /ajustes/email: ${JSON.stringify(cards)}`);
    if (cards.length < 4) {
      r.pass = false;
      r.errors.push(`Index /ajustes/email: ${cards.length} tarjetas (esperado 4)`);
    }
    for (const c of cards) {
      if (!c.hasChevron) {
        r.pass = false;
        r.errors.push(`Tarjeta ${c.href}: sin chevron`);
      }
    }

    // Link ← Volver
    const backLink = await page.evaluate(() => {
      const a = [...document.querySelectorAll("a")].find((aa) =>
        /volver al cliente de correo/i.test(aa.textContent || ""),
      );
      return a ? a.getAttribute("href") : null;
    });
    r.steps.push(`back link href: ${backLink}`);
    if (backLink !== "/emails") {
      r.pass = false;
      r.errors.push(`Link volver apunta a ${backLink} (se esperaba /emails)`);
    }
  } catch (e) {
    r.pass = false;
    r.errors.push(`Exception: ${String(e.message || e)}`);
  } finally {
    await ctx.close();
  }
  report.blocks.block6 = r;
  console.log("BLOCK6", JSON.stringify(r, null, 2));
}

/* ═══════════════════════════════════════════════════════════════════
 * RESPONSIVE — /emails y /ajustes/email en 5 viewports
 * ═══════════════════════════════════════════════════════════════════ */
async function responsiveAudit(browser) {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    attachConsole(page, `resp-${vp.name}`);
    const out = {};

    for (const route of ["/emails", "/ajustes/email"]) {
      const slug = route.replace(/\//g, "_").replace(/^_/, "");
      try {
        await page.goto(BASE_URL + route, { waitUntil: "networkidle", timeout: 15000 });
        await page.waitForTimeout(500);
        await shot(page, `resp-${vp.name}-${slug}`);
        const m = await page.evaluate(() => ({
          sw: document.documentElement.scrollWidth,
          cw: document.documentElement.clientWidth,
          sh: document.documentElement.scrollHeight,
        }));
        out[route] = {
          sw: m.sw, cw: m.cw,
          overflow: m.sw > m.cw + 1,
        };
      } catch (e) {
        out[route] = { error: String(e.message || e) };
      }
    }
    report.responsive[vp.name] = out;
    console.log(`RESP ${vp.name}`, JSON.stringify(out));
    await ctx.close();
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  try {
    await block1Toaster(browser);
    await block2Labels(browser);
    await block3Drafts(browser);
    await block4ComposeRedesign(browser);
    await block5ComposePosition(browser);
    await block6SubRoutes(browser);
    await responsiveAudit(browser);
  } finally {
    await browser.close();
  }
  await writeFile(join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log("\nDONE.");
}

main().catch((e) => { console.error(e); process.exit(1); });
