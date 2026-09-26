import "server-only";
import type { Answer } from "../answer/types";

export interface WebResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Institutions only. Any `.md` host used to qualify, which surfaced private law firms as
 * places to "verify" an answer — exactly the authority this app must not lend out.
 */
const OFFICIAL = [
  "gov.md", "chisinau.md", "acc.md", "anre.md", "autosalubritate.md", "agsv.md", "autourban.md",
  "cnas.md", "cnam.md", "fisc.md", "sfs.md", "politia.md", "legis.md", "parlament.md",
  "presedinte.md", "justice.md", "ms.md", "e-licitatie.md", "dgets.md", "cec.md", "anofm.md",
  "bnm.md", "statistica.md", "instante.justice.md", "csm.md", "avocatul-poporului.md",
];

const TIMEOUT_MS = 8000;

function trusted(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return OFFICIAL.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

/**
 * Attach web results ONLY when the corpus came up empty (status missing).
 * Everything else passes through untouched — the corpus stays the authority.
 */
export async function withWebFallback(answer: Answer, question: string): Promise<Answer> {
  if (answer.status !== "missing" || answer.web) return answer;
  const web = await webSearch(question);
  if (!web.length) return answer;
  console.log(`[web] attached ${web.length} results to missing answer`);
  return { ...answer, web };
}

/** Web search via DuckDuckGo Lite (no API key). Call only via withWebFallback. */
export async function webSearch(query: string, limit = 3): Promise<WebResult[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const t0 = Date.now();
  try {
    const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;
    const r = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; pe-fir/0.1; +https://localhost)" },
      signal: ctrl.signal,
    });
    if (!r.ok) {
      console.warn(`[web] search http=${r.status} ms=${Date.now() - t0}`);
      return [];
    }
    const html = await r.text();
    const out: WebResult[] = [];
    const seen = new Set<string>();
    // lite DDG markup: <a rel="nofollow" href="REDIRECT">title</a> ... <td class='result-snippet'>text</td>
    const linkRe = /<a[^>]*rel="nofollow"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    const snipRe = /class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/g;
    const links: { href: string; title: string; rank: number }[] = [];
    let m: RegExpExecArray | null;
    let rank = 0;
    while ((m = linkRe.exec(html))) {
      const raw = m[1];
      const title = m[2].replace(/<[^>]+>/g, "").trim().slice(0, 160);
      let href = raw;
      const u = raw.match(/[?&]uddg=([^&]+)/);
      if (u) {
        try {
          href = decodeURIComponent(u[1]);
        } catch {
          continue;
        }
      }
      if (href.startsWith("//duckduckgo.com") || href.startsWith("/") || !/^https?:\/\//i.test(href)) continue;
      if (!title || seen.has(href)) continue;
      seen.add(href);
      // Each result row is one link followed by one snippet, so position pairs them.
      links.push({ href, title, rank: rank++ });
    }
    const snips: string[] = [];
    while ((m = snipRe.exec(html))) snips.push(m[1].replace(/<[^>]+>/g, "").trim().slice(0, 280));
    // Only institutional sources: an unofficial link shown as "verify here" is worse than none.
    for (const l of links.filter((x) => trusted(x.href)).slice(0, limit)) {
      out.push({ title: l.title, url: l.href, snippet: snips[l.rank] ?? "" });
    }
    console.log(`[web] search q=${JSON.stringify(query.slice(0, 80))} results=${out.length} ms=${Date.now() - t0}`);
    return out;
  } catch (e) {
    console.warn(`[web] search fail ms=${Date.now() - t0} err=${e instanceof Error ? e.message.slice(0, 80) : String(e)}`);
    return [];
  } finally {
    clearTimeout(timer);
  }
}
