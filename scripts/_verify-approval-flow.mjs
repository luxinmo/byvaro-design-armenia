/**
 * E2E · Verificación del flujo de aprobación en /registros
 *
 * Tests:
 *   A · reg-005 (James O'Connor) · DNI oculto + teléfono enmascarado
 *   B · Historial plegado por defecto · toggle expande
 *   C · reg-008/009 (match >= 65%) · MatchConfirmDialog
 *   D · reg-003 (Joris van der Berg) · RelationConfirmDialog
 *   E · reg-023 visit_only (Anna-Liisa Virtanen) · VisitConfirmDialog directo
 *   F · reg-002 (Lars Bergström) registration_visit · VisitConfirmDialog directo
 *
 *  Lanzar con:  node scripts/_verify-approval-flow.mjs
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const BASE = "http://localhost:8080";
const OUT = "screenshots/approval-flow";

/* ─── utilidades de logging ─── */
let pass = 0;
let fail = 0;
const results = [];
const ok = (msg) => { pass++; results.push({ ok: true, msg }); console.log(`✓ ${msg}`); };
const ko = (msg, extra) => {
  fail++;
  results.push({ ok: false, msg, extra });
  console.log(`✗ ${msg}${extra ? ` · ${extra}` : ""}`);
};

/* ─── selector helpers ─── */
async function clickCardByName(page, needle) {
  const cards = page.locator("article");
  const n = await cards.count();
  for (let i = 0; i < n; i++) {
    const t = await cards.nth(i).innerText().catch(() => "");
    if (t.includes(needle)) {
      await cards.nth(i).click();
      await page.waitForTimeout(450);
      return true;
    }
  }
  return false;
}

/** Navega de detalle a lista (móvil) / o limpia activeId clicando otro card (desktop). */
async function backToList(page) {
  // En desktop la lista siempre es visible; basta con clicar otro registro para cambiar.
  // Pero necesitamos poder click-ar la misma tarjeta otra vez, así que forzamos
  // scroll-top y nos aseguramos de que la lista esté visible.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
}

async function cancelDialogIfOpen(page) {
  // Try clicking a button labelled "Cancelar" inside any open dialog (role=dialog)
  const btn = page.locator("[role='dialog'] button", { hasText: /^Cancelar$/ });
  if (await btn.count()) {
    await btn.first().click();
    await page.waitForTimeout(300);
  } else {
    // Fallback: press Escape
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
}

/* ─── main ─── */
async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));
  page.on("console", (m) => {
    if (m.type() === "error") console.log("[console.error]", m.text());
  });

  /* ─── Login ─── */
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  // Quick-login card · buscamos "Arman Rahmanov"
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
  ok("Login como arman@byvaro.com");

  /* ─── Ir a /registros ─── */
  await page.goto(`${BASE}/registros`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  ok("Navegación a /registros");

  /* ═══════════════════════════════════════════════════════════════
     TEST A · DNI oculto + teléfono enmascarado · reg-005 James O'Connor
     ═══════════════════════════════════════════════════════════════ */
  console.log("\n── TEST A · reg-005 DNI oculto + phone masked ──");
  const foundA = await clickCardByName(page, "James O'Connor");
  if (!foundA) {
    ko("Encontrar card reg-005 James O'Connor");
  } else {
    ok("Card reg-005 clicada");
    // Tomamos el texto del detalle · usamos el <section> que envuelve el detalle.
    // Pero más seguro: leer el body y buscar DNI / phone
    const bodyText = await page.locator("body").innerText();

    // a.1 · No debe aparecer el literal "DNI / NIE"
    const hasDniLabel = /DNI\s*\/\s*NIE/i.test(bodyText);
    if (!hasDniLabel) ok("Detalle NO contiene 'DNI / NIE'");
    else ko("Detalle contiene 'DNI / NIE' (no debería)");

    // a.2 · No debe aparecer el teléfono completo
    const fullPhone = "+44 7700 900 301";
    if (!bodyText.includes(fullPhone)) ok("Detalle NO contiene teléfono completo");
    else ko(`Detalle contiene el teléfono completo '${fullPhone}'`);

    // a.3 · Sí debe aparecer enmascarado · acepta '·' o '•'
    const maskedDot = bodyText.includes("+44 ··· ··· 0301") || bodyText.includes("··· ··· 0301");
    const maskedBullet = bodyText.includes("+44 ••• ••• 0301") || bodyText.includes("••• ••• 0301");
    if (maskedDot || maskedBullet) ok(`Teléfono enmascarado presente (${maskedDot ? "···" : "•••"} + 0301)`);
    else ko("Teléfono enmascarado NO encontrado", `buscado '+44 ··· ··· 0301'`);

    await page.screenshot({ path: `${OUT}/01-detail-masked.png`, fullPage: true });
    ok("Screenshot 01-detail-masked.png");
  }

  /* ═══════════════════════════════════════════════════════════════
     TEST B · Historial plegado por defecto · click expande
     ═══════════════════════════════════════════════════════════════ */
  console.log("\n── TEST B · Historial collapsed/expanded ──");
  const historialBtn = page.locator("button[aria-expanded]", { hasText: "Historial" }).first();
  const hasBtn = await historialBtn.count();
  if (!hasBtn) {
    ko("Botón 'Historial' no encontrado");
  } else {
    const expandedBefore = await historialBtn.getAttribute("aria-expanded");
    if (expandedBefore === "false") ok("Historial colapsado inicialmente (aria-expanded=false)");
    else ko(`Historial NO colapsado (aria-expanded=${expandedBefore})`);

    // Medimos altura del contenedor del detalle antes
    const detailLocator = page.locator("section >> article, section").first();
    // Más simple · comparar visibilidad del contenido del timeline
    // El timeline se renderiza como hijo directo tras click. Veamos el bounding box del parent del botón:
    const parent = historialBtn.locator("xpath=..");
    const boxBefore = await parent.boundingBox();

    await historialBtn.click();
    await page.waitForTimeout(500);

    const expandedAfter = await historialBtn.getAttribute("aria-expanded");
    if (expandedAfter === "true") ok("Tras click, aria-expanded=true");
    else ko(`Tras click, aria-expanded=${expandedAfter}`);

    const boxAfter = await parent.boundingBox();
    if (boxBefore && boxAfter && boxAfter.height > boxBefore.height + 20) {
      ok(`Altura del bloque aumentó: ${Math.round(boxBefore.height)} → ${Math.round(boxAfter.height)}`);
    } else {
      ko(`Altura no aumentó lo suficiente`, `${boxBefore?.height} → ${boxAfter?.height}`);
    }

    await page.screenshot({ path: `${OUT}/02-timeline-expanded.png`, fullPage: true });
    ok("Screenshot 02-timeline-expanded.png");
  }

  /* ═══════════════════════════════════════════════════════════════
     TEST C · MatchConfirmDialog · necesitamos match >= 65%
     Candidatos: reg-008 (61% → NO) · reg-009 (96%) · reg-010 (88%) ·
                 reg-011 (92% duplicado · ya no pendiente)
     Vamos con reg-010 (Émilie Rousseau · duplicado 88%, pendiente).
     ═══════════════════════════════════════════════════════════════ */
  console.log("\n── TEST C · MatchConfirmDialog ──");
  await backToList(page);
  // Hay DOS Émilie Rousseau en la lista (reg-001 match 0, reg-010 match 88).
  // Buscamos la que tiene 88%.
  const cards = page.locator("article");
  const cardN = await cards.count();
  let matchCardIdx = -1;
  for (let i = 0; i < cardN; i++) {
    const t = await cards.nth(i).innerText().catch(() => "");
    if (t.includes("Émilie Rousseau") && (t.includes("88%") || t.includes("Duplicado"))) {
      matchCardIdx = i;
      break;
    }
  }
  if (matchCardIdx < 0) {
    // fallback · reg-009 Lars 96%
    for (let i = 0; i < cardN; i++) {
      const t = await cards.nth(i).innerText().catch(() => "");
      if (t.includes("Lars Bergström") && t.includes("96%")) { matchCardIdx = i; break; }
    }
  }

  if (matchCardIdx < 0) {
    ko("Card con match >= 65% no encontrada");
  } else {
    await cards.nth(matchCardIdx).click();
    await page.waitForTimeout(400);
    ok(`Card con match alto clicada (índice ${matchCardIdx})`);

    // Clic en "Aprobar"
    const aprobarBtn = page.locator("button:not([disabled])", { hasText: /^Aprobar$/ }).last();
    if (!(await aprobarBtn.count())) {
      ko("Botón Aprobar no encontrado / deshabilitado");
    } else {
      await aprobarBtn.click();
      await page.waitForTimeout(500);

      const dialog = page.locator("[role='dialog']").first();
      const dlgText = await dialog.innerText().catch(() => "");

      if (/Coincidencia detectada/i.test(dlgText)) ok("MatchConfirmDialog abierto con 'Coincidencia detectada'");
      else ko("'Coincidencia detectada' no aparece en el diálogo", `texto: ${dlgText.slice(0, 160)}`);

      if (/\d{2,3}\s*%/.test(dlgText)) ok("Diálogo muestra porcentaje");
      else ko("Diálogo no muestra porcentaje");

      if (/Cliente existente/i.test(dlgText)) ok("Diálogo muestra 'Cliente existente'");
      else ko("'Cliente existente' no aparece");

      if (/Nombre|Email/i.test(dlgText)) ok("Diálogo muestra rows de nombre/email");
      else ko("No aparecen rows de nombre/email");

      await page.screenshot({ path: `${OUT}/03-match-dialog.png`, fullPage: true });
      ok("Screenshot 03-match-dialog.png");

      await cancelDialogIfOpen(page);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     TEST D · RelationConfirmDialog · reg-003 Joris van der Berg
     ═══════════════════════════════════════════════════════════════ */
  console.log("\n── TEST D · RelationConfirmDialog · reg-003 ──");
  await backToList(page);
  const foundD = await clickCardByName(page, "Joris van der Berg");
  if (!foundD) {
    ko("Card reg-003 no encontrada");
  } else {
    ok("Card reg-003 clicada");
    const aprobarBtn = page.locator("button:not([disabled])", { hasText: /^Aprobar$/ }).last();
    if (!(await aprobarBtn.count())) {
      ko("Botón Aprobar no disponible en reg-003");
    } else {
      await aprobarBtn.click();
      await page.waitForTimeout(500);
      const dialog = page.locator("[role='dialog']").first();
      const dlgText = await dialog.innerText().catch(() => "");

      if (/Posible\s+pareja\s+detectada/i.test(dlgText)) ok("RelationConfirmDialog: 'Posible pareja detectada'");
      else ko("No aparece 'Posible pareja detectada'", `texto: ${dlgText.slice(0, 160)}`);

      if (/Sophie van der Berg/.test(dlgText)) ok("Nombre Sophie van der Berg presente");
      else ko("Sophie van der Berg no aparece");

      // Reasons · hay 3 bullets
      const reasons = await dialog.locator("ul li").count();
      if (reasons >= 3) ok(`Se muestran ${reasons} motivos (>=3)`);
      else ko(`Solo ${reasons} motivos (se esperaban 3)`);

      await page.screenshot({ path: `${OUT}/04-relation-dialog.png`, fullPage: true });
      ok("Screenshot 04-relation-dialog.png");
      await cancelDialogIfOpen(page);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     TEST E · VisitConfirmDialog directo · reg-023 visit_only Anna-Liisa
     (reg-023 es el visit_only pendiente; reg-004 es la aprobada previa.)
     ═══════════════════════════════════════════════════════════════ */
  console.log("\n── TEST E · VisitConfirmDialog visit_only · reg-023 Anna-Liisa ──");
  await backToList(page);
  // Hay DOS Anna-Liisa en el seed: reg-004 (aprobado, match 0) y reg-023 (pendiente, visit_only).
  // Necesitamos la pendiente · la distinguimos por "Pendiente" en el tag de estado.
  const cardsE = page.locator("article");
  const cardsEN = await cardsE.count();
  let annaIdx = -1;
  for (let i = 0; i < cardsEN; i++) {
    const t = await cardsE.nth(i).innerText().catch(() => "");
    if (t.includes("Anna-Liisa Virtanen") && /Pendiente/i.test(t)) {
      annaIdx = i; break;
    }
  }
  const foundE = annaIdx >= 0;
  if (!foundE) {
    ko("Card reg-023 Anna-Liisa Virtanen (pendiente) no encontrada");
  } else {
    await cardsE.nth(annaIdx).click();
    await page.waitForTimeout(500);
    ok(`Card reg-023 Anna-Liisa Virtanen clicada (índice ${annaIdx})`);
    const h2Name = await page.locator("section h2").first().innerText().catch(() => "?");
    console.log(`   [debug] detail header: "${h2Name}"`);
    const aprobarBtn = page.locator("button:not([disabled])", { hasText: /^Aprobar$/ }).last();
    if (!(await aprobarBtn.count())) {
      ko("Botón Aprobar no disponible para reg-023");
    } else {
      await aprobarBtn.click();
      await page.waitForTimeout(500);
      const dialog = page.locator("[role='dialog']").first();
      const dlgText = await dialog.innerText().catch(() => "");

      if (/Confirmar visita\s*·\s*Anna-Liisa Virtanen/i.test(dlgText)) {
        ok("VisitConfirmDialog abierto directamente con 'Confirmar visita · Anna-Liisa Virtanen'");
      } else {
        ko("Título VisitConfirmDialog incorrecto", `texto: ${dlgText.slice(0, 200)}`);
      }

      if (/Cliente ya aprobado previamente/i.test(dlgText)) ok("Subtítulo 'Cliente ya aprobado previamente'");
      else ko("'Cliente ya aprobado previamente' no aparece");

      // Selector de agente (UserSelect · tiene placeholder "Selecciona agente…")
      const userSelect = dialog.locator("text=/Selecciona agente/i");
      if (await userSelect.count()) ok("Selector de agente presente");
      else ko("Selector de agente no encontrado");

      if (/Aceptar horario propuesto/i.test(dlgText)) ok("Radio 'Aceptar horario propuesto' presente");
      else ko("Radio 'Aceptar horario propuesto' no aparece");

      if (/Proponer otro horario/i.test(dlgText)) ok("Radio 'Proponer otro horario' presente");
      else ko("Radio 'Proponer otro horario' no aparece");

      // Verificamos que NO pasó por MatchConfirmDialog ni RelationConfirmDialog
      if (!/Coincidencia detectada/i.test(dlgText) && !/Posible\s+\w+\s+detectada/i.test(dlgText)) {
        ok("No se abrió Match ni Relation (visit_only salta ambos)");
      } else {
        ko("Se abrió Match o Relation — no debería en visit_only");
      }

      await page.screenshot({ path: `${OUT}/05-visit-dialog.png`, fullPage: true });
      ok("Screenshot 05-visit-dialog.png");
      await cancelDialogIfOpen(page);
    }
  }

  /* ═══════════════════════════════════════════════════════════════
     TEST F · VisitConfirmDialog directo · reg-002 Lars Bergström
     (registration_visit · match=0 · sin relation)
     ═══════════════════════════════════════════════════════════════ */
  console.log("\n── TEST F · VisitConfirmDialog registration_visit · reg-002 Lars ──");
  await backToList(page);
  // Hay 2 Lars Bergström: reg-002 (match 0) y reg-009 (96%). Buscamos el que tiene ·visita.
  const cardsF = page.locator("article");
  const cardNF = await cardsF.count();
  let larsIdx = -1;
  for (let i = 0; i < cardNF; i++) {
    const t = await cardsF.nth(i).innerText().catch(() => "");
    if (t.includes("Lars Bergström") && /visita/i.test(t) && !t.includes("96%")) {
      larsIdx = i; break;
    }
  }
  if (larsIdx < 0) {
    ko("Card reg-002 Lars Bergström (·visita) no encontrada");
  } else {
    await cardsF.nth(larsIdx).click();
    await page.waitForTimeout(400);
    ok(`Card reg-002 clicada (índice ${larsIdx})`);

    const aprobarBtn = page.locator("button:not([disabled])", { hasText: /^Aprobar$/ }).last();
    if (!(await aprobarBtn.count())) {
      ko("Botón Aprobar no disponible en reg-002");
    } else {
      await aprobarBtn.click();
      await page.waitForTimeout(500);
      const dialog = page.locator("[role='dialog']").first();
      const dlgText = await dialog.innerText().catch(() => "");

      if (/Confirmar visita\s*·\s*Lars Bergström/i.test(dlgText)) {
        ok("VisitConfirmDialog directo para reg-002 Lars");
      } else {
        ko("Título VisitConfirmDialog incorrecto en reg-002", `texto: ${dlgText.slice(0, 200)}`);
      }

      if (!/Coincidencia detectada/i.test(dlgText) && !/Posible\s+\w+\s+detectada/i.test(dlgText)) {
        ok("No se abrió Match ni Relation (match=0 + sin possibleRelation)");
      } else {
        ko("Se abrió Match o Relation en reg-002");
      }

      await page.screenshot({ path: `${OUT}/06-visit-dialog-reg.png`, fullPage: true });
      ok("Screenshot 06-visit-dialog-reg.png");
      await cancelDialogIfOpen(page);
    }
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

  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(2); });
