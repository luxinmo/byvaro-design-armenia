/**
 * Emails final audit v2 · auditor específico de los 4 flujos + responsive.
 */

import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASE_URL = "http://localhost:8080";
const OUT_DIR = "/Users/armanyeghiazaryan/byvaro-design-armenia/screenshots/emails-final-audit";
const VIEWPORTS = [
  { w: 375, h: 812 },
  { w: 414, h: 896 },
  { w: 768, h: 1024 },
  { w: 1280, h: 800 },
  { w: 1440, h: 900 },
];

const report = {
  generatedAt: new Date().toISOString(),
  flows: {},
  responsive: {},
  consoleErrors: [],
  globalFindings: [],
};

function attachConsole(page, tag) {
  page.on("pageerror", (err) => {
    const msg = `[${tag}] pageerror: ${String(err)}`;
    report.consoleErrors.push(msg);
    console.error(msg);
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const t = `[${tag}] console.error: ${msg.text()}`;
      report.consoleErrors.push(t);
    }
  });
}

async function shot(page, name) {
  const p = join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: p, fullPage: true });
  return p;
}

/** El Toaster de Sonner no está montado en /emails — los toast nunca aparecen. */
async function hasToastMounted(page) {
  return page.evaluate(() => !!document.querySelector("[data-sonner-toaster]"));
}

async function openInbox(page) {
  await page.goto(BASE_URL + "/emails", { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(800);
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
  if (!clicked) throw new Error(`No encontré fila para ${subjectRegex}`);
  await page.waitForTimeout(600);
}

async function clickReplyButton(page) {
  const ok = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const btn = btns.find((b) => (b.textContent || "").trim() === "Responder");
    if (btn) { btn.click(); return true; }
    return false;
  });
  if (!ok) throw new Error("No encontré botón Responder");
  await page.waitForTimeout(700);
}

async function clickFolder(page, label) {
  await page.evaluate((lbl) => {
    const btns = [...document.querySelectorAll("button")];
    const btn = btns.find((b) => (b.textContent || "").trim().startsWith(lbl));
    btn?.click();
  }, label);
  await page.waitForTimeout(700);
}

async function clickRedactar(page) {
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button")];
    const exact = btns.find((b) => (b.textContent || "").trim() === "Redactar");
    exact?.click();
  });
  await page.waitForTimeout(800);
}

/** Extrae chips SÓLO del área de destinatarios del InlineReply. */
async function getInlineReplyChips(page) {
  return page.evaluate(() => {
    // Buscamos el contenedor "Para" dentro del InlineReply
    // span con clase "rounded-full h-6 pl-2 pr-1" — ese es el patrón exacto del chip
    const chips = [...document.querySelectorAll("span.rounded-full.h-6.pl-2.pr-1")];
    return chips.map((s) => s.textContent?.trim().replace("×", "").trim());
  });
}

/** ═══════════════════════ FLUJO 1 ═══════════════════════ */
async function flow1Sent(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  attachConsole(page, "flow1");
  const result = { steps: [], pass: true, errors: [], toastMounted: null };

  try {
    await openInbox(page);
    result.toastMounted = await hasToastMounted(page);
    result.steps.push(`[pre] Toaster montado en /emails: ${result.toastMounted}`);

    await openEmailBySubject(page, /Confirmación visita/);
    await clickReplyButton(page);
    await shot(page, "flow1-02-inline-reply");

    const editor = page.locator("[contenteditable='true']").first();
    await editor.click();
    await page.keyboard.press("Home");
    await page.keyboard.type("Gracias, confirmado.");
    await page.waitForTimeout(300);

    // Click Enviar (primary del split-button del InlineReply)
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      const send = btns.find((b) => (b.textContent || "").trim() === "Enviar");
      send?.click();
    });
    await page.waitForTimeout(400);
    await shot(page, "flow1-03-after-send");

    // El Toaster no está montado → no podemos verificar toast visualmente
    // pero verificamos efecto: email en Enviados y tracking card
    await clickFolder(page, "Enviados");
    await shot(page, "flow1-04-sent-folder");

    const counts = await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      const e = btns.find((b) => (b.textContent || "").trim().startsWith("Enviados"));
      return e ? (e.textContent || "").trim() : null;
    });
    result.steps.push(`folder Enviados text: ${counts}`);

    const sentFound = await page.evaluate(() => {
      const all = [...document.querySelectorAll("div")];
      return all.some((el) => /Re: Confirmación visita/i.test(el.textContent || ""));
    });
    if (!sentFound) {
      result.pass = false;
      result.errors.push("Mensaje enviado NO aparece en Enviados");
    } else {
      result.steps.push("mensaje en Enviados: OK");
    }

    // Badge "Enviando…" o "Entregado" — texto exact en badge
    const badges = await page.evaluate(() => {
      const all = [...document.querySelectorAll("span, div")];
      return all
        .filter((n) => /^(Enviando|Entregado|Entregando|Rebotado|Enviado)$/i.test((n.textContent || "").trim()))
        .slice(0, 5)
        .map((n) => ({ text: (n.textContent || "").trim(), cls: n.className.toString().slice(0, 100) }));
    });
    result.steps.push(`badges: ${JSON.stringify(badges)}`);

    await page.waitForTimeout(1700);
    const entregadoCount = await page.evaluate(() => {
      return [...document.querySelectorAll("span, div")].filter(
        (n) => (n.textContent || "").trim() === "Entregado",
      ).length;
    });
    result.steps.push(`count Entregado badges tras 1.7s: ${entregadoCount}`);
    if (entregadoCount === 0) {
      result.pass = false;
      result.errors.push('Badge "Entregado" no aparece tras 1.7s');
    }

    await openEmailBySubject(page, /Re: Confirmación visita/);
    await shot(page, "flow1-05-sent-detail-tracking");

    const tracking = await page.evaluate(() => {
      // TrackingCard contiene "ENVIADO" + "ENTREGADO" + "APERTURAS" + "CLICKS"
      const all = [...document.querySelectorAll("*")];
      const el = all.find((n) =>
        /ENVIADO/i.test(n.textContent || "") &&
        /ENTREGADO/i.test(n.textContent || "") &&
        /APERTURAS/i.test(n.textContent || ""),
      );
      return el ? (el.textContent || "").trim().slice(0, 200) : null;
    });
    result.steps.push(`TrackingCard detectado: ${tracking ? "SI" : "NO"}`);
    if (!tracking) {
      result.pass = false;
      result.errors.push("TrackingCard no encontrado en detalle del enviado");
    } else {
      result.steps.push(`TrackingCard content: ${tracking}`);
    }
  } catch (e) {
    result.pass = false;
    result.errors.push(`Excepción: ${String(e.message || e)}`);
  } finally {
    await ctx.close();
  }

  report.flows.flow1 = result;
  console.log("FLOW1", JSON.stringify(result, null, 2));
}

/** ═══════════════════════ FLUJO 2 ═══════════════════════ */
async function flow2Draft(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  attachConsole(page, "flow2");
  const result = { steps: [], pass: true, errors: [], toastMounted: null };

  try {
    await openInbox(page);
    result.toastMounted = await hasToastMounted(page);
    await page.evaluate(() => window.localStorage.removeItem("byvaro.emailComposeDraft.v1"));
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    await clickRedactar(page);
    await shot(page, "flow2-01-compose-open");

    const toInput = page.locator('input[placeholder="Para"]').first();
    await toInput.fill("test@example.com");
    const subInput = page.locator('input[placeholder="Asunto"]').first();
    await subInput.fill("Borrador test");
    const body = page.locator("[contenteditable='true']").first();
    await body.click();
    await page.keyboard.press("Home");
    await page.keyboard.type("Hola prueba");
    await page.waitForTimeout(300);
    await shot(page, "flow2-02-compose-filled");

    // X del header del Compose
    const xClicked = await page.evaluate(() => {
      const header = document.querySelector("div.h-12.bg-muted\\/40");
      if (!header) return false;
      const btns = [...header.querySelectorAll("button")];
      btns[btns.length - 1]?.click();
      return btns.length >= 3;
    });
    if (!xClicked) {
      result.pass = false;
      result.errors.push("Header del Compose no tiene 3 botones como se esperaba");
    }
    await page.waitForTimeout(700);
    await shot(page, "flow2-03-after-close");

    const ls1 = await page.evaluate(() =>
      window.localStorage.getItem("byvaro.emailComposeDraft.v1"),
    );
    result.steps.push(`localStorage tras X: ${ls1 ? "SET" : "NULL"}`);
    if (!ls1) {
      result.pass = false;
      result.errors.push("localStorage no persistió el draft tras cerrar con X");
    }

    // Redactar de nuevo
    await page.waitForTimeout(400);
    await clickRedactar(page);
    const toVal = await page.locator('input[placeholder="Para"]').first().inputValue();
    const subVal = await page.locator('input[placeholder="Asunto"]').first().inputValue();
    const bodyText = await page.locator("[contenteditable='true']").first().textContent();
    result.steps.push(`restored: to="${toVal}" sub="${subVal}" body="${(bodyText ?? "").slice(0, 80)}"`);
    if (toVal !== "test@example.com") {
      result.pass = false;
      result.errors.push(`Campo To no restaurado: "${toVal}"`);
    }
    if (subVal !== "Borrador test") {
      result.pass = false;
      result.errors.push(`Campo Subject no restaurado: "${subVal}"`);
    }
    if (!(bodyText ?? "").includes("Hola prueba")) {
      result.pass = false;
      result.errors.push(`Body no restaurado: "${bodyText}"`);
    }
    await shot(page, "flow2-04-compose-restored");

    // Trash del footer del Compose — scope al fixed contenedor
    const trashClicked = await page.evaluate(() => {
      // El Compose está en div.fixed.inset-0 o similar
      const compose = [...document.querySelectorAll("div.fixed")].find((d) =>
        d.querySelector("[contenteditable='true']") &&
        d.querySelector('input[placeholder="Para"]'),
      );
      if (!compose) return { ok: false, reason: "no compose container" };
      const btns = [...compose.querySelectorAll("button")];
      const trashBtn = btns.find((b) => {
        const svg = b.querySelector("svg");
        return svg?.classList?.contains("lucide-trash2");
      });
      if (trashBtn) {
        trashBtn.click();
        return { ok: true };
      }
      return { ok: false, reason: "no trash2 svg" };
    });
    result.steps.push(`trash click: ${JSON.stringify(trashClicked)}`);
    if (!trashClicked.ok) {
      result.pass = false;
      result.errors.push(`Trash del Compose no encontrado: ${trashClicked.reason}`);
    }
    await page.waitForTimeout(600);

    const ls2 = await page.evaluate(() =>
      window.localStorage.getItem("byvaro.emailComposeDraft.v1"),
    );
    result.steps.push(`localStorage tras Trash: ${ls2 ? "SET(persiste)" : "NULL(ok)"}`);
    if (ls2) {
      result.pass = false;
      result.errors.push("Trash NO borró el draft de localStorage");
    }

    // Redactar → campos vacíos
    await page.waitForTimeout(300);
    await clickRedactar(page);
    const toVal3 = await page.locator('input[placeholder="Para"]').first().inputValue();
    const subVal3 = await page.locator('input[placeholder="Asunto"]').first().inputValue();
    const bodyText3 = await page.locator("[contenteditable='true']").first().textContent();
    result.steps.push(`fresh: to="${toVal3}" sub="${subVal3}" body="${(bodyText3 ?? "").slice(0, 80)}"`);
    if (toVal3 || subVal3) {
      result.pass = false;
      result.errors.push(`Fresh compose no vacío: to="${toVal3}" sub="${subVal3}"`);
    }
    // El body debe contener sólo firma por defecto (no "Hola prueba")
    if ((bodyText3 ?? "").includes("Hola prueba")) {
      result.pass = false;
      result.errors.push(`Fresh body contiene texto del draft viejo: "${bodyText3}"`);
    }
    await shot(page, "flow2-05-fresh-compose");
  } catch (e) {
    result.pass = false;
    result.errors.push(`Excepción: ${String(e.message || e)}`);
  } finally {
    await ctx.close();
  }

  report.flows.flow2 = result;
  console.log("FLOW2", JSON.stringify(result, null, 2));
}

/** ═══════════════════════ FLUJO 3 ═══════════════════════ */
async function flow3Forward(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  attachConsole(page, "flow3");
  const result = { steps: [], pass: true, errors: [] };

  try {
    await openInbox(page);
    await openEmailBySubject(page, /Confirmación visita/);
    await clickReplyButton(page);
    await page.waitForTimeout(400);
    await shot(page, "flow3-01-reply");

    const chipsReply = await getInlineReplyChips(page);
    result.steps.push(`chips (reply): ${JSON.stringify(chipsReply)}`);
    if (!chipsReply.some((c) => c?.includes("ana.martinez"))) {
      result.pass = false;
      result.errors.push("Chip ana no aparece en Reply");
    }

    await page.locator('button[title="Cambiar tipo de respuesta"]').first().click();
    await page.waitForTimeout(300);
    await shot(page, "flow3-02-dropdown");

    await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button")];
      const fwd = btns.find((b) => (b.textContent || "").trim() === "Reenviar");
      fwd?.click();
    });
    await page.waitForTimeout(700);
    await shot(page, "flow3-03-forward");

    const chipsForward = await getInlineReplyChips(page);
    result.steps.push(`chips (forward): ${JSON.stringify(chipsForward)}`);
    const anaStillThere = chipsForward.some((c) => c?.includes("ana.martinez"));
    if (anaStillThere) {
      result.pass = false;
      result.errors.push("Chip ana NO se limpió al cambiar a Forward");
    }

    const fwdSubject = await page.locator('input[placeholder="Asunto"]').first().inputValue().catch(() => "");
    result.steps.push(`subject (forward): "${fwdSubject}"`);
    if (!/^Fwd:/i.test(fwdSubject)) {
      result.pass = false;
      result.errors.push(`Asunto no cambia a "Fwd:" — valor="${fwdSubject}"`);
    }
  } catch (e) {
    result.pass = false;
    result.errors.push(`Excepción: ${String(e.message || e)}`);
  } finally {
    await ctx.close();
  }

  report.flows.flow3 = result;
  console.log("FLOW3", JSON.stringify(result, null, 2));
}

/** ═══════════════════════ FLUJO 4 ═══════════════════════ */
async function flow4SentReply(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  attachConsole(page, "flow4");
  const result = { steps: [], pass: true, errors: [] };

  try {
    await openInbox(page);
    await clickFolder(page, "Enviados");
    await shot(page, "flow4-01-sent-folder");

    await openEmailBySubject(page, /Dossier Sotogrande/);
    await shot(page, "flow4-02-dossier-open");

    await clickReplyButton(page);
    await page.waitForTimeout(400);
    await shot(page, "flow4-03-reply");

    const chips = await getInlineReplyChips(page);
    result.steps.push(`chips: ${JSON.stringify(chips)}`);

    const hasAna = chips.some((c) => (c || "").includes("ana.martinez@iberiahomes.com"));
    const hasArman = chips.some((c) => (c || "").includes("arman@byvaro.com"));
    result.steps.push(`hasAna=${hasAna} hasArman=${hasArman}`);

    if (!hasAna) {
      result.pass = false;
      result.errors.push("Chip ana.martinez NO aparece al responder desde Enviados");
    }
    if (hasArman) {
      result.pass = false;
      result.errors.push("Chip arman@byvaro.com aparece (debería ser ana)");
    }
  } catch (e) {
    result.pass = false;
    result.errors.push(`Excepción: ${String(e.message || e)}`);
  } finally {
    await ctx.close();
  }

  report.flows.flow4 = result;
  console.log("FLOW4", JSON.stringify(result, null, 2));
}

/** ═══════════════════════ RESPONSIVE InlineReply ═══════════════════════ */
async function responsiveInlineReply(browser) {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
    const page = await ctx.newPage();
    attachConsole(page, `resp-${vp.w}`);
    const r = { w: vp.w, steps: [], pass: true, issues: [] };

    try {
      await openInbox(page);
      await openEmailBySubject(page, /Confirmación visita/);
      await clickReplyButton(page);
      await page.waitForTimeout(500);
      await shot(page, `resp-${vp.w}-01-reply-open`);

      const avatarVisible = await page.evaluate(() => {
        const el = document.querySelector("div.hidden.sm\\:flex.shrink-0.mt-1");
        if (!el) return false;
        const cs = getComputedStyle(el);
        return cs.display !== "none" && cs.visibility !== "hidden";
      });
      r.steps.push(`avatar container visible: ${avatarVisible}`);

      if (vp.w < 640) {
        if (avatarVisible) {
          r.pass = false;
          r.issues.push(`Avatar visible en ${vp.w}px (debería ocultarse)`);
        }
      } else {
        if (!avatarVisible) {
          r.pass = false;
          r.issues.push(`Avatar NO visible en ${vp.w}px`);
        }
      }

      const docMetrics = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      }));
      if (docMetrics.scrollW > docMetrics.clientW + 1) {
        r.pass = false;
        r.issues.push(`Overflow documento: ${docMetrics.scrollW} > ${docMetrics.clientW}`);
      }
      r.steps.push(`doc scrollW=${docMetrics.scrollW} clientW=${docMetrics.clientW}`);

      const cardBox = await page.evaluate(() => {
        const ed = document.querySelector("[contenteditable='true']");
        if (!ed) return null;
        const card = ed.closest(".rounded-2xl");
        if (!card) return null;
        const b = card.getBoundingClientRect();
        return { left: b.left, right: b.right, width: b.width, sw: card.scrollWidth, cw: card.clientWidth };
      });
      r.steps.push(`editor card: ${JSON.stringify(cardBox)}`);
      if (cardBox && cardBox.sw > cardBox.cw + 1) {
        r.pass = false;
        r.issues.push(`Editor card desborda internamente: sw=${cardBox.sw} cw=${cardBox.cw}`);
      }

      // Toolbar pill — solo la pill del InlineReply (bg-muted/60)
      const toolbarMetrics = await page.evaluate(() => {
        const pills = [...document.querySelectorAll("div.inline-flex.items-center.rounded-full.bg-muted\\/60, div.bg-muted\\/60.rounded-full")];
        return pills
          .filter((p) => p.querySelector("svg"))
          .map((p) => {
            const b = p.getBoundingClientRect();
            const parent = p.parentElement;
            const parentBox = parent?.getBoundingClientRect();
            return {
              sw: p.scrollWidth,
              cw: p.clientWidth,
              bRight: b.right,
              bLeft: b.left,
              width: b.width,
              parentClippingWidth: parentBox?.width,
            };
          });
      });
      r.steps.push(`toolbar pill: ${JSON.stringify(toolbarMetrics)}`);
      for (const tm of toolbarMetrics) {
        if (tm.width > tm.parentClippingWidth + 1) {
          r.pass = false;
          r.issues.push(`Toolbar pill (${tm.width}px) más ancha que contenedor (${tm.parentClippingWidth}px) — se clippea`);
        }
      }

      // Footer del InlineReply
      const footerMetrics = await page.evaluate(() => {
        const footers = [...document.querySelectorAll("div.flex.items-center.gap-1.px-3.h-14")];
        return footers.map((f) => {
          const lastChild = f.lastElementChild;
          return {
            sw: f.scrollWidth,
            cw: f.clientWidth,
            childCount: f.childElementCount,
            lastChildTitle: lastChild?.getAttribute?.("title") || null,
          };
        });
      });
      r.steps.push(`footer metrics: ${JSON.stringify(footerMetrics)}`);
      for (const fm of footerMetrics) {
        if (fm.sw > fm.cw + 1) {
          r.pass = false;
          r.issues.push(`Footer InlineReply desborda: sw=${fm.sw} cw=${fm.cw}`);
        }
      }

      // Banner confidencial
      const banner = await page.evaluate(() => {
        const warn = [...document.querySelectorAll("div")].find((n) =>
          /Ten cuidado si vas a compartir/i.test(n.textContent || ""),
        );
        if (!warn) return null;
        const wrap = warn.closest(".bg-amber-100") || warn;
        const b = wrap.getBoundingClientRect();
        return { left: b.left, right: b.right, width: b.width, sw: wrap.scrollWidth, cw: wrap.clientWidth };
      });
      r.steps.push(`banner confidencial: ${JSON.stringify(banner)}`);
      if (!banner) {
        r.issues.push("(aviso) Banner confidencial no detectado (debería existir para ana externo)");
      }
      if (banner && banner.sw > banner.cw + 1) {
        r.pass = false;
        r.issues.push(`Banner confidencial desborda: sw=${banner.sw} cw=${banner.cw}`);
      }

      // Chips del InlineReply (scope específico)
      const chips = await getInlineReplyChips(page);
      r.steps.push(`chips: ${JSON.stringify(chips)}`);

      await shot(page, `resp-${vp.w}-02-full`);
    } catch (e) {
      r.pass = false;
      r.issues.push(`Excepción: ${String(e.message || e)}`);
    } finally {
      await ctx.close();
    }

    report.responsive[`${vp.w}`] = r;
    console.log(`RESP ${vp.w}`, JSON.stringify(r, null, 2));
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  try {
    await flow1Sent(browser);
    await flow2Draft(browser);
    await flow3Forward(browser);
    await flow4SentReply(browser);
    await responsiveInlineReply(browser);
  } finally {
    await browser.close();
  }

  await writeFile(
    join(OUT_DIR, "report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log("\nDONE.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
