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

// 1. Cuenta nueva via /invite/:token con auto=1
console.log("→ STEP 1 · Auto-signup");
await page.goto("http://localhost:8080/invite/demo-caso1-nuevo?auto=1", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

// 2. Click "Quiero invitar al Responsable" + Continuar
console.log("→ STEP 2 · Choose 'Invitar Responsable'");
await page.locator('text=Quiero invitar al Responsable').click();
await page.waitForTimeout(200);
await page.locator('button:has-text("Continuar")').click();
await page.waitForTimeout(400);

// 3. Rellenar form
console.log("→ STEP 3 · Llenar form");
await page.locator('input[placeholder="Nombre y apellido"]').fill("Carlos Dueño Real");
await page.locator('input[placeholder="responsable@agencia.com"]').fill("dueno@nuevaagencia.com");
await page.locator('input[placeholder*="600"]').fill("+34 600 111 222");
await page.waitForTimeout(200);

// 4. Click "Enviar invitación" (capturamos popups · son los blob:// del HTML preview)
const popupPromise = page.waitForEvent("popup");
await page.locator('button:has-text("Enviar invitación")').click();
const popup = await popupPromise.catch(() => null);
console.log("→ Popup HTML email:", popup ? "abierto" : "no abierto");
await page.waitForTimeout(500);

// 5. Recuperar el token de la responsible-invitation desde localStorage
const respInv = await page.evaluate(() => {
  const raw = localStorage.getItem("byvaro.responsible-invitations.v1");
  return raw ? JSON.parse(raw) : [];
});
console.log("→ Responsible-invitations en storage:", respInv.length);
const token = respInv[0]?.token;
console.log("→ Token generado:", token);

// 6. Abrir la landing /responsible/:token en una nueva pestaña (sin sesión es lo importante,
//    pero como ya estamos logueados aquí, simulamos pestaña nueva limpiando sessionStorage primero).
const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page2 = await ctx2.newPage();
const respUrl = `http://localhost:8080/responsible/${token}`;
console.log("→ STEP 6 · Abrir landing", respUrl);
// Necesitamos copiar el localStorage de la primera pestaña (simulación: la invitación
// vive en el mismo dominio · en producción sería server-side).
const storage = await page.evaluate(() => JSON.stringify(localStorage));
await page2.goto("http://localhost:8080/", { waitUntil: "domcontentloaded" });
await page2.evaluate((s) => {
  const data = JSON.parse(s);
  for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
}, storage);
await page2.goto(respUrl, { waitUntil: "networkidle" });
await page2.waitForTimeout(1000);

const heading = await page2.locator("h1").first().textContent().catch(() => null);
console.log("→ Landing title:", heading);

// 7. Activar la cuenta
console.log("→ STEP 7 · Crear contraseña + activar");
await page2.locator('input[type="password"]').fill("Test1234!");
await page2.waitForTimeout(200);
await page2.locator('button:has-text("Activar mi cuenta")').click();
await page2.waitForTimeout(1500);

const finalUrl = page2.url();
console.log("→ URL final:", finalUrl);

const sessionInfo = await page2.evaluate(() => ({
  accountType: sessionStorage.getItem("byvaro.accountType.v1"),
  agencyId: sessionStorage.getItem("byvaro.accountType.agencyId.v1"),
  agencyEmail: sessionStorage.getItem("byvaro.accountType.agencyEmail.v1"),
}));
console.log("→ Sesión final:", JSON.stringify(sessionInfo));

const finalUsers = await page2.evaluate(() => {
  const u = JSON.parse(localStorage.getItem("byvaro.users.created.v1") || "[]");
  return u.map((x) => ({ email: x.email, role: x.role }));
});
console.log("→ Users final (admin/member):", JSON.stringify(finalUsers));

const respInvFinal = await page2.evaluate(() => {
  const u = JSON.parse(localStorage.getItem("byvaro.responsible-invitations.v1") || "[]");
  return u.map((x) => ({ token: x.token.slice(0, 8), estado: x.estado }));
});
console.log("→ Responsible-invitations estado:", JSON.stringify(respInvFinal));

await page2.screenshot({ path: "/tmp/responsible-final.png", fullPage: false });
if (popup) await popup.screenshot({ path: "/tmp/responsible-email.png", fullPage: false });

if (errors.length) {
  console.log("\n❌ ERRORES:");
  for (const e of errors) console.log("  ", e);
} else {
  console.log("\n✅ Sin errores");
}

await browser.close();
