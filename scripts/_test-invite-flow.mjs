import { chromium } from "playwright";

const URL = "http://localhost:8080/invite/demo-caso1-nuevo?auto=1";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`[console.error] ${msg.text()}`);
});
page.on("pageerror", (err) => errors.push(`[pageerror] ${err.message}`));
page.on("requestfailed", (req) => {
  if (!req.url().includes("posthog")) {
    errors.push(`[requestfailed] ${req.method()} ${req.url()} · ${req.failure()?.errorText}`);
  }
});

console.log("→ Navegando a", URL);
await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);

const finalUrl = page.url();
console.log("→ URL final:", finalUrl);

const sessionStorage = await page.evaluate(() => ({
  accountType: window.sessionStorage.getItem("byvaro.accountType.v1"),
  agencyId: window.sessionStorage.getItem("byvaro.accountType.agencyId.v1"),
  agencyEmail: window.sessionStorage.getItem("byvaro.accountType.agencyEmail.v1"),
}));
console.log("→ sessionStorage:", JSON.stringify(sessionStorage));

const localState = await page.evaluate(() => ({
  agenciesCreated: JSON.parse(window.localStorage.getItem("byvaro.agencies.created.v1") || "[]").map((a) => ({ id: a.id, name: a.name })),
  usersCreated: JSON.parse(window.localStorage.getItem("byvaro.users.created.v1") || "[]").map((u) => ({ email: u.email, agencyId: u.agencyId })),
  onboarding: JSON.parse(window.localStorage.getItem("byvaro.agencies.onboarding.v1") || "[]"),
}));
console.log("→ localStorage agencias:", JSON.stringify(localState.agenciesCreated));
console.log("→ localStorage usuarios:", JSON.stringify(localState.usersCreated));
console.log("→ localStorage onboarding:", JSON.stringify(localState.onboarding));

const dialogVisible = await page.locator('[role="dialog"]').isVisible().catch(() => false);
const dialogText = dialogVisible ? await page.locator('[role="dialog"]').textContent() : null;
console.log("→ Dialog visible:", dialogVisible);
if (dialogText) console.log("→ Dialog text (200):", dialogText.slice(0, 200));

await page.screenshot({ path: "/tmp/invite-flow.png", fullPage: false });
console.log("→ Screenshot guardado en /tmp/invite-flow.png");

if (errors.length) {
  console.log("\n❌ ERRORES:");
  for (const e of errors) console.log("  ", e);
} else {
  console.log("\n✅ Sin errores en consola");
}

await browser.close();
