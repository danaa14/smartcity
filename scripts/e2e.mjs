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
const ask = async (p, q) => { await p.goto(`${BASE}/intreaba?q=${encodeURIComponent(q)}`); await p.waitForSelector("[id$='-ans-h']", { timeout: 120000 }); };

// The answers live in the chat (/intreaba renders ChatClient with compact answers).
const answerText = (p) => p.locator(".chat-answer").last().innerText();

// 1-3: answer states
let p = await ctx();
const states = [
  ["Ce acte îmi trebuie pentru contractul de apă la apartament?", "Susținut de surse"],
  ["Cât costă și în cât timp se încheie contractul de apă?", "Susținut parțial"],
  ["Cum înscriu copilul la grădiniță?", "Lipsește din corpus"],
];
for (const [q, badge] of states) {
  await ask(p, q);
  check(`state "${badge}"`, (await answerText(p)).includes(badge));
}
// The fictional DEMO corpus illustrates contradictions for staff; residents never get it as evidence.
await ask(p, "Cu câte zile înainte depun cererea pentru terasă sezonieră?");
const terrace = await answerText(p);
check("chat never serves fictional DEMO sources", !terrace.includes("DEMO") && terrace.includes("Lipsește din corpus"));

// Claim-level citations + highlighting, in the chat's source dialog
await ask(p, states[0][0]);
const markers = p.locator(".chat-answer button[aria-label^='Dovada']");
check("claim citation markers present", (await markers.count()) >= 3, `${await markers.count()} markers`);
await markers.nth(1).click();
let panel = p.locator("dialog[open] [id$='-source-panel']");
const mark = await panel.locator("mark").first().innerText();
check("source panel highlights exact passage", mark.length > 20, mark.slice(0, 60));
check("source panel links original URL", (await panel.locator("a[href^='https://www.acc.md']").count()) > 0);

// Citation report from the source dialog
await panel.getByRole("button", { name: /Semnalează o citare/ }).click();
await panel.getByRole("button", { name: "Trimite semnalarea" }).click();
check("citation report validates reason", (await panel.getByText("Alegeți un motiv.").count()) > 0);
await panel.getByLabel("Informația pare depășită").check();
await panel.getByRole("button", { name: "Trimite semnalarea" }).click();
await p.waitForSelector("text=Semnalarea a fost salvată");
check("citation report saved", true);
const q1 = await panel.locator("blockquote").first().innerText();
await panel.getByRole("button", { name: "Închide" }).click();

// Language switch (account menu) preserves citations
const before = await markers.evaluateAll((els) => els.map((e) => e.textContent));
await p.getByRole("button", { name: "Deschide meniul" }).click();
await p.getByRole("button", { name: "Русский" }).click();
await p.waitForSelector("text=Коротко");
await p.keyboard.press("Escape");
const ruMarkers = p.locator(".chat-answer button[aria-label^='Доказательство']");
const after = await ruMarkers.evaluateAll((els) => els.map((e) => e.textContent));
check("RU switch keeps same citation markers", JSON.stringify(before.map((x) => x.replace(/RO$/, ""))) === JSON.stringify(after.map((x) => x.replace(/RO$/, ""))), `${before.length} vs ${after.length}`);
await ruMarkers.nth(1).click();
panel = p.locator("dialog[open] [id$='-source-panel']");
check("RU switch keeps original RO quote", (await panel.locator("blockquote").first().innerText()) === q1);
check("RU shows unofficial translation", (await panel.getByText("Неофициальный перевод").count()) > 0);
check("html lang updated to ru", (await p.evaluate(() => document.documentElement.lang)) === "ru");
await p.screenshot({ path: ".data/shots/e2e-ru.png", fullPage: true });
await panel.getByRole("button", { name: "Закрыть" }).click();

// Russian question
await ask(p, "Какие документы нужны для договора на воду в квартире?");
check("RU question answered supported", (await answerText(p)).includes("Подтверждено источниками"));

// Rating
p = await ctx();
await ask(p, states[0][0]);
await p.getByRole("button", { name: /Da, util/ }).click();
await p.waitForSelector("text=Mulțumim.");
check("rating saved", true);

// Empty question error + Enter submits
await p.goto(`${BASE}/intreaba`);
await p.waitForLoadState("networkidle");
await p.focus("#chat-message");
await p.keyboard.press("Enter");
check("empty question shows alert", (await p.locator("#chat-validation[role=alert]").count()) === 1);
check("keyboard: Enter submits question", await (async () => { await p.fill("#chat-message", "Cum depun o petiție la primărie?"); await p.press("#chat-message", "Enter"); await p.waitForSelector("[id$='-ans-h']", { timeout: 120000 }); return true; })());

// Mobile: citation opens as dialog, focus returns
const m = await ctx(true);
await ask(m, states[0][0]);
const mk = m.locator(".chat-answer button[aria-label^='Dovada']").first();
await mk.click();
check("mobile: citation opens modal dialog", await m.locator("dialog[open]").isVisible());
await m.getByRole("button", { name: "Închide" }).click();
check("mobile: focus returns to marker", await mk.evaluate((e) => e === document.activeElement));
const overflow = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
check("mobile: no horizontal overflow on Ask", !overflow);
await m.screenshot({ path: ".data/shots/e2e-mobile-ask.png", fullPage: true });

// Document assistant (/scaneaza): local OCR → personal data hidden on the device → the user
// confirms the exact outgoing text → verdict. The review call is stubbed so no model is needed.
// Send stays locked until the ~280 MB on-device personal-data model is loaded; a persistent
// profile keeps it cached, so only the first run pays for the download.
const scanCtx = await chromium.launchPersistentContext(".data/pw-scan-profile", { viewport: { width: 1360, height: 900 } });
p = await scanCtx.newPage();
await p.goto(`${BASE}/scaneaza`);
await p.getByRole("button", { name: /Folosește contractul-exemplu/ }).click();
await p.waitForSelector("text=Exemplu ales");
await p.getByRole("button", { name: /Citește documentul pe acest dispozitiv/ }).click();
await p.waitForSelector("#red-h", { timeout: 300000 });
check("scan: text recognised on the device", (await p.locator("#doc-text").innerText()).trim().length > 100);
const piiHeading = await p.getByText(/Date personale găsite \(\d+\/\d+\)/).innerText();
check("scan: personal data detected", Number(piiHeading.match(/\/(\d+)\)/)?.[1] ?? 0) > 0, piiHeading);
const sendScan = p.getByRole("button", { name: /Trimite spre analiză/ });
check("scan: send blocked until confirmed", await sendScan.isDisabled());
const outgoingScan = await p.locator("pre").filter({ hasText: /\S/ }).last().innerText();
check("scan: outgoing text has no IDNP", !/\b[0-2]\d{12}\b/.test(outgoingScan));
await p.getByLabel(/Am verificat: toate datele personale sunt ascunse/).check();
const unlocked = await p.waitForFunction(() => ![...document.querySelectorAll("button")].find((x) => x.textContent?.includes("Trimite spre analiză"))?.disabled, null, { timeout: 900000 }).then(() => true, () => false);
check("scan: send unlocked after confirmation + local model ready", unlocked);
await p.route("**/api/scan/review", (route) => route.fulfill({
  status: 200,
  contentType: "application/json",
  body: JSON.stringify({
    docType: { ro: "Contract de vânzare-cumpărare", ru: "Договор купли-продажи" },
    userRole: { ro: "cumpărător", ru: "покупатель" },
    summary: { ro: "Contractul acoperă părțile și prețul, dar nu spune ce se întâmplă la întârziere.", ru: "Договор покрывает стороны и цену." },
    verdict: "needs_attention",
    findings: [{ id: "f1", kind: "risk", severity: "risk", title: { ro: "Nu există termen de predare", ru: "Нет срока передачи" }, explanation: { ro: "Documentul nu fixează o dată de predare.", ru: "Нет даты передачи." }, suggestion: { ro: "Cereți un termen explicit.", ru: "Попросите явный срок." }, quote: null, quoteVerified: false }],
    checklist: [{ item: { ro: "Termen de predare", ru: "Срок передачи" }, present: false, quote: null, quoteVerified: false }],
    model: "stub/test",
  }),
}));
await sendScan.click();
await p.waitForSelector("#res-h", { timeout: 30000 });
const scanTxt = await p.locator("main").innerText();
check("scan: verdict rendered", scanTxt.includes("Necesită atenție") && scanTxt.includes("Nu există termen de predare"));
check("scan: not presented as legal advice", scanTxt.includes("nu este consultanță juridică"));
await p.screenshot({ path: ".data/shots/e2e-scan.png", fullPage: true });
await scanCtx.close();

// Report flow on mobile: photo → title + service + description → review → registered on the
// server (institutions not connected) → ticket page → delete
const PHOTO = "public/samples/contract-exemplu.jpg";
const describe = async (pg, text) => {
  if (!(await pg.locator("#report-message").count())) await pg.getByRole("button", { name: /Mesaj/ }).first().click();
  await pg.fill("#report-message", text);
};
const r = await ctx(true);
await r.goto(`${BASE}/raporteaza`);
await r.evaluate(() => localStorage.clear());
await r.reload();
await r.locator(".camera-alternative input[type=file]").setInputFiles(PHOTO);
check("report: a photo opens the details step", await r.waitForSelector("#report-title", { timeout: 10000 }).then(() => true, () => false));
await r.getByRole("button", { name: /Mai departe/ }).click();
check("report: title required", (await r.getByText("Dă-i problemei un titlu").count()) > 0);
await r.fill("#report-title", "Groapă mare pe trotuar");
await r.getByRole("button", { name: /Mai departe/ }).click();
check("report: description required", (await r.getByText("de cel puțin 10 caractere").count()) > 0);
await describe(r, "Groapă adâncă lângă stația de autobuz, periculoasă seara.");
await r.getByRole("button", { name: /Mai departe/ }).click();
check("report: service required", (await r.getByText("Alege serviciul").count()) > 0);
await r.locator("input[name=service]").first().check({ force: true });
await r.fill("#report-location", "bd. Exemplu 1");
await r.getByRole("button", { name: /Mai departe/ }).click();
await r.waitForSelector("text=SESIZAREA TA");
check("report: review shows what will be saved", (await r.locator("main").innerText()).includes("Groapă mare pe trotuar"));
await r.getByRole("button", { name: /Trimite sesizarea/ }).click();
await r.waitForSelector("text=SESIZARE ÎNREGISTRATĂ", { timeout: 15000 });
const done = await r.locator("main").innerText();
const ticketId = done.match(/SES-\d{8}-[0-9A-F]{8}/)?.[0];
check("ticket: unique id shown", !!ticketId, ticketId);
check("ticket: honest 'not connected' notice", done.includes("nu sunt conectate"));
await r.screenshot({ path: ".data/shots/e2e-ticket-mobile.png", fullPage: true });
// Tickets are kept on the server for staff only: a resident's link shows the staff gate.
await r.goto(`${BASE}/tichet/${ticketId}`);
check("ticket: page closed to residents", (await r.locator(".bo-gate").count()) === 1);

// Report network failure keeps the draft
const f = await ctx();
await f.goto(`${BASE}/raporteaza`);
await f.evaluate(() => localStorage.clear());
await f.reload();
await f.locator(".camera-alternative input[type=file]").setInputFiles(PHOTO);
await f.fill("#report-title", "Bec stradal ars de o săptămână");
await f.locator("input[name=service]").first().check({ force: true });
await describe(f, "Becul de pe stâlpul din fața blocului nu mai arde.");
await f.getByRole("button", { name: /Mai departe/ }).click();
await f.route("**/api/tickets", (route) => route.abort());
await f.getByRole("button", { name: /Trimite sesizarea/ }).click();
await f.waitForSelector("text=Nu am putut salva sesizarea");
check("report: failed save keeps the user on the review", (await f.locator("main").innerText()).includes("Bec stradal ars"));
await f.unroute("**/api/tickets");
await f.reload();
await f.locator(".camera-alternative input[type=file]").setInputFiles(PHOTO);
await f.waitForSelector("#report-title");
check("report: draft survives failure + reload", (await f.inputValue("#report-title")).includes("Bec stradal") && (await f.getByText("Am păstrat textul ciornei").count()) > 0);
await f.evaluate(() => localStorage.clear());

// Back office sits behind the password gate
p = await ctx();
await p.goto(`${BASE}/angajati`);
check("staff: closed without a session", (await p.locator(".bo-gate").count()) === 1);

const STAFF_PASSWORD = process.env.STAFF_PASSWORD;
if (!STAFF_PASSWORD) {
  console.log("… staff section skipped (set STAFF_PASSWORD to run it)");
} else {
  const bad = await p.request.post(`${BASE}/api/staff/auth`, { data: { password: "definitely-not-it" } });
  check("staff: wrong password rejected", bad.status() === 401);
  check("staff: review endpoint closed without a session", (await p.request.patch(`${BASE}/api/review`, { data: { id: "x", state: "resolved" } })).status() === 401);

  await p.request.post(`${BASE}/api/staff/auth`, { data: { password: STAFF_PASSWORD } });
  await p.goto(`${BASE}/angajati`);
  check("staff: session opens the back office", (await p.locator(".bo-shell").count()) === 1);
  check("staff: overview counts corpus coverage", (await p.locator(".bo-tiles .bo-tile").count()) >= 5);

  await p.getByRole("button", { name: /Lacune/ }).first().click();
  check("staff: gap from unanswered question", (await p.locator(".bo-rows").innerText()).includes("grădiniță"));

  await p.getByRole("button", { name: /Contradicții/ }).first().click();
  check("staff: conflict with both passages", (await p.locator("blockquote.bo-quote").count()) === 2);

  await p.getByRole("button", { name: /Acoperire/ }).first().click();
  check("staff: coverage funnel rendered", (await p.locator(".bo-funnel li").count()) === 4);

  await p.getByRole("button", { name: /Dovezi/ }).first().click();
  check("staff: recheck queue rendered", (await p.locator(".bo-rows .bo-row").count()) >= 1);

  await p.goto(`${BASE}/tichet/${ticketId}`);
  const tt = await p.locator("main").innerText();
  check("ticket: staff page says it was not sent", tt.includes("Nu a fost trimisă"));
  check("ticket: no fake progress", tt.includes("nimeni nu a fost anunțat"));
  await p.getByRole("button", { name: /Șterge tichetul și fișierele/ }).click();
  await p.getByRole("button", { name: "Da, șterge" }).click();
  await p.waitForSelector("text=au fost șterse");
  check("ticket: deletable by staff", true);
}

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
await p.waitForSelector("text=Numărul sesizării", { timeout: 30000 });
check("phone: read-back before confirmation", (await p.getByText("Citesc înapoi").count()) > 0);
check("phone: says the report was not sent to the Primărie", (await p.getByText(/nu a fost trimisă Primăriei/).count()) > 0);

// Home 5-second test on mobile: ask input above fold
const h = await ctx(true);
await h.goto(`${BASE}/`);
const box = await h.locator("#chat-message").boundingBox();
check("home mobile: question input above the fold", box && box.y + box.height < 844, `y=${Math.round(box?.y)}`);
await h.screenshot({ path: ".data/shots/e2e-home-mobile.png" });

console.log(`\n${results.filter((x) => x.ok).length}/${results.length} passed`);
await b.close();
process.exit(results.every((x) => x.ok) ? 0 : 1);
