// Renders every Annex 1 start URL not yet covered by hand-curated docs (home page + contact page),
// saves raw snapshots to corpus/raw/ and writes citable passages to corpus/annex-ingest.json.
// Run: node scripts/ingest-annex.mjs   (dev server not required)
import { chromium } from "playwright";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const probe = JSON.parse(readFileSync("corpus/annex-probe.json", "utf8"));
const curated = new Set(["https://chisinau.md/", "https://www.acc.md/", "https://autosalubritate.md/informatie-de-contact/", "https://agsv.md/diagrama-defrisare-curatare-a-arborilor-2/"]);
const targets = probe.filter((r) => !curated.has(r.startUrl));
const today = new Date().toISOString().slice(0, 10);
const MAX_PASSAGES = 30;
const CONTACTISH = /(\+373|\b0\s?22\b|\btel\b|телефон|e-?mail|@[\w-]+\.\w|str\.|bd\.|ул\.|адрес|adresa|program(ul)? de lucru|график)/i;

mkdirSync("corpus/raw", { recursive: true });

const slugOf = (url) =>
  "ax-" + url.replace(/^https?:\/\/(www\.)?/, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 60);

const cleanTitle = (t) => (t ?? "").replace(/\s+/g, " ").trim();

function toLines(text) {
  const out = [];
  for (const raw of text.split("\n")) {
    const l = raw.replace(/[ \t ]+/g, " ").trim();
    if (l && out[out.length - 1] !== l) out.push(l);
  }
  return out;
}

function chunk(lines) {
  const chunks = [];
  let cur = [];
  const flush = () => {
    if (cur.length) chunks.push(cur);
    cur = [];
  };
  for (const l of lines) {
    cur.push(l);
    if (cur.join(" ").length >= 350) flush();
  }
  flush();
  const seen = new Set();
  return chunks
    .map((c) => ({ text: c.join(" "), avg: c.reduce((s, l) => s + l.length, 0) / c.length }))
    .filter((c) => c.text.length >= 80 && (c.avg >= 30 || CONTACTISH.test(c.text)))
    .filter((c) => !seen.has(c.text) && seen.add(c.text))
    .slice(0, MAX_PASSAGES)
    .map((c) => c.text);
}

const langOf = (text) => ((text.match(/[Ѐ-ӿ]/g) ?? []).length > text.length * 0.3 ? "ru" : "ro");

async function capture(ctx, url) {
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const data = await page.evaluate(() => {
      document.querySelectorAll("script,style,noscript,svg,iframe").forEach((e) => e.remove());
      const links = [...document.querySelectorAll("a[href]")].map((a) => ({ href: a.href, text: (a.textContent || "").trim() }));
      return { title: document.title, text: document.body?.innerText ?? "", links };
    });
    return { ...data, html: await page.content(), finalUrl: page.url() };
  } finally {
    await page.close();
  }
}

function findContact(home, startUrl) {
  const host = new URL(home.finalUrl).hostname.replace(/^www\./, "");
  const candidates = home.links.filter((l) => {
    try {
      const u = new URL(l.href);
      return u.hostname.replace(/^www\./, "") === host && /contact|контакт/i.test(l.href + " " + l.text) && l.href.split("#")[0] !== startUrl;
    } catch {
      return false;
    }
  });
  const foreign = /\/(uk|ru|en)\//i;
  return (candidates.find((l) => !foreign.test(l.href)) ?? candidates[0])?.href.split("#")[0];
}

function save(slug, url, cap) {
  const lines = toLines(cap.text);
  writeFileSync(`corpus/raw/${slug}.html`, cap.html);
  writeFileSync(`corpus/raw/${slug}.txt`, lines.join("\n"));
  writeFileSync(`corpus/raw/${slug}.meta.json`, JSON.stringify({ slug, url, finalUrl: cap.finalUrl, title: cleanTitle(cap.title), retrievedAt: new Date().toISOString() }));
  return lines;
}

function makeDoc(r, id, url, cap, lines, kind, publisher) {
  const passages = chunk(lines);
  const lang = langOf(lines.join(" "));
  const isHome = kind === "home";
  return {
    doc: {
      id,
      kind: "real",
      title: cleanTitle(cap.title) || url,
      url: cap.finalUrl || url,
      publisher,
      annexCategory: r.category,
      annexStartUrl: r.startUrl,
      lang,
      docType: isHome ? { ro: "Pagină principală (preluare automată)", ru: "Главная страница (автоматическая загрузка)" } : { ro: "Pagină de contact (preluare automată)", ru: "Страница контактов (автоматическая загрузка)" },
      retrievedAt: today,
      status: "unknown",
      statusNote: {
        ro: "Preluată automat din Anexa 1. Pagina nu afișează data publicării sau a ultimei actualizări; valabilitatea curentă nu poate fi stabilită din corpus.",
        ru: "Загружено автоматически из Приложения 1. На странице не указана дата публикации или обновления; текущую действительность нельзя установить по корпусу.",
      },
      rawFile: `corpus/raw/${id}.txt`,
    },
    passages: passages.map((text, i) => ({
      id: `${id}#f${i + 1}`,
      docId: id,
      locator: { ro: `Fragmentul ${i + 1} al paginii`, ru: `Фрагмент ${i + 1} страницы` },
      lang,
      text,
    })),
  };
}

async function ingest(ctx, r) {
  const id = slugOf(r.startUrl);
  const home = await capture(ctx, r.startUrl);
  const publisher = cleanTitle(home.title).split(/\s[|–—-]\s/)[0] || new URL(r.startUrl).hostname;
  const out = [makeDoc(r, id, r.startUrl, home, save(id, r.startUrl, home), "home", publisher)];
  const contactUrl = findContact(home, r.startUrl);
  if (contactUrl) {
    try {
      const c = await capture(ctx, contactUrl);
      const cid = `${id}-contact`;
      out.push(makeDoc(r, cid, contactUrl, c, save(cid, contactUrl, c), "contact", publisher));
    } catch (e) {
      console.warn(`  contact page failed for ${r.startUrl}: ${e.message.split("\n")[0]}`);
    }
  }
  return out;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ ignoreHTTPSErrors: true, locale: "ro-MD", userAgent: "Mozilla/5.0 (pe-fir prototype research) Chrome/140" });
const results = [];
const failed = [];
const queue = [...targets];
await Promise.all(
  Array.from({ length: 6 }, async () => {
    for (let r; (r = queue.shift()); ) {
      try {
        const docs = await ingest(ctx, r);
        results.push(...docs);
        console.log(`✓ ${r.startUrl} → ${docs.map((d) => `${d.doc.id} (${d.passages.length})`).join(", ")}`);
      } catch (e) {
        failed.push({ startUrl: r.startUrl, error: e.message.split("\n")[0] });
        console.error(`✗ ${r.startUrl}: ${e.message.split("\n")[0]}`);
      }
    }
  }),
);
await browser.close();

const order = new Map(targets.map((r, i) => [r.startUrl, i]));
results.sort((a, b) => order.get(a.doc.annexStartUrl) - order.get(b.doc.annexStartUrl) || a.doc.id.localeCompare(b.doc.id));
const seenUrls = new Set();
const kept = results.filter((d) => d.passages.length && !seenUrls.has(d.doc.url) && seenUrls.add(d.doc.url));
writeFileSync(
  "corpus/annex-ingest.json",
  JSON.stringify({ generatedAt: new Date().toISOString(), failed, docs: kept.map((d) => d.doc), passages: kept.flatMap((d) => d.passages) }, null, 1),
);
console.log(`\n${kept.length} docs, ${kept.reduce((s, d) => s + d.passages.length, 0)} passages; ${results.length - kept.length} pages without citable text; ${failed.length} failed.`);
