import { chromium } from "playwright";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on("pageerror", (err) => errors.push(`[pageerror] ${err.message}`));
page.on("console", (msg) => {
  if (msg.type() === "error") {
    const t = msg.text();
    if (!t.includes("posthog") && !t.includes("Failed to load resource")) errors.push(`[console.error] ${t}`);
  }
});

console.log("→ STEP 1 · Auto signup");
await page.goto("http://localhost:8080/invite/demo-caso1-nuevo?auto=1", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const dialogVisible = await page.locator('[role="dialog"]').first().isVisible();
console.log("→ Modal visible:", dialogVisible);

console.log("→ STEP 2 · Click X (close button)");
// El sr-only text "Close" identifica el botón X en el dialog
await page.locator('[role="dialog"]').locator('button:has(span:text("Close"))').click({ timeout: 5000 }).catch(async (e) => {
  console.log("  No se encontró X · intentando ESC");
  await page.keyboard.press("Escape");
});
await page.waitForTimeout(500);

const dialogAfterClose = await page.locator('[role="dialog"]').first().isVisible().catch(() => false);
console.log("→ Modal after X click:", dialogAfterClose);

const onboardingState = await page.evaluate(() => {
  return JSON.parse(localStorage.getItem("byvaro.agencies.onboarding.v1") || "[]");
});
console.log("→ Onboarding state:", JSON.stringify(onboardingState));

console.log("→ STEP 3 · Banner ámbar visible?");
const bannerVisible = await page.locator('text=Falta configurar el Responsable').isVisible().catch(() => false);
console.log("→ Banner visible:", bannerVisible);

console.log("→ STEP 4 · Navegar a /ajustes/empresa/datos · debe re-abrir modal");
await page.goto("http://localhost:8080/ajustes/empresa/datos", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);

const modalReopened = await page.locator('[role="dialog"]').first().isVisible().catch(() => false);
console.log("→ Modal re-opened on critical route:", modalReopened);

console.log("→ STEP 5 · Click 'Soy el Responsable' + Continuar · debe ir a self-confirm");
if (modalReopened) {
  await page.locator('text=Soy el Responsable').click();
  await page.waitForTimeout(200);
  await page.locator('button:has-text("Continuar")').click();
  await page.waitForTimeout(400);
  const tcVisible = await page.locator('text=Confirma que eres el Responsable').isVisible().catch(() => false);
  console.log("→ Step T&C visible:", tcVisible);
  const checkboxVisible = await page.locator('input[type="checkbox"]').isVisible().catch(() => false);
  console.log("→ Checkbox visible:", checkboxVisible);
}

await page.screenshot({ path: "/tmp/modal-tc.png", fullPage: false });

if (errors.length) {
  console.log("\n❌ ERRORES:");
  for (const e of errors) console.log("  ", e);
} else {
  console.log("\n✅ Sin errores");
}

await browser.close();
