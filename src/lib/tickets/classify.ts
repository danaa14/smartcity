import { normalize, tokens } from "../text";
import { CATEGORIES, type CategoryId } from "./types";

/** Keyword suggestion only — the user always confirms or changes the category. */
export function suggestCategory(text: string): { id: CategoryId; matched: string[] } | null {
  const t = tokens(text);
  let best: { id: CategoryId; matched: string[] } | null = null;
  for (const c of CATEGORIES) {
    const matched = c.cues.filter((cue) => t.some((w) => w.startsWith(normalize(cue))));
    if (matched.length && (!best || matched.length > best.matched.length)) best = { id: c.id, matched };
  }
  return best;
}

/** Tidies a free-text description into one short sentence without adding facts. */
export function suggestDescription(text: string): string {
  const s = text.replace(/\s+/g, " ").trim();
  if (!s) return "";
  const first = s.charAt(0).toUpperCase() + s.slice(1);
  const cut = first.length > 280 ? first.slice(0, 277).replace(/\s\S*$/, "") + "…" : first;
  return /[.!?…]$/.test(cut) ? cut : cut + ".";
}
