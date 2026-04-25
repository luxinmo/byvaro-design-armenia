/**
 * E2E · Regresión completa de /registros
 *
 * Verifica:
 *   A · Default state · tab "Pendientes" + badge sidebar
 *   B · Drawer de filtros · secciones, agencias con logos, badge
 *   C · Detail · Cross-promoción banner (reg-005 vs reg-024)
 *   D · "No es duplicado" · descarta el match
 *   E · MatchConfirmDialog (reg-010 88%)
 *   F · RejectDialog · 3 motivos + textarea Otro
 *   G · Mobile 375px · tabs fade · footer · drawer full-screen
 *
 *  Lanzar:  node scripts/_regression-registros-full.mjs
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = "http://localhost:8080";
const OUT = "screenshots/regression-registros-full";

let pass = 0;
let fail = 0;
const results = [];
const ok = (msg) => { pass++; results.push({ ok: true, msg }); console.log(`  ✓ ${msg}`); };
const ko = (msg, extra) => {
  fail++;
  results.push({ ok: false, msg, extra });
  console.log(`  ✗ ${msg}${extra ? ` · ${extra}` : ""}`);
};

const consoleErrors = [];

async function clickCardByText(page, needle, extraNeedle) {
  const cards = page.locator("article");
  const n = await cards.count();
  for (let i = 0; i < n; i++) {
    const t = await cards.nth(i).innerText().catch(() => "");
    if (t.includes(needle) && (!extraNeedle || t.includes(extraNeedle))) {
      await cards.nth(i).click();
      await page.waitForTimeout(450);
      return i;
    }
  }
  return -1;
}

async function cancelDialogIfOpen(page) {
  const btn = page.locator("[role='dialog'] button", { hasText: /^Cancelar$/ });
  if (await btn.count()) {
    await btn.first().click();
    await page.waitForTimeout(300);
  } else {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
}

async function closeDrawer(page) {
  const closeBtn = page.locator("aside[role='dialog'][aria-label='Filtros de registros'] button[aria-label='Cerrar filtros']");
  if (await closeBtn.count()) {
    await closeBtn.first().click();
    await page.waitForTimeout(350);
  }
}

async function openDrawer(page) {
  // El botón puede ser "Filtros" o "Filtros3" (con badge concatenado en el DOM, sin espacio).
  await page.locator("button:has(svg.lucide-filter)").first().click().catch(async () => {
    await page.locator("button", { hasText: /Filtros/ }).first().click();
  });
  await page.waitForTimeout(350);
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const armanCard = page.locator("button", { hasText: "Arman Rahmanov" }).first();
  if (await armanCard.count()) {
    await armanCard.click();
  } else {
    await page.fill("input#login-email", "arman@byvaro.com");
    await page.fill("input#login-password", "demo1234");
    await page.locator("button", { hasText: "Iniciar sesión" }).click();
  }
  await page.waitForURL(/\/inicio/, { timeout: 8000 });
  await page.waitForTimeout(400);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => {
    consoleErrors.push(`[pageerror] ${e.message}`);
    console.log(`  ! pageerror: ${e.message}`);
  });
  page.on("console", (m) => {
    if (m.type() === "error") {
      const text = m.text();
      // Filtra ruido de Vite/HMR
      if (/Failed to load resource|404|favicon/i.test(text)) return;
      consoleErrors.push(`[console.error] ${text}`);
    }
  });

  /* ─── Login + nav ─── */
  console.log("\n── SETUP ──");
  await login(page);
  ok("Login arman@byvaro.com");
  await page.goto(`${BASE}/registros`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  ok("Navegación a /registros");

  /* ═══════════════════════════════════════════════════════════
     TEST A · Default state
     ═══════════════════════════════════════════════════════════ */
  console.log("\n── TEST A · Default state ──");
  // Tab "Pendientes" activo · clase bg-foreground
  const pendientesTab = page.locator("button", { hasText: /^Pendientes$/ }).first();
  if (!(await pendientesTab.count())) {
    ko("Tab Pendientes no encontrado");
  } else {
    const cls = (await pendientesTab.getAttribute("class")) || "";
    if (cls.includes("bg-foreground")) ok("Tab 'Pendientes' activo (bg-foreground)");
    else ko("Tab 'Pendientes' NO activo", `class: ${cls.slice(0, 100)}`);
  }

  // Sidebar · Registros con badge numérico (rojo)
  const sidebarRegistros = page.locator("a[href='/registros']").first();
  if (!(await sidebarRegistros.count())) {
    ko("Link Registros del sidebar no encontrado");
  } else {
    const sidebarText = await sidebarRegistros.innerText().catch(() => "");
    // Buscamos un número junto al label
    const badgeMatch = sidebarText.match(/Registros\s*(\d+)/);
    if (badgeMatch) ok(`Sidebar Registros con badge numérico: ${badgeMatch[1]}`);
    else ko("Badge numérico no encontrado en sidebar Registros", `texto: ${sidebarText}`);
  }

  await page.screenshot({ path: `${OUT}/01-default.png`, fullPage: false });
  ok("Screenshot 01-default.png");

  /* ═══════════════════════════════════════════════════════════
     TEST B · Drawer de filtros
     ═══════════════════════════════════════════════════════════ */
  console.log("\n── TEST B · Drawer de filtros ──");
  await openDrawer(page);
  const drawer = page.locator("aside[role='dialog'][aria-label='Filtros de registros']");
  if (!(await drawer.count())) {
    ko("Drawer de filtros NO se abrió");
  } else {
    ok("Drawer abierto");
    const drawerText = await drawer.innerText().catch(() => "");

    // Secciones canónicas
    if (/Origen y agencia/i.test(drawerText)) ok("Sección 'Origen y agencia'");
    else ko("Falta sección 'Origen y agencia'");

    if (/Promoción y mercado/i.test(drawerText)) ok("Sección 'Promoción y mercado'");
    else ko("Falta sección 'Promoción y mercado'");

    if (/Fecha y duplicados/i.test(drawerText)) ok("Sección 'Fecha y duplicados'");
    else ko("Falta sección 'Fecha y duplicados'");

    // Bandera 🇫🇷 en nacionalidad
    if (/🇫🇷/.test(drawerText)) ok("Bandera 🇫🇷 presente en nacionalidades");
    else ko("Bandera 🇫🇷 no encontrada en el drawer");

    // Logos en la lista de agencias · img dentro del agency picker
    const agencyImgs = await drawer.locator("img").count();
    if (agencyImgs > 0) ok(`Logos de agencias presentes (${agencyImgs} <img>)`);
    else ko("No se encontraron <img> de logos de agencias");

    // Buscar campo de búsqueda de agencias · placeholder "Buscar por nombre o ubicación…"
    const hasAgencySearch = await drawer.locator("input[placeholder*='nombre o ubicación' i], input[placeholder*='ubicación' i]").count();
    if (hasAgencySearch) ok("Buscador de agencias presente (placeholder 'nombre o ubicación')");
    else ko("Buscador de agencias no encontrado");

    await page.screenshot({ path: `${OUT}/02-drawer.png`, fullPage: false });
    ok("Screenshot 02-drawer.png");

    // Click una agencia
    const agencyButtons = drawer.locator("button");
    const agencyN = await agencyButtons.count();
    let clickedAgency = false;
    for (let i = 0; i < agencyN; i++) {
      const t = await agencyButtons.nth(i).innerText().catch(() => "");
      if (/Prime Properties|Costa|Mediterranean|Luxury/i.test(t) && !/Limpiar|Cerrar/i.test(t)) {
        await agencyButtons.nth(i).click();
        await page.waitForTimeout(300);
        clickedAgency = true;
        break;
      }
    }
    if (clickedAgency) ok("Agencia seleccionada en el drawer");
    else ko("No fue posible clicar una agencia");

    await page.waitForTimeout(300);
    // Cerrar drawer y verificar badge "1" en el botón Filtros
    await closeDrawer(page);

    const filtrosBtn = page.locator("button:has(svg.lucide-filter)").first();
    const filtrosText = await filtrosBtn.innerText().catch(() => "");
    if (/1/.test(filtrosText.replace(/Filtros/, ""))) ok(`Badge '1' aparece en botón Filtros (texto: '${filtrosText.replace(/\s+/g, "")}')`);
    else ko("Badge '1' NO aparece en botón Filtros", `texto: ${filtrosText}`);

    await page.screenshot({ path: `${OUT}/03-drawer-with-agency.png`, fullPage: false });
    ok("Screenshot 03-drawer-with-agency.png");

    // Limpiar el filtro abriendo de nuevo y limpiando (para no contaminar tests siguientes)
    await openDrawer(page);
    const limpiarBtn = page.locator("aside[role='dialog'] button", { hasText: /Limpiar/ }).first();
    if (await limpiarBtn.count()) {
      await limpiarBtn.click().catch(() => {});
      await page.waitForTimeout(200);
    }
    await closeDrawer(page);
  }

  /* ═══════════════════════════════════════════════════════════
     TEST C · Detail · Cross-promoción banner (reg-005)
     ═══════════════════════════════════════════════════════════ */
  console.log("\n── TEST C · Cross-promoción banner ──");
  // Asegurarnos de estar en pendientes
  await page.locator("button", { hasText: /^Pendientes$/ }).first().click();
  await page.waitForTimeout(300);
  const idxJames = await clickCardByText(page, "James O'Connor");
  if (idxJames < 0) {
    ko("Card James O'Connor (reg-005) no encontrada");
  } else {
    ok(`Card reg-005 clicada (idx ${idxJames})`);

    const bodyText = await page.locator("body").innerText();

    // Header con nombre
    if (/James O'Connor/.test(bodyText)) ok("Header detalle muestra 'James O'Connor'");
    else ko("Header detalle NO muestra 'James O'Connor'");

    // Marina Bay Towers (promoción 2)
    if (/Marina Bay Towers/.test(bodyText)) ok("Detalle muestra promoción 'Marina Bay Towers'");
    else ko("Promoción 'Marina Bay Towers' no aparece");

    // Banner cross-promoción · texto canónico
    if (/Posible conflicto cross-promoción/i.test(bodyText)) {
      ok("Banner cross-promoción presente ('Posible conflicto cross-promoción')");
    } else {
      ko("Banner cross-promoción NO presente");
    }

    // El banner usa role="alert" · verificar
    const alertCount = await page.locator("[role='alert']").count();
    if (alertCount > 0) ok(`role='alert' presente (${alertCount})`);
    else ko("No hay [role='alert'] visible");

    // Bloque "Coincidencia parcial" + botón "No es duplicado"
    if (/Coincidencia parcial/i.test(bodyText)) ok("Bloque 'Coincidencia parcial' presente");
    else ko("Bloque 'Coincidencia parcial' NO presente");

    const noDupBtn = page.locator("button", { hasText: /No es duplicado/ });
    if (await noDupBtn.count()) ok("Botón 'No es duplicado' presente");
    else ko("Botón 'No es duplicado' no encontrado");

    await page.screenshot({ path: `${OUT}/04-detail-cross-promo.png`, fullPage: true });
    ok("Screenshot 04-detail-cross-promo.png");
  }

  /* ═══════════════════════════════════════════════════════════
     TEST D · "No es duplicado"
     ═══════════════════════════════════════════════════════════ */
  console.log("\n── TEST D · Click 'No es duplicado' ──");
  const noDupBtn = page.locator("button", { hasText: /No es duplicado/ }).first();
  if (!(await noDupBtn.count())) {
    ko("Botón 'No es duplicado' no encontrado para Test D");
  } else {
    await noDupBtn.click();
    await page.waitForTimeout(700);

    const bodyAfter = await page.locator("body").innerText();
    if (!/Coincidencia parcial/i.test(bodyAfter)) ok("Bloque 'Coincidencia parcial' desapareció");
    else ko("Bloque 'Coincidencia parcial' sigue visible tras descartar");

    // Toast "Match descartado"
    if (/Match descartado/i.test(bodyAfter)) ok("Toast 'Match descartado' visible");
    else ko("Toast 'Match descartado' no visible (puede haber expirado)");

    await page.screenshot({ path: `${OUT}/05-no-duplicate.png`, fullPage: true });
    ok("Screenshot 05-no-duplicate.png");
  }

  /* ═══════════════════════════════════════════════════════════
     TEST E · MatchConfirmDialog · reg-010 Émilie Rousseau 88%
     ═══════════════════════════════════════════════════════════ */
  console.log("\n── TEST E · MatchConfirmDialog reg-010 ──");
  // Volver a la lista en pendientes
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator("button", { hasText: /^Pendientes$/ }).first().click();
  await page.waitForTimeout(300);

  // Buscar la card de Émilie Rousseau con 88%
  const cards = page.locator("article");
  const cardN = await cards.count();
  let emilieIdx = -1;
  for (let i = 0; i < cardN; i++) {
    const t = await cards.nth(i).innerText().catch(() => "");
    if (t.includes("Émilie Rousseau") && t.includes("88%")) { emilieIdx = i; break; }
  }
  if (emilieIdx < 0) {
    ko("Card reg-010 (Émilie Rousseau 88%) no encontrada");
  } else {
    await cards.nth(emilieIdx).click();
    await page.waitForTimeout(450);
    ok(`Card reg-010 clicada (idx ${emilieIdx})`);

    const aprobarBtn = page.locator("button:not([disabled])", { hasText: /^Aprobar$/ }).last();
    if (!(await aprobarBtn.count())) {
      ko("Botón Aprobar no disponible en reg-010");
    } else {
      await aprobarBtn.click();
      await page.waitForTimeout(500);
      const dialog = page.locator("[role='dialog']").first();
      const dlgText = await dialog.innerText().catch(() => "");

      if (/Coincidencia detectada/i.test(dlgText)) ok("Dialog 'Coincidencia detectada' presente");
      else ko("'Coincidencia detectada' no aparece", `txt: ${dlgText.slice(0, 160)}`);

      if (/\d{2,3}\s*%/.test(dlgText)) ok("Dialog muestra %");
      else ko("Dialog NO muestra %");

      if (/Cliente existente/i.test(dlgText)) ok("Sección 'Cliente existente' presente");
      else ko("'Cliente existente' no aparece");

      const cancelBtn = dialog.locator("button", { hasText: /^Cancelar$/ });
      if (await cancelBtn.count()) ok("Botón 'Cancelar' presente");
      else ko("Botón 'Cancelar' no presente");

      const continueBtn = dialog.locator("button", { hasText: /Continuar/i });
      if (await continueBtn.count()) ok("Botón 'Continuar con la aprobación' presente");
      else ko("Botón 'Continuar...' no presente");

      await page.screenshot({ path: `${OUT}/06-match-dialog.png`, fullPage: false });
      ok("Screenshot 06-match-dialog.png");

      await cancelDialogIfOpen(page);
    }
  }

  /* ═══════════════════════════════════════════════════════════
     TEST F · RejectDialog
     ═══════════════════════════════════════════════════════════ */
  console.log("\n── TEST F · RejectDialog ──");
  // Click un card pendiente · seguimos en reg-010 abierto.
  const rechazarBtn = page.locator("button:not([disabled])", { hasText: /^Rechazar$/ }).last();
  if (!(await rechazarBtn.count())) {
    ko("Botón 'Rechazar' no disponible");
  } else {
    await rechazarBtn.click();
    await page.waitForTimeout(450);

    const dialog = page.locator("[role='dialog']").first();
    const dlgText = await dialog.innerText().catch(() => "");

    if (/Rechazar\s*·/.test(dlgText)) ok("Dialog title 'Rechazar · {nombre}' presente");
    else ko("Dialog title incorrecto", `txt: ${dlgText.slice(0, 160)}`);

    // 3 motivos
    if (/Cliente ya registrado por otra agencia/i.test(dlgText)) ok("Motivo 'Cliente ya registrado por otra agencia'");
    else ko("Motivo 'Cliente ya registrado por otra agencia' no presente");

    if (/Datos incompletos o incorrectos/i.test(dlgText)) ok("Motivo 'Datos incompletos o incorrectos'");
    else ko("Motivo 'Datos incompletos o incorrectos' no presente");

    if (/Otro/i.test(dlgText)) ok("Motivo 'Otro' presente");
    else ko("Motivo 'Otro' no presente");

    // Click "Otro"
    const otroRadio = dialog.locator("label", { hasText: /^Otro/ }).first();
    if (!(await otroRadio.count())) {
      ko("Label 'Otro' no clickable");
    } else {
      await otroRadio.click();
      await page.waitForTimeout(250);

      const dlgTextAfter = await dialog.innerText().catch(() => "");
      if (/Comentario.*obligatorio/i.test(dlgTextAfter)) ok("Label 'Comentario · obligatorio' visible tras click 'Otro'");
      else ko("Label 'Comentario obligatorio' no visible", `txt: ${dlgTextAfter.slice(0, 160)}`);

      // Botón Confirmar rechazo deshabilitado inicialmente
      const confirmBtn = dialog.locator("button", { hasText: /Confirmar rechazo/i }).first();
      const disabledBefore = await confirmBtn.isDisabled().catch(() => null);
      if (disabledBefore === true) ok("Botón 'Confirmar rechazo' deshabilitado sin texto");
      else ko(`Botón 'Confirmar rechazo' debería estar deshabilitado · disabled=${disabledBefore}`);

      // Escribir comentario
      const textarea = dialog.locator("textarea").first();
      if (!(await textarea.count())) {
        ko("Textarea no encontrada");
      } else {
        await textarea.fill("test motivo personalizado");
        await page.waitForTimeout(250);

        const disabledAfter = await confirmBtn.isDisabled().catch(() => null);
        if (disabledAfter === false) ok("Botón 'Confirmar rechazo' habilitado tras escribir 25 chars");
        else ko(`Botón sigue deshabilitado tras escribir · disabled=${disabledAfter}`);
      }

      await page.screenshot({ path: `${OUT}/07-reject-other.png`, fullPage: false });
      ok("Screenshot 07-reject-other.png");

      await cancelDialogIfOpen(page);
    }
  }

  /* ═══════════════════════════════════════════════════════════
     TEST G · Mobile 375px
     ═══════════════════════════════════════════════════════════ */
  console.log("\n── TEST G · Mobile 375x812 ──");
  await ctx.close();
  const mctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const mpage = await mctx.newPage();
  mpage.on("pageerror", (e) => { consoleErrors.push(`[mobile pageerror] ${e.message}`); });
  mpage.on("console", (m) => {
    if (m.type() === "error") {
      const t = m.text();
      if (/Failed to load resource|404|favicon/i.test(t)) return;
      consoleErrors.push(`[mobile console.error] ${t}`);
    }
  });

  await login(mpage);
  ok("Mobile login");
  await mpage.goto(`${BASE}/registros`, { waitUntil: "networkidle" });
  await mpage.waitForTimeout(700);

  // G.1 · Tabs con fade gradient · selector clase 'pointer-events-none' + 'gradient-to-l'
  const fadeEl = mpage.locator("div.pointer-events-none.bg-gradient-to-l, div[class*='from-background'][class*='to-transparent']").first();
  if (await fadeEl.count()) ok("Fade gradient en tabs presente");
  else ko("Fade gradient no encontrado");

  await mpage.screenshot({ path: `${OUT}/08-mobile-tabs.png`, fullPage: false });
  ok("Screenshot 08-mobile-tabs.png");

  // G.2 · Click una card pendiente
  const mcards = mpage.locator("article");
  const mcardN = await mcards.count();
  let pendingIdx = -1;
  for (let i = 0; i < mcardN; i++) {
    const t = await mcards.nth(i).innerText().catch(() => "");
    if (/Pendiente/i.test(t)) { pendingIdx = i; break; }
  }
  if (pendingIdx < 0) {
    ko("No se encontró card pendiente en mobile");
  } else {
    await mcards.nth(pendingIdx).click();
    await mpage.waitForTimeout(600);
    ok(`Card pendiente clicada en mobile (idx ${pendingIdx})`);

    // Scroll al final
    await mpage.evaluate(() => {
      const containers = Array.from(document.querySelectorAll("[data-scroll-container]"));
      for (const c of containers) c.scrollTo(0, c.scrollHeight);
      window.scrollTo(0, document.body.scrollHeight);
    });
    await mpage.waitForTimeout(400);

    // Verificar visibilidad del footer Aprobar/Rechazar
    const footerAprobar = mpage.locator("button", { hasText: /^Aprobar$/ }).last();
    const footerRechazar = mpage.locator("button", { hasText: /^Rechazar$/ }).last();
    const aBox = await footerAprobar.boundingBox().catch(() => null);
    const rBox = await footerRechazar.boundingBox().catch(() => null);

    if (aBox && rBox) {
      ok(`Footer Aprobar/Rechazar localizados (Aprobar.y=${Math.round(aBox.y)})`);

      // Verificar gap con MobileBottomNav · suele ser fixed bottom-0 con h≈60-72
      // Comprobamos que el footer queda dentro del viewport (375x812)
      if (aBox.y + aBox.height <= 812) {
        ok(`Footer dentro del viewport (Aprobar.y+h=${Math.round(aBox.y + aBox.height)} <= 812)`);
      } else {
        ko(`Footer fuera de viewport (y+h=${Math.round(aBox.y + aBox.height)} > 812)`);
      }

      // Calcular gap: distancia entre el bottom del footer Aprobar y el top del MobileBottomNav
      const navBox = await mpage.locator("nav.fixed.bottom-0, [class*='MobileBottomNav'], nav[class*='fixed'][class*='bottom']").first().boundingBox().catch(() => null);
      if (navBox) {
        const gap = navBox.y - (aBox.y + aBox.height);
        if (gap >= 10) ok(`Gap footer↔MobileBottomNav = ${Math.round(gap)}px (>=10)`);
        else if (gap >= 0) ok(`Gap footer↔MobileBottomNav = ${Math.round(gap)}px (>=0; aceptable)`);
        else ko(`Footer SOLAPA con MobileBottomNav · gap=${Math.round(gap)}px`);
      } else {
        // Sin barra detectada · solo verificamos que el footer no esté tapado.
        ok("MobileBottomNav no detectada (selector); footer dentro de viewport ya verificado");
      }
    } else {
      ko("No se pudieron medir botones Aprobar/Rechazar en mobile");
    }

    await mpage.screenshot({ path: `${OUT}/09-mobile-detail-footer.png`, fullPage: false });
    ok("Screenshot 09-mobile-detail-footer.png");
  }

  // G.3 · Drawer FULL-SCREEN en mobile
  // Volver a /registros para que el botón Filtros esté visible
  await mpage.goto(`${BASE}/registros`, { waitUntil: "networkidle" });
  await mpage.waitForTimeout(500);
  await mpage.locator("button:has(svg.lucide-filter)").first().click().catch(async () => {
    await mpage.locator("button", { hasText: /Filtros/ }).first().click();
  });
  await mpage.waitForTimeout(400);

  const mdrawer = mpage.locator("aside[role='dialog'][aria-label='Filtros de registros']");
  if (!(await mdrawer.count())) {
    ko("Drawer mobile no abre");
  } else {
    const dBox = await mdrawer.boundingBox();
    if (dBox && dBox.width >= 370) ok(`Drawer full-screen en mobile (w=${Math.round(dBox.width)})`);
    else ko(`Drawer NO full-screen en mobile · w=${dBox?.width}`);

    await mpage.screenshot({ path: `${OUT}/10-mobile-drawer.png`, fullPage: false });
    ok("Screenshot 10-mobile-drawer.png");
  }

  /* ─── Summary ─── */
  const total = pass + fail;
  console.log(`\n══════════════════════════════════════════`);
  console.log(`  Summary: ${pass}/${total} passed · ${fail} failed`);
  console.log(`══════════════════════════════════════════`);
  if (fail > 0) {
    console.log("\nFailed steps:");
    results.filter((r) => !r.ok).forEach((r) => console.log(`  ✗ ${r.msg}${r.extra ? ` — ${r.extra}` : ""}`));
  }

  if (consoleErrors.length > 0) {
    console.log(`\nConsole errors capturados (${consoleErrors.length}):`);
    consoleErrors.slice(0, 10).forEach((e) => console.log(`  ${e}`));
  } else {
    console.log("\nNo console errors capturados.");
  }

  console.log(`\nScreenshots en: ${OUT}/`);
  console.log(`  01-default.png · 02-drawer.png · 03-drawer-with-agency.png`);
  console.log(`  04-detail-cross-promo.png · 05-no-duplicate.png · 06-match-dialog.png`);
  console.log(`  07-reject-other.png · 08-mobile-tabs.png · 09-mobile-detail-footer.png · 10-mobile-drawer.png`);

  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(2); });
