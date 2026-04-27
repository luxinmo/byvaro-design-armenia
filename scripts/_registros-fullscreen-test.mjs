import { chromium } from "playwright";

const BASE = "http://localhost:8080";
const OUT = "/Users/armanyeghiazaryan/byvaro-design-armenia/screenshots/_registros_fullscreen_test";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
const page = await ctx.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(`[console] ${m.text()}`); });

// LOGIN
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[type="email"]', "arman@byvaro.com");
await page.fill('input[type="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL(/\/inicio|\/promociones|\/$/, { timeout: 10000 }).catch(() => {});
await page.waitForTimeout(800);

// GO TO REGISTROS
await page.goto(`${BASE}/registros`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

// Step 1: list visible
await page.screenshot({ path: `${OUT}/01-list-mobile.png`, fullPage: false });

// Inspect what is visible: header text, toolbar, bottom nav
const beforeClickInfo = await page.evaluate(() => {
  const findText = (txt) => {
    const all = document.querySelectorAll("*");
    for (const el of all) {
      const cs = window.getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const t = el.textContent || "";
      if (t.includes(txt) && t.length < 200) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) return { found: true, rect: { x: r.x, y: r.y, w: r.width, h: r.height } };
      }
    }
    return { found: false };
  };
  const bottomNav = document.querySelector('nav.fixed.bottom-0, [class*="MobileBottom"], nav[class*="bottom-0"]');
  const bottomNavRect = bottomNav ? (() => { const r = bottomNav.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, visible: window.getComputedStyle(bottomNav).display !== "none" }; })() : null;
  return {
    pendientes: findText("Pendientes"),
    breadcrumb: findText("Comercial"),
    bottomNav: bottomNavRect,
  };
});

// Find first registro card. Look for the master list cards in registros page.
const cardCount = await page.evaluate(() => {
  // Cards are typically buttons or articles within the master list
  const candidates = document.querySelectorAll('article, button[class*="rounded"], [role="button"]');
  return candidates.length;
});

// Click first registro item — try different selectors
const clicked = await page.evaluate(() => {
  // The registros master list cards contain a name + status. Find by structure.
  const main = document.querySelector('main') || document.body;
  const cards = main.querySelectorAll('button, [role="button"], article');
  // Filter for cards that look like registro list items (have avatar circle + name)
  for (const c of cards) {
    const r = c.getBoundingClientRect();
    if (r.width >= 250 && r.height >= 60 && r.height <= 200 && r.x < 100) {
      // Make sure it's not a header element
      const t = c.textContent || "";
      if (t.length > 10 && !t.includes("Pendientes 14") && !t.includes("Comercial")) {
        c.click();
        return { ok: true, text: t.slice(0, 80), rect: { x: r.x, y: r.y, w: r.width, h: r.height } };
      }
    }
  }
  return { ok: false };
});

await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/02-detail-fullscreen-top.png`, fullPage: false });

// Inspect detail state — is the detail covering the whole viewport?
const detailInfo = await page.evaluate(() => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // Find the detail container — typically the largest fixed/absolute panel covering viewport
  const all = document.querySelectorAll('*');
  let largestFixed = null;
  let largestArea = 0;
  for (const el of all) {
    const cs = window.getComputedStyle(el);
    if (cs.position !== "fixed" && cs.position !== "absolute") continue;
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    const a = r.width * r.height;
    if (a > largestArea && r.width >= vw * 0.8 && r.height >= vh * 0.5) {
      largestArea = a;
      largestFixed = { tag: el.tagName, className: typeof el.className === "string" ? el.className.slice(0, 200) : "", x: r.x, y: r.y, w: r.width, h: r.height, z: cs.zIndex };
    }
  }
  // Check breadcrumb visibility (Comercial · Registros · Pendientes 14)
  const findVisible = (txt) => {
    const els = Array.from(document.querySelectorAll('*')).filter(e => (e.textContent || "").includes(txt) && (e.textContent || "").length < 150);
    for (const el of els) {
      const r = el.getBoundingClientRect();
      const cs = window.getComputedStyle(el);
      if (r.width > 0 && r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden" && r.y >= 0 && r.y < window.innerHeight) {
        return { visible: true, y: r.y };
      }
    }
    return { visible: false };
  };
  // Bottom nav check
  const navs = document.querySelectorAll('nav');
  let bottomNav = null;
  for (const n of navs) {
    const cs = window.getComputedStyle(n);
    const r = n.getBoundingClientRect();
    if (cs.position === "fixed" && r.bottom >= vh - 5 && r.width > 200) {
      bottomNav = { visible: cs.display !== "none" && cs.visibility !== "hidden", y: r.y, h: r.height, z: cs.zIndex, display: cs.display };
      break;
    }
  }
  // Back button
  const buttons = document.querySelectorAll('button');
  let backBtn = null;
  for (const b of buttons) {
    const t = (b.textContent || "").trim();
    const aria = b.getAttribute('aria-label') || "";
    if (t === "" || t.length < 5 || aria.toLowerCase().includes("back") || aria.toLowerCase().includes("atrás") || aria.toLowerCase().includes("volver")) {
      const svg = b.querySelector('svg');
      if (svg) {
        const r = b.getBoundingClientRect();
        if (r.y < 80 && r.x < 80 && r.width > 0) {
          backBtn = { visible: true, x: r.x, y: r.y, aria, text: t };
          break;
        }
      }
    }
  }
  // Find Aprobar / Rechazar buttons
  const aprobarBtn = Array.from(document.querySelectorAll('button')).find(b => /aprobar/i.test(b.textContent || ""));
  const rechazarBtn = Array.from(document.querySelectorAll('button')).find(b => /rechazar/i.test(b.textContent || ""));
  const aprobarRect = aprobarBtn ? (() => { const r = aprobarBtn.getBoundingClientRect(); return { y: r.y, h: r.height, visible: r.y < window.innerHeight && r.y + r.height > 0 }; })() : null;
  const rechazarRect = rechazarBtn ? (() => { const r = rechazarBtn.getBoundingClientRect(); return { y: r.y, h: r.height, visible: r.y < window.innerHeight && r.y + r.height > 0 }; })() : null;

  return {
    viewport: { w: vw, h: vh },
    largestFixed,
    breadcrumbVisible: findVisible("Comercial").visible,
    pendientesVisible: findVisible("Pendientes 14").visible,
    bottomNav,
    backBtn,
    aprobarRect,
    rechazarRect,
    bodyOverflow: document.documentElement.scrollWidth > vw,
  };
});

// Scroll to bottom of detail to verify footer
await page.evaluate(() => {
  // find scrollable container in detail
  const scrollers = Array.from(document.querySelectorAll('*')).filter(el => {
    const cs = window.getComputedStyle(el);
    return (cs.overflowY === "auto" || cs.overflowY === "scroll") && el.scrollHeight > el.clientHeight + 20;
  });
  // pick the largest one
  scrollers.sort((a, b) => (b.clientWidth * b.clientHeight) - (a.clientWidth * a.clientHeight));
  if (scrollers[0]) scrollers[0].scrollTop = scrollers[0].scrollHeight;
  window.scrollTo(0, document.body.scrollHeight);
});
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/03-detail-fullscreen-bottom.png`, fullPage: false });

const footerInfo = await page.evaluate(() => {
  const aprobarBtn = Array.from(document.querySelectorAll('button')).find(b => /aprobar/i.test(b.textContent || ""));
  const rechazarBtn = Array.from(document.querySelectorAll('button')).find(b => /rechazar/i.test(b.textContent || ""));
  const vh = window.innerHeight;
  const a = aprobarBtn ? (() => { const r = aprobarBtn.getBoundingClientRect(); return { y: r.y, h: r.height, inViewport: r.y >= 0 && r.y + r.height <= vh, fullyVisible: r.y >= 0 && r.bottom <= vh }; })() : null;
  const re = rechazarBtn ? (() => { const r = rechazarBtn.getBoundingClientRect(); return { y: r.y, h: r.height, inViewport: r.y >= 0 && r.y + r.height <= vh, fullyVisible: r.y >= 0 && r.bottom <= vh }; })() : null;
  // Bottom nav still hidden?
  const navs = document.querySelectorAll('nav');
  let bottomNav = null;
  for (const n of navs) {
    const cs = window.getComputedStyle(n);
    const r = n.getBoundingClientRect();
    if (cs.position === "fixed" && r.bottom >= vh - 5 && r.width > 200) {
      bottomNav = { display: cs.display, visibility: cs.visibility, y: r.y, z: cs.zIndex };
      break;
    }
  }
  return { aprobar: a, rechazar: re, bottomNav };
});

// Click back button
const backClicked = await page.evaluate(() => {
  const buttons = document.querySelectorAll('button');
  for (const b of buttons) {
    const aria = b.getAttribute('aria-label') || "";
    const t = (b.textContent || "").trim();
    const svg = b.querySelector('svg');
    const r = b.getBoundingClientRect();
    // back is upper-left small icon button
    if (svg && r.y < 80 && r.x < 80 && r.width < 60 && r.height < 60) {
      b.click();
      return { ok: true, aria, text: t };
    }
  }
  return { ok: false };
});

await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/04-post-back.png`, fullPage: false });

const postBackInfo = await page.evaluate(() => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const findVisible = (txt) => {
    const els = Array.from(document.querySelectorAll('*')).filter(e => (e.textContent || "").includes(txt) && (e.textContent || "").length < 150);
    for (const el of els) {
      const r = el.getBoundingClientRect();
      const cs = window.getComputedStyle(el);
      if (r.width > 0 && r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden" && r.y < vh) return true;
    }
    return false;
  };
  const navs = document.querySelectorAll('nav');
  let bottomNav = null;
  for (const n of navs) {
    const cs = window.getComputedStyle(n);
    const r = n.getBoundingClientRect();
    if (cs.position === "fixed" && r.bottom >= vh - 5 && r.width > 200) {
      bottomNav = { visible: cs.display !== "none" && cs.visibility !== "hidden", y: r.y };
      break;
    }
  }
  return {
    breadcrumb: findVisible("Comercial"),
    pendientes: findVisible("Pendientes 14"),
    bottomNav,
  };
});

console.log(JSON.stringify({ beforeClickInfo, clicked, detailInfo, footerInfo, backClicked, postBackInfo, errors }, null, 2));

await browser.close();
