import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASE_URL = "http://localhost:8080";
const OUT_DIR = "/Users/armanyeghiazaryan/byvaro-design-armenia/screenshots/emails-5fixes-audit";
await mkdir(OUT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: "375", width: 375, height: 812 },
  { name: "414", width: 414, height: 896 },
  { name: "768", width: 768, height: 1024 },
  { name: "1280", width: 1280, height: 800 },
  { name: "1440", width: 1440, height: 900 },
];

const browser = await chromium.launch();
const results = [];

for (const vp of VIEWPORTS) {
  const report = { viewport: vp.name, width: vp.width, checks: {}, errors: [] };
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();

  page.on("pageerror", (e) => report.errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") report.errors.push("console: " + m.text().slice(0, 200)); });

  await page.goto(BASE_URL + "/emails", { waitUntil: "networkidle" });
  await page.waitForTimeout(700);

  // ========== CHECK 1: Open email "Sotogrande" → click MoreVertical in toolbar ==========
  // On mobile/narrow: the list is shown, click an email. On desktop the list is also visible.
  try {
    // Click Sotogrande email
    const clicked = await page.evaluate(() => {
      const target = Array.from(document.querySelectorAll("*")).find(e =>
        e.children.length === 0 && e.textContent && e.textContent.includes("Confirmación visita Promoción Sotogrande")
      );
      if (!target) return "no-target";
      // Walk up to find clickable parent (button or [role=button] or a div with click handler)
      let el = target;
      for (let i = 0; i < 8 && el; i++) {
        if (el.tagName === "BUTTON" || el.getAttribute("role") === "button" || el.onclick) {
          el.click();
          return "clicked-" + el.tagName;
        }
        el = el.parentElement;
      }
      // fallback: click the closest list row
      target.closest("div")?.click();
      return "fallback-click";
    });
    report.checks.openEmail = clicked;
    await page.waitForTimeout(700);
    await page.screenshot({ path: join(OUT_DIR, `${vp.name}-p2-detail.png`), fullPage: false });

    // Toolbar check
    const toolbarInfo = await page.evaluate(() => {
      const volverBtn = Array.from(document.querySelectorAll("button")).find(b => b.getAttribute("title") === "Volver a la bandeja");
      if (!volverBtn) return { found: false };
      const toolbar = volverBtn.closest("div");
      const siblings = Array.from(toolbar?.querySelectorAll("button") || []);
      const titles = siblings.map(b => b.getAttribute("title") || b.textContent.trim()).filter(Boolean);
      const hasSpam = titles.some(t => /spam/i.test(t));
      const hasPosponer = titles.some(t => /posponer/i.test(t));
      return { found: true, titles, count: siblings.length, hasSpam, hasPosponer };
    });
    report.checks.detailToolbar = toolbarInfo;

    // Find MoreVertical button (title="Más acciones") and click
    const moreClicked = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.getAttribute("title") === "Más acciones");
      if (!btn) return "not-found";
      btn.click();
      return "clicked";
    });
    report.checks.moreClicked = moreClicked;
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(OUT_DIR, `${vp.name}-p2-more-popover.png`), fullPage: false });

    const popoverItems = await page.evaluate(() => {
      // Radix popover content has data-radix-popper-content-wrapper
      const pop = document.querySelector('[data-radix-popper-content-wrapper]');
      if (!pop) return { open: false };
      const text = pop.textContent;
      const buttons = Array.from(pop.querySelectorAll("button, [role='menuitem']")).map(b => b.textContent.trim());
      return {
        open: true,
        hasDestacar: /destacad|destacar/i.test(text),
        hasImportante: /importante/i.test(text),
        hasImprimir: /imprimir/i.test(text),
        buttons,
      };
    });
    report.checks.morePopover = popoverItems;

    // Check sender card NO MoreVertical
    const senderCardMoreVertical = await page.evaluate(() => {
      const replyBtn = Array.from(document.querySelectorAll("button")).find(b => b.textContent && b.textContent.trim() === "Responder");
      if (!replyBtn) return "no-reply-btn";
      // sender card is a parent/ancestor that also contains the sender name and email body
      // check within the parent container (two levels up) for any MoreVertical icons
      let node = replyBtn;
      for (let i = 0; i < 6 && node; i++) node = node.parentElement;
      if (!node) return "no-node";
      const mv = node.querySelectorAll("svg.lucide-ellipsis-vertical, svg.lucide-more-vertical");
      // Filter out the toolbar MoreVertical — search within the region of sender card (same row as Responder/Reenviar)
      // Safer: look at the immediate sibling chain around reply buttons for MoreVertical
      const siblings = Array.from(replyBtn.parentElement?.querySelectorAll("button") || []);
      const hasMoreNearReply = siblings.some(b => b.querySelector("svg.lucide-ellipsis-vertical, svg.lucide-more-vertical"));
      return { siblingsNearReply: siblings.map(s => s.textContent.trim()), hasMoreNearReply };
    });
    report.checks.senderCardMoreVertical = senderCardMoreVertical;

    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);

    // Back to inbox
    const backClicked = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.getAttribute("title") === "Volver a la bandeja");
      btn?.click(); return !!btn;
    });
    await page.waitForTimeout(500);
  } catch (e) { report.checks.detailError = e.message; }

  // ========== CHECK 2: Folder counts (desktop 768+) ==========
  if (vp.width >= 768) {
    const folderCounts = {};
    for (const folder of ["Bandeja de entrada", "Destacados", "Enviados", "Papelera"]) {
      try {
        await page.evaluate((f) => {
          const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent && b.textContent.trim().startsWith(f));
          btn?.click();
        }, folder);
        await page.waitForTimeout(500);
        // Count email rows: inside the list pane, count rows with sender avatar/name
        const count = await page.evaluate(() => {
          // A row has: checkbox, star, avatar?, sender, subject
          // Heuristic: rows are buttons or divs inside a list with class containing "cursor-pointer" or role
          // Count unique senders by looking at cells with a specific pattern
          const allTruncSubjects = document.querySelectorAll("div.text-sm.truncate.mt-0\\.5, .text-sm.truncate.mt-0\\.5.font-semibold");
          // Fallback heuristic: visible emails with subject line
          return allTruncSubjects.length;
        });
        folderCounts[folder] = count;
      } catch (e) { folderCounts[folder] = `err: ${e.message}`; }
    }
    report.checks.folderCounts = folderCounts;
  }

  // ========== CHECK 3: ETIQUETAS + create label ==========
  if (vp.width >= 768) {
    // Return to inbox first
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent && b.textContent.trim().startsWith("Bandeja de entrada"));
      btn?.click();
    });
    await page.waitForTimeout(400);

    const etqHeader = await page.evaluate(() => {
      // ETIQUETAS header is a span inside sidebar
      const all = Array.from(document.querySelectorAll("*")).filter(e => e.textContent && e.textContent.trim() === "ETIQUETAS" && e.children.length === 0);
      if (!all.length) return { exists: false };
      // Find parent row to locate plus button
      const row = all[0].parentElement;
      const plusBtn = row?.querySelector("button");
      return { exists: true, parentTag: row?.tagName, hasButtonSibling: !!plusBtn, rowText: row?.textContent.trim().slice(0, 50) };
    });
    report.checks.etiquetasHeader = etqHeader;

    // Click +
    const plusClicked = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll("*")).filter(e => e.textContent && e.textContent.trim() === "ETIQUETAS" && e.children.length === 0);
      if (!all.length) return "no-header";
      const row = all[0].parentElement;
      const plusBtn = row?.querySelector("button");
      if (!plusBtn) return "no-button";
      plusBtn.click();
      return "clicked";
    });
    report.checks.plusClicked = plusClicked;
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(OUT_DIR, `${vp.name}-p2-etiqueta-input.png`), fullPage: false });

    const inputAppears = await page.evaluate(() => {
      const inps = Array.from(document.querySelectorAll("input")).filter(i => i.offsetParent !== null);
      // Find an input that just appeared near ETIQUETAS
      return inps.map(i => ({ placeholder: i.placeholder, type: i.type, value: i.value }));
    });
    report.checks.inputs = inputAppears;

    // Type + Enter
    const newLabel = `Audit_${vp.name}`;
    try {
      // Focus the first visible empty input
      await page.evaluate(() => {
        const inps = Array.from(document.querySelectorAll("input")).filter(i => i.offsetParent !== null && !i.value);
        inps[inps.length - 1]?.focus();
      });
      await page.keyboard.type(newLabel);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(500);
      const tagCreated = await page.evaluate((l) => {
        return Array.from(document.querySelectorAll("button, span, div")).some(e =>
          e.children.length === 0 && e.textContent && e.textContent.trim() === l
        );
      }, newLabel);
      report.checks.labelCreated = tagCreated;
      await page.screenshot({ path: join(OUT_DIR, `${vp.name}-p2-etiqueta-created.png`), fullPage: false });
    } catch (e) { report.checks.labelCreateError = e.message; }

    // Click Visitas label to filter
    try {
      const visitasClicked = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll("button")).find(b => b.textContent && b.textContent.trim().startsWith("Visitas"));
        if (!btn) return "not-found";
        btn.click();
        return "clicked";
      });
      report.checks.visitasClicked = visitasClicked;
      await page.waitForTimeout(500);
      const visitasCount = await page.evaluate(() => document.querySelectorAll(".text-sm.truncate.mt-0\\.5").length);
      report.checks.visitasEmailCount = visitasCount;
      await page.screenshot({ path: join(OUT_DIR, `${vp.name}-p2-visitas-filtered.png`), fullPage: false });
    } catch (e) { report.checks.visitasError = e.message; }
  }

  // ========== CHECK 4: Email de sistema dismiss ==========
  // Go to /emails and trigger EmailSetup via "Añadir nueva cuenta"
  await page.goto(BASE_URL + "/emails", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  try {
    // Open AccountSwitcher
    const openedSwitch = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find(b => b.querySelector("svg.lucide-chevron-down") && b.closest("header, [class*='border-b']"));
      if (!btn) return false;
      btn.click();
      return true;
    });
    await page.waitForTimeout(300);
    // Click "Añadir nueva cuenta" or similar
    const addClicked = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button, [role='menuitem']")).find(b => b.textContent && /añadir|agregar|nueva cuenta/i.test(b.textContent));
      if (!btn) return "not-found";
      btn.click();
      return btn.textContent.trim();
    });
    report.checks.addAccountClicked = addClicked;
    await page.waitForTimeout(700);
    await page.screenshot({ path: join(OUT_DIR, `${vp.name}-p2-setup.png`), fullPage: false });

    const cardBefore = await page.evaluate(() => {
      // Card with "Email de sistema activo" and X inside
      const p = Array.from(document.querySelectorAll("p")).find(e => e.textContent === "Email de sistema activo");
      if (!p) return { present: false };
      // card is the ancestor with class containing "rounded-2xl"
      let node = p;
      for (let i = 0; i < 8; i++) {
        if (node.classList && node.classList.contains("rounded-2xl")) break;
        node = node.parentElement;
        if (!node) break;
      }
      const xBtn = node?.querySelector('button[title*="Deshabilitar"], button[title*="deshabilitar"]');
      return { present: true, hasXButton: !!xBtn, xButtonTitle: xBtn?.getAttribute("title") };
    });
    report.checks.emailSistemaCard = cardBefore;

    if (cardBefore.hasXButton) {
      await page.evaluate(() => {
        const btn = document.querySelector('button[title*="Deshabilitar"]');
        btn?.click();
      });
      await page.waitForTimeout(500);
      await page.screenshot({ path: join(OUT_DIR, `${vp.name}-p2-setup-dismissed.png`), fullPage: false });

      const dismissed = await page.evaluate(() => {
        return !Array.from(document.querySelectorAll("p")).some(p => p.textContent === "Email de sistema activo");
      });
      report.checks.cardDismissed = dismissed;
      const lsValue = await page.evaluate(() => window.localStorage.getItem("byvaro.emails.systemNoticeHidden"));
      report.checks.localStorage = lsValue;
      // reload and confirm persistence
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(500);
      // click add account again
      await page.evaluate(() => {
        const b = Array.from(document.querySelectorAll("button")).find(b => b.querySelector("svg.lucide-chevron-down") && b.closest("header, [class*='border-b']"));
        b?.click();
      });
      await page.waitForTimeout(300);
      await page.evaluate(() => {
        const b = Array.from(document.querySelectorAll("button, [role='menuitem']")).find(b => b.textContent && /añadir|agregar|nueva cuenta/i.test(b.textContent));
        b?.click();
      });
      await page.waitForTimeout(600);
      const cardAfterReload = await page.evaluate(() => {
        return Array.from(document.querySelectorAll("p")).some(p => p.textContent === "Email de sistema activo");
      });
      report.checks.persistsAfterReload = !cardAfterReload; // true = persistent hide works
    }
  } catch (e) { report.checks.emailSetupError = e.message; }

  await ctx.close();
  results.push(report);
}

await browser.close();
await writeFile(join(OUT_DIR, "report-p2.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
