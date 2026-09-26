// Usage: node scripts/shot.mjs <path> <name> [mobile] [lang] — screenshot + console errors
import { chromium } from "playwright";
const [, , p, name, mobile, lang = "ro"] = process.argv;
const b = await chromium.launch();
const ctx = await b.newContext(mobile === "mobile" ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1360, height: 900 } });
await ctx.addCookies([{ name: "pefir_lang", value: lang, url: "http://localhost:3100" }]);
const page = await ctx.newPage();
const errs = [];
page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
page.on("pageerror", (e) => errs.push(String(e)));
await page.goto("http://localhost:3100" + p, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: `.data/shots/${name}.png`, fullPage: true });
console.log(errs.length ? "ERRORS:\n" + errs.join("\n") : "no console errors");
await b.close();
