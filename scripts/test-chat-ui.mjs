// Browser checks for the chat itself: startup (no restart cancelling the first question),
// real-unmount cancellation, the support-agent wording in RO/RU, streaming clean-up and the
// context sent with follow-ups. Needs the dev server (BASE, default http://localhost:3100).
// The model is never called: corpus answers are deterministic and streaming is stubbed.
import { chromium } from "playwright";
import { createServer } from "node:http";

const BASE = process.env.BASE ?? "http://localhost:3100";
const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok }); console.log(`${ok ? "✓" : "✗"} ${name}${extra ? " — " + extra : ""}`); };
const WATER = "Ce acte îmi trebuie pentru contractul de apă la apartament?";

const b = await chromium.launch();
async function page(lang = "ro") {
  const c = await b.newContext({ viewport: { width: 1100, height: 900 } });
  await c.addCookies([{ name: "pefir_lang", value: lang, url: BASE }]);
  const p = await c.newPage();
  p.errs = [];
  p.on("pageerror", (e) => p.errs.push(String(e)));
  return p;
}

// 1. A question in the link is answered, not cancelled by the startup, and saved once.
{
  const p = await page();
  const aborted = [];
  p.on("requestfailed", (r) => r.url().includes("/api/ask") && aborted.push(r.failure()?.errorText));
  await p.goto(`${BASE}/intreaba?q=${encodeURIComponent(WATER)}`);
  const answered = await p.waitForSelector("[id$='-ans-h']", { timeout: 120000 }).then(() => true, () => false);
  check("startup: ?q= question answered", answered);
  check("startup: no cancelled request", aborted.length === 0, JSON.stringify(aborted));
  check("startup: no error box", (await p.locator(".chat-error").count()) === 0);
  await p.waitForTimeout(400);
  const store = await p.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith("pefir:conversations")).map((k) => [k, JSON.parse(localStorage.getItem(k))])));
  const keys = Object.keys(store);
  check("startup: saved only under the resolved owner", keys.length === 1 && keys[0].endsWith(":guest"), JSON.stringify(keys));
  const turn = store[keys[0]]?.[0]?.turns?.[0];
  check("startup: saved turn is the answer, not a failure", !!turn?.answer && !turn?.failed);
  check("startup: no page errors", p.errs.length === 0, p.errs.join(" | ").slice(0, 160));
  await p.context().close();
}

// 1b. The layout is prerendered in Romanian; a Russian user's link question must still go out
//     in Russian (it used to be sent before the language cookie was adopted).
{
  const p = await page("ru");
  const sent = [];
  p.on("request", (r) => r.url().includes("/api/ask") && sent.push(JSON.parse(r.postData() ?? "{}").lang));
  await p.goto(`${BASE}/intreaba?q=${encodeURIComponent("Какие документы нужны для договора на воду в квартире?")}`);
  await p.waitForSelector("[id$='-ans-h']", { timeout: 120000 });
  check("language: link question sent in the selected language", sent.length === 1 && sent[0] === "ru", JSON.stringify(sent));
  const txt = await p.locator(".chat-answer").last().innerText();
  check("language: RU question answered from the sources, in RU", txt.includes("Подтверждено источниками") && !txt.includes("Язык изменён"));
  await p.context().close();
}

// 1c. No question leaves the browser before the on-device name model (~280 MB) has checked it,
//     not even the first one; the download starts when the chat opens, not on send, and
//     the wait shows its progress. If the model cannot load, nothing is sent.
{
  const p = await page();
  const bodies = [];
  let modelRequestedAt = Infinity;
  p.on("request", (r) => {
    if (r.url().includes("/api/ask")) bodies.push(r.postData() ?? "");
    if (/multilang-pii-ner-ONNX/.test(r.url())) modelRequestedAt = Math.min(modelRequestedAt, Date.now());
  });
  await p.goto(`${BASE}/intreaba`);
  await p.waitForTimeout(1500);
  check("privacy: model download starts when the chat opens, before any question", modelRequestedAt !== Infinity && !bodies.length);
  await p.fill("#chat-message", "Mă numesc Ion Popescu, IDNP 2001234567890, cum depun o petiție?");
  await p.keyboard.press("Enter");
  const shown = await p.getByRole("status").filter({ hasText: "Pregătesc protecția datelor personale" }).waitFor({ timeout: 5000 }).then(() => true, () => false);
  check("privacy: waiting question shows the download progress", shown || bodies.length > 0);
  await p.waitForFunction(() => document.querySelectorAll("[id$='-ans-h'], .chat-error").length >= 1, null, { timeout: 300000 });
  const first = bodies[0] ? JSON.parse(bodies[0]).question : "";
  check("privacy: name masked in the very first question", first.length > 0 && !first.includes("Popescu") && /\[NUME_1\]/.test(first), first);
  check("privacy: IDNP masked in the very first question", first.length > 0 && !first.includes("2001234567890"));
  check("privacy: progress hint gone once sent", (await p.getByText("Pregătesc protecția datelor personale").count()) === 0);
  await p.context().close();
}
{
  const p = await page();
  const bodies = [];
  await p.route(/huggingface\.co|hf\.co/, (route) => route.abort());
  p.on("request", (r) => { if (r.url().includes("/api/ask")) bodies.push(r.postData() ?? ""); });
  await p.goto(`${BASE}/intreaba`);
  await p.waitForLoadState("networkidle");
  await p.fill("#chat-message", "Mă numesc Ion Popescu și vreau să depun o petiție.");
  await p.keyboard.press("Enter");
  const failed = await p.locator(".composer-error").filter({ hasText: "Nu am putut verifica datele personale" }).waitFor({ timeout: 60000 }).then(() => true, () => false);
  check("privacy: model unavailable → question not sent", failed && bodies.length === 0, `${bodies.length} sent`);
  check("privacy: model unavailable → text kept in the box", (await p.inputValue("#chat-message")).includes("Popescu"));
  await p.context().close();
}

// 2. Text typed before the session check finishes is not wiped.
{
  const p = await page();
  await p.goto(`${BASE}/intreaba`, { waitUntil: "domcontentloaded" });
  await p.fill("#chat-message", "Cumpăr mașina — e corect contractul?");
  await p.waitForTimeout(2500);
  check("startup: early draft survives", (await p.inputValue("#chat-message")) === "Cumpăr mașina — e corect contractul?");
  await p.context().close();
}

// 3. Leaving the chat still cancels a question in flight (and staying does not).
{
  const c = await b.newContext();
  await c.addInitScript(() => {
    window.__askAborted = false;
    const orig = window.fetch;
    window.fetch = (input, init) => {
      if (String(input).includes("/api/ask") && init?.signal) init.signal.addEventListener("abort", () => { window.__askAborted = true; });
      return orig(input, init);
    };
  });
  const p = await c.newPage();
  await p.route("**/api/ask", async (route) => { await new Promise((r) => setTimeout(r, 5000)); await route.continue().catch(() => {}); });
  await p.goto(`${BASE}/intreaba`);
  await p.waitForLoadState("networkidle");
  await p.fill("#chat-message", "Cât costă apa?");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(1000);
  check("unmount: staying in the chat does not cancel", !(await p.evaluate(() => window.__askAborted)));
  let completed = 0;
  p.on("requestfinished", (r) => r.url().includes("/api/ask") && completed++);
  await p.locator('a[href="/raporteaza"]').first().click();
  await p.waitForURL("**/raporteaza");
  // The question is either still in the on-device privacy check (then it is never sent) or
  // already in flight (then it is aborted). Either way it must never complete.
  await p.waitForTimeout(8000);
  check("unmount: leaving the chat cancels the question", completed === 0, `${completed} completed`);
  await c.close();
}

// 4. "Conversație nouă" still starts a fresh chat and keeps the saved one.
{
  const p = await page();
  await p.goto(`${BASE}/intreaba`);
  await p.waitForLoadState("networkidle");
  await p.fill("#chat-message", "Cum depun o petiție?");
  await p.keyboard.press("Enter");
  await p.waitForSelector("[id$='-ans-h']", { timeout: 120000 });
  await p.waitForTimeout(300);
  await p.fill("#chat-message", "ciornă nesalvată");
  await p.getByRole("button", { name: "Deschide meniul" }).click();
  await p.locator(".new-conversation").click();
  await p.waitForTimeout(1200);
  check("new conversation: starts with an empty message box", (await p.inputValue("#chat-message")) === "");
  await p.goto(`${BASE}/intreaba`);
  await p.waitForLoadState("networkidle");
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem("pefir:conversations:v1:guest") ?? "[]"));
  check("new conversation: chat is empty", (await p.locator(".chat-turn").count()) === 0);
  check("new conversation: previous one kept in history", saved.length === 1);
  await p.context().close();
}

// 5. Support-agent wording, in the platform language.
for (const [lang, brief, gapTitle, claim] of [
  ["ro", "Pe scurt", "Ce nu știu încă sigur", "Copia buletinului de verificare metrologică a contorului este opțională."],
  ["ru", "Коротко", "Чего я пока не знаю точно", "Копия свидетельства о метрологической поверке счётчика необязательна."],
]) {
  const p = await page(lang);
  await p.goto(`${BASE}/intreaba`);
  await p.waitForLoadState("networkidle");
  await p.fill("#chat-message", WATER);
  await p.keyboard.press("Enter");
  await p.waitForSelector("[id$='-ans-h']", { timeout: 120000 });
  let txt = await p.locator(".chat-answer").last().innerText();
  check(`wording ${lang}: brief heading "${brief}"`, txt.includes(brief));
  check(`wording ${lang}: claim states the fact, in ${lang}`, txt.includes(claim));
  check(`wording ${lang}: no page/corpus attribution`, !/marcată pe pagină|отмечена на странице|Corpusul|В корпусе/.test(txt));
  await p.fill("#chat-message", lang === "ro" ? "Cum înscriu copilul la grădiniță?" : "Как записать ребёнка в детский сад?");
  await p.keyboard.press("Enter");
  await p.waitForFunction((n) => document.querySelectorAll("[id$='-ans-h']").length >= n, 2, { timeout: 120000 });
  txt = await p.locator(".chat-answer").last().innerText();
  check(`wording ${lang}: gap section "${gapTitle}"`, txt.includes(gapTitle));
  await p.context().close();
}

// 6. The follow-up carries what the person actually read, not the internal summary.
{
  const p = await page();
  await p.goto(`${BASE}/intreaba`);
  await p.waitForLoadState("networkidle");
  await p.fill("#chat-message", WATER);
  await p.keyboard.press("Enter");
  await p.waitForSelector("[id$='-ans-h']", { timeout: 120000 });
  const req = p.waitForRequest((r) => r.url().includes("/api/ask") && r.method() === "POST");
  await p.fill("#chat-message", "Și cât durează?");
  await p.keyboard.press("Enter");
  const body = JSON.parse((await req).postData() ?? "{}");
  const said = body.history?.find((t) => t.role === "assistant")?.content ?? "";
  check("history: assistant turn is the claims shown", said.includes("Copia buletinului") && !said.includes("Răspuns susținut de surse"), said.slice(0, 80));
  await p.context().close();
}

// 7. Streaming text is cleaned the same way as the final answer.
{
  const server = createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
    const send = (o) => res.write(`data: ${JSON.stringify(o)}\n\n`);
    send({ type: "chunk", text: "Conform Anexei 1, aveți nevoie " });
    send({ type: "chunk", text: "de o cerere tip [1]." });
    setTimeout(() => {
      send({ type: "answer", answer: { question: "q", questionLang: "ro", kind: "prose", prose: "Aveți nevoie de o cerere tip.", unverified: true, status: "missing", topicId: null, topicTitle: null, demoCorpus: false, summary: { ro: "", ru: "" }, claims: [], claimIndex: {}, sources: [], steps: [], missing: [], conflicts: [], contacts: [], requestedAspects: [], passages: {}, docs: {}, validation: { checked: 0, passed: 0, dropped: [] }, engine: { mode: "general", label: { ro: "", ru: "" }, retrieval: { topicScore: 0, candidates: [] } }, generatedAt: new Date().toISOString() } });
      res.end();
    }, 2500);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const p = await page();
  await p.route("**/api/ask", (route) => route.continue({ url: `http://127.0.0.1:${port}/sse` }));
  await p.goto(`${BASE}/intreaba`);
  await p.waitForLoadState("networkidle");
  await p.fill("#chat-message", "Ce acte trebuie?");
  await p.keyboard.press("Enter");
  const streaming = await p.waitForSelector(".prose-stream", { timeout: 120000 }).then(() => p.locator(".prose-stream").innerText(), () => "");
  check("streaming: robotic opener never shown", streaming.length > 0 && !/Conform Anexei|\[1\]/.test(streaming), JSON.stringify(streaming));
  check("streaming: text starts naturally", /^Aveți nevoie/.test(streaming));
  await p.context().close();
  server.close();
}

// 8. A failed request reads like a person, and the question is kept for retry.
{
  const p = await page();
  await p.route("**/api/ask", (route) => route.abort());
  await p.goto(`${BASE}/intreaba`);
  await p.waitForLoadState("networkidle");
  await p.fill("#chat-message", "Cât costă apa?");
  await p.keyboard.press("Enter");
  await p.waitForSelector(".chat-error", { timeout: 120000 });
  const err = await p.locator(".chat-error").innerText();
  check("error: friendly apology with retry", err.includes("Îmi pare rău") && err.includes("Încearcă din nou"));
  await p.context().close();
}

console.log(`\n${results.filter((x) => x.ok).length}/${results.length} passed`);
await b.close();
process.exit(results.every((x) => x.ok) ? 0 : 1);
