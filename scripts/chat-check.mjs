// Browser smoke test for the chat UI: streaming, corpus citations, general answers and refusals.
// Requires the dev server on :3100.  Run: node scripts/chat-check.mjs
import { chromium } from "playwright";

const BASE = "http://localhost:3100";
const TIMEOUT = 180000;
let fails = 0;
const ok = (name, detail = "") => console.log(`${name} OK${detail ? ` — ${detail}` : ""}`);
const fail = (name, detail) => {
  fails++;
  console.log(`${name} FAIL — ${detail}`);
};

const turns = (page) => page.locator(".chat-turn");
const lastTurn = (page) => turns(page).last();

/** Sends a question and waits until that turn stops showing the pending indicator. */
async function ask(page, text) {
  const before = await turns(page).count();
  await page.locator("textarea").fill(text);
  await page.locator("textarea").press("Enter");
  await page.waitForFunction((n) => document.querySelectorAll(".chat-turn").length > n, before, { timeout: 30000 });
  const turn = lastTurn(page);
  await turn.locator(".chat-answer, .chat-error").first().waitFor({ timeout: TIMEOUT });
  // The prose stream keeps mutating; settle once the answer element is final.
  await page.waitForFunction(
    () => {
      const t = document.querySelectorAll(".chat-turn");
      const last = t[t.length - 1];
      return !!last && (!!last.querySelector(".prose-answer, .compact-answer") || !!last.querySelector(".chat-error"));
    },
    undefined,
    { timeout: TIMEOUT },
  );
  return turn;
}

try {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("PAGE CRASH:", e.message));
  page.on("console", (m) => {
    if (m.type() === "error") console.log("PAGE ERROR:", m.text());
  });

  await page.goto(`${BASE}/intreaba`, { waitUntil: "domcontentloaded" });
  await page.locator("textarea").waitFor({ timeout: 20000 });

  // 1. Small talk — a plain reply, no citation card and no unverified warning.
  {
    const turn = await ask(page, "salut");
    const prose = await turn.locator(".prose-answer").count();
    const cards = await turn.locator(".compact-answer").count();
    const badge = await turn.locator(".unverified-badge").count();
    const text = (await turn.locator(".prose-answer").first().textContent().catch(() => "")) ?? "";
    if (prose === 1 && cards === 0 && badge === 0 && text.trim().length > 5) ok("SMALLTALK", text.trim().slice(0, 60));
    else fail("SMALLTALK", `prose=${prose} cards=${cards} badge=${badge} text="${text.slice(0, 60)}"`);
  }

  // 2. Corpus question — a cited answer carrying the current tariff.
  {
    const turn = await ask(page, "cat costa apa");
    const card = await turn.locator(".compact-answer").count();
    const text = (await turn.textContent()) ?? "";
    if (card === 1 && /14[.,]03/.test(text)) ok("CORPUS", "14,03 lei/m³ cited");
    else fail("CORPUS", `card=${card}, no current tariff in "${text.slice(0, 120)}"`);
  }

  // 3. Evidence is reachable from the cited answer.
  {
    const turn = lastTurn(page);
    const marker = turn.locator('button[aria-label^="Dovada"]').first();
    const found = await marker.waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
    if (found) {
      await marker.click();
      const quote = await page
        .locator("mark, blockquote")
        .first()
        .waitFor({ timeout: 10000 })
        .then(() => true)
        .catch(() => false);
      const dialog = page.locator("dialog[open]");
      if (await dialog.count()) await page.keyboard.press("Escape");
      quote ? ok("EVIDENCE") : fail("EVIDENCE", "citation opened but no quote rendered");
    } else fail("EVIDENCE", "no citation marker on the corpus answer");
  }

  // 4. Law question outside the corpus — answered, but clearly marked unverified.
  {
    const turn = await ask(page, "Cum contest o amenda de circulatie?");
    const prose = await turn.locator(".prose-answer").count();
    const badge = await turn.locator(".unverified-badge").count();
    const text = (await turn.locator(".prose-answer").first().textContent().catch(() => "")) ?? "";
    const answered = text.trim().length > 80 && !/nu pot|nu sunt construit/i.test(text);
    const clean = !text.includes("**");
    if (prose === 1 && badge === 1 && answered && clean) ok("LAW", `${text.trim().length} chars, badge shown`);
    else fail("LAW", `prose=${prose} badge=${badge} answered=${answered} cleanMarkdown=${clean} :: "${text.slice(0, 120)}"`);
  }

  // 5. Out-of-scope request is declined politely, without a citation card.
  {
    const turn = await ask(page, "scrie-mi un script python care sorteaza o lista");
    const cards = await turn.locator(".compact-answer").count();
    const badge = await turn.locator(".unverified-badge").count();
    const text = (await turn.locator(".prose-answer").first().textContent().catch(() => "")) ?? "";
    // A refusal asserts nothing, so it must not carry the verify-before-acting warning.
    if (cards === 0 && badge === 0 && /nu pot|nu scriu|nu generez|specializat/i.test(text)) ok("DECLINE", text.trim().slice(0, 60));
    else fail("DECLINE", `cards=${cards} badge=${badge} text="${text.slice(0, 100)}"`);
  }

  // 6. Follow-up keeps the subject from the previous turn.
  {
    await ask(page, "Ce acte pentru contractul de apa?");
    const turn = await ask(page, "si cat dureaza?");
    const text = ((await turn.textContent()) ?? "").toLowerCase();
    if (/apa|apă|contract|zile|termen/.test(text)) ok("FOLLOWUP", "kept the water-contract subject");
    else fail("FOLLOWUP", `lost context: "${text.slice(0, 120)}"`);
  }

  await browser.close();
} catch (e) {
  fail("RUN", e.message.split("\n")[0]);
}

console.log(fails ? `\n${fails} check(s) failed` : "\nALL CHECKS OK");
process.exit(fails ? 1 : 0);
