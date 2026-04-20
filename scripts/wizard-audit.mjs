/**
 * wizard-audit · tester end-to-end del wizard de Crear Promoción.
 *
 * Qué hace:
 *   1. Abre `/crear-promocion` con localStorage vacío.
 *   2. En cada paso intenta avanzar rellenando con defaults razonables:
 *      · Clic en la primera "card/opción" visible del step (patrón
 *        dominante: divs o buttons con role=button, aria-pressed, o
 *        con clase "border-2" y padding grande).
 *      · Rellena cada `<input>` de texto visible con un string de test.
 *      · Rellena cada `<textarea>` con un párrafo de prueba.
 *      · Si hay sliders/number inputs, pone 1.
 *      · Tras rellenar, reintenta clic en "Siguiente".
 *   3. Si sigue deshabilitado, marca el paso BLOCKED y para.
 *   4. Screenshot de cada paso + report.json con heading, fields,
 *      acciones aplicadas y resultado.
 *
 * Uso:
 *   npm run dev                    # en otra terminal
 *   node scripts/wizard-audit.mjs  # ~60-90s
 */

import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASE_URL = process.env.BASE_URL || "http://localhost:8080";
const OUT_DIR = "screenshots/wizard";
const MAX_STEPS = 20;

async function captureState(page) {
  return await page.evaluate(() => {
    const h1 = document.querySelector("main h1, main h2");
    const heading = h1 ? h1.textContent.trim() : "(sin título)";

    const labels = [];
    document.querySelectorAll("main label").forEach((el) => {
      const t = el.textContent.trim().slice(0, 80);
      if (t) labels.push(t);
    });

    const inputs = [];
    document.querySelectorAll("main input, main textarea").forEach((el) => {
      inputs.push({
        tag: el.tagName.toLowerCase(),
        type: el.type || "",
        name: el.name || "",
        placeholder: el.placeholder || "",
        value: el.value || "",
      });
    });

    const clickables = document.querySelectorAll(
      'main [role="button"], main button[type="button"]:not([aria-label="Cerrar"]), main [data-card], main div[tabindex="0"]'
    ).length;

    const btns = Array.from(document.querySelectorAll("footer button"));
    const nextBtn = btns.find((b) => /Siguiente|Publicar/i.test(b.textContent));
    const next = nextBtn
      ? {
          label: nextBtn.textContent.trim(),
          disabled: nextBtn.disabled || nextBtn.getAttribute("aria-disabled") === "true",
        }
      : null;

    return { heading, labels: [...new Set(labels)].slice(0, 12), inputs, clickables, next };
  });
}

async function fillStep(page, heading) {
  const actions = [];

  // 1) Text inputs y textareas con defaults sensatos.
  const filled = await page.evaluate(() => {
    let count = 0;
    const set = (el, value) => {
      const setter = Object.getOwnPropertyDescriptor(el.__proto__, "value")?.set;
      setter?.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      count++;
    };
    document.querySelectorAll('main input[type="text"]:not([readonly]), main input:not([type]):not([readonly])').forEach((el) => {
      if (!el.value) set(el, "Residencial Test");
    });
    document.querySelectorAll('main input[type="email"]').forEach((el) => { if (!el.value) set(el, "test@example.com"); });
    document.querySelectorAll('main input[type="tel"]').forEach((el) => { if (!el.value) set(el, "+34600000000"); });
    document.querySelectorAll('main input[type="number"]').forEach((el) => { if (!el.value) set(el, "1"); });
    document.querySelectorAll("main textarea:not([readonly])").forEach((el) => {
      if (!el.value) set(el, "Descripción de prueba generada por wizard-audit.");
    });
    return count;
  });
  if (filled) actions.push(`filled:${filled}`);

  // 2) Si el botón Siguiente ya se habilitó, paramos de tocar.
  let state = await captureState(page);
  if (state.next && !state.next.disabled) return { actions, state };

  // 3) Clic en la primera opción "card" visible. Heurísticas:
  //    · Elementos con clases de tarjeta seleccionable (border-2,
  //      cursor-pointer, rounded-xl o rounded-2xl), que NO sean el
  //      botón Siguiente.
  //    · `role="button"` divs.
  const clicked = await page.evaluate(() => {
    const cands = Array.from(document.querySelectorAll("main button, main [role=\"button\"], main div[tabindex=\"0\"]"));
    const clickable = cands.filter((el) => {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") return false;
      const rect = el.getBoundingClientRect();
      if (rect.width < 60 || rect.height < 40) return false; // toggles pequeños no
      // Excluir el header X y botones del footer
      if (el.closest("footer")) return false;
      if (el.getAttribute("aria-label") === "Cerrar") return false;
      if (/Siguiente|Atrás|Publicar|Cancelar|Omitir/i.test(el.textContent)) return false;
      return true;
    });
    if (clickable.length === 0) return 0;
    clickable[0].click();
    return 1;
  });
  if (clicked) actions.push("clicked-first-card");

  await page.waitForTimeout(300);
  state = await captureState(page);

  // 4) Reintentar fill por si aparecieron inputs tras la selección.
  if (state.next && state.next.disabled) {
    const refilled = await page.evaluate(() => {
      let count = 0;
      const set = (el, value) => {
        const setter = Object.getOwnPropertyDescriptor(el.__proto__, "value")?.set;
        setter?.call(el, value);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        count++;
      };
      document.querySelectorAll("main input:not([readonly]), main textarea:not([readonly])").forEach((el) => {
        if (!el.value && el.type !== "checkbox" && el.type !== "radio") {
          set(el, el.type === "number" ? "1" : "Valor test");
        }
      });
      return count;
    });
    if (refilled) actions.push(`refilled:${refilled}`);
    await page.waitForTimeout(200);
    state = await captureState(page);
  }

  return { actions, state };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  const consoleErrors = [];
  const netErrors = [];
  page.on("pageerror", (e) => consoleErrors.push({ type: "pageerror", msg: String(e) }));
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push({ type: "console", msg: m.text() });
  });
  page.on("requestfailed", (req) => {
    netErrors.push({ url: req.url(), failure: req.failure()?.errorText });
  });

  await page.addInitScript(() => localStorage.clear());
  const t0 = Date.now();
  await page.goto(BASE_URL + "/crear-promocion", { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(500);

  const steps = [];
  const visited = new Set();
  let n = 0;

  while (n < MAX_STEPS) {
    n++;
    const initial = await captureState(page);
    const shot = join(OUT_DIR, `${String(n).padStart(2, "0")}-${(initial.heading || "step").replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40)}.png`);
    await page.screenshot({ path: shot, fullPage: false });

    const key = initial.heading;
    const loop = visited.has(key);
    visited.add(key);
    if (loop) {
      console.log(`↻ ${n} loop en "${key}" — paro`);
      steps.push({ n, heading: key, loop: true, screenshot: shot });
      break;
    }

    const fillRes = await fillStep(page, key);
    const record = {
      n,
      heading: key,
      screenshot: shot,
      actions: fillRes.actions,
      fieldsSeen: initial.labels,
      inputs: initial.inputs,
      clickables: initial.clickables,
      nextAfterFill: fillRes.state.next,
      advanced: false,
    };

    if (!fillRes.state.next) {
      console.log(`✗ ${n} "${key}" — no next button`);
      record.error = "no_next_button";
      steps.push(record);
      break;
    }

    if (fillRes.state.next.disabled) {
      console.log(`⚠ ${n} "${key}" BLOQUEADO tras [${fillRes.actions.join(", ")}]  labels: ${initial.labels.slice(0, 3).join(" / ")}`);
      record.blocked = true;
      steps.push(record);
      break;
    }

    record.advanced = true;
    steps.push(record);
    const isFinal = /Publicar/i.test(fillRes.state.next.label);
    console.log(`→ ${n} "${key}" [${fillRes.actions.join(", ")}] → ${fillRes.state.next.label}`);

    await page.click(`footer button:has-text("${isFinal ? "Publicar" : "Siguiente"}")`).catch(() => null);

    if (isFinal) {
      await page.waitForURL(/\/promociones/, { timeout: 10000 }).catch(() => null);
      console.log(`✓ ${n} wizard completado`);
      break;
    }
    await page.waitForTimeout(400);
  }

  const completed = steps.some((s) => s.advanced && /Publicar/i.test(s.nextAfterFill?.label || ""));
  const blocked = steps.find((s) => s.blocked);
  const summary = {
    baseUrl: BASE_URL,
    generatedAt: new Date().toISOString(),
    totalSteps: steps.length,
    completed,
    blockedAt: blocked ? blocked.heading : null,
    blockedInputs: blocked ? blocked.inputs : null,
    blockedLabels: blocked ? blocked.fieldsSeen : null,
    consoleErrors,
    netErrors,
    steps,
    elapsedMs: Date.now() - t0,
  };

  await writeFile(join(OUT_DIR, "report.json"), JSON.stringify(summary, null, 2));

  console.log(`\n→ ${steps.length} pasos · ${summary.elapsedMs}ms`);
  console.log(`→ ${completed ? "wizard completado ✓" : `bloqueado en: "${summary.blockedAt}"`}`);
  console.log(`→ ${consoleErrors.length} JS errs · ${netErrors.length} net errs`);

  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
