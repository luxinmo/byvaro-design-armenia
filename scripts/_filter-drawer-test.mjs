import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = "http://localhost:8080";
const OUT = "/Users/armanyeghiazaryan/byvaro-design-armenia/screenshots/filter-drawer";
await mkdir(OUT, { recursive: true });

const consoleErrors = [];
const log = [];
function L(s){ console.log(s); log.push(s); }

const browser = await chromium.launch();

async function login(page) {
  await page.goto(BASE + "/login", { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', "arman@byvaro.com");
  await page.fill('input[type="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(inicio|registros|promociones)/, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(800);
}

// ─── DESKTOP 1440 ────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => consoleErrors.push("[1440] pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push("[1440] console.error: " + m.text()); });

  await login(page);
  await page.goto(BASE + "/registros", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/01-registros-1440-closed.png`, fullPage: false });

  // Click Filtros button
  const filterBtn = await page.locator('button:has-text("Filtros")').first();
  if (!(await filterBtn.count())) {
    L("✗ DESKTOP: No Filtros button found");
  } else {
    await filterBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/02-registros-1440-drawer-open.png`, fullPage: false });

    // Inspect drawer dimensions/position
    const drawerInfo = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('[role="dialog"], [data-state="open"]'));
      const found = candidates.find(el => {
        const t = el.textContent || "";
        return t.includes("Filtros") && (t.includes("Origen") || t.includes("Promoción") || t.includes("Limpiar"));
      });
      if (!found) return null;
      const r = found.getBoundingClientRect();
      const cs = getComputedStyle(found);
      return {
        x: Math.round(r.x), y: Math.round(r.y),
        width: Math.round(r.width), height: Math.round(r.height),
        position: cs.position, transform: cs.transform,
        right: Math.round(window.innerWidth - r.right),
        innerWidth: window.innerWidth, innerHeight: window.innerHeight,
        rolesAtRoot: Array.from(document.querySelectorAll('[role="dialog"]')).length,
      };
    });
    L(`DESKTOP drawer: ${JSON.stringify(drawerInfo)}`);

    // Verify header parts
    const hasTitle = await page.locator('h2, h3, [role="heading"]').filter({ hasText: /^Filtros$/ }).count();
    const hasCloseX = await page.locator('button[aria-label*="errar" i], button:has(svg.lucide-x)').count();
    L(`DESKTOP header: titleCount=${hasTitle} closeBtnCount=${hasCloseX}`);

    // Sections
    const hasOrigen = await page.locator('text=/Origen y agencia|Origen/i').count();
    const hasPromo = await page.locator('text=/Promoción y mercado|Promoción/i').count();
    const hasFecha = await page.locator('text=/Fecha y duplicados|Solo duplicados/i').count();
    L(`DESKTOP sections: origen=${hasOrigen} promocion=${hasPromo} fecha=${hasFecha}`);

    // Footer
    const hasLimpiar = await page.locator('button:has-text("Limpiar todo")').count();
    const hasVerResultados = await page.locator('button').filter({ hasText: /Ver \d+ resultados?/i }).count();
    const hasVerAny = await page.locator('button:has-text("Ver")').count();
    L(`DESKTOP footer: limpiar=${hasLimpiar} verResultados=${hasVerResultados} verAny=${hasVerAny}`);

    // Agency rows: logo (img) + name + location + check
    const agencyImgs = await page.locator('img').count();
    L(`DESKTOP imgs in drawer area total: ${agencyImgs}`);

    // Try search input "prime"
    const searchInputs = page.locator('input[placeholder*="uscar" i], input[type="search"]');
    const sCount = await searchInputs.count();
    L(`DESKTOP search inputs: ${sCount}`);
    // The agency search likely is the second one (after promo or unique to agency block)
    let agencySearchFound = false;
    for (let i = 0; i < sCount; i++) {
      const ph = await searchInputs.nth(i).getAttribute("placeholder");
      if (ph && /agenc/i.test(ph)) {
        await searchInputs.nth(i).fill("prime");
        await page.waitForTimeout(400);
        agencySearchFound = true;
        L(`DESKTOP agency search: filled "prime" in input[placeholder="${ph}"]`);
        break;
      }
    }
    if (!agencySearchFound) L("DESKTOP agency search: not found by placeholder /agenc/i");

    await page.screenshot({ path: `${OUT}/03-registros-1440-search-prime.png`, fullPage: false });

    // Select 2 agencies (click rows that contain text "Prime" or first 2 visible agency rows)
    // Heuristic: agency rows are buttons or list items with role="button" or with images + check icon support
    const beforeBadge = await page.locator('button:has-text("Filtros")').first().textContent();
    L(`DESKTOP filter button text before select: "${beforeBadge}"`);

    // Click first 2 agency option rows inside the agencies list
    const agencyRows = page.locator('button, [role="option"], li').filter({ has: page.locator('img') });
    const rowsCount = await agencyRows.count();
    L(`DESKTOP candidate agency rows (with img): ${rowsCount}`);
    if (rowsCount >= 2) {
      await agencyRows.nth(0).click().catch(() => {});
      await page.waitForTimeout(200);
      await agencyRows.nth(1).click().catch(() => {});
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: `${OUT}/04-registros-1440-agencies-2-selected.png`, fullPage: false });

    // Close drawer
    const closeBtn = page.locator('button:has(svg.lucide-x)').last();
    if (await closeBtn.count()) await closeBtn.click();
    await page.waitForTimeout(500);

    const filterTextAfter = await page.locator('button:has-text("Filtros")').first().textContent();
    L(`DESKTOP filter button text AFTER select+close: "${filterTextAfter}"`);
    await page.screenshot({ path: `${OUT}/05-registros-1440-after-close-badge.png`, fullPage: false });
  }

  await ctx.close();
}

// ─── MOBILE 375 ──────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => consoleErrors.push("[375] pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push("[375] console.error: " + m.text()); });

  await login(page);
  await page.goto(BASE + "/registros", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/10-registros-375-closed.png`, fullPage: false });

  const filterBtn = page.locator('button:has-text("Filtros")').first();
  if (!(await filterBtn.count())) {
    L("✗ MOBILE: No Filtros button found");
  } else {
    await filterBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/11-registros-375-drawer-open.png`, fullPage: false });

    const drawerInfo = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('[role="dialog"], [data-state="open"]'));
      const found = candidates.find(el => {
        const t = el.textContent || "";
        return t.includes("Filtros") && (t.includes("Origen") || t.includes("Promoción") || t.includes("Limpiar"));
      });
      if (!found) return null;
      const r = found.getBoundingClientRect();
      const cs = getComputedStyle(found);
      return {
        x: Math.round(r.x), y: Math.round(r.y),
        width: Math.round(r.width), height: Math.round(r.height),
        position: cs.position,
        innerWidth: window.innerWidth, innerHeight: window.innerHeight,
        coversFullWidth: Math.round(r.width) >= window.innerWidth - 2,
        coversFullHeight: Math.round(r.height) >= window.innerHeight - 2,
      };
    });
    L(`MOBILE drawer: ${JSON.stringify(drawerInfo)}`);

    // Test scrolling inside
    const scrollResult = await page.evaluate(() => {
      const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
      const found = dialogs.find(d => (d.textContent || "").includes("Filtros"));
      if (!found) return { err: "no dialog" };
      const scrollers = Array.from(found.querySelectorAll("*")).filter(el => {
        const cs = getComputedStyle(el);
        return /(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 2;
      });
      return { scrollerCount: scrollers.length, dialogScrollH: found.scrollHeight, dialogClientH: found.clientHeight };
    });
    L(`MOBILE scroll: ${JSON.stringify(scrollResult)}`);

    // Toggle "Solo duplicados" switch and verify footer count update
    const beforeFooter = await page.locator('button:has-text("Ver")').last().textContent().catch(() => null);
    L(`MOBILE footer BEFORE toggle: "${beforeFooter}"`);

    const dupSwitch = page.locator('[role="switch"]').first();
    if (await dupSwitch.count()) {
      await dupSwitch.click();
      await page.waitForTimeout(400);
    }
    const afterFooter = await page.locator('button:has-text("Ver")').last().textContent().catch(() => null);
    L(`MOBILE footer AFTER toggle: "${afterFooter}"`);
    await page.screenshot({ path: `${OUT}/12-registros-375-toggle-duplicates.png`, fullPage: false });

    // Close X
    const closeBtn = page.locator('button:has(svg.lucide-x)').last();
    const closeCount = await closeBtn.count();
    L(`MOBILE close X button count: ${closeCount}`);
    if (closeCount) {
      await closeBtn.click();
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: `${OUT}/13-registros-375-after-close.png`, fullPage: false });
  }

  await ctx.close();
}

// ─── PROMOCIONES regression — desktop + mobile ─────────────────────────────
for (const vp of [{ w: 1440, h: 900, tag: "1440" }, { w: 375, h: 812, tag: "375" }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => consoleErrors.push(`[promo-${vp.tag}] pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(`[promo-${vp.tag}] console.error: ${m.text()}`); });

  await login(page);
  await page.goto(BASE + "/promociones", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/20-promociones-${vp.tag}-closed.png`, fullPage: false });

  const filterBtn = page.locator('button:has-text("Filtros")').first();
  const cnt = await filterBtn.count();
  L(`PROMO ${vp.tag}: Filtros btn count = ${cnt}`);
  if (cnt) {
    await filterBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/21-promociones-${vp.tag}-drawer.png`, fullPage: false });

    const dInfo = await page.evaluate(() => {
      const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
      const found = dialogs.find(d => (d.textContent || "").includes("Filtros"));
      if (!found) return null;
      const r = found.getBoundingClientRect();
      return { x: Math.round(r.x), width: Math.round(r.width), height: Math.round(r.height), iw: window.innerWidth, ih: window.innerHeight };
    });
    L(`PROMO ${vp.tag} drawer: ${JSON.stringify(dInfo)}`);
  }
  await ctx.close();
}

await browser.close();

console.log("\n──── CONSOLE ERRORS ────");
if (consoleErrors.length === 0) console.log("(none)");
else consoleErrors.forEach((e) => console.log("  " + e));
