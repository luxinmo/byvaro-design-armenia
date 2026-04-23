/**
 * Verifica 2 fixes:
 *   · Rail "Acciones rápidas" AL LADO del contenido en vista agencia.
 *   · Email dialog en vista agencia muestra SOLO "A un cliente".
 */
import { chromium } from "playwright";

const BASE = "http://localhost:8080";
const OUT = "/tmp/byvaro-agency-fixes";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => console.log("[pageerror]", e.message));

  // Login como agencia
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await p.locator("button", { hasText: "Laura Sánchez" }).first().click();
  await p.waitForURL(/\/inicio/, { timeout: 5000 });
  await p.waitForTimeout(300);

  // Abrir primera promoción
  await p.goto(`${BASE}/promociones`, { waitUntil: "networkidle" });
  await p.waitForTimeout(400);
  await p.locator("main article.cursor-pointer").first().click();
  await p.waitForLoadState("networkidle");
  await p.waitForTimeout(1000);

  // 1 · Layout rail al lado
  await p.screenshot({ path: `${OUT}/1-ficha-agencia.png`, fullPage: true });
  const rail = p.locator("text=Acciones rápidas").first();
  const mainTitle = p.locator("main h1").first();
  const railExists = await rail.count();
  if (!railExists) {
    console.log("🟡 'Acciones rápidas' no encontrado — la ficha puede que oculte el label en vista agencia. Inspecciono screenshot.");
  } else {
    const railBox = await rail.boundingBox();
    const titleBox = await mainTitle.boundingBox();
    console.log("Rail position:", railBox);
    console.log("Main title position:", titleBox);
    if (railBox && titleBox) {
      const sideBySide = railBox.x > 900; // viewport 1440, rail en la derecha si x > 900
      console.log(sideBySide
        ? `✅ Rail al LADO (x=${railBox.x})`
        : `❌ Rail DEBAJO (x=${railBox.x})`);
    }
  }

  // 2 · Email dialog — en agencia salta directo a template, sin mode picker ni colab
  const enviarBtn = p.locator("button", { hasText: /Enviar|Email/ }).first();
  if (await enviarBtn.count()) {
    await enviarBtn.click();
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${OUT}/2-email-dialog-agencia.png` });
    const dialogText = await p.locator("[role='dialog']").innerText();
    const hasColab = dialogText.includes("A un colaborador");
    const hasNuevoLanz = dialogText.includes("Nuevo lanzamiento");
    const hasNuevaDisp = dialogText.includes("Nueva disponibilidad");
    const hasDisp = dialogText.includes("Disponibilidad");
    console.log(`Dialog snippet: ${dialogText.slice(0, 300).replace(/\n/g, " · ")}`);
    console.log(hasColab ? "❌ Sigue apareciendo 'A un colaborador'" : "✅ Sin 'A un colaborador'");
    console.log(hasNuevoLanz ? "❌ Sigue apareciendo 'Nuevo lanzamiento'" : "✅ Sin 'Nuevo lanzamiento'");
    console.log(hasNuevaDisp ? "❌ Sigue apareciendo 'Nueva disponibilidad'" : "✅ Sin 'Nueva disponibilidad'");
    console.log(hasDisp ? "✅ Plantilla 'Disponibilidad' visible" : "🟡 'Disponibilidad' no visible");

    // Click en la plantilla Disponibilidad para verificar subject/body agencia
    const dispBtn = p.locator("[role='dialog'] button", { hasText: "Comparte con tu cliente las unidades" }).first();
    if (await dispBtn.count()) {
      await dispBtn.click();
      await p.waitForTimeout(600);
      await p.screenshot({ path: `${OUT}/3-dispo-compose.png`, fullPage: true });
      const subjectVal = await p.locator("[role='dialog'] input").first().inputValue().catch(() => "");
      console.log(`Subject: "${subjectVal}"`);

      // Verificar que el tagline del iframe contiene "Agencia inmobiliaria"
      const iframe = p.frameLocator("iframe");
      const taglineEl = iframe.locator("[data-block='brandTagline']").first();
      const taglineText = await taglineEl.innerText().catch(() => null);
      console.log(taglineText === "Agencia inmobiliaria"
        ? "✅ Header tagline: 'Agencia inmobiliaria'"
        : `❌ Header tagline: "${taglineText}"`);
      const brandNameEl = iframe.locator("img.brand-logo-img").first();
      const brandAlt = await brandNameEl.getAttribute("alt").catch(() => null);
      console.log(brandAlt?.includes("Prime")
        ? `✅ Logo alt: "${brandAlt}"`
        : `❌ Logo alt: "${brandAlt}"`);

      // Abrir popover Para y verificar que no muestra tab Colaboradores
      await p.locator("[role='dialog'] button", { hasText: /Añadir destinatarios/ }).first().click().catch(() => {});
      await p.waitForTimeout(400);
      await p.screenshot({ path: `${OUT}/4-popover-destinatarios.png` });
      const popoverText = await p.locator("[role='dialog']").first().innerText();
      const hasCollaboratorsTab = popoverText.includes("Colaboradores favoritos") || popoverText.match(/\bColaboradores\b/);
      console.log(!hasCollaboratorsTab
        ? "✅ Popover destinatarios: sin tab 'Colaboradores'"
        : "❌ Popover aún muestra 'Colaboradores'");
    }
  } else {
    console.log("🟡 No se encontró botón Enviar en la ficha");
  }

  await browser.close();
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
