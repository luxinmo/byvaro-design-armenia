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

// PNG 1x1 transparente válido — para subir al input file en Multimedia.
const FAKE_PNG_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

// Fillers específicos por heading — algunos pasos requieren interacciones
// que no se detectan con heurísticas genéricas.
async function runStepSpecificFiller(page, heading, actions) {
  // Multimedia — el botón "Subir imágenes" abre un modal mock que inserta
  // 3 fotos de Unsplash al confirmar. Replicamos ese flujo.
  if (/multimedia/i.test(heading)) {
    const clicked = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("main button")).find(
        (b) => /Subir imágenes|Subir foto|Añadir imagen/i.test(b.textContent)
      );
      if (btn) { btn.click(); return true; }
      return false;
    });
    if (clicked) {
      await page.waitForTimeout(400);
      // Confirmar en el modal (botón con texto tipo "Añadir", "Subir", "Confirmar")
      const confirmed = await page.evaluate(() => {
        const modalBtns = Array.from(document.querySelectorAll('div[class*="fixed"] button, [role="dialog"] button'));
        const target = modalBtns.find((b) =>
          /^Añadir|^Subir|^Confirmar|^Aceptar|mock|generar/i.test(b.textContent.trim())
        );
        if (target) { target.click(); return true; }
        return false;
      });
      if (confirmed) {
        actions.push("uploaded-photos");
        await page.waitForTimeout(400);
      } else {
        // Cerramos el modal si no encontramos el botón de confirmar
        await page.keyboard.press("Escape");
      }
    }
  }
}

async function fillStep(page, heading) {
  const actions = [];

  // 0) Filler específico por heading (uploads, interacciones custom).
  await runStepSpecificFiller(page, heading, actions);

  // 1) Text inputs y textareas con defaults sensatos.
  //    Inputs que son autocomplete de ubicación (placeholder menciona
  //    ciudad/dirección/ubicación) se detectan y se trata aparte: se
  //    teclea una ciudad real presente en las sugerencias y se emite
  //    click sobre la primera opción del dropdown.
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
      if (el.value) return;
      const ph = (el.placeholder || "").toLowerCase();
      if (/ciudad|direcci|ubicaci|zona|localidad/.test(ph)) {
        set(el, "Marbella");
        el.focus();
      } else {
        set(el, "Residencial Test");
      }
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

  // Dejar que aparezca el dropdown del autocomplete y clicar la 1ª opción.
  await page.waitForTimeout(300);
  const sugClicked = await page.evaluate(() => {
    // Radix/custom dropdowns tipo lista en document.body
    const candidates = Array.from(document.querySelectorAll('[role="option"], [role="listbox"] li, [role="listbox"] button, ul[class*="absolute"] li, ul[class*="absolute"] button'));
    const visible = candidates.find((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 30 && r.height > 20;
    });
    if (visible) {
      visible.click();
      return 1;
    }
    return 0;
  });
  if (sugClicked) actions.push("picked-suggestion");

  let state = await captureState(page);

  // 2) Clic iterativo en cards — SIEMPRE, no sólo cuando Siguiente está
  //    deshabilitado. Muchos pasos (Detalles finales, Plan de pagos…)
  //    permiten avanzar sin selección pero luego la Revisión exige que
  //    ciertos campos estén rellenos. Clicar una card por cada grupo
  //    garantiza que el WizardState acumule lo necesario para publicar.
  const clickedSet = new Set();
  let clicks = 0;
  for (let attempt = 0; attempt < 6; attempt++) {
    const picked = await page.evaluate((alreadyClicked) => {
      const cands = Array.from(document.querySelectorAll("main button, main [role=\"button\"], main div[tabindex=\"0\"]"));
      const clickable = cands.filter((el) => {
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") return false;
        const rect = el.getBoundingClientRect();
        if (rect.width < 60 || rect.height < 40) return false;
        if (el.closest("footer")) return false;
        if (el.getAttribute("aria-label") === "Cerrar") return false;
        if (/Siguiente|Atrás|Publicar|Cancelar|Omitir|Añadir|Subir|Quitar/i.test(el.textContent)) return false;
        // No reclickear cards ya seleccionadas (detectar estado "pressed"/selected)
        if (el.getAttribute("aria-pressed") === "true") return false;
        if (el.getAttribute("data-selected") === "true") return false;
        // No reclickear los que ya probamos en este paso
        const sig = (el.textContent || "").trim().slice(0, 60);
        if (alreadyClicked.includes(sig)) return false;
        return true;
      });
      if (!clickable.length) return null;
      const target = clickable[0];
      const sig = (target.textContent || "").trim().slice(0, 60);
      target.click();
      return sig;
    }, [...clickedSet]);

    if (!picked) break;
    clickedSet.add(picked);
    clicks++;
    await page.waitForTimeout(200);
    state = await captureState(page);
    // Clicamos al menos 3 veces aunque Siguiente ya esté habilitado:
    // pasos como "Plan de pagos" o "Detalles finales" tienen múltiples
    // grupos y solo uno afecta a `canContinue`, pero los demás son
    // necesarios para `canPublishWizard`.
    if (clicks >= 3 && state.next && !state.next.disabled) break;
  }
  if (clicks) actions.push(`cards:${clicks}`);

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

  let missingOnPublish = null;
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

    // Si es el paso de Revisión, extraemos los requisitos que faltan
    // para publicar directamente del banner (sin clicar nada que haga
    // navegar atrás).
    if (/Revisi[oó]n/i.test(key)) {
      missingOnPublish = await page.evaluate(() => {
        const out = [];
        // El banner "Faltan N requisitos" tiene items clickables que
        // llevan al paso correspondiente. Los extraemos como texto.
        document.querySelectorAll("main button, main a").forEach((el) => {
          const t = (el.textContent || "").trim();
          if (/^(Añade|Define|Configura|Selecciona|Completa|Sube)/i.test(t) && t.length < 120) {
            out.push(t);
          }
        });
        return [...new Set(out)];
      });
      const nextBtn = initial.next;
      const record = {
        n, heading: key, screenshot: shot,
        isFinalReview: true,
        missingOnPublish,
        publishEnabled: nextBtn && !nextBtn.disabled,
        nextAfterFill: nextBtn,
      };
      if (nextBtn && !nextBtn.disabled) {
        console.log(`✓ ${n} "${key}" listo para publicar`);
        record.advanced = true;
        steps.push(record);
        await page.click('footer button:has-text("Publicar")').catch(() => null);
        await page.waitForURL(/\/promociones/, { timeout: 10000 }).catch(() => null);
        break;
      }
      console.log(`⏸ ${n} "${key}" bloqueado por ${missingOnPublish.length} requisitos:`);
      missingOnPublish.forEach((m) => console.log(`     · ${m}`));
      record.blocked = true;
      steps.push(record);
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
    missingOnPublish,
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
