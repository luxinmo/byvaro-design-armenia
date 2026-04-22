import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASE_URL = "http://localhost:8080";
const OUT_DIR = "/Users/armanyeghiazaryan/byvaro-design-armenia/screenshots/emails-arregla-todo";
await mkdir(OUT_DIR, { recursive: true });

const VIEWPORTS = [
  { w: 375, h: 812 },
  { w: 414, h: 896 },
  { w: 768, h: 1024 },
  { w: 1280, h: 800 },
  { w: 1440, h: 900 },
];

const browser = await chromium.launch();
const results = {};

// Helpers: measure compose div (it's a <div class="fixed ... z-50 ... border-border shadow-soft-lg">)
const COMPOSE_SEL = "div.fixed.z-50.border-border.shadow-soft-lg";

for (const vp of VIEWPORTS) {
  const label = `${vp.w}`;
  const out = results[label] = { overflow: null, errors: [], findings: {} };
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => out.errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") out.errors.push("console: " + m.text()); });

  const snap = (n) => page.screenshot({ path: join(OUT_DIR, `${label}-${n}.png`), fullPage: false });

  try {
    await page.goto(BASE_URL + "/emails", { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(600);

    const metrics = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
    }));
    out.overflow = metrics.sw > metrics.cw + 1 ? `${metrics.sw}>${metrics.cw}` : null;
    await snap("00-landing");

    // ===== 4. LABELS VISIBILITY =====
    const labelInfo = await page.evaluate(() => {
      const visitasPill = Array.from(document.querySelectorAll("span")).find(s => {
        const t = (s.textContent || "").trim();
        if (t !== "Visitas") return false;
        const r = s.getBoundingClientRect();
        const cs = getComputedStyle(s);
        return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
      });
      const amberDots = Array.from(document.querySelectorAll("span.bg-amber-500")).filter(s => {
        const r = s.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      return {
        visitasPillVisible: !!visitasPill,
        amberDotCount: amberDots.length,
      };
    });
    out.findings.labels = labelInfo;

    // ===== 1. AÑADIR NUEVA CUENTA FLOW =====
    const trigger = page.locator("button:has(svg.lucide-chevron-down)").first();
    await trigger.click({ timeout: 3000 });
    await page.waitForTimeout(500);
    await snap("01-switcher");

    const gestionar = page.locator("button:has-text('Gestionar cuentas')").first();
    await gestionar.click({ timeout: 3000 });
    await page.waitForTimeout(700);
    await snap("02-manage");

    const tab = page.locator("[role='tab']:has-text('Cuentas conectadas')").first();
    if (await tab.count() > 0) {
      await tab.click({ timeout: 3000 });
      await page.waitForTimeout(500);
      await snap("03-connected-tab");
    }

    const addBtn = page.locator("button:has-text('Añadir nueva cuenta')").first();
    let addOK = false;
    if (await addBtn.count() > 0) {
      await addBtn.click({ timeout: 3000 });
      await page.waitForTimeout(800);
      await snap("04-after-add-click");
      const check = await page.evaluate(() => {
        const txt = document.body.innerText;
        return {
          setupTitlePresent: txt.includes("Configura tu correo electrónico") || txt.includes("Configura tu correo"),
          dialogClosed: !document.querySelector('[role="dialog"]'),
          cancelBtnVisible: Array.from(document.querySelectorAll("button")).some(b => {
            const t = (b.textContent || "").trim();
            const r = b.getBoundingClientRect();
            return t === "Cancelar" && r.width > 0 && r.height > 0;
          }),
        };
      });
      addOK = check.setupTitlePresent && check.dialogClosed && check.cancelBtnVisible;
      out.findings.addAccountFlow = { ...check, addOK };

      // click Cancelar to return
      const cancel = page.locator("button:has-text('Cancelar'):visible").first();
      if (await cancel.count() > 0) {
        await cancel.click({ timeout: 2000 });
        await page.waitForTimeout(500);
        const afterCancel = await page.evaluate(() => ({
          stillInSetup: document.body.innerText.includes("Configura tu correo electrónico"),
        }));
        out.findings.cancelReturned = !afterCancel.stillInSetup;
      }
    } else {
      out.findings.addAccountFlow = { error: "add btn not found" };
    }

    // Reload clean
    await page.goto(BASE_URL + "/emails", { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(500);

    // ===== 2. COMPOSE SIZES (normal / maximized / minimized) =====
    const redactar = page.locator("button:has-text('Redactar'):visible").first();
    await redactar.click({ timeout: 3000 });
    await page.waitForTimeout(700);
    await snap("05-compose-normal");

    const normalSize = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), t: Math.round(r.top), winW: window.innerWidth, winH: window.innerHeight };
    }, COMPOSE_SEL);
    out.findings.composeNormalSize = normalSize;

    // maximize
    const maxBtn = page.locator('button[title="Maximizar"]').first();
    if (await maxBtn.count() > 0) {
      await maxBtn.click({ timeout: 2000 });
      await page.waitForTimeout(500);
      await snap("06-compose-maximized");
      out.findings.maximizedSize = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), t: Math.round(r.top), winW: window.innerWidth, winH: window.innerHeight };
      }, COMPOSE_SEL);
      // restore
      const restore = page.locator('button[title="Restaurar"]').first();
      await restore.click({ timeout: 2000 });
      await page.waitForTimeout(400);
      out.findings.sizeAfterRestoreMax = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      }, COMPOSE_SEL);
    }

    // minimize
    const minBtn = page.locator('button[title="Minimizar"]').first();
    if (await minBtn.count() > 0) {
      await minBtn.click({ timeout: 2000 });
      await page.waitForTimeout(500);
      await snap("07-compose-minimized");
      out.findings.minimizedSize = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), t: Math.round(r.top) };
      }, COMPOSE_SEL);
      // click header to restore (whole compose clickable when minimized)
      await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) {
          const header = el.querySelector("div.h-12");
          if (header) header.click();
          else el.click();
        }
      }, COMPOSE_SEL);
      await page.waitForTimeout(500);
      out.findings.sizeAfterRestoreMin = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      }, COMPOSE_SEL);
    }

    // ===== 5. CARET BEFORE SIGNATURE =====
    const caretBefore = await page.evaluate((sel) => {
      const root = document.querySelector(sel);
      if (!root) return { error: "no compose" };
      const ta = root.querySelector("textarea");
      if (!ta) return { error: "no textarea" };
      ta.focus();
      const val = ta.value || "";
      const selStart = ta.selectionStart ?? 0;
      const idxPhone = val.indexOf("📞");
      const idxByvaro = val.indexOf("Byvaro");
      return {
        totalLen: val.length,
        selStart,
        idxPhone,
        idxByvaro,
        caretBeforeSig: (idxPhone < 0 || selStart <= idxPhone) && (idxByvaro < 0 || selStart <= idxByvaro),
        valPreview: val.slice(0, 120),
      };
    }, COMPOSE_SEL);
    out.findings.caretInitial = caretBefore;

    // type text
    if (!caretBefore.error) {
      // Focus textarea and type
      await page.evaluate((sel) => {
        const root = document.querySelector(sel);
        const ta = root.querySelector("textarea");
        if (ta) ta.focus();
      }, COMPOSE_SEL);
      await page.keyboard.type("TEXTO_PRUEBA");
      await page.waitForTimeout(300);
      await snap("08-typed");
      const typed = await page.evaluate((sel) => {
        const root = document.querySelector(sel);
        const ta = root.querySelector("textarea");
        if (!ta) return null;
        const v = ta.value || "";
        const iText = v.indexOf("TEXTO_PRUEBA");
        const iPhone = v.indexOf("📞");
        const iByvaro = v.indexOf("Byvaro");
        return {
          textIndex: iText,
          phoneIndex: iPhone,
          byvaroIndex: iByvaro,
          textBeforeSig: iText >= 0 && (iPhone < 0 || iText < iPhone) && (iByvaro < 0 || iText < iByvaro),
          preview: v.slice(0, 300),
        };
      }, COMPOSE_SEL);
      out.findings.afterTyping = typed;
    }

    // ===== 3. "De" SELECTOR =====
    // Default state: should be not-red (has fromAccount) + send NOT disabled (empty To => actually only account matters? spec says disabled when no account)
    const fromDefault = await page.evaluate((sel) => {
      const root = document.querySelector(sel);
      if (!root) return null;
      const txt = root.innerText;
      const hasElige = txt.includes("Elige cuenta de envío");
      const hasRedDestClass = !!root.querySelector(".text-destructive");
      // find the De button (contains an email + chevron)
      const deRow = Array.from(root.querySelectorAll("div")).find(d => {
        const s = d.querySelectorAll("span");
        return s.length && (s[0].textContent || "").trim() === "De";
      });
      let deEmail = null;
      if (deRow) {
        const btn = deRow.querySelector("button");
        deEmail = btn ? btn.innerText : null;
      }
      // send btn
      const sendBtns = Array.from(root.querySelectorAll("button")).filter(b => {
        const t = (b.textContent || "").trim();
        return t === "Enviar" || t.startsWith("Enviar ");
      });
      const visSend = sendBtns.find(b => b.getBoundingClientRect().width > 0);
      return {
        hasEligeText: hasElige,
        hasDestructiveElement: hasRedDestClass,
        deEmail,
        sendDisabled: visSend ? visSend.disabled || visSend.hasAttribute("disabled") : null,
      };
    }, COMPOSE_SEL);
    out.findings.fromDefault = fromDefault;

    // open "De" popover
    const deBtn = page.locator(`${COMPOSE_SEL} button:has(svg.lucide-chevron-down)`).first();
    if (await deBtn.count() > 0) {
      await deBtn.click({ timeout: 2000 });
      await page.waitForTimeout(500);
      await snap("09-de-popover");
      const popoverCheck = await page.evaluate(() => {
        const pop = document.querySelector('[data-radix-popper-content-wrapper]');
        if (!pop) return { opened: false };
        const hasEnviarDesde = (pop.textContent || "").includes("Enviar desde");
        const btns = pop.querySelectorAll("button");
        const hasDefault = Array.from(pop.querySelectorAll("span")).some(s => (s.textContent || "").trim() === "Default");
        return { opened: true, hasEnviarDesde, optionCount: btns.length, hasDefaultBadge: hasDefault };
      });
      out.findings.fromPopover = popoverCheck;
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }

    // close compose via X
    await page.evaluate((sel) => {
      const root = document.querySelector(sel);
      if (!root) return;
      const btns = Array.from(root.querySelectorAll("button"));
      const xBtn = btns.find(b => b.querySelector("svg.lucide-x") && !b.title && !b.getAttribute("title")?.includes("Cerrar")) || btns[btns.length - 1];
      // Actually X is the last of the three header buttons — prefer finding by lucide-x and top position
      const headerBtns = btns.filter(b => b.querySelector("svg.lucide-x"));
      if (headerBtns.length) headerBtns[headerBtns.length - 1].click();
    }, COMPOSE_SEL);
    await page.waitForTimeout(500);

    // ===== 3b. TODAS LAS CUENTAS -> compose red + disabled =====
    // Open switcher
    const trig2 = page.locator("button:has(svg.lucide-chevron-down)").first();
    await trig2.click({ timeout: 3000 });
    await page.waitForTimeout(500);
    // Click the "Todas las cuentas" button (in the unified inbox section)
    // This button exists only when isAll === false (which is our starting state)
    const todasBtn = page.locator("button:has-text('Todas las cuentas'):visible").first();
    let todasOK = false;
    if (await todasBtn.count() > 0) {
      await todasBtn.click({ timeout: 3000 });
      todasOK = true;
      await page.waitForTimeout(800);
      await snap("10-todas-cuentas");
    }
    out.findings.todasClicked = todasOK;

    if (todasOK) {
      const red2 = page.locator("button:has-text('Redactar'):visible").first();
      if (await red2.count() > 0) {
        await red2.click({ timeout: 3000 });
        await page.waitForTimeout(700);
        await snap("11-compose-todas");
        const unifiedCheck = await page.evaluate((sel) => {
          const root = document.querySelector(sel);
          if (!root) return null;
          const txt = root.innerText;
          const hasElige = txt.includes("Elige cuenta de envío");
          const hasRedClass = !!root.querySelector(".text-destructive");
          const hasBorderDestructive = !!root.querySelector("[class*='border-destructive']");
          const sendBtns = Array.from(root.querySelectorAll("button")).filter(b => {
            const t = (b.textContent || "").trim();
            return t === "Enviar" || t.startsWith("Enviar ");
          });
          const visSend = sendBtns.find(b => b.getBoundingClientRect().width > 0);
          return {
            hasEligeText: hasElige,
            hasRedClass,
            hasBorderDestructive,
            sendDisabled: visSend ? visSend.disabled || visSend.hasAttribute("disabled") : null,
          };
        }, COMPOSE_SEL);
        out.findings.unifiedCompose = unifiedCheck;

        // Pick an account from De popover and verify Send enables
        const deBtn2 = page.locator(`${COMPOSE_SEL} button:has(svg.lucide-chevron-down)`).first();
        if (await deBtn2.count() > 0) {
          await deBtn2.click({ timeout: 2000 });
          await page.waitForTimeout(400);
          // click first account button in popover
          const firstAcc = page.locator("[data-radix-popper-content-wrapper] button").first();
          if (await firstAcc.count() > 0) {
            await firstAcc.click({ timeout: 2000 });
            await page.waitForTimeout(500);
            await snap("12-compose-afterpick");
            const after = await page.evaluate((sel) => {
              const root = document.querySelector(sel);
              if (!root) return null;
              const txt = root.innerText;
              const hasElige = txt.includes("Elige cuenta de envío");
              const sendBtns = Array.from(root.querySelectorAll("button")).filter(b => {
                const t = (b.textContent || "").trim();
                return t === "Enviar" || t.startsWith("Enviar ");
              });
              const visSend = sendBtns.find(b => b.getBoundingClientRect().width > 0);
              return {
                eligeGone: !hasElige,
                sendDisabled: visSend ? visSend.disabled || visSend.hasAttribute("disabled") : null,
              };
            }, COMPOSE_SEL);
            out.findings.unifiedAfterPick = after;
          }
        }
      }
    }

  } catch (e) {
    out.errors.push("TOP: " + e.message);
  }

  await ctx.close();
}

await browser.close();
await writeFile(join(OUT_DIR, "report.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
