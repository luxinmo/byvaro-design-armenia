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
  const report = { viewport: vp.name, width: vp.width, checks: {}, errors: [], overflow: null };
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();

  page.on("pageerror", (e) => report.errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") report.errors.push("console: " + m.text().slice(0, 200)); });

  await page.goto(BASE_URL + "/emails", { waitUntil: "networkidle" });
  await page.waitForTimeout(700);

  // Overflow check
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  report.overflow = metrics.scrollWidth > metrics.clientWidth + 1 ? `OVERFLOW ${metrics.scrollWidth}>${metrics.clientWidth}` : "ok";

  await page.screenshot({ path: join(OUT_DIR, `${vp.name}-01-landing.png`), fullPage: false });

  // ========== CHECK 2: Sidebar folders (desktop ≥768) ==========
  if (vp.width >= 768) {
    const folderLabels = await page.evaluate(() => {
      // Look at the left sidebar inside GmailInterface; grab all buttons that look like folder items
      const btns = Array.from(document.querySelectorAll("aside button, nav button, button"));
      const folders = ["Bandeja de entrada", "Destacados", "Enviados", "Papelera", "Borradores", "Drafts", "Spam", "Posponer", "Snoozed", "Más"];
      const found = {};
      for (const f of folders) {
        found[f] = btns.some(b => b.textContent && b.textContent.trim().includes(f));
      }
      return found;
    });
    report.checks.sidebarFolders = folderLabels;

    // Click each folder and verify filtering (count emails in list)
    const counts = {};
    for (const folder of ["Bandeja de entrada", "Destacados", "Enviados", "Papelera"]) {
      try {
        const btn = page.locator(`button:has-text("${folder}")`).first();
        if (await btn.count()) {
          await btn.click();
          await page.waitForTimeout(400);
          // Count email list items (heuristic: rows with subject text or specific role)
          const count = await page.evaluate(() => {
            // Emails list items - find the scrollable list of threads
            const items = document.querySelectorAll('[data-email-id], [role="listitem"]');
            if (items.length) return items.length;
            // Fallback: rows with visible name + subject pattern - heuristic
            return document.querySelectorAll('button[aria-label*="email"], li').length;
          });
          counts[folder] = count;
          await page.screenshot({ path: join(OUT_DIR, `${vp.name}-folder-${folder.replace(/ /g, "_")}.png`), fullPage: false });
        }
      } catch (e) { counts[folder] = `err: ${e.message}`; }
    }
    report.checks.folderCounts = counts;

    // Return to Inbox
    try {
      await page.locator(`button:has-text("Bandeja de entrada")`).first().click();
      await page.waitForTimeout(400);
    } catch {}
  }

  // ========== CHECK 3: Labels (ETIQUETAS) creation ==========
  if (vp.width >= 768) {
    const etiquetasInfo = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll("*")).filter(e => e.textContent && e.textContent.trim() === "ETIQUETAS");
      if (!spans.length) return { exists: false };
      const container = spans[0].closest("div");
      // find + button sibling
      const plusBtn = container?.parentElement?.querySelector('button:has(svg.lucide-plus), button svg.lucide-plus');
      return { exists: true, hasPlus: !!plusBtn };
    });
    report.checks.etiquetasHeader = etiquetasInfo;

    // Try clicking the plus next to ETIQUETAS
    try {
      // Find ETIQUETAS text's parent row, click a Plus inside
      const plusBtn = await page.evaluateHandle(() => {
        const spans = Array.from(document.querySelectorAll("*")).filter(e => e.textContent && e.textContent.trim() === "ETIQUETAS");
        if (!spans.length) return null;
        const row = spans[0].parentElement;
        const btn = row?.querySelector("button");
        return btn;
      });
      const el = plusBtn.asElement();
      if (el) {
        await el.click();
        await page.waitForTimeout(400);
        await page.screenshot({ path: join(OUT_DIR, `${vp.name}-etiqueta-input.png`), fullPage: false });
        const inputVisible = await page.evaluate(() => {
          const inps = Array.from(document.querySelectorAll("input"));
          return inps.some(i => i.offsetParent !== null && (i.placeholder || "").toLowerCase().includes("etiqueta") || (i.placeholder || "").toLowerCase().includes("nombre"));
        });
        report.checks.etiquetaInputAppears = inputVisible;

        // Type and press Enter
        const newLabel = `AuditTag${vp.name}`;
        await page.keyboard.type(newLabel);
        await page.waitForTimeout(200);
        await page.keyboard.press("Enter");
        await page.waitForTimeout(500);
        const tagExists = await page.evaluate((l) => {
          return Array.from(document.querySelectorAll("*")).some(e => e.textContent && e.textContent.trim() === l);
        }, newLabel);
        report.checks.etiquetaCreated = tagExists;

        // Test Escape cancel by opening again
        const plus2 = await page.evaluateHandle(() => {
          const spans = Array.from(document.querySelectorAll("*")).filter(e => e.textContent && e.textContent.trim() === "ETIQUETAS");
          if (!spans.length) return null;
          const row = spans[0].parentElement;
          return row?.querySelector("button");
        });
        const el2 = plus2.asElement();
        if (el2) {
          await el2.click();
          await page.waitForTimeout(200);
          await page.keyboard.type("xxx");
          await page.keyboard.press("Escape");
          await page.waitForTimeout(300);
          const cancelOk = await page.evaluate(() => {
            return !Array.from(document.querySelectorAll("*")).some(e => e.textContent && e.textContent.trim() === "xxx");
          });
          report.checks.etiquetaEscapeCancels = cancelOk;
        }

        // Test click on existing label filters
        try {
          const visitasBtn = page.locator('button:has-text("Visitas")').first();
          if (await visitasBtn.count()) {
            await visitasBtn.click();
            await page.waitForTimeout(400);
            await page.screenshot({ path: join(OUT_DIR, `${vp.name}-etiqueta-visitas.png`), fullPage: false });
            report.checks.etiquetaFilterClickable = true;
          }
        } catch (e) { report.checks.etiquetaFilterClickable = `err: ${e.message}`; }
      } else {
        report.checks.etiquetaPlusFound = false;
      }
    } catch (e) { report.checks.etiquetaError = e.message; }

    // Return to Inbox
    try {
      await page.locator(`button:has-text("Bandeja de entrada")`).first().click();
      await page.waitForTimeout(300);
    } catch {}
  }

  // ========== CHECK 1: Email detail 3-dot menu ==========
  // Open "Sotogrande" email
  try {
    const emailRow = page.locator('text=/Confirmación visita Promoción Sotogrande/').first();
    if (await emailRow.count()) {
      await emailRow.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: join(OUT_DIR, `${vp.name}-02-detail.png`), fullPage: false });

      // Count toolbar buttons & check for Spam/Posponer presence
      const toolbarInfo = await page.evaluate(() => {
        // Find toolbar that contains the "Volver" button, scope to its parent
        const volverBtn = Array.from(document.querySelectorAll("button")).find(b => b.getAttribute("title") === "Volver a la bandeja" || (b.textContent && b.textContent.trim() === "Volver"));
        if (!volverBtn) return { found: false };
        const toolbar = volverBtn.closest("div");
        const siblings = Array.from(toolbar?.querySelectorAll("button") || []);
        const titles = siblings.map(b => b.getAttribute("title") || b.textContent.trim()).filter(Boolean);
        return { found: true, titles, count: siblings.length };
      });
      report.checks.detailToolbar = toolbarInfo;

      // Check no MoreVertical in sender card (the section between toolbar and body)
      const senderCardMore = await page.evaluate(() => {
        // Sender card is near Reply/Forward (Responder/Reenviar) buttons
        const replyBtn = Array.from(document.querySelectorAll("button")).find(b => b.textContent && (b.textContent.trim() === "Responder" || b.textContent.includes("Responder")));
        if (!replyBtn) return { hasMoreInSender: "no reply btn found" };
        const card = replyBtn.closest("div")?.parentElement;
        const more = card?.querySelector('svg.lucide-more-vertical, svg.lucide-ellipsis-vertical');
        return { hasMoreInSender: !!more };
      });
      report.checks.senderCardMoreVertical = senderCardMore;

      // Click the MoreVertical at the end of toolbar
      const moreBtn = await page.evaluateHandle(() => {
        const volverBtn = Array.from(document.querySelectorAll("button")).find(b => b.getAttribute("title") === "Volver a la bandeja");
        if (!volverBtn) return null;
        const toolbar = volverBtn.closest("div");
        const btns = Array.from(toolbar?.querySelectorAll("button") || []);
        // find button containing lucide-more-vertical icon
        return btns.find(b => b.querySelector("svg.lucide-more-vertical"));
      });
      const el = moreBtn.asElement();
      if (el) {
        await el.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: join(OUT_DIR, `${vp.name}-03-more-popover.png`), fullPage: false });
        const popoverItems = await page.evaluate(() => {
          const items = Array.from(document.querySelectorAll('[role="menu"] *, [role="menuitem"], [data-radix-popper-content-wrapper] button, [data-state="open"] button'));
          const texts = Array.from(new Set(items.map(i => i.textContent.trim()).filter(t => t && t.length < 60)));
          // Filter for expected options
          return {
            hasDestacar: texts.some(t => t.toLowerCase().includes("destacad") || t.toLowerCase().includes("destacar")),
            hasImportante: texts.some(t => t.toLowerCase().includes("importante")),
            hasImprimir: texts.some(t => t.toLowerCase().includes("imprimir")),
            allTexts: texts.slice(0, 20),
          };
        });
        report.checks.morePopover = popoverItems;
        // Close popover
        await page.keyboard.press("Escape");
        await page.waitForTimeout(200);
      } else {
        report.checks.morePopover = { clickable: false };
      }
    } else {
      report.checks.emailOpen = "email row not found";
    }
  } catch (e) { report.checks.detailError = e.message; }

  // ========== CHECK 5: AccountSwitcher → Gestionar cuentas → PenLine ==========
  try {
    // Open account switcher in top-right
    const switcher = page.locator("button:has(svg.lucide-chevron-down)").first();
    if (await switcher.count()) {
      await switcher.click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: join(OUT_DIR, `${vp.name}-04-account-switcher.png`), fullPage: false });
      const gestionar = page.locator('button:has-text("Gestionar cuentas"), [role="menuitem"]:has-text("Gestionar cuentas")').first();
      if (await gestionar.count()) {
        await gestionar.click();
        await page.waitForTimeout(700);
        await page.screenshot({ path: join(OUT_DIR, `${vp.name}-05-manage-accounts.png`), fullPage: false });
        const manageInfo = await page.evaluate(() => {
          const dlg = document.querySelector('[role="dialog"]');
          if (!dlg) return { found: false };
          const html = dlg.innerHTML;
          const hasGmailProvider = /Gmail/i.test(html) && /Arman/i.test(html);
          const pens = dlg.querySelectorAll('svg.lucide-pen-line, svg.lucide-pen, svg.lucide-edit-3, svg.lucide-edit');
          return {
            found: true,
            hasProviderDotName: hasGmailProvider,
            pencilIconCount: pens.length,
            dialogWidth: dlg.getBoundingClientRect().width,
          };
        });
        report.checks.manageAccounts = manageInfo;

        // Click first pencil to enter inline edit
        const pencil = page.locator('[role="dialog"] svg.lucide-pen-line, [role="dialog"] button:has(svg.lucide-pen-line)').first();
        if (await pencil.count()) {
          await pencil.click();
          await page.waitForTimeout(300);
          await page.screenshot({ path: join(OUT_DIR, `${vp.name}-06-pencil-edit.png`), fullPage: false });
          const editInfo = await page.evaluate(() => {
            const dlg = document.querySelector('[role="dialog"]');
            if (!dlg) return null;
            const inputs = dlg.querySelectorAll("input");
            const checks = dlg.querySelectorAll("svg.lucide-check");
            const xs = dlg.querySelectorAll("svg.lucide-x");
            return { inputCount: inputs.length, hasCheck: checks.length > 0, hasX: xs.length > 0 };
          });
          report.checks.inlineEdit = editInfo;
          await page.keyboard.press("Escape");
          await page.waitForTimeout(200);
        } else {
          report.checks.inlineEdit = "pencil not found";
        }

        // Test IMAP editor "Nombre visible" field
        try {
          // Look for any "Editar configuración" (only on IMAP accounts)
          const editCfg = page.locator('button:has-text("Editar configuración")').first();
          if (await editCfg.count()) {
            await editCfg.click();
            await page.waitForTimeout(500);
            await page.screenshot({ path: join(OUT_DIR, `${vp.name}-07-imap-editor.png`), fullPage: false });
            const imapInfo = await page.evaluate(() => {
              const dlg = document.querySelector('[role="dialog"]');
              if (!dlg) return null;
              const labels = Array.from(dlg.querySelectorAll("label")).map(l => l.textContent.trim());
              const hasNombreVisible = labels.some(l => l.toLowerCase().includes("nombre visible"));
              // Check ordering: Nombre visible should appear before Usuario
              const idxNombre = labels.findIndex(l => l.toLowerCase().includes("nombre visible"));
              const idxUsuario = labels.findIndex(l => l.toLowerCase().includes("usuario"));
              return { labels, hasNombreVisible, nombreBeforeUsuario: idxNombre !== -1 && idxUsuario !== -1 && idxNombre < idxUsuario };
            });
            report.checks.imapEditor = imapInfo;
          } else {
            report.checks.imapEditor = "no IMAP account with Editar configuración";
          }
        } catch (e) { report.checks.imapEditorError = e.message; }

        // Close
        await page.keyboard.press("Escape");
        await page.waitForTimeout(200);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(200);
      } else {
        report.checks.manageAccounts = "Gestionar cuentas button not found";
      }
    } else {
      report.checks.accountSwitcher = "trigger not found";
    }
  } catch (e) { report.checks.accountSwitcherError = e.message; }

  // ========== CHECK 4: Email de sistema card dismiss via EmailSetup ==========
  // EmailSetup only shows when "Añadir nueva cuenta" is clicked and there are 0 accounts in setup flow
  // We'll try to open the EmailSetup view by adding new account
  try {
    // Re-open switcher
    const switcher2 = page.locator("button:has(svg.lucide-chevron-down)").first();
    if (await switcher2.count()) {
      await switcher2.click();
      await page.waitForTimeout(300);
      const addBtn = page.locator('button:has-text("Añadir"), [role="menuitem"]:has-text("Añadir")').first();
      if (await addBtn.count()) {
        await addBtn.click();
        await page.waitForTimeout(700);
        await page.screenshot({ path: join(OUT_DIR, `${vp.name}-08-email-setup.png`), fullPage: false });
        const setupInfo = await page.evaluate(() => {
          // Find the blue card mentioning "Email de sistema"
          const texts = Array.from(document.querySelectorAll("*")).filter(e => e.children.length === 0 && e.textContent && e.textContent.includes("Email de sistema"));
          if (!texts.length) return { cardPresent: false };
          const card = texts[0].closest("div")?.parentElement;
          // Look for an X close button inside the card
          const xBtn = card?.querySelector('button:has(svg.lucide-x)');
          return { cardPresent: true, hasCloseX: !!xBtn };
        });
        report.checks.emailSistemaCard = setupInfo;

        // Try to dismiss
        if (setupInfo?.hasCloseX) {
          await page.evaluate(() => {
            const texts = Array.from(document.querySelectorAll("*")).filter(e => e.children.length === 0 && e.textContent && e.textContent.includes("Email de sistema"));
            const card = texts[0].closest("div")?.parentElement;
            const xBtn = card?.querySelector('button:has(svg.lucide-x)');
            xBtn?.click();
          });
          await page.waitForTimeout(300);
          await page.screenshot({ path: join(OUT_DIR, `${vp.name}-09-setup-dismissed.png`), fullPage: false });
          const dismissed = await page.evaluate(() => {
            return !Array.from(document.querySelectorAll("*")).some(e => e.textContent && e.textContent.includes("Email de sistema activo"));
          });
          report.checks.emailSistemaDismissed = dismissed;
          // Verify localStorage persistence
          const lsKey = await page.evaluate(() => {
            const keys = Object.keys(localStorage);
            return keys.filter(k => /system|sistema|dismiss/i.test(k));
          });
          report.checks.localStorageKeys = lsKey;
        }
      } else {
        report.checks.addAccountButton = "not found in switcher menu";
      }
    }
  } catch (e) { report.checks.emailSetupError = e.message; }

  await page.screenshot({ path: join(OUT_DIR, `${vp.name}-10-final.png`), fullPage: true });

  await ctx.close();
  results.push(report);
}

await browser.close();
await writeFile(join(OUT_DIR, "report.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
