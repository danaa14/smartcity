export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokens(s: string): string[] {
  return normalize(s).split(" ").filter((t) => t.length > 1);
}

export function detectLang(s: string): "ro" | "ru" {
  const cyr = (s.match(/[Ѐ-ӿ]/g) || []).length;
  const lat = (s.match(/[a-zA-ZăâîșțşţĂÂÎȘȚ]/g) || []).length;
  return cyr > lat ? "ru" : "ro";
}

/** Collapses whitespace only; used to compare quotes against passages exactly. */
export function squash(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Removes obvious personal data before a question is stored for review. */
export function redact(s: string): string {
  return s
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .replace(/\+?\d[\d\s().-]{6,}\d/g, "[număr]")
    .replace(/\b\d{13}\b/g, "[IDNP]")
    .slice(0, 300);
}
