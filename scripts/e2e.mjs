// End-to-end checks against a running dev server (default http://localhost:3100).
import { chromium } from "playwright";
const BASE = process.env.BASE ?? "http://localhost:3100";
const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok }); console.log(`${ok ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`); };
const b = await chromium.launch();

async function ctx(mobile = false, lang = "ro") {
  const c = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1360, height: 900 } });
  await c.addCookies([{ name: "pefir_lang", value: lang, url: BASE }]);
  const p = await c.newPage();
  p.errs = [];
  p.on("pageerror", (e) => p.errs.push(String(e)));
  p.on("console", (m) => m.type() === "error" && p.errs.push(m.text()));
  return p;
}
const ask = async (p, q) => { await p.goto(`${BASE}/intreaba?q=${encodeURIComponent(q)}`); await p.waitForSelector("#ans-h", { timeout: 15000 }); };

// 1-4: answer states
let p = await ctx();
const states = [
  ["Ce acte îmi trebuie pentru contractul de apă la apartament?", "Susținut de surse"],
  ["Cât costă și în cât timp se încheie contractul de apă?", "Susținut parțial"],
  ["Cum înscriu copilul la grădiniță?", "Lipsește din corpus"],
  ["Cu câte zile înainte depun cererea pentru terasă sezonieră?", "Posibilă contradicție"],
];
for (const [q, badge] of states) {
  await ask(p, q);
  const txt = await p.locator("article").first().innerText();
  check(`state "${badge}"`, txt.includes(badge));
}
check("contradiction shows two side-by-side passages", (await p.locator("figure blockquote").count()) >= 2);
check("contradiction labelled DEMO", (await p.getByText("DEMO — fictiv").count()) > 0);
await p.screenshot({ path: ".data/shots/e2e-conflict.png", fullPage: true });

// Claim-level citations + highlighting
await ask(p, states[0][0]);
const markers = p.locator("article button[aria-label^='Dovada']");
check("claim citation markers present", (await markers.count()) >= 3, `${await markers.count()} markers`);
await markers.nth(1).click();
const mark = await p.locator("#source-panel mark").innerText();
check("source panel highlights exact passage", mark.length > 20, mark.slice(0, 60));
check("source panel links original URL", (await p.locator("#source-panel a[href^='https://www.acc.md']").count()) > 0);
await p.getByRole("button", { name: /Radiografie/ }).click();
check("x-ray shows quotes inline", (await p.locator("article li mark").count()) >= 3);

// Language switch preserves citations
const before = await markers.evaluateAll((els) => els.map((e) => e.textContent));
const q1 = await p.locator("#source-panel blockquote").innerText();
await p.getByRole("button", { name: "Русский" }).click();
await p.waitForSelector("text=Что говорят источники");
const after = await p.locator("article button[aria-label^='Доказательство']").evaluateAll((els) => els.map((e) => e.textContent));
check("RU switch keeps same citation markers", JSON.stringify(before.map((x) => x.replace(/RO$/, ""))) === JSON.stringify(after.map((x) => x.replace(/RO$/, ""))), `${before.length} vs ${after.length}`);
check("RU switch keeps original RO quote", (await p.locator("#source-panel blockquote").innerText()) === q1);
check("RU shows unofficial translation", (await p.getByText("Неофициальный перевод").count()) > 0);
check("html lang updated to ru", (await p.evaluate(() => document.documentElement.lang)) === "ru");
await p.screenshot({ path: ".data/shots/e2e-ru.png", fullPage: true });

// Russian question
await ask(p, "Какие документы нужны для договора на воду в квартире?");
check("RU question answered supported", (await p.locator("article").first().innerText()).includes("Подтверждено источниками"));

// Feedback + citation report
p = await ctx();
await ask(p, states[0][0]);
await p.getByRole("button", { name: /Da, util/ }).click();
await p.waitForSelector("text=Evaluarea a fost salvată");
check("rating saved", true);
await p.getByRole("button", { name: /Semnalează o citare/ }).click();
await p.getByRole("button", { name: "Trimite semnalarea" }).click();
check("citation report validates reason", (await p.getByText("Alegeți un motiv.").count()) > 0);
await p.getByLabel("Informația pare depășită").check();
await p.getByRole("button", { name: "Trimite semnalarea" }).click();
await p.waitForSelector("text=Semnalarea a fost salvată");
check("citation report saved", true);

// Empty question error
await p.goto(`${BASE}/intreaba`);
await p.getByRole("button", { name: "Întreabă", exact: true }).click();
check("empty question shows alert", (await p.locator("#q-err[role=alert]").count()) === 1);
check("keyboard: Enter submits question", await (async () => { await p.fill("#q", "Cum depun o petiție la primărie?"); await p.press("#q", "Enter"); await p.waitForSelector("#ans-h"); return true; })());

// Mobile: citation opens as dialog, focus returns
const m = await ctx(true);
await ask(m, states[0][0]);
const mk = m.locator("article button[aria-label^='Dovada']").first();
await mk.click();
check("mobile: citation opens modal dialog", await m.locator("dialog[open]").isVisible());
await m.getByRole("button", { name: "Închide" }).click();
check("mobile: focus returns to marker", await mk.evaluate((e) => e === document.activeElement));
const overflow = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
check("mobile: no horizontal overflow on Ask", !overflow);
await m.screenshot({ path: ".data/shots/e2e-mobile-ask.png", fullPage: true });

// Scan sample
p = await ctx();
await p.goto(`${BASE}/scaneaza`);
await p.getByRole("button", { name: "Scanează exemplul" }).click();
await p.waitForSelector("#obs-h", { timeout: 60000 });
const scanTxt = await p.locator("main").innerText();
check("scan: OCR text displayed", scanTxt.includes("EXAMINARE FITOSANITAR"));
check("scan: blank-field observation", scanTxt.includes("pare necompletat"));
check("scan: suggestion with citation", (await p.locator("#sug-h ~ ul figure blockquote").count()) >= 1);
check("scan: observation vs inference labels", scanTxt.includes("Observație:") && scanTxt.includes("Deducție:"));
check("scan: no validity verdict", !/document(ul)? (este )?valid\b/i.test(scanTxt.replace("Nu declarăm documentul valid sau invalid", "")));
await p.getByRole("button", { name: "Corectează textul" }).click();
await p.fill("#ocr-edit", "Un text oarecare fără formular");
await p.getByRole("button", { name: "Reanalizează" }).click();
await p.waitForSelector("text=Analiză pe textul corectat");
check("scan: correction reanalyses + needs review", (await p.getByText("Necesită verificare").count()) > 0);
await p.screenshot({ path: ".data/shots/e2e-scan.png", fullPage: true });

// Report flow on mobile
const r = await ctx(true);
await r.goto(`${BASE}/raporteaza`);
await r.evaluate(() => localStorage.clear());
await r.reload();
await r.getByRole("button", { name: /Continuă/ }).click();
check("report: validation on empty step 1", (await r.locator("#rep-text-err").count()) === 1);
await r.fill("#rep-text", "groapă mare pe trotuar lângă stația de autobuz");
await r.getByRole("button", { name: /Continuă/ }).click();
await r.waitForSelector("#rep-loc");
check("report: category suggested (roads)", await r.locator("input[name=cat][value=roads]").isChecked());
await r.getByRole("button", { name: /Verifică/ }).click();
check("report: location required", (await r.locator("#rep-loc-err").count()) === 1);
await r.fill("#rep-loc", "bd. Exemplu 1");
await r.locator("input[name=cat][value=other]").check();
await r.getByRole("button", { name: /Verifică/ }).click();
await r.waitForSelector("#rep-confirm");
check("report: review shows user-changed category", (await r.locator("dl").innerText()).includes("schimbată de dvs."));
await r.getByRole("button", { name: /Creează tichetul demo/ }).click();
check("report: confirm required", (await r.locator("#rep-confirm-err").count()) === 1);
await r.check("#rep-confirm");
await r.getByRole("button", { name: /Creează tichetul demo/ }).click();
await r.waitForURL(/\/tichet\/DEMO-/);
const tt = await r.locator("main").innerText();
check("ticket: unique DEMO id", /DEMO-\d{8}-[0-9A-F]{6}/.test(tt));
check("ticket: 'not submitted' label", tt.includes("netrimis la Primărie") || tt.includes("NETRIMIS LA PRIMĂRIE"));
check("ticket: no fake progress", tt.includes("NU (nu există integrare)"));
await r.screenshot({ path: ".data/shots/e2e-ticket-mobile.png", fullPage: true });
const ticketUrl = r.url();
await r.getByRole("button", { name: /Șterge tichetul/ }).click();
await r.getByRole("button", { name: "Da, șterge" }).click();
await r.waitForSelector("text=au fost șterse");
check("ticket: deletable", true);

// Report network failure keeps draft
const f = await ctx();
await f.goto(`${BASE}/raporteaza`);
await f.fill("#rep-text", "bec stradal ars de o săptămână");
await f.getByRole("button", { name: /Continuă/ }).click();
await f.fill("#rep-loc", "str. Exemplu 5");
await f.getByRole("button", { name: /Verifică/ }).click();
await f.check("#rep-confirm");
await f.route("**/api/tickets", (route) => route.abort());
await f.getByRole("button", { name: /Creează tichetul demo/ }).click();
await f.waitForSelector("text=Ciorna este păstrată");
await f.unroute("**/api/tickets");
await f.reload();
await f.waitForFunction(() => document.querySelector("#rep-text")?.value.length > 0, null, { timeout: 5000 }).catch(() => {});
check("report: draft survives failure + reload", (await f.inputValue("#rep-text")).includes("bec stradal"));
await f.evaluate(() => localStorage.clear());

// Staff sees gaps / conflicts
p = await ctx();
await p.goto(`${BASE}/angajati`);
check("staff: gap from unanswered question", (await p.locator("main").innerText()).includes("grădiniță"));
await p.getByRole("tab", { name: /Contradicții/ }).click();
check("staff: conflict with both passages", (await p.locator("#panel-conflicts blockquote").count()) === 2);
await p.getByRole("tab", { name: /Citări semnalate/ }).click();
check("staff: citation report listed", (await p.locator("#panel-citations article").count()) >= 1);
await p.getByRole("tab", { name: /Citări semnalate/ }).press("ArrowRight");
check("staff: tabs keyboard navigable", (await p.getByRole("tab", { name: /Evaluări/ }).getAttribute("aria-selected")) === "true");

// Keyboard: skip link + focus visible
p = await ctx();
await p.goto(`${BASE}/`);
await p.keyboard.press("Tab");
check("keyboard: first Tab reaches skip link", (await p.evaluate(() => document.activeElement?.textContent)) === "Sari la conținut");
const outline = await p.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
check("keyboard: visible focus outline", outline !== "none");

// Phone demo
p = await ctx();
await p.goto(`${BASE}/suna`);
await p.getByLabel(/Informație lipsă/).check();
await p.getByRole("button", { name: /Pornește apelul demo/ }).click();
await p.waitForSelector("text=Nu am în surse", { timeout: 15000 });
check("phone: missing → human contact suggestion", (await p.getByText("+373 22 20 15 05").count()) > 0);
await p.getByLabel(/Sesizare vocală/).check();
await p.getByRole("button", { name: /Pornește apelul demo/ }).click();
await p.waitForSelector("text=Deschide tichetul demo", { timeout: 15000 });
check("phone: read-back before confirmation", (await p.getByText("Citesc înapoi").count()) > 0);

// Home 5-second test on mobile: ask input above fold
const h = await ctx(true);
await h.goto(`${BASE}/`);
const box = await h.locator("#home-q").boundingBox();
check("home mobile: question input above the fold", box && box.y + box.height < 844, `y=${Math.round(box?.y)}`);
await h.screenshot({ path: ".data/shots/e2e-home-mobile.png" });

console.log(`\n${results.filter((x) => x.ok).length}/${results.length} passed`);
await b.close();
process.exit(results.every((x) => x.ok) ? 0 : 1);
