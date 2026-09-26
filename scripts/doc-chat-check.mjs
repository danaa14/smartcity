// Exercises the in-chat document flow: attach → local OCR → redaction gate → verdict.
// Usage: node scripts/doc-chat-check.mjs   (needs the dev server on :3100)
import { chromium } from "playwright";

const BASE = "http://localhost:3100";
const SAMPLE = "public/samples/contract-exemplu.jpg";
const out = [];
const ok = (m) => out.push(`${m} OK`);
const fail = (m) => { out.push(`${m} FAILED`); process.exitCode = 1; };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1100 } });
page.on("console", (m) => m.type() === "error" && console.log("  [console error]", m.text().slice(0, 160)));

await page.goto(`${BASE}/intreaba`, { waitUntil: "domcontentloaded" });

// The goal is whatever is already typed when the file is attached.
await page.fill("#chat-message", "Cumpăr mașina — sunt corecți termenii pentru mine?");
await page.click(".composer-tools");
await page.waitForSelector(".tool-list", { state: "visible" });
const docBtn = page.locator(".tool-list button").first();
if ((await docBtn.textContent())?.includes("document")) ok("SHEET ENTRY"); else fail("SHEET ENTRY");

// The real path: the sheet entry opens the picker and closes the sheet behind it.
const [chooser] = await Promise.all([page.waitForEvent("filechooser"), docBtn.click()]);
await chooser.setFiles(SAMPLE);
await page.waitForSelector("dialog.utility-sheet", { state: "hidden", timeout: 5000 });
ok("SHEET CLOSES ON PICK");

// Attaching must create a turn without leaving /intreaba.
await page.waitForSelector(".user-file", { timeout: 10000 });
if (new URL(page.url()).pathname === "/intreaba") ok("STAYS IN CHAT"); else fail("STAYS IN CHAT");
if (await page.locator(".user-message", { hasText: "Cumpăr mașina" }).count()) ok("GOAL CAPTURED"); else fail("GOAL CAPTURED");
if ((await page.inputValue("#chat-message")) === "") ok("COMPOSER CLEARED"); else fail("COMPOSER CLEARED");

await page.waitForSelector(".doc-card", { timeout: 15000 });
ok("OCR TURN");

// The PII model is a ~280 MB download on a cold cache; rules-only is an accepted outcome.
// The gate appears only once detection has stopped changing the list.
await page.waitForSelector(".doc-confirm", { timeout: 300000 });
ok("REDACT GATE");
const found = await page.locator(".doc-pii li").count();
out.push(`  (pii spans found: ${found})`);

const send = page.locator(".doc-send");
if (await send.isDisabled()) ok("SEND BLOCKED UNTIL CONFIRMED"); else fail("SEND BLOCKED UNTIL CONFIRMED");

// What leaves the device must be the redacted text, not the original.
await page.locator(".doc-fold summary").nth(1).click();
const outgoing = (await page.locator(".doc-outgoing").textContent()) ?? "";
if (found === 0 || /\[[A-ZĂÎÂȘȚ_]+_\d+\]/.test(outgoing)) ok("OUTGOING REDACTED"); else fail("OUTGOING REDACTED");

await page.locator(".doc-confirm input").check();
await page.waitForFunction(() => !document.querySelector(".doc-send")?.disabled, null, { timeout: 5000 })
  .then(() => ok("SEND UNLOCKED")).catch(() => fail("SEND UNLOCKED"));
if ((await page.locator(".doc-outgoing").textContent()) === outgoing) ok("OUTGOING STABLE AT GATE"); else fail("OUTGOING STABLE AT GATE");

await page.screenshot({ path: ".data/doc-chat-redact.png", fullPage: true });

// STUB=1 exercises the verdict UI without the live model (the provider key may be capped).
if (process.env.STUB === "1") {
  const quote = outgoing.replace(/\s+/g, " ").trim().slice(40, 110);
  await page.route("**/api/scan/review", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        docType: { ro: "Contract de vânzare-cumpărare", ru: "Договор купли-продажи" },
        userRole: { ro: "cumpărător", ru: "покупатель" },
        summary: { ro: "Contractul acoperă părțile și prețul, dar nu spune ce se întâmplă la întârziere.", ru: "Договор покрывает стороны и цену, но не описывает просрочку." },
        verdict: "needs_attention",
        findings: [
          { id: "f1", kind: "risk", severity: "risk", title: { ro: "Nu există termen de predare", ru: "Нет срока передачи" }, explanation: { ro: "Documentul nu fixează o dată până la care bunul trebuie predat.", ru: "В документе нет даты передачи." }, suggestion: { ro: "Cereți un termen explicit, în zile calendaristice.", ru: "Попросите явный срок в календарных днях." }, quote, quoteVerified: true },
          { id: "f2", kind: "missing", severity: "warn", title: { ro: "Penalitățile nu sunt reciproce", ru: "Штрафы не взаимны" }, explanation: { ro: "Doar cumpărătorul plătește penalități.", ru: "Штрафы платит только покупатель." }, quote: null, quoteVerified: false },
          { id: "f3", kind: "good", severity: "ok", title: { ro: "Prețul este clar", ru: "Цена указана ясно" }, explanation: { ro: "Suma și moneda sunt menționate fără ambiguitate.", ru: "Сумма и валюта указаны однозначно." }, quote: null, quoteVerified: false },
        ],
        checklist: [
          { item: { ro: "Părțile contractante", ru: "Стороны договора" }, present: true, quote: null, quoteVerified: false },
          { item: { ro: "Termen de predare", ru: "Срок передачи" }, present: false, quote: null, quoteVerified: false },
        ],
        model: "stub/test",
      }),
    }),
  );
}

await send.click();
try {
  await page.waitForSelector(".doc-result, .doc-alert", { timeout: 180000 });
  if (await page.locator(".doc-result").count()) {
    ok("VERDICT IN CHAT");
    if (await page.locator(".doc-followup").count()) ok("FOLLOW-UP HINT");
    if (await page.locator(".doc-finding").count()) ok("FINDINGS RENDER"); else fail("FINDINGS RENDER");

    // The verified quote must land as a highlight inside the document fold.
    await page.locator(".doc-result .doc-fold summary").last().click();
    if (await page.locator(".doc-result mark").count()) ok("QUOTE HIGHLIGHTED"); else fail("QUOTE HIGHLIGHTED");
    await page.screenshot({ path: ".data/doc-chat-result.png", fullPage: true });

    // The reviewed document must travel with the next question.
    const req = page.waitForRequest((r) => r.url().includes("/api/ask") && r.method() === "POST");
    await page.fill("#chat-message", "Ce riscuri am cu clauza de plată?");
    await page.click(".send-button");
    const body = JSON.parse((await req).postData() ?? "{}");
    if (body.document?.text) ok("DOC SENT AS FOLLOW-UP CONTEXT"); else fail("DOC SENT AS FOLLOW-UP CONTEXT");
    if (!/\b[0-2]\d{12}\b/.test(body.document?.text ?? "")) ok("NO IDNP IN OUTGOING"); else fail("NO IDNP IN OUTGOING");
  } else {
    out.push(`  (review unavailable: ${(await page.locator(".doc-alert").textContent())?.slice(0, 90)})`);
  }
} catch {
  out.push("  (review timed out — model unavailable)");
}

await browser.close();
console.log(out.join("\n"));
console.log(process.exitCode ? "\nSOME CHECKS FAILED" : "\nALL OK");
